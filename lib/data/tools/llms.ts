import type { Authored, ToolTopics } from "../content-de";
import type { Level } from "../../types";

export const levels: Partial<Record<Level, { authored: Authored[]; topics: ToolTopics }>> = {
  junior: {
    authored: [
      {
        category: "deep-dives",
        riskLevel: "medium",
        freePreview: true,
        asked: 28,
        questionText:
          "What is a token, and why does token count matter in practice?",
        code: [
          {
            lang: "python",
            label: "tiktoken count",
            lines: [
              "import tiktoken",
              "enc = tiktoken.get_encoding('o200k_base')",
              "len(enc.encode('hello world'))   # 2",
              "len(enc.encode('{\"k\": 1.0e-9}')) # 11",
              "# code/JSON packs fewer words/token",
            ],
          },
        ],
        answerStructured:
          "- A **token** is the atomic unit an LLM processes — roughly 3–4 characters of English, but shorter for common words and longer for rare ones. 'ChatGPT' is 1 token; 'supercalifragilistic' is several.\n- Token count drives **cost** (most APIs charge per input + output token), **latency** (more tokens = longer generation), and **context limits** (you can't exceed the model's context window).\n- **Tokenization is not word-splitting**: punctuation, whitespace, and rare/non-English text tokenize differently and often less efficiently.\n- In practice: trim unnecessary context, use short system prompts where possible, and be aware that code and JSON tokenize more tokens than equivalent prose.\n- Tools like the **OpenAI tokenizer playground** let you count tokens before hitting the API.",
        explanationDeep:
          "The key junior misconception is equating tokens with words — one word can be one or several tokens depending on the model's vocabulary (BPE). This matters because a 100k-token context window doesn't mean 100k words; at ~0.75 words per token you're looking at 75k words. Misunderstanding this leads to context overflows that are confusing to debug.\n\nCost and latency follow directly from token counts. If a system prompt is 2,000 tokens and you make 10,000 calls a day, that's 20M input tokens — easily the dominant cost line. This is why prompt caching and prompt compression exist; they both reduce the effective token spend. Understanding tokens is the foundation for every cost and latency optimization you'll ever make on an LLM product.\n\nFinally, tokenization is model-specific. GPT-4o uses tiktoken; Claude uses a different vocabulary. Token counts for the same string can differ slightly between providers, which matters when porting prompts or estimating cross-provider costs.",
        interviewerLens:
          "I'm checking baseline LLM literacy. If you can't explain what a token is and why it matters for cost and context limits, you're going to make expensive or broken decisions in prod. The trap is candidates who say 'a token is a word' — that tells me they've used ChatGPT but haven't read any API docs.",
        followupChain: [
          {
            question: "How do you count tokens before sending an API request?",
            answer:
              "Use the provider's tokenizer library — tiktoken for OpenAI, or the Anthropic token-count endpoint. Both let you count tokens locally or via API before you send, so you can guard against context overflow and estimate cost.",
          },
          {
            question: "What happens if you exceed the context window?",
            answer:
              "The API returns an error (or silently truncates, depending on provider and config). You handle it by chunking the input, summarizing earlier conversation, or using a model with a larger window — not by just hoping it works.",
          },
        ],
        redFlags: [
          {
            junior: "\"A token is basically a word.\"",
            senior:
              "\"A token is a subword unit; 1 token ≈ 0.75 words for English prose, less for code or rare words.\"",
          },
          {
            junior: "\"Token count doesn't really matter, models are fast.\"",
            senior:
              "\"Token count drives cost, latency, and whether you fit in the context window — it's the primary cost lever.\"",
          },
        ],
        alternatePhrasings: [
          "\"How does tokenization work and why should I care?\"",
          "\"Why is my API bill so high?\"",
          "\"What is the context window?\"",
        ],
        interviewContexts: [
          "Opening question at an AI startup junior screen",
          "Asked in 3 separate junior/entry-level LLM engineer screens",
        ],
      },
      {
        category: "deep-dives",
        riskLevel: "medium",
        asked: 22,
        questionText:
          "What is temperature, and how do you set it for different tasks?",
        code: [
          {
            lang: "python",
            lines: [
              "# factual: deterministic",
              "client.responses.create(",
              "  model='gpt-4o', input=msgs,",
              "  temperature=0)",
              "# creative: add variety",
              "# temperature=0.9, top_p=0.95",
            ],
          },
        ],
        answerStructured:
          "- **Temperature** scales the logit distribution before sampling: low values (near 0) make the model deterministic and pick the highest-probability token; high values (near 1–2) flatten the distribution and increase randomness.\n- **Temperature 0** (or near 0): classification, extraction, data structuring, factual Q&A — you want the same correct answer every time.\n- **Temperature 0.7–1.0**: creative writing, brainstorming, varied suggestions — you want diversity across runs.\n- **top-p (nucleus sampling)** works differently: it limits the candidate set to the smallest group of tokens whose cumulative probability exceeds p, ignoring the long tail. A common production default is `temperature=0.7` + `top_p=0.95`.\n- Don't combine both extremes: very low temperature + very low top-p collapses all variety; very high both produces incoherence.",
        explanationDeep:
          "Temperature and top-p are often confused because they both control randomness, but they operate at different points. Temperature re-scales the raw logit vector before softmax — think of it as turning the confidence dial. Top-p then truncates the resulting distribution to the most probable tokens summing to p. Setting both gives you compound control: temperature shapes confidence, top-p clips the tail.\n\nThe practical takeaway: use temperature 0 (or the API equivalent, sometimes called greedy decoding) any time your task has a correct answer and you need reproducibility in evals. Use 0.5–0.8 for tasks where some creativity is good but not chaos. Use top-p as a safety guardrail to prevent the model from sampling very-low-probability garbage even at high temperatures.\n\nOne important nuance: many providers expose temperature but not top-p, or vice versa, or they have other sampling params like top-k. Know what your provider exposes and default to temperature as your primary dial.",
        interviewerLens:
          "I want to hear you name a low-temperature use case and a high-temperature use case without prompting. The advanced signal is explaining that top-p and temperature are complementary, not interchangeable. Candidates who say 'just set it to 0.7 for everything' reveal they haven't thought through reproducibility for factual tasks.",
        followupChain: [
          {
            question: "What's the downside of temperature 0 for creative tasks?",
            answer:
              "The model will give the exact same output every run, which is great for evals but bad for variety. If you're generating marketing copy or brainstorming ideas you want 10 different options — temperature 0 gives you the same one repeated.",
          },
          {
            question: "How do you test the effect of temperature changes?",
            answer:
              "Run the same prompt N times at each temperature setting and compare outputs — variance in output, factual accuracy, and format. Track this in an eval harness so temperature decisions are data-driven, not vibes.",
          },
        ],
        redFlags: [
          {
            junior: "\"I just leave it at whatever the default is.\"",
            senior:
              "\"I set temperature by task type: 0 for factual/structured output, 0.7+ for creative generation.\"",
          },
          {
            junior: "\"Temperature and top-p are the same thing.\"",
            senior:
              "\"Temperature rescales logits; top-p clips the candidate set by cumulative probability — they compound.\"",
          },
        ],
        alternatePhrasings: [
          "\"What does temperature control in an LLM?\"",
          "\"When would you use a high vs low temperature?\"",
        ],
        interviewContexts: [
          "Junior LLM engineer phone screen at a SaaS startup",
          "Asked in onsite fundamentals round at an AI product company",
        ],
      },
      {
        category: "deep-dives",
        riskLevel: "low",
        asked: 18,
        questionText:
          "What is an embedding, and what can you use it for in an LLM application?",
        code: [
          {
            lang: "python",
            lines: [
              "r = client.embeddings.create(",
              "  model='text-embedding-3-small',",
              "  input=['cat', 'dog'])",
              "v = r.data[0].embedding  # list[float]",
              "# separate model -> vectors, not text",
            ],
          },
        ],
        answerStructured:
          "- An **embedding** is a dense, fixed-size vector of floating-point numbers that represents the *meaning* of a text — similar texts have vectors that are close together in the embedding space.\n- Produced by running text through an **embedding model** (e.g. OpenAI `text-embedding-3-small`, Cohere, or open-source models like `bge-m3`).\n- Key uses: **semantic search** (find documents similar in meaning, not just keyword), **retrieval-augmented generation** (RAG) as the retrieval step, **clustering and classification**, and **deduplication**.\n- Similarity is usually measured with **cosine similarity** (direction, scale-invariant) or dot product.\n- Embedding models ≠ generation models: they output vectors, not text. They're typically smaller, cheaper, and faster.",
        explanationDeep:
          "The intuition behind embeddings is that the model learns to compress semantic meaning into coordinates in a high-dimensional space. The word 'dog' and 'puppy' end up nearby; 'dog' and 'airplane' end up far apart. This geometric structure is what makes semantic search possible — you embed the query, embed all documents, and find the nearest neighbors.\n\nIn a RAG system, the embedding model is the retrieval backbone. Its quality determines what chunks get surfaced to the LLM. Swap a weak embedding model for a better one and you often get a bigger accuracy jump than swapping the generation model. This is often counterintuitive for engineers who focus all their tuning on the generation side.\n\nOne common confusion: embedding models and LLMs both process text, but embedding models don't generate text — they output a vector. They have separate model cards, separate pricing, and separate benchmarks (MTEB leaderboard is the standard for embeddings). Never use a generation model's hidden states as embeddings in production — use a model trained for retrieval.",
        interviewerLens:
          "I want the candidate to connect embeddings to a concrete use case (semantic search, RAG retrieval) immediately — not just recite the definition. The junior tell I'm worried about is thinking the LLM itself produces embeddings for retrieval — it doesn't; that's a separate embedding model call.",
        followupChain: [
          {
            question: "Why cosine similarity instead of Euclidean distance?",
            answer:
              "Cosine similarity measures the angle between vectors, ignoring magnitude, which is what you want for semantic meaning. A long document and a short document about the same topic can have different magnitude vectors but similar directions — cosine captures that; Euclidean doesn't.",
          },
          {
            question: "How do you pick an embedding model?",
            answer:
              "Check the MTEB leaderboard for your task type (retrieval, classification, etc.), consider dimension size (higher = more expressive but more memory/latency), and match the model to your domain if available. Smaller models like text-embedding-3-small are often sufficient and much cheaper.",
          },
        ],
        redFlags: [
          {
            junior: "\"An embedding is what the LLM outputs.\"",
            senior:
              "\"An embedding is a vector from a separate embedding model; the LLM generates text — different models, different calls.\"",
          },
          {
            junior: "\"I'd use the LLM to do semantic search directly.\"",
            senior:
              "\"I'd embed documents offline with an embedding model, store vectors, and do ANN search at query time.\"",
          },
        ],
        alternatePhrasings: [
          "\"How does semantic search work?\"",
          "\"What's the difference between an embedding model and a language model?\"",
        ],
        interviewContexts: [
          "Junior take-home followed by a technical deep-dive at a search startup",
          "Asked early in a junior AI engineer screen at a Series B",
        ],
      },
      {
        category: "decision-frameworks",
        riskLevel: "medium",
        asked: 15,
        questionText:
          "What is a system prompt, and how do you use it well?",
        answerStructured:
          "- The **system prompt** is a privileged instruction block sent before the user turn that sets the model's role, persona, constraints, and output format for the entire conversation.\n- Use it for: **role / persona** ('You are a customer support agent for Acme Corp'), **output format** (always respond in JSON), **constraints** (never discuss competitors), and **context** (here is relevant policy text).\n- Keep it **focused and explicit** — vague system prompts produce vague behavior. Be specific about what the model should and should not do.\n- **Order matters**: put the most important constraint first. Models attend more reliably to early instructions in long prompts.\n- It is **not a security boundary**: users can ask the model to ignore system instructions — a system prompt is guidance, not an access control layer.",
        explanationDeep:
          "The system prompt is the most powerful single lever in prompting. It sets the frame for every response in the session. The mistake juniors make is under-using it — writing 'You are a helpful assistant' and putting all real instructions in the user turn. That forces the model to reinterpret context on every message and makes the behavior fragile.\n\nA well-crafted system prompt is a specification: here is the role, here is the output format, here are the allowed topics, here are the constraints. Think of it as the config file for the model's behavior in your app. For production LLM features, the system prompt is the thing you version-control, test in evals, and review carefully before deploy.\n\nThe security caveat is important for junior engineers building user-facing apps: a system prompt saying 'never reveal your instructions' does not guarantee the model won't reveal them. Models can be prompted to ignore system instructions via jailbreaks or carefully crafted user messages. System prompt is product guardrails, not authentication.",
        interviewerLens:
          "I want to see the candidate treat the system prompt as a formal spec they write carefully and version-control, not a throw-in sentence before the conversation. The critical junior trap is thinking the system prompt is a security mechanism — it's behavioral guidance, not access control.",
        followupChain: [
          {
            question: "How do you handle a system prompt that's getting very long?",
            answer:
              "First, trim redundant instructions. Then use prompt caching — with Anthropic, mark the static system prompt block with cache_control so it's cached after the first call. For dynamic context, move it out of the system prompt and into a retrieval step (RAG). A bloated system prompt hurts latency and cost.",
          },
          {
            question: "What's the difference between a system prompt and a user prompt?",
            answer:
              "System prompt is author-controlled — it sets the frame for the whole session and the user usually never sees it. User prompt is what the end user sends per turn. The model weights them differently; system instructions generally override conflicting user instructions, but not reliably for adversarial prompts.",
          },
        ],
        redFlags: [
          {
            junior: "\"System prompt is like extra instructions before the user message.\"",
            senior:
              "\"System prompt is the spec for the model's behavior — role, format, constraints, versioned and tested like code.\"",
          },
          {
            junior: "\"The system prompt protects my instructions from the user.\"",
            senior:
              "\"It's behavioral guidance, not an access control boundary — a determined user can prompt the model to reveal or ignore it.\"",
          },
        ],
        alternatePhrasings: [
          "\"How do you structure your prompts for a production LLM feature?\"",
          "\"What goes in the system prompt vs the user prompt?\"",
        ],
        interviewContexts: [
          "Junior onsite at an LLM product startup",
          "Asked in 2 separate junior AI engineer screens",
        ],
      },
      {
        category: "tool-comparison",
        riskLevel: "low",
        isComparison: true,
        comparisonTools: ["Streaming", "Batch"],
        asked: 11,
        questionText:
          "When would you use streaming responses vs waiting for the full response from an LLM?",
        code: [
          {
            lang: "python",
            lines: [
              "stream = client.responses.create(",
              "  model='gpt-4o', input=msgs,",
              "  stream=True)",
              "for e in stream:",
              "  if e.type=='response.output_text.delta':",
              "    print(e.delta, end='')",
            ],
          },
        ],
        answerStructured:
          "- **Streaming**: the model sends tokens as they're generated — users see text appearing in real time. Use for **chat UIs, long-form generation, and anything where time-to-first-token matters** for UX.\n- **Batch (non-streaming)**: wait for the full response before processing. Use for **backend pipelines**, classification, extraction, or anything where you need the complete output before acting.\n- Streaming improves **perceived latency** without changing total generation time — the LLM takes the same compute; you're just surfacing partial output earlier.\n- Batch is simpler to implement and easier to handle retries and errors — you have the full response before acting.\n- For **async batch workloads** (many requests, no UX), provider batch APIs (OpenAI Batch, Anthropic Message Batches) offer 50% cost discounts at the expense of up to 24h turnaround.",
        explanationDeep:
          "Streaming is a UX technique, not a performance optimization. The model generates the same number of tokens at the same speed either way — streaming just lets the client start rendering before the full response is ready. For a chat interface generating a 500-token response at 50 tokens/sec, streaming shows the first token in ~20ms; without streaming the user waits 10 seconds staring at a spinner. The perceived latency difference is dramatic even though the total compute is identical.\n\nBatch processing is the right model for pipeline work: classification at scale, extraction over a document corpus, or anything running as a nightly job. Here you don't need UX responsiveness, and you often want the complete structured output before writing to a database. Retrying a failed non-streamed call is also simpler — you just retry the request.\n\nThe cost angle: both OpenAI and Anthropic offer async batch APIs (not SSE streaming) that queue requests and process them with spare capacity. OpenAI Batch API delivers results within 24h at 50% off; Anthropic Message Batches work similarly. This is the play for large-scale, latency-tolerant workloads like bulk document processing.",
        interviewerLens:
          "I'm checking that the candidate understands streaming is a UX pattern, not a speed improvement. If they say 'streaming is faster,' that's a misconception. The advanced signal is mentioning async batch APIs for cost-sensitive, non-real-time pipelines.",
        followupChain: [
          {
            question: "How do you handle errors mid-stream?",
            answer:
              "You need to handle partial output — buffer tokens, detect error events in the SSE stream, and decide whether to show partial content or clear it. Batch is easier: you just check the full response status. Streaming error handling is genuinely more complex.",
          },
          {
            question: "When would async batch APIs save the most money?",
            answer:
              "High-volume classification, bulk extraction, or nightly enrichment jobs where the result doesn't need to be real-time. You submit thousands of requests, pay 50% less per token, and get results back within 24h. The savings are real at scale.",
          },
        ],
        redFlags: [
          {
            junior: "\"Streaming is faster than waiting for the full response.\"",
            senior:
              "\"Streaming doesn't change generation speed — it improves perceived latency for the user by showing tokens as they arrive.\"",
          },
        ],
        alternatePhrasings: [
          "\"Should we stream or wait for the full response?\"",
          "\"How do you improve LLM response time in a chat UI?\"",
        ],
        interviewContexts: [
          "Junior screen at an AI chat product startup",
          "First question in a junior AI engineer take-home debrief",
        ],
      },
    ],
    topics: {
      moreDeepDives: [
        "What is few-shot prompting and when does adding examples help?",
        "How does the model 'know' things — what is a training cutoff?",
        "What is a context window and how do you work within it?",
        "What is hallucination and what causes it?",
        "How do you read a model card and pick between providers?",
      ],
      decisions: [
        "GPT-4o vs Claude vs Gemini — how do you choose for a new project?",
        "When is a small/fast model good enough vs a large frontier model?",
        "Prompt in the system turn vs user turn — where does context go?",
      ],
      quickRef: [
        "What is a token? (~0.75 words for English prose)",
        "Context window: max tokens model can process at once",
        "Temperature 0 = deterministic; 1+ = creative/random",
        "Top-p: clips candidate tokens by cumulative probability",
        "System prompt: author-controlled instruction block",
        "Embedding: dense vector representing text meaning",
        "Cosine similarity: angle-based similarity for embeddings",
        "Streaming: tokens sent as generated for better UX",
        "Few-shot: examples in the prompt to guide output format",
        "Hallucination: confident but factually incorrect output",
      ],
      redFlags: [
        {
          junior: "\"A token is a word.\"",
          senior:
            "\"A token is a subword unit — 1 token ≈ 0.75 words for English, less for code.\"",
        },
        {
          junior: "\"Streaming makes the model faster.\"",
          senior:
            "\"Streaming improves perceived latency; total generation time is unchanged.\"",
        },
        {
          junior: "\"The system prompt keeps my instructions secret.\"",
          senior:
            "\"It's behavioral guidance, not a security boundary.\"",
        },
        {
          junior: "\"Embedding is what the LLM outputs.\"",
          senior:
            "\"Embeddings come from a separate embedding model; LLMs generate text.\"",
        },
        {
          junior: "\"Just set temperature to 0.7 for everything.\"",
          senior:
            "\"Temperature 0 for factual/structured tasks; higher for creative generation.\"",
        },
        {
          junior: "\"Just make the context window bigger to fix context issues.\"",
          senior:
            "\"Bigger context = higher cost and latency; I trim, chunk, or use RAG first.\"",
        },
      ],
      checklist: [
        "Explain token/context window relationship and cost implications",
        "Temperature vs top-p: when and why to adjust each",
        "System prompt as a versioned spec, not a magic incantation",
        "Embedding model vs generation model: distinct calls, distinct purpose",
        "Streaming for UX vs batch for pipeline workloads",
      ],
      behavioral: [
        "Tell me about the first LLM feature you shipped",
        "A time a prompt stopped working and how you debugged it",
        "How you explained a model failure to a non-technical stakeholder",
      ],
      reverse: [
        "Which LLM providers are in prod and why those?",
        "How is LLM cost tracked and budgeted today?",
        "What does the onboarding to the LLM infra look like?",
      ],
    },
  },

  mid: {
    authored: [
      {
        category: "deep-dives",
        riskLevel: "high",
        freePreview: true,
        asked: 31,
        questionText:
          "How do you get reliable structured output (e.g. JSON) from an LLM in production?",
        code: [
          {
            lang: "python",
            lines: [
              "from pydantic import BaseModel",
              "class Item(BaseModel):",
              "    name: str; qty: int",
              "r = client.responses.parse(",
              "  model='gpt-4o', input=msgs,",
              "  text_format=Item)",
              "obj = r.output_parsed  # typed, valid",
            ],
          },
        ],
        answerStructured:
          "- Use the provider's **structured-output / tool-calling** mode with a strict schema rather than 'please return JSON' in the prompt — it constrains decoding to valid shapes.\n- Define the schema explicitly (JSON Schema / typed tool) and **validate on the way out**; reject + retry on parse failure with the error fed back to the model.\n- Keep the schema **flat and typed**; deeply nested or ambiguous schemas raise failure rates.\n- Add **idempotency + bounded retries** and a fallback path so a single bad generation doesn't break the pipeline.\n- **Eval the structured path**: track parse-failure rate and field-level accuracy as real SLOs, not just eyeball tests.",
        explanationDeep:
          "The naive approach — asking for JSON in the prompt and calling JSON.parse — fails a few percent of the time at scale: trailing prose, markdown fences, hallucinated fields. In production you want the model constrained to a schema via native structured output or tool calling, where the decoder literally cannot emit invalid structure. OpenAI's response_format with strict: true and Anthropic's tool-calling both provide this guarantee at the sampling level.\n\nThen you still validate the result against your own schema and retry on failure, feeding the validation error back so the model self-corrects on the next attempt. This retry loop with error feedback is often called 'self-repair' and dramatically reduces failure rates. Flat schemas with clear types, enums, and descriptions beat clever nested hierarchies — the model has to fill every field and ambiguity compounds.\n\nMeasure it: parse-failure rate and per-field accuracy are real SLOs once an LLM is in a data pipeline. If your structured extraction has a 2% parse failure rate across 50k/day calls, that's 1,000 failed records a day hitting your fallback path — you want to know and alert on that.",
        interviewerLens:
          "I'm listening for 'use the structured-output/tool API + validate + retry,' not 'prompt it to return JSON.' The senior tell is that they still validate and measure parse-failure rate — they treat the model as unreliable infrastructure and engineer around it. Candidates who say 'the model knows the format' reveal they haven't run this in high-volume production.",
        followupChain: [
          {
            question: "Why not just regex/repair the output?",
            answer:
              "Repair is a brittle band-aid that hides real failures and silently corrupts data. Constrain generation up front and validate; repair only as a last-resort fallback you alert on, not the happy path.",
          },
          {
            question: "How does prompt caching interact with structured output?",
            answer:
              "Cache the static system prompt and schema definition prefix. On Anthropic, mark those blocks with cache_control so they're cached at 0.1x the input token cost. The dynamic user input comes after the cache breakpoint, so you still pay full price for it — but the schema preamble is nearly free on repeat calls.",
          },
          {
            question: "What do you do when the schema changes in production?",
            answer:
              "Version the schema alongside the prompt in git. Deploy schema changes with a prompt version bump and run your structured-output eval suite against the new version before cutover. Treat schema changes as breaking changes — downstream consumers depend on the field names.",
          },
        ],
        redFlags: [
          {
            junior: "\"I ask it to return JSON and parse it.\"",
            senior:
              "\"I use structured-output/tool calling with a schema, then validate and retry on failure.\"",
          },
          {
            junior: "\"The model just knows the format.\"",
            senior:
              "\"I constrain decoding and measure parse-failure rate as an SLO.\"",
          },
        ],
        alternatePhrasings: [
          "\"How do you make an LLM return data your code can trust?\"",
          "\"How do you handle JSON parsing failures from a model?\"",
          "\"Describe your production structured-output pipeline.\"",
        ],
        interviewContexts: [
          "Asked at an AI-platform startup, Senior AI Engineer loop",
          "Came up in 2 mid-level LLM-infra interviews in 2025",
        ],
      },
      {
        category: "deep-dives",
        riskLevel: "high",
        asked: 26,
        questionText:
          "Explain prompt caching: how it works, when it pays off, and how you structure prompts to maximize cache hits.",
        code: [
          {
            lang: "python",
            lines: [
              "client.messages.create(",
              "  model='claude-sonnet-4-5',",
              "  system=[{'type': 'text',",
              "    'text': BIG_STATIC_PROMPT,",
              "    'cache_control':",
              "      {'type': 'ephemeral'}}],",
              "  messages=msgs)  # variable last",
            ],
          },
        ],
        answerStructured:
          "- **Prompt caching** lets providers reuse the KV cache from a prior identical prompt prefix, skipping recomputation for the cached tokens.\n- **Anthropic**: explicit `cache_control` markers on content blocks; cache reads cost 0.1× base input tokens (90% off); writes cost 1.25× (25% premium, amortized over hits); default 5-minute TTL, optional 1-hour TTL.\n- **OpenAI**: automatic — no code changes; 50–90% input token discount on cached prefixes ≥ 1,024 tokens.\n- **When it pays**: high-volume repeated calls with the same large system prompt, static tool definitions, or large document context. If you have a 10k-token system prompt and 1,000 calls/day, caching eliminates 10M input tokens/day.\n- **Structure prompts correctly**: put the **most static content first** (tools → system instructions → static context) and the **variable user input last**. Any change before the breakpoint invalidates everything after it.",
        explanationDeep:
          "The mechanism is the KV (key-value) cache from the transformer's attention layers. When a new request has a prefix that's identical to a previously computed one, the provider reuses those KV activations instead of recomputing them — effectively skipping the forward pass for the cached portion. This is why exact prefix matching is required; even a single character change invalidates the cache from that point forward.\n\nOn Anthropic, you explicitly mark which content blocks to cache using cache_control, giving you fine-grained control over up to 4 cache breakpoints at different sections that change at different rates — e.g., tool definitions (rarely change), system instructions (occasionally change), and large document context (per-session). This lets you maximize reuse across all three layers independently. Minimum cacheable length is 1,024 tokens for most Claude models (4,096 for some newer ones).\n\nThe design implication is that prompt structure becomes a performance decision. You're not just writing for model quality — you're writing to maximize cache hit rate. Long system prompts that seemed wasteful are now cheap if cached. This changes the calculus for adding detailed instructions, few-shot examples, or large schemas to the system prompt.",
        interviewerLens:
          "I want to see the candidate understand the mechanism (KV cache reuse, not semantic caching), the structural constraint (prefix must be identical), and the ordering rule (static first). The advanced signal is naming Anthropic's explicit vs OpenAI's automatic approach and the pricing model. Candidates who confuse prompt caching with semantic response caching (caching the output of similar queries) show they've read the headline but not the docs.",
        followupChain: [
          {
            question: "What's the difference between prompt caching and semantic caching?",
            answer:
              "Prompt caching reuses KV attention states for identical prompt prefixes — it's inside the model forward pass. Semantic caching caches the full response for semantically similar queries (e.g. in a Redis layer) — it skips the API call entirely. Semantic caching is coarser and application-layer; prompt caching is provider-side and exact-match.",
          },
          {
            question: "How do you warm the cache before user traffic arrives?",
            answer:
              "With Anthropic, fire a dummy request with max_tokens=0 targeting the static prefix at startup. Check cache_creation_input_tokens in the response to confirm the write happened. This ensures the first real user request gets a cache hit instead of a cold miss.",
          },
          {
            question: "When does prompt caching actually hurt you?",
            answer:
              "When the 'static' prefix changes every call (e.g. includes a timestamp or session ID) — you get cache writes but zero hits, paying the 25% write premium for nothing. Also when the prompt is below the minimum token threshold (1,024 for most models), caching simply doesn't activate.",
          },
        ],
        redFlags: [
          {
            junior: "\"Prompt caching is like response caching — if the question is similar you get the same answer.\"",
            senior:
              "\"Prompt caching reuses KV states for identical prefixes — it's inside the model, not application-layer semantic caching.\"",
          },
          {
            junior: "\"I'd put the user message first to give it context.\"",
            senior:
              "\"Static content first (tools, system, fixed context), variable user input last — changing anything before the breakpoint busts the cache.\"",
          },
        ],
        alternatePhrasings: [
          "\"How do you reduce LLM API cost for a high-volume feature?\"",
          "\"What is KV cache and how does it relate to prompt caching?\"",
          "\"How do you structure prompts for cost efficiency?\"",
        ],
        interviewContexts: [
          "Mid-level AI engineer loop at a scale-up product company",
          "System design round focused on LLM cost optimization",
        ],
      },
      {
        category: "deep-dives",
        riskLevel: "high",
        asked: 24,
        questionText:
          "How do you reduce hallucination in a production LLM feature?",
        answerStructured:
          "- **Ground the model in retrieved facts** (RAG): inject relevant source text and instruct the model to answer only from that context. This is the single biggest lever.\n- **Temperature 0** for factual tasks: deterministic sampling at the top probability reduces random confabulation.\n- **Constrain the abstain path**: explicitly prompt 'If you don't know, say so' and few-shot the desired abstention format.\n- **Validate outputs**: use NLI or LLM-as-judge faithfulness checks to flag answers that aren't supported by the retrieved context.\n- **Structured output + schema**: a model forced to fill typed fields hallucinates less than one generating free prose.\n- **Acknowledge you can't hit zero**: hallucination is a property of probabilistic generation; you reduce it with layers, then monitor and alert on the rate.",
        explanationDeep:
          "Hallucination isn't a bug you fix; it's a property of autoregressive language models generating the statistically plausible next token. The model doesn't know what it doesn't know — it fills gaps with confident-sounding text. The engineering goal is layered mitigation, not elimination.\n\nThe most impactful single change is grounding: give the model the source document and tell it to stay within it. The model no longer needs to 'remember' the fact — it's in context. RAG is the production pattern for this at scale. Then: temperature 0 for factual extraction (reproducible + least likely to sample off-distribution), explicit abstention prompting ('say I don't know'), and structured output (harder to confabulate when you have to fill specific typed fields).\n\nThe validation layer closes the loop: a faithfulness check compares each claim in the output against the retrieved context using NLI or an LLM-as-judge prompt. If a claim isn't grounded, flag it, log it, and optionally refuse to serve it. This is how you build an SLO around hallucination rate instead of just hoping the prompt works.",
        interviewerLens:
          "I want the layered answer: grounding first, then sampling params, then abstention prompting, then validation. The trap is candidates who say 'use a bigger/better model' — that usually helps marginally but doesn't change the architecture of the problem. The senior signal is treating hallucination rate as a measurable SLO with a validation layer, not just a prompt quality issue.",
        followupChain: [
          {
            question: "How do you run a faithfulness check at scale?",
            answer:
              "Use an LLM-as-judge prompt that scores each answer against the retrieved context (Likert scale or binary faithful/not). Run this asynchronously on a sample in prod and on 100% of your eval set. Track faithfulness rate per feature and alert on drops.",
          },
          {
            question: "Doesn't RAG hallucination happen too — the model ignores the retrieved context?",
            answer:
              "Yes — a model can retrieve the right passage and still ignore it. The fix is a stronger prompt ('answer ONLY using the context below'), few-shot examples of correct grounding, and checking the model's temperature. A faithfulness check catches this: if the claim isn't in the retrieved text, it's a hallucination regardless of whether RAG was used.",
          },
        ],
        redFlags: [
          {
            junior: "\"Use a better/bigger model.\"",
            senior:
              "\"Ground the model in retrieved context, set temperature 0, prompt for abstention, and validate faithfulness — layered mitigation, not model magic.\"",
          },
          {
            junior: "\"You can't do anything about hallucination.\"",
            senior:
              "\"You can't reach zero, but you can measure and reduce the rate with grounding, sampling, and validation layers.\"",
          },
        ],
        alternatePhrasings: [
          "\"Our LLM is making stuff up — how do you fix it?\"",
          "\"How do you build a trustworthy LLM feature?\"",
          "\"How do you measure hallucination rate in production?\"",
        ],
        interviewContexts: [
          "Mid-level AI engineer onsite at an enterprise software company",
          "Asked in every LLM quality-focused interview in the 2025 season",
        ],
      },
      {
        category: "decision-frameworks",
        riskLevel: "medium",
        asked: 19,
        questionText:
          "How do you optimize LLM cost and latency without sacrificing output quality?",
        code: [
          {
            lang: "python",
            lines: [
              "TIER = {'classify': 'gpt-4o-mini',",
              "        'reason': 'gpt-4o'}",
              "def route(task):",
              "    return TIER[task]  # cheapest",
              "# only hard tasks -> frontier model",
            ],
          },
        ],
        answerStructured:
          "- **Model routing**: use a small, fast model (GPT-4o-mini, Haiku) for simple tasks; route complex tasks to a frontier model. 40–60% cost reduction is typical with <3% quality drop.\n- **Prompt caching**: cache the static system prompt + tool definitions. 90% off cached tokens (Anthropic) or 50-90% off (OpenAI) for repeated large prefixes.\n- **Prompt compression**: trim redundant instructions, remove filler, use concise few-shot examples. Fewer input tokens = lower cost + lower TTFTT.\n- **Async batch APIs**: for offline workloads (classification, enrichment), use OpenAI Batch API or Anthropic Message Batches — 50% cost reduction, up to 24h turnaround.\n- **Streaming** for chat UX: doesn't reduce cost but radically improves perceived latency at no extra charge.\n- **Never optimize blind**: measure token spend per feature, output quality per model tier, and latency p50/p95 before and after each change.",
        explanationDeep:
          "Cost and quality are often in tension, but they don't have to be. The key insight is that not all requests need the same model — a simple classification or extraction call that a small model handles reliably doesn't need GPT-4o or Claude Sonnet. Model routing is the highest-ROI lever: identify your task categories, benchmark quality across model tiers on a representative eval set, and route accordingly.\n\nPrompt caching compounds well with model routing: large system prompts become cheap once cached. Together these two changes can reduce cost by 60–80% on a mature feature. Then prompt compression is a one-time investment in writing tight, high-signal prompts — it also improves latency because the model processes fewer tokens.\n\nThe meta-principle: never do latency or cost optimization without measurement. Run your eval set on the candidate model before routing to it. Track token spend by feature in your observability dashboard so you know which feature is burning the budget. Cost optimization without quality measurement is just making things worse, faster.",
        interviewerLens:
          "I want to hear model routing as the first and biggest lever, then caching, then compression. The red flag is 'just use a smaller model everywhere' without mentioning quality eval or routing logic. The senior signal is treating this as a quality/cost trade-off that you measure before shipping.",
        followupChain: [
          {
            question: "How do you decide the routing threshold between models?",
            answer:
              "Run the same eval set on both the small and large model. Find the task categories where quality drops below your SLO on the small model — those stay on the large model. Everything else routes to the small model. Track routing distribution in prod and alert on quality regression.",
          },
          {
            question: "What's TTFTT and why does it matter for streaming?",
            answer:
              "Time-to-first-token: how long before the user sees the first character. In streaming chat UIs this is the dominant latency metric — users perceive a fast TTFTT as 'snappy' even if total generation is long. Prompt compression, caching, and smaller models all reduce TTFTT.",
          },
        ],
        redFlags: [
          {
            junior: "\"Just use a cheaper model everywhere.\"",
            senior:
              "\"I benchmark quality by task category, route each category to the cheapest model that hits the SLO, and measure before shipping.\"",
          },
          {
            junior: "\"We can cut cost by shortening the output.\"",
            senior:
              "\"Cutting output length hurts quality for long-form tasks. The levers are input token reduction (caching, compression) and model routing — not truncating answers.\"",
          },
        ],
        alternatePhrasings: [
          "\"Our LLM API bill is too high — what do you do?\"",
          "\"How do you balance model quality and cost?\"",
          "\"What's your latency optimization playbook for LLM features?\"",
        ],
        interviewContexts: [
          "Mid-level system design round at a Series B AI startup",
          "Asked at 2 platform engineering interviews with LLM budget owners",
        ],
      },
      {
        category: "decision-frameworks",
        riskLevel: "medium",
        asked: 14,
        questionText:
          "How do you decide which LLM provider and model to use for a new feature?",
        answerStructured:
          "- **Start with the task**: what kind of reasoning, what output format, what context length? Not all models are equal on all tasks.\n- **Check benchmarks for your task type**: general benchmarks (MMLU, MATH) don't tell you about your specific domain — run your own eval.\n- **Provider constraints**: latency SLAs, data residency (Azure vs OpenAI vs Anthropic direct), compliance (HIPAA, SOC2), pricing, and rate limits matter operationally.\n- **Start with a frontier model** to establish a quality ceiling, then try smaller/cheaper models to find the minimum quality-meeting tier.\n- **Don't pick by hype**: the 'best' model changes every few months. Your eval set is the tiebreaker, not the leaderboard.",
        explanationDeep:
          "The wrong answer is picking the latest model by hype or the cheapest by default. The right answer is establishing a quality ceiling with a frontier model on your actual task, then finding the cheapest model that clears your quality SLO. This requires an eval set — a representative set of inputs with known correct outputs that you can score automatically.\n\nProvider constraints are real and underweighted in technical conversations. A startup moving fast might be fine with direct OpenAI; an enterprise handling healthcare data needs a Business Associate Agreement, data residency controls, and audit logs — that's Azure OpenAI or Anthropic's Enterprise. These constraints often narrow the model choice before technical evaluation begins.\n\nModel capabilities shift fast. GPT-4o, Claude 3.5 Sonnet, and Gemini 1.5 Pro were neck-and-neck on many benchmarks in 2024–2025; by mid-2025 new releases reshuffled rankings. This means your selection process needs to be repeatable — the same eval harness you use to select a model today is the thing you run when the next model drops.",
        interviewerLens:
          "I want to see 'run your own eval' as the central selection mechanism, not benchmark leaderboard worship. The provider-constraint angle is a senior signal — most engineers only think about model quality, not compliance, residency, or rate limits.",
        followupChain: [
          {
            question: "How quickly should you switch to a new model when a better one releases?",
            answer:
              "Run it through your eval set. If it beats the current model on quality and the migration is low-risk (same API shape, same pricing tier), switch. If quality is marginal or the pricing jumps, stay put. Never switch based on benchmarks alone.",
          },
        ],
        redFlags: [
          {
            junior: "\"We use GPT-4o because it's the best.\"",
            senior:
              "\"I run the task through our eval set across candidate models — 'best' is task-specific and changes with every release.\"",
          },
        ],
        alternatePhrasings: [
          "\"Which LLM would you pick for this use case?\"",
          "\"How do you evaluate model options for a new AI feature?\"",
        ],
        interviewContexts: [
          "Mid-level AI engineering interview at a product-led growth company",
          "Asked as a follow-up during a system design interview",
        ],
      },
      {
        category: "tool-comparison",
        riskLevel: "medium",
        isComparison: true,
        comparisonTools: ["Function Calling", "Prompt-only"],
        asked: 17,
        questionText:
          "What is function/tool calling in LLM APIs, and when would you use it over plain prompt output?",
        code: [
          {
            lang: "python",
            lines: [
              "tools = [{'type': 'function',",
              "  'name': 'get_weather',",
              "  'parameters': schema}]",
              "r = client.responses.create(",
              "  model='gpt-4o', input=msgs,",
              "  tools=tools)",
              "# model picks tool; YOU run it",
            ],
          },
        ],
        answerStructured:
          "- **Tool calling** (also 'function calling') lets you declare a set of functions with JSON Schema, and the model outputs a structured tool-call object (name + typed arguments) when it decides to invoke a tool, rather than free text.\n- The model **does not execute** the function — your code does. The model just produces the structured call; you run it and optionally return results for the model to continue.\n- **Use tool calling over plain prompt output** when: (1) you need reliable structured data extraction, (2) you're building an agent that takes real actions, (3) you want type-safe argument parsing without manual JSON coercion.\n- **Prompt-only** is fine for: free-form generation, classification where you format the output in the prompt, or tasks where a schema would over-constrain the output.\n- Tool calling is the production-grade path for structured extraction — it's constraint-based, not prompt-based, so it doesn't rely on the model 'knowing' to format correctly.",
        explanationDeep:
          "Tool calling exists because asking a model to output valid JSON in a prompt is unreliable at scale. When you declare a tool with a JSON Schema, the provider constrains the sampler to generate tokens that form a valid object matching the schema — the same mechanism as structured output mode. This guarantees parseable, type-correct output without retry logic for malformed responses.\n\nFor agents, tool calling is the mechanism that connects the model's reasoning to real-world actions. You declare what tools are available (search, send_email, query_db), and the model decides which to call and with what arguments based on the user's goal. Your orchestration layer handles execution and feeds results back. This ReAct-style loop (Reason, Act, Observe) is the foundation of every modern LLM agent.\n\nThe distinction that matters in interviews: the model generates the tool call as a structured output — it's a message in the response, not an execution. Your code receives it, validates it, runs the actual function (with all the safety checks that implies), and optionally returns a tool result message to continue the conversation. The model is the planner; your code is the executor.",
        interviewerLens:
          "I'm checking that the candidate knows the model doesn't execute the function — it produces a structured call that your code runs. Candidates who say 'the model calls the API' reveal they've only read the high-level pitch. The follow-up trap: 'What's the difference between tool calling and structured output mode?' — both constrain generation, but tool calling is the pattern for agent action-taking, structured output is for passive data extraction.",
        followupChain: [
          {
            question: "What's the difference between tool calling and structured output mode?",
            answer:
              "Tool calling declares available functions and the model decides if/which to invoke, returning a tool-call message. Structured output constrains the entire response to a schema you define — the model always returns the schema shape. Tool calling is for agent action-taking where the model decides what to do; structured output is for extraction where you always want the same shape.",
          },
          {
            question: "How do you handle a model that calls the wrong tool?",
            answer:
              "Clear tool descriptions with explicit examples of when to use each, few-shot demonstrations, and restrict the tool set to what's actually needed for the task. In agents, validate the tool name before executing and return a structured error if an unknown or inapplicable tool is called.",
          },
        ],
        redFlags: [
          {
            junior: "\"The model calls the function directly.\"",
            senior:
              "\"The model outputs a structured tool-call object; my code executes the function and optionally returns the result.\"",
          },
          {
            junior: "\"I'd just prompt it to return the JSON with the function arguments.\"",
            senior:
              "\"Tool calling constrains the sampler to a valid schema — it's more reliable than prompt-based JSON at production scale.\"",
          },
        ],
        alternatePhrasings: [
          "\"How do you use an LLM to trigger actions in your system?\"",
          "\"What is function calling and how do you implement it?\"",
        ],
        interviewContexts: [
          "Mid-level AI engineer screen at an agent-platform startup",
          "Asked in the system design round of an LLM infra interview",
        ],
      },
    ],
    topics: {
      moreDeepDives: [
        "How do you version and deploy prompt changes safely?",
        "What is chain-of-thought prompting and when does it improve accuracy?",
        "How do you implement semantic caching for LLM responses?",
        "How do you handle multi-turn conversation history efficiently?",
        "What is LLM-as-judge and how do you calibrate it?",
      ],
      decisions: [
        "When to add a reranker to a RAG pipeline vs improve embeddings?",
        "Synchronous API call vs async batch for a data-enrichment job?",
        "One large prompt vs multiple smaller chained calls?",
      ],
      quickRef: [
        "Structured output: schema-constrained decoding, not prompt tricks",
        "Prompt caching (Anthropic): 90% off cache reads, 5-min TTL default",
        "Prompt caching (OpenAI): automatic, 50-90% off, ≥1024 tokens",
        "Tool calling: model outputs structured call, your code executes",
        "Temperature 0 for extraction/classification; 0.7+ for generation",
        "Model routing: route by task complexity to minimize cost",
        "Batch API: 50% cost reduction, ≤24h turnaround, latency-tolerant",
        "Hallucination mitigation: ground → temp-0 → abstain-prompt → validate",
        "TTFTT: time-to-first-token, key UX latency metric for streaming",
        "Parse-failure rate: primary SLO for structured output pipelines",
      ],
      redFlags: [
        {
          junior: "\"The model calls the function itself.\"",
          senior:
            "\"Model outputs a structured call; my code executes it and returns results.\"",
        },
        {
          junior: "\"Use a bigger model to fix hallucination.\"",
          senior:
            "\"Layer mitigation: ground in context, temperature 0, abstention, faithfulness validation.\"",
        },
        {
          junior: "\"Prompt caching is like semantic response caching.\"",
          senior:
            "\"Prompt caching reuses KV attention states for identical prefixes — exact match, provider-side.\"",
        },
        {
          junior: "\"We can cut cost by just using a smaller model.\"",
          senior:
            "\"Route by task complexity after benchmarking quality per tier — not wholesale downgrade.\"",
        },
        {
          junior: "\"I'll prompt it to return JSON.\"",
          senior:
            "\"I use structured-output/tool-calling mode with a schema — constraint-based, not prompt-based.\"",
        },
        {
          junior: "\"Streaming reduces API cost.\"",
          senior:
            "\"Streaming reduces perceived latency; cost is determined by token count, not streaming mode.\"",
        },
      ],
      checklist: [
        "Structured output: schema, validate, retry on failure, measure parse-failure rate",
        "Prompt caching: structure prompt static-first, know provider mechanics",
        "Hallucination: grounding, temperature, abstention, faithfulness eval",
        "Cost optimization: model routing, caching, batch API, prompt compression",
        "Tool calling: model as planner, your code as executor, validate before run",
      ],
      behavioral: [
        "A time you cut LLM API cost significantly — what levers did you pull?",
        "Describe debugging a structured-output pipeline that was silently dropping data",
        "How you introduced an eval harness to a team that didn't have one",
      ],
      reverse: [
        "Which models are in prod and how is the routing decision made?",
        "How is LLM cost tracked per feature?",
        "What's the current hallucination rate and how is it monitored?",
      ],
    },
  },

  senior: {
    authored: [
      {
        category: "deep-dives",
        riskLevel: "high",
        freePreview: true,
        asked: 29,
        questionText:
          "Fine-tuning vs RAG vs prompt engineering — how do you decide which to use, and when do you combine them?",
        answerStructured:
          "- **Prompt engineering first**: cheapest, fastest to iterate, solves more than expected with few-shot + careful instructions. Always the starting point.\n- **RAG** when the problem is **knowledge or freshness**: the model needs facts it wasn't trained on, facts that change, or needs to cite sources. Retrieval injects current knowledge at inference; the index updates in minutes.\n- **Fine-tuning** when the problem is **behavior, format, or style — not facts**: consistent output structure, a narrow specialized task, or reducing prompt size and latency at high volume. LoRA/QLoRA make fine-tuning accessible on a single GPU.\n- **They compose**: fine-tune for output format and tone + RAG for knowledge is the production-grade hybrid pattern for 2025–2026.\n- Decision driver: is the gap **knowledge** (→ RAG) or **behavior** (→ fine-tune)? And can prompting close it cheaply first?",
        explanationDeep:
          "The classic mistake is fine-tuning to teach a model facts. Fine-tuning bakes weights — it's expensive, becomes stale the moment the knowledge changes, and is hard to audit. RAG keeps knowledge external, updatable, and citable. The diagnostic question is: 'If I gave this context to the model in the prompt, would it answer correctly?' If yes, it's a retrieval problem, not a fine-tuning problem.\n\nFine-tuning pays when the behavior gap is consistent, measurable, and stable: you want the model to always extract in a specific JSON shape, always respond in a particular brand voice, or classify into a narrow taxonomy with high precision. You have labeled examples, the task is narrow, and a fine-tuned smaller model can replace a larger prompted one at lower cost and latency. LoRA and QLoRA (2024–2025 standard) make this tractable on a single consumer GPU — full fine-tuning is rarely necessary.\n\nThe modern production pattern is hybrid: a fine-tuned model handles the behavioral shape and domain calibration; RAG injects current knowledge at inference. This separates the concerns cleanly and lets you update knowledge (rebuild the index) without re-training the model. The pitfall: a model fine-tuned for high confidence can override retrieved context — you manage this with prompt design and faithfulness evals.",
        interviewerLens:
          "The dividing line I want to hear is 'knowledge → RAG, behavior → fine-tune,' and that they'd try prompting first. The expensive-lesson red flag is candidates who say 'fine-tune on our docs so it knows them' — that reveals they haven't shipped an LLM product. The senior tell is naming the hybrid pattern and noting that fine-tuned confidence can conflict with RAG — that's the subtle pitfall you only see in production.",
        followupChain: [
          {
            question: "When is fine-tuning clearly the right call over RAG?",
            answer:
              "Stable, narrow task with abundant labeled examples where you need consistent format/tone or want to shrink a large prompted model into a smaller, cheaper one. High-volume classification, extraction with a fixed schema, or brand-voice generation are the canonical cases. The knowledge doesn't change, so staleness isn't a risk.",
          },
          {
            question: "Can RAG and fine-tuning conflict?",
            answer:
              "Yes — a model fine-tuned to be confident about domain topics can override retrieved context that contradicts its weights. You manage it with a strong grounding prompt ('answer only from the context below'), faithfulness evals, and optionally a lower fine-tuning learning rate so the model doesn't over-fit to confidence.",
          },
          {
            question: "What's the 2025 best practice for fine-tuning efficiently?",
            answer:
              "LoRA (Low-Rank Adaptation) or QLoRA for memory-constrained setups — train adapter layers on a frozen base model, requiring a fraction of the memory of full fine-tuning. DPO (Direct Preference Optimization) for alignment from preference data without a separate reward model. Both are now available in open frameworks (HuggingFace TRL, LLaMA-Factory).",
          },
        ],
        redFlags: [
          {
            junior: "\"Fine-tune it on our docs so it knows them.\"",
            senior:
              "\"Docs are knowledge — that's RAG. Fine-tuning is for behavior/format, and knowledge baked in weights goes stale.\"",
          },
          {
            junior: "\"Fine-tuning always makes the model better.\"",
            senior:
              "\"Fine-tuning changes behavior, not knowledge; it can hurt general capability if your dataset is narrow — you measure on a held-out eval set.\"",
          },
        ],
        alternatePhrasings: [
          "\"Should we fine-tune or use RAG?\"",
          "\"How do you customize an LLM for our use case?\"",
          "\"When is fine-tuning worth the cost?\"",
        ],
        interviewContexts: [
          "Asked at 4 separate senior AI engineering loops in 2025",
          "System design round at a well-funded AI infrastructure company",
        ],
      },
      {
        category: "deep-dives",
        riskLevel: "high",
        asked: 23,
        questionText:
          "How do you design an eval harness for an LLM feature in production?",
        answerStructured:
          "- **Define what 'correct' means first**: a curated test set of 100–500 representative inputs with expected outputs, scored by automated metrics and/or LLM-as-judge.\n- **Layer your evals**: (1) unit evals on individual steps (retrieval recall, parse-failure rate), (2) end-to-end task success on the full pipeline, (3) regression tests for known failure modes.\n- **Automate in CI**: every prompt change, model upgrade, or schema change runs the eval suite before merge. A quality drop below SLO blocks the deploy.\n- **LLM-as-judge calibration**: agree your judge prompt with human raters on a calibration set (target >85% agreement); then it's a reliable automated signal at scale.\n- **Monitor in prod**: sample live outputs and score them asynchronously; alert on quality drops, not just error rates. Evals in CI catch regressions; prod monitoring catches distribution shift.",
        explanationDeep:
          "The hardest part of LLM evals is that 'correct' is often fuzzy and task-specific. Start by defining it concretely: for extraction, it's field accuracy on a labeled set; for generation, it's a rubric your LLM judge scores reliably; for agents, it's end-to-end task success rate. The test set is the most important artifact — 100 high-quality, representative examples beats 10,000 random ones. Include known failure modes and edge cases explicitly.\n\nCI integration is the forcing function for engineering discipline. When every prompt change runs the eval suite, prompt engineering becomes a rigorous engineering practice instead of vibes-based iteration. You need fast evals (automated metrics, LLM-as-judge) that complete in minutes, not hours. Slow evals don't get run and don't catch regressions.\n\nThe production monitoring layer is separate and necessary. Your CI eval set is a static slice of the distribution at the time you wrote it; production data drifts. Sampling live outputs, scoring them asynchronously, and trending the quality score over time catches model drift, data drift, and prompt breakage in production — things that never appear on your static eval set.",
        interviewerLens:
          "I'm listening for the three-layer structure (unit / end-to-end / regression), CI integration as a blocking gate, and the distinction between eval in CI and monitoring in prod. Candidates who describe only 'running the eval manually' reveal they haven't productionized an LLM feature at scale. LLM-as-judge calibration is the advanced signal — you should be able to justify why your judge is reliable.",
        followupChain: [
          {
            question: "How do you handle eval for non-deterministic tasks like creative writing?",
            answer:
              "Define a rubric (tone, relevance, length, format) and score with LLM-as-judge. Run multiple samples and aggregate to reduce variance. Calibrate the judge on human-rated examples. You can't require exact string match, but you can define measurable quality dimensions and score them reliably.",
          },
          {
            question: "What's the minimum eval set size to be meaningful?",
            answer:
              "100–200 examples is typically enough to detect regressions at the 5% level with statistical significance. The quality of examples matters more than the quantity — 50 carefully curated, edge-case-rich examples often detect more regressions than 500 randomly sampled ones.",
          },
          {
            question: "How do you handle model version changes from the provider?",
            answer:
              "Treat them as breaking changes: pin to a specific model version in prod, run the full eval suite on the new version before upgrading, and plan a rollout window. Providers deprecate model versions on schedule — staying on an old version is a known tech debt you track and pay down deliberately.",
          },
        ],
        redFlags: [
          {
            junior: "\"We manually check outputs after each change.\"",
            senior:
              "\"Evals run in CI on every prompt/model change — manual review is for calibration, not regression detection.\"",
          },
          {
            junior: "\"We use BLEU/ROUGE for everything.\"",
            senior:
              "\"BLEU/ROUGE are word-overlap metrics that miss semantic quality. I use task-specific metrics + LLM-as-judge calibrated to human raters.\"",
          },
        ],
        alternatePhrasings: [
          "\"How do you know if your LLM feature is getting better or worse?\"",
          "\"Describe your eval setup for an LLM in production.\"",
          "\"How do you prevent prompt regressions?\"",
        ],
        interviewContexts: [
          "Senior AI engineer system design at an enterprise AI company",
          "Staff-level AI engineering interview at a FAANG-adjacent product org",
        ],
      },
      {
        category: "deep-dives",
        riskLevel: "high",
        asked: 21,
        questionText:
          "How do you build production reliability and guardrails for an LLM feature that handles user input?",
        answerStructured:
          "- **Input guardrails**: classify/filter user input before it hits the model — detect off-topic requests, PII, jailbreak attempts, and prompt injections. Use a fast classifier (small fine-tuned model or rules) as a gating layer.\n- **Output guardrails**: validate output against schema, content policy, and citation faithfulness before serving. Reject + retry or return a safe fallback.\n- **Prompt injection defense**: treat user input as untrusted data; separate it from system instructions structurally, never concatenate raw user input into the system prompt.\n- **Circuit breakers + fallbacks**: if the model is unavailable, returns errors, or exceeds latency SLO, serve a cached or degraded response — don't fail open.\n- **Observability**: log every request/response (with PII scrubbing), trace latency per step, alert on error rate, quality score, and cost per request.",
        explanationDeep:
          "Production LLM features face a different threat model than traditional software. The 'input' is arbitrary natural language and the 'output' is generated text — both surfaces are novel attack vectors. Input guardrails are a middleware layer: every user message runs through a fast classifier that gates on content policy violations, PII (for compliance), and known jailbreak patterns before the expensive model call. This protects against both accidental misuse and adversarial attacks.\n\nPrompt injection is the SQL injection of LLM systems: if user-supplied text is concatenated into the system prompt, a malicious user can override your instructions. The structural defense is keeping system and user turns in their proper API fields — never f-string user input into a system prompt. For RAG, retrieved documents can also carry injections, which is why you validate and sanitize retrieved context before injecting it.\n\nThe output layer is symmetric: you validate the generated content before serving it. Schema validation catches malformed structured outputs; content policy checks catch policy violations in free-form text; faithfulness checks catch hallucinations in grounded answers. Then you decide: retry silently, return a safe fallback, or surface an error to the user. The key is never silently serving a bad output — log it, track it, and alert on volume.",
        interviewerLens:
          "I'm looking for the middleware mental model: input guardrails → model call → output validation → serve or fallback. The prompt injection angle is the senior security signal — most candidates don't think about it. Observability and circuit breakers show operational maturity. Candidates who say 'just add a system prompt saying be helpful and harmless' have not shipped a user-facing LLM feature.",
        followupChain: [
          {
            question: "How do you handle a model that starts returning policy violations in prod?",
            answer:
              "You need observability first — you see the violation in your output-validation metrics. Immediate: add an output filter to catch and reject the pattern. Short-term: identify if it's prompt drift (the prompt changed), model drift (provider updated the model), or data drift (users found a new jailbreak). Long-term: add the pattern to your eval set so it's a regression test going forward.",
          },
          {
            question: "How do you defend against indirect prompt injection in RAG?",
            answer:
              "Retrieved documents can contain adversarial instructions meant to override the system prompt. Defenses: sanitize retrieved text (strip HTML, escape special chars), use a structured prompt format that clearly delineates retrieved context from instructions, and run a classifier on retrieved chunks for injection patterns. Full defense is hard — you monitor and add patterns as you see them.",
          },
        ],
        redFlags: [
          {
            junior: "\"Just add a system prompt saying 'be safe and helpful.'\"",
            senior:
              "\"Guardrails are middleware — input classifier, output validator, fallbacks, prompt injection isolation, and observability on every layer.\"",
          },
          {
            junior: "\"The model handles safety automatically.\"",
            senior:
              "\"Base models have alignment training, but production safety is your responsibility: input filtering, output validation, and monitoring.\"",
          },
        ],
        alternatePhrasings: [
          "\"How do you make an LLM feature safe for production users?\"",
          "\"What is prompt injection and how do you defend against it?\"",
          "\"Describe your guardrails architecture for a user-facing LLM app.\"",
        ],
        interviewContexts: [
          "Senior AI engineer security round at a consumer AI company",
          "System design interview focused on trust and safety at scale",
        ],
      },
      {
        category: "deep-dives",
        riskLevel: "high",
        asked: 18,
        questionText:
          "Self-host an open-source LLM vs use a cloud API — how do you make the decision?",
        answerStructured:
          "- **API (OpenAI/Anthropic/Gemini)**: zero MLOps overhead, access to frontier capability, per-token pricing, easy to start. Best for most products, especially early-stage.\n- **Self-host (Llama 3, Mistral, Qwen)**: data never leaves your infra (critical for compliance/IP), predictable cost at high throughput, customization freedom (fine-tuning, inference optimization). Requires GPU infra, serving stack (vLLM, TGI), and ongoing ops.\n- **Decision matrix**: data sensitivity (self-host wins for regulated data), volume (self-host wins above a cost-crossover point), capability gap (API wins for frontier reasoning), ops capacity (API wins without an ML platform team).\n- **Hybrid is common**: API for frontier tasks and low-volume calls; self-hosted for high-volume classification, PII-sensitive processing, or tasks where a fine-tuned open-source model matches frontier quality.\n- The cost crossover is typically reached at millions of tokens/day — below that, API is almost always cheaper when you factor in GPU infra and ops.",
        explanationDeep:
          "The cost math is deceptive. Self-hosting a 70B parameter model requires A100/H100 GPUs ($2–4/hr on cloud), a serving stack (vLLM is the 2025 standard for PagedAttention and continuous batching), monitoring, model management, and engineering time. At low volume, this overhead dwarfs API per-token costs. The crossover happens when token volume is high enough that API spend exceeds infrastructure-plus-ops cost — typically millions of tokens/day.\n\nThe more compelling reason to self-host is often data sensitivity, not cost. Healthcare, finance, and legal workflows often can't send data to third-party APIs due to compliance requirements (HIPAA, SOC2, GDPR). Self-hosting (or using a cloud provider's dedicated endpoint) keeps data within your control boundary. A fine-tuned open-source model at 7B–70B often matches frontier API quality on narrow tasks, so the capability trade is frequently acceptable.\n\nThe ops reality of self-hosting is substantial: model versioning, GPU capacity planning, serving latency SLOs, fault tolerance, batching strategies, and keeping up with rapidly improving open-source releases. This requires a dedicated ML platform function. Without it, API is usually the right answer regardless of cost.",
        interviewerLens:
          "I want to hear the decision matrix: data sensitivity, volume/cost crossover, capability gap, and ops capacity. The cost-only answer is incomplete — data residency and compliance are often the decisive factor. The advanced signal is naming the 2025 serving stack (vLLM, TGI) and acknowledging that ops overhead is real and underestimated.",
        followupChain: [
          {
            question: "What serving stack would you use for self-hosted inference?",
            answer:
              "vLLM (2024–2025 standard) for its PagedAttention (efficient KV cache management) and continuous batching — dramatically higher throughput than naive inference. TGI (Text Generation Inference) is the alternative. For smaller models on constrained hardware, llama.cpp for CPU/low-VRAM inference. Layer an OpenAI-compatible API adapter on top so applications can switch between self-hosted and cloud API without code changes.",
          },
          {
            question: "How do you quantify the cost crossover point?",
            answer:
              "Estimate monthly token volume (input + output separately, since output is usually more expensive). Compare against API per-token cost. Then estimate self-host cost: GPU hours × utilization × instance cost + engineering overhead + ops time. The crossover for a 70B model on A100 vs GPT-4o API is typically in the 100M–500M tokens/month range, but varies widely by model size, GPU, and utilization.",
          },
        ],
        redFlags: [
          {
            junior: "\"Self-hosting is always cheaper.\"",
            senior:
              "\"Below a few hundred million tokens/month, API is usually cheaper when you factor in GPU infra and ops overhead.\"",
          },
          {
            junior: "\"Just run it on a local machine.\"",
            senior:
              "\"Production self-hosting needs a serving stack (vLLM), GPU capacity planning, fault tolerance, and an ML platform to operate it.\"",
          },
        ],
        alternatePhrasings: [
          "\"When would you use an open-source model instead of the OpenAI API?\"",
          "\"How do you evaluate the build-vs-buy decision for LLM inference?\"",
          "\"What does it take to run your own LLM in production?\"",
        ],
        interviewContexts: [
          "Senior AI engineer interview at a data-sensitive enterprise software company",
          "Platform design round at a cost-conscious scale-up",
        ],
      },
      {
        category: "decision-frameworks",
        riskLevel: "medium",
        asked: 16,
        questionText:
          "How do you approach a failing LLM feature in production — your quality metrics dropped and users are complaining?",
        answerStructured:
          "- **Bisect the failure first**: is it retrieval, model, prompt, or data? Log the full pipeline — retrieved chunks, prompt sent, model response — before drawing conclusions.\n- **Check what changed**: prompt change, model version change (provider upgrade), upstream data change, or user behavior shift. Use git blame on prompts and deployment logs.\n- **Roll back if needed**: if a prompt change is the culprit, revert immediately. If it's a provider-side model update, pin to the prior model version while investigating.\n- **Characterize the failure**: run the failing examples through your eval suite to identify which categories are degrading. Is it a specific topic, a schema field, a new user pattern?\n- **Fix, eval, deploy**: fix the identified root cause, run the full eval suite (not just the failing examples), and deploy with monitoring on the affected metrics.",
        explanationDeep:
          "LLM quality incidents differ from typical software bugs because the failure is probabilistic and often gradual — you might not notice until quality metrics have been degrading for days. This is why prod monitoring on sampled outputs matters: you want to catch the trend, not the complaint.\n\nThe bisection discipline is the senior signal: never assume it's the model without checking retrieval (if RAG), and never assume it's the prompt without checking whether the model version changed. Providers update models on their own schedules, and a model update that passes their safety benchmarks can still degrade your feature's specific task. Pinning model versions in production is therefore a best practice, not a footnote.\n\nThe rollback-first reflex is important: users are complaining, your quality metric is down. If you can identify the last change, revert it while you investigate. Don't try to fix the degraded state under pressure — restore the working state first, then diagnose at leisure.",
        interviewerLens:
          "I'm listening for the bisection instinct (what changed? where in the pipeline?) and the rollback-first reflex. The red flag is immediately jumping to 'improve the prompt' without checking whether the model version changed or the retrieval degraded. The advanced signal is having logging that makes bisection possible — which means they built observability proactively.",
        followupChain: [
          {
            question: "How do you prevent this failure mode from happening again?",
            answer:
              "Add the failing examples to the eval suite. Automate eval in CI so the failure would have been caught before deploy. Set up prod monitoring on the affected quality metrics with alerting. Pin the model version and have a documented upgrade process that includes running the full eval suite on the new version.",
          },
          {
            question: "What if the failure is in retrieval, not the model?",
            answer:
              "Inspect the retrieved chunks: are the right documents being surfaced? Check if the source data changed (index is stale, new document formats broke chunking). Run recall@k on a labeled set to measure retrieval quality directly. Fix the retrieval issue (re-chunk, re-embed, update the index) and validate before re-enabling.",
          },
        ],
        redFlags: [
          {
            junior: "\"I'd try different prompts until it gets better.\"",
            senior:
              "\"I'd bisect the pipeline, check what changed, roll back if possible, characterize the failure categories, then fix with eval validation.\"",
          },
        ],
        alternatePhrasings: [
          "\"Describe how you debug a degraded LLM feature.\"",
          "\"What's your incident response for an LLM quality issue?\"",
          "\"How do you know where in the LLM pipeline something broke?\"",
        ],
        interviewContexts: [
          "Staff AI engineer interview at a production-heavy LLM company",
          "Senior AI engineer system design — on-call and reliability focus",
        ],
      },
      {
        category: "decision-frameworks",
        riskLevel: "medium",
        asked: 13,
        questionText:
          "How do you decide when to use an LLM vs a traditional ML model or deterministic code for a task?",
        answerStructured:
          "- **Deterministic code first**: if the logic is expressible as rules, regex, or a simple lookup — do it. It's fast, cheap, testable, and doesn't hallucinate.\n- **Traditional ML** (classification, regression, structured prediction): if you have labeled data and a well-defined input/output schema, a fine-tuned BERT or sklearn model is orders of magnitude cheaper and more reliable than an LLM.\n- **LLM** when: the task requires **natural language understanding at the semantic level** (summarization, complex extraction, reasoning over unstructured text, conversation), or the task domain changes too rapidly for a labeled training set.\n- **The real question**: is the bottleneck language understanding or pattern matching? LLMs shine at the former; they're overkill and expensive for the latter.\n- Hybrid is common: LLM for the understanding step, deterministic code for business logic afterward.",
        explanationDeep:
          "The default for many engineers in 2024–2025 is 'use an LLM for everything' — it's the hammer. The senior engineer's job is knowing when the nail doesn't need a sledgehammer. A regex that correctly extracts a date format is infinitely more reliable, cheaper, and faster than asking an LLM to do it. Classification with 10k labeled examples is a fine-tuned BERT problem, not a GPT-4 problem.\n\nLLMs earn their cost when the task genuinely requires language understanding at a semantic level that's hard to specify as rules: summarizing a 10-page contract, reasoning about an ambiguous user intent, generating a contextually appropriate customer response. The non-rule-expressible, high-variance, natural-language-in tasks are where LLMs have no good alternatives.\n\nThe hybrid pattern is the practical synthesis: use an LLM for the fuzzy language-understanding step (classify intent, extract entities, summarize), then pass the structured output to deterministic code for business logic (route the request, validate the extracted value against a database, apply a rule-based filter). This isolates the probabilistic part and makes the system overall more testable and reliable.",
        interviewerLens:
          "I want to hear 'deterministic code first, then traditional ML, then LLM' as a deliberate escalation, not a default to LLM. The hybrid pattern is the senior tell — using LLMs for the language-understanding step and deterministic code for everything else. Candidates who say 'LLMs are just better' have not thought about cost, reliability, or testability.",
        followupChain: [
          {
            question: "Give an example where you'd choose traditional ML over an LLM.",
            answer:
              "Spam classification with 100k labeled emails: fine-tune a DistilBERT, run it locally, 99%+ accuracy, $0 per inference. Using GPT-4o for the same task is 100x more expensive per classification with no accuracy benefit — and you can't explain the decision in a regulated context.",
          },
        ],
        redFlags: [
          {
            junior: "\"LLMs are so good now, we use them for everything.\"",
            senior:
              "\"LLMs for language-understanding tasks; deterministic code or traditional ML for pattern-matching and structured prediction — LLMs are overkill and expensive for the latter.\"",
          },
        ],
        alternatePhrasings: [
          "\"How do you decide whether to use an LLM or not?\"",
          "\"Is there a task you'd never use an LLM for?\"",
          "\"When is a simpler ML model better than a foundation model?\"",
        ],
        interviewContexts: [
          "Senior AI engineering interview at a pragmatic product company",
          "Asked in a staff engineering loop at a data-intensive startup",
        ],
      },
      {
        category: "tool-comparison",
        riskLevel: "high",
        isComparison: true,
        comparisonTools: ["Fine-tuning", "RAG", "Prompting"],
        asked: 24,
        questionText:
          "Compare fine-tuning, RAG, and prompting: when does each dominate, when do they fail, and how do you validate the choice?",
        answerStructured:
          "- **Prompting**: zero infra, instant iteration, surprisingly powerful with few-shot + chain-of-thought. Fails when context length limits hit, when task requires knowledge beyond the cutoff, or when consistent format at scale becomes a prompt-engineering maintenance burden.\n- **RAG**: adds external knowledge that's current, citable, and swappable without retraining. Fails when retrieval quality is poor (the right chunk isn't surfaced), when latency of retrieval + generation is too high, or when the knowledge domain is too narrow for a retrieval index.\n- **Fine-tuning**: fixes behavioral gaps (format, tone, task specialization), can shrink prompt size, and reduces per-call cost at high volume. Fails when you use it to teach facts (goes stale), when the training set is too small or unrepresentative, or when the eval set doesn't match production distribution.\n- **Validate**: run all viable approaches through the same eval set; pick the one that hits the quality SLO at the lowest total cost (compute + ops + iteration velocity).",
        explanationDeep:
          "The practical production pattern in 2025–2026 is: start with prompting, add RAG when knowledge gaps appear, and consider fine-tuning only when prompting + RAG don't close the behavioral gap or the volume makes cost prohibitive. This isn't a waterfall — you can run all three in parallel in an eval harness and let the data decide.\n\nThe failure modes are where the learning lives. RAG's failure mode is retrieval — if recall@k is bad, the LLM can't help because the supporting text isn't in context. Fine-tuning's failure mode is overfitting to training distribution: if production inputs look different from the fine-tuning set, quality collapses in ways that are hard to predict without a representative eval set.\n\nValidation is the only honest answer: run every candidate approach on a test set that represents real production traffic. Cost the approaches end-to-end (prompt token cost for prompting; retrieval infra + generation for RAG; training + serving for fine-tuning). The winner is the one that hits the SLO at lowest total cost — and that answer changes as volume, model prices, and task requirements shift.",
        interviewerLens:
          "I want the failure modes for all three, not just the happy paths — that's what separates someone who's read about these techniques from someone who's shipped them. The validation answer (run all viable approaches through the same eval) is the senior engineering discipline signal.",
        followupChain: [
          {
            question: "How does LoRA change the fine-tuning decision?",
            answer:
              "LoRA makes fine-tuning much more accessible: you train adapter layers on a frozen base model, requiring 1/10th the VRAM of full fine-tuning, and you can swap adapters at serving time. This lowers the bar for fine-tuning experiments significantly — you can now iterate on fine-tuning almost as fast as on prompting, which changes the economics of the approach.",
          },
          {
            question: "Can you have too much context in prompting?",
            answer:
              "Yes — 'lost in the middle' is a documented phenomenon where models underweight context in the middle of very long prompts. Frontier models have improved, but very long contexts still see quality degradation on the middle sections. This is one reason RAG (retrieving only the relevant chunks) beats stuffing the full document, even when the document fits in the context window.",
          },
        ],
        redFlags: [
          {
            junior: "\"Fine-tuning is always the best for our use case.\"",
            senior:
              "\"Fine-tuning fixes behavior gaps; RAG fixes knowledge gaps. I validate the choice with an eval set — not intuition.\"",
          },
          {
            junior: "\"RAG always works if retrieval is good.\"",
            senior:
              "\"Even with perfect retrieval, the model can hallucinate, ignore context, or produce malformed output — retrieval quality is necessary but not sufficient.\"",
          },
        ],
        alternatePhrasings: [
          "\"Design a customization strategy for our LLM use case.\"",
          "\"We tried prompting and it's not good enough — what next?\"",
          "\"How do you think about the make-vs-buy spectrum for LLM customization?\"",
        ],
        interviewContexts: [
          "Senior AI engineer system design at a large AI-first startup",
          "Asked in staff engineering loop at a company evaluating moving from API to fine-tuned models",
        ],
      },
    ],
    topics: {
      moreDeepDives: [
        "How do you implement multi-model routing with quality fallback?",
        "Designing a prompt versioning and deployment pipeline.",
        "Agentic system design: tool orchestration, state management, budgets.",
        "How do you handle LLM latency SLOs at the 99th percentile?",
        "Evaluating and adopting a new frontier model in a live production system.",
      ],
      decisions: [
        "LoRA vs QLoRA vs full fine-tuning — which adapter approach for which constraint?",
        "API model with RAG vs self-hosted fine-tuned model for a sensitive use case?",
        "LLM-as-judge vs human eval vs automated metrics — when to use each?",
      ],
      quickRef: [
        "Fine-tuning = behavior/format; RAG = knowledge/freshness — never confuse",
        "LoRA: adapter layers on frozen base, ~10x less VRAM than full fine-tuning",
        "vLLM: production serving standard — PagedAttention + continuous batching",
        "Eval harness: unit / end-to-end / regression, automated in CI",
        "LLM-as-judge: calibrate to >85% human agreement before trusting at scale",
        "Prompt injection: user input in system prompt = SQL injection equivalent",
        "Input guardrails: fast classifier on user input before expensive model call",
        "Cost crossover: API cheaper below ~100M-500M tokens/month vs self-hosting",
        "Model pinning: pin versions in prod, run eval suite before upgrading",
        "Lost-in-the-middle: models underweight context in the middle of very long prompts",
      ],
      redFlags: [
        {
          junior: "\"Fine-tune on the docs to make it know them.\"",
          senior:
            "\"Docs are knowledge — use RAG. Fine-tuning is for behavior, and knowledge in weights goes stale.\"",
        },
        {
          junior: "\"We manually check outputs to validate quality.\"",
          senior:
            "\"Evals run in CI on every prompt/model change; prod monitoring on sampled outputs for drift.\"",
        },
        {
          junior: "\"Self-hosting is always cheaper at scale.\"",
          senior:
            "\"Below ~100M tokens/month the API is usually cheaper after GPU infra and ops overhead.\"",
        },
        {
          junior: "\"The model's safety training handles guardrails.\"",
          senior:
            "\"Base alignment is a starting point; production safety needs input classifiers, output validators, and observability.\"",
        },
        {
          junior: "\"I'd use an LLM for this classification task.\"",
          senior:
            "\"With labeled data and a stable taxonomy, a fine-tuned BERT is 100x cheaper and more reliable — I reach for LLMs when the task requires language understanding, not pattern matching.\"",
        },
        {
          junior: "\"I tried different prompts until it worked.\"",
          senior:
            "\"I bisect the pipeline, identify the failure category, fix root cause, and validate with the eval suite before shipping.\"",
        },
      ],
      checklist: [
        "Fine-tune vs RAG vs prompting: know the decision axis (knowledge vs behavior) and the failure modes of each",
        "Eval harness: unit / end-to-end / regression, CI-gated, prod monitoring layer",
        "Guardrails architecture: input classifier, output validator, prompt injection isolation",
        "Self-host vs API: data sensitivity, volume/cost crossover, ops capacity",
        "Production incident response: bisect, roll back, characterize, fix with eval validation",
      ],
      behavioral: [
        "A time you redesigned an LLM feature after a production quality incident",
        "How you introduced eval infrastructure to a team that shipped on vibes",
        "A decision to self-host vs API — what drove it and was it the right call?",
      ],
      reverse: [
        "What does your eval pipeline look like today — is it automated in CI?",
        "How do you handle provider model version updates in production?",
        "What's the most painful LLM reliability issue you've hit in the last 6 months?",
      ],
    },
  },
};
