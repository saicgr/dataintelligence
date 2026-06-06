# One task runs forever (data skew)

**Q:** A Spark stage has 199 tasks that finish in seconds and 1 task that runs for
an hour. What's happening and how do you fix it?

**Say this (≈30s):**

"That's data skew — one key, often a null or a hot account, holds most of the rows,
so a single partition is enormous and one task does almost all the work while the
rest sit idle. First I'd confirm it in the Spark UI by looking at the per-task
duration and shuffle-read distribution. The fix: AQE's skew-join handling splits
the skewed partition automatically and it's on by default on modern runtimes; for
stubborn cases I salt the hot key — add a random suffix and explode the small side
to match — so the work spreads across tasks; if one side is small I broadcast it to
skip the shuffle entirely; and I handle nulls on a separate path. Adding executors
doesn't help — they'd just sit idle while the one big task runs."

- **Cause** — hot/null key → one giant partition → one straggler task
- **AQE skew-join** — auto-splits skewed partitions (default-on modern DBR)
- **Salt** the hot key (+explode small side) / **broadcast** the small table
- **Don't say** — "add more executors" / "just raise shuffle partitions"
