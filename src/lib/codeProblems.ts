/**
 * Executable code problems for the on-device judge (plan GAP 1). Distinct from the display-only
 * `querybuild` lesson cards: each problem carries a REAL executable setup + a canonical expected
 * output so the judge can run the user's code and output-match deterministically (no AI).
 *
 *  - SQL      → setup is DDL+INSERT; runs in expo-sqlite (fully offline).
 *  - Python   → setup is Python that defines inputs (e.g. a pandas `df`); runs in Pyodide.
 *  - PySpark  → setup uses the pandas-backed Spark shim; runs in Pyodide.
 *
 * The judge serializes the result to ROWS of VALUES (column names ignored), each row's values
 * joined by '|', rows joined by newline — so `expected` is authored in that exact canonical form.
 * Prompts state the precise output columns + order to keep the match unambiguous.
 */
export type CodeLang = 'sql' | 'python' | 'pyspark';

export interface CodeProblem {
  id: string;
  lang: CodeLang;
  title: string;
  /** What to produce — be explicit about output columns + order. */
  prompt: string;
  /** Badge label (e.g. 'SQL', 'pandas', 'PySpark'). */
  tool: string;
  /** Executable setup run BEFORE the user's code. */
  setup: string;
  /** Editor starter scaffold. */
  starter: string;
  /** Canonical expected output (values per row joined by '|', rows by '\n'). */
  expected: string;
  hints: string[];
  /** Optional web deep-link problem id for full-fidelity / AI-graded follow-up on Web Pro. */
  webProblemId?: string;
}

