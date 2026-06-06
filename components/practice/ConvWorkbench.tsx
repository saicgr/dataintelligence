"use client";

import { useState, useEffect } from "react";
import type { ConvItem } from "@/lib/data/practice";
import { runPython, runTests, type TestResult } from "./pyodide";
import { ResultsTable } from "./ResultsTable";
import { WorkbenchFrame, type ChatMsg } from "./WorkbenchFrame";
import { CodeEditor } from "./CodeEditor";
import { Whiteboard, type Shape } from "./Whiteboard";
import { VerticalSplit } from "./VerticalSplit";
import { WinModal } from "./WinModal";
import { ToolBtn } from "./ToolBtn";
import { MicButton } from "./MicButton";
import { ApproachGate, approachGateEnabled } from "./ApproachGate";
import { usePracticeLimits } from "@/lib/practice-limits";
import { useProgress } from "@/components/providers/progress-provider";
import { cn } from "@/lib/utils";

interface Grade {
  score: number;
  verdict: string;
  strengths: string[];
  gaps: string[];
  source: "ai" | "self";
  rubric?: string[];
}

function Prompt({ text }: { text: string }) {
  const parts = text.split(/```/);
  return (
    <div className="space-y-2 text-sm leading-relaxed text-fg">
      {parts.map((p, i) =>
        i % 2 === 1 ? (
          <pre key={i} className="overflow-x-auto rounded-lg border border-border bg-surface p-3 font-mono text-xs text-fg scroll-thin">{p.replace(/^[a-z]*\n/, "")}</pre>
        ) : (
          <p key={i} className="whitespace-pre-wrap">{p}</p>
        )
      )}
    </div>
  );
}

export function ConvWorkbench({
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
  const runnable = item.mode === "code" && (item.tests?.length ?? 0) > 0;
  const sparkable = item.category === "pyspark" && !!item.sparkExec;
  const designable = item.category === "systemdesign" || item.category === "casestudy";

  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [spark, setSpark] = useState<{ correct?: boolean; columns?: string[]; rows?: unknown[][]; error?: string; unavailable?: boolean; message?: string } | null>(null);
  const [thinking, setThinking] = useState(false);
  const [answer, setAnswer] = useState(item.starter);
  const [grade, setGrade] = useState<Grade | null>(null);
  const [grading, setGrading] = useState(false);
  const [showModel, setShowModel] = useState(false);
  const [modelAnswer, setModelAnswer] = useState<string | null>(null);
  const [revealedHints, setRevealedHints] = useState(0);
  const [sampleOn, setSampleOn] = useState(false);
  const [consoleOut, setConsoleOut] = useState<string | null>(null);
  const [tests, setTests] = useState<TestResult[] | null>(null);
  const [execErr, setExecErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<"" | "run" | "tests">("");
  const [copied, setCopied] = useState(false);
  const [win, setWin] = useState(false);
  const [solved, setSolved] = useState(false);
  const [pane, setPane] = useState<"notes" | "board">("notes");
  const [shapes, setShapes] = useState<Shape[]>([]);
  const [gateOpen, setGateOpen] = useState(!approachGateEnabled(item));
  const limits = usePracticeLimits(practicePro);
  const { recordPracticeSolve } = useProgress();
  const markSolved = () => { setSolved(true); setWin(true); recordPracticeSolve(item.category, item.id); };

  // The model answer is NOT included — chat/grade resolve it server-side by problemId.
  const ctx = {
    title: item.title,
    level: item.level,
    prompt: item.prompt,
    schemaNote: `${item.category} · ${item.difficulty}`,
    hint: item.hints[0] ?? "",
  };

  async function askInterviewer(history: ChatMsg[]) {
    setThinking(true);
    try {
      const res = await fetch("/api/practice/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ problemId: item.id, problem: ctx, messages: history }) });
      const data = await res.json();
      setMessages((m) => [...m, { role: "assistant", content: data.reply }]);
    } catch {
      setMessages((m) => [...m, { role: "assistant", content: "(coach offline — keep going.)" }]);
    } finally {
      setThinking(false);
    }
  }

  useEffect(() => {
    if (gateOpen && messages.length === 0) askInterviewer([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gateOpen]);

  // The approach gate's probe seeds the coach thread (no extra AI call vs. the greeting).
  async function gateProbe(approach: string): Promise<string> {
    const next: ChatMsg[] = [{ role: "user", content: `My approach: ${approach}` }];
    setMessages(next);
    setThinking(true);
    try {
      const res = await fetch("/api/practice/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ problemId: item.id, problem: ctx, messages: next }) });
      const data = await res.json();
      const reply = data.reply || "Sounds reasonable — let's see it.";
      setMessages((m) => [...m, { role: "assistant", content: reply }]);
      return reply;
    } catch {
      const reply = "Couldn't reach the coach — go ahead and start.";
      setMessages((m) => [...m, { role: "assistant", content: reply }]);
      return reply;
    } finally {
      setThinking(false);
    }
  }

  function onSend(text: string) {
    if (!limits.useAsk()) { onUpgrade(); return; }
    const next = [...messages, { role: "user" as const, content: text }];
    setMessages(next);
    askInterviewer(next);
  }
  function askAboutCode() {
    let state = "";
    if (execErr) state = ` It errored: ${execErr}.`;
    else if (tests && tests.some((t) => !t.ok)) state = ` Some tests are failing.`;
    else if (spark && spark.correct === false) state = ` The Spark result isn't a match yet.`;
    const label = item.mode === "code" ? "code" : "answer";
    onSend(`On "${item.prompt}" — here's my ${label}, what am I missing?${state}\n\`\`\`\n${answer || "(empty)"}\n\`\`\``);
  }
  function onHint() {
    if (revealedHints >= item.hints.length) return;
    const h = item.hints[revealedHints];
    setRevealedHints((n) => n + 1);
    setMessages((m) => [...m, { role: "assistant", content: `💡 ${h}` }]);
  }
  async function onRevealGated() {
    if (!practicePro) { onUpgrade(); return; }
    if (!modelAnswer) {
      try {
        const res = await fetch("/api/practice/solution", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ problemId: item.id }) });
        if (!res.ok) { onUpgrade(); return; }
        setModelAnswer((await res.json()).answer ?? null);
      } catch { return; }
    }
    setShowModel(true);
  }
  function copyCode() {
    navigator.clipboard?.writeText(answer).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1200); }).catch(() => {});
  }

  async function onRun() {
    setBusy("run");
    setTests(null);
    setExecErr(null);
    const r = await runPython(answer);
    setConsoleOut(r.output || (r.error ? "" : "(ran — no output)"));
    setExecErr(r.error ?? null);
    setBusy("");
  }
  async function onRunTests() {
    if (!item.tests) return;
    if (!limits.useSubmit()) { onUpgrade(); return; }
    setBusy("tests");
    setExecErr(null);
    const r = await runTests(answer, item.tests);
    setTests(r.results);
    setConsoleOut(r.output || null);
    setExecErr(r.error ?? null);
    setBusy("");
    const passed = r.results.filter((t) => t.ok).length;
    const total = r.results.length;
    if (!r.error && passed === total && !solved) { markSolved(); }
    // Results show inline below — we don't auto-message the coach. Use "Ask AI" to discuss.
  }
  async function onRunSpark() {
    if (!item.sparkExec) return;
    if (!limits.useSubmit()) { onUpgrade(); return; }
    setBusy("tests");
    setSpark(null);
    try {
      const res = await fetch("/api/practice/spark", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code: answer, problemId: item.id }),
      });
      const data = await res.json();
      setSpark(data);
      if (data.correct && !solved) { markSolved(); }
      // Result renders inline; no auto-coach message. Use "Ask AI" to discuss.
    } catch {
      setSpark({ unavailable: true, message: "Spark runner unreachable." });
    } finally {
      setBusy("");
    }
  }

  async function getFeedback() {
    if (!limits.useAsk()) { onUpgrade(); return; }
    setGrading(true);
    try {
      const res = await fetch("/api/practice/grade", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ problemId: item.id, item: { title: item.title, category: item.category, level: item.level, prompt: item.prompt, idealAnswer: "", rubric: item.rubric, mode: item.mode }, answer }) });
      const g: Grade = await res.json();
      setGrade(g);
      if (g.source === "ai" && g.score >= 80 && !solved) { markSolved(); }
    } catch {
      setGrade({ score: 0, verdict: "Could not reach grader.", strengths: [], gaps: [], source: "self", rubric: item.rubric });
    } finally {
      setGrading(false);
    }
  }

  const scoreColor = (s: number) => (s >= 75 ? "text-success" : s >= 50 ? "text-warning" : "text-danger");
  const passed = tests?.filter((t) => t.ok).length ?? 0;
  const allPass = tests !== null && passed === tests.length && !execErr;

  const question = (
    <div className="space-y-4">
      <div>
        <div className="flex items-center gap-2">
          <span className="grid h-5 w-5 place-items-center rounded-full border border-amber text-[11px] font-bold text-amber">1</span>
          <span className="text-xs font-semibold uppercase tracking-wider text-muted">Question</span>
        </div>
        <div className="mt-2"><Prompt text={item.prompt} /></div>
      </div>
      {runnable && item.tests && (
        <div className="rounded-xl border border-border p-3">
          <label className="flex items-center justify-between gap-2 text-sm">
            <span className="font-medium text-fg">Sample input &amp; output</span>
            <button onClick={() => setSampleOn((s) => !s)} role="switch" aria-checked={sampleOn} className={cn("relative h-5 w-9 rounded-full transition-colors", sampleOn ? "bg-navy dark:bg-accent" : "bg-border")}>
              <span className={cn("absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all", sampleOn ? "left-[18px]" : "left-0.5")} />
            </button>
          </label>
          {sampleOn ? (
            <ul className="mt-3 space-y-2">{item.tests.map((t, i) => (
              <li key={i} className="rounded-lg border border-border bg-surface p-2"><p className="text-xs font-medium text-fg">{t.name}</p><pre className="mt-1 overflow-x-auto font-mono text-[11px] text-muted scroll-thin">{t.code}</pre></li>
            ))}</ul>
          ) : <p className="mt-2 text-xs text-muted">Off — flip on to see the example test cases.</p>}
        </div>
      )}
      {sparkable && item.sparkExec && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Sample DataFrames</p>
          <p className="mb-2 text-xs text-muted">Available as <code className="rounded bg-surface px-1 font-mono">spark</code> + these views. Assign your answer to <code className="rounded bg-surface px-1 font-mono">result</code>.</p>
          <div className="space-y-3">
            {item.sparkExec.sampleData.map((t) => (
              <ResultsTable key={t.name} title={t.name} result={{ columns: t.columns, rows: t.rows }} />
            ))}
          </div>
        </div>
      )}
    </div>
  );

  const editor = (
    <div className="flex h-full flex-col p-3">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex items-center gap-1.5 border-b border-border px-3 py-1.5">
          {designable ? (
            <div className="flex gap-1">
              <button onClick={() => setPane("notes")} className={cn("rounded px-2.5 py-1 text-xs font-semibold", pane === "notes" ? "bg-navy text-white dark:bg-accent dark:text-accent-fg" : "text-muted hover:bg-surface")}>✏️ Notes</button>
              <button onClick={() => setPane("board")} className={cn("rounded px-2.5 py-1 text-xs font-semibold", pane === "board" ? "bg-navy text-white dark:bg-accent dark:text-accent-fg" : "text-muted hover:bg-surface")}>🎨 Whiteboard</button>
            </div>
          ) : (
            <span className="text-xs font-semibold uppercase tracking-wider text-muted">{item.mode === "code" ? (sparkable ? "PySpark · server runner" : runnable ? "Python · runs in browser" : "Code") : "Your answer"}</span>
          )}
          <div className="ml-auto flex items-center gap-1">
            {item.mode === "text" && (!designable || pane === "notes") && <MicButton onText={(t) => setAnswer((a) => a + t)} className="h-7 w-7" />}
            {(!designable || pane === "notes") && <ToolBtn label={copied ? "Copied" : "Copy"} onClick={copyCode} icon="copy" />}
            <ToolBtn label="Ask AI" onClick={askAboutCode} icon="ai" />
            <ToolBtn label="Hint" onClick={onHint} icon="hint" disabled={revealedHints >= item.hints.length} />
          </div>
        </div>
        {designable && pane === "board" ? (
          <div className="min-h-0 flex-1"><Whiteboard shapes={shapes} onChange={setShapes} /></div>
        ) : item.mode === "code" ? (
          <div className="min-h-0 flex-1"><CodeEditor value={answer} onChange={setAnswer} language="python" onRun={runnable ? onRun : undefined} /></div>
        ) : (
          <textarea value={answer} onChange={(e) => setAnswer(e.target.value)} className="min-h-0 flex-1 resize-none bg-card px-4 py-3 text-sm leading-relaxed text-fg focus:outline-none" placeholder={designable ? "Outline your design — sketch on the whiteboard, then write the trade-offs here…" : "Write your answer — reason out loud, name trade-offs…"} />
        )}
        <div className="flex flex-wrap items-center gap-2 border-t border-border p-2.5">
          {runnable && (
            <>
              <button onClick={onRun} disabled={busy !== ""} className="rounded-full border border-border bg-surface px-5 py-2 text-sm font-semibold text-fg hover:bg-card disabled:opacity-50">{busy === "run" ? "Running…" : "Run"}</button>
              <button onClick={onRunTests} disabled={busy !== ""} className="rounded-full bg-navy px-5 py-2 text-sm font-semibold text-white disabled:opacity-50 dark:bg-accent dark:text-accent-fg">{busy === "tests" ? "Testing…" : `Run tests (${item.tests!.length})`}</button>
            </>
          )}
          {sparkable && (
            <button onClick={onRunSpark} disabled={busy !== ""} className="rounded-full bg-navy px-5 py-2 text-sm font-semibold text-white disabled:opacity-50 dark:bg-accent dark:text-accent-fg">{busy === "tests" ? "Running…" : "Run on Spark"}</button>
          )}
          <button onClick={getFeedback} disabled={grading} className={cn("rounded-full px-5 py-2 text-sm font-semibold disabled:opacity-50", runnable ? "border border-border bg-surface text-fg hover:bg-card" : "bg-navy text-white dark:bg-accent dark:text-accent-fg")}>{grading ? "Grading…" : "Get feedback"}</button>
          {!practicePro && <span className="ml-auto text-[11px] text-muted">{limits.submitsLeft} submits · {limits.asksLeft} AI left</span>}
        </div>
      </div>
    </div>
  );

  const results = (
    <div className="space-y-3 p-3">
      {spark && (
        spark.unavailable ? (
          <div className="rounded-xl border border-warning/30 bg-warning/10 p-4 text-sm text-warning">{spark.message || "Spark runner offline — use Get feedback (AI) instead."}</div>
        ) : spark.error ? (
          <div className="rounded-xl border border-danger/30 bg-danger/5 p-4"><p className="text-xs font-semibold uppercase tracking-wider text-danger">Spark error</p><pre className="mt-2 overflow-x-auto whitespace-pre-wrap font-mono text-xs text-danger">{spark.error}</pre></div>
        ) : (
          <>
            <div className={cn("rounded-xl border px-4 py-3 text-sm font-medium", spark.correct ? "border-success/30 bg-success/10 text-success" : "border-warning/30 bg-warning/10 text-warning")}>{spark.correct ? "✓ Correct — matches expected." : "✗ Not a match yet."}</div>
            {spark.columns && spark.rows && <ResultsTable title="Your Spark result" result={{ columns: spark.columns, rows: spark.rows }} />}
          </>
        )
      )}
      {tests && (
        <div className={cn("rounded-xl border", allPass ? "border-success/30 bg-success/5" : "border-warning/30 bg-warning/5")}>
          <div className="border-b border-border px-4 py-2 text-sm font-semibold">{allPass ? "✓ " : "✗ "}{passed}/{tests.length} tests passed</div>
          <ul className="divide-y divide-border">{tests.map((t, i) => (
            <li key={i} className="flex items-start gap-2 px-4 py-2 text-sm"><span className={t.ok ? "text-success" : "text-danger"}>{t.ok ? "✓" : "✗"}</span><span className="flex-1"><span className="text-fg">{t.name}</span>{!t.ok && t.msg && <span className="ml-2 font-mono text-xs text-danger">{t.msg}</span>}</span></li>
          ))}</ul>
        </div>
      )}
      {(consoleOut || execErr) && (
        <div className="overflow-hidden rounded-xl border border-border bg-card"><div className="border-b border-border px-4 py-2 text-xs font-semibold uppercase tracking-wider text-muted">Console</div><pre className={cn("max-h-48 overflow-auto whitespace-pre-wrap p-4 font-mono text-xs scroll-thin", execErr ? "text-danger" : "text-fg")}>{execErr ? execErr : consoleOut}</pre></div>
      )}
      {!runnable && !grade && <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted">Write your answer, then “Get feedback” for an AI grade.</div>}
      {runnable && !tests && !consoleOut && <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted">Run your code or run the tests to see output here.</div>}
      {grade && grade.source === "ai" && (
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-4"><span className={cn("text-4xl font-bold tracking-tight", scoreColor(grade.score))}>{grade.score}</span><p className="text-sm text-fg">{grade.verdict}</p></div>
          {grade.strengths.length > 0 && <div className="mt-4"><p className="text-xs font-semibold uppercase tracking-wider text-success">What you nailed</p><ul className="mt-1 space-y-1 text-sm text-fg">{grade.strengths.map((s, i) => <li key={i}>✓ {s}</li>)}</ul></div>}
          {grade.gaps.length > 0 && <div className="mt-4"><p className="text-xs font-semibold uppercase tracking-wider text-warning">Gaps</p><ul className="mt-1 space-y-1 text-sm text-fg">{grade.gaps.map((s, i) => <li key={i}>• {s}</li>)}</ul></div>}
        </div>
      )}
      {grade && grade.source === "self" && <div className="rounded-xl border border-border bg-surface p-5"><p className="text-sm font-medium text-fg">{grade.verdict}</p><ul className="mt-2 space-y-1 text-sm text-muted">{(grade.rubric ?? item.rubric).map((r, i) => <li key={i}>☐ {r}</li>)}</ul></div>}
      {showModel && <div className="overflow-hidden rounded-xl border border-amber/30 bg-amber/5"><div className="border-b border-amber/20 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-amber">Model answer</div><div className="p-4"><Prompt text={modelAnswer ?? ""} /></div></div>}
    </div>
  );

  return (
    <>
      <WorkbenchFrame
        title={item.title} company={item.company} difficulty={item.difficulty} level={item.level}
        onBack={onBack} hasAi={hasAi}
        messages={messages} thinking={thinking} onSend={onSend}
        onHint={onHint} hintsLeft={item.hints.length - revealedHints} onReveal={onRevealGated}
        question={question}
        code={gateOpen
          ? <VerticalSplit top={editor} bottom={results} bottomLabel={runnable ? "Output & tests" : "Feedback"} />
          : <ApproachGate
              kind="solve"
              onVerdict={(a) => fetch("/api/practice/approach-verdict", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ problemId: item.id, approach: a }) }).then((r) => r.json())}
              onProbe={gateProbe}
              onUnlock={() => setGateOpen(true)}
            />}
      />
      <WinModal open={win} onClose={() => setWin(false)} practicePro={practicePro} onUpgrade={() => { setWin(false); onUpgrade(); }} />
    </>
  );
}
