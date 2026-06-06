import type { Question } from "@/lib/types";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

/**
 * Parse the markdown-ish answer block into bullet lines. We keep `**bold**`
 * as a simple emphasized lead-in when present.
 */
function bullets(s: string): { lead?: string; text: string }[] {
  return s
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.startsWith("-") || l.startsWith("*"))
    .map((l) => {
      const body = l.replace(/^[-*]\s*/, "");
      const m = body.match(/^\*\*(.*?)\*\*[:\-—]?\s*(.*)$/);
      if (m) return { lead: m[1], text: m[2] };
      return { text: body.replace(/\*\*(.*?)\*\*/g, "$1") };
    });
}

/**
 * Render a comparison question as a clean framing: the question as a heading,
 * the tools being compared as chips, and the structured answer bullets.
 */
export function CompareTable({ question }: { question: Question }) {
  const tools = question.comparisonTools ?? [];
  const rows = bullets(question.answerStructured);

  return (
    <section>
      <h2 className="text-xl font-semibold text-fg">{question.questionText}</h2>
      {tools.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {tools.map((t) => (
            <Badge key={t} tone="navy">
              {t}
            </Badge>
          ))}
        </div>
      )}
      <Card className="mt-5" as="div">
        <ul className="grid gap-3">
          {rows.map((r, i) => (
            <li key={i} className="flex gap-3 text-sm text-fg">
              <span aria-hidden className="select-none text-amber">
                ▸
              </span>
              <span>
                {r.lead && (
                  <span className="font-semibold text-fg">{r.lead}: </span>
                )}
                <span className="text-muted">{r.text}</span>
              </span>
            </li>
          ))}
        </ul>
      </Card>
    </section>
  );
}
