"use client";

import { useRef, useState } from "react";
import { cn } from "@/lib/utils";

type Pt = { x: number; y: number };
export type Shape =
  | { kind: "path"; points: Pt[]; color: string }
  | { kind: "box"; x: number; y: number; w: number; h: number; color: string }
  | { kind: "arrow"; x1: number; y1: number; x2: number; y2: number; color: string }
  | { kind: "text"; x: number; y: number; text: string; color: string };

type Tool = "pen" | "box" | "arrow" | "text";

const COLORS = ["#1f3a5f", "#2f6df6", "#7c5cff", "#16a34a", "#ea8a2e", "#dc2626"];
const TOOLS: { id: Tool; label: string; icon: string }[] = [
  { id: "pen", label: "Pen", icon: "M3 13l7-7 4 4-7 7H3v-4z" },
  { id: "box", label: "Box", icon: "M3 4h10v8H3z" },
  { id: "arrow", label: "Arrow", icon: "M3 8h9m0 0l-3-3m3 3l-3 3" },
  { id: "text", label: "Label", icon: "M4 4h8M8 4v8" },
];

/** Lightweight architecture whiteboard for System Design practice — sketch components, flows, labels. */
export function Whiteboard({ shapes, onChange }: { shapes: Shape[]; onChange: (s: Shape[]) => void }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [tool, setTool] = useState<Tool>("pen");
  const [color, setColor] = useState(COLORS[1]);
  const [draft, setDraft] = useState<Shape | null>(null);
  const startRef = useRef<Pt | null>(null);

  function pt(e: React.PointerEvent): Pt {
    const r = svgRef.current!.getBoundingClientRect();
    return { x: Math.round(e.clientX - r.left), y: Math.round(e.clientY - r.top) };
  }

  function down(e: React.PointerEvent) {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    const p = pt(e);
    startRef.current = p;
    if (tool === "pen") setDraft({ kind: "path", points: [p], color });
    else if (tool === "box") setDraft({ kind: "box", x: p.x, y: p.y, w: 0, h: 0, color });
    else if (tool === "arrow") setDraft({ kind: "arrow", x1: p.x, y1: p.y, x2: p.x, y2: p.y, color });
    else if (tool === "text") {
      const text = window.prompt("Label text:");
      if (text) onChange([...shapes, { kind: "text", x: p.x, y: p.y, text, color }]);
      startRef.current = null;
    }
  }
  function move(e: React.PointerEvent) {
    if (!draft || !startRef.current) return;
    const p = pt(e);
    const s = startRef.current;
    if (draft.kind === "path") setDraft({ ...draft, points: [...draft.points, p] });
    else if (draft.kind === "box") setDraft({ ...draft, x: Math.min(s.x, p.x), y: Math.min(s.y, p.y), w: Math.abs(p.x - s.x), h: Math.abs(p.y - s.y) });
    else if (draft.kind === "arrow") setDraft({ ...draft, x2: p.x, y2: p.y });
  }
  function up() {
    if (!draft) return;
    const keep =
      (draft.kind === "path" && draft.points.length > 1) ||
      (draft.kind === "box" && draft.w > 4 && draft.h > 4) ||
      (draft.kind === "arrow" && (Math.abs(draft.x2 - draft.x1) > 4 || Math.abs(draft.y2 - draft.y1) > 4));
    if (keep) onChange([...shapes, draft]);
    setDraft(null);
    startRef.current = null;
  }

  const all = draft ? [...shapes, draft] : shapes;

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-1.5">
        <div className="flex gap-1">
          {TOOLS.map((t) => (
            <button key={t.id} onClick={() => setTool(t.id)} title={t.label} className={cn("grid h-7 w-7 place-items-center rounded border text-fg", tool === t.id ? "border-navy bg-navy/10 dark:border-accent dark:bg-accent/10" : "border-border hover:bg-surface")}>
              <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d={t.icon} /></svg>
            </button>
          ))}
        </div>
        <div className="flex gap-1">
          {COLORS.map((c) => (
            <button key={c} onClick={() => setColor(c)} title="Color" className={cn("h-5 w-5 rounded-full border-2", c === color ? "border-fg" : "border-transparent")} style={{ background: c }} />
          ))}
        </div>
        <div className="ml-auto flex gap-1">
          <button onClick={() => onChange(shapes.slice(0, -1))} disabled={!shapes.length} className="rounded border border-border px-2.5 py-1 text-xs font-medium text-muted hover:bg-surface disabled:opacity-40">Undo</button>
          <button onClick={() => { if (shapes.length && window.confirm("Clear the whiteboard?")) onChange([]); }} disabled={!shapes.length} className="rounded border border-border px-2.5 py-1 text-xs font-medium text-muted hover:bg-surface disabled:opacity-40">Clear</button>
        </div>
      </div>
      <div className="min-h-0 flex-1 bg-surface/40">
        <svg ref={svgRef} className="h-full w-full touch-none cursor-crosshair" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerLeave={up}>
          <defs>
            <marker id="wb-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M0 0L10 5L0 10z" fill="context-stroke" />
            </marker>
          </defs>
          {all.map((s, i) => {
            if (s.kind === "path") return <path key={i} d={s.points.map((p, j) => `${j === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ")} fill="none" stroke={s.color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />;
            if (s.kind === "box") return <rect key={i} x={s.x} y={s.y} width={s.w} height={s.h} rx={6} fill={s.color + "14"} stroke={s.color} strokeWidth={2} />;
            if (s.kind === "arrow") return <line key={i} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} stroke={s.color} strokeWidth={2} markerEnd="url(#wb-arrow)" />;
            return <text key={i} x={s.x} y={s.y} fill={s.color} fontSize={14} fontWeight={600} className="select-none">{s.text}</text>;
          })}
        </svg>
      </div>
    </div>
  );
}
