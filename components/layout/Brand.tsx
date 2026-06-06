import Link from "next/link";
import { cn } from "@/lib/utils";
import { SITE_NAME } from "@/lib/catalog";

export function Brand({
  className,
  href = "/",
}: {
  className?: string;
  href?: string;
}) {
  return (
    <Link href={href} className={cn("flex items-center gap-2.5", className)}>
      <span className="grid h-9 w-9 flex-none place-items-center rounded-lg bg-navy text-white dark:bg-accent dark:text-accent-fg">
        <span className="font-mono text-sm font-bold">FN</span>
      </span>
      <span className="leading-tight">
        <span className="block text-[15px] font-bold tracking-tight">
          {SITE_NAME}
        </span>
        <span className="block text-[11px] font-medium uppercase tracking-wider text-muted">
          Interview Notes
        </span>
      </span>
    </Link>
  );
}
