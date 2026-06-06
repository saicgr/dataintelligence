import type { QueryResult } from "./duckdb";
import { cn } from "@/lib/utils";

export function fmtCell(v: unknown): string {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "bigint") return v.toString();
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v);
}

export function ResultsTable({
  title,
  result,
  tone = "default",
}: {
  title: string;
  result: QueryResult;
  tone?: "default" | "expected";
}) {
  if (result.error) {
    return (
      <div className="rounded-xl border border-danger/30 bg-danger/5 p-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-danger">{title}</p>
        <pre className="mt-2 overflow-x-auto whitespace-pre-wrap font-mono text-xs text-danger">{result.error}</pre>
      </div>
    );
  }
  return (
    <div className={cn("overflow-hidden rounded-xl border", tone === "expected" ? "border-amber/30" : "border-border", "bg-card")}>
      <div className="border-b border-border px-4 py-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted">
          {title} · {result.rows.length} row{result.rows.length === 1 ? "" : "s"}
        </span>
      </div>
      <div className="overflow-x-auto scroll-thin">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border bg-surface">
              {result.columns.map((c) => (
                <th key={c} className="px-3 py-2 font-mono text-xs font-semibold text-fg">{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {result.rows.slice(0, 50).map((row, i) => (
              <tr key={i} className="border-b border-border last:border-0">
                {row.map((cell, j) => (
                  <td key={j} className="px-3 py-1.5 font-mono text-xs text-muted">{fmtCell(cell)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
