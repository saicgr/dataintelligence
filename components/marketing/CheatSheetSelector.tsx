"use client";

import { useState } from "react";
import Link from "next/link";
import { ButtonLink } from "@/components/ui/Button";
import { TOOLS, LEVELS, TRACKS, SHEET_PRICE, TOOL_PACK_PRICE, BUNDLE_PRICE } from "@/lib/catalog";
import { cn } from "@/lib/utils";

const selectCls =
  "rounded-full border border-border bg-surface px-3 py-2 text-sm font-medium text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-navy/30";

/**
 * Skill picker for the Cheat Sheets offer:
 *  - "All tools" → $59 full bundle
 *  - one tool + "All levels" → $29 tool pack (all 3 levels)
 *  - one tool + a single level → $12 sheet
 * Price + CTA update with the selection.
 */
export function CheatSheetSelector({ browseLink = true }: { browseLink?: boolean }) {
  const [tool, setTool] = useState("all");
  const [level, setLevel] = useState("all"); // "all" = every level of the chosen tool

  const isAllTools = tool === "all";
  const isAllLevels = level === "all";
  const toolName = TOOLS.find((t) => t.slug === tool)?.name ?? "";
  const levelName = LEVELS.find((l) => l.slug === level)?.name ?? "";

  const price = isAllTools ? BUNDLE_PRICE : isAllLevels ? TOOL_PACK_PRICE : SHEET_PRICE;
  const priceNote = isAllTools
    ? "one-time · all sheets"
    : isAllLevels
      ? "one-time · all levels"
      : "one-time · single sheet";
  const href = isAllTools
    ? "/buy?bundle=1"
    : `/buy?tool=${tool}&level=${level}`;
  const cta = isAllTools
    ? `Get all cheat sheets — ${BUNDLE_PRICE}`
    : isAllLevels
      ? `Get all ${toolName} levels — ${TOOL_PACK_PRICE}`
      : `Get ${toolName} ${levelName} — ${SHEET_PRICE}`;

  return (
    <div>
      {/* Selector */}
      <div className="flex flex-wrap gap-2">
        <select value={tool} onChange={(e) => setTool(e.target.value)} aria-label="Choose a skill" className={selectCls}>
          <option value="all">📚 All tools (full access)</option>
          {TRACKS.map((track) => (
            <optgroup key={track.slug} label={track.name}>
              {TOOLS.filter((t) => t.track === track.slug).map((t) => (
                <option key={t.slug} value={t.slug}>{t.icon} {t.name}</option>
              ))}
            </optgroup>
          ))}
        </select>
        {!isAllTools && (
          <select value={level} onChange={(e) => setLevel(e.target.value)} aria-label="Choose a level" className={selectCls}>
            <option value="all">All levels</option>
            {LEVELS.map((l) => (
              <option key={l.slug} value={l.slug}>{l.name}</option>
            ))}
          </select>
        )}
      </div>

      {/* Price */}
      <div className="mt-4 flex items-baseline gap-2">
        {isAllTools && <span className="text-base font-medium text-muted line-through">$120</span>}
        <span className="text-4xl font-bold tracking-tight text-fg">{price}</span>
        <span className="text-sm text-muted">{priceNote}</span>
      </div>

      {/* CTA */}
      <ButtonLink href={href} variant="amber" className={cn("mt-5 w-full")}>
        {cta}
      </ButtonLink>

      {browseLink && (
        <p className="mt-3 text-center text-xs text-muted">
          <Link href="/cheat-sheets" className="underline hover:text-fg">or browse every sheet first →</Link>
        </p>
      )}
    </div>
  );
}
