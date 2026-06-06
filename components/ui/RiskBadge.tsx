import { cn } from "@/lib/utils";
import type { Risk } from "@/lib/types";

const config: Record<Risk, { label: string; cls: string; dot: string }> = {
  high: {
    label: "High Risk",
    cls: "bg-danger/10 text-danger border-danger/30",
    dot: "bg-danger",
  },
  medium: {
    label: "Watch",
    cls: "bg-warning/10 text-warning border-warning/30",
    dot: "bg-warning",
  },
  low: {
    label: "Common",
    cls: "bg-success/10 text-success border-success/30",
    dot: "bg-success",
  },
};

export function RiskBadge({
  risk,
  className,
  showLabel = true,
}: {
  risk: Risk;
  className?: string;
  showLabel?: boolean;
}) {
  const c = config[risk];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-semibold",
        c.cls,
        className
      )}
      title={`Risk: ${c.label}`}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", c.dot)} />
      {showLabel && c.label}
    </span>
  );
}
