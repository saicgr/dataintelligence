"use client";

import { useState } from "react";
import { useProgress } from "@/components/providers/progress-provider";
import { cn } from "@/lib/utils";

/**
 * "I was asked this" — logs the question to the user's asked set, optimistically
 * bumps the visible count, and POSTs to /api/asked when newly logged.
 */
export function IGotAskedButton({
  id,
  askedCount,
  className,
}: {
  id: number;
  askedCount: number;
  className?: string;
}) {
  const { hasAsked, markAsked } = useProgress();
  const [, setOptimistic] = useState(0);

  const logged = hasAsked(id);

  return (
    <button
      type="button"
      disabled={logged}
      onClick={() => {
        const newly = markAsked(id);
        if (newly) {
          setOptimistic(1);
          fetch("/api/asked", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ questionId: id }),
          }).catch(() => {});
        }
      }}
      title={logged ? "Logged — thanks for the signal" : "Were you asked this in a real interview? Let us know."}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-semibold transition-colors disabled:cursor-default",
        logged
          ? "border-success/40 bg-success/10 text-success"
          : "border-border bg-card text-fg hover:bg-surface",
        className
      )}
    >
      {logged ? (
        <>
          <span aria-hidden>✓</span> Logged
        </>
      ) : (
        <>
          <span aria-hidden>✋</span> I was asked this
        </>
      )}
    </button>
  );
}
