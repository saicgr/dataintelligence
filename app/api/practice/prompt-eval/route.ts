import { NextResponse } from "next/server";
import { geminiGenerate } from "@/lib/gemini";
import { hasGemini } from "@/lib/env";
import type { PromptAssertion, PromptEval } from "@/lib/data/practice";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Body {
  prompt: string; // candidate's prompt template
  spec: PromptEval;
}

function stripFences(s: string): string {
  return s.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
}

function getPath(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc == null) return undefined;
    const idx = Number(key);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return Number.isInteger(idx) ? (acc as any)[idx] : (acc as any)[key];
  }, obj);
}

function checkAssertion(output: string, a: PromptAssertion): { label: string; ok: boolean; detail?: string } {
  const label = a.label ?? `${a.kind}${a.expected ? ` "${a.expected}"` : ""}${a.path ? ` @${a.path}` : ""}`;
  try {
    switch (a.kind) {
      case "contains":
        return { label, ok: output.toLowerCase().includes((a.expected ?? "").toLowerCase()) };
      case "not_contains":
        return { label, ok: !output.toLowerCase().includes((a.expected ?? "").toLowerCase()) };
      case "equals":
        return { label, ok: output.trim() === (a.expected ?? "").trim() };
      case "regex":
        return { label, ok: new RegExp(a.expected ?? "").test(output) };
      case "json_valid": {
        JSON.parse(stripFences(output));
        return { label, ok: true };
      }
      case "json_path": {
        const parsed = JSON.parse(stripFences(output));
        const val = getPath(parsed, a.path ?? "");
        const ok = a.expected === undefined ? val !== undefined : String(val) === a.expected;
        return { label, ok, detail: `got ${JSON.stringify(val)}` };
      }
      default:
        return { label, ok: false };
    }
  } catch (e) {
    return { label, ok: false, detail: String((e as Error)?.message ?? e) };
  }
}

export async function POST(req: Request) {
  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  if (!hasGemini) {
    return NextResponse.json({ needsKey: true, message: "Prompt evaluation runs on Gemini — set GEMINI_API_KEY to grade prompts for real." });
  }

  const { prompt, spec } = body;
  const token = spec.placeholder || "{{input}}";

  const results = [];
  for (const inp of spec.inputs) {
    const filled = prompt.includes(token) ? prompt.split(token).join(inp.input) : `${prompt}\n\n${inp.input}`;
    const output = (await geminiGenerate({ messages: [{ role: "user", content: filled }], maxTokens: 600 })) ?? "";
    const checks = inp.assertions.map((a) => checkAssertion(output, a));

    let judge: { score: number; reason: string } | undefined;
    if (spec.judge) {
      const judgeText = await geminiGenerate({
        system: `You grade an LLM output for a prompt-engineering exercise. Task: ${spec.task}. Criteria: ${spec.judge.criteria}. Respond ONLY with minified JSON {"score": 0-100, "reason": "one sentence"}.`,
        messages: [{ role: "user", content: `Input:\n${inp.input}\n\nLLM output to grade:\n${output}` }],
        json: true,
        maxTokens: 200,
      });
      try {
        const p = JSON.parse(stripFences(judgeText ?? "{}"));
        judge = { score: Math.max(0, Math.min(100, Number(p.score) || 0)), reason: String(p.reason ?? "") };
      } catch {
        /* ignore judge parse failure */
      }
    }

    results.push({ name: inp.name, output, checks, judge });
  }

  const totalChecks = results.reduce((n, r) => n + r.checks.length, 0);
  const passedChecks = results.reduce((n, r) => n + r.checks.filter((c) => c.ok).length, 0);
  const judged = results.map((r) => r.judge?.score).filter((s): s is number => typeof s === "number");
  const avgJudge = judged.length ? Math.round(judged.reduce((a, b) => a + b, 0) / judged.length) : null;
  const allPass = totalChecks > 0 && passedChecks === totalChecks && (avgJudge === null || avgJudge >= (spec.judge?.threshold ?? 0));

  return NextResponse.json({ results, totalChecks, passedChecks, avgJudge, allPass });
}
