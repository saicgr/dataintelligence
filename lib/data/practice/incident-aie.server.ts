import "server-only";
import type { IncidentScenario } from "./incidents.server";

/**
 * SERVER-ONLY answer key for the AI-Engineer Incident Debugging scenarios.
 *
 * Keyed by the same problemId as INCIDENT_AIE_ITEMS in incident-aie.ts. Holds the
 * diagnosed root cause, the fix, contributing factors, red herrings (hellish),
 * triage order (hellish), the grading rubric, and the facts the coach MAY reveal.
 * `import "server-only"` keeps all of this off the client. Grounded in 2025–2026
 * RAG/agent failure-mode literature (embedding mismatch, stale index, context
 * truncation, reranker latency, token/cost blowups, citation off-by-one, no-stop loops).
 */
export const INCIDENT_AIE_SCENARIOS: Record<string, IncidentScenario> = {
  // 1) hellish — embedding model version mismatch (looks like hallucination)
  "inc-aie-embedding-model-mismatch": {
    actualRootCause:
      "Last week's 'deps + config refresh' PR bumped the QUERY embedding model in retrieval.py from text-embedding-3-small (1536-dim) to text-embedding-3-large (3072-dim), but the live index was built months ago by ingest.py using text-embedding-3-small (1536-dim) and was never re-embedded. Query and document vectors now live in different, incompatible embedding spaces, so nearest-neighbor search returns near-random chunks (top-1 cosine collapsed from ~0.87 to ~0.41). The LLM then has no relevant context and answers fluently from parametric memory — which the eval correctly flags as ungrounded. It looks like an LLM hallucination spike but retrieval silently broke.",
    actualFix:
      "Restore the match: either pin the query model back to text-embedding-3-small (the index's build model) — the fast mitigation — or do a full re-embed of the index with text-embedding-3-large and update the dimension. Add an enforced guard: assert query-model == index build_embed_model (and dimension match) at startup/query time, and a CI check on embedding provenance so a model bump can't ship without a matching re-index.",
    contributingFactors: [
      "Query path sets its own embedding model; the vector-DB control plane does not enforce a match with the index's build model",
      "A dimension mismatch (3072 vs 1536) that should have been a hard error was tolerated/normalized somewhere in the path",
      "Eval measured groundedness of the final answer but had no retrieval-quality (score/recall) gate to localize the break",
    ],
    redHerrings: [
      "It presents as an LLM hallucination spike, tempting a model rollback or stronger output guardrail — neither touches the real cause",
      "The generation prompt is unchanged and looks fine; staring at the prompt wastes time",
      "Blaming the embedding PROVIDER for a silent model update — here it's our own explicit model bump in the PR",
    ],
    triageOrder: [
      "Mitigate: revert the query-model bump (pin back to text-embedding-3-small) to restore correct retrieval immediately",
      "Root-cause: confirm via retrieval_logs that scores collapsed exactly at the deploy and that query_model != index_model",
      "Prevent: enforce query-model == index build model + dimension assertion in CI and at runtime; add a retrieval-quality eval gate",
    ],
    rubric: [
      "Investigates retrieval before blaming the model (inspects scores/returned chunks, not just the final answer)",
      "Root cause: query embedding model (3-large/3072) ≠ index build model (3-small/1536) -> incompatible vector spaces",
      "Explains WHY it presents as hallucination (mismatched spaces -> near-random retrieval -> ungrounded generation)",
      "Identifies the missing model/dimension-match enforcement as the systemic gap",
      "Fix: pin to the index's build model now (or re-embed the index) + add a provenance/dimension assertion",
      "Triage: revert the model bump to mitigate; rejects 'swap the LLM' / 'add a guardrail' non-fixes",
    ],
    facts: [
      { q: "Did the generation prompt change in the PR?", a: "No. The PR only touched dependency versions and a config value — including the query embedding model name." },
      { q: "When exactly did groundedness drop?", a: "Sharply at the 2026-05-26 deploy; before that it was ~0.9+." },
      { q: "Was the index rebuilt recently?", a: "No — the last full rebuild (ingest.py) was 2026-01-09 with text-embedding-3-small." },
      { q: "What are the cosine scores doing?", a: "top-1 fell from ~0.87 to ~0.41 right at the deploy." },
    ],
  },

  // 2) hellish — agent cost runaway ~$47K (full history every turn, no real stop)
  "inc-aie-agent-cost-runaway": {
    actualRootCause:
      "agent_loop.py re-sends the ENTIRE conversation history (system prompt + every assistant turn + every raw, unsummarized tool output) as `messages` on every LLM call. Because providers bill for the full input on each call, cumulative token cost grows quadratically (O(n²)) in the number of turns — input_tokens roughly double each turn (5k -> 10k -> 18k -> ... -> 1.93M by turn 10). Compounding it, the run never terminates: the planner and verifier ping-pong ('double-check' / 're-plan') so 'DONE' is never emitted, and the only ceiling is max_turns=1000, which is effectively unbounded for cost. The budget 'alert' fires but does not stop the run.",
    actualFix:
      "Stop resending raw history: use a sliding context window and/or summarize/compress prior turns and tool outputs (store full detail out-of-band, feed the model a compact running state). Add a HARD budget/turn ENFORCER that kills the run when a per-task token/$ ceiling or a sane max_turns (e.g. 15–25) is hit — not just an alert. Add a no-progress detector and a real terminal condition so planner/verifier can't loop forever.",
    contributingFactors: [
      "Tool outputs appended verbatim and never summarized, so each one permanently inflates every subsequent call",
      "max_turns=1000 is far too high to bound cost; the budget alert is observability, not enforcement",
      "No no-progress / loop detector, so the planner↔verifier ping-pong runs indefinitely",
    ],
    redHerrings: [
      "Per-turn OUTPUT tokens are small and flat (~300), tempting you to conclude the model is fine — the cost is all in re-sent INPUT",
      "Assuming a single expensive tool call is to blame; it's the cumulative history, not any one tool",
      "Believing max_turns/the budget alert already protect you — they exist but neither stops the run",
    ],
    triageOrder: [
      "Mitigate: kill task 8f2a now (and any sibling runaway) to stop the bleed; set a hard per-task $ ceiling on the service",
      "Root-cause: from agent_turns, show input_tokens ~double per turn (O(n²) cumulative) and that no DONE is ever emitted",
      "Prevent: context-window/summarization, hard turn+budget enforcement, no-progress detector + real stop condition",
    ],
    rubric: [
      "Quantifies it: input tokens roughly double per turn -> full-history resend => O(n²) cumulative tokens/cost",
      "Root cause: loop re-sends entire ever-growing (raw tool output) history every call with no termination",
      "Notes the budget alert doesn't STOP the run and max_turns=1000 is effectively unbounded for cost",
      "Spots the planner↔verifier ping-pong preventing a terminal 'DONE' state",
      "Fix: cap/compress context, hard budget+turn enforcement that kills the run, no-progress detector + stop condition",
      "Triage: kill 8f2a first; adds a hard per-task $ ceiling, doesn't just lower a logging threshold",
    ],
    facts: [
      { q: "Are output tokens also growing?", a: "No — output is ~300/turn and flat. The growth is entirely in re-sent input." },
      { q: "Does the run ever reach a terminal state?", a: "No. The planner and verifier keep asking each other to re-check/re-plan; 'DONE' is never emitted." },
      { q: "Isn't there a max_turns cap?", a: "Yes, max_turns=1000 — far too high to bound cost — and the budget alert only logs, it doesn't stop the run." },
      { q: "What happens to tool outputs?", a: "They're appended to history verbatim and never summarized, so they inflate every later call." },
    ],
  },

  // 3) hard — RAG wrong overnight: stale index / deleted docs served
  "inc-aie-stale-index-deleted-docs": {
    actualRootCause:
      "reindex.py's nightly full rebuild pulls 'all docs' via docs_for_index.sql, which has NO `WHERE is_deleted = false` filter and does not select effective_date. So retracted and superseded documents (the 2024 travel policy, the v1 pricing doc) get re-embedded and served as current. Deletions/retractions in the source kb_docs never propagate because the rebuild drops the whole index and reloads everything unfiltered — that's why chunk count went UP even though a cleanup ran.",
    actualFix:
      "Filter the source query to current docs only (is_deleted = false, and pick the latest by effective_date per doc family). Reconcile the live index now by removing the stale vectors (hard delete, or soft-delete-with-retrieval-filter). Add a guard: assert index vector count == count of current (non-deleted) source chunks after each rebuild, and alert on drift.",
    contributingFactors: [
      "Drop-and-rebuild reindex means source deletions are only honored if the rebuild query filters them — and it doesn't",
      "effective_date isn't carried into the index, so even with duplicates the system can't prefer the current version",
      "No source-vs-index reconciliation/count assertion to catch retracted docs going live",
    ],
    rubric: [
      "Queries kb_docs JOIN index_contents to confirm is_deleted/superseded docs are present in the index",
      "Root cause: reindex source query lacks an is_deleted/effective_date filter, so retracted docs are re-indexed",
      "Explains the 'more chunks after a cleanup' clue (source deletes never reach the rebuilt index)",
      "Notes dropped effective_date means no way to prefer the current version",
      "Fix: filter to current docs in the query, reconcile/remove stale vectors now, add a count-drift assertion",
      "Mentions hard-delete or soft-delete-with-filter so source deletions actually remove vectors",
    ],
    facts: [
      { q: "Are the retracted docs actually in the live index?", a: "Yes — index_contents includes c2 (travel-2024) and c4 (pricing-v1), both is_deleted in kb_docs." },
      { q: "Did the rebuild error?", a: "No, it succeeded — and reported MORE chunks than the prior day despite a cleanup." },
      { q: "Does the source mark these as deleted?", a: "Yes, kb_docs.is_deleted is true for the 2024 travel policy and v1 pricing." },
    ],
  },

  // 4) hard — hallucination spike from context truncation at token limit
  "inc-aie-hallucination-context-truncation": {
    actualRootCause:
      "Raising retrieved-k from 4 to 6 pushed the assembled prompt over the model context window. build_prompt.py concatenates instructions + context + question, then HARD-TRUNCATES the tail to fit MODEL_CTX - RESERVE_OUTPUT. With k=6 the context alone (~6.6k tokens) overflows, so truncation cuts the END of the string — which is the Question line and the 'Answer using ONLY the context' grounding instruction. The model is left with partial context and no grounding instruction, so it answers fluently from parametric memory. At k=4 nothing was truncated, so faithfulness was fine.",
    actualFix:
      "Stop letting truncation eat the instructions/question. Order the prompt so instructions + question come FIRST and the context is the only truncatable part; budget tokens for the context and truncate/rank the CHUNKS (drop lowest-ranked) rather than the prompt string. Alternatively lower k or use a larger-context model. Add an assertion that the question + grounding instruction survive assembly, and gate rollouts on a faithfulness eval.",
    contributingFactors: [
      "Truncation applied to the fully-assembled string instead of to the context chunks specifically",
      "Instructions/question placed at the END, the exact region the tail-truncation removes",
      "k was raised without re-checking the prompt token budget; no faithfulness gate on the change",
    ],
    rubric: [
      "Recognizes k=6 overruns the context window while k=4 fit (does the token math)",
      "Root cause: tail truncation drops the question + 'use ONLY the context' instruction, not a model regression",
      "Connects it to the symptom (longer, confident, ungrounded answers because grounding instruction is gone)",
      "Notes the prompt template is fine; the bug is assembly/truncation order",
      "Fix: instructions/question first, truncate chunks not instructions, or lower k / bigger context window",
      "Adds a guard asserting question+instructions survive assembly and a faithfulness eval gate",
    ],
    facts: [
      { q: "How big is each chunk?", a: "About 1100 tokens; 6 chunks is ~6.6k, plus system/instructions overflows the 8192 window minus the 1024 output reserve." },
      { q: "Is the prompt template wrong?", a: "No — the template is correct. The problem is in how build_prompt assembles and truncates it." },
      { q: "Was k=4 affected?", a: "No, k=4 traffic has 0% faithfulness failures; only k=6 traffic regressed." },
      { q: "What gets cut by the truncation?", a: "The tail — which contains the Question line and the 'Answer using ONLY the context' instruction." },
    ],
  },

  // 5) hard — RAG latency cliff: reranker in hot path, sync embed, no cache
  "inc-aie-rag-latency-cliff": {
    actualRootCause:
      "The reranker rollout put a cross-encoder in the synchronous hot path, called once PER candidate over 100 over-fetched candidates, sequentially, un-batched, with no timeout and no skip-if-over-budget fallback. Those 100 sequential calls add ~4,600ms at p99 and dominate the 6.7s tail. The synchronous, un-cached query embedding (p99 ~920ms) and the absence of any result/semantic cache (despite ~71% near-duplicate queries) make it worse.",
    actualFix:
      "Take the reranker out of the naive hot path: batch all candidates into one (or few) rerank calls, run async/parallel, cap top_k_candidates well below 100, and add a timeout with a graceful skip-rerank fallback so the tail is bounded. Add a query-embedding cache and a semantic/result cache to absorb the ~71% near-duplicate traffic. As immediate mitigation, feature-flag rerank off or set a tight timeout.",
    contributingFactors: [
      "top_k_candidates=100 over-fetch multiplies the per-candidate rerank cost",
      "Synchronous, un-cached embedding call with a long tail (p99 ~920ms)",
      "No result/semantic cache despite ~71% near-duplicate queries; no timeout/fallback on external calls",
    ],
    rubric: [
      "Reads the span breakdown and attributes the p99 tail to the reranker (~4,600ms from 100 sequential calls)",
      "Root cause: reranker in hot path, per-candidate, sequential, un-batched, no timeout, no fallback",
      "Notes contributing factors: sync un-cached embedding and no result cache despite ~71% duplicate queries",
      "Fix the reranker: batch + async + cap candidates + timeout with skip-rerank fallback",
      "Add caching: query-embedding cache + semantic/result cache",
      "Triage: disable/tighten rerank now to restore latency, then re-enable batched",
    ],
    facts: [
      { q: "Which span dominates p99?", a: "rerank_api x100 at ~4,600ms p99 — the rest of the path is well under a second except embedding's tail." },
      { q: "Did answer quality change?", a: "No, quality is fine; this is purely a latency regression from the rerank rollout." },
      { q: "Are the rerank calls batched?", a: "No — one synchronous call per candidate, 100 of them, no timeout." },
      { q: "How repetitive is the traffic?", a: "About 71% of queries are near-duplicates, but there's no cache layer." },
    ],
  },

  // 6) hard — token spend spike: k too high, no dedup, broken cache key
  "inc-aie-token-spend-spike": {
    actualRootCause:
      "Three compounding regressions from the 'improve recall' PR. (1) retrieved_k was raised 8 -> 25, inflating prompt tokens (~5k -> ~19k). (2) context_builder.py does no chunk dedup, so overlapping/duplicate chunks from the same doc are included verbatim (unique_chunks ~10–12 out of 25). (3) prompt_cache.py's cache_key includes time.time(), making every key unique, so the provider prompt cache never hits (cache_hit dropped to ~0%). Together they roughly tripled per-request cost with no quality gain.",
    actualFix:
      "Remove time.time() from the cache key so prompt caching works again (key on system + context + question only). Dedup retrieved chunks before assembling context. Tune retrieved_k back down (or rerank-then-trim) — verify recall didn't actually need 25. Add a per-request token/cost regression guard in CI.",
    contributingFactors: [
      "k bumped 8 -> 25 without measuring whether recall improved enough to justify the cost",
      "No chunk dedup, so near-duplicate chunks bloat the prompt",
      "Cache key includes a per-request timestamp, defeating prompt caching entirely",
    ],
    rubric: [
      "Quantifies from llm_usage: prompt_tokens ~5k -> ~19k, unique_chunks << retrieved_k, cache_hit false post-PR",
      "Root cause 1: retrieved_k raised 8 -> 25 inflating tokens",
      "Root cause 2: no chunk dedup -> redundant chunks in context",
      "Root cause 3: cache key includes time.time() -> ~0% prompt-cache hits",
      "Fix: drop timestamp from cache key, dedup chunks, tune k down (or rerank-then-trim)",
      "Adds a token/cost regression guard and verifies recall didn't actually require k=25",
    ],
    facts: [
      { q: "Did quality improve with k=25?", a: "No measurable quality change — recall gain was marginal; cost tripled." },
      { q: "Why did the cache stop hitting?", a: "The cache key includes time.time(), so it's unique every request and never matches." },
      { q: "How redundant is the context?", a: "Of 25 retrieved chunks, only ~10–12 are unique; the rest overlap." },
    ],
  },

  // 7) standard — citations off-by-one after re-chunk
  "inc-aie-citations-off-by-one": {
    actualRootCause:
      "Classic off-by-one introduced by last week's re-chunk. build_doc_index.py assigns chunk_id = len(doc_index) + 1 (1-based) but appends each doc_id at the current 0-based list index. citation_map.py then does doc_index[ch.chunk_id], so it reads the doc one position ahead — every citation resolves to the NEXT chunk's document. Retrieval and the answer are correct; only the citation link is wrong, which users misread as the bot 'making things up'.",
    actualFix:
      "Resolve citations consistently with the id scheme: index by chunk_id - 1, or (more robustly) store the mapping as a dict keyed by chunk_id rather than a positional list, or make chunk_id 0-based everywhere. Add a regression test asserting each chunk_id resolves back to its own doc_id after a re-chunk.",
    contributingFactors: [
      "1-based chunk_id paired with a 0-based positional list with no key check",
      "No test asserting citation -> source doc correctness after re-chunking",
      "Symptom (right answer, wrong link) masquerades as hallucination, misdirecting triage",
    ],
    rubric: [
      "Isolates the bug to citation mapping (recognizes retrieval/answer are correct, not a hallucination)",
      "Root cause: 1-based chunk_id indexed into a 0-based list -> off-by-one (always one doc ahead)",
      "Points to build_doc_index.py (chunk_id = len+1, append at len) as the mismatch source",
      "Fix: index by chunk_id - 1, or use a dict keyed by chunk_id, or make ids 0-based consistently",
      "Adds a regression test that chunk_id resolves to its own doc_id after a re-chunk",
    ],
    facts: [
      { q: "Are the answers actually wrong?", a: "No — the retrieved chunk and the answer text are correct; only the [source] link is off." },
      { q: "When did it start?", a: "After last week's re-chunk, which rebuilt the chunk_id -> doc mapping." },
      { q: "Which direction is the error?", a: "Always one document ahead — doc_index[chunk_id] instead of doc_index[chunk_id - 1]." },
    ],
  },

  // 8) standard — agent never finishes (no stopping condition)
  "inc-aie-agent-no-stopping": {
    actualRootCause:
      "task_agent.py runs `while True` with no max-iterations and an unreachable stop condition. The intended exit is the planner choosing action.type == 'finish', which only happens when is_complete() is true — but is_complete() requires ALL sub-goals 'verified', and the verify step always re-queues a sub-goal ('section 3 needs re-check'). So the verify/refine cycle repeats forever and 'finish' is never reached. Per-step tokens are small, so this is a logic loop (not the history-resend cost blowup).",
    actualFix:
      "Add a hard max-iterations cap AND a no-progress detector that stops if the draft/state doesn't change across N steps. Fix the verify logic so a sub-goal that passes is marked verified and not re-queued, making the 'finish' path reachable. Surface a terminal state (success or give-up) to the queue so workers don't back up.",
    contributingFactors: [
      "`while True` with no iteration cap or no-progress guard",
      "is_complete() depends on an all-verified condition that verify can never satisfy (always re-queues)",
      "No terminal give-up/timeout, so the worker queue backs up",
    ],
    rubric: [
      "Identifies the infinite loop: while True, no max-iterations, unreachable stop condition",
      "Root cause: is_complete() needs all sub-goals verified but verify always re-queues one, so 'finish' is never chosen",
      "Distinguishes it from the cost-runaway incident (logic loop, not token-growth from history resend)",
      "Fix: hard max-iterations cap + no-progress detector",
      "Fixes verify so a passing sub-goal isn't re-queued, making 'finish' reachable",
    ],
    facts: [
      { q: "Is this a token/cost explosion?", a: "No — per-step tokens are small and flat; it's a logic loop that never terminates." },
      { q: "What cycle repeats in the trace?", a: "verify -> 'section 3 needs re-check' -> refine -> verify ... the same sub-goal is re-queued every time." },
      { q: "Is there a max-iterations cap?", a: "No — the loop is `while True` with no iteration or no-progress guard." },
    ],
  },
};
