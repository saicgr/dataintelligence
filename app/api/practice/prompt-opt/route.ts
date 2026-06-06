import { NextResponse } from "next/server";
import { geminiGenerate } from "@/lib/gemini";
import { hasGemini } from "@/lib/env";
import { getPracticeItem } from "@/lib/data/practice";
import { getPromptOptScenario } from "@/lib/data/practice/promptopt-scenarios.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Body {
  problemId: string; // labels are resolved server-side by id — never sent by the client
  prompt: string; // the candidate's current prompt template
}

function stripFences(s: string): string {
  return s.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
}

/** Fill {{input}} (whole row joined) and per-column {{col}} placeholders. */
function fill(prompt: string, input: Record<string, string>, placeholder: string): string {
  let out = prompt;
  for (const [k, v] of Object.entries(input)) out = out.split(`{{${k}}}`).join(v);
  const joined = Object.values(input).join("\n");
  if (out.includes(placeholder)) out = out.split(placeholder).join(joined);
  // If the candidate referenced no placeholder at all, append the row so the call isn't empty.
  const referenced = out !== prompt;
  return referenced ? out : `${prompt}\n\n${joined}`;
}

function scoreExact(output: string, label: string, contains: boolean): boolean {
  const o = output.trim().toLowerCase().replace(/[.""'`]+$/g, "");
  const l = label.trim().toLowerCase();
  return contains ? o.includes(l) : o === l;
}

export async function POST(req: Request) {
  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  if (!hasGemini) {
    return NextResponse.json({ needsKey: true, message: "Prompt optimization runs on Gemini — set GEMINI_API_KEY to grade against the dataset for real." });
  }

  const item = getPracticeItem(body.problemId);
  const scenario = getPromptOptScenario(body.problemId);
  if (!item || item.category === "sql" || !item.promptOpt || !scenario) {
    return NextResponse.json({ error: "no prompt-opt scenario for this problem" }, { status: 404 });
  }
  const { rows, placeholder } = item.promptOpt;
  const { labels, metric, judgeCriteria, target } = scenario;
  const token = placeholder || "{{input}}";

  // Run the candidate's prompt over every row.
  const outputs: string[] = [];
  for (const row of rows) {
    const filled = fill(body.prompt, row.input, token);
    outputs.push((await geminiGenerate({ messages: [{ role: "user", content: filled }], maxTokens: 400 })) ?? "");
  }

  // Score per row WITHOUT ever returning the label.
  let correctness: boolean[];
  if (metric === "judge") {
    // One batched judge call: the judge sees outputs + labels and returns a verdict array.
    const pairs = outputs.map((o, i) => `Row ${i + 1}\nExpected: ${labels[i]}\nModel output: ${o}`).join("\n\n");
    const judgeText = await geminiGenerate({
      system: `You are grading whether each model output satisfies the expected answer for a prompt-optimization exercise. Criteria: ${judgeCriteria ?? "the output conveys the same answer as expected"}. Respond ONLY with minified JSON {"verdicts":[true,false,...]} — one boolean per row, in order.`,
      messages: [{ role: "user", content: pairs }],
      json: true,
      maxTokens: 400,
    });
    try {
      const parsed = JSON.parse(stripFences(judgeText ?? "{}"));
      const v: unknown[] = Array.isArray(parsed.verdicts) ? parsed.verdicts : [];
      correctness = outputs.map((_, i) => Boolean(v[i]));
    } catch {
      correctness = outputs.map(() => false);
    }
  } else {
    correctness = outputs.map((o, i) => scoreExact(o, labels[i] ?? "", metric === "contains"));
  }

  const passed = correctness.filter(Boolean).length;
  const accuracy = rows.length ? Math.round((passed / rows.length) * 100) : 0;
  // Per-row payload exposes the model's own output + verdict, but NEVER the expected label.
  const rowResults = correctness.map((correct, i) => ({ index: i, correct, output: outputs[i] }));

  return NextResponse.json({
    rows: rowResults,
    accuracy,
    target,
    passed,
    total: rows.length,
    allPass: accuracy >= target,
  });
}
