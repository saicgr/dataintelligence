/** Amber-accented "what I'm actually listening for" panel. */
export function InterviewerLens({ text }: { text: string }) {
  return (
    <div className="rounded-r-xl border-l-4 border-amber bg-amber/5 px-5 py-4">
      <div className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-amber">
        <span aria-hidden>👁</span> The Interviewer&apos;s Lens
      </div>
      <p className="text-sm leading-relaxed text-fg">{text}</p>
    </div>
  );
}
