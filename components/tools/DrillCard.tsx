"use client";

import { useState } from "react";
import type { Drill } from "@/lib/types";
import { Card } from "@/components/ui/Card";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { useProgress } from "@/components/providers/progress-provider";
import { TOOL_BY_SLUG } from "@/lib/catalog";
import { cn } from "@/lib/utils";

export function DrillCard({ drills }: { drills: Drill[] }) {
  const { recordDrill } = useProgress();
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [sessionXp, setSessionXp] = useState(0);
  const [done, setDone] = useState(false);

  const total = drills.length;
  const current = drills[index];

  function answer(choiceIndex: number) {
    if (picked !== null || !current) return;
    setPicked(choiceIndex);
    const correct = choiceIndex === current.correctIndex;
    recordDrill(current.xp, correct);
    if (correct) setSessionXp((x) => x + current.xp);
  }

  function next() {
    if (index + 1 >= total) {
      setDone(true);
    } else {
      setIndex((i) => i + 1);
      setPicked(null);
    }
  }

  if (!total) {
    return (
      <Card>
        <p className="text-muted">No drills available today. Check back soon.</p>
      </Card>
    );
  }

  if (done) {
    return (
      <Card className="text-center">
        <div className="text-5xl">🎉</div>
        <h2 className="mt-3 text-2xl font-extrabold text-fg">
          Come back tomorrow
        </h2>
        <p className="mt-2 text-muted">
          You earned{" "}
          <strong className="text-amber">⭐ {sessionXp} XP</strong> this session.
          Five fresh questions drop every day — keep the streak alive.
        </p>
        <div className="mt-5">
          <ButtonLink href="/interview-questions" variant="outline">
            Browse full sheets →
          </ButtonLink>
        </div>
      </Card>
    );
  }

  const correct = picked !== null && picked === current.correctIndex;
  const tool = TOOL_BY_SLUG[current.toolSlug];

  return (
    <Card>
      <div className="mb-3 flex items-center justify-between gap-4">
        <Badge tone="amber">
          {tool ? `${tool.icon} ${tool.name}` : current.toolSlug}
        </Badge>
        <Badge tone="navy">
          {index + 1} / {total}
        </Badge>
      </div>
      <ProgressBar value={(index / total) * 100} />

      <h2 className="mt-5 text-lg font-bold text-fg">{current.prompt}</h2>

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
                "rounded-xl border px-4 py-3 text-left text-sm font-medium transition-colors",
                !reveal &&
                  "border-border bg-card text-fg hover:border-navy hover:bg-surface",
                reveal && isCorrect && "border-success/40 bg-success/10 text-fg",
                reveal &&
                  isPicked &&
                  !isCorrect &&
                  "border-danger/40 bg-danger/10 text-fg",
                reveal && !isPicked && !isCorrect && "border-border text-muted"
              )}
            >
              {choice}
            </button>
          );
        })}
      </div>

      {picked !== null && (
        <div className="mt-5">
          <div
            className={cn(
              "rounded-xl border p-4 text-sm",
              correct
                ? "border-success/30 bg-success/10"
                : "border-danger/30 bg-danger/10"
            )}
          >
            <div
              className={cn(
                "font-semibold",
                correct ? "text-success" : "text-danger"
              )}
            >
              {correct ? `Correct! +${current.xp} XP` : "Not quite."}
            </div>
            <p className="mt-1 text-fg">{current.explanation}</p>
          </div>
          <div className="mt-4 flex justify-end">
            <Button onClick={next}>
              {index + 1 >= total ? "Finish →" : "Next →"}
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
