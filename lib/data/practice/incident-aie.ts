import type { ConvItem } from "./types";

/**
 * Incident Debugging — AI Engineer role (RAG / agents / LLM apps).
 *
 * Eight production-incident scenarios the candidate investigates by reading
 * retrieval/agent code, agent traces, prompt templates, latency/cost/token logs
 * and index/model config, then running SQL/Python in-browser. The diagnosed root
 * cause / fix / red herrings / triage live SERVER-SIDE in incident-aie.server.ts
 * (resolved by problemId) and never ship to the client. ids match across files.
 *
 * Grounded in 2025–2026 RAG/agent failure-mode write-ups: embedding model
 * version mismatch (query model ≠ index model — looks like hallucination),
 * stale-index/deleted-doc serving, context-truncation hallucination spikes,
 * reranker-in-hot-path latency cliffs, chunk↔doc id off-by-one citations,
 * retrieved-k/dedup token-spend blowups, and the "$47K agent loop" that resends
 * full history every turn (O(n²) tokens). Tier spread: 2 standard, 4 hard, 2 hellish.
 */

/* ──────────────────────────────────────────────────────────────────────────
 * 1) EMBEDDING MODEL VERSION MISMATCH  (hellish)
 * ────────────────────────────────────────────────────────────────────────── */

const EMB_RETRIEVAL_PY = `# retrieval.py — embeds the query and searches the vector index.
# The index was BUILT by an offline batch job (ingest.py, not changed in months).
from openai import OpenAI
client = OpenAI()

# bumped in last week's "routine deps + config refresh" PR
QUERY_EMBED_MODEL = "text-embedding-3-large"   # 3072-dim

def retrieve(question: str, k: int = 6):
    q = client.embeddings.create(model=QUERY_EMBED_MODEL, input=question)
    qvec = q.data[0].embedding
    # cosine search over the prebuilt index; returns nearest chunks
    hits = index.query(vector=qvec, top_k=k, include_metadata=True)
    return [h["metadata"]["text"] for h in hits["matches"]]
`;

const EMB_INGEST_PY = `# ingest.py — OFFLINE batch that built the live index (unchanged for ~5 months).
QUERY_EMBED_MODEL = "text-embedding-3-small"   # 1536-dim  <-- index was built with THIS

def build_index(docs):
    for d in docs:
        v = client.embeddings.create(model=QUERY_EMBED_MODEL, input=d["text"])
        index.upsert(id=d["id"],
                     vector=v.data[0].embedding,
                     metadata={"text": d["text"], "embed_model": QUERY_EMBED_MODEL})
`;

const EMB_TRACE = `# trace: support bot answering "what is the refund window for Pro?"  (KB clearly states 30 days)
[12:02:11] retrieve  q="refund window for Pro plan"  model=text-embedding-3-large  dim=3072
[12:02:11] index     top_k=6  returned 6 matches  (scores: 0.41, 0.39, 0.38, 0.37, 0.36, 0.35)
[12:02:11] context   chunks=[onboarding-checklist, sso-setup, billing-glossary, ...]  # NONE about refunds
[12:02:12] generate  answer="Pro plans can be refunded within 14 days of purchase."   # WRONG + not in KB
[12:02:12] eval      groundedness=0.21  faithfulness=FAIL   # flagged as hallucination
`;

const EMB_CONFIG = `# index_config.yaml — pulled from the vector DB control plane (read-only)
index_name: kb-prod-v3
metric: cosine
dimension: 1536          # index vectors are 1536-dim
total_vectors: 48211
build_job: ingest.py @ 2026-01-09        # last full rebuild
build_embed_model: text-embedding-3-small
# NOTE: the live query path sets its own model; control plane does not enforce a match
`;

const EMB_SETUP_SQL = `-- retrieval_logs: one row per production query. score = top-1 cosine similarity.
CREATE TABLE retrieval_logs (
  ts            TIMESTAMP,
  question      VARCHAR,
  query_model   VARCHAR,
  index_model   VARCHAR,
  top1_score    DECIMAL(4,3),
  groundedness  DECIMAL(4,3),
  deploy        VARCHAR
);
INSERT INTO retrieval_logs VALUES
  -- BEFORE last week's deploy: query model == index model, scores high, grounded
  (TIMESTAMP '2026-05-20 09:00:00','reset my password','text-embedding-3-small','text-embedding-3-small',0.871,0.94,'2026-05-12'),
  (TIMESTAMP '2026-05-20 09:05:00','refund window for Pro','text-embedding-3-small','text-embedding-3-small',0.864,0.91,'2026-05-12'),
  (TIMESTAMP '2026-05-20 10:00:00','how to enable SSO','text-embedding-3-small','text-embedding-3-small',0.882,0.93,'2026-05-12'),
  -- AFTER deploy 2026-05-26: query model bumped to -large, index still -small. scores collapse, groundedness tanks
  (TIMESTAMP '2026-05-27 09:00:00','reset my password','text-embedding-3-large','text-embedding-3-small',0.412,0.22,'2026-05-26'),
  (TIMESTAMP '2026-05-27 09:05:00','refund window for Pro','text-embedding-3-large','text-embedding-3-small',0.408,0.21,'2026-05-26'),
  (TIMESTAMP '2026-05-27 10:00:00','how to enable SSO','text-embedding-3-large','text-embedding-3-small',0.397,0.19,'2026-05-26'),
  (TIMESTAMP '2026-05-28 11:00:00','cancel my subscription','text-embedding-3-large','text-embedding-3-small',0.401,0.18,'2026-05-26');
`;

