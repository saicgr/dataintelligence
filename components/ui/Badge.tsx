import { cn } from "@/lib/utils";

type Tone = "neutral" | "amber" | "green" | "navy" | "muted";

const tones: Record<Tone, string> = {
  neutral: "bg-surface text-fg border border-border",
  amber: "bg-amber/15 text-amber border border-amber/30",
  green: "bg-success/15 text-success border border-success/30",
  navy: "bg-navy text-white dark:bg-navy-surface dark:text-navy-fg",
  muted: "bg-surface text-muted border border-border",
};

export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: React.ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide",
        tones[tone],
        className
      )}
    >
      {children}
    </span>
  );
}
