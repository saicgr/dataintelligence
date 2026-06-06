import { SITE_NAME } from "@/lib/catalog";
import { SITE_URL } from "@/lib/env";

/**
 * Renders a JSON-LD <script> from a plain object. Used to add structured data
 * (schema.org) to SEO pages. Content is trusted seed data.
 */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

/** Build a schema.org FAQPage object from a list of Q/A pairs. */
export function qaPageJsonLd(
  questions: { q: string; a: string }[]
): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: questions.map(({ q, a }) => ({
      "@type": "Question",
      name: q,
      acceptedAnswer: {
        "@type": "Answer",
        text: a,
      },
    })),
  };
}

/** Build a schema.org DefinedTerm object for a glossary entry. */
export function definedTermJsonLd(
  term: string,
  description: string
): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "DefinedTerm",
    name: term,
    description,
    inDefinedTermSet: {
      "@type": "DefinedTermSet",
      name: `${SITE_NAME} Glossary`,
      url: `${SITE_URL}/glossary`,
    },
  };
}
