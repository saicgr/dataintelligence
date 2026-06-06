import { allQuestions } from "@/lib/data/seed";
import { TOOLS, TOOL_BY_SLUG } from "@/lib/catalog";
import type { Level, Question } from "@/lib/types";

/**
 * Grounded retrieval for the cheat-sheet generator.
 * Maps a JD (or role text) to the REAL question bank — never invents questions.
 * Phase 1 is deterministic, keyword/synonym based (the bank is small + tagged).
 */

const SYNONYMS: Record<string, string[]> = {
  snowflake: ["snowflake", "warehouse", "micro-partition", "snowpipe", "data warehouse", "warehousing"],
  dbt: ["dbt", "data build tool", "transformation", "incremental model", "jinja", "lineage"],
  airflow: ["airflow", "dag", "orchestration", "scheduler", "workflow", "backfill"],
  kafka: ["kafka", "streaming", "event", "pub/sub", "partition", "producer", "consumer", "exactly-once"],
  spark: ["spark", "pyspark", "rdd", "dataframe", "shuffle", "distributed", "skew"],
  databricks: ["databricks", "delta", "lakehouse", "unity catalog", "photon", "delta lake"],
  llms: ["llm", "prompt", "gpt", "openai", "language model", "fine-tune", "token", "context window", "genai"],
  rag: ["rag", "retrieval", "embedding", "chunk", "grounding", "semantic search", "reranking"],
  vectordb: ["vector", "pinecone", "pgvector", "faiss", "hnsw", "ann", "vector database"],
  agents: ["agent", "tool use", "autonomous", "eval", "guardrail", "react", "agentic"],
  sql: ["sql", "query", "join", "window function", "cte", "postgres", "mysql", "analytics"],
  python: ["python", "pandas", "numpy", "scripting", "data wrangling"],
  systemdesign: ["system design", "architecture", "scalab", "throughput", "latency", "design a", "high-level design"],
  datamodeling: ["data model", "dimensional", "star schema", "normaliz", "scd", "grain", "fact table", "modeling"],
};

export interface MatchedTool {
  slug: string;
  name: string;
  score: number;
}

export interface RetrievedSection {
  tool: string;
  toolName: string;
  questions: Question[];
}

// Memoized bank index: tool slug -> its questions (deduped by text).
let BANK: Record<string, Question[]> | null = null;
function bankByTool(): Record<string, Question[]> {
  if (BANK) return BANK;
  const out: Record<string, Question[]> = {};
  const seen = new Set<string>();
  for (const q of allQuestions()) {
    const key = `${q.toolSlug}::${q.questionText}`;
    if (seen.has(key)) continue;
    seen.add(key);
    (out[q.toolSlug] ??= []).push(q);
  }
  BANK = out;
  return out;
}

function tokens(text: string): string[] {
  return (text.toLowerCase().match(/[a-z0-9+#.]+/g) ?? []).filter((t) => t.length > 3);
}

/** Score each tool by how strongly the text references it. */
export function parseSkills(text: string): MatchedTool[] {
  const lower = ` ${text.toLowerCase()} `;
  const scored: MatchedTool[] = [];
  for (const tool of TOOLS) {
    const syns = [tool.name.toLowerCase(), ...(SYNONYMS[tool.slug] ?? [])];
    let score = 0;
    for (const s of syns) {
      let i = lower.indexOf(s);
      while (i !== -1) {
        score += 1;
        i = lower.indexOf(s, i + s.length);
      }
    }
    if (score > 0) scored.push({ slug: tool.slug, name: tool.name, score });
  }
  return scored.sort((a, b) => b.score - a.score);
}

/**
 * Retrieve the most relevant REAL questions for a target.
 * Returns matched tools + questions grouped by tool (level-preferred).
 */
export function retrieve(opts: {
  text: string;
  level: Level;
  maxTools?: number;
  perTool?: number;
}): { matchedTools: MatchedTool[]; sections: RetrievedSection[] } {
  const { text, level, maxTools = 6, perTool = 4 } = opts;
  const bank = bankByTool();

  let matched = parseSkills(text);
  if (matched.length === 0) {
    // Sparse input — fall back to the core data/AI screen.
    matched = ["sql", "python", "systemdesign"]
      .map((slug) => ({ slug, name: TOOL_BY_SLUG[slug]?.name ?? slug, score: 1 }))
      .filter((m) => bank[m.slug]);
  }

  const jd = new Set(tokens(text));
  const top = matched.slice(0, maxTools);

  const sections: RetrievedSection[] = [];
  for (const m of top) {
    const pool = bank[m.slug] ?? [];
    if (pool.length === 0) continue;
    const ranked = [...pool]
      .map((q) => {
        let s = m.score * 2;
        const qTokens = tokens(q.questionText);
        for (const t of qTokens) if (jd.has(t)) s += 1;
        if (q.level === level) s += 2;
        if (q.riskLevel === "high") s += 1; // high-signal questions first
        return { q, s };
      })
      .sort((a, b) => b.s - a.s)
      .slice(0, perTool)
      .map((x) => x.q);
    if (ranked.length) sections.push({ tool: m.slug, toolName: m.name, questions: ranked });
  }

  return { matchedTools: matched, sections };
}

/** Condense a real structured answer into a 2–3 line study snippet (grounded — no invention). */
export function conciseAnswer(answerStructured: string): string {
  const clean = answerStructured.replace(/\r/g, "").trim();
  const lines = clean
    .split("\n")
    .map((l) => l.replace(/^[\s\-*•\d.]+/, "").trim())
    .filter(Boolean);
  const snippet = lines.slice(0, 3).join(" · ");
  return snippet.length > 320 ? snippet.slice(0, 317) + "…" : snippet;
}
