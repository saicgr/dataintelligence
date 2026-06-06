import type { Metadata } from "next";
import Link from "next/link";
import { STUDY_PLANS, planItemCount, type StudyPlan } from "@/lib/data/practice/study-plans";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Study plans — SQL 50, DE 50, AI 50 & more",
  description:
    "Curated, ordered interview-prep tracks: SQL 50, Data Engineering 50, AI Engineering 50, data reconciliation, RAG, agents & MCP, code review and more. Work the list, tick off progress.",
};

const TRACKS: { key: StudyPlan["track"]; label: string }[] = [
  { key: "headliner", label: "The big three" },
  { key: "ai", label: "AI Engineering" },
  { key: "data", label: "Data Engineering" },
  { key: "review", label: "Review" },
  { key: "incident", label: "Incident debugging" },
  { key: "foundations", label: "Foundations" },
];

export default function StudyPlansPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber">Study plans</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight text-fg sm:text-4xl">Pick a track and work the list</h1>
      <p className="mt-2 max-w-2xl text-muted">
        Curated, ordered sets — LeetCode-style — across SQL, Data Engineering, AI Engineering and review.
        Each links straight into the practice workbench and ticks off as you solve.
      </p>

      {TRACKS.map((t) => {
        const plans = STUDY_PLANS.filter((p) => p.track === t.key);
        if (!plans.length) return null;
        return (
          <section key={t.key} className="mt-8">
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-muted">{t.label}</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {plans.map((p) => (
                <Link
                  key={p.slug}
                  href={`/practice/plans/${p.slug}`}
                  className="flex flex-col rounded-xl border border-border bg-card p-5 shadow-card transition-colors hover:border-navy/40"
                >
                  <div className="flex items-center justify-between">
                    <span className={cn("text-lg font-bold tracking-tight", p.accent ?? "text-fg")}>{p.name}</span>
                    <span className="rounded-full bg-surface px-2 py-0.5 text-xs font-semibold text-muted">{planItemCount(p)}</span>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{p.blurb}</p>
                  <span className="mt-3 text-sm font-semibold text-amber">Start →</span>
                </Link>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
