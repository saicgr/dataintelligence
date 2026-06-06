"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

export interface FileEntry {
  name: string; // full path (folder mode) or display name (group mode)
  group?: string; // explicit group label (group mode), e.g. "Code" / "Logs"
  badge?: number; // optional count chip (e.g. comments on this file)
  dot?: string; // optional tailwind bg-* class for a status dot (e.g. diff)
}

/**
 * Generic, collapsible file-explorer sidebar reused by PR review (grouped by
 * folder, with comment-count badges) and the Incident workbench (grouped by kind:
 * Code / Logs / Config). The whole sidebar collapses to a thin rail.
 */
export function FileTree({
  entries,
  active,
  onSelect,
  groupBy = "folder",
  title = "Files",
}: {
  entries: FileEntry[];
  active: string;
  onSelect: (name: string) => void;
  groupBy?: "folder" | "group";
  title?: string;
}) {
  const [open, setOpen] = useState(true);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const groupKey = (e: FileEntry) =>
    groupBy === "group" ? e.group ?? "Files" : e.name.includes("/") ? e.name.slice(0, e.name.lastIndexOf("/")) : "";
  const leaf = (e: FileEntry) =>
    groupBy === "group" ? e.name : e.name.includes("/") ? e.name.slice(e.name.lastIndexOf("/") + 1) : e.name;

  // Preserve insertion order of groups.
  const groups: { key: string; items: FileEntry[] }[] = [];
  for (const e of entries) {
    const k = groupKey(e);
    let g = groups.find((x) => x.key === k);
    if (!g) { g = { key: k, items: [] }; groups.push(g); }
    g.items.push(e);
  }

  function toggle(k: string) {
    setCollapsed((s) => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n; });
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} title="Show files" className="flex w-8 flex-none flex-col items-center gap-2 border-r border-border py-2 text-muted hover:bg-surface hover:text-fg">
        <span className="text-sm">🗂</span>
        <span className="text-[10px] font-semibold uppercase tracking-wider [writing-mode:vertical-rl]">Files</span>
      </button>
    );
  }

  return (
    <aside className="flex w-52 flex-none flex-col overflow-y-auto border-r border-border bg-card/50 scroll-thin">
      <div className="flex items-center gap-1 border-b border-border px-2 py-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted">{title}</span>
        <button onClick={() => setOpen(false)} title="Hide files" className="ml-auto grid h-5 w-5 place-items-center rounded text-muted hover:bg-surface hover:text-fg">
          <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M10 4l-4 4 4 4" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
      </div>
      <div className="py-1">
        {groups.map((g) => {
          const isCollapsed = collapsed.has(g.key);
          return (
            <div key={g.key || "_root"}>
              {g.key !== "" && (
                <button onClick={() => toggle(g.key)} className="flex w-full items-center gap-1 px-2 py-1 text-left text-[11px] font-medium text-muted hover:text-fg">
                  <span className="text-[9px]">{isCollapsed ? "▸" : "▾"}</span>
                  <span className="truncate font-mono">{g.key}</span>
                </button>
              )}
              {!isCollapsed && g.items.map((e) => (
                <button
                  key={e.name}
                  onClick={() => onSelect(e.name)}
                  className={cn(
                    "flex w-full items-center gap-1.5 py-1 pr-2 text-left font-mono text-xs",
                    g.key !== "" ? "pl-5" : "pl-3",
                    active === e.name ? "bg-navy/10 text-navy dark:bg-accent/15 dark:text-accent" : "text-fg hover:bg-surface"
                  )}
                >
                  {e.dot && <span className={cn("inline-block h-1.5 w-1.5 shrink-0 rounded-full", e.dot)} />}
                  <span className="truncate">{leaf(e)}</span>
                  {typeof e.badge === "number" && e.badge > 0 && (
                    <span className="ml-auto rounded-full bg-amber/20 px-1 text-[10px] font-semibold text-amber">{e.badge}</span>
                  )}
                </button>
              ))}
            </div>
          );
        })}
      </div>
    </aside>
  );
}
