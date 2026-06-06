"use client";

import { useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { TRACKS, TOOLS } from "@/lib/catalog";

/** Searchable cheat-sheet catalog, grouped by track. */
export function CheatSheetCatalog() {
  const [q, setQ] = useState("");
  const query = q.trim().toLowerCase();

  const matches = (name: string, blurb: string, track: string) =>
    !query ||
    name.toLowerCase().includes(query) ||
    blurb.toLowerCase().includes(query) ||
    track.toLowerCase().includes(query);

  const visibleTracks = TRACKS.map((track) => ({
    track,
    tools: TOOLS.filter(
      (t) => t.track === track.slug && matches(t.name, t.blurb, track.name)
    ),
  })).filter((g) => g.tools.length > 0);

  const total = visibleTracks.reduce((n, g) => n + g.tools.length, 0);

  return (
    <div>
      {/* Search */}
      <div className="mx-auto max-w-md">
        <div className="relative">
          <svg viewBox="0 0 20 20" className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="9" cy="9" r="6" />
            <path d="M14 14l4 4" strokeLinecap="round" />
          </svg>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search tools — e.g. spark, rag, sql…"
            className="w-full rounded-full border border-border bg-surface py-2.5 pl-11 pr-10 text-sm text-fg placeholder:text-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-navy/30"
          />
          {q && (
            <button onClick={() => setQ("")} aria-label="Clear search" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-fg">
              <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 4l8 8M12 4l-8 8" strokeLinecap="round" /></svg>
            </button>
          )}
        </div>
        {query && (
          <p className="mt-2 text-center text-xs text-muted">{total} {total === 1 ? "tool" : "tools"} match “{q}”</p>
        )}
      </div>

      {/* Results */}
      {visibleTracks.length === 0 ? (
        <p className="mt-12 rounded-xl border border-dashed border-border p-10 text-center text-muted">
          No tools match “{q}”. Try a different term.
        </p>
      ) : (
        <div className="mt-12 space-y-14">
          {visibleTracks.map(({ track, tools }) => (
            <div key={track.slug}>
              <div className="mb-6">
                <h2 className="text-xl font-bold tracking-tight text-fg">{track.name}</h2>
                <p className="text-sm text-muted">{track.blurb}</p>
              </div>
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {tools.map((tool) => (
                  <Card key={tool.slug} className="flex flex-col p-6">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl" aria-hidden>{tool.icon}</span>
                      <span className="text-lg font-bold tracking-tight text-fg">{tool.name}</span>
                    </div>
                    <div className="mt-3"><Badge tone="amber">Jr · Mid · Sr</Badge></div>
                    <p className="mt-3 flex-1 text-sm leading-relaxed text-muted">{tool.blurb}</p>
                    <div className="mt-5 flex items-center justify-between">
                      <span className="text-sm font-semibold text-amber">{tool.questionCount} questions</span>
                      <Link href={`/interview-questions/${tool.slug}/senior`} className="text-sm font-semibold text-fg hover:text-amber">
                        View sheet →
                      </Link>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
