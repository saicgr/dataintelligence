import { NextResponse } from "next/server";
import { geminiGenerate } from "@/lib/gemini";
import { hasGemini } from "@/lib/env";
import { getPracticeItem } from "@/lib/data/practice";
import { getReviewScenario } from "@/lib/data/practice/review-scenarios.server";
import { getIncidentScenario } from "@/lib/data/practice/incidents.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Body {
  /** Preferred: the answer key (idealAnswer / referenceSolution) is resolved server-side. */
  problemId?: string;
  item: {
    title: string;
    category: string;
    level: string;
    prompt: string;
    idealAnswer: string;
    rubric: string[];
    mode: "code" | "text";
  };
  answer: string;
}

const SQL_RUBRIC = ["Correct result set", "Right columns/order", "Handles edge cases", "Efficient approach"];

/** Fill the answer key server-side from problemId so the client never carries it. */
function resolveItem(body: Body): Body["item"] {
  const it = body.problemId ? getPracticeItem(body.problemId) : null;
  if (!it) return body.item;
  if (it.category === "sql") {
    return { title: it.title, category: "sql", level: it.level, prompt: it.prompt, idealAnswer: it.referenceSolution, rubric: SQL_RUBRIC, mode: "code" };
  }
  // Interactive review (single-file or multi-file PR): grade the transcript against the
  // planted issues + scenario rubric. The artifact + issues stay server-side.
  const REVIEW_CATS = ["codereview", "aireview", "llmops", "typescript", "pr"];
  const scenario = body.problemId ? getReviewScenario(body.problemId) : null;
  if (REVIEW_CATS.includes(it.category) && it.review && scenario) {
    const rv = it.review;
    const artifact = rv.files && rv.files.length
      ? `a multi-file pull request:\n\n${rv.files.map((f) => `### ${f.name}\n${f.code}`).join("\n\n")}`
      : `this ${rv.language ?? "code"}:\n\n${rv.code ?? ""}`;
    const ideal =
      `The candidate is reviewing ${artifact}\n\n` +
      `A strong review identifies these planted issues and reasons about them under follow-ups:\n` +
      scenario.issues
        .map((iss, n) => `${n + 1}. (${iss.file ? `${iss.file} ` : ""}lines ${iss.lines[0]}-${iss.lines[1]}) ${iss.topic} — ${iss.why} Fix: ${iss.fix} Depth points: ${iss.idealPoints.join("; ")}.`)
        .join("\n");
    return { title: it.title, category: it.category, level: it.level, prompt: it.prompt, idealAnswer: ideal, rubric: scenario.rubric, mode: "text" };
  }
  // Incident debugging: grade the candidate's root-cause + fix (+ notes) against the diagnosed scenario.
  if (it.category === "incident" && it.incident) {
    const sc = getIncidentScenario(body.problemId!);
    if (sc) {
      const ideal =
        `The candidate is on call for this incident:\n${it.incident.brief}\n\n` +
        `They investigated by reading the artifacts and running SQL/Python, then submitted a root cause + fix.\n\n` +
        `DIAGNOSED ROOT CAUSE (for your judgment only): ${sc.actualRootCause}\n` +
        `CORRECT FIX: ${sc.actualFix}\n` +
        `CONTRIBUTING FACTORS: ${sc.contributingFactors.join("; ")}\n` +
        (sc.redHerrings?.length ? `RED HERRINGS (a strong answer does NOT chase these): ${sc.redHerrings.join("; ")}\n` : "") +
        (sc.triageOrder?.length ? `EXPECTED TRIAGE ORDER: ${sc.triageOrder.join(" → ")}\n` : "");
      return { title: it.title, category: "incident", level: it.level, prompt: it.prompt, idealAnswer: ideal, rubric: sc.rubric, mode: "text" };
    }
  }
  return { title: it.title, category: it.category, level: it.level, prompt: it.prompt, idealAnswer: it.idealAnswer, rubric: it.rubric, mode: it.mode };
}

interface Grade {
  score: number;
  verdict: string;
  strengths: string[];
  gaps: string[];
  source: "ai" | "self";
  rubric?: string[];
}

const SYSTEM = (i: Body["item"]) => `You are a senior interviewer grading a candidate's answer to a ${i.category} interview question (${i.level} level). Be fair but rigorous, the way a real interviewer scores.

QUESTION:
${i.prompt}

REFERENCE / IDEAL ANSWER (for your judgment only — the candidate never saw it):
${i.idealAnswer}

RUBRIC — what a strong answer must hit:
${i.rubric.map((r, n) => `${n + 1}. ${r}`).join("\n")}

Grade the candidate's answer against the rubric and reference. Respond with ONLY valid minified JSON, no markdown:
{"score": <0-100>, "verdict": "<one-sentence overall>", "strengths": ["..."], "gaps": ["what they missed or got wrong, referencing the rubric"]}
Score honestly: a junior answer that misses senior-level trade-offs should not score 90. Reward correct reasoning and naming trade-offs; penalize hand-waving and factual errors.`;

function selfRubric(item: Body["item"]): Grade {
  return {
    score: 0,
    verdict: "AI grading is off — self-assess against the rubric below.",
    strengths: [],
    gaps: [],
    source: "self",
    rubric: item.rubric,
  };
}

export async function POST(req: Request) {
  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  const item = resolveItem(body);
  if (!hasGemini) return NextResponse.json(selfRubric(item));

  try {
    const text = await geminiGenerate({
      system: SYSTEM(item),
      messages: [
        { role: "user", content: `Candidate's answer:\n\n${body.answer || "(empty)"}` },
      ],
      json: true,
      maxTokens: 700,
    });
    if (!text) return NextResponse.json(selfRubric(item));
    const clean = text
      .trim()
      .replace(/^```(?:json)?/i, "")
      .replace(/```$/, "")
      .trim();
    const parsed = JSON.parse(clean);
    const grade: Grade = {
      score: Math.max(0, Math.min(100, Number(parsed.score) || 0)),
      verdict: String(parsed.verdict || "Graded."),
      strengths: Array.isArray(parsed.strengths) ? parsed.strengths.map(String) : [],
      gaps: Array.isArray(parsed.gaps) ? parsed.gaps.map(String) : [],
      source: "ai",
    };
    return NextResponse.json(grade);
  } catch {
    return NextResponse.json(selfRubric(item));
  }
}
