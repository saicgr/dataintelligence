"use client";

import { useEffect, useRef, useState } from "react";
import { Timer } from "./Timer";
import { MicButton } from "./MicButton";
import { cn } from "@/lib/utils";
import { LEVEL_NAMES } from "@/lib/catalog";
import type { Level } from "@/lib/types";

export interface ChatMsg {
  role: "user" | "assistant";
  content: string;
}

const STORAGE = "fieldnotes_practice_layout_v3";
const DEFAULT = { left: 22, right: 24, coachOpen: true, leftOpen: true };
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export function WorkbenchFrame({
  title,
  company,
  difficulty,
  level,
  onBack,
  hasAi,
  messages,
  thinking,
  onSend,
  onHint,
  hintsLeft,
  onReveal,
  question,
  code,
}: {
  title: string;
  company: string;
  difficulty: string;
  level: Level;
  onBack: () => void;
  hasAi: boolean;
  messages: ChatMsg[];
  thinking: boolean;
  onSend: (text: string) => void;
  onHint?: () => void;
  hintsLeft?: number;
  onReveal?: () => void;
  question: React.ReactNode;
  code: React.ReactNode;
}) {
  const [input, setInput] = useState("");
  const [left, setLeft] = useState(DEFAULT.left);
  const [right, setRight] = useState(DEFAULT.right);
  const [coachOpen, setCoachOpen] = useState(true);
  const [leftOpen, setLeftOpen] = useState(true);
  const [focus, setFocus] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const chatRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const w = JSON.parse(localStorage.getItem(STORAGE) || "null");
      if (w) { setLeft(w.left ?? DEFAULT.left); setRight(w.right ?? DEFAULT.right); setCoachOpen(w.coachOpen ?? true); setLeftOpen(w.leftOpen ?? true); }
    } catch {}
  }, []);
  useEffect(() => {
    try { localStorage.setItem(STORAGE, JSON.stringify({ left, right, coachOpen, leftOpen })); } catch {}
  }, [left, right, coachOpen, leftOpen]);
  useEffect(() => {
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, thinking, coachOpen]);
  // Lock page scroll + escape to exit when in focus (full-screen) mode.
  useEffect(() => {
    if (!focus) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setFocus(false); };
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", onKey); };
  }, [focus]);

  function startDrag(which: "left" | "right") {
    return (e: React.MouseEvent) => {
      e.preventDefault();
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const startX = e.clientX;
      const startL = left;
      const startR = right;
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      const onMove = (ev: MouseEvent) => {
        const dx = ((ev.clientX - startX) / rect.width) * 100;
        if (which === "left") {
          const l = clamp(startL + dx, 15, 100 - (coachOpen ? startR : 0) - 28);
          setLeft(l);
        } else {
          const r = clamp(startR - dx, 16, 100 - (leftOpen ? startL : 0) - 28);
          setRight(r);
        }
      };
      const onUp = () => {
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    };
  }

  const send = () => {
    const t = input.trim();
    if (!t || thinking) return;
    onSend(t);
    setInput("");
  };

  return (
    <div
      className={cn(
        "flex flex-col overflow-hidden border border-border bg-card",
        focus ? "fixed inset-0 z-50 h-screen rounded-none" : "h-[86vh] min-h-[560px] rounded-xl"
      )}
    >
      {/* Header */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-border px-4 py-2.5">
        <button onClick={onBack} className="text-sm font-medium text-muted hover:text-fg">← Questions</button>
        <div className="h-4 w-px bg-border" />
        <h1 className="truncate text-base font-bold tracking-tight text-fg">{title}</h1>
        <span className="hidden text-xs text-muted sm:inline">{company} · {difficulty} · {LEVEL_NAMES[level]}</span>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={() => setLeftOpen((o) => !o)} title={leftOpen ? "Hide question panel" : "Show question panel"} className="hidden rounded-full border border-border px-3 py-1 text-xs font-medium text-muted hover:text-fg sm:block">
            {leftOpen ? "Hide question" : "Show question"}
          </button>
          <button onClick={() => { setLeft(DEFAULT.left); setRight(DEFAULT.right); setCoachOpen(true); setLeftOpen(true); }} title="Reset layout" className="rounded-full border border-border px-3 py-1 text-xs font-medium text-muted hover:text-fg">Reset layout</button>
          <button onClick={() => setFocus((f) => !f)} title={focus ? "Exit focus (Esc)" : "Focus mode — full screen"} className="grid h-7 w-7 place-items-center rounded-full border border-border text-muted hover:text-fg">
            {focus ? (
              <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M10 6h-4v4M6 6l4 4" strokeLinecap="round" strokeLinejoin="round" /></svg>
            ) : (
              <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M6 2H2v4M14 6V2h-4M10 14h4v-4M2 10v4h4" strokeLinecap="round" strokeLinejoin="round" /></svg>
            )}
          </button>
          <Timer />
        </div>
      </div>

      {/* Body */}
      <div ref={containerRef} className="flex min-h-0 flex-1">
        {/* Left — question + data + sample I/O (collapsible) */}
        {leftOpen ? (
          <>
            <section style={{ width: `${left}%` }} className="min-w-0 flex-none overflow-y-auto p-4 scroll-thin">{question}</section>
            <Divider onMouseDown={startDrag("left")} />
          </>
        ) : (
          <button onClick={() => setLeftOpen(true)} title="Show question" className="flex w-9 flex-none flex-col items-center gap-2 border-r border-border py-3 text-muted hover:bg-surface hover:text-fg">
            <span className="grid h-6 w-6 place-items-center rounded-full border border-amber text-[11px] font-bold text-amber">1</span>
            <span className="text-[10px] font-semibold uppercase tracking-wider [writing-mode:vertical-rl]">Question</span>
          </button>
        )}

        {/* Middle — code + results (fills height; child controls vertical split) */}
        <section className="flex min-w-0 flex-1 overflow-hidden">{code}</section>

        {/* Right — coach (collapsible) */}
        {coachOpen ? (
          <>
            <Divider onMouseDown={startDrag("right")} />
            <section style={{ width: `${right}%` }} className="flex min-w-0 flex-none flex-col border-l border-border">
              <div className="flex items-center gap-2 border-b border-border px-3 py-3">
                <span className="grid h-6 w-6 place-items-center rounded-full bg-amber/15 text-xs font-bold text-amber">D</span>
                <span className="text-sm font-semibold">Coach</span>
                <span className="text-[11px] text-muted">{hasAi ? "live" : "scripted"}</span>
                <button onClick={() => setCoachOpen(false)} title="Minimize coach" className="ml-auto grid h-6 w-6 place-items-center rounded text-muted hover:bg-surface hover:text-fg">
                  <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M6 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </button>
              </div>
              <div ref={chatRef} className="flex-1 space-y-3 overflow-y-auto p-3 scroll-thin">
                {messages.map((m, i) => (
                  <div key={i} className={cn("rounded-xl px-3 py-2 text-sm leading-relaxed", m.role === "assistant" ? "bg-surface text-fg" : "ml-4 bg-navy text-white dark:bg-navy-surface dark:text-navy-fg")}>{m.content}</div>
                ))}
                {thinking && <div className="rounded-xl bg-surface px-3 py-2 text-sm text-muted">…</div>}
                {messages.length <= 1 && !thinking && (
                  <p className="px-1 text-xs text-muted">Tip: run and submit freely — the coach only chimes in when you tap <span className="font-semibold text-amber">Ask AI</span> or ask here.</p>
                )}
              </div>
              {(onHint || onReveal) && (
                <div className="flex items-center gap-3 border-t border-border px-3 py-2 text-xs">
                  {onHint && <button onClick={onHint} disabled={hintsLeft === 0} className="font-medium text-amber hover:underline disabled:opacity-40">Hint{typeof hintsLeft === "number" ? ` (${hintsLeft})` : ""}</button>}
                  {onReveal && <button onClick={onReveal} className="font-medium text-muted hover:text-fg">Reveal answer</button>}
                </div>
              )}
              <div className="flex gap-2 border-t border-border p-2.5">
                <MicButton onText={(t) => setInput((v) => v + t)} />
                <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="Ask the coach… or 🎤" className="min-w-0 flex-1 rounded-full border border-border bg-card px-3 py-2 text-sm text-fg placeholder:text-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-navy/30" />
                <button onClick={send} disabled={thinking} className="grid h-9 w-9 flex-none place-items-center rounded-full bg-navy text-white disabled:opacity-50 dark:bg-accent dark:text-accent-fg" aria-label="Send">
                  <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M8 13V3M4 7l4-4 4 4" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </button>
              </div>
            </section>
          </>
        ) : (
          <button onClick={() => setCoachOpen(true)} title="Open coach" className="flex w-10 flex-none flex-col items-center gap-2 border-l border-border py-3 text-muted hover:bg-surface hover:text-fg">
            <span className="grid h-6 w-6 place-items-center rounded-full bg-amber/15 text-xs font-bold text-amber">D</span>
            <span className="text-[10px] font-semibold uppercase tracking-wider [writing-mode:vertical-rl]">Coach</span>
          </button>
        )}
      </div>
    </div>
  );
}

function Divider({ onMouseDown }: { onMouseDown: (e: React.MouseEvent) => void }) {
  return (
    <div onMouseDown={onMouseDown} className="group relative w-px flex-none cursor-col-resize bg-border hover:bg-navy dark:hover:bg-accent">
      <div className="absolute inset-y-0 -left-1.5 -right-1.5" />
    </div>
  );
}
