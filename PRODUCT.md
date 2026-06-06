# FieldNotes — Product Clarification

A single brand, two surfaces, one job: **help senior AI & Data Engineers walk into interview loops ready.**
This doc exists to make the web idea, the mobile idea, and the line between them explicit — so every
future feature decision can be checked against "does this belong on the surface that *trains* or the surface
that *keeps you sharp*?"

---

## 0. One-sentence positioning

> **FieldNotes is interview prep for senior AI & Data Engineering — the web app is where you _train_
> (hands-on, graded, coached); the mobile app is where you _stay sharp and show up ready_ (recall,
> calibration, the interview-week companion).**

Not LeetCode. Not generic SWE prep. Not DataLemur-style SQL grinding. The wedge is **senior-level
judgment in the Data/AI domain** — diagnosing before reaching for the obvious lever, naming the trade-off,
quantifying impact — which is exactly what separates a senior "hire" from a mid "no-hire" in a real loop.

---

## 1. The Web App — "where you train"

**Posture:** lean-forward, at a desk, 30–60 min sessions.
**Job:** build and pressure-test real skill, hands-on, with feedback.

### What it is
A practice **workbench + AI interviewer** across ~22 categories (SQL, Python, PySpark, RAG, agents,
LLM ops, system design, code review, incident debugging, behavioral, admin tracks, and more). It doesn't
just *ask* questions — it lets you **do the work and grades it**:

- **Executable practice** — SQL runs in-browser (DuckDB-WASM) graded on correctness; PySpark runs on a
  Spark runner; Python via Pyodide with assert-based tests; prompts run on a model and are scored by
  assertions + an LLM judge.
- **The AI interviewer** — states-before-it-opens "approach gate," probes your answer with follow-ups,
  applies a rubric, and gives a senior-vs-junior read.
- **Interactive review** — line-anchored comments on code / prompts / eval traces / multi-file PRs, with
  AI follow-ups. ("Review is the future" bet.)
- **Incident debugging** — dropped into a prod incident; read logs/config, query the data, submit a
  root-cause + fix that gets graded.
- **Cheat-sheets & study plans** — JD→tailored sheet (grounded RAG), LeetCode-style structured plans.

### Who it's for
The serious candidate actively preparing who wants to *do reps with feedback*, not just read.

### Monetization
**Web Pro** (subscription) — unlocks the live coding workbench + AI coach. This is the deep, higher-cost
product (real compute, real model calls). Separate from mobile Pro (its own subscription + lifetime).

### The moat
Domain-specific, **graded, hands-on** practice with an interviewer that knows the senior bar. Generic
LLM chat can answer a question; it can't run your PySpark against a reference, grade your eval harness,
or hold a rubric across a follow-up chain.

---

## 2. The Mobile App — "where you stay sharp & show up ready"

**Posture:** lean-back, in your pocket, 2–5 min sessions (commute, couch, morning-of).
**Job:** keep senior answers loaded and ready, and be the companion during the interview week.

### What it is
A free, bundled, **offline** recall + calibration app. Open it → a question, immediately. Swipe through
flip cards (self-rated Again/Got it/Easy, real spaced repetition) and senior-correct-vs-junior-trap MCQs.

### The jobs only mobile can do (its reason to exist)
1. **Spaced recall** — the web teaches the answer once; the app keeps it from fading so it's there in the
   loop. The web has no reason to nag you tomorrow; the app's whole point is tomorrow. (Engine: on-device
   SM-2; the daily session is a real due-driven queue.)
2. **Explain it fully (articulation)** — the senior gap isn't *knowing* OOM, it's *producing* the full
   answer under pressure. **Pillar 1** cards open with teaching-expectancy framing ("a new hire asks you to
   explain…"), force **produce-before-reveal** (answer out loud against a timer; the model answer unlocks
   only after you commit), then reveal the **senior arc** (Symptom → Diagnose → Root cause → Fix → Trade-off
   → Prevent/Quantify) and a **binary rubric** self-check whose completeness — not a vanity rating — feeds
   the scheduler. Self-scored, no on-device AI; the graded version is the web AI-interviewer (the upsell).
3. **Stay current** — Claude/OpenAI/AWS/data-stack ship constantly and there's no easy, retained way to keep
   up. **Pillar 2** is a *retention engine, not a feed*: a daily review queue + a 1–2 card fresh trickle, a
   weekly "This Week" deck, and event drops. Each fresh card uses the same junior-trap/senior-correct schema
   **plus a required source URL and a verify-by expiry** (re-verify or retire — stale facts never resurface).
   The moat vs free newsletters/ChatGPT is retention + senior framing + verification, not the news itself.
