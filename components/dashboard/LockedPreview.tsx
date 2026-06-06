import { Card } from "@/components/ui/Card";
import { ButtonLink } from "@/components/ui/Button";
import { RiskBadge } from "@/components/ui/RiskBadge";
import { AnswerMarkdown } from "./AnswerMarkdown";
import { InterviewerLens } from "./InterviewerLens";
import { sheetTitle, BUNDLE_PRICE } from "@/lib/catalog";
import type { Level, Question } from "@/lib/types";

const FAKE_ROWS = [
  "How do micro-partitions affect pruning at scale?",
  "When would you reach for a materialized view here?",
  "Walk me through diagnosing a slow join.",
  "What's your approach to cost governance?",
  "How do you handle late-arriving data?",
];

/** Free-preview question shown in full, then a blurred teaser + unlock CTA. */
export function LockedPreview({
  tool,
  level,
  preview,
}: {
  tool: string;
  level: Level;
  preview: Question | null;
}) {
  return (
    <div className="space-y-6">
      {preview && (
        <Card>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-success/15 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-success">
              Free preview
            </span>
            <RiskBadge risk={preview.riskLevel} />
          </div>
          <h2 className="text-lg font-bold text-navy dark:text-fg">
            {preview.questionText}
          </h2>
          <div className="mt-4">
            <AnswerMarkdown text={preview.answerStructured} />
          </div>
          {preview.interviewerLens && (
            <div className="mt-4">
              <InterviewerLens text={preview.interviewerLens} />
            </div>
          )}
        </Card>
      )}

      {/* Blurred teaser */}
      <div className="relative">
        <div
          aria-hidden
          className="select-none space-y-2 blur-sm"
        >
          {FAKE_ROWS.map((t, i) => (
            <Card key={i}>
              <div className="flex items-center gap-3">
                <span className="h-5 w-5 flex-none rounded border border-border" />
                <span className="flex-1 text-sm text-fg">{t}</span>
                <span className="h-4 w-16 rounded-full bg-surface" />
              </div>
            </Card>
          ))}
        </div>

        {/* Unlock CTA overlay */}
        <div className="absolute inset-0 flex items-end justify-center pb-2">
          <Card className="w-full max-w-md text-center shadow-lift">
            <h3 className="text-lg font-bold text-fg">
              Unlock the full {sheetTitle(tool, level)} sheet
            </h3>
            <p className="mt-1 text-sm text-muted">
              Every question, the interviewer&apos;s lens, follow-ups and red-flag
              phrases — across every tool and level.
            </p>
            <div className="mt-4 flex flex-col items-center justify-center gap-2 sm:flex-row">
              <ButtonLink
                href="/buy?bundle=1"
                variant="amber"
              >
                Unlock all cheat sheets — {BUNDLE_PRICE}
              </ButtonLink>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
