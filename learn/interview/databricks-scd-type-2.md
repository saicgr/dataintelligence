# Track history of a changing dimension (SCD Type 2)

**Q:** A customer's address changes. The business needs to see what the address
*was* at the time of each historical order — not just the current one. How do you
model and load this in Delta?

**Say this (≈30s):**

"This is SCD Type 2 — I version the dimension rows instead of overwriting. Each row
gets a surrogate key plus `effective_from`, `effective_to`, and an `is_current`
flag. When an address changes, a single MERGE does two things: it closes the
existing current row by setting its end date and `is_current = false`, and it
inserts a new row with the new values as the current version. Fact rows join on the
surrogate key — or on natural key with a date-between — so each order points to the
address version that was valid when it happened. On Databricks I'd often let DLT do
this declaratively with `APPLY CHANGES ... STORED AS SCD TYPE 2`. The thing not to
do is UPDATE the address in place — that's Type 1 and it destroys the history the
business is asking for."

- **Type 2 = version rows** — surrogate key + effective_from/to + is_current
- **MERGE** — close old row (end_date, is_current=false) + insert new current row
- **Facts join on surrogate key** → point-in-time correct
- **Don't say** — "UPDATE the address in place" (that's Type 1, loses history)
