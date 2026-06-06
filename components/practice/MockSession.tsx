"use client";

import { useState } from "react";
import Link from "next/link";
import type { PracticeItem } from "@/lib/data/practice/types";
import { PRACTICE_CATEGORIES } from "@/lib/data/practice/types";
import type { Level } from "@/lib/types";
import { Timer } from "./Timer";
import { MicButton } from "./MicButton";
import { useProgress } from "@/components/providers/progress-provider";
import { cn } from "@/lib/utils";
import { LEVEL_NAMES } from "@/lib/catalog";

interface Graded { item: PracticeItem; answer: string; score: number; verdict: string }

function gradePayload(item: PracticeItem, answer: string) {
  if (item.category === "sql") {
    return { title: item.title, category: "sql", level: item.level, prompt: item.prompt, idealAnswer: item.referenceSolution, rubric: ["Correct result set", "Right columns/order", "Handles edge cases", "Efficient approach"], mode: "code" as const };
  }
  return { title: item.title, category: item.category, level: item.level, prompt: item.prompt, idealAnswer: item.idealAnswer, rubric: item.rubric, mode: item.mode };
}

export function MockSession({ items, hasAi, practicePro }: { items: PracticeItem[]; hasAi: boolean; practicePro: boolean }) {
  const progress = useProgress();
  const [phase, setPhase] = useState<"setup" | "running" | "grading" | "report">("setup");
  const [count, setCount] = useState(3);
  const [level, setLevel] = useState<"any" | Level>("any");
  const [picked, setPicked] = useState<PracticeItem[]>([]);
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [graded, setGraded] = useState<Graded[]>([]);

  const maxQ = practicePro ? 8 : 3;

  function start() {
    const pool = items.filter((it) => (level === "any" || it.level === level) && (practicePro || it.free));
    // spread across categories, then fill
    const byCat: Record<string, PracticeItem[]> = {};
    for (const it of pool) (byCat[it.category] ??= []).push(it);
    const cats = Object.keys(byCat).sort(() => Math.random() - 0.5);
    const chosen: PracticeItem[] = [];
    let i = 0;
    while (chosen.length < Math.min(count, maxQ) && cats.length) {
      const c = cats[i % cats.length];
      const bucket = byCat[c];
      if (bucket && bucket.length) chosen.push(bucket.shift()!);
      i++;
      if (i > 500) break;
    }
    if (!chosen.length) return;
    setPicked(chosen);
    setIdx(0);
    setAnswers({});
    setGraded([]);
    setPhase("running");
  }

  async function finish() {
    setPhase("grading");
    const out: Graded[] = [];
    for (const item of picked) {
      const answer = answers[item.id] ?? "";
      let score = 0;
      let verdict = "No answer.";
      if (answer.trim()) {
        try {
          const res = await fetch("/api/practice/grade", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ problemId: item.id, item: gradePayload(item, answer), answer }) });
          const g = await res.json();
          if (g.source === "ai") { score = g.score; verdict = g.verdict; }
          else { score = 0; verdict = "AI grading off — set GEMINI_API_KEY to score mocks."; }
        } catch { verdict = "Grader unreachable."; }
      }
      if (score >= 70) progress.recordPracticeSolve?.(item.category, item.id);
      out.push({ item, answer, score, verdict });
    }
    setGraded(out);
    setPhase("report");
  }

  // ── Setup ──
  if (phase === "setup") {
    return (
      <div>
        <Link href="/practice" className="text-sm font-medium text-muted hover:text-fg">← Practice</Link>
        <h1 className="mt-3 flex items-center gap-2 text-3xl font-bold tracking-tight text-fg">Mock interview <span className="rounded-full bg-amber/15 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-amber">Beta</span></h1>
        <p className="mt-2 text-muted">A timed run of mixed questions, one at a time, no answers shown — then a report card with your weak areas. {hasAi ? "" : "Set GEMINI_API_KEY to get scored."}</p>
        <div className="mt-6 space-y-5 rounded-xl border border-border bg-card p-6">
          <div>
            <p className="text-sm font-semibold text-fg">Questions</p>
            <div className="mt-2 flex gap-2">
              {[3, 5, 8].map((n) => (
                <button key={n} onClick={() => setCount(n)} disabled={n > maxQ} className={cn("rounded-full border px-4 py-1.5 text-sm font-medium disabled:opacity-40", count === n ? "border-navy bg-navy text-white dark:border-accent dark:bg-accent dark:text-accent-fg" : "border-border text-muted hover:text-fg")}>{n}</button>
              ))}
              {!practicePro && <span className="self-center text-xs text-muted">free = 3 · Pro = up to 8</span>}
            </div>
          </div>
          <div>
            <p className="text-sm font-semibold text-fg">Level</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {(["any", "junior", "mid", "senior"] as const).map((l) => (
                <button key={l} onClick={() => setLevel(l)} className={cn("rounded-full border px-4 py-1.5 text-sm font-medium", level === l ? "border-navy bg-navy text-white dark:border-accent dark:bg-accent dark:text-accent-fg" : "border-border text-muted hover:text-fg")}>{l === "any" ? "Any" : LEVEL_NAMES[l]}</button>
              ))}
            </div>
          </div>
          <button onClick={start} className="rounded-full bg-navy px-6 py-3 text-sm font-semibold text-white hover:bg-navy/90 dark:bg-accent dark:text-accent-fg">Start mock →</button>
        </div>
      </div>
    );
  }

  // ── Running ──
  if (phase === "running") {
    const item = picked[idx];
    const last = idx === picked.length - 1;
    return (
      <div>
        <div className="mb-4 flex items-center justify-between">
          <span className="text-sm font-medium text-muted">Question {idx + 1} / {picked.length}</span>
          <Timer />
        </div>
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="flex items-center gap-2 text-xs text-muted">
            <span className="font-semibold uppercase tracking-wider">{PRACTICE_CATEGORIES.find((c) => c.slug === item.category)?.name}</span>
            <span>· {item.company} · {LEVEL_NAMES[item.level]}</span>
          </div>
          <p className="mt-2 whitespace-pre-wrap text-fg">{item.prompt.split("```")[0]}</p>
          <div className="mt-4 flex items-start gap-2">
            <textarea
              value={answers[item.id] ?? ""}
              onChange={(e) => setAnswers((a) => ({ ...a, [item.id]: e.target.value }))}
              rows={8}
              placeholder="Type (or 🎤 speak) your answer — you won't see the solution until the end."
              className="min-h-0 flex-1 resize-y rounded-lg border border-border bg-card px-4 py-3 font-mono text-sm text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-navy/30"
            />
            <MicButton onText={(t) => setAnswers((a) => ({ ...a, [item.id]: (a[item.id] ?? "") + t }))} />
          </div>
        </div>
        <div className="mt-4 flex justify-between">
          <button onClick={() => setIdx((i) => Math.max(0, i - 1))} disabled={idx === 0} className="rounded-full border border-border px-5 py-2 text-sm font-semibold text-fg disabled:opacity-40">← Previous</button>
          {last ? (
            <button onClick={finish} className="rounded-full bg-navy px-6 py-2 text-sm font-semibold text-white dark:bg-accent dark:text-accent-fg">Finish &amp; grade →</button>
          ) : (
            <button onClick={() => setIdx((i) => i + 1)} className="rounded-full bg-navy px-6 py-2 text-sm font-semibold text-white dark:bg-accent dark:text-accent-fg">Next →</button>
          )}
        </div>
      </div>
    );
  }

  // ── Grading ──
  if (phase === "grading") {
    return <div className="py-20 text-center text-muted">Grading your answers…</div>;
  }

  // ── Report ──
  const scored = graded.filter((g) => g.answer.trim());
  const overall = scored.length ? Math.round(scored.reduce((a, g) => a + g.score, 0) / scored.length) : 0;
  const weak = graded.filter((g) => g.score < 60);
  const scoreColor = (s: number) => (s >= 75 ? "text-success" : s >= 50 ? "text-warning" : "text-danger");
  return (
    <div>
      <Link href="/practice" className="text-sm font-medium text-muted hover:text-fg">← Practice</Link>
      <div className="mt-3 rounded-2xl border border-border bg-card p-6 text-center">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted">Mock report card</p>
        <div className={cn("mt-2 text-6xl font-bold tracking-tight", scoreColor(overall))}>{overall}</div>
        <p className="mt-1 text-sm text-muted">overall · {scored.length}/{picked.length} answered</p>
      </div>
      <div className="mt-5 space-y-3">
        {graded.map((g, i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold text-fg">{g.item.title}</span>
              <span className={cn("text-lg font-bold", scoreColor(g.score))}>{g.score}</span>
            </div>
            <p className="mt-1 text-xs text-muted">{PRACTICE_CATEGORIES.find((c) => c.slug === g.item.category)?.name} · {LEVEL_NAMES[g.item.level]}</p>
            <p className="mt-2 text-sm text-fg">{g.verdict}</p>
          </div>
        ))}
      </div>
      {weak.length > 0 && (
        <div className="mt-5 rounded-xl border border-amber/30 bg-amber/5 p-4">
          <p className="text-sm font-semibold text-fg">Focus next on:</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {Array.from(new Set(weak.map((g) => g.item.category))).map((c) => (
              <Link key={c} href="/practice" className="rounded-full border border-amber/40 px-3 py-1 text-xs font-semibold text-amber hover:bg-amber/10">{PRACTICE_CATEGORIES.find((x) => x.slug === c)?.name} →</Link>
            ))}
          </div>
        </div>
      )}
      <div className="mt-6 flex gap-3">
        <button onClick={() => setPhase("setup")} className="rounded-full bg-navy px-6 py-2.5 text-sm font-semibold text-white dark:bg-accent dark:text-accent-fg">New mock</button>
        <Link href="/practice/progress" className="rounded-full border border-border px-6 py-2.5 text-sm font-semibold text-fg hover:bg-surface">View progress</Link>
      </div>
    </div>
  );
}
