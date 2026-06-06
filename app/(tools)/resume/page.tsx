import type { Metadata } from "next";
import { ResumeOptimizer } from "@/components/resume/ResumeOptimizer";

export const metadata: Metadata = {
  title: "Free ATS résumé optimizer for data & AI engineers",
  description:
    "Paste your résumé and a target job description. Get an ATS score, the keywords you're missing, and a rewritten résumé tailored to the role — free.",
};

export default function ResumePage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <ResumeOptimizer />
    </div>
  );
}
