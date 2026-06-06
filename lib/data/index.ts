import type { Level, Question, SheetCategory, SalaryBenchmark, Drill, GlossaryTerm, BlogPost, QuizQuestion, Track } from "../types";
import {
  buildSheet,
  buildSheetQuestions,
  allQuestions,
  buildQuiz,
  SEED_SALARIES,
  SEED_DRILLS,
  SEED_GLOSSARY,
  SEED_BLOG,
  salarySlug,
} from "./seed";

/**
 * Content data access. Content is static and ships in the bundle (seed.ts),
 * identical to supabase/seed.sql. User state (progress, entitlements) lives in
 * Supabase via lib/entitlements + the progress provider. This keeps reads fast
 * and the app fully functional with zero keys.
 */

export function getSheetCategories(tool: string, level: Level): SheetCategory[] {
  return buildSheet(tool, level);
}

export function getSheetQuestions(tool: string, level: Level): Question[] {
  return buildSheetQuestions(tool, level);
}

export function getQuestion(
  tool: string,
  level: Level,
  id: number
): { question: Question; prevId: number | null; nextId: number | null } | null {
  const qs = getSheetQuestions(tool, level);
  const idx = qs.findIndex((q) => q.id === id);
  if (idx === -1) return null;
  return {
    question: qs[idx],
    prevId: idx > 0 ? qs[idx - 1].id : null,
    nextId: idx < qs.length - 1 ? qs[idx + 1].id : null,
  };
}

export function getQuestionById(id: number): Question | null {
  return allQuestions().find((q) => q.id === id) ?? null;
}

export function getFreePreview(tool: string, level: Level): Question | null {
  const qs = getSheetQuestions(tool, level);
  return qs.find((q) => q.isFreePreview) ?? qs[0] ?? null;
}

/** Sample (free-preview) questions for a public landing page. */
export function getSampleQuestions(tool: string, level: Level, n = 3): Question[] {
  const qs = getSheetQuestions(tool, level);
  const previews = qs.filter((q) => q.isFreePreview);
  const rest = qs.filter((q) => !q.isFreePreview && q.categorySlug === "deep-dives");
  return [...previews, ...rest].slice(0, n);
}

export function getComparisonQuestions(): Question[] {
  return allQuestions().filter((q) => q.isComparison);
}

export function getMostAsked(limit = 25): Question[] {
  return [...allQuestions()]
    .sort((a, b) => b.askedCount - a.askedCount)
    .slice(0, limit);
}

export function getQuestionOfTheDay(dayKey: number): Question {
  const all = allQuestions().filter((q) => q.isFreePreview || q.askedCount > 10);
  const pool = all.length ? all : allQuestions();
  return pool[dayKey % pool.length];
}

export function getQuiz(tool: string, level: Level): QuizQuestion[] {
  return buildQuiz(tool, level);
}

// Salaries
export function getSalaries(): SalaryBenchmark[] {
  return SEED_SALARIES;
}
export function getSalaryBySlug(slug: string): SalaryBenchmark[] {
  // a slug maps to (tool, level); return all regions for that role
  return SEED_SALARIES.filter((s) => salarySlug(s.toolSlug, s.level) === slug);
}
export { salarySlug };

// Drills
export function getDrills(filter?: { track?: Track; tool?: string }): Drill[] {
  return SEED_DRILLS.filter(
    (d) =>
      (!filter?.track || d.track === filter.track) &&
      (!filter?.tool || d.toolSlug === filter.tool)
  );
}

// Glossary
export function getGlossary(): GlossaryTerm[] {
  return SEED_GLOSSARY;
}
export function getGlossaryTerm(slug: string): GlossaryTerm | null {
  return SEED_GLOSSARY.find((g) => g.slug === slug) ?? null;
}

// Blog
export function getPosts(): BlogPost[] {
  return [...SEED_BLOG].sort((a, b) => (a.date < b.date ? 1 : -1));
}
export function getPost(slug: string): BlogPost | null {
  return SEED_BLOG.find((p) => p.slug === slug) ?? null;
}
