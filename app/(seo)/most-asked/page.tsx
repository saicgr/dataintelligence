import type { Metadata } from "next";
import Link from "next/link";
import { getMostAsked } from "@/lib/data";
import { TOOL_BY_SLUG } from "@/lib/catalog";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { AskedBadge } from "@/components/dashboard/AskedBadge";

export const metadata: Metadata = {
  title: "Most-Asked Data & AI Interview Questions (2026)",
  description:
    "The data & AI engineering interview questions that come up most often — our research-based ranking of the highest-signal questions to prep first.",
};

export default function MostAskedPage() {
  const questions = getMostAsked(25);
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <h1 className="text-3xl font-bold tracking-tight text-fg sm:text-4xl">
        Most-Asked Interview Questions
      </h1>
      <p className="mt-4 text-lg text-muted">
        Our research-based ranking of the questions that come up most across data &amp; AI
        engineering loops. If you only prep 25 questions, start here.
      </p>

      <ol className="mt-8 grid gap-3">
        {questions.map((q, i) => {
          const toolDef = TOOL_BY_SLUG[q.toolSlug];
          return (
            <li key={q.id}>
              <Link
                href={`/interview-questions/${q.toolSlug}/${q.level}`}
                className="block"
              >
                <Card className="transition-colors hover:bg-surface" as="article">
                  <div className="flex items-start gap-4">
                    <span className="font-mono text-lg font-bold text-muted">
                      #{i + 1}
                    </span>
                    <div className="flex-1">
                      <p className="font-medium text-fg">{q.questionText}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        {toolDef && (
                          <Badge tone="navy">
                            {toolDef.icon} {toolDef.name}
                          </Badge>
                        )}
                        <AskedBadge count={q.askedCount} />
                      </div>
                    </div>
                  </div>
                </Card>
              </Link>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
