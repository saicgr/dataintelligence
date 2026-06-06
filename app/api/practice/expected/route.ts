import { NextResponse } from "next/server";
import { getPracticeProblem } from "@/lib/data/practice";
import { runSql, jsonSafe } from "@/lib/practice/duckdb-node";
import { getCurrentUser } from "@/lib/entitlements";
import { rateLimit, clientKey } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Returns the EXPECTED OUTPUT (columns + rows) of a SQL problem's reference on
 * its sample data — for the "Sample input & output" toggle. The expected output
 * is already shown to users, so it isn't secret; the reference SQL text is not
 * returned here (that's gated behind /api/practice/solution).
 */
export async function POST(req: Request) {
  let body: { problemId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  const problem = body?.problemId ? getPracticeProblem(body.problemId) : null;
  if (!problem) return NextResponse.json({ error: "unknown problem" }, { status: 404 });

  const user = await getCurrentUser();
  const rl = rateLimit(clientKey(user.id, req), 60, 60_000, Date.now());
  if (!rl.ok) return NextResponse.json({ error: "rate limited" }, { status: 429, headers: { "retry-after": String(rl.retryAfter) } });

  const out = await runSql(problem.setupSql, problem.referenceSolution);
  if (out.error) return NextResponse.json({ error: "could not compute expected output" }, { status: 500 });
  return NextResponse.json(jsonSafe({ columns: out.columns, rows: out.rows }));
}
