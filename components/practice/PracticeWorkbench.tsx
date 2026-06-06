"use client";

import { useState, useEffect } from "react";
import type { PracticeProblem } from "@/lib/data/practice";
import { runQuery, type QueryResult, type CheckResult } from "./duckdb";
import { ResultsTable } from "./ResultsTable";
import { WorkbenchFrame, type ChatMsg } from "./WorkbenchFrame";
import { CodeEditor, type EditorSchema, type SqlDialect } from "./CodeEditor";
import { VerticalSplit } from "./VerticalSplit";
import { WinModal } from "./WinModal";
import { ToolBtn } from "./ToolBtn";
import { ApproachGate, approachGateEnabled } from "./ApproachGate";
import { usePracticeLimits } from "@/lib/practice-limits";
import { useProgress } from "@/components/providers/progress-provider";
import { cn } from "@/lib/utils";

/** Parse "orders(id, customer_id, amount)" → tables + columns for editor completions. */
function parseSchema(schemaNote: string): EditorSchema {
  const re = /([A-Za-z_][A-Za-z0-9_]*)\s*\(([^)]*)\)/g;
  const tables: EditorSchema["tables"] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(schemaNote)) !== null) {
    tables.push({ name: m[1], columns: m[2].split(",").map((c) => c.trim()).filter(Boolean) });
  }
  return { tables };
}
function tableNames(schemaNote: string): string[] {
  return parseSchema(schemaNote).tables.map((t) => t.name);
}

/** Mirror of the /api/practice/grade-sql `hidden` field (lib/practice/adversarial-grade.ts). */
type HiddenOutcome =
  | { status: "none" }
  | { status: "pass" }
  | { status: "locked"; name: string; failedCount: number }
  | { status: "fail"; name: string; explanation: string; yourRows: unknown[][]; expectedRows: unknown[][]; columns: string[] };

interface HiddenResponse {
  isPro: boolean;
  sample: { correct: boolean; error: string | null; columns: string[]; rows: unknown[][]; expectedRows: unknown[][] };
  hidden: HiddenOutcome;
}

const DIALECTS: { slug: SqlDialect; label: string }[] = [
  { slug: "duckdb", label: "DuckDB" },
  { slug: "postgresql", label: "PostgreSQL" },
  { slug: "mysql", label: "MySQL" },
  { slug: "sqlite", label: "SQLite" },
  { slug: "snowflake", label: "Snowflake" },
  { slug: "databricks", label: "Databricks / Spark SQL" },
  { slug: "tsql", label: "T-SQL (SQL Server)" },
];

