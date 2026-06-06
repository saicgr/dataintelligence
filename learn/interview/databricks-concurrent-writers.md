# Two jobs MERGE the same table → ConcurrentAppendException

**Q:** Two jobs MERGE into the same Delta table at the same time. One fails with
`ConcurrentAppendException`. Why does it happen, and how do you design around it?

**Say this (≈30s):**

"Delta uses optimistic concurrency control — there's no lock manager. Each writer
reads the current table version, does its work, then tries to commit the next
version; if another writer committed first and touched overlapping files, the
second one's commit conflicts and throws. So the fixes are about avoiding overlap:
partition-isolate the writers so their MERGE conditions touch disjoint files — I
include the partition column in the merge predicate so Delta can prove they don't
overlap; if two writers genuinely target the same data I serialize them; and I wrap
the commit in a retry-with-backoff, which is safe because the operation is
idempotent. The wrong mental model is 'Delta can't do concurrent writes' — it can,
it just detects conflicts at commit time instead of blocking."

- **Optimistic concurrency** — conflict detected at commit on overlapping files (no locks)
- **Partition-isolate** writers — include partition col in the MERGE predicate
- **Serialize** true-overlap writers; **retry-with-backoff** (safe if idempotent)
- **Don't say** — "Delta can't do concurrent writes" / "add a lock"
