"use client";

import { useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface ResumeResult {
  ats_score_before: number;
  ats_score_after: number;
  keywords: { matched: string[]; missing: string[] };
  improvements: string[];
  rewritten: string;
  source: "ai" | "rule";
}

const scoreColor = (s: number) => (s >= 75 ? "text-success" : s >= 50 ? "text-warning" : "text-danger");

export function ResumeOptimizer() {
  const [resume, setResume] = useState("");
  const [jd, setJd] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ResumeResult | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  async function run() {
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch("/api/resume", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ resume, jd }) });
      const data = await res.json();
      if (data.error) setError(data.error);
      else setResult(data);
    } catch {
      setError("Something went wrong — try again.");
    } finally {
      setLoading(false);
    }
  }

  function copyRewritten() {
    if (!result) return;
    navigator.clipboard?.writeText(result.rewritten).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1400); }).catch(() => {});
  }

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber">Free tool</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight text-fg sm:text-4xl">ATS résumé optimizer</h1>
      <p className="mt-2 max-w-2xl text-muted">Paste your résumé and the job you&apos;re targeting. Get an ATS score, the keywords you&apos;re missing, and a tailored rewrite — built for data &amp; AI engineering roles.</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-muted">Your résumé</span>
          <textarea value={resume} onChange={(e) => setResume(e.target.value)} rows={12} placeholder="Paste your résumé text…" className={taCls} />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-muted">Target job description</span>
          <textarea value={jd} onChange={(e) => setJd(e.target.value)} rows={12} placeholder="Paste the job description…" className={taCls} />
        </label>
      </div>

      <button onClick={run} disabled={loading || !resume.trim() || !jd.trim()} className="mt-4 rounded-full bg-navy px-6 py-2.5 text-sm font-semibold text-white hover:bg-navy/90 disabled:opacity-50 dark:bg-accent dark:text-accent-fg">
        {loading ? "Analyzing…" : "Optimize my résumé →"}
      </button>
      {error && <p className="mt-3 text-sm text-danger">{error}</p>}

      {result && (
        <div className="mt-8 space-y-5">
          {/* Score */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-border bg-card p-5 text-center">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted">ATS score now</p>
              <div className={cn("text-5xl font-bold tracking-tight", scoreColor(result.ats_score_before))}>{result.ats_score_before}</div>
            </div>
            <div className="rounded-xl border border-success/30 bg-success/5 p-5 text-center">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted">After rewrite</p>
              <div className={cn("text-5xl font-bold tracking-tight", scoreColor(result.ats_score_after))}>{result.ats_score_after}</div>
            </div>
          </div>
          {result.source === "rule" && <p className="text-xs text-muted">Heuristic analysis — set GEMINI_API_KEY for an AI-tailored rewrite.</p>}

          {/* Keywords */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-success">Matched ({result.keywords.matched.length})</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {result.keywords.matched.length ? result.keywords.matched.map((k) => <span key={k} className="rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success">{k}</span>) : <span className="text-xs text-muted">None detected.</span>}
              </div>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-danger">Missing ({result.keywords.missing.length})</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {result.keywords.missing.length ? result.keywords.missing.map((k) => <span key={k} className="rounded-full bg-danger/10 px-2 py-0.5 text-xs font-medium text-danger">{k}</span>) : <span className="text-xs text-muted">Great — nothing major missing.</span>}
              </div>
            </div>
          </div>

          {/* Improvements */}
          {result.improvements.length > 0 && (
            <div className="rounded-xl border border-border bg-card p-5">
              <p className="text-sm font-semibold text-fg">What to change</p>
              <ul className="mt-2 space-y-1.5 text-sm text-fg">
                {result.improvements.map((s, i) => <li key={i} className="flex gap-2"><span className="text-amber">→</span><span>{s}</span></li>)}
              </ul>
            </div>
          )}

          {/* Rewritten */}
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border px-4 py-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted">Rewritten résumé</span>
              <button onClick={copyRewritten} className="rounded-full border border-border px-3 py-1 text-xs font-medium text-muted hover:text-fg">{copied ? "Copied ✓" : "Copy"}</button>
            </div>
            <pre className="max-h-[28rem] overflow-auto whitespace-pre-wrap p-4 text-sm leading-relaxed text-fg scroll-thin">{result.rewritten}</pre>
          </div>

          <div className="rounded-xl border border-amber/30 bg-amber/5 p-4 text-sm">
            <p className="font-semibold text-fg">Résumé ready? Now practice the interview.</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Link href="/practice/plan" className="rounded-full bg-navy px-4 py-1.5 text-xs font-semibold text-white dark:bg-accent dark:text-accent-fg">Build a prep plan →</Link>
              <Link href="/practice" className="rounded-full border border-border px-4 py-1.5 text-xs font-semibold text-fg hover:bg-surface">Start practicing</Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const taCls = "w-full rounded-lg border border-border bg-card px-3 py-2 font-mono text-xs leading-relaxed text-fg placeholder:text-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-navy/30 resize-y";
