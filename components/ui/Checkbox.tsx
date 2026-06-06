"use client";

import { cn } from "@/lib/utils";

export function Checkbox({
  checked,
  onChange,
  className,
  ariaLabel,
}: {
  checked: boolean;
  onChange?: () => void;
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={ariaLabel}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onChange?.();
      }}
      className={cn(
        "flex h-5 w-5 flex-none items-center justify-center rounded-[5px] border transition-colors",
        checked
          ? "border-navy bg-navy text-white dark:border-accent dark:bg-accent dark:text-accent-fg"
          : "border-border bg-card hover:border-navy/40",
        className
      )}
    >
      {checked && (
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none">
          <path
            d="M3.5 8.5l3 3 6-7"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </button>
  );
}
