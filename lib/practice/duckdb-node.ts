import "server-only";
import { DuckDBInstance } from "@duckdb/node-api";
import { splitSqlStatements } from "./sql-split";

/** Server-side DuckDB execution for grading. Shared by the practice API routes. */
export interface GridResult {
  columns: string[];
  rows: unknown[][];
  error: string | null;
}

/** Run `setup` (CREATE/INSERT) then `sql` in a fresh in-memory DuckDB. */
export async function runSql(setup: string, sql: string): Promise<GridResult> {
  const inst = await DuckDBInstance.create(":memory:");
  const con = await inst.connect();
  try {
    for (const stmt of splitSqlStatements(setup)) await con.run(stmt);
    const reader = await con.runAndReadAll(sql);
    return { columns: reader.columnNames(), rows: reader.getRows(), error: null };
  } catch (e) {
    return { columns: [], rows: [], error: String((e as Error)?.message ?? e) };
  }
}

/** BigInt isn't JSON-serializable — DuckDB returns it for integer columns. */
export function jsonSafe<T>(v: T): T {
  return JSON.parse(JSON.stringify(v, (_k, val) => (typeof val === "bigint" ? Number(val) : val)));
}