export const CODE_PROBLEMS: CodeProblem[] = [
  // ───────────────────────────── SQL (expo-sqlite, offline) ─────────────────────────────
  {
    id: 'sql-running-total',
    lang: 'sql',
    title: 'Running total',
    tool: 'SQL',
    prompt:
      'Return user_id, day, and the running total of amount per user ordered by day. Columns: user_id, day, running_total.',
    setup: `CREATE TABLE txns(user_id INTEGER, day TEXT, amount INTEGER);
INSERT INTO txns VALUES (1,'D1',10),(1,'D2',5),(1,'D3',20),(2,'D1',7);`,
    starter: `SELECT user_id, day,
       -- a windowed running sum here
       AS running_total
FROM txns
ORDER BY user_id, day;`,
    expected: `1|D1|10
1|D2|15
1|D3|35
2|D1|7`,
    hints: [
      'A running sum is SUM(amount) OVER (...).',
      'PARTITION BY user_id ORDER BY day gives a per-user cumulative frame.',
    ],
    webProblemId: 'sql-running-total',
  },
  {
    id: 'sql-revenue-per-region',
    lang: 'sql',
    title: 'Revenue per region',
    tool: 'SQL',
    prompt: 'Total amount per region, highest first. Columns: region, total.',
    setup: `CREATE TABLE orders(region TEXT, amount INTEGER);
INSERT INTO orders VALUES ('US',100),('US',50),('EU',80);`,
    starter: `SELECT region, SUM(amount) AS total
FROM orders
-- group + order here
;`,
    expected: `US|150
EU|80`,
    hints: ['GROUP BY region to collapse per region.', 'ORDER BY total DESC for highest first.'],
    webProblemId: 'sql-revenue-per-region',
  },
  {
    id: 'sql-repeat-buyers',
    lang: 'sql',
    title: 'Repeat buyers',
    tool: 'SQL',
    prompt: 'User ids with more than one order, ascending. Column: user_id.',
    setup: `CREATE TABLE purchases(user_id INTEGER, item TEXT);
INSERT INTO purchases VALUES (1,'a'),(1,'b'),(2,'c'),(3,'d'),(3,'e'),(3,'f');`,
    starter: `SELECT user_id
FROM purchases
-- group, filter groups, order
;`,
    expected: `1
3`,
    hints: ['GROUP BY user_id then filter aggregates with HAVING.', 'HAVING COUNT(*) > 1.'],
    webProblemId: 'sql-repeat-buyers',
  },

  {
    id: 'sql-dedup-latest',
    lang: 'sql',
    title: 'Latest row per id',
    tool: 'SQL',
    prompt: 'Keep only the latest row per id by updated_at. Columns: id, status, ordered by id.',
    setup: `CREATE TABLE events(id INTEGER, status TEXT, updated_at TEXT);
INSERT INTO events VALUES (1,'new','2026-01-01'),(1,'paid','2026-01-03'),(2,'new','2026-01-02');`,
    starter: `WITH ranked AS (
  SELECT *, ROW_NUMBER() OVER (/* partition + order */) AS rn
  FROM events
)
SELECT id, status FROM ranked WHERE rn = 1 ORDER BY id;`,
    expected: `1|paid
2|new`,
    hints: ['ROW_NUMBER() OVER (PARTITION BY id ORDER BY updated_at DESC).', 'Keep rn = 1 — the newest per id.'],
    webProblemId: 'sql-dedup-latest',
  },
  {
    id: 'sql-anti-join-followups',
    lang: 'sql',
    title: 'Users with no orders',
    tool: 'SQL',
    prompt: 'User ids that have no orders, ascending. Column: id.',
    setup: `CREATE TABLE users(id INTEGER);
CREATE TABLE orders(user_id INTEGER);
INSERT INTO users VALUES (1),(2),(3);
INSERT INTO orders VALUES (1),(3);`,
    starter: `SELECT u.id
FROM users u
LEFT JOIN orders o ON o.user_id = u.id
-- keep only the non-matches
ORDER BY u.id;`,
    expected: `2`,
    hints: ['LEFT JOIN then WHERE o.user_id IS NULL is the anti-join.', 'NOT IN / NOT EXISTS also work (mind NULLs).'],
    webProblemId: 'sql-anti-join-followups',
  },
  {
    id: 'sql-candidates-all-skills',
    lang: 'sql',
    title: 'Has all required skills',
    tool: 'SQL',
    prompt: "Candidates who have BOTH 'sql' and 'python'. Column: candidate, ascending.",
    setup: `CREATE TABLE cand_skill(candidate TEXT, skill TEXT);
INSERT INTO cand_skill VALUES ('a','sql'),('a','python'),('b','sql'),('c','sql'),('c','python'),('c','spark');`,
    starter: `SELECT candidate
FROM cand_skill
WHERE skill IN ('sql','python')
-- group + require both
ORDER BY candidate;`,
    expected: `a
c`,
    hints: ['Filter to the required skills, GROUP BY candidate.', 'HAVING COUNT(DISTINCT skill) = 2 enforces ALL of them.'],
    webProblemId: 'sql-candidates-all-skills',
  },

  // ───────────────────────────── Python / pandas (Pyodide) ─────────────────────────────
  {
    id: 'py-revenue-per-region',
    lang: 'python',
    title: 'Revenue per region',
    tool: 'pandas',
    prompt:
      'Set `result` to a DataFrame of total amount per region, highest first, with columns region, amount.',
    setup: `import pandas as pd
df = pd.DataFrame({'region': ['US', 'US', 'EU'], 'amount': [100, 50, 80]})`,
    starter: `result = (
    df.groupby('region')['amount'].sum()
      .sort_values(ascending=False)
      .reset_index()
)`,
    expected: `US|150
EU|80`,
    hints: ['groupby the key, sum the measure — vectorized, never iterrows.', 'reset_index() turns the grouped Series back into a DataFrame.'],
    webProblemId: 'py-revenue-per-region',
  },
  {
    id: 'py-top-customers',
    lang: 'python',
    title: 'Top customers',
    tool: 'pandas',
    prompt:
      'Set `result` to a DataFrame of total spend per customer, highest first, columns customer, spend. Keep all customers.',
    setup: `import pandas as pd
df = pd.DataFrame({'customer': ['a', 'b', 'a', 'c', 'b'], 'spend': [10, 5, 7, 3, 9]})`,
    starter: `result = (
    df.groupby('customer')['spend'].sum()
      .sort_values(ascending=False)
      .reset_index()
)`,
    expected: `a|17
b|14
c|3`,
    hints: ['groupby + sum, then sort_values(ascending=False).', 'reset_index() to get a tidy DataFrame.'],
    webProblemId: 'py-top-customers',
  },

  // ───────────────────────────── PySpark (pandas shim, Pyodide) ─────────────────────────────
  {
    id: 'spark-revenue-per-region',
    lang: 'pyspark',
    title: 'Revenue per region',
    tool: 'PySpark',
    prompt:
      'Set `result` to a DataFrame of total amount per region, highest first, columns region, total.',
    setup: `df = spark.createDataFrame(
    [('US', 100), ('US', 50), ('EU', 80)],
    ['region', 'amount'],
)`,
    starter: `from pyspark.sql.functions import sum, col

result = (
    df.groupBy('region')
      .agg(sum('amount').alias('total'))
      .orderBy(col('total').desc())
)`,
    expected: `US|150
EU|80`,
    hints: ['groupBy(key).agg(sum(measure)) — the Spark aggregation idiom.', 'orderBy(col(...).desc()) for highest first.'],
    webProblemId: 'spark-revenue-per-region',
  },
  {
    id: 'spark-active-users',
    lang: 'pyspark',
    title: 'Events per user',
    tool: 'PySpark',
    prompt: 'Set `result` to event counts per user, highest first, columns user, n.',
    setup: `df = spark.createDataFrame(
    [('u1', 'click'), ('u1', 'view'), ('u2', 'click'), ('u1', 'buy')],
    ['user', 'event'],
)`,
    starter: `from pyspark.sql.functions import count, col

result = (
    df.groupBy('user')
      .agg(count('event').alias('n'))
      .orderBy(col('n').desc())
)`,
    expected: `u1|3
u2|1`,
    hints: ['groupBy(user).agg(count(...)) counts rows per group.', 'orderBy(col("n").desc()).'],
    webProblemId: 'spark-active-users',
  },
];

export function problemsForLang(lang: CodeLang): CodeProblem[] {
  return CODE_PROBLEMS.filter((p) => p.lang === lang);
}
