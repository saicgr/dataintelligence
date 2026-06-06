"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ConvItem } from "@/lib/data/practice";
import { WorkbenchFrame, type ChatMsg } from "./WorkbenchFrame";
import { CodeReviewPanel, REVIEW_CATEGORIES, type ReviewAnnotation, type CommentPayload } from "./CodeReviewPanel";
import { FileTree, type FileEntry } from "./FileTree";
import { ApproachGate, approachGateEnabled } from "./ApproachGate";
import { usePracticeLimits } from "@/lib/practice-limits";
import { useProgress } from "@/components/providers/progress-provider";
import { cn } from "@/lib/utils";

interface Grade { score: number; verdict: string; strengths: string[]; gaps: string[]; source: "ai" | "self"; rubric?: string[] }

/** Line-level diff: which 1-indexed lines in `code` are added vs its `baseCode`. */
function lineToneFor(code: string, baseCode?: string): Record<number, "add" | "del"> | undefined {
  if (!baseCode) return undefined;
  const base = new Set(baseCode.split("\n").map((l) => l.trim()));
  const tone: Record<number, "add" | "del"> = {};
  code.split("\n").forEach((l, i) => { if (l.trim() && !base.has(l.trim())) tone[i + 1] = "add"; });
  return Object.keys(tone).length ? tone : undefined;
}

/**
 * Multi-file, GitHub-style PR review interview. The candidate switches between the
 * interconnected files, comments across them (file + line anchored), and the
 * interviewer probes — including drawing them toward the cross-file bug. Optional
 * "comment-first" mode queues comments and requests the review in one batch. The
 * planted issues + grading stay server-side (resolved by problemId).
 */
