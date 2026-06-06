import { ALL_ITEMS } from "./index";

/**
 * Curated, LeetCode/NeetCode-style study plans over the existing practice items.
 * Pure data + helpers — no item-model changes. Each plan is an ordered set of
 * sections; each section is a list of itemIds resolvable via getPracticeItem.
 * Built from the live item set so ids are always valid (see validateStudyPlans).
 */
export interface StudyPlanSection {
  title: string;
  blurb?: string;
  itemIds: string[];
}
export interface StudyPlan {
  slug: string;
  name: string;
  blurb: string;
  track: "headliner" | "ai" | "data" | "review" | "foundations" | "incident";
  accent?: string; // tailwind text color for the card badge
  sections: StudyPlanSection[];
}

// ── id selectors over the live item set (keeps plans valid by construction) ──
const cat = (c: string) => ALL_ITEMS.filter((i) => i.category === c).map((i) => i.id);
const catDiff = (c: string, d: "easy" | "medium" | "hard") =>
  ALL_ITEMS.filter((i) => i.category === c && i.difficulty === d).map((i) => i.id);
const prefix = (p: string) => ALL_ITEMS.filter((i) => i.id.startsWith(p)).map((i) => i.id);
const take = (ids: string[], n: number) => ids.slice(0, n);
// Incidents by difficulty tier (tier lives on item.incident.tier).
const incTier = (t: "standard" | "hard" | "hellish") =>
  ALL_ITEMS.filter((i) => i.category === "incident" && (i as { incident?: { tier?: string } }).incident?.tier === t).map((i) => i.id);

const SQL = cat("sql");
const RECON = prefix("rec-"); // reconciliation scenario items (category casestudy)

