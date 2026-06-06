# Failed run → backlog balloons → cascade

**Q:** A batch job runs every 4 hours all day (~10GB per run, starting 8am). The
12pm run fails, so the 4pm run has to process both the missed and the new data
(~20GB) — and that bigger batch is itself at risk of failing, which delays the
daily report and all downstream reports. Did you build architecture around this?
If not, how would you approach it?

**Say this (≈45–60s):**

"The root problem here is that the batch size is coupled to how long the pipeline
has been down — when the 12pm run fails, its data sits unprocessed, so the 4pm
run inherits a double-sized backlog, and because that batch is bigger it's
actually *more* likely to fail, which is how one failure cascades into delayed
reports. So the fix isn't a bigger cluster or just adding retries — those scale
the problem, they don't bound it. What I'd do is decouple batch size from the
backlog: I'd cap how much any single run processes using `maxBytesPerTrigger`, so
even a 20GB backlog drains as several fixed-size micro-batches instead of one
fragile giant one. I'd make recovery checkpoint-driven rather than clock-driven —
on Databricks that's Auto Loader with `Trigger.AvailableNow`, which tracks exactly
which files it has ingested, so after a failure the next run automatically picks
up the missed data without any 'did the last run succeed' logic. I'd make the
writes idempotent with a Delta MERGE on the key so reprocessing can't
double-count, and add Workflow retries with backoff for the transient failures.
And to stop the cascade into reporting, I'd decouple ingestion from transformation
in a medallion layout and trigger the daily report off a data-completion signal
instead of the wall clock, with the report built as an upsert so a late batch just
self-corrects instead of going out wrong or empty."

---

**Glance fallback:**
- **Bound** — `maxBytesPerTrigger` → constant size regardless of backlog *(key line)*
- **Recover** — checkpoint, not "last 4h" → auto-resumes missed files
- **Idempotent** — Delta MERGE on key → no double-count on replay
- **Decouple** — Bronze ingest ≠ Gold report; report waits on data ready
- **Don't say** — "bigger cluster" / "add retries" → scales, doesn't *bound*
