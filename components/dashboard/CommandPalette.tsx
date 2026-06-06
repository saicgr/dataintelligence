"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { cn } from "@/lib/utils";

export interface PaletteItem {
  id: number;
  questionText: string;
  url: string;
}

/** ⌘K / Ctrl+K fuzzy question jumper. */
export function CommandPalette({ items }: { items: PaletteItem[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActive(0);
      // focus after mount
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? items.filter((it) => it.questionText.toLowerCase().includes(q))
      : items;
    return list.slice(0, 20);
  }, [query, items]);

  useEffect(() => {
    setActive(0);
  }, [query]);

  const go = (item: PaletteItem | undefined) => {
    if (!item) return;
    setOpen(false);
    router.push(item.url);
  };

  return (
    <Modal open={open} onClose={() => setOpen(false)} className="max-w-xl">
      <div className="border-b border-border p-3">
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((a) => Math.min(a + 1, results.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => Math.max(a - 1, 0));
            } else if (e.key === "Enter") {
              e.preventDefault();
              go(results[active]);
            }
          }}
          placeholder="Search questions…"
          className="w-full bg-transparent px-2 py-2 text-base text-fg placeholder:text-muted focus:outline-none"
        />
      </div>
      <ul className="max-h-80 overflow-y-auto p-2 scroll-thin">
        {results.length === 0 ? (
          <li className="px-3 py-6 text-center text-sm text-muted">
            No matching questions.
          </li>
        ) : (
          results.map((it, i) => (
            <li key={it.id}>
              <button
                type="button"
                onMouseEnter={() => setActive(i)}
                onClick={() => go(it)}
                className={cn(
                  "block w-full truncate rounded-lg px-3 py-2 text-left text-sm",
                  i === active
                    ? "bg-navy text-white dark:bg-accent dark:text-accent-fg"
                    : "text-fg hover:bg-surface"
                )}
              >
                {it.questionText}
              </button>
            </li>
          ))
        )}
      </ul>
      <div className="flex items-center justify-end gap-3 border-t border-border px-3 py-2 text-[11px] text-muted">
        <span>↑↓ navigate</span>
        <span>↵ open</span>
        <span>esc close</span>
      </div>
    </Modal>
  );
}
