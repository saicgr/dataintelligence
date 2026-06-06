#!/usr/bin/env node
/**
 * SPIKE — adversarial SQL grading ("looks right, but watch this").
 *
 * Proves the wedge end-to-end with a real DuckDB engine, no app server needed:
 *   1. A candidate's SQL is graded against a VISIBLE sample dataset (free tier).
 *   2. The same SQL is graded against a HIDDEN adversarial dataset engineered to
 *      break the most common mistake for this question.
 *   3. We print what each tier of user would see: free users learn they failed a
 *      hidden case (the itch); Pro users see the failing rows + why.
 *
 * Question used: "Customers who never ordered" — the canonical NOT IN / NULL trap.
 *   - Naive answer:  WHERE id NOT IN (SELECT customer_id FROM orders)
 *   - Correct answer: LEFT JOIN ... WHERE o.id IS NULL  (or NOT EXISTS)
 * The naive answer PASSES the clean sample but returns 0 rows on hidden data that
 * contains an order with a NULL customer_id.
 *
 * Run:  node scripts/spike_adversarial.mjs
 */
import { DuckDBInstance } from "@duckdb/node-api";

// ── Public sample (shipped to the browser today, shown free) ─────────────────
const SAMPLE_SETUP = `CREATE TABLE customers (id INTEGER, name VARCHAR);
CREATE TABLE orders (id INTEGER, customer_id INTEGER, amount DOUBLE);
INSERT INTO customers VALUES (1,'Ava'),(2,'Ben'),(3,'Cleo'),(4,'Dina'),(5,'Eli');
INSERT INTO orders VALUES (10,1,50),(11,1,20),(12,3,75),(13,5,10);`;

// ── Hidden adversarial dataset (server-only; never leaves the server) ────────
// Same shape, but one order has a NULL customer_id — a real-world dirty FK.
const HIDDEN_SETUP = `CREATE TABLE customers (id INTEGER, name VARCHAR);
CREATE TABLE orders (id INTEGER, customer_id INTEGER, amount DOUBLE);
INSERT INTO customers VALUES (1,'Ava'),(2,'Ben'),(3,'Cleo'),(4,'Dina'),(5,'Eli');
INSERT INTO orders VALUES (10,1,50),(11,1,20),(12,3,75),(13,5,10),(14,NULL,99);`;

const REFERENCE = `SELECT c.id, c.name
FROM customers c
LEFT JOIN orders o ON o.customer_id = c.id
WHERE o.id IS NULL
ORDER BY c.id;`;

const ORDER_MATTERS = true;

const TRAP = {
  name: "NULL foreign key",
  explanation:
    "The orders table has a row with a NULL customer_id. `NOT IN (… NULL …)` " +
    "evaluates to UNKNOWN for every customer, so the filter keeps no rows. Use " +
    "NOT EXISTS or a LEFT JOIN … WHERE o.id IS NULL — both are null-safe.",
};

// Two candidate submissions to contrast.
const NAIVE = `SELECT id, name
FROM customers
WHERE id NOT IN (SELECT customer_id FROM orders)
ORDER BY id;`;

const CORRECT = `SELECT c.id, c.name
FROM customers c
WHERE NOT EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = c.id)
ORDER BY c.id;`;

// ── Engine ───────────────────────────────────────────────────────────────────
function splitStatements(sql) {
  return sql
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
}

function norm(v) {
  if (v === null || v === undefined) return "∅";
  if (typeof v === "bigint") return v.toString();
  if (typeof v === "number")
    return Number.isInteger(v) ? v.toString() : v.toFixed(4).replace(/0+$/, "").replace(/\.$/, "");
  const s = String(v);
  if (/^-?\d+\.\d+$/.test(s)) return parseFloat(s).toFixed(4).replace(/0+$/, "").replace(/\.$/, "");
  return s;
}

function rowsEqual(a, b, orderMatters) {
  if (a.length !== b.length) return false;
  const A = a.map((r) => r.map(norm));
  const B = b.map((r) => r.map(norm));
  const key = (r) => r.join("");
  if (orderMatters) return A.every((r, i) => key(r) === key(B[i]));
  const sa = A.map(key).sort();
  const sb = B.map(key).sort();
  return sa.length === sb.length && sa.every((x, i) => x === sb[i]);
}

async function run(setup, sql) {
  const inst = await DuckDBInstance.create(":memory:");
  const con = await inst.connect();
  try {
    for (const stmt of splitStatements(setup)) await con.run(stmt);
    const reader = await con.runAndReadAll(sql);
    return { columns: reader.columnNames(), rows: reader.getRows(), error: null };
  } catch (e) {
    return { columns: [], rows: [], error: String(e?.message ?? e) };
  } finally {
    con.closeSync?.();
  }
}

async function gradeOn(setup, userSql) {
  const mine = await run(setup, userSql);
  if (mine.error) return { correct: false, error: mine.error, mine, expected: null };
  const ref = await run(setup, REFERENCE);
  const correct = rowsEqual(mine.rows, ref.rows, ORDER_MATTERS);
  return { correct, error: null, mine, expected: ref };
}

function fmt(rows) {
  return rows.length ? rows.map((r) => "      " + r.map((c) => (c === null ? "NULL" : String(c))).join(" | ")).join("\n") : "      (0 rows)";
}

async function gradeSubmission(label, userSql, isPro) {
  console.log(`\n━━━ ${label} ━━━`);
  console.log(userSql.replace(/\n/g, "\n  ").replace(/^/, "  "));

  const sample = await gradeOn(SAMPLE_SETUP, userSql);
  console.log(`\n  Sample case:  ${sample.correct ? "✓ PASS" : "✗ FAIL"}  (this is what runs free today)`);

  const hidden = await gradeOn(HIDDEN_SETUP, userSql);

  if (hidden.correct) {
    console.log(`  Hidden suite: ✓ PASS — solution is robust.`);
    return;
  }

  // Hidden case failed — the conversion moment.
  if (!isPro) {
    console.log(`  Hidden suite: 🔒 1 hidden case FAILED — "${TRAP.name}"`);
    console.log(`                Unlock with Practice Pro to see the failing rows + why.`);
    console.log(`                [ FREE-TIER VIEW: itch created, detail withheld ]`);
  } else {
    console.log(`  Hidden suite: ✗ FAIL — "${TRAP.name}"  [ PRO VIEW ]`);
    console.log(`\n  Your output on hidden data:`);
    console.log(fmt(sample.error ? [] : hidden.mine.rows));
    console.log(`  Expected:`);
    console.log(fmt(hidden.expected.rows));
    console.log(`\n  Why it broke:\n      ${TRAP.explanation}`);
  }
}

console.log("=".repeat(72));
console.log('SPIKE: adversarial grading — "Customers who never ordered"');
console.log("=".repeat(72));

await gradeSubmission("Naive answer (NOT IN) — seen by a FREE user", NAIVE, false);
await gradeSubmission("Naive answer (NOT IN) — seen by a PRO user", NAIVE, true);
await gradeSubmission("Correct answer (NOT EXISTS)", CORRECT, true);

console.log("\n" + "=".repeat(72));
console.log("Takeaway: the naive query looks right (passes the visible sample) but");
console.log("silently fails on a NULL FK. That gap is the product — and the paywall.");
console.log("=".repeat(72));
