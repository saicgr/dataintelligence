import type { Authored, ToolTopics } from "../content-de";
import type { Level } from "../../types";

export const levels: Partial<Record<Level, { authored: Authored[]; topics: ToolTopics }>> = {
  // ─────────────────────────────────────────────────────────────
  // JUNIOR  — What RAG is + why, embeddings, top-k retrieval, basic chunking
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
          "What is Retrieval-Augmented Generation (RAG) and why would you use it instead of just relying on the LLM's built-in knowledge?",
        answerStructured:
          "- **RAG** connects a language model to an external knowledge source at query time: the pipeline retrieves relevant documents, injects them into the prompt as context, and the LLM generates a grounded answer from that context.\n- **Why not just the LLM?** Three problems: (1) **knowledge cutoff** — models freeze at training time and don't know about events after that date; (2) **hallucination** — when the model doesn't know something, it often fabricates a plausible-sounding answer; (3) **private data** — your internal documents, wikis, and product data never went into the model's weights.\n- **RAG vs fine-tuning**: RAG is the right choice when knowledge changes frequently, needs to be auditable with sources, or lives in private documents. Fine-tuning is better for teaching the model a tone, format, or domain behavior that doesn't change — it encodes knowledge into weights, which is expensive to update.\n- The four-stage pipeline: **ingest** (chunk + embed documents) → **index** (store vectors in a vector DB) → **retrieve** (embed query, find nearest neighbors) → **generate** (inject top-k chunks into the prompt, call the LLM).",
        explanationDeep:
          "The key insight is that LLMs are great reasoners but poor databases. They synthesize language well, but their 'memory' is frozen at training time and imprecise — what looks like recall is actually reconstruction. RAG separates the memory problem (vector search is very good at retrieval) from the reasoning problem (the LLM is very good at synthesis given accurate context).\n\nThe alternative — fine-tuning on your documents — sounds appealing but has major practical drawbacks: it's expensive to retrain every time documents change, the knowledge is opaque (you can't audit which document produced an answer), and fine-tuning can cause catastrophic forgetting of the model's general capabilities. RAG sidesteps all of that: update the knowledge base by re-indexing documents, and the change takes effect immediately.\n\nFine-tuning still makes sense for style, format, and behavioral changes — teaching the model to respond in a specific tone, follow a particular output schema, or reason in a domain-specific way. In practice, teams often combine both: RAG for freshness and auditability, fine-tuning for behavior.",
        interviewerLens:
          "I'm listening for 'knowledge cutoff + hallucination + private data' as the three reasons, and then the RAG-vs-fine-tuning distinction. Junior candidates often say 'RAG is better than fine-tuning' with no nuance — the senior signal is knowing each is the right tool for a different job. If you can name the four pipeline stages in order, you've demonstrated a working mental model, not just a definition.",
        followupChain: [
          {
            question: "When would you choose fine-tuning over RAG?",
            answer: "When the knowledge is stable and doesn't need to be cited — for example, teaching the model to respond in a consistent brand voice, follow a custom output format, or reason in a specialized domain (medical coding, legal clause classification). Fine-tuning encodes behavior into weights; RAG injects knowledge at inference time. They solve different problems."
          },
          {
            question: "What happens if no relevant documents are retrieved?",
            answer: "The LLM generates with no grounding context, which is basically back to relying on parametric memory — hallucination risk spikes. Good systems either detect this (low similarity score on all retrieved chunks) and respond 'I don't have enough information,' or guard against it with a fallback prompt instruction like 'if the context doesn't contain the answer, say so explicitly.'"
          },
          {
            question: "What is a vector embedding and why does retrieval use it?",
            answer: "An embedding is a dense numeric vector (e.g., 1536 floats) that represents a piece of text as a point in high-dimensional space, such that semantically similar texts are geometrically close. Retrieval computes the embedding of the query and finds document chunks whose embeddings are nearest — this captures semantic similarity, not just keyword overlap. A search for 'car repair cost' will find 'automobile maintenance pricing' even without shared words."
          }
        ],
        redFlags: [
          {
            junior: "\"RAG is just better than fine-tuning, always use it.\"",
            senior: "\"RAG is better when knowledge is dynamic or needs to be cited; fine-tuning is better for stable behavioral changes. They solve different problems and teams often combine both.\""
          },
          {
            junior: "\"The LLM just looks up the answer in its training data.\"",
            senior: "\"LLMs don't look up — they reconstruct plausible text from compressed patterns. RAG adds a real retrieval step so the model generates from actual retrieved documents, not reconstructed memory.\""
          }
        ],
        alternatePhrasings: [
          "\"Explain RAG in simple terms.\"",
          "\"Why not just fine-tune the model on your documents?\"",
          "\"How does RAG prevent hallucination?\""
        ],
        interviewContexts: [
          "Asked at almost every entry-level AI engineering screen in 2024–2025",
          "Junior ML engineer role at a Series B SaaS company",
          "LLM application developer screen"
        ]
      },
      {
        category: "deep-dives",
        riskLevel: "high",
        asked: 22,
        questionText:
          "Walk me through how chunking works in a RAG pipeline and how you would pick a chunk size.",
        code: [
          {
            lang: "python",
            label: "fixed-size + overlap",
            lines: [
              "def chunk(text, size=400, overlap=60):",
              "    toks = text.split()",
              "    out, i = [], 0",
              "    while i < len(toks):",
              "        out.append(toks[i:i+size])",
              "        i += size - overlap  # overlap",
              "    return out",
            ],
          },
        ],
        answerStructured:
          "- **Chunking** splits source documents into smaller segments before embedding, because: (1) embedding models have token limits (typically 512–8192 tokens); (2) smaller, focused chunks produce more precise embeddings — a 4,000-token document embedding averages over many topics, diluting retrieval signal.\n- **Too small** (e.g., 50 tokens): chunks lose context and become sentence fragments that embed poorly. Retrieved chunks may not contain enough information to answer the question.\n- **Too large** (e.g., 2,000 tokens): chunks cover multiple topics, reducing embedding precision. Retrieved chunks also consume more of the LLM's context window.\n- **Typical starting point**: 300–500 tokens with a 10–20% overlap between adjacent chunks. Overlap prevents answers from being split across chunk boundaries.\n- **Why overlap?** A sentence at the end of chunk N and the start of chunk N+1 won't appear in either chunk alone — overlap ensures boundary-spanning content stays accessible.\n- **Chunking strategies**: fixed-size (simple, ignores structure), sentence-based (respects natural breaks), paragraph-based (good for prose), semantic chunking (groups by topic shift — best quality, higher cost).",
        explanationDeep:
          "The intuition for chunk size is a precision/recall trade-off. Small chunks are precise — each embedding represents a tight topic, so vector similarity is sharper. But small chunks can miss the surrounding context that makes an answer complete. Large chunks contain more context but their embeddings blend many topics, making them harder to match to specific queries.\n\nOverlap is the practical fix for boundary loss. If you chunk a legal contract into 400-token segments with no overlap, a key clause might be split across chunk 3 and chunk 4 — neither chunk contains the complete clause. With 15% overlap (~60 tokens), both chunks include that boundary region, so either can be retrieved.\n\nSemantic chunking — grouping tokens by detected topic changes rather than fixed lengths — produces the highest-quality chunks but requires a model call per document section to detect topic shifts, which adds ingestion cost. For a first version, fixed-size with overlap is the pragmatic starting point; semantic chunking becomes worthwhile when retrieval quality (measured by recall@k on a labeled test set) is insufficient.",
        interviewerLens:
          "I want to hear 'too small loses context, too large dilutes the embedding' — that trade-off framing shows conceptual understanding. The overlap explanation is the next signal: candidates who know overlap exists and why (boundary-spanning content) have built a real RAG system. If you also mention that chunk size should be validated by measuring retrieval recall on a test set, you're thinking like an engineer, not just reading a tutorial.",
        followupChain: [
          {
            question: "How do you choose between fixed-size and semantic chunking?",
            answer: "Start with fixed-size (it's simple and fast to implement), measure retrieval recall@k on a labeled test set, and switch to semantic chunking if recall is insufficient. Semantic chunking adds ingestion compute cost and complexity — it only pays for itself if you can measure a quality improvement."
          },
          {
            question: "How do you handle documents with natural structure — like PDFs with headers and sections?",
            answer: "Respect the structure: split at section boundaries (headings, paragraphs) rather than fixed token counts. Store the section title and document metadata as chunk metadata so the retriever can also filter by section or document type. Forcing fixed-size chunks across section breaks destroys the structural signal."
          }
        ],
        redFlags: [
          {
            junior: "\"I'd use whatever the default chunk size is.\"",
            senior: "\"I'd start at 300–500 tokens with overlap, then validate the choice by measuring retrieval recall@k on a labeled test set — chunk size is a hyperparameter, not a constant.\""
          },
          {
            junior: "\"Bigger chunks always give more context, so use bigger chunks.\"",
            senior: "\"Bigger chunks dilute the embedding across multiple topics — retrieval precision drops. There's a trade-off, and the right size depends on your documents and query distribution.\""
          }
        ],
        alternatePhrasings: [
          "\"Why do we chunk documents before embedding them?\"",
          "\"What chunk size would you use and why?\"",
          "\"What is chunk overlap and why does it matter?\""
        ],
        interviewContexts: [
          "Entry-level AI engineer screen at a document-intelligence startup",
          "MLOps engineer interview at a Series A LLM app company",
          "Asked in a RAG system design intro round"
        ]
      },
      {
        category: "deep-dives",
        riskLevel: "medium",
        asked: 18,
        questionText:
          "What is top-k retrieval in a RAG system? How do you pick k, and what goes wrong at the extremes?",
        code: [
          {
            lang: "python",
            label: "top-k retrieval",
            lines: [
              "q = embed(query)",
              "hits = index.search(q, k=5)",
              "ctx = [h.text for h in hits]",
              "prompt = SYS + '\\n'.join(ctx) + query",
            ],
          },
        ],
        answerStructured:
          "- **Top-k retrieval** fetches the k document chunks with the highest vector similarity score to the query embedding. These k chunks become the context injected into the LLM prompt.\n- **Too small k** (e.g., k=1): retrieval is brittle — if the single closest chunk misses a nuance, the model has nothing to fall back on. Recall suffers.\n- **Too large k** (e.g., k=30): the prompt fills up with marginally relevant or irrelevant chunks. The model gets distracted by noise, answers degrade, and context window cost increases.\n- **Typical starting point**: k=3–5 for most applications. Tune based on the complexity of queries and available context window.\n- **Interaction with context window**: if each chunk is 400 tokens and k=10, that's 4,000 tokens of context before your question and system prompt. On a 4K-token model, you'd overflow. On GPT-4 with a 128K window, it's fine.\n- **Practical tuning**: measure answer quality (human eval or LLM-graded) across k values on a test set. Also look at retrieval precision@k — how many of the k chunks are actually relevant?\n- Consider **reranking** (a cross-encoder) to improve the quality of the top chunks after an initial large-k retrieval.",
        explanationDeep:
          "The k hyperparameter sits at the intersection of retrieval recall and generation quality. Low k gives the model a tight, focused context but risks missing the relevant document entirely. High k improves recall but floods the prompt with low-quality context — which is actually worse than no context, because the model may hallucinate by blending irrelevant chunks.\n\nThe context window size is a real constraint that beginners underestimate. With k=10 and 400-token chunks, you've spent 4,000 tokens on retrieval before the system prompt and query. On a system with a 4,096-token limit (early GPT-3.5), that's the entire window. With modern 128K context models, k can be much larger, but there's growing evidence that LLMs struggle to use information buried in the middle of very long contexts (the 'lost in the middle' problem) — more context doesn't always mean better answers.\n\nThe right approach is empirical: measure precision@k (are the retrieved chunks actually relevant?) and end-to-end answer quality. If retrieval precision is low at k=5, a reranker can improve quality more effectively than just increasing k.",
        interviewerLens:
          "I'm checking whether you understand the two-sided failure: too small misses answers, too large adds noise. The context-window interaction is the signal that you've actually shipped a RAG system — you've hit the overflow problem or seen the cost. Mentioning reranking as the right tool for improving quality (rather than just increasing k) is the mid-to-senior signal.",
        followupChain: [
          {
            question: "How do you measure whether your k is right?",
            answer: "Two metrics: retrieval recall@k (is the ground-truth document in the top k?) on a labeled test set, and end-to-end answer quality (LLM-graded or human). If recall@k is low, k is too small or the retriever is weak. If recall is high but answer quality is low, the problem may be generation or irrelevant chunks polluting the prompt."
          }
        ],
        redFlags: [
          {
            junior: "\"I'd set k as high as the context window allows.\"",
            senior: "\"More chunks doesn't mean better answers — irrelevant chunks add noise. I'd start at k=3–5, measure retrieval precision and answer quality, and rerank rather than blindly increasing k.\""
          }
        ],
        alternatePhrasings: [
          "\"How many documents do you retrieve in a RAG pipeline?\"",
          "\"What is the trade-off between a small k and a large k?\"",
          "\"How does the context window size affect retrieval design?\""
        ],
        interviewContexts: [
          "Junior AI engineer screen at an enterprise search startup",
          "Entry-level LLM engineer interview at a B2B SaaS company"
        ]
      },
      // ── decision-frameworks ───────────────────────────────────
      {
        category: "decision-frameworks",
        riskLevel: "medium",
        asked: 15,
        questionText:
          "RAG vs fine-tuning vs prompting — how do you decide which approach to use for a new LLM application?",
        answerStructured:
          "- **Prompting only**: right when the task is within the model's existing knowledge and a well-crafted system prompt is sufficient. Zero extra cost or infrastructure.\n- **RAG**: right when knowledge is (a) private, (b) frequently updated, or (c) needs to be cited/auditable. Use RAG when the model doesn't know your domain but the knowledge can be written down and retrieved.\n- **Fine-tuning**: right when you need to change *how* the model behaves — output format, tone, domain reasoning style — not just what it knows. Fine-tuning is expensive to update and doesn't give you citations.\n- **Decision tree**: Is the needed knowledge in the model's training data? → Prompting may suffice. Is the knowledge private or changing? → RAG. Is the problem about model behavior/style/format, not knowledge? → Fine-tuning.\n- These aren't mutually exclusive: teams often RAG + fine-tune (RAG for freshness, fine-tuning for domain vocabulary/behavior).",
        explanationDeep:
          "The mistake junior engineers make is treating RAG and fine-tuning as competitors. They solve different problems. RAG is about getting the right information into the model's context at inference time. Fine-tuning is about changing the model's behavior, not its knowledge.\n\nA concrete example: if you're building a customer support bot for a software product, fine-tuning might teach the model to always respond in a structured format and use the product's terminology. RAG provides the actual support documentation, release notes, and customer account data that changes constantly. Neither alone is ideal; combining them is often the production answer.\n\nThe cost calculus matters too. Prompting is free beyond inference tokens. RAG adds vector search infrastructure and embedding costs, but those are cheap. Fine-tuning costs significant compute and time upfront plus re-training whenever behavior needs to change. That upfront cost is worth it for stable behavioral requirements, not for knowledge that changes daily.",
        interviewerLens:
          "The answer I want is structured around three different problem types, not a declaration that one approach is always better. Junior candidates often say 'use RAG for everything' — the sophisticated answer is that prompting is often enough for simple tasks, fine-tuning handles behavior changes, and RAG handles knowledge retrieval. The insight that they combine rather than compete is the senior signal.",
        followupChain: [
          {
            question: "When would you use all three — prompting, RAG, and fine-tuning together?",
            answer: "A medical QA bot: fine-tune on medical reasoning style and output format (behavior); RAG over the patient's records and current clinical guidelines (fresh private data); carefully engineered system prompt for safety guardrails and response structure (prompting). Each layer solves a different problem."
          }
        ],
        redFlags: [
          {
            junior: "\"I'd fine-tune the model on my documents.\"",
            senior: "\"Fine-tuning teaches behavior, not knowledge — and it's expensive to update. For private, frequently-changing documents, RAG is almost always the right first choice.\""
          }
        ],
        alternatePhrasings: [
          "\"Should I fine-tune or use RAG for my domain-specific chatbot?\"",
          "\"When is prompting enough and when do you need RAG?\"",
          "\"What's the difference in use cases for RAG vs fine-tuning?\""
        ],
        interviewContexts: [
          "Junior AI engineer interview at a GenAI startup",
          "Entry-level ML engineer screen at an enterprise software company"
        ]
      },
      {
        category: "decision-frameworks",
        riskLevel: "low",
        asked: 11,
        questionText:
          "How do you choose an embedding model for a RAG system?",
        answerStructured:
          "- **Key axes**: (1) quality (retrieval recall on your domain), (2) cost (API vs self-hosted), (3) latency (cloud API adds a network hop; local models are faster once deployed), (4) dimension size (higher dimensions can mean richer representations but larger index).\n- **Hosted options**: OpenAI `text-embedding-3-small/large` (strong general-purpose, API cost scales with volume), Cohere Embed (multilingual strength), Google `text-embedding-004`.\n- **Open-source / self-hosted**: `sentence-transformers` (e.g., `all-MiniLM-L6-v2` for fast and cheap, `bge-large-en-v1.5` for high quality), `nomic-embed-text`. Self-host when data privacy matters or at high query volume.\n- **Evaluation**: benchmark on your actual data using MTEB retrieval tasks or a custom labeled test set. General leaderboard rankings don't always transfer to domain-specific content.\n- **Practical default**: start with `text-embedding-3-small` if you're on OpenAI infrastructure (good quality, cheap); switch to a self-hosted model if you need data privacy or the volume-driven cost becomes significant.",
        explanationDeep:
          "The common mistake is picking the highest MTEB benchmark score without validating on domain data. A model that excels on Wikipedia QA may underperform on financial documents or code. Evaluation on your own labeled query-document pairs (50–200 examples is often enough to detect major differences) is more reliable than any public leaderboard.\n\nDimension size matters for practical reasons: a 3,072-dimension model (OpenAI large) stores 4x the bytes per vector vs a 768-dimension model and requires more memory for the vector index. For millions of documents, this matters for both storage cost and ANN search speed. Many modern models let you reduce dimensions via matryoshka representation learning (MRL) with modest quality loss — OpenAI's 3-small supports this.\n\nPrivacy is often the deciding factor. If your documents contain sensitive customer data, sending them to an embedding API means that data leaves your infrastructure. Self-hosted models (running on your GPU) give you the same quality without the privacy concern.",
        interviewerLens:
          "The signal I want is 'evaluate on your own data, not just MTEB' — it tells me you know that benchmark rankings don't always transfer. Mentioning the privacy vs cost trade-off for hosted vs self-hosted shows production thinking. Juniors who just say 'use OpenAI embeddings' have not thought about what happens when volume or privacy constraints kick in.",
        followupChain: [
          {
            question: "What is MTEB and why can't you rely on it alone?",
            answer: "MTEB (Massive Text Embedding Benchmark) is a standardized benchmark for embedding model quality across retrieval, classification, and clustering tasks. It's a useful baseline, but it evaluates on public datasets that may not match your domain. A model that ranks #1 on MTEB may underperform on specialized domain text (legal, medical, code). Always validate on a sample of your actual data."
          }
        ],
        redFlags: [
          {
            junior: "\"I'd use whichever embedding model has the best benchmark score.\"",
            senior: "\"I'd benchmark on my own domain data — general MTEB scores don't always transfer. I'd also factor in privacy requirements and volume-driven cost before committing to a hosted API.\""
          }
        ],
        alternatePhrasings: [
          "\"Which embedding model would you pick for a RAG system and why?\"",
          "\"OpenAI embeddings vs open-source — when do you pick each?\"",
          "\"How do you evaluate embedding model quality?\""
        ],
        interviewContexts: [
          "Junior AI engineer loop at a document intelligence startup",
          "ML engineer screen at a privacy-sensitive healthcare company"
        ]
      },
      // ── tool-comparison ───────────────────────────────────────
      {
        category: "tool-comparison",
        riskLevel: "medium",
        isComparison: true,
        comparisonTools: ["Vector Search", "Keyword Search (BM25)"],
        asked: 14,
        questionText:
          "Vector search vs keyword search (BM25) — what does each do well and when would you choose one over the other?",
        answerStructured:
          "- **Vector search (dense retrieval)**: converts query and documents to embedding vectors; retrieves by geometric proximity. Captures **semantic similarity** — 'automobile maintenance' matches 'car repair' without shared words.\n- **BM25 (sparse retrieval)**: classic keyword frequency-based ranking. Strong on **exact term matches** — product codes, error messages, function names, rare domain terms that embeddings may blur or misrepresent.\n- **Where vector search wins**: paraphrased queries, conceptual questions, multilingual settings, when the vocabulary is natural language.\n- **Where BM25 wins**: technical precision — part numbers, error codes, API names, proper nouns. Dense embeddings often lose fine-grained token identity.\n- **Hybrid**: use both in parallel, then combine scores (RRF — Reciprocal Rank Fusion is a simple, effective method). Hybrid is usually the safest default for production because real-world query distributions include both types.\n- Most production vector databases (Weaviate, Qdrant, Elasticsearch with dense vectors) support hybrid search natively.",
        explanationDeep:
          "The failure mode of pure vector search is precision on rare, specific terms. If a user searches for error code 'ERR_NETWORK_TIMEOUT_4082,' the embedding model will map that string to a generic 'network timeout' region of the embedding space — it loses the specific token. BM25, being a term-frequency model, will find that exact string wherever it appears.\n\nThe failure mode of pure BM25 is vocabulary mismatch. If a user asks 'how do I fix my car's braking system' and the document says 'brake caliper replacement procedure,' BM25 sees little term overlap and ranks it low. Vector search finds it immediately because semantically it's close.\n\nHybrid search with RRF is the practical default: run both pipelines independently, rank by each, then combine the ranks using the Reciprocal Rank Fusion formula (1/(k + rank)) for each result, and sum. The winner gets high scores from at least one system. No training needed, no score normalization required — it just works. The only cost is running two retrieval pipelines, which is acceptable in most systems.",
        interviewerLens:
          "I want 'exact terms vs semantic paraphrasing' as the core distinction, with a concrete example of where each fails. The RRF/hybrid mention is the signal that you've actually implemented retrieval, not just read about it. Candidates who say 'always use vector search because it's semantic' haven't thought about the error-code problem.",
        followupChain: [
          {
            question: "What is Reciprocal Rank Fusion (RRF)?",
            answer: "RRF combines ranked lists from multiple retrieval systems without requiring score normalization. For each document, compute 1/(k + rank) for each system (k is typically 60), sum across systems, and re-sort. Documents that appear near the top in multiple systems get the highest combined scores. It's parameter-insensitive and works well in practice without training."
          }
        ],
        redFlags: [
          {
            junior: "\"Vector search is always better because it understands meaning.\"",
            senior: "\"Vector search misses exact-term precision — error codes, product names, rare technical terms. For production I default to hybrid search (BM25 + vector + RRF) unless I have evidence that one clearly dominates.\""
          }
        ],
        alternatePhrasings: [
          "\"When would you use BM25 over embeddings?\"",
          "\"What is hybrid retrieval and when do you use it?\"",
          "\"Why is keyword search still relevant in a RAG system?\""
        ],
        interviewContexts: [
          "Junior AI engineer screen at an enterprise search company",
          "Entry-level ML engineer at a legal document AI startup",
          "RAG fundamentals screen at a Series A startup"
        ]
      }
    ],
    topics: {
      moreDeepDives: [
        "Walk me through setting up a minimal RAG pipeline from scratch — what libraries and steps?",
        "What is a vector database? How is it different from a regular database?",
        "How does approximate nearest-neighbor (ANN) search work and why use it instead of exact search?",
        "What is cosine similarity and why is it used instead of Euclidean distance for embeddings?",
        "How do you handle documents that exceed the embedding model's token limit?"
      ],
      decisions: [
        "Hosted vector DB (Pinecone, Weaviate Cloud) vs self-hosted vs pgvector — when does each make sense?",
        "When do you re-embed documents vs just re-index them?",
        "How do you decide whether to add metadata filtering to vector search?"
      ],
      quickRef: [
        "What is RAG in one sentence?",
        "What problem does chunking solve?",
        "What does k represent in top-k retrieval?",
        "What is a vector embedding?",
        "BM25 stands for what? What does it measure?",
        "What is cosine similarity?",
        "What is the ingestion stage of RAG?",
        "What does ANN stand for and why is it used?",
        "What is context window and why does it matter for RAG?",
        "RAG vs fine-tuning — which one updates knowledge faster?"
      ],
      redFlags: [
        {
          junior: "\"RAG always beats fine-tuning.\"",
          senior: "\"They solve different problems — RAG is for dynamic knowledge retrieval, fine-tuning is for behavioral/style changes. I use them together when needed.\""
        },
        {
          junior: "\"I'd use the highest-ranked MTEB embedding model.\"",
          senior: "\"MTEB scores don't always transfer to domain-specific data — I'd validate on a sample of my own query-document pairs.\""
        },
        {
          junior: "\"Higher k means better answers.\"",
          senior: "\"Too many chunks pollute the prompt with noise — I start at k=3–5, measure precision@k, and use a reranker rather than just increasing k.\""
        }
      ],
      checklist: [
        "Be able to explain the four RAG pipeline stages (ingest, index, retrieve, generate)",
        "Know the chunk size trade-off and why overlap exists",
        "Know when BM25 beats vector search and why hybrid retrieval is the safe default",
        "Be able to explain RAG vs fine-tuning use cases without declaring one always better",
        "Know the context window constraint and how it interacts with k and chunk size"
      ],
      behavioral: [
        "Tell me about a time you built or worked with an LLM-powered feature — what went wrong first?",
        "How would you explain RAG to a product manager with no ML background?",
        "Describe a situation where you had to pick between two technical approaches — what was your process?"
      ],
      reverse: [
        "What embedding model and vector DB are you currently using in production?",
        "Is the RAG pipeline evaluated on any automated metrics, or is it purely human review?",
        "How frequently does the knowledge base get re-indexed when documents change?"
      ]
    }
  },

  // ─────────────────────────────────────────────────────────────
  // MID  — Chunking strategies & overlap, hybrid search (BM25 + vector),
  //        rerankers (cross-encoder), retrieval eval recall@k
  // ─────────────────────────────────────────────────────────────
  mid: {
    authored: [
      // ── deep-dives ────────────────────────────────────────────
      {
        category: "deep-dives",
        riskLevel: "high",
        freePreview: true,
        asked: 27,
        questionText:
          "Explain hybrid search in a RAG pipeline — how does it combine BM25 and dense vector retrieval, and why is it better than either alone?",
        code: [
          {
            lang: "python",
            label: "reciprocal rank fusion",
            lines: [
              "def rrf(ranks, k=60):     # bm25+dense",
              "    s = {}",
              "    for lst in ranks:",
              "        for r, doc in enumerate(lst):",
              "            s[doc] = s.get(doc, 0) + \\",
              "                     1 / (k + r + 1)",
              "    return sorted(s, key=s.get,",
              "                  reverse=True)",
            ],
          },
        ],
        answerStructured:
          "- **Hybrid search** runs two retrieval pipelines in parallel: **sparse (BM25)** over an inverted index, and **dense (vector)** over the ANN index. Results are merged and re-ranked.\n- **BM25 wins on**: exact token matches — product codes, error strings, proper nouns, rare technical terms that embeddings blur into generic semantic regions.\n- **Dense wins on**: semantic paraphrasing — 'car repair' matches 'automobile maintenance' without shared tokens.\n- **Fusion**: the standard technique is **Reciprocal Rank Fusion (RRF)**. For each candidate, compute `1/(k + rank)` for each retrieval system (k=60 default), sum across systems, and re-rank. No score normalization needed — robust and parameter-light.\n- **Alternative fusion**: weighted linear combination of normalized BM25 and vector scores. Requires calibration but gives direct control over the trade-off.\n- **Alpha parameter**: some systems expose an alpha (0=pure BM25, 1=pure vector) that you tune based on your query distribution.\n- **Production default**: hybrid is almost always worth it — the cost of running two pipelines is small, and it covers failure modes neither system handles alone.",
        explanationDeep:
          "The fundamental failure mode of pure dense retrieval is what I call 'semantic blurring': the embedding model maps specific tokens (error codes, product IDs, rare names) into the broader semantic neighborhood they belong to. 'ERR_AUTH_EXPIRED_TOKEN' becomes approximately 'authentication timeout error' in embedding space — close to related concepts but no longer exact. BM25 retrieves it trivially because it matches the literal string.\n\nConversely, BM25 completely fails on paraphrase gaps. If your query says 'show me policies about staff absences' and your document says 'employee leave regulations,' BM25 sees minimal overlap. The embedding catches the semantic equivalence immediately.\n\nRRF is elegant because it requires no score normalization. Raw BM25 scores and cosine similarities live on different scales — you can't add them directly. RRF converts both to rank lists, then combines by rank position, which is scale-agnostic. The k=60 constant has been empirically shown to make top-ranked results from either system influential, while preventing any single low-ranked result from dominating. Most vector database products (Weaviate, Elasticsearch, Qdrant with sparse vectors) implement this natively — you don't have to build it yourself.",
        interviewerLens:
          "I'm listening for two concrete failure modes ('dense loses on exact terms, BM25 loses on paraphrase') before any discussion of how to combine them. Candidates who can name RRF and explain why rank-based fusion avoids the score normalization problem have clearly shipped hybrid search. The alpha/weighting discussion shows you've tuned it in practice, not just implemented the default.",
        followupChain: [
          {
            question: "How do you tune the balance between BM25 and vector in a hybrid system?",
            answer: "Either via the alpha hyperparameter (some systems expose this directly) or by weighting in the RRF formula. Tune by looking at your query distribution — if most queries are technical/exact (product codes, CLI commands), weight BM25 higher; if most are conversational/conceptual, weight vector higher. Evaluate using recall@k on a labeled test set split by query type."
          },
          {
            question: "What is sparse vector retrieval (SPLADE) and how is it different from BM25?",
            answer: "SPLADE learns sparse representations that are still token-based (like BM25) but trained to expand queries with related terms. It combines BM25's precision with some semantic expansion capability. It requires training unlike BM25, but can outperform both pure BM25 and dense retrieval in some settings. It runs on the same inverted-index infrastructure as BM25."
          }
        ],
        redFlags: [
          {
            junior: "\"Dense retrieval understands meaning, so it's always better than BM25.\"",
            senior: "\"Dense retrieval loses on exact token precision — product codes, error strings, rare proper nouns. I default to hybrid retrieval to cover both failure modes.\""
          },
          {
            junior: "\"I'd add the BM25 and vector scores together.\"",
            senior: "\"Raw scores live on different scales and can't be directly added — I use RRF which is rank-based and scale-agnostic, or normalize scores carefully if I need linear combination.\""
          }
        ],
        alternatePhrasings: [
          "\"When would BM25 outperform a dense retriever?\"",
          "\"What is RRF and why is it used for hybrid search?\"",
          "\"How do you combine sparse and dense retrieval results?\""
        ],
        interviewContexts: [
          "Mid-level AI engineer screen at an enterprise knowledge-base company",
          "ML engineer loop at a legal AI startup (2024)",
          "Asked at a Series B search infrastructure company"
        ]
      },
      {
        category: "deep-dives",
        riskLevel: "high",
        asked: 24,
        questionText:
          "Explain cross-encoder reranking in a RAG pipeline — how does it differ from bi-encoder retrieval, and when does it pay off?",
        code: [
          {
            lang: "python",
            label: "retrieve then rerank",
            lines: [
              "ce = CrossEncoder(",
              "    'cross-encoder/ms-marco-MiniLM-L6-v2')",
              "cand = index.search(q, k=100)",
              "pairs = [(query, c.text) for c in cand]",
              "scores = ce.predict(pairs)",
              "top = sorted(zip(scores, cand),",
              "             reverse=True)[:5]",
            ],
          },
        ],
        answerStructured:
          "- **Bi-encoder (retrieval stage)**: independently encodes query and document into separate vectors; similarity is computed by dot product or cosine. Fast because document vectors are pre-computed and stored in the index. Scales to millions of chunks.\n- **Cross-encoder (reranker)**: takes the query and a candidate document concatenated as a single input, and outputs a relevance score. **Cannot be pre-computed** — must run fresh on every query-document pair. Much slower but much more accurate because the model sees both texts together and can capture fine-grained interactions.\n- **Two-stage architecture**: bi-encoder retrieves top-100 candidates quickly, cross-encoder reranks to top-k (e.g., top-5). You never run the cross-encoder on the full corpus, only on the coarse retrieval output.\n- **When it pays off**: when top-k precision matters more than raw speed. If retrieved chunks are noisy, a reranker dramatically improves which chunks the LLM actually sees.\n- **Models**: Cohere Rerank API, BGE-Reranker, cross-encoder/ms-marco-MiniLM-L-12-v2 (open source). Cohere's API is lowest effort; self-hosted models reduce cost at scale.\n- **Latency cost**: a cross-encoder on 100 candidates typically adds 50–200ms. This is often acceptable for asynchronous workloads but requires careful placement in a real-time pipeline.",
        explanationDeep:
          "The fundamental reason bi-encoders are used for retrieval and cross-encoders for reranking is the computational structure. Pre-computing document embeddings and storing them in a vector index lets you search millions of chunks in milliseconds. But this also means the similarity score is computed from two separate representations — the model never sees the query and document in context together. It's scoring two things independently and measuring their geometric closeness, which is a proxy for relevance, not relevance itself.\n\nA cross-encoder processes the concatenated query+document pair as a single sequence. The attention mechanism can now relate specific query terms to specific document spans — 'when the query says X, does this document actually discuss X?' This full interaction produces much more accurate relevance scores. The cost is that you can't pre-compute anything — every candidate must be processed at query time.\n\nThe two-stage design is a standard engineering trade-off: use the fast bi-encoder to get a manageable candidate set (say, top-100), then use the accurate cross-encoder to rerank those 100. You get most of the quality benefit of the cross-encoder without running it on the full corpus. This pattern is used in industrial search systems (Bing, Google neural ranking) and is equally applicable to RAG.",
        interviewerLens:
          "I want 'bi-encoder = fast, pre-computable, approximate; cross-encoder = slow, full interaction, accurate' — and then the two-stage architecture as the solution to the speed-quality trade-off. Candidates who can say 'cross-encoder runs on the coarse retrieval output, not the full corpus' have understood the key design insight. The latency number (50–200ms) tells me you've measured it in production.",
        followupChain: [
          {
            question: "How do you decide whether to add a reranker to your pipeline?",
            answer: "Run an ablation: measure top-k precision (are the k chunks actually relevant?) before and after the reranker on a labeled test set. If retrieval precision is already high (k=5 chunks are almost always correct), the reranker adds latency with marginal gain. If precision is low — the retriever is pulling noisy results — the reranker fixes the quality problem more efficiently than increasing k or tuning embeddings."
          },
          {
            question: "What is the 'lost in the middle' problem and how does reranking help?",
            answer: "Research shows LLMs underweight information in the middle of long contexts — they attend better to the beginning and end. If you retrieve 10 chunks and the most relevant one lands at position 6, the model may effectively ignore it. Reranking puts the most relevant chunk first, improving the chance the LLM actually uses it. Good reranking + low k often outperforms high k alone."
          }
        ],
        redFlags: [
          {
            junior: "\"I'd use a reranker instead of a bi-encoder.\"",
            senior: "\"Cross-encoders can't scale to a full corpus — you'd run the reranker on the coarse bi-encoder output, not instead of it. The two-stage architecture exists for exactly this reason.\""
          },
          {
            junior: "\"I'd just increase k if the retrieved chunks aren't good enough.\"",
            senior: "\"Higher k adds more noise. A reranker improves quality within the existing candidate set — I'd benchmark both approaches rather than assuming more is better.\""
          }
        ],
        alternatePhrasings: [
          "\"What is the difference between a bi-encoder and a cross-encoder?\"",
          "\"Why do RAG systems use a two-stage retrieve-then-rerank architecture?\"",
          "\"When would you add a Cohere Rerank step to your pipeline?\""
        ],
        interviewContexts: [
          "Mid-level AI engineer loop at an enterprise document search company",
          "ML engineer screen at a fintech using RAG for policy lookup (2025)",
          "Asked at a Series C AI infrastructure startup"
        ]
      },
      {
        category: "deep-dives",
        riskLevel: "high",
        asked: 21,
        questionText:
          "How do you measure retrieval quality in a RAG system? Walk me through recall@k, precision@k, MRR, and NDCG.",
        code: [
          {
            lang: "python",
            label: "recall@k vs precision@k",
            lines: [
              "def recall_at_k(hits, gold, k):",
              "    return gold in hits[:k]",
              "def precision_at_k(hits, rel, k):",
              "    got = hits[:k]",
              "    n = sum(d in rel for d in got)",
              "    return n / k",
            ],
          },
        ],
        answerStructured:
          "- **Recall@k**: for a given query, is the ground-truth relevant chunk present in the top-k retrieved results? Ranges 0–1. **Most important RAG metric** — if recall is low, the model never sees the right document and no amount of generation improvement helps.\n- **Precision@k**: of the k retrieved chunks, what fraction are actually relevant? High precision means less noise injected into the prompt.\n- **MRR (Mean Reciprocal Rank)**: averages `1/rank_of_first_relevant_result` across queries. Good for single-answer queries where you care about where the first relevant chunk ranks. Limitation: ignores all relevant results after the first.\n- **NDCG@k (Normalized Discounted Cumulative Gain)**: rewards relevant results ranked higher, penalizes them ranked lower, normalized by the ideal ranking. Best when you have graded relevance (some documents are more relevant than others) and multiple relevant documents per query.\n- **Practical starting point**: measure recall@5 and recall@10 first. If recall@5 is below ~0.7, your retriever needs work before you optimize generation. Use MRR when queries have a single best answer; NDCG when you care about ordering multiple relevant results.\n- **How to get ground truth**: manually label 50–200 query/relevant-chunk pairs from real user queries. Or use an LLM to generate synthetic query-answer pairs from documents (with human spot-checking).",
        explanationDeep:
          "Recall@k is the most decision-relevant RAG metric because it gates everything downstream. If recall@k is 0.5, half your queries are being answered with no correct context — those answers will be wrong regardless of how good your LLM is. Improving recall@k from 0.5 to 0.8 will improve end-to-end answer quality more than any prompt engineering change you could make.\n\nThe limitation of recall@k is that it's binary — a chunk is either in the top k or not. It doesn't tell you whether the relevant chunk is at rank 1 or rank k. MRR captures this for single-answer scenarios: a relevant chunk at rank 1 contributes 1.0 to MRR, at rank 3 contributes 0.33. If MRR is high but recall@k is also high, you're retrieving the right chunk and putting it near the top — ideal.\n\nNDCG is needed when relevance isn't binary and there are multiple relevant chunks per query. If a query about 'refund policy' has three relevant chunks (one very relevant, two partially relevant), NDCG rewards putting the most relevant chunk first. Without NDCG, you can't distinguish a system that retrieves three equally-ranked relevant results from one that correctly puts the best result first.\n\nBuilding the labeled test set is often the hardest part. For production systems, the right approach is to sample real user queries, retrieve results, and have human reviewers label relevant chunks. LLM-assisted labeling (using the LLM to score retrieved chunks against known answers) can bootstrap quickly but needs human validation to avoid circular evaluation — the same model generation quality you're trying to measure.",
        interviewerLens:
          "I want recall@k named first and identified as 'the most important metric because it gates generation.' Candidates who jump straight to BLEU or ROUGE are evaluating the generator, not the retriever — two different problems. The MRR vs NDCG distinction (single best answer vs graded multiple) tells me you've designed evaluation harnesses, not just read about metrics. How you build the ground-truth dataset separates engineers from academics.",
        followupChain: [
          {
            question: "What does it mean if recall@k is high but answer quality is still low?",
            answer: "The right chunks are being retrieved (good retriever) but the LLM isn't using them correctly — this is a generation failure, not a retrieval failure. Investigate: are the relevant chunks being injected at the beginning of the prompt? Are there too many irrelevant chunks diluting the signal? Is the LLM ignoring the context and using parametric memory instead? This is why you evaluate retrieval and generation separately."
          },
          {
            question: "How do you create a ground-truth test set for retrieval evaluation efficiently?",
            answer: "Hybrid approach: (1) take 100 real user queries from logs, manually identify which chunks are relevant for each; (2) use an LLM to generate synthetic question-answer pairs from your documents (reverse generation: given a chunk, generate a plausible query), then human-spot-check 20%. This gives you hundreds of labeled pairs quickly. Refresh the test set quarterly as your knowledge base evolves."
          }
        ],
        redFlags: [
          {
            junior: "\"I'd evaluate RAG quality using BLEU and ROUGE scores.\"",
            senior: "\"BLEU/ROUGE measure generation surface similarity, not retrieval quality or factual grounding. For RAG I separate retrieval evaluation (recall@k, precision@k) from generation evaluation (faithfulness, answer relevancy). Evaluating the wrong layer gives you misleading signal.\""
          },
          {
            junior: "\"I'd measure end-to-end accuracy on a few sample queries.\"",
            senior: "\"End-to-end accuracy conflates retrieval and generation failures — if it's wrong, I don't know which component failed. I evaluate the retriever (recall@k) and the generator (faithfulness to context) separately so I know where to invest.\""
          }
        ],
        alternatePhrasings: [
          "\"How do you evaluate whether your RAG retriever is working?\"",
          "\"What is recall@k and why is it important for RAG?\"",
          "\"NDCG vs MRR — when would you use each?\""
        ],
        interviewContexts: [
          "Mid-level AI engineer loop at a search-infrastructure company (2025)",
          "ML engineer at an enterprise knowledge-base startup",
          "Asked in a RAG evaluation design interview at a Series B AI company"
        ]
      },
      {
        category: "deep-dives",
        riskLevel: "medium",
        asked: 17,
        questionText:
          "Walk me through advanced chunking strategies — semantic chunking, sliding window, and parent-child chunking — and when you would use each.",
        code: [
          {
            lang: "python",
            label: "parent-child expand",
            lines: [
              "hit = index.search(q, k=5)[0]",
              "# retrieved on the small chunk",
              "parent = parents[hit.parent_id]",
              "ctx = parent.text  # expand for LLM",
            ],
          },
        ],
        answerStructured:
          "- **Fixed-size with overlap** (baseline): simple, fast, doesn't respect document structure. Good starting point. Risk: cuts mid-sentence or mid-concept.\n- **Sentence-based**: split on sentence boundaries. Preserves natural language units. Better for prose documents; paragraph boundaries are often the right split point.\n- **Semantic chunking**: use an embedding model to detect topic shifts between consecutive sentences/paragraphs — split where cosine similarity drops significantly. Produces topically coherent chunks. Cost: an embedding call per sentence during ingestion.\n- **Sliding window**: adjacent chunks overlap significantly (e.g., 50% overlap). Expensive in storage/index size but maximizes boundary coverage. Useful when you can't afford to miss boundary-spanning answers.\n- **Parent-child chunking**: index small chunks for retrieval precision, but when a small chunk matches, expand to include its surrounding parent chunk (larger context window) before passing to the LLM. Best of both worlds: precise retrieval + rich context for generation.\n- **Decision**: start with sentence-based or fixed-size + small overlap. Add semantic chunking if recall on a labeled test set is insufficient. Use parent-child when generation quality suffers from fragmented chunk context despite good retrieval.",
        explanationDeep:
          "The parent-child pattern solves a genuine tension in RAG design: the best embedding precision comes from small, focused chunks (each embedding represents one idea), but the best generation quality comes from larger chunks that give the LLM surrounding context. Parent-child decouples these: index child chunks (e.g., 100–200 tokens) for high-precision retrieval, but when a child chunk is retrieved, replace it with its parent chunk (e.g., 500–800 tokens) before injecting into the prompt. You retrieve precisely and generate from rich context.\n\nSemantic chunking is conceptually appealing but has a real cost: you need an embedding call for every consecutive sentence pair during ingestion, which is expensive at scale. It's worth it when your documents have wildly varying topic density — academic papers, legal contracts with many distinct clauses, or technical documentation where sections are long but topically coherent. For plain prose (support articles, product descriptions), sentence-based chunking is usually sufficient.\n\nSliding window is a brute-force solution to boundary loss — it guarantees every possible boundary-spanning passage exists in at least one chunk. The cost is index bloat: 50% overlap doubles your chunk count and storage. It's worth it only when boundary-spanning answers are the rule (dense information packing) and you can't use parent-child for architectural reasons.",
        interviewerLens:
          "I want a structured comparison, not just a list of names. The parent-child explanation is the mid-to-senior signal — it shows you've understood that retrieval precision and generation context are in tension and that parent-child is a clean engineering solution. Candidates who describe semantic chunking but can't articulate when fixed-size is sufficient have over-engineered their thinking.",
        followupChain: [
          {
            question: "How does LangChain's RecursiveCharacterTextSplitter work and when is it appropriate?",
            answer: "It splits on a hierarchy of separators — first tries paragraph breaks, then sentence breaks, then word breaks, then characters — until chunks are under the target size. It preserves natural boundaries when possible, falls back to character splitting when necessary. Appropriate for general-purpose chunking when you want better-than-naive fixed-size splitting without the full cost of semantic chunking."
          }
        ],
        redFlags: [
          {
            junior: "\"I'd use the default chunking in LangChain.\"",
            senior: "\"The default is fixed-size, which is a reasonable start. I'd validate with recall@k on my actual documents and switch to sentence-based, semantic, or parent-child chunking if the retrieval quality is insufficient for the use case.\""
          }
        ],
        alternatePhrasings: [
          "\"What chunking strategy would you use for a RAG system over legal contracts?\"",
          "\"What is the difference between small-chunk retrieval and large-chunk context injection?\"",
          "\"How does parent-child chunking improve RAG quality?\""
        ],
        interviewContexts: [
          "Mid-level ML engineer at a legal AI company (2024)",
          "AI engineer loop at a document understanding startup",
          "RAG system design round at a Series B enterprise software company"
        ]
      },
      // ── decision-frameworks ───────────────────────────────────
      {
        category: "decision-frameworks",
        riskLevel: "high",
        asked: 19,
        questionText:
          "Your RAG system is returning answers that are accurate-sounding but factually wrong. How do you systematically debug whether the problem is in retrieval or generation?",
        answerStructured:
          "- **Bisect the pipeline**: treat retrieval and generation as independent components with independent failure modes. Debug them separately.\n- **Step 1 — Inspect retrieved chunks**: for each failing query, manually look at the top-k chunks. Does the correct answer exist anywhere in the retrieved context?\n  - **If NO**: retrieval failure. The right document is not being found. Fix: improve recall@k — better chunking, hybrid search, reranker, query expansion.\n  - **If YES**: generation failure. The model had the right context but produced a wrong or hallucinated answer. Fix: prompt engineering, faithfulness constraints, lower temperature, or verify the model isn't ignoring context in favor of parametric memory.\n- **Step 2 — Inject correct context directly**: take the gold-standard chunk and inject it into the prompt manually. If the answer becomes correct, confirm it's a retrieval failure. If it's still wrong, it's a generation failure.\n- **Step 3 — Measure retrieval recall@k** on a labeled test set to quantify how often the correct chunk is retrieved. Also measure **faithfulness** — what fraction of answer claims are supported by the retrieved context.\n- **Step 4 — Categorize your failure log**: tag each failing example as retrieval failure, generation failure, or knowledge gap (correct information doesn't exist in the knowledge base at all). This determines where to invest.",
        explanationDeep:
          "The most common mistake in debugging RAG is treating 'wrong answer' as a generation problem by default. Many practitioners immediately look at the LLM, tweak prompts, or switch models — only to discover weeks later that the retriever was the culprit and the model never had a chance. Separating the two evaluation surfaces prevents this.\n\nThe gold-context injection test is the decisive diagnostic. If you manually inject the correct chunk and the answer becomes correct, the LLM's generation capability is fine — the retriever isn't finding the right chunk. If the answer is still wrong with the correct context injected, you have a generation failure — the model may be ignoring context in favor of its parametric knowledge, or the generation prompt isn't strong enough to ground the response.\n\nFaithfulness measurement (using RAGAS or a custom LLM judge) can be automated: for each answer, ask an LLM 'is every claim in this answer supported by the retrieved context?' A high faithfulness score with wrong answers indicates the answer is faithfully following wrong context — a retrieval failure. A low faithfulness score indicates hallucination regardless of context quality — a generation failure. These two signals together point to the right fix.",
        interviewerLens:
          "The phrase I'm waiting for is 'bisect the pipeline — evaluate retrieval and generation separately.' Candidates who immediately say 'I'd tune the prompt' without first checking if the right document was retrieved have never systematically debugged a RAG system. The gold-context injection test is the decisive diagnostic that junior engineers miss. If you mention recall@k AND faithfulness as separate metrics for separate components, you've demonstrated end-to-end evaluation thinking.",
        followupChain: [
          {
            question: "What is the RAGAS framework and which metrics does it provide?",
            answer: "RAGAS (Retrieval Augmented Generation Assessment) is an open-source evaluation framework for RAG. Key metrics: Faithfulness (are answer claims supported by context?), Answer Relevancy (does the answer address the query?), Context Precision (what fraction of retrieved context is actually relevant?), Context Recall (does retrieved context contain the needed information?). It can score without human ground-truth answers by using LLM judges, making it practical for automated evaluation pipelines."
          },
          {
            question: "What is 'context relevance' vs 'faithfulness' in RAG evaluation?",
            answer: "Context relevance (or precision) measures the retriever: are the retrieved chunks relevant to the query? Faithfulness measures the generator: are the model's claims grounded in the retrieved context? A system can have high context relevance but low faithfulness (retrieved the right docs, LLM still hallucinated) or low context relevance but high faithfulness (retrieved wrong docs, LLM faithfully followed wrong context and produced a wrong answer). Distinguishing them is exactly the retrieval-vs-generation bisection."
          }
        ],
        redFlags: [
          {
            junior: "\"I'd try a better LLM if the answers are wrong.\"",
            senior: "\"First I'd check if the correct chunk was even retrieved — if it wasn't, no LLM upgrade will help. I bisect: inspect retrieved chunks for the failing query, inject gold context to isolate retrieval vs generation failure, then decide which layer to fix.\""
          }
        ],
        alternatePhrasings: [
          "\"Your RAG chatbot is giving plausible but wrong answers. What do you do?\"",
          "\"How do you know if your RAG failure is a retrieval problem or a generation problem?\"",
          "\"Walk me through debugging a RAG pipeline that gives hallucinated answers.\""
        ],
        interviewContexts: [
          "Mid-level AI engineer loop at a Series B enterprise AI company (2024)",
          "Senior ML engineer screen at a knowledge-management startup",
          "Asked at an LLM platform company in a systems debugging round"
        ]
      },
      {
        category: "decision-frameworks",
        riskLevel: "medium",
        asked: 13,
        questionText:
          "How do you add metadata filtering to a RAG retrieval pipeline, and when is it worth the added complexity?",
        code: [
          {
            lang: "python",
            label: "metadata pre-filter",
            lines: [
              "hits = index.search(",
              "    q, k=5,",
              "    filter={'dept': user.dept,",
              "            'date': {'$gte': '2025-01'}})",
              "# pre-filter: runs before ANN search",
            ],
          },
        ],
        answerStructured:
          "- **Metadata filtering** pre-filters candidate chunks by structured attributes (date, document type, author, department, product category) before or alongside vector similarity search.\n- **Why**: pure similarity search returns the semantically closest chunks regardless of whether they're relevant to the user's scope. A legal team searching for 'refund policy' shouldn't get HR policy chunks that happen to be semantically close.\n- **Implementation**: store metadata alongside each chunk in the vector database. At query time, add a `where` clause (e.g., `doc_type == 'legal' AND date >= '2024-01-01'`) to restrict the similarity search to matching chunks.\n- **Two patterns**: (1) **pre-filter** (restrict vector search to metadata-matching chunks — may miss relevant results if filter is too narrow), (2) **post-filter** (retrieve top-k by similarity, then filter — may return fewer than k relevant results if many are filtered out).\n- **When worth it**: when users have natural access control boundaries (teams, roles, date ranges), when document types are semantically similar but organizationally distinct (HR vs legal), or when freshness matters (prefer recent documents).\n- **When to skip**: if all documents are from the same type and time range, filtering adds complexity with no benefit.",
        explanationDeep:
          "Metadata filtering is one of the highest-leverage RAG improvements for enterprise use cases because it directly encodes business logic into retrieval. Without it, pure vector search returns the most semantically similar chunks across all documents — which may cross organizational boundaries, return outdated documents, or mix document types that should be kept separate.\n\nThe pre-filter vs post-filter trade-off is a precision/recall problem. Pre-filtering restricts the candidate pool before ANN search, which is fast but can hurt recall if the filter is aggressive — you might exclude the best document because it doesn't match the filter exactly. Post-filtering retrieves a larger set by similarity then applies filters, preserving recall at the cost of potentially returning fewer than k results (if most of the top-k fail the filter).\n\nThe practical solution for strict access control is pre-filtering: users should never see results from documents they don't have access to, even if those documents are the most semantically relevant. For softer filters (prefer recent, prefer certain types), post-filtering or a score penalty approach (downweight old documents rather than exclude them) is more appropriate.",
        interviewerLens:
          "I want the 'semantic similarity alone ignores organizational context' motivation, and then the pre-filter vs post-filter trade-off explained correctly as a recall/access-control choice. Candidates who can give a concrete example (legal vs HR documents, access control by team) have built real enterprise RAG systems. The access control case — where pre-filtering is non-negotiable — shows security thinking.",
        followupChain: [
          {
            question: "How do you extract and store metadata from unstructured documents?",
            answer: "For structured sources (CRMs, databases), metadata is attached natively. For unstructured documents (PDFs, docs), use parsing libraries (PyMuPDF, Unstructured.io) to extract headers, dates, authors, and section titles. For documents without explicit metadata, use an LLM to extract or classify attributes during ingestion (e.g., classify document type, extract date from text). Store metadata in the vector database's metadata field alongside the chunk embedding."
          }
        ],
        redFlags: [
          {
            junior: "\"I'd just do pure vector search and let similarity handle relevance.\"",
            senior: "\"Pure similarity ignores organizational scope — a user's query might be semantically similar to chunks from a department or time period that should be excluded. Metadata filtering is how you encode business logic into retrieval.\""
          }
        ],
        alternatePhrasings: [
          "\"How do you implement access control in a RAG system?\"",
          "\"How do you ensure users only see documents they're allowed to access?\"",
          "\"What is a metadata filter in vector search?\""
        ],
        interviewContexts: [
          "Mid-level AI engineer at an enterprise knowledge-base company",
          "ML engineer loop at a healthcare AI startup (data access control was a requirement)",
          "Asked at a legal AI company: how do you scope retrieval to a client matter?"
        ]
      },
      // ── tool-comparison ───────────────────────────────────────
      {
        category: "tool-comparison",
        riskLevel: "high",
        isComparison: true,
        comparisonTools: ["RAG", "Long Context (Full-document in prompt)"],
        asked: 20,
        questionText:
          "RAG vs long-context LLMs — now that models have 128K–1M token context windows, is RAG still necessary?",
        answerStructured:
          "- **Long context**: put all documents directly into the prompt. Eliminates retrieval complexity; the model reads everything. Works well when the document set is small and stable (< ~50K tokens in practice), and latency is acceptable.\n- **RAG advantages that survive long context**:\n  1. **Cost**: 1M tokens per query is expensive even at current prices. RAG injects only 2,000–5,000 tokens of context.\n  2. **Latency**: processing 1M tokens per query adds significant time; RAG is faster per query.\n  3. **Knowledge base updates**: re-index a document, change takes effect immediately. With long context, you'd have to re-embed or re-pass the entire corpus.\n  4. **Recall**: LLMs demonstrably underweight information in the middle of long contexts (the 'lost in the middle' problem — shown in Stanford research). RAG with good retrieval puts the right information first.\n  5. **Citation and auditability**: RAG naturally provides which chunks were retrieved; long context makes attribution harder.\n- **When long context wins**: < 100 documents, the query requires reasoning over the whole corpus at once, or retrieval precision is too low and accuracy matters more than cost.\n- **Practical answer**: they're complementary. Use RAG at scale; use long context for small, complex, high-value queries where you can afford the cost.",
        explanationDeep:
          "The 'long context kills RAG' narrative assumes models use long context perfectly — but research (Liu et al., 2023 'Lost in the Middle') showed that GPT-4 and other models significantly underweight information placed in the middle of very long contexts. They attend best to the beginning and end. If the relevant passage is in the middle of a 200,000-token prompt, the model may effectively miss it — which is exactly the recall problem RAG solves by putting the retrieved chunks first.\n\nCost is also a real constraint. At 2025 pricing, 1M input tokens per query at scale is expensive. RAG with 3,000 tokens of context per query costs orders of magnitude less. For a system handling 100,000 queries/day, the difference is significant.\n\nThe strongest case for long context over RAG is multi-hop reasoning over a corpus: questions that require comparing information from 10 different documents that can't be retrieved independently because each piece is only meaningful in context of the others. Here, retrieval struggles because no single chunk is 'the answer' — you need the whole picture. Long context handles this naturally. These cases exist but are less common than retrieval-friendly single-document QA.",
        interviewerLens:
          "I want 'cost + latency + lost-in-the-middle recall + knowledge-base freshness' as the four reasons RAG stays relevant. Candidates who say 'RAG is obsolete' haven't measured long-context cost at scale or read the lost-in-the-middle research. Candidates who say 'RAG is always better' haven't thought about the multi-hop reasoning edge case. The right answer is nuanced: complementary tools for different workloads.",
        followupChain: [
          {
            question: "What is the 'lost in the middle' problem and what evidence exists for it?",
            answer: "Liu et al. (2023, Stanford) showed that LLM performance on multi-document QA degrades significantly when the relevant document is in the middle of the context, compared to the beginning or end. Models exhibit a U-shaped performance curve by document position. This is well-replicated and affects GPT-4, Claude, and most frontier models, though newer models with better long-context training have partially mitigated it."
          }
        ],
        redFlags: [
          {
            junior: "\"Now that models have 1M context, RAG is obsolete.\"",
            senior: "\"Long context doesn't fix cost at scale, the lost-in-the-middle recall problem, or knowledge base update latency. RAG is still the right default for large dynamic corpora — long context is complementary for small-corpus, high-value, complex-reasoning queries.\""
          }
        ],
        alternatePhrasings: [
          "\"With Gemini 1M context, why would anyone use RAG?\"",
          "\"Long context vs RAG — which should I build?\"",
          "\"What are the limits of just putting everything in the context window?\""
        ],
        interviewContexts: [
          "Mid-to-senior AI engineer interviews in 2024–2025 (very common question post-Gemini)",
          "LLM platform architecture discussion at a Series C startup",
          "Asked at a FAANG-adjacent AI infrastructure team"
        ]
      }
    ],
    topics: {
      moreDeepDives: [
        "What is query expansion / HyDE (Hypothetical Document Embeddings) and when does it improve retrieval?",
        "How do you handle multi-hop queries that require reasoning across multiple retrieved documents?",
        "Explain RAG fusion — how does it use multiple query variants to improve retrieval coverage?",
        "How do you update a vector index incrementally when documents change?",
        "What is RAGAS and how do you set it up as an automated evaluation pipeline?"
      ],
      decisions: [
        "Pre-filter vs post-filter for metadata constraints — when does each make sense?",
        "When do you add a reranker vs increase k vs improve chunking — how do you prioritize?",
        "Bi-encoder only vs two-stage (bi-encoder + cross-encoder) — latency vs quality trade-off?"
      ],
      quickRef: [
        "What does recall@k measure?",
        "What is MRR and what is its limitation?",
        "What is RRF (Reciprocal Rank Fusion)?",
        "What is a cross-encoder and what is it used for?",
        "What is parent-child chunking?",
        "What is semantic chunking?",
        "What is RAGAS? What four metrics does it provide?",
        "What is the 'lost in the middle' problem?",
        "What is HyDE?",
        "What is NDCG@k and when does it differ from MRR?"
      ],
      redFlags: [
        {
          junior: "\"Dense vector retrieval is always better than BM25.\"",
          senior: "\"Dense retrieval loses on exact token precision — I default to hybrid retrieval so both failure modes are covered.\""
        },
        {
          junior: "\"I'd increase k to get better answers.\"",
          senior: "\"Higher k adds more noise. I'd first measure recall@k on a labeled set, then add a reranker if precision is low rather than just adding more chunks.\""
        },
        {
          junior: "\"I'd evaluate RAG quality with BLEU/ROUGE.\"",
          senior: "\"BLEU/ROUGE measure surface similarity to a reference — they don't measure retrieval quality or faithfulness. I evaluate the retriever (recall@k) and the generator (faithfulness) as separate components.\""
        }
      ],
      checklist: [
        "Know hybrid search (BM25 + dense + RRF) and the failure modes of each alone",
        "Understand bi-encoder vs cross-encoder and the two-stage architecture",
        "Know recall@k, precision@k, MRR, and NDCG and when to use each",
        "Be able to bisect retrieval vs generation failures using the gold-context injection test",
        "Know why long context doesn't make RAG obsolete (cost, lost-in-the-middle, freshness)"
      ],
      behavioral: [
        "Tell me about a time your RAG system gave wrong answers — how did you diagnose and fix it?",
        "Describe a chunking strategy decision you made — what data guided it?",
        "A time you had to explain RAG evaluation trade-offs to a non-technical stakeholder."
      ],
      reverse: [
        "Is retrieval evaluated separately from generation quality? What metrics are in place?",
        "Are you using hybrid search (BM25 + vector) or pure dense retrieval today?",
        "How are knowledge base updates handled — re-index everything or incremental updates?"
      ]
    }
  },

  // ─────────────────────────────────────────────────────────────
  // SENIOR  — Debugging "plausible but wrong" by bisecting retrieval vs generation,
  //           faithfulness/grounding checks, retrieval eval harness,
  //           production RAG at scale, comparisons: vector-only vs hybrid, RAG vs long-context
  // ─────────────────────────────────────────────────────────────
  senior: {
    authored: [
      // ── deep-dives ────────────────────────────────────────────
      {
        category: "deep-dives",
        riskLevel: "high",
        freePreview: true,
        asked: 26,
        questionText:
          "Your production RAG system gives answers that are plausible-sounding but factually wrong. Describe your end-to-end debugging methodology.",
        answerStructured:
          "- **Don't start with the LLM.** The most common mistake is blaming generation when retrieval is the culprit.\n- **Step 1 — Build a failure sample**: collect 20–50 queries where the answer is definitively wrong. Tag each with the correct answer and which knowledge base document contains it.\n- **Step 2 — Bisect at the retrieval boundary**: for each failure, inspect the top-k retrieved chunks. Ask: 'Does the ground-truth chunk appear in top-k?'\n  - **Not present**: retrieval failure. Invest in: hybrid search (BM25+vector), reranking, query expansion, better chunking, embedding model upgrade.\n  - **Present but wrong answer**: generation failure. Invest in: faithfulness prompt constraints, lower temperature, chunk ordering (put best chunk first), context window cleanup (remove noise chunks).\n- **Step 3 — Gold-context injection test**: inject the correct chunk manually into the prompt. If the answer becomes correct, it's definitively a retrieval failure. If still wrong, it's a generation failure.\n- **Step 4 — Quantify at scale**: compute recall@k, faithfulness (RAGAS or custom judge), and answer accuracy on the full labeled set. This tells you which failure mode dominates and where ROI is highest.\n- **Step 5 — Slice the failures**: some queries are retrieval failures, some generation, some genuine knowledge gaps (the information isn't in the knowledge base). Each requires a different fix. Conflating them wastes engineering time.",
        explanationDeep:
          "The 'plausible but wrong' failure pattern is the hardest to catch because the system looks correct to users who don't know the right answer. It's also the most dangerous in high-stakes domains — medical, legal, financial. The model is coherent and confident while wrong, which is more harmful than an obviously confused answer.\n\nThis failure typically comes from three sources: (1) The retriever finds a chunk that is topically nearby but not the specific relevant one — the model synthesizes an answer from related but incorrect context. (2) The model partially ignores the context and injects parametric memory — common when context contradicts what the model learned during training. (3) The retrieved context genuinely contains wrong or outdated information — a data freshness problem.\n\nEach has a different fix. For (1): improve retrieval precision with reranking or hybrid search. For (2): add explicit prompt instructions ('answer ONLY using the provided context; if the context doesn't contain the answer, say so'), use a faithfulness check to flag when model claims diverge from context, reduce temperature. For (3): add document freshness metadata and time-weight or filter old documents, add a knowledge base quality pipeline.\n\nThe gold-context injection test is the decisive diagnostic that most engineers don't use. It's operationally simple — you manually craft a prompt with the correct context — but it cleanly separates retrieval from generation failures in under five minutes per failure case. Building this as an automated evaluation harness (that injects correct context from your labeled set and checks if accuracy improves) gives you a systematic measure of how much retrieval is limiting you.",
        interviewerLens:
          "I'm looking for 'bisect at the retrieval boundary' before any other suggestion. Engineers who immediately say 'I'd try a better model' or 'I'd tune the prompt' without first checking what was retrieved have never owned a production RAG system. The gold-context injection test is the senior diagnostic that separates theory from practice. The taxonomy of failure modes (retrieval miss, generation hallucination, knowledge gap) and the separate remedies for each is the staff-engineer signal — it shows systems thinking, not just debugging heuristics.",
        followupChain: [
          {
            question: "How do you automate faithfulness checking at scale in production?",
            answer: "Two approaches: (1) LLM-as-judge — for each response, prompt a secondary LLM (smaller, cheaper) with 'given this context, does the following claim appear in the context or contradict it?' and aggregate a faithfulness rate. (2) NLI (natural language inference) classifier — run an NLI model on context/claim pairs to detect entailment vs contradiction vs neutral. LLM-as-judge is more flexible but more expensive; NLI is faster and cheaper for high-volume use. Both should be monitored for drift as your corpus and query distribution evolve."
          },
          {
            question: "What is 'context stuffing' and how does it relate to generation failures?",
            answer: "Context stuffing is injecting a large number of retrieved chunks into the prompt, hoping quantity compensates for quality. It typically makes generation worse: the model gets distracted by irrelevant chunks, the most relevant chunk gets 'lost in the middle,' and the model may hallucinate by blending conflicting chunks. The fix is aggressive chunk quality control — use a reranker, limit to top-3–5 high-quality chunks, and measure faithfulness rather than just recall."
          },
          {
            question: "How do you monitor RAG quality continuously in production without labeled data for every query?",
            answer: "Multiple signals: (1) Retrieval similarity score distribution — if average similarity scores drop, your queries are drifting away from your corpus. (2) LLM-as-judge faithfulness on a sample of production responses (automated). (3) User feedback signals (thumbs up/down, follow-up clarification questions as implicit negative signals). (4) Semantic drift in query embeddings — if the cluster structure of user queries shifts, your knowledge base coverage may be degrading. Alert on all of these with threshold-based monitoring."
          }
        ],
        redFlags: [
          {
            junior: "\"I'd try a bigger/better LLM model.\"",
            senior: "\"Upgrading the LLM won't help if the right context was never retrieved. I bisect first — inspect the retrieved chunks for each failure. If the correct chunk isn't in top-k, it's a retrieval problem no model upgrade can fix.\""
          },
          {
            junior: "\"I'd tune the prompt.\"",
            senior: "\"Prompt tuning is the right lever for generation failures, not retrieval failures. I diagnose which it is first — the same symptom (wrong answer) has two completely different causes.\""
          }
        ],
        alternatePhrasings: [
          "\"Your RAG chatbot sounds confident but is wrong 30% of the time. Walk me through what you do.\"",
          "\"How do you debug a RAG system in production when users report wrong answers?\"",
          "\"What's your process for improving a deployed RAG system's accuracy?\""
        ],
        interviewContexts: [
          "Senior AI engineer loop at a Series C enterprise AI company (2024)",
          "Staff ML engineer interview at a legal tech startup",
          "AI engineering design interview at a healthcare AI company"
        ]
      },
      {
        category: "deep-dives",
        riskLevel: "high",
        asked: 22,
        questionText:
          "Design a retrieval evaluation harness for a production RAG system. What components does it need and how do you keep it current?",
        answerStructured:
          "- **Core components**: (1) labeled query-document test set, (2) retrieval metrics computation (recall@k, precision@k, MRR, NDCG), (3) generation quality evaluation (faithfulness, answer relevancy), (4) automated CI gate, (5) continuous monitoring on production traffic.\n- **Test set construction**: collect 100–500 real user queries from logs; label which knowledge base chunks are relevant for each (human review + LLM-assisted bootstrap). Include edge cases: queries with no answer in the corpus, multi-hop queries, queries with conflicting information across documents.\n- **Retrieval metrics**: measure recall@k (is the ground-truth chunk in top-k?) for k=3, 5, 10. Track separately for query types (exact-match, paraphrase, multi-hop). Baseline: BM25 alone (cheap, should be beaten by any decent dense retriever).\n- **Generation metrics**: RAGAS faithfulness (LLM-graded: are answer claims grounded in context?), answer relevancy, and optionally exact-match or F1 against reference answers.\n- **CI gate**: run the full harness on every change to the knowledge base, embedding model, chunking strategy, or retrieval pipeline. Fail the deploy if recall@5 drops more than 5% from the baseline.\n- **Production monitoring**: sample 2–5% of production queries, run LLM-as-judge faithfulness check, track similarity score distributions, monitor query cluster drift.\n- **Test set maintenance**: refresh quarterly or after any major knowledge base or domain change. Stale test sets lose signal as your corpus and user distribution evolve.",
        explanationDeep:
          "The evaluation harness is infrastructure, not a one-time experiment. It needs to be automated, version-controlled, and tied to the deployment pipeline — otherwise RAG quality regresses silently every time someone changes the chunking strategy, swaps an embedding model, or adds new documents that shift the index distribution.\n\nThe hardest part is building and maintaining the labeled test set. Manual labeling is slow and expensive. The practical approach is a hybrid: use LLM-assisted generation (given a chunk, generate a plausible user query; given a query, retrieve candidates and have the LLM score them) to bootstrap a large set quickly, then have humans review the borderline cases and the high-stakes failure categories. The test set should cover your actual query distribution — weight heavily toward the query types your users actually ask, not hypothetical cases.\n\nThe CI gate is the cultural change that most teams resist until they've been burned by a silent regression. I've seen teams change a chunking strategy to fix one user complaint and quietly halve recall@5 for a different query category because they had no automated check. A recall@5 gate in CI catches this in minutes. The deployment latency cost is minimal — a labeled 200-query test takes seconds to evaluate.",
        interviewerLens:
          "I want to hear 'CI gate' early — the evaluation harness is worthless if it doesn't block bad deploys. Candidates who describe the metrics correctly but don't mention automation and continuous monitoring have built point-in-time evaluations, not production infrastructure. The test set maintenance cadence shows you understand that data distribution drift silently invalidates static test sets. 'LLM-as-judge' for generation metrics shows you know how to scale evaluation without requiring human labelers for every query.",
        followupChain: [
          {
            question: "How do you prevent your evaluation harness from having circular evaluation (using the same LLM to evaluate itself)?",
            answer: "Two strategies: (1) use a different model family as the judge — if your RAG pipeline uses GPT-4o for generation, use Claude Sonnet or Gemini as the judge. Different training distributions reduce correlated failure. (2) Calibrate the LLM judge against human labels on a subset — measure judge accuracy relative to human ground truth and discard the judge if correlation is below a threshold (typically r > 0.75). Never rely solely on LLM-as-judge without this calibration step."
          },
          {
            question: "How do you handle the test set coverage problem — users ask questions you didn't anticipate?",
            answer: "Continuously mine production query logs for novel query types that cluster away from your existing test set coverage. Use embedding clustering to identify uncovered regions in query space. When a new cluster appears (e.g., users start asking about a new feature that wasn't in the original knowledge base), add that cluster to the test set and the knowledge base. Think of it as a feedback loop: production distribution informs test set coverage, test set coverage informs evaluation completeness."
          }
        ],
        redFlags: [
          {
            junior: "\"I'd evaluate by trying a few queries manually.\"",
            senior: "\"Manual evaluation doesn't scale and misses silent regressions. I'd build a labeled test set, compute recall@k and faithfulness automatically, and gate deploys on these metrics — just like a unit test suite for the retrieval pipeline.\""
          }
        ],
        alternatePhrasings: [
          "\"How do you set up systematic evaluation for a RAG pipeline?\"",
          "\"How do you prevent RAG quality from degrading over time?\"",
          "\"What does a mature RAG evaluation system look like?\""
        ],
        interviewContexts: [
          "Senior AI engineer platform interview at a Series C AI company",
          "Staff ML engineer loop at a knowledge-management startup (2025)",
          "AI infrastructure design round at an enterprise software company"
        ]
      },
      {
        category: "deep-dives",
        riskLevel: "high",
        asked: 19,
        questionText:
          "Walk me through how you would design a RAG system for a large enterprise with 10 million documents, strict access control, and a requirement for cited, grounded answers.",
        answerStructured:
          "- **Ingestion at scale**: chunk documents with semantic chunking (respects structure); store chunks with rich metadata (document ID, section, owner, access control labels, timestamp). Embed with a high-quality model (e.g., OpenAI `text-embedding-3-large` or BGE-large self-hosted for privacy). Use batch embedding to manage cost.\n- **Index architecture**: hybrid index — dense vectors (HNSW in Qdrant/Weaviate) + sparse BM25 inverted index. Pre-filter by user's access control labels at query time (pre-filtering, not post, for security). Shard the index by access domain to bound search scope.\n- **Retrieval pipeline**: (1) query embedding + metadata filter → top-100 hybrid candidates; (2) cross-encoder reranker → top-5 chunks; (3) deduplication pass (remove near-duplicate chunks from the same document).\n- **Grounded generation**: strict prompt: 'Answer ONLY using the provided context. If the context doesn't contain the answer, respond: I don't have enough information.' Require the model to output citations (chunk IDs/document names) alongside each claim. Post-generation faithfulness check: verify each claim is supported by a retrieved chunk using NLI or LLM judge.\n- **Citation pipeline**: map chunk IDs back to source documents and render with deep links. This is the auditability artifact users need.\n- **Observability**: log every query, retrieved chunks, answer, faithfulness score, and latency. Alert on faithfulness rate drop and similarity score distribution drift. Sample 5% for human review.",
        explanationDeep:
          "At 10 million documents, the engineering challenges compound: embedding 10M documents costs real money (compute and storage), the ANN index needs to handle latency requirements at scale, and access control cannot be an afterthought — it must be a pre-filter enforced before similarity search, not a post-filter that might still return unauthorized documents if the filter is inefficient.\n\nThe pre-filter requirement for access control changes the index architecture. Post-filtering retrieves from the full index then applies permissions — it might accidentally score and return a document that should be excluded before checking. Pre-filtering requires that the vector database support efficient namespace or partition-based search (Qdrant collections, Weaviate tenant isolation, or metadata filter pushdown into HNSW). This is a database selection criterion, not just a feature.\n\nThe grounding requirement — cited, verifiable answers — demands a post-generation verification step. Generating citations isn't enough; you need to verify that the cited chunk actually supports the claim. An NLI classifier or a secondary LLM check can catch cases where the model cited a tangentially related chunk that doesn't actually support the specific claim. This is non-trivial at production latency — you're adding another model call per answer. Design it as an async background verification that logs faithfulness rates and alerts, rather than blocking the response.",
        interviewerLens:
          "This is a full system design question and I'm evaluating whether you can hold multiple constraints in tension: scale (10M docs) forces efficient indexing, access control forces pre-filter architecture, grounded answers force post-generation verification. Candidates who just describe a basic RAG pipeline haven't thought about how these constraints interact. The access control pre-filter design is where most junior architects make mistakes — they post-filter, which is a security problem. The citation verification step (checking that citations actually support claims) separates AI engineers who've shipped compliance requirements from those who haven't.",
        followupChain: [
          {
            question: "How would you handle document updates in a 10M-document index?",
            answer: "Incremental updates using a document change detection pipeline: detect changed/new/deleted documents via checksum or timestamp, delete the old chunks for changed documents (by document ID), re-embed and re-insert the new chunks. Queue these as background jobs. The index is eventually consistent — documents are stale for the duration of the update pipeline (typically minutes to hours depending on throughput). For critical documents with strict freshness requirements, implement a push-invalidation mechanism that marks specific document chunks as stale and forces re-retrieval from the source."
          },
          {
            question: "How do you handle the case where two retrieved chunks contain conflicting information?",
            answer: "Explicitly: add a conflict detection step in the prompt — 'if the provided documents contain conflicting information, acknowledge the conflict in your answer and cite which sources say what.' For high-stakes use cases (legal, medical), surface the conflict to the user rather than having the model silently pick one. Log these conflicts for knowledge base quality review — conflicting documents often indicate that one is outdated and needs to be updated or deprecated."
          }
        ],
        redFlags: [
          {
            junior: "\"I'd use a simple vector search with a post-filter for access control.\"",
            senior: "\"Post-filtering retrieves from the full index before applying permissions — that's a security gap and a performance problem at 10M docs. Access control must be a pre-filter enforced at the index level, before similarity scoring.\""
          }
        ],
        alternatePhrasings: [
          "\"Design a RAG system for an enterprise knowledge base.\"",
          "\"How do you scale RAG to millions of documents?\"",
          "\"How do you implement grounded, cited answers in a RAG system?\""
        ],
        interviewContexts: [
          "Senior AI engineer system design round at an enterprise software company (2025)",
          "Staff ML engineer at a Fortune 500's internal AI platform team",
          "AI infrastructure design loop at a Series D knowledge-management company"
        ]
      },
      {
        category: "deep-dives",
        riskLevel: "medium",
        asked: 16,
        questionText:
          "What is faithfulness in RAG evaluation, how do you measure it, and what do you do when faithfulness is high but answers are still wrong?",
        code: [
          {
            lang: "python",
            label: "RAGAS faithfulness",
            lines: [
              "from ragas.metrics import faithfulness",
              "from ragas import evaluate",
              "r = evaluate(ds, metrics=[faithfulness])",
              "# 1.0 = every claim backed by ctx",
              "# high score + wrong = bad source doc",
            ],
          },
        ],
        answerStructured:
          "- **Faithfulness** measures whether every factual claim in the generated answer is supported by the retrieved context. A faithful answer never introduces facts that aren't in the retrieved chunks — even if those facts happen to be correct from parametric memory.\n- **Why it matters**: a RAG system's value proposition is grounded generation — answers traceable to sources. Low faithfulness means the model is hallucinating even when given correct context, undermining the auditability that RAG provides.\n- **Measurement**: (1) **RAGAS faithfulness metric** — uses an LLM to decompose the answer into individual claims, then checks whether each claim is supported by the retrieved context. Scores 0–1. (2) **NLI classifier** — run an entailment model on (context, claim) pairs to detect contradiction or no-support. Faster and cheaper than LLM judge at scale.\n- **High faithfulness, wrong answers — what it means**: the model is faithfully following the retrieved context, but the context itself is wrong, outdated, or incomplete. This is a knowledge base problem, not a generation problem: incorrect source documents, outdated information not refreshed, or the retriever is finding plausible-but-wrong chunks.\n- **Fix for high faithfulness + wrong answers**: audit the retrieved chunks for the failing queries. Find the wrong source document and fix/remove it. Add freshness metadata and deprecate outdated versions. Add a retrieval precision check — are the retrieved chunks actually the correct sources, not just topically nearby ones?\n- **Fix for low faithfulness**: prompt engineering (stronger grounding instruction), citation enforcement, lower temperature, context pruning (remove irrelevant chunks that may confuse the model).",
        explanationDeep:
          "The faithfulness/accuracy distinction is subtle and critical. Faithfulness asks 'did the model follow the context?' Accuracy asks 'is the answer correct?' These can diverge in both directions: a model can be faithful (everything it says is in the context) but wrong (the context was wrong), and a model can be accurate (the answer happens to be correct) but unfaithful (it used parametric memory rather than the provided context).\n\nHigh faithfulness + wrong answers is the more insidious failure because it's harder to detect and fix. The model is doing exactly what you asked (follow the context), but the context was the problem. This requires going upstream — auditing the knowledge base, checking when documents were last updated, and building a document quality pipeline. In fast-moving domains (financial data, legal regulations, product documentation), knowledge base freshness is as important as retrieval quality.\n\nLow faithfulness + right answers is equally concerning from a production standpoint: the model happens to be right because its parametric knowledge agrees with the correct answer, but it's not using the provided context. This means the RAG system is providing a false sense of security — it looks like it's grounding responses, but it's actually hallucinating correctly by coincidence. In domains where the context and parametric knowledge diverge (your proprietary data isn't in the LLM's training set), this pattern will eventually produce wrong answers when parametric memory runs out.",
        interviewerLens:
          "The distinction between 'faithful but wrong because the context is wrong' vs 'unfaithful and wrong because the model hallucinated' is the diagnostic insight I'm looking for. Junior engineers see low accuracy and assume the model needs improvement. Senior engineers trace it upstream — high faithfulness + wrong answers points directly to a data quality problem, not a model problem. The fix (audit the knowledge base, add freshness controls) is completely different from the model improvement path.",
        followupChain: [
          {
            question: "How would you build an automated pipeline to detect and flag stale or incorrect knowledge base documents?",
            answer: "Multi-signal approach: (1) timestamp + freshness policy — automatically flag documents older than a domain-specific threshold (e.g., 90 days for product documentation, 1 year for stable technical references); (2) conflict detection — when two documents make contradictory claims about the same entity, flag both for human review; (3) downstream signal — when answers based on a specific document consistently fail faithfulness checks or get negative user feedback, flag that document for quality review. Build a document quality score that aggregates these signals and surfaces low-quality documents for editorial review."
          }
        ],
        redFlags: [
          {
            junior: "\"If faithfulness is high, the system is working correctly.\"",
            senior: "\"High faithfulness only means the model followed the retrieved context. If the context itself was wrong or outdated, faithfulness is high but answers are still incorrect. Faithfulness measures generation grounding, not answer accuracy — you need both.\""
          }
        ],
        alternatePhrasings: [
          "\"What is the RAGAS faithfulness metric and how is it computed?\"",
          "\"My RAG system has high faithfulness scores but users still report wrong answers. What's happening?\"",
          "\"How do you distinguish a retrieval data quality problem from a generation hallucination problem?\""
        ],
        interviewContexts: [
          "Senior AI engineer evaluation-design interview at a healthcare AI company",
          "Staff ML engineer at a fintech building a RAG system for financial data (2025)",
          "AI engineering loop at a legal document intelligence startup"
        ]
      },
      // ── decision-frameworks ───────────────────────────────────
      {
        category: "decision-frameworks",
        riskLevel: "high",
        asked: 21,
        questionText:
          "How do you decide between vector-only retrieval, hybrid retrieval, and adding a reranker? Walk me through your decision process and the signals you look at.",
        answerStructured:
          "- **Start with a baseline**: BM25 alone is your free baseline. Any dense or hybrid system should beat it on your actual query distribution. If BM25 performs surprisingly well, your queries may be keyword-heavy and the ROI on dense retrieval is lower.\n- **Dense vector-only**: choose when queries are primarily semantic/conversational and your vocabulary is natural language with frequent paraphrasing. Skip when queries contain exact identifiers (SKU codes, error strings, function names).\n- **Hybrid (BM25 + dense + RRF)**: the safe default for mixed query distributions. Cost: slightly more latency (running two pipelines), slightly more infrastructure. Benefit: covers both failure modes with no training required.\n- **Add a reranker when**: recall@k is adequate (the right chunks are in top-k) but precision@k is poor (many irrelevant chunks in the top-k dilute generation quality). The reranker reorders what you've already retrieved — it can't fix low recall.\n- **Decision signals**:\n  - Recall@k low → improve retrieval (hybrid, better embeddings, chunking, query expansion). Reranker won't help.\n  - Recall@k high, precision@k low → add reranker.\n  - Recall@k high, precision@k high, answer quality low → generation problem (prompting, faithfulness constraints).\n- **Latency budget**: if P95 latency target is < 500ms, a cross-encoder reranker on 100 candidates may be tight — profile it and consider a faster, smaller reranker model or reduce candidate count.",
        explanationDeep:
          "The decision tree is designed to match the investment to the actual bottleneck. A reranker is a precision tool — it can only reorder what was retrieved; it cannot retrieve a chunk that wasn't in the original candidate set. This seems obvious but is frequently misunderstood: I've seen engineers add rerankers as the first optimization and wonder why it barely helps recall-constrained systems.\n\nThe recall@k threshold I use as a decision trigger is roughly 0.7 at k=5. If 70% of queries have the right chunk in the top 5, adding a reranker to improve ordering quality is likely valuable. Below 0.7, invest in retrieval quality first. This is an empirical threshold — your domain and query distribution will shift it, but it's a reasonable starting point.\n\nHybrid retrieval deserves its own discussion on the ROI side. The operational cost is running two retrieval pipelines, which most modern vector databases support natively (Weaviate, Elasticsearch, Qdrant). The implementation overhead is low. The quality benefit — covering exact-term and semantic queries — is consistent across almost all real-world corpora. Unless you have strong evidence that your query distribution is purely one type, start hybrid. It's the default, not the optimization.",
        interviewerLens:
          "The signal I'm waiting for is 'recall@k tells you whether to fix retrieval; precision@k tells you whether to add a reranker.' Candidates who jump straight to 'add a reranker' without checking recall first have a toolkit problem — they apply solutions without diagnosing which component is limiting. The latency budget consideration shows production engineering maturity: knowing that a cross-encoder on 100 candidates adds 50–200ms and how to trade off against accuracy is a real engineering constraint, not a theoretical one.",
        followupChain: [
          {
            question: "When would you NOT use hybrid retrieval despite its general advantages?",
            answer: "When the query distribution is demonstrably uniform — for example, a code search system where all queries are exact function or class names, or a medical ICD code lookup where all queries are codes. In those cases, BM25 alone may achieve near-perfect recall and the added complexity of dense retrieval has negative ROI. Measure first; don't add hybrid as a reflex."
          },
          {
            question: "How do you select the reranker model to use?",
            answer: "Evaluate on your domain: benchmark Cohere Rerank, BGE-Reranker, cross-encoder/ms-marco-MiniLM variants on a sample of your query-document pairs. Measure both NDCG improvement over the bi-encoder ranking and latency. Cohere Rerank is lowest operational overhead (hosted API) but adds cost and a network hop. Self-hosted BGE-Reranker is cheaper at scale but requires inference infrastructure. Pick the smallest model that crosses your quality threshold — reranker latency scales with model size."
          }
        ],
        redFlags: [
          {
            junior: "\"I'd add a reranker to improve RAG quality.\"",
            senior: "\"A reranker improves precision within retrieved candidates but can't fix low recall — it reorders what's already there. I'd check recall@k first: if recall is low, the reranker won't help, and I need to fix retrieval upstream.\""
          }
        ],
        alternatePhrasings: [
          "\"When should I use hybrid retrieval vs pure vector search?\"",
          "\"Does adding a reranker always improve RAG quality?\"",
          "\"Walk me through the optimization order for a RAG retrieval pipeline.\""
        ],
        interviewContexts: [
          "Senior AI engineer at an enterprise search company (2025)",
          "Staff ML engineer at a Series D platform company",
          "RAG architecture review at a large financial services firm"
        ]
      },
      {
        category: "decision-frameworks",
        riskLevel: "medium",
        asked: 14,
        questionText:
          "How do you scale a RAG system from prototype to production — what changes and what breaks?",
        answerStructured:
          "- **Embedding latency**: prototype calls the embedding API per query synchronously; production needs a caching layer for common queries (exact-match cache by query string) and async batch embedding for ingestion. At 10k QPS, embedding adds up.\n- **Index size and ANN performance**: HNSW indices grow in memory. Profile index memory usage early — 100M 1536-dim vectors need ~600GB RAM. Consider quantization (int8 reduces memory ~4x with <5% quality loss), dimensionality reduction, or sharding by domain.\n- **Knowledge base freshness**: prototype re-indexes everything on change; production needs incremental update pipelines — detect changed documents, delete old chunk embeddings, insert new ones. Nightly full re-index is viable at 100K docs, not at 10M.\n- **Access control and multi-tenancy**: prototype has one knowledge base; production has per-team or per-user document scopes that must be enforced at the index level.\n- **Evaluation and monitoring**: prototype uses ad-hoc testing; production needs automated recall@k evaluation in CI, production faithfulness monitoring, and query log analysis for drift detection.\n- **Cost governance**: prototype uses hosted APIs freely; production requires cost controls — embedding caching, smaller models for reranking, prompt compression, batching generation calls.\n- **Latency SLAs**: prototype ignores P99; production must profile and optimize the full pipeline (embed + retrieve + rerank + generate) for P95 latency targets.",
        explanationDeep:
          "The gap between prototype and production RAG is wider than most teams expect. The prototype validates the capability; production requires engineering all the operational concerns that weren't visible at prototype scale.\n\nThe index memory problem is the one that surprises teams most. During prototyping, Pinecone or Qdrant cloud handles everything. In production, especially if you're self-hosting for cost or privacy reasons, a 10M-document index with 1536-dim vectors (OpenAI) occupies 10M × 1536 × 4 bytes ≈ 60GB for the vectors alone, plus HNSW graph overhead (typically 2–4x the raw vector size). On commodity cloud hardware, that's a significant memory bill. Quantization (8-bit or 4-bit) reduces this dramatically with acceptable quality degradation — but you need to profile the quality impact on your specific corpus, not just assume the benchmarks apply.\n\nEvaluation is the other production gap. Prototypes are validated by trying it out; production systems need automated regression detection tied to the deployment pipeline. Every change to the embedding model, chunking strategy, or knowledge base should automatically compute recall@k against a labeled test set and block deployment on regression. This is the CI/CD equivalent for AI systems and is the cultural practice that separates mature AI engineering teams from ones that perpetually rediscover regressions in production.",
        interviewerLens:
          "I'm looking for a systems-level answer that identifies the prototype-to-production gap across multiple dimensions: performance (index memory, embedding latency), operations (freshness pipelines, multi-tenancy), and quality (automated evaluation). Candidates who only mention 'scaling the API' have never operated a production RAG system. The index memory calculation shows you've actually run the numbers, not just waved at 'vector database scalability.'",
        followupChain: [
          {
            question: "How do you reduce embedding costs in production?",
            answer: "Multiple levers: (1) exact-match query cache — identical queries (common in enterprise use) hit cache, no embedding call needed; (2) smaller embedding models — validate quality on your domain first, but models like text-embedding-3-small are 5x cheaper than text-embedding-3-large with similar quality for most corpora; (3) batch ingestion — embed documents in large batches during off-peak hours rather than per-document real-time; (4) caching at ingestion — never re-embed unchanged documents, detect changes by content hash."
          }
        ],
        redFlags: [
          {
            junior: "\"I'd just scale up the vector database.\"",
            senior: "\"Scaling the database is necessary but not sufficient — the production gaps are in knowledge base freshness pipelines, embedding cost and latency at scale, access control enforcement, and automated evaluation. I address each of these explicitly.\""
          }
        ],
        alternatePhrasings: [
          "\"What breaks when you take a RAG prototype to production?\"",
          "\"How do you handle RAG at scale?\"",
          "\"What is different about operating a production RAG system vs a prototype?\""
        ],
        interviewContexts: [
          "Senior AI engineer platform interview at a Series D company (2025)",
          "Staff ML engineer at a large enterprise with an AI platform team",
          "AI infrastructure design round at a consulting firm building RAG for enterprise clients"
        ]
      },
      // ── tool-comparison ───────────────────────────────────────
      {
        category: "tool-comparison",
        riskLevel: "high",
        isComparison: true,
        comparisonTools: ["Vector-only Retrieval", "Hybrid Retrieval (BM25 + Vector)"],
        asked: 18,
        questionText:
          "Systematically compare vector-only retrieval vs hybrid retrieval (BM25 + vector) — when does hybrid actually move the needle and when is it not worth the complexity?",
        answerStructured:
          "- **Vector-only wins when**: queries are purely semantic/conversational (natural language questions, no exact identifiers), the vocabulary in documents and queries is aligned, and the embedding model was trained on similar domain text. Enterprise knowledge base with well-written prose is a strong vector-only candidate.\n- **Hybrid wins when**: query distribution is mixed — some users ask conceptual questions, others search by exact product name, error code, or technical identifier. Nearly all real-world corpora have this mix. Also wins on multilingual corpora where BM25's language-agnosticism complements dense models trained primarily on English.\n- **Empirical signal to check**: run BM25 alone on your test set. If BM25 recall@5 > 0.6, your corpus has strong keyword signal and hybrid will likely outperform dense alone. If BM25 recall@5 < 0.3, your queries are highly paraphrastic and hybrid adds marginal benefit over dense.\n- **Complexity cost**: hybrid requires maintaining two indices (inverted + ANN), running two retrieval paths per query, and fusing results. Modern vector databases (Weaviate, Qdrant, Elasticsearch) handle this natively — the implementation complexity is low compared to building it yourself. Operational overhead is modest.\n- **When NOT to use hybrid**: code retrieval (BM25 alone often wins because code is token-precise), medical ICD/CPT code lookup (exact matches dominate), or scenarios where maintaining two indices is genuinely costly and the domain is demonstrably one type.",
        explanationDeep:
          "The academic literature (BEIR benchmark, 2021 onward) consistently shows hybrid retrieval outperforming either sparse or dense alone across heterogeneous corpora. The reason is coverage: different retrieval systems have different failure modes, and their errors are only partially correlated. When a dense retriever fails (exact-term precision), BM25 succeeds; when BM25 fails (semantic paraphrase), dense succeeds. RRF fusion rewards documents that appear in both systems' top results, effectively finding the safe consensus across both retrieval paradigms.\n\nThe operationalization question is often the practical barrier. Teams at prototype scale run dense retrieval on Pinecone and have no BM25 infrastructure. In production, most mature vector databases now support hybrid search natively — Weaviate, Qdrant with sparse vectors, Elasticsearch with dense vectors. The migration is more about operational decision-making than raw engineering work. If you're choosing a vector database for a new project, hybrid support should be a first-class selection criterion.\n\nThe empirical check I recommend — running BM25 alone and looking at recall@5 — is underused. It's a free diagnostic that tells you whether BM25 signal is worth adding. Teams that skip this test add hybrid retrieval 'just in case' without knowing whether it actually moves their specific metrics.",
        interviewerLens:
          "The empirical signal check (run BM25 alone, look at recall@5) is the senior move that distinguishes engineers who've measured their systems from those who've read about hybrid retrieval. The 'when NOT to use hybrid' discussion shows you don't apply solutions reflexively — you know that code search is a domain where BM25 often dominates and dense retrieval adds complexity for little gain. Naming BEIR as the benchmark family that establishes hybrid's advantage shows literature awareness.",
        followupChain: [
          {
            question: "How does sparse vector retrieval (SPLADE, BM25++) compare to traditional BM25 and dense retrieval?",
            answer: "SPLADE learns sparse representations that include implicit term expansion — if a document contains 'automobile', SPLADE's representation may also activate 'car' and 'vehicle' tokens, giving it semantic expansion while remaining sparse (and therefore indexable by an inverted index). BM25 can only match exact or stemmed terms; SPLADE partially closes the vocabulary gap. Dense retrieval still outperforms SPLADE on extreme paraphrase, but SPLADE beats BM25 significantly on recall for in-domain corpora. It requires training, unlike BM25, and runs on standard inverted-index infrastructure."
          }
        ],
        redFlags: [
          {
            junior: "\"I'd always use hybrid retrieval since it's always better.\"",
            senior: "\"Hybrid is generally better on mixed corpora, but it adds infrastructure complexity and isn't always necessary. I'd run BM25 alone as a baseline first — if it already achieves high recall@5, the ROI on hybrid may not justify the added complexity for that specific corpus.\""
          }
        ],
        alternatePhrasings: [
          "\"Does hybrid search always beat vector-only retrieval?\"",
          "\"When would you add BM25 to a vector search system?\"",
          "\"Compare dense retrieval and hybrid retrieval with real trade-offs.\""
        ],
        interviewContexts: [
          "Senior AI engineer at a search infrastructure company (2025)",
          "Staff ML engineer designing a RAG architecture at a legal AI company",
          "RAG system design round at an enterprise content management platform"
        ]
      }
    ],
    topics: {
      moreDeepDives: [
        "What is GraphRAG and when does graph-based retrieval outperform vector retrieval?",
        "How do you implement iterative / multi-step retrieval (Agentic RAG) for complex queries?",
        "Explain RAFT (Retrieval-Augmented Fine-Tuning) and when it is used.",
        "How do you handle knowledge base conflicts — multiple documents with contradictory information?",
        "What is Corrective RAG (CRAG) and how does it address low-confidence retrievals?"
      ],
      decisions: [
        "When do you implement query rewriting / HyDE vs simply improving chunking?",
        "Self-hosted vector DB (Qdrant/Weaviate) vs managed service (Pinecone) — when does self-hosting pay?",
        "Synchronous reranking vs async post-generation faithfulness check — latency vs quality trade-off?"
      ],
      quickRef: [
        "What is faithfulness and how does RAGAS measure it?",
        "What is the gold-context injection test?",
        "What does recall@k measure vs precision@k?",
        "HNSW: what does it stand for and what does it optimize?",
        "What is quantization in the context of vector indices?",
        "What is the 'lost in the middle' problem?",
        "What is RRF and why is it preferred for score fusion?",
        "What is BEIR and what does it measure?",
        "What is a cross-encoder and why can it not be pre-computed?",
        "What is RAGAS and what four metrics does it provide?"
      ],
      redFlags: [
        {
          junior: "\"I'd upgrade the LLM if answers are wrong.\"",
          senior: "\"First I check if the correct chunk was retrieved — LLM upgrades don't fix retrieval failures. I bisect: inspect retrieved chunks, run gold-context injection, measure recall@k, then target the right layer.\""
        },
        {
          junior: "\"High faithfulness means the system is working.\"",
          senior: "\"Faithfulness only measures grounding — a system can be faithful but wrong if the retrieved context is itself incorrect. I need both faithfulness (generation grounding) AND accuracy (correct knowledge base) to be high.\""
        },
        {
          junior: "\"Long context windows make RAG obsolete.\"",
          senior: "\"Long context doesn't solve cost at scale, the 'lost in the middle' recall problem, or knowledge base update latency. RAG and long context are complementary tools for different workloads.\""
        },
        {
          junior: "\"I'd add a reranker to fix low accuracy.\"",
          senior: "\"Rerankers fix precision, not recall — they reorder candidates already retrieved. If recall@k is low, no reranker helps. I measure recall first to know which layer is the bottleneck.\""
        }
      ],
      checklist: [
        "Be able to describe the full bisect-at-retrieval-boundary debugging methodology",
        "Know the full evaluation stack: recall@k, precision@k, faithfulness, answer relevancy — and which layer each measures",
        "Understand the production scaling challenges: index memory, embedding cost, incremental updates, multi-tenancy",
        "Know when hybrid retrieval wins vs vector-only and how to empirically check (BM25 baseline recall@5)",
        "Be able to design a RAG evaluation CI gate: labeled test set, automated metrics, deployment gating"
      ],
      behavioral: [
        "Tell me about the most challenging RAG debugging problem you've faced — how did you isolate the root cause?",
        "Describe a time you improved RAG quality by investing in evaluation infrastructure rather than the model itself.",
        "How did you convince stakeholders to invest in evaluation harness infrastructure for an AI system?"
      ],
      reverse: [
        "How is RAG quality monitored in production today — automated metrics or primarily user feedback?",
        "Have you hit the 'faithfulness vs accuracy' distinction in production? How was it diagnosed?",
        "What's the current bottleneck in the RAG system — retrieval quality, generation grounding, or knowledge base freshness?"
      ]
    }
  }
};
