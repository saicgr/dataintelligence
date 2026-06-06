import type { Metadata } from "next";
import { getPracticeItems, toClientItems } from "@/lib/data/practice";
import { getCurrentUser } from "@/lib/entitlements";
import { hasGemini } from "@/lib/env";
import { MockSession } from "@/components/practice/MockSession";

export const metadata: Metadata = {
  title: "Mock Interview — a timed, graded run",
  description:
    "A timed mock interview: mixed questions, one at a time, no answers shown — then a report card with your score, weak areas, and what to study next.",
};

export default async function MockPage() {
  const items = getPracticeItems();
  const user = await getCurrentUser();
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <MockSession items={toClientItems(items)} hasAi={hasGemini} practicePro={user.practicePro} />
    </div>
  );
}
