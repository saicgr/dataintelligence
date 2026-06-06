import type { Metadata } from "next";
import Link from "next/link";
import { getGlossary } from "@/lib/data";
import { Card } from "@/components/ui/Card";

export const metadata: Metadata = {
  title: "Data & AI Engineering Glossary (2026)",
  description:
    "Plain-English definitions of the data & AI engineering terms interviewers expect you to know — micro-partitions, HNSW, RAG, idempotency and more.",
};

export default function GlossaryIndexPage() {
  const terms = getGlossary();
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <h1 className="text-3xl font-bold tracking-tight text-fg sm:text-4xl">
        Data &amp; AI Engineering Glossary
      </h1>
      <p className="mt-4 text-lg text-muted">
        The terms interviewers expect you to define cold — explained the way
        you&apos;d want to hear them say it back.
      </p>

      <ul className="mt-8 grid gap-4">
        {terms.map((t) => (
          <li key={t.slug}>
            <Link href={`/glossary/${t.slug}`} className="block">
              <Card className="transition-colors hover:bg-surface" as="article">
                <h2 className="font-semibold text-fg">{t.term}</h2>
                <p className="mt-1 text-sm text-muted">{t.short}</p>
              </Card>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
