"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { SegmentedTabs } from "@/components/ui/Tabs";
import { QuizEngine, QuizEngineQuestion } from "@/components/tools/QuizEngine";
import { TOOLS, LEVELS, TOOL_BY_SLUG } from "@/lib/catalog";
import type { Level, QuizQuestion } from "@/lib/types";
import { cn } from "@/lib/utils";

export default function ReadinessQuizPage() {
  const [tool, setTool] = useState<string>(TOOLS[0]?.slug ?? "snowflake");
  const [level, setLevel] = useState<Level>("senior");
  const [questions, setQuestions] = useState<QuizEngineQuestion[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/quiz?tool=${tool}&level=${level}`);
      if (!res.ok) throw new Error("Could not load quiz");
      const data = (await res.json()) as QuizQuestion[];
      setQuestions(
        data.map((q) => ({
          id: q.id,
          prompt: q.prompt,
          choices: q.choices,
          correctIndex: q.correctIndex,
          area: q.area,
        }))
      );
    } catch {
      setError("Something went wrong loading the quiz. Try again.");
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setQuestions(null);
    setError(null);
  }

  const toolName = TOOL_BY_SLUG[tool]?.name ?? tool;

  if (questions) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10">
        <button
          onClick={reset}
          className="mb-4 text-sm font-medium text-muted hover:text-fg"
        >
          ← Pick a different sheet
        </button>
        <QuizEngine
          questions={questions}
          title={`${toolName} · ${level} readiness check`}
          ctaHref={`/interview-questions/${tool}/${level}`}
          ctaLabel="See the full sheet →"
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <div className="text-center">
        <h1 className="text-3xl font-extrabold tracking-tight text-fg sm:text-4xl">
          How ready are you?
        </h1>
        <p className="mx-auto mt-3 max-w-lg text-muted">
          Ten real interview-style questions, scored by area. Find out exactly
          where you&apos;d get caught — before the loop does it for you.
        </p>
      </div>

      <Card className="mt-8">
        <div className="mb-2 text-sm font-semibold text-fg">Pick a tool</div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {TOOLS.map((t) => (
            <button
              key={t.slug}
              onClick={() => setTool(t.slug)}
              className={cn(
                "flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-sm font-medium transition-colors",
                tool === t.slug
                  ? "border-navy bg-surface text-fg"
                  : "border-border bg-card text-muted hover:border-navy hover:text-fg"
              )}
            >
              <span className="text-lg">{t.icon}</span>
              {t.name}
            </button>
          ))}
        </div>

        <div className="mb-2 mt-6 text-sm font-semibold text-fg">
          Target level
        </div>
        <SegmentedTabs
          options={LEVELS.map((l) => ({ value: l.slug, label: l.name }))}
          value={level}
          onChange={(v) => setLevel(v as Level)}
        />

        {error && <p className="mt-4 text-sm text-danger">{error}</p>}

        <div className="mt-6">
          <Button onClick={start} disabled={loading} size="lg">
            {loading ? "Loading…" : "Start quiz →"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
