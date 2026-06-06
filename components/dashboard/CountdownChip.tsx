"use client";

import { useState } from "react";
import { useProgress } from "@/components/providers/progress-provider";
import { daysUntil } from "@/lib/utils";
import { cn } from "@/lib/utils";

/** Shows interview countdown, or a date input to set one. Persists via provider + /api/settings. */
export function CountdownChip() {
  const { interviewDate, setInterviewDate, ready } = useProgress();
  const [value, setValue] = useState("");

  if (!ready) return null;

  if (interviewDate) {
    const n = daysUntil(interviewDate) ?? 0;
    const tone =
      n < 2
        ? "border-danger/40 bg-danger/10 text-danger"
        : n < 7
        ? "border-amber/40 bg-amber/10 text-amber"
        : "border-border bg-surface text-fg";
    const label =
      n < 0
        ? "Interview date has passed"
        : n === 0
        ? "Interviewing today — focus on the High-Risk ones"
        : `Interviewing in ${n} ${n === 1 ? "day" : "days"} — focus on the High-Risk ones`;
    return (
      <div
        className={cn(
          "flex items-center justify-between gap-3 rounded-xl border px-4 py-2.5 text-sm font-semibold",
          tone
        )}
      >
        <span className="flex items-center gap-2">
          <span aria-hidden>⏳</span>
          {label}
        </span>
        <button
          type="button"
          onClick={() => {
            setInterviewDate(null);
            fetch("/api/settings", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ interviewDate: null }),
            }).catch(() => {});
          }}
          className="text-xs font-medium underline opacity-80 hover:opacity-100"
        >
          Clear
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-surface px-4 py-2.5 text-sm">
      <span className="font-medium text-muted">📅 When&apos;s your interview?</span>
      <input
        type="date"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="rounded-lg border border-border bg-card px-2 py-1 text-sm text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-navy/40"
      />
      <button
        type="button"
        disabled={!value}
        onClick={() => {
          setInterviewDate(value);
          fetch("/api/settings", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ interviewDate: value }),
          }).catch(() => {});
        }}
        className="rounded-full bg-amber px-3 py-1 text-xs font-semibold text-white transition-colors hover:bg-amber/90 disabled:opacity-50"
      >
        Set interview date
      </button>
    </div>
  );
}
