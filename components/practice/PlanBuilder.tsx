"use client";

import { useState } from "react";
import Link from "next/link";
import { PRACTICE_CATEGORIES, type PracticeCategory } from "@/lib/data/practice/types";
import { useProgress } from "@/components/providers/progress-provider";
import { LEVEL_NAMES } from "@/lib/catalog";
import { cn } from "@/lib/utils";

interface LiteItem { id: string; title: string; category: string; level: string; company: string; free: boolean }
interface Round { name: string; focus: string; categories: PracticeCategory[] }
interface Plan { summary: string; rounds: Round[]; source: "ai" | "rule" }

interface GenQuestion { id: number; question: string; risk: string; answer: string | null; owned: boolean; href: string }
interface GenSection { tool: string; toolName: string; questions: GenQuestion[] }
interface Sheet {
  locked: boolean;
  source: "ai" | "rule";
  readiness: number;
  summary: string;
  companyAngle: string | null;
  matchedTools: { slug: string; name: string }[];
  sections: GenSection[];
  gaps: string[];
  crossSell: { tool: string; toolName: string; owned: boolean; href: string; price: string }[];
  sheetPrice: string;
}

const catName = (slug: string) => PRACTICE_CATEGORIES.find((c) => c.slug === slug)?.name ?? slug;

