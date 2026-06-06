# Late-arriving data → report already ran

**Q:** The daily report ran at midnight. At 2am, events timestamped for *yesterday*
arrive (mobile clients were offline). The report is now wrong. How do you design
so late data is handled correctly — without recomputing everything?

**Say this (≈30s):**

"I'd process on event-time, not arrival-time, and set a watermark that bounds how
late I'll still accept data into the stateful aggregation — sized from the real
lateness SLA, because an unbounded watermark means unbounded state. Within that
window late events just fold in. I'd make the gold table an idempotent upsert —
a MERGE keyed on the report grain — so a late batch corrects only the affected
rows instead of triggering a full recompute. And for a correction that arrives
beyond the watermark, I'd reprocess just that one day's partition with
`replaceWhere` rather than rebuilding the table."

- **Event-time + `withWatermark`** — bounded by lateness SLA (unbounded = unbounded state)
- **Idempotent gold (MERGE on grain)** — late batch corrects only affected rows
- **Beyond the window** — `replaceWhere` to reprocess just that partition
- **Don't say** — "just rerun the whole job" / a watermark that never expires
