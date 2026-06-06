"use client";

import Link from "next/link";
import { useProgress } from "@/components/providers/progress-provider";
import { cn } from "@/lib/utils";

export interface PlanItemMeta {
  id: string;
  title: string;
  category: string;
  level: string;
  company: string;
  difficulty: "easy" | "medium" | "hard";
  free: boolean;
}
export interface PlanSectionView {
  title: string;
  blurb?: string;
  items: PlanItemMeta[];
}

const diffDot = { easy: "bg-success", medium: "bg-amber", hard: "bg-danger" } as const;

/** Guided checklist for a study plan: ticks completed items via local progress. */
export function PlanChecklist({ sections }: { sections: PlanSectionView[] }) {
  const { isPracticeSolved, ready } = useProgress();
  const all = sections.flatMap((s) => s.items);
  const done = ready ? all.filter((i) => isPracticeSolved(i.id)).length : 0;
  const pct = all.length ? Math.round((done / all.length) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Overall progress */}
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="mb-1.5 flex items-baseline justify-between">
          <span className="text-sm font-semibold text-fg">Your progress</span>
          <span className="text-sm font-bold tabular-nums text-fg">{done}<span className="text-muted">/{all.length}</span></span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-surface">
          <div className="h-full rounded-full bg-gradient-to-r from-navy to-success transition-all dark:from-accent" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {sections.map((s, si) => {
        const sd = ready ? s.items.filter((i) => isPracticeSolved(i.id)).length : 0;
        return (
          <section key={si}>
            <div className="mb-2 flex items-baseline gap-2">
              <h2 className="text-sm font-bold uppercase tracking-wider text-fg">{s.title}</h2>
              <span className="text-xs text-muted">{sd}/{s.items.length}</span>
              {s.blurb && <span className="ml-auto hidden text-xs text-muted sm:block">{s.blurb}</span>}
            </div>
            <ol className="overflow-hidden rounded-xl border border-border">
              {s.items.map((it, i) => {
                const solved = ready && isPracticeSolved(it.id);
                return (
                  <li key={it.id} className={cn("border-b border-border last:border-0", solved && "bg-success/5")}>
                    <Link
                      href={`/practice?cat=${it.category}&item=${it.id}`}
                      className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface"
                    >
                      <span className={cn("grid h-5 w-5 shrink-0 place-items-center rounded-full border text-[11px]", solved ? "border-success bg-success text-white" : "border-border text-transparent")}>✓</span>
                      <span className="w-6 shrink-0 text-right text-xs tabular-nums text-muted">{i + 1}</span>
                      <span className={cn("inline-block h-1.5 w-1.5 shrink-0 rounded-full", diffDot[it.difficulty])} />
                      <span className={cn("flex-1 truncate text-sm", solved ? "text-muted line-through" : "text-fg")}>{it.title}</span>
                      <span className="hidden shrink-0 font-mono text-[11px] text-muted sm:block">{it.company}</span>
                      {it.free && <span className="shrink-0 rounded-full bg-success/15 px-1.5 text-[10px] font-bold uppercase text-success">Free</span>}
                    </Link>
                  </li>
                );
              })}
            </ol>
          </section>
        );
      })}
    </div>
  );
}