export function PlanBuilder({ items, practicePro, hasAi }: { items: LiteItem[]; practicePro: boolean; hasAi: boolean }) {
  const progress = useProgress();
  const [mode, setMode] = useState<"role" | "jd">("role");
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("Data Engineer");
  const [level, setLevel] = useState<"junior" | "mid" | "senior">("mid");
  const [jd, setJd] = useState("");
  const [resume, setResume] = useState("");
  const [date, setDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [generating, setGenerating] = useState(false);
  const [sheet, setSheet] = useState<Sheet | null>(null);

  function inputBody() {
    return {
      jd: mode === "jd" ? jd : undefined,
      role: mode === "role" ? role : undefined,
      company: company || undefined,
      level,
    };
  }

  async function build() {
    setLoading(true);
    setPlan(null);
    try {
      const res = await fetch("/api/practice/plan", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(inputBody()) });
      setPlan(await res.json());
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }

  async function generate() {
    setGenerating(true);
    setSheet(null);
    try {
      const res = await fetch("/api/practice/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...inputBody(), resume: resume || undefined }),
      });
      setSheet(await res.json());
    } catch {
      /* ignore */
    } finally {
      setGenerating(false);
    }
  }

  async function startPro() {
    try {
      const res = await fetch("/api/stripe/checkout", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ practicePro: true, plan: "annual" }) });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else window.location.href = "/pricing";
    } catch {
      window.location.href = "/pricing";
    }
  }

  const noTarget = mode === "jd" ? !jd.trim() : !role.trim();

  // Items relevant to the plan, by round → pick a few per category (level-matched first).
  function itemsFor(cats: PracticeCategory[]): LiteItem[] {
    const pool = items.filter((it) => cats.includes(it.category as PracticeCategory));
    const ranked = [...pool].sort((a, b) => {
      const al = a.level === level ? 0 : 1;
      const bl = b.level === level ? 0 : 1;
      return al - bl;
    });
    return ranked.slice(0, 4);
  }

  // Readiness: solved / total across all categories named in the plan.
  let readiness = 0;
  if (plan) {
    const cats = new Set(plan.rounds.flatMap((r) => r.categories));
    const inScope = items.filter((it) => cats.has(it.category as PracticeCategory));
    const solved = inScope.filter((it) => progress.isPracticeSolved(it.id)).length;
    readiness = inScope.length ? Math.round((solved / inScope.length) * 100) : 0;
  }

  const daysLeft = date ? Math.ceil((new Date(date).getTime() - Date.now()) / 86400000) : null;

  return (
    <div>
      <Link href="/practice" className="text-sm font-medium text-muted hover:text-fg">← Practice</Link>
      <h1 className="mt-3 flex items-center gap-2 text-3xl font-bold tracking-tight text-fg">Target a role <span className="rounded-full bg-amber/15 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-amber">Beta</span></h1>
      <p className="mt-2 text-muted">Tell me where you&apos;re interviewing. I&apos;ll predict the loop and build an ordered plan.</p>

      {/* Input card */}
      <div className="mt-6 space-y-4 rounded-xl border border-border bg-card p-6">
        <div className="inline-flex rounded-full border border-border bg-surface p-1 text-sm">
          <button onClick={() => setMode("role")} className={cn("rounded-full px-4 py-1.5 font-medium", mode === "role" ? "bg-navy text-white dark:bg-accent dark:text-accent-fg" : "text-muted")}>Company &amp; role</button>
          <button onClick={() => setMode("jd")} className={cn("rounded-full px-4 py-1.5 font-medium", mode === "jd" ? "bg-navy text-white dark:bg-accent dark:text-accent-fg" : "text-muted")}>Paste a JD</button>
        </div>

        {mode === "role" ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Company (optional)"><input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="e.g. Stripe" className={inputCls} /></Field>
            <Field label="Role"><input value={role} onChange={(e) => setRole(e.target.value)} placeholder="Data Engineer" className={inputCls} /></Field>
          </div>
        ) : (
          <Field label="Job description"><textarea value={jd} onChange={(e) => setJd(e.target.value)} rows={6} placeholder="Paste the full JD here…" className={cn(inputCls, "resize-y font-mono text-xs")} /></Field>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Level">
            <select value={level} onChange={(e) => setLevel(e.target.value as typeof level)} className={inputCls}>
              <option value="junior">{LEVEL_NAMES.junior}</option>
              <option value="mid">{LEVEL_NAMES.mid}</option>
              <option value="senior">{LEVEL_NAMES.senior}</option>
            </select>
          </Field>
          <Field label="Interview date (optional)"><input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} /></Field>
        </div>

        <Field label="Your résumé (optional — powers the gap analysis)">
          <textarea value={resume} onChange={(e) => setResume(e.target.value)} rows={4} placeholder="Paste your résumé to see which JD skills you're missing…" className={cn(inputCls, "resize-y font-mono text-xs")} />
        </Field>

        <div className="flex flex-wrap gap-3">
          <button onClick={build} disabled={loading || noTarget} className="rounded-full border border-border bg-surface px-6 py-2.5 text-sm font-semibold text-fg hover:bg-card disabled:opacity-50">
            {loading ? "Building…" : "Build plan"}
          </button>
          <button onClick={generate} disabled={generating || noTarget} className="inline-flex items-center gap-2 rounded-full bg-navy px-6 py-2.5 text-sm font-semibold text-white hover:bg-navy/90 disabled:opacity-50 dark:bg-accent dark:text-accent-fg">
            {generating ? "Generating…" : "Generate my cheat sheet →"}
            {!practicePro && <span className="rounded-full bg-amber/20 px-1.5 text-[10px] font-bold uppercase text-amber">Pro</span>}
          </button>
        </div>
      </div>

      {/* Generated cheat sheet */}
      {sheet && (
        <div className="generated-sheet mt-6">
          <div className="rounded-2xl border border-border bg-card p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted">Your tailored cheat sheet</p>
                <div className="mt-1 text-5xl font-bold tracking-tight text-navy dark:text-accent">{sheet.readiness}%</div>
                <p className="text-xs text-muted">ready{resume ? " · based on your résumé" : ""}</p>
              </div>
              <button onClick={() => window.print()} className="rounded-full border border-border px-4 py-2 text-xs font-semibold text-fg hover:bg-surface print:hidden">Print / Save PDF</button>
            </div>
            {sheet.summary && <p className="mt-3 text-sm text-fg">{sheet.summary}</p>}
            {sheet.companyAngle && <p className="mt-2 rounded-lg bg-surface p-3 text-sm text-muted"><strong className="text-fg">Company angle:</strong> {sheet.companyAngle}</p>}
            {sheet.source === "rule" && hasAi === false && <p className="mt-2 text-xs text-muted">Set GEMINI_API_KEY for an AI-tailored focus note. Questions below are real, from the bank.</p>}
            <div className="mt-3 flex flex-wrap gap-1.5">
              {sheet.matchedTools.map((t) => (
                <span key={t.slug} className="rounded-full bg-surface px-2 py-0.5 text-[11px] font-medium text-muted">{t.name}</span>
              ))}
            </div>
          </div>

          {/* Locked banner */}
          {sheet.locked && (
            <div className="mt-4 rounded-xl border border-amber/40 bg-amber/5 p-5 text-center print:hidden">
              <p className="text-sm font-semibold text-fg">This is a preview — the questions are real, the answers are locked.</p>
              <p className="mt-1 text-xs text-muted">Practice Pro unlocks grounded answers, the gap analysis and PDF export.</p>
              <button onClick={startPro} className="mt-3 rounded-full bg-navy px-6 py-2.5 text-sm font-semibold text-white dark:bg-accent dark:text-accent-fg">Unlock with Practice Pro</button>
            </div>
          )}

          {/* Gaps */}
          {sheet.gaps.length > 0 && (
            <div className="mt-4 rounded-xl border border-border bg-card p-5">
              <p className="text-sm font-semibold text-fg">Your focus areas</p>
              <ul className="mt-2 space-y-1.5 text-sm text-fg">
                {sheet.gaps.map((g, i) => <li key={i} className="flex gap-2"><span className="text-amber">→</span><span>{g}</span></li>)}
              </ul>
            </div>
          )}

          {/* Sections of real questions */}
          <div className="mt-4 space-y-4">
            {sheet.sections.map((s) => (
              <div key={s.tool} className="rounded-xl border border-border bg-card p-5">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-fg">{s.toolName}</h3>
                  <span className="text-xs text-muted">{s.questions.length} real questions</span>
                </div>
                <ul className="mt-3 space-y-3">
                  {s.questions.map((q) => (
                    <li key={q.id} className="border-t border-border pt-3 first:border-0 first:pt-0">
                      <div className="flex items-start gap-2">
                        <span className={cn("mt-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase", q.risk === "high" ? "bg-danger/10 text-danger" : q.risk === "medium" ? "bg-warning/10 text-warning" : "bg-success/10 text-success")}>{q.risk}</span>
                        <p className="flex-1 text-sm font-medium text-fg">{q.question}</p>
                      </div>
                      {q.answer ? (
                        <p className="mt-1.5 pl-1 text-sm text-muted">{q.answer}</p>
                      ) : (
                        <p className="mt-1.5 flex items-center gap-1.5 pl-1 text-xs text-muted print:hidden">
                          <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="3" y="7" width="10" height="6" rx="1" /><path d="M5 7V5a3 3 0 016 0v2" /></svg>
                          answer locked
                        </p>
                      )}
                      <Link href={q.href} className="mt-1 inline-block pl-1 text-xs font-semibold text-amber hover:underline print:hidden">
                        {q.owned ? "Open full answer →" : `Unlock ${s.toolName} (all levels) — ${sheet.crossSell.find((c) => c.tool === s.tool)?.price ?? ""} →`}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* Cross-sell */}
          {sheet.crossSell.some((c) => !c.owned) && (
            <div className="mt-4 rounded-xl border border-amber/30 bg-amber/5 p-5 print:hidden">
              <p className="text-sm font-semibold text-fg">Get the full answers</p>
              <p className="mt-1 text-xs text-muted">Unlock the complete Interviewer&apos;s-Lens answers for the tools that matter most here.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {sheet.crossSell.filter((c) => !c.owned).map((c) => (
                  <Link key={c.tool} href={c.href} className="rounded-full border border-amber/40 px-3 py-1.5 text-xs font-semibold text-amber hover:bg-amber/10">{c.toolName} — {c.price}</Link>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Plan */}
      {plan && (
        <div className="mt-6">
          <div className="rounded-2xl border border-border bg-card p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted">Readiness</p>
                <div className="text-5xl font-bold tracking-tight text-navy dark:text-accent">{readiness}%</div>
              </div>
              {daysLeft !== null && (
                <div className="text-right">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted">Countdown</p>
                  <div className="text-3xl font-bold tracking-tight text-fg">{daysLeft < 0 ? "—" : daysLeft}</div>
                  <p className="text-xs text-muted">{daysLeft < 0 ? "past" : daysLeft === 1 ? "day left" : "days left"}</p>
                </div>
              )}
            </div>
            {plan.summary && <p className="mt-3 text-sm text-fg">{plan.summary}</p>}
            {plan.source === "rule" && <p className="mt-2 text-xs text-muted">Rule-based plan — set GEMINI_API_KEY for a JD-tailored prediction.</p>}
          </div>

          <ol className="mt-4 space-y-3">
            {plan.rounds.map((r, i) => {
              const roundItems = itemsFor(r.categories);
              const solvedCount = roundItems.filter((it) => progress.isPracticeSolved(it.id)).length;
              return (
                <li key={i} className="rounded-xl border border-border bg-card p-5">
                  <div className="flex items-center gap-2">
                    <span className="grid h-6 w-6 flex-none place-items-center rounded-full bg-navy text-xs font-bold text-white dark:bg-accent dark:text-accent-fg">{i + 1}</span>
                    <span className="font-bold text-fg">{r.name}</span>
                    <span className="ml-auto text-xs text-muted">{solvedCount}/{roundItems.length} done</span>
                  </div>
                  <p className="mt-1.5 text-sm text-muted">{r.focus}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {r.categories.map((c) => (
                      <span key={c} className="rounded-full bg-surface px-2 py-0.5 text-[11px] font-medium text-muted">{catName(c)}</span>
                    ))}
                  </div>
                  {roundItems.length > 0 && (
                    <div className="mt-3 space-y-1.5 border-t border-border pt-3">
                      {roundItems.map((it) => {
                        const done = progress.isPracticeSolved(it.id);
                        return (
                          <Link key={it.id} href={`/practice?item=${it.id}`} className="flex items-center gap-2 text-sm text-fg hover:text-navy dark:hover:text-accent">
                            <span className={cn("grid h-4 w-4 flex-none place-items-center rounded-full border text-[9px]", done ? "border-success bg-success text-white" : "border-border")}>{done ? "✓" : ""}</span>
                            <span className={cn("truncate", done && "text-muted line-through")}>{it.title}</span>
                            <span className="ml-auto flex-none text-xs text-muted">{LEVEL_NAMES[it.level as "junior" | "mid" | "senior"]}</span>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </li>
              );
            })}
          </ol>

          <div className="mt-5 flex gap-3">
            <Link href="/practice/mock" className="rounded-full bg-navy px-6 py-2.5 text-sm font-semibold text-white dark:bg-accent dark:text-accent-fg">Take a mock →</Link>
            <Link href="/practice/progress" className="rounded-full border border-border px-6 py-2.5 text-sm font-semibold text-fg hover:bg-surface">Track progress</Link>
          </div>
        </div>
      )}
    </div>
  );
}

const inputCls = "w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-fg placeholder:text-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-navy/30";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-muted">{label}</span>
      {children}
    </label>
  );
}
