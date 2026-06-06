import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  TOOL_BY_SLUG,
  TOOLS,
  LEVEL_NAMES,
  BUNDLE_PRICE,
  sheetTitle,
  isValidTool,
  isValidLevel,
  allSheets,
} from "@/lib/catalog";
import type { Level } from "@/lib/types";
import {
  getSampleQuestions,
  getSheetCategories,
} from "@/lib/data";
import { Card } from "@/components/ui/Card";
import { ButtonLink } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { LandingSampleList } from "@/components/seo/LandingSampleList";
import { JsonLd, qaPageJsonLd } from "@/components/seo/JsonLd";

/** Strip markdown-ish formatting for plain-text JSON-LD answers. */
function stripMarkdown(s: string): string {
  return s
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/^[-*]\s+/gm, "")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

interface Params {
  params: { tool: string; level: string };
}

export function generateStaticParams() {
  return allSheets().map(({ tool, level }) => ({ tool, level }));
}

export function generateMetadata({ params }: Params): Metadata {
  const { tool, level } = params;
  if (!isValidTool(tool) || !isValidLevel(level)) return {};
  const title = `${sheetTitle(tool, level as Level)} Interview Questions (2026)`;
  const name = TOOL_BY_SLUG[tool].name;
  const description = `${LEVEL_NAMES[level as Level]} ${name} interview questions for 2026 — researched from how real loops run and fact-checked against the docs, with senior-level answers and the interviewer's lens.`;
  return {
    title,
    description,
    openGraph: { title, description },
  };
}

export default function InterviewQuestionsPage({ params }: Params) {
  const { tool } = params;
  const level = params.level;
  if (!isValidTool(tool) || !isValidLevel(level)) notFound();

  const lvl = level as Level;
  const toolDef = TOOL_BY_SLUG[tool];
  const levelName = LEVEL_NAMES[lvl];

  const categories = getSheetCategories(tool, lvl);
  const questionCount = categories.reduce(
    (sum, c) => sum + c.questions.length,
    0
  );

  const samples = getSampleQuestions(tool, lvl, 3);
  const faq = qaPageJsonLd(
    samples.map((q) => ({
      q: q.questionText,
      a: stripMarkdown(q.answerStructured),
    }))
  );

  // A couple of related tools from the same track.
  const related = TOOLS.filter(
    (t) => t.track === toolDef.track && t.slug !== tool
  ).slice(0, 3);

  return (
    <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <JsonLd data={faq} />

      <div className="flex items-center gap-2">
        <Badge tone="navy">{toolDef.icon} {toolDef.name}</Badge>
        <Badge tone="muted">{levelName}</Badge>
      </div>

      <h1 className="mt-4 text-3xl font-bold tracking-tight text-fg sm:text-4xl">
        {levelName} {toolDef.name} Interview Questions
      </h1>

      <p className="mt-4 text-lg text-muted">
        The {toolDef.name} questions that actually come up for{" "}
        {levelName.toLowerCase()}-level candidates — researched from how real loops run,
        fact-checked against the official docs, and written up with the answer that lands
        and the interviewer&apos;s lens behind it. <a href="/methodology" className="text-amber underline">How these are made →</a>
      </p>

      <p className="mt-3 text-sm font-medium text-muted">
        {questionCount} questions across {categories.length} categories —{" "}
        deep dives, decision frameworks, red flags and more.
      </p>

      <h2 className="mt-10 text-xl font-bold text-fg">Sample questions</h2>
      <div className="mt-4">
        <LandingSampleList questions={samples} />
      </div>

      <Card className="mt-10 bg-navy text-white" as="section">
        <h2 className="text-xl font-bold">
          Get every {toolDef.name} question they ask {levelName.toLowerCase()} candidates
        </h2>
        <p className="mt-2 text-sm text-white/80">
          Full answers, the interviewer&apos;s lens, follow-up chains and red flags —
          everything in one sheet you can drill the week before your loop.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <ButtonLink
            variant="amber"
            href="/buy?bundle=1"
          >
            Unlock all cheat sheets — {BUNDLE_PRICE}
          </ButtonLink>
        </div>
      </Card>

      {related.length > 0 && (
        <section className="mt-12">
          <h2 className="text-lg font-bold text-fg">Related tools</h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {related.map((t) => (
              <li key={t.slug}>
                <ButtonLink
                  variant="outline"
                  size="sm"
                  href={`/interview-questions/${t.slug}/${level}`}
                >
                  {t.icon} {t.name}
                </ButtonLink>
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}