/* ──────────────────────────────────────────────────────────────────────────
 * 2) AGENT COST RUNAWAY ~$47K  (hellish)
 * ────────────────────────────────────────────────────────────────────────── */

const AGENT_LOOP_PY = `# agent_loop.py — research agent: planner <-> tools, runs until "DONE".
def run_agent(task):
    history = [{"role": "system", "content": SYSTEM_PROMPT},
               {"role": "user", "content": task}]
    for step in range(1000):               # generous safety cap
        resp = llm.chat(messages=history)  # <-- bills for the ENTIRE history every call
        history.append({"role": "assistant", "content": resp.text})
        if resp.tool_calls:
            for tc in resp.tool_calls:
                out = run_tool(tc)          # full tool output appended raw, never summarized
                history.append({"role": "tool", "content": out})
            continue
        if "DONE" in resp.text:
            return resp.text
    return history[-1]["content"]
`;

const AGENT_TRACE = `# trace: one research task. input_tokens grow every turn (full history re-sent).
turn  role         tool            input_tokens  output_tokens  cumulative_$
1     assistant    web_search      5,100         220            0.02
2     assistant    web_search      9,800         260            0.05
3     assistant    fetch_page      18,400        300            0.11
4     assistant    fetch_page      34,900        280            0.23
5     assistant    fetch_page      66,200        310            0.46
6     assistant    web_search      129,500       290            0.93
7     assistant    fetch_page      256,800       300            1.88
# ...agent keeps "verifying" and re-fetching; never emits DONE...
# planner and verifier ping-pong; full transcript re-sent each turn => O(n^2) tokens
`;

const AGENT_COST_LOG = `[agent-svc] WARN  task 8f2a running 4h12m, 191 turns, no terminal state
[agent-svc] WARN  task 8f2a input_tokens this turn = 1,930,000
[finops]    ALERT daily LLM spend $11,400 (7d avg $310)  -> projecting ~$47K before month end
[agent-svc] NOTE  max_turns=1000; budget "alert" fires but does not STOP the run
[agent-svc] NOTE  planner asks verifier to "double-check"; verifier asks planner to "re-plan" — loop
`;

const AGENT_SETUP_SQL = `-- agent_turns: per-turn token accounting for the runaway task.
CREATE TABLE agent_turns (
  task_id       VARCHAR,
  turn          INTEGER,
  tool          VARCHAR,
  input_tokens  INTEGER,
  output_tokens INTEGER,
  emitted_done  BOOLEAN
);
INSERT INTO agent_turns VALUES
  ('8f2a',1,'web_search',5100,220,false),
  ('8f2a',2,'web_search',9800,260,false),
  ('8f2a',3,'fetch_page',18400,300,false),
  ('8f2a',4,'fetch_page',34900,280,false),
  ('8f2a',5,'fetch_page',66200,310,false),
  ('8f2a',6,'web_search',129500,290,false),
  ('8f2a',7,'fetch_page',256800,300,false),
  ('8f2a',8,'fetch_page',511000,295,false),
  ('8f2a',9,'web_search',1014000,305,false),
  ('8f2a',10,'fetch_page',1930000,300,false);
`;

/* ──────────────────────────────────────────────────────────────────────────
 * 3) RAG ANSWERS WRONG OVERNIGHT — stale index / deleted docs still served  (hard)
 * ────────────────────────────────────────────────────────────────────────── */

const STALE_REINDEX_PY = `# reindex.py — nightly full rebuild of the KB index.
def reindex(docs):
    index.drop(); index.create(metric="cosine", dim=1536)   # fresh empty index
    for d in docs:                                            # docs = ALL rows in the docs table
        v = embed(d["text"])
        index.upsert(id=d["chunk_id"], vector=v, metadata={"text": d["text"], "doc_id": d["doc_id"]})
    # BUG: 'docs' query has no WHERE is_deleted = false, and drops the 'effective_date' field
    # so retracted/expired policy docs get re-indexed and served as current.
`;

const STALE_DOCS_QUERY = `-- docs_for_index.sql — the query reindex.py pulls "all docs" from
SELECT chunk_id, doc_id, text          -- NOTE: effective_date and is_deleted are NOT selected
FROM kb_docs;                          -- no filter: includes retracted + superseded docs
`;

const STALE_LOG = `[reindex] 02:00:03 nightly rebuild started
[reindex] 02:07:41 upserted 48,211 chunks (was 47,902 yesterday)   # MORE chunks after a cleanup?
[support]  09:14   user: "is the 2024 travel policy still valid?"  bot: "Yes — reimburse up to $75/night"
[support]  09:15   escalation: that policy was RETRACTED in March; current cap is $120/night
[recon]    09:20   3 retracted docs and 1 superseded pricing doc found live in the index
`;

