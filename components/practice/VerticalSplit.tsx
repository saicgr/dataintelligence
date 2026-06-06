"use client";

import { useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * VS-Code-style editor/results split: the top (editor) and bottom (results)
 * fill the height; drag the bar to resize, or hit ⤢ to maximize the results.
 */
export function VerticalSplit({
  top,
  bottom,
  bottomLabel = "Results",
}: {
  top: React.ReactNode;
  bottom: React.ReactNode;
  bottomLabel?: string;
}) {
  const [topPct, setTopPct] = useState(58);
  const [prev, setPrev] = useState(58);
  const ref = useRef<HTMLDivElement>(null);

  const maximized = topPct <= 16;

  function startDrag(e: React.MouseEvent) {
    e.preventDefault();
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    const startY = e.clientY;
    const start = topPct;
    document.body.style.cursor = "row-resize";
    document.body.style.userSelect = "none";
    const onMove = (ev: MouseEvent) => {
      const dy = ((ev.clientY - startY) / rect.height) * 100;
      setTopPct(Math.max(12, Math.min(88, start + dy)));
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  function toggleMax() {
    if (maximized) setTopPct(prev || 58);
    else {
      setPrev(topPct);
      setTopPct(12);
    }
  }

  return (
    <div ref={ref} className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col">
      <div style={{ height: `${topPct}%` }} className="min-h-0 overflow-auto scroll-thin">
        {top}
      </div>
      <div className="group relative flex h-2 flex-none items-center justify-between border-y border-border bg-surface px-3">
        <span
          onMouseDown={startDrag}
          className="absolute inset-x-0 -top-1 -bottom-1 cursor-row-resize"
          aria-label="Resize results"
        />
        <span className="pointer-events-none text-[10px] font-semibold uppercase tracking-wider text-muted">
          {bottomLabel}
        </span>
        <button onClick={toggleMax} className="relative z-10 text-muted hover:text-fg" title={maximized ? "Restore" : "Maximize results"}>
          <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.6">
            {maximized ? (
              <path d="M9 7l4-4M13 3v3M13 3h-3M7 9l-4 4M3 13v-3M3 13h3" strokeLinecap="round" />
            ) : (
              <path d="M4 4l3 3M4 4v3M4 4h3M12 12l-3-3M12 12v-3M12 12h-3" strokeLinecap="round" />
            )}
          </svg>
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto scroll-thin">{bottom}</div>
    </div>
  );
}
