"use client";

import { useProgress } from "@/components/providers/progress-provider";
import type { Confidence } from "@/lib/types";
import { cn } from "@/lib/utils";

const OPTIONS: { value: Confidence; emoji: string; label: string }[] = [
  { value: "low", emoji: "😬", label: "Shaky" },
  { value: "medium", emoji: "😐", label: "Okay" },
  { value: "high", emoji: "💪", label: "Confident" },
];

/** Three-emoji self-rated confidence picker, persisted via the progress provider. */
export function ConfidencePicker({
  id,
  className,
}: {
  id: number;
  className?: string;
}) {
  const { getConfidence, setConfidence } = useProgress();
  const current = getConfidence(id);

  return (
    <div
      className={cn("inline-flex items-center gap-1", className)}
      role="radiogroup"
      aria-label="Confidence"
    >
      {OPTIONS.map((o) => {
        const active = current === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            title={o.label}
            onClick={() => setConfidence(id, o.value)}
            className={cn(
              "grid h-8 w-8 place-items-center rounded-full border text-base transition-colors",
              active
                ? "border-amber bg-amber/15 scale-105"
                : "border-border bg-card opacity-60 hover:opacity-100 hover:bg-surface"
            )}
          >
            <span aria-hidden>{o.emoji}</span>
          </button>
        );
      })}
    </div>
  );
}
