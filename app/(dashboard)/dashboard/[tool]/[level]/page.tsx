import { notFound } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { DashboardMain } from "@/components/dashboard/DashboardMain";
import { LockedPreview } from "@/components/dashboard/LockedPreview";
import { getCurrentUser, ownsSheet } from "@/lib/entitlements";
import { getSheetCategories, getFreePreview } from "@/lib/data";
import { isValidTool, isValidLevel } from "@/lib/catalog";
import type { Level } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function SheetPage({
  params,
}: {
  params: { tool: string; level: string };
}) {
  const { tool, level } = params;
  if (!isValidTool(tool) || !isValidLevel(level)) notFound();
  const lvl = level as Level;

  const user = await getCurrentUser();
  const categories = getSheetCategories(tool, lvl);
  const owns = ownsSheet(user, tool, lvl);
  const preview = owns ? null : getFreePreview(tool, lvl);

  return (
    <DashboardShell
      tool={tool}
      level={lvl}
      owned={Array.from(user.owned)}
      hasBundle={user.hasFullBundle}
      categories={categories}
    >
      <nav className="mb-4 flex items-center gap-1.5 text-sm text-muted">
        <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6">
          <path d="M2 7l6-5 6 5M4 6v7h8V6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span>Dashboard</span>
      </nav>

      <h1 className="text-2xl font-bold text-fg">Your Prep Dashboard</h1>
      <p className="mt-1 text-sm text-muted">
        Mark entries as practiced to track your progress.
      </p>

      <div className="mt-6">
        {owns ? (
          <DashboardMain tool={tool} level={lvl} categories={categories} />
        ) : (
          <LockedPreview tool={tool} level={lvl} preview={preview} />
        )}
      </div>
    </DashboardShell>
  );
}
