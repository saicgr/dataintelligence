"use client";

import { useEffect, useRef, useState } from "react";
import type { ConvItem } from "@/lib/data/practice";
import { WorkbenchFrame, type ChatMsg } from "./WorkbenchFrame";
import { CodeReviewPanel, REVIEW_CATEGORIES, type ReviewAnnotation, type CommentPayload } from "./CodeReviewPanel";
import { ApproachGate, approachGateEnabled } from "./ApproachGate";
import { usePracticeLimits } from "@/lib/practice-limits";
import { useProgress } from "@/components/providers/progress-provider";
import { cn } from "@/lib/utils";

interface Grade { score: number; verdict: string; strengths: string[]; gaps: string[]; source: "ai" | "self"; rubric?: string[] }

/**
 * Interactive code/artifact REVIEW interview. The candidate leaves line-anchored
 * comments; each comment is posted to /api/practice/chat (with the line) and the
 * interviewer probes with escalating follow-ups (server-side scenario). The
 * candidate can also ask clarifying questions in the chat. "Submit review" grades
 * the whole transcript against the planted issues. Answer key stays server-side.
 */
export function ReviewWorkbench({
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
  const review = item.review!;
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

  const ctx = {
    title: item.title,
    level: item.level,
    prompt: item.prompt,
    schemaNote: `${item.category} · ${item.difficulty}`,
    hint: item.hints[0] ?? "",
  };

  async function ask(history: ChatMsg[], lineComment?: { line: number; text: string }): Promise<string> {
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

  // The approach gate's probe seeds the coach thread (no extra AI call vs. the greeting).
  async function gateProbe(approach: string): Promise<string> {
    const next: ChatMsg[] = [{ role: "user", content: `My review strategy: ${approach}` }];
    setMessages(next);
    const r = await ask(next);
    setMessages((m) => [...m, { role: "assistant", content: r }]);
    greeted.current = true;
    return r;
  }

  function onComment(p: CommentPayload) {
    const catLabel = REVIEW_CATEGORIES.find((c) => c.slug === p.category)?.label ?? p.category;
    setAnnotations((a) => [...a, { author: "you", line: p.line, text: p.text, category: p.category, quote: p.quote, start: p.start, end: p.end }]);
    if (batchMode) { setQueue((q) => [...q, p]); return; }
    if (!limits.useAsk()) { onUpgrade(); return; }
    const anchorLine = p.start?.line ?? p.line;
    const label = p.quote ? `💬 Line ${p.line} ("${p.quote}")` : `💬 Line ${p.line}`;
    const next: ChatMsg[] = [...messages, { role: "user", content: `${label} [${catLabel}]: ${p.text}` }];
    setMessages(next);
    ask(next, { line: p.line, text: `(on ${p.quote ? `"${p.quote}"` : `line ${p.line}`}, candidate flagged it as "${catLabel}") ${p.text}` }).then((r) => {
      setMessages((m) => [...m, { role: "assistant", content: r }]);
      setAnnotations((a) => [...a, { author: "ai", line: anchorLine, text: r }]);
    });
  }

  async function requestReview() {
    if (!queue.length) return;
    if (!limits.useAsk()) { onUpgrade(); return; }
    const summary = queue
      .map((p) => `- Line ${p.line}${p.quote ? ` ("${p.quote}")` : ""} [${REVIEW_CATEGORIES.find((c) => c.slug === p.category)?.label ?? p.category}]: ${p.text}`)
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

  // Reply to the interviewer's inline message — either inline ("here") or in the chat pane.
  function onReply(line: number, text: string, target: "here" | "chat") {
    if (!limits.useAsk()) { onUpgrade(); return; }
    if (target === "here") setAnnotations((a) => [...a, { author: "you", line, text }]);
    const next: ChatMsg[] = [...messages, { role: "user", content: `${target === "here" ? "↩" : "💬"} (re line ${line}) ${text}` }];
    setMessages(next);
    ask(next, { line, text }).then((r) => {
      setMessages((m) => [...m, { role: "assistant", content: r }]);
      if (target === "here") setAnnotations((a) => [...a, { author: "ai", line, text: r }]);
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
      "REVIEW COMMENTS (line-anchored, with the candidate's own category tag):",
      ...(yours.length
        ? yours.map((c) => `- Line ${c.line}${c.quote ? ` ("${c.quote}")` : ""} [flagged: ${c.category}]: ${c.text}`)
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

  const question = (
    <div className="space-y-4">
      <div>
        <div className="flex items-center gap-2">
          <span className="grid h-5 w-5 place-items-center rounded-full border border-amber text-[11px] font-bold text-amber">1</span>
          <span className="text-xs font-semibold uppercase tracking-wider text-muted">Review task</span>
        </div>
        <div className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-fg">{item.prompt.replace(/```[\s\S]*?```/g, "").replace(/\n{3,}/g, "\n\n").trim()}</div>
      </div>
      <div className="rounded-xl border border-border bg-surface/40 p-3 text-xs text-muted">
        Leave comments on the lines you'd flag in a PR — the interviewer will push back and ask follow-ups.
        You can also ask clarifying questions in the chat (e.g. data volumes). Hit <span className="font-semibold text-fg">Submit review</span> when done.
      </div>
      {showModel && modelReview && (
        <div className="overflow-hidden rounded-xl border border-amber/30 bg-amber/5">
          <div className="border-b border-amber/20 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-amber">Model review</div>
          <div className="whitespace-pre-wrap p-4 text-xs text-fg">{modelReview}</div>
        </div>
      )}
    </div>
  );

  const codePane = gateOpen ? (
    <div className="flex h-full flex-col gap-2 p-3">
      <div className="flex items-center gap-2">
        <button onClick={() => setBatchMode((v) => !v)} title="Comment-first: queue comments, then request the review in one batch"
          className={cn("whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-medium", batchMode ? "border-amber/50 text-amber" : "border-border text-muted hover:text-fg")}>
          {batchMode ? "Comment-first: on" : "Comment-first: off"}
        </button>
        {batchMode && (
          <button onClick={requestReview} disabled={!queue.length || thinking} className="whitespace-nowrap rounded-full border border-amber/50 px-3 py-1 text-[11px] font-semibold text-amber disabled:opacity-40">
            Request review{queue.length ? ` (${queue.length})` : ""}
          </button>
        )}
      </div>
      <div className="min-h-0 flex-1">
        <CodeReviewPanel code={review.code ?? ""} language={review.language ?? "text"} deferComments={batchMode} annotations={annotations} onComment={onComment} onReply={onReply} onClearAll={onClearAll} jumpLine={jumpLine} disabled={grading} />
      </div>
      <div className="rounded-xl border border-border bg-card p-2.5">
        <div className="flex items-center gap-2">
          <button onClick={onSubmit} disabled={grading} className="rounded-full bg-navy px-5 py-2 text-sm font-semibold text-white disabled:opacity-50 dark:bg-accent dark:text-accent-fg">{grading ? "Grading…" : "Submit review"}</button>
          <span className="text-[11px] text-muted">{annotations.filter((a) => a.author === "you").length} comment{annotations.filter((a) => a.author === "you").length === 1 ? "" : "s"}</span>
          {!practicePro && <span className="ml-auto text-[11px] text-muted">{limits.submitsLeft} submits left today</span>}
        </div>
        {grade && (
          <div className={cn("mt-2 rounded-lg border px-3 py-2 text-sm", grade.score >= 70 ? "border-success/30 bg-success/10" : "border-warning/30 bg-warning/10")}>
            <div className="font-semibold text-fg">{grade.source === "ai" ? `Score ${grade.score}/100` : "Self-assess"} — {grade.verdict}</div>
            {grade.gaps?.length > 0 && (
              <ul className="mt-1 list-disc pl-5 text-xs text-muted">
                {grade.gaps.map((g, i) => <li key={i}>{g}</li>)}
              </ul>
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

  // Clicking a "Line N" badge in a chat message jumps to that line.
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
