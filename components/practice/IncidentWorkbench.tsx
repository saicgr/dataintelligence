"use client";

import { useEffect, useRef, useState } from "react";
import type { ConvItem } from "@/lib/data/practice";
import { WorkbenchFrame, type ChatMsg } from "./WorkbenchFrame";
import { CodeReviewPanel } from "./CodeReviewPanel";
import { CodeEditor } from "./CodeEditor";
import { ResultsTable } from "./ResultsTable";
import { FileTree, type FileEntry } from "./FileTree";
import { ApproachGate, approachGateEnabled } from "./ApproachGate";
import { runQuery, type QueryResult } from "./duckdb";
import { runPython, type RunResult } from "./pyodide";
import { usePracticeLimits } from "@/lib/practice-limits";
import { useProgress } from "@/components/providers/progress-provider";
import { cn } from "@/lib/utils";

interface Grade { score: number; verdict: string; strengths: string[]; gaps: string[]; source: "ai" | "self"; rubric?: string[] }

const KIND_GROUP: Record<string, string> = { code: "Code", log: "Logs", config: "Config", query: "Queries" };
const TIER_BADGE: Record<string, { label: string; cls: string }> = {
  standard: { label: "Standard", cls: "border-border text-muted" },
  hard: { label: "🔥 Hard", cls: "border-amber/50 text-amber" },
  hellish: { label: "💀 Broken", cls: "border-danger/50 text-danger" },
};

/**
 * Production-incident workbench: read artifacts in a file explorer, investigate
 * with an in-browser SQL/Python scratchpad, take notes (war-room pad, autosaved),
 * ask the coach, then submit a root-cause + fix that's graded. Diagnosed answer is
 * server-side. Every panel collapses so the candidate can focus.
 */
