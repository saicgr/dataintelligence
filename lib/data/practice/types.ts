import type { Level } from "../../types";

export type PracticeCategory =
  | "sql"
  | "python"
  | "pyspark"
  | "ai"
  | "prompting"
  | "codereview"
  | "casestudy"
  | "systemdesign"
  | "dba"
  | "behavioral"
  | "datascience"
  | "databricks-admin"
  | "snowflake-admin"
  | "aireview"
  // AI-engineering tracks
  | "rag"
  | "agents"
  | "llmops"
  | "claude"
  | "promptlab"
  // engineering tracks
  | "typescript"
  | "basics"
  // multi-file PR review
  | "pr"
  // production incident debugging (investigate with SQL/Python, diagnose root cause + fix)
  | "incident";

/** Tab groups for the practice browser (keeps ~22 categories navigable). */
export type CategoryGroup = "core" | "ai" | "review" | "design" | "admin";

export const PRACTICE_CATEGORIES: {
  slug: PracticeCategory;
  name: string;
  blurb: string;
  executes: boolean;
  group: CategoryGroup;
}[] = [
  { slug: "sql", name: "SQL", blurb: "Write real SQL — runs in your browser, graded on correctness.", executes: true, group: "core" },
  { slug: "python", name: "Python", blurb: "Data-wrangling & complexity problems, coached by the AI interviewer.", executes: false, group: "core" },
  { slug: "pyspark", name: "PySpark", blurb: "Distributed transforms, joins & skew — runs on the Spark runner.", executes: false, group: "core" },
  { slug: "typescript", name: "TypeScript", blurb: "Type-safety, async pitfalls & API contracts — practice and review.", executes: false, group: "core" },
  { slug: "dba", name: "DBA", blurb: "Indexing, query plans, replication, locking, tuning & recovery.", executes: false, group: "core" },
  { slug: "datascience", name: "Data Science / ML", blurb: "Stats, A/B testing, ML system design & model eval.", executes: false, group: "core" },
  { slug: "basics", name: "Basics", blurb: "Teach it back — 'what is Snowflake / git / a vector DB?' Explain to learn.", executes: false, group: "core" },
  { slug: "ai", name: "AI Engineering", blurb: "RAG, LLM, agents & eval design questions.", executes: false, group: "ai" },
  { slug: "rag", name: "RAG Pipelines", blurb: "Chunking, retrieval, reranking & hallucination root-cause — the ~95% AI question.", executes: false, group: "ai" },
  { slug: "agents", name: "AI Agents & MCP", blurb: "Tool/function calling, agentic loops, MCP & framework trade-offs.", executes: false, group: "ai" },
  { slug: "llmops", name: "LLM Eval & Ops", blurb: "Evals, LLM-as-judge bias, observability, guardrails, FinOps & red-teaming.", executes: false, group: "ai" },
  { slug: "prompting", name: "Prompt Engineering", blurb: "Write prompts — run them on Gemini, graded by assertions + a judge.", executes: false, group: "ai" },
  { slug: "promptlab", name: "Prompt Optimization", blurb: "Edit the prompt, run it on a labeled dataset, watch accuracy climb to target.", executes: false, group: "ai" },
  { slug: "claude", name: "Claude Development", blurb: "CLAUDE.md, slash commands, subagents/skills & context engineering.", executes: false, group: "ai" },
  { slug: "codereview", name: "Code Review", blurb: "Spot the bugs, risks & smells in a snippet — like a real PR review.", executes: false, group: "review" },
  { slug: "aireview", name: "AI Review", blurb: "Review prompts, evals & agent traces — the AI-era skills interviews are starting to test.", executes: false, group: "review" },
  { slug: "pr", name: "PR Review", blurb: "Review a multi-file pull request, GitHub-style — comment across files, catch the cross-file bug.", executes: false, group: "review" },
  { slug: "incident", name: "Incident Debugging", blurb: "You're on call — read the files & logs, query the data, find the root cause and the fix.", executes: false, group: "design" },
  { slug: "casestudy", name: "Case Studies", blurb: "Open-ended 'design this' problems — the way real loops go.", executes: false, group: "design" },
  { slug: "systemdesign", name: "System Design", blurb: "Data/AI system design & model serving — drive the trade-offs out loud.", executes: false, group: "design" },
  { slug: "behavioral", name: "Behavioral", blurb: "STAR + leadership rounds — practice out loud with voice.", executes: false, group: "design" },
  { slug: "databricks-admin", name: "Databricks Admin", blurb: "Unity Catalog, clusters, cost, governance & monitoring.", executes: false, group: "admin" },
  { slug: "snowflake-admin", name: "Snowflake Admin", blurb: "Warehouses, RBAC, cost, replication & governance.", executes: false, group: "admin" },
];

interface BaseItem {
  id: string;
  category: PracticeCategory;
  level: Level;
  title: string;
  company: string; // anonymized context
  difficulty: "easy" | "medium" | "hard";
  prompt: string;
  hints: string[];
  free: boolean; // true = available without Practice Pro
  /**
   * "Think before you build" gate. When not explicitly false, the workbench
   * makes the candidate state their approach (1–2 sentences) before the
   * editor/comment pane unlocks — the interviewer probes it once, then opens.
   * Set false to skip (e.g. design-first items where the whole answer IS the approach).
   */
  approachGate?: boolean;
}

/** Languages an artifact under review can be rendered as. */
export type ReviewLang = "python" | "sql" | "typescript" | "text" | "prompt" | "trace" | "eval";

/** SQL items execute in-browser via DuckDB-WASM and are graded on correctness. */
export interface SqlItem extends BaseItem {
  category: "sql";
  executes: true;
  schemaNote: string;
  setupSql: string;
  referenceSolution: string;
  orderMatters: boolean;
  starter: string;
}

