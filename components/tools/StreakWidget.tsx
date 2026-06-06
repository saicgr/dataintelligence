"use client";

import { useProgress } from "@/components/providers/progress-provider";

export function StreakWidget() {
  const { drillStreak, drillXp, ready } = useProgress();

  return (
    <div className="flex flex-wrap gap-3">
      <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-4 py-2 text-sm font-semibold text-fg">
        🔥 {ready ? drillStreak : 0} day streak
      </div>
      <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-4 py-2 text-sm font-semibold text-fg">
        ⭐ {ready ? drillXp : 0} XP
      </div>
    </div>
  );
}
