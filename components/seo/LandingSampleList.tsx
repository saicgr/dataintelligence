import type { Question } from "@/lib/types";
import { Card } from "@/components/ui/Card";
import { RiskBadge } from "@/components/ui/RiskBadge";

/** Strip the markdown-ish formatting we use in answers down to plain text. */
function stripMarkdown(s: string): string {
  return s
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/^[-*]\s+/gm, "")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function preview(s: string, n = 160): string {
  const clean = stripMarkdown(s);
  return clean.length > n ? clean.slice(0, n).trimEnd() + "…" : clean;
}

/**
 * Teaser cards for a public landing page: the question, its risk, a short
 * preview of the answer, and a locked-content hint.
 */
export function LandingSampleList({ questions }: { questions: Question[] }) {
  if (!questions.length) return null;
  return (
    <ul className="grid gap-4">
      {questions.map((q) => (
        <li key={q.id}>
          <Card as="article">
            <div className="flex items-start justify-between gap-4">
              <h3 className="font-semibold text-fg">{q.questionText}</h3>
              <RiskBadge risk={q.riskLevel} />
            </div>
            <p className="mt-3 text-sm text-muted">
              {preview(q.answerStructured)}
            </p>
            <p className="mt-4 text-sm font-medium text-muted">
              🔒 Full answer + Interviewer&apos;s Lens in the sheet
            </p>
          </Card>
        </li>
      ))}
    </ul>
  );
}
