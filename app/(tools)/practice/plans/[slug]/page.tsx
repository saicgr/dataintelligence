import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getStudyPlan, STUDY_PLANS } from "@/lib/data/practice/study-plans";
import { getPracticeItem } from "@/lib/data/practice";
import { PlanChecklist, type PlanSectionView } from "@/components/practice/PlanChecklist";

export function generateStaticParams() {
  return STUDY_PLANS.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const plan = getStudyPlan(slug);
  if (!plan) return { title: "Study plan" };
  return { title: `${plan.name} — study plan`, description: plan.blurb };
}

export default async function StudyPlanPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const plan = getStudyPlan(slug);
  if (!plan) notFound();

  // Resolve item metadata server-side (no answer keys needed for the checklist).
  const sections: PlanSectionView[] = plan.sections.map((s) => ({
    title: s.title,
    blurb: s.blurb,
    items: s.itemIds
      .map((id) => getPracticeItem(id))
      .filter((it): it is NonNullable<typeof it> => it != null)
      .map((it) => ({ id: it.id, title: it.title, category: it.category, level: it.level, company: it.company, difficulty: it.difficulty, free: it.free })),
  }));

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <Link href="/practice/plans" className="text-sm font-medium text-muted hover:text-fg">← All study plans</Link>
      <h1 className="mt-3 text-3xl font-bold tracking-tight text-fg sm:text-4xl">{plan.name}</h1>
      <p className="mt-2 max-w-2xl text-muted">{plan.blurb}</p>
      <div className="mt-6">
        <PlanChecklist sections={sections} />
      </div>
    </div>
  );
}
