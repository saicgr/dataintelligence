import type { Authored, ToolTopics } from "../content-de";
import type { Level } from "../../types";

export const levels: Partial<Record<Level, { authored: Authored[]; topics: ToolTopics }>> = {
  // ─────────────────────────────────────────────────────────────
  // JUNIOR  — What a vector/embedding is, similarity metrics,
  //           what ANN means vs exact KNN, basic use cases
  // ─────────────────────────────────────────────────────────────
  junior: {
    authored: [
      // ── deep-dives ────────────────────────────────────────────
      {
        category: "deep-dives",
        riskLevel: "high",
        freePreview: true,
        asked: 28,
        questionText:
          "What is a vector embedding, and why do we store them in a vector database instead of a regular database?",
        answerStructured:
          "- A **vector embedding** is a dense list of numbers (e.g. 768 floats) that represents the meaning or features of an object — a sentence, image, or product — such that semantically similar objects have vectors that are close together in space.\n- Embeddings are produced by ML models (BERT for text, CLIP for images). The key property: two sentences that mean the same thing will have similar vectors even if the words are different.\n- A **regular relational database** stores exact values and retrieves them with equality or range filters. There is no efficient built-in way to ask 'find the 10 rows whose vector column is closest to this query vector' across millions of rows — doing it naively is O(n) with every row.\n- A **vector database** solves this with an **ANN index** (e.g. HNSW or IVF) — a data structure that enables fast approximate nearest-neighbor search at scale, trading a small accuracy loss for orders-of-magnitude speed gains.\n- Common use cases: semantic search, RAG (retrieval-augmented generation), recommendation systems, duplicate/anomaly detection.",
        explanationDeep:
          "The intuition for why you can't just use a regular database: similarity search is a geometric problem, not a lookup problem. Finding 'the 10 most similar vectors to this one' requires computing distances to every vector in the table — that's O(n) operations even with perfect indexing on the raw numbers, because a B-tree index on float values tells you nothing about proximity in high-dimensional space.\n\nANN indexes solve this by building a data structure that lets you navigate the embedding space efficiently. HNSW builds a graph where similar vectors are connected; you enter the graph and traverse toward the query, which is much faster than scanning every row. The trade-off is 'approximate' — you might miss the absolute nearest neighbor, but you'll find one that's very close, which is acceptable for most applications.\n\nThe vector database abstraction also solves storage for large embedding collections: 1M vectors at 768 dimensions in float32 is roughly 3 GB. Managing that at scale alongside ANN indexing, filtering, and update operations is non-trivial — purpose-built systems handle it much better than a general-purpose RDBMS.",
        interviewerLens:
          "I want to hear 'embeddings encode semantic similarity as geometric proximity' and 'regular indexes can't find nearest neighbors efficiently.' The ANN vs exact distinction is the core concept at this level. If you can also name one real use case (RAG, semantic search, recommendations), you've answered this completely. Junior candidates who just say 'it stores vectors' without explaining why that's different from a regular database haven't internalized the problem.",
        followupChain: [
          {
            question: "What's the difference between a vector and an embedding?",
            answer: "A vector is any list of numbers. An embedding is a vector that encodes the semantic meaning of data — it's a vector produced by a trained ML model so that similar inputs produce similar vectors. All embeddings are vectors, but not all vectors are embeddings."
          },
          {
            question: "Can you just store embeddings in a Postgres column?",
            answer: "Yes — with pgvector, Postgres can store and query vectors. For small datasets (under a few million vectors) this works well. At large scale, a dedicated vector database or a managed service like Pinecone provides better ANN index performance, built-in sharding, and managed updates."
          },
          {
            question: "What is a RAG pipeline and where does the vector database fit?",
            answer: "RAG (Retrieval-Augmented Generation) pairs an LLM with a knowledge base. The pipeline: embed documents and store in a vector DB; at query time, embed the user question, retrieve the closest document chunks via similarity search, and pass them as context to the LLM. The vector database is the retrieval layer."
          }
        ],
        redFlags: [
          {
            junior: "\"A vector database just stores arrays of numbers.\"",
            senior: "\"Vector databases store embeddings and build ANN indexes so you can find semantically similar items in sub-linear time — the index is what makes it different from a relational DB with a float array column.\""
          },
          {
            junior: "\"I'd just use a regular SQL database with a float array column.\"",
            senior: "\"That works at small scale, but without an ANN index, finding the nearest neighbors requires scanning every row — it doesn't scale past a few hundred thousand vectors.\""
          }
        ],
        alternatePhrasings: [
          "\"Why can't we just store vectors in Postgres and do exact search?\"",
          "\"Explain embeddings to me like I'm new to AI.\"",
          "\"What problem does a vector database solve?\""
        ],
        interviewContexts: [
          "Entry-level ML engineer screen at a Series B AI startup",
          "AI engineering fundamentals round at a RAG-focused company",
          "Asked at a junior data scientist interview focused on LLM tooling"
        ]
      },
      {
        category: "deep-dives",
        riskLevel: "high",
        asked: 22,
        questionText:
          "Explain cosine similarity, dot product, and Euclidean distance for vector search. When do you use each?",
        code: [
          {
            lang: "sql",
            label: "pgvector distance operators",
            lines: [
              "-- cosine distance",
              "ORDER BY emb <=> :q LIMIT 10;",
              "-- L2 / Euclidean",
              "ORDER BY emb <-> :q LIMIT 10;",
              "-- negative inner product",
              "ORDER BY emb <#> :q LIMIT 10;",
            ],
          },
        ],
        answerStructured:
          "- **Cosine similarity**: measures the angle between two vectors, ignoring magnitude. Formula: `cos(θ) = (A · B) / (|A| |B|)`. Ranges from -1 to 1; identical direction = 1. Best for **text embeddings** where vector length isn't meaningful — two documents of different length that discuss the same topic should still score high similarity.\n- **Dot product** (inner product): `A · B = Σ(Aᵢ × Bᵢ)`. Sensitive to both angle AND magnitude. When vectors are normalized to unit length, dot product equals cosine similarity. Use when your model produces normalized embeddings (many modern models do) — it's faster since no division needed.\n- **Euclidean distance** (L2): `||A - B||₂`. Measures straight-line distance in space. Sensitive to magnitude. Better for **image embeddings or continuous feature vectors** where the absolute distance in space has geometric meaning.\n- **Decision rule**: text/NLP models → cosine or dot product (check if model normalizes); image/dense feature models → check model card; models that output normalized unit vectors → use dot product for efficiency.",
        explanationDeep:
          "The most common junior mistake is treating these metrics as interchangeable. They are not, and using the wrong one can significantly degrade search quality. Cosine similarity captures directional alignment — it doesn't care if one vector is twice as long as another, only whether they point in the same direction. This is exactly what you want for text: a short sentence about 'dogs' and a long paragraph about 'dogs' should both be close to a query about 'dogs,' even though their vector magnitudes differ.\n\nDot product is almost identical to cosine when vectors are normalized. Most production embedding models (OpenAI Ada-002, sentence-transformers defaults) output unit-length vectors specifically so you can use dot product and skip the normalization step. This is a non-trivial speedup at scale. Always check your model's embedding normalization behavior before choosing a metric.\n\nEuclidean distance treats the embedding space as a physical space and measures actual geometric distance. For dense image features or coordinate-style embeddings where magnitude has semantic meaning, L2 is correct. For text, it often underperforms cosine because text embeddings cluster at similar magnitudes regardless of content.",
        interviewerLens:
          "I want to hear that cosine ignores magnitude, dot product equals cosine for normalized vectors, and that the choice depends on whether the model normalizes its output. Candidates who can say 'check your model card for normalization' are thinking like practitioners, not textbook readers. The L2 vs cosine distinction for text vs image is the mid-level signal at a junior screen.",
        followupChain: [
          {
            question: "If both vectors are unit-normalized, which is faster: cosine or dot product?",
            answer: "Dot product — cosine similarity requires dividing by the product of the two norms, which is an extra computation. When vectors are already unit-normalized, the norms are both 1, so dot product and cosine give the same result. Skip the division."
          },
          {
            question: "What is the curse of dimensionality and how does it affect similarity search?",
            answer: "In very high-dimensional spaces, distances between all pairs of points converge — everything becomes roughly equidistant. This makes nearest-neighbor search less meaningful because the signal-to-noise ratio in distances degrades. Practical mitigation: dimensionality reduction (PCA, UMAP), or models designed for the target dimension (e.g., OpenAI text-embedding-3-small allows truncation to lower dims)."
          }
        ],
        redFlags: [
          {
            junior: "\"I'd just use Euclidean distance for text search.\"",
            senior: "\"For text embeddings, cosine similarity is standard because it's magnitude-invariant. Euclidean distance penalizes longer documents unfairly.\""
          },
          {
            junior: "\"Cosine and dot product are the same thing.\"",
            senior: "\"Dot product equals cosine only when both vectors are unit-normalized. Cosine always normalizes; dot product doesn't — and many models normalize so you can use the faster dot product.\""
          }
        ],
        alternatePhrasings: [
          "\"What distance metric would you use for a text similarity search?\"",
          "\"Explain cosine similarity.\"",
          "\"When would you use L2 distance over cosine?\""
        ],
        interviewContexts: [
          "Junior AI engineer screen at a search startup",
          "ML fundamentals interview at a Series A NLP company"
        ]
      },
      {
        category: "deep-dives",
        riskLevel: "medium",
        asked: 18,
        questionText:
          "What is Approximate Nearest Neighbor (ANN) search and why do production vector databases use it instead of exact KNN?",
        answerStructured:
          "- **Exact KNN** (brute force): compute the distance from the query vector to every vector in the database, sort, return the top K. Guaranteed to find the true nearest neighbors. Time complexity: O(n × d) per query, where n = number of vectors and d = dimensions.\n- **ANN** (Approximate Nearest Neighbor): use an index structure (HNSW, IVF, LSH) to search a *subset* of the data space, returning results that are 'close enough' with high probability but not guaranteed to be the exact nearest neighbors. Orders-of-magnitude faster at scale.\n- **Trade-off**: ANN accepts a small reduction in **recall** (fraction of true nearest neighbors returned) in exchange for much lower **latency** and better **throughput**.\n- **Why ANN at scale**: at 100M vectors with 768 dimensions, exact KNN requires ~400B floating-point operations per query — not feasible in real-time. ANN can answer the same query in milliseconds.\n- **Tuning recall**: most ANN indexes let you trade recall for speed via a parameter (HNSW: `efSearch`; IVF: `nprobe`). A higher value = more search = higher recall = more latency.",
        explanationDeep:
          "The key insight is that for most applications, 'the 10 most similar items' and '10 items that are nearly as similar' are functionally equivalent. A recommendation system that returns products at 0.95 similarity instead of 0.97 delivers the same user experience. A semantic search returning 98% of the true top-10 results is indistinguishable from 100%. The practical value of that 1-2% recall loss bought with 100x latency speedup is an obvious trade.\n\nThe exceptions are rare: high-stakes similarity deduplication (financial fraud, copyright detection) might require exact search or very high recall guarantees. For these, you either use exact search (brute force FAISS flat index) on a smaller corpus, or verify ANN candidates with an exact re-ranking step.\n\nRecall is the key measurement for ANN systems. Recall@k = (number of true top-k neighbors found by ANN) / k. A system with Recall@10 = 0.95 means that on average it finds 9.5 of the 10 true nearest neighbors. Most production systems target 0.90-0.99 depending on the application.",
        interviewerLens:
          "The answer I want is 'exact KNN is O(n×d) per query — not feasible at scale — so ANN trades a small recall loss for much lower latency.' The recall-vs-latency framing and the mention of tuning parameters (efSearch, nprobe) signals someone who has actually worked with vector search systems, not just read about them.",
        followupChain: [
          {
            question: "How do you measure the quality of an ANN index?",
            answer: "Recall@k is the standard metric: the fraction of the true top-k nearest neighbors that the ANN index returns. You measure it by comparing ANN results to exact brute-force results on a validation set. Also track query latency (p50/p99) and throughput (QPS) to understand the full recall-latency trade-off curve."
          },
          {
            question: "When would you use exact KNN instead of ANN?",
            answer: "When the dataset is small (under ~100k vectors, brute force is fast enough), when recall must be 100% (fraud detection, copyright matching), or when you want to re-rank ANN candidates with exact distances as a final verification step."
          }
        ],
        redFlags: [
          {
            junior: "\"ANN just means the search is approximate, so it's less accurate.\"",
            senior: "\"ANN is a deliberate trade: you tune the recall-latency curve. At efSearch=200 you might get 98% recall at 3ms; at efSearch=50 you get 85% recall at 1ms. The application determines which point on that curve is acceptable.\""
          },
          {
            junior: "\"Exact search is always better if you can afford it.\"",
            senior: "\"At 100M+ vectors, exact search is not feasible in real-time regardless of hardware. ANN is the production reality, and well-tuned ANN with 98% recall is indistinguishable from exact in most applications.\""
          }
        ],
        alternatePhrasings: [
          "\"What is the difference between exact KNN and approximate nearest neighbor search?\"",
          "\"Why doesn't a vector database just do a brute-force search?\"",
          "\"Explain the recall-latency trade-off in vector search.\""
        ],
        interviewContexts: [
          "Entry-level AI engineering interview at a search platform",
          "Fundamentals screen at a vector-DB startup"
        ]
      },
      // ── decision-frameworks ───────────────────────────────────
      {
        category: "decision-frameworks",
        riskLevel: "medium",
        asked: 14,
        questionText:
          "How do you choose a similarity metric for a new vector search use case?",
        answerStructured:
          "- **First question**: does your embedding model normalize output vectors to unit length? If yes → use **dot product** (equals cosine, but faster). If no → use **cosine** for text/NLP, **L2** for image/spatial.\n- **Text and language models** (BERT, sentence-transformers, OpenAI embeddings): cosine or dot product. Magnitude doesn't carry semantic meaning; directional alignment does.\n- **Image or dense feature vectors**: L2 (Euclidean). Spatial distance in the embedding space often correlates with visual similarity.\n- **Recommendation systems**: dot product is common, especially with models trained with inner-product objectives (ANN retrieval stages of two-tower models).\n- **Rule of thumb**: check the model card or documentation — the right metric is almost always specified. Use the wrong one and recall drops significantly even though the index looks correct.\n- **Performance**: for unit-normalized vectors, dot product is fastest. Cosine adds a normalization step. L2 requires a square-root-based calculation.",
        explanationDeep:
          "This decision is more straightforward than it looks, but the wrong choice is surprisingly common in junior implementations. The root cause is treating similarity metrics as interchangeable. They're not — they measure different geometric properties and a model trained to produce meaningful cosine similarities will give poor results if you query it with L2 distance.\n\nThe practical workflow: (1) read the model card, (2) check if outputs are normalized, (3) pick the metric the model was trained with. If the card is ambiguous, compute a small benchmark: run 100 queries, compare top-10 results from cosine vs L2, and see which matches human judgment of 'similar.' This is a quick sanity check that catches misconfigurations before they reach production.",
        interviewerLens:
          "The answer I'm looking for is: 'read the model card first, then use the metric the model was optimized for.' Candidates who default to L2 for everything, or who don't know that normalized vectors make dot product equivalent to cosine, haven't implemented this in production.",
        followupChain: [
          {
            question: "Two text documents are very different in length. Which metric handles this better?",
            answer: "Cosine similarity — it's magnitude-invariant, so a short document and a long document about the same topic can still score high similarity. L2 distance would penalize the longer document because its vector tends to have a larger magnitude."
          }
        ],
        redFlags: [
          {
            junior: "\"I'd use L2 by default since that's the standard distance.\"",
            senior: "\"I check the model card — most text embedding models expect cosine or dot product. Using L2 on a cosine-trained model degrades recall meaningfully.\""
          }
        ],
        alternatePhrasings: [
          "\"Should I use cosine or L2 for my RAG retrieval step?\"",
          "\"What distance metric does OpenAI recommend for its embeddings?\"",
          "\"When would dot product outperform cosine similarity?\""
        ],
        interviewContexts: [
          "Junior AI engineer screen at a RAG-focused startup",
          "ML engineer interview at a search-relevance company"
        ]
      },
      {
        category: "decision-frameworks",
        riskLevel: "low",
        asked: 11,
        questionText:
          "When would you use a vector database versus a keyword search engine (like Elasticsearch) for a search feature?",
        answerStructured:
          "- **Keyword/BM25 search** (Elasticsearch, OpenSearch): matches on exact terms and term frequency. Fast, interpretable, great for queries with specific terms (product SKUs, names, codes). Fails when users use different words than the documents ('car' vs 'automobile').\n- **Semantic/vector search**: matches on meaning. Handles paraphrase, synonyms, multilingual queries. Better for natural-language queries ('something for a sore throat') and zero-shot retrieval over new content.\n- **Hybrid search**: combine both — BM25 for precision on known terms, vector search for recall on paraphrased queries. Weaviate and OpenSearch support native hybrid (BM25 + vector with a fusion step). Often outperforms either alone.\n- **Decision**: exact-match-heavy domain (e-commerce product IDs, error codes) → keyword first. Natural language, FAQ, long-tail queries → vector. Production systems serving general users → hybrid.\n- **Cost**: vector search adds embedding inference cost (GPU/API) and larger index sizes. Keyword search is cheaper to operate.",
        explanationDeep:
          "The semantic vs keyword distinction maps directly to what users type vs what's in the data. A keyword search for 'ibuprofen' finds documents containing 'ibuprofen' exactly. A semantic search for 'ibuprofen' also finds results mentioning 'Advil,' 'NSAID,' and 'pain reliever' — because those are geometrically close in the embedding space.\n\nHybrid search has become the production standard at scale because it combines the strengths of both. BM25 handles precision (exact term match) while vector search handles recall (semantic variants). The fusion step (Reciprocal Rank Fusion or a learned ranker) combines the two result lists. The result typically outperforms either alone, which is why Weaviate, Elastic, and most modern search systems support it natively.",
        interviewerLens:
          "I want to hear the paraphrase/synonym limitation of keyword search and the hybrid recommendation. Candidates who say 'always use vector search for everything' haven't thought about cost and the cases where exact-term matching is actually better.",
        followupChain: [
          {
            question: "What is BM25 and why does it still matter in a world with vector search?",
            answer: "BM25 is a probabilistic ranking function that scores documents by term frequency and inverse document frequency. It's extremely fast, interpretable, and handles exact-match precision well. Vector search can miss exact-match queries when embeddings are too coarse. Hybrid systems use BM25 for that precision while vector search adds recall for paraphrased queries."
          }
        ],
        redFlags: [
          {
            junior: "\"Vector search is always better than keyword search.\"",
            senior: "\"They solve different problems. Keyword search wins on exact-term precision and cost. Vector search wins on semantic recall. Production systems often use hybrid to get both.\""
          }
        ],
        alternatePhrasings: [
          "\"Should I replace Elasticsearch with a vector database?\"",
          "\"What is hybrid search?\"",
          "\"When does semantic search fail?\""
        ],
        interviewContexts: [
          "Junior AI engineer at a SaaS company building internal search",
          "Entry-level ML engineer at a customer support automation startup"
        ]
      },
      // ── tool-comparison ───────────────────────────────────────
      {
        category: "tool-comparison",
        riskLevel: "medium",
        isComparison: true,
        comparisonTools: ["pgvector", "Pinecone"],
        asked: 13,
        questionText:
          "pgvector vs Pinecone — when would you choose one over the other for a new project?",
        answerStructured:
          "- **pgvector**: Postgres extension that adds vector storage and HNSW/IVF indexes to your existing Postgres instance. Choose when: you already run Postgres, your vector count is under ~10M, you want SQL queries combining vector similarity with relational filters, and you want to avoid a new managed service.\n- **Pinecone**: managed, dedicated vector database. Choose when: you expect to scale past 50-100M vectors, you want automatic sharding and replication without ops overhead, and your team doesn't want to manage a Postgres cluster.\n- **Key trade-offs**:\n  - pgvector: zero new infra if you're already on Postgres; limited ANN performance at very large scale; filtering recall issues (post-filter only by default — see mid-level for details).\n  - Pinecone: purpose-built ANN, managed scaling, higher cost, vendor lock-in, less flexible querying (no arbitrary SQL joins).\n- **Pragmatic rule**: under 10M vectors and already on Postgres → pgvector. Over 50M vectors or need SLA-backed managed scale → Pinecone or Weaviate.",
        explanationDeep:
          "The pgvector vs Pinecone choice is really a build-vs-buy decision scoped to vector search. pgvector's strength is that it requires no new infrastructure — you get vector search in the same Postgres instance where your user table lives, enabling relational queries like 'find the 10 most similar documents owned by this user' as a single SQL join. That's hard to replicate in Pinecone, where you'd need to store metadata separately and retrieve it post-search.\n\nPinecone's strength is managed scale: automatic sharding, replication, and ANN index maintenance without any DBA effort. At 100M+ vectors, running and tuning a high-performance HNSW index in Postgres requires real expertise. Pinecone handles that as a service.\n\nThe 10-50M vector gray zone is where the decision is genuinely hard. pgvector with HNSW performs well up to ~10-50M vectors on appropriately sized hardware. Beyond that, operational complexity grows and a dedicated service often wins on total cost of ownership.",
        interviewerLens:
          "I want to hear the 'already on Postgres, under 10M vectors' vs 'need managed scale at 100M+' decision frame. Candidates who say 'Pinecone is always better' or 'pgvector is free so always use it' haven't thought through the operational trade-offs.",
        followupChain: [
          {
            question: "What does pgvector add to Postgres exactly?",
            answer: "A vector data type, cosine/L2/dot-product operators, and support for HNSW and IVF indexes on vector columns. You can `SELECT * FROM docs ORDER BY embedding <=> query_vec LIMIT 10` in SQL. The `<=>` operator is cosine distance; `<->` is L2."
          },
          {
            question: "What is Pinecone's serverless tier and how does it change the cost model?",
            answer: "Pinecone serverless charges by reads and writes rather than provisioned capacity. It's much cheaper for low-QPS or spiky workloads where you don't want to pay for idle resources. The trade-off is that cold starts and very high QPS can have less predictable latency compared to provisioned pods."
          }
        ],
        redFlags: [
          {
            junior: "\"I'd always use Pinecone because it's purpose-built.\"",
            senior: "\"If we're already on Postgres and under 10M vectors, pgvector adds zero operational overhead and supports relational joins. I'd only introduce Pinecone when the scale or SLA requirements justify the added complexity.\""
          }
        ],
        alternatePhrasings: [
          "\"Should I add a vector database or use pgvector?\"",
          "\"What are the limitations of pgvector at scale?\"",
          "\"Is Pinecone worth the cost?\""
        ],
        interviewContexts: [
          "Junior AI engineer at a startup with existing Postgres infrastructure",
          "ML engineer loop at a seed-stage AI company"
        ]
      }
    ],
    topics: {
      moreDeepDives: [
        "What is a flat (brute-force) FAISS index and when is it appropriate?",
        "Explain what chunking strategy means for a RAG pipeline and how it affects retrieval quality.",
        "What are the main categories of vector database products (cloud-managed, open-source, Postgres extensions)?",
        "How does an embedding model turn a sentence into a vector?",
        "What is recall@k and how do you measure it?"
      ],
      decisions: [
        "When do you choose semantic search over keyword search for a new product feature?",
        "At what scale does pgvector start to struggle and you should consider a dedicated vector DB?",
        "Which similarity metric to use — a decision framework based on model card and use case"
      ],
      quickRef: [
        "What is a vector embedding in one sentence?",
        "What does cosine similarity measure?",
        "What is ANN and why is it approximate?",
        "L2 vs cosine — which for text, which for images?",
        "What does recall@k mean?",
        "What is HNSW (one sentence)?",
        "What is pgvector?",
        "What is a RAG pipeline?",
        "What is Pinecone?",
        "What is the curse of dimensionality?"
      ],
      redFlags: [
        {
          junior: "\"A vector database is just a database that stores arrays.\"",
          senior: "\"It stores embeddings and indexes them with ANN structures (HNSW, IVF) so nearest-neighbor queries are sub-linear — that's fundamentally different from a regular DB.\""
        },
        {
          junior: "\"I'd use L2 distance for text similarity.\"",
          senior: "\"For text embeddings, cosine is standard because it's magnitude-invariant. I check the model card first.\""
        },
        {
          junior: "\"ANN is just inaccurate search.\"",
          senior: "\"ANN is a tunable trade-off: at high efSearch, recall can reach 98%+. You choose where on the recall-latency curve to operate based on the application.\""
        }
      ],
      checklist: [
        "Explain what an embedding is and why geometric proximity = semantic similarity",
        "Know the three main similarity metrics and when to use each",
        "Explain ANN vs exact KNN with a recall-latency trade-off framing",
        "Know when pgvector is enough vs when a dedicated vector DB is justified",
        "Be ready to describe one end-to-end use case (RAG, semantic search)"
      ],
      behavioral: [
        "Have you used embeddings or vector search in a project? Walk me through it.",
        "How do you explain vector similarity to a non-technical stakeholder?",
        "How did you decide which embedding model to use for a task?"
      ],
      reverse: [
        "What embedding models does the team use today?",
        "Is vector search already in production or is this a greenfield build?",
        "What scale of vectors are you working with — millions or billions?"
      ]
    }
  },

  // ─────────────────────────────────────────────────────────────
  // MID  — HNSW vs IVF internals, recall/latency/memory trade-offs,
  //        metadata filtering (pre vs post), index tuning knobs
  // ─────────────────────────────────────────────────────────────
  mid: {
    authored: [
      // ── deep-dives ────────────────────────────────────────────
      {
        category: "deep-dives",
        riskLevel: "high",
        freePreview: true,
        asked: 31,
        questionText:
          "Explain how HNSW works and what its key parameters (M, efConstruction, efSearch) do. How do you tune them?",
        code: [
          {
            lang: "sql",
            label: "build-time vs runtime",
            lines: [
              "CREATE INDEX ON docs USING hnsw",
              "  (emb vector_cosine_ops)",
              "  WITH (m=16, ef_construction=200);",
              "-- runtime recall knob, no rebuild",
              "SET hnsw.ef_search = 100;",
            ],
          },
        ],
        answerStructured:
          "- **HNSW** (Hierarchical Navigable Small World) is a multi-layer graph index where each node is a vector and nodes are connected to their nearest neighbors at each layer. The top layers are sparse (long-range connections), the bottom layer is dense (short-range). Search enters at the top and descends, greedy-walking toward the query vector.\n- **M**: number of bidirectional edges per node in the graph. Higher M → better connectivity → higher recall, but more memory and longer build time. Typical range: 8-64. M=16 is a common default.\n- **efConstruction**: size of the candidate list when building the graph (inserting nodes). Higher → better-quality graph → higher recall at query time, but slower index build. Typical range: 100-2000.\n- **efSearch** (or `ef` at query time): size of the dynamic candidate list during search. This is the **runtime recall knob** — higher efSearch → more candidates explored → higher recall → higher latency. Example: efSearch=50 may give 85% recall at 1ms; efSearch=500 may give 98% recall at 5ms.\n- **Tuning workflow**: set M and efConstruction once at build time for the recall floor you need; tune efSearch at query time to hit your latency SLA while maximizing recall. Build with efConstruction >= efSearch.\n- Memory cost: approximately `M × 4 bytes × n` for the graph structure on top of the raw vector storage.",
        explanationDeep:
          "The multi-layer structure is what makes HNSW fast. The top layers have few nodes with long edges — they cover the space in large strides. A query enters the top and quickly gets to the right neighborhood. The lower layers refine with shorter edges. This mimics the intuition of 'navigating a city via highways first, then local streets.' Without layers, you'd need to traverse the entire graph to find the nearest neighbor.\n\nThe M parameter controls the trade-off between graph quality and memory. Doubling M doubles the graph's edge storage. A dense graph is harder to get stuck in a local minimum, so recall improves — but you pay in RAM. For a 10M vector index with M=16, the graph adds roughly 640MB of edge storage. With M=32, that's 1.3GB. This is a non-trivial budget decision at production scale.\n\nefSearch is the knob that matters most in production operations. Unlike M and efConstruction, which are set once at build time and require a rebuild to change, efSearch can be adjusted per-query. Many systems expose this as a query parameter. If your recall@10 drops below an SLA threshold, increase efSearch — it's an immediate fix without reindexing. The cost is added latency per query.",
        interviewerLens:
          "I'm listening for the multi-layer graph navigation story and the M-efConstruction-efSearch distinction. The critical test is whether you know efSearch is the runtime lever (no rebuild needed) while M and efConstruction require a full index rebuild. Candidates who can give a realistic example with numbers (M=16, efSearch=200 → ~97% recall at 3ms) have clearly tuned this in production.",
        followupChain: [
          {
            question: "HNSW is known to struggle with updates — why?",
            answer: "HNSW was designed for static datasets. Inserting a new vector is fast (it's just connecting a new node), but deleting is expensive — you can't remove a node without breaking the graph's connectivity. Most implementations use 'soft delete' (mark as deleted, exclude from results) and periodically rebuild the index to remove them. This means HNSW has a 'graveyard' of deleted vectors still consuming memory until the rebuild."
          },
          {
            question: "How does memory usage scale with M and dataset size?",
            answer: "Graph edge storage is approximately M × 8 bytes × n (for float32 edges stored bidirectionally). For n=10M vectors with M=16: ~1.3GB for the graph, plus n × d × 4 bytes for the raw vectors (e.g., 30GB for d=768). The graph overhead is meaningful but usually smaller than the raw vector storage."
          },
          {
            question: "For a recommendation system requiring 98% recall, what parameters would you start with?",
            answer: "Start with M=24, efConstruction=400 at build time; then tune efSearch upward from 100 until recall@10 hits 98% on your validation set. Measure p99 latency at each efSearch value to find the acceptable point on the curve."
          }
        ],
        redFlags: [
          {
            junior: "\"HNSW is just a graph where vectors are connected to their neighbors.\"",
            senior: "\"HNSW is a hierarchical graph — the top layers navigate the space quickly in large strides, the bottom layer refines with short-range edges. The hierarchy is what makes it sub-linear.\""
          },
          {
            junior: "\"I'd tune M to get better recall.\"",
            senior: "\"M and efConstruction are build-time parameters that require a full rebuild. For a production recall SLA, I tune efSearch first — it's the runtime lever with no rebuild cost.\""
          }
        ],
        alternatePhrasings: [
          "\"How does HNSW differ from a flat index?\"",
          "\"What happens when you increase efSearch?\"",
          "\"How do you improve recall in an HNSW index without rebuilding it?\""
        ],
        interviewContexts: [
          "Mid-level AI engineer interview at a search platform",
          "Vector DB engineering screen at a Series B RAG startup",
          "Asked at a Weaviate-heavy engineering interview"
        ]
      },
      {
        category: "deep-dives",
        riskLevel: "high",
        asked: 24,
        questionText:
          "How does IVF (Inverted File) indexing work, what is nprobe, and when would you choose IVF over HNSW?",
        code: [
          {
            lang: "sql",
            label: "lists at build, probes at query",
            lines: [
              "CREATE INDEX ON docs USING ivfflat",
              "  (emb vector_l2_ops)",
              "  WITH (lists = 1000);",
              "-- nprobe: how many lists to scan",
              "SET ivfflat.probes = 10;",
            ],
          },
        ],
        answerStructured:
          "- **IVF** partitions the vector space into **nlist clusters** using k-means centroids at build time. Each vector is assigned to its nearest centroid and stored in that centroid's 'inverted list.'\n- **At query time**: compute the distance from the query vector to each centroid, pick the **nprobe closest centroids**, search only those clusters, return the best results found.\n- **nprobe** is the runtime recall knob: nprobe=1 searches only the nearest cluster (fast, low recall); nprobe=nlist searches all clusters (exact, slow). Typical production values: 10-50 out of 512-4096 clusters.\n- **Recall trade-off**: if the true nearest neighbor is in a cluster not searched (because nprobe is too small), it will be missed. Higher nprobe = higher recall = higher latency.\n- **IVF vs HNSW**:\n  - IVF: lower memory (just centroids + lists, no graph edges), faster build, but recall degrades badly with small nprobe; requires more data to train good centroids (rule of thumb: 30x-256x nlist training vectors).\n  - HNSW: consistently higher recall at low latency, higher memory (graph edges), better for dynamic updates (insert is O(log n)).\n- **Choose IVF** when: memory is severely constrained, build time matters, or the data is large and stable (batch indexed); often combined with PQ (IVF-PQ) for billion-scale.",
        explanationDeep:
          "IVF is conceptually simpler than HNSW: cluster the data, at query time search the nearby clusters. The simplicity is both its strength and weakness. Building an IVF index is fast — k-means clustering is embarrassingly parallel and scales to billions of vectors. The index itself is memory-efficient since you're just storing centroid IDs and lists, not a graph.\n\nThe weakness is recall degradation. Near the boundary between two clusters, the true nearest neighbor might be in a different cluster than the one the query is assigned to. You need to search multiple clusters (increase nprobe) to catch those boundary cases. With HNSW, the multi-layer graph navigates boundaries naturally because it explores graph neighborhoods rather than cluster partitions.\n\nIVF-PQ (IVF with Product Quantization) is the combination that powers billion-scale vector search. IVF partitions the space so you only search a fraction of vectors; PQ compresses the vectors in each partition so they fit in memory. This is the architecture behind FAISS at production scale (Meta, Google recommendation systems). The trade-off: training the quantizer and the centroids together, managing the nprobe×nlist matrix, and accepting recall that's typically lower than HNSW at equivalent latency.",
        interviewerLens:
          "The phrase I want is 'nprobe controls how many clusters you search — it's the runtime recall knob, like efSearch in HNSW.' The IVF-vs-HNSW comparison should come out as: HNSW for higher recall at lower memory budgets, IVF for very large scale where memory is tight and you combine it with PQ. Candidates who can name the training-data requirement (30x-256x nlist vectors) have clearly read the FAISS documentation.",
        followupChain: [
          {
            question: "What is the training data requirement for IVF and why does it matter?",
            answer: "The k-means centroids need to be trained on a representative sample of your data — typically 30x-256x your nlist value. With nlist=4096 clusters, you need 120K-1M training vectors. If the training set doesn't represent the full distribution, centroids will be misplaced and recall will suffer even with high nprobe."
          },
          {
            question: "What is IVF-PQ and when would you use it over plain HNSW?",
            answer: "IVF-PQ combines IVF partitioning with Product Quantization compression on the stored vectors. It enables billion-scale search that fits in memory, at the cost of lower recall than HNSW. Use it when your dataset is too large for HNSW's full memory footprint and you can accept 5-10% recall degradation."
          }
        ],
        redFlags: [
          {
            junior: "\"IVF is slower than HNSW so you should always use HNSW.\"",
            senior: "\"IVF is more memory-efficient and builds faster. At billion scale combined with PQ, it's often the only feasible option. The choice depends on recall requirements, memory budget, and dataset size.\""
          },
          {
            junior: "\"I'd set nprobe=1 to make queries fast.\"",
            senior: "\"nprobe=1 searches only one cluster and will have terrible recall unless your query vector is comfortably in the center of its cluster. I'd profile recall@k across several nprobe values and find the minimum nprobe that meets the recall SLA.\""
          }
        ],
        alternatePhrasings: [
          "\"Explain IVF indexing and how nprobe affects recall.\"",
          "\"When would you choose IVF-PQ over HNSW?\"",
          "\"Why does IVF recall degrade near cluster boundaries?\""
        ],
        interviewContexts: [
          "Mid-level ML engineer at a FAISS-heavy recommendation team",
          "AI engineering interview at a large-scale search platform",
          "Asked at a Milvus/Zilliz engineering screen"
        ]
      },
      {
        category: "deep-dives",
        riskLevel: "high",
        asked: 26,
        questionText:
          "Explain the metadata filtering problem in vector databases. What are pre-filter, post-filter, and integrated approaches, and what are their pitfalls?",
        code: [
          {
            accent: "bug",
            lang: "sql",
            label: "post-filter: WHERE after ANN",
            lines: [
              "SELECT id FROM docs",
              "WHERE lang = 'fr'   -- selective",
              "ORDER BY emb <=> :q",
              "LIMIT 10;",
              "-- ANN cands found first, then",
              "-- filtered -> few/no rows survive",
            ],
          },
          {
            accent: "fix",
            lang: "sql",
            label: "compensate: oversample then trim",
            lines: [
              "SET hnsw.ef_search = 400;",
              "SELECT id FROM docs",
              "WHERE lang = 'fr'",
              "ORDER BY emb <=> :q",
              "LIMIT 200;  -- app trims to 10",
              "-- or partial index per lang",
            ],
          },
        ],
        answerStructured:
          "- **The problem**: ANN indexes optimize for proximity, not boolean predicates. Adding a metadata filter ('only results where category=X') disrupts both recall and latency in ways that don't occur in relational databases.\n- **Post-filter (search then filter)**: run ANN on all vectors, then discard results failing the predicate. Problem: with a selective filter (only 1% of documents match), the top-k ANN candidates may include few matching documents — you return fewer than k results and miss closer matches. Requires oversampling (ask for 10x candidates), which spikes latency.\n- **Pre-filter (filter then search)**: apply the metadata filter first to get matching IDs, then run similarity search on that subset. Problem: if the filtered subset is large (10% of your corpus), you're doing near-linear scan. If the subset is small, you might get good recall but with expensive brute-force on the subset.\n- **Integrated filtering** (in-algorithm): modifies the index to respect the predicate during traversal. Examples: Weaviate's ACORN (two-hop graph expansion that keeps HNSW connectivity under selective filters), Qdrant's filterable HNSW (tags edges with metadata, prunes traversal at the index level), Pinecone's single-stage search. This is the current state of the art — best recall and latency under selective filters.\n- **pgvector's limitation**: uses post-filtering by default. Under tight filters (e.g., `WHERE user_id = X`), recall degrades significantly because the HNSW index returns candidates for all users and the filter discards most of them.",
        explanationDeep:
          "The core tension is architectural: ANN indexes encode proximity, not partitioning by metadata. A HNSW graph built on all documents knows which documents are semantically similar to each other, but it doesn't know which ones have `category='FAQ'`. When you add a category filter, you're asking the index to simultaneously navigate proximity AND enforce a boolean constraint — two objectives that don't align.\n\nPost-filtering is the naive approach and fails predictably under selective filters. If only 1% of your 10M vectors match the filter, a standard top-100 ANN search might return 100 vectors of which only 1 passes the filter. You return 1 result when you asked for 10. The workaround — oversample by 10x, asking for 1000 candidates — spikes latency to 200-300ms and still doesn't guarantee recall.\n\nWeaviate's ACORN algorithm specifically addresses this: when traversing the HNSW graph, instead of exploring only immediate neighbors, ACORN does a two-hop expansion — it explores neighbors-of-neighbors — to find matching candidates even when the direct neighbors don't pass the filter. This keeps recall high under selective filters without collapsing to brute force. The detail worth knowing for an interview is that this became the default in Weaviate v1.34 (2025).",
        interviewerLens:
          "This is a senior-leaning topic asked at mid-level in companies heavily using filtered vector search (e-commerce, multi-tenant SaaS). The key signals: naming all three approaches, knowing why post-filter fails under selective predicates, and knowing that integrated filtering (ACORN, filterable HNSW) is the right architecture. The pgvector recall degradation under filters is the gotcha that separates people who've run this in production.",
        followupChain: [
          {
            question: "How does pgvector's lack of integrated filtering affect a multi-tenant RAG system?",
            answer: "In a multi-tenant system, each user's documents are a tiny fraction of the total. A `WHERE tenant_id = X` filter is extremely selective — maybe 0.1% of vectors. pgvector post-filters, so the HNSW search returns candidates from all tenants, then discards most. Recall for a given tenant's query can drop to near zero. Workarounds: separate HNSW index per tenant (operationally expensive), or increase hnsw.ef_search (latency spike)."
          },
          {
            question: "What is ACORN and why does it improve filtered HNSW recall?",
            answer: "ACORN (Weaviate's algorithm) does two-hop graph expansion during HNSW traversal: when a neighbor doesn't satisfy the filter, ACORN explores that neighbor's neighbors before giving up on the neighborhood. This ensures the search doesn't get stuck in a region of the graph where all immediate neighbors fail the filter, preserving recall even for very selective predicates."
          }
        ],
        redFlags: [
          {
            junior: "\"I'd just add a WHERE clause after the vector search.\"",
            senior: "\"That's post-filtering — under selective filters, you'll miss most of the true nearest neighbors because they weren't in the ANN candidates. I'd use a system with integrated filtering (Weaviate, Qdrant) or understand the recall degradation and compensate with oversampling.\""
          },
          {
            junior: "\"Filtering is easy, it's just a WHERE clause.\"",
            senior: "\"In relational databases, filters narrow the search. In ANN indexes, selective filters can break recall entirely because the index wasn't built around the filter. It's one of the hardest problems in vector search system design.\""
          }
        ],
        alternatePhrasings: [
          "\"How do you handle filtered vector search correctly?\"",
          "\"Why does pgvector struggle with multi-tenant workloads?\"",
          "\"What is the difference between pre-filter and post-filter in a vector database?\""
        ],
        interviewContexts: [
          "Mid-level AI engineer at a multi-tenant SaaS company",
          "RAG system design interview at a Series B startup",
          "Asked at a Weaviate user's engineering interview"
        ]
      },
      {
        category: "deep-dives",
        riskLevel: "medium",
        asked: 16,
        questionText:
          "Walk me through the recall-latency-memory triangle in vector search. How do you reason about trade-offs when building a production system?",
        answerStructured:
          "- Vector search has three competing dimensions: **recall** (fraction of true nearest neighbors returned), **latency** (query response time), and **memory** (RAM required to serve the index).\n- You generally can't optimize all three simultaneously — improving one degrades another:\n  - Higher recall → higher efSearch/nprobe → higher latency (more computation per query).\n  - Lower memory → quantization (PQ/SQ) → lower recall (compressed distances are approximate).\n  - Lower latency → smaller index (fewer vectors, lower dimensionality) → lower recall or higher memory per vector.\n- **Production reasoning workflow**:\n  1. Define the recall SLA (e.g., Recall@10 >= 0.95).\n  2. Define the latency SLA (e.g., p99 < 50ms).\n  3. Size the memory budget (e.g., must fit in 64GB RAM).\n  4. Choose an index type that can meet all three given the dataset size — start with HNSW for recall and latency; add PQ if memory is the binding constraint.\n  5. Tune efSearch/nprobe to the minimum value that meets recall SLA.\n- **Typical starting point**: HNSW with M=16, efConstruction=200 for build; efSearch starting at 100 and tuned upward. Measure Recall@10 on a validation set.",
        explanationDeep:
          "The triangle metaphor is useful because it forces teams to make explicit choices instead of hoping the index 'just works.' In practice, most teams discover they've implicitly chosen low recall without realizing it — they set efSearch to the default, get 80% recall, and don't know they're missing 20% of relevant results because they haven't measured it.\n\nMeasuring recall in production is harder than it sounds. You need a ground-truth dataset: run exact brute-force search on a sample of queries, record the true top-k, then measure what percentage the ANN returns. Many teams skip this entirely and only discover recall problems when users complain about search quality.\n\nThe memory constraint often bites when teams underestimate index size. A 10M vector HNSW index with 768-dimensional float32 vectors requires ~30GB for raw vectors plus graph overhead. That doesn't fit on a standard 16GB instance. The practical response is scalar quantization (store 8-bit ints instead of 32-bit floats, 4x size reduction, ~1% recall loss) or product quantization (10-20x reduction, 5-15% recall loss). Many teams don't know quantization exists and instead vertically scale the instance — which is expensive and doesn't solve the root cause.",
        interviewerLens:
          "The triangle framing shows you think about vector search as an engineering trade-off, not a magic black box. The production workflow (define SLAs → choose index → tune parameters → measure recall) is what separates someone who has shipped a vector search system from someone who has only read about it. Mention that most teams don't measure recall — that's a real observation about the field.",
        followupChain: [
          {
            question: "What is scalar quantization and how does it help with memory?",
            answer: "Scalar quantization converts each float32 (4 bytes) in a vector to an int8 (1 byte), reducing memory by 4x with minimal recall loss (typically under 1%). It's the easiest compression step before considering product quantization. pgvector supports binary and scalar quantization for this reason."
          },
          {
            question: "How do you set latency and recall SLAs for a RAG retrieval system?",
            answer: "Latency: the retrieval step should consume at most 20-30% of the total request budget. If the LLM call is 1s, target <200ms for retrieval. Recall: for RAG, Recall@k at k=10-20 should be >0.90 — you're retrieving context chunks, and missing relevant context directly degrades generation quality. Measure by comparing ANN retrieval to exact search on a validation set."
          }
        ],
        redFlags: [
          {
            junior: "\"I'd just use the default settings and see if it works.\"",
            senior: "\"Default settings often give 80-85% recall, which may be fine or may be a silent quality problem. I always measure Recall@k on a validation set before going to production.\""
          },
          {
            junior: "\"More memory always means better performance.\"",
            senior: "\"More memory enables larger indexes and less quantization, which helps recall. But the binding constraint varies — sometimes it's latency or recall that you need to tune first.\""
          }
        ],
        alternatePhrasings: [
          "\"How do you tune a vector search system for production?\"",
          "\"What's the trade-off between recall and latency in HNSW?\"",
          "\"How do you decide whether to use quantization?\""
        ],
        interviewContexts: [
          "Mid-level AI engineer designing a production search system",
          "Technical design interview at a vector-DB-first startup"
        ]
      },
      // ── decision-frameworks ───────────────────────────────────
      {
        category: "decision-frameworks",
        riskLevel: "high",
        asked: 19,
        questionText:
          "How do you choose between HNSW and IVF for a new vector index? Walk me through your decision framework.",
        answerStructured:
          "- **Default choice: HNSW.** It gives consistently higher recall at lower latency for datasets up to ~100M vectors. Prefer it when recall is the priority and memory budget allows.\n- **Choose IVF when**:\n  - Dataset is extremely large (100M-1B+ vectors) and HNSW's memory footprint is prohibitive.\n  - You combine with Product Quantization (IVF-PQ) for billion-scale, memory-constrained environments.\n  - Build time matters: IVF builds faster than HNSW at large scale.\n  - Data is largely static (IVF is harder to update incrementally).\n- **Choose HNSW when**:\n  - You need high recall (>95%) with low latency (<10ms p99).\n  - The dataset has frequent updates (HNSW insert is O(log n)).\n  - Memory is not the primary constraint.\n- **Key numbers to know**: HNSW memory ≈ (4 × M × n) bytes for graph + raw vectors. IVF memory = centroids + lists (much smaller, but recall requires nprobe × nlist coverage).\n- **Hybrid option**: HNSW for the primary index, IVF-PQ as a compressed fallback for a cold tier or very large archive.",
        explanationDeep:
          "The HNSW default is well-supported by benchmarks: on the ann-benchmarks.com datasets, HNSW consistently reaches the Pareto frontier of recall vs latency across most dataset types. It's the right starting point unless you have a specific reason to deviate.\n\nThe IVF-PQ combination earns its place at scale that's genuinely too large for HNSW. A 1B vector dataset at 768 dimensions in float32 is 3TB of raw vectors — plus the HNSW graph overhead, you'd need 4-5TB of RAM. That's not feasible even on high-memory cloud instances. IVF-PQ compresses vectors by 20-40x, bringing that 3TB to 75-150GB. At the cost of ~10% recall, you get a manageable memory footprint.\n\nUpdate behavior is an underrated consideration. HNSW handles inserts well (each insertion adds a node to the graph in O(log n)). IVF requires periodic retraining if the data distribution shifts — new clusters might appear that aren't covered by existing centroids. For document stores with heavy ingestion, HNSW is more operational-friendly.",
        interviewerLens:
          "I want HNSW as the default with explicit reasons to deviate toward IVF (scale, memory, build time). The IVF-PQ combination for billion scale is the mid-to-senior signal. Candidates who say 'IVF is faster so I'd use it' without addressing recall degradation haven't actually tuned these systems.",
        followupChain: [
          {
            question: "What is ann-benchmarks.com and why is it useful?",
            answer: "A community benchmark that measures recall vs QPS for major ANN algorithms across standardized datasets (SIFT, GLOVE, etc.). It's useful for seeing the Pareto frontier of recall-latency trade-offs and comparing HNSW, IVF, SCANN, and others on equivalent hardware. The caveat: it doesn't account for your specific data distribution or filtering requirements."
          }
        ],
        redFlags: [
          {
            junior: "\"I'd use whichever is fastest.\"",
            senior: "\"Speed without recall is meaningless. I start with HNSW (best recall-latency Pareto), and only switch to IVF when memory is the binding constraint or dataset is billion-scale.\""
          }
        ],
        alternatePhrasings: [
          "\"HNSW vs IVF — which should I use?\"",
          "\"When does IVF-PQ make sense?\"",
          "\"How does data size affect my index choice?\""
        ],
        interviewContexts: [
          "Mid-level ML engineer at a search-heavy platform",
          "AI engineering system design interview"
        ]
      },
      {
        category: "decision-frameworks",
        riskLevel: "medium",
        asked: 13,
        questionText:
          "Your vector search system has high latency under filtered queries. How do you diagnose and fix it?",
        code: [
          {
            lang: "sql",
            label: "partial index per filter value",
            lines: [
              "-- selective, stable filter value",
              "CREATE INDEX ON docs USING hnsw",
              "  (emb vector_cosine_ops)",
              "  WHERE lang = 'fr';",
              "-- query hits the small index,",
              "-- no post-filter scan blowup",
            ],
          },
        ],
        answerStructured:
          "- **Step 1: Measure selectivity**. How many vectors pass the filter? If <5% of vectors match, you're in the high-selectivity regime where post-filtering breaks down.\n- **Step 2: Identify the filtering strategy**. Is your system using post-filter (search then filter), pre-filter (filter then search), or integrated? Most systems default to post-filter.\n- **Step 3: Diagnose the failure mode**:\n  - Post-filter + high selectivity → system is oversampling ANN candidates, spiking latency.\n  - Pre-filter + large filtered set → near-brute-force scan of the matching vectors.\n- **Fixes**:\n  - Switch to an integrated-filter system (Weaviate ACORN, Qdrant filterable HNSW).\n  - For pgvector: increase `hnsw.ef_search` (more candidates, higher recall but more latency) or create a partial index per filter value (one HNSW index per category).\n  - Reduce selectivity: index multiple filter values together and do a broader search.\n  - Re-embed metadata into vectors for low-cardinality filters (filter-in-embedding approach) — only feasible for simple, stable categorizations.\n- **Monitoring**: track query latency by filter selectivity bucket. High-latency queries almost always correspond to highly selective filters.",
        explanationDeep:
          "The diagnostic step is the one most people skip. They see high latency under filtered queries and immediately reach for more hardware. The root cause is architectural: the post-filter or pre-filter strategy is the wrong tool for the filter selectivity they're seeing.\n\nBuilding a partial index per filter value is the pgvector-native workaround: `CREATE INDEX ON docs USING hnsw (embedding ops) WHERE category = 'FAQ'`. Queries with `WHERE category = 'FAQ'` now use a dedicated index of only FAQ documents, where the ANN search is exact within the filtered subset. The downside: you need to maintain N indexes for N distinct filter values, which is operationally expensive for high-cardinality filters.",
        interviewerLens:
          "The selectivity measurement step is the key diagnostic signal. Candidates who jump straight to 'increase hardware' haven't understood the architectural cause. Naming partial indexes as the pgvector workaround shows practical experience with the limitations of the system.",
        followupChain: [
          {
            question: "What is a partial index in pgvector and when is it appropriate?",
            answer: "A partial index builds a separate HNSW index on a subset of rows (e.g., WHERE category='FAQ'). Queries that include that exact filter predicate use the smaller, focused index instead of searching all vectors. Appropriate for low-cardinality filters where the number of distinct values is manageable (< 100s of indexes). Not practical for high-cardinality filters like user_id."
          }
        ],
        redFlags: [
          {
            junior: "\"I'd scale up the server to handle more queries.\"",
            senior: "\"The latency under selective filters is an architectural problem with the filtering strategy, not a compute problem. More hardware doesn't fix post-filter recall failure.\""
          }
        ],
        alternatePhrasings: [
          "\"Our vector search is slow when users filter by category. What do you do?\"",
          "\"Filtered ANN search is giving us bad recall — how do you fix it?\"",
          "\"How do you diagnose a slow filtered vector query?\""
        ],
        interviewContexts: [
          "Mid-level AI engineer debugging a production RAG system",
          "Engineering design interview at a multi-tenant SaaS AI company"
        ]
      },
      // ── tool-comparison ───────────────────────────────────────
      {
        category: "tool-comparison",
        riskLevel: "high",
        isComparison: true,
        comparisonTools: ["HNSW", "IVF"],
        asked: 21,
        questionText:
          "HNSW vs IVF — given a concrete scenario (10M vectors, 768 dimensions, <10ms p99 latency, >95% Recall@10), which do you choose and why?",
        answerStructured:
          "- **Answer: HNSW** wins this scenario.\n- **Memory check**: 10M vectors × 768 dims × 4 bytes = ~30GB raw. HNSW graph with M=16 adds ~640MB. Total ~31GB — fits on a 64GB instance. Not a binding constraint.\n- **Latency check**: HNSW with efSearch=100-200 typically delivers <5ms p99 at 10M vectors on modern hardware. We have headroom.\n- **Recall check**: HNSW with efSearch=200 routinely achieves 97-99% recall@10 on normalized embeddings. Target of 95% is achievable with efSearch as low as 100.\n- **IVF would require** nprobe=~50 out of 4096 clusters to reach 95% recall — achievable but requires careful tuning and may degrade near cluster boundaries. Offers no advantage here since memory is not the binding constraint.\n- **IVF wins** only if dataset grows to 500M+ (HNSW memory becomes prohibitive) or build time is critical (IVF trains faster).\n- **Config**: HNSW M=16, efConstruction=200, efSearch=100 as starting point; measure recall@10 on validation set, tune efSearch up if needed.",
        explanationDeep:
          "This scenario is designed so HNSW wins clearly — it's the right tool when memory allows and recall-latency performance is the priority. The interesting analysis is the elimination of IVF: you walk through why IVF would be harder to tune (nprobe selection near boundaries, centroid training requirements) for marginal benefit when HNSW already fits in memory comfortably.\n\nThe memory math is important to do out loud: 10M × 768 × 4 = 30.7GB. With graph overhead: ~31.5GB. On a 64GB instance with OS and application overhead, this is snug but feasible. If the dataset were 50M vectors, the raw storage alone would be 153GB — now you're in IVF-PQ territory or you need a very large instance. Showing this math demonstrates you've actually provisioned these systems.\n\nThe validation set point is critical: you don't know you've hit 95% recall until you measure it. 'efSearch=100 should give 95%' is a starting estimate, not a guarantee, because it depends on data distribution, embedding quality, and M value. Always measure on a representative sample.",
        interviewerLens:
          "I want the memory math, the recall-latency reasoning with specific numbers, and the clear 'HNSW wins here but IVF would win at 500M+ vectors.' Candidates who compare indexes only qualitatively haven't actually provisioned production systems. The validation-set measurement call is the production credibility signal.",
        followupChain: [
          {
            question: "Same scenario but 500M vectors. What changes?",
            answer: "500M × 768 × 4 = 1.5TB raw vectors. HNSW graph adds another ~30GB. Total ~1.53TB — impractical for a single-node deployment. Switch to IVF-PQ: PQ can compress to 32-64 bytes per vector (32x reduction), bringing storage to 15-30GB. Accept ~5-10% recall degradation vs HNSW. Alternatively, distribute HNSW across multiple shards (each shard ~10M vectors), with a coordinator that fan-outs queries and merges results."
          }
        ],
        redFlags: [
          {
            junior: "\"I'd use IVF because it's designed for large-scale search.\"",
            senior: "\"10M vectors fits comfortably in memory for HNSW. I'd only use IVF when memory is the binding constraint — here it's not. HNSW gives better recall at equivalent latency.\""
          }
        ],
        alternatePhrasings: [
          "\"Pick an index for a 10M document semantic search with 95% recall target.\"",
          "\"How would you architect the retrieval layer for a mid-scale RAG system?\"",
          "\"When does HNSW become the wrong choice?\""
        ],
        interviewContexts: [
          "Mid-level AI engineer system design interview",
          "Technical screen at a production-RAG-focused company",
          "Vector DB architecture discussion at a growth-stage startup"
        ]
      }
    ],
    topics: {
      moreDeepDives: [
        "How does Weaviate's hybrid search (BM25 + vector) fusion work, and when does it outperform pure vector search?",
        "Explain the HNSW insertion algorithm: what happens when you add a new vector to an existing index?",
        "How do you handle vector index updates and deletes without a full rebuild?",
        "What is scalar quantization (int8) and how does it compare to product quantization in terms of recall loss?",
        "Walk me through building a RAG retrieval pipeline — chunking, embedding, indexing, and querying."
      ],
      decisions: [
        "HNSW vs IVF vs Flat index — a decision tree based on dataset size, recall requirements, and memory budget.",
        "When to choose Weaviate vs Qdrant vs Pinecone for a new production deployment?",
        "Pre-filter vs post-filter vs integrated filtering — which to use under high vs low filter selectivity?"
      ],
      quickRef: [
        "What does M control in HNSW?",
        "What is efSearch and can you change it at query time?",
        "What is nprobe in IVF?",
        "What is Recall@10?",
        "What is the runtime recall knob for HNSW vs IVF?",
        "What is IVF-PQ?",
        "What does 'integrated filtering' mean in a vector DB?",
        "What is a cluster centroid in IVF?",
        "What is ACORN in Weaviate?",
        "What is the HNSW graph memory footprint formula?"
      ],
      redFlags: [
        {
          junior: "\"I'd tune M to improve recall without rebuilding.\"",
          senior: "\"M is a build-time parameter — changing it requires a full index rebuild. The runtime recall lever is efSearch, which you can tune per-query.\""
        },
        {
          junior: "\"Filtering is just adding a WHERE clause after the search.\"",
          senior: "\"Post-filtering degrades recall severely under selective predicates. I'd use an integrated-filter system or understand the oversampling cost and test recall explicitly.\""
        },
        {
          junior: "\"Higher nprobe always makes IVF better.\"",
          senior: "\"At nprobe=nlist you've done exact search — you've paid the full cost and lost the ANN speedup. Nprobe is a recall-latency trade-off knob, not a quality dial you max out.\""
        }
      ],
      checklist: [
        "Know the HNSW multi-layer graph structure and what M, efConstruction, efSearch each control",
        "Know IVF cluster partitioning and what nprobe does",
        "Explain the post-filter recall failure mode under selective filters",
        "Know HNSW vs IVF memory math and when to switch",
        "Be ready to reason through a recall@k measurement workflow"
      ],
      behavioral: [
        "Describe a time you had to tune a vector search system for a latency or recall SLA.",
        "Have you worked with filtered vector search? What challenges did you encounter?",
        "How did you decide which vector database to use for a project and what were the key trade-offs?"
      ],
      reverse: [
        "What ANN index type is the team using today, and have you measured recall@k?",
        "How do you handle metadata filtering — pre-filter, post-filter, or integrated?",
        "What's the current p99 latency on your vector search queries?"
      ]
    }
  },

  // ─────────────────────────────────────────────────────────────
  // SENIOR  — PQ quantization & memory math, sharding/scaling,
  //           filtered-ANN pitfalls, choosing under constraints
  // ─────────────────────────────────────────────────────────────
  senior: {
    authored: [
      // ── deep-dives ────────────────────────────────────────────
      {
        category: "deep-dives",
        riskLevel: "high",
        freePreview: true,
        asked: 27,
        questionText:
          "Explain Product Quantization (PQ): how it works, how much memory it saves, and what recall degradation to expect in production.",
        code: [
          {
            lang: "python",
            label: "FAISS IVFPQ",
            lines: [
              "import faiss",
              "d = 768",
              "q = faiss.IndexFlatL2(d)",
              "# m=96 subvecs, 8 bits -> 96 bytes",
              "idx = faiss.IndexIVFPQ(q, d, 1024, 96, 8)",
              "# vs 768*4 = 3072 bytes raw (32x)",
            ],
          },
        ],
        answerStructured:
          "- **Core mechanism**: PQ divides each d-dimensional vector into m equal sub-vectors, each of dimension d/m. Each sub-vector is independently quantized using a codebook of k* centroids (typically 256). The vector is stored as m centroid IDs (1 byte each if k*=256), not the original floats.\n- **Memory reduction**: original float32 vector = d × 4 bytes. PQ representation = m bytes. Example: 768-dim vector normally = 3072 bytes; with m=96 sub-vectors and k*=256, stored as 96 bytes — a **32x reduction**. At 1M vectors: Flat index = 3GB, PQ index ≈ 96MB.\n- **Recall impact**: PQ introduces quantization error. Distance calculations are approximate (computed in the compressed sub-vector space). Typical production recall degradation: **5-15% lower recall than uncompressed HNSW** at equivalent latency. A system with 97% recall at full precision may drop to 82-88% with aggressive PQ settings. Testing on your data distribution is mandatory.\n- **Combining with HNSW/IVF**: HNSW-PQ or IVF-PQ builds the graph/cluster structure on compressed vectors. This enables billion-scale indexes in memory. FAISS's IVFPQ is the most common production implementation.\n- **Tuning**: the m (number of sub-vectors) and nbits (bits per centroid ID, usually 8 for k*=256) control the trade-off. More sub-vectors → better fidelity → more memory. m should divide d evenly.\n- **Alternative: scalar quantization (SQ/int8)**: store each float32 as int8 — 4x size reduction, <1% recall loss. Usually prefer SQ over PQ when a 4x reduction is enough; use PQ only when you need 10-30x.",
        explanationDeep:
          "The key to understanding PQ is the codebook training step. Before indexing, you run k-means on each sub-dimension independently on a training set. This produces m codebooks, each with k* centroids. At query time, instead of computing exact dot products, you compute distances from the query to each centroid in each sub-space (precomputed lookup table), then look up the precomputed distances for each vector's stored centroid IDs. This is the ADC (Asymmetric Distance Computation) trick — it makes distance calculation over millions of compressed vectors extremely fast.\n\nThe recall impact is data-dependent and must be measured, not assumed. The 5-15% figure is a rule of thumb for 768-dim embeddings with m=96 and k*=256. With lower m (more aggressive compression), recall drops further. The Pinecone blog demonstrates this concretely: an IndexPQ in FAISS achieved 50% recall while an IndexIVFPQ achieved 52% recall — both dramatically lower than the 100% recall of exact search. If your application requires 95% recall, PQ may not be viable without significant m tuning.\n\nScalar quantization (int8) is the pragmatic first step before PQ. Converting each float32 to a signed int8 reduces memory by 4x with recall loss typically under 1%. pgvector added scalar and binary quantization support in 2024 specifically because teams couldn't fit their indexes in RAM. For most teams, SQ/int8 is the right first lever; PQ is for when you genuinely need 10-30x compression.",
        interviewerLens:
          "I want the PQ mechanism (sub-vectors + codebooks + centroid IDs), the memory reduction math with numbers (32x for m=96, d=768), and the recall impact range (5-15% typical). The contrast with scalar quantization is the senior signal — knowing that int8 quantization gives 4x with <1% recall loss and is usually the right first step before reaching for PQ shows operational maturity. If you can mention ADC (asymmetric distance computation), you've clearly read the primary literature.",
        followupChain: [
          {
            question: "Why does PQ require a training step, and what happens if you train on unrepresentative data?",
            answer: "PQ trains codebooks by running k-means on each sub-dimension of a training corpus. If the training data doesn't represent the query-time distribution — e.g., you trained on English text but now query with multilingual text — the centroids will be misaligned with the actual vector distribution, leading to poor quantization and worse recall than expected. Always train PQ on a sample that matches the production data distribution."
          },
          {
            question: "What is ADC (Asymmetric Distance Computation) and why does it make PQ queries fast?",
            answer: "ADC precomputes a lookup table of distances from the query vector to each centroid in each sub-space (m × k* distance values, typically 96 × 256 = 24,576 calculations). Then for each stored vector, you look up m distances from the table and sum them — O(m) lookups per vector vs O(d) multiply-accumulates for exact distance. This makes distance computation over billions of compressed vectors feasible in real-time."
          },
          {
            question: "How does binary quantization differ from PQ in terms of memory and recall?",
            answer: "Binary quantization (BQ) stores each float32 as a single bit (1 if positive, 0 if negative), a 32x size reduction — same as aggressive PQ. But BQ recall loss is severe (~20-30%) because it captures only the sign of each dimension, not the magnitude. Scalar quantization (int8) is almost always preferable: 4x reduction, <1% recall loss. BQ is only justified when memory is catastrophically constrained and approximate results are acceptable."
          }
        ],
        redFlags: [
          {
            junior: "\"PQ compresses vectors and reduces memory — sounds great, let's use it.\"",
            senior: "\"PQ gives 10-30x compression but 5-15% recall degradation. I'd always try scalar quantization (int8) first — 4x reduction, <1% recall loss. PQ only when SQ isn't enough.\""
          },
          {
            junior: "\"I'd use m=8 sub-vectors for maximum compression.\"",
            senior: "\"With m=8 on a 768-dim vector, each sub-vector is 96 dimensions — very coarse, likely >20% recall loss. I'd prototype with m=96 (8-dim sub-vectors) and measure recall before going more aggressive.\""
          }
        ],
        alternatePhrasings: [
          "\"How does FAISS's IVFPQ work at billion scale?\"",
          "\"What is the memory cost of a vector index and how do you reduce it?\"",
          "\"Explain the quantization trade-off in vector databases.\""
        ],
        interviewContexts: [
          "Senior AI engineer at a FAISS-heavy recommendation system team",
          "Staff ML engineer loop at a large-scale search platform",
          "Asked at a Milvus architecture interview at a Series C AI company"
        ]
      },
      {
        category: "deep-dives",
        riskLevel: "high",
        asked: 21,
        questionText:
          "How do you shard a vector index across multiple nodes? What are the key architectural challenges and how do major systems solve them?",
        answerStructured:
          "- **Why shard**: a single-node HNSW index at 1B vectors × 768 dims = ~3TB RAM — infeasible. Distribute vectors across N nodes, each holding a shard of the index.\n- **Sharding strategies**:\n  - **Random/hash sharding**: vectors distributed uniformly at random. Simple to implement; guarantees even load. But geometry is ignored — two similar vectors may live on different shards, so every query must fan out to all shards.\n  - **Space partitioning**: cluster vectors (k-means, geographic partitioning) and assign each cluster to a shard. Queries can be routed to fewer shards. Requires knowing the distribution at shard time; hot clusters create uneven load.\n- **Distributed query execution**: a coordinator receives a query, fans out to all relevant shards in parallel, each shard returns its local top-k results, the coordinator merges and re-ranks to produce the global top-k.\n- **Key challenges**:\n  1. **Recall degradation**: if a shard doesn't contain the global nearest neighbors (because they landed on a different shard), the merged result is wrong. You must over-fetch from each shard (get top-k × safety factor) and merge.\n  2. **Cross-shard graph connectivity** (HNSW): HNSW relies on dense connections for navigation. A sharded HNSW can't traverse edges across shard boundaries, leading to isolated sub-graphs with poor recall.\n  3. **Load imbalance**: skewed data distributions cause some shards to serve far more queries (hot shard problem).\n- **How managed systems solve it**: Pinecone handles sharding transparently; Weaviate and Qdrant provide native replication and sharding with configurable shard counts; Milvus uses a coordinator-based distributed architecture with separate index nodes.",
        explanationDeep:
          "The fundamental challenge of sharding vector indexes is that nearest neighbors are a global geometric property, not a partition-local one. In a relational database, if you shard by user_id, a query for user 42's data goes to exactly one shard. In a vector database, the 10 globally nearest neighbors to a query vector could be scattered across all shards — you have no a priori way to know which shard contains them without searching all of them.\n\nThis forces a fan-out architecture: every query goes to every shard, each shard returns its local top-k, the coordinator merges and returns the global top-k. The overhead is proportional to the number of shards. With 10 shards, you're running 10 parallel ANN queries and one merge — which is fast but not free, and the merge quality depends on each shard's recall.\n\nThe over-fetch strategy mitigates merge recall degradation: if you want the global top-10, each shard returns top-30 or top-50. The coordinator sees 300-500 candidates and selects the true top-10 from them. The overhead is the additional candidate computation on each shard. Setting the right over-fetch factor is an empirical exercise — too low and merge recall suffers; too high and latency spikes. Managed services like Pinecone abstract this complexity, which is a significant part of what you pay for.",
        interviewerLens:
          "I'm looking for the fan-out + merge pattern and the over-fetch strategy for recall. Candidates who say 'just distribute the data across nodes' without addressing the global nearest-neighbor problem haven't thought this through. The HNSW cross-shard connectivity problem is a senior-level detail that shows you understand the index structure, not just the database interface.",
        followupChain: [
          {
            question: "How does Milvus handle distributed vector search differently from Pinecone?",
            answer: "Milvus is open-source with explicit architecture: it separates the coordinator (query routing), index nodes (build and store shards), and query nodes (search shards). You control shard count, replication factor, and index parameters explicitly. Pinecone is fully managed — sharding is transparent, you just specify the index config and number of replicas. Milvus offers more control and lower cost at scale; Pinecone offers less operational overhead."
          },
          {
            question: "What is replication in a vector database and why do you need it?",
            answer: "Replication stores each shard on multiple nodes. It provides fault tolerance (a node failure doesn't lose data) and read throughput (queries can be served by any replica). For high-QPS production systems, you might run 3-5 replicas per shard to distribute query load. The trade-off is 3-5x the memory and storage cost."
          }
        ],
        redFlags: [
          {
            junior: "\"You shard by distributing vectors evenly across nodes.\"",
            senior: "\"Distributing vectors is the easy part. The hard part is that nearest neighbors are global — you need every query to fan out to all shards, over-fetch candidates, and merge. The recall of the merged result depends on how many candidates each shard returns.\""
          },
          {
            junior: "\"Sharding gives you linear scalability with no trade-offs.\"",
            senior: "\"Sharding adds latency (fan-out + merge), recall risk (if you don't over-fetch), and operational complexity (rebalancing, hot shards). Managed services like Pinecone exist specifically to hide this complexity.\""
          }
        ],
        alternatePhrasings: [
          "\"How do you scale a vector database beyond one machine?\"",
          "\"Explain the distributed query flow in a sharded vector DB.\"",
          "\"What's the recall risk of sharding HNSW indexes?\""
        ],
        interviewContexts: [
          "Senior AI engineer designing a billion-scale vector search system",
          "Staff engineer loop at a large ML platform company",
          "Distributed systems round at a cloud AI infrastructure team"
        ]
      },
      {
        category: "deep-dives",
        riskLevel: "high",
        asked: 19,
        questionText:
          "Walk me through the complete set of failure modes in a filtered vector search system at production scale.",
        answerStructured:
          "- **Failure mode 1 — Post-filter recall collapse**: system uses post-filtering; a selective filter (<5% of vectors match) causes ANN to return candidates that are mostly filtered out. Result: fewer than k results, poor recall, or latency spikes from oversampling. Detection: track `results_returned / k_requested` per query; values < 0.8 indicate this failure.\n- **Failure mode 2 — Pre-filter brute force**: system pre-filters to a large set (30-50% of corpus) before ANN. Pre-filtering degrades to near-linear scan over the filtered subset. Detection: query latency scales with filter match count, not with k.\n- **Failure mode 3 — HNSW graph fragmentation under heavy deletes**: after deleting many vectors (soft delete approach), the 'graveyard' of deleted nodes occupies memory and causes graph traversal to waste time visiting dead nodes. Detection: memory usage growing despite constant live vector count; recall gradually degrading.\n- **Failure mode 4 — IVF centroid staleness**: data distribution shifts after IVF was trained. New vectors cluster in regions not covered by existing centroids, leading to poor nprobe coverage and recall degradation. Detection: monitor Recall@k on a validation set over time; degrade beyond threshold signals centroid retraining.\n- **Failure mode 5 — Quantization-induced recall degradation**: PQ codebooks trained on non-representative data or with too few sub-vectors. Recall is lower than expected and hard to diagnose without ground-truth measurement. Detection: always measure Recall@k before and after enabling PQ.\n- **Failure mode 6 — Index-serving memory OOM**: index grows beyond available RAM; system falls back to disk-based access (MMAP), causing latency to spike 10-100x. Detection: monitor RSS/peak memory; alert before OOM.",
        explanationDeep:
          "The post-filter recall collapse is the most common silent failure in production vector search. It's silent because the system returns results without errors — it just returns fewer relevant ones, or returns results faster by skipping candidates. Without measuring Recall@k on a representative query set, teams often don't know they have this problem until users report poor search quality.\n\nHNSW graph fragmentation under deletes is subtle and grows over time. Most HNSW implementations use soft deletes (the deleted vector remains in the graph but is excluded from results). After millions of deletes, traversal wastes significant time visiting dead nodes. This shows up as a gradual recall and latency degradation correlated with delete volume, not with live dataset growth. The fix is a periodic full index rebuild — but this requires a strategy for serving queries during the rebuild (blue-green index swap).\n\nIndex serving memory OOM is the operations failure that causes the most acute incidents. HNSW indexes must be fully loaded into RAM to achieve low latency. If the index grows beyond available RAM and the system falls back to mmap (memory-mapped file access), latency spikes from <5ms to 50-500ms because each cache miss requires a disk read. The fix is to monitor the index:RAM ratio and either scale horizontally (shard) or compress (SQ, PQ) before hitting the limit.",
        interviewerLens:
          "I want at least 3 of these 6 failure modes named and diagnosed, not just listed. The post-filter collapse and the HNSW soft-delete fragmentation are the ones that show production experience. 'Silent' is the key word for several of them — they don't throw errors, they just quietly degrade quality, which makes them harder to catch and more dangerous.",
        followupChain: [
          {
            question: "How do you do a zero-downtime index rebuild when you need to reindex to fix HNSW fragmentation?",
            answer: "Blue-green index swap: build a fresh index on a separate volume or node while the current one continues serving traffic. Once the new index is built and validated (Recall@k tested), atomically route traffic to the new index and decommission the old one. In managed systems (Pinecone, Weaviate), reindexing is handled transparently. In self-hosted FAISS/HNSW, this requires an explicit build-and-swap pipeline."
          },
          {
            question: "How do you detect centroid staleness in an IVF index?",
            answer: "Track Recall@k on a fixed validation query set over time. A sustained decline in recall (e.g., from 95% to 87% over 3 months) correlated with new data ingestion is a signal of centroid staleness. Also monitor the distribution of nprobe-covered cluster sizes — if recently added vectors are poorly clustered (large empty regions in the index), the centroids need retraining."
          }
        ],
        redFlags: [
          {
            junior: "\"Vector databases just work — you insert vectors and search.\"",
            senior: "\"In production, vector systems have specific failure modes: post-filter recall collapse under selective filters, HNSW fragmentation from deletes, PQ recall degradation, and memory OOM from index growth. I monitor Recall@k and memory/RAM ratio proactively.\""
          },
          {
            junior: "\"I'd soft-delete vectors and not worry about rebuilding.\"",
            senior: "\"Soft deletes accumulate in the HNSW graph as dead nodes that waste traversal time. After 20-30% deletes, recall degrades noticeably. I'd schedule periodic full rebuilds with a blue-green swap to keep the index healthy.\""
          }
        ],
        alternatePhrasings: [
          "\"What can go wrong in a production vector search system?\"",
          "\"How do you monitor vector search quality in production?\"",
          "\"A vector search system's recall was 95% at launch and is now 78%. What happened?\""
        ],
        interviewContexts: [
          "Senior AI engineer reliability interview at a large-scale search team",
          "Staff ML platform interview with production operations focus",
          "Asked at a Qdrant user's senior engineering loop"
        ]
      },
      {
        category: "deep-dives",
        riskLevel: "medium",
        asked: 15,
        questionText:
          "Design a vector search system for 1B multilingual documents with <50ms p99 latency and >90% Recall@10. Walk through your architecture and justify every major decision.",
        answerStructured:
          "- **Scale math**: 1B × 768 dims × 4 bytes = 3TB raw. Not feasible on a single node. Must shard.\n- **Compression**: apply scalar quantization (int8) first — 4x reduction → 750GB. If still too large per node, add PQ (m=96, k*=256) → ~24x further reduction on quantized vectors → ~31GB. Accept ~5-10% recall loss from PQ on top of <1% from SQ.\n- **Index choice**: IVF-PQ for the compressed index, with HNSW on a smaller uncompressed representative sample for re-ranking. Or HNSW sharded across 20-30 nodes (each holding 30-50M vectors, ~30-50GB per shard after SQ).\n- **Sharding**: random sharding with fan-out to all shards. Each shard returns top-50, coordinator merges to produce global top-10 (5x over-fetch). Measure merge recall to verify 90% target is met.\n- **Filtering**: if queries include language filters, build language-specific sub-indexes. Language is a stable, low-cardinality metadata — partial indexes are feasible.\n- **Re-ranking**: retrieve top-50 candidates via ANN, then re-rank with a cross-encoder or exact distance computation to recover recall lost to quantization.\n- **Monitoring**: Recall@10 on a fixed multilingual validation set, p99 latency per query, shard fan-out latency breakdown, memory/RAM ratio per shard.\n- **Managed vs self-hosted**: Pinecone or Weaviate Cloud handles sharding/replication. Self-hosted Milvus or Qdrant if budget or data-residency constraints apply.",
        explanationDeep:
          "The 1B vector scenario forces every decision to be explicit. The most important step is the memory math — 3TB raw vectors immediately tells you this is a distributed system. Everything flows from that constraint.\n\nThe re-ranking step is worth emphasizing: ANN + re-rank is a two-stage retrieval pattern that decouples recall from latency. The first stage (ANN) retrieves many candidates cheaply; the second stage (exact re-ranking) orders them accurately. This pattern recovers recall lost to quantization or coarse ANN. In RAG systems, the re-ranker is often a cross-encoder model that scores (query, document) pairs — expensive per pair but run on only 50-200 candidates, not the full corpus.\n\nMultilingual adds embedding model considerations: you need a model trained on multilingual corpora (multilingual-e5-large, mGTE, or OpenAI's multilingual embeddings). The embedding quality at the same dimension affects recall more than index choice — a poor embedding model won't be saved by the best ANN index.",
        interviewerLens:
          "I want the memory math first, then a justified series of decisions that flow from it. 'Shard because it doesn't fit on one node' → 'compress with SQ/PQ to reduce memory per shard' → 'HNSW or IVF-PQ depending on remaining memory budget' → 're-rank to recover recall.' Candidates who jump to a technology without doing the math haven't designed billion-scale systems. The re-ranking step is the senior signal.",
        followupChain: [
          {
            question: "How would you measure whether you've hit 90% Recall@10 before launch?",
            answer: "Build a validation set: randomly sample 1000 multilingual queries, run exact brute-force search to get ground-truth top-10 for each, then run your ANN system and measure what fraction of ground-truth top-10 it returns. Average across queries gives Recall@10. Do this before launch and re-measure monthly to catch drift."
          },
          {
            question: "What multilingual embedding model would you use and why?",
            answer: "multilingual-e5-large or mGTE-base are strong open-source options (100+ languages, 768-dim). For hosted: OpenAI text-embedding-3-large with truncation. The key criteria: language coverage matching your document corpus, benchmark performance on multilingual retrieval benchmarks (MIRACL, MTEB multilingual), and inference cost/latency at scale."
          }
        ],
        redFlags: [
          {
            junior: "\"I'd use Pinecone because it handles scale automatically.\"",
            senior: "\"That's a valid operational choice, but I'd want to justify it after doing the memory math. At 1B vectors, managed services have significant cost. Self-hosted Milvus or Weaviate might be justified. The index choice, compression, and re-ranking architecture apply regardless.\""
          }
        ],
        alternatePhrasings: [
          "\"Design a semantic search system for Wikipedia at scale.\"",
          "\"How do you architect a production RAG system for a global enterprise?\"",
          "\"Walk me through a billion-vector ANN system design.\""
        ],
        interviewContexts: [
          "Senior AI engineer system design loop at a search company",
          "Staff ML engineer design round at a LLM-focused startup",
          "Asked at a Weaviate Cloud enterprise engineering interview"
        ]
      },
      // ── decision-frameworks ───────────────────────────────────
      {
        category: "decision-frameworks",
        riskLevel: "high",
        asked: 18,
        questionText:
          "Given a set of constraints (dataset size, latency SLA, recall target, memory budget, update frequency), how do you systematically choose a vector database and index configuration?",
        answerStructured:
          "- **Step 1 — Memory math**: compute raw vector storage (n × d × 4 bytes). If it fits in <50% of available RAM on a single node → stay single-node. If not → plan sharding or compression first.\n- **Step 2 — Update frequency**: high update rate (inserts/deletes >1% per day) → HNSW handles inserts better than IVF; plan for periodic rebuild to clear soft-deleted nodes. Low update rate (batch-indexed, mostly static) → IVF is fine.\n- **Step 3 — Recall vs latency SLA**:\n  - >95% recall AND <10ms → HNSW, tune efSearch. Measure before committing.\n  - >90% recall, 20-50ms budget → HNSW or IVF with nprobe tuning.\n  - <90% recall acceptable, extreme scale → IVF-PQ.\n- **Step 4 — Filtering**:\n  - Low-cardinality, stable filters (language, category) → partial indexes per filter value.\n  - High-cardinality dynamic filters (user_id, date ranges) → need integrated filtering (Weaviate, Qdrant). Not pgvector.\n- **Step 5 — Operations**: who maintains this? No DBA → managed (Pinecone, Weaviate Cloud). Own infra → Milvus, Qdrant, or pgvector.\n- **Step 6 — Validate**: measure Recall@k on a validation set before declaring done. No exception.",
        explanationDeep:
          "The systematic approach matters because vector search is full of local optima — teams pick an index type based on a blog post, skip the recall measurement step, and discover 6 months later that they're operating at 78% recall and don't know why their search quality is degraded.\n\nThe memory math step is non-negotiable. I've seen teams choose HNSW for a 500M vector dataset, run out of RAM 3 months after launch when the dataset grew, and face an emergency reindex with quantization under pressure. If you do the math upfront and see that your dataset will outgrow single-node HNSW in 6 months, you build the distributed architecture now, not under incident pressure.\n\nThe filtering assessment often reveals that pgvector, despite its operational simplicity, is wrong for the use case. A multi-tenant SaaS with per-user filtering can't use pgvector without partial indexes (one HNSW index per user — operationally infeasible at scale). That's a correctness requirement that overrides the convenience argument.",
        interviewerLens:
          "I'm looking for the six steps in roughly this order, with memory math first and recall validation last. Skipping either is a red flag. The filtering step separating pgvector from integrated-filter systems is the architectural signal. Candidates who can name when each managed service (Pinecone vs Weaviate vs Qdrant) wins based on requirements, not just brand preference, are senior.",
        followupChain: [
          {
            question: "How does this framework change if the team is on Postgres and wants minimal new infrastructure?",
            answer: "pgvector first if: dataset < 10M vectors AND filter selectivity is low (most queries match >10% of vectors) AND recall doesn't need to exceed 92%. If any of those conditions fail, the infrastructure cost of pgvector's limitations (partial indexes, recall degradation under filters) exceeds the cost of adding a purpose-built vector DB."
          },
          {
            question: "What does 'validate with Recall@k on a representative query set' look like in practice?",
            answer: "Sample 500-1000 production-representative queries. Run exact brute-force search (IndexFlat in FAISS or `ORDER BY embedding <-> query LIMIT k` without an index in pgvector). Record ground-truth top-k. Then run the same queries through your ANN index. Recall@k = average fraction of ground-truth results returned. Automate this as a weekly job; alert if recall drops >3% from baseline."
          }
        ],
        redFlags: [
          {
            junior: "\"I'd use Pinecone because it's the most popular vector DB.\"",
            senior: "\"Popularity is not a constraint. I start with memory math, update frequency, recall/latency SLAs, and filtering requirements — then pick the system that fits those constraints. Pinecone wins on managed scale, pgvector wins on operational simplicity at small scale, Weaviate wins on integrated filtering.\""
          },
          {
            junior: "\"We'll just tune it if performance is bad.\"",
            senior: "\"'Tune later' means you discover the wrong index type after ingesting 100M vectors and face a reindex. I'd validate the configuration on a sample before committing to a full-scale build.\""
          }
        ],
        alternatePhrasings: [
          "\"How do you choose between pgvector, Pinecone, and Weaviate?\"",
          "\"Walk me through your decision framework for a new vector search system.\"",
          "\"What questions do you ask before picking a vector database?\""
        ],
        interviewContexts: [
          "Senior AI engineer architecture interview at a product company",
          "Principal ML engineer design loop at a Series C startup",
          "Asked at a data platform architect interview with AI search focus"
        ]
      },
      {
        category: "decision-frameworks",
        riskLevel: "medium",
        asked: 12,
        questionText:
          "When should you use a re-ranking step after ANN retrieval, and what are the cost and latency implications?",
        code: [
          {
            lang: "python",
            label: "retrieve top-50, rerank to 10",
            lines: [
              "# cheap ANN: wide net",
              "cands = index.query(qvec, top_k=50)",
              "# expensive cross-encoder rerank",
              "pairs = [(query, c.text) for c in cands]",
              "scores = reranker.predict(pairs)",
              "top = sort_by(scores)[:10]",
            ],
          },
        ],
        answerStructured:
          "- **What re-ranking does**: ANN retrieval returns top-k approximate nearest neighbors. Re-ranking re-scores those k candidates with a more expensive but more accurate model (cross-encoder, exact distances, or a learned ranker), then re-orders them. Improves precision at the cost of additional computation on the candidates.\n- **When to use it**:\n  - You're using PQ-compressed vectors (recall degradation). Re-ranking with exact distances on the original uncompressed vectors recovers most of the lost recall.\n  - Precision of the top-1 result is critical (e.g., the first result is always displayed prominently). ANN recall@10 might be 95%, but recall@1 is only 80% — re-ranking improves the ordering.\n  - You want semantic coherence beyond cosine similarity (RAG passage ranking, e-commerce relevance). Cross-encoder models score (query, document) pairs and capture interaction effects that bi-encoder embeddings miss.\n- **Cost model**: ANN retrieval: O(log n) per query, <5ms. Re-ranking N candidates with a cross-encoder: O(N × inference cost). With N=50 and a small cross-encoder, add 20-100ms. With a large model (e.g., reranker-base), 200-500ms. Trade: ANN retrieves cheaply with reasonable recall; cross-encoder re-ranks accurately at higher latency.\n- **Practical pattern**: ANN with k=50-200, re-rank to return top-10. This two-stage pattern is used in production RAG systems (Cohere Rerank, Jina Reranker, Voyage Rerank APIs).",
        explanationDeep:
          "The two-stage retrieve-then-rerank pattern is one of the most impactful architectural improvements for RAG quality. Bi-encoder embeddings (used for ANN retrieval) encode query and document independently and compare their representations. This is fast but misses query-document interaction effects. Cross-encoders take (query, document) as joint input and model their interaction directly — much more accurate but expensive per pair.\n\nThe cost math justifies the pattern: running a cross-encoder over all 1B documents is impossible. Running it over 50-200 ANN candidates is cheap. The ANN stage acts as an efficient filter that narrows the candidate set to a manageable size for the expensive model. This is the retrieval architecture used at scale in enterprise search (Google Search uses a similar multi-stage pattern).\n\nFor PQ-compressed indexes, re-ranking with exact distances is particularly valuable. After PQ retrieves the top-50 compressed candidates, re-computing exact dot products against the original float32 vectors for those 50 candidates costs almost nothing but significantly improves the ordering. This pattern (PQ for recall with exact re-ranking for precision) is used in Facebook's FAISS production deployments.",
        interviewerLens:
          "The cross-encoder interaction-effect explanation and the PQ-exact-reranking pattern are the senior signals. Candidates who know Cohere Rerank or Jina Reranker by name have used production RAG systems. The cost model (O(log n) ANN vs O(N × inference) re-ranking, where N is the candidate set size) shows quantitative reasoning.",
        followupChain: [
          {
            question: "What is the difference between a bi-encoder and a cross-encoder?",
            answer: "Bi-encoder: embeds query and document independently into a shared vector space; similarity computed as dot product/cosine. Fast — embed once, compare many. Cross-encoder: takes (query, document) as a single input and outputs a relevance score. Models their interaction directly; much more accurate but runs inference per (query, document) pair, so only feasible on a small candidate set."
          }
        ],
        redFlags: [
          {
            junior: "\"ANN is good enough — I don't need re-ranking.\"",
            senior: "\"ANN recall@10 is 90-95% at best. If the top-1 result quality matters (it always does for users), re-ranking the ANN candidates with a cross-encoder or exact distances is a meaningful improvement, especially when using PQ-compressed vectors.\""
          }
        ],
        alternatePhrasings: [
          "\"How do you improve RAG retrieval quality beyond ANN?\"",
          "\"When would you use Cohere Rerank?\"",
          "\"What is a two-stage retrieval pipeline?\""
        ],
        interviewContexts: [
          "Senior AI engineer designing a production RAG system",
          "ML platform interview at a LLM startup with enterprise search focus"
        ]
      },
      // ── tool-comparison ───────────────────────────────────────
      {
        category: "tool-comparison",
        riskLevel: "high",
        isComparison: true,
        comparisonTools: ["pgvector", "Pinecone"],
        asked: 23,
        questionText:
          "pgvector vs Pinecone: make the case for each at senior level, including where each breaks down in production.",
        answerStructured:
          "- **pgvector — strengths**: zero new infrastructure if on Postgres; full SQL joins (vector similarity + relational data in one query); ACID transactions; no vendor lock-in; open-source. Practical ceiling: ~10-50M vectors on a well-provisioned instance.\n- **pgvector — breaks down**:\n  1. **Filtered search recall**: post-filter only by default. Under selective filters, recall degrades significantly. Partial indexes help but are operationally expensive at scale.\n  2. **Scale**: HNSW in pgvector is single-node. Beyond 50M vectors, you need read replicas, pgvector on Citus, or a migration to a dedicated system.\n  3. **Index rebuild**: adding vectors to an HNSW index in pgvector locks the index during build phases. High-ingestion workloads require careful management.\n- **Pinecone — strengths**: fully managed sharding, replication, and ANN index at billions of vectors; single-stage integrated filtering (better recall under selective predicates); serverless tier for low-QPS; SLA-backed uptime.\n- **Pinecone — breaks down**:\n  1. **No SQL joins**: can't join Pinecone results with relational data in one query. You fetch IDs from Pinecone, then query Postgres for metadata — two round trips.\n  2. **Vendor lock-in**: proprietary API, no SQL portability, migration to another system requires re-indexing.\n  3. **Cost at scale**: at very high QPS, pod-based Pinecone is expensive. Self-hosted Weaviate or Qdrant may have a better cost profile.\n  4. **Limited query expressiveness**: filter syntax is simpler than SQL; complex multi-table conditions aren't possible.\n- **Decision line**: pgvector if Postgres-first, <10M vectors, relational joins critical. Pinecone if scale >50M vectors, SLA-backed managed ops required, or filtering recall is a hard requirement.",
        explanationDeep:
          "The pgvector 'breaks down under selective filters' issue is the most commonly discovered production problem with a pgvector-first choice. It works fine at development time when queries are broad. It fails in production when users filter to their own data (multi-tenant) or filter by a specific category (e-commerce). The recall degradation can be severe — going from 95% to 65% recall when filtering to a small subset — and it's silent (no error, just worse results).\n\nPinecone's 'no SQL joins' limitation is the one that surprises teams who assumed they could replace Postgres entirely. Vector databases are not general-purpose databases. They store vectors and metadata, not arbitrary relational schemas. The typical production pattern is a hybrid: Pinecone for vector similarity, Postgres for relational data, with the application layer joining the two result sets. This adds a round trip and application-layer complexity that teams don't always budget for.\n\nThe cost trajectory matters at scale. Pinecone pod-based pricing at 1B vectors can reach tens of thousands of dollars per month. Self-hosted Weaviate or Milvus on commodity cloud instances at equivalent scale is often 5-10x cheaper, but requires engineering hours for operations. The right answer depends on team size and the value of engineering time vs infrastructure savings.",
        interviewerLens:
          "I want both breakdown conditions named, not just the strengths. 'pgvector breaks on selective filters' and 'Pinecone breaks on relational join requirements' are the real-world failure modes that differentiate senior practitioners from those who have only read documentation. The cost comparison at scale shows you've priced production systems.",
        followupChain: [
          {
            question: "How does Qdrant fit into this comparison?",
            answer: "Qdrant is a Rust-based dedicated vector database with native integrated filtering (filterable HNSW), strong single-node QPS, and a clean REST/gRPC API. It's often the best cost-performance choice for medium scale (10M-500M vectors) when you want better filtered search than pgvector but don't need Pinecone's fully managed global scale. Open-source with a managed cloud offering."
          },
          {
            question: "What is Weaviate's key advantage over both pgvector and Pinecone?",
            answer: "Weaviate's native hybrid search (BM25 + vector with built-in RRF fusion) is production-ready without needing a separate Elasticsearch instance. Combined with ACORN integrated filtering for high-recall filtered search, it's the strongest choice for enterprise search that needs both keyword precision and semantic recall under complex filters."
          }
        ],
        redFlags: [
          {
            junior: "\"pgvector is free so I'd always start there.\"",
            senior: "\"pgvector is free to use but has a real recall cost under selective filters and a real scale ceiling. If the use case has per-user filtering or will grow past 50M vectors, the 'free' choice becomes expensive in engineering time to work around limitations.\""
          },
          {
            junior: "\"Pinecone handles everything — just use it.\"",
            senior: "\"Pinecone is excellent for managed scale but doesn't do SQL joins, has a complex cost model at high QPS, and creates vendor lock-in. I'd evaluate it against the specific requirements, not as a default.\""
          }
        ],
        alternatePhrasings: [
          "\"When would you NOT use pgvector?\"",
          "\"What are the hidden costs of Pinecone in production?\"",
          "\"Which vector database would you choose for a multi-tenant SaaS product?\""
        ],
        interviewContexts: [
          "Senior AI engineer architecture review at a Series B AI-native company",
          "Staff ML platform interview with infrastructure cost focus",
          "Asked at a multi-tenant SaaS engineering design interview"
        ]
      }
    ],
    topics: {
      moreDeepDives: [
        "Explain the ADC (Asymmetric Distance Computation) optimization in FAISS product quantization.",
        "How do you implement zero-downtime index migration from pgvector to a dedicated vector database?",
        "What is SCANN (Google's Scalable Approximate Nearest Neighbors) and how does it compare to HNSW?",
        "How do you implement a hybrid retrieval pipeline combining BM25 and vector search with score fusion?",
        "Walk me through training a PQ codebook: data requirements, validation, and common pitfalls."
      ],
      decisions: [
        "At what scale does HNSW's memory footprint force you to switch to IVF-PQ or sharding?",
        "When does the re-ranking step (cross-encoder) justify its latency cost in a RAG pipeline?",
        "How do you choose between Weaviate, Qdrant, and Pinecone for a production deployment under specific constraints?"
      ],
      quickRef: [
        "PQ memory reduction formula: original bytes vs PQ bytes?",
        "What is ADC in PQ?",
        "HNSW soft delete: why does it degrade recall over time?",
        "What is Recall@k and how do you measure it?",
        "Fan-out + merge pattern in sharded vector search?",
        "What is the over-fetch multiplier and why is it needed?",
        "Cross-encoder vs bi-encoder: key difference?",
        "What does Weaviate ACORN solve?",
        "pgvector filtered search limitation in one sentence?",
        "IVF centroid staleness: how to detect?"
      ],
      redFlags: [
        {
          junior: "\"I'd use PQ to save memory without measuring recall.\"",
          senior: "\"PQ can cut recall by 5-15%. I always measure Recall@k before and after compression on a representative query set — never enable PQ without a recall baseline.\""
        },
        {
          junior: "\"Sharding is easy — just distribute vectors across nodes.\"",
          senior: "\"Nearest neighbors are global, not local. Sharding requires fan-out to all shards, over-fetch, and coordinator-side merge. Recall of the merged result must be measured, not assumed.\""
        },
        {
          junior: "\"pgvector with a WHERE clause handles filtering fine.\"",
          senior: "\"pgvector post-filters by default. Under a selective filter (<5% of vectors match), recall can drop to 60-70%. Multi-tenant workloads need integrated filtering — Weaviate or Qdrant, not pgvector.\""
        },
        {
          junior: "\"Soft deletes are fine, we don't need to rebuild.\"",
          senior: "\"After significant delete volume, dead nodes accumulate in the HNSW graph and degrade recall and latency. I'd schedule periodic full index rebuilds with a blue-green swap strategy.\""
        }
      ],
      checklist: [
        "Know the PQ memory reduction math and typical recall degradation range (5-15%)",
        "Explain the fan-out + merge architecture for sharded vector search and the over-fetch strategy",
        "Name all six failure modes in filtered vector search at production scale",
        "Be ready to do memory math (n × d × 4 bytes) and reason from it to index and compression choices",
        "Know the pgvector vs Pinecone vs Weaviate decision framework with specific constraint triggers"
      ],
      behavioral: [
        "Tell me about the largest-scale vector search system you've built or contributed to — what were the key design decisions?",
        "Describe a time vector search quality degraded in production. How did you detect it and what did you change?",
        "How have you explained the recall-latency trade-off to a product manager or non-technical stakeholder?"
      ],
      reverse: [
        "What is the current recall@k for your production vector search, and how is it monitored?",
        "Have you hit any of the filtering recall issues in production — how did you address them?",
        "What is the vector index memory footprint today and how close are you to the single-node ceiling?"
      ]
    }
  }
};
