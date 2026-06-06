"use client";

import { useMemo } from "react";
import { CountdownChip } from "./CountdownChip";
import { WeakSpotNudge } from "./WeakSpotNudge";
import { DueForReview } from "./DueForReview";
import { StudyStreak } from "./StudyStreak";
import { CategoryCard } from "./CategoryCard";
import { CommandPalette, type PaletteItem } from "./CommandPalette";
import type { Level, SheetCategory } from "@/lib/types";

/** Client orchestrator for the dashboard main panel widgets + category stack. */
export function DashboardMain({
  tool,
  level,
  categories,
}: {
  tool: string;
  level: Level;
  categories: SheetCategory[];
}) {
  const paletteItems = useMemo<PaletteItem[]>(
    () =>
      categories.flatMap((c) =>
        c.questions.map((q) => ({
          id: q.id,
          questionText: q.questionText,
          url: `/dashboard/${tool}/${level}/${q.id}`,
        }))
      ),
    [categories, tool, level]
  );

  return (
    <div className="space-y-5">
      <CountdownChip />
      <WeakSpotNudge tool={tool} level={level} categories={categories} />
      <DueForReview tool={tool} level={level} categories={categories} />
      <StudyStreak categories={categories} />

      <div className="space-y-4">
        {categories.map((c) => (
          <CategoryCard
            key={c.slug}
            tool={tool}
            level={level}
            category={c}
          />
        ))}
      </div>

      <CommandPalette items={paletteItems} />
    </div>
  );
}
