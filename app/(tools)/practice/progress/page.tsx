import type { Metadata } from "next";
import { countByCategory, PRACTICE_CATEGORIES } from "@/lib/data/practice";
import { ProgressDashboard } from "@/components/practice/ProgressDashboard";

export const metadata: Metadata = {
  title: "Your readiness — practice progress & streaks",
  description:
    "Track your interview readiness: mastery per skill, your study streak, what's due for review, and a shareable progress card.",
};

export default function ProgressPage() {
  const totals = countByCategory();
  const categories = PRACTICE_CATEGORIES.map((c) => ({
    slug: c.slug,
    name: c.name,
    total: totals[c.slug] ?? 0,
  })).filter((c) => c.total > 0);
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <ProgressDashboard categories={categories} />
    </div>
  );
}
