"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

export function CollapsibleSection({
  title,
  count,
  defaultOpen = false,
  children,
  className,
}: {
  title: React.ReactNode;
  count?: number;
  defaultOpen?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={className}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-surface"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2 text-sm font-semibold">
          {title}
          {typeof count === "number" && (
            <span className="rounded-full bg-surface px-2 py-0.5 text-xs font-semibold text-muted">
              {count}
            </span>
          )}
        </span>
        <svg
          viewBox="0 0 16 16"
          className={cn(
            "h-4 w-4 flex-none text-muted transition-transform",
            open && "rotate-90"
          )}
          fill="none"
        >
          <path
            d="M6 4l4 4-4 4"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      <div
        className={cn(
          "grid transition-[grid-template-rows] duration-200 ease-out",
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        )}
      >
        <div className="overflow-hidden">{children}</div>
      </div>
    </div>
  );
}
