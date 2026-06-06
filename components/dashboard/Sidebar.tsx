"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Brand } from "@/components/layout/Brand";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { CollapsibleSection } from "@/components/ui/CollapsibleSection";
import { SheetSwitcher } from "./SheetSwitcher";
import { useProgress } from "@/components/providers/progress-provider";
import { getBrowserSupabase } from "@/lib/supabase";
import { TOOL_BY_SLUG, LEVEL_NAMES, LEVELS } from "@/lib/catalog";
import type { Level, SheetCategory } from "@/lib/types";
import { cn } from "@/lib/utils";

export function Sidebar({
  tool,
  level,
  owned,
  hasBundle,
  categories,
  activeQuestionId,
}: {
  tool: string;
  level: Level;
  owned: string[];
  hasBundle: boolean;
  categories: SheetCategory[];
  activeQuestionId?: number;
}) {
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const router = useRouter();
  const progress = useProgress();
  const t = TOOL_BY_SLUG[tool];

  const allIds = useMemo(
    () => categories.flatMap((c) => c.questions.map((q) => q.id)),
    [categories]
  );
  const reviewed = allIds.filter((id) => progress.isPracticed(id)).length;
  const total = allIds.length;
  const pct = total ? Math.round((reviewed / total) * 100) : 0;
  const years = LEVELS.find((l) => l.slug === level)?.years ?? "";

  const signOut = async () => {
    const sb = getBrowserSupabase();
    if (sb) await sb.auth.signOut();
    router.push("/");
  };

  return (
    <aside className="flex w-[280px] flex-none flex-col border-r border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-3.5">
        <Brand />
        <ThemeToggle className="h-8 w-8" />
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 scroll-thin">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">
            Interview Cheat Sheet
          </span>
          <button
            onClick={() => setSwitcherOpen(true)}
            className="text-xs font-medium text-amber hover:underline"
          >
            Switch
          </button>
        </div>

        {/* Level / tool selector card */}
        <button
          onClick={() => setSwitcherOpen(true)}
          className="flex w-full items-center gap-3 rounded-xl bg-navy px-4 py-3 text-left text-white transition-colors hover:bg-navy/90 dark:bg-navy-surface"
        >
          <span className="grid h-9 w-9 flex-none place-items-center rounded-lg bg-white/10 text-lg">
            {t?.icon ?? "📘"}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-bold">
              {LEVEL_NAMES[level]} · {t?.name ?? tool}
            </span>
            <span className="block text-[11px] font-medium text-amber">
              {years}
            </span>
          </span>
          <svg viewBox="0 0 16 16" className="h-4 w-4 flex-none text-white/70" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M4 6l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        {/* Progress */}
        <div className="mt-4">
          <div className="mb-1.5 flex items-center justify-between text-sm text-muted">
            <span>{reviewed}/{total} reviewed</span>
            <span>{pct}%</span>
          </div>
          <ProgressBar value={pct} />
        </div>

        {/* Nav */}
        <nav className="mt-5 space-y-1">
          <Link
            href={`/dashboard/${tool}/${level}`}
            className={cn(
              "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium",
              !activeQuestionId
                ? "bg-navy text-white dark:bg-accent dark:text-accent-fg"
                : "text-fg hover:bg-surface"
            )}
          >
            <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6">
              <rect x="2" y="2" width="5" height="5" rx="1" />
              <rect x="9" y="2" width="5" height="5" rx="1" />
              <rect x="2" y="9" width="5" height="5" rx="1" />
              <rect x="9" y="9" width="5" height="5" rx="1" />
            </svg>
            Dashboard
          </Link>

          <Link
            href="/practice"
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-fg hover:bg-surface"
          >
            <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6">
              <circle cx="8" cy="8" r="6" />
              <path d="M8 5v3l2 1" strokeLinecap="round" />
            </svg>
            Practice
          </Link>

          <div className="pt-3">
            {categories.map((c) => (
              <CollapsibleSection
                key={c.slug}
                defaultOpen={c.expanded}
                title={
                  <span className="flex items-center gap-1.5">
                    <span>{c.icon}</span>
                    {c.name}
                  </span>
                }
                count={c.questions.length}
              >
                <ul className="ml-2 mt-1 space-y-0.5 border-l border-border pl-3">
                  {c.questions.map((q) => (
                    <li key={q.id}>
                      <Link
                        href={`/dashboard/${tool}/${level}/${q.id}`}
                        className={cn(
                          "block truncate rounded px-2 py-1 text-[13px]",
                          activeQuestionId === q.id
                            ? "bg-surface font-medium text-fg"
                            : "text-muted hover:bg-surface hover:text-fg"
                        )}
                        title={q.questionText}
                      >
                        {q.questionText}
                      </Link>
                    </li>
                  ))}
                </ul>
              </CollapsibleSection>
            ))}
          </div>
        </nav>
      </div>

      <div className="border-t border-border px-4 py-3">
        <button
          onClick={signOut}
          className="flex items-center gap-2 text-sm text-muted hover:text-fg"
        >
          <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6">
            <path d="M6 2H3v12h3M10 11l3-3-3-3M13 8H6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Sign out
        </button>
      </div>

      <SheetSwitcher
        open={switcherOpen}
        onClose={() => setSwitcherOpen(false)}
        currentTool={tool}
        currentLevel={level}
        owned={owned}
        hasBundle={hasBundle}
      />
    </aside>
  );
}
