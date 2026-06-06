"use client";

import { useProgress } from "@/components/providers/progress-provider";
import type { SheetCategory } from "@/lib/types";

/** Small stat strip: distinct study days + questions studied across the sheet. */
export function StudyStreak({ categories }: { categories: SheetCategory[] }) {
  const { ready, getLastStudied, isPracticed } = useProgress();
  if (!ready) return null;

  const ids = categories.flatMap((c) => c.questions.map((q) => q.id));

  const days = new Set<string>();
  let studied = 0;
  for (const id of ids) {
    const last = getLastStudied(id);
    if (last) {
      studied += 1;
      days.add(last.slice(0, 10));
    }
  }
  const practiced = ids.filter((id) => isPracticed(id)).length;

  if (studied === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-1 rounded-xl border border-border bg-surface px-4 py-3 text-sm">
      <span className="flex items-center gap-1.5 font-semibold text-fg">
        <span aria-hidden>🔥</span>
        {days.size} {days.size === 1 ? "day" : "days"} studied
      </span>
      <span className="text-muted">
        <span className="font-semibold text-fg">{studied}</span> questions touched
      </span>
      <span className="text-muted">
        <span className="font-semibold text-fg">{practiced}</span> practiced
      </span>
    </div>
  );
}
