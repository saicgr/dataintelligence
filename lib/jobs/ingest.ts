import type { Job, Level } from "@/lib/types";

/** Tool keyword → catalog tool slug. */
const TOOL_KEYWORDS: { keyword: string; slug: string }[] = [
  { keyword: "snowflake", slug: "snowflake" },
  { keyword: "dbt", slug: "dbt" },
  { keyword: "airflow", slug: "airflow" },
  { keyword: "kafka", slug: "kafka" },
  { keyword: "spark", slug: "spark" },
  { keyword: "databricks", slug: "databricks" },
  // AI
  { keyword: "llm", slug: "llms" },
  { keyword: "gpt", slug: "llms" },
  { keyword: "prompt", slug: "llms" },
  { keyword: "rag", slug: "rag" },
  { keyword: "retrieval", slug: "rag" },
  { keyword: "pinecone", slug: "vectordb" },
  { keyword: "pgvector", slug: "vectordb" },
  { keyword: "vector", slug: "vectordb" },
  { keyword: "agent", slug: "agents" },
];

function detectTools(text: string): string[] {
  const lower = text.toLowerCase();
  const found = new Set<string>();
  for (const { keyword, slug } of TOOL_KEYWORDS) {
    if (lower.includes(keyword)) found.add(slug);
  }
  return Array.from(found);
}

function detectLevel(title: string): Level {
  const t = title.toLowerCase();
  if (/(senior|staff|lead|principal)/.test(t)) return "senior";
  if (/(junior|associate|graduate)/.test(t)) return "junior";
  return "mid";
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");
}

function envList(name: string): string[] {
  return (process.env[name] ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

interface GreenhouseJob {
  id?: number | string;
  title?: string;
  location?: { name?: string };
  absolute_url?: string;
  updated_at?: string;
  content?: string;
}

interface LeverJob {
  id?: string;
  text?: string;
  categories?: { location?: string };
  hostedUrl?: string;
  createdAt?: number;
  descriptionPlain?: string;
  description?: string;
}

async function fetchGreenhouse(board: string): Promise<Job[]> {
  try {
    const res = await fetch(
      `https://boards-api.greenhouse.io/v1/boards/${board}/jobs?content=true`
    );
    if (!res.ok) return [];
    const data = (await res.json()) as { jobs?: GreenhouseJob[] };
    const jobs = data.jobs ?? [];
    const out: Job[] = [];
    for (const j of jobs) {
      const title = j.title ?? "";
      const content = j.content ? stripHtml(j.content) : "";
      const tools = detectTools(`${title} ${content}`);
      if (!tools.length) continue;
      out.push({
        id: `gh-${board}-${j.id ?? j.absolute_url ?? title}`,
        title,
        company: board,
        location: j.location?.name ?? "",
        level: detectLevel(title),
        tools,
        url: j.absolute_url ?? "",
        source: "greenhouse",
        postedAt: j.updated_at?.slice(0, 10) ?? "",
      });
    }
    return out;
  } catch {
    return [];
  }
}

async function fetchLever(company: string): Promise<Job[]> {
  try {
    const res = await fetch(
      `https://api.lever.co/v0/postings/${company}?mode=json`
    );
    if (!res.ok) return [];
    const data = (await res.json()) as LeverJob[];
    const jobs = Array.isArray(data) ? data : [];
    const out: Job[] = [];
    for (const j of jobs) {
      const title = j.text ?? "";
      const content = j.descriptionPlain ?? (j.description ? stripHtml(j.description) : "");
      const tools = detectTools(`${title} ${content}`);
      if (!tools.length) continue;
      out.push({
        id: `lever-${company}-${j.id ?? j.hostedUrl ?? title}`,
        title,
        company,
        location: j.categories?.location ?? "",
        level: detectLevel(title),
        tools,
        url: j.hostedUrl ?? "",
        source: "lever",
        postedAt: j.createdAt
          ? new Date(j.createdAt).toISOString().slice(0, 10)
          : "",
      });
    }
    return out;
  } catch {
    return [];
  }
}

/**
 * Ingest jobs from configured Greenhouse boards and Lever companies.
 * Fully defensive — never throws; returns [] for any failing source.
 */
export async function ingestJobs(): Promise<Job[]> {
  const boards = envList("JOBS_GREENHOUSE_BOARDS");
  const companies = envList("JOBS_LEVER_COMPANIES");

  const results = await Promise.all([
    ...boards.map((b) => fetchGreenhouse(b)),
    ...companies.map((c) => fetchLever(c)),
  ]);

  const all = results.flat().filter((j) => j.url);

  // dedup by url
  const seen = new Set<string>();
  const deduped: Job[] = [];
  for (const j of all) {
    if (seen.has(j.url)) continue;
    seen.add(j.url);
    deduped.push(j);
  }
  return deduped;
}
