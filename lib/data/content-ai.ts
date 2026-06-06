import type { Authored, ToolTopics } from "./content-de";

export const AI_AUTHORED: Record<string, Authored[]> = {
  llms: [
    {
      category: "deep-dives",
      riskLevel: "high",
      freePreview: true,
      asked: 21,
      questionText:
        "How do you get reliable structured output (e.g. JSON) from an LLM in production?",
      answerStructured:
        "- Use the provider's **structured-output / tool-calling** mode with a strict schema rather than 'please return JSON' in the prompt — it constrains decoding to valid shapes.\n- Define the schema explicitly (JSON Schema / typed tool) and **validate on the way out**; reject + retry on parse failure with the error fed back.\n- Keep the schema **flat and typed**; deeply nested/ambiguous schemas raise failure rates.\n- Add **idempotency + bounded retries** and a fallback path so a single bad generation doesn't break the pipeline.\n- **Eval** the structured path: track parse-failure rate and field-level accuracy, not just 'looks right.'",
      explanationDeep:
        "The naive approach — asking for JSON in the prompt and `JSON.parse`-ing — fails a few percent of the time at scale: trailing prose, markdown fences, hallucinated fields. Production wants the model constrained to a schema via native structured output / tool calling, where the decoder can't emit invalid structure.\n\nThen you still validate against your schema and retry on failure, feeding the validation error back so the model self-corrects. Flat schemas with clear types and enums beat clever nested ones. And you measure it: parse-failure rate and per-field accuracy are real SLOs once an LLM is in a pipeline.",
      interviewerLens:
        "I'm listening for 'use the structured-output/tool API + validate + retry,' not 'prompt it to return JSON.' The senior tell is that they still validate and measure parse-failure rate — they treat the model as unreliable infrastructure and engineer around it, rather than trusting the prompt.",
      followupChain: [
        { question: "Why not just regex/repair the output?", answer: "Repair is a brittle band-aid that hides real failures and silently corrupts data. Constrain generation up front and validate; repair only as a last-resort fallback you alert on." },
        { question: "How does prompt caching change your design?", answer: "Caching the static system prompt / schema / few-shot prefix cuts cost and latency dramatically for repeated calls, so you structure the prompt with the stable part first and the variable input last." },
      ],
      redFlags: [
        { junior: "\"I ask it to return JSON and parse it.\"", senior: "\"I use structured-output/tool calling with a schema, then validate and retry on failure.\"" },
        { junior: "\"The model just knows the format.\"", senior: "\"I constrain decoding and measure parse-failure rate as an SLO.\"" },
      ],
      alternatePhrasings: [
        "\"How do you make an LLM return data your code can trust?\"",
        "\"How do you handle JSON parsing failures from a model?\"",
      ],
      interviewContexts: ["Asked at an AI-platform startup, Senior AI Engineer", "Came up in 2 LLM-infra interviews"],
    },
    {
      category: "tool-comparison",
      riskLevel: "medium",
      isComparison: true,
      comparisonTools: ["Fine-tuning", "RAG", "Prompting"],
      asked: 18,
      questionText:
        "Fine-tuning vs RAG vs prompt engineering — how do you decide?",
      answerStructured:
        "- **Prompting** first: cheapest, fastest to iterate; solves a surprising amount with few-shot + good instructions.\n- **RAG** when the problem is **knowledge/freshness/grounding** — the model needs facts it wasn't trained on or that change. Retrieval injects them at inference; easy to update.\n- **Fine-tuning** when the problem is **behavior/format/style or latency/cost**, not facts — you want consistent tone, a niche task, or to shrink prompt size.\n- They **compose**: fine-tune for format + RAG for facts is common.\n- Decision driver: is the gap *knowledge* (→RAG) or *behavior* (→fine-tune)? And what's the iteration speed / cost budget?",
      explanationDeep:
        "The classic mistake is fine-tuning to teach the model facts. Fine-tuning bakes in behavior and style; it's a poor and stale way to store knowledge, and it's expensive to redo when facts change. RAG is how you give a model knowledge — and you can update the index in minutes.\n\nSo I diagnose the gap. Wrong facts / out-of-date / needs citations → RAG. Right facts but wrong format/tone/too verbose, or you need to cut latency by trimming the prompt → fine-tune. Often both: fine-tune the shape, retrieve the substance. And always start with prompting because it's free to iterate.",
      interviewerLens:
        "The dividing line I want to hear is 'knowledge → RAG, behavior → fine-tune,' and that they'd try prompting first. Candidates who reach for fine-tuning to add knowledge reveal they haven't shipped LLM features — that's the expensive lesson everyone learns once.",
      followupChain: [
        { question: "When is fine-tuning clearly the right call?", answer: "Stable, narrow task with lots of labeled examples where you need consistent format/tone or lower latency/cost by shrinking the prompt — e.g. classification or a fixed extraction format at high volume." },
        { question: "Can RAG and fine-tuning conflict?", answer: "Yes — a model fine-tuned to be confident can override retrieved context. You manage it with prompt design (prefer context) and evals that check grounding/citation faithfulness." },
      ],
      redFlags: [
        { junior: "\"Fine-tune it on our docs so it knows them.\"", senior: "\"Docs are knowledge — that's RAG. Fine-tuning is for behavior/format.\"" },
      ],
      alternatePhrasings: ["\"Should we fine-tune or use RAG?\"", "\"How do you customize an LLM for our use case?\""],
      interviewContexts: ["Asked at 3 separate AI-engineering loops"],
    },
  ],
  rag: [
    {
      category: "deep-dives",
      riskLevel: "high",
      freePreview: true,
      asked: 25,
      questionText:
        "Your RAG system returns plausible but wrong answers. How do you debug it?",
      answerStructured:
        "- **Split retrieval from generation.** First check: did retrieval surface the right chunks at all? If the answer isn't in the retrieved context, it's a retrieval problem, not a model problem.\n- **Retrieval quality**: inspect top-k chunks, measure recall@k on a labeled set. Fix chunking (size/overlap), add **hybrid search** (BM25 + vector) and a **reranker**.\n- **Generation/grounding**: if the right context was retrieved but the answer is still wrong, tighten the prompt to answer *only* from context and to say 'I don't know,' and add **citation/faithfulness checks**.\n- **Chunking**: too-large chunks dilute relevance; too-small lose context. Tune to the content.\n- **Eval harness**: track retrieval recall AND answer faithfulness separately, so you know which half to fix.",
      explanationDeep:
        "The first instinct of juniors is to blame the model or swap to a bigger one. The senior move is to bisect: is the failure in retrieval or in generation? Log the retrieved chunks. If the supporting passage isn't in the top-k, no model can answer correctly — you fix retrieval (chunking, hybrid search, reranking, embeddings). If the passage *is* there but the answer's wrong, it's grounding — prompt it to use only the context and to abstain, and add a faithfulness check.\n\nChunking is the most under-rated lever: it determines what 'a result' even is. And you can't improve what you don't measure — separate retrieval recall@k from answer faithfulness, because they have different fixes.",
      interviewerLens:
        "I want the bisection instinct: retrieval vs generation, proven by inspecting the retrieved chunks. The candidates who say 'use a better model' have never debugged RAG. Naming hybrid search + reranking and *separate* metrics for retrieval and faithfulness is the strong senior signal.",
      followupChain: [
        { question: "How do you choose chunk size?", answer: "By content structure and the embedding model's effective context — semantically coherent units (sections/paragraphs) with some overlap usually beat fixed token windows. You tune it against retrieval recall on a labeled set." },
        { question: "Why add a reranker if vector search already ranks?", answer: "Vector similarity is a coarse first pass; a cross-encoder reranker scores query-document pairs jointly and is far more precise, so you retrieve top-50 cheaply then rerank to top-5." },
        { question: "How do you reduce hallucination specifically?", answer: "Constrain to context + allow 'I don't know,' lower the temperature, cite sources, and run a faithfulness eval (does each claim trace to a retrieved chunk?)." },
      ],
      redFlags: [
        { junior: "\"Use a bigger/better model.\"", senior: "\"First check whether retrieval even surfaced the right chunk — bisect retrieval vs generation.\"" },
        { junior: "\"Just embed everything and search.\"", senior: "\"Chunking, hybrid search, and reranking drive retrieval quality far more than raw embedding.\"" },
      ],
      alternatePhrasings: ["\"Why is my RAG bot hallucinating?\"", "\"How do you improve RAG accuracy?\""],
      interviewContexts: ["Asked at an enterprise-search startup, Senior AI Eng", "RAG-platform interview"],
    },
  ],
  vectordb: [
    {
      category: "deep-dives",
      riskLevel: "medium",
      freePreview: true,
      asked: 17,
      questionText:
        "Explain HNSW vs IVF indexes and the recall/latency/memory trade-offs.",
      answerStructured:
        "- Both are **approximate nearest-neighbor (ANN)** indexes — you trade exactness for speed.\n- **HNSW** (graph-based): excellent recall + low latency, but **high memory** and slower builds; great default for most workloads.\n- **IVF** (inverted-file/clustering): partitions vectors into cells, searches a few (`nprobe`); **lower memory**, tunable, but recall depends on `nprobe` and cluster quality.\n- Key knobs: HNSW `M`/`efSearch`, IVF `nlist`/`nprobe` — all dial the recall ↔ latency trade-off.\n- Add **metadata filtering** (and know that pre- vs post-filtering changes recall/latency); quantization (PQ) cuts memory at some recall cost.",
      explanationDeep:
        "The headline is that vector search at scale is approximate — exact KNN is too slow — so every index is a recall/latency/memory triangle. HNSW builds a navigable small-world graph: you get high recall and fast queries, paying with RAM. IVF clusters the space and only scans the nearest cells; it's lighter on memory and tunable via nprobe, but push nprobe too low and recall drops.\n\nIn practice HNSW is the safe default until memory cost bites, then IVF (often IVF+PQ) for huge corpora. The other real-world wrinkle is filtering: combining 'similar to X' with 'where tenant = Y' — pre-filtering is correct but can blow up latency, post-filtering is fast but can return too few results.",
      interviewerLens:
        "I'm checking you understand it's approximate and can name the trade-off triangle (recall/latency/memory) with at least one tuning knob. Bonus: metadata filtering pitfalls and quantization. Reciting 'HNSW is a graph' without the trade-offs is a junior answer.",
      followupChain: [
        { question: "pgvector vs a dedicated vector DB (Pinecone)?", answer: "pgvector keeps vectors next to your relational data with one system to operate — great until scale/latency demands specialized indexing, sharding, and hybrid features that a dedicated DB provides. Start with pgvector; graduate when it hurts." },
        { question: "What breaks with naive metadata filtering?", answer: "Post-filtering an ANN result can leave too few hits; pre-filtering restricts the search space but can be slow or unsupported. Good systems support filtered ANN that balances both." },
      ],
      redFlags: [
        { junior: "\"Just use cosine similarity over all vectors.\"", senior: "\"That's exact KNN — too slow at scale; you use an ANN index and accept a recall trade-off.\"" },
      ],
      alternatePhrasings: ["\"How does approximate nearest-neighbor search work?\"", "\"Which vector index would you choose and why?\""],
      interviewContexts: ["Asked at a vector-search infra team, Senior AI Eng"],
    },
    {
      category: "tool-comparison",
      riskLevel: "medium",
      isComparison: true,
      comparisonTools: ["pgvector", "Pinecone"],
      asked: 13,
      questionText:
        "pgvector vs Pinecone — which would you pick for a new product and why?",
      answerStructured:
        "- **pgvector**: vectors live in your existing Postgres — one system, transactional, easy joins with metadata, cheap to start. Limits show up at very large scale / high QPS / advanced index features.\n- **Pinecone (managed vector DB)**: purpose-built for scale — sharding, high QPS, low-latency ANN, hybrid search, minimal ops — at the cost of another vendor + spend.\n- **Pick pgvector** if you're already on Postgres, data is modest, and you value one fewer system. **Pick Pinecone** when scale/latency/availability demands specialization or you don't want to operate ANN yourself.\n- Migration path: start pgvector, move hot collections to a dedicated DB when it actually hurts.",
      explanationDeep:
        "I default to pgvector for most new products: keeping embeddings beside relational data removes a whole distributed-systems problem and lets you filter/join naturally. The honest limit is scale — billions of vectors, very high QPS, or needing the newest index/hybrid features — where a dedicated, horizontally-scaled vector DB earns its keep.\n\nThe senior answer resists 'use the shiny vector DB by default.' It's a cost/ops/scale decision, and 'start simple, graduate when measured pain appears' is usually right.",
      interviewerLens:
        "Same anti-tribal trap as Snowflake-vs-Databricks. I want the choice tied to scale, ops appetite, and existing stack — and ideally 'start with pgvector, migrate when it hurts,' which signals pragmatism over resume-driven design.",
      followupChain: [
        { question: "What's the first thing that breaks on pgvector at scale?", answer: "Index build time and memory, plus query latency under high QPS and large dimensionality — and combining heavy metadata filters with ANN. That's the signal to consider a dedicated DB." },
      ],
      redFlags: [
        { junior: "\"Always use a dedicated vector DB.\"", senior: "\"pgvector is plenty until scale/latency forces specialization.\"" },
      ],
      alternatePhrasings: ["\"Do we need a vector database or is Postgres enough?\""],
      interviewContexts: ["Asked at a seed-stage AI product team"],
    },
  ],
  agents: [
    {
      category: "deep-dives",
      riskLevel: "high",
      freePreview: true,
      asked: 19,
      questionText:
        "What are the common failure modes of LLM agents and how do you make them reliable?",
      answerStructured:
        "- **Looping / not terminating**: cap steps, add a budget, and detect repeated actions.\n- **Bad tool calls**: validate arguments against a schema, return structured errors the agent can recover from, and make tools idempotent.\n- **Compounding errors**: each step's mistake feeds the next — keep tasks short, checkpoint, and prefer deterministic code over the model for anything you can.\n- **Hallucinated tool use / wrong tool**: clear tool descriptions, few-shot examples, and restrict the toolset to what's needed.\n- **Reliability engineering**: evals on end-to-end task success, tracing/observability per step, human-in-the-loop for high-stakes actions, and guardrails on side-effecting tools.",
      explanationDeep:
        "Agents fail differently from single prompts because errors *compound* across steps and they can take real actions. So reliability is about bounding and observing the loop: step/cost budgets, schema-validated tool I/O, idempotent side effects, and graceful error returns so the agent can recover instead of spiraling.\n\nThe meta-principle: use the model for the fuzzy parts and deterministic code for everything else. Don't ask the agent to do arithmetic or enforce business rules it can get wrong — give it a tool. Then measure end-to-end task success with an eval set and trace every step, because 'it worked in the demo' is not reliability.",
      interviewerLens:
        "I want to hear that errors compound and that the answer is engineering discipline — budgets, validated/idempotent tools, evals, tracing, human-in-the-loop for risky actions — not 'use a better prompt.' Saying 'prefer deterministic code over the model where you can' is a senior tell that they've shipped agents and felt the pain.",
      followupChain: [
        { question: "How do you evaluate an agent?", answer: "End-to-end task-success rate on a curated task set, plus per-step traces; for non-deterministic output use rubric/LLM-as-judge with spot human review, and track regressions across prompt/model changes." },
        { question: "How do you keep a dangerous tool safe?", answer: "Least-privilege scopes, dry-run/confirmation steps, human-in-the-loop approval for irreversible actions, and idempotency so retries don't double-execute." },
      ],
      redFlags: [
        { junior: "\"Just prompt it better and it'll work.\"", senior: "\"Agents compound errors — I bound the loop, validate tools, and measure task success.\"" },
        { junior: "\"Let the agent do everything autonomously.\"", senior: "\"Deterministic code for what's deterministic; human-in-the-loop for high-stakes actions.\"" },
      ],
      alternatePhrasings: ["\"How do you productionize an LLM agent?\"", "\"Why do agents fail and how do you fix it?\""],
      interviewContexts: ["Asked at an agent-platform startup, Senior AI Eng", "Came up in 2 agent-focused loops"],
    },
  ],
};

