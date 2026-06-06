import type { Metadata } from "next";
import { getPracticeItems } from "@/lib/data/practice";
import { getCurrentUser } from "@/lib/entitlements";
import { hasGemini } from "@/lib/env";
import { PlanBuilder } from "@/components/practice/PlanBuilder";

export const metadata: Metadata = {
  title: "Target a role — build your interview prep plan",
  description:
    "Paste a job description or pick a company and role. Get the predicted interview loop, a readiness score, and an ordered practice plan tailored to that job.",
};

export default async function PlanPage() {
  const items = getPracticeItems().map((it) => ({
    id: it.id,
    title: it.title,
    category: it.category,
    level: it.level,
    company: it.company,
    free: it.free,
  }));
  const user = await getCurrentUser();
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <PlanBuilder items={items} practicePro={user.practicePro} hasAi={hasGemini} />
    </div>
  );
}
