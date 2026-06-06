"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { PracticeItem, PracticeCategory } from "@/lib/data/practice/types";
import { PRACTICE_CATEGORIES } from "@/lib/data/practice/types";
import { SqlWorkbench } from "./PracticeWorkbench";
import { ConvWorkbench } from "./ConvWorkbench";
import { PromptWorkbench } from "./PromptWorkbench";
import { PromptOptWorkbench } from "./PromptOptWorkbench";
import { ReviewWorkbench } from "./ReviewWorkbench";
import { PrReviewWorkbench } from "./PrReviewWorkbench";
import { IncidentWorkbench } from "./IncidentWorkbench";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import { SegmentedTabs } from "@/components/ui/Tabs";
import {
  LEVEL_NAMES,
  PRACTICE_PRO_PRICE,
  PRACTICE_PRO_ANNUAL_PRICE,
  PRACTICE_PRO_ANNUAL_MONTHLY,
  PRACTICE_PRO_ANNUAL_SAVE,
} from "@/lib/catalog";
import { cn } from "@/lib/utils";

const diffTone = { easy: "green", medium: "amber", hard: "neutral" } as const;

const GROUPS = [
  { key: "core", label: "Core" },
  { key: "ai", label: "AI Eng" },
  { key: "review", label: "Review" },
  { key: "design", label: "Design" },
  { key: "admin", label: "Admin" },
] as const;

