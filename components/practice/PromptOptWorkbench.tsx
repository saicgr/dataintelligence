"use client";

import { useEffect, useState } from "react";
import type { ConvItem } from "@/lib/data/practice";
import { WorkbenchFrame, type ChatMsg } from "./WorkbenchFrame";
import { CodeEditor } from "./CodeEditor";
import { VerticalSplit } from "./VerticalSplit";
import { WinModal } from "./WinModal";
import { ToolBtn } from "./ToolBtn";
import { PromptDataGrid, type RowResult } from "./PromptDataGrid";
import { usePracticeLimits } from "@/lib/practice-limits";
import { useProgress } from "@/components/providers/progress-provider";
import { cn } from "@/lib/utils";

interface OptResult {
  needsKey?: boolean;
  message?: string;
  rows?: RowResult[];
  accuracy?: number;
  target?: number;
  passed?: number;
  total?: number;
  allPass?: boolean;
}

/**
 * Prompt Optimization workbench ("promptlab"): the candidate edits a prompt and
 * re-runs it across a labeled dataset, watching accuracy climb toward the target.
 * Grading is server-side (/api/practice/prompt-opt) so the labels never ship.
 * Best accuracy is tracked across runs.
 */
export function PromptOptWorkbench({
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
  const opt = item.promptOpt!;
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [thinking, setThinking] = useState(false);
  const [prompt, setPrompt] = useState(item.starter);
  const [res, setRes] = useState<OptResult | null>(null);
  const [running, setRunning] = useState(false);
  const [best, setBest] = useState(0);
  const [revealedHints, setRevealedHints] = useState(0);
  const [win, setWin] = useState(false);
  const [solved, setSolved] = useState(false);
  const [copied, setCopied] = useState(false);
  const limits = usePracticeLimits(practicePro);
  const { recordPracticeSolve } = useProgress();

  const ctx = {
    title: item.title,
    level: item.level,
    prompt: `${item.prompt}\n\n(The candidate iterates a prompt over a labeled dataset toward ${opt.target}% accuracy.)`,
    schemaNote: `prompt optimization · ${item.difficulty}`,
    hint: item.hints[0] ?? "",
  };

  async function askInterviewer(history: ChatMsg[]) {
    setThinking(true);
    try {
      const r = await fetch("/api/practice/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ problemId: item.id, problem: ctx, messages: history }) });
      const data = await r.json();
      setMessages((m) => [...m, { role: "assistant", content: data.reply }]);
    } catch {
      setMessages((m) => [...m, { role: "assistant", content: "(coach offline.)" }]);
    } finally {
      setThinking(false);
    }
  }
  useEffect(() => { askInterviewer([]); /* eslint-disable-next-line */ }, []);

  function onSend(text: string) {
    if (!limits.useAsk()) { onUpgrade(); return; }
    const next = [...messages, { role: "user" as const, content: text }];
    setMessages(next);
    askInterviewer(next);
  }
  function onHint() {
    if (revealedHints >= item.hints.length) return;
    setMessages((m) => [...m, { role: "assistant", content: `💡 ${item.hints[revealedHints]}` }]);
    setRevealedHints((n) => n + 1);
  }

  async function run() {
    if (!limits.useSubmit()) { onUpgrade(); return; }
    setRunning(true);
    try {
      const r = await fetch("/api/practice/prompt-opt", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ problemId: item.id, prompt }) });
      const data: OptResult = await r.json();
      setRes(data);
      if (typeof data.accuracy === "number") setBest((b) => Math.max(b, data.accuracy!));
      if (data.allPass && !solved) { setSolved(true); setWin(true); recordPracticeSolve(item.category, item.id); }
    } catch {
      setRes({ message: "Run failed — try again." });
    } finally {
      setRunning(false);
    }
  }

  const acc = res?.accuracy ?? 0;
  const target = opt.target;

  const question = (
    <div className="space-y-4">
      <div>
        <div className="flex items-center gap-2">
          <span className="grid h-5 w-5 place-items-center rounded-full border border-amber text-[11px] font-bold text-amber">1</span>
          <span className="text-xs font-semibold uppercase tracking-wider text-muted">Optimize the prompt</span>
        </div>
        <div className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-fg">{item.prompt}</div>
        <div className="mt-3 rounded-lg border border-amber/30 bg-amber/5 p-3 text-sm text-fg">
          🎯 <span className="font-semibold">Target:</span> reach {target}% accuracy on the labeled rows.
        </div>
        <p className="mt-3 text-xs text-muted">
          Reference your inputs with{" "}
          {opt.inputColumns.map((c) => <code key={c} className="mr-1 rounded bg-surface px-1 font-mono">{`{{${c}}}`}</code>)}
          in the prompt. The expected answers are hidden — you only see whether each row is right.
        </p>
      </div>
    </div>
  );

  const editor = (
    <div className="flex h-full flex-col p-3">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex items-center gap-1.5 border-b border-border px-3 py-1.5">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted">Your prompt</span>
          <div className="ml-auto flex items-center gap-1">
            <ToolBtn label={copied ? "Copied" : "Copy"} onClick={() => navigator.clipboard?.writeText(prompt).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1200); }).catch(() => {})} icon="copy" />
            <ToolBtn label="Ask AI" onClick={() => onSend(`Here's my prompt — accuracy is ${acc}% / ${target}%. How would you improve it?\n\n${prompt || "(empty)"}`)} icon="ai" />
            <ToolBtn label="Hint" onClick={onHint} icon="hint" disabled={revealedHints >= item.hints.length} />
          </div>
        </div>
        <div className="min-h-0 flex-1"><CodeEditor value={prompt} onChange={setPrompt} language="plaintext" onRun={run} /></div>
        <div className="flex items-center gap-3 border-t border-border p-2.5">
          <button onClick={run} disabled={running} className="rounded-full bg-navy px-5 py-2 text-sm font-semibold text-white disabled:opacity-50 dark:bg-accent dark:text-accent-fg">{running ? "Running…" : `Run on ${opt.rows.length} rows`}</button>
          {best > 0 && <span className="text-[11px] text-muted">best {best}%</span>}
          {!practicePro && <span className="ml-auto text-[11px] text-muted">{limits.submitsLeft} runs left today</span>}
        </div>
      </div>
    </div>
  );

  const results = (
    <div className="space-y-3 p-3">
      {res?.needsKey && <div className="rounded-xl border border-warning/30 bg-warning/10 p-4 text-sm text-warning">{res.message}</div>}
      {res?.message && !res.needsKey && <div className="rounded-xl border border-danger/30 bg-danger/10 p-4 text-sm text-danger">{res.message}</div>}
      {/* Accuracy meter */}
      <div className={cn("rounded-xl border px-4 py-3", res?.allPass ? "border-success/30 bg-success/5" : "border-border")}>
        <div className="mb-1.5 flex items-baseline justify-between">
          <span className="text-sm font-semibold text-fg">Accuracy</span>
          <span className={cn("text-lg font-bold tabular-nums", res?.allPass ? "text-success" : "text-fg")}>{res ? `${acc}%` : "—"}<span className="ml-1 text-xs font-normal text-muted">/ {target}%</span></span>
        </div>
        <div className="relative h-2.5 overflow-hidden rounded-full bg-surface">
          <div className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-navy to-success transition-all duration-500 dark:from-accent" style={{ width: `${Math.min(100, acc)}%` }} />
          <div className="absolute inset-y-0 w-0.5 bg-amber" style={{ left: `${Math.min(100, target)}%` }} title={`target ${target}%`} />
        </div>
        {res && <p className="mt-1.5 text-[11px] text-muted">{res.passed}/{res.total} rows correct{res.allPass ? " · target reached 🎉" : ` · ${target - acc > 0 ? `${target - acc}% to go` : "almost"}`}</p>}
      </div>
      <PromptDataGrid inputColumns={opt.inputColumns} rows={opt.rows} results={res?.rows ?? null} />
    </div>
  );

  return (
    <>
      <WorkbenchFrame
        title={item.title} company={item.company} difficulty={item.difficulty} level={item.level}
        onBack={onBack} hasAi={hasAi}
        messages={messages} thinking={thinking} onSend={onSend}
        onHint={onHint} hintsLeft={item.hints.length - revealedHints}
        question={question}
        code={<VerticalSplit top={editor} bottom={results} bottomLabel="Dataset & accuracy" />}
      />
      <WinModal open={win} onClose={() => setWin(false)} practicePro={practicePro} onUpgrade={() => { setWin(false); onUpgrade(); }} />
    </>
  );
}
