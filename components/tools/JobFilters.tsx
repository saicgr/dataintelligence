"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { SegmentedTabs } from "@/components/ui/Tabs";
import { TOOLS, LEVELS, TRACKS } from "@/lib/catalog";
import { cn } from "@/lib/utils";

export function JobFilters() {
  const router = useRouter();
  const params = useSearchParams();

  const tool = params.get("tool") ?? "";
  const level = params.get("level") ?? "";
  const track = params.get("track") ?? "";

  const update = useCallback(
    (key: string, value: string) => {
      const next = new URLSearchParams(params.toString());
      if (value) next.set(key, value);
      else next.delete(key);
      const qs = next.toString();
      router.push(qs ? `/jobs?${qs}` : "/jobs");
    },
    [params, router]
  );

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-4 sm:flex-row sm:flex-wrap sm:items-end">
      <div>
        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">
          Tool
        </label>
        <select
          value={tool}
          onChange={(e) => update("tool", e.target.value)}
          className="rounded-full border border-border bg-card px-4 py-2 text-sm text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-navy/40"
        >
          <option value="">All tools</option>
          {TOOLS.map((t) => (
            <option key={t.slug} value={t.slug}>
              {t.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">
          Level
        </label>
        <SegmentedTabs
          options={[
            { value: "", label: "All" },
            ...LEVELS.map((l) => ({ value: l.slug, label: l.name })),
          ]}
          value={level}
          onChange={(v) => update("level", v)}
        />
      </div>

      <div>
        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">
          Track
        </label>
        <div className="inline-flex rounded-full border border-border bg-card p-1">
          {[{ slug: "", name: "All" }, ...TRACKS].map((t) => (
            <button
              key={t.slug || "all"}
              onClick={() => update("track", t.slug)}
              className={cn(
                "rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
                track === t.slug
                  ? "bg-navy text-white"
                  : "text-muted hover:text-fg"
              )}
            >
              {t.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
