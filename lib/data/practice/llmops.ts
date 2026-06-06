import type { ConvItem } from "./types";

/**
 * LLM Eval & Ops track — evals, LLM-as-judge (and its biases), observability
 * (OTel/Grafana/Logfire/Langfuse), guardrails, FinOps/cost-per-outcome, red-teaming.
 * Mostly conversational; a subset are interactive review items (eval/trace artifacts)
 * whose planted issues live in review-scenarios.server.ts. Authored via gen_conv.py
 * + gen_review.py.
 *
 * Sources (2025–2026):
 * - OWASP Top 10 for LLMs 2025: https://genai.owasp.org/llmrisk/llm01-prompt-injection/
 * - Ragas metrics: https://docs.ragas.io/en/stable/concepts/metrics/available_metrics/
 * - OTel GenAI semantic conventions: https://opentelemetry.io/docs/specs/semconv/gen-ai/
 * - vLLM / PagedAttention anatomy: https://blog.vllm.ai/2025/09/05/anatomy-of-vllm.html
 * - Self-Preference Bias in LLM-as-a-Judge: https://arxiv.org/abs/2410.21819
 * - Many-shot jailbreaking (Anthropic, NeurIPS 2024): https://www.anthropic.com/research/many-shot-jailbreaking
 * - How to Correctly Report LLM-as-a-Judge Evaluations: https://arxiv.org/pdf/2511.21140
 */