const STALE_SETUP_SQL = `-- kb_docs: source of truth. is_deleted / effective_date decide what's CURRENT.
CREATE TABLE kb_docs (
  chunk_id       VARCHAR,
  doc_id         VARCHAR,
  text           VARCHAR,
  effective_date DATE,
  is_deleted     BOOLEAN
);
INSERT INTO kb_docs VALUES
  ('c1','travel-2025','Reimburse up to $120/night for lodging.', DATE '2025-03-01', false),
  ('c2','travel-2024','Reimburse up to $75/night for lodging.',  DATE '2024-01-01', true),   -- RETRACTED
  ('c3','pricing-v2','Pro plan is $49/mo.',                       DATE '2026-02-01', false),
  ('c4','pricing-v1','Pro plan is $39/mo.',                       DATE '2025-01-01', true),   -- SUPERSEDED
  ('c5','sso-guide','Enable SSO under Settings > Security.',      DATE '2025-06-01', false);
-- index_contents: what the rebuild actually loaded last night (mirrors the buggy query)
CREATE TABLE index_contents (
  chunk_id VARCHAR,
  doc_id   VARCHAR
);
INSERT INTO index_contents VALUES
  ('c1','travel-2025'),('c2','travel-2024'),('c3','pricing-v2'),('c4','pricing-v1'),('c5','sso-guide');
`;

/* ──────────────────────────────────────────────────────────────────────────
 * 4) HALLUCINATION SPIKE — context truncated at token limit  (hard)
 * ────────────────────────────────────────────────────────────────────────── */

const HALLU_BUILD_PY = `# build_prompt.py — assembles the generation prompt from retrieved chunks.
MODEL_CTX = 8192          # model context window (tokens)
RESERVE_OUTPUT = 1024

def build_prompt(question, chunks):
    instr = SYSTEM_PROMPT + "\\n\\nContext:\\n"
    body = "\\n\\n".join(c["text"] for c in chunks)   # 6 chunks, ~1100 tokens each
    prompt = instr + body + f"\\n\\nQuestion: {question}\\nAnswer using ONLY the context."
    # HARD-TRUNCATE to fit the window. Truncates the TAIL of the prompt...
    # ...which now includes the QUESTION and the "use ONLY the context" instruction.
    toks = tokenizer.encode(prompt)[: MODEL_CTX - RESERVE_OUTPUT]
    return tokenizer.decode(toks)
`;

const HALLU_PROMPT_TMPL = `You are a support assistant. Answer using ONLY the provided context.
If the answer is not in the context, say "I don't have that information."

Context:
{{chunks}}

Question: {{question}}
Answer using ONLY the context above. Cite the chunk id.`;

const HALLU_TRACE = `# trace: groundedness dropped from 0.92 -> 0.55 after retrieved-k was raised 4 -> 6 last sprint
[gen] prompt_tokens=7168 (capped at MODEL_CTX-RESERVE)   # before: 5100 with k=4, nothing truncated
[gen] decoded prompt ENDS at: "...Context:\\n<chunk-5 text> <chunk-6 text par"   # cut mid-chunk
[gen] MISSING from prompt: the Question line AND "Answer using ONLY the context" instruction
[gen] model output: long, fluent, confident — and ungrounded (answers from parametric memory)
[eval] faithfulness FAIL on 38% of k=6 traffic; 0% on k=4 traffic
`;

/* ──────────────────────────────────────────────────────────────────────────
 * 5) RAG LATENCY CLIFF — reranker in hot path / sync embed / no cache  (hard)
 * ────────────────────────────────────────────────────────────────────────── */

const LAT_PIPELINE_PY = `# rag_pipeline.py — synchronous request path. p99 went 0.6s -> 5.8s after the rerank rollout.
def answer(question):
    qvec = embed_api(question)                     # sync HTTP, no cache  (~120ms, spikes to 900ms)
    candidates = vstore.search(qvec, top_k=100)    # over-fetch 100
    # NEW last sprint: cross-encoder rerank, called PER candidate, synchronously, no timeout
    scored = [(c, rerank_api(question, c.text)) for c in candidates]   # 100 sequential API calls
    scored.sort(key=lambda x: -x[1])
    top = [c for c, _ in scored[:6]]
    return llm.generate(build_prompt(question, top))
`;

const LAT_LOG = `# latency_breakdown.log — span timings (ms) at p99, sampled from tracing
span                       p50     p99
embed_api (sync, no cache)  140     920
vstore.search(top_k=100)     35      80
rerank_api x100 (sequential) 410   4,600    <-- 100 sequential cross-encoder calls, no timeout
llm.generate                620   1,100
TOTAL                      1,205  6,700
# 71% of repeat queries are near-duplicates ("how do I reset password" variants) — but no cache layer
`;

