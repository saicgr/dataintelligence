import type {
  Level,
  Question,
  QuestionStub,
  SheetCategory,
  Job,
  SalaryBenchmark,
  Drill,
  QuizQuestion,
  GlossaryTerm,
  BlogPost,
  Track,
} from "../types";
import {
  TOOLS,
  TOOL_BY_SLUG,
  CATEGORY_DEFS,
  LEVELS,
  LEVEL_NAMES,
} from "../catalog";
import type { Authored, ToolTopics } from "./content-de";
import { AUTHORED, TOPICS } from "./tools";

const LEVEL_INDEX: Record<Level, number> = { junior: 0, mid: 1, senior: 2 };
const CAT_INDEX: Record<string, number> = Object.fromEntries(
  CATEGORY_DEFS.map((c, i) => [c.slug, i])
);

function toolIndex(slug: string): number {
  return TOOL_BY_SLUG[slug]?.sortOrder ?? 99;
}

/** Stable, unique numeric id for a question within a sheet. */
function qid(
  tool: string,
  level: Level,
  category: string,
  idx: number
): number {
  return (
    toolIndex(tool) * 100000 +
    LEVEL_INDEX[level] * 10000 +
    (CAT_INDEX[category] ?? 9) * 100 +
    idx
  );
}

function authoredToQuestion(
  tool: string,
  level: Level,
  a: Authored,
  idx: number
): Question {
  return {
    id: qid(tool, level, a.category, idx),
    categorySlug: a.category,
    toolSlug: tool,
    level,
    sortOrder: idx,
    questionText: a.questionText,
    answerStructured: a.answerStructured,
    explanationDeep: a.explanationDeep,
    code: a.code,
    interviewerLens: a.interviewerLens,
    riskLevel: a.riskLevel,
    isComparison: Boolean(a.isComparison),
    comparisonTools: a.comparisonTools,
    followupChain: a.followupChain,
    redFlags: a.redFlags,
    alternatePhrasings: a.alternatePhrasings,
    interviewContexts: a.interviewContexts,
    askedCount: a.asked ?? 0,
    isFreePreview: Boolean(a.freePreview),
  };
}

const RISK_CYCLE: Question["riskLevel"][] = ["medium", "high", "low", "medium"];

/** A plausible generated full question for filler / collapsed-category items. */
function genQuestion(
  tool: string,
  level: Level,
  category: string,
  title: string,
  idx: number
): Question {
  const t = TOOL_BY_SLUG[tool];
  const name = t?.name ?? tool;
  const lvl = LEVEL_NAMES[level];
  return {
    id: qid(tool, level, category, idx),
    categorySlug: category,
    toolSlug: tool,
    level,
    sortOrder: idx,
    questionText: title,
    answerStructured: `- Frame the answer around what a **${lvl}-level ${name}** engineer is expected to own.\n- Lead with the trade-off, not the definition — name what you'd optimize for and why.\n- Ground it in a concrete production scenario you've seen.\n- Close with how you'd verify/measure it in practice.`,
    explanationDeep: `This comes up because it separates people who've *operated* ${name} from people who've only read about it. A ${lvl} answer connects the concept to a real decision: what you'd choose, what it costs, and how you'd know it worked.\n\nSay the trade-off out loud and tie it to a scenario. That narration is what the interviewer is grading — the willingness to reason about cost, failure, and verification rather than recite a definition.`,
    interviewerLens: `I'm listening for whether you reason about trade-offs and verification, or just define the term. A ${lvl} candidate ties "${title}" to a real ${name} decision and says how they'd measure success.`,
    riskLevel: RISK_CYCLE[idx % RISK_CYCLE.length],
    isComparison: false,
    followupChain: [
      { question: `Where does this bite you in production?`, answer: `Usually at scale or under failure — name the specific ${name} symptom and the lever you'd pull.` },
      { question: `How would you verify your choice was right?`, answer: `Define the metric up front (cost, latency, correctness) and measure before/after, rather than trusting intuition.` },
    ],
    redFlags: [
      { junior: `Reciting the definition with no trade-off.`, senior: `Naming the trade-off and a concrete ${name} scenario.` },
    ],
    alternatePhrasings: [title.replace(/\?$/, "") + " — walk me through it."],
    interviewContexts: [`Commonly asked in ${lvl} ${name} loops`],
    askedCount: ((idx * 7 + toolIndex(tool) * 3) % 18),
    isFreePreview: false,
  };
}

