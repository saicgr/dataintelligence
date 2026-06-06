import type { Level } from "../../types";
import type { PracticeItem, PracticeCategory, ConvItem } from "./types";
import { SQL_ITEMS } from "./sql";
import { SQL_INTERVIEWMASTER_ITEMS } from "./sql-interviewmaster";
import { PYTHON_ITEMS } from "./python";
import { PYSPARK_ITEMS } from "./pyspark";
import { AI_ITEMS } from "./ai";
import { PROMPTING_ITEMS } from "./prompting";
import { CODEREVIEW_ITEMS } from "./codereview";
import { CODEREVIEW_EXTRA_ITEMS } from "./codereview-extra";
import { AIREVIEW_ITEMS } from "./ai-review";
import { CODEREVIEW_REVIEW_ITEMS } from "./codereview-review";
import { REVIEW_CODE } from "./review-code";
import { PR_REVIEW_FILES } from "./pr-review-code";
import { CASESTUDY_ITEMS } from "./casestudy";
import { SYSTEMDESIGN_ITEMS } from "./systemdesign";
import { DBA_ITEMS } from "./dba";
import { BEHAVIORAL_ITEMS } from "./behavioral";
import { DATASCIENCE_ITEMS } from "./datascience";
import { DATABRICKS_ADMIN_ITEMS } from "./databricks-admin";
import { SNOWFLAKE_ADMIN_ITEMS } from "./snowflake-admin";
// AI-engineering + new tracks
import { RAG_ITEMS } from "./rag";
import { AGENTS_ITEMS } from "./agents";
import { LLMOPS_ITEMS } from "./llmops";
import { TYPESCRIPT_ITEMS } from "./typescript";
import { CLAUDE_ITEMS } from "./claude";
import { BASICS_ITEMS } from "./basics";
import { PROMPTLAB_ITEMS } from "./promptlab";
import { PR_ITEMS } from "./pr";
import { RECON_ITEMS } from "./recon";
import { INCIDENT_ITEMS } from "./incident";
import { INCIDENT_DE_ITEMS } from "./incident-de";
import { INCIDENT_AE_ITEMS } from "./incident-ae";
import { INCIDENT_STREAM_ITEMS } from "./incident-stream";
import { INCIDENT_MLE_ITEMS } from "./incident-mle";
import { INCIDENT_AIE_ITEMS } from "./incident-aie";
import { INCIDENT_DBA_ITEMS } from "./incident-dba";
import { INCIDENT_SRE_ITEMS } from "./incident-sre";

export * from "./types";

/** All SQL workbench problems — the hand-authored core plus the Interview-Master set. */
export const ALL_SQL_ITEMS = [...SQL_ITEMS, ...SQL_INTERVIEWMASTER_ITEMS];

export const ALL_ITEMS: PracticeItem[] = [
  ...ALL_SQL_ITEMS,
  ...PYTHON_ITEMS,
  ...PYSPARK_ITEMS,
  ...AI_ITEMS,
  ...PROMPTING_ITEMS,
  ...CODEREVIEW_ITEMS,
  ...CODEREVIEW_EXTRA_ITEMS,
  ...CODEREVIEW_REVIEW_ITEMS,
  ...AIREVIEW_ITEMS,
  ...CASESTUDY_ITEMS,
  ...SYSTEMDESIGN_ITEMS,
  ...DBA_ITEMS,
  ...BEHAVIORAL_ITEMS,
  ...DATASCIENCE_ITEMS,
  ...DATABRICKS_ADMIN_ITEMS,
  ...SNOWFLAKE_ADMIN_ITEMS,
  ...RAG_ITEMS,
  ...AGENTS_ITEMS,
  ...LLMOPS_ITEMS,
  ...TYPESCRIPT_ITEMS,
  ...CLAUDE_ITEMS,
  ...BASICS_ITEMS,
  ...PROMPTLAB_ITEMS,
  ...PR_ITEMS,
  ...RECON_ITEMS,
  ...INCIDENT_ITEMS,
  ...INCIDENT_DE_ITEMS,
  ...INCIDENT_AE_ITEMS,
  ...INCIDENT_STREAM_ITEMS,
  ...INCIDENT_MLE_ITEMS,
  ...INCIDENT_AIE_ITEMS,
  ...INCIDENT_DBA_ITEMS,
  ...INCIDENT_SRE_ITEMS,
];

// Categories whose items can carry a single-file interactive review artifact.
const REVIEW_CATEGORIES = new Set(["codereview", "aireview", "llmops", "typescript"]);

// Attach the interactive review artifact (the code/prompt/trace under review) to
// review-bearing items by id, so the whole review track is interactive without
// editing each item inline. The planted issues stay server-only.
for (const it of ALL_ITEMS) {
  if (REVIEW_CATEGORIES.has(it.category) && REVIEW_CODE[it.id]) {
    (it as ConvItem).review = REVIEW_CODE[it.id];
  }
  // Multi-file PR review: attach the interconnected files by id.
  if (it.category === "pr" && PR_REVIEW_FILES[it.id]) {
    (it as ConvItem).review = { files: PR_REVIEW_FILES[it.id] };
  }
}

export interface PracticeFilter {
  category?: PracticeCategory;
  level?: Level;
  difficulty?: "easy" | "medium" | "hard";
}

export function getPracticeItems(filter?: PracticeFilter): PracticeItem[] {
  return ALL_ITEMS.filter(
    (p) =>
      (!filter?.category || p.category === filter.category) &&
      (!filter?.level || p.level === filter.level) &&
      (!filter?.difficulty || p.difficulty === filter.difficulty)
  );
}

export function getPracticeItem(id: string): PracticeItem | null {
  return ALL_ITEMS.find((p) => p.id === id) ?? null;
}

/**
 * Strip the SQL answer key before items are handed to client components. The
 * reference solution is graded/revealed server-side (api/practice/grade-sql,
 * solution, expected), so it must never ship to the browser. Everything the
 * workbench needs client-side (setupSql for in-browser runs, schema, hints,
 * starter) is preserved.
 */
export function toClientItems(items: PracticeItem[]): PracticeItem[] {
  return items.map((it) => {
    if (it.category === "sql") return { ...it, referenceSolution: "" };
    // Conversational/prompt items: blank the model answer (idealAnswer) and the
    // PySpark reference; both are graded/revealed server-side by problemId.
    const c = { ...it, idealAnswer: "" };
    if (c.sparkExec) c.sparkExec = { ...c.sparkExec, reference: "" };
    // Incident items: the rubric names the root cause, so blank it client-side —
    // grading uses the server-only scenario rubric (incidents.server.ts), not this.
    if (c.category === "incident") c.rubric = [];
    return c;
  });
}

export function countByCategory(): Record<string, number> {
  const out: Record<string, number> = {};
  for (const p of ALL_ITEMS) out[p.category] = (out[p.category] ?? 0) + 1;
  return out;
}

// ── Back-compat (the SQL workbench + DuckDB runner) ──────────────────────────
export type { PracticeProblem } from "./types";
export const PRACTICE_PROBLEMS = ALL_SQL_ITEMS;
export function getPracticeProblem(id: string) {
  const item = getPracticeItem(id);
  return item && item.category === "sql" ? item : null;
}
export function getPracticeProblems(level?: Level) {
  return ALL_SQL_ITEMS.filter((p) => !level || p.level === level);
}
