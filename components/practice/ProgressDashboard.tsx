"use client";

import Link from "next/link";
import { useProgress } from "@/components/providers/progress-provider";
import { cn } from "@/lib/utils";

interface Cat { slug: string; name: string; total: number }

function daysAgo(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

export function ProgressDashboard({ categories }: { categories: Cat[] }) {
  const progress = useProgress();
  const counts = progress.practiceCountByCategory();
  const solves = progress.practiceSolves;
  const solveList = Object.entries(solves);
  const totalSolved = solveList.length;
  const grandTotal = categories.reduce((a, c) => a + c.total, 0);
  const overall = grandTotal ? Math.round((totalSolved / grandTotal) * 100) : 0;

  // Due for review: solved 3+ days ago (lightweight spaced repetition)
  const due = solveList.filter(([, v]) => daysAgo(v.solvedAt) >= 3);

  if (!progress.ready) {
    return <div className="py-20 text-center text-muted">Loading…</div>;
  }

  return (
    <div>
      <Link href="/practice" className="text-sm font-medium text-muted hover:text-fg">← Practice</Link>
      <h1 className="mt-3 flex items-center gap-2 text-3xl font-bold tracking-tight text-fg">Your readiness <span className="rounded-full bg-amber/15 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-amber">Beta</span></h1>
      <p className="mt-2 text-muted">Solve practice problems to fill these in. Everything is stored on this device.</p>

      {/* Top stats */}
      <div className="mt-6 grid grid-cols-3 gap-3">
        <Stat label="Solved" value={`${totalSolved}`} sub={`of ${grandTotal}`} />
        <Stat label="Readiness" value={`${overall}%`} accent />
        <Stat label="Streak" value={`${progress.practiceStreak}`} sub={progress.practiceStreak === 1 ? "day" : "days"} />
      </div>

      {/* Mastery bars */}
      <h2 className="mt-8 text-sm font-semibold uppercase tracking-wider text-muted">Mastery by skill</h2>
      <div className="mt-3 space-y-2.5">
        {categories.map((c) => {
          const done = counts[c.slug] ?? 0;
          const pct = c.total ? Math.round((done / c.total) * 100) : 0;
          return (
            <div key={c.slug}>
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="font-medium text-fg">{c.name}</span>
                <span className="text-xs text-muted">{done}/{c.total}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-surface">
                <div className={cn("h-full rounded-full transition-all", pct >= 100 ? "bg-success" : "bg-navy dark:bg-accent")} style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Due for review */}
      {due.length > 0 && (
        <div className="mt-8 rounded-xl border border-amber/30 bg-amber/5 p-4">
          <p className="text-sm font-semibold text-fg">Due for review</p>
          <p className="mt-1 text-xs text-muted">{due.length} problem{due.length === 1 ? "" : "s"} you solved 3+ days ago — re-solve to keep it sharp.</p>
          <Link href={`/practice?item=${due[0][0]}`} className="mt-3 inline-block rounded-full border border-amber/40 px-4 py-1.5 text-xs font-semibold text-amber hover:bg-amber/10">Review now →</Link>
        </div>
      )}

      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/practice/mock" className="rounded-full bg-navy px-6 py-2.5 text-sm font-semibold text-white dark:bg-accent dark:text-accent-fg">Take a mock →</Link>
        <Link href="/practice/plan" className="rounded-full border border-border px-6 py-2.5 text-sm font-semibold text-fg hover:bg-surface">Build a study plan</Link>
        {totalSolved > 0 && (
          <a href={`/api/og?title=${encodeURIComponent(`I'm ${overall}% interview-ready`)}&subtitle=${encodeURIComponent(`${totalSolved} problems solved · ${progress.practiceStreak}-day streak`)}`} target="_blank" rel="noreferrer" className="rounded-full border border-border px-6 py-2.5 text-sm font-semibold text-fg hover:bg-surface">Share progress card</a>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 text-center">
      <div className={cn("text-3xl font-bold tracking-tight", accent ? "text-navy dark:text-accent" : "text-fg")}>{value}</div>
      <div className="mt-0.5 text-xs text-muted">{label}{sub ? ` · ${sub}` : ""}</div>
    </div>
  );
}