const LAT_CONFIG = `# rag.yaml
retriever:
  top_k_candidates: 100        # over-fetch before rerank
reranker:
  enabled: true
  model: cross-encoder/ms-marco
  call_mode: per_candidate     # one API call per candidate
  batch: false                 # not batched
  timeout_ms: null             # no timeout -> tail latency unbounded
  skip_if_over_budget: false   # no fallback to skip rerank
cache:
  query_embedding_cache: false # no embed cache
  result_cache: false          # no result/semantic cache
`;

/* ──────────────────────────────────────────────────────────────────────────
 * 6) TOKEN SPEND SPIKE — retrieved-k too high / no chunk dedup / cache key broke  (hard)
 * ────────────────────────────────────────────────────────────────────────── */

const TOKEN_RETRIEVE_PY = `# context_builder.py — builds context for generation.
RETRIEVED_K = 25            # bumped from 8 -> 25 in last week's "improve recall" PR

def build_context(question):
    hits = vstore.search(embed(question), top_k=RETRIEVED_K)
    # no dedup: overlapping/duplicate chunks from the same doc are all included verbatim
    context = "\\n\\n".join(h.text for h in hits)
    return context        # often 18k+ tokens of largely redundant text
`;

const TOKEN_CACHE_PY = `# prompt_cache.py — provider prompt-caching wrapper.
def cache_key(system, context, question):
    # BUG: includes a per-request timestamp -> key is unique every call -> 0% cache hit
    return hash((system, context, question, time.time()))
`;

const TOKEN_SETUP_SQL = `-- llm_usage: per-request token + cache accounting.
CREATE TABLE llm_usage (
  ts             TIMESTAMP,
  request_id     VARCHAR,
  retrieved_k    INTEGER,
  unique_chunks  INTEGER,     -- distinct chunks after dedup
  prompt_tokens  INTEGER,
  cache_hit      BOOLEAN,
  cost_usd       DECIMAL(8,4)
);
INSERT INTO llm_usage VALUES
  -- before the PR: k=8, deduped, prompt-cache working
  (TIMESTAMP '2026-05-20 10:00:00','r1',8,8,5200,true,0.0060),
  (TIMESTAMP '2026-05-20 10:01:00','r2',8,7,4800,true,0.0008),
  (TIMESTAMP '2026-05-20 10:02:00','r3',8,8,5100,true,0.0009),
  -- after the PR: k=25, many duplicate chunks, cache never hits
  (TIMESTAMP '2026-05-27 10:00:00','r4',25,11,18600,false,0.0220),
  (TIMESTAMP '2026-05-27 10:01:00','r5',25,12,19100,false,0.0228),
  (TIMESTAMP '2026-05-27 10:02:00','r6',25,10,18900,false,0.0224);
`;

/* ──────────────────────────────────────────────────────────────────────────
 * 7) CITATIONS POINT TO WRONG DOCS — chunk_id↔doc_id off-by-one after re-chunk  (standard)
 * ────────────────────────────────────────────────────────────────────────── */

const CITE_MAP_PY = `# citation_map.py — maps retrieved chunk -> source doc for the citation footnote.
def attach_citations(chunks, doc_index):
    cites = []
    for ch in chunks:
        # doc_index is a list aligned to chunk_id; built AFTER a re-chunk last week
        cites.append(doc_index[ch.chunk_id])   # off-by-one: chunk_id is 1-based, list is 0-based
    return cites
`;

const CITE_BUILD_PY = `# build_doc_index.py — built the chunk_id -> doc mapping list during re-chunk.
def build(chunks):
    doc_index = []
    for ch in chunks:        # chunk_id assigned starting at 1
        ch.chunk_id = len(doc_index) + 1
        doc_index.append(ch.doc_id)   # list index 0 holds chunk_id 1's doc -> mapping is shifted
    return doc_index
`;

const CITE_TRACE = `# trace: answer text is CORRECT, but the [source] link is one doc off
[retrieve] top chunk: chunk_id=5  text="Refund window is 30 days."   (truly from doc 'refunds-v2')
[cite]     attach_citations -> doc_index[5] = 'sso-guide'    # should be doc_index[4] = 'refunds-v2'
[answer]   "Refunds are available for 30 days [source: SSO Setup Guide]"   # right answer, wrong cite
[support]  user clicks citation, lands on SSO doc, files "the bot is making things up" ticket
`;

/* ──────────────────────────────────────────────────────────────────────────
 * 8) AGENT NEVER FINISHES — no stopping condition  (standard)
 * ────────────────────────────────────────────────────────────────────────── */

const AGENT_NOSTOP_PY = `# task_agent.py — agent that should stop when the task is complete.
def run(task):
    state = init_state(task)
    while True:                          # <-- no max-iterations, no progress check
        action = planner(state)
        result = execute(action)
        state = update(state, action, result)
        # intended stop: planner returns action.type == "finish"
        # but planner keeps choosing "refine" / "re-verify"; "finish" path is unreachable
        # because is_complete() requires ALL sub-goals "verified", and verify always re-queues one
    # unreachable
`;

