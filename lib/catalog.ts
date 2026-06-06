import type { Level, Track } from "./types";

export const SITE_NAME = "FieldNotes";
export const SITE_DESC =
  "Real Data & AI Engineering interview questions — researched from how real loops run and fact-checked against the official docs.";
export const SITE_TAGLINE =
  "The questions they actually ask — across every major data & AI tool.";

/** Pricing (one-time payments). */
export const SHEET_PRICE_CENTS = 1200; // $12 per (tool + level)
export const TOOL_PACK_PRICE_CENTS = 2900; // $29 — one tool, all 3 levels
export const BUNDLE_PRICE_CENTS = 5900; // $59 full access
export const SHEET_PRICE = "$12";
export const TOOL_PACK_PRICE = "$29";
export const BUNDLE_PRICE = "$59";

/** Practice Pro — the interactive practice subscription. */
export const PRACTICE_PRO_PRICE_CENTS = 1499; // $14.99 / month
export const PRACTICE_PRO_PRICE = "$14.99";
export const PRACTICE_PRO_ANNUAL_CENTS = 9900; // $99 / year (~$8.25/mo)
export const PRACTICE_PRO_ANNUAL_PRICE = "$99";
export const PRACTICE_PRO_ANNUAL_MONTHLY = "$8.25";
export const PRACTICE_PRO_ANNUAL_SAVE = "45%"; // vs $14.99 × 12

/** Free-tier daily limits (Practice Pro = unlimited). */
export const FREE_SUBMITS_PER_DAY = 20;
export const FREE_AI_MSGS_PER_DAY = 5;

export const LEVELS: { slug: Level; name: string; years: string }[] = [
  { slug: "junior", name: "Junior", years: "0–2 YEARS" },
  { slug: "mid", name: "Mid", years: "2–5 YEARS" },
  { slug: "senior", name: "Senior", years: "5–8 YEARS" },
];

export const LEVEL_NAMES: Record<Level, string> = {
  junior: "Junior",
  mid: "Mid",
  senior: "Senior",
};

export const TRACKS: { slug: Track; name: string; blurb: string }[] = [
  {
    slug: "data_engineering",
    name: "Data Engineering",
    blurb: "Pipelines, warehouses, streaming and orchestration.",
  },
  {
    slug: "ai_engineering",
    name: "AI Engineering",
    blurb: "LLMs, retrieval, vector search, agents and evals.",
  },
  {
    slug: "core_skills",
    name: "Core Skills",
    blurb: "SQL, Python, system design and data modeling — the fundamentals every loop tests.",
  },
];

export interface ToolDef {
  slug: string;
  name: string;
  icon: string; // emoji placeholder (swap for real logos later)
  track: Track;
  sortOrder: number;
  questionCount: number; // headline marketing count
  blurb: string;
}

export const TOOLS: ToolDef[] = [
  // Data Engineering
  { slug: "snowflake", name: "Snowflake", icon: "❄️", track: "data_engineering", sortOrder: 1, questionCount: 47, blurb: "Warehousing, micro-partitions, performance & cost." },
  { slug: "dbt", name: "dbt", icon: "🔧", track: "data_engineering", sortOrder: 2, questionCount: 42, blurb: "Modeling, incremental builds, tests & lineage." },
  { slug: "airflow", name: "Apache Airflow", icon: "🌀", track: "data_engineering", sortOrder: 3, questionCount: 39, blurb: "DAG design, idempotency, backfills & scheduling." },
  { slug: "kafka", name: "Apache Kafka", icon: "📡", track: "data_engineering", sortOrder: 4, questionCount: 38, blurb: "Partitioning, ordering, delivery semantics." },
  { slug: "spark", name: "Apache Spark", icon: "⚡", track: "data_engineering", sortOrder: 5, questionCount: 44, blurb: "Joins, skew, shuffles & memory tuning." },
  { slug: "databricks", name: "Databricks", icon: "🧱", track: "data_engineering", sortOrder: 6, questionCount: 41, blurb: "Lakehouse, Delta, Unity Catalog & jobs." },
  // AI Engineering
  { slug: "llms", name: "LLMs & Prompting", icon: "🧠", track: "ai_engineering", sortOrder: 7, questionCount: 36, blurb: "Context, structured output, tool calling, cost." },
  { slug: "rag", name: "RAG & Retrieval", icon: "🔎", track: "ai_engineering", sortOrder: 8, questionCount: 35, blurb: "Chunking, hybrid search, reranking, grounding." },
  { slug: "vectordb", name: "Vector Databases", icon: "🧮", track: "ai_engineering", sortOrder: 9, questionCount: 30, blurb: "HNSW/IVF, filtering, pgvector vs Pinecone." },
  { slug: "agents", name: "Agents & Evals", icon: "🤖", track: "ai_engineering", sortOrder: 10, questionCount: 32, blurb: "Tool use, failure modes, guardrails, evaluation." },
  // Core Skills
  { slug: "sql", name: "SQL", icon: "🗃️", track: "core_skills", sortOrder: 11, questionCount: 48, blurb: "Joins, window functions, CTEs, query reasoning." },
  { slug: "python", name: "Python for Data", icon: "🐍", track: "core_skills", sortOrder: 12, questionCount: 40, blurb: "Data structures, pandas, idioms, complexity." },
  { slug: "systemdesign", name: "System Design", icon: "🏗️", track: "core_skills", sortOrder: 13, questionCount: 34, blurb: "Pipelines, scaling, trade-offs, the design loop." },
  { slug: "datamodeling", name: "Data Modeling", icon: "📐", track: "core_skills", sortOrder: 14, questionCount: 36, blurb: "Dimensional vs normalized, SCDs, grain, keys." },
];