/**
 * Conversational items (python/pyspark/ai/casestudy): the candidate writes a
 * code or prose answer; the AI interviewer evaluates it against an ideal answer
 * + rubric (no execution). `mode` controls the editor flavor.
 */
export interface ConvItem extends BaseItem {
  category:
    | "python"
    | "pyspark"
    | "ai"
    | "prompting"
    | "codereview"
    | "casestudy"
    | "systemdesign"
    | "dba"
    | "behavioral"
    | "datascience"
    | "databricks-admin"
    | "snowflake-admin"
    | "aireview"
    | "rag"
    | "agents"
    | "llmops"
    | "claude"
    | "promptlab"
    | "typescript"
    | "basics"
    | "pr"
    | "incident";
  executes: false;
  mode: "code" | "text";
  starter: string;
  idealAnswer: string; // reference for the grader — never shown raw to the user
  rubric: string[]; // what a strong answer must hit
  /**
   * Optional runnable test cases (Python only — executed in-browser via Pyodide).
   * Each `code` is assert-based Python run after the candidate's code; throwing = fail.
   */
  tests?: { name: string; code: string }[];
  /**
   * Optional prompt-evaluation spec (Prompt Engineering): the candidate writes a
   * PROMPT; we run it on Gemini against each input and grade with assertions + a judge.
   */
  promptEval?: PromptEval;
  /**
   * Optional real PySpark execution. The candidate's code must assign a `result`
   * DataFrame; the spark-runner service (local mode) runs it vs the reference and
   * diffs. Falls back to AI-eval when the runner is offline.
   */
  sparkExec?: {
    sampleData: { name: string; columns: string[]; rows: (string | number | null)[][] }[];
    reference: string;
    orderMatters: boolean;
  };
  /**
   * Optional INTERACTIVE review scenario (codereview/aireview). When present, the
   * item renders in ReviewWorkbench: the candidate leaves line-anchored comments
   * and the AI interviewer probes with follow-ups. Only the artifact under review
   * is client-visible here; the planted issues, follow-ups and facts live
   * server-side in review-scenarios.server.ts (resolved by problemId).
   */
  review?: {
    /**
     * Single-file review (codereview/aireview): the code/prompt/eval/trace under
     * review. Exactly one of `code` or `files` is set.
     */
    code?: string;
    /** Syntax-highlight + interviewer-context hint. "trace"/"prompt"/"eval" for AI artifacts. */
    language?: ReviewLang;
    /** Line count of `code` (precomputed so the panel/grader can validate anchors). */
    lineCount?: number;
    /**
     * Multi-file PR review (category "pr"): the interconnected files in the pull
     * request. `baseCode` (the pre-change version) enables added/removed diff coloring.
     * Comments anchor to (file, line); a planted bug may span files.
     */
    files?: { name: string; code: string; language: ReviewLang; baseCode?: string }[];
  };
  /**
   * Optional prompt-OPTIMIZATION exercise (category "promptlab"): the candidate
   * edits a prompt and re-runs it over a labeled dataset, watching accuracy climb
   * toward `target`. Only the INPUT cells ship to the client here — the expected
   * labels + scoring metric live server-side in promptopt-scenarios.server.ts
   * (resolved by problemId) and are never sent to the browser.
   */
  promptOpt?: {
    inputColumns: string[]; // visible input column names
    rows: { input: Record<string, string> }[]; // input cells ONLY — no expected label
    target: number; // accuracy % to beat (e.g. 90)
    placeholder?: string; // token replaced per row; default "{{input}}" (or per-column {{col}})
  };
  /**
   * Optional PRODUCTION-INCIDENT scenario (category "incident"): the candidate is
   * dropped into an incident, reads the artifacts (code/logs/config), investigates
   * by running SQL/Python in-browser, asks the coach, then submits a root-cause +
   * fix that gets graded. Only the brief + artifacts + investigation data are
   * client-visible; the diagnosed root cause / fix / red herrings / rubric live
   * server-side in incidents.server.ts (resolved by problemId) and never ship.
   */
  incident?: {
    brief: string; // the page / symptom the candidate sees
    severity?: string; // e.g. "SEV-1 · customer-facing"
    /** Difficulty band — drives a 🔥/💀 badge and how stingy the coach/grader are. */
    tier: "standard" | "hard" | "hellish";
    /** Read-only artifacts to investigate (rendered in the file explorer). */
    artifacts: { name: string; kind: "code" | "log" | "config" | "query"; language: ReviewLang; content: string }[];
    /** Optional in-browser SQL console: setupSql seeds DuckDB; tables are previewed. */
    sql?: { setupSql: string; tables: string[] };
    /** Optional in-browser Python scratchpad. */
    python?: boolean;
  };
}

export interface PromptAssertion {
  kind: "contains" | "not_contains" | "equals" | "json_valid" | "json_path" | "regex";
  path?: string; // dot path for json_path, e.g. "items.0.amount"
  expected?: string; // substring / exact / pattern / expected value
  label?: string; // human label shown in the UI
}
export interface PromptEvalInput {
  name: string;
  input: string;
  assertions: PromptAssertion[];
}
export interface PromptEval {
  task: string; // what the prompt must accomplish (shown to candidate)
  placeholder?: string; // token replaced with each input (default "{{input}}")
  inputs: PromptEvalInput[];
  judge?: { criteria: string; threshold: number }; // optional LLM-as-judge
}

export type PracticeItem = SqlItem | ConvItem;

/** Back-compat alias: the SQL workbench + DuckDB runner type. */
export type PracticeProblem = SqlItem;
