import { NextResponse } from "next/server";
import { geminiGenerate } from "@/lib/gemini";
import { hasGemini } from "@/lib/env";
import { getPracticeItem } from "@/lib/data/practice";
import { getReviewScenario } from "@/lib/data/practice/review-scenarios.server";
import { getIncidentScenario } from "@/lib/data/practice/incidents.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Body {
  problemId: string;
  approach: string;
}

/** Build a short, server-only "where a strong approach is heading" hint by problemId.
 *  Used to JUDGE the candidate's plan — never returned to the client. */
function referenceFor(problemId: string): { prompt: string; category: string; reference: string } | null {
  const it = getPracticeItem(problemId);
  if (!it) return null;
  if (it.category === "sql") {
    return { prompt: it.prompt, category: "sql", reference: `A correct query roughly looks like: ${it.referenceSolution}` };
  }
  if (it.category === "incident" && it.incident) {
    const sc = getIncidentScenario(problemId);
    return {
      prompt: it.incident.brief,
      category: "incident",
      reference: sc
        ? `Diagnosed root cause: ${sc.actualRootCause}. ${sc.redHerrings?.length ? `Plausible-but-WRONG leads to avoid: ${sc.redHerrings.join("; ")}. ` : ""}A strong plan investigates with data before concluding and heads toward this cause.`
        : "A strong plan investigates the artifacts/data before committing to a cause.",
    };
  }
  const review = getReviewScenario(problemId);
  if (review) {
    return { prompt: it.prompt, category: it.category, reference: `Key issues to surface: ${review.issues.map((i) => i.topic).join("; ")}.` };
  }
  return { prompt: it.prompt, category: it.category, reference: `What a strong answer covers: ${(it.idealAnswer || "").slice(0, 800)} Rubric: ${it.rubric.join("; ")}` };
}

const SYSTEM = (prompt: string, category: string, reference: string) => `You are a senior interviewer judging whether a candidate's stated APPROACH (before they start) is heading in the right direction. This is a "think before you build" gate.

THE PROBLEM (${category}): ${prompt}

WHERE A STRONG APPROACH HEADS (FOR YOUR JUDGMENT ONLY — never reveal it, never hand over the answer/fix/query):
${reference}

Judge the candidate's approach. Respond with ONLY minified JSON, no markdown:
{"verdict":"on_track"|"partial"|"off","reason":"one short sentence on what's right or missing","followUp":"ONE probing question that nudges them WITHOUT revealing the answer"}
Rules: "on_track" = the plan would plausibly get there (sound direction + names the key idea or the right first check). "partial" = reasonable but vague or missing the crux. "off" = wrong direction or pure guessing. Keep reason + followUp short and conversational. NEVER state the solution, the root cause, or the fix.`;

export async function POST(req: Request) {
  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  const ref = referenceFor(body.problemId);
  // No key (or unknown problem): don't block — accept as "partial" with a generic nudge.
  if (!hasGemini || !ref) {
    return NextResponse.json({
      verdict: "partial",
      reason: "Noted — let's see it in practice.",
      followUp: "What's the very first thing you'd check or measure to confirm that?",
      source: hasGemini ? "scripted" : "no-key",
    });
  }

  try {
    const text = await geminiGenerate({
      system: SYSTEM(ref.prompt, ref.category, ref.reference),
      messages: [{ role: "user", content: `Candidate's approach:\n${body.approach || "(empty)"}` }],
      json: true,
      maxTokens: 200,
    });
    const clean = (text ?? "{}").trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
    const p = JSON.parse(clean);
    const verdict = ["on_track", "partial", "off"].includes(p.verdict) ? p.verdict : "partial";
    return NextResponse.json({
      verdict,
      reason: String(p.reason ?? "").slice(0, 300),
      followUp: String(p.followUp ?? "What would you check first?").slice(0, 300),
      source: "ai",
    });
  } catch {
    return NextResponse.json({ verdict: "partial", reason: "Let's just get going.", followUp: "What's your first concrete step?", source: "scripted" });
  }
}
