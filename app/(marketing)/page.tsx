import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { CheatSheetSelector } from "@/components/marketing/CheatSheetSelector";
import {
  SITE_NAME,
  BUNDLE_PRICE,
  PRACTICE_PRO_PRICE,
  PRACTICE_PRO_ANNUAL_MONTHLY,
  TRACKS,
  TOOLS,
  toolsByTrack,
} from "@/lib/catalog";

export const metadata: Metadata = {
  title: `${SITE_NAME} — The data & AI interview questions they actually ask`,
  description:
    "Real Data & AI Engineering interview questions — researched from how real loops run and fact-checked against the official docs. Snowflake, dbt, Airflow, Kafka, Spark, Databricks plus LLMs, RAG, vector DBs and agents — across three seniority levels.",
};

const STATS = [
  { value: "14", label: "Tools covered" },
  { value: "42", label: "Cheat sheets" },
  { value: "550+", label: "Questions" },
  { value: "3", label: "Seniority levels" },
];

const STEPS = [
  {
    n: "01",
    title: "The questions that actually come up",
    body: "Researched from how real data & AI loops run — public interview reports, practitioners, and the official docs — not invented trivia or padding.",
  },
  {
    n: "02",
    title: "Pick your tool + level",
    body: "Choose Snowflake, Spark, RAG, agents — whatever the role leans on — then dial in Junior, Mid or Senior. The answers shift with you.",
  },
  {
    n: "03",
    title: "Know what they're listening for",
    body: "Each answer comes with the Interviewer's Lens, red/green zones and follow-up chains — so you read the room, not just the question.",
  },
];

