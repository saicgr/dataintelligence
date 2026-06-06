import type { ConvItem } from "./types";

/**
 * Claude Development track — CLAUDE.md, slash commands, subagents/skills, hooks,
 * MCP servers, and context engineering as the successor to prompt engineering.
 * Conversational items graded against idealAnswer + rubric. Authored via gen_conv.py.
 *
 * Sources (verified 2025–2026):
 * - https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents
 * - https://www.anthropic.com/engineering/building-agents-with-the-claude-agent-sdk
 * - https://code.claude.com/docs/en/skills
 * - https://code.claude.com/docs/en/hooks
 * - https://code.claude.com/docs/en/security
 */
export const CLAUDE_ITEMS: ConvItem[] = [
  {
    id: "cl-001",
    category: "claude",
    level: "junior",
    title: "What belongs in CLAUDE.md (and what doesn't)",
    company: "AI-forward team",
    difficulty: "easy",
    free: true,
    executes: false,
    mode: "text",
    starter: "",
    prompt:
      "You're onboarding a new repo to Claude Code. What should go into CLAUDE.md, and what should you deliberately keep out of it? Why does this distinction matter?",
    idealAnswer:
      "CLAUDE.md is project memory that Claude Code loads automatically at the start of every session, so it should hold the high-signal, durable facts an agent needs to act correctly: how to build/test/lint, key commands, architecture and directory layout, coding conventions, and any non-obvious gotchas or 'do not touch' rules. It functions as configuration, not documentation — its contents get high priority and are followed more strictly than ordinary chat or file contents. Keep it small (Anthropic-style guidance is roughly under ~200 lines / a few hundred tokens) because everything in it consumes context on every turn and bloat reduces adherence. Deliberately keep OUT: long prose explanations, ad-hoc one-off task notes, secrets/credentials, and large reference material — push those into docs/ and reference them by path, or into skills that load on demand. The distinction matters because context is a finite resource: a tight CLAUDE.md lets the agent onboard fast and behave consistently, while a bloated one wastes tokens and dilutes the instructions that matter.",
    rubric: [
      "Explains CLAUDE.md is auto-loaded project memory / acts as high-priority configuration, not docs",
      "Names concrete contents: build/test/lint commands, architecture/layout, conventions, gotchas",
      "Stresses keeping it small/concise and the token-cost reason (bloat reduces adherence)",
      "Lists what to exclude: secrets, ad-hoc notes, long reference material (move to docs/ or skills)",
    ],
    hints: [
      "Think about what gets read on EVERY session vs. what's only sometimes relevant.",
      "Why would a 1,000-line CLAUDE.md actually hurt the agent?",
    ],
  },
  {
    id: "cl-002",
    category: "claude",
    level: "mid",
    title: "Context engineering vs prompt engineering",
    company: "AI-forward team",
    difficulty: "medium",
    free: true,
    executes: false,
    mode: "text",
    starter: "",
    prompt:
      "Anthropic frames 'context engineering' as the successor to prompt engineering. Explain the difference and why context — not prompt wording — is now the bottleneck for agent reliability.",
    idealAnswer:
      "Prompt engineering is about writing and organizing the instructions you hand the model — finding the right words and phrasing for a mostly single-shot task. Context engineering is broader and iterative: it's curating and maintaining the optimal set of tokens (system instructions, tool definitions, retrieved data, memory, and accumulated message history) that occupy the context window across many turns of an agentic loop. The guiding question shifts from 'what's the best wording?' to 'what configuration of context is most likely to produce the desired behavior?' Context is the bottleneck because it's a finite resource subject to 'context rot' — as the token count grows, attention is spread thin (transformers must model n² pairwise relationships) and the model has fewer parameters tuned for very long-range dependencies, so accuracy degrades. In production, most agent failures are context failures, not model failures: bloated, stale, or irrelevant tokens crowd out the signal. So the job becomes finding the smallest set of high-signal tokens that maximizes the odds of the right outcome — through curation, retrieval, compaction, and memory.",
    rubric: [
      "Defines prompt engineering (wording/instructions) vs context engineering (curating the whole token set across turns)",
      "States the reframe: 'what configuration of context produces the desired behavior'",
      "Explains context as a finite resource / context rot and the attention-degradation reason",
      "Notes most agent failures are context failures, and the goal is the smallest high-signal token set",
    ],
    hints: [
      "Context engineering manages state across many inference turns, not just one prompt.",
      "Why does cramming more into the window eventually make the agent worse?",
    ],
  },
  {
    id: "cl-003",
    category: "claude",
    level: "mid",
    title: "Skill vs slash command: which and when",
    company: "AI-forward team",
    difficulty: "medium",
    free: false,
    executes: false,
    mode: "text",
    starter: "",
    prompt:
      "Your team keeps re-running the same multi-step release workflow. Would you encode it as a slash command or a Skill in Claude Code? Explain the trade-offs and when each is the right tool.",
    idealAnswer:
      "Both package reusable workflow instructions as Markdown that loads into context, but they differ in invocation and richness. A slash command is an explicit, user-initiated entry point — you type /command and it runs only when asked; it's great for situational, reactive, one-off actions that you specifically do NOT want firing automatically (e.g. /compact, or a quick canned prompt). A Skill is a discoverable capability, typically a directory with a SKILL.md plus supporting files/scripts, that Claude can auto-apply when it judges a task relevant, and it can orchestrate richer multi-step processes (and even spawn subagents). For a repeatable multi-step release that should run the same way every time, a Skill is the better fit: it encodes the whole process, bundles helper scripts, and Claude can pull it in with progressive disclosure rather than you manually walking each step. Reserve a slash command for when you want a deterministic, explicit trigger and tight terminal autocomplete, or when the action is reactive and shouldn't auto-trigger. (Note recent versions have converged the two file locations, but the mental model — explicit one-shot vs. auto-applied richer workflow — still guides the choice.)",
    rubric: [
      "Slash command = explicit, user-invoked, good for situational/one-off actions you don't want auto-triggering",
      "Skill = auto-discoverable capability, often a directory with supporting files, for richer repeatable workflows",
      "Picks Skill for the repeatable multi-step release and justifies (bundled scripts, progressive disclosure, consistency)",
      "Notes the trade-off dimension (explicit trigger/autocomplete vs auto-applied orchestration)",
    ],
    hints: [
      "Which one does Claude decide to use on its own, and which one do you trigger by name?",
      "Think about packaging: a single canned prompt vs a folder of instructions + scripts.",
    ],
  },
  {
    id: "cl-004",
    category: "claude",
    level: "senior",
    title: "Set up a long-running data pipeline repo for fast agent onboarding",
    company: "AI-forward team",
    difficulty: "hard",
    free: false,
    executes: false,
    mode: "text",
    starter: "",
    prompt:
      "Set up a Claude Code project for a long-running data pipeline so an agent can onboard quickly and work safely. How do you structure CLAUDE.md plus skills (and anything else) for this?",
    idealAnswer:
      "Start with a lean root CLAUDE.md that gives the agent its bearings fast: a one-paragraph system overview, the directory map (ingestion / transforms / orchestration / tests), the exact build/test/lint/run commands, naming and schema conventions, and explicit guardrails ('never run against prod', 'migrations require X'). Keep it well under a couple hundred lines and treated as high-priority config — push long reference material into docs/ and link by path so it loads only when needed. Use the memory hierarchy: subdirectory CLAUDE.md files (e.g. transforms/CLAUDE.md) carry component-specific rules and load on demand, so the root stays small. Encode recurring multi-step jobs — 'add a new source table', 'backfill a partition', 'run the dbt/Spark test suite and interpret failures' — as Skills (directory + SKILL.md + helper scripts) so they execute consistently with progressive disclosure rather than re-explaining each time. Add hooks for safety/automation (a PreToolUse hook that denies destructive Bash or writes to protected paths; a PostToolUse hook that auto-runs the formatter/tests). Connect read-mostly data sources via trusted MCP servers with least-privilege, env-var credentials. The whole point is context engineering at the repo level: small, high-signal, just-in-time — so the agent gets the smallest set of high-signal tokens to act correctly without you re-onboarding it every session.",
    rubric: [
      "Lean root CLAUDE.md: overview, directory map, exact commands, conventions, explicit guardrails",
      "Uses the memory hierarchy (subdirectory CLAUDE.md loading on demand) + docs/ references to keep root small",
      "Encodes recurring multi-step pipeline jobs as Skills with supporting scripts (consistent, progressive disclosure)",
      "Adds safety automation (hooks denying destructive ops / running tests) and least-privilege MCP for data access",
    ],
    hints: [
      "What does the agent need on every session vs. only when touching one component?",
      "Recurring jobs → Skills; safety/automation → hooks; data access → MCP.",
    ],
  },
  {
    id: "cl-005",
    category: "claude",
    level: "senior",
    title: "Subagent vs a longer prompt",
    company: "AI-forward team",
    difficulty: "hard",
    free: false,
    executes: false,
    mode: "text",
    starter: "",
    prompt:
      "When would you delegate to a subagent instead of just writing a longer, more detailed prompt to the main agent? How do you scope a subagent task, and when do you run subagents in parallel vs sequentially?",
    idealAnswer:
      "Reach for a subagent when the work would otherwise flood the main context with tokens you don't need to keep — broad searches, reading many files, exploratory research — or when a task is independent enough to isolate. A subagent runs with its own clean context window, does focused work, and returns only a condensed summary, which protects the main agent from context rot and keeps its window high-signal. A longer prompt just makes the main context bigger, which beyond a point degrades attention and reliability; it's the right move only when the extra detail is genuinely needed on every subsequent turn. Scope a subagent like a contract: give it a single clear objective, the minimal context/tools it needs, and a tight spec for what to return (the summary/artifact, not the raw trace). Run subagents in parallel when the subtasks are independent and you want speed and isolated search contexts (e.g. investigate three modules at once); run them sequentially when one's output feeds the next or they share state. Don't over-delegate — subagents add coordination overhead and a summarization handoff, so use them where context isolation or parallelism is genuinely valuable, not as a default for every request.",
    rubric: [
      "Subagent isolates context: own clean window, returns a condensed summary, protects main context from rot",
      "Contrasts with longer prompt (just enlarges main context, degrades attention) — detail only if needed every turn",
      "Scoping: single clear objective, minimal context/tools, explicit return spec (summary/artifact not raw trace)",
      "Parallel for independent subtasks (speed/isolation) vs sequential when output feeds the next; warns against over-delegating",
    ],
    hints: [
      "What happens to the main agent's window when it reads 40 files itself vs. delegating that?",
      "Independent subtasks → parallel; dependent/chained → sequential.",
    ],
  },
  {
    id: "cl-006",
    category: "claude",
    level: "mid",
    title: "Agent keeps losing context across a long task",
    company: "AI-forward team",
    difficulty: "medium",
    free: false,
    executes: false,
    mode: "text",
    starter: "",
    prompt:
      "Your agent is working a long, multi-hour task and keeps 'forgetting' earlier decisions and drifting. What context-engineering techniques do you apply to fix this?",
    idealAnswer:
      "This is the classic long-horizon problem: the conversation outgrows the window and earlier high-value context gets pushed out or drowned out (context rot). Apply the long-horizon toolkit. First, compaction: periodically summarize the conversation so far and reinitialize a fresh window from that summary — the skill is choosing what to keep (decisions, constraints, open TODOs) versus discard (verbose tool dumps). Second, structured note-taking / agentic memory: have the agent persist key decisions, progress, and a running plan to a durable store (files/memory) outside the window, then re-read them when needed, so state survives compaction. Third, just-in-time retrieval: stop pre-loading everything; keep lightweight identifiers (paths, IDs) and pull full content into context only when a step needs it. Fourth, sub-agent decomposition: push wide searches and exploration into subagents that return condensed summaries, keeping the main thread lean. Underlying all of it: curate the window to the smallest set of high-signal tokens, and design tools to return compact results rather than dumping 50k tokens of output. Together these keep the durable signal (goals, decisions, plan) resident while transient detail flows in and out.",
    rubric: [
      "Identifies the cause as context window overflow / context rot on a long horizon",
      "Compaction: summarize-and-reinitialize, choosing what to keep vs discard",
      "Persistent note-taking / agentic memory outside the window + re-reading it",
      "Adds just-in-time retrieval and/or subagent decomposition; curate to smallest high-signal token set",
    ],
    hints: [
      "Think summarize-and-restart, write-notes-to-disk, and load-on-demand.",
      "Where can durable decisions live so they survive a context reset?",
    ],
  },
  {
    id: "cl-007",
    category: "claude",
    level: "mid",
    title: "Claude Code hooks for safe automation",
    company: "AI-forward team",
    difficulty: "medium",
    free: false,
    executes: false,
    mode: "text",
    starter: "",
    prompt:
      "Explain Claude Code hooks. Name the main lifecycle events and give a concrete example of using a hook to enforce safety or automate a workflow.",
    idealAnswer:
      "Hooks are user-defined handlers (shell commands, or HTTP/LLM handlers in newer versions) that Claude Code runs automatically at fixed points in its lifecycle, so behavior is deterministic and policy-enforced rather than left to the model's discretion. The events fall into cadences: once per session (SessionStart, SessionEnd), once per turn (UserPromptSubmit, Stop), and on every tool call inside the agentic loop (PreToolUse, PostToolUse). PreToolUse is the enforcement point — it runs before a tool executes and can block it (a non-zero/exit-code-2 or deny signal stops the action), which is how you implement security gates: e.g. deny any Bash matching destructive patterns (rm -rf, dropping a prod table) or any write to protected paths or .env. PostToolUse runs after a tool succeeds and sees both the input and the result, ideal for automation: auto-format and run tests after every file edit, or log the change for audit. SessionStart can inject fresh context (current branch, ticket) at the top of the session. For safety: keep hooks least-privilege and reviewed (they run real commands), prefer deny-by-default for risky operations, and treat the PreToolUse gate as your hard boundary the model cannot talk its way past.",
    rubric: [
      "Defines hooks as auto-run lifecycle handlers that make behavior deterministic/policy-enforced",
      "Names lifecycle events incl. PreToolUse and PostToolUse (and ideally session/turn events)",
      "PreToolUse can BLOCK a tool call — concrete safety example (deny destructive Bash / protected-path writes)",
      "PostToolUse automation example (format/test/audit after edits) and a safety caution (hooks run real commands)",
    ],
    hints: [
      "Which event fires BEFORE a tool runs and can veto it?",
      "Per-session vs per-turn vs per-tool-call cadences.",
    ],
  },
  {
    id: "cl-008",
    category: "claude",
    level: "senior",
    title: "Connecting MCP servers in Claude Code — and securing them",
    company: "AI-forward team",
    difficulty: "hard",
    free: false,
    executes: false,
    mode: "text",
    starter: "",
    prompt:
      "You want Claude Code to query an internal database and a ticketing system via MCP servers. How does MCP fit in, and what security controls do you put in place before turning it on?",
    idealAnswer:
      "MCP (Model Context Protocol) is the open standard that lets Claude Code connect to external tools and data through servers that expose tools/resources; you register the DB and ticketing servers and the agent can call them as tools within its loop, which is how it reaches systems beyond the local repo. The risk is that you're handing an autonomous agent live access to internal systems, so security comes first. Prefer servers you write or from providers you trust — Anthropic lists connectors against criteria but does not security-audit third-party MCP servers. Apply least privilege: scope credentials to read-only where possible (especially the database), use short-lived tokens or service-level auth like IAM roles rather than long-lived secrets, and pass them via environment variables, never hardcoded. Harden the tool schemas as a defense line — enums instead of free strings, branded/validated IDs, and host allow-lists for any URL params — so the agent can't be coaxed into arbitrary calls (prompt-injection from tool results is a real threat). Add deny rules and a PreToolUse hook to block dangerous operations, keep audit logging with redaction so every call is reconstructable, and run in a sandbox/dev-container with bypass-permissions disabled outside isolation. Net: connect through trusted, least-privilege MCP servers with tight schemas, env-var/short-lived creds, and audited, gated execution.",
    rubric: [
      "Explains MCP as the standard for connecting Claude Code to external tools/data via servers exposing tools/resources",
      "Trust posture: prefer self-written/trusted servers; Anthropic does not security-audit third-party MCP servers",
      "Least privilege: read-only/scoped creds, short-lived tokens or IAM, secrets via env vars not hardcoded",
      "Hardening: strict tool input schemas (enums/allow-lists), deny rules/hooks, audit logging, sandbox/least permissions; notes prompt-injection risk",
    ],
    hints: [
      "Who vouches for a third-party MCP server's safety? (Hint: not necessarily Anthropic.)",
      "Think credentials scope, schema validation, and a blocking hook.",
    ],
  },
  {
    id: "cl-009",
    category: "claude",
    level: "mid",
    title: "The Claude Agent SDK and the agentic loop",
    company: "AI-forward team",
    difficulty: "medium",
    free: false,
    executes: false,
    mode: "text",
    starter: "",
    prompt:
      "What is the Claude Agent SDK, and what does it give you over calling the model API directly? Describe the agentic loop it runs.",
    idealAnswer:
      "The Claude Agent SDK (the renamed/evolved Claude Code SDK, available in Python and TypeScript) packages the same harness that powers Claude Code — the agent loop, a set of built-in tools, and context management — so you can build custom agents programmatically. The key advantage over calling the messages API directly is that the SDK runs the tool-use loop for you: with the raw API you implement the loop yourself (send messages, detect tool_use, execute the tool, feed back tool_result, repeat), whereas the SDK handles that orchestration and ships built-in tools (read/write files, run Bash, glob/grep, web search/fetch) referenced by name rather than hand-defined JSON schemas. The agentic loop is the gather-context → take-action → verify-work → repeat cycle: the agent pulls in the context it needs, calls a tool to act, observes the result and checks its work, then iterates until the task is done. The design principle is 'give the agent a computer' — let it use tools the way a human would — while the SDK also brings the context-management and (in supported setups) subagent/memory machinery so your agent stays reliable over long tasks instead of you rebuilding all of that.",
    rubric: [
      "Identifies the Agent SDK as the Claude Code harness (loop + built-in tools + context mgmt), Python/TS",
      "Key win over raw API: the SDK runs the tool-use loop for you instead of hand-coding it",
      "Describes the loop: gather context → take action (tool call) → verify → repeat until done",
      "Notes built-in tools by name and/or the 'give the agent a computer' design principle",
    ],
    hints: [
      "What do you have to write yourself with the bare messages API that the SDK handles?",
      "gather → act → verify → repeat.",
    ],
  },
  {
    id: "cl-010",
    category: "claude",
    level: "senior",
    title: "Designing tools so the agent uses them correctly",
    company: "AI-forward team",
    difficulty: "hard",
    free: false,
    executes: false,
    mode: "text",
    starter: "",
    prompt:
      "An agent you built keeps picking the wrong tool and its context fills with huge tool outputs. From a context-engineering standpoint, how do you redesign the toolset?",
    idealAnswer:
      "Both symptoms are tool-design failures. For wrong-tool selection: the rule of thumb is that if a human engineer can't definitively say which tool to use in a situation, the agent can't either — so prune and disambiguate. Keep the toolset small and self-contained, give each tool an unambiguous name and a crisp description of exactly when to use it, and eliminate overlapping tools that create ambiguous choices; consolidate where two tools do nearly the same thing. For context bloat from huge outputs: tools should return the smallest high-signal result, not raw dumps — page or filter results, return identifiers/summaries the agent can expand on demand (just-in-time retrieval) instead of 50k-token blobs, and make outputs robust to error with clear messages so the agent doesn't retry blindly. Also constrain inputs with tight schemas (enums, validated IDs) so calls are well-formed. The unifying principle is context engineering: every token a tool injects competes for the model's attention, so design tools to be clear about their purpose and economical in what they put back into the window — find the smallest set of high-signal tokens that gets the job done.",
    rubric: [
      "Wrong-tool fix: small, non-overlapping toolset; the 'if a human can't pick, the agent can't' heuristic; clear names/descriptions of when to use",
      "Context-bloat fix: tools return compact/high-signal results (paginate/filter/summaries) instead of huge dumps",
      "Just-in-time retrieval — return identifiers/handles the agent expands on demand",
      "Frames it as context engineering: tools robust/clear, tight input schemas, smallest high-signal token footprint",
    ],
    hints: [
      "If you can't tell which of two tools to use, neither can the agent.",
      "A tool that returns 50k tokens is a context problem — what should it return instead?",
    ],
  },
  {
    id: "cl-011",
    category: "claude",
    level: "senior",
    title: "Just-in-time vs pre-loaded retrieval for an agent",
    company: "AI-forward team",
    difficulty: "hard",
    free: false,
    executes: false,
    mode: "text",
    starter: "",
    prompt:
      "When designing how an agent gets data into context, when do you pre-load (pre-inference retrieval) versus let it pull data just-in-time? What's the trade-off and is there a middle ground?",
    idealAnswer:
      "Pre-inference retrieval fetches and stuffs the relevant data into context up front (classic RAG-style): it's fast at runtime and predictable, but you pay tokens for everything you load — including material the agent never needs — which bloats the window and risks context rot, and you have to guess correctly what's relevant before the task starts. Just-in-time retrieval flips it: the agent holds lightweight identifiers (file paths, record IDs, links) and uses tools to load full content into context only at the moment a step needs it, mirroring human cognition and progressive discovery. The trade-off is latency and tool-call overhead and the risk of the agent not fetching something it should — in exchange for a leaner, higher-signal window and the ability to explore data it couldn't have anticipated. The middle ground, which Anthropic explicitly endorses, is hybrid: pre-load a small amount of stable, always-needed context (the high-confidence essentials) for speed, while leaving the long tail to autonomous just-in-time loading. Choose based on how predictable and bounded the needed data is — bounded and known → pre-load; large, branching, or exploratory → just-in-time; most real agents → hybrid.",
    rubric: [
      "Pre-load: fast/predictable but pays tokens for everything and risks bloat / wrong upfront guess",
      "Just-in-time: lightweight identifiers, load full content on demand at runtime (progressive discovery)",
      "States the trade-off (latency/tool overhead/missed fetch vs leaner high-signal window)",
      "Recommends a hybrid middle ground and ties the choice to predictability/boundedness of the data",
    ],
    hints: [
      "Do you carry the whole filing cabinet, or just the labels and open a drawer when needed?",
      "Anthropic recommends a blend — pre-load the stable essentials, fetch the rest on demand.",
    ],
  },
  {
    id: "cl-012",
    category: "claude",
    level: "mid",
    title: "Structure the CLAUDE.md system prompt to the 'Goldilocks' altitude",
    company: "AI-forward team",
    difficulty: "medium",
    free: false,
    executes: false,
    mode: "text",
    starter: "",
    prompt:
      "Anthropic talks about writing instructions at the right 'altitude' — the Goldilocks zone. Critique these two failure modes and describe what good system instructions look like: (a) a brittle prompt full of hardcoded if/else logic for every case, and (b) a vague prompt that assumes shared context.",
    idealAnswer:
      "The 'altitude' idea is that instructions should sit at the right level of abstraction — the Goldilocks zone: specific enough to steer behavior reliably, yet flexible enough to act as strong heuristics rather than a rigid script. Failure mode (a), brittle hardcoded if/else logic enumerating every case, is too low-altitude: it's fragile, can't generalize to situations you didn't foresee, balloons the token count, and becomes a maintenance burden — you're trying to program the model instead of guiding it. Failure mode (b), the vague prompt, is too high-altitude: it assumes shared context the model doesn't have and gives no concrete signal, so behavior is unpredictable. Good instructions live in between: a minimal set of clear, well-organized guidance — use distinct sections with Markdown headers or XML tags, state the expected behavior and the heuristics/principles to apply, give a few canonical examples rather than exhaustive rules, and trust the model to handle the long tail. The aim is the minimal set of information that fully outlines the desired behavior — the smallest high-signal prompt that reliably produces it, which is the same context-engineering discipline applied to the system prompt itself.",
    rubric: [
      "Explains 'altitude'/Goldilocks: specific enough to guide, flexible enough to act as strong heuristics",
      "Critiques (a) hardcoded logic as too low/brittle: fragile, doesn't generalize, bloated, hard to maintain",
      "Critiques (b) vague prompt as too high: assumes shared context, gives no concrete signal, unpredictable",
      "Good = minimal, organized (headers/XML sections), heuristics + a few examples; smallest set fully outlining behavior",
    ],
    hints: [
      "Too rigid scripts the model; too vague leaves it guessing — aim between.",
      "Organize with clear sections and give principles + a few examples, not an exhaustive rulebook.",
    ],
  },
];
