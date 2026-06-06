"use client";

import { Modal } from "@/components/ui/Modal";
import { PRACTICE_PRO_PRICE, PRACTICE_PRO_ANNUAL_PRICE } from "@/lib/catalog";

const PRO_PERKS = [
  { icon: "∞", title: "Unlimited everything", body: "No daily caps on submissions or AI coaching." },
  { icon: "🧠", title: "Premium evaluator + coach", body: "Deeper grading and optimization tips on every answer." },
  { icon: "🎙", title: "Case studies & Python", body: "Voice-style case interviews and runnable Python problems." },
];

/** Shown after a correct submit — celebrate, then nudge toward Practice Pro. */
export function WinModal({
  open,
  onClose,
  practicePro,
  onUpgrade,
}: {
  open: boolean;
  onClose: () => void;
  practicePro: boolean;
  onUpgrade: () => void;
}) {
  return (
    <Modal open={open} onClose={onClose} className="max-w-md overflow-hidden p-0">
      <div className="bg-success px-6 py-8 text-center text-white">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-white/20">
          <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </div>
        <h2 className="mt-4 text-2xl font-bold tracking-tight">Solved it.</h2>
        <p className="mt-1 text-sm text-white/85">That&apos;s a hire-worthy answer. Keep the momentum going.</p>
      </div>
      <div className="p-6">
        {practicePro ? (
          <button onClick={onClose} className="w-full rounded-full bg-navy px-6 py-3 text-sm font-semibold text-white hover:bg-navy/90 dark:bg-accent dark:text-accent-fg">
            Continue →
          </button>
        ) : (
          <>
            <p className="text-sm font-semibold text-fg">Unlock the rest with Practice Pro</p>
            <ul className="mt-3 space-y-2.5">
              {PRO_PERKS.map((p) => (
                <li key={p.title} className="flex gap-3 rounded-lg border border-border bg-surface p-3">
                  <span className="grid h-8 w-8 flex-none place-items-center rounded-full bg-amber/15 text-amber">{p.icon}</span>
                  <span>
                    <span className="block text-sm font-semibold text-fg">{p.title}</span>
                    <span className="block text-xs text-muted">{p.body}</span>
                  </span>
                </li>
              ))}
            </ul>
            <button onClick={onUpgrade} className="mt-4 w-full rounded-full bg-navy px-6 py-3 text-sm font-semibold text-white hover:bg-navy/90 dark:bg-accent dark:text-accent-fg">
              Go Pro — {PRACTICE_PRO_PRICE}/mo or {PRACTICE_PRO_ANNUAL_PRICE}/yr
            </button>
            <button onClick={onClose} className="mt-2 w-full text-center text-xs font-medium text-muted hover:text-fg">
              Keep practicing free
            </button>
          </>
        )}
      </div>
    </Modal>
  );
}