/** Build the full list of questions for a (tool, level) sheet. */
export function buildSheetQuestions(tool: string, level: Level): Question[] {
  const sheetKey = `${tool}:${level}`;
  const topics = TOPICS[sheetKey] ?? TOPICS[`${tool}:senior`];
  const authored = (AUTHORED[sheetKey] ?? AUTHORED[`${tool}:senior`] ?? []).map(
    (a, i) => authoredToQuestion(tool, level, a, i)
  );
  const byCat = (slug: string) => authored.filter((q) => q.categorySlug === slug);

  const out: Question[] = [];

  // Deep Dives = authored + generated from moreDeepDives
  let i = 0;
  for (const q of byCat("deep-dives")) out.push({ ...q, sortOrder: i++ });
  for (const title of topics?.moreDeepDives ?? [])
    out.push(genQuestion(tool, level, "deep-dives", title, i++));

  // Decision Frameworks
  i = 0;
  for (const q of byCat("decision-frameworks")) out.push({ ...q, sortOrder: i++ });
  for (const title of topics?.decisions ?? [])
    out.push(genQuestion(tool, level, "decision-frameworks", title, i++));

  // Tool Comparison (authored only, may be empty)
  i = 0;
  for (const q of byCat("tool-comparison")) out.push({ ...q, sortOrder: i++ });

  // Quick Reference
  i = 0;
  for (const title of topics?.quickRef ?? [])
    out.push(genQuestion(tool, level, "quick-reference", title, i++));

  // Red Flags — each topic redFlag becomes a question
  i = 0;
  for (const rf of topics?.redFlags ?? []) {
    const q = genQuestion(
      tool,
      level,
      "red-flags",
      `Red flag: "${rf.junior}"`,
      i++
    );
    q.redFlags = [rf];
    q.riskLevel = "high";
    out.push(q);
  }

  // Day-of Checklist
  i = 0;
  for (const title of topics?.checklist ?? [])
    out.push(genQuestion(tool, level, "day-of-checklist", title, i++));

  // Behavioral
  i = 0;
  for (const title of topics?.behavioral ?? [])
    out.push(genQuestion(tool, level, "behavioral-frameworks", title, i++));

  // Reverse Questions
  i = 0;
  for (const title of topics?.reverse ?? [])
    out.push(genQuestion(tool, level, "reverse-questions", title, i++));

  // Ensure at least one free preview per sheet (first deep dive)
  if (!out.some((q) => q.isFreePreview)) {
    const firstDeep = out.find((q) => q.categorySlug === "deep-dives");
    if (firstDeep) firstDeep.isFreePreview = true;
  }

  return out;
}

function toStub(q: Question): QuestionStub {
  return {
    id: q.id,
    categorySlug: q.categorySlug,
    toolSlug: q.toolSlug,
    level: q.level,
    sortOrder: q.sortOrder,
    questionText: q.questionText,
    riskLevel: q.riskLevel,
    askedCount: q.askedCount,
  };
}

/** Assemble dashboard categories (with stubs) for a sheet. */
export function buildSheet(tool: string, level: Level): SheetCategory[] {
  const qs = buildSheetQuestions(tool, level);
  return CATEGORY_DEFS.map((c) => ({
    slug: c.slug,
    name: c.name,
    icon: c.icon,
    description: c.description,
    expanded: c.expanded,
    questions: qs
      .filter((q) => q.categorySlug === c.slug)
      .map(toStub)
      .sort((a, b) => a.sortOrder - b.sortOrder),
  })).filter((c) => c.questions.length > 0);
}

/** All questions across every sheet — for most-asked, qotd, compare. */
let _allCache: Question[] | null = null;
export function allQuestions(): Question[] {
  if (_allCache) return _allCache;
  const out: Question[] = [];
  for (const t of TOOLS)
    for (const l of LEVELS)
      out.push(...buildSheetQuestions(t.slug, l.slug));
  _allCache = out;
  return out;
}

