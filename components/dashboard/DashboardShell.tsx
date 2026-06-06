import { Sidebar } from "./Sidebar";
import type { Level, SheetCategory } from "@/lib/types";

/** Two-panel dashboard layout: fixed sidebar + scrollable main. */
export function DashboardShell({
  tool,
  level,
  owned,
  hasBundle,
  categories,
  activeQuestionId,
  children,
}: {
  tool: string;
  level: Level;
  owned: string[];
  hasBundle: boolean;
  categories: SheetCategory[];
  activeQuestionId?: number;
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen overflow-hidden bg-card">
      <Sidebar
        tool={tool}
        level={level}
        owned={owned}
        hasBundle={hasBundle}
        categories={categories}
        activeQuestionId={activeQuestionId}
      />
      <main className="flex-1 overflow-y-auto scroll-thin">
        <div className="mx-auto max-w-4xl px-6 py-8 lg:px-10">{children}</div>
      </main>
    </div>
  );
}
