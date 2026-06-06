# Reprocess one bad day without rebuilding the table

**Q:** You discover yesterday's data was loaded with a bug. You need to reprocess
just that one day on a multi-TB table — without rebuilding the whole table, without
touching other days, and without breaking live readers. How?

**Say this (≈30s):**

"I'd do a selective overwrite with `replaceWhere`. I write the corrected day's data
with `.option("replaceWhere", "event_date = '2026-06-04'")`, and Delta atomically
replaces only the rows matching that predicate in a single commit — every other
partition is untouched and readers never see a half-written state. I'd reprocess
*from bronze*, the raw landing, never re-pull the source. For a range I just widen
the predicate, and the whole thing is idempotent so a retry is safe. The key
detail is the predicate has to line up with how the data's laid out so I don't
accidentally over-replace. What I wouldn't do is overwrite the whole table or
DELETE-then-INSERT — that's non-atomic and breaks concurrent reads."

- **`replaceWhere` predicate** — atomic, one commit, only matching rows
- **Reprocess from bronze**, not the source; widen predicate for a range
- **Idempotent** → safe to retry
- **Don't say** — "overwrite the whole table" / "DELETE then INSERT" (non-atomic)
