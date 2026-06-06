import { NextResponse } from "next/server";
import { geminiGenerate } from "@/lib/gemini";
import { hasGemini } from "@/lib/env";
import { PRACTICE_CATEGORIES, type PracticeCategory } from "@/lib/data/practice";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Body {
  jd?: string;
  company?: string;
  role?: string;
  level?: "junior" | "mid" | "senior";
}

interface Round {
  name: string;
  focus: string;
  categories: PracticeCategory[];
}
interface Plan {
  summary: string;
  rounds: Round[];
  source: "ai" | "rule";
}

const VALID = new Set(PRACTICE_CATEGORIES.map((c) => c.slug));
function coerceCats(arr: unknown): PracticeCategory[] {
  if (!Array.isArray(arr)) return [];
  return arr.map(String).filter((s): s is PracticeCategory => VALID.has(s as PracticeCategory));
}

// Rule-based fallback when there's no Gemini key — a sensible data/AI loop.
function rulePlan(body: Body): Plan {
  const role = (body.role || "").toLowerCase();
  const jd = (body.jd || "").toLowerCase();
  const text = `${role} ${jd}`;
  const isAi = /\b(ai|ml|llm|rag|genai|machine learning)\b/.test(text);
  const isAdmin = /\b(admin|platform|governance|unity catalog)\b/.test(text);
  const rounds: Round[] = [
    { name: "Phone screen — SQL", focus: "Window functions, joins, aggregation under time pressure.", categories: ["sql"] },
    { name: "Coding — Python", focus: "Data wrangling, complexity, clean code.", categories: ["python"] },
  ];
  if (/spark|databricks|big data|pyspark/.test(text)) rounds.push({ name: "Distributed data — PySpark", focus: "Transforms, joins, skew, partitioning.", categories: ["pyspark"] });
  if (isAi) rounds.push({ name: "AI engineering", focus: "RAG, eval design, prompt engineering.", categories: ["ai", "prompting"] });
  rounds.push({ name: "System design", focus: "Pipelines, idempotency, late data, scale trade-offs.", categories: ["systemdesign", "casestudy"] });
  if (text.includes("snowflake")) rounds.push({ name: "Snowflake admin", focus: "Warehouses, RBAC, cost, governance.", categories: ["snowflake-admin"] });
  if (text.includes("databricks") || isAdmin) rounds.push({ name: "Databricks admin", focus: "Unity Catalog, clusters, cost, monitoring.", categories: ["databricks-admin"] });
  rounds.push({ name: "Behavioral", focus: "STAR stories, ownership, leadership signals.", categories: ["behavioral"] });
  return {
    summary: `A ${body.level || "mid"}-level ${body.role || "data engineering"} loop${body.company ? ` at ${body.company}` : ""}. Work the rounds top to bottom.`,
    rounds,
    source: "rule",
  };
}

const SYSTEM = `You are an expert technical recruiter and interview coach for data & AI engineering roles. Given a job (title/company/level or a pasted JD), predict the realistic interview loop and which practice skills each round drills.

Available practice categories (use ONLY these slugs): ${PRACTICE_CATEGORIES.map((c) => `${c.slug} (${c.name})`).join(", ")}.

Respond with ONLY valid minified JSON, no markdown:
{"summary":"<2-sentence read on this loop>","rounds":[{"name":"<round name>","focus":"<what they test, one sentence>","categories":["<slug>", ...]}]}
Order rounds the way a real loop runs (screen → technical → design → behavioral). 4-7 rounds. Only use valid category slugs.`;

export async function POST(req: Request) {
  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  if (!hasGemini) return NextResponse.json(rulePlan(body));

  const ctx = body.jd
    ? `Job description:\n${body.jd.slice(0, 6000)}`
    : `Company: ${body.company || "(unspecified)"}\nRole: ${body.role || "Data Engineer"}\nLevel: ${body.level || "mid"}`;

  try {
    const text = await geminiGenerate({
      system: SYSTEM,
      messages: [{ role: "user", content: ctx }],
      json: true,
      maxTokens: 900,
    });
    if (!text) return NextResponse.json(rulePlan(body));
    const clean = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
    const parsed = JSON.parse(clean);
    const rounds: Round[] = Array.isArray(parsed.rounds)
      ? parsed.rounds
          .map((r: { name?: unknown; focus?: unknown; categories?: unknown }) => ({
            name: String(r.name || "Round"),
            focus: String(r.focus || ""),
            categories: coerceCats(r.categories),
          }))
          .filter((r: Round) => r.categories.length > 0)
      : [];
    if (!rounds.length) return NextResponse.json(rulePlan(body));
    const plan: Plan = { summary: String(parsed.summary || ""), rounds, source: "ai" };
    return NextResponse.json(plan);
  } catch {
    return NextResponse.json(rulePlan(body));
  }
}
