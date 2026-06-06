import { Badge } from "@/components/ui/Badge";

/**
 * Editorial "how often this comes up" signal — our research-based assessment,
 * NOT interview telemetry. Bucketed into qualitative tiers (no fake precise count).
 */
export function AskedBadge({
  count,
  className,
}: {
  count: number;
  className?: string;
}) {
  if (count < 3) return null;
  return (
    <Badge tone="amber" className={className}>
      {count >= 8 ? "Frequently asked" : "Commonly asked"}
    </Badge>
  );
}