export function IncidentWorkbench({
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
  const incident = item.incident!;
  const notesKey = `fieldnotes_incident_notes_${item.id}`;

  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [thinking, setThinking] = useState(false);
  const [activeFile, setActiveFile] = useState(incident.artifacts[0]?.name ?? "");
  const [tool, setTool] = useState<"sql" | "python">(incident.sql ? "sql" : "python");
  const [scratch, setScratch] = useState("");
  const [sqlRes, setSqlRes] = useState<QueryResult | null>(null);
  const [pyRes, setPyRes] = useState<RunResult | null>(null);
  const [running, setRunning] = useState(false);
  const [pane, setPane] = useState<"both" | "files" | "console">("both");
  const [rootCause, setRootCause] = useState("");
  const [fix, setFix] = useState("");
  const [notes, setNotes] = useState("");
  const [notesOpen, setNotesOpen] = useState(false);
  const [steps, setSteps] = useState<string[]>([]);
  const [stepsOpen, setStepsOpen] = useState(true);
  const [grade, setGrade] = useState<Grade | null>(null);
  const [grading, setGrading] = useState(false);
  const [modelAnswer, setModelAnswer] = useState<string | null>(null);
  const [showModel, setShowModel] = useState(false);
  const [revealedHints, setRevealedHints] = useState(0);
  const [gateOpen, setGateOpen] = useState(!approachGateEnabled(item));
  const limits = usePracticeLimits(practicePro);
  const { recordPracticeSolve } = useProgress();
  const greeted = useRef(false);

  const active = incident.artifacts.find((a) => a.name === activeFile) ?? incident.artifacts[0];
  const hasSql = !!incident.sql;
  const hasPy = !!incident.python;

  // Auto activity trail — "what I did", so the candidate (and grader) can trace the investigation.
  function logStep(s: string) {
    setSteps((p) => (p[p.length - 1] === s ? p : [...p, s]));
  }
  function selectFile(name: string) {
    setActiveFile(name);
    logStep(`Opened ${name}`);
  }

  // Load + autosave notes locally (survives reload + file switching).
  useEffect(() => { try { setNotes(localStorage.getItem(notesKey) ?? ""); } catch {} }, [notesKey]);
  useEffect(() => { try { localStorage.setItem(notesKey, notes); } catch {} }, [notesKey, notes]);

  const ctx = {
    title: item.title,
    level: item.level,
    prompt: incident.brief,
    schemaNote: `incident · ${incident.tier}`,
    hint: item.hints[0] ?? "",
  };

  async function ask(history: ChatMsg[]): Promise<string> {
    setThinking(true);
    try {
      const res = await fetch("/api/practice/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ problemId: item.id, problem: ctx, messages: history }) });
      return (await res.json()).reply || "(no reply)";
    } catch {
      return "(coach offline — keep investigating.)";
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

  async function gateProbe(approach: string): Promise<string> {
    greeted.current = true;
    // Skipped the plan (empty) — don't praise a non-existent approach; open neutrally.
    if (!approach.trim()) {
      const r = "Jumping straight in — that's allowed, but I'll ask what you're checking as you go. What's the first thing you'll look at?";
      setMessages([{ role: "assistant", content: r }]);
      return r;
    }
    const next: ChatMsg[] = [{ role: "user", content: `My debugging plan: ${approach}` }];
    setMessages(next);
    const r = await ask(next);
    setMessages((m) => [...m, { role: "assistant", content: r }]);
    return r;
  }

  function onSend(text: string) {
    if (!limits.useAsk()) { onUpgrade(); return; }
    const next: ChatMsg[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    ask(next).then((r) => setMessages((m) => [...m, { role: "assistant", content: r }]));
  }

  function onHint() {
    if (revealedHints >= item.hints.length) return;
    setMessages((m) => [...m, { role: "assistant", content: `💡 ${item.hints[revealedHints]}` }]);
    setRevealedHints((n) => n + 1);
  }

  async function runScratch() {
    setRunning(true);
    const q = scratch.trim().replace(/\s+/g, " ").slice(0, 70);
    try {
      if (tool === "sql" && incident.sql) {
        const r = await runQuery(incident.sql.setupSql, scratch);
        setSqlRes(r); setPyRes(null);
        logStep(r.error ? `Ran SQL "${q}" → error` : `Ran SQL "${q}" → ${r.rows.length} row${r.rows.length === 1 ? "" : "s"}`);
      } else {
        const r = await runPython(scratch);
        setPyRes(r); setSqlRes(null);
        logStep(r.error ? `Ran Python "${q}" → error` : `Ran Python "${q}" → output`);
      }
    } finally {
      setRunning(false);
    }
  }

  async function onReveal() {
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

  async function onSubmit() {
    if (!limits.useSubmit()) { onUpgrade(); return; }
    if (!rootCause.trim() || !fix.trim()) return;
    setGrading(true);
    const answer = [
      `Root cause:\n${rootCause.trim()}`,
      `\nFix:\n${fix.trim()}`,
      steps.length ? `\nInvestigation steps taken:\n${steps.map((s, i) => `${i + 1}. ${s}`).join("\n")}` : "",
      notes.trim() ? `\nInvestigation notes:\n${notes.trim()}` : "",
    ].join("\n");
    try {
      const res = await fetch("/api/practice/grade", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ problemId: item.id, item: { title: item.title, category: "incident", level: item.level, prompt: item.prompt, idealAnswer: "", rubric: item.rubric, mode: "text" }, answer }),
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

  const badge = TIER_BADGE[incident.tier];
  const fileEntries: FileEntry[] = incident.artifacts.map((a) => ({ name: a.name, group: KIND_GROUP[a.kind] ?? "Files" }));

  const question = (
    <div className="space-y-4">
      <div>
        <div className="flex items-center gap-2">
          <span className="grid h-5 w-5 place-items-center rounded-full border border-danger text-[11px] font-bold text-danger">!</span>
          <span className="text-xs font-semibold uppercase tracking-wider text-muted">Incident</span>
          <span className={cn("ml-auto rounded-full border px-2 py-0.5 text-[10px] font-semibold", badge.cls)}>{badge.label}</span>
        </div>
        {incident.severity && <div className="mt-2 text-[11px] font-semibold uppercase tracking-wider text-danger">{incident.severity}</div>}
        <div className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-fg">{incident.brief}</div>
      </div>

      {/* War-room notes pad (autosaved locally; included in the graded submission) */}
      <div className="rounded-xl border border-border">
        <button onClick={() => setNotesOpen((v) => !v)} className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-semibold text-fg">
          📝 Notes <span className="text-muted">{notesOpen ? "▾" : "▸"}</span>
          {notes.trim() && <span className="ml-auto rounded-full bg-amber/20 px-1.5 text-[10px] font-semibold text-amber">saved</span>}
        </button>
        {notesOpen && (
          <div className="px-3 pb-2">
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Jot findings, queries you ran, hypotheses… (autosaved, fed to the grader)"
              className="h-28 w-full resize-none rounded border border-border bg-surface p-2 font-mono text-[11px] text-fg focus:outline-none focus:ring-1 focus:ring-navy dark:focus:ring-accent" />
            {notes.trim() && <button onClick={() => setNotes("")} className="mt-1 text-[10px] text-danger hover:underline">Clear notes</button>}
          </div>
        )}
      </div>

      {/* Steps taken — auto activity trail so the candidate can trace what they did */}
      <div className="rounded-xl border border-border">
        <button onClick={() => setStepsOpen((v) => !v)} className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-semibold text-fg">
          🧭 Steps taken <span className="text-muted">{stepsOpen ? "▾" : "▸"}</span>
          <span className="ml-auto rounded-full bg-surface px-1.5 text-[10px] font-semibold text-muted">{steps.length}</span>
        </button>
        {stepsOpen && (
          <div className="px-3 pb-2">
            {steps.length === 0 ? (
              <p className="text-[11px] text-muted">Your actions log here automatically — open a file, run a query — so you can trace your investigation (and it's sent to the grader).</p>
            ) : (
              <ol className="space-y-0.5 text-[11px] text-fg">
                {steps.map((s, i) => <li key={i} className="flex gap-1.5"><span className="text-muted">{i + 1}.</span><span className="font-mono">{s}</span></li>)}
              </ol>
            )}
            {steps.length > 0 && <button onClick={() => setSteps([])} className="mt-1 text-[10px] text-danger hover:underline">Clear steps</button>}
          </div>
        )}
      </div>

      {showModel && modelAnswer && (
        <div className="overflow-hidden rounded-xl border border-amber/30 bg-amber/5">
          <div className="border-b border-amber/20 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-amber">Model post-mortem</div>
          <div className="whitespace-pre-wrap p-4 text-xs text-fg">{modelAnswer}</div>
        </div>
      )}

      {/* Diagnosis */}
      <div className="space-y-2 rounded-xl border border-border bg-surface/40 p-3">
        <div className="text-xs font-semibold uppercase tracking-wider text-muted">Your diagnosis</div>
        <textarea value={rootCause} onChange={(e) => setRootCause(e.target.value)} placeholder="Root cause — what actually went wrong (and how you confirmed it)?"
          className="h-24 w-full resize-none rounded border border-border bg-card p-2 text-xs text-fg focus:outline-none focus:ring-1 focus:ring-navy dark:focus:ring-accent" />
        <textarea value={fix} onChange={(e) => setFix(e.target.value)} placeholder="Fix — mitigation, root-cause fix, and prevention."
          className="h-24 w-full resize-none rounded border border-border bg-card p-2 text-xs text-fg focus:outline-none focus:ring-1 focus:ring-navy dark:focus:ring-accent" />
        <button onClick={onSubmit} disabled={grading || !rootCause.trim() || !fix.trim()} className="w-full rounded-full bg-navy px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 dark:bg-accent dark:text-accent-fg">
          {grading ? "Grading…" : "Submit diagnosis"}
        </button>
        {!practicePro && <p className="text-center text-[10px] text-muted">{limits.submitsLeft} submits left today</p>}
        {grade && (
          <div className={cn("rounded-lg border px-3 py-2 text-sm", grade.score >= 70 ? "border-success/30 bg-success/10" : "border-warning/30 bg-warning/10")}>
            <div className="font-semibold text-fg">{grade.source === "ai" ? `Score ${grade.score}/100` : "Self-assess"} — {grade.verdict}</div>
            {grade.gaps?.length > 0 && <ul className="mt-1 list-disc pl-5 text-xs text-muted">{grade.gaps.map((g, i) => <li key={i}>{g}</li>)}</ul>}
          </div>
        )}
      </div>
    </div>
  );

  const viewer = (
    <div className="h-full">
      {active && (active.kind === "log" || active.kind === "config" ? (
        <div className="flex h-full flex-col overflow-hidden rounded-xl border border-border bg-card">
          <div className="border-b border-border px-3 py-1.5 font-mono text-[11px] text-muted">{active.name}</div>
          <pre className="min-h-0 flex-1 overflow-auto whitespace-pre-wrap p-3 font-mono text-xs text-fg scroll-thin">{active.content}</pre>
        </div>
      ) : (
        <CodeReviewPanel
          key={active.name}
          code={active.content}
          language={active.language}
          annotations={[]}
          onComment={() => {}}
          onReply={() => {}}
          onClearAll={() => {}}
          disabled
        />
      ))}
    </div>
  );

  const consolePane = (
    <div className="flex h-full flex-col gap-2">
      <div className="flex min-h-0 flex-[2] flex-col overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex items-center gap-2 border-b border-border px-3 py-1.5">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted">Investigate</span>
          {hasSql && hasPy && (
            <div className="flex gap-1">
              <button onClick={() => setTool("sql")} className={cn("rounded px-2 py-0.5 text-[11px] font-semibold", tool === "sql" ? "bg-navy text-white dark:bg-accent dark:text-accent-fg" : "text-muted hover:bg-surface")}>SQL</button>
              <button onClick={() => setTool("python")} className={cn("rounded px-2 py-0.5 text-[11px] font-semibold", tool === "python" ? "bg-navy text-white dark:bg-accent dark:text-accent-fg" : "text-muted hover:bg-surface")}>Python</button>
            </div>
          )}
          {incident.sql && tool === "sql" && <span className="ml-auto font-mono text-[10px] text-muted">tables: {incident.sql.tables.join(", ")}</span>}
        </div>
        <div className="min-h-0 flex-1"><CodeEditor value={scratch} onChange={setScratch} language={tool === "sql" ? "sql" : "python"} onRun={runScratch} /></div>
        <div className="border-t border-border p-2">
          <button onClick={runScratch} disabled={running} className="rounded-full bg-navy px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-50 dark:bg-accent dark:text-accent-fg">{running ? "Running…" : `Run ${tool === "sql" ? "query" : "Python"}`}</button>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-auto scroll-thin">
        {sqlRes && <ResultsTable title="Query result" result={sqlRes} />}
        {pyRes && <div className={cn("overflow-hidden rounded-xl border", pyRes.error ? "border-danger/30 bg-danger/5" : "border-border bg-card")}><pre className="max-h-48 overflow-auto whitespace-pre-wrap p-3 font-mono text-xs scroll-thin" >{pyRes.error ? pyRes.error : pyRes.output || "(ran — no output)"}</pre></div>}
        {!sqlRes && !pyRes && <div className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted">Run a {hasSql ? "query" : "snippet"} to investigate the data.</div>}
      </div>
    </div>
  );

  const hasConsole = hasSql || hasPy;
  const codePane = gateOpen ? (
    <div className="flex h-full flex-col gap-1 p-2">
      {hasConsole && (
        <div className="flex items-center gap-1 text-[11px]">
          <span className="text-muted">View:</span>
          {(["both", "files", "console"] as const).map((p) => (
            <button key={p} onClick={() => setPane(p)} className={cn("rounded px-2 py-0.5 font-medium", pane === p ? "bg-navy text-white dark:bg-accent dark:text-accent-fg" : "text-muted hover:bg-surface")}>
              {p === "both" ? "Files + Console" : p === "files" ? "Files only" : "Console only"}
            </button>
          ))}
        </div>
      )}
      <div className="flex min-h-0 flex-1 gap-2">
        {pane !== "console" && <FileTree entries={fileEntries} active={activeFile} onSelect={selectFile} groupBy="group" title="Artifacts" />}
        <div className="flex min-h-0 flex-1 flex-col gap-2">
          {pane !== "console" && <div className={cn("min-h-0", pane === "both" && hasConsole ? "flex-[3]" : "flex-1")}>{viewer}</div>}
          {hasConsole && pane !== "files" && <div className={cn("min-h-0", pane === "both" ? "flex-[2]" : "flex-1")}>{consolePane}</div>}
        </div>
      </div>
    </div>
  ) : (
    <ApproachGate
      kind="solve"
      onVerdict={(a) => fetch("/api/practice/approach-verdict", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ problemId: item.id, approach: a }) }).then((r) => r.json())}
      onProbe={gateProbe}
      onUnlock={() => setGateOpen(true)}
    />
  );

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
      onSend={onSend}
      onHint={onHint}
      hintsLeft={item.hints.length - revealedHints}
      onReveal={onReveal}
      question={question}
      code={codePane}
    />
  );
}
