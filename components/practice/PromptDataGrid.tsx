"use client";

import { cn } from "@/lib/utils";

export interface RowResult { index: number; correct: boolean; output: string }

/**
 * Spreadsheet-style view for the prompt-optimization loop: the input columns the
 * prompt sees, the AI-generated column from the last run, and a per-row verdict.
 * The EXPECTED label is never shipped to the client — only correct/incorrect.
 */
export function PromptDataGrid({
  inputColumns,
  rows,
  results,
}: {
  inputColumns: string[];
  rows: { input: Record<string, string> }[];
  results: RowResult[] | null;
}) {
  const byIndex = new Map((results ?? []).map((r) => [r.index, r]));
  return (
    <div className="overflow-auto rounded-xl border border-border scroll-thin">
      <table className="w-full border-collapse text-xs">
        <thead className="sticky top-0 bg-surface">
          <tr className="text-left">
            <th className="border-b border-border px-2 py-1.5 font-semibold text-muted">#</th>
            {inputColumns.map((c) => (
              <th key={c} className="border-b border-border px-2 py-1.5 font-mono font-semibold text-fg">{c}</th>
            ))}
            <th className="border-b border-border px-2 py-1.5 font-semibold text-navy dark:text-accent">AI output</th>
            <th className="border-b border-border px-2 py-1.5 font-semibold text-muted">✓</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const r = byIndex.get(i);
            return (
              <tr key={i} className={cn("align-top", r ? (r.correct ? "bg-success/5" : "bg-danger/5") : "")}>
                <td className="border-b border-border px-2 py-1.5 text-muted">{i + 1}</td>
                {inputColumns.map((c) => (
                  <td key={c} className="max-w-[18rem] border-b border-border px-2 py-1.5 text-fg">{row.input[c]}</td>
                ))}
                <td className="max-w-[12rem] border-b border-border px-2 py-1.5 font-mono text-fg">
                  {r ? (r.output || "(empty)") : <span className="text-muted">—</span>}
                </td>
                <td className="border-b border-border px-2 py-1.5">
                  {r ? <span className={r.correct ? "text-success" : "text-danger"}>{r.correct ? "✓" : "✗"}</span> : <span className="text-muted">·</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
