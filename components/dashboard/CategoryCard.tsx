"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { QuestionRow } from "./QuestionRow";
import { useProgress } from "@/components/providers/progress-provider";
import type { Level, QuestionStub, SheetCategory } from "@/lib/types";

/**
 * Sort weight: shaky-practiced (low confidence) float to top, then unpracticed,
 * then everything confident/done sinks to the bottom.
 */
function weight(
  q: QuestionStub,
  isPracticed: (id: number) => boolean,
  getConfidence: (id: number) => "low" | "medium" | "high" | null
): number {
  const practiced = isPracticed(q.id);
  const conf = getConfidence(q.id);
  if (practiced && conf === "low") return 0;
  if (!practiced) return 1;
  if (practiced && conf === "medium") return 2;
  return 3; // confident / high
}

export function CategoryCard({
  tool,
  level,
  category,
}: {
  tool: string;
  level: Level;
  category: SheetCategory;
}) {
  const { ready, isPracticed, getConfidence } = useProgress();

  const sorted = useMemo(() => {
    const qs = [...category.questions];
    if (!ready) return qs;
    return qs.sort((a, b) => {
      const wa = weight(a, isPracticed, getConfidence);
      const wb = weight(b, isPracticed, getConfidence);
      if (wa !== wb) return wa - wb;
      return a.sortOrder - b.sortOrder;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category.questions, ready, isPracticed, getConfidence]);

  const total = category.questions.length;
  const practicedCount = category.questions.filter((q) =>
    isPracticed(q.id)
  ).length;

  const firstId = category.questions[0]?.id;

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 text-base font-bold text-fg">
            <span aria-hidden>{category.icon}</span>
            {category.name}
          </h3>
          <p className="mt-0.5 text-sm text-muted">{category.description}</p>
        </div>
        {category.expanded && (
          <span className="flex-none rounded-full bg-surface px-2.5 py-0.5 text-xs font-semibold text-muted">
            {practicedCount}/{total}
          </span>
        )}
      </div>

      {category.expanded ? (
        <div className="mt-3 space-y-0.5">
          {sorted.map((q, i) => (
            <QuestionRow
              key={q.id}
              tool={tool}
              level={level}
              index={i + 1}
              question={q}
            />
          ))}
        </div>
      ) : (
        firstId != null && (
          <Link
            href={`/dashboard/${tool}/${level}/${firstId}`}
            className="mt-3 inline-block text-sm font-semibold text-amber hover:underline"
          >
            Open {category.name} →
          </Link>
        )
      )}
    </Card>
  );
}