export function SqlWorkbench({
  problem,
  hasAi,
  practicePro,
  onUpgrade,
  onBack,
}: {
  problem: PracticeProblem;
  hasAi: boolean;
  practicePro: boolean;
  onUpgrade: () => void;
  onBack: () => void;
}) {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [thinking, setThinking] = useState(false);
  const [sql, setSql] = useState(problem.starter);
  const [result, setResult] = useState<QueryResult | null>(null);
  const [check, setCheck] = useState<CheckResult | null>(null);
  const [running, setRunning] = useState(false);
  const [showExpected, setShowExpected] = useState(false);
  const [showReference, setShowReference] = useState(false);
  const [revealedHints, setRevealedHints] = useState(0);
  const [dataTables, setDataTables] = useState<{ name: string; result: QueryResult }[]>([]);
  const [sampleOn, setSampleOn] = useState(false);
  const [sampleOut, setSampleOut] = useState<QueryResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [win, setWin] = useState(false);
  const [solved, setSolved] = useState(false);
  const [dialect, setDialect] = useState<SqlDialect>("duckdb");
  const [dataOpen, setDataOpen] = useState(true);
  const [hidden, setHidden] = useState<HiddenOutcome | null>(null);
  const [hiddenLoading, setHiddenLoading] = useState(false);
  const [referenceSql, setReferenceSql] = useState<string | null>(null);
  const [gateOpen, setGateOpen] = useState(!approachGateEnabled(problem));
  const limits = usePracticeLimits(practicePro);
  const { recordPracticeSolve } = useProgress();
  const schema = parseSchema(problem.schemaNote);

  // The reference answer is NOT included — the chat route looks it up server-side by problemId.
  const ctx = {
    title: problem.title,
    level: problem.level,
    prompt: problem.prompt,
    schemaNote: problem.schemaNote,
    hint: problem.hints[0] ?? "",
  };

  async function askInterviewer(history: ChatMsg[], lastRun?: { sql: string; correct: boolean | null; error?: string }) {
    setThinking(true);
    try {
      const res = await fetch("/api/practice/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ problemId: problem.id, problem: ctx, messages: history.map((m) => ({ role: m.role, content: m.content })), lastRun }),
      });
      const data = await res.json();
      setMessages((m) => [...m, { role: "assistant", content: data.reply }]);
    } catch {
      setMessages((m) => [...m, { role: "assistant", content: "(coach offline — run your query when ready.)" }]);
    } finally {
      setThinking(false);
    }
  }

  useEffect(() => {
    if (gateOpen && messages.length === 0) askInterviewer([]);
    (async () => {
      const out: { name: string; result: QueryResult }[] = [];
      for (const n of tableNames(problem.schemaNote)) out.push({ name: n, result: await runQuery(problem.setupSql, `SELECT * FROM ${n} LIMIT 50`) });
      setDataTables(out);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gateOpen]);

  // The approach gate's probe seeds the coach thread (no extra AI call vs. the greeting).
  async function gateProbe(approach: string): Promise<string> {
    const next: ChatMsg[] = [{ role: "user", content: `My approach: ${approach}` }];
    setMessages(next);
    setThinking(true);
    try {
      const res = await fetch("/api/practice/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ problemId: problem.id, problem: ctx, messages: next }) });
      const reply = (await res.json()).reply || "Sounds reasonable — let's see the query.";
      setMessages((m) => [...m, { role: "assistant", content: reply }]);
      return reply;
    } catch {
      const reply = "Couldn't reach the coach — go ahead and write it.";
      setMessages((m) => [...m, { role: "assistant", content: reply }]);
      return reply;
    } finally {
      setThinking(false);
    }
  }

  async function toggleSample() {
    const next = !sampleOn;
    setSampleOn(next);
    if (next && !sampleOut) {
      // Expected output comes from the server (reference runs server-side); the
      // expected OUTPUT is shown to users, but the reference SQL never ships.
      try {
        const res = await fetch("/api/practice/expected", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ problemId: problem.id }),
        });
        const data = await res.json();
        setSampleOut(res.ok ? { columns: data.columns, rows: data.rows } : { columns: [], rows: [], error: "Could not load expected output." });
      } catch {
        setSampleOut({ columns: [], rows: [], error: "Could not load expected output." });
      }
    }
  }

  // user-initiated chat (counts against the free AI quota)
  function onSend(text: string) {
    if (!limits.useAsk()) { onUpgrade(); return; }
    const next = [...messages, { role: "user" as const, content: text }];
    setMessages(next);
    askInterviewer(next);
  }
  function askAboutCode() {
    if (!limits.useAsk()) { onUpgrade(); return; }
    // Give the coach the full picture: the task, the code, and the latest result.
    let state = "";
    if (check?.error) state = ` It errored: ${check.error}.`;
    else if (check && check.correct === false) state = ` The checker says it's not a match yet (check columns, values and row order).`;
    else if (result?.error) state = ` It errored: ${result.error}.`;
    const text = `On "${problem.prompt}" — here's my query, what am I missing?${state}\n\`\`\`sql\n${sql || "(empty)"}\n\`\`\``;
    const next = [...messages, { role: "user" as const, content: text }];
    setMessages(next);
    askInterviewer(next, { sql, correct: check ? (check.error ? null : check.correct) : null, error: check?.error || result?.error });
  }
  function onHint() {
    if (revealedHints >= problem.hints.length) return;
    const h = problem.hints[revealedHints];
    setRevealedHints((n) => n + 1);
    setMessages((m) => [...m, { role: "assistant", content: `💡 ${h}` }]);
  }
  async function onRevealGated() {
    if (!practicePro) { onUpgrade(); return; }
    if (!referenceSql) {
      // The answer key is fetched from the server only after the Pro check —
      // it is never present in the page bundle.
      try {
        const res = await fetch("/api/practice/solution", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ problemId: problem.id }),
        });
        if (!res.ok) { onUpgrade(); return; }
        const data = await res.json();
        setReferenceSql(data.referenceSolution ?? null);
      } catch {
        return;
      }
    }
    setShowReference(true);
  }
  function copyCode() {
    navigator.clipboard?.writeText(sql).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1200); }).catch(() => {});
  }

  async function onRun() {
    setRunning(true);
    setCheck(null);
    setShowExpected(false);
    setHidden(null);
    setResult(await runQuery(problem.setupSql, sql));
    setRunning(false);
  }

  /**
   * Adversarial grading: the server runs this query against a hidden dataset
   * engineered to break the common mistake. Free users get a locked teaser; Pro
   * users get the failing rows + why. The hidden data never reaches the client.
   */
  async function onRunHidden() {
    setHiddenLoading(true);
    setHidden(null);
    try {
      const res = await fetch("/api/practice/grade-sql", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ problemId: problem.id, userSql: sql }),
      });
      const data: HiddenResponse = await res.json();
      setHidden(data.hidden ?? null);
    } catch {
      setHidden(null);
    } finally {
      setHiddenLoading(false);
    }
  }
  async function onSubmit() {
    if (!limits.useSubmit()) { onUpgrade(); return; }
    setRunning(true);
    setHidden(null);
    // Graded server-side: the reference solution + expected output never reach
    // the browser, so the answer can't be read from the page.
    let c: CheckResult;
    try {
      const res = await fetch("/api/practice/grade-sql", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ problemId: problem.id, userSql: sql }),
      });
      if (res.status === 429) {
        c = { columns: [], rows: [], correct: false, message: "Too many submissions — slow down a moment." };
      } else {
        const s = (await res.json()).sample;
        c = {
          columns: s.columns ?? [],
          rows: s.rows ?? [],
          error: s.error ?? undefined,
          correct: s.correct,
          expected: { columns: s.expectedColumns ?? [], rows: s.expectedRows ?? [] },
          message: s.error
            ? "Your query errored."
            : s.correct
              ? "Correct — your result matches the expected output."
              : problem.orderMatters
                ? "Not a match yet — check the values AND the row order."
                : "Not a match yet — the set of rows differs from expected.",
        };
      }
    } catch {
      c = { columns: [], rows: [], correct: false, message: "Couldn't reach the grader — try again." };
    }
    setResult({ columns: c.columns, rows: c.rows, error: c.error });
    setCheck(c);
    setRunning(false);
    if (c.correct && !solved) { setSolved(true); setWin(true); recordPracticeSolve(problem.category, problem.id); }
  }
  function onEditorKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); onRun(); }
    if (e.key === "Tab") {
      e.preventDefault();
      const t = e.currentTarget;
      const s = t.selectionStart;
      const v = t.value;
      setSql(v.slice(0, s) + "  " + v.slice(t.selectionEnd));
      requestAnimationFrame(() => { t.selectionStart = t.selectionEnd = s + 2; });
    }
  }

  const question = (
    <div className="space-y-4">
      <div>
        <div className="flex items-center gap-2">
          <span className="grid h-5 w-5 place-items-center rounded-full border border-amber text-[11px] font-bold text-amber">1</span>
          <span className="text-xs font-semibold uppercase tracking-wider text-muted">Question</span>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-fg">{problem.prompt}</p>
        <p className="mt-3 text-xs font-semibold uppercase tracking-wider text-muted">Tables</p>
        <p className="font-mono text-xs text-fg">{problem.schemaNote}</p>
      </div>
      <div>
        <button onClick={() => setDataOpen((o) => !o)} className="mb-2 flex w-full items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted hover:text-fg">
          <svg viewBox="0 0 16 16" className={cn("h-3 w-3 transition-transform", dataOpen ? "rotate-90" : "")} fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" /></svg>
          Data{dataTables.length > 0 ? ` · ${dataTables.length} ${dataTables.length === 1 ? "table" : "tables"}` : ""}
        </button>
        {dataOpen && (
          <div className="space-y-3">
            {dataTables.length === 0 ? <p className="text-xs text-muted">Loading data…</p> : dataTables.map((t) => <ResultsTable key={t.name} title={t.name} result={t.result} />)}
          </div>
        )}
      </div>
      <div className="rounded-xl border border-border p-3">
        <label className="flex items-center justify-between gap-2 text-sm">
          <span className="font-medium text-fg">Sample input &amp; output</span>
          <button onClick={toggleSample} role="switch" aria-checked={sampleOn} className={cn("relative h-5 w-9 rounded-full transition-colors", sampleOn ? "bg-navy dark:bg-accent" : "bg-border")}>
            <span className={cn("absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all", sampleOn ? "left-[18px]" : "left-0.5")} />
          </button>
        </label>
        {sampleOn ? (sampleOut ? <div className="mt-3"><ResultsTable title="Expected output" result={sampleOut} tone="expected" /></div> : <p className="mt-3 text-xs text-muted">Computing…</p>) : <p className="mt-2 text-xs text-muted">Off — flip on to reveal the expected result.</p>}
      </div>
    </div>
  );

  const editor = (
    <div className="flex h-full flex-col p-3">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex items-center gap-2 border-b border-border px-3 py-1.5">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted">SQL</span>
          <select
            value={dialect}
            onChange={(e) => setDialect(e.target.value as SqlDialect)}
            title={dialect === "duckdb" ? "Runs on DuckDB" : "Editor syntax + autocomplete only — queries execute on DuckDB (Postgres-compatible)"}
            className="rounded-md border border-border bg-surface px-2 py-0.5 text-xs font-medium text-fg focus:outline-none"
          >
            {DIALECTS.map((d) => <option key={d.slug} value={d.slug}>{d.label}</option>)}
          </select>
          {dialect !== "duckdb" && <span className="hidden text-[10px] text-muted lg:inline">runs on DuckDB</span>}
          <div className="ml-auto flex items-center gap-1">
            <ToolBtn label={copied ? "Copied" : "Copy"} onClick={copyCode} icon="copy" />
            <ToolBtn label="Ask AI" onClick={askAboutCode} icon="ai" />
            <ToolBtn label="Hint" onClick={onHint} icon="hint" disabled={revealedHints >= problem.hints.length} />
          </div>
        </div>
        <div className="min-h-0 flex-1"><CodeEditor value={sql} onChange={setSql} language="sql" onRun={onRun} schema={schema} dialect={dialect} /></div>
        <div className="flex items-center gap-2 border-t border-border p-2.5">
          <button onClick={onRun} disabled={running} className="rounded-full border border-border bg-surface px-5 py-2 text-sm font-semibold text-fg hover:bg-card disabled:opacity-50">{running ? "Running…" : "Run"}</button>
          <button onClick={onSubmit} disabled={running} className="rounded-full bg-navy px-5 py-2 text-sm font-semibold text-white disabled:opacity-50 dark:bg-accent dark:text-accent-fg">Submit &amp; evaluate</button>
          <button onClick={onRunHidden} disabled={running || hiddenLoading} title="Run your query against hidden edge-case data engineered to break common mistakes" className="rounded-full border border-amber/40 bg-amber/5 px-4 py-2 text-sm font-semibold text-amber hover:bg-amber/10 disabled:opacity-50">{hiddenLoading ? "Testing…" : practicePro ? "Run hidden tests" : "Run hidden tests 🔒"}</button>
          {!practicePro && <span className="ml-auto text-[11px] text-muted">{limits.submitsLeft} submits left today</span>}
        </div>
      </div>
    </div>
  );

  const results = (
    <div className="space-y-3 p-3">
      {check && (
        <div className={cn("rounded-xl border px-4 py-3 text-sm font-medium", check.error ? "border-danger/30 bg-danger/10 text-danger" : check.correct ? "border-success/30 bg-success/10 text-success" : "border-warning/30 bg-warning/10 text-warning")}>
          {check.correct ? "✓ " : "✗ "}{check.message}
          {!check.correct && !check.error && check.expected && <button onClick={() => setShowExpected((s) => !s)} className="ml-2 underline">{showExpected ? "hide expected" : "show expected output"}</button>}
        </div>
      )}
      {result ? <ResultsTable title={result.error ? "Error" : "Your result"} result={result} /> : <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted">Run a query to see results</div>}
      {showExpected && check?.expected && <ResultsTable title="Expected output" result={{ columns: check.expected.columns, rows: check.expected.rows }} tone="expected" />}
      {showReference && (
        <div className="overflow-hidden rounded-xl border border-amber/30 bg-amber/5">
          <div className="border-b border-amber/20 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-amber">Reference solution</div>
          <pre className="overflow-x-auto p-4 font-mono text-xs text-fg scroll-thin">{referenceSql ?? ""}</pre>
        </div>
      )}

      {hiddenLoading && (
        <div className="rounded-xl border border-amber/30 bg-amber/5 px-4 py-3 text-sm text-amber">Running hidden edge-case suite…</div>
      )}
      {hidden?.status === "none" && (
        <div className="rounded-xl border border-dashed border-border px-4 py-3 text-sm text-muted">No hidden edge-case tests for this question yet.</div>
      )}
      {hidden?.status === "pass" && (
        <div className="rounded-xl border border-success/30 bg-success/10 px-4 py-3 text-sm font-medium text-success">✓ Passed all hidden edge cases — your solution is robust.</div>
      )}
      {hidden?.status === "locked" && (
        <div className="overflow-hidden rounded-xl border border-amber/40 bg-amber/5">
          <div className="border-b border-amber/20 px-4 py-2 text-sm font-semibold text-amber">✗ Failed a hidden edge case: “{hidden.name}”</div>
          <div className="relative">
            <div className="space-y-2 p-4 blur-sm select-none" aria-hidden>
              <div className="h-4 w-2/3 rounded bg-fg/15" />
              <div className="h-4 w-1/2 rounded bg-fg/15" />
              <div className="h-4 w-3/4 rounded bg-fg/15" />
            </div>
            <div className="absolute inset-0 grid place-items-center bg-card/50 px-4 backdrop-blur-[1px]">
              <div className="text-center">
                <p className="text-sm font-medium text-fg">Your query looks right — but it breaks on a hidden case.</p>
                <p className="mt-1 text-xs text-muted">Unlock the failing rows and a fix explanation with Practice Pro.</p>
                <button onClick={onUpgrade} className="mt-3 rounded-full bg-navy px-4 py-1.5 text-sm font-semibold text-white dark:bg-accent dark:text-accent-fg">Unlock with Pro →</button>
              </div>
            </div>
          </div>
        </div>
      )}
      {hidden?.status === "fail" && (
        <div className="space-y-3">
          <div className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm font-medium text-danger">✗ Failed a hidden edge case: “{hidden.name}”</div>
          <p className="text-sm leading-relaxed text-fg">{hidden.explanation}</p>
          <ResultsTable title="Your output on hidden data" result={{ columns: hidden.columns, rows: hidden.yourRows }} />
          <ResultsTable title="Expected" result={{ columns: hidden.columns, rows: hidden.expectedRows }} tone="expected" />
        </div>
      )}
    </div>
  );

  return (
    <>
      <WorkbenchFrame
        title={problem.title} company={problem.company} difficulty={problem.difficulty} level={problem.level}
        onBack={onBack} hasAi={hasAi}
        messages={messages} thinking={thinking} onSend={onSend}
        onHint={onHint} hintsLeft={problem.hints.length - revealedHints} onReveal={onRevealGated}
        question={question}
        code={gateOpen
          ? <VerticalSplit top={editor} bottom={results} bottomLabel="Results" />
          : <ApproachGate
              kind="solve"
              onVerdict={(a) => fetch("/api/practice/approach-verdict", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ problemId: problem.id, approach: a }) }).then((r) => r.json())}
              onProbe={gateProbe}
              onUnlock={() => setGateOpen(true)}
            />}
      />
      <WinModal open={win} onClose={() => setWin(false)} practicePro={practicePro} onUpgrade={() => { setWin(false); onUpgrade(); }} />
    </>
  );
}