const AGENT_NOSTOP_TRACE = `# trace: task "summarize the Q2 report" — agent spins forever
step 1  plan=gather   -> fetched report
step 2  plan=summarize-> draft v1 produced
step 3  plan=verify   -> "section 3 needs re-check"  (re-queues a sub-goal)
step 4  plan=refine   -> draft v2
step 5  plan=verify   -> "section 3 needs re-check"  (same sub-goal re-queued)
step 6  plan=refine   -> draft v3
# ...identical verify/refine cycle repeats; is_complete() never returns True...
step 240 plan=verify  -> "section 3 needs re-check"
`;

export const INCIDENT_AIE_ITEMS: ConvItem[] = [
  // 1) hellish — embedding model version mismatch (looks like hallucination) — FREE
  {
    id: "inc-aie-embedding-model-mismatch",
    category: "incident",
    level: "senior",
    title: "Support bot went confidently wrong after a 'routine deps refresh'",
    company: "AI startup",
    difficulty: "hard",
    free: true,
    executes: false,
    mode: "text",
    starter: "",
    prompt:
      "SEV-1: since last week's 'routine deps + config refresh' deploy, the support bot answers are fluent but wrong — it invents refund windows, SSO steps, pricing. Eval flags it as a hallucination spike and leadership wants the model rolled back or a stronger guardrail. Nothing in the generation prompt changed. You have retrieval.py, ingest.py, an answer trace, the index config, and a retrieval_logs table. Investigate, then submit the real root cause and the fix.",
    hints: [
      "It looks like the LLM hallucinating — but check retrieval FIRST. Compare the top-1 cosine scores in retrieval_logs before vs after the deploy.",
      "Diff the embedding model used by retrieval.py against the one ingest.py used to BUILD the index (and the dimension in index_config.yaml).",
      "If the query is embedded by a different model than the index, the vectors live in a different space — scores collapse and the 'context' is unrelated chunks. The LLM is just answering from memory because retrieval gave it junk.",
    ],
    idealAnswer: "",
    rubric: [
      "Investigates retrieval before blaming the model — inspects scores/context, not just the final answer",
      "Root cause: query embedding model (text-embedding-3-large/3072-d) ≠ index embedding model (text-embedding-3-small/1536-d) after the deploy",
      "Explains WHY it presents as hallucination: mismatched vector spaces -> near-random retrieval -> ungrounded generation",
      "Notes the dimension mismatch / lack of an enforced model-match check as the gap",
      "Fix: pin query model to the index's build model (or re-embed the whole index with -large), and add a provenance/dimension assertion in CI + at query time",
      "Triage: revert the query-model bump to mitigate immediately, don't 'fix' by swapping LLMs or loosening guardrails",
    ],
    incident: {
      brief:
        "After a 'routine deps + config refresh' deploy, the support bot's answers are fluent but factually wrong; eval calls it a hallucination spike. The generation prompt is unchanged. Find the real root cause and the fix.",
      severity: "SEV-1 · customer-facing",
      tier: "hellish",
      artifacts: [
        { name: "retrieval.py", kind: "code", language: "python", content: EMB_RETRIEVAL_PY },
        { name: "ingest.py", kind: "code", language: "python", content: EMB_INGEST_PY },
        { name: "logs/answer.trace", kind: "log", language: "trace", content: EMB_TRACE },
        { name: "index_config.yaml", kind: "config", language: "text", content: EMB_CONFIG },
      ],
      sql: { setupSql: EMB_SETUP_SQL, tables: ["retrieval_logs"] },
      python: true,
    },
  },

  // 2) hellish — agent cost runaway ~$47K (full history every turn) — FREE
  {
    id: "inc-aie-agent-cost-runaway",
    category: "incident",
    level: "senior",
    title: "A single agent run is on track to cost $47K",
    company: "AI startup",
    difficulty: "hard",
    free: true,
    executes: false,
    mode: "text",
    starter: "",
    prompt:
      "SEV-1 / FinOps: daily LLM spend jumped from a ~$310 average to $11,400 and is projected to hit ~$47K before month end. One research-agent task ('8f2a') has been running for hours with no terminal state, and per-turn input tokens are exploding. There IS a max_turns=1000 cap and a budget alert — yet costs keep climbing. You have the agent loop, a turn-by-turn trace, the cost log, and an agent_turns table. Find the root cause and the fix.",
    hints: [
      "Plot input_tokens by turn from agent_turns. Is the growth linear or super-linear? What does that tell you about what's being sent each call?",
      "Read agent_loop.py: what exactly is passed as `messages` every turn, and how big does `history` get? Tool outputs are appended raw and never summarized.",
      "A budget ALERT is not budget ENFORCEMENT, and max_turns=1000 is far too high. Also: why does the run never end? (planner/verifier ping-pong, no 'DONE').",
    ],
    idealAnswer: "",
    rubric: [
      "Quantifies the blowup: input tokens roughly double each turn -> resending full history => O(n²) cumulative tokens",
      "Root cause: the loop re-sends the entire (ever-growing, raw-tool-output) history on every call, with no termination/no-progress check",
      "Identifies that the budget 'alert' doesn't STOP the run and max_turns=1000 is effectively unbounded for cost",
      "Spots the planner↔verifier ping-pong that prevents reaching a terminal 'DONE' state",
      "Fix: hard budget/turn enforcement that kills the run; cap context (sliding window / summarize tool outputs); add a no-progress detector + a real stop condition",
      "Triage: kill task 8f2a now to stop the bleed, THEN fix the loop; mentions a hard per-task $ ceiling",
    ],
    incident: {
      brief:
        "Daily LLM spend went $310 -> $11,400, projecting ~$47K. Agent task 8f2a runs for hours with no terminal state; per-turn input tokens explode. A max_turns cap and budget alert exist but costs keep rising. Find the root cause and fix.",
      severity: "SEV-1 · cost",
      tier: "hellish",
      artifacts: [
        { name: "agent_loop.py", kind: "code", language: "python", content: AGENT_LOOP_PY },
        { name: "logs/agent.trace", kind: "log", language: "trace", content: AGENT_TRACE },
        { name: "logs/cost.log", kind: "log", language: "text", content: AGENT_COST_LOG },
      ],
      sql: { setupSql: AGENT_SETUP_SQL, tables: ["agent_turns"] },
      python: true,
    },
  },

  // 3) hard — RAG wrong overnight: stale index / deleted docs served
  {
    id: "inc-aie-stale-index-deleted-docs",
    category: "incident",
    level: "mid",
    title: "RAG started serving retracted policies overnight",
    company: "Enterprise SaaS",
    difficulty: "hard",
    free: false,
    executes: false,
    mode: "text",
    starter: "",
    prompt:
      "SEV-2: this morning the assistant told a customer a RETRACTED 2024 travel policy ($75/night) is still valid; the current cap is $120/night. Reconciliation found 3 retracted docs and a superseded pricing doc live in the index. The nightly rebuild reported MORE chunks than the day before, even though a cleanup ran. You have reindex.py, the docs query it uses, the rebuild/support log, and kb_docs vs index_contents tables. Find the root cause and the fix.",
    hints: [
      "Join kb_docs to index_contents: which chunks are in the index that should NOT be (is_deleted = true)?",
      "Read the SELECT in docs_for_index.sql — what filter is missing, and which fields aren't selected?",
      "The rebuild drops effective_date and never filters is_deleted, so retracted/superseded docs are re-embedded and served as current. That's why chunk count went UP after a 'cleanup'.",
    ],
    idealAnswer: "",
    rubric: [
      "Queries to confirm retracted/superseded docs are present in the index (doesn't guess)",
      "Root cause: reindex pulls ALL kb_docs with no `is_deleted = false` filter, so retracted/superseded docs are re-indexed",
      "Notes the dropped `effective_date` field means the system can't pick the current version even when duplicates exist",
      "Explains the 'more chunks after cleanup' clue (deletes in source never propagate to the index rebuild)",
      "Fix: filter is_deleted/effective_date in the source query (serve only current versions); reconcile/delete the stale vectors now; add a source-vs-index count assertion",
      "Mentions hard-delete or soft-delete-with-filter so source deletions actually remove vectors",
    ],
    incident: {
      brief:
        "The assistant served a retracted 2024 policy as current. Recon found 3 retracted + 1 superseded doc live in the index; the nightly rebuild reported more chunks than yesterday despite a cleanup. Find the root cause and fix.",
      severity: "SEV-2 · customer-facing",
      tier: "hard",
      artifacts: [
        { name: "reindex.py", kind: "code", language: "python", content: STALE_REINDEX_PY },
        { name: "docs_for_index.sql", kind: "code", language: "sql", content: STALE_DOCS_QUERY },
        { name: "logs/reindex.log", kind: "log", language: "text", content: STALE_LOG },
      ],
      sql: { setupSql: STALE_SETUP_SQL, tables: ["kb_docs", "index_contents"] },
      python: false,
    },
  },

  // 4) hard — hallucination spike from context truncation at token limit
  {
    id: "inc-aie-hallucination-context-truncation",
    category: "incident",
    level: "mid",
    title: "Hallucinations spiked right after we 'improved recall'",
    company: "Enterprise SaaS",
    difficulty: "hard",
    free: false,
    executes: false,
    mode: "text",
    starter: "",
    prompt:
      "SEV-2: faithfulness dropped from 0.92 to 0.55 after last sprint's 'improve recall' change that raised retrieved-k from 4 to 6. The model's answers got longer, more confident, and less grounded. The generation prompt template itself looks correct. You have build_prompt.py, the prompt template, and a generation trace. Find the root cause and the fix.",
    hints: [
      "Compute the prompt token budget: 6 chunks at ~1100 tokens each, plus the system/instruction, vs MODEL_CTX - RESERVE_OUTPUT. Does it fit?",
      "Look at WHERE build_prompt truncates and WHAT lives at the tail of the assembled string.",
      "The hard-truncate cuts the END of the prompt — which is the Question and the 'use ONLY the context' instruction. The model loses its grounding instruction and answers from parametric memory.",
    ],
    idealAnswer: "",
    rubric: [
      "Computes/realizes k=6 overruns the context window while k=4 fit (token-budget reasoning)",
      "Root cause: hard tail-truncation drops the question + the 'answer using ONLY the context' instruction (not a model regression)",
      "Connects it to the observed symptom: longer, confident, ungrounded answers because the grounding instruction is gone",
      "Notes the prompt template is fine — the bug is in assembly/truncation order",
      "Fix: put instructions/question BEFORE the (truncatable) context, budget tokens for chunks (truncate/rank chunks not the instructions), or lower k / use a bigger-context model",
      "Suggests a guard: assert the question+instructions survive assembly; eval gate on faithfulness before rollout",
    ],
    incident: {
      brief:
        "Faithfulness fell 0.92 -> 0.55 after retrieved-k went 4 -> 6. Answers are longer and confidently ungrounded. The prompt template looks correct. Find the root cause and fix.",
      severity: "SEV-2 · quality",
      tier: "hard",
      artifacts: [
        { name: "build_prompt.py", kind: "code", language: "python", content: HALLU_BUILD_PY },
        { name: "prompts/generation.tmpl", kind: "config", language: "prompt", content: HALLU_PROMPT_TMPL },
        { name: "logs/generation.trace", kind: "log", language: "trace", content: HALLU_TRACE },
      ],
      python: true,
    },
  },

  // 5) hard — RAG latency cliff: reranker in hot path, sync embed, no cache
  {
    id: "inc-aie-rag-latency-cliff",
    category: "incident",
    level: "senior",
    title: "RAG p99 latency went off a cliff after the rerank rollout",
    company: "FAANG · search",
    difficulty: "hard",
    free: false,
    executes: false,
    mode: "text",
    starter: "",
    prompt:
      "SEV-2: p99 answer latency jumped from 0.6s to 5.8s right after last sprint's reranker rollout, and users are timing out. Quality looks fine. You have the synchronous pipeline code, a latency span breakdown, and the rag.yaml config. Find what's dominating the tail and the fix.",
    hints: [
      "Read latency_breakdown.log: which span dominates p99, and by how much vs p50?",
      "In rag_pipeline.py, how many rerank calls happen per request, are they batched/async, and is there a timeout?",
      "100 sequential cross-encoder calls with no timeout/no batching is the cliff; the sync no-cache embed and lack of a result cache (71% near-duplicate queries) make it worse.",
    ],
    idealAnswer: "",
    rubric: [
      "Reads the span breakdown and attributes the tail to the reranker (rerank_api x100 ~4,600ms p99)",
      "Root cause: reranker in the hot path called per-candidate, sequentially, no batching, no timeout, no skip-if-over-budget fallback",
      "Notes contributing factors: synchronous un-cached query embedding and no result/semantic cache despite ~71% near-duplicate queries",
      "Fix the reranker: batch the calls, run async/parallel, cap top_k_candidates, add a timeout + skip-rerank fallback (degrade gracefully)",
      "Add caching: query-embedding cache + semantic/result cache to kill repeat-query latency and load",
      "Triage: feature-flag/disable rerank or set a tight timeout to restore latency now, then re-enable batched",
    ],
    incident: {
      brief:
        "p99 latency went 0.6s -> 5.8s after the rerank rollout; users time out, quality is fine. Find what dominates the tail and the fix.",
      severity: "SEV-2 · latency",
      tier: "hard",
      artifacts: [
        { name: "rag_pipeline.py", kind: "code", language: "python", content: LAT_PIPELINE_PY },
        { name: "logs/latency_breakdown.log", kind: "log", language: "trace", content: LAT_LOG },
        { name: "rag.yaml", kind: "config", language: "text", content: LAT_CONFIG },
      ],
      python: true,
    },
  },

  // 6) hard — token spend spike: k too high, no dedup, cache key broke
  {
    id: "inc-aie-token-spend-spike",
    category: "incident",
    level: "senior",
    title: "Per-request token spend tripled overnight",
    company: "Devtools",
    difficulty: "hard",
    free: false,
    executes: false,
    mode: "text",
    starter: "",
    prompt:
      "SEV-2 / FinOps: per-request LLM cost roughly tripled after last week's 'improve recall' PR, and prompt-cache hit rate dropped to ~0%. Quality is unchanged. You have context_builder.py, the prompt-cache wrapper, and an llm_usage table. Find the root cause(s) and the fix.",
    hints: [
      "From llm_usage, compare retrieved_k vs unique_chunks and prompt_tokens before vs after the PR. How much of the context is redundant?",
      "Read prompt_cache.py: what's in the cache key? Why would the hit rate go to zero?",
      "Three compounding issues: k bumped 8 -> 25, no chunk dedup (lots of overlapping chunks), and a cache key that includes time.time() so it never matches.",
    ],
    idealAnswer: "",
    rubric: [
      "Quantifies the blowup from llm_usage (prompt_tokens ~5k -> ~19k; unique_chunks << retrieved_k; cache_hit false)",
      "Root cause 1: retrieved_k raised 8 -> 25, inflating prompt tokens for little recall gain",
      "Root cause 2: no chunk dedup — overlapping/duplicate chunks included verbatim",
      "Root cause 3: prompt-cache key includes time.time(), so it's unique per request -> 0% cache hits",
      "Fix: dedup chunks, tune k back down (or rerank-then-trim), and remove the timestamp from the cache key so prompt caching works",
      "Mentions verifying recall didn't actually need k=25, and adding a token/cost regression guard in CI",
    ],
    incident: {
      brief:
        "Per-request token cost ~tripled and prompt-cache hit rate fell to ~0% after an 'improve recall' PR; quality unchanged. Find the root cause(s) and fix.",
      severity: "SEV-2 · cost",
      tier: "hard",
      artifacts: [
        { name: "context_builder.py", kind: "code", language: "python", content: TOKEN_RETRIEVE_PY },
        { name: "prompt_cache.py", kind: "code", language: "python", content: TOKEN_CACHE_PY },
      ],
      sql: { setupSql: TOKEN_SETUP_SQL, tables: ["llm_usage"] },
      python: true,
    },
  },

  // 7) standard — citations off-by-one after re-chunk
  {
    id: "inc-aie-citations-off-by-one",
    category: "incident",
    level: "mid",
    title: "Right answers, wrong citation links",
    company: "Devtools",
    difficulty: "medium",
    free: false,
    executes: false,
    mode: "text",
    starter: "",
    prompt:
      "SEV-3: users report the bot 'makes things up' — but the ANSWERS are correct; it's the [source] links that point to the wrong document (e.g. a refund answer cites the SSO guide). This started after last week's re-chunk. You have citation_map.py, build_doc_index.py, and a trace. Find the root cause and the fix.",
    hints: [
      "Read the trace: the retrieved chunk is right and the answer is right — only the doc the citation resolves to is off.",
      "In build_doc_index.py, how is chunk_id assigned, and at which list index is each doc_id stored?",
      "chunk_id starts at 1 but the list is 0-based, so doc_index[chunk_id] is always one doc ahead — classic off-by-one introduced by the re-chunk.",
    ],
    idealAnswer: "",
    rubric: [
      "Recognizes retrieval/answer are correct and isolates the bug to the citation mapping (not hallucination)",
      "Root cause: chunk_id is 1-based but doc_index is 0-based, so doc_index[chunk_id] is off by one",
      "Points to build_doc_index.py assigning chunk_id = len+1 while appending at index len",
      "Fix: index by chunk_id - 1, or use a dict keyed by chunk_id, or make chunk_id 0-based consistently",
      "Adds a regression test asserting chunk_id resolves to its own doc_id after a re-chunk",
    ],
    incident: {
      brief:
        "Answers are correct but citation links point one document off (refund answer cites the SSO guide). Started after a re-chunk. Find the root cause and fix.",
      severity: "SEV-3 · trust",
      tier: "standard",
      artifacts: [
        { name: "citation_map.py", kind: "code", language: "python", content: CITE_MAP_PY },
        { name: "build_doc_index.py", kind: "code", language: "python", content: CITE_BUILD_PY },
        { name: "logs/citation.trace", kind: "log", language: "trace", content: CITE_TRACE },
      ],
      python: true,
    },
  },

  // 8) standard — agent never finishes (no stopping condition)
  {
    id: "inc-aie-agent-no-stopping",
    category: "incident",
    level: "mid",
    title: "The summarizer agent never finishes",
    company: "AI startup",
    difficulty: "medium",
    free: false,
    executes: false,
    mode: "text",
    starter: "",
    prompt:
      "SEV-3: a 'summarize the Q2 report' agent task runs hundreds of steps and never returns; the worker queue is backing up. It's not a token explosion (each step is small) — it just never stops. You have task_agent.py and a step trace. Find the root cause and the fix.",
    hints: [
      "Look at the loop condition in task_agent.py — what makes it exit, and is that exit reachable?",
      "In the trace, what cycle repeats? Why does is_complete() never become true?",
      "verify always re-queues the same sub-goal ('section 3 needs re-check'), so all-sub-goals-verified is never satisfied, and there's no max-iterations / no-progress guard.",
    ],
    idealAnswer: "",
    rubric: [
      "Identifies the infinite loop: `while True` with no max-iterations and an unreachable stop condition",
      "Root cause: is_complete() requires all sub-goals verified, but verify always re-queues one, so 'finish' is never chosen",
      "Distinguishes this from the cost-runaway incident (it's a logic loop, not history-resend token growth)",
      "Fix: add a hard max-iterations cap AND a no-progress detector (stop if state/draft doesn't change across N steps)",
      "Fixes the verify logic so a passing sub-goal isn't re-queued, making the 'finish' path reachable",
    ],
    incident: {
      brief:
        "A 'summarize the Q2 report' agent runs hundreds of steps and never returns; the queue backs up. Per-step tokens are small — it just never stops. Find the root cause and fix.",
      severity: "SEV-3 · reliability",
      tier: "standard",
      artifacts: [
        { name: "task_agent.py", kind: "code", language: "python", content: AGENT_NOSTOP_PY },
        { name: "logs/agent.trace", kind: "log", language: "trace", content: AGENT_NOSTOP_TRACE },
      ],
      python: false,
    },
  },
];
