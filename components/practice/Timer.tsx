"use client";

import { useEffect, useState } from "react";

export function Timer() {
  const [secs, setSecs] = useState(0);
  const [running, setRunning] = useState(true);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setSecs((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [running]);

  const mm = String(Math.floor(secs / 60)).padStart(2, "0");
  const ss = String(secs % 60).padStart(2, "0");

  return (
    <div className="flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1">
      <span className="font-mono text-sm tabular-nums text-fg">{mm}:{ss}</span>
      <button onClick={() => setRunning((r) => !r)} aria-label={running ? "Pause" : "Start"} className="grid h-6 w-6 place-items-center rounded-full text-muted hover:bg-surface hover:text-fg">
        {running ? (
          <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="currentColor"><rect x="4" y="3" width="3" height="10" rx="1" /><rect x="9" y="3" width="3" height="10" rx="1" /></svg>
        ) : (
          <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="currentColor"><path d="M5 3l8 5-8 5z" /></svg>
        )}
      </button>
      <button onClick={() => { setSecs(0); setRunning(true); }} aria-label="Reset" className="grid h-6 w-6 place-items-center rounded-full text-muted hover:bg-surface hover:text-fg">
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M13 8a5 5 0 1 1-1.5-3.5" strokeLinecap="round" /><path d="M13 3v3h-3" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>
    </div>
  );
}
