"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { CheatSheetSelector } from "@/components/marketing/CheatSheetSelector";
import {
  BUNDLE_PRICE,
  PRACTICE_PRO_PRICE,
  PRACTICE_PRO_ANNUAL_PRICE,
  PRACTICE_PRO_ANNUAL_MONTHLY,
  PRACTICE_PRO_ANNUAL_SAVE,
} from "@/lib/catalog";
import { cn } from "@/lib/utils";

const SHEET_BULLETS = [
  "Every tool, every level — all cheat sheets unlocked",
  "Full senior-level answers to every question",
  "The Interviewer's Lens on what they're really scoring",
  "Red Zone / Green Zone phrasing cues + follow-up chains",
  "Free lifetime updates as new questions land",
];

const PRO_BULLETS = [
  "The full practice bank — SQL, Python, PySpark, AI, Prompt Engineering & more",
  "Real in-browser SQL execution + correctness grading",
  "The live AI interviewer — align, hints, follow-ups",
  "AI cheat-sheet generator — paste a JD, get a tailored prep kit",
  "Mock Interview, role targeting & readiness tracking (beta)",
  "Cancel anytime",
];

export default function PricingPage() {
  const [loadingPro, setLoadingPro] = useState(false);
  const [proPlan, setProPlan] = useState<"monthly" | "annual">("annual");

  async function startPro() {
    setLoadingPro(true);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ practicePro: true, plan: proPlan }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else window.location.href = "/practice";
    } finally {
      setLoadingPro(false);
    }
  }

  return (
    <div className="px-4 py-20">
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber">
            One price for the sheets · one for practice
          </p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight text-fg sm:text-5xl">
            Simple, honest pricing
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-muted">
            Get <strong>all the cheat sheets</strong> for a one-time {BUNDLE_PRICE}, or
            subscribe to <strong>interactive coding practice</strong> monthly or yearly.
            That&apos;s it — no per-tool prices, no add-ons.
          </p>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-2">
          {/* Cheat Sheets — one-time */}
          <Card className="flex flex-col p-8">
            <Badge tone="amber">Cheat Sheets · one-time</Badge>
            <h2 className="mt-4 text-2xl font-bold tracking-tight text-fg">
              Read the real questions
            </h2>
            <p className="mt-2 text-sm text-muted">Pick one skill, or get them all. Pay once — yours for good.</p>
            <ul className="mt-5 flex-1 space-y-2 text-sm text-fg">
              {SHEET_BULLETS.map((b) => (
                <li key={b} className="flex gap-2"><span aria-hidden className="text-amber">✓</span><span>{b}</span></li>
              ))}
            </ul>
            <div className="mt-6"><CheatSheetSelector /></div>
          </Card>

          {/* Practice — subscription */}
          <Card className="flex flex-col border-navy/30 p-8 dark:border-accent/30">
            <div className="flex items-center gap-2">
              <Badge tone="navy">Practice · subscription</Badge>
              <Badge tone="muted">Beta</Badge>
            </div>
            <h2 className="mt-4 text-2xl font-bold tracking-tight text-fg">
              Train like the real thing
            </h2>

            {/* Monthly / Annual toggle */}
            <div className="mt-4 inline-flex w-fit rounded-full border border-border bg-surface p-1 text-sm">
              <button onClick={() => setProPlan("monthly")} className={cn("rounded-full px-3 py-1 font-medium", proPlan === "monthly" ? "bg-navy text-white dark:bg-accent dark:text-accent-fg" : "text-muted")}>Monthly</button>
              <button onClick={() => setProPlan("annual")} className={cn("inline-flex items-center gap-1 rounded-full px-3 py-1 font-medium", proPlan === "annual" ? "bg-navy text-white dark:bg-accent dark:text-accent-fg" : "text-muted")}>
                Yearly <span className="rounded-full bg-amber/20 px-1.5 text-[10px] font-bold text-amber">Save {PRACTICE_PRO_ANNUAL_SAVE}</span>
              </button>
            </div>
            <div className="mt-4 flex items-baseline gap-1">
              <span className="text-5xl font-bold tracking-tight text-fg">{proPlan === "annual" ? PRACTICE_PRO_ANNUAL_PRICE : PRACTICE_PRO_PRICE}</span>
              <span className="text-base font-medium text-muted">{proPlan === "annual" ? "/yr" : "/mo"}</span>
            </div>
            <p className="mt-1 text-sm text-muted">{proPlan === "annual" ? `just ${PRACTICE_PRO_ANNUAL_MONTHLY}/mo · cancel anytime` : "cancel anytime"}</p>

            <ul className="mt-6 flex-1 space-y-2 text-sm text-fg">
              {PRO_BULLETS.map((b) => (
                <li key={b} className="flex gap-2"><span aria-hidden className="text-amber">✓</span><span>{b}</span></li>
              ))}
            </ul>
            <button onClick={startPro} disabled={loadingPro} className="mt-8 w-full rounded-full bg-navy px-8 py-3.5 text-base font-semibold text-white hover:bg-navy/90 disabled:opacity-50 dark:bg-accent dark:text-accent-fg">
              {loadingPro ? "Starting…" : `Start Practice — ${proPlan === "annual" ? PRACTICE_PRO_ANNUAL_PRICE + "/yr" : PRACTICE_PRO_PRICE + "/mo"}`}
            </button>
            <p className="mt-3 text-center text-xs text-muted">Or <a href="/practice" className="underline">try the free questions →</a></p>
          </Card>
        </div>

        <p className="mx-auto mt-8 max-w-xl text-center text-xs text-muted">
          Mock Interview, role targeting and readiness tracking are in <strong>beta</strong> and improving fast.
          Cheat sheets and core SQL/Python practice are fully ready today.
        </p>
      </div>
    </div>
  );
}
