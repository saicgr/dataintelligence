import { NextResponse } from "next/server";
import { geminiGenerate } from "@/lib/gemini";
import { hasGemini } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Body {
  resume: string;
  jd: string;
}

export interface ResumeResult {
  ats_score_before: number;
  ats_score_after: number;
  keywords: { matched: string[]; missing: string[] };
  improvements: string[];
  rewritten: string;
  source: "ai" | "rule";
}

// Data/AI-engineering keyword universe for the rule-based fallback + JD keyword extraction.
const KEYWORDS = [
  "SQL", "Python", "PySpark", "Spark", "Snowflake", "dbt", "Airflow", "Iceberg", "Delta Lake",
  "Kafka", "Databricks", "Redshift", "BigQuery", "Kubernetes", "Docker", "Terraform", "AWS", "GCP", "Azure",
  "ETL", "ELT", "data modeling", "data warehouse", "lakehouse", "streaming", "batch", "CI/CD",
  "machine learning", "ML", "LLM", "RAG", "vector database", "feature store", "MLOps",
  "A/B testing", "statistics", "system design", "orchestration", "governance", "Unity Catalog",
];

function score(resume: string, jd: string): { before: number; after: number; matched: string[]; missing: string[] } {
  const rl = resume.toLowerCase();
  const jl = jd.toLowerCase();
  const inJd = KEYWORDS.filter((k) => jl.includes(k.toLowerCase()));
  const target = inJd.length ? inJd : KEYWORDS;
  const matched = target.filter((k) => rl.includes(k.toLowerCase()));
  const missing = target.filter((k) => !matched.includes(k));
  const coverage = target.length ? matched.length / target.length : 0;
  const before = Math.round(45 + coverage * 50);
  const after = Math.min(98, before + Math.min(20, missing.length * 3 + 8));
  return { before, after, matched, missing };
}

function rulePlan(body: Body): ResumeResult {
  const { before, after, matched, missing } = score(body.resume, body.jd);
  const firstLine = body.jd.split("\n").find((l) => l.trim()) || "the target role";
  const rewritten = `${body.resume.trim()}

— Tailored for: ${firstLine.trim()} —

PROFESSIONAL SUMMARY (recruiter-friendly, lead with impact):
${matched.slice(0, 8).join(" · ") || "Data Engineering"}

Suggested edits (apply in your experience section):
${missing.slice(0, 6).map((k) => `• Surface "${k}" where you've used it — name the project and the measurable result.`).join("\n")}
• Rewrite each bullet to lead with the metric (latency, cost, scale, % improvement), not the task.
• Match the JD's exact phrasing for tools so keyword scanners catch them.`;
  return {
    ats_score_before: before,
    ats_score_after: after,
    keywords: { matched, missing },
    improvements: [
      "Lead every bullet with the impact metric, not the activity.",
      `Add the missing keywords (${missing.slice(0, 5).join(", ") || "—"}) where you genuinely used them.`,
      "Tighten the summary to 3 lines aimed at this specific role.",
      "Use the JD's exact tool names so ATS keyword matching catches them.",
    ],
    rewritten,
    source: "rule",
  };
}

const SYSTEM = `You are an expert technical résumé writer and ATS optimization specialist for data & AI engineering roles. Given a résumé and a target job description, rewrite the résumé to maximize ATS keyword match and recruiter impact WITHOUT inventing experience the candidate doesn't have.

Respond with ONLY valid minified JSON, no markdown:
{"ats_score_before":<0-100 int>,"ats_score_after":<0-100 int>,"keywords":{"matched":["..."],"missing":["..."]},"improvements":["specific edit 1","..."],"rewritten":"<full rewritten résumé text>"}
Score honestly: ats_score_before reflects the current résumé vs this JD; ats_score_after reflects your rewrite. Only claim skills supported by the original résumé — reframe and surface, never fabricate.`;

export async function POST(req: Request) {
  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  if (!body.resume?.trim() || !body.jd?.trim()) {
    return NextResponse.json({ error: "Paste both a résumé and a job description." }, { status: 400 });
  }

  if (!hasGemini) return NextResponse.json(rulePlan(body));

  try {
    const text = await geminiGenerate({
      system: SYSTEM,
      messages: [{ role: "user", content: `RÉSUMÉ:\n${body.resume.slice(0, 8000)}\n\nJOB DESCRIPTION:\n${body.jd.slice(0, 6000)}` }],
      json: true,
      maxTokens: 2400,
    });
    if (!text) return NextResponse.json(rulePlan(body));
    const clean = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
    const p = JSON.parse(clean);
    const result: ResumeResult = {
      ats_score_before: Math.max(0, Math.min(100, Number(p.ats_score_before) || 0)),
      ats_score_after: Math.max(0, Math.min(100, Number(p.ats_score_after) || 0)),
      keywords: {
        matched: Array.isArray(p.keywords?.matched) ? p.keywords.matched.map(String) : [],
        missing: Array.isArray(p.keywords?.missing) ? p.keywords.missing.map(String) : [],
      },
      improvements: Array.isArray(p.improvements) ? p.improvements.map(String) : [],
      rewritten: String(p.rewritten || body.resume),
      source: "ai",
    };
    return NextResponse.json(result);
  } catch {
    return NextResponse.json(rulePlan(body));
  }
}
