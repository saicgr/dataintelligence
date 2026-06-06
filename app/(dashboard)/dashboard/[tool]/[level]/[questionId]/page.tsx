import { notFound } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { QuestionDetail } from "@/components/dashboard/QuestionDetail";
import { Card } from "@/components/ui/Card";
import { ButtonLink } from "@/components/ui/Button";
import { getCurrentUser, ownsSheet } from "@/lib/entitlements";
import { getQuestion, getSheetCategories } from "@/lib/data";
import {
  isValidTool,
  isValidLevel,
  sheetTitle,
  BUNDLE_PRICE,
} from "@/lib/catalog";
import type { Level } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function QuestionPage({
  params,
}: {
  params: { tool: string; level: string; questionId: string };
}) {
  const { tool, level, questionId } = params;
  if (!isValidTool(tool) || !isValidLevel(level)) notFound();
  const lvl = level as Level;

  const id = Number(questionId);
  if (!Number.isFinite(id)) notFound();

  const result = getQuestion(tool, lvl, id);
  if (!result) notFound();
  const { question, prevId, nextId } = result;

  const user = await getCurrentUser();
  const owns = ownsSheet(user, tool, lvl);
  const categories = getSheetCategories(tool, lvl);

  const locked = !owns && !question.isFreePreview;

  return (
    <DashboardShell
      tool={tool}
      level={lvl}
      owned={Array.from(user.owned)}
      hasBundle={user.hasFullBundle}
      categories={categories}
      activeQuestionId={id}
    >
      {locked ? (
        <Card className="text-center">
          <div className="mx-auto max-w-md py-6">
            <div className="mb-3 text-3xl" aria-hidden>
              🔒
            </div>
            <h1 className="text-xl font-bold text-fg">
              This question is locked
            </h1>
            <p className="mt-2 text-sm text-muted">
              Unlock the full {sheetTitle(tool, lvl)} sheet to read the answer,
              the interviewer&apos;s lens, follow-ups and red-flag phrases.
            </p>
            <div className="mt-5 flex flex-col items-center justify-center gap-2 sm:flex-row">
              <ButtonLink
                href="/buy?bundle=1"
                variant="amber"
              >
                Unlock all cheat sheets — {BUNDLE_PRICE}
              </ButtonLink>
            </div>
          </div>
        </Card>
      ) : (
        <QuestionDetail
          question={question}
          tool={tool}
          level={lvl}
          prevId={prevId}
          nextId={nextId}
        />
      )}
    </DashboardShell>
  );
}
