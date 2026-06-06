# FieldNotes

A paid interview-prep platform for **Data Engineers and AI Engineers** — built around real questions saved from interview loops, not researched study guides.

- **Two tracks, 10 tools, 3 levels (30 sheets):** Data Engineering (Snowflake, dbt, Airflow, Kafka, Spark, Databricks) and AI Engineering (LLMs & Prompting, RAG & Retrieval, Vector Databases, Agents & Evals).
- **Pricing:** $12 per (tool + level) sheet, $59 full-access bundle (one-time).
- **Differentiators:** the Interviewer's Lens, Red/Green Zone risk ratings, Tool Comparison questions, Simulation Mode with AI grading, a tool×level Switcher (upsell surface), Interview Countdown, Weak-Spot Detection, "I got asked this" social proof, confidence ratings, free-preview questions.
- **Free funnel:** Daily Drill (PWA), multi-tool Job Board with live Greenhouse/Lever/RSS ingestion, Readiness & What-Tool quizzes, Salary Benchmarks.
- **SEO:** 30 programmatic tool×level landing pages, X-vs-Y compare pages, glossary, MDX field-notes blog, Question of the Day, Most-Asked, sitemap/robots/JSON-LD/dynamic OG images.

## Stack

Next.js 14 (App Router) · TypeScript · Tailwind (light default + dark toggle) · Supabase (Auth + Postgres) · Stripe (one-time payments) · Anthropic (simulation grading) · deploy on Vercel.

## Run it locally

The app **builds and runs with zero keys** ("seed mode"): content ships in the bundle, a mock user owns every sheet, and progress persists in `localStorage`. Adding `.env.local` flips each subsystem to live with no code change.

```bash
npm install
npm run dev          # keyless seed mode, http://localhost:3000
# or, to also boot local Supabase (Postgres + Auth) if the Supabase CLI is installed:
npm run dev:full
```

`npm run build` · `npm run typecheck` · `npm run lint`.

## Going live

Copy `.env.example` → `.env.local` and fill in any subset:

- **Supabase** (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) — auth + persisted progress/entitlements. Apply `supabase/schema.sql` then `supabase/seed.sql`.
- **Stripe** (`STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`) — checkout + the webhook that grants entitlements.
- **Anthropic** (`ANTHROPIC_API_KEY`) — Simulation Mode AI grading (falls back to self-rate without it).
- **Jobs** (`JOBS_GREENHOUSE_BOARDS`, `JOBS_LEVER_COMPANIES`, `CRON_SECRET`) — live job ingestion via the daily cron at `/api/jobs/ingest` (configured in `vercel.json`).

## Layout

- `app/(marketing)` — homepage, pricing
- `app/(tools)` — free funnel tools (quizzes, salaries, jobs, daily drill)
- `app/(seo)` — programmatic landing pages, compare, glossary, blog, QotD, most-asked
- `app/(auth)` — magic-link login, paywall
- `app/(dashboard)` — protected cheat-sheet dashboard, question detail, simulation
- `lib/data` — content catalog + seed (source of truth, shipped in bundle)
- `lib/catalog.ts`, `lib/entitlements.ts`, `middleware.ts` — tools/pricing, ownership, paywall
