"use client";

import { splitSqlStatements } from "@/lib/practice/sql-split";

// DuckDB-WASM client. Loads lazily in the browser (CDN bundle + blob worker),
// so it never touches the server bundle. Used to actually run candidate SQL and
// diff it against the reference for true correctness.
import type { PracticeProblem } from "@/lib/data/practice";

export interface QueryResult {
  columns: string[];
  rows: unknown[][];
  error?: string;
}

export interface CheckResult extends QueryResult {
  correct: boolean;
  message: string;
  expected?: { columns: string[]; rows: unknown[][] };
}

/* eslint-disable @typescript-eslint/no-explicit-any */
let dbPromise: Promise<any> | null = null;

async function getDb(): Promise<any> {
  if (dbPromise) return dbPromise;
  dbPromise = (async () => {
    const duckdb = await import("@duckdb/duckdb-wasm");
    const bundles = duckdb.getJsDelivrBundles();
    const bundle = await duckdb.selectBundle(bundles);
    const workerUrl = URL.createObjectURL(
      new Blob([`importScripts("${bundle.mainWorker}");`], {
        type: "text/javascript",
      })
    );
    const worker = new Worker(workerUrl);
    const logger = new duckdb.ConsoleLogger(duckdb.LogLevel.WARNING);
    const db = new duckdb.AsyncDuckDB(logger, worker);
    await db.instantiate(bundle.mainModule, bundle.pthreadWorker ?? undefined);
    URL.revokeObjectURL(workerUrl);
    return db;
  })();
  return dbPromise;
}

/** Split a setup script into statements and make table creation idempotent. */
function setupStatements(setupSql: string): string[] {
  return splitSqlStatements(setupSql.replace(/CREATE TABLE/gi, "CREATE OR REPLACE TABLE"));
}

function toResult(table: any): QueryResult {
  const columns: string[] = table.schema.fields.map((f: any) => f.name);
  const rows: unknown[][] = table
    .toArray()
    .map((r: any) => columns.map((c) => r[c]));
  return { columns, rows };
}

export async function runQuery(
  setupSql: string,
  sql: string
): Promise<QueryResult> {
  try {
    const db = await getDb();
    const conn = await db.connect();
    try {
      for (const stmt of setupStatements(setupSql)) await conn.query(stmt);
      const table = await conn.query(sql);
      return toResult(table);
    } finally {
      await conn.close();
    }
  } catch (e: any) {
    return { columns: [], rows: [], error: String(e?.message ?? e) };
  }
}

/** Normalize a cell for comparison: numbers rounded, dates ISO, null sentinel. */
function norm(v: unknown): string {
  if (v === null || v === undefined) return "∅";
  if (typeof v === "bigint") return v.toString();
  if (typeof v === "number")
    return Number.isInteger(v) ? v.toString() : v.toFixed(4).replace(/0+$/, "").replace(/\.$/, "");
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  // DuckDB sometimes returns Decimal-like objects / typed values — stringify.
  const s = String(v);
  // Try to treat numeric strings consistently
  if (/^-?\d+\.\d+$/.test(s)) return parseFloat(s).toFixed(4).replace(/0+$/, "").replace(/\.$/, "");
  return s;
}

function rowsEqual(a: unknown[][], b: unknown[][], orderMatters: boolean): boolean {
  if (a.length !== b.length) return false;
  if (a[0]?.length !== b[0]?.length && a.length > 0) return false;
  const A = a.map((r) => r.map(norm));
  const B = b.map((r) => r.map(norm));
  const key = (r: string[]) => r.join("");
  if (orderMatters) {
    return A.every((r, i) => key(r) === key(B[i]));
  }
  const sa = A.map(key).sort();
  const sb = B.map(key).sort();
  return sa.every((x, i) => x === sb[i]);
}

export async function runAndCheck(
  problem: PracticeProblem,
  userSql: string
): Promise<CheckResult> {
  const mine = await runQuery(problem.setupSql, userSql);
  if (mine.error) {
    return { ...mine, correct: false, message: "Your query errored." };
  }
  const ref = await runQuery(problem.setupSql, problem.referenceSolution);
  if (ref.error) {
    return {
      ...mine,
      correct: false,
      message:
        "Couldn't evaluate (reference query failed): " + ref.error,
    };
  }
  const correct = rowsEqual(mine.rows, ref.rows, problem.orderMatters);
  return {
    ...mine,
    correct,
    expected: { columns: ref.columns, rows: ref.rows },
    message: correct
      ? "Correct — your result matches the expected output."
      : problem.orderMatters
        ? "Not a match yet — check the values AND the row order."
        : "Not a match yet — the set of rows differs from expected.",
  };
}
