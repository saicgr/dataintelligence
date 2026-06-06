import type { Authored, ToolTopics } from "../content-de";
import type { Level } from "../../types";

export const levels: Partial<Record<Level, { authored: Authored[]; topics: ToolTopics }>> = {
  // ─────────────────────────────────────────────────────────────
  // JUNIOR  — SELECT, JOINs, GROUP BY, NULLs, DISTINCT, basic aggregates
  // ─────────────────────────────────────────────────────────────
  junior: {
    authored: [
      // ── deep-dives ────────────────────────────────────────────
      {
        category: "deep-dives",
        riskLevel: "high",
        freePreview: true,
        asked: 29,
        questionText:
          "Explain the difference between INNER JOIN, LEFT JOIN, RIGHT JOIN, and FULL OUTER JOIN. When would you use each?",
        answerStructured:
          "- **INNER JOIN**: returns only rows where the join condition matches in *both* tables. Rows with no match on either side are dropped.\n- **LEFT JOIN**: returns *all* rows from the left table; right-side columns are NULL where there is no match. Use this when the left table is the 'anchor' (e.g., all customers, even those with no orders).\n- **RIGHT JOIN**: mirror of LEFT — all rows from the right table. In practice, I almost always rewrite a RIGHT JOIN as a LEFT JOIN by swapping table order (easier to read).\n- **FULL OUTER JOIN**: returns all rows from both tables, with NULLs on whichever side has no match. Good for reconciliation / finding unmatched rows on either side.\n- **Decision rule**: start with INNER unless you need to preserve unmatched rows; LEFT when the 'master' table should never lose rows; FULL OUTER only for diff/audit queries.",
        explanationDeep:
          "The failure mode I see most often is using INNER JOIN by default and silently dropping rows the analyst never meant to drop — a customer table joined to orders returns no customers who haven't ordered yet. The first question to ask about any join is 'do I need rows with no match on one side?'\n\nRIGHT JOIN is almost never the clearest choice. You can always swap the table order and use LEFT JOIN, which reads left-to-right in the direction of the anchor — more natural. FULL OUTER JOIN is rare but essential for reconciliation: 'show me every row in A or B that doesn't have a counterpart.'\n\nWhen debugging a join that drops rows unexpectedly, the move is to switch it to LEFT JOIN and look for NULLs on the right side — that tells you which left rows had no match and why.",
        interviewerLens:
          "I'm listening for two things: whether you can explain the NULL behavior, and whether you can say when you'd actually reach for each one. 'LEFT JOIN returns all from the left' is the correct textbook answer; 'I use LEFT JOIN when I need to keep every customer even if they have no orders' is the hired answer. If you can't say when, you've memorized a definition, not understood a tool.",
        followupChain: [
          {
            question: "Your query returns way more rows than you expected after a JOIN. What's happening?",
            answer: "Almost certainly a join fan-out: the join key isn't unique on one side, so each left row matches multiple right rows and the result set explodes. First, COUNT the join key on both sides to check uniqueness. Fix by deduplicating one side before joining, or using a GROUP BY/aggregation step."
          },
          {
            question: "How do you find rows in table A that have NO match in table B?",
            answer: "LEFT JOIN B on the key, then WHERE B.key IS NULL. This is cleaner and usually faster than NOT IN (which behaves badly with NULLs) or NOT EXISTS."
          },
          {
            question: "What is a CROSS JOIN and when would you actually use one?",
            answer: "A CROSS JOIN returns the Cartesian product — every row in A paired with every row in B. Rarely what you want by accident, but useful intentionally: generating all combinations (e.g. every date paired with every store to find gaps), or pairing a small lookup table with a date spine."
          }
        ],
        redFlags: [
          {
            junior: "\"INNER JOIN is the default, I use it for everything.\"",
            senior: "\"I check first whether I need to preserve unmatched rows — then LEFT JOIN is the right default when the left table is the anchor.\""
          },
          {
            junior: "\"I got way more rows than expected and I'm not sure why.\"",
            senior: "\"That's a fan-out — I'd COUNT the join key on both sides to find the non-unique side, then deduplicate before joining.\""
          }
        ],
        alternatePhrasings: [
          "\"What's the difference between INNER and LEFT JOIN?\"",
          "\"Why do I get NULLs after a join?\"",
          "\"My join doubled the row count — what happened?\""
        ],
        interviewContexts: [
          "Asked in nearly every SQL fundamentals screen",
          "Entry-level analytics role at a Series A e-commerce company"
        ]
      },
      {
        category: "deep-dives",
        riskLevel: "high",
        asked: 22,
        questionText:
          "How does SQL handle NULL? What are the gotchas with NULL in WHERE clauses, COUNT, and JOINs?",
        code: [
          {
            lang: "sql",
            lines: [
              "-- = NULL is UNKNOWN, never TRUE",
              "WHERE status = NULL    -- 0 rows",
              "WHERE status IS NULL   -- correct",
              "",
              "SELECT COUNT(*),        -- all rows",
              "       COUNT(status)    -- skips NULLs",
              "FROM orders;",
            ],
          },
        ],
        answerStructured:
          "- SQL uses **three-valued logic**: a condition evaluates to TRUE, FALSE, or **UNKNOWN**. Any comparison with NULL yields UNKNOWN — not FALSE.\n- `WHERE status = NULL` returns nothing — you must use `WHERE status IS NULL`. `NULL = NULL` is UNKNOWN, not TRUE.\n- **COUNT(column)** skips NULLs; **COUNT(*)** counts every row regardless. This is one of the most common sources of wrong totals.\n- **JOIN**: NULLs in join keys never match — `NULL = NULL` is UNKNOWN, so a row with a NULL key joins to nothing.\n- **Aggregates** (SUM, AVG, MIN, MAX) ignore NULLs. `AVG` of (1, 2, NULL) is 1.5, not 1.0 — this surprises people.\n- Fix with **COALESCE(col, default)** or **IS NULL / IS NOT NULL**.",
        explanationDeep:
          "The root cause of almost every NULL confusion is three-valued logic: SQL doesn't evaluate conditions to TRUE/FALSE — it evaluates them to TRUE/FALSE/UNKNOWN. UNKNOWN behaves like FALSE in a WHERE clause (the row is excluded), which is why `WHERE x = NULL` silently returns nothing instead of everything-that-is-null.\n\nThe COUNT gotcha is a classic: if you're counting a nullable column to count users, and some users have no value, your count is lower than you expect. You want COUNT(*) for row count, COUNT(col) only when you intentionally want to count non-NULL values.\n\nJoin keys with NULLs are a quieter trap: if your join column has NULLs, those rows will never match anything, and the join silently drops them (INNER) or returns NULLs on the other side (LEFT). Always check for NULLs in join columns before trusting a join.",
        interviewerLens:
          "I want to hear 'three-valued logic' or at minimum 'IS NULL, not = NULL.' The COUNT distinction (COUNT(*) vs COUNT(col)) is the other half — candidates who know both have clearly been burned by bad aggregates in production. If you just say 'NULL means missing' without explaining the comparison behavior, you haven't internalized it.",
        followupChain: [
          {
            question: "What does COALESCE do?",
            answer: "Returns the first non-NULL value in its argument list. COALESCE(a, b, 0) returns a if not NULL, else b if not NULL, else 0. It's ANSI SQL; ISNULL() is SQL Server-specific. Use COALESCE when you need a fallback for NULL in calculations or string concatenation."
          },
          {
            question: "Why does 'NOT IN (subquery)' return nothing when the subquery has a NULL?",
            answer: "Because NOT IN expands to != all values, and != NULL is UNKNOWN, not TRUE. So the whole expression becomes UNKNOWN and the row is excluded. Use NOT EXISTS instead — it handles NULLs correctly and is usually the safer choice."
          }
        ],
        redFlags: [
          {
            junior: "\"WHERE col = NULL\"",
            senior: "\"WHERE col IS NULL — comparing to NULL with = always returns UNKNOWN, never TRUE.\""
          },
          {
            junior: "\"COUNT(column) gives me the row count.\"",
            senior: "\"COUNT(column) skips NULLs; I use COUNT(*) when I want the full row count.\""
          }
        ],
        alternatePhrasings: [
          "\"What's the difference between COUNT(*) and COUNT(column)?\"",
          "\"Why does my WHERE clause miss NULL values?\"",
          "\"Explain SQL's three-valued logic.\""
        ],
        interviewContexts: [
          "SQL fundamentals screen at a fintech startup",
          "Asked at a business intelligence analyst loop"
        ]
      },
      {
        category: "deep-dives",
        riskLevel: "medium",
        asked: 19,
        questionText:
          "Walk me through how GROUP BY and aggregate functions work. What can and can't you put in the SELECT list?",
        code: [
          {
            lang: "sql",
            lines: [
              "-- region not grouped -> error",
              "SELECT region, SUM(amt)",
              "FROM sales GROUP BY dept;",
              "",
              "-- valid: grouped or aggregated",
              "SELECT dept, SUM(amt)",
              "FROM sales GROUP BY dept;",
            ],
          },
        ],
        answerStructured:
          "- **GROUP BY** collapses all rows that share the same value(s) in the grouped columns into one output row, then applies aggregate functions (SUM, COUNT, AVG, MAX, MIN) to each group.\n- In the SELECT list, every non-aggregated column **must appear in the GROUP BY clause** — otherwise the engine doesn't know which value to show for that column within the group.\n- Use **HAVING** to filter *after* aggregation (e.g., `HAVING COUNT(*) > 5`); use **WHERE** to filter *before* grouping.\n- Logical execution order: `FROM → WHERE → GROUP BY → HAVING → SELECT → ORDER BY`.\n- DISTINCT inside an aggregate (`COUNT(DISTINCT user_id)`) counts unique values before counting.",
        explanationDeep:
          "The SELECT-list rule is the one that trips people up most: if I group by department, I can SELECT department (I grouped on it) and COUNT(*) (an aggregate). I cannot SELECT employee_name without also grouping on it or aggregating it — the engine would have to pick one of multiple names per group arbitrarily.\n\nThe evaluation order is the deeper insight. It explains why you can't filter on an aggregate in WHERE (aggregates don't exist yet at the WHERE stage — use HAVING), and why you can't use a SELECT alias in WHERE (SELECT runs after WHERE). Once you understand the order, all the seemingly arbitrary rules fall out of it.\n\nCOUNT(DISTINCT col) is also worth knowing: it counts unique non-NULL values, which is exactly what you want for 'how many distinct customers placed orders' — different from COUNT(*) or COUNT(col).",
        interviewerLens:
          "I want to hear the execution order, not just 'GROUP BY groups rows.' If you can tell me why WHERE COUNT(*) > 5 errors, and why you use HAVING instead, you've demonstrated you understand the engine — not just the syntax. The SELECT list rule (non-aggregated = must be in GROUP BY) should come out naturally as part of the explanation.",
        followupChain: [
          {
            question: "Why does this error: SELECT dept, name, COUNT(*) FROM employees GROUP BY dept?",
            answer: "Because 'name' is neither in the GROUP BY nor wrapped in an aggregate function. The engine can't choose which name to return for a department with many employees. Fix: add name to GROUP BY (changes the grain), or use MAX(name) / MIN(name) if you want any representative value."
          },
          {
            question: "When would you use COUNT(DISTINCT col) instead of COUNT(*)?",
            answer: "When you want unique entities, not total rows. 'How many distinct users purchased?' is COUNT(DISTINCT user_id); 'how many orders total?' is COUNT(*). They'll give different answers whenever users have more than one order."
          }
        ],
        redFlags: [
          {
            junior: "\"I can put any column in SELECT with GROUP BY.\"",
            senior: "\"Only columns in the GROUP BY or wrapped in an aggregate — otherwise it's undefined which value to return.\""
          },
          {
            junior: "\"I'd filter with WHERE COUNT(*) > 5.\"",
            senior: "\"That's a syntax error — WHERE runs before aggregation, so COUNT doesn't exist yet. That filter goes in HAVING.\""
          }
        ],
        alternatePhrasings: [
          "\"Why does GROUP BY error when I add more columns to SELECT?\"",
          "\"What's the difference between WHERE and HAVING?\""
        ],
        interviewContexts: [
          "Junior SQL screen at a data analytics startup",
          "Asked at an entry-level data analyst interview"
        ]
      },
      // ── decision-frameworks ───────────────────────────────────
      {
        category: "decision-frameworks",
        riskLevel: "medium",
        asked: 14,
        questionText:
          "DISTINCT vs GROUP BY — when would you choose one over the other for deduplication?",
        answerStructured:
          "- **DISTINCT**: removes duplicate rows from the full result set. Simple, declarative, and best when you just need unique rows with no aggregation.\n- **GROUP BY**: collapses rows and lets you apply aggregates per group. The right choice when you want uniqueness *plus* a count, sum, or other aggregate.\n- For a plain deduplicated list: `SELECT DISTINCT col` — cleaner and signals intent.\n- For 'unique values + count': `SELECT col, COUNT(*) … GROUP BY col` — DISTINCT won't give you the count.\n- **Performance**: on most modern engines they're close, but GROUP BY is slightly more optimizable when combined with aggregates. Don't optimize prematurely.\n- If you need to deduplicate while keeping *specific* rows (e.g., the most recent per user), use a window function (`ROW_NUMBER()`) — DISTINCT and GROUP BY alone can't control which duplicate to keep.",
        explanationDeep:
          "The semantic difference is simple: DISTINCT says 'give me unique rows,' GROUP BY says 'give me one row per group and let me aggregate.' When all you want is a deduplicated list, DISTINCT is cleaner — it reads like what you mean. When you need something per group (count, sum, latest value), GROUP BY is the only option.\n\nThe nuance is when you care *which* duplicate to keep. Neither DISTINCT nor GROUP BY gives you control over that. If you want 'one row per customer, the most recent order,' you need ROW_NUMBER() or a lateral join — that's a mid-level skill, but worth knowing this is the boundary.",
        interviewerLens:
          "I'm checking whether you know DISTINCT is a full-row operation (applies to all selected columns together) and whether you know it's limited when you want to control which duplicate survives. The jump from 'DISTINCT for dedup' to 'ROW_NUMBER for keeping the right one' is the junior-to-mid signal.",
        followupChain: [
          {
            question: "Does SELECT DISTINCT col1, col2 deduplicate only on col1?",
            answer: "No — DISTINCT applies to the entire row tuple. If col1 is the same but col2 differs, both rows are kept. To deduplicate on one column and pick a specific row, you need GROUP BY + aggregate or a window function."
          }
        ],
        redFlags: [
          {
            junior: "\"DISTINCT is always the best way to deduplicate.\"",
            senior: "\"DISTINCT is great for simple dedup; when I need to control which duplicate survives, I use ROW_NUMBER() partitioned on the key.\""
          }
        ],
        alternatePhrasings: [
          "\"How do you deduplicate rows in SQL?\"",
          "\"When would GROUP BY be better than DISTINCT?\""
        ],
        interviewContexts: ["SQL fundamentals screen", "Junior data analyst role at a SaaS company"]
      },
      {
        category: "decision-frameworks",
        riskLevel: "low",
        asked: 11,
        questionText:
          "How do you choose between using a subquery and a JOIN for a filtering task?",
        code: [
          {
            accent: "bug",
            lang: "sql",
            label: "NOT IN + NULL kills all rows",
            lines: [
              "SELECT * FROM orders",
              "WHERE cust_id NOT IN (",
              "  SELECT cust_id FROM banned",
              ");  -- any NULL -> 0 rows",
            ],
          },
          {
            accent: "fix",
            lang: "sql",
            lines: [
              "SELECT * FROM orders o",
              "WHERE NOT EXISTS (",
              "  SELECT 1 FROM banned b",
              "  WHERE b.cust_id = o.cust_id",
              ");",
            ],
          },
        ],
        answerStructured:
          "- **JOIN**: readable when you need columns from both tables in the output, or when the relationship is a many-to-one lookup.\n- **Subquery in WHERE (IN / EXISTS)**: cleaner when you only need the outer table's columns and are filtering on membership.\n- **EXISTS vs IN**: prefer EXISTS when the inner query can be large — it short-circuits once a match is found, and handles NULLs correctly (IN with NULLs in the subquery can silently return nothing).\n- On modern optimizers the performance difference is often negligible — **readability** is the primary driver.\n- Anti-patterns to avoid: correlated subqueries in SELECT that run once per row (use a JOIN or window function instead), and NOT IN when the subquery might return NULLs.",
        explanationDeep:
          "Modern query optimizers (Postgres, SQL Server, BigQuery) often rewrite EXISTS/IN into the same plan as a JOIN, so the performance difference is usually small. That means the real question is what's more readable and maintainable. If I only need columns from the outer table and I'm doing a membership test, `WHERE EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = c.id)` clearly reads 'customers who have at least one order.'\n\nThe NOT IN + NULL trap is worth memorizing: `NOT IN (SELECT customer_id FROM orders)` returns zero rows if any customer_id in orders is NULL, because NOT IN expands to '!= every value,' and NULL comparisons yield UNKNOWN. NOT EXISTS doesn't have this problem — it returns TRUE when the correlated subquery finds no match, regardless of NULLs.",
        interviewerLens:
          "I care about the EXISTS-vs-IN-with-NULLs awareness and the correlated-subquery-per-row anti-pattern. Candidates who know why NOT IN is dangerous with NULLs have thought carefully about SQL semantics, not just syntax.",
        followupChain: [
          {
            question: "What's a correlated subquery and why can it be slow?",
            answer: "A subquery that references the outer query — it re-executes for every row of the outer query, turning a O(n) query into O(n²). Rewrite with a JOIN or window function to compute it once."
          }
        ],
        redFlags: [
          {
            junior: "\"I always use IN for filtering.\"",
            senior: "\"I prefer EXISTS for large inner sets and especially when the inner query might have NULLs — NOT IN + NULL silently kills all rows.\""
          }
        ],
        alternatePhrasings: [
          "\"EXISTS vs IN — which do you prefer?\"",
          "\"When is a subquery better than a JOIN?\""
        ],
        interviewContexts: ["SQL technical screen", "Data engineering fundamentals interview"]
      },
      // ── tool-comparison ───────────────────────────────────────
      {
        category: "tool-comparison",
        riskLevel: "medium",
        isComparison: true,
        comparisonTools: ["WHERE", "HAVING"],
        asked: 13,
        questionText:
          "WHERE vs HAVING — what's the difference, and why can't you filter an aggregate in WHERE?",
        code: [
          {
            lang: "sql",
            lines: [
              "-- WHERE can't see aggregates",
              "WHERE COUNT(*) > 5   -- error",
              "",
              "SELECT dept, COUNT(*)",
              "FROM emp WHERE active",
              "GROUP BY dept",
              "HAVING COUNT(*) > 5;",
            ],
          },
        ],
        answerStructured:
          "- **WHERE** filters rows **before** grouping. It runs before GROUP BY, so aggregate results don't exist yet — `WHERE COUNT(*) > 5` is a syntax error.\n- **HAVING** filters **after** GROUP BY. It can reference aggregates because it runs after they're computed.\n- Logical execution order: `FROM → WHERE → GROUP BY → HAVING → SELECT → ORDER BY`.\n- Performance tip: push non-aggregate filters into WHERE — it reduces the rows that need grouping, which is faster than filtering a large group result with HAVING.\n- You can use both in the same query: `WHERE status = 'active' HAVING COUNT(*) > 2` — WHERE shrinks the input, HAVING filters the output.",
        explanationDeep:
          "This question is really about the logical processing order of SQL. WHERE sees individual rows before any grouping; HAVING sees the output of GROUP BY. That's why an aggregate like COUNT(*) only makes sense in HAVING — the groups don't exist yet when WHERE runs.\n\nThe practical consequence: always put row-level filters in WHERE (faster, reduces grouping work) and only use HAVING for aggregate conditions. A common mistake is putting everything in HAVING 'just to be safe' — it works but it's slower because you're grouping all rows first and then filtering.\n\nThe evaluation-order insight also explains why you can't use a SELECT alias in WHERE on most engines — SELECT is evaluated *after* WHERE, so the alias doesn't exist yet.",
        interviewerLens:
          "I'm looking for the execution order as the *reason*, not just 'HAVING is for groups.' Anyone can memorize the rule; knowing the reason means you can derive all the corollaries (alias in WHERE, multiple aggregates in HAVING, performance implication). That's the senior tell.",
        followupChain: [
          {
            question: "Why can't I use a SELECT alias in the WHERE clause?",
            answer: "Because SELECT is evaluated after WHERE in the logical order — the alias doesn't exist yet when WHERE runs. Some engines allow aliases in ORDER BY (which runs last), but not WHERE."
          },
          {
            question: "Can you use both WHERE and HAVING in the same query?",
            answer: "Yes, and you should when you have both row-level and aggregate filters. WHERE filters rows before grouping (cheaper), HAVING filters groups after (necessary for aggregates)."
          }
        ],
        redFlags: [
          {
            junior: "\"They're basically the same.\"",
            senior: "\"WHERE is pre-aggregation, HAVING is post — the key is the logical execution order of SQL.\""
          }
        ],
        alternatePhrasings: [
          "\"Why does WHERE COUNT(*) > 1 give an error?\"",
          "\"When do you use HAVING versus WHERE?\""
        ],
        interviewContexts: [
          "Junior SQL technical screen",
          "Analytics engineer entry-level loop"
        ]
      }
    ],
    topics: {
      moreDeepDives: [
        "Write a query to find customers who have placed more than 3 orders in the last 30 days.",
        "What does ORDER BY NULL LAST do and when do you use it?",
        "Explain the difference between UNION and UNION ALL.",
        "How do you find the most recent record per user without a window function?",
        "What is a self-join and give a real use case."
      ],
      decisions: [
        "When do you use a CTE versus a subquery for readability?",
        "LIMIT + OFFSET for pagination — what are the pitfalls at scale?",
        "When is SELECT * acceptable and when is it dangerous?"
      ],
      quickRef: [
        "What does DISTINCT apply to — one column or all?",
        "Logical execution order of a SELECT statement?",
        "What does COUNT(*) vs COUNT(col) return differently?",
        "IS NULL vs = NULL — which works?",
        "What does COALESCE return?",
        "INNER JOIN vs LEFT JOIN in one sentence each?",
        "What is a Cartesian product?",
        "What does GROUP BY do to rows?",
        "Can you ORDER BY a column not in SELECT?",
        "What does LIKE '%value%' do to index usage?"
      ],
      redFlags: [
        {
          junior: "\"I use SELECT * to keep things simple.\"",
          senior: "\"I name columns — SELECT * breaks on schema changes and ships unnecessary data to the client.\""
        },
        {
          junior: "\"WHERE col = NULL to find NULLs.\"",
          senior: "\"WHERE col IS NULL — NULL comparisons with = always return UNKNOWN.\""
        },
        {
          junior: "\"I just throw a DISTINCT in there if I get duplicates.\"",
          senior: "\"Duplicates usually mean a join fan-out or bad grain — I diagnose the root cause before masking with DISTINCT.\""
        },
        {
          junior: "\"NOT IN (subquery) to find rows with no match.\"",
          senior: "\"NOT IN fails silently when the subquery has NULLs — I use NOT EXISTS instead.\""
        },
        {
          junior: "\"WHERE COUNT(*) > 5\"",
          senior: "\"That's a syntax error — aggregates go in HAVING, which runs after GROUP BY.\""
        },
        {
          junior: "\"I loop through results in application code to filter.\"",
          senior: "\"That's N+1 — push the filter into SQL where the engine can optimize it.\""
        }
      ],
      checklist: [
        "Know all four JOIN types and when NULLs appear in each",
        "Be able to explain three-valued logic and IS NULL vs = NULL",
        "Understand the logical execution order: FROM → WHERE → GROUP BY → HAVING → SELECT → ORDER BY",
        "Know COUNT(*) vs COUNT(col) and how NULLs affect each aggregate",
        "Be ready to debug a fan-out: how to spot it, how to fix it"
      ],
      behavioral: [
        "Tell me about a time your query returned wrong numbers — how did you debug it?",
        "Describe a SQL query you wrote that you're especially proud of.",
        "How do you explain a complex query to a non-technical stakeholder?"
      ],
      reverse: [
        "What SQL dialect / engine will I be writing against day-to-day?",
        "Do you use a style guide or code review process for SQL?",
        "How much of the role is writing SQL versus building pipelines?"
      ]
    }
  },

  // ─────────────────────────────────────────────────────────────
  // MID  — Window functions, CTEs, subquery patterns, debugging fan-out
  // ─────────────────────────────────────────────────────────────
  mid: {
    authored: [
      // ── deep-dives ────────────────────────────────────────────
      {
        category: "deep-dives",
        riskLevel: "high",
        freePreview: true,
        asked: 33,
        questionText:
          "Find the second-highest salary per department. Walk me through your query and the edge cases.",
        code: [
          {
            lang: "sql",
            lines: [
              "WITH r AS (",
              "  SELECT dept, emp, salary,",
              "    DENSE_RANK() OVER (",
              "      PARTITION BY dept",
              "      ORDER BY salary DESC) rk",
              "  FROM emp)",
              "SELECT * FROM r WHERE rk = 2;",
            ],
          },
        ],
        answerStructured:
          "- Use a **window function**: `DENSE_RANK() OVER (PARTITION BY dept ORDER BY salary DESC)` then filter `= 2`.\n- **Why DENSE_RANK, not RANK or ROW_NUMBER**: if two people share the top salary, `RANK` gives them both rank 1 and the next distinct salary rank 3 (gap). `ROW_NUMBER` would arbitrarily assign 1 and 2 to the tied rows. `DENSE_RANK` gives both rank 1 and the next distinct value rank 2 — usually what 'second-highest *salary*' means.\n- **Edge cases to name out loud**: departments with fewer than 2 distinct salaries (the filter returns no row — confirm: NULL or omit?), tied salaries at rank 2 returning multiple rows, and whether 'second-highest person' vs 'second-highest salary value' is intended.\n- Structure: CTE to rank, then `SELECT ... WHERE rnk = 2` outside — keeps it readable.\n- The correlated subquery / nested MAX approach also works but doesn't generalize to Nth and reads poorly at scale.",
        explanationDeep:
          "This is the canonical window-function gate question. The senior signal isn't knowing DENSE_RANK — it's stopping to clarify the ambiguity before writing a line. 'Second-highest salary' is underspecified: does it mean the person with the second-highest number, or the second distinct salary value? If two people earn $100k and you want the second distinct value, DENSE_RANK gives you rank 2 = $90k. If you want the second-ranked person (ties broken arbitrarily), ROW_NUMBER might be correct — but it's a different question.\n\nI'd write it as a CTE: rank inside, filter outside. That makes the 'why rank = 2' obvious to a reviewer and composable for follow-ups. Then I'd explicitly ask: which behavior on ties? That single question often decides a loop.\n\nThe nested-MAX approach (`MAX(salary) WHERE salary < (SELECT MAX...)`) works for one department at a time but doesn't partition cleanly. Window functions scale to any grain.",
        interviewerLens:
          "I'm not testing whether you know window functions — I'm watching whether you clarify the ambiguity (salary value vs person) and can explain DENSE_RANK vs RANK vs ROW_NUMBER *when each gives a different answer*. Candidates who immediately write LIMIT 1 OFFSET 1 or a nested MAX without asking about ties are telling me they haven't hit this edge in production. The question I set after this is 'what if a department has only one salary?' — if your query silently drops that department, that's a bug.",
        followupChain: [
          {
            question: "Now return the Nth-highest salary, parameterized.",
            answer: "Same structure — swap the filter to `= N`. DENSE_RANK vs RANK still changes the answer on ties. For very large N, the window approach is the only one that generalizes cleanly."
          },
          {
            question: "What if a department has fewer than 2 distinct salaries?",
            answer: "The CTE filter returns no row for that department. If the spec wants every department in the output, LEFT JOIN the department list and COALESCE the rank-2 salary to NULL. I'd confirm which behavior is required before writing either version."
          },
          {
            question: "RANK vs DENSE_RANK vs ROW_NUMBER in one line each?",
            answer: "ROW_NUMBER: unique sequential integer, ties broken arbitrarily. RANK: tied rows share a rank, leaves gaps (1, 1, 3). DENSE_RANK: tied rows share a rank, no gaps (1, 1, 2)."
          }
        ],
        redFlags: [
          {
            junior: "\"I'd use LIMIT 1 OFFSET 1.\"",
            senior: "\"That breaks per-group and on ties — I'd use DENSE_RANK partitioned by department, after asking which tie behavior is expected.\""
          },
          {
            junior: "Writing the query without asking about salary-value vs person.",
            senior: "Clarifying 'second distinct salary value or second-ranked person?' before writing a line."
          }
        ],
        alternatePhrasings: [
          "\"Get the top-2 earners in each department.\"",
          "\"Return the Nth-highest value per group.\"",
          "\"Rank employees by salary within their team.\""
        ],
        interviewContexts: [
          "Asked at nearly every analytics and data engineering SQL screen",
          "FAANG data analyst loop",
          "Mid-level data engineer screen at a Series C fintech"
        ]
      },
      {
        category: "deep-dives",
        riskLevel: "high",
        asked: 24,
        questionText:
          "Write a query to compute a 7-day rolling average of daily revenue. What window frame do you use and why?",
        code: [
          {
            lang: "sql",
            lines: [
              "SELECT date, daily_revenue,",
              "  AVG(daily_revenue) OVER (",
              "    ORDER BY date",
              "    ROWS BETWEEN 6 PRECEDING",
              "    AND CURRENT ROW) AS avg7",
              "FROM revenue;",
            ],
          },
        ],
        answerStructured:
          "- Use `AVG(daily_revenue) OVER (ORDER BY date ROWS BETWEEN 6 PRECEDING AND CURRENT ROW)` — this averages the current day plus the 6 prior days (7 rows total).\n- **ROWS vs RANGE**: `ROWS BETWEEN` counts physical rows; `RANGE BETWEEN` counts rows with the same ORDER BY value. For a daily revenue table (one row per day), both behave the same — but if there are missing days, `ROWS BETWEEN 6 PRECEDING` still looks at 6 prior rows even if they're not 6 calendar days apart. If you want a true 7-day calendar window, you need a date spine or a date-range-based approach.\n- **Date spine**: pre-generate every calendar date and LEFT JOIN your revenue onto it so missing days appear as 0 (or NULL), then apply the window. This is usually the right production approach.\n- Name the **PARTITION BY** if you want per-entity rolling averages (e.g., per product, per store).",
        explanationDeep:
          "The naive approach — ORDER BY date, ROWS BETWEEN 6 PRECEDING — works perfectly when there's exactly one row per date and no gaps. That assumption breaks in real data: store closures, weekends with no sales, or a data pipeline gap create missing dates. When rows are missing, 'ROWS BETWEEN 6 PRECEDING' includes 6 prior rows, but those rows might span 10 calendar days, not 7. The rolling average is silently wrong.\n\nThe production fix is a date spine: generate the full set of calendar dates with a recursive CTE or a pre-built calendar table, LEFT JOIN the actual revenue onto it, and let missing days fill with 0 or NULL. Then the window frame sees a true 7-row = 7-day window. This is a pattern that separates people who've built production reporting from people who've only done toy examples.\n\nROWS vs RANGE is worth knowing: RANGE looks at value boundaries (all rows with the same ORDER BY value), ROWS looks at physical position. For distinct dates, they're equivalent. But for non-distinct values in the ORDER BY, RANGE can silently include more rows than expected.",
        interviewerLens:
          "I'm listening for two things: the correct window frame syntax (ROWS BETWEEN 6 PRECEDING) and the date-gap problem. Candidates who write the window function correctly but don't mention missing dates have only done toy examples. The date-spine answer separates people who've shipped production reports from those who learned SQL from tutorials.",
        followupChain: [
          {
            question: "How do you generate a date spine in SQL?",
            answer: "Recursive CTE: anchor on a start date, recursively add 1 day until the end date. Or use a numbers table joined with a date arithmetic expression. Most warehouses also have a generate_series() or unnest(sequence()) equivalent."
          },
          {
            question: "How would you compute a rolling SUM instead of AVG?",
            answer: "SUM(revenue) OVER (ORDER BY date ROWS BETWEEN 6 PRECEDING AND CURRENT ROW). Same frame, different aggregate. For cumulative sum, use ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW."
          },
          {
            question: "What does UNBOUNDED PRECEDING mean?",
            answer: "The window frame starts at the very first row of the partition — giving a running/cumulative total. Combined with UNBOUNDED FOLLOWING, it spans the entire partition (same as no frame clause for most aggregates)."
          }
        ],
        redFlags: [
          {
            junior: "\"I'd use a subquery with WHERE date >= current - 7.\"",
            senior: "\"A window function with ROWS BETWEEN 6 PRECEDING is cleaner and more composable — and I'd add a date spine to handle gaps.\""
          },
          {
            junior: "\"ROWS BETWEEN 7 PRECEDING AND CURRENT ROW.\"",
            senior: "\"That's 8 rows (7 prior + current). For a 7-day average it's ROWS BETWEEN 6 PRECEDING AND CURRENT ROW.\""
          }
        ],
        alternatePhrasings: [
          "\"Calculate a running average over the past week.\"",
          "\"What's the window frame for a rolling 30-day sum?\"",
          "\"How do you handle missing dates in a time-series aggregate?\""
        ],
        interviewContexts: [
          "Mid-level data analyst screen at an e-commerce company",
          "StrataScratch-style SQL problem at a Series B analytics team",
          "Asked at a business intelligence engineer loop"
        ]
      },
      {
        category: "deep-dives",
        riskLevel: "medium",
        asked: 18,
        questionText:
          "How do you use LAG() and LEAD() to calculate period-over-period change, and what are the edge cases?",
        code: [
          {
            lang: "sql",
            lines: [
              "SELECT year, revenue,",
              "  revenue - LAG(revenue) OVER (",
              "    PARTITION BY product",
              "    ORDER BY year) AS yoy",
              "-- pct change: divide by",
              "-- NULLIF(prior,0) to dodge /0",
              "FROM sales;",
            ],
          },
        ],
        answerStructured:
          "- **LAG(col, N)**: returns the value of `col` from N rows *behind* the current row within the window. Use it to compare current value to a prior period without a self-join.\n- **LEAD(col, N)**: same idea, N rows *ahead*.\n- Year-over-year revenue change: `revenue - LAG(revenue, 1) OVER (PARTITION BY product ORDER BY year)` — clean, one pass.\n- **Edge cases**: the first N rows in each partition return NULL (no prior period exists). Handle with COALESCE or exclude with a WHERE on the row's position.\n- LAG default value: `LAG(col, 1, 0)` uses 0 as the fallback when the prior row is NULL — useful to treat 'no prior period' as 0 revenue, but beware of semantic meaning.\n- Percentage change: `(revenue - LAG(revenue, 1) OVER (...)) / NULLIF(LAG(revenue, 1) OVER (...), 0)` — NULLIF guards against division by zero.",
        explanationDeep:
          "Before window functions, 'compare to previous row' required a self-join on offset row numbers — messy, often wrong, always slower. LAG/LEAD computes this in a single scan and is far more readable. The partition by clause ensures you're comparing within the right group (per product, per region) rather than accidentally comparing across groups.\n\nThe NULL at the boundary is the most common source of wrong output: if you compute percentage change and the first row of a partition has no prior period, LAG returns NULL, making your percentage change NULL for that row. Whether to exclude those rows (WHERE prior_value IS NOT NULL) or fill them (COALESCE to 0) depends on the business question. For growth metrics, usually exclude — a 'first appearance' isn't meaningful growth data.\n\nDivision by zero is the other trap: if prior revenue was 0, the percentage-change formula blows up. NULLIF(prior, 0) turns zero into NULL so the division returns NULL instead of an error.",
        interviewerLens:
          "I want to hear LAG/LEAD named immediately as the right tool ('instead of a self-join'), the partition-by importance, and the NULL-at-boundary handling. Candidates who know about NULLIF for zero division have clearly written production metrics code.",
        followupChain: [
          {
            question: "How would you calculate the difference between each event and the one 3 events prior?",
            answer: "LAG(col, 3) OVER (PARTITION BY user_id ORDER BY event_time) — the second argument to LAG is the offset, defaulting to 1."
          },
          {
            question: "Self-join vs LAG for 'compare to previous row' — why prefer LAG?",
            answer: "Self-join requires generating offset row numbers (ROW_NUMBER), joining back, and is harder to read. LAG is a single pass, reads declaratively, and is easier for the optimizer to handle."
          }
        ],
        redFlags: [
          {
            junior: "\"I'd self-join the table on row_number() - 1.\"",
            senior: "\"LAG() does this in one scan and is far more readable — self-joins on offsets are the pre-window-function workaround.\""
          },
          {
            junior: "\"I wouldn't worry about NULLs at the start.\"",
            senior: "\"The first row of every partition returns NULL from LAG — I decide whether to exclude or fill those based on what 'no prior period' means for the metric.\""
          }
        ],
        alternatePhrasings: [
          "\"How do you compute month-over-month growth rate?\"",
          "\"How do you compare each row to the row before it without a self-join?\"",
          "\"What window function do you use for period-over-period metrics?\""
        ],
        interviewContexts: [
          "Mid-level data analyst loop at a SaaS company",
          "Analytics engineering screen at a growth-stage startup",
          "Asked at a Year-over-Year reporting interview at a retail analytics team"
        ]
      },
      {
        category: "deep-dives",
        riskLevel: "medium",
        asked: 15,
        questionText:
          "What is a CTE, how does it differ from a subquery, and when would you use a temp table instead?",
        answerStructured:
          "- A **CTE** (`WITH name AS (...)`) names a logical step so you can reference it by name later in the query. Improves readability and eliminates repeated subqueries.\n- **Vs subquery**: mostly a readability difference on modern engines — but on some databases (older Postgres), a CTE was an **optimization fence** (materialized exactly once, preventing the planner from pushing predicates through it). Know your engine.\n- **Temp table**: a physical table written to disk (or a temp schema) during query execution. Use it when: the intermediate result is large, reused across multiple separate queries or statements, or the optimizer keeps recomputing it. Pay the write cost once; read it cheaply many times.\n- **Summary**: CTE for readability in a single complex query; temp table for large intermediates reused across statements or when the engine needs a hint to materialize.\n- Window functions belong *inside* CTEs when you need to filter on their result — you can't put `WHERE rank = 2` in the same SELECT where you define the window.",
        explanationDeep:
          "The practical reason to choose CTE over a nested subquery is code review: a deeply nested subquery is hard to debug because you have to mentally unpack the nesting. A CTE with a descriptive name ('ranked_employees', 'daily_revenue') makes the query read like a recipe — step by step.\n\nThe optimization-fence caveat is the senior signal. In older versions of PostgreSQL, a CTE was always materialized — meaning it was computed once and the result cached, which could help (avoiding recomputation) or hurt (preventing index pushdown into the CTE). Modern Postgres (v12+) inlines CTEs by default unless you use MATERIALIZED explicitly. SQL Server and BigQuery inline them differently. If you're tuning a slow CTE-heavy query, this is worth checking.\n\nTemp tables earn their keep in multi-statement scenarios: a stored procedure that runs several queries against the same intermediate result, or an ETL step where you want to materialize a deduplication pass before doing several different joins against it. The write cost is a one-time payment; subsequent reads are fast.",
        interviewerLens:
          "I want three answers: CTE = readability in one query; subquery = fine for one-off simple cases; temp table = large reused intermediates or multi-statement scripts. The optimization fence is a bonus — it tells me you've profiled CTE-heavy queries and encountered the behavior, not just read about it.",
        followupChain: [
          {
            question: "Can you reference a CTE more than once in the same query?",
            answer: "Yes, by name. On engines that don't materialize CTEs (inline by default), the CTE is recomputed each reference — which can be expensive. In those cases, a temp table or MATERIALIZED CTE hint ensures a single computation."
          },
          {
            question: "Why do you need a CTE (or subquery) to filter on a window function result?",
            answer: "Because WHERE runs before the window is computed — the rank doesn't exist yet. You define the window in an inner query or CTE, then filter in the outer query. QUALIFY (available in BigQuery, Snowflake) lets you filter window results inline, skipping the outer query."
          }
        ],
        redFlags: [
          {
            junior: "\"CTEs are just slower subqueries wrapped in WITH.\"",
            senior: "\"They're mostly readability, but can be an optimization fence on some engines — worth checking behavior when tuning.\""
          },
          {
            junior: "\"I always use temp tables for intermediate results.\"",
            senior: "\"I use CTEs for readability within a query and only reach for temp tables when the intermediate is large, reused across statements, or the optimizer needs the materialization.\""
          }
        ],
        alternatePhrasings: [
          "\"How do you structure a complex multi-step query?\"",
          "\"Is a CTE always materialized?\"",
          "\"When would you use a temp table over a CTE?\""
        ],
        interviewContexts: [
          "Analytics engineering screen",
          "Mid-level data engineer interview at a B2B SaaS startup",
          "Asked in a SQL design round at a growth-stage fintech"
        ]
      },
      // ── decision-frameworks ───────────────────────────────────
      {
        category: "decision-frameworks",
        riskLevel: "medium",
        asked: 16,
        questionText:
          "When do you reach for a window function versus GROUP BY? Walk me through the decision.",
        code: [
          {
            lang: "sql",
            lines: [
              "-- each row keeps detail +",
              "-- its dept average alongside",
              "SELECT emp, dept, salary,",
              "  AVG(salary) OVER (",
              "    PARTITION BY dept) AS avg",
              "FROM emp;",
            ],
          },
        ],
        answerStructured:
          "- **GROUP BY** collapses rows — one output row per group. Use it when you need a single aggregate per group and don't need the original detail rows.\n- **Window function** preserves rows — every input row stays in the output, with the aggregate computed alongside it. Use it when you need *per-row results plus a group-level aggregate* (e.g., each employee's salary AND the department average, running totals, row ranks).\n- Key signal: do you need the detail rows? Yes → window function. No → GROUP BY.\n- You can combine both: GROUP BY first to aggregate, then window over the grouped result.\n- Anti-patterns: using a self-join to compare a row to the group average (use window function instead), or computing per-row ranks with GROUP BY + subquery (use RANK/DENSE_RANK instead).",
        explanationDeep:
          "GROUP BY destroys row identity: once you aggregate, you can't see individual records. That's correct when you want 'total revenue per department.' But when you want 'each employee's salary alongside the department average,' GROUP BY can't do it — you need the aggregate calculated *per window* while keeping the original rows. That's what window functions are for.\n\nA concrete example: to find employees whose salary is above their department average without a window function, you'd do a self-join or a correlated subquery (expensive and ugly). With a window function, one pass: `AVG(salary) OVER (PARTITION BY dept)` gives the dept average on every row, and you filter where salary > that average. Clean, fast, readable.\n\nThe 'do I need detail rows?' question is the decision heuristic. If yes: window function. If no (just the aggregate): GROUP BY.",
        interviewerLens:
          "The phrase I'm listening for is 'window functions preserve rows while GROUP BY collapses them.' Once I hear that, I know you understand the core semantic difference. The self-join-for-group-comparison anti-pattern is a bonus: it tells me you've seen production code that should have used a window function and can recognize it.",
        followupChain: [
          {
            question: "Can you use a window function in a WHERE clause?",
            answer: "No — window functions are computed after WHERE and GROUP BY. To filter on a window result (e.g., WHERE rank = 1), wrap it in a CTE or subquery, or use QUALIFY if your dialect supports it (Snowflake, BigQuery)."
          }
        ],
        redFlags: [
          {
            junior: "\"I use GROUP BY whenever I need a per-group calculation.\"",
            senior: "\"If I need per-group results while keeping every row, I use a window function — GROUP BY collapses the rows and I lose the detail.\""
          }
        ],
        alternatePhrasings: [
          "\"How do you find the employee with the highest salary in each department while keeping all columns?\"",
          "\"What's the difference between SUM() and SUM() OVER ()?\""
        ],
        interviewContexts: [
          "Mid-level analyst screen at a Series B startup",
          "SQL design interview at a data-heavy product company"
        ]
      },
      {
        category: "decision-frameworks",
        riskLevel: "medium",
        asked: 12,
        questionText:
          "Your query returns far more rows than expected. How do you systematically debug it?",
        code: [
          {
            lang: "sql",
            lines: [
              "-- is the join key unique?",
              "SELECT join_key, COUNT(*)",
              "FROM right_tbl",
              "GROUP BY join_key",
              "HAVING COUNT(*) > 1;",
              "-- >1 means it fans out",
            ],
          },
        ],
        answerStructured:
          "- Step 1: **Count rows at each join step**. Isolate the first join, count the result. Then add the next, count again. The row count will explode at the problematic join.\n- Step 2: **Check join key uniqueness**. `SELECT join_key, COUNT(*) FROM table GROUP BY join_key HAVING COUNT(*) > 1` — if this returns rows, you have duplicates on the join key causing fan-out.\n- Step 3: **Verify the join condition**. Missing or wrong join conditions create accidental cross joins.\n- Step 4: **Check for NULLs in join keys** — they don't match, but a wrong outer join might preserve them.\n- Fix options: deduplicate the non-unique side before joining (`ROW_NUMBER() = 1`), aggregate it down to the correct grain, or use an `EXISTS` check instead of a JOIN if you only need a membership test.\n- Add `EXPLAIN` or a row count assertion after each join in complex queries to catch this early.",
        explanationDeep:
          "Join fan-out is one of the most common sources of wrong analytics numbers, and it's especially insidious because the query runs without error — it just produces inflated results. A revenue SUM over a fan-out table will be 2x or 10x the real number, and downstream stakeholders see a number that 'looks reasonable enough' until someone audits it.\n\nThe systematic approach matters: don't guess which join is the problem. Isolate each join step by commenting out subsequent joins and counting. When the row count jumps from what you expect, you've found the culprit. Then inspect that table's join key for duplicates. The fix is almost always: deduplicate before joining (using ROW_NUMBER() to pick the right row), or change the join type to EXISTS/IN (which returns at most one match per left row).",
        interviewerLens:
          "I'm looking for 'isolate each join step and count' — methodical debugging, not guessing. The ROW_NUMBER deduplication fix is the senior answer. Candidates who just say 'add DISTINCT' are masking the problem instead of fixing the underlying grain mismatch.",
        followupChain: [
          {
            question: "Why is adding DISTINCT not a good fix for join fan-out?",
            answer: "DISTINCT masks the symptom — you're removing duplicate output rows without fixing the underlying data. If you're summing revenue, DISTINCT on rows doesn't help; the SUM has already counted duplicates. You need to fix the grain of the join itself."
          }
        ],
        redFlags: [
          {
            junior: "\"I'd just add DISTINCT.\"",
            senior: "\"DISTINCT masks the symptom. I'd find which join is fanning out, check the join key for uniqueness, then fix the grain — deduplicate before joining or use EXISTS if I only need membership.\""
          }
        ],
        alternatePhrasings: [
          "\"My SUM is twice the correct number — why?\"",
          "\"How do you detect a Cartesian product in a query?\"",
          "\"Walk me through debugging a query that returns too many rows.\""
        ],
        interviewContexts: [
          "Mid-level data analyst loop at an e-commerce company",
          "SQL debugging round at a Series B fintech"
        ]
      },
      // ── tool-comparison ───────────────────────────────────────
      {
        category: "tool-comparison",
        riskLevel: "high",
        isComparison: true,
        comparisonTools: ["RANK", "DENSE_RANK", "ROW_NUMBER"],
        asked: 21,
        questionText:
          "RANK vs DENSE_RANK vs ROW_NUMBER — what is the difference, when does the choice matter, and give me an example where each gives a different answer?",
        code: [
          {
            lang: "sql",
            lines: [
              "-- salaries 90, 90, 80:",
              "ROW_NUMBER -> 1, 2, 3",
              "RANK       -> 1, 1, 3  (gap)",
              "DENSE_RANK -> 1, 1, 2  (no gap)",
            ],
          },
        ],
        answerStructured:
          "- **ROW_NUMBER()**: assigns a unique sequential integer to every row. Ties are broken arbitrarily — no two rows share a number. Use it when you need uniqueness (deduplication, pagination).\n- **RANK()**: tied rows share the same rank; subsequent ranks are skipped (gaps). Example: two rows tie at rank 1, the next row gets rank 3. Use it when gaps matter conceptually ('tied for first place, nothing is in second place').\n- **DENSE_RANK()**: tied rows share the same rank; no gaps. Example: two rows tie at rank 1, the next distinct value gets rank 2. Use it when you want the Nth-distinct value (second-highest salary).\n- **Example with tied salaries (90, 90, 80)**:\n  - ROW_NUMBER: 1, 2, 3 (arbitrary tie-break)\n  - RANK: 1, 1, 3 (gap after tie)\n  - DENSE_RANK: 1, 1, 2 (no gap)\n- Rule of thumb: deduplication → ROW_NUMBER; Nth distinct value → DENSE_RANK; leaderboard with gaps → RANK.",
        explanationDeep:
          "The choice matters whenever there are ties, which is almost always in real data. The second-highest salary problem is the canonical case: if two people tie at the top, ROW_NUMBER picks one of them as the 'second' arbitrarily — wrong. RANK skips to 3 — also wrong if you want rank 2 to mean the second distinct value. DENSE_RANK assigns the next distinct value rank 2 — usually what 'second-highest salary' means.\n\nFor deduplication (keep one row per entity), ROW_NUMBER is the right choice because you need uniqueness — ties must be broken somehow, and you specify the ORDER BY to control which row gets rank 1 (e.g., ORDER BY created_at DESC to keep the latest).\n\nFor leaderboards where tied positions are meaningful — Olympic medals, rankings — RANK makes 'gold, gold, bronze' visible; DENSE_RANK would make it 'gold, gold, silver,' which misrepresents the situation.",
        interviewerLens:
          "I want a concrete example with numbers, not an abstract definition. And I want the dedup → ROW_NUMBER / Nth value → DENSE_RANK rule of thumb. Candidates who can produce the 1/1/3 vs 1/1/2 vs 1/2/3 example unprompted have clearly used all three in production.",
        followupChain: [
          {
            question: "How would you use ROW_NUMBER to deduplicate a table and keep only the most recent record per user?",
            answer: "ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at DESC) as rn in a CTE, then WHERE rn = 1 in the outer query. This keeps exactly one row per user — the most recent one — and is deterministic."
          },
          {
            question: "What happens if you use ORDER BY in ROW_NUMBER without PARTITION BY?",
            answer: "The window spans the entire result set — you get a single sequence of row numbers across all rows, not per-group. Usually only useful for full-table pagination."
          }
        ],
        redFlags: [
          {
            junior: "\"RANK and DENSE_RANK are basically the same.\"",
            senior: "\"RANK leaves gaps, DENSE_RANK doesn't — with salaries (90, 90, 80): RANK gives 1, 1, 3; DENSE_RANK gives 1, 1, 2. That difference changes the answer for 'second-highest salary.'\""
          }
        ],
        alternatePhrasings: [
          "\"Explain the ranking window functions.\"",
          "\"When would you use ROW_NUMBER vs DENSE_RANK?\"",
          "\"Google asked me: return the Nth-highest salary per department.\""
        ],
        interviewContexts: [
          "Asked at nearly every mid-level SQL screen",
          "FAANG data analyst loop (Google)",
          "Mid-level analytics engineer interview at a fintech"
        ]
      }
    ],
    topics: {
      moreDeepDives: [
        "Write a query to find users active in month N but not month N-1 (churn detection).",
        "Pivot rows to columns without a PIVOT operator using CASE + GROUP BY.",
        "How do you write a cumulative SUM and a running percentile?",
        "Find duplicate rows in a table and delete all but the most recent.",
        "Write a sessionization query: group user events into sessions separated by 30-minute gaps."
      ],
      decisions: [
        "CTE vs temp table vs subquery — how do you pick for a multi-step aggregation?",
        "EXISTS vs IN vs JOIN for a membership filter — when does each win?",
        "ROWS BETWEEN vs RANGE BETWEEN in a window frame — when do they differ?"
      ],
      quickRef: [
        "What does PARTITION BY do in a window function?",
        "What is ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW?",
        "ROW_NUMBER vs RANK vs DENSE_RANK in one line each?",
        "What does LAG(col, 1) return for the first row of a partition?",
        "Can you filter on a window function result in WHERE?",
        "What is QUALIFY (Snowflake/BigQuery)?",
        "What does COALESCE(LAG(...), 0) do?",
        "Difference between a CTE and a subquery?",
        "What is an optimization fence?",
        "What is COUNT(DISTINCT col)?"
      ],
      redFlags: [
        {
          junior: "\"I'd self-join on row number to compare to the previous row.\"",
          senior: "\"LAG() does that in one pass — self-joins on offsets are the pre-window-function workaround.\""
        },
        {
          junior: "\"DISTINCT fixes my duplicates after the join.\"",
          senior: "\"DISTINCT masks the grain problem — I find which join fan-out caused it and fix the join.\""
        },
        {
          junior: "\"CTEs are always slower than subqueries.\"",
          senior: "\"On most modern engines they're inlined and equivalent — the real win is readability and avoiding recomputation.\""
        },
        {
          junior: "\"RANK and DENSE_RANK do the same thing.\"",
          senior: "\"RANK leaves gaps on ties, DENSE_RANK doesn't — the difference matters for Nth-value problems.\""
        },
        {
          junior: "\"My 7-day rolling average is correct.\" (No mention of date gaps)\"",
          senior: "\"I check for missing dates and use a date spine — ROWS BETWEEN on a sparse table gives the wrong calendar window.\""
        },
        {
          junior: "\"WHERE rank = 1 inside the same SELECT as the window.\"",
          senior: "\"Window functions are computed after WHERE — I wrap in a CTE and filter in the outer query, or use QUALIFY.\""
        }
      ],
      checklist: [
        "Know RANK vs DENSE_RANK vs ROW_NUMBER with a tied-values example",
        "Be able to write a rolling average with correct window frame and explain date-gap risk",
        "Know LAG/LEAD syntax including offset and default value",
        "Understand CTE optimization fence behavior by engine (Postgres v12+, SQL Server, Snowflake)",
        "Be ready to debug a join fan-out systematically (isolate each join, check key uniqueness)"
      ],
      behavioral: [
        "Tell me about a time you found a significant error in a production metric — what was it and how did you catch it?",
        "Describe a complex multi-step query you wrote and how you made it maintainable.",
        "A time you optimized a slow query — what did you change and how did you measure improvement?"
      ],
      reverse: [
        "What SQL dialect do you use — and do you use QUALIFY or need CTE workarounds for window filtering?",
        "How do you handle data quality checks on complex aggregations before they hit dashboards?",
        "How are rolling/cumulative metrics currently built — in SQL or in a downstream BI layer?"
      ]
    }
  },

  // ─────────────────────────────────────────────────────────────
  // SENIOR  — Query optimization, gaps-and-islands, dedup at scale,
  //           pivot, ambiguous specs, hard analytics patterns
  // ─────────────────────────────────────────────────────────────
  senior: {
    authored: [
      // ── deep-dives ────────────────────────────────────────────
      {
        category: "deep-dives",
        riskLevel: "high",
        freePreview: true,
        asked: 27,
        questionText:
          "A production query is slow. Walk me through how you'd diagnose and optimize it — from first principles.",
        answerStructured:
          "- **Step 1: Read the execution plan first** (`EXPLAIN ANALYZE` in Postgres/Redshift, Query Profile in Snowflake, EXPLAIN in BigQuery). Never guess; the plan shows what the engine actually does.\n- **Look for**: sequential scans on large tables (missing or unused index), high row-count estimates that are far off (stale statistics), hash joins on enormous sets (skew or no predicate pushdown), sort operations on unindexed columns.\n- **Common fixes in priority order**:\n  1. **Add or fix a filter** — push predicates closer to the scan to shrink the working set early.\n  2. **Index the right columns** — B-tree for equality/range on filter/join columns; covering index if all needed columns are in the index (avoids a table heap lookup).\n  3. **Rewrite the query** — replace correlated subqueries with JOINs or window functions; move expensive operations out of SELECT * into the right place.\n  4. **Materialization** — pre-aggregate into a summary table for repeatedly-hit patterns.\n  5. **Partition pruning** — if the table is partitioned, ensure the filter touches the partition key.\n- Resist the instinct to throw more compute at it before understanding the bottleneck.",
        explanationDeep:
          "The execution plan is the ground truth — it shows actual vs estimated row counts, join strategies, and where time is spent. The senior move is to open the plan immediately and find the most expensive operator, not to guess or 'try an index and see.'\n\nThe highest-impact fixes are usually at the scan level: a full sequential scan on a 100M-row table from a missing predicate or a missing index will kill any query. Once the scan is right, look at join strategies: nested loops on large tables or hash joins on heavily skewed keys are the next culprits. Statistics being stale means the planner chooses a bad plan based on wrong estimates — run ANALYZE (Postgres) or equivalent to refresh.\n\nCovering indexes are a mid-level optimization: if a query only needs three columns and all three are in the index (as key or INCLUDE columns), the engine never touches the heap, turning a two-step lookup into a single-step index scan. On read-heavy reporting queries this is significant. The trade-off is write cost — indexes slow down INSERTs and UPDATEs.",
        interviewerLens:
          "'Read the execution plan first' is the answer I'm waiting for. Candidates who say 'add an index' or 'move to a bigger server' before reading the plan have never owned a slow query in production. I then ask them to interpret a sample plan — sequential scan vs index scan, the actual vs estimated row count discrepancy. The covering index and statistics-staleness awareness separates solid mid-level from senior.",
        followupChain: [
          {
            question: "What does 'Seq Scan' vs 'Index Scan' tell you in a Postgres EXPLAIN?",
            answer: "Seq Scan reads every row of the table regardless of filters — usually what you see when there's no index or the planner estimates it's cheaper than the index (below a certain selectivity threshold). Index Scan uses a B-tree to jump directly to matching rows. If you see Seq Scan on a large table with a highly selective WHERE clause, that's a missing index or stale statistics."
          },
          {
            question: "What is a covering index?",
            answer: "An index that includes all columns the query needs — key columns used in WHERE/JOIN plus additional INCLUDE columns for the SELECT list. The engine satisfies the query entirely from the index without touching the heap table, eliminating the 'index + heap' two-step lookup. Most effective for read-heavy, narrow-column queries."
          },
          {
            question: "Your query plan looks fine but it's still slow. What else do you check?",
            answer: "Lock contention (query waiting, not running), parameter sniffing / plan cache issues (SQL Server), temp file spill for sorts or hash joins exceeding work_mem, and network/IO latency if the warehouse is remote. Also confirm the plan is for the actual parameters, not generic estimates."
          }
        ],
        redFlags: [
          {
            junior: "\"I'd add an index and see if that helps.\"",
            senior: "\"I'd open the execution plan first — the plan tells me whether the bottleneck is a missing index, a bad join strategy, or something else entirely.\""
          },
          {
            junior: "\"Move it to a bigger server / more compute.\"",
            senior: "\"Compute doesn't fix a sequential scan on a table missing an index. I diagnose the plan first, then pick the right lever.\""
          }
        ],
        alternatePhrasings: [
          "\"How do you optimize a slow SQL query?\"",
          "\"Walk me through reading an EXPLAIN plan.\"",
          "\"A dashboard query is 10x slower than last week — what do you do?\""
        ],
        interviewContexts: [
          "Senior data engineer loop at a high-scale analytics company",
          "Staff engineer SQL design round",
          "Platform interview at a Series D fintech"
        ]
      },
      {
        category: "deep-dives",
        riskLevel: "high",
        asked: 22,
        questionText:
          "Given a table of user login dates, find all users who logged in on at least 3 consecutive calendar days, and return the start and end of each streak. Walk me through your approach.",
        code: [
          {
            lang: "sql",
            lines: [
              "WITH r AS (",
              "  SELECT user_id, login_date,",
              "    login_date - ROW_NUMBER()",
              "    OVER (PARTITION BY user_id",
              "      ORDER BY login_date) grp",
              "  FROM logins)",
              "-- consecutive dates -> same grp",
            ],
          },
          {
            lang: "sql",
            lines: [
              "SELECT user_id,",
              "  MIN(login_date) AS start,",
              "  MAX(login_date) AS end_,",
              "  COUNT(*) AS days",
              "FROM r",
              "GROUP BY user_id, grp",
              "HAVING COUNT(*) >= 3;",
            ],
          },
        ],
        answerStructured:
          "- This is the **gaps-and-islands** pattern. The key insight: subtract a row number from the login date — consecutive dates move forward 1 step and the row number moves forward 1 step, so their difference stays constant inside a streak. That difference is the grouping key.\n- **Step 1: Deduplicate** to one row per (user, date) — multiple logins on the same day should count as one.\n- **Step 2: Assign row numbers** per user ordered by date: `ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY login_date)`.\n- **Step 3: Compute the grouping key**: `login_date - rn` (date arithmetic). Consecutive dates within a user's partition will share the same value.\n- **Step 4: Aggregate** per (user, grp_key): `MIN(login_date)` is the streak start, `MAX(login_date)` is the end, `COUNT(*)` is the length. Filter `HAVING COUNT(*) >= 3`.\n- Always ask first: 'Does the same-day logins count once or multiple times? Does any gap break the streak?'",
        explanationDeep:
          "The gaps-and-islands pattern is one of perhaps 10-15 SQL patterns that cover the majority of hard interview problems. It shows up as consecutive login days, subscription periods, inventory availability windows — anything where you need to identify contiguous sequences in data.\n\nThe intuition for the row-number subtraction: if Monday is date 1 and row number 1, Tuesday is date 2 and row number 2, the difference is 0 for both. If there's a gap (Monday, Wednesday skipping Tuesday), Wednesday is date 3 but row number 2, difference = 1. The gap changes the constant, marking a new island. That's the elegantly simple mechanism.\n\nThe deduplication step is critical and often missed: if a user logs in twice on Monday, both rows have the same date, but they'll get different row numbers, corrupting the grouping key. Deduplicate first (DISTINCT or ROW_NUMBER over the raw events) before building the streak logic. This is the most common mistake candidates make on this problem at Meta and Airbnb, per engineering blog posts.",
        interviewerLens:
          "The phrase 'gaps and islands' tells me you know the pattern by name and can apply it. The deduplication step is what separates candidates who've debugged this in production from those who learned it from a tutorial. If I see `SELECT DISTINCT user_id, login_date` at the top of the CTE before the ROW_NUMBER, I know you've been burned by the duplicate-dates bug before.",
        followupChain: [
          {
            question: "How would you modify this to find the longest streak per user?",
            answer: "After building the grp_key CTE, add a step: for each (user, grp_key), count the streak length. Then pick the maximum per user with ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY streak_length DESC) = 1, or use a simple MAX(COUNT(*)) with GROUP BY user_id over the grouped result."
          },
          {
            question: "What if 'consecutive' means within 2 days (not just adjacent)?",
            answer: "The row-number subtraction trick breaks — it only works for true adjacency. Switch to the LAG-based pattern: flag rows where the gap to the prior date exceeds the threshold (LAG(login_date)), then use a cumulative SUM of the flags to assign group IDs. Aggregate as before."
          },
          {
            question: "How does sessionization differ from consecutive-days?",
            answer: "Sessionization groups events where the gap between consecutive events within a user exceeds a time threshold (e.g., 30 minutes). Same LAG-based approach: flag a new session when LAG gap > threshold, cumulative SUM for session IDs. The grouping key is a running count of session starts, not a date subtraction."
          }
        ],
        redFlags: [
          {
            junior: "\"I'd self-join the table three times to check for three consecutive days.\"",
            senior: "\"Self-joins only work for exactly 3 days and don't scale. I'd use the row-number subtraction pattern to group consecutive dates as islands and filter on streak length.\""
          },
          {
            junior: "\"I'd apply ROW_NUMBER directly on the raw table.\"",
            senior: "\"I'd deduplicate to one row per (user, date) first — multiple same-day logins corrupt the grouping key and give wrong streak lengths.\""
          }
        ],
        alternatePhrasings: [
          "\"Find users who were active for 7 consecutive days.\"",
          "\"Detect login streaks in a user activity table.\"",
          "\"How do you solve the gaps-and-islands problem in SQL?\"",
          "\"Meta asked me: find users with at least 3 consecutive login days.\""
        ],
        interviewContexts: [
          "Hard SQL question at a Meta data engineering interview (80% failure rate per eng blog)",
          "Senior analyst loop at an Airbnb-adjacent travel company",
          "Asked at LinkedIn data science interview"
        ]
      },
      {
        category: "deep-dives",
        riskLevel: "high",
        asked: 18,
        questionText:
          "You have a large table with duplicate records and you need to deduplicate it, keeping only the most recent version of each entity. Walk me through your approach at scale.",
        code: [
          {
            lang: "sql",
            lines: [
              "-- Snowflake/BigQuery: inline",
              "SELECT * FROM events",
              "QUALIFY ROW_NUMBER() OVER (",
              "  PARTITION BY entity_id",
              "  ORDER BY updated_at DESC",
              ") = 1;",
            ],
          },
        ],
        answerStructured:
          "- Use **ROW_NUMBER() OVER (PARTITION BY entity_id ORDER BY updated_at DESC)** to rank records per entity, then filter `WHERE rn = 1`.\n- In a CTE: rank inside, `SELECT ... WHERE rn = 1` outside. This picks the single most-recent row per entity deterministically.\n- For a **DELETE in-place** (if you own the table): `DELETE FROM table WHERE id NOT IN (SELECT id FROM ranked WHERE rn = 1)` — or a MERGE/CTAS-swap for large tables.\n- At scale, **CTAS + swap** is safer: `CREATE TABLE table_deduped AS SELECT ... WHERE rn = 1`, then rename/swap atomically. Avoids long-running DELETE locks.\n- **Always ask**: what makes a record 'most recent'? Is `updated_at` reliable? What if two records have the same timestamp?\n- In Snowflake/BigQuery you can use **QUALIFY ROW_NUMBER() OVER (...) = 1** to filter in-line without a CTE.",
        explanationDeep:
          "The ROW_NUMBER deduplication pattern is the industry standard for 'keep one row per entity.' It's deterministic (you control the ORDER BY, so you control which row wins), efficient (one window pass over the table), and composable (the outer SELECT can project any columns from the ranked CTE).\n\nAt large scale, the implementation strategy matters as much as the query. An in-place DELETE on a 500M-row table with a NOT IN subquery can lock the table for hours and overwhelm transaction logs. The CTAS + swap pattern materializes the clean result into a new table, renames it atomically (swap the name), and drops the old one — much safer for production, and allows a verification step before the swap.\n\nThe 'what if two records share the same timestamp?' question is worth raising unprompted — if updated_at isn't guaranteed unique per entity, you need a tiebreaker (a surrogate ID, a sequence number, an event hash). Without a tiebreaker, ROW_NUMBER picks one arbitrarily, which might be fine or might be a data quality issue depending on the domain.",
        interviewerLens:
          "ROW_NUMBER is the answer every mid-level candidate gives. The senior signal is the CTAS + swap strategy at scale (not a DELETE on a huge table), and the tiebreaker question. Naming QUALIFY as a Snowflake/BigQuery shortcut shows platform depth.",
        followupChain: [
          {
            question: "How would you handle deduplication in a streaming pipeline where duplicates arrive continuously?",
            answer: "Idempotent MERGE/upsert keyed on the entity ID and a version/timestamp. In the warehouse, a MERGE statement with WHEN MATCHED THEN UPDATE (if source is newer) handles ongoing dedup. In the message layer (Kafka), configure idempotent producer + unique_key in a consumer to deduplicate before writing to the warehouse."
          },
          {
            question: "What is QUALIFY and how does it simplify deduplication in Snowflake?",
            answer: "QUALIFY filters window function results inline — like HAVING for window functions. `SELECT ... QUALIFY ROW_NUMBER() OVER (PARTITION BY id ORDER BY updated_at DESC) = 1` eliminates the outer CTE or subquery. Supported in Snowflake, BigQuery, and DuckDB; not in Postgres or SQL Server."
          }
        ],
        redFlags: [
          {
            junior: "\"I'd use DISTINCT.\"",
            senior: "\"DISTINCT deduplicates rows with identical columns — it can't pick the most recent version of an entity. ROW_NUMBER with an ORDER BY is the right tool.\""
          },
          {
            junior: "\"I'd run DELETE WHERE id NOT IN (SELECT MAX(id) ...).\"",
            senior: "\"On a large table, an in-place DELETE can lock for hours and overflow transaction logs. I'd use CTAS + rename swap for production-scale dedup.\""
          }
        ],
        alternatePhrasings: [
          "\"How do you remove duplicate rows keeping only the latest?\"",
          "\"Your event table has duplicates from upstream. How do you clean it at scale?\"",
          "\"Walk me through deduplicating a 500M-row table.\""
        ],
        interviewContexts: [
          "Senior data engineer screen at a data platform team",
          "Staff analytics engineer loop at a Series D company",
          "Asked in a data quality deep-dive at a logistics platform"
        ]
      },
      {
        category: "deep-dives",
        riskLevel: "high",
        asked: 15,
        questionText:
          "How do you pivot rows into columns in SQL without a PIVOT operator? Walk me through the pattern and tradeoffs.",
        code: [
          {
            lang: "sql",
            lines: [
              "SELECT entity_id,",
              "  MAX(CASE WHEN cat='A'",
              "      THEN value END) AS a,",
              "  MAX(CASE WHEN cat='B'",
              "      THEN value END) AS b",
              "FROM t GROUP BY entity_id;",
            ],
          },
        ],
        answerStructured:
          "- Use **conditional aggregation**: `MAX(CASE WHEN category = 'A' THEN value END) AS col_A`, repeated for each target column, with `GROUP BY entity_id`.\n- The pattern: for each unique value you want as a column, write one `MAX(CASE WHEN ...)` expression in the SELECT list. Group by the entity key.\n- Works on every SQL dialect; PIVOT syntax (SQL Server, Snowflake) is a shortcut but dialect-specific.\n- **Static pivot** (you write each column): clear and predictable, but breaks when new category values appear.\n- **Dynamic pivot** (enumerate categories at runtime): requires dynamic SQL or application-layer string construction — messy but necessary when the category list isn't known ahead of time.\n- **Always clarify**: what's the grain of the output? What happens if an entity has multiple rows for the same category (use MAX/MIN/SUM depending on intent)?",
        explanationDeep:
          "Conditional aggregation is the universal pivot pattern in ANSI SQL. The `MAX(CASE WHEN ...)` trick works because: the CASE expression returns the value for the matching category row and NULL for all others; MAX ignores NULLs, so it picks the one non-NULL value in the group. If there are multiple rows for the same (entity, category), MAX returns the maximum — which may or may not be what you want (sometimes you want SUM, sometimes MIN, sometimes ARRAY_AGG).\n\nThe static vs dynamic pivot trade-off is the senior judgment call. Static pivot is transparent, version-controllable SQL — anyone can read it and understand which columns exist. But it breaks the moment a new product category appears: your ETL produces a column-schema mismatch and the pipeline errors or silently drops new values. Dynamic pivot (building SQL strings at runtime based on a `SELECT DISTINCT category` query) handles new values automatically but is harder to test, harder to review, and can produce surprising schema changes downstream. At scale, most teams prefer a downstream transformation layer (dbt models, BI tool pivoting) that can handle schema drift more gracefully than dynamic SQL.",
        interviewerLens:
          "I want the conditional aggregation pattern explained correctly, including the MAX + CASE + GROUP BY structure and why MAX ignores NULLs (making it work). The static vs dynamic distinction is the senior signal — knowing that static breaks on new categories and dynamic is risky to automate shows you've shipped this pattern in production.",
        followupChain: [
          {
            question: "Your pivot has 50 possible category values. How do you avoid writing 50 CASE expressions?",
            answer: "Dynamic SQL: query `SELECT DISTINCT category FROM table ORDER BY 1`, build the CASE expressions as a string, and execute with EXECUTE/EXECUTE IMMEDIATE (Postgres/Snowflake). Or use a BI layer (Tableau, Looker, dbt pivot macro) that handles the column generation. For Snowflake, the PIVOT operator with dynamic values is available in recent versions."
          },
          {
            question: "How does Snowflake's PIVOT operator compare to conditional aggregation?",
            answer: "Snowflake's `PIVOT (aggregate FOR col IN (val1, val2, ...))` is more concise but still requires static value lists unless combined with dynamic SQL. Conditional aggregation is portable across dialects; PIVOT is dialect-specific. The output is semantically identical."
          }
        ],
        redFlags: [
          {
            junior: "\"I'd export to Python and pivot there.\"",
            senior: "\"That's fine for ad-hoc, but in a pipeline I'd use conditional aggregation in SQL — it stays in the warehouse, is version-controlled, and handles the GROUP BY grain cleanly.\""
          },
          {
            junior: "\"I'd use PIVOT syntax.\"",
            senior: "\"PIVOT is dialect-specific. I default to conditional aggregation (MAX CASE WHEN) for portability, and name the static-vs-dynamic trade-off.\""
          }
        ],
        alternatePhrasings: [
          "\"Pivot rows to columns in BigQuery (no PIVOT operator at the time).\"",
          "\"How do you turn category-value pairs into wide format?\"",
          "\"Write a crosstab query.\""
        ],
        interviewContexts: [
          "Senior analyst loop at a product analytics company",
          "Data engineering SQL screen at a retail chain's data team",
          "Asked at a reporting-heavy platform company"
        ]
      },
      {
        category: "deep-dives",
        riskLevel: "medium",
        asked: 14,
        questionText:
          "An analyst gives you a vague spec: 'Show me active users over time.' What do you ask before writing a single line of SQL?",
        answerStructured:
          "- **Define 'active'**: what constitutes an 'active' event — any login, a specific action (purchase, search), a minimum session duration? The definition changes the entire query.\n- **Define 'user'**: unique by account ID, device ID, email? How do you handle anonymous users, bots, internal test accounts?\n- **Define 'over time'**: what granularity — daily, weekly, monthly? Rolling window or calendar period? Which time zone?\n- **Define the metric**: total active users per period (simple count), DAU/WAU/MAU, retention (same users returning), or new-vs-returning split?\n- **Confirm the grain**: should a user who is active on 5 days in a week count 5 times or once?\n- **Understand downstream use**: is this a one-off exploration or a recurring dashboard? That affects how much to invest in correctness vs speed.",
        explanationDeep:
          "This question tests whether you build what's asked or what's meant. 'Active users over time' is one of the most underspecified specs in analytics — I've seen it mean DAU on a login event, MAU on a purchase event, weekly unique visitors, 30-day rolling active — all reasonable interpretations, all wildly different numbers.\n\nThe cost of writing code before clarifying is significant: you ship a number, it looks wrong to the stakeholder, you rebuild. In a mid-to-senior role, the most valuable thing you can do is surface the ambiguity before it costs a sprint. This is also a proxy for communication skill — interviewers often use vague specs intentionally to see if you'll ask or just code.\n\nThe grain question ('does a user active on 5 days count 5 or 1 times?') is specifically where most SQL errors come from. If the stakeholder wants 'users per day' but you're counting event rows, you'll overcount users with multiple events per day. DISTINCT is the fix, but only if you know to ask.",
        interviewerLens:
          "I want five or more clarifying questions before any SQL — and I want them to be the right five (active definition, grain, time window, metric type, downstream use). Candidates who dive into writing immediately are giving me the right-syntax wrong-question answer. The ones who ask for the business context first are the ones I want building dashboards.",
        followupChain: [
          {
            question: "Once you've clarified 'active = made a purchase, count by calendar month, per unique user_id' — write the query.",
            answer: "SELECT DATE_TRUNC('month', purchased_at) AS month, COUNT(DISTINCT user_id) AS active_users FROM orders WHERE status = 'completed' GROUP BY 1 ORDER BY 1. The key choices: DATE_TRUNC for the month grain, COUNT(DISTINCT user_id) to avoid counting the same user multiple times per month, filter on completed orders."
          }
        ],
        redFlags: [
          {
            junior: "Immediately writing `SELECT DATE, COUNT(DISTINCT user_id) FROM events GROUP BY 1`.",
            senior: "Asking 'what counts as active?', 'what time grain?', 'are bots filtered?', and 'how is this used?' before writing a character."
          }
        ],
        alternatePhrasings: [
          "\"Our PM asks for 'engagement metrics' — what do you do first?\"",
          "\"How do you handle an underspecified analytics request?\"",
          "\"Write a query to track user growth.\" (Intentionally vague)\""
        ],
        interviewContexts: [
          "Senior analytics engineer loop at a consumer startup",
          "Data lead interview at a Series B product company",
          "Asked in a SQL + communication round at a growth-stage analytics team"
        ]
      },
      // ── decision-frameworks ───────────────────────────────────
      {
        category: "decision-frameworks",
        riskLevel: "high",
        asked: 16,
        questionText:
          "How do you choose between indexing strategies in a relational database — B-tree, covering index, composite index — and how does that choice interact with query patterns?",
        answerStructured:
          "- **B-tree** (default): ordered tree structure, good for equality (`=`), range (`<`, `>`, `BETWEEN`), and sorting. The index of choice for most filter and join columns.\n- **Composite index**: indexes multiple columns. Column order matters: the leftmost prefix rule — a composite index on `(a, b, c)` supports queries filtering on `(a)`, `(a, b)`, or `(a, b, c)` but NOT `(b, c)` alone. Put the highest-selectivity column or the equality column first.\n- **Covering index**: includes all columns the query needs (key + INCLUDE columns) so the engine never hits the heap. Eliminates the index-to-heap lookup ('index only scan').\n- **Index trade-off**: every index speeds reads but slows writes (INSERT/UPDATE/DELETE must maintain all indexes). Don't over-index write-heavy tables.\n- **Decision flow**: find the slow query's filter/join columns → check if a B-tree exists → check leftmost prefix alignment → add INCLUDE columns if the query does many heap lookups → measure.\n- Hash indexes: equality only, not range, not sorting. Useful in specific OLTP equality-heavy scenarios but rarely needed over B-tree.",
        explanationDeep:
          "The leftmost prefix rule is the most commonly misunderstood aspect of composite indexes. An index on `(region, product_id, sale_date)` will be used for `WHERE region = 'US'` or `WHERE region = 'US' AND product_id = 123`, but not for `WHERE product_id = 123` alone — the engine can't skip to the middle of the B-tree. If your query patterns only filter on product_id, you need a separate index or to reorder the composite.\n\nCovering indexes are the high-leverage optimization for read-heavy queries on well-defined patterns. If a query always selects three columns and filters on two, and all five are in the index, the engine reads the index leaf pages only and never touches the main table. On SSDs this is less dramatic than spinning disks, but it still eliminates I/O and reduces lock contention.\n\nThe write cost is real: in high-throughput OLTP tables (events, transactions), indexes compound write latency. The pattern I use is: index only after profiling read-vs-write volume; for analytics/OLAP tables that are mostly read, index aggressively; for high-write event tables, index conservatively and consider partitioning instead.",
        interviewerLens:
          "I want the leftmost prefix rule explained correctly and the covering index concept named. Candidates who just say 'add an index on the WHERE columns' are missing the nuance that makes the difference between an index being used and not. The write-cost trade-off shows you've thought about production table lifecycle, not just read optimization.",
        followupChain: [
          {
            question: "A composite index on (user_id, created_at) — does it support ORDER BY created_at without a user_id filter?",
            answer: "No — without the leading user_id predicate, the index isn't fully leveraged for this sort. The engine might still use the index for a full-scan ordered read, but it won't be an efficient index seek. For a query that orders by created_at globally, a separate index on created_at (or a partial index) is more appropriate."
          },
          {
            question: "When would you NOT add an index even if a query is slow?",
            answer: "When the table is write-heavy (adding an index slows every write), when selectivity is very low (an index on a boolean column is rarely worth it — the planner just does a seq scan), or when the table is small enough that a seq scan is cheaper than the index lookup overhead."
          }
        ],
        redFlags: [
          {
            junior: "\"Just add an index on the slow column.\"",
            senior: "\"I check the query pattern first — column order for composite indexes matters (leftmost prefix), and I consider covering index columns to avoid heap lookups.\""
          },
          {
            junior: "\"Indexes always make queries faster.\"",
            senior: "\"Indexes trade write cost for read speed. On high-write tables I'm selective about which indexes I add.\""
          }
        ],
        alternatePhrasings: [
          "\"When is a composite index better than two separate indexes?\"",
          "\"What is a covering index and when do you use one?\"",
          "\"How does index column order affect query performance?\""
        ],
        interviewContexts: [
          "Senior data engineer at a high-volume OLTP-adjacent platform",
          "Staff engineer SQL optimization round",
          "Database design discussion at a Series C fintech"
        ]
      },
      {
        category: "decision-frameworks",
        riskLevel: "medium",
        asked: 12,
        questionText:
          "How do you decide when to pre-aggregate data into a summary table versus computing on-the-fly at query time?",
        answerStructured:
          "- **On-the-fly**: always fresh, zero storage, query complexity is bounded by source data. Use when: data is small, query is infrequent, or freshness SLA is very tight (can't tolerate staleness).\n- **Pre-aggregated summary table**: expensive computation done once, cheap reads. Use when: the aggregation is read many times, the source data is large (full-scan expensive), or the query is on a hot path (dashboard, API).\n- **Decision axes**: (read frequency) × (compute cost) / (freshness tolerance) × (maintenance overhead).\n- In a warehouse (Snowflake/BigQuery): materialized views automate refresh but have query restrictions (single table, limited functions). Scheduled tables (task + INSERT/MERGE) give full control over multi-table aggregations at the cost of explicit orchestration.\n- A pre-aggregated table also lets you control the grain — you can collapse raw events to daily-user level, which makes subsequent joins and aggregations much cheaper.\n- Always profile before pre-aggregating: the compute cost of on-the-fly is sometimes negligible.",
        explanationDeep:
          "Pre-aggregation is a classic latency vs freshness trade-off. The cost of on-the-fly is paid at read time by the query engine; the cost of pre-aggregation is paid at write time (scheduled refresh) and storage. For a dashboard hit by 10,000 users a day, recomputing a 6-month revenue rollup on every request is expensive and pointless — pre-aggregate it once per hour and serve cached reads.\n\nThe grain shift is the less obvious benefit: if raw events are at millisecond granularity and you only ever report at daily-user level, materializing a daily-user summary table not only speeds the query but dramatically shrinks the data size. All downstream queries join against a tiny table instead of a 100M-row event log.\n\nMaterialized views in Snowflake are seductive but boxed in: single source table, no joins, limited aggregates. Once you need a multi-table rollup, you're in a scheduled-task territory. BigQuery materialized views have similar constraints. Understanding these restrictions is what keeps you from designing a solution that can't be implemented in the tool you're using.",
        interviewerLens:
          "I want the read-frequency × compute-cost framing, not just 'use a summary table when it's slow.' The materialized-view restrictions (single table) are the gotcha I look for — candidates who know them have hit the wall in production.",
        followupChain: [
          {
            question: "Your pre-aggregated table is wrong for 2 hours after source data loads. Stakeholders complain. What are your options?",
            answer: "Increase refresh frequency (shorter staleness, more compute cost), switch to near-real-time incremental loading with MERGE (more complexity), or set expectations and SLAs clearly ('data is refreshed hourly'). If freshness matters more than cost, on-the-fly with proper indexing may be the right call after all."
          }
        ],
        redFlags: [
          {
            junior: "\"Always pre-aggregate everything to make dashboards fast.\"",
            senior: "\"Pre-aggregation has a freshness cost and maintenance overhead — I compute the read-frequency × compute-cost trade-off before adding another scheduled refresh to manage.\""
          }
        ],
        alternatePhrasings: [
          "\"Should I use a view or a materialized table for a heavy aggregation?\"",
          "\"When does a summary table pay for itself?\"",
          "\"When would you NOT pre-aggregate?\""
        ],
        interviewContexts: [
          "Senior analytics engineer at a high-traffic SaaS product",
          "Data platform architecture discussion at a Series D company"
        ]
      },
      // ── tool-comparison ───────────────────────────────────────
      {
        category: "tool-comparison",
        riskLevel: "high",
        isComparison: true,
        comparisonTools: ["CTE", "Subquery", "Temp Table"],
        asked: 18,
        questionText:
          "CTE vs subquery vs temp table — explain the differences in execution, optimization, and when you'd choose each at the senior level.",
        answerStructured:
          "- **Subquery**: inline, anonymous, scoped to one expression. Fine for simple scalar or set-membership checks. Gets unreadable when nested more than one level deep.\n- **CTE** (`WITH`): named, readable, can be referenced multiple times in the same query. On most modern engines (Postgres 12+, SQL Server, BigQuery), CTEs are **inlined by default** — the planner can push predicates through them. On older Postgres, they were optimization fences (always materialized). Snowflake inlines by default. Be engine-aware.\n- **Temp table**: written to disk/temp storage. Pays a write cost. Benefits: (1) materialize an expensive intermediate once for multiple subsequent queries or statements, (2) can be indexed, (3) optimizer sees real row counts (not estimates). Use in multi-statement scripts, stored procedures, or when the intermediate is used across multiple separate queries.\n- **Senior judgment**: if it's in one query → CTE for readability; if the CTE is referenced multiple times and the engine inlines it (recomputes each time) → MATERIALIZED CTE hint or temp table; if it's used across multiple SQL statements → temp table.",
        explanationDeep:
          "The optimization-fence behavior is the most misunderstood aspect of CTEs. In older PostgreSQL (pre-v12), any CTE was materialized: computed once, result cached. That sounds good, but it prevented the planner from pushing a WHERE clause predicate through the CTE — so a CTE that produced 10M rows would produce all 10M even if the outer query filtered to 100. Modern PostgreSQL inlines CTEs (like subqueries) by default, but you can force materialization with `WITH name AS MATERIALIZED (...)` when you actually want it.\n\nWhen should you want materialization? When the CTE is referenced multiple times and recomputing it is expensive — say, a heavy window-function result that's used in two subsequent joins. In that case, materializing once (temp table or MATERIALIZED hint) is faster than computing twice. This is a nuanced trade-off: most of the time inlining is better, but sometimes you want to pay upfront.\n\nTemp tables add one more capability: you can build an index on them. If your intermediate result is 50M rows and subsequent queries join against it on a specific key, adding an index to the temp table can be a massive performance win — CTEs don't support this.",
        interviewerLens:
          "The optimization fence behavior is the test. I want 'it depends on the engine' and ideally the Postgres version threshold (v12). Candidates who say 'CTEs are always materialized' or 'CTEs are always inlined' have a partial view. The 'temp tables can be indexed' insight is a bonus that shows production experience with complex multi-step queries.",
        followupChain: [
          {
            question: "When would you use MATERIALIZED on a CTE in Postgres?",
            answer: "When the CTE is referenced multiple times and the computation is expensive — you want to pay once, not N times. Or when the query planner's estimate is bad and materializing forces a better intermediate row count for subsequent operators."
          },
          {
            question: "How does QUALIFY simplify CTE usage in Snowflake?",
            answer: "QUALIFY filters window function results inline — like HAVING for window functions. WHERE ROW_NUMBER() = 1 in a CTE-then-filter pattern becomes a single SELECT with QUALIFY ROW_NUMBER() OVER (...) = 1. Reduces one CTE layer."
          }
        ],
        redFlags: [
          {
            junior: "\"CTEs are always materialized.\"",
            senior: "\"Depends on the engine and version — modern Postgres (12+) and most cloud warehouses inline by default. You can force materialization explicitly when you want it.\""
          },
          {
            junior: "\"Temp tables are always slower because they write to disk.\"",
            senior: "\"The write cost is often worth it: temp tables can be indexed, are reused across statements, and give the optimizer real row-count statistics — which can make subsequent joins much faster.\""
          }
        ],
        alternatePhrasings: [
          "\"When do you use a CTE versus a temp table?\"",
          "\"Is a CTE always materialized?\"",
          "\"How does CTE behavior differ across SQL engines?\""
        ],
        interviewContexts: [
          "Senior data engineer platform interview",
          "Staff analytics engineer loop at a high-scale company",
          "SQL architecture deep-dive at a data-infrastructure team"
        ]
      }
    ],
    topics: {
      moreDeepDives: [
        "Write a sessionization query that groups user events into sessions with a 30-minute idle timeout.",
        "Explain how the query planner uses statistics to choose a join strategy.",
        "Write a query to detect and report data quality issues: NULLs, unexpected values, row count drops.",
        "How do you implement an incremental SQL pipeline that handles late-arriving data?",
        "Explain what a histogram is in database statistics and why it matters for query planning."
      ],
      decisions: [
        "When do you reach for window functions vs self-joins vs lateral joins?",
        "Partitioned table vs clustered index vs sorted segments — when does each win for range queries?",
        "How do you decide when a subquery should become a CTE vs a temp table in a production pipeline?"
      ],
      quickRef: [
        "What is the leftmost prefix rule for composite indexes?",
        "What is a covering index?",
        "What does EXPLAIN ANALYZE show that EXPLAIN doesn't?",
        "What is the QUALIFY clause and which engines support it?",
        "What is a B-tree index and what operations can it support?",
        "When is a hash index preferred over B-tree?",
        "What does MATERIALIZED do in a Postgres CTE?",
        "What is the gaps-and-islands technique in one sentence?",
        "What does NULLIF(x, 0) do and when do you use it?",
        "What is a date spine and why do you need one for time-series queries?"
      ],
      redFlags: [
        {
          junior: "\"I'd add an index and see if it helps.\"",
          senior: "\"I'd read the execution plan first — the plan tells me whether the bottleneck is a missing index, a bad join strategy, or something else entirely.\""
        },
        {
          junior: "\"Self-join the table three times to check for three consecutive days.\"",
          senior: "\"That's the brittle approach — I'd use the row-number subtraction (gaps-and-islands) pattern to handle any streak length.\""
        },
        {
          junior: "\"DISTINCT will fix the duplicates.\"",
          senior: "\"DISTINCT masks the grain problem — for deduplication at entity level, I use ROW_NUMBER partitioned on the entity key, ordered by the timestamp.\""
        },
        {
          junior: "\"I'd just write the query for 'active users over time' right away.\"",
          senior: "\"I'd ask: what counts as active, what grain, what time zone, are bots filtered, and how is this used — before writing a line.\""
        },
        {
          junior: "\"CTEs are always materialized.\"",
          senior: "\"Depends on the engine — Postgres 12+ and most cloud warehouses inline by default; you opt into materialization explicitly.\""
        },
        {
          junior: "\"Add more compute to fix a slow query.\"",
          senior: "\"More compute doesn't fix a sequential scan or a bad join strategy — I read the execution plan first, then pick the targeted fix.\""
        }
      ],
      checklist: [
        "Be able to walk through reading an EXPLAIN/EXPLAIN ANALYZE plan: seq scan vs index scan, actual vs estimated rows",
        "Know the gaps-and-islands row-number subtraction pattern and the deduplication prerequisite",
        "Know the leftmost prefix rule for composite indexes and when covering indexes eliminate heap lookups",
        "Know CTE optimization fence behavior by engine (Postgres 12+, Snowflake, BigQuery) and how to force MATERIALIZED",
        "Be ready to ask 5+ clarifying questions before writing any SQL for a vague spec"
      ],
      behavioral: [
        "Tell me about the most complex SQL query or pipeline you've built — walk me through the design decisions.",
        "A time you caught a significant data quality problem before it reached stakeholders — how did you catch it?",
        "How have you communicated a nuanced SQL result or trade-off to a non-technical executive?"
      ],
      reverse: [
        "How mature is the query optimization story here — do you use execution plans regularly in code review?",
        "What's the most complex analytics problem the SQL layer is currently being asked to solve?",
        "Are there recurring slow queries or fan-out issues in production today, and how does the team handle them?"
      ]
    }
  }
};