// ─── Jobs ──────────────────────────────────────────────────────────────────
const COMPANIES = [
  "Stripe", "Airbnb", "Datadog", "Snowflake", "Ramp", "Notion",
  "Anthropic", "Figma", "Brex", "Vercel", "Confluent", "Databricks",
];
const LOCS = ["Remote (US)", "San Francisco, CA", "New York, NY", "Remote (EU)", "London, UK", "Austin, TX"];

function seededJobs(): Job[] {
  const out: Job[] = [];
  let id = 1;
  const titles: { title: string; tools: string[]; level: Level }[] = [
    { title: "Senior Data Engineer", tools: ["snowflake", "dbt", "airflow"], level: "senior" },
    { title: "Staff Data Engineer", tools: ["spark", "kafka", "databricks"], level: "senior" },
    { title: "Analytics Engineer", tools: ["dbt", "snowflake"], level: "mid" },
    { title: "Data Engineer", tools: ["airflow", "spark"], level: "mid" },
    { title: "Junior Data Engineer", tools: ["snowflake", "dbt"], level: "junior" },
    { title: "Senior AI Engineer", tools: ["llms", "rag", "vectordb"], level: "senior" },
    { title: "AI Engineer, RAG", tools: ["rag", "vectordb", "llms"], level: "mid" },
    { title: "ML / AI Platform Engineer", tools: ["agents", "llms"], level: "senior" },
    { title: "Streaming Data Engineer", tools: ["kafka", "spark"], level: "senior" },
    { title: "Lakehouse Engineer", tools: ["databricks", "spark"], level: "mid" },
    { title: "Applied AI Engineer", tools: ["llms", "agents"], level: "mid" },
    { title: "Data Platform Engineer", tools: ["snowflake", "airflow", "dbt"], level: "senior" },
  ];
  for (let i = 0; i < titles.length; i++) {
    const tspec = titles[i];
    out.push({
      id: id++,
      title: tspec.title,
      company: COMPANIES[i % COMPANIES.length],
      location: LOCS[i % LOCS.length],
      level: tspec.level,
      tools: tspec.tools,
      url: `https://example.com/jobs/${id}`,
      source: i % 2 === 0 ? "greenhouse" : "lever",
      postedAt: `2026-05-${String((i % 27) + 1).padStart(2, "0")}`,
    });
  }
  return out;
}
export const SEED_JOBS: Job[] = seededJobs();

// ─── Salary benchmarks ───────────────────────────────────────────────────────
function seededSalaries(): SalaryBenchmark[] {
  const out: SalaryBenchmark[] = [];
  let id = 1;
  const base: Record<string, number> = {
    snowflake: 150, dbt: 145, airflow: 148, kafka: 155, spark: 158, databricks: 160,
    llms: 168, rag: 165, vectordb: 162, agents: 170,
    sql: 130, python: 140, systemdesign: 165, datamodeling: 150,
  };
  const levelMult: Record<Level, number> = { junior: 0.62, mid: 0.82, senior: 1.1 };
  const regions = ["US", "Europe", "Remote"];
  const regionMult: Record<string, number> = { US: 1, Europe: 0.78, Remote: 0.9 };
  for (const t of TOOLS) {
    for (const l of LEVELS) {
      for (const r of regions) {
        const mid = Math.round(base[t.slug] * levelMult[l.slug] * regionMult[r]);
        out.push({
          id: id++,
          role: `${LEVEL_NAMES[l.slug]} ${t.name} Engineer`,
          toolSlug: t.slug,
          level: l.slug,
          region: r,
          currency: r === "Europe" ? "EUR" : "USD",
          min: (mid - 25) * 1000,
          median: mid * 1000,
          max: (mid + 35) * 1000,
          year: 2026,
        });
      }
    }
  }
  return out;
}
export const SEED_SALARIES: SalaryBenchmark[] = seededSalaries();

export function salarySlug(tool: string, level: Level): string {
  const t = TOOL_BY_SLUG[tool];
  return `${level}-${(t?.name ?? tool).toLowerCase().replace(/[^a-z0-9]+/g, "-")}-engineer-salary-2026`;
}

