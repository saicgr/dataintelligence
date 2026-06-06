"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { TOOL_BY_SLUG } from "@/lib/catalog";
import { cn } from "@/lib/utils";

interface PrefQuestion {
  id: string;
  prompt: string;
  options: { label: string; scores: Record<string, number> }[];
}

// Scores accumulate onto tool slugs from the catalog.
const QUESTIONS: PrefQuestion[] = [
  {
    id: "workload",
    prompt: "What kind of data work pulls you in?",
    options: [
      {
        label: "Real-time streams & events",
        scores: { kafka: 3, spark: 1 },
      },
      {
        label: "Batch pipelines & warehouses",
        scores: { snowflake: 3, dbt: 2 },
      },
      {
        label: "Building with LLMs & AI",
        scores: { llms: 3, rag: 1, agents: 1 },
      },
    ],
  },
  {
    id: "language",
    prompt: "Where are you most comfortable?",
    options: [
      { label: "SQL all day", scores: { snowflake: 2, dbt: 3 } },
      { label: "Python & distributed compute", scores: { spark: 3, databricks: 2 } },
      { label: "Prompting & API calls", scores: { llms: 3, agents: 1 } },
    ],
  },
  {
    id: "architecture",
    prompt: "Warehouse or lakehouse?",
    options: [
      { label: "Cloud warehouse", scores: { snowflake: 3 } },
      { label: "Lakehouse / Delta", scores: { databricks: 3, spark: 1 } },
      { label: "Orchestrating the whole flow", scores: { airflow: 3 } },
    ],
  },
  {
    id: "ai",
    prompt: "How interested are you in AI/LLMs?",
    options: [
      { label: "Very — I want to ship AI features", scores: { llms: 2, rag: 2, agents: 1 } },
      { label: "Retrieval & search excite me", scores: { rag: 3, vectordb: 2 } },
      { label: "Not really — keep me in pipelines", scores: { airflow: 2, dbt: 1, snowflake: 1 } },
    ],
  },
  {
    id: "depth",
    prompt: "What do you enjoy optimizing?",
    options: [
      { label: "Query cost & performance", scores: { snowflake: 2, spark: 2 } },
      { label: "Search relevance & embeddings", scores: { vectordb: 3, rag: 1 } },
      { label: "Reliability & scheduling", scores: { airflow: 3, kafka: 1 } },
    ],
  },
];

export default function WhatToolQuizPage() {
  const [index, setIndex] = useState(0);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [done, setDone] = useState(false);

  const total = QUESTIONS.length;
  const current = QUESTIONS[index];

  function choose(opt: PrefQuestion["options"][number]) {
    setScores((prev) => {
      const next = { ...prev };
      for (const [slug, pts] of Object.entries(opt.scores)) {
        next[slug] = (next[slug] ?? 0) + pts;
      }
      return next;
    });
    if (index + 1 >= total) setDone(true);
    else setIndex((i) => i + 1);
  }

  function restart() {
    setIndex(0);
    setScores({});
    setDone(false);
  }

  const winnerSlug =
    Object.entries(scores).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "snowflake";
  const winner = TOOL_BY_SLUG[winnerSlug];

  if (done && winner) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10">
        <Card className="text-center">
          <div className="text-sm font-semibold uppercase tracking-wide text-muted">
            Your next tool to learn
          </div>
          <div className="mt-4 text-6xl">{winner.icon}</div>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-fg">
            {winner.name}
          </h1>
          <div className="mt-3 flex justify-center">
            <Badge tone="navy">
              {winner.track === "ai_engineering"
                ? "AI Engineering"
                : "Data Engineering"}
            </Badge>
          </div>
          <p className="mx-auto mt-4 max-w-md text-muted">{winner.blurb}</p>

          <div className="mt-7 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <ButtonLink
              href={`/interview-questions/${winner.slug}/senior`}
              variant="amber"
              size="lg"
            >
              See {winner.name} interview questions →
            </ButtonLink>
            <Button variant="outline" onClick={restart}>
              Retake quiz
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <div className="text-center">
        <h1 className="text-3xl font-extrabold tracking-tight text-fg sm:text-4xl">
          What tool should I learn next?
        </h1>
        <p className="mx-auto mt-3 max-w-lg text-muted">
          Five quick questions. We&apos;ll point you at the tool that fits how you
          like to work — and the interview sheet to go with it.
        </p>
      </div>

      <Card className="mt-8">
        <div className="mb-4 flex items-center justify-between">
          <Badge tone="navy">
            {index + 1} / {total}
          </Badge>
        </div>
        <ProgressBar value={(index / total) * 100} />

        <h2 className="mt-5 text-xl font-bold text-fg">{current.prompt}</h2>
        <div className="mt-5 grid gap-3">
          {current.options.map((opt, i) => (
            <button
              key={i}
              onClick={() => choose(opt)}
              className={cn(
                "rounded-xl border border-border bg-card px-4 py-3 text-left text-sm font-medium text-fg transition-colors hover:border-navy hover:bg-surface"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </Card>
    </div>
  );
}
