import { NextResponse } from "next/server";
import { getPracticeItem } from "@/lib/data/practice";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RUNNER = process.env.SPARK_RUNNER_URL || "http://localhost:4000";

/**
 * Proxy to the local PySpark runner (server-side, local mode). If the runner
 * isn't reachable, returns { unavailable: true } so the UI falls back to AI-eval.
 *
 * The reference solution is resolved server-side from problemId so it never
 * ships to (or is sent by) the client; sampleData is public (shown to the user).
 */
export async function POST(req: Request) {
  let body: { code?: string; problemId?: string; reference?: string; sampleData?: unknown; orderMatters?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  let payload: unknown = body;
  if (body.problemId) {
    const it = getPracticeItem(body.problemId);
    if (it && it.category !== "sql" && it.sparkExec) {
      payload = {
        code: body.code,
        reference: it.sparkExec.reference,
        sampleData: it.sparkExec.sampleData,
        orderMatters: it.sparkExec.orderMatters,
      };
    }
  }

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 30_000);
    const res = await fetch(`${RUNNER}/run`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return NextResponse.json({ unavailable: true });
    return NextResponse.json(await res.json());
  } catch {
    return NextResponse.json({
      unavailable: true,
      message: "Spark runner isn't running — use Get feedback (AI) instead, or start it with scripts/dev.sh.",
    });
  }
}
