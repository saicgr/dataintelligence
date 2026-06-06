"use client";

import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { RiskBadge } from "@/components/ui/RiskBadge";
import { useProgress } from "@/components/providers/progress-provider";
import { daysUntil, timeAgo } from "@/lib/utils";
import type { Level, SheetCategory } from "@/lib/types";

/** Practiced questions that are shaky or stale (studied > 3 days ago). Up to 5. */
export function DueForReview({
  tool,
  level,
  categories,
}: {
  tool: string;
  level: Level;
  categories: SheetCategory[];
}) {
  const { ready, isPracticed, getConfidence, getLastStudied } = useProgress();
  if (!ready) return null;

  const stubs = categories.flatMap((c) => c.questions);

  const due = stubs
    .filter((q) => {
      if (!isPracticed(q.id)) return false;
      if (getConfidence(q.id) === "low") return true;
      const last = getLastStudied(q.id);
      if (!last) return false;
      const ageDays = -(daysUntil(last.slice(0, 10)) ?? 0);
      return ageDays > 3;
    })
    .slice(0, 5);

  if (due.length === 0) return null;

  return (
    <Card>
      <div className="mb-3 flex items-center gap-2 text-sm font-bold text-fg">
        <span aria-hidden>🔁</span> Due for review
      </div>
      <ul className="space-y-1.5">
        {due.map((q) => {
          const last = getLastStudied(q.id);
          const conf = getConfidence(q.id);
          return (
            <li key={q.id}>
              <Link
                href={`/dashboard/${tool}/${level}/${q.id}`}
                className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-surface"
              >
                <span className="min-w-0 flex-1 truncate text-fg">
                  {q.questionText}
                </span>
                {conf === "low" && <span aria-hidden>😬</span>}
                <RiskBadge risk={q.riskLevel} showLabel={false} />
                {last && (
                  <span className="flex-none text-xs text-muted">
                    {timeAgo(last)}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
