"use client";

import Link from "next/link";
import { Checkbox } from "@/components/ui/Checkbox";
import { RiskBadge } from "@/components/ui/RiskBadge";
import { AskedBadge } from "./AskedBadge";
import { useProgress } from "@/components/providers/progress-provider";
import { timeAgo } from "@/lib/utils";
import type { Confidence, Level, QuestionStub } from "@/lib/types";

const CONF_EMOJI: Record<Confidence, string> = {
  low: "😬",
  medium: "😐",
  high: "💪",
};

export function QuestionRow({
  tool,
  level,
  index,
  question,
}: {
  tool: string;
  level: Level;
  index: number;
  question: QuestionStub;
}) {
  const { isPracticed, togglePracticed, getLastStudied, getConfidence } =
    useProgress();
  const practiced = isPracticed(question.id);
  const last = getLastStudied(question.id);
  const conf = getConfidence(question.id);

  return (
    <div className="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-surface">
      <Checkbox
        checked={practiced}
        ariaLabel="Mark practiced"
        onChange={() => {
          togglePracticed(question.id);
          fetch("/api/progress", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              questionId: question.id,
              practiced: !practiced,
            }),
          }).catch(() => {});
        }}
      />
      <span className="w-5 flex-none text-right font-mono text-xs text-muted">
        {index}
      </span>
      <Link
        href={`/dashboard/${tool}/${level}/${question.id}`}
        className="min-w-0 flex-1 truncate text-sm text-fg hover:underline"
        title={question.questionText}
      >
        {question.questionText}
      </Link>
      {conf && (
        <span className="flex-none text-sm" title={`Confidence: ${conf}`}>
          {CONF_EMOJI[conf]}
        </span>
      )}
      {last && (
        <span className="hidden flex-none text-xs text-muted sm:inline">
          {timeAgo(last)}
        </span>
      )}
      <AskedBadge count={question.askedCount} className="hidden md:inline-flex" />
      <RiskBadge risk={question.riskLevel} showLabel={false} />
    </div>
  );
}
