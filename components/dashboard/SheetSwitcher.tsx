"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { Modal } from "@/components/ui/Modal";
import { TRACKS, LEVELS, toolsByTrack, BUNDLE_PRICE } from "@/lib/catalog";
import type { Level } from "@/lib/types";
import { cn } from "@/lib/utils";

export function SheetSwitcher({
  open,
  onClose,
  currentTool,
  currentLevel,
  owned,
  hasBundle,
}: {
  open: boolean;
  onClose: () => void;
  currentTool: string;
  currentLevel: Level;
  owned: string[];
  hasBundle: boolean;
}) {
  const router = useRouter();
  const ownedSet = new Set(owned);
  const isOwned = (tool: string, level: Level) =>
    hasBundle || ownedSet.has(`${tool}:${level}`);

  const go = (tool: string, level: Level) => {
    onClose();
    router.push(`/dashboard/${tool}/${level}`);
  };

  return (
    <Modal open={open} onClose={onClose} className="max-w-3xl" labelledBy="switch-title">
      <div className="flex items-center justify-between border-b border-border px-6 py-4">
        <div>
          <h2 id="switch-title" className="text-lg font-bold">
            Switch sheet
          </h2>
          <p className="text-sm text-muted">
            Pick a tool and level. Owned sheets switch instantly.
          </p>
        </div>
        <button
          onClick={onClose}
          className="rounded-full p-1.5 text-muted hover:bg-surface"
          aria-label="Close"
        >
          <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M5 5l10 10M15 5L5 15" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <div className="max-h-[60vh] space-y-6 overflow-y-auto px-6 py-5 scroll-thin">
        {TRACKS.map((track) => (
          <div key={track.slug}>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-amber">
              {track.name}
            </h3>
            <div className="overflow-hidden rounded-xl border border-border">
              <div className="grid grid-cols-[1.4fr_1fr_1fr_1fr] bg-surface text-xs font-semibold uppercase tracking-wide text-muted">
                <div className="px-3 py-2">Tool</div>
                {LEVELS.map((l) => (
                  <div key={l.slug} className="px-3 py-2 text-center">
                    {l.name}
                  </div>
                ))}
              </div>
              {toolsByTrack(track.slug).map((tool) => (
                <div
                  key={tool.slug}
                  className="grid grid-cols-[1.4fr_1fr_1fr_1fr] items-stretch border-t border-border"
                >
                  <div className="flex items-center gap-2 px-3 py-2 text-sm font-medium">
                    <span>{tool.icon}</span>
                    <span className="truncate">{tool.name}</span>
                  </div>
                  {LEVELS.map((l) => {
                    const ownedCell = isOwned(tool.slug, l.slug);
                    const isCurrent =
                      tool.slug === currentTool && l.slug === currentLevel;
                    if (ownedCell) {
                      return (
                        <button
                          key={l.slug}
                          onClick={() => go(tool.slug, l.slug)}
                          className={cn(
                            "m-1 flex items-center justify-center gap-1 rounded-lg border px-2 py-2 text-xs font-semibold transition-colors",
                            isCurrent
                              ? "border-navy bg-navy text-white dark:border-accent dark:bg-accent dark:text-accent-fg"
                              : "border-border hover:border-navy/40 hover:bg-surface"
                          )}
                        >
                          {isCurrent ? "Current" : "Open"}
                        </button>
                      );
                    }
                    return (
                      <Link
                        key={l.slug}
                        href="/buy?bundle=1"
                        onClick={onClose}
                        aria-label={`Unlock ${tool.name} ${l.name}`}
                        className="m-1 flex items-center justify-center gap-1 rounded-lg border border-dashed border-border px-2 py-2 text-xs font-medium text-muted transition-colors hover:border-amber/50 hover:text-amber"
                      >
                        <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="1.6">
                          <rect x="3" y="7" width="10" height="6" rx="1" />
                          <path d="M5 7V5a3 3 0 016 0v2" />
                        </svg>
                        Unlock
                      </Link>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {!hasBundle && (
        <div className="flex flex-col items-center justify-between gap-3 border-t border-border bg-surface px-6 py-4 sm:flex-row">
          <div className="text-sm">
            <span className="font-semibold">Unlock everything</span>
            <span className="text-muted">
              {" "}
              — all 10 tools, all 3 levels, both tracks.
            </span>
          </div>
          <Link
            href="/buy?bundle=1"
            onClick={onClose}
            className="rounded-full bg-navy px-5 py-2.5 text-sm font-semibold text-white hover:bg-navy/90 dark:bg-accent dark:text-accent-fg"
          >
            Get Full Access · {BUNDLE_PRICE}
          </Link>
        </div>
      )}
    </Modal>
  );
}
