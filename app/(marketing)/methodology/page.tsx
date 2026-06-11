import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/Button";
import { SITE_NAME, BUNDLE_PRICE } from "@/lib/catalog";

export const metadata: Metadata = {
  title: "How these are made — methodology",
  description:
    "How ByteShards builds its interview questions: researched from how real loops run, written with the interviewer's lens, and fact-checked against the official docs.",
};

const STEPS = [
  {
    n: "01",
    title: "Researched from how real loops run",
    body: "We study how data & AI interviews actually go — public interview reports and debriefs, practitioner input, and the day-to-day realities of each tool. The goal is the questions that genuinely come up, not textbook trivia.",
  },
  {
    n: "02",
    title: "Written from the interviewer's side",
    body: "Each question is written up with the answer that lands, the Interviewer's Lens (what they're really listening for), red/green-zone phrasing, and the follow-up chain — so you read the room, not just recite a definition.",
  },
  {
    n: "03",
    title: "Fact-checked against the official docs",
    body: "Answers are cross-checked against primary sources — the official documentation for Snowflake, Spark, dbt, Kafka, Databricks and the rest — so the technical claims hold up under a senior interviewer's scrutiny.",
  },
  {
    n: "04",
    title: "Kept current",
    body: "Tools change. We revise questions and answers as the platforms and the interview bar move, and we fold in signal from readers who tell us what they were actually asked.",
  },
];

const FAQ = [
  {
    q: "Where do these questions come from?",
    a: "They're compiled from how real data & AI interviews run — public interview reports, practitioners, and the realities of each tool — then written with the interviewer's perspective and fact-checked against official documentation. They're not transcripts of specific interviews.",
  },
  {
    q: "Do you claim a specific company asked a specific question?",
    a: "No. We describe questions by role, level and the kind of team that asks them (anonymized archetypes) — never “Company X asks exactly this.”",
  },
  {
    q: "Is the content AI-written?",
    a: "It's drafted with AI from researched sources, then fact-checked against the official docs and the interviewer's lens applied. We use AI to assemble and organize — the grounding is real source material, not invention.",
  },
  {
    q: "How is this different from a generic study guide?",
    a: "Two things: the interviewer's-lens framing (what they're actually scoring), and the practice workspace where you run SQL/Python/PySpark and get graded. It's built to mirror the loop, not just list facts.",
  },
];

export default function MethodologyPage() {
  return (
    <div className="px-4 py-16">
      <div className="mx-auto max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber">Methodology</p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight text-fg sm:text-5xl">How these are made</h1>
        <p className="mt-4 text-lg text-muted">
          {SITE_NAME} is built to mirror how interviews actually run — researched, written from the
          interviewer&apos;s side, and fact-checked against the docs. Here&apos;s exactly how.
        </p>

        <div className="mt-12 space-y-8">
          {STEPS.map((s) => (
            <div key={s.n} className="flex gap-5">
              <div className="grid h-11 w-11 flex-none place-items-center rounded-full bg-amber/15 text-sm font-bold text-amber">{s.n}</div>
              <div>
                <h2 className="text-lg font-bold tracking-tight text-fg">{s.title}</h2>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">{s.body}</p>
              </div>
            </div>
          ))}
        </div>

        <h2 className="mt-16 text-2xl font-bold tracking-tight text-fg">FAQ</h2>
        <div className="mt-6 space-y-6">
          {FAQ.map((f) => (
            <div key={f.q}>
              <p className="font-semibold text-fg">{f.q}</p>
              <p className="mt-1 text-sm leading-relaxed text-muted">{f.a}</p>
            </div>
          ))}
        </div>

        <div className="mt-14 rounded-2xl border border-amber/40 bg-card p-8 text-center shadow-lift">
          <h2 className="text-2xl font-bold tracking-tight text-fg">See the questions for yourself</h2>
          <p className="mx-auto mt-2 max-w-md text-muted">Browse the cheat sheets, or try the free practice questions.</p>
          <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <ButtonLink href="/cheat-sheets" variant="amber" size="lg">Browse cheat sheets — {BUNDLE_PRICE}</ButtonLink>
            <ButtonLink href="/practice" variant="outline" size="lg">Try practice free</ButtonLink>
          </div>
        </div>
      </div>
    </div>
  );
}
