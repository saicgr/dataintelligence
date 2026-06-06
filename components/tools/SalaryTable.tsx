import type { SalaryBenchmark } from "@/lib/types";
import { fmtMoney } from "@/lib/utils";

export function SalaryTable({ rows }: { rows: SalaryBenchmark[] }) {
  if (!rows.length) {
    return <p className="text-muted">No salary data available.</p>;
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-border bg-surface text-left">
            <th className="px-4 py-3 font-semibold text-fg">Role</th>
            <th className="px-4 py-3 font-semibold text-fg">Region</th>
            <th className="px-4 py-3 text-right font-semibold text-fg">Min</th>
            <th className="px-4 py-3 text-right font-semibold text-fg">
              Median
            </th>
            <th className="px-4 py-3 text-right font-semibold text-fg">Max</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.id}
              className="border-b border-border last:border-0 hover:bg-surface"
            >
              <td className="px-4 py-3 font-medium text-fg">{r.role}</td>
              <td className="px-4 py-3 text-muted">{r.region}</td>
              <td className="px-4 py-3 text-right tabular-nums text-muted">
                {fmtMoney(r.min, r.currency)}
              </td>
              <td className="px-4 py-3 text-right font-semibold tabular-nums text-fg">
                {fmtMoney(r.median, r.currency)}
              </td>
              <td className="px-4 py-3 text-right tabular-nums text-muted">
                {fmtMoney(r.max, r.currency)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
