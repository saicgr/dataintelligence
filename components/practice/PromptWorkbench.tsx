"use client";

import { useState, useEffect } from "react";
import type { ConvItem } from "@/lib/data/practice";
import { WorkbenchFrame, type ChatMsg } from "./WorkbenchFrame";
import { CodeEditor } from "./CodeEditor";
import { VerticalSplit } from "./VerticalSplit";
import { WinModal } from "./WinModal";
import { ToolBtn } from "./ToolBtn";
import { usePracticeLimits } from "@/lib/practice-limits";
import { useProgress } from "@/components/providers/progress-provider";
import { cn } from "@/lib/utils";

interface Check { label: string; ok: boolean; detail?: string }
interface InputResult { name: string; output: string; checks: Check[]; judge?: { score: number; reason: string } }
interface EvalResult { needsKey?: boolean; message?: string; results?: InputResult[]; totalChecks?: number; passedChecks?: number; avgJudge?: number | null; allPass?: boolean }

export function PromptWorkbench({
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
  const spec = item.promptEval!;
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [thinking, setThinking] = useState(false);
  const [prompt, setPrompt] = useState(item.starter);
  const [evalRes, setEvalRes] = useState<EvalResult | null>(null);
  const [running, setRunning] = useState(false);
  const [revealedHints, setRevealedHints] = useState(0);
  const [showModel, setShowModel] = useState(false);
  const [modelAnswer, setModelAnswer] = useState<string | null>(null);
  const [sampleOn, setSampleOn] = useState(false);
  const [copied, setCopied] = useState(false);
  const [win, setWin] = useState(false);
  const [solved, setSolved] = useState(false);
  const limits = usePracticeLimits(practicePro);
  const { recordPracticeSolve } = useProgress();

  // The model prompt is NOT included — chat resolves it server-side by problemId.
  const ctx = {
    title: item.title,
    level: item.level,
    prompt: `${item.prompt}\n\nTask: ${spec.task}`,
    schemaNote: `prompt engineering · ${item.difficulty}`,
    hint: item.hints[0] ?? "",
  };

  async function askInterviewer(history: ChatMsg[]) {
    setThinking(true);
    try {
      const res = await fetch("/api/practice/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ problemId: item.id, problem: ctx, messages: history }) });
      const data = await res.json();
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
    const h = item.hints[revealedHints];
    setRevealedHints((n) => n + 1);
    setMessages((m) => [...m, { role: "assistant", content: `💡 ${h}` }]);
  }
  function copyPrompt() {
    navigator.clipboard?.writeText(prompt).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1200); }).catch(() => {});
  }

  async function runEval() {
    if (!limits.useSubmit()) { onUpgrade(); return; }
    setRunning(true);
    try {
      const res = await fetch("/api/practice/prompt-eval", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ prompt, spec }) });
      const data: EvalResult = await res.json();
      setEvalRes(data);
      if (data.allPass && !solved) { setSolved(true); setWin(true); recordPracticeSolve(item.category, item.id); }
      // Eval results render inline; no auto-coach message. Use "Ask AI" to discuss.
    } catch {
      setEvalRes({ message: "Eval failed — try again." });
    } finally {
      setRunning(false);
    }
  }

  const question = (
    <div className="space-y-4">
      <div>
        <div className="flex items-center gap-2">
          <span className="grid h-5 w-5 place-items-center rounded-full border border-amber text-[11px] font-bold text-amber">1</span>
          <span className="text-xs font-semibold uppercase tracking-wider text-muted">Prompt task</span>
        </div>
        <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-fg">{item.prompt}</p>
        <div className="mt-3 rounded-lg border border-amber/30 bg-amber/5 p-3 text-sm text-fg">
          🎯 <span className="font-semibold">Goal:</span> {spec.task}
        </div>
        <p className="mt-3 text-xs text-muted">
          Use <code className="rounded bg-surface px-1 font-mono">{spec.placeholder || "{{input}}"}</code> where each test input should be inserted. We run your prompt on each input and grade the output.
        </p>
      </div>
      <div className="rounded-xl border border-border p-3">
        <label className="flex items-center justify-between gap-2 text-sm">
          <span className="font-medium text-fg">Show test inputs</span>
          <button onClick={() => setSampleOn((s) => !s)} role="switch" aria-checked={sampleOn} className={cn("relative h-5 w-9 rounded-full transition-colors", sampleOn ? "bg-navy dark:bg-accent" : "bg-border")}>
            <span className={cn("absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all", sampleOn ? "left-[18px]" : "left-0.5")} />
          </button>
        </label>
        {sampleOn ? (
          <ul className="mt-3 space-y-2">{spec.inputs.map((inp, i) => (
            <li key={i} className="rounded-lg border border-border bg-surface p-2">
              <p className="text-xs font-medium text-fg">{inp.name}</p>
              <pre className="mt-1 overflow-x-auto whitespace-pre-wrap font-mono text-[11px] text-muted scroll-thin">{inp.input}</pre>
              <p className="mt-1 text-[11px] text-muted">checks: {inp.assertions.map((a) => a.label ?? a.kind).join(", ")}</p>
            </li>
          ))}</ul>
        ) : <p className="mt-2 text-xs text-muted">{spec.inputs.length} hidden test inputs. Flip on to inspect them.</p>}
      </div>
    </div>
  );

  const editor = (
    <div className="flex h-full flex-col p-3">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex items-center gap-1.5 border-b border-border px-3 py-1.5">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted">Your prompt</span>
          <div className="ml-auto flex items-center gap-1">
            <ToolBtn label={copied ? "Copied" : "Copy"} onClick={copyPrompt} icon="copy" />
            <ToolBtn label="Ask AI" onClick={() => onSend(`Here's my prompt — how would you improve it?\n\n${prompt || "(empty)"}`)} icon="ai" />
            <ToolBtn label="Hint" onClick={onHint} icon="hint" disabled={revealedHints >= item.hints.length} />
          </div>
        </div>
        <div className="min-h-0 flex-1"><CodeEditor value={prompt} onChange={setPrompt} language="plaintext" onRun={runEval} /></div>
        <div className="flex items-center gap-2 border-t border-border p-2.5">
          <button onClick={runEval} disabled={running} className="rounded-full bg-navy px-5 py-2 text-sm font-semibold text-white disabled:opacity-50 dark:bg-accent dark:text-accent-fg">{running ? "Running eval…" : `Run eval (${spec.inputs.length})`}</button>
          {!practicePro && <span className="ml-auto text-[11px] text-muted">{limits.submitsLeft} runs left today</span>}
        </div>
      </div>
    </div>
  );

  const results = (
    <div className="space-y-3 p-3">
      {!evalRes && <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted">Write a prompt, then “Run eval” to grade it on the test inputs.</div>}
      {evalRes?.needsKey && <div className="rounded-xl border border-warning/30 bg-warning/10 p-4 text-sm text-warning">{evalRes.message}</div>}
      {evalRes?.results && (
        <>
          <div className={cn("rounded-xl border px-4 py-3 text-sm font-semibold", evalRes.allPass ? "border-success/30 bg-success/5 text-success" : "border-warning/30 bg-warning/5 text-warning")}>
            {evalRes.allPass ? "✓ " : "✗ "}{evalRes.passedChecks}/{evalRes.totalChecks} checks passed{typeof evalRes.avgJudge === "number" ? ` · judge ${evalRes.avgJudge}/100` : ""}
          </div>
          {evalRes.results.map((r, i) => (
            <div key={i} className="overflow-hidden rounded-xl border border-border bg-card">
              <div className="flex items-center justify-between border-b border-border px-3 py-1.5">
                <span className="text-xs font-semibold text-fg">{r.name}</span>
                {r.judge && <span className="text-[11px] text-muted">judge {r.judge.score}/100</span>}
              </div>
              <pre className="max-h-40 overflow-auto whitespace-pre-wrap p-3 font-mono text-[11px] text-fg scroll-thin">{r.output || "(empty)"}</pre>
              <ul className="border-t border-border px-3 py-2 text-xs">
                {r.checks.map((c, j) => (
                  <li key={j} className="flex items-start gap-2"><span className={c.ok ? "text-success" : "text-danger"}>{c.ok ? "✓" : "✗"}</span><span className="flex-1 text-fg">{c.label}{c.detail && !c.ok && <span className="ml-1 text-muted">— {c.detail}</span>}</span></li>
                ))}
                {r.judge && <li className="mt-1 text-muted">⚖ {r.judge.reason}</li>}
              </ul>
            </div>
          ))}
        </>
      )}
      {showModel && (
        <div className="overflow-hidden rounded-xl border border-amber/30 bg-amber/5"><div className="border-b border-amber/20 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-amber">Model prompt</div><pre className="whitespace-pre-wrap p-4 font-mono text-xs text-fg scroll-thin">{modelAnswer ?? ""}</pre></div>
      )}
    </div>
  );

  return (
    <>
      <WorkbenchFrame
        title={item.title} company={item.company} difficulty={item.difficulty} level={item.level}
        onBack={onBack} hasAi={hasAi}
        messages={messages} thinking={thinking} onSend={onSend}
        onHint={onHint} hintsLeft={item.hints.length - revealedHints}
        onReveal={async () => {
          if (!practicePro) { onUpgrade(); return; }
          if (!modelAnswer) {
            try {
              const res = await fetch("/api/practice/solution", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ problemId: item.id }) });
              if (!res.ok) { onUpgrade(); return; }
              setModelAnswer((await res.json()).answer ?? null);
            } catch { return; }
          }
          setShowModel(true);
        }}
        question={question}
        code={<VerticalSplit top={editor} bottom={results} bottomLabel="Eval results" />}
      />
      <WinModal open={win} onClose={() => setWin(false)} practicePro={practicePro} onUpgrade={() => { setWin(false); onUpgrade(); }} />
    </>
  );
}
