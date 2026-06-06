"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/** Review categories the candidate tags a comment with — each color-coded. */
export const REVIEW_CATEGORIES = [
  { slug: "bug", label: "Bug / correctness", mark: "bg-danger/25 decoration-danger/60", dot: "bg-danger", chip: "border-danger/50 text-danger" },
  { slug: "perf", label: "Performance", mark: "bg-amber/30 decoration-amber/60", dot: "bg-amber", chip: "border-amber/50 text-amber" },
  { slug: "security", label: "Security", mark: "bg-violet-500/25 decoration-violet-500/60", dot: "bg-violet-500", chip: "border-violet-500/50 text-violet-600 dark:text-violet-400" },
  { slug: "prod", label: "Prod risk", mark: "bg-orange-500/25 decoration-orange-500/60", dot: "bg-orange-500", chip: "border-orange-500/50 text-orange-600 dark:text-orange-400" },
  { slug: "style", label: "Style / nit", mark: "bg-muted/25 decoration-muted/60", dot: "bg-muted", chip: "border-border text-muted" },
  { slug: "question", label: "Question", mark: "bg-sky-500/25 decoration-sky-500/60", dot: "bg-sky-500", chip: "border-sky-500/50 text-sky-600 dark:text-sky-400" },
] as const;

export type ReviewCategory = (typeof REVIEW_CATEGORIES)[number]["slug"];
const CAT = Object.fromEntries(REVIEW_CATEGORIES.map((c) => [c.slug, c]));

interface Pt { line: number; col: number }
export interface ReviewAnnotation {
  author: "you" | "ai";
  /** Multi-file PR review only: which file this comment is anchored to. */
  file?: string;
  line: number;
  text: string;
  category?: ReviewCategory;
  quote?: string;
  start?: Pt;
  end?: Pt;
}

export interface CommentPayload {
  file?: string;
  line: number;
  text: string;
  category: ReviewCategory;
  quote?: string;
  start?: Pt;
  end?: Pt;
}

interface Pending { start: Pt; end: Pt; quote: string }

/**
 * Read-only review pane with line-anchored, threaded comments.
 *  • Comment a whole line (hover → 💬) or SELECT any span (across lines) → chip.
 *  • Tag a category (color-coded); the span highlights in that color.
 *  • Interviewer (AI) replies render inline, styled distinctly; you can "Reply
 *    here" (inline) or "Reply on chat".
 *  • Each line's thread can be minimized; "Clear all" wipes in-code comments.
 */
