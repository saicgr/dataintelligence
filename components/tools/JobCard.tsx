import type { Job } from "@/lib/types";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { TOOL_BY_SLUG, LEVEL_NAMES } from "@/lib/catalog";
import { timeAgo } from "@/lib/utils";

export function JobCard({ job }: { job: Job }) {
  const posted = timeAgo(job.postedAt) ?? job.postedAt;
  return (
    <Card className="flex flex-col">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-fg">{job.title}</h3>
          <div className="mt-1 text-sm text-muted">
            {job.company}
            {job.location ? ` · ${job.location}` : ""}
          </div>
        </div>
        <Badge tone="navy">{LEVEL_NAMES[job.level] ?? job.level}</Badge>
      </div>

      {job.tools.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {job.tools.map((t) => (
            <Badge key={t} tone="amber">
              {TOOL_BY_SLUG[t]?.name ?? t}
            </Badge>
          ))}
        </div>
      )}

      <div className="mt-4 flex items-center justify-between gap-4">
        <span className="text-xs text-muted">Posted {posted}</span>
        <ButtonLink
          href={job.url}
          variant="outline"
          size="sm"
          target="_blank"
          rel="noopener noreferrer"
        >
          View role →
        </ButtonLink>
      </div>
    </Card>
  );
}