export const AI_TOPICS: Record<string, ToolTopics> = {
  llms: {
    moreDeepDives: ["How do context windows and token limits shape your design?", "What is prompt caching and when does it pay off?", "Temperature/top-p — how do you set them per task?", "How do you control cost + latency at scale?"],
    decisions: ["Bigger model vs better prompt vs fine-tune?", "Streaming vs batch responses for UX?", "Self-host vs API model?"],
    quickRef: ["What is a token?", "What is the context window?", "What is temperature?", "What is top-p?", "What is prompt caching?", "Tool/function calling — what is it?", "What is a system prompt?", "What are few-shot examples?", "What is structured output?", "What is an embedding?"],
    redFlags: [{ junior: "\"Bigger model always wins.\"", senior: "\"Often a better prompt or RAG beats a bigger model at lower cost.\"" }],
    checklist: ["Structured output approach", "Prompt-caching strategy", "Cost/latency levers", "Fine-tune vs RAG decision", "Eval harness basics"],
    behavioral: ["A time you cut LLM cost", "Shipping your first LLM feature", "Debugging a flaky prompt"],
    reverse: ["Which models are in prod and why?", "How is LLM cost tracked?", "What's the eval setup?"],
  },
  rag: {
    moreDeepDives: ["Chunking strategies and overlap.", "Hybrid search (BM25 + vector) — why bother?", "Rerankers: cross-encoder vs bi-encoder.", "How do you evaluate retrieval quality?"],
    decisions: ["Chunk size: small vs large?", "Add a reranker or improve embeddings?", "Vector-only vs hybrid retrieval?"],
    quickRef: ["What is chunking?", "What is recall@k?", "What is a reranker?", "What is hybrid search?", "What is grounding?", "What is a faithfulness check?", "Dense vs sparse retrieval", "What is top-k?", "What is an embedding model?", "What is context stuffing?"],
    redFlags: [{ junior: "\"Bigger model fixes hallucination.\"", senior: "\"Fix retrieval first — bisect retrieval vs generation.\"" }],
    checklist: ["Retrieval vs generation bisection", "Chunking + overlap tuning", "Hybrid search + reranking", "Faithfulness/citation checks", "Recall@k eval"],
    behavioral: ["A time you fixed a hallucinating RAG bot", "Building eval for retrieval", "Scaling a RAG pipeline"],
    reverse: ["How do you measure retrieval quality?", "Hybrid search or vector-only?", "How fresh is the index?"],
  },
  vectordb: {
    moreDeepDives: ["Quantization (PQ) and memory trade-offs.", "Sharding and scaling vector search.", "Metadata filtering: pre vs post.", "Embedding dimensionality and its costs."],
    decisions: ["HNSW vs IVF for this workload?", "pgvector vs dedicated vector DB?", "Quantize for memory or keep full precision?"],
    quickRef: ["What is ANN?", "What is HNSW?", "What is IVF?", "What is recall in ANN?", "What is nprobe?", "What is product quantization?", "What is cosine vs dot product?", "What is metadata filtering?", "What is efSearch?", "What is a flat index?"],
    redFlags: [{ junior: "\"Scan all vectors with cosine.\"", senior: "\"That's exact KNN — use an ANN index at scale.\"" }],
    checklist: ["HNSW vs IVF trade-offs", "Recall/latency/memory triangle", "Metadata filtering pitfalls", "pgvector vs dedicated DB", "Quantization basics"],
    behavioral: ["Choosing a vector store under constraints", "Tuning recall vs latency", "A scaling problem you solved"],
    reverse: ["How many vectors / QPS?", "pgvector or dedicated?", "How is recall measured?"],
  },
  agents: {
    moreDeepDives: ["Tool/function calling design.", "Memory and state across steps.", "Planning vs ReAct loops.", "Multi-agent vs single-agent — when?"],
    decisions: ["Autonomous vs human-in-the-loop?", "Single powerful agent vs multi-agent?", "LLM-as-judge vs human eval?"],
    quickRef: ["What is a tool call?", "What is the ReAct pattern?", "What is an eval set?", "What is LLM-as-judge?", "What is a guardrail?", "What is agent memory?", "What is a step budget?", "What is idempotency (for tools)?", "What is human-in-the-loop?", "What is task-success rate?"],
    redFlags: [{ junior: "\"Let it run fully autonomously.\"", senior: "\"Bound the loop, validate tools, and gate risky actions with a human.\"" }],
    checklist: ["Agent failure modes", "Tool validation + idempotency", "Step/cost budgets", "Eval (task success) + tracing", "Human-in-the-loop for risk"],
    behavioral: ["An agent you shipped to prod", "Debugging a looping agent", "Adding evals to an agent"],
    reverse: ["How do you eval agents?", "What guardrails are in place?", "Where is human-in-the-loop required?"],
  },
};
