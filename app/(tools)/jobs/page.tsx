import type { Metadata } from "next";
import { getJobs } from "@/lib/data/jobs";
import { isValidTool, isValidLevel } from "@/lib/catalog";
import type { Level, Track } from "@/lib/types";
import { JobFilters } from "@/components/tools/JobFilters";
import { JobCard } from "@/components/tools/JobCard";

export const metadata: Metadata = {
  title: "Data & AI Engineering jobs | ByteShards",
  description:
    "Open Data & AI Engineering roles tagged by tool and level — Snowflake, dbt, Airflow, Kafka, Spark, Databricks, LLMs, RAG and more. Refreshed daily.",
};

interface SearchParams {
  tool?: string;
  level?: string;
  track?: string;
}

function parseTrack(v?: string): Track | undefined {
  return v === "data_engineering" || v === "ai_engineering" ? v : undefined;
}

export default async function JobsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const tool =
    searchParams.tool && isValidTool(searchParams.tool)
      ? searchParams.tool
      : undefined;
  const level =
    searchParams.level && isValidLevel(searchParams.level)
      ? (searchParams.level as Level)
      : undefined;
  const track = parseTrack(searchParams.track);

  const jobs = await getJobs({ tool, level, track });

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-3xl font-extrabold tracking-tight text-fg sm:text-4xl">
        Data &amp; AI Engineering jobs
      </h1>
      <p className="mt-3 max-w-2xl text-muted">
        Roles tagged by the tools they actually use, so you can prep the right
        sheet before you apply.
      </p>

      <div className="mt-6">
        <JobFilters />
      </div>

      <div className="mt-6">
        {jobs.length === 0 ? (
          <div className="rounded-xl border border-border bg-surface p-8 text-center text-muted">
            No matching roles right now — try widening your filters.
          </div>
        ) : (
          <>
            <div className="mb-3 text-sm text-muted">
              {jobs.length} open role{jobs.length === 1 ? "" : "s"}
            </div>
            <div className="grid gap-4">
              {jobs.map((job) => (
                <JobCard key={job.id} job={job} />
              ))}
            </div>
          </>
        )}
      </div>

      <p className="mt-8 text-center text-xs text-muted">
        Listings refreshed daily from Greenhouse, Lever and RSS.
      </p>
    </div>
  );
}