export default function HomePage() {
  return (
    <>
      {/* Hero */}
      <section className="px-4 py-24 sm:py-28">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber">
            Researched from real data &amp; AI interview loops
          </p>
          <h1 className="mt-5 text-balance text-5xl font-bold tracking-tight text-fg sm:text-6xl">
            The questions they <span className="text-amber">actually</span> ask
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted">
            Data &amp; AI Engineering interview prep across{" "}
            <span className="font-mono text-fg">Snowflake</span>,{" "}
            <span className="font-mono text-fg">dbt</span>,{" "}
            <span className="font-mono text-fg">Airflow</span>,{" "}
            <span className="font-mono text-fg">Kafka</span>,{" "}
            <span className="font-mono text-fg">Spark</span>,{" "}
            <span className="font-mono text-fg">Databricks</span> — plus the AI
            stack: LLMs, RAG, vector DBs and agents. Read the real questions, or practice them live.
          </p>
          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <ButtonLink href="/cheat-sheets" size="lg">
              Browse cheat sheets →
            </ButtonLink>
            <ButtonLink href="/practice" variant="outline" size="lg">
              Try practice free
            </ButtonLink>
          </div>
          <p className="mt-8 text-sm text-muted">
            {TOOLS.map((t) => t.name).join(" · ")}
          </p>
        </div>
      </section>

      {/* Stats bar */}
      <section className="border-y border-border bg-surface">
        <div className="mx-auto grid max-w-5xl grid-cols-2 divide-x divide-y divide-border sm:grid-cols-4 sm:divide-y-0">
          {STATS.map((s) => (
            <div key={s.label} className="px-6 py-8 text-center">
              <div className="text-4xl font-bold tracking-tight text-fg">
                {s.value}
              </div>
              <div className="mt-1 text-xs font-semibold uppercase tracking-wider text-muted">
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Two ways to prep — the core distinction */}
      <section className="px-4 py-20">
        <div className="mx-auto max-w-5xl">
          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber">Two ways to prep</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-fg sm:text-4xl">Read it, or do it</h2>
            <p className="mx-auto mt-3 max-w-2xl text-muted">Pick whichever fits how you study — or use both. Two products, two prices, nothing else.</p>
          </div>
          <div className="mt-12 grid gap-6 md:grid-cols-2">
            {/* Cheat Sheets */}
            <Card className="flex flex-col p-8">
              <div className="flex items-center justify-between">
                <Badge tone="amber">Read it</Badge>
                <span className="text-2xl" aria-hidden>📓</span>
              </div>
              <h3 className="mt-4 text-2xl font-bold tracking-tight text-fg">Cheat Sheets</h3>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-muted">
                The real questions, researched from how loops actually run — with full answers, the Interviewer&apos;s Lens and
                red/green-zone cues. You <strong>read and study</strong> — no setup, no grading.
              </p>
              <div className="mt-5"><CheatSheetSelector /></div>
            </Card>
            {/* Practice */}
            <Card className="flex flex-col border-navy/30 p-8 dark:border-accent/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2"><Badge tone="navy">Do it</Badge><Badge tone="muted">Beta</Badge></div>
                <span className="text-2xl" aria-hidden>⚡</span>
              </div>
              <h3 className="mt-4 text-2xl font-bold tracking-tight text-fg">Practice</h3>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-muted">
                <strong>Write and run</strong> SQL, Python, PySpark and prompts against live data, graded
                on the spot by an AI interviewer. Plus mock interviews and readiness tracking.
              </p>
              <div className="mt-5 flex items-baseline gap-1">
                <span className="text-3xl font-bold tracking-tight text-fg">{PRACTICE_PRO_ANNUAL_MONTHLY}</span>
                <span className="text-sm text-muted">/mo billed yearly · or {PRACTICE_PRO_PRICE}/mo</span>
              </div>
              <ButtonLink href="/practice" variant="outline" className="mt-6 w-full">Start practicing →</ButtonLink>
            </Card>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="border-t border-border px-4 py-20">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center text-3xl font-bold tracking-tight text-fg">
            How the cheat sheets work
          </h2>
          <div className="mt-12 grid gap-10 sm:grid-cols-3">
            {STEPS.map((step) => (
              <div key={step.n}>
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-amber/15 text-sm font-bold text-amber">
                  {step.n}
                </div>
                <h3 className="mt-5 text-lg font-bold tracking-tight text-fg">
                  {step.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">
                  {step.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Simulation Mode (the interviewmaster-style interactive practice) */}
      <section className="border-t border-border bg-navy px-4 py-20 text-white dark:bg-navy-surface">
        <div className="mx-auto grid max-w-5xl items-center gap-10 md:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber">
              Practice · Simulation Mode
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
              Don&apos;t just read. Run the interview.
            </h2>
            <p className="mt-4 text-white/70">
              Pick a real company-style SQL problem, talk through your approach
              with the AI interviewer, then <strong>write SQL and actually run
              it against a live dataset</strong> — graded on real correctness,
              with follow-ups when you nail it. Free to try.
            </p>
            <ul className="mt-6 space-y-2 text-sm text-white/80">
              <li>💬 Conversational interviewer — align, hint, follow-up</li>
              <li>⚡ Real in-browser SQL execution + correctness check</li>
              <li>🎯 Company-style problems across every level</li>
            </ul>
            <div className="mt-8">
              <ButtonLink href="/practice" variant="amber" size="lg">
                Start practicing →
              </ButtonLink>
            </div>
          </div>
          <div className="rounded-2xl border border-white/15 bg-white/5 p-6">
            <div className="flex items-center justify-between text-xs text-white/50">
              <span className="font-mono">Mid · SQL · Enterprise SaaS</span>
              <span className="rounded-full bg-amber px-2 py-0.5 text-[10px] font-bold text-white">D · live</span>
            </div>
            <p className="mt-3 text-sm text-white/80">
              <span className="text-amber">Dawn:</span> Before you write SQL —
              what window function gives you ranks that share on ties?
            </p>
            <div className="mt-3 rounded-lg border border-white/10 bg-navy/50 p-3 font-mono text-xs text-white/70">
              <div><span className="text-amber">SELECT</span> dept, name, salary</div>
              <div><span className="text-amber">FROM</span> ranked <span className="text-amber">WHERE</span> rk = 2;</div>
            </div>
            <div className="mt-3 flex items-center gap-2 rounded-lg bg-success/15 p-3 text-xs text-white/80">
              <span className="font-bold text-success">✓ Correct</span>
              <span>— matches expected. Now: what if two people tie for 2nd?</span>
            </div>
          </div>
        </div>
      </section>

      {/* Tools preview */}
      <section className="border-t border-border bg-surface px-4 py-20" id="tools">
        <div className="mx-auto max-w-5xl">
          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber">
              Cheat Sheets · every major data &amp; AI stack
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-fg sm:text-4xl">
              One platform. Fourteen tools.
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm text-muted">
              {TOOLS.length} tools across Data Engineering, AI Engineering and Core Skills — all
              included in the one-time {BUNDLE_PRICE} cheat-sheet pass.
            </p>
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            {TRACKS.map((track) => (
              <Card key={track.slug} className="flex flex-col p-6">
                <h3 className="text-lg font-bold tracking-tight text-fg">{track.name}</h3>
                <p className="mt-1 flex-1 text-sm leading-relaxed text-muted">{track.blurb}</p>
                <p className="mt-4 flex flex-wrap gap-x-2 gap-y-1 text-xs text-muted">
                  {toolsByTrack(track.slug).map((tool) => (
                    <span key={tool.slug} className="font-medium text-fg">{tool.icon} {tool.name}</span>
                  ))}
                </p>
              </Card>
            ))}
          </div>

          <div className="mt-10 text-center">
            <ButtonLink href="/cheat-sheets" variant="amber" size="lg">
              Browse all cheat sheets →
            </ButtonLink>
          </div>
        </div>
      </section>

      {/* Pricing teaser */}
      <section className="px-4 py-20">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-fg sm:text-4xl">
            Two products. Three prices. That&apos;s all.
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-muted">
            All cheat sheets for a one-time {BUNDLE_PRICE}, or interactive practice from{" "}
            {PRACTICE_PRO_ANNUAL_MONTHLY}/mo. No per-tool prices, no hidden add-ons.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <ButtonLink href="/pricing" variant="amber" size="lg">See pricing →</ButtonLink>
            <ButtonLink href="/practice" variant="outline" size="lg">Try practice free</ButtonLink>
          </div>
        </div>
      </section>

      {/* Methodology / trust */}
      <section className="border-y border-border bg-surface px-4 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-lg leading-relaxed text-fg sm:text-xl">
            Most prep is trivia. This is built the way interviews actually run —
            <strong> researched from real loops, fact-checked against the official docs,</strong> and
            written from the interviewer&apos;s side of the table.
          </p>
          <Link href="/methodology" className="mt-5 inline-block text-sm font-semibold text-amber hover:underline">
            How these are made →
          </Link>
        </div>
      </section>

      {/* Newsletter */}
      <section className="px-4 py-20">
        <div className="mx-auto max-w-3xl">
          <div className="rounded-2xl border border-border bg-surface px-6 py-12 text-center sm:px-12">
            <h2 className="text-2xl font-bold tracking-tight text-fg sm:text-3xl">
              Get a real question in your inbox
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-muted">
              One pulled-from-a-loop question, with the Interviewer&apos;s Lens,
              every week. No spam.
            </p>
            <form
              action="#"
              className="mx-auto mt-7 flex max-w-md flex-col gap-3 sm:flex-row"
            >
              <input
                type="email"
                name="email"
                required
                placeholder="you@company.com"
                aria-label="Email address"
                className="w-full flex-1 rounded-full border border-border bg-card px-5 py-3 text-sm text-fg placeholder:text-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-navy/40"
              />
              <button
                type="submit"
                className="inline-flex items-center justify-center rounded-full bg-navy px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-navy/90 dark:bg-navy-surface dark:text-navy-fg dark:hover:bg-navy-surface/80"
              >
                Subscribe
              </button>
            </form>
          </div>
        </div>
      </section>
    </>
  );
}
