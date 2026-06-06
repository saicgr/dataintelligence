"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

export interface TabItem {
  id: string;
  label: React.ReactNode;
  content: React.ReactNode;
}

export function Tabs({
  items,
  initial,
  className,
}: {
  items: TabItem[];
  initial?: string;
  className?: string;
}) {
  const [active, setActive] = useState(initial ?? items[0]?.id);
  return (
    <div className={className}>
      <div
        className="flex gap-1 overflow-x-auto border-b border-border"
        role="tablist"
      >
        {items.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={active === t.id}
            onClick={() => setActive(t.id)}
            className={cn(
              "-mb-px whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
              active === t.id
                ? "border-navy text-fg dark:border-accent"
                : "border-transparent text-muted hover:text-fg"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="pt-5">
        {items.map(
          (t) =>
            active === t.id && (
              <div key={t.id} role="tabpanel" className="animate-fade-in">
                {t.content}
              </div>
            )
        )}
      </div>
    </div>
  );
}

/** Controlled segmented control (used for level tabs etc.). */
export function SegmentedTabs({
  options,
  value,
  onChange,
  className,
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "inline-flex rounded-full border border-border bg-surface p-1",
        className
      )}
    >
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
            value === o.value
              ? "bg-navy text-white dark:bg-accent dark:text-accent-fg"
              : "text-muted hover:text-fg"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
