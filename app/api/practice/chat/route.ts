import { NextResponse } from "next/server";
import { geminiGenerate } from "@/lib/gemini";
import { hasGemini } from "@/lib/env";
import { getPracticeItem } from "@/lib/data/practice";
import { getReviewScenario, issueForLine, type ReviewScenario } from "@/lib/data/practice/review-scenarios.server";
import { getIncidentScenario } from "@/lib/data/practice/incidents.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ChatMsg {
  role: "user" | "assistant";
  content: string;
}
interface Body {
  problemId?: string; // preferred: the reference answer is looked up server-side, never sent by the client
  problem: {
    title: string;
    level: string;
    prompt: string;
    schemaNote: string;
    hint: string;
    referenceSolution?: string;
  };
  messages: ChatMsg[];
  /** Optional latest execution event so the interviewer can react. */
  lastRun?: { sql: string; correct: boolean | null; error?: string };
  /** Interactive review: a comment the candidate just anchored to a code line (+ file for PR review). */
  lineComment?: { line: number; text: string; file?: string };
}

/** Number the artifact under review so the interviewer can refer to lines. */
function numbered(code: string): string {
  return code.split("\n").map((l, i) => `${String(i + 1).padStart(3)}  ${l}`).join("\n");
}

/** Render a multi-file PR with per-file headers and per-file line numbers. */
function numberedFiles(files: { name: string; code: string }[]): string {
  return files.map((f) => `### ${f.name}\n${numbered(f.code)}`).join("\n\n");
}

const SYSTEM_REVIEW = (artifact: string, lang: string, sc: ReviewScenario, lineComment?: Body["lineComment"]) => {
  const matched = lineComment ? issueForLine(sc, lineComment.line, 2, lineComment.file) : null;
  return `You are "Dawn", a warm but sharp senior engineer running a LIVE code-review interview. The candidate leaves comments on specific lines and you probe their thinking — like a real PR review.

THE ARTIFACT UNDER REVIEW (${lang})${lineComment?.file ? " — a multi-file pull request; each file is shown under its own ### header with its own line numbers" : ", with line numbers"}:
\`\`\`
${artifact}
\`\`\`

CLARIFICATIONS you MAY reveal when the candidate asks (and only then) — answer concisely:
${sc.facts.map((f) => `- Q: ${f.q}\n  A: ${f.a}`).join("\n")}

KNOWN ISSUES — FOR YOUR EYES ONLY. NEVER list them or hand them over. Only react to what the candidate raises:
${sc.issues.map((iss, n) => `${n + 1}. ${iss.file ? `${iss.file} ` : ""}lines ${iss.lines[0]}-${iss.lines[1]} — ${iss.topic}. Why: ${iss.why} Escalating follow-ups to use: ${iss.followups.map((f) => `"${f}"`).join(" → ")}`).join("\n")}

HOW TO CONDUCT THE REVIEW:
${matched ? `- The candidate just commented on ${lineComment!.file ? `${lineComment!.file} ` : ""}line ${lineComment!.line}: "${lineComment!.text}". This maps to issue "${matched.topic}". If they quoted a specific span or flagged a category (bug/perf/security/prod/style/question), FOCUS your follow-up on exactly that span, and if their category label is wrong, gently correct it. If they're on the right track, acknowledge briefly, then ask the NEXT escalating follow-up (one at a time, at most ~3 across the thread), pushing toward scale / edge cases — and where the bug spans files, draw them toward the connected file WITHOUT naming the issue. If they're vague or wrong about this line, nudge toward the real issue WITHOUT naming it.` : lineComment ? `- The candidate commented on ${lineComment!.file ? `${lineComment!.file} ` : ""}line ${lineComment!.line}: "${lineComment!.text}", which doesn't map to a known issue here. If it's a real (if minor) point, acknowledge it and (if they flagged a category) say whether that classification fits; otherwise gently ask what specifically concerns them, or point them toward a line that does matter — without revealing the issue list.` : `- The candidate sent a message (an answer to your last follow-up, or a clarifying question). If it's a clarifying question that the CLARIFICATIONS cover, answer it concisely. If it's an answer, judge it and either push one level deeper or move on.`}
- Ask ONE question at a time. Keep every reply SHORT (1-3 sentences), conversational, no markdown headers. Stay in character; never dump the full issue list or the fixes.`;
};