export function PracticeBrowser({
  items,
  hasAi,
  practicePro,
}: {
  items: PracticeItem[];
  hasAi: boolean;
  practicePro: boolean;
}) {
  const [cat, setCat] = useState<PracticeCategory>("sql");
  const [level, setLevel] = useState<string>("all");
  const [active, setActive] = useState<PracticeItem | null>(null);
  const [paywall, setPaywall] = useState(false);
  const [plan, setPlan] = useState<"monthly" | "annual">("annual");
  const [loadingCheckout, setLoadingCheckout] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  // Deep-link support: ?item=<id> opens a problem; ?cat=<slug> selects a tab.
  useEffect(() => {
    const itemId = searchParams.get("item");
    const catParam = searchParams.get("cat") as PracticeCategory | null;
    if (itemId) {
      const found = items.find((it) => it.id === itemId);
      if (found) {
        if (found.free || practicePro) setActive(found);
        else setPaywall(true);
        setCat(found.category);
        return;
      }
    }
    if (catParam && PRACTICE_CATEGORIES.some((c) => c.slug === catParam)) setCat(catParam);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  if (active) {
    return (
      <>
        <div className="mx-auto max-w-[1500px]">
          {active.category === "sql" ? (
            <SqlWorkbench problem={active} hasAi={hasAi} practicePro={practicePro} onUpgrade={() => setPaywall(true)} onBack={() => setActive(null)} />
          ) : active.incident ? (
            <IncidentWorkbench item={active} hasAi={hasAi} practicePro={practicePro} onUpgrade={() => setPaywall(true)} onBack={() => setActive(null)} />
          ) : active.promptOpt ? (
            <PromptOptWorkbench item={active} hasAi={hasAi} practicePro={practicePro} onUpgrade={() => setPaywall(true)} onBack={() => setActive(null)} />
          ) : active.category === "prompting" && active.promptEval ? (
            <PromptWorkbench item={active} hasAi={hasAi} practicePro={practicePro} onUpgrade={() => setPaywall(true)} onBack={() => setActive(null)} />
          ) : active.review?.files ? (
            <PrReviewWorkbench item={active} hasAi={hasAi} practicePro={practicePro} onUpgrade={() => setPaywall(true)} onBack={() => setActive(null)} />
          ) : active.review ? (
            <ReviewWorkbench item={active} hasAi={hasAi} practicePro={practicePro} onUpgrade={() => setPaywall(true)} onBack={() => setActive(null)} />
          ) : (
            <ConvWorkbench item={active} hasAi={hasAi} practicePro={practicePro} onUpgrade={() => setPaywall(true)} onBack={() => setActive(null)} />
          )}
        </div>
        <Paywall open={paywall} onClose={() => setPaywall(false)} plan={plan} setPlan={setPlan} loading={loadingCheckout} onStart={() => startCheckout(plan)} />
      </>
    );
  }

  const counts: Record<string, number> = {};
  for (const it of items) counts[it.category] = (counts[it.category] ?? 0) + 1;

  const visible = items.filter(
    (it) => it.category === cat && (level === "all" || it.level === level)
  );

  const locked = (it: PracticeItem) => !it.free && !practicePro;

  function open(it: PracticeItem) {
    if (locked(it)) setPaywall(true);
    else setActive(it);
  }

  async function startCheckout(chosen: "monthly" | "annual" = plan) {
    setLoadingCheckout(true);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ practicePro: true, plan: chosen }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else {
        setPaywall(false);
        router.refresh();
      }
    } finally {
      setLoadingCheckout(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl">
      {/* Intro */}
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber">Practice</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-fg sm:text-4xl">Run the interview, don&apos;t just read it</h1>
        <p className="mt-2 max-w-2xl text-muted">
          Real company-style questions. Write SQL and <strong>run it against a live dataset</strong>, or
          drill Python, PySpark, AI, prompts, code reviews and case studies with the AI coach — graded on
          the spot. A few are free; the rest unlock with Practice Pro.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/practice/plans" className="inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-1.5 text-sm font-semibold text-fg hover:border-navy/40 hover:bg-surface">🗂 Study plans <span className="rounded-full bg-navy/10 px-1.5 text-[10px] font-bold uppercase text-navy dark:bg-accent/15 dark:text-accent">SQL50·DE50·AI50</span></Link>
          <Link href="/practice/plan" className="inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-1.5 text-sm font-semibold text-fg hover:border-navy/40 hover:bg-surface">🎯 Target a role <span className="rounded-full bg-amber/15 px-1.5 text-[10px] font-bold uppercase text-amber">Beta</span></Link>
          <Link href="/practice/mock" className="inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-1.5 text-sm font-semibold text-fg hover:border-navy/40 hover:bg-surface">⏱ Mock interview <span className="rounded-full bg-amber/15 px-1.5 text-[10px] font-bold uppercase text-amber">Beta</span></Link>
          <Link href="/practice/progress" className="inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-1.5 text-sm font-semibold text-fg hover:border-navy/40 hover:bg-surface">📈 Your readiness <span className="rounded-full bg-amber/15 px-1.5 text-[10px] font-bold uppercase text-amber">Beta</span></Link>
        </div>
      </div>
      {/* Category tabs, grouped to stay navigable across ~22 categories */}
      <div className="mb-5 space-y-2 border-b border-border pb-3">
        {GROUPS.map((g) => {
          const cats = PRACTICE_CATEGORIES.filter((c) => c.group === g.key);
          if (!cats.length) return null;
          return (
            <div key={g.key} className="flex flex-wrap items-center gap-2">
              <span className="w-20 shrink-0 text-[10px] font-semibold uppercase tracking-wider text-muted/70">{g.label}</span>
              {cats.map((c) => (
                <button
                  key={c.slug}
                  onClick={() => setCat(c.slug)}
                  className={cn(
                    "rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors",
                    cat === c.slug ? "bg-navy text-white dark:bg-accent dark:text-accent-fg" : "text-muted hover:bg-surface hover:text-fg"
                  )}
                >
                  {c.name}
                  <span className="ml-1.5 text-xs opacity-70">{counts[c.slug] ?? 0}</span>
                </button>
              ))}
            </div>
          );
        })}
      </div>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <SegmentedTabs
          value={level}
          onChange={setLevel}
          options={[
            { value: "all", label: "All levels" },
            { value: "junior", label: "Junior" },
            { value: "mid", label: "Mid" },
            { value: "senior", label: "Senior" },
          ]}
        />
        {practicePro ? (
          <Badge tone="green">Practice Pro active</Badge>
        ) : (
          <button onClick={() => setPaywall(true)} className="rounded-full bg-amber px-4 py-1.5 text-sm font-semibold text-white hover:bg-amber/90">
            Get Practice Pro · {PRACTICE_PRO_PRICE}/mo
          </button>
        )}
      </div>

      <p className="mb-4 text-sm text-muted">
        {PRACTICE_CATEGORIES.find((c) => c.slug === cat)?.blurb}
      </p>

      {visible.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-8 text-center text-muted">
          More {PRACTICE_CATEGORIES.find((c) => c.slug === cat)?.name} questions coming soon.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((it) => {
            const lock = locked(it);
            return (
              <button
                key={it.id}
                onClick={() => open(it)}
                className={cn(
                  "flex flex-col rounded-xl border border-border bg-card p-5 text-left shadow-card transition-colors hover:border-navy/40",
                  lock && "opacity-90"
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs text-muted">{it.company}</span>
                  <Badge tone={diffTone[it.difficulty]}>{it.difficulty}</Badge>
                </div>
                <span className="mt-2 text-base font-bold tracking-tight text-fg">{it.title}</span>
                <div className="mt-3 flex items-center gap-2">
                  <Badge tone="muted">{LEVEL_NAMES[it.level]}</Badge>
                  {it.free ? (
                    <Badge tone="green">Free</Badge>
                  ) : lock ? (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber">
                      <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="1.6">
                        <rect x="3" y="7" width="10" height="6" rx="1" />
                        <path d="M5 7V5a3 3 0 016 0v2" />
                      </svg>
                      Pro
                    </span>
                  ) : (
                    <Badge tone="amber">Pro</Badge>
                  )}
                </div>
                <span className="mt-3 text-sm font-semibold text-amber">
                  {lock ? "Unlock with Pro →" : it.category === "sql" ? "Solve (runs live) →" : "Start →"}
                </span>
              </button>
            );
          })}
        </div>
      )}

      <Paywall open={paywall} onClose={() => setPaywall(false)} plan={plan} setPlan={setPlan} loading={loadingCheckout} onStart={() => startCheckout(plan)} />
    </div>
  );
}

function Paywall({
  open,
  onClose,
  plan,
  setPlan,
  loading,
  onStart,
}: {
  open: boolean;
  onClose: () => void;
  plan: "monthly" | "annual";
  setPlan: (p: "monthly" | "annual") => void;
  loading: boolean;
  onStart: () => void;
}) {
  return (
    <Modal open={open} onClose={onClose} className="max-w-md">
      <div className="p-6 text-center">
        <Badge tone="amber">Practice Pro</Badge>
        <h2 className="mt-3 text-2xl font-bold tracking-tight text-fg">Unlock the full question bank</h2>
        <p className="mt-2 text-sm text-muted">
          Every question across SQL, Python, PySpark, AI, Prompt Engineering, Code Review and Case
          Studies — unlimited submissions, the live AI coach, hints, optimization tips and reveal-answer.
        </p>

        {/* Monthly / Annual toggle */}
        <div className="mt-5 inline-flex rounded-full border border-border bg-surface p-1 text-sm">
          <button onClick={() => setPlan("monthly")} className={cn("rounded-full px-4 py-1.5 font-medium", plan === "monthly" ? "bg-navy text-white dark:bg-accent dark:text-accent-fg" : "text-muted")}>Monthly</button>
          <button onClick={() => setPlan("annual")} className={cn("inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 font-medium", plan === "annual" ? "bg-navy text-white dark:bg-accent dark:text-accent-fg" : "text-muted")}>
            Annual <span className="rounded-full bg-amber/20 px-1.5 text-[10px] font-bold text-amber">Save {PRACTICE_PRO_ANNUAL_SAVE}</span>
          </button>
        </div>

        <div className="mt-4 text-3xl font-bold tracking-tight text-fg">
          {plan === "annual" ? (
            <>{PRACTICE_PRO_ANNUAL_PRICE}<span className="text-base font-medium text-muted">/yr</span></>
          ) : (
            <>{PRACTICE_PRO_PRICE}<span className="text-base font-medium text-muted">/mo</span></>
          )}
        </div>
        {plan === "annual" && <p className="text-xs text-muted">just {PRACTICE_PRO_ANNUAL_MONTHLY}/mo, billed yearly</p>}

        <button onClick={onStart} disabled={loading} className="mt-5 w-full rounded-full bg-navy px-6 py-3 text-sm font-semibold text-white hover:bg-navy/90 disabled:opacity-50 dark:bg-accent dark:text-accent-fg">
          {loading ? "Starting…" : "Start Practice Pro"}
        </button>
        <p className="mt-3 text-xs text-muted">Cancel anytime. Cheat sheets are separate one-time purchases.</p>
      </div>
    </Modal>
  );
}
