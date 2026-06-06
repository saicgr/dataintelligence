import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getComparisonQuestions } from "@/lib/data";
import type { Question } from "@/lib/types";
import { TOOL_BY_SLUG } from "@/lib/catalog";
import { Card } from "@/components/ui/Card";
import { ButtonLink } from "@/components/ui/Button";
import { CompareTable } from "@/components/seo/CompareTable";
import { JsonLd, qaPageJsonLd } from "@/components/seo/JsonLd";

/** Slug for a comparison: tools lowercased, spaces→'-', joined with '-vs-'. */
function compareSlug(tools: string[]): string {
  return tools
    .map((t) => t.toLowerCase().replace(/\s+/g, "-"))
    .join("-vs-");
}

function stripMarkdown(s: string): string {
  return s
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/^[-*]\s+/gm, "")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

/** Map a tool display name to its catalog slug (for sheet CTA links). */
function toolSlugFromName(name: string): string | null {
  const lc = name.toLowerCase();
  for (const t of Object.values(TOOL_BY_SLUG)) {
    if (t.name.toLowerCase() === lc || t.slug === lc) return t.slug;
  }
  return null;
}

function findQuestion(slug: string): Question | null {
  for (const q of getComparisonQuestions()) {
    if (q.comparisonTools && compareSlug(q.comparisonTools) === slug) return q;
  }
  return null;
}

interface Params {
  params: { slug: string };
}

export function generateStaticParams() {
  const seen = new Set<string>();
  const out: { slug: string }[] = [];
  for (const q of getComparisonQuestions()) {
    if (!q.comparisonTools) continue;
    const slug = compareSlug(q.comparisonTools);
    if (seen.has(slug)) continue;
    seen.add(slug);
    out.push({ slug });
  }
  return out;
}

export function generateMetadata({ params }: Params): Metadata {
  const q = findQuestion(params.slug);
  if (!q || !q.comparisonTools) return {};
  const [a, b] = q.comparisonTools;
  const title = `${a} vs ${b} (2026): which to choose`;
  const description = `${a} vs ${b} — the interview-grade comparison: trade-offs, when to pick each, and what an interviewer is actually listening for.`;
  return { title, description, openGraph: { title, description } };
}

export default function ComparePage({ params }: Params) {
  const q = findQuestion(params.slug);
  if (!q || !q.comparisonTools) notFound();

  const [a, b] = q.comparisonTools;
  const faq = qaPageJsonLd([
    { q: q.questionText, a: stripMarkdown(q.answerStructured) },
  ]);

  const paragraphs = q.explanationDeep
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  const ctaTools = q.comparisonTools
    .map((name) => ({ name, slug: toolSlugFromName(name) }))
    .filter((t): t is { name: string; slug: string } => Boolean(t.slug));

  return (
    <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <JsonLd data={faq} />

      <h1 className="text-3xl font-bold tracking-tight text-fg sm:text-4xl">
        {a} vs {b} <span className="text-muted">(2026)</span>
      </h1>
      <p className="mt-4 text-lg text-muted">
        Which would you choose and why — the cross-tool question that quietly
        decides senior loops. Here&apos;s the framing that signals you&apos;ve
        actually run both.
      </p>

      <div className="mt-10">
        <CompareTable question={q} />
      </div>

      <div className="mt-8 rounded-xl border border-amber/30 bg-amber/10 p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-amber">
          Interviewer&apos;s lens
        </p>
        <p className="mt-2 text-sm text-fg">{q.interviewerLens}</p>
      </div>

      {paragraphs.length > 0 && (
        <section className="mt-8 space-y-4">
          {paragraphs.map((p, i) => (
            <p key={i} className="leading-relaxed text-fg">
              {p}
            </p>
          ))}
        </section>
      )}

      <Card className="mt-10 bg-navy text-white" as="section">
        <h2 className="text-xl font-bold">Prep both sides properly</h2>
        <p className="mt-2 text-sm text-white/80">
          Get the full question sheets for {a} and {b} — every question, answer
          and interviewer&apos;s lens.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          {ctaTools.map((t) => (
            <ButtonLink
              key={t.slug}
              variant="amber"
              size="sm"
              href={`/interview-questions/${t.slug}/senior`}
            >
              {t.name} questions
            </ButtonLink>
          ))}
        </div>
      </Card>
    </article>
  );
}
