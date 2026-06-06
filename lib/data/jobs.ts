import type { Job, Level, Track } from "../types";
import { SEED_JOBS } from "./seed";
import { getAdminSupabase } from "../supabase";
import { hasSupabaseAdmin } from "../env";

/** In-memory store used in seed mode (persists for the server process lifetime). */
const memJobs: Job[] = [...SEED_JOBS];

export interface JobFilter {
  tool?: string;
  level?: Level;
  track?: Track;
}

const AI_TOOLS = new Set(["llms", "rag", "vectordb", "agents"]);

export async function getJobs(filter?: JobFilter): Promise<Job[]> {
  let jobs: Job[] = memJobs;

  if (hasSupabaseAdmin) {
    const supabase = getAdminSupabase();
    if (supabase) {
      const { data } = await supabase
        .from("jobs")
        .select("*")
        .order("posted_at", { ascending: false })
        .limit(200);
      if (data && data.length) {
        jobs = data.map((r) => ({
          id: r.id,
          title: r.title,
          company: r.company,
          location: r.location,
          level: r.level,
          tools: r.tools ?? [],
          url: r.url,
          source: r.source,
          postedAt: r.posted_at,
        }));
      }
    }
  }

  return jobs.filter((j) => {
    if (filter?.tool && !j.tools.includes(filter.tool)) return false;
    if (filter?.level && j.level !== filter.level) return false;
    if (filter?.track) {
      const isAi = j.tools.some((t) => AI_TOOLS.has(t));
      if (filter.track === "ai_engineering" && !isAi) return false;
      if (filter.track === "data_engineering" && isAi && !j.tools.some((t) => !AI_TOOLS.has(t)))
        return false;
    }
    return true;
  });
}

/** Upsert ingested jobs — to Supabase if configured, else the in-memory store. */
export async function upsertJobs(jobs: Job[]): Promise<number> {
  if (hasSupabaseAdmin) {
    const supabase = getAdminSupabase();
    if (supabase) {
      const rows = jobs.map((j) => ({
        title: j.title,
        company: j.company,
        location: j.location,
        level: j.level,
        tools: j.tools,
        url: j.url,
        source: j.source,
        posted_at: j.postedAt,
      }));
      const { error, count } = await supabase
        .from("jobs")
        .upsert(rows, { onConflict: "url", count: "exact" });
      if (error) throw error;
      return count ?? rows.length;
    }
  }
  // in-memory dedup by url
  let added = 0;
  for (const j of jobs) {
    if (!memJobs.some((m) => m.url === j.url)) {
      memJobs.push(j);
      added++;
    }
  }
  return added;
}
