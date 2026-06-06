import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getGlossary, getGlossaryTerm } from "@/lib/data";
import { TOOL_BY_SLUG } from "@/lib/catalog";
import { ButtonLink } from "@/components/ui/Button";
import { Markdown } from "@/components/seo/Markdown";
import { JsonLd, definedTermJsonLd } from "@/components/seo/JsonLd";

interface Params {
  params: { term: string };
}

export function generateStaticParams() {
  return getGlossary().map((g) => ({ term: g.slug }));
}

export function generateMetadata({ params }: Params): Metadata {
  const t = getGlossaryTerm(params.term);
  if (!t) return {};
  const title = `${t.term} — definition (2026)`;
  return {
    title,
    description: t.short,
    openGraph: { title, description: t.short },
  };
}

export default function GlossaryTermPage({ params }: Params) {
  const t = getGlossaryTerm(params.term);
  if (!t) notFound();

  const toolDef = TOOL_BY_SLUG[t.toolSlug];

  return (
    <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <JsonLd data={definedTermJsonLd(t.term, t.short)} />

      <p className="text-sm">
        <Link href="/glossary" className="text-muted hover:text-fg">
          ← Glossary
        </Link>
      </p>

      <h1 className="mt-3 text-3xl font-bold tracking-tight text-fg sm:text-4xl">
        {t.term}
      </h1>
      <p className="mt-3 text-lg text-muted">{t.short}</p>

      <div className="mt-6">
        <Markdown>{t.body}</Markdown>
      </div>

      {toolDef && (
        <div className="mt-10 rounded-xl border border-border bg-surface p-5">
          <p className="text-sm text-fg">
            This comes up in <strong>{toolDef.name}</strong> interviews. See the
            real questions they ask.
          </p>
          <div className="mt-4">
            <ButtonLink
              href={`/interview-questions/${t.toolSlug}/senior`}
              size="sm"
            >
              {toolDef.name} interview questions →
            </ButtonLink>
          </div>
        </div>
      )}
    </article>
  );
}