// ─── Drills (Daily Drill) ────────────────────────────────────────────────────
function seededDrills(): Drill[] {
  const out: Drill[] = [];
  let id = 1;
  for (const t of TOOLS) {
    const topics = TOPICS[t.slug];
    const rfs = topics?.redFlags ?? [];
    for (let i = 0; i < Math.min(4, (topics?.quickRef.length ?? 0)); i++) {
      const correct = topics!.quickRef[i];
      const wrongPool = topics!.quickRef.filter((_, j) => j !== i);
      out.push({
        id: id++,
        track: t.track,
        toolSlug: t.slug,
        level: i < 2 ? "junior" : "senior",
        prompt: `(${t.name}) ${correct}`,
        choices: [
          "A precise, correct one-liner",
          "A plausible-but-wrong answer",
          "An unrelated concept",
          "“It doesn't matter”",
        ],
        correctIndex: 0,
        explanation: `Senior tell: ${rfs[0]?.senior ?? "name the trade-off, not just the definition."}`,
        xp: i < 2 ? 10 : 15,
      });
    }
  }
  return out;
}
export const SEED_DRILLS: Drill[] = seededDrills();

// ─── Quizzes ─────────────────────────────────────────────────────────────────
export function buildQuiz(tool: string, level: Level): QuizQuestion[] {
  const topics = TOPICS[tool];
  const areas = ["fundamentals", "performance", "design", "operations", "trade-offs"];
  const titles = [
    ...(topics?.quickRef ?? []),
    ...(topics?.moreDeepDives ?? []),
    ...(topics?.decisions ?? []),
  ].slice(0, 10);
  return titles.map((title, i) => ({
    id: `${tool}-${level}-${i}`,
    toolSlug: tool,
    level,
    area: areas[i % areas.length],
    prompt: title,
    choices: [
      "The correct senior-level answer",
      "A common junior misconception",
      "A confidently-wrong distractor",
      "Not sure",
    ],
    correctIndex: 0,
  }));
}

