import "server-only";
import { runSql, type GridResult } from "./duckdb-node";
import { getPracticeProblem } from "@/lib/data/practice";
import { getAdversarialCase } from "@/lib/data/practice/adversarial.server";

/**
 * Server-side SQL grading for the adversarial wedge.
 *
 * Runs the candidate's query against the VISIBLE sample dataset (the result a
 * free user already sees) and, when one exists, a HIDDEN adversarial dataset
 * engineered to break the common mistake. The hidden data and reference answer
 * never leave the server. Execution uses a fresh in-memory DuckDB per call.
 */

export type { GridResult };

const run = runSql;

interface CaseGrade {
  correct: boolean;
  error: string | null;
  mine: GridResult;
  expected: GridResult | null;
}

export type HiddenOutcome =
  | { status: "none" } // no adversarial case authored for this question
  | { status: "pass" } // candidate's answer is robust
  | { status: "locked"; name: string; failedCount: number } // free user: itch, no detail
  | {
      status: "fail";
      name: string;
      explanation: string;
      yourRows: unknown[][];
      expectedRows: unknown[][];
      columns: string[];
    };

export interface AdversarialGrade {
  sample: { correct: boolean; error: string | null; columns: string[]; rows: unknown[][]; expectedColumns: string[]; expectedRows: unknown[][] };
  hidden: HiddenOutcome;
}

/** Mirror of the client diff (components/practice/duckdb.ts) so verdicts agree. */
function norm(v: unknown): string {
  if (v === null || v === undefined) return "∅";
  if (typeof v === "bigint") return v.toString();
  if (typeof v === "number")
    return Number.isInteger(v) ? v.toString() : v.toFixed(4).replace(/0+$/, "").replace(/\.$/, "");
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const s = String(v);
  if (/^-?\d+\.\d+$/.test(s)) return parseFloat(s).toFixed(4).replace(/0+$/, "").replace(/\.$/, "");
  return s;
}

function rowsEqual(a: unknown[][], b: unknown[][], orderMatters: boolean): boolean {
  if (a.length !== b.length) return false;
  const A = a.map((r) => r.map(norm));
  const B = b.map((r) => r.map(norm));
  const key = (r: string[]) => r.join("");
  if (orderMatters) return A.every((r, i) => key(r) === key(B[i]));
  const sa = A.map(key).sort();
  const sb = B.map(key).sort();
  return sa.every((x, i) => x === sb[i]);
}

async function gradeOn(
  setup: string,
  userSql: string,
  reference: string,
  orderMatters: boolean
): Promise<CaseGrade> {
  const mine = await run(setup, userSql);
  if (mine.error) return { correct: false, error: mine.error, mine, expected: null };
  const expected = await run(setup, reference);
  if (expected.error) return { correct: false, error: expected.error, mine, expected };
  return { correct: rowsEqual(mine.rows, expected.rows, orderMatters), error: null, mine, expected };
}

/**
 * Grade a SQL submission. `isPro` controls whether the hidden failure detail is
 * revealed or returned as a locked teaser (the paywall moment).
 */
export async function gradeSqlAdversarial(
  problemId: string,
  userSql: string,
  isPro: boolean
): Promise<AdversarialGrade> {
  const problem = getPracticeProblem(problemId);
  if (!problem) throw new Error(`unknown problem: ${problemId}`);

  // 1) Visible sample — the result a free user already gets in-browser today.
  const sampleGrade = await gradeOn(problem.setupSql, userSql, problem.referenceSolution, problem.orderMatters);
  const sample = {
    correct: sampleGrade.correct,
    error: sampleGrade.error,
    columns: sampleGrade.mine.columns,
    rows: sampleGrade.mine.rows,
    expectedColumns: sampleGrade.expected?.columns ?? [],
    expectedRows: sampleGrade.expected?.rows ?? [],
  };

  // 2) Hidden adversarial case (if authored).
  const adv = getAdversarialCase(problemId);
  if (!adv) return { sample, hidden: { status: "none" } };

  const hiddenGrade = await gradeOn(adv.hiddenSetupSql, userSql, adv.referenceSolution, adv.orderMatters);
  if (hiddenGrade.correct) return { sample, hidden: { status: "pass" } };

  if (!isPro) {
    return { sample, hidden: { status: "locked", name: adv.name, failedCount: 1 } };
  }

  return {
    sample,
    hidden: {
      status: "fail",
      name: adv.name,
      explanation: adv.explanation,
      yourRows: hiddenGrade.mine.error ? [] : hiddenGrade.mine.rows,
      expectedRows: hiddenGrade.expected?.rows ?? [],
      columns: hiddenGrade.expected?.columns ?? [],
    },
  };
}
