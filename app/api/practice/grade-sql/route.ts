import { NextResponse } from "next/server";
import { gradeSqlAdversarial } from "@/lib/practice/adversarial-grade";
import { jsonSafe } from "@/lib/practice/duckdb-node";
import { getCurrentUser } from "@/lib/entitlements";
import { rateLimit, clientKey } from "@/lib/rate-limit";
import { geminiGenerate } from "@/lib/gemini";
import { hasGemini } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Body {
  problemId: string;
  userSql: string;
}

function fmtRows(columns: string[], rows: unknown[][]): string {
  if (!rows.length) return "(0 rows)";
  const head = columns.join(" | ");
  const body = rows.slice(0, 20).map((r) => r.map((c) => (c === null ? "NULL" : String(c))).join(" | "));
  return [head, ...body].join("\n");
}

export async function POST(req: Request) {
  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  if (!body?.problemId || typeof body.userSql !== "string") {
    return NextResponse.json({ error: "problemId and userSql required" }, { status: 400 });
  }

  const user = await getCurrentUser();
  const isPro = user.practicePro || user.hasFullBundle || user.isDemo;

  // Rate-limit to blunt brute-forcing the hidden-test oracle (esp. free users
  // probing pass/fail to infer hidden rows). Pro users get a higher ceiling.
  const rl = rateLimit(clientKey(user.id, req), isPro ? 60 : 20, 60_000, Date.now());
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many submissions — slow down a moment." },
      { status: 429, headers: { "retry-after": String(rl.retryAfter) } }
    );
  }

  let grade;
  try {
    grade = await gradeSqlAdversarial(body.problemId, body.userSql, isPro);
  } catch (e) {
    return NextResponse.json({ error: String((e as Error)?.message ?? e) }, { status: 404 });
  }

  // For Pro users who failed the hidden case, ground the explanation in the
  // actual diff with the AI coach (falls back to the static trap explanation).
  if (grade.hidden.status === "fail" && hasGemini) {
    try {
      const h = grade.hidden;
      const ai = await geminiGenerate({
        system:
          "You are a senior SQL interviewer. A candidate's query passed the visible sample but FAILED a hidden edge-case dataset. " +
          "In 2-3 sentences, explain the bug concretely and name the null-safe fix. Be specific and grounded in the rows shown; do not hedge.",
        messages: [
          {
            role: "user",
            content:
              `Candidate SQL:\n${body.userSql}\n\n` +
              `Their output on hidden data:\n${fmtRows(h.columns, h.yourRows)}\n\n` +
              `Expected output:\n${fmtRows(h.columns, h.expectedRows)}\n\n` +
              `Edge case under test: ${h.name}.`,
          },
        ],
        maxTokens: 220,
      });
      if (ai && ai.trim()) grade = { ...grade, hidden: { ...h, explanation: ai.trim() } };
    } catch {
      /* keep the static explanation */
    }
  }

  return NextResponse.json(jsonSafe({ isPro, ...grade }));
}
