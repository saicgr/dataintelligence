import type { Metadata } from "next";
import { getQuestionOfTheDay } from "@/lib/data";
import { TOOL_BY_SLUG, LEVEL_NAMES } from "@/lib/catalog";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { RiskBadge } from "@/components/ui/RiskBadge";
import { ButtonLink } from "@/components/ui/Button";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Interview Question of the Day",
  description:
    "A fresh, real data & AI engineering interview question every day — with a teaser of the answer that lands.",
};

function stripMarkdown(s: string): string {
  return s
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/^[-*]\s+/gm, "")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

export default function QotdPage() {
  const dayKey = Math.floor(Date.now() / 86400000);
  const q = getQuestionOfTheDay(dayKey);
  const toolDef = TOOL_BY_SLUG[q.toolSlug];
  const teaser = stripMarkdown(q.answerStructured).slice(0, 220).trimEnd();

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <p className="text-xs font-semibold uppercase tracking-wide text-amber">
        Question of the day
      </p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight text-fg sm:text-4xl">
        Today&apos;s interview question
      </h1>

      <Card className="mt-8" as="article">
        <div className="flex flex-wrap items-center gap-2">
          {toolDef && <Badge tone="navy">{toolDef.icon} {toolDef.name}</Badge>}
          <Badge tone="muted">{LEVEL_NAMES[q.level]}</Badge>
          <RiskBadge risk={q.riskLevel} />
        </div>

        <h2 className="mt-4 text-xl font-semibold text-fg">{q.questionText}</h2>

        <p className="mt-4 text-sm text-muted">{teaser}…</p>
        <p className="mt-4 text-sm font-medium text-muted">
          🔒 Full answer + Interviewer&apos;s Lens in the sheet
        </p>

        <div className="mt-6">
          <ButtonLink
            href={`/interview-questions/${q.toolSlug}/${q.level}`}
          >
            See the full answer →
          </ButtonLink>
        </div>
      </Card>
    </div>
  );
}