export const TOOL_BY_SLUG: Record<string, ToolDef> = Object.fromEntries(
  TOOLS.map((t) => [t.slug, t])
);

export function toolsByTrack(track: Track): ToolDef[] {
  return TOOLS.filter((t) => t.track === track).sort(
    (a, b) => a.sortOrder - b.sortOrder
  );
}

export function isValidTool(slug: string): boolean {
  return slug in TOOL_BY_SLUG;
}
export function isValidLevel(slug: string): slug is Level {
  return slug === "junior" || slug === "mid" || slug === "senior";
}

/** All (tool, level) sheet combinations. */
export function allSheets(): { tool: string; level: Level }[] {
  const out: { tool: string; level: Level }[] = [];
  for (const t of TOOLS) {
    for (const l of LEVELS) out.push({ tool: t.slug, level: l.slug });
  }
  return out;
}

/** Standard category set present in every sheet. */
export const CATEGORY_DEFS: {
  slug: string;
  name: string;
  icon: string;
  description: string;
  expanded: boolean;
}[] = [
  { slug: "deep-dives", name: "Deep Dives", icon: "🎯", description: "The questions that decide the loop. Full senior-level answers with the interviewer's lens.", expanded: true },
  { slug: "decision-frameworks", name: "Decision Frameworks", icon: "🧭", description: "How to reason about trade-offs out loud — the thing that actually signals seniority.", expanded: true },
  { slug: "tool-comparison", name: "Tool Comparison", icon: "⚖️", description: "Cross-tool 'which would you choose and why' questions. Unique to a multi-tool prep.", expanded: false },
  { slug: "quick-reference", name: "Quick Reference", icon: "📌", description: "Fast facts and one-liners you should be able to fire back instantly.", expanded: false },
  { slug: "red-flags", name: "Red Flags", icon: "🚩", description: "Phrases that quietly sink candidates — and what to say instead.", expanded: false },
  { slug: "day-of-checklist", name: "Day-of Checklist", icon: "✅", description: "What to review the morning of, so nothing catches you cold.", expanded: false },
  { slug: "behavioral-frameworks", name: "Behavioral Frameworks", icon: "💬", description: "STAR-style structures for the 'tell me about a time' rounds.", expanded: false },
  { slug: "reverse-questions", name: "Reverse Questions", icon: "🔁", description: "Sharp questions to ask them — that make you look senior.", expanded: false },
];

export const CATEGORY_BY_SLUG = Object.fromEntries(
  CATEGORY_DEFS.map((c) => [c.slug, c])
);

export function levelLabel(level: Level): string {
  return LEVEL_NAMES[level];
}

export function sheetTitle(toolSlug: string, level: Level): string {
  const t = TOOL_BY_SLUG[toolSlug];
  return `${LEVEL_NAMES[level]} · ${t ? t.name : toolSlug}`;
}
