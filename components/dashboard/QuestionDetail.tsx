"use client";

import { useEffect } from "react";
import Link from "next/link";
import { RiskBadge } from "@/components/ui/RiskBadge";
import { Badge } from "@/components/ui/Badge";
import { AnswerMarkdown } from "./AnswerMarkdown";
import { CodeExamples } from "./CodeExamples";
import { InterviewerLens } from "./InterviewerLens";
import { AskedBadge } from "./AskedBadge";
import { MarkPracticedToggle } from "./MarkPracticedToggle";
import { ConfidencePicker } from "./ConfidencePicker";
import { IGotAskedButton } from "./IGotAskedButton";
import { useProgress } from "@/components/providers/progress-provider";
import { cn } from "@/lib/utils";
import type { Level, Question } from "@/lib/types";

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted">
      {children}
    </h2>
  );
}

export function QuestionDetail({
  question,
  tool,
  level,
  prevId,
  nextId,
}: {
  question: Question;
  tool: string;
  level: Level;
  prevId: number | null;
  nextId: number | null;
}) {
  const { markStudied } = useProgress();

  useEffect(() => {
    markStudied(question.id);
  }, [question.id, markStudied]);

  const sheetUrl = `/dashboard/${tool}/${level}`;

  return (
    <article className="space-y-8">
      {/* Header */}
      <header className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <Link
            href={sheetUrl}
            className="text-sm font-medium text-muted hover:text-fg"
          >
            ← Back to sheet
          </Link>
          <IGotAskedButton id={question.id} askedCount={question.askedCount} />
        </div>

        <h1 className="text-2xl font-bold leading-snug text-navy dark:text-fg">
          {question.questionText}
        </h1>

        <div className="flex flex-wrap items-center gap-3">
          <RiskBadge risk={question.riskLevel} />
          <AskedBadge count={question.askedCount} />
          {question.isComparison && question.comparisonTools?.length ? (
            <Badge tone="navy">
              Comparison · {question.comparisonTools.join(" vs ")}
            </Badge>
          ) : null}
          <div className="ml-auto flex items-center gap-3">
            <ConfidencePicker id={question.id} />
            <MarkPracticedToggle id={question.id} />
          </div>
        </div>
      </header>

      {/* The Answer */}
      <section>
        <SectionHeading>The Answer</SectionHeading>
        <AnswerMarkdown text={question.answerStructured} />
        {question.code && question.code.length > 0 && (
          <div className="mt-4">
            <CodeExamples examples={question.code} />
          </div>
        )}
      </section>

      {/* Deep Explanation */}
      {question.explanationDeep.trim() && (
        <section>
          <SectionHeading>Deep Explanation</SectionHeading>
          <AnswerMarkdown text={question.explanationDeep} />
        </section>
      )}

      {/* Interviewer's Lens */}
      {question.interviewerLens && (
        <section>
          <SectionHeading>The Interviewer&apos;s Lens</SectionHeading>
          <InterviewerLens text={question.interviewerLens} />
        </section>
      )}

      {/* Follow-up Chain */}
      {question.followupChain.length > 0 && (
        <section>
          <SectionHeading>Follow-up Chain</SectionHeading>
          <ol className="space-y-4">
            {question.followupChain.map((f, i) => (
              <li key={i} className="flex gap-3">
                <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-navy text-xs font-bold text-white dark:bg-accent dark:text-accent-fg">
                  {i + 1}
                </span>
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-fg">{f.question}</p>
                  <p className="text-sm leading-relaxed text-muted">
                    {f.answer}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* Red Flag Phrases */}
      {question.redFlags.length > 0 && (
        <section>
          <SectionHeading>Red Flag Phrases</SectionHeading>
          <div className="overflow-hidden rounded-xl border border-border">
            <div className="grid grid-cols-2 border-b border-border text-xs font-bold uppercase tracking-wide">
              <div className="bg-danger/10 px-4 py-2 text-danger">
                Junior says…
              </div>
              <div className="bg-success/10 px-4 py-2 text-success">
                Senior says…
              </div>
            </div>
            {question.redFlags.map((rf, i) => (
              <div
                key={i}
                className="grid grid-cols-2 divide-x divide-border border-t border-border first:border-t-0"
              >
                <div className="bg-danger/5 px-4 py-3 text-sm text-fg">
                  {rf.junior}
                </div>
                <div className="bg-success/5 px-4 py-3 text-sm text-fg">
                  {rf.senior}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Alternate phrasings */}
      {question.alternatePhrasings.length > 0 && (
        <section>
          <SectionHeading>You Might Hear It As…</SectionHeading>
          <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed text-muted">
            {question.alternatePhrasings.map((p, i) => (
              <li key={i}>{p}</li>
            ))}
          </ul>
        </section>
      )}

      {/* Diagram placeholder */}
      <section>
        <div className="grid place-items-center rounded-2xl border border-border p-6 text-sm text-muted">
          Flow diagram
        </div>
      </section>

      {/* "Where it came from" intentionally not rendered — the per-question
          interview-context strings asserted fabricated specifics (named companies,
          exact interview counts). Honesty: don't display unverifiable provenance. */}

      {/* Bottom nav */}
      <nav className="flex items-center justify-between border-t border-border pt-6">
        {prevId != null ? (
          <Link
            href={`${sheetUrl}/${prevId}`}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold text-fg transition-colors hover:bg-surface"
          >
            ← Previous Question
          </Link>
        ) : (
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-2 text-sm font-semibold opacity-40"
            )}
          >
            ← Previous Question
          </span>
        )}
        {nextId != null ? (
          <Link
            href={`${sheetUrl}/${nextId}`}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold text-fg transition-colors hover:bg-surface"
          >
            Next Question →
          </Link>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-2 text-sm font-semibold opacity-40">
            Next Question →
          </span>
        )}
      </nav>
    </article>
  );
}
