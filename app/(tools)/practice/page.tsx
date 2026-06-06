import type { Metadata } from "next";
import { Suspense } from "react";
import { getPracticeItems, toClientItems } from "@/lib/data/practice";
import { getCurrentUser } from "@/lib/entitlements";
import { hasGemini } from "@/lib/env";
import { PracticeBrowser } from "@/components/practice/PracticeBrowser";

export const metadata: Metadata = {
  title: "Practice — real SQL execution + an AI interviewer",
  description:
    "Mock interviews like the real thing: SQL that runs against a live dataset, plus Python, PySpark, AI, Prompt Engineering, Code Review and Case Study questions coached and graded by an AI interviewer.",
};

export default async function PracticePage() {
  const items = getPracticeItems();
  const user = await getCurrentUser();
  return (
    <div className="px-4 py-6 sm:px-6">
      <Suspense fallback={null}>
        <PracticeBrowser items={toClientItems(items)} hasAi={hasGemini} practicePro={user.practicePro} />
      </Suspense>
    </div>
  );
}