export function CodeReviewPanel({
  code,
  language,
  annotations,
  onComment,
  onReply,
  onClearAll,
  jumpLine,
  disabled,
  file,
  lineTone,
  deferComments,
}: {
  code: string;
  language: string;
  annotations: ReviewAnnotation[];
  onComment: (p: CommentPayload) => void;
  onReply: (line: number, text: string, target: "here" | "chat", file?: string) => void;
  onClearAll: () => void;
  jumpLine?: number | null;
  disabled?: boolean;
  /** Multi-file PR review: the filename this panel is showing (stamped onto comments). */
  file?: string;
  /** Diff coloring per 1-indexed line (computed from baseCode by the PR workbench). */
  lineTone?: Record<number, "add" | "del">;
  /** Comment-first ("batch") mode: comments queue locally; the parent flushes to the AI on request. */
  deferComments?: boolean;
}) {
  const lines = code.split("\n");
  // In multi-file mode, only this file's comments belong to this panel.
  const fileAnnotations = file ? annotations.filter((a) => (a.file ?? "") === file) : annotations;
  const [active, setActive] = useState<number | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [chip, setChip] = useState<{ x: number; y: number } | null>(null);
  const [draft, setDraft] = useState("");
  const [cat, setCat] = useState<ReviewCategory>("bug");
  const [collapsedAll, setCollapsedAll] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());
  const [reply, setReply] = useState<{ line: number; target: "here" | "chat" } | null>(null);
  const [replyDraft, setReplyDraft] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!jumpLine || !containerRef.current) return;
    containerRef.current.querySelector(`[data-line="${jumpLine}"]`)?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [jumpLine]);

  const isCollapsed = (line: number) => collapsedAll || collapsed.has(line);
  function toggleCollapse(line: number) {
    setCollapsed((s) => { const n = new Set(s); n.has(line) ? n.delete(line) : n.add(line); return n; });
  }

  function endpoint(container: Node, offset: number): Pt | null {
    const el = (container.nodeType === 3 ? container.parentElement : (container as Element));
    const lineEl = el?.closest("[data-line]") as HTMLElement | null;
    if (!lineEl || !containerRef.current?.contains(lineEl)) return null;
    const line = Number(lineEl.getAttribute("data-line"));
    const codeEl = lineEl.querySelector("[data-code]");
    let col = 0;
    if (codeEl) {
      const r = document.createRange();
      r.selectNodeContents(codeEl);
      try { r.setEnd(container, offset); col = r.toString().length; } catch { col = 0; }
    }
    return { line, col };
  }

  function onMouseUp(e: React.MouseEvent) {
    if (disabled) return;
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.toString().trim()) { setChip(null); setPending(null); return; }
    const range = sel.getRangeAt(0);
    const start = endpoint(range.startContainer, range.startOffset);
    let end = endpoint(range.endContainer, range.endOffset);
    if (!start) { setChip(null); return; }
    if (!end || end.line < start.line) end = { line: start.line, col: start.col + sel.toString().split("\n")[0].length };
    setPending({ start, end, quote: sel.toString() });
    setChip({ x: e.clientX, y: e.clientY });
  }

  function openLineBox(line: number) { setPending(null); setChip(null); setReply(null); setDraft(""); setCat("bug"); setActive(active === line ? null : line); }
  function openSelectionBox() { if (!pending) return; setChip(null); setReply(null); setDraft(""); setCat("bug"); setActive(pending.start.line); }

  function submit(line: number) {
    const text = draft.trim();
    if (!text) return;
    const p = pending && pending.start.line === line ? pending : null;
    onComment({ file, line, text, category: cat, quote: p?.quote?.split("\n")[0], start: p?.start, end: p?.end });
    setDraft(""); setActive(null); setPending(null);
    window.getSelection()?.removeAllRanges();
  }

  function submitReply() {
    if (!reply) return;
    const text = replyDraft.trim();
    if (!text) return;
    onReply(reply.line, text, reply.target, file);
    setReply(null); setReplyDraft("");
  }

  function rangesFor(lineNum: number, text: string): Array<{ from: number; to: number; mark: string }> {
    const out: Array<{ from: number; to: number; mark: string }> = [];
    const cover = (a: { start?: Pt; end?: Pt }, mark: string) => {
      if (!a.start || !a.end) return;
      if (lineNum < a.start.line || lineNum > a.end.line) return;
      const from = lineNum === a.start.line ? a.start.col : 0;
      const to = lineNum === a.end.line ? a.end.col : text.length;
      if (to > from) out.push({ from, to, mark });
    };
    for (const a of fileAnnotations) if (a.author === "you") cover(a, CAT[a.category ?? "style"].mark);
    if (pending) cover(pending, "bg-navy/20 dark:bg-accent/20");
    return out.sort((x, y) => x.from - y.from);
  }

  function renderLine(text: string, ranges: Array<{ from: number; to: number; mark: string }>) {
    if (!ranges.length) return text || " ";
    const segs: React.ReactNode[] = [];
    let pos = 0;
    for (let i = 0; i < ranges.length; i++) {
      const r = ranges[i];
      const from = Math.max(r.from, pos);
      if (from >= r.to) continue;
      if (from > pos) segs.push(<span key={`n${i}`}>{text.slice(pos, from)}</span>);
      segs.push(<mark key={`m${i}`} className={cn("rounded-sm text-fg underline", r.mark)}>{text.slice(from, r.to)}</mark>);
      pos = r.to;
    }
    if (pos < text.length) segs.push(<span key="t">{text.slice(pos)}</span>);
    return segs;
  }

  const replyBox = (line: number) => (
    <div className="ml-10 mr-2 mb-2 rounded-md border border-border bg-surface p-2">
      <div className="mb-1 text-[10px] text-muted">{reply?.target === "chat" ? "Replying in the chat panel" : "Replying inline"}</div>
      <textarea autoFocus value={replyDraft} onChange={(e) => setReplyDraft(e.target.value)} onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") submitReply(); }}
        placeholder="Your reply to the interviewer…"
        className="h-14 w-full resize-none rounded border border-border bg-card p-1.5 font-sans text-xs text-fg focus:outline-none focus:ring-1 focus:ring-navy dark:focus:ring-accent" />
      <div className="mt-1 flex items-center gap-2">
        <button onClick={submitReply} className="rounded-full bg-navy px-3 py-1 text-xs font-semibold text-white dark:bg-accent dark:text-accent-fg">Send</button>
        <button onClick={() => { setReply(null); setReplyDraft(""); }} className="text-xs text-muted hover:text-fg">Cancel</button>
        <span className="ml-auto text-[10px] text-muted">⌘↵</span>
      </div>
    </div>
  );

  return (
    <div className="relative flex h-full flex-col overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex items-center gap-2 border-b border-border px-3 py-1.5">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted">Under review</span>
        <span className="rounded bg-surface px-1.5 py-0.5 text-[10px] font-medium text-muted">{language}</span>
        {deferComments && <span className="rounded bg-amber/15 px-1.5 py-0.5 text-[10px] font-medium text-amber">batch · comment first</span>}
        <div className="ml-auto flex items-center gap-2">
          {fileAnnotations.length > 0 && (
            <>
              <button onClick={() => setCollapsedAll((v) => !v)} className="text-[11px] text-muted hover:text-fg">{collapsedAll ? "Show comments" : "Hide comments"}</button>
              <button onClick={() => { if (confirm("Remove all in-code comments? (chat history stays)")) onClearAll(); }} className="text-[11px] text-danger hover:underline">Clear all</button>
            </>
          )}
        </div>
      </div>

      <div ref={containerRef} onMouseUp={onMouseUp} onScroll={() => setChip(null)} className="min-h-0 flex-1 overflow-auto font-mono text-xs leading-relaxed scroll-thin">
        {lines.map((ln, i) => {
          const num = i + 1;
          const thread = fileAnnotations.filter((a) => a.line === num);
          const tone = lineTone?.[num];
          const lastAi = [...thread].reverse().find((a) => a.author === "ai");
          const isActive = active === num;
          const isJump = jumpLine === num;
          const hideThread = thread.length > 0 && isCollapsed(num);
          return (
            <div key={num} data-line={num} className={cn("border-l-2", isActive ? "border-navy bg-navy/5 dark:border-accent dark:bg-accent/10" : isJump ? "border-amber bg-amber/10" : thread.length ? "border-amber/40" : "border-transparent")}>
              <div className={cn("group flex items-start gap-2 px-2 hover:bg-surface/60", tone === "add" && "bg-success/10", tone === "del" && "bg-danger/10")}>
                {lineTone && <span className={cn("w-2 shrink-0 select-none pt-0.5 text-center font-bold", tone === "add" ? "text-success" : tone === "del" ? "text-danger" : "text-transparent")}>{tone === "add" ? "+" : tone === "del" ? "−" : " "}</span>}
                <span className="w-8 shrink-0 select-none pt-0.5 text-right text-muted">{num}</span>
                {!disabled && <button title="Comment on this line" onClick={() => openLineBox(num)} className="shrink-0 select-none pt-0.5 text-muted opacity-0 transition-opacity hover:text-navy group-hover:opacity-100 dark:hover:text-accent">💬</button>}
                <pre data-code className="flex-1 whitespace-pre-wrap break-words pt-0.5 text-fg">{renderLine(ln || " ", rangesFor(num, ln))}</pre>
                {thread.length > 0 && (
                  <button onClick={() => toggleCollapse(num)} title={isCollapsed(num) ? "Show thread" : "Minimize thread"} className="mt-0.5 shrink-0 select-none rounded bg-amber/20 px-1 text-[10px] font-semibold text-amber hover:bg-amber/30">
                    💬 {thread.length} {isCollapsed(num) ? "▸" : "▾"}
                  </button>
                )}
              </div>

              {!hideThread && thread.map((a, k) =>
                a.author === "ai" ? (
                  <div key={k} className="ml-10 mr-2 mb-1 rounded-md border border-navy/30 bg-navy/5 px-2 py-1 text-[11px] text-fg dark:border-accent/40 dark:bg-accent/10">
                    <span className="font-semibold text-navy dark:text-accent">✦ Interviewer:</span> {a.text}
                    {!disabled && a === lastAi && (
                      <div className="mt-1 flex gap-3">
                        <button onClick={() => { setActive(null); setReply({ line: num, target: "here" }); setReplyDraft(""); }} className="text-[10px] font-semibold text-navy hover:underline dark:text-accent">↩ Reply here</button>
                        <button onClick={() => { setActive(null); setReply({ line: num, target: "chat" }); setReplyDraft(""); }} className="text-[10px] font-semibold text-muted hover:text-fg hover:underline">💬 Reply on chat</button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div key={k} className={cn("ml-10 mr-2 mb-1 rounded-md border bg-surface/60 px-2 py-1 text-[11px] text-fg", a.category ? CAT[a.category].chip : "border-border")}>
                    {a.quote && <div className="mb-0.5 truncate font-mono text-[10px] opacity-80">“{a.quote}”</div>}
                    <span className="inline-flex items-center gap-1 font-semibold">
                      {a.category && <span className={cn("inline-block h-1.5 w-1.5 rounded-full", CAT[a.category].dot)} />}
                      {a.category ? `you · ${CAT[a.category].label}:` : "you:"}
                    </span>{" "}
                    {a.text}
                  </div>
                )
              )}

              {reply?.line === num && !disabled && replyBox(num)}

              {isActive && !disabled && (
                <div className="ml-10 mr-2 mb-2 rounded-md border border-border bg-surface p-2">
                  {pending && pending.start.line === num && (
                    <div className="mb-1 truncate font-mono text-[10px] text-muted">On <span className="text-amber">“{pending.quote.split("\n")[0]}”</span>{pending.end.line > pending.start.line ? ` … (+${pending.end.line - pending.start.line} lines)` : ""}</div>
                  )}
                  <div className="mb-1.5 flex flex-wrap gap-1">
                    {REVIEW_CATEGORIES.map((c) => (
                      <button key={c.slug} onClick={() => setCat(c.slug)} className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium transition-colors", cat === c.slug ? c.chip + " bg-surface" : "border-border text-muted hover:text-fg")}>
                        <span className={cn("inline-block h-1.5 w-1.5 rounded-full", c.dot)} />{c.label}
                      </button>
                    ))}
                  </div>
                  <textarea autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") submit(num); }}
                    placeholder={deferComments ? "What's the issue? Queued until you request the review." : "What's the issue? The interviewer will follow up."}
                    className="h-16 w-full resize-none rounded border border-border bg-card p-1.5 font-sans text-xs text-fg focus:outline-none focus:ring-1 focus:ring-navy dark:focus:ring-accent" />
                  <div className="mt-1 flex items-center gap-2">
                    <button onClick={() => submit(num)} className="rounded-full bg-navy px-3 py-1 text-xs font-semibold text-white dark:bg-accent dark:text-accent-fg">{deferComments ? "Add comment" : "Comment"}</button>
                    <button onClick={() => { setActive(null); setDraft(""); setPending(null); }} className="text-xs text-muted hover:text-fg">Cancel</button>
                    <span className="ml-auto text-[10px] text-muted">⌘↵</span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {chip && pending && !disabled && (
        <button onMouseDown={(e) => { e.preventDefault(); openSelectionBox(); }} style={{ position: "fixed", left: chip.x, top: chip.y - 34, zIndex: 50 }}
          className="-translate-x-1/2 rounded-full bg-navy px-3 py-1 text-xs font-semibold text-white shadow-lg dark:bg-accent dark:text-accent-fg">💬 Comment</button>
      )}
    </div>
  );
}