// ─── Glossary ──────────────────────────────────────────────────────────────
export const SEED_GLOSSARY: GlossaryTerm[] = [
  { slug: "dbt-incremental-model", term: "dbt incremental model", toolSlug: "dbt", short: "A dbt model that processes only new or changed rows instead of rebuilding the whole table.", body: "An incremental model uses `is_incremental()` and a watermark filter so each run only transforms new/changed records. With a `unique_key` it MERGEs (avoiding duplicates) and a lookback window catches late-arriving data. It trades compute for some complexity and drift risk — ideal for large, mostly-append tables." },
  { slug: "micro-partition", term: "Snowflake micro-partition", toolSlug: "snowflake", short: "The 50–500MB immutable storage unit Snowflake automatically organizes data into.", body: "Snowflake stores table data in compressed columnar micro-partitions with per-column min/max metadata. Queries 'prune' partitions whose ranges can't match the filter, scanning far less data — which is why query shape and clustering matter more than warehouse size for performance." },
  { slug: "data-skew", term: "data skew (Spark)", toolSlug: "spark", short: "When one partition holds far more data than others, creating a long-running straggler task.", body: "Skew shows up as one task running much longer than the rest. Caused by hot join keys (including nulls). Fixes: broadcast the small side, salt the skewed key, or enable Adaptive Query Execution skew-join handling." },
  { slug: "kafka-partition", term: "Kafka partition", toolSlug: "kafka", short: "The unit of ordering and parallelism in a Kafka topic.", body: "A topic is split into partitions; ordering is guaranteed only within a partition, and at most one consumer per partition per group bounds parallelism. The partition key decides what stays ordered and can create hot partitions if skewed." },
  { slug: "rag", term: "RAG (Retrieval-Augmented Generation)", toolSlug: "rag", short: "Injecting retrieved documents into an LLM prompt so it answers from current, grounded facts.", body: "RAG retrieves relevant chunks (often via hybrid search + reranking) and adds them to the prompt so the model answers from real context instead of memory. It's the right tool for knowledge/freshness — far easier to update than fine-tuning." },
  { slug: "hnsw", term: "HNSW index", toolSlug: "vectordb", short: "A graph-based approximate-nearest-neighbor index with high recall and low latency.", body: "Hierarchical Navigable Small World builds a navigable graph over vectors for fast, high-recall approximate search — at the cost of higher memory and slower builds. The common default until memory cost forces alternatives like IVF or quantization." },
  { slug: "delta-lake", term: "Delta Lake", toolSlug: "databricks", short: "An open table format adding ACID transactions, MERGE, and time travel on top of Parquet.", body: "Delta uses a transaction log (`_delta_log`) over Parquet files to provide ACID guarantees, upserts/deletes via MERGE, schema enforcement, and time travel — turning a pile of files into a reliable table while staying open-format." },
  { slug: "llm-tool-calling", term: "LLM tool calling", toolSlug: "llms", short: "Letting an LLM invoke defined functions with structured arguments instead of free text.", body: "Tool (function) calling constrains the model to emit structured calls against a schema, which is how you get reliable structured output and let models take actions — validated and retried like any unreliable input." },
  { slug: "llm-agent", term: "LLM agent", toolSlug: "agents", short: "An LLM that plans and acts in a loop using tools to accomplish a multi-step task.", body: "Agents call tools across steps to reach a goal. Their failure modes (looping, compounding errors, bad tool calls) mean reliability comes from step budgets, schema-validated idempotent tools, evals on task success, and human-in-the-loop for risky actions." },
  { slug: "idempotency", term: "idempotency (data pipelines)", toolSlug: "airflow", short: "Re-running a task for the same date produces the same result — no duplicates or drift.", body: "Achieved by keying work on the logical/execution date and overwriting a deterministic partition (INSERT OVERWRITE / MERGE) rather than appending. It's what makes Airflow backfills and retries safe." },
  { slug: "mcp", term: "MCP (Model Context Protocol)", toolSlug: "agents", short: "An open protocol that lets LLM apps connect to tools and data through a standard interface.", body: "MCP standardizes how models reach external tools, data, and prompts via lightweight servers — write a tool once and any MCP-aware client (Claude, IDEs, agents) can use it, instead of bespoke per-framework wrappers. Interviewers probe whether you understand the shift from tool-format fragmentation to a shared protocol, and the security implications of connecting untrusted MCP servers." },
  { slug: "context-engineering", term: "context engineering", toolSlug: "llms", short: "Curating the optimal set of tokens in the context window across an agent's turns — the successor to prompt engineering.", body: "Where prompt engineering tunes the wording of one request, context engineering manages the whole token budget over many turns: system instructions, tool definitions, retrieved data, memory and history. It matters because context is finite and suffers 'context rot' — accuracy degrades as the window fills with low-signal tokens. The goal is the smallest high-signal context that produces the right behavior." },
  { slug: "llm-as-judge", term: "LLM-as-a-judge", toolSlug: "llms", short: "Using an LLM to score another model's outputs — fast and scalable, but biased.", body: "An LLM grader enables automated evals at scale, but carries systematic biases: position bias (order of options), length/verbosity bias (longer = higher score), and self-preference (favoring its own family). Report results with confidence intervals and bias correction, use a 'jury' of judges, and validate judge–human agreement before trusting the numbers." },
  { slug: "vllm", term: "vLLM", toolSlug: "llms", short: "A high-throughput LLM serving engine built around PagedAttention and continuous batching.", body: "vLLM manages the KV cache like OS virtual memory (PagedAttention), so it wastes little GPU memory and serves many concurrent requests via continuous batching — large throughput gains over naive serving. It's the common default for self-hosted inference; interviews pair it with quantization, speculative decoding and latency-vs-throughput trade-offs." },
  { slug: "quantization", term: "quantization (LLM inference)", toolSlug: "llms", short: "Storing model weights/activations at lower precision (FP8/INT8/INT4) to cut memory and boost throughput.", body: "Lower precision fits more model into GPU memory and speeds inference, at some accuracy risk. FP8 is near-lossless on modern (Hopper-class) GPUs and a reasonable default; INT8/INT4 push further but are noisier. The interview answer to a memory-bound serving bottleneck is usually FP8 + continuous batching." },
  { slug: "prompt-injection", term: "prompt injection", toolSlug: "llms", short: "Malicious instructions smuggled into a model's input to override its intended behavior.", body: "Direct injection puts attacker instructions in the user message; indirect injection hides them in retrieved/tool data (a poisoned doc, a web page). It's #1 on the OWASP LLM Top 10. Defenses are layered: input/output filtering, privilege separation, least-privilege tools, and not trusting retrieved content as instructions." },
  { slug: "guardrails", term: "LLM guardrails", toolSlug: "llms", short: "Input/output controls that keep an LLM app safe — blocking injection, PII leaks, jailbreaks and unsafe content.", body: "Guardrails are separate checks around the model: prompt-injection and jailbreak detection, PII redaction, output filtering, and tool-use limits (e.g. Llama Guard, NeMo Guardrails, Guardrails AI). Design them by failure severity — which outcomes are catastrophic vs merely annoying — and monitor trigger rates as a drift signal." },
  { slug: "rag-triad", term: "RAG triad", toolSlug: "rag", short: "Three metrics — context relevance, faithfulness, answer relevance — that localize where a RAG pipeline fails.", body: "Context relevance asks if the retrieved chunks fit the question (blames the retriever); faithfulness asks if the answer is grounded in those chunks (blames generation/hallucination); answer relevance asks if the response actually addresses the question. Because they decouple, they tell you whether to fix retrieval or generation. Ragas, DeepEval and TruLens compute them." },
  { slug: "reranking", term: "reranking (RAG)", toolSlug: "rag", short: "A second-stage model that re-scores retrieved candidates for relevance before they hit the prompt.", body: "First-stage retrieval favors recall (get the right doc into the top-k); a cross-encoder reranker then reorders those candidates with far higher precision — at ~10–100× the per-pair cost, so you only rerank a small shortlist. It's the standard fix when the right document is retrieved but buried below noise." },
  { slug: "chunking", term: "chunking (RAG)", toolSlug: "rag", short: "Splitting documents into retrievable pieces — the single biggest lever on RAG quality.", body: "Fixed-size chunking is simple but cuts mid-thought; recursive splitting respects structure and is a strong default; semantic chunking groups by embedding similarity for coherence at higher cost. Overlap (~10–20%) preserves boundary context. Chunk size is a tunable: too large dilutes the embedding, too small loses context — tune it against an eval set." },
  { slug: "hybrid-search", term: "hybrid search", toolSlug: "rag", short: "Combining keyword (BM25) and dense vector retrieval, fused with RRF, to handle both exact and semantic matches.", body: "Dense retrieval nails paraphrase but misses rare tokens (SKUs, error codes); BM25 nails exact terms but misses intent. Run both and fuse the ranked lists with Reciprocal Rank Fusion (sum of 1/(k+rank), k≈60) so you avoid normalizing incomparable score scales. Hybrid beats either alone for the mixed queries real users send." },
  { slug: "embedding", term: "embedding", toolSlug: "vectordb", short: "A dense vector that encodes meaning, so similar items sit near each other in vector space.", body: "An embedding maps text (or images) to a fixed-length vector where cosine/inner-product similarity approximates semantic similarity — the foundation of vector search and RAG retrieval. Choice of embedding model, dimensionality, and normalization all affect retrieval quality and index cost." },
  { slug: "data-reconciliation", term: "data reconciliation", toolSlug: "sql", short: "Verifying that data in a source system matches what landed in a target — and explaining every difference.", body: "Reconciliation compares source vs target by row, by aggregate (sum/count/distinct), or by audit trail. The hard part is the edge cases: it must catch discrepancies in BOTH directions (missing AND extra/duplicate rows), compare money in integer cents (never float ==), survive duplicate keys (set-difference, not row-count math), and align day windows across time zones. It's one of the highest-frequency data-engineering topics." },
  { slug: "scd-type-2", term: "SCD Type 2", toolSlug: "dbt", short: "A dimension-modeling pattern that preserves history by versioning rows with effective-date ranges.", body: "Slowly Changing Dimension Type 2 keeps every version of a record using valid-from/valid-to dates and a current-flag, so you can query 'what did this look like on that date'. The classic bugs: overlapping validity windows, two rows marked current, and not closing the prior version when a new one opens." },
  { slug: "cdc", term: "CDC (Change Data Capture)", toolSlug: "kafka", short: "Streaming inserts/updates/deletes out of a source database as they happen.", body: "CDC reads a database's change log to emit row-level changes downstream (often via Kafka/Debezium). The correctness traps: handling deletes/tombstones, preserving per-key ordering across partitions, and merging an initial snapshot with the ongoing stream without losing or double-applying changes." },
];

