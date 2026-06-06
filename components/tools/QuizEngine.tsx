"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { cn } from "@/lib/utils";

export interface QuizEngineQuestion {
  id: string | number;
  prompt: string;
  choices: string[];
  correctIndex: number;
  area: string;
}

interface QuizEngineProps {
  questions: QuizEngineQuestion[];
  title: string;
  ctaHref?: string;
  ctaLabel?: string;
}

interface AreaStat {
  area: string;
  correct: number;
  total: number;
}

export function QuizEngine({
  questions,
  title,
  ctaHref,
  ctaLabel,
}: QuizEngineProps) {
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [areaStats, setAreaStats] = useState<Record<string, AreaStat>>({});
  const [done, setDone] = useState(false);

  const total = questions.length;
  const current = questions[index];

  function answer(choiceIndex: number) {
    if (picked !== null || !current) return;
    setPicked(choiceIndex);
    const correct = choiceIndex === current.correctIndex;
    if (correct) setScore((s) => s + 1);
    setAreaStats((prev) => {
      const cur = prev[current.area] ?? {
        area: current.area,
        correct: 0,
        total: 0,
      };
      return {
        ...prev,
        [current.area]: {
          area: current.area,
          correct: cur.correct + (correct ? 1 : 0),
          total: cur.total + 1,
        },
      };
    });
  }

  function next() {
    if (index + 1 >= total) {
      setDone(true);
    } else {
      setIndex((i) => i + 1);
      setPicked(null);
    }
  }

  const breakdown = useMemo(() => {
    const stats = Object.values(areaStats);
    const strong = stats
      .filter((s) => s.total > 0 && s.correct / s.total >= 0.6)
      .map((s) => s.area);
    const weak = stats
      .filter((s) => s.total > 0 && s.correct / s.total < 0.6)
      .map((s) => s.area);
    return { strong, weak };
  }, [areaStats]);

  const shareUrl =
    typeof window !== "undefined"
      ? `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(
          window.location.href
        )}`
      : "https://www.linkedin.com/sharing/share-offsite/?url=";

  if (!total) {
    return (
      <Card>
        <p className="text-muted">No questions available yet.</p>
      </Card>
    );
  }

  if (done) {
    const pct = Math.round((score / total) * 100);
    const verdict =
      pct >= 80
        ? "You're interview-ready 🎯"
        : pct >= 50
        ? "Solid foundation — close the gaps 💪"
        : "Time to drill before the loop 📚";
    return (
      <Card className="overflow-hidden">
        <div className="text-center">
          <div className="text-sm font-semibold uppercase tracking-wide text-muted">
            {title}
          </div>
          <div className="mt-3 text-6xl font-extrabold tracking-tight text-fg">
            {score}{" "}
            <span className="text-3xl font-bold text-muted">/ {total}</span>
          </div>
          <div className="mt-2 text-lg font-semibold text-amber">{verdict}</div>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-border bg-surface p-4">
            <div className="mb-2 text-sm font-semibold text-success">
              ✅ Strong on
            </div>
            {breakdown.strong.length ? (
              <div className="flex flex-wrap gap-2">
                {breakdown.strong.map((a) => (
                  <Badge key={a} tone="green">
                    {a}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted">
                Nothing aced yet — keep drilling.
              </p>
            )}
          </div>
          <div className="rounded-xl border border-border bg-surface p-4">
            <div className="mb-2 text-sm font-semibold text-danger">
              ⚠️ Weak on
            </div>
            {breakdown.weak.length ? (
              <div className="flex flex-wrap gap-2">
                {breakdown.weak.map((a) => (
                  <Badge key={a} tone="amber">
                    {a}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted">No weak areas — nicely done.</p>
            )}
          </div>
        </div>

        <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          {ctaHref && (
            <ButtonLink href={ctaHref} variant="amber" size="lg">
              {ctaLabel ?? "Continue →"}
            </ButtonLink>
          )}
          <ButtonLink href={shareUrl} variant="outline">
            Share on LinkedIn
          </ButtonLink>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <div className="mb-4 flex items-center justify-between gap-4">
        <div className="text-sm font-semibold uppercase tracking-wide text-muted">
          {title}
        </div>
        <Badge tone="navy">
          {index + 1} / {total}
        </Badge>
      </div>

      <ProgressBar value={((index + (picked !== null ? 1 : 0)) / total) * 100} />

      <div className="mt-5">
        <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-amber">
          {current.area}
        </div>
        <h2 className="text-xl font-bold text-fg">{current.prompt}</h2>
      </div>

      <div className="mt-5 grid gap-3">
        {current.choices.map((choice, i) => {
          const isPicked = picked === i;
          const isCorrect = i === current.correctIndex;
          const reveal = picked !== null;
          return (
            <button
              key={i}
              onClick={() => answer(i)}
              disabled={reveal}
              className={cn(
                "flex items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm font-medium transition-colors",
                !reveal &&
                  "border-border bg-card text-fg hover:border-navy hover:bg-surface",
                reveal &&
                  isCorrect &&
                  "border-success/40 bg-success/10 text-fg",
                reveal &&
                  isPicked &&
                  !isCorrect &&
                  "border-danger/40 bg-danger/10 text-fg",
                reveal &&
                  !isPicked &&
                  !isCorrect &&
                  "border-border bg-card text-muted"
              )}
            >
              <span
                className={cn(
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-bold",
                  reveal && isCorrect
                    ? "border-success bg-success text-white"
                    : reveal && isPicked
                    ? "border-danger bg-danger text-white"
                    : "border-border text-muted"
                )}
              >
                {String.fromCharCode(65 + i)}
              </span>
              <span>{choice}</span>
            </button>
          );
        })}
      </div>

      {picked !== null && (
        <div className="mt-5 flex items-center justify-between gap-4">
          <span
            className={cn(
              "text-sm font-semibold",
              picked === current.correctIndex ? "text-success" : "text-danger"
            )}
          >
            {picked === current.correctIndex
              ? "Correct ✅"
              : "Not quite — the highlighted one is right."}
          </span>
          <Button onClick={next}>
            {index + 1 >= total ? "See results →" : "Next question →"}
          </Button>
        </div>
      )}
    </Card>
  );
}