4. **The interview week** — Cram mode, company tailoring (JD/keyword re-rank, on-device, no AI), and the
   **debrief loop** — all of which only matter in the days around a real onsite, which is exactly when a
   phone is where you live.

### Core surfaces (built)
Home (role switcher AI/DE/Both · Cram/Maintain · the swipe loop) · Library (16 tracks → categories →
questions; locked Pro categories give one free flagship sample — "windows not walls") · Practice (drill
on demand) · Progress (streak, coverage, debrief history) · Profile (optional sign-in) · Debrief loop ·
Share card · Paywall.

### Monetization — free core, subscribe for *freshness*
> **Single source of truth: [`mobile/PRICING.md`](mobile/PRICING.md).** This section is the *why*; prices live there.

The app is **free** at the core (mobile-market reality: ~95% of App Store apps are free; a paywall-at-the-door
near-zeroes installs, and mobile is also the *funnel* for Web Pro). Free = the full core deck
(302 cards + fundamentals), the daily due-driven session, real streak, articulation scenarios, and a *taste*
of the weekly fresh stream. **You charge for *freshness*** — the continuously-updated "stay current" cards
shipped **every week** — because that's the rare thing worth paying for *and* the one piece with an ongoing
production cost. Because freshness is a **weekly stream** (manual + agent authoring, forever), it is a
*recurring* cost, and recurring cost must be funded by **recurring revenue** → a **Pro subscription**
(monthly/yearly). A **lifetime** one-time unlock exists for people who refuse subscriptions (priced ≈ 2 years
of yearly so it still covers expected tenure). This **reverses** the earlier "one-time unlock + à-la-carte
packs, no subscription" call: a single payment can't honestly fund a forever content-treadmill. Mobile has
**no runtime AI** by design, so the paid mobile tier can't cannibalize **Web Pro** (the AI grader + executable
practice) — that constraint is the moat that lets both monetize.

**Free vs Pro on the *engine* (avoid double-talk).** These are two different jobs, not two schedulers:
- **Spaced review (FREE)** = *timing.* The SM-2 engine computes when each card is due and serves a capped
  daily queue (due cards first, then new, ~15/day). The spacing that makes it stick is **free** — that's the
  habit, and the funnel.
- **Smart scheduling (PRO)** = *prioritization + adaptation on top of timing.* It decides **what to push
  among everything due** and **how hard**: weak-spot targeting (surfaces what you keep missing), adaptive
  difficulty (sessions sit at the edge of your ability), and company/JD-weighted ordering — plus the simple
  lever of **unlimited cards/day** (no ~15 cap). This is the genuinely-Pro layer.
