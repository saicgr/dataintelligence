"use client";

import { useState } from "react";
import Link from "next/link";
import { useProgress } from "@/components/providers/progress-provider";
import type { Level, SheetCategory } from "@/lib/types";

/** Surfaces the first category the user hasn't touched at all. Dismissible. */
export function WeakSpotNudge({
  tool,
  level,
  categories,
}: {
  tool: string;
  level: Level;
  categories: SheetCategory[];
}) {
  const { isPracticed, ready } = useProgress();
  const [dismissed, setDismissed] = useState(false);

  if (!ready || dismissed) return null;

  const untouched = categories.find(
    (c) =>
      c.questions.length > 0 &&
      c.questions.every((q) => !isPracticed(q.id))
  );
  if (!untouched) return null;

  const first = untouched.questions[0];

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-amber/30 bg-amber/5 px-4 py-3">
      <Link
        href={`/dashboard/${tool}/${level}/${first.id}`}
        className="flex items-center gap-2 text-sm font-medium text-fg hover:underline"
      >
        <span aria-hidden>{untouched.icon}</span>
        You haven&apos;t touched{" "}
        <span className="font-bold">{untouched.name}</span> yet →
      </Link>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={() => setDismissed(true)}
        className="flex-none rounded-full px-2 py-0.5 text-muted hover:bg-surface hover:text-fg"
      >
        ✕
      </button>
    </div>
  );
}
