export type Track = "data_engineering" | "ai_engineering" | "core_skills";
export type Level = "junior" | "mid" | "senior";
export type Risk = "low" | "medium" | "high";
export type Confidence = "low" | "medium" | "high";

export interface FollowUp {
  question: string;
  answer: string;
}
export interface RedFlag {
  junior: string;
  senior: string;
}

/** Languages a code example can be tagged with (display only — no execution). */
export type CodeLang = "sql" | "python" | "pyspark" | "airflow" | "dbt" | "ts";

/**
 * A labelled code example attached to a question's answer. `accent: "bug" | "fix"`
 * is the canonical "show me the bug and the fix" pair; plain panels (no accent) are
 * single illustrative snippets. Kept structurally identical to the mobile app's
 * CodePanel so the two surfaces stay in sync. `lines` are pre-split.
 */
export interface CodeExample {
  label?: string;
  lang?: CodeLang;
  lines: string[];
  accent?: "bug" | "fix";
}

export interface Question {
  id: number;
  categorySlug: string;
  toolSlug: string;
  level: Level;
  sortOrder: number;
  questionText: string;
  answerStructured: string; // markdown-ish bullet block
  explanationDeep: string; // 2-3 paragraphs
  code?: CodeExample[]; // real code examples shown under the answer (bug/fix etc.)
  interviewerLens: string; // "what I'm actually listening for"
  riskLevel: Risk;
  isComparison: boolean;
  comparisonTools?: string[];
  followupChain: FollowUp[];
  redFlags: RedFlag[];
  alternatePhrasings: string[];
  interviewContexts: string[];
  askedCount: number;
  isFreePreview: boolean;
}

/** Lightweight item used for collapsed categories (Quick Reference, Red Flags, etc.). */
export interface QuestionStub {
  id: number;
  categorySlug: string;
  toolSlug: string;
  level: Level;
  sortOrder: number;
  questionText: string;
  riskLevel: Risk;
  askedCount: number;
}

export interface SheetCategory {
  slug: string;
  name: string;
  icon: string;
  description: string;
  expanded: boolean;
  questions: QuestionStub[];
}

export interface Job {
  id: number | string;
  title: string;
  company: string;
  location: string;
  level: Level;
  tools: string[];
  url: string;
  source: string;
  postedAt: string; // ISO date
}

export interface SalaryBenchmark {
  id: number;
  role: string;
  toolSlug: string;
  level: Level;
  region: string;
  currency: string;
  min: number;
  median: number;
  max: number;
  year: number;
}

export interface Drill {
  id: number;
  track: Track;
  toolSlug: string;
  level: Level;
  prompt: string;
  choices: string[];
  correctIndex: number;
  explanation: string;
  xp: number;
}

export interface QuizQuestion {
  id: string;
  toolSlug: string;
  level: Level;
  area: string;
  prompt: string;
  choices: string[];
  correctIndex: number;
}

export interface GlossaryTerm {
  slug: string;
  term: string;
  toolSlug: string;
  short: string;
  body: string;
}

export interface BlogPost {
  slug: string;
  title: string;
  excerpt: string;
  date: string;
  tool?: string;
  body: string; // markdown
}

/** Grade returned by the simulation grader. */
export interface SimGrade {
  score: number; // 0-100
  verdict: string;
  strengths: string[];
  gaps: string[];
  interviewerWants: string;
  source: "ai" | "self";
}