function scriptedReview(sc: ReviewScenario, lineComment?: Body["lineComment"]): string {
  if (lineComment) {
    const iss = issueForLine(sc, lineComment.line, 2, lineComment.file);
    if (iss) return iss.followups[0] ?? "Interesting — why is that a problem here, and how would you fix it?";
    return "What specifically concerns you about that line? Or is there another line you'd flag first?";
  }
  return "Good — walk me through your reasoning. What would you change, and what would you check at scale?";
}

const SYSTEM = (p: Body["problem"] & { referenceSolution?: string }) => `You are "Dawn", a warm but sharp senior interviewer running a live technical interview in real time.

THE PROBLEM (the candidate sees the prompt + context, NOT the reference):
- Title: ${p.title}  (level: ${p.level})
- Prompt: ${p.prompt}
- Context/schema: ${p.schemaNote}
- Reference answer (FOR YOUR EYES ONLY — never paste it):
${p.referenceSolution}

HOW TO CONDUCT THE INTERVIEW:
- First, get them to align on their APPROACH before they write code or commit to an answer — ask how they'd tackle it.
- Give INCREMENTAL hints, never the full answer. Nudge toward the next idea.
- When their attempt is WRONG or incomplete, point at the likely category of mistake (edge case, wrong approach, missing trade-off) without handing them the fix.
- When they get it RIGHT, briefly affirm WHAT made it strong, then ask ONE realistic follow-up (a harder variant, a performance/scale angle, or "what breaks in production?").
- Keep every message SHORT and conversational — 1-3 sentences, like a real interviewer, not an essay. No markdown headers.
- Stay in character as the interviewer. Don't break the fourth wall.`;

function scripted(body: Body): string {
  const { messages, lastRun, problem } = body;
  if (lastRun?.error)
    return `Looks like that query errored. Read the message carefully — often it's a column name or a missing GROUP BY. Want a hint on the approach?`;
  if (lastRun && lastRun.correct === true)
    return `Nice — that's correct. Follow-up: how would your query behave at 100M rows, and what would you check on the query plan?`;
  if (lastRun && lastRun.correct === false)
    return `Not quite. Hint: ${problem.hint} Give it another go.`;
  if (messages.length <= 1)
    return `Hey — let's work through "${problem.title}" together. Before you write anything, walk me through your approach: what's the shape of the answer, and which pieces of the input do you need?`;
  const last = messages[messages.length - 1]?.content.toLowerCase() ?? "";
  // React to test-run results coming from the workbench.
  const m = last.match(/(\d+)\/(\d+)\s*(?:tests\s*)?passed/);
  if (m) {
    if (m[1] === m[2])
      return `Nice — all ${m[2]} green. Now the follow-up I'd ask in a real loop: what's the time and space complexity, and what breaks at very large input?`;
    return `Not all green yet (${m[1]}/${m[2]}). Look hard at the failing case — is it an edge case like an empty input, ties, or ordering? ${problem.hint}`;
  }
  if (last.includes("errored") || last.includes("error:") || last.includes("traceback"))
    return `Read the traceback top-to-bottom — it's often a NameError or a wrong function name/signature. Want a hint on the approach?`;
  // "Ask AI" sends the candidate's code in a fenced block — give a real, structural nudge.
  if (last.includes("```")) {
    if (/select\s+1\b|select\s+\*\s+from/.test(last) && /group by/.test(problem.hint.toLowerCase()))
      return `You're selecting raw rows — the prompt wants an aggregate. ${problem.hint} Then order and limit as the prompt asks.`;
    return `Looking at your query: ${problem.hint} Double-check you're selecting exactly the columns the prompt names, with the right grouping, ordering and any LIMIT.`;
  }
  if (last.includes("hint") || last.includes("stuck") || last.includes("help") || last.includes("missing"))
    return `Here's a nudge: ${problem.hint}`;
  return `Tell me your approach in a sentence — the shape of the output and which columns you need — and I'll tell you if it holds up.`;
}

