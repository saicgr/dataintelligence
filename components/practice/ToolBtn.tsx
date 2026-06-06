"use client";

const ICONS: Record<string, React.ReactNode> = {
  copy: (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="5" y="5" width="8" height="8" rx="1.5" /><path d="M3 11V4a1 1 0 0 1 1-1h7" /></svg>
  ),
  ai: (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M8 2l1.2 2.8L12 6l-2.8 1.2L8 10 6.8 7.2 4 6l2.8-1.2z" strokeLinejoin="round" /><circle cx="12.5" cy="11.5" r="1.2" /></svg>
  ),
  hint: (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M8 2a4 4 0 0 1 2.5 7.1c-.4.3-.5.6-.5 1V11H6v-.9c0-.4-.1-.7-.5-1A4 4 0 0 1 8 2z" /><path d="M6.5 13.5h3" strokeLinecap="round" /></svg>
  ),
};

export function ToolBtn({
  label,
  onClick,
  icon,
  disabled,
}: {
  label: string;
  onClick: () => void;
  icon: keyof typeof ICONS | string;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-muted transition-colors hover:bg-surface hover:text-fg disabled:opacity-40"
    >
      {ICONS[icon] ?? null}
      {label}
    </button>
  );
}