export const STUDY_PLANS: StudyPlan[] = [
  // ───────────────────────── Headliners ─────────────────────────
  {
    slug: "sql50",
    name: "SQL 50",
    blurb: "The 50 SQL patterns that clear 90% of data interviews — warm-ups to window-function gauntlets. Runs live in your browser.",
    track: "headliner",
    accent: "text-success",
    sections: [
      { title: "Warm-ups", blurb: "Filters, joins, aggregates.", itemIds: take(catDiff("sql", "easy"), 12) },
      { title: "Core patterns", blurb: "Grouping, ranking, subqueries, CTEs.", itemIds: take(catDiff("sql", "medium"), 24) },
      { title: "Hard — windows & edge cases", blurb: "Where the adversarial traps live.", itemIds: take(catDiff("sql", "hard"), 14) },
    ],
  },
  {
    slug: "de50",
    name: "DE 50",
    blurb: "An end-to-end Data Engineering loop: SQL, Spark, reconciliation & correctness, warehousing, and pipeline design.",
    track: "headliner",
    accent: "text-amber",
    sections: [
      { title: "SQL foundations", itemIds: take(SQL, 14) },
      { title: "Spark & distributed", blurb: "Transforms, joins, skew, OOM.", itemIds: take(cat("pyspark"), 10) },
      { title: "Reconciliation & correctness", blurb: "The edge cases that break naive pipelines.", itemIds: [...RECON, "pr-recon-daily-revenue"] },
      { title: "Production incidents", blurb: "You're on call — find the root cause.", itemIds: [...prefix("inc-de-"), ...take(prefix("inc-ae-"), 4)] },
      { title: "Warehousing & admin", itemIds: [...take(cat("dba"), 6), ...take(cat("snowflake-admin"), 4), ...take(cat("databricks-admin"), 4)] },
      { title: "Pipeline & system design", itemIds: take(cat("systemdesign"), 7) },
    ],
  },
  {
    slug: "ai50",
    name: "AI 50",
    blurb: "The AI-Engineering interview surface that's actually being tested in 2026: RAG, agents & MCP, evals & ops, prompt optimization.",
    track: "headliner",
    accent: "text-violet-500",
    sections: [
      { title: "RAG pipelines", itemIds: cat("rag") },
      { title: "Agents & MCP", itemIds: cat("agents") },
      { title: "Eval, Ops & Serving", itemIds: cat("llmops") },
      { title: "Prompting & optimization", itemIds: [...take(cat("prompting"), 8), ...cat("promptlab")] },
      { title: "Reviewing AI artifacts", itemIds: cat("aireview") },
      { title: "AI incidents in prod", blurb: "RAG/agent failures on call.", itemIds: [...prefix("inc-aie-"), ...take(prefix("inc-mle-"), 3)] },
    ],
  },

  // ───────────────────────── Themed: AI ─────────────────────────
  {
    slug: "rag-pipeline",
    name: "RAG, end-to-end",
    blurb: "Chunk → retrieve → rerank → evaluate → guard. Build the production RAG mental model interviewers probe.",
    track: "ai",
    sections: [{ title: "RAG pipeline", itemIds: cat("rag") }],
  },
  {
    slug: "agentic-mcp",
    name: "Agentic flows + MCP",
    blurb: "Tool calling, agent loops, MCP, and framework trade-offs — plus the failure modes (loops, cascades, injection).",
    track: "ai",
    sections: [{ title: "Agents & MCP", itemIds: cat("agents") }],
  },
  {
    slug: "llm-eval-ops",
    name: "Eval, Ops & guardrails",
    blurb: "Evals & LLM-as-judge bias, observability, guardrails, model serving and FinOps — the production AI surface.",
    track: "ai",
    sections: [{ title: "LLM Eval & Ops", itemIds: cat("llmops") }],
  },
  {
    slug: "prompt-optimization",
    name: "Prompt optimization",
    blurb: "Stop guessing at prompts — iterate against a labeled dataset and drive measurable accuracy.",
    track: "ai",
    sections: [
      { title: "Optimize on data", blurb: "Edit the prompt, watch accuracy climb.", itemIds: cat("promptlab") },
      { title: "Prompt engineering", itemIds: take(cat("prompting"), 8) },
    ],
  },
  {
    slug: "claude-context-engineering",
    name: "Claude & context engineering",
    blurb: "CLAUDE.md, slash commands, subagents/skills, and context engineering — the emerging high-leverage skill.",
    track: "ai",
    sections: [{ title: "Claude development", itemIds: cat("claude") }],
  },

  // ───────────────────────── Themed: Data ─────────────────────────
  {
    slug: "data-reconciliation",
    name: "Data reconciliation",
    blurb: "The single highest-frequency data-eng topic — source-vs-target, late data, SCD2, CDC, financial precision, day boundaries.",
    track: "data",
    accent: "text-amber",
    sections: [
      { title: "Reconciliation scenarios", blurb: "Each with an engineered edge case.", itemIds: RECON },
      { title: "Multi-file PR review", blurb: "Catch the cross-file recon bug.", itemIds: ["pr-recon-daily-revenue"] },
    ],
  },
  {
    slug: "spark-performance",
    name: "Spark performance",
    blurb: "Skew, shuffles, spill and OOM — diagnose the distributed failures interviewers love.",
    track: "data",
    sections: [
      { title: "PySpark", itemIds: cat("pyspark") },
      { title: "Review a real OOM", itemIds: ["cr-pyspark-multi-fault-perf"] },
    ],
  },

  // ───────────────────────── Themed: Review ─────────────────────────
  {
    slug: "code-review-50",
    name: "Code review gauntlet",
    blurb: "Read code (incl. AI-generated) and prompts the way modern loops test it — spot the bug, defend it under follow-ups.",
    track: "review",
    accent: "text-sky-500",
    sections: [
      { title: "Code review", itemIds: cat("codereview") },
      { title: "AI review", itemIds: cat("aireview") },
      { title: "PR review (multi-file)", itemIds: cat("pr") },
    ],
  },
  {
    slug: "typescript-review",
    name: "TypeScript deep cuts",
    blurb: "Type-safety, async pitfalls, API contracts — and the bugs the types should have caught.",
    track: "review",
    sections: [{ title: "TypeScript", itemIds: cat("typescript") }],
  },

  // ───────────────────────── Foundations ─────────────────────────
  {
    slug: "foundations",
    name: "Foundations first",
    blurb: "New to the stack? Teach the basics back in your own words before you build — then warm up on SQL.",
    track: "foundations",
    accent: "text-success",
    sections: [
      { title: "Explain it back", itemIds: cat("basics") },
      { title: "First SQL", itemIds: take(catDiff("sql", "easy"), 8) },
    ],
  },
  {
    slug: "design-first",
    name: "Design first",
    blurb: "Everyone can build — few think first. Reason about architecture and trade-offs before any code.",
    track: "foundations",
    accent: "text-violet-500",
    sections: [
      { title: "Case studies", itemIds: take(cat("casestudy"), 8) },
      { title: "System design", itemIds: cat("systemdesign") },
    ],
  },

  // ───────────────────────── Incident debugging ─────────────────────────
  {
    slug: "incident-oncall",
    name: "On-call: every incident",
    blurb: "The full incident catalog — read the artifacts, query the data, find the root cause and the fix. Grouped by role.",
    track: "incident",
    accent: "text-danger",
    sections: [
      { title: "Data Engineering", itemIds: prefix("inc-de-") },
      { title: "Analytics Engineering", itemIds: prefix("inc-ae-") },
      { title: "Streaming", itemIds: prefix("inc-stream-") },
      { title: "ML Engineering", itemIds: prefix("inc-mle-") },
      { title: "AI Engineering", itemIds: prefix("inc-aie-") },
      { title: "DBA", itemIds: prefix("inc-dba-") },
      { title: "Platform / SRE", itemIds: prefix("inc-sre-") },
    ],
  },
  {
    slug: "incident-hellweek",
    name: "Hell week",
    blurb: "The 💀 broken ones — multi-cause incidents with red herrings, cascades and sparse signals. The set that breaks people.",
    track: "incident",
    accent: "text-danger",
    sections: [{ title: "Multi-cause / red-herring incidents", blurb: "Mitigate, then find the real cause — don't get fooled.", itemIds: incTier("hellish") }],
  },
  { slug: "incidents-de", name: "Incidents · Data Eng", blurb: "Airflow, Spark, warehouse and pipeline incidents at scale.", track: "incident", sections: [{ title: "Data Engineering incidents", itemIds: prefix("inc-de-") }] },
  { slug: "incidents-analytics", name: "Incidents · Analytics", blurb: "dbt, metrics, A/B and warehouse-cost incidents.", track: "incident", sections: [{ title: "Analytics Engineering incidents", itemIds: prefix("inc-ae-") }] },
  { slug: "incidents-streaming", name: "Incidents · Streaming", blurb: "Kafka lag, rebalances, poison messages, exactly-once.", track: "incident", sections: [{ title: "Streaming incidents", itemIds: prefix("inc-stream-") }] },
  { slug: "incidents-ml", name: "Incidents · ML Eng", blurb: "Train/serve skew, leakage, stale features, GPU serving.", track: "incident", sections: [{ title: "ML Engineering incidents", itemIds: prefix("inc-mle-") }] },
  { slug: "incidents-ai", name: "Incidents · AI Eng", blurb: "RAG, embeddings, agent loops, prompt injection in prod.", track: "incident", sections: [{ title: "AI Engineering incidents", itemIds: prefix("inc-aie-") }] },
  { slug: "incidents-dba", name: "Incidents · DBA", blurb: "Indexing, deadlocks, pools, replica lag, hot rows.", track: "incident", sections: [{ title: "DBA incidents", itemIds: prefix("inc-dba-") }] },
  { slug: "incidents-platform", name: "Incidents · Platform/SRE", blurb: "OOM, p99, cache stampede, retry amplification, idempotency.", track: "incident", sections: [{ title: "Platform / SRE incidents", itemIds: prefix("inc-sre-") }] },
];

export function getStudyPlan(slug: string): StudyPlan | null {
  return STUDY_PLANS.find((p) => p.slug === slug) ?? null;
}

/** Total items in a plan (deduped). */
export function planItemCount(p: StudyPlan): number {
  return new Set(p.sections.flatMap((s) => s.itemIds)).size;
}

/** Dev/test guard: every referenced itemId must resolve. Returns the missing ids. */
export function validateStudyPlans(): string[] {
  const valid = new Set(ALL_ITEMS.map((i) => i.id));
  const missing: string[] = [];
  for (const p of STUDY_PLANS)
    for (const s of p.sections)
      for (const id of s.itemIds) if (!valid.has(id)) missing.push(`${p.slug}:${id}`);
  return missing;
}
