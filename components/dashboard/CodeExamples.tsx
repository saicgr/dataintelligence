import { cn } from "@/lib/utils";
import type { CodeExample } from "@/lib/types";

const ACCENT = {
  bug: {
    icon: "🐞",
    label: "Bug",
    text: "text-danger",
    border: "border-danger/40",
    bg: "bg-danger/5",
  },
  fix: {
    icon: "✅",
    label: "Fix",
    text: "text-success",
    border: "border-success/40",
    bg: "bg-success/5",
  },
} as const;

/**
 * Renders a question's `code` examples as labelled code blocks under the answer
 * (🐞 Bug / ✅ Fix accents, or a plain single snippet). Structurally mirrors the
 * mobile app's CodePanel so both surfaces show identical examples.
 */
export function CodeExamples({ examples }: { examples: CodeExample[] }) {
  return (
    <div className="space-y-3">
      {examples.map((ex, i) => {
        const a = ex.accent ? ACCENT[ex.accent] : null;
        const label = ex.label ?? a?.label;
        return (
          <div
            key={i}
            className={cn(
              "overflow-hidden rounded-xl border",
              a?.border ?? "border-border"
            )}
          >
            {(label || ex.lang) && (
              <div
                className={cn(
                  "flex items-center justify-between border-b px-4 py-2 text-xs font-bold",
                  a?.border ?? "border-border",
                  a?.bg ?? "bg-surface"
                )}
              >
                <span className={a?.text ?? "text-muted"}>
                  {a ? `${a.icon} ` : ""}
                  {label}
                </span>
                {ex.lang ? (
                  <span className="font-mono text-[11px] font-medium text-muted">
                    {ex.lang}
                  </span>
                ) : null}
              </div>
            )}
            <pre className="overflow-x-auto bg-card px-4 py-3 text-[13px] leading-relaxed text-fg">
              <code className="font-mono">{ex.lines.join("\n")}</code>
            </pre>
          </div>
        );
      })}
    </div>
  );
}