export const LLMOPS_ITEMS: ConvItem[] = [
  // ─── EVALS ───────────────────────────────────────────────────────────────────
  {
    id: "lop-001",
    category: "llmops",
    level: "junior",
    title: "Offline vs online evaluation",
    company: "Enterprise SaaS · technical screen",
    difficulty: "easy",
    free: true,
    executes: false,
    mode: "text",
    starter: "",
    prompt:
      "Explain the difference between offline and online evaluation of an LLM feature. Give one metric you would track in each setting, and say why you can't rely on offline evals alone before shipping.",
    idealAnswer:
      "Offline evaluation runs your model/prompt/pipeline against a fixed, curated dataset before deployment — you compare outputs to expected behavior with no live users in the loop. It is cheap, reproducible, and ideal as a CI gate; typical metrics are pass rate on a golden set, faithfulness/answer-relevance scores, or exact/semantic match against references. Online evaluation measures behavior in production on real traffic: you sample live traces and score them (often with automated judges or sampled human review) and track product/business signals like user thumbs-up rate, task-completion or resolution rate, escalation/deflection rate, and latency. You can't rely on offline alone because the golden set never covers the true input distribution — real users phrase things you didn't anticipate, prompt-inject, or hit edge cases — and offline scores optimize a proxy, not the business outcome. The mature pattern is both: a lean golden-set gate offline in CI, plus continuous online sampling and metrics to catch drift and the long tail.",
    rubric: [
      "Defines offline eval as a fixed pre-deployment dataset (reproducible, CI-friendly) and online eval as scoring real production traffic.",
      "Gives at least one concrete metric for each (e.g., golden-set pass rate offline; resolution/thumbs-up rate online).",
      "Explains the gap: golden sets don't cover the real input distribution / offline optimizes a proxy.",
      "Concludes that both are needed (gate offline, monitor online).",
    ],
    hints: [
      "Think about what changes between a CI run and a real user typing into the box.",
      "One is reproducible and gates merges; the other catches drift and the long tail.",
    ],
  },
  {
    id: "lop-002",
    category: "llmops",
    level: "mid",
    title: "Build an eval suite from scratch",
    company: "AI platform team",
    difficulty: "medium",
    free: false,
    executes: false,
    mode: "text",
    starter: "",
    prompt:
      "You're asked to stand up the first eval suite for a new customer-support RAG assistant that currently has no tests. Walk through how you'd bootstrap a golden dataset, what you'd measure, and how you'd keep it from going stale.",
    idealAnswer:
      "Start by mining real traffic and tickets rather than inventing inputs: pull a representative sample of actual user questions (stratified across intents, difficulty, and known failure modes), plus a deliberate set of hard/adversarial and out-of-scope cases. Label them — ideally with SMEs writing reference answers or acceptance criteria — to form a golden dataset; even 50–200 well-curated, stratified examples beat thousands of random ones. Measure at two layers: retrieval quality (context precision/recall — did we fetch the right chunks) and generation quality (faithfulness/groundedness, answer relevance, correctness vs reference), plus operational metrics (latency, cost/token, refusal rate). Wire the suite into CI as a regression gate so any prompt, model, or retrieval change must clear a threshold before merge, and version the dataset alongside the code. To fight staleness, treat the golden set as living: continuously sample production traces (especially thumbs-down and escalations), triage new failure modes into the set, and re-validate labels periodically since 'correct' drifts as the product and docs change. Keep the gate lean and deterministic, and use random production sampling for discovery of new failures.",
    rubric: [
      "Bootstraps the golden set from real traffic/tickets, stratified across intents and failure modes (not invented prompts).",
      "Measures retrieval (context precision/recall) AND generation (faithfulness, answer relevance, correctness) plus ops metrics.",
      "Wires evals into CI as a versioned regression gate.",
      "Has an explicit anti-staleness loop: continuously feed production failures (thumbs-down/escalations) back into the set.",
    ],
    hints: [
      "Where do good test cases actually come from — your imagination or your logs?",
      "Separate 'did we retrieve the right thing' from 'did the model use it faithfully'.",
    ],
  },
  {
    id: "lop-003",
    category: "llmops",
    level: "mid",
    title: "The RAG triad",
    company: "Enterprise search vendor",
    difficulty: "medium",
    free: false,
    executes: false,
    mode: "text",
    starter: "",
    prompt:
      "Explain the 'RAG triad' of evaluation metrics. For each, say what it isolates and which component you'd blame when it drops. Name a framework that computes them.",
    idealAnswer:
      "The RAG triad is context relevance, faithfulness (groundedness), and answer relevance — together they localize where a RAG pipeline fails. Context relevance asks whether the retrieved chunks are actually relevant to the question; a low score blames the retriever/index (chunking, embeddings, top-k, reranking). Faithfulness/groundedness asks whether the generated answer's claims are supported by the retrieved context — low faithfulness means the model is hallucinating or ignoring context, i.e. a generation/prompt problem, not a retrieval one. Answer relevance asks whether the response actually addresses the user's question (ignoring correctness) — low here means the model wandered or under-answered. The diagnostic value is that they decouple: high context relevance but low faithfulness points at the generator; low context relevance points at retrieval no matter how good the model is. Ragas is the canonical open-source framework that computes faithfulness, answer relevancy, context precision and context recall (notably with a largely reference-free, LLM-as-judge design); DeepEval and TruLens implement the same triad.",
    rubric: [
      "Names all three: context relevance, faithfulness/groundedness, answer relevance.",
      "Correctly maps each metric to the component it blames (retriever vs generator).",
      "Explains the decoupling/diagnostic value (low faithfulness != low retrieval).",
      "Names a real framework (Ragas, DeepEval, or TruLens).",
    ],
    hints: [
      "One metric is about what you fetched, two are about what the model did with it.",
      "If retrieval is perfect but the answer invents facts, which leg of the triad drops?",
    ],
  },
  {
    id: "lop-004",
    category: "llmops",
    level: "senior",
    title: "Aligning automated evals with human labels",
    company: "Frontier AI lab",
    difficulty: "hard",
    free: false,
    executes: false,
    mode: "text",
    starter: "",
    prompt:
      "Your automated eval (an LLM judge with a rubric) reports 92% pass, but a sampled human review of the same outputs disagrees on a third of them. How do you measure and improve the alignment between your automated metric and human ground truth?",
    idealAnswer:
      "First treat the judge as a classifier to be validated against humans, not as ground truth. Collect a human-labeled set on the same outputs and compute chance-corrected agreement — Cohen's kappa (or Krippendorff's alpha for multiple annotators) — not just raw accuracy, because high base rates inflate naive agreement. Break the disagreement down: is the judge biased toward false positives (passing things humans fail) or false negatives, and is it concentrated in specific slices (long answers, certain intents)? That tells you whether it's a rubric problem or a judge-capability problem. Improve alignment by tightening the rubric into concrete, atomic, example-anchored criteria, adding few-shot calibration examples (including hard negatives), and forcing the judge to cite evidence/reasoning before scoring. Re-measure kappa after each change on a held-out human set. For honest reporting, calibrate the judge against human sensitivity/specificity and apply bias correction with bootstrap confidence intervals rather than reporting the raw 92% as if it were truth. Maintain inter-annotator agreement among the humans too — if humans only agree 80% with each other, no judge can exceed that ceiling, and the rubric itself is ambiguous.",
    rubric: [
      "Validates the judge against human labels using a chance-corrected metric (Cohen's kappa / Krippendorff's alpha), not raw accuracy.",
      "Analyzes disagreement structure (false-positive vs false-negative, sliced) to localize the cause.",
      "Improves via concrete rubric refinement, few-shot calibration, and evidence-before-score; re-measures on held-out humans.",
      "Notes the inter-annotator-agreement ceiling and/or reports calibrated results with confidence intervals rather than the raw 92%.",
    ],
    hints: [
      "Raw agreement % lies when the pass rate is high — what corrects for chance?",
      "If your human labelers only agree 80% with each other, what's the most a judge can hope for?",
    ],
  },
  {
    id: "lop-005",
    category: "llmops",
    level: "mid",
    title: "Regression evals in CI",
    company: "Dev-tools company",
    difficulty: "medium",
    free: false,
    executes: false,
    mode: "text",
    starter: "",
    prompt:
      "A teammate edits a system prompt and the change ships straight to prod with no checks. Design a CI gate that catches LLM quality regressions on prompt/model changes. What tooling and what failure policy?",
    idealAnswer:
      "Make every prompt, model-version, or retrieval-config change run an eval job in CI before merge — the LLM equivalent of a unit-test gate. Use a tool like promptfoo or DeepEval (both have first-class CI/CD integration and GitHub Actions support) to run the candidate config against a versioned golden dataset of inputs with assertions: deterministic checks where possible (regex/JSON-schema/contains) plus rubric-based LLM-judge or metric thresholds (faithfulness, correctness) where outputs are open-ended. The failure policy should gate on aggregate thresholds and on no-regression-vs-baseline: fail the build if the pass rate drops below a floor, if any 'must-never-regress' canary case flips, or if cost/latency exceeds a budget. Because LLM outputs are non-deterministic, pin temperature/seed where you can and either run N samples with a tolerance band or assert on stable properties rather than exact strings to avoid flaky gates. Store eval results as PR artifacts so reviewers see the diff in behavior, and keep the golden set versioned with the code so a prompt change and its expected-behavior update land together.",
    rubric: [
      "Runs evals automatically on prompt/model/config changes as a pre-merge gate.",
      "Names a real CI-integrated tool (promptfoo or DeepEval) and mixes deterministic assertions with metric/judge thresholds.",
      "Defines a concrete failure policy (threshold floor, no-regression-vs-baseline, canary cases, cost/latency budget).",
      "Addresses non-determinism/flakiness (pinned seed/temp, N-sample tolerance, or property-based assertions).",
    ],
    hints: [
      "Treat a prompt change like a code change — what's the equivalent of a failing unit test?",
      "Exact-string asserts on LLM output are flaky; what do you assert on instead?",
    ],
  },
  // ─── LLM-AS-JUDGE & BIASES ────────────────────────────────────────────────────
  {
    id: "lop-006",
    category: "llmops",
    level: "senior",
    title: "Biases in LLM-as-a-judge",
    company: "AI evaluation startup",
    difficulty: "hard",
    free: false,
    executes: false,
    mode: "text",
    starter: "",
    prompt:
      "You use an LLM to pick the better of two responses (pairwise judging). Name the major systematic biases this introduces and one concrete mitigation for each.",
    idealAnswer:
      "Position bias: the judge favors the response in a particular slot (often the first or last) regardless of quality — in pairwise judging, swapping order can flip the verdict and shift accuracy by 10%+. Mitigate by evaluating both orderings and averaging, or only counting a win if it holds in both positions (consistency). Length/verbosity bias: judges reward longer, more elaborate answers even when no better, an artifact of RLHF. Mitigate by controlling for length (instruct the rubric to ignore length, normalize, or penalize unsupported padding) and checking score-vs-length correlation. Self-preference (self-enhancement) bias: a judge rates outputs from its own model family higher — research links this to the judge preferring lower-perplexity, more familiar text. Mitigate by using a different model family as judge than the one being evaluated, or a jury of diverse judges. Other shortcut biases include sycophancy/agreeableness, and bias toward formatting/authority cues. General mitigations: a Panel-of-LLMs ('jury') across model families to dilute correlated blind spots, forcing chain-of-thought/evidence before the score, calibrating against human labels, and reporting bootstrap confidence intervals rather than a single number.",
    rubric: [
      "Identifies position bias and a mitigation (swap order / require consistency across both positions).",
      "Identifies length/verbosity bias and a mitigation (control for or ignore length).",
      "Identifies self-preference bias and a mitigation (use a different model family / jury).",
      "Mentions a general remedy: jury of diverse judges, calibration to humans, or confidence intervals.",
    ],
    hints: [
      "What happens to the verdict if you literally swap which answer is shown first?",
      "Why might GPT-as-judge quietly prefer GPT-written answers?",
    ],
  },
  {
    id: "lop-007",
    category: "llmops",
    level: "senior",
    title: "Scenario: 95% judge score, prod is failing",
    company: "Enterprise SaaS",
    difficulty: "hard",
    free: false,
    executes: false,
    mode: "text",
    starter: "",
    prompt:
      "Your GPT-4-judge eval reports 95% quality on the new assistant, but production users are escalating and churning. What biases or methodology flaws could be hiding the real failure, and how would you get an honest number?",
    idealAnswer:
      "A 95% that doesn't survive contact with users almost always means the eval measured the wrong thing or measured it with a biased instrument. First, distribution mismatch: the eval set isn't representative of live traffic — it's too easy, stale, or missing the adversarial/long-tail and out-of-scope cases users actually send; sample real failing traces and add them. Second, judge bias inflating the score: self-preference (GPT-4 judging GPT-4 output rates it generously), verbosity bias (the assistant pads answers and the judge rewards length), position/leniency bias, and sycophancy — the judge may rate fluent, confident-sounding but wrong answers as good. Third, the rubric measures style/format, not grounded correctness or task success, so confidently-wrong or unhelpful answers pass. Fourth, no calibration to humans: 95% is reported as truth with no agreement check or confidence interval. To get an honest number: re-sample the eval set from production (stratified, including thumbs-down/escalations), switch to a different-family or jury-of-judges to cut self-preference, control for length, force evidence-before-score, calibrate against a human-labeled subset (Cohen's kappa) and report bias-corrected results with bootstrap CIs. Finally, anchor on an online business metric (resolution/escalation rate), since that's the ground truth the offline 95% was supposed to predict.",
    rubric: [
      "Calls out eval-set distribution mismatch (unrepresentative/stale/missing adversarial & long-tail cases).",
      "Names judge biases that inflate the score (self-preference, verbosity, sycophancy/leniency).",
      "Notes the rubric may reward style over grounded correctness/task success, and that 95% was reported without human calibration/CIs.",
      "Prescribes honest re-measurement: prod-sampled set, different-family/jury judge, human calibration with kappa + bootstrap CIs, and anchoring to an online business metric.",
    ],
    hints: [
      "If the judge is the same model family as the assistant, what does it secretly prefer?",
      "Where did the eval inputs come from — and do they look like what real users type?",
    ],
  },
  {
    id: "lop-008",
    category: "llmops",
    level: "senior",
    title: "Reporting judge results honestly",
    company: "AI evaluation startup",
    difficulty: "hard",
    free: false,
    executes: false,
    mode: "text",
    starter: "",
    prompt:
      "Leadership wants a single headline number from your LLM-as-judge eval to put on a dashboard. Explain why a bare point estimate is misleading and how you would report results responsibly.",
    idealAnswer:
      "A bare point estimate hides both statistical and systematic uncertainty. Statistically, eval sets are small and skewed, so the score has real sampling error — you should report a confidence interval, typically a bootstrap 95% CI, so a '92% vs 90%' comparison isn't over-read as a real improvement when the intervals overlap. Systematically, the judge is an imperfect, biased instrument: its number is only meaningful relative to human agreement, so report chance-corrected agreement (Cohen's kappa) against a human-labeled subset and, ideally, a bias-corrected estimate that accounts for the judge's sensitivity/specificity rather than the raw judge pass rate. Use a jury of diverse judges to reduce correlated bias and report inter-judge variance. Slice the number — overall scores hide failures concentrated in specific intents, languages, or input lengths, so report per-slice with their own CIs and flag any regressed canary cases. Be explicit about what the judge measures (e.g., faithfulness, not factual correctness) and version the eval set and judge prompt so the number is reproducible. In short: a calibrated, bias-corrected score with confidence intervals and slices, not a single decimal on a dashboard.",
    rubric: [
      "Explains sampling uncertainty and the need for confidence intervals (bootstrap CIs) so small differences aren't over-read.",
      "Treats the judge as a biased instrument: report agreement with humans (Cohen's kappa) and/or a bias-corrected estimate, not the raw pass rate.",
      "Recommends slicing the metric (per intent/length/language) since aggregates hide concentrated failures.",
      "Mentions reproducibility/scope: version the set & judge prompt, state what the metric actually measures, optionally a jury.",
    ],
    hints: [
      "Is '92% vs 90%' a real win, or could it be noise? What would tell you?",
      "The judge's number only means something relative to what other ground truth?",
    ],
  },
  // ─── OBSERVABILITY ────────────────────────────────────────────────────────────
  {
    id: "lop-009",
    category: "llmops",
    level: "mid",
    title: "Tracing an agentic loop",
    company: "Agent platform",
    difficulty: "medium",
    free: false,
    executes: false,
    mode: "text",
    starter: "",
    prompt:
      "A multi-step agent (plan → call tools → reflect → answer) sometimes returns wrong answers and you can't tell why. What would you instrument to make it debuggable, and what standard would you follow?",
    idealAnswer:
      "Instrument the agent as a tree of spans, one trace per user request, with a span for every LLM call, tool/function call, and retrieval step nested under the parent. Each span should capture inputs and outputs (prompt, rendered context, tool arguments and results), the model and parameters, token counts (input/output), latency, cost, and the finish reason — so you can replay the exact decision the model made at each step and see where the chain went wrong (bad tool args, wrong tool chosen, hallucinated reflection, lost context). Follow the OpenTelemetry GenAI semantic conventions, which standardize attributes like gen_ai.request.model, gen_ai.usage.input_tokens/output_tokens, and gen_ai.response.finish_reasons, plus agent/tool span conventions — this keeps you vendor-neutral and lets you export to any backend. Use an LLM-observability platform that speaks these conventions (Langfuse, LangSmith, Arize Phoenix, Logfire, or Datadog LLM Observability) to view the trace tree, attach evals/scores to spans, and slice by cost/latency. Crucially, propagate a trace/session id end to end so a single trace links all steps of one agent run, and attach feedback (thumbs/eval scores) to traces so failing runs are findable.",
    rubric: [
      "Models the run as a nested span tree (one trace per request; span per LLM call, tool call, retrieval) capturing inputs/outputs.",
      "Captures the right attributes per span: model+params, token counts, latency, cost, finish reason.",
      "Cites OpenTelemetry GenAI semantic conventions (e.g., gen_ai.* attributes) for vendor-neutral standardization.",
      "Names a real LLM-observability backend (Langfuse/LangSmith/Phoenix/Logfire) and notes trace-id propagation + attaching evals/feedback.",
    ],
    hints: [
      "Each tool call and model call is a span — what do you need to log on each to replay the decision?",
      "There's an emerging OTel standard for gen_ai.* attributes — naming it shows maturity.",
    ],
  },
  {
    id: "lop-010",
    category: "llmops",
    level: "mid",
    title: "What to alert on in LLM observability",
    company: "Fintech",
    difficulty: "medium",
    free: false,
    executes: false,
    mode: "text",
    starter: "",
    prompt:
      "You have full tracing on a production LLM app. What signals would you actually set alerts on (vs just dashboard), and why? Give a few with rough thresholds or conditions.",
    idealAnswer:
      "Alert on things that indicate user-facing harm, runaway cost, or a regression — not on every metric. Quality/safety: spike in guardrail blocks, refusal rate, or a drop in online quality score (thumbs-down / automated judge on sampled traffic) versus a rolling baseline; spike in fallback/error or empty-answer rate. Reliability/latency: p95/p99 latency or time-to-first-token breaching SLO, and provider 5xx / rate-limit (429) error rate — these are page-worthy because they break the product. Cost: cost-per-day or cost-per-request anomaly (e.g., >2x the rolling mean), and a sudden jump in average tokens per request, which is the classic signature of an agent looping or a prompt bloating — this catches FinOps blowups early. Volume/abuse: traffic anomalies and a spike in prompt-injection / jailbreak-pattern detections. Set alerts on rates and anomalies (deviation from a baseline) rather than absolute single-event thresholds to avoid noise, route severity appropriately (page on latency/error SLO breach and cost runaway; ticket on slow quality drift), and always keep the rest on dashboards. The key is that you alert on leading indicators of cost and quality regressions, because token/cost and quality drift silently.",
    rubric: [
      "Distinguishes alert-worthy signals (user harm, runaway cost, regression) from dashboard-only metrics.",
      "Covers quality/safety (quality-score drop, refusal/guardrail-block spike), reliability (p95/p99 latency, 429/5xx error rate).",
      "Includes cost signals (cost anomaly, tokens-per-request jump) and ties the latter to agent loops/prompt bloat.",
      "Recommends anomaly/rate-based alerting vs absolute thresholds, with severity routing.",
    ],
    hints: [
      "A sudden jump in average tokens-per-request usually means what is going wrong?",
      "Alert on deviation-from-baseline, not on every single dashboard line.",
    ],
  },
  {
    id: "lop-011",
    category: "llmops",
    level: "senior",
    title: "Scenario: agent cost is 5x projection",
    company: "Enterprise SaaS",
    difficulty: "hard",
    free: false,
    executes: false,
    mode: "text",
    starter: "",
    prompt:
      "Your production agent's bill is 5x what you projected. Using tracing/observability data, walk through how you'd diagnose where the tokens are going and the levers you'd pull.",
    idealAnswer:
      "Diagnose with cost/token attribution from your traces before changing anything. Aggregate spend by span type and step: is it input tokens or output tokens, which model, and which step in the loop? The most common culprits are (1) the agent looping — more steps/tool calls per request than expected, so attribute cost-per-trace and look at the distribution of steps-per-request; (2) context bloat — the full conversation/retrieved context is re-sent on every step, so input tokens grow super-linearly across a multi-turn loop; (3) over-retrieval — top-k too high stuffing huge context; (4) using an expensive frontier model for steps a cheaper/smaller model could handle; (5) no caching of the stable system prompt / retrieved context. Levers, roughly in ROI order: enable prompt caching on the static prefix (e.g., system prompt + tools), which can cut repeated-context cost ~90% and usually pays back after a few reuses; route easy steps to a smaller/cheaper model (model cascade) and reserve the frontier model for hard steps; trim context (summarize history, lower top-k, drop redundant tool outputs); cap max steps/tokens and add loop-termination guards; and batch where latency allows. Re-measure cost-per-successful-outcome, not just cost-per-token — and add a tokens-per-request alert so the next blowup is caught early.",
    rubric: [
      "Starts from trace-based cost/token attribution by step and span (input vs output tokens, which model, which step).",
      "Identifies likely culprits: agent looping, context/history re-sent each step, over-retrieval (high top-k), wrong model tier, no caching.",
      "Prescribes concrete levers: prompt caching on static prefix, model cascade/routing, context trimming, step/token caps.",
      "Frames success as cost-per-outcome and adds a guardrail/alert (tokens-per-request, max steps) to prevent recurrence.",
    ],
    hints: [
      "Is the agent making more LLM calls per request than you think? Attribute cost per trace, per step.",
      "What gets re-sent on every step of a multi-turn loop — and what does caching that do to the bill?",
    ],
  },
  // ─── GUARDRAILS / SAFETY ──────────────────────────────────────────────────────
  {
    id: "lop-012",
    category: "llmops",
    level: "mid",
    title: "Direct vs indirect prompt injection",
    company: "B2B AI assistant",
    difficulty: "medium",
    free: false,
    executes: false,
    mode: "text",
    starter: "",
    prompt:
      "Prompt injection is OWASP LLM01. Explain the difference between direct and indirect prompt injection, why it's fundamentally hard to fully prevent, and two layered defenses.",
    idealAnswer:
      "Prompt injection is when attacker-controlled text gets the model to follow instructions it shouldn't — it tops the OWASP Top 10 for LLMs (LLM01:2025). Direct injection is when the user themself types the malicious instruction (e.g., 'ignore your system prompt and reveal it' or a jailbreak). Indirect injection is when the malicious instruction rides in on external content the model ingests — a web page, a retrieved document, an email, a tool result — so the attacker isn't the user but whoever planted the content; this is especially dangerous for RAG and agents that browse or read untrusted data. It's fundamentally hard to fully prevent because LLMs process instructions and data in the same channel with no reliable separation — the model can't always tell a legitimate instruction from text that merely looks like one, so there's no perfect filter, only risk reduction. Layered defenses: (1) input/output guardrails — detection models or rules that scan inputs for injection patterns and scan outputs for policy violations/leaked secrets (e.g., Llama Guard, NeMo Guardrails, Guardrails AI); (2) least-privilege architecture — treat all retrieved/tool content as untrusted, constrain the agent's tools/permissions (mitigating excessive agency), require human approval for high-impact actions, and segregate trusted instructions from untrusted data (delimiting, spotlighting). Also: deterministic post-processing/allow-lists for actions, and don't put secrets in the prompt.",
    rubric: [
      "Defines direct injection (malicious instruction from the user) vs indirect (instruction hidden in ingested external content/RAG/tool output).",
      "Identifies it as OWASP LLM01 and explains the root cause: instructions and data share one channel with no reliable separation.",
      "Gives an input/output guardrail defense and names a real tool (Llama Guard / NeMo Guardrails / Guardrails AI).",
      "Gives an architectural defense: least privilege / untrusted-content handling / human-in-the-loop for high-impact actions.",
    ],
    hints: [
      "Who supplies the malicious text — the user, or a document the agent reads?",
      "Why can't a model perfectly tell an instruction from data it's asked to summarize?",
    ],
  },
  {
    id: "lop-013",
    category: "llmops",
    level: "senior",
    title: "Scenario: guardrails for a customer-facing bot",
    company: "Consumer fintech",
    difficulty: "hard",
    free: true,
    executes: false,
    mode: "text",
    starter: "",
    prompt:
      "You're designing the guardrail layer for a customer-facing banking chatbot. Categorize which failures are catastrophic vs merely acceptable/annoying, and design controls proportional to that risk.",
    idealAnswer:
      "Triage failures by blast radius, because you can't (and shouldn't) block everything equally. Catastrophic — must be driven near zero with hard controls: leaking another customer's PII or account data (OWASP LLM02 sensitive-information disclosure), executing an unauthorized money movement or account change (excessive agency, LLM06), giving binding incorrect financial/legal advice, or emitting toxic/discriminatory content. Acceptable/annoying — tolerate or degrade gracefully: an over-cautious refusal of a benign question, a slightly verbose or off-tone answer, or a 'let me hand you to a human' fallback. Design controls proportional to risk: for catastrophic categories use defense-in-depth — input rails (PII/injection detection, e.g., Llama Guard or NeMo Guardrails), strict least-privilege tools where any state-changing action (transfer, change of address) is gated behind deterministic auth checks and human/step-up confirmation rather than the model's discretion, output rails that scan for PII leakage and block before display, and grounding so financial answers cite policy and the bot defers to humans when unsure. For low-risk failures, prefer graceful degradation over hard blocks to avoid wrecking UX — log and tune rather than page. Set explicit risk thresholds (false-negative rate near zero for catastrophic, more tolerance for false positives there; the reverse for benign refusals), red-team the catastrophic paths specifically, and keep an audit trail. The principle: spend your strictest, lowest-false-negative controls only where a single failure is unrecoverable.",
    rubric: [
      "Classifies failures into catastrophic (PII leak, unauthorized transactions, harmful advice) vs acceptable (over-refusal, tone, verbosity).",
      "Applies defense-in-depth to catastrophic cases: input+output rails (named tool), and least-privilege/human-confirmation for state-changing actions.",
      "Treats low-risk failures with graceful degradation rather than hard blocks (protect UX), and sets asymmetric false-negative/false-positive tolerances.",
      "Mentions red-teaming the catastrophic paths and an audit trail / proportional-to-risk principle.",
    ],
    hints: [
      "Which single failure can never be undone — a clumsy refusal, or wiring money to the wrong account?",
      "Should a money-transfer action depend on the model's judgment, or on a deterministic auth check?",
    ],
  },
  // ─── MODEL SERVING / DEPLOYMENT ───────────────────────────────────────────────
  {
    id: "lop-014",
    category: "llmops",
    level: "senior",
    title: "vLLM internals: PagedAttention & continuous batching",
    company: "ML infra team",
    difficulty: "hard",
    free: false,
    executes: false,
    mode: "text",
    starter: "",
    prompt:
      "Why does an engine like vLLM achieve far higher throughput than naive HuggingFace generate? Explain PagedAttention, continuous batching, and the KV cache, and what problem each solves.",
    idealAnswer:
      "The bottleneck in LLM serving is GPU memory for the KV cache — the cached keys/values for every token in every active sequence, which grows with sequence length and concurrency and is what limits how many requests you can run at once. Naive serving pre-allocates a contiguous KV block sized to the max sequence length per request, so most of it sits empty; prior systems wasted ~60–80% of KV memory to fragmentation and over-reservation. PagedAttention applies OS virtual-memory paging to the KV cache: it splits each sequence's KV cache into fixed-size blocks mapped through a block table to non-contiguous physical GPU blocks, so memory is allocated on demand and waste drops to under ~4%; it also enables sharing blocks across sequences (e.g., shared prompt prefixes / beam search) via copy-on-write. Continuous (in-flight) batching solves GPU under-utilization from static batching: instead of waiting for the whole batch to finish, the scheduler admits new requests and evicts finished ones at the granularity of each decode step, so the GPU stays saturated and fast requests don't wait behind slow ones. Together these let vLLM pack far more concurrent sequences into the same GPU and keep it busy, yielding roughly 2–4x higher throughput than prior serving systems and up to ~24x over naive HF Transformers at comparable latency. TGI and others now implement the same ideas.",
    rubric: [
      "Identifies the KV cache as the memory bottleneck that caps concurrency, and that naive serving wastes most of it (fragmentation/over-reservation).",
      "Explains PagedAttention as paging the KV cache into non-contiguous fixed-size blocks via a block table, cutting waste to ~4% and enabling prefix sharing.",
      "Explains continuous/in-flight batching: admitting/retiring requests per decode step to keep the GPU saturated (vs static batching).",
      "States the payoff (roughly 2–4x throughput vs prior systems) and notes TGI/others adopted similar techniques.",
    ],
    hints: [
      "What in GPU memory grows with every token and limits how many requests fit at once?",
      "Static batching waits for the slowest request; what does continuous batching change?",
    ],
  },
  {
    id: "lop-015",
    category: "llmops",
    level: "senior",
    title: "Quantization & speculative decoding trade-offs",
    company: "ML infra team",
    difficulty: "hard",
    free: false,
    executes: false,
    mode: "text",
    starter: "",
    prompt:
      "You need to cut serving cost and latency. Explain the trade-offs of FP8 vs INT8 vs INT4 quantization, and how speculative decoding helps — including when it does NOT help.",
    idealAnswer:
      "Quantization shrinks weights (and sometimes activations/KV cache) to fewer bits, reducing memory footprint and bandwidth so you fit bigger models or more concurrency on a GPU and run faster. FP8 is the current sweet spot on modern hardware (H100/H200): with proper calibration it gives sizeable throughput and memory gains over FP16/BF16 with minimal quality loss, and pairs well with other tricks. INT8 (often weight+activation) also serves well with small accuracy loss when calibrated. INT4 is weight-only and widely used to fit 7B–13B models on a single GPU — biggest memory savings, but naive INT4 can cause noticeable accuracy degradation, especially on larger or sensitive workloads, so it needs careful methods (GPTQ/AWQ-style) and per-task validation. The rule: more aggressive quantization = more memory/throughput but more quality risk, so measure quality, don't assume. Speculative decoding uses a small fast draft model to propose several tokens (e.g., 5–8) that the big target model verifies in parallel; since output is identical to the target's distribution, quality is unchanged while latency drops ~2–3x. The catch: it helps most in latency-sensitive, low-batch/memory-bound regimes where decoding is sequential and the GPU is under-utilized; under high-throughput large-batch serving the GPU is already compute-bound, so the extra draft+verify work yields little or can even hurt. It also depends on a high draft acceptance rate — a poorly aligned draft model wastes compute. So: FP8 broadly, INT4 when memory-constrained with validation, and speculative decoding for interactive low-batch latency, not for saturated batch throughput.",
    rubric: [
      "FP8 as the modern sweet spot (minimal quality loss with calibration); INT8 small loss; INT4 weight-only, biggest savings but real accuracy risk needing careful methods/validation.",
      "States the general trade-off: fewer bits = more memory/throughput but more quality risk; measure, don't assume.",
      "Explains speculative decoding: small draft proposes tokens, target verifies in parallel, ~2–3x latency win with unchanged output quality.",
      "Notes when speculative decoding does NOT help: compute-bound high-batch/high-throughput serving, or low draft acceptance rate.",
    ],
    hints: [
      "Going from FP8 to INT4 saves the most memory — what does it cost, and how would you know?",
      "Speculative decoding shines when the GPU is idle waiting on sequential decode; what regime kills that benefit?",
    ],
  },
  {
    id: "lop-016",
    category: "llmops",
    level: "senior",
    title: "Scenario: latency is 500ms at 50 users, design for 500",
    company: "Enterprise SaaS",
    difficulty: "hard",
    free: false,
    executes: false,
    mode: "text",
    starter: "",
    prompt:
      "Your LLM endpoint serves 50 concurrent users at ~500ms p95. Product wants to support 500 concurrent users without latency blowing up. Walk through which levers you'd pull and the trade-offs.",
    idealAnswer:
      "First quantify and decompose: is the constraint throughput (requests/sec the GPUs can sustain) or per-request latency, and within latency is it time-to-first-token (prefill, prompt-length-bound) or inter-token latency (decode, memory-bandwidth-bound)? At 10x load the usual failure is queueing — requests pile up waiting for KV-cache/GPU capacity, so p95 explodes even though single-request compute is unchanged. Levers: (1) Serving engine — if you're on naive HF generate, move to vLLM/TGI to get PagedAttention + continuous batching, which dramatically raises concurrent sequences per GPU; this is often the single biggest win. (2) Horizontal scale-out — add replicas behind a load balancer/autoscaler so capacity grows with QPS; this is the most direct lever for 10x users if you can pay for GPUs. (3) Reduce per-request cost — quantize (FP8) to fit more concurrency per GPU, cap max output tokens, trim/compress prompts, and use prompt caching for shared prefixes to slash prefill. (4) Tier/route — send easy requests to a smaller cheaper model (cascade), reserve the big model for hard ones, lowering average load. (5) Speculative decoding to cut decode latency in the interactive (lower-batch) regime, with the caveat it helps less once batches are large and compute-bound. (6) Stream tokens so perceived latency (TTFT) stays low even if total time rises. The core trade-off is latency vs throughput vs cost: bigger batches and aggressive batching raise throughput but can raise tail latency, so set an SLO (e.g., p95 TTFT and end-to-end), size batch/concurrency to it, and autoscale on queue depth/GPU utilization rather than CPU. Load-test at 500 to validate before shipping.",
    rubric: [
      "Decomposes the problem: throughput vs latency, and TTFT (prefill) vs inter-token (decode); identifies queueing as the 10x failure mode.",
      "Names the serving-engine win (vLLM/TGI: PagedAttention + continuous batching) and horizontal scale-out/autoscaling.",
      "Reduces per-request load: quantization, output-token caps, prompt caching, model cascade/routing, speculative decoding (with its caveat).",
      "Articulates the latency/throughput/cost trade-off, sets an SLO, autoscales on queue depth/GPU util, and load-tests at target.",
    ],
    hints: [
      "At 10x users the math problem is usually queueing, not raw compute — what relieves the queue?",
      "Which single change (engine swap vs more replicas) gives the biggest concurrency win, and what does each cost?",
    ],
  },
  // ─── FINOPS ───────────────────────────────────────────────────────────────────
  {
    id: "lop-017",
    category: "llmops",
    level: "senior",
    title: "Cost-per-outcome vs cost-per-token",
    company: "AI product org",
    difficulty: "medium",
    free: false,
    executes: false,
    mode: "text",
    starter: "",
    prompt:
      "Your manager wants to cut the LLM bill by minimizing cost-per-token. Explain why optimizing cost-per-token can backfire, what 'cost-per-outcome' means, and how prompt caching fits the unit economics.",
    idealAnswer:
      "Cost-per-token is an input metric, not a value metric. If you minimize it blindly — switch to a cheaper/smaller model, trim context, shorten outputs — you can raise retry rates, hallucinations, and failed tasks, so the model has to be re-run or a human cleans up, and your real cost goes up even as the per-token line drops. The right unit is cost-per-outcome (use-case economics): total inference cost divided by the number of outputs that actually achieve the business goal — cost per resolved support ticket, per correctly extracted invoice, per accepted code review. The variant that aligns engineering to value is cost-per-successful-output: total cost divided by outputs that pass your quality gate, so a 'cheaper' change that lowers pass rate shows up as more expensive. Prompt caching fits here: providers let you cache a stable prefix (system prompt, tools, retrieved context) and read it back at a steep discount (e.g., Anthropic cache reads ~90% cheaper than uncached input), with an upfront write fee. So it's a true win only when the cached content is reused enough to amortize the write — break-even is typically just a few reuses, which most production workloads clear easily, but caching content read once actually costs more. Net: instrument cost-per-outcome per trace (Langfuse/Portkey/Datadog), then cache aggressively, route easy traffic to smaller models, and compress prompts — while watching the quality gate so you're optimizing value, not just tokens.",
    rubric: [
      "Explains how minimizing cost-per-token backfires (more retries/hallucinations/failed tasks raise real cost despite lower per-token).",
      "Defines cost-per-outcome / cost-per-successful-output (cost ÷ outputs that pass the quality gate / achieve the business goal).",
      "Explains prompt-caching economics: cheap cached reads (~90% off) but an upfront write fee, so it only pays off above a reuse break-even.",
      "Recommends instrumenting cost-per-outcome per trace plus levers (caching, model routing, compression) gated on quality.",
    ],
    hints: [
      "If a cheaper model doubles the retry rate, did your bill actually go down?",
      "Caching has an upfront write fee — when does caching content read only once cost you more?",
    ],
  },
  // ─── RED-TEAMING ──────────────────────────────────────────────────────────────
  {
    id: "lop-018",
    category: "llmops",
    level: "senior",
    title: "Red-teaming, many-shot jailbreaks & the EU AI Act",
    company: "Regulated enterprise",
    difficulty: "hard",
    free: false,
    executes: false,
    mode: "text",
    starter: "",
    prompt:
      "Define red-teaming for an LLM application and the metric you'd report. Explain the 'many-shot jailbreaking' technique and a defense, and note why adversarial testing is becoming a regulatory requirement.",
    idealAnswer:
      "Red-teaming an LLM app means systematically attacking it with adversarial inputs — jailbreaks, prompt injections, attempts to extract PII or the system prompt, harmful-content elicitation — to find failures before attackers do; it can be manual or automated (tools like promptfoo's red-team, DeepTeam, AutoDAN/Crescendo generators). The headline metric is attack success rate (ASR): the fraction of attack attempts that achieve the harmful objective, ideally reported per attack category and per severity, and tracked over time/model versions. Modern automated jailbreaks reach very high ASR on frontier models in benchmark conditions, so a single number per category matters. Many-shot jailbreaking (Anthropic, NeurIPS 2024) exploits long context windows: the attacker stuffs hundreds of fake dialogue turns in which an 'assistant' complies with harmful requests, conditioning the model in-context to continue the pattern — at ~256 shots it succeeds where a few shots fail, and it generalizes across model families. Defenses: cap or classify/filter context to detect the many-shot pattern, fine-tune/RLHF against it, and add input guardrails that flag repetitive faux-dialogue conditioning (the underlying in-context learning effect can't be fully removed just by a longer context window, so detection + refusal training is key). Regulation: the EU AI Act requires adversarial testing and risk-management evidence for high-risk and GPAI systems (Article 9 risk management; GPAI systemic-risk obligations), so documented red-teaming with ASR results is moving from best practice to a compliance requirement (aligned with NIST AI RMF). The takeaway: red-team continuously, report ASR by category with the artifacts regulators will ask for.",
    rubric: [
      "Defines red-teaming (systematic adversarial testing: jailbreaks, injection, PII/system-prompt extraction) and names attack success rate (ASR) as the metric, reported per category.",
      "Correctly explains many-shot jailbreaking: many faux dialogue turns exploiting long context to condition compliance (Anthropic, ~hundreds of shots).",
      "Gives a real defense (context filtering/classification of the pattern, refusal fine-tuning) and notes it can't be fully removed by context-window changes alone.",
      "Connects to regulation: EU AI Act adversarial-testing/risk-management requirements for high-risk/GPAI (documented evidence), aligned with NIST AI RMF.",
    ],
    hints: [
      "The core red-team number is a rate of successful attacks — broken down by what?",
      "Many-shot jailbreaking abuses the one thing context windows got bigger to allow.",
    ],
  },
];
