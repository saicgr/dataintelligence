import type { SqlItem } from "./types";

/**
 * SQL practice problems — run in-browser via DuckDB-WASM and graded on
 * correctness. Hand-authored from canonical interview patterns; every reference
 * solution is DuckDB-compatible and verified to execute. `free: true` items are
 * playable without a Practice Pro subscription.
 */
export const SQL_ITEMS: SqlItem[] = [
  {
    id: "top-customers",
    category: "sql",
    executes: true,
    free: true,
    level: "junior",
    title: "Top 3 customers by spend",
    company: "Marketplace · Series C",
    difficulty: "easy",
    prompt:
      "Return the **3 customers with the highest total order amount**. Output `customer_id` and `total_spend`, highest first. Break ties by `customer_id` ascending.",
    schemaNote: "orders(id, customer_id, amount, order_date)",
    setupSql: `CREATE TABLE orders (id INTEGER, customer_id INTEGER, amount DOUBLE, order_date DATE);
INSERT INTO orders VALUES
 (1, 101, 120.00, DATE '2026-01-03'),
 (2, 102, 80.00,  DATE '2026-01-04'),
 (3, 101, 200.00, DATE '2026-01-10'),
 (4, 103, 50.00,  DATE '2026-01-11'),
 (5, 102, 300.00, DATE '2026-01-15'),
 (6, 104, 90.00,  DATE '2026-01-18'),
 (7, 103, 60.00,  DATE '2026-01-20'),
 (8, 101, 40.00,  DATE '2026-01-22');`,
    referenceSolution: `SELECT customer_id, SUM(amount) AS total_spend
FROM orders
GROUP BY customer_id
ORDER BY total_spend DESC, customer_id ASC
LIMIT 3;`,
    orderMatters: true,
    starter: "SELECT\nFROM orders\n",
    hints: ["Aggregate with SUM grouped by customer, then ORDER BY the total descending and LIMIT 3."],
  },
  {
    id: "never-ordered",
    category: "sql",
    executes: true,
    free: true,
    level: "junior",
    title: "Customers who never ordered",
    company: "Subscription box · Seed",
    difficulty: "easy",
    prompt:
      "Return every customer who has **no orders** — output `id` and `name`, ordered by `id`.",
    schemaNote: "customers(id, name) · orders(id, customer_id, amount)",
    setupSql: `CREATE TABLE customers (id INTEGER, name VARCHAR);
CREATE TABLE orders (id INTEGER, customer_id INTEGER, amount DOUBLE);
INSERT INTO customers VALUES (1,'Ava'),(2,'Ben'),(3,'Cleo'),(4,'Dina'),(5,'Eli');
INSERT INTO orders VALUES (10,1,50),(11,1,20),(12,3,75),(13,5,10);`,
    referenceSolution: `SELECT c.id, c.name
FROM customers c
LEFT JOIN orders o ON o.customer_id = c.id
WHERE o.id IS NULL
ORDER BY c.id;`,
    orderMatters: true,
    starter: "SELECT c.id, c.name\nFROM customers c\n",
    hints: ["LEFT JOIN orders and keep rows where the join produced NULL (no match). A NOT IN / NOT EXISTS also works — watch NULLs with NOT IN."],
  },
  {
    id: "second-highest-salary",
    category: "sql",
    executes: true,
    free: false,
    level: "mid",
    title: "Second-highest salary per department",
    company: "Enterprise SaaS · Senior screen",
    difficulty: "medium",
    prompt:
      "For each department, return the **second-highest salary value** and who earns it. Output `dept`, `name`, `salary`. If two people tie for top, the next distinct salary is 'second'. Order by `dept`, then `name`.",
    schemaNote: "employees(id, name, dept, salary)",
    setupSql: `CREATE TABLE employees (id INTEGER, name VARCHAR, dept VARCHAR, salary INTEGER);
INSERT INTO employees VALUES
 (1,'Ada','Data',180000),
 (2,'Bo','Data',180000),
 (3,'Cy','Data',150000),
 (4,'Di','Data',140000),
 (5,'Ed','Platform',200000),
 (6,'Fi','Platform',170000),
 (7,'Gus','Platform',170000),
 (8,'Ha','Ops',90000);`,
    referenceSolution: `WITH ranked AS (
  SELECT name, dept, salary,
         DENSE_RANK() OVER (PARTITION BY dept ORDER BY salary DESC) AS rk
  FROM employees
)
SELECT dept, name, salary
FROM ranked
WHERE rk = 2
ORDER BY dept, name;`,
    orderMatters: true,
    starter: "WITH ranked AS (\n  SELECT name, dept, salary,\n         /* a window function here */\n  FROM employees\n)\nSELECT dept, name, salary\nFROM ranked\n",
    hints: ["DENSE_RANK() OVER (PARTITION BY dept ORDER BY salary DESC) then filter rk = 2. DENSE_RANK (not RANK/ROW_NUMBER) handles the tie correctly for 'second distinct salary'."],
  },
  {
    id: "rolling-7d-revenue",
    category: "sql",
    executes: true,
    free: false,
    level: "mid",
    title: "7-day rolling average revenue",
    company: "Streaming · growth team",
    difficulty: "medium",
    prompt:
      "Return each day with the **trailing 7-day average revenue** (today + the 6 prior days). Output `day` and `rolling_avg` rounded to 2 decimals, ordered by `day`.",
    schemaNote: "daily_revenue(day, revenue)",
    setupSql: `CREATE TABLE daily_revenue (day DATE, revenue INTEGER);
INSERT INTO daily_revenue VALUES
 (DATE '2026-03-01',100),(DATE '2026-03-02',120),(DATE '2026-03-03',90),
 (DATE '2026-03-04',150),(DATE '2026-03-05',200),(DATE '2026-03-06',170),
 (DATE '2026-03-07',130),(DATE '2026-03-08',160),(DATE '2026-03-09',210),
 (DATE '2026-03-10',180);`,
    referenceSolution: `SELECT day,
       ROUND(AVG(revenue) OVER (ORDER BY day ROWS BETWEEN 6 PRECEDING AND CURRENT ROW), 2) AS rolling_avg
FROM daily_revenue
ORDER BY day;`,
    orderMatters: true,
    starter: "SELECT day,\n       /* windowed average over the last 7 rows */\nFROM daily_revenue\nORDER BY day;\n",
    hints: ["Use AVG(revenue) OVER (ORDER BY day ROWS BETWEEN 6 PRECEDING AND CURRENT ROW). The frame is the key — a plain OVER (ORDER BY day) defaults to RANGE unbounded preceding, not a 7-row window."],
  },
  {
    id: "login-streak",
    category: "sql",
    executes: true,
    free: false,
    level: "senior",
    title: "Longest consecutive login streak",
    company: "Social app · the 'gaps & islands' question",
    difficulty: "hard",
    prompt:
      "For each user, return their **longest streak of consecutive calendar days** with at least one login. Output `user_id` and `longest_streak`, ordered by `user_id`. (Duplicate logins on the same day count once.)",
    schemaNote: "logins(user_id, login_date)",
    setupSql: `CREATE TABLE logins (user_id INTEGER, login_date DATE);
INSERT INTO logins VALUES
 (1, DATE '2026-02-01'),(1, DATE '2026-02-02'),(1, DATE '2026-02-03'),
 (1, DATE '2026-02-05'),(1, DATE '2026-02-06'),
 (2, DATE '2026-02-01'),(2, DATE '2026-02-01'),(2, DATE '2026-02-02'),
 (3, DATE '2026-02-10'),(3, DATE '2026-02-12'),(3, DATE '2026-02-13'),(3, DATE '2026-02-14');`,
    referenceSolution: `WITH d AS (
  SELECT DISTINCT user_id, login_date FROM logins
),
grouped AS (
  SELECT user_id, login_date,
         (login_date - DATE '2000-01-01')
           - ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY login_date) AS grp
  FROM d
),
streaks AS (
  SELECT user_id, grp, COUNT(*) AS streak
  FROM grouped GROUP BY user_id, grp
)
SELECT user_id, MAX(streak) AS longest_streak
FROM streaks GROUP BY user_id ORDER BY user_id;`,
    orderMatters: true,
    starter: "-- Classic gaps-and-islands.\n-- Hint: a consecutive run has a constant (date - row_number).\nWITH d AS (\n  SELECT DISTINCT user_id, login_date FROM logins\n)\n",
    hints: ["Dedup dates first. For each user, (day_number - ROW_NUMBER() over date) is CONSTANT within a consecutive run — group by that, count, take the max per user."],
  },
  {
    id: "mom-growth",
    category: "sql",
    executes: true,
    free: false,
    level: "senior",
    title: "Month-over-month growth %",
    company: "Fintech · board-metrics pipeline",
    difficulty: "medium",
    prompt:
      "Return each month's revenue and its **percent growth vs the previous month**. Output `month`, `revenue`, `growth_pct` (rounded to 1 decimal; NULL for the first month). Order by `month`.",
    schemaNote: "monthly_revenue(month, revenue)",
    setupSql: `CREATE TABLE monthly_revenue (month DATE, revenue INTEGER);
INSERT INTO monthly_revenue VALUES
 (DATE '2026-01-01', 1000),
 (DATE '2026-02-01', 1200),
 (DATE '2026-03-01', 1100),
 (DATE '2026-04-01', 1540);`,
    referenceSolution: `WITH m AS (
  SELECT month, revenue,
         LAG(revenue) OVER (ORDER BY month) AS prev
  FROM monthly_revenue
)
SELECT month, revenue,
       ROUND((revenue - prev) * 100.0 / prev, 1) AS growth_pct
FROM m
ORDER BY month;`,
    orderMatters: true,
    starter: "WITH m AS (\n  SELECT month, revenue,\n         /* previous month's revenue */\n  FROM monthly_revenue\n)\n",
    hints: ["LAG(revenue) OVER (ORDER BY month) gives the prior month. Growth = (cur - prev) * 100.0 / prev. Multiply by 100.0 (not 100) to avoid integer division."],
  },
];