export async function POST(req: Request) {
  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  // Look up the reference answer server-side so it never travels via the client.
  const looked = body.problemId ? getPracticeItem(body.problemId) : null;

  // ── Interactive review mode: line-anchored comments → escalating follow-ups ──
  // Covers single-file review (codereview/aireview/llmops/typescript) and multi-file PR review (pr).
  const REVIEW_CATS = ["codereview", "aireview", "llmops", "typescript", "pr"];
  const scenario = body.problemId ? getReviewScenario(body.problemId) : null;
  if (looked && looked.category !== "sql" && REVIEW_CATS.includes(looked.category) && looked.review && scenario) {
    const rv = looked.review;
    const isPr = Array.isArray(rv.files) && rv.files.length > 0;
    const artifact = isPr ? numberedFiles(rv.files!) : numbered(rv.code ?? "");
    const lang = isPr ? "multi-file PR" : rv.language ?? "text";
    const turns: ChatMsg[] = [...body.messages];
    if (body.lineComment) {
      const where = body.lineComment.file ? `${body.lineComment.file} line ${body.lineComment.line}` : `line ${body.lineComment.line}`;
      turns.push({ role: "user", content: `[Comment on ${where}] ${body.lineComment.text}` });
    }
    if (!hasGemini) {
      return NextResponse.json({ reply: scriptedReview(scenario, body.lineComment), source: "scripted" });
    }
    const reply = await geminiGenerate({
      system: SYSTEM_REVIEW(artifact, lang, scenario, body.lineComment),
      messages: turns,
      maxTokens: 300,
    });
    return NextResponse.json(reply ? { reply, source: "ai" } : { reply: scriptedReview(scenario, body.lineComment), source: "scripted" });
  }

  // ── Incident coach: answer clarifications from facts, nudge, never reveal the root cause ──
  if (looked && looked.category === "incident" && looked.incident) {
    const sc = getIncidentScenario(body.problemId!);
    if (sc) {
      if (!hasGemini) {
        return NextResponse.json({ reply: "What have you checked so far? Try querying the data for anomalies (duplicates, nulls, time gaps) before you commit to a cause.", source: "scripted" });
      }
      const stingy = looked.incident.tier === "hellish";
      const system = `You are "Dawn", a calm senior engineer pairing with the candidate on a live production incident. Help them THINK; never hand over the answer.

THE INCIDENT: ${looked.incident.brief}
ARTIFACTS THEY CAN SEE: ${looked.incident.artifacts.map((a) => a.name).join(", ")}${looked.incident.sql ? ` · a SQL console over tables: ${looked.incident.sql.tables.join(", ")}` : ""}${looked.incident.python ? " · a Python scratchpad" : ""}

CLARIFICATIONS you MAY confirm when asked (only when asked, answer briefly):
${(sc.facts ?? []).map((f) => `- Q: ${f.q}\n  A: ${f.a}`).join("\n") || "- (none)"}

FOR YOUR EYES ONLY — NEVER state these; only nudge toward them with questions:
- Root cause: ${sc.actualRootCause}
${sc.redHerrings?.length ? `- Plausible-but-wrong leads to gently steer AWAY from if they fixate: ${sc.redHerrings.join("; ")}` : ""}

HOW TO COACH:
- If they ask a clarifying question the CLARIFICATIONS cover, answer it concisely.
- If they're guessing without evidence, ask what query/check would confirm or kill the hypothesis.
- ${stingy ? "This is a HARD/BROKEN incident — be stingy: at most a small nudge, make them earn it, and don't confirm the second cause." : "Give a gentle nudge toward the next thing to inspect."}
- Never name the root cause or the fix. Keep replies SHORT (1-3 sentences), conversational, no markdown headers.`;
      const reply = await geminiGenerate({ system, messages: body.messages, maxTokens: 250 });
      return NextResponse.json(reply ? { reply, source: "ai" } : { reply: "What does the data say — have you run a query to test that idea?", source: "scripted" });
    }
  }

  const lookedRef = looked ? (looked.category === "sql" ? looked.referenceSolution : looked.idealAnswer) : undefined;
  const problem = {
    ...body.problem,
    referenceSolution: lookedRef ?? body.problem.referenceSolution,
  };

  if (!hasGemini) {
    return NextResponse.json({ reply: scripted(body), source: "scripted" });
  }

  const userTurns: ChatMsg[] = [...body.messages];
  if (body.lastRun) {
    const verdict = body.lastRun.error
      ? `errored: ${body.lastRun.error}`
      : body.lastRun.correct
        ? "marked CORRECT by the checker"
        : "marked INCORRECT by the checker";
    userTurns.push({
      role: "user",
      content: `[I just ran this query, ${verdict}]\n\`\`\`sql\n${body.lastRun.sql}\n\`\`\``,
    });
  }

  const reply = await geminiGenerate({
    system: SYSTEM(problem),
    messages: userTurns,
    maxTokens: 350,
  });
  return NextResponse.json(
    reply
      ? { reply, source: "ai" }
      : { reply: scripted(body), source: "scripted" }
  );
}
