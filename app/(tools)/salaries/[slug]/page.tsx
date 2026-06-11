import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSalaryBySlug, salarySlug } from "@/lib/data";
import { TOOLS, LEVELS, TOOL_BY_SLUG, LEVEL_NAMES } from "@/lib/catalog";
import type { Level } from "@/lib/types";
import { SalaryTable } from "@/components/tools/SalaryTable";
import { ButtonLink } from "@/components/ui/Button";
import { fmtMoney } from "@/lib/utils";

interface Params {
  slug: string;
}

/** Resolve a salary slug back to its (tool, level), if it matches a known combo. */
function resolveSlug(slug: string): { tool: string; level: Level } | null {
  for (const t of TOOLS) {
    for (const l of LEVELS) {
      if (salarySlug(t.slug, l.slug) === slug) {
        return { tool: t.slug, level: l.slug };
      }
    }
  }
  return null;
}

export function generateStaticParams(): Params[] {
  const out: Params[] = [];
  for (const t of TOOLS) {
    for (const l of LEVELS) {
      out.push({ slug: salarySlug(t.slug, l.slug) });
    }
  }
  return out;
}

export function generateMetadata({
  params,
}: {
  params: Params;
}): Metadata {
  const resolved = resolveSlug(params.slug);
  if (!resolved) return { title: "Salary | ByteShards" };
  const tool = TOOL_BY_SLUG[resolved.tool];
  const levelName = LEVEL_NAMES[resolved.level];
  const title = `What does a ${levelName} ${tool?.name ?? resolved.tool} Engineer earn in 2026?`;
  return {
    title: `${title} | ByteShards`,
    description: `2026 salary benchmark for ${levelName} ${
      tool?.name ?? resolved.tool
    } Engineers — min, median and max total compensation across regions.`,
  };
}

export default function SalaryDetailPage({ params }: { params: Params }) {
  const rows = getSalaryBySlug(params.slug);
  if (!rows.length) notFound();

  const resolved = resolveSlug(params.slug);
  const tool = resolved ? TOOL_BY_SLUG[resolved.tool] : undefined;
  const levelName = resolved ? LEVEL_NAMES[resolved.level] : "";
  const toolName = tool?.name ?? rows[0].role;

  const medians = rows.map((r) => r.median).sort((a, b) => a - b);
  const median = medians[Math.floor(medians.length / 2)];
  const currency = rows[0].currency;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-extrabold tracking-tight text-fg sm:text-4xl">
        What does a {levelName} {toolName} Engineer earn in 2026?
      </h1>
      <p className="mt-4 text-muted">
        A {levelName.toLowerCase()} {toolName} Engineer earns a median of{" "}
        <strong className="text-fg">{fmtMoney(median, currency)}</strong> in
        2026, with regional ranges shown below. {tool?.blurb ?? ""} Pay scales
        with depth on the hard trade-offs — exactly what the interview probes
        for.
      </p>

      <div className="mt-8">
        <SalaryTable rows={rows} />
      </div>

      {resolved && (
        <div className="mt-10 rounded-xl border border-border bg-surface p-6 text-center">
          <p className="font-semibold text-fg">
            Want to land at the top of that range?
          </p>
          <p className="mt-1 text-sm text-muted">
            Prep the questions they actually ask {levelName.toLowerCase()}{" "}
            {toolName} engineers.
          </p>
          <div className="mt-4">
            <ButtonLink
              href={`/interview-questions/${resolved.tool}/${resolved.level}`}
              variant="amber"
            >
              See {toolName} interview questions →
            </ButtonLink>
          </div>
        </div>
      )}
    </div>
  );
}
