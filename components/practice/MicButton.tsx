"use client";

import { useSpeechRecognition } from "@/lib/hooks/useSpeechRecognition";
import { cn } from "@/lib/utils";

/** Dictation mic — appends transcribed speech via onText. Hidden if unsupported. */
export function MicButton({
  onText,
  className,
}: {
  onText: (t: string) => void;
  className?: string;
}) {
  const { supported, listening, toggle } = useSpeechRecognition(onText);
  if (!supported) return null;
  return (
    <button
      type="button"
      onClick={toggle}
      title={listening ? "Stop dictation" : "Dictate your answer"}
      aria-label="Voice input"
      className={cn(
        "grid h-9 w-9 flex-none place-items-center rounded-full border border-border text-muted hover:text-fg",
        listening && "border-danger/40 bg-danger/10 text-danger",
        className
      )}
    >
      {listening ? (
        <svg viewBox="0 0 16 16" className="h-4 w-4 animate-pulse" fill="currentColor"><rect x="4" y="4" width="8" height="8" rx="1.5" /></svg>
      ) : (
        <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="6" y="2" width="4" height="7" rx="2" /><path d="M4 8a4 4 0 0 0 8 0M8 12v2" strokeLinecap="round" /></svg>
      )}
    </button>
  );
}
