import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/Button";
import { CheatSheetCatalog } from "@/components/marketing/CheatSheetCatalog";
import { BUNDLE_PRICE, TOOLS } from "@/lib/catalog";

export const metadata: Metadata = {
  title: "Cheat Sheets — real interview questions for every data & AI tool",
  description:
    "Browse all ByteShards cheat sheets: Snowflake, dbt, Airflow, Kafka, Spark, Databricks, LLMs, RAG, vector DBs, agents, SQL, Python and more — across Junior, Mid and Senior. One-time price unlocks them all.",
};

export default function CheatSheetsPage() {
  return (
    <div className="px-4 py-16">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber">
            Cheat Sheets · read the real questions
          </p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight text-fg sm:text-5xl">
            Every tool. Every level.
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-muted">
            {TOOLS.length} tools across Data Engineering, AI Engineering and Core Skills — each with
            Junior, Mid and Senior answers, the Interviewer&apos;s Lens and red/green-zone cues. One
            one-time {BUNDLE_PRICE} unlocks all of them.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <ButtonLink href="/buy?bundle=1" variant="amber" size="lg">
              Get all cheat sheets — {BUNDLE_PRICE}
            </ButtonLink>
            <ButtonLink href="/pricing" variant="outline" size="lg">
              Compare with Practice
            </ButtonLink>
          </div>
        </div>

        {/* Searchable catalog */}
        <div className="mt-14">
          <CheatSheetCatalog />
        </div>

        {/* Footer CTA */}
        <div className="mt-16 rounded-2xl border border-amber/40 bg-card p-8 text-center shadow-lift">
          <h2 className="text-2xl font-bold tracking-tight text-fg">Stop guessing which sheet to buy</h2>
          <p className="mx-auto mt-2 max-w-xl text-muted">Get the whole library and every future update for one one-time {BUNDLE_PRICE}.</p>
          <ButtonLink href="/buy?bundle=1" variant="amber" size="lg" className="mt-6">
            Get all cheat sheets — {BUNDLE_PRICE}
          </ButtonLink>
        </div>
      </div>
    </div>
  );
}
