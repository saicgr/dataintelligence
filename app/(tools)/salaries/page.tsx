import type { Metadata } from "next";
import Link from "next/link";
import { getSalaries, salarySlug } from "@/lib/data";
import { TOOLS, TOOL_BY_SLUG, LEVELS, LEVEL_NAMES } from "@/lib/catalog";
import type { Level, SalaryBenchmark } from "@/lib/types";
import { Card } from "@/components/ui/Card";
import { fmtMoney } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Data & AI Engineering Salaries (2026) | FieldNotes",
  description:
    "2026 salary benchmarks for Data & AI Engineers by tool and level — Snowflake, dbt, Airflow, Kafka, Spark, Databricks, LLMs, RAG, vector DBs and agents.",
};

/** Median across all regions for a (tool, level) role, or null. */
function medianFor(rows: SalaryBenchmark[]): { median: number; currency: string } | null {
  if (!rows.length) return null;
  const sorted = [...rows].sort((a, b) => a.median - b.median);
  const mid = sorted[Math.floor(sorted.length / 2)];
  return { median: mid.median, currency: mid.currency };
}

export default function SalariesIndexPage() {
  const all = getSalaries();

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-3xl font-extrabold tracking-tight text-fg sm:text-4xl">
        Data &amp; AI Engineering Salaries (2026)
      </h1>
      <p className="mt-3 max-w-2xl text-muted">
        Median total compensation by tool and seniority, refreshed for 2026.
        Pick a role to see the full range across regions.
      </p>

      <div className="mt-8 space-y-8">
        {TOOLS.map((tool) => {
          const toolRows = all.filter((s) => s.toolSlug === tool.slug);
          if (!toolRows.length) return null;
          return (
            <section key={tool.slug}>
              <h2 className="mb-3 flex items-center gap-2 text-xl font-bold text-fg">
                <span className="text-2xl">{tool.icon}</span>
                {tool.name} Engineer salaries
              </h2>
              <div className="grid gap-3 sm:grid-cols-3">
                {LEVELS.map((lvl) => {
                  const rows = toolRows.filter((s) => s.level === lvl.slug);
                  const m = medianFor(rows);
                  const slug = salarySlug(tool.slug, lvl.slug as Level);
                  return (
                    <Link key={lvl.slug} href={`/salaries/${slug}`}>
                      <Card className="h-full transition-colors hover:border-navy">
                        <div className="text-sm font-semibold text-muted">
                          {LEVEL_NAMES[lvl.slug as Level]} {tool.name} Engineer
                        </div>
                        <div className="mt-1 text-2xl font-extrabold text-fg">
                          {m ? `${fmtMoney(m.median, m.currency)}` : "—"}
                        </div>
                        <div className="mt-1 text-xs text-muted">
                          median · {lvl.years}
                        </div>
                      </Card>
                    </Link>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      <p className="mt-10 text-sm text-muted">
        Figures are blended market estimates for {TOOL_BY_SLUG.snowflake?.name}{" "}
        and other tooling, 2026. Use them as a negotiation anchor, not gospel.
      </p>
    </div>
  );
}