// ─── Blog (field notes) ───────────────────────────────────────────────────────
export const SEED_BLOG: BlogPost[] = [
  {
    slug: "5-kafka-questions-series-b",
    title: "5 Kafka questions I got asked at a Series B (and the answers that landed)",
    excerpt: "Real questions from a streaming-heavy Senior DE loop — partitioning, ordering, and the follow-up that trips everyone.",
    date: "2026-05-20",
    tool: "kafka",
    body: "I walked out of this loop and wrote down every question while it was fresh. Here are the five Kafka ones, in order, plus what I'd say if I could do it again.\n\n## 1. \"How does partitioning interact with ordering?\"\nOrdering is per-partition, not per-topic. Key on the entity that must stay ordered. The interviewer was visibly waiting for me to *not* say 'Kafka keeps everything in order.'\n\n## 2. \"What caps consumer parallelism?\"\nPartition count — one consumer per partition per group. This is the whole reason partition count is an up-front decision.\n\n## 3. \"What happens when you add partitions?\"\nThe key→partition mapping changes, so ordering breaks for in-flight keys. This was the follow-up that separated people.\n\n## 4. \"At-least-once vs exactly-once — when do you need EOS?\"\nMost pipelines: at-least-once + idempotent consumers. EOS for money movement.\n\n## 5. \"One consumer can't keep up — what now?\"\nAdd consumers up to the partition count, then you're forced to add partitions or speed up processing.\n\nThe meta-lesson: they weren't testing trivia, they were testing whether I'd been paged at 3am because of a hot partition.",
  },
  {
    slug: "rag-debugging-playbook",
    title: "The RAG debugging playbook that got me through 3 AI interviews",
    excerpt: "Every RAG question reduces to one move: bisect retrieval from generation. Here's the script.",
    date: "2026-05-12",
    tool: "rag",
    body: "After a few AI engineering loops, every 'why is your RAG wrong' question started feeling the same. The answer they want is always the same first move.\n\n## Bisect first\nDid retrieval surface the right chunk? Log the top-k. If the supporting passage isn't there, no model fixes it — it's a retrieval problem.\n\n## Fix retrieval\nChunking, hybrid search (BM25 + vector), a reranker. Measure recall@k on a labeled set.\n\n## Then fix grounding\nIf the right context *was* retrieved and the answer's still wrong, constrain the prompt to context, allow 'I don't know,' and add a faithfulness check.\n\n## Measure both halves separately\nRetrieval recall and answer faithfulness have different fixes. Track them apart.\n\nSay 'use a bigger model' and you've told the interviewer you've never actually debugged RAG.",
  },
  {
    slug: "snowflake-bill-cut-in-half",
    title: "How I cut a Snowflake bill in half without anyone noticing",
    excerpt: "Auto-suspend, warehouse isolation, and reading the Query Profile instead of resizing.",
    date: "2026-05-03",
    tool: "snowflake",
    body: "The fastest way to look senior in a Snowflake interview is to talk about cost like someone who's owned the bill.\n\n## Stop resizing as the first move\nThe Query Profile tells you if you're memory-bound (spilling) or scanning too much (poor pruning). Resizing a query that prunes badly just burns credits faster.\n\n## Auto-suspend and isolation\nAggressive auto-suspend, separate warehouses per workload, resource monitors. One runaway BI query shouldn't starve ETL.\n\n## Clustering only where it pays\nReclustering is an ongoing cost. It earns its keep on large, mostly-append tables filtered on a consistent key — not everywhere.\n\nThat's the whole story, and it's also exactly what the interviewer wants to hear.",
  },
];

export const TRACK_OF: Record<string, Track> = Object.fromEntries(
  TOOLS.map((t) => [t.slug, t.track])
);