export function PrReviewWorkbench({
  item,
  hasAi,
  practicePro,
  onUpgrade,
  onBack,
}: {
  item: ConvItem;
  hasAi: boolean;
  practicePro: boolean;
  onUpgrade: () => void;
  onBack: () => void;
}) {
  const files = item.review!.files!;
  const [activeFile, setActiveFile] = useState(files[0].name);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [annotations, setAnnotations] = useState<ReviewAnnotation[]>([]);
  const [thinking, setThinking] = useState(false);
  const [revealedHints, setRevealedHints] = useState(0);
  const [grade, setGrade] = useState<Grade | null>(null);
  const [grading, setGrading] = useState(false);
  const [jumpLine, setJumpLine] = useState<number | null>(null);
  const [modelReview, setModelReview] = useState<string | null>(null);
  const [showModel, setShowModel] = useState(false);
  const [batchMode, setBatchMode] = useState(false);
  const [queue, setQueue] = useState<CommentPayload[]>([]);
  const [gateOpen, setGateOpen] = useState(!approachGateEnabled(item));
  const limits = usePracticeLimits(practicePro);
  const { recordPracticeSolve } = useProgress();
  const greeted = useRef(false);

  const active = files.find((f) => f.name === activeFile) ?? files[0];
  const lineTone = useMemo(() => lineToneFor(active.code, active.baseCode), [active]);

  const ctx = {
    title: item.title,
    level: item.level,
    prompt: item.prompt,
    schemaNote: `${item.category} · ${item.difficulty} · ${files.length} files`,
    hint: item.hints[0] ?? "",
  };

  async function ask(history: ChatMsg[], lineComment?: { line: number; text: string; file?: string }): Promise<string> {
    setThinking(true);
    try {
      const res = await fetch("/api/practice/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ problemId: item.id, problem: ctx, messages: history, lineComment }),
      });
      return (await res.json()).reply || "(no reply)";
    } catch {
      return "(interviewer offline — keep reviewing; submit when ready.)";
    } finally {
      setThinking(false);
    }
  }

  useEffect(() => {
    if (greeted.current || !gateOpen) return;
    greeted.current = true;
    if (messages.length === 0) ask([]).then((r) => setMessages([{ role: "assistant", content: r }]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gateOpen]);

  // The approach gate's probe seeds the coach thread (so no extra AI call vs. the greeting).
  async function gateProbe(approach: string): Promise<string> {
    const next: ChatMsg[] = [{ role: "user", content: `My review strategy: ${approach}` }];
    setMessages(next);
    const r = await ask(next);
    setMessages((m) => [...m, { role: "assistant", content: r }]);
    greeted.current = true;
    return r;
  }

  function catLabelFor(p: CommentPayload) {
    return REVIEW_CATEGORIES.find((c) => c.slug === p.category)?.label ?? p.category;
  }

  function onComment(p: CommentPayload) {
    // Record the in-code annotation immediately (both modes).
    const anchorLine = p.start?.line ?? p.line;
    setAnnotations((a) => [...a, { author: "you", file: p.file, line: p.line, text: p.text, category: p.category, quote: p.quote, start: p.start, end: p.end }]);
    if (batchMode) { setQueue((q) => [...q, p]); return; } // defer the AI until "Request review"
    if (!limits.useAsk()) { onUpgrade(); return; }
    const where = `${p.file ? `${p.file} ` : ""}line ${p.line}`;
    const label = p.quote ? `💬 ${where} ("${p.quote}")` : `💬 ${where}`;
    const next: ChatMsg[] = [...messages, { role: "user", content: `${label} [${catLabelFor(p)}]: ${p.text}` }];
    setMessages(next);
    ask(next, { line: p.line, text: `(on ${p.quote ? `"${p.quote}"` : where}, flagged "${catLabelFor(p)}") ${p.text}`, file: p.file }).then((r) => {
      setMessages((m) => [...m, { role: "assistant", content: r }]);
      setAnnotations((a) => [...a, { author: "ai", file: p.file, line: anchorLine, text: r }]);
    });
  }

  // Flush the queued comments to the interviewer as one batch review.
  async function requestReview() {
    if (!queue.length) return;
    if (!limits.useAsk()) { onUpgrade(); return; }
    const summary = queue
      .map((p) => `- ${p.file ? `${p.file} ` : ""}line ${p.line}${p.quote ? ` ("${p.quote}")` : ""} [${catLabelFor(p)}]: ${p.text}`)
      .join("\n");
    const next: ChatMsg[] = [...messages, { role: "user", content: `Here is my full review:\n${summary}` }];
    setMessages(next);
    setQueue([]);
    const r = await ask(next);
    setMessages((m) => [...m, { role: "assistant", content: r }]);
  }

  function onSend(text: string) {
    if (!limits.useAsk()) { onUpgrade(); return; }
    const next: ChatMsg[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    ask(next).then((r) => setMessages((m) => [...m, { role: "assistant", content: r }]));
  }

  function onReply(line: number, text: string, target: "here" | "chat", file?: string) {
    if (!limits.useAsk()) { onUpgrade(); return; }
    if (target === "here") setAnnotations((a) => [...a, { author: "you", file, line, text }]);
    const next: ChatMsg[] = [...messages, { role: "user", content: `${target === "here" ? "↩" : "💬"} (re ${file ? `${file} ` : ""}line ${line}) ${text}` }];
    setMessages(next);
    ask(next, { line, text, file }).then((r) => {
      setMessages((m) => [...m, { role: "assistant", content: r }]);
      if (target === "here") setAnnotations((a) => [...a, { author: "ai", file, line, text: r }]);
    });
  }

  function onClearAll() { setAnnotations([]); setQueue([]); }

  function onHint() {
    if (revealedHints >= item.hints.length) return;
    const h = item.hints[revealedHints];
    setRevealedHints((n) => n + 1);
    setMessages((m) => [...m, { role: "assistant", content: `💡 ${h}` }]);
  }

  async function onReveal() {
    if (!practicePro) { onUpgrade(); return; }
    if (!modelReview) {
      try {
        const res = await fetch("/api/practice/solution", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ problemId: item.id }) });
        if (!res.ok) { onUpgrade(); return; }
        setModelReview((await res.json()).answer ?? null);
      } catch { return; }
    }
    setShowModel(true);
  }

  async function onSubmit() {
    if (!limits.useSubmit()) { onUpgrade(); return; }
    setGrading(true);
    const yours = annotations.filter((a) => a.author === "you");
    const transcript = [
      "PR REVIEW COMMENTS (file + line anchored, with the candidate's own category tag):",
      ...(yours.length
        ? yours.map((c) => `- ${c.file ? `${c.file} ` : ""}Line ${c.line}${c.quote ? ` ("${c.quote}")` : ""} [flagged: ${c.category}]: ${c.text}`)
        : ["(none)"]),
      "",
      "INTERVIEW DIALOGUE:",
      ...messages.map((m) => `${m.role === "user" ? "Candidate" : "Interviewer"}: ${m.content}`),
    ].join("\n");
    try {
      const res = await fetch("/api/practice/grade", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          problemId: item.id,
          item: { title: item.title, category: item.category, level: item.level, prompt: item.prompt, idealAnswer: "", rubric: item.rubric, mode: "text" },
          answer: transcript,
        }),
      });
      const g: Grade = await res.json();
      setGrade(g);
      if (g.source === "ai" && g.score >= 70) recordPracticeSolve(item.category, item.id);
    } catch {
      setGrade({ score: 0, verdict: "Grader unreachable — try again.", strengths: [], gaps: [], source: "self" });
    } finally {
      setGrading(false);
    }
  }

  const yourCount = annotations.filter((a) => a.author === "you").length;

  const question = (
    <div className="space-y-4">
      <div>
        <div className="flex items-center gap-2">
          <span className="grid h-5 w-5 place-items-center rounded-full border border-amber text-[11px] font-bold text-amber">1</span>
          <span className="text-xs font-semibold uppercase tracking-wider text-muted">Pull request</span>
        </div>
        <div className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-fg">{item.prompt.replace(/```[\s\S]*?```/g, "").replace(/\n{3,}/g, "\n\n").trim()}</div>
      </div>
      <div className="rounded-xl border border-border bg-surface/40 p-3 text-xs text-muted">
        {files.length} files changed. Switch files with the tabs, select a span to comment, and the interviewer
        will push back. There's at least one bug that only shows up when the files interact.
      </div>
      {showModel && modelReview && (
        <div className="overflow-hidden rounded-xl border border-amber/30 bg-amber/5">
          <div className="border-b border-amber/20 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-amber">Model review</div>
          <div className="whitespace-pre-wrap p-4 text-xs text-fg">{modelReview}</div>
        </div>
      )}
    </div>
  );

  const fileEntries: FileEntry[] = files.map((f) => ({
    name: f.name,
    badge: annotations.filter((a) => a.author === "you" && a.file === f.name).length,
    dot: f.baseCode ? "bg-success" : undefined,
  }));

  const codePane = gateOpen ? (
    <div className="flex h-full flex-col gap-2 p-3">
      <div className="flex items-center justify-end">
        <button onClick={() => setBatchMode((v) => !v)} title="Comment-first: queue comments, then request the review in one batch"
          className={cn("whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-medium", batchMode ? "border-amber/50 text-amber" : "border-border text-muted hover:text-fg")}>
          {batchMode ? "Comment-first: on" : "Comment-first: off"}
        </button>
      </div>

      {/* File explorer (left) + code panel (right) */}
      <div className="flex min-h-0 flex-1 gap-2">
        <FileTree entries={fileEntries} active={activeFile} onSelect={setActiveFile} groupBy="folder" title="Changed files" />
        <div className="min-h-0 flex-1">
          <CodeReviewPanel
            key={active.name}
            code={active.code}
            language={active.language}
            file={active.name}
            lineTone={lineTone}
            deferComments={batchMode}
            annotations={annotations}
            onComment={onComment}
            onReply={onReply}
            onClearAll={onClearAll}
            jumpLine={jumpLine}
            disabled={grading}
          />
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-2.5">
        <div className="flex flex-wrap items-center gap-2">
          {batchMode && (
            <button onClick={requestReview} disabled={!queue.length || thinking} className="rounded-full border border-amber/50 px-4 py-2 text-sm font-semibold text-amber disabled:opacity-40">
              Request review{queue.length ? ` (${queue.length})` : ""}
            </button>
          )}
          <button onClick={onSubmit} disabled={grading} className="rounded-full bg-navy px-5 py-2 text-sm font-semibold text-white disabled:opacity-50 dark:bg-accent dark:text-accent-fg">{grading ? "Grading…" : "Submit review"}</button>
          <span className="text-[11px] text-muted">{yourCount} comment{yourCount === 1 ? "" : "s"} across {files.length} files</span>
          {!practicePro && <span className="ml-auto text-[11px] text-muted">{limits.submitsLeft} submits left today</span>}
        </div>
        {grade && (
          <div className={cn("mt-2 rounded-lg border px-3 py-2 text-sm", grade.score >= 70 ? "border-success/30 bg-success/10" : "border-warning/30 bg-warning/10")}>
            <div className="font-semibold text-fg">{grade.source === "ai" ? `Score ${grade.score}/100` : "Self-assess"} — {grade.verdict}</div>
            {grade.gaps?.length > 0 && (
              <ul className="mt-1 list-disc pl-5 text-xs text-muted">{grade.gaps.map((g, i) => <li key={i}>{g}</li>)}</ul>
            )}
          </div>
        )}
      </div>
    </div>
  ) : (
    <ApproachGate
      kind="review"
      onVerdict={(a) => fetch("/api/practice/approach-verdict", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ problemId: item.id, approach: a }) }).then((r) => r.json())}
      onProbe={gateProbe}
      onUnlock={() => setGateOpen(true)}
    />
  );

  function onSendOrJump(text: string) {
    const m = text.match(/^\s*line\s+(\d+)\s*$/i);
    if (m) { setJumpLine(Number(m[1])); return; }
    onSend(text);
  }

  return (
    <WorkbenchFrame
      title={item.title}
      company={item.company}
      difficulty={item.difficulty}
      level={item.level}
      onBack={onBack}
      hasAi={hasAi}
      messages={messages}
      thinking={thinking}
      onSend={onSendOrJump}
      onHint={onHint}
      hintsLeft={item.hints.length - revealedHints}
      onReveal={onReveal}
      question={question}
      code={codePane}
    />
  );
}
