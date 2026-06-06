"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

export interface ApproachVerdict {
  verdict: "on_track" | "partial" | "off";
  reason: string;
  followUp: string;
}

/**
 * "Think before you build" gate. Before the editor / review pane unlocks, the
 * candidate states their approach; the AI JUDGES its direction (on_track /
 * partial / off) and pushes back with a probing follow-up if it's weak — the
 * candidate refines and resubmits. A strong approach shows ✓ and unlocks. A
 * "Start anyway" escape is ALWAYS available (more prominent after 2 tries) so the
 * gate never hard-traps anyone — like a real interviewer who eventually says
 * "ok, let's just start." On unlock the approach seeds the coach thread (onProbe),
 * so the gate costs one AI call.
 *
 * The product thesis: everyone can build; the differentiator is reasoning first.
 */
export function ApproachGate({
  kind,
  onVerdict,
  onProbe,
  onUnlock,
}: {
  /** What they're about to do — tunes the copy ("solve" vs "review"). */
  kind: "solve" | "review";
  /** Judges the approach's direction without revealing the answer. */
  onVerdict: (approach: string) => Promise<ApproachVerdict>;
  /** Seeds the coach thread with the locked-in approach (fire-and-forget on unlock). */
  onProbe: (approach: string) => Promise<string>;
  /** Reveal the editor / review pane. */
  onUnlock: () => void;
}) {
  const [text, setText] = useState("");
  const [verdict, setVerdict] = useState<ApproachVerdict | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState(false);

  const verb = kind === "review" ? "review" : "solve";
  const ask = kind === "review"
    ? "Before you open the diff — what's your review strategy? What would you check first, and what failure modes are you hunting for?"
    : "Before you write any code — what's your approach? Name the shape of the answer and the one case most likely to break it.";

  const onTrack = verdict?.verdict === "on_track";

  async function submit() {
    const a = text.trim();
    if (!a || busy) return;
    setBusy(true);
    try {
      const v = await onVerdict(a);
      setVerdict(v);
      setAttempt((n) => n + 1);
    } catch {
      // On failure, don't trap — let them through.
      setVerdict({ verdict: "on_track", reason: "Couldn't reach the interviewer — go ahead.", followUp: "" });
    } finally {
      setBusy(false);
    }
  }

  function start() {
    // Seed the coach with the approach ONLY if one was given; otherwise let the
    // workbench's normal greeting fire (don't praise a non-existent plan).
    const a = text.trim();
    if (a) onProbe(a).catch(() => {});
    onUnlock();
  }

  const tone =
    verdict?.verdict === "on_track" ? "border-success/40 bg-success/10"
    : verdict?.verdict === "off" ? "border-danger/40 bg-danger/10"
    : "border-amber/40 bg-amber/10";
  const label =
    verdict?.verdict === "on_track" ? "✓ On track"
    : verdict?.verdict === "off" ? "✗ Off track"
    : "~ Getting there";

  return (
    <div className="flex h-full flex-col items-center justify-center p-6">
      <div className="w-full max-w-xl rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="mb-1 flex items-center gap-2">
          <span className="grid h-6 w-6 place-items-center rounded-full bg-amber/15 text-sm">🧠</span>
          <h3 className="text-sm font-bold tracking-tight text-fg">Think first</h3>
        </div>
        <p className="mb-3 text-sm leading-relaxed text-muted">{ask}</p>

        <textarea
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") submit(); }}
          placeholder={`Your ${verb}-plan in 1–2 sentences…`}
          disabled={busy || onTrack}
          className="h-24 w-full resize-none rounded-lg border border-border bg-surface p-2.5 text-sm text-fg focus:outline-none focus:ring-1 focus:ring-navy disabled:opacity-70 dark:focus:ring-accent"
        />

        {verdict && (
          <div className={cn("mt-3 rounded-lg border px-3 py-2 text-sm text-fg", tone)}>
            <span className="font-semibold">{label}.</span> {verdict.reason}
            {!onTrack && verdict.followUp && (
              <div className="mt-1 text-muted"><span className="font-semibold text-fg">Interviewer:</span> {verdict.followUp}</div>
            )}
          </div>
        )}

        <div className="mt-3 flex items-center gap-2">
          {onTrack ? (
            <button onClick={start} className="rounded-full bg-navy px-4 py-2 text-sm font-semibold text-white dark:bg-accent dark:text-accent-fg">
              {kind === "review" ? "Open the diff →" : "Open the editor →"}
            </button>
          ) : (
            <button onClick={submit} disabled={busy || !text.trim()} className="rounded-full bg-navy px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 dark:bg-accent dark:text-accent-fg">
              {busy ? "Thinking…" : verdict ? "Refine & resubmit" : "Lock in approach"}
            </button>
          )}
          {/* Never hard-block: always offer an escape, more prominent after 2 tries. */}
          {!onTrack && (
            <button onClick={start} className={cn("rounded-full px-3 py-2 text-sm font-medium", attempt >= 2 ? "border border-border text-fg hover:bg-surface" : "text-muted hover:text-fg")}>
              Start anyway — I&apos;ll work it out
            </button>
          )}
          <span className="ml-auto text-[11px] text-muted">⌘↵</span>
        </div>
      </div>
    </div>
  );
}

/** Whether the think-first gate applies to a given item by default. */
export function approachGateEnabled(item: { category: string; approachGate?: boolean }): boolean {
  if (item.approachGate === false) return false;
  return ["sql", "python", "pyspark", "codereview", "pr", "typescript", "incident"].includes(item.category);
}
