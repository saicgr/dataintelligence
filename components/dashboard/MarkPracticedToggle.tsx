"use client";

import { useProgress } from "@/components/providers/progress-provider";
import { cn } from "@/lib/utils";

/** Outline button that turns navy + ✓ when the question is marked practiced. */
export function MarkPracticedToggle({
  id,
  className,
}: {
  id: number;
  className?: string;
}) {
  const { isPracticed, togglePracticed } = useProgress();
  const practiced = isPracticed(id);

  return (
    <button
      type="button"
      onClick={() => {
        togglePracticed(id);
        fetch("/api/progress", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ questionId: id, practiced: !practiced }),
        }).catch(() => {});
      }}
      aria-pressed={practiced}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-semibold transition-colors",
        practiced
          ? "border-navy bg-navy text-white dark:border-accent dark:bg-accent dark:text-accent-fg"
          : "border-border bg-card text-fg hover:bg-surface",
        className
      )}
    >
      <span aria-hidden>{practiced ? "✓" : "○"}</span>
      {practiced ? "Practiced" : "Mark practiced"}
    </button>
  );
}