- **Honesty gate:** today only the *card cap* is actually enforced; weak-spot/adaptive, JD decks, and
  most-asked are **not built yet** and are marked "soon" on the paywall — do **not** sell them as live ✓
  until they exist (the demo-ware trap). "Smart scheduling" earns its paywall slot only once the adaptive
  selector ships (build-order item #4).

### What mobile deliberately is NOT
No live workbench. No runtime AI. Not "the website, smaller." Executable problems (SQL/PySpark runners,
code review, incidents) **stay web-only by design** — they don't fit a swipe card and they're the web's job.

---

## 3. The differentiation — web vs mobile

| | **Web (train)** | **Mobile (stay sharp)** |
|---|---|---|
| Posture | Lean-forward, at a desk | Lean-back, in pocket |
| Session | 30–60 min | 2–5 min |
| Core verb | **Do** (build, run, get graded) | **Recall / calibrate** |
| Interaction | Workbench + AI interviewer | Swipe flip cards + MCQ |
| Feedback | Graded, rubric, follow-ups, executes code | Self-rated (spaced repetition) |
| AI | Runtime AI coach (core) | None (bundled, offline) |
| Content | Full interactive problem set | Recall-style Q&A, bundled + OTA |
| Pricing | **Subscription** (Web Pro) | **Free core · Pro subscription (mo/yr) + lifetime unlock** (see `mobile/PRICING.md`) |
| Moment | Whenever you sit down to prep | The interview *week* + daily habit |
| Role in funnel | The deep paid engine | Free top-of-funnel + retention + the interview moment |

**Litmus test for any new feature:** does it need a keyboard, a runner, or live grading? → **web.** Is it a
2-minute thing you'd do on a train to stay ready? → **mobile.** If a feature is "the same as web but smaller,"
it probably shouldn't exist.

---

## 4. How they reinforce each other (the funnel)

- The **mobile app is free** → cheap, broad **top-of-funnel** (App Store discovery + the share card as a
  CAC-reducer, *not* a K-factor growth engine).
- Mobile **retains** casual/employed users (Priya/Dev personas) with a habit, so they're still around when
  they next interview.
- The **serious** users (Maria — interviewing now) convert on mobile Pro *and* graduate to
  **Web Pro** when they want hands-on reps. Web is the deep monetization; mobile widens the mouth of the
  funnel and owns the urgent moment.
- **Shared brain:** both read from the same content source (`lib/data`). Mobile bundles a recall-formatted
  slice and ships updates over-the-air (EAS Update) with no app-store release.

---

## 5. Competitor positioning (why not just…)

- **DataLemur / StrataScratch** — SQL/case grinding. We're senior *judgment* across the whole Data/AI
  stack, not a SQL drill. (Explicitly "not competing with DataLemur.")
- **LeetCode / NeetCode** — generic DS&A. We're domain-specific senior Data/AI, not algorithm puzzles.
- **Anki** — pure recall. We're recall *plus* the senior-vs-junior framing, articulation, company
  tailoring, and the interview-week companion — and (on web) graded hands-on practice Anki can't do.
- **Exponent / interviewing.io** — mock interviews / coaching marketplaces. We're self-serve, always-on,
  domain-deep, and cheap.
- **ChatGPT / generic LLM** — can answer a question, but can't run your PySpark against a reference, hold a
  rubric across a follow-up chain, schedule your spaced review, or tell you what's *actually* asked at a
  company from real debriefs.

---

## 6. Content model

- **Source of truth:** `lib/data` (tools/*.ts Authored Q&A + practice/*.ts interactive problems), authored
  + verified by build-time agents (`question-author` / `answer-verifier`). ~300+ recall Q&A + ~395
  interactive problems.
- **Web** uses the full interactive set directly.
- **Mobile** bundles the **recall-style** Q&A converted to flip/MCQ cards (this pipeline), ships in-app,
  updates via OTA. Interactive problems are referenced as "open in web," never faked as cards.
- **The debrief flywheel** (mobile) feeds an anonymized "most-asked at <company>" list, gated at **20+
  debriefs** so it can never surface one identifiable interview — a data asset neither competitors nor a
  generic LLM has.
- **Fresh content (Pillar 2) pipeline + delivery.** The same build-time agents (`question-author` →
  `answer-verifier`) ingest **first-party changelogs** (Anthropic/Claude, OpenAI, AWS News Blog, Databricks,
  Snowflake, dbt, Spark) on a cadence, author cards extractively, and **hard-verify every model name /
  GA-vs-preview / number / price against the cited source URL** (grounded extractive summarization keeps
  hallucination <2%; an unverified numeric is rejected). Each card carries a `verifyBy` date and is
  re-verified or retired. **How the app knows about new content:** content ships in two offline-first layers —
  (1) a **bundled seed** baked into the binary (works day one, offline), and (2) a **remote manifest** the
  app version-checks on launch (`{ version, freshUrl }`); when the manifest version is newer than the cached
  one, the app downloads the new card set, caches it (AsyncStorage), and merges remote-over-bundled. So
  publishing = author → verify → upload `fresh.json` + bump the manifest version (manual now, cron later) —
  **no app-store release.** (`lib/fresh.ts`, `lib/contentSync.ts`; set `EXPO_PUBLIC_CONTENT_MANIFEST_URL`.)

---

## 7. Open questions to clarify (your call)

1. **Web Pro price point** and whether mobile Pro should bundle any web trial.
2. **Articulation** — we cut the AI grader. Do we ever want a *lightweight* "speak it out loud + self-score
   against a model answer" (no grading model) to lean into the articulation wedge?
3. **Which categories are mobile-eligible** — confirm the recall tracks (done) and whether any interactive
   category should get a read-only "concept card" presence on mobile.
4. **Company tailoring depth** — keyword re-rank only (current), or eventually a richer JD parse?
5. **Cross-surface account** — should one sign-in unify web + mobile entitlements, and is that worth the
   complexity early?

---

*Surfaces change; the split shouldn't. Web trains. Mobile keeps you sharp and gets you in the room ready.*
