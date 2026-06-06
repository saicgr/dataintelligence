import type { Authored, ToolTopics } from "../content-de";
import type { Level } from "../../types";

export const levels: Partial<Record<Level, { authored: Authored[]; topics: ToolTopics }>> = {
  // ─────────────────────────────────────────────────────────────
  // JUNIOR — list/tuple/set/dict + complexity, comprehensions,
  //          mutable default arg gotcha, *args/**kwargs
  // ─────────────────────────────────────────────────────────────
  junior: {
    authored: [
      // ── deep-dives ────────────────────────────────────────────
      {
        category: "deep-dives",
        riskLevel: "high",
        freePreview: true,
        asked: 28,
        questionText:
          "Walk me through Python's built-in data structures — list, tuple, set, dict — and their Big-O trade-offs. When would you reach for each?",
        code: [
          {
            accent: "bug",
            lang: "python",
            label: "O(n^2)",
            lines: [
              "valid = load_list()  # 100k items",
              "for r in rows:",
              "    if r.id in valid:  # O(n) scan",
              "        keep(r)",
            ],
          },
          {
            accent: "fix",
            lang: "python",
            label: "O(n)",
            lines: [
              "valid = set(load_list())",
              "for r in rows:",
              "    if r.id in valid:  # O(1) hash",
              "        keep(r)",
            ],
          },
        ],
        answerStructured:
          "- **list**: ordered, mutable, allows duplicates. O(1) append and index; **O(n) membership** (`x in list`). Default when order matters and you need to mutate.\n- **tuple**: ordered, immutable, hashable. Use as dict keys or set members (`(user_id, date)` as a composite key). Signals 'this record is fixed.' Same access complexity as list.\n- **set**: unordered, unique elements, hash-based. **O(1) average membership** and dedup. Reach for it when you test `in` repeatedly or need fast intersection/union.\n- **dict**: key→value mapping, O(1) average lookup/insert. Workhorse for grouping and counting; `defaultdict(int)` or `Counter` handle frequency counting without key-existence checks.\n- **The canonical interview win**: replacing `if x in some_list` inside a loop (O(n²) total) with a set conversion (O(n) total). One line change, dramatic speedup.",
        explanationDeep:
          "The point of this question is the membership-test complexity gap, not the 'mutable vs immutable' definition that every tutorial leads with. In real data engineering code, the most common Python performance bug is `if x in large_list` inside a loop. Each `in` check on a list is O(n), so the loop is O(n²). Converting the list to a set before the loop makes each check O(1) and the whole loop O(n). That single refactor on a 100k-element list drops runtime from seconds to milliseconds.\n\nTuples-as-dict-keys is the fluency tell: tuples are immutable, therefore hashable, so `(user_id, event_date)` works as a dict key. Lists are mutable, therefore not hashable — you get a TypeError if you try. Understanding why hashability requires immutability (the hash must not change after the object is stored) shows you understand the memory model, not just the syntax.\n\nFor counting, `Counter` from `collections` beats a hand-rolled `dict[key] = dict.get(key, 0) + 1` loop — it's one line, faster (C-implemented), and gives you `.most_common(n)` for free. Mentioning it signals production Python fluency.",
        interviewerLens:
          "I'm listening for the O(n) vs O(1) membership distinction and the O(n²) → O(n) set-conversion instinct. Reciting 'lists are mutable, tuples aren't' without the complexity angle is the textbook answer that tells me you've read a tutorial, not written production code. If you volunteer Counter unprompted, I know you've used Python for real data work.",
        followupChain: [
          {
            question: "Why can a tuple be a dict key but a list cannot?",
            answer: "Dict keys must be hashable — their hash must not change while stored in the dict. Tuples are immutable so their hash is stable. Lists are mutable; Python refuses to hash them (raises TypeError) because a mutated list would produce a different hash, corrupting the dict's internal structure."
          },
          {
            question: "When would you choose a list over a set even for a membership-heavy use case?",
            answer: "When order matters (sets are unordered), when you need duplicates (sets deduplicate), or when the collection is very small (the set-creation overhead isn't worth it for tiny inputs). Also when you need index access — sets don't support indexing."
          },
          {
            question: "What does Counter give you over a plain dict?",
            answer: "Counter is dict subclass optimized for frequency counting: counts default to 0 (no KeyError), .most_common(n) returns the top-n elements sorted by count, and set operations (+, -, &, |) work directly on the counts. It's implemented in C so it's faster than an equivalent Python loop."
          }
        ],
        redFlags: [
          {
            junior: "\"I'd just use a list for everything — it's the default.\"",
            senior: "\"I check the membership pattern first. If I'm doing `if x in collection` in a loop, I convert to a set — that's the difference between O(n²) and O(n).\""
          },
          {
            junior: "\"I use dict.get() and increment manually for counting.\"",
            senior: "\"Counter from collections is cleaner, C-implemented, and gives me most_common() — I reach for it whenever I'm tallying frequencies.\""
          }
        ],
        alternatePhrasings: [
          "\"Which Python collection type would you use for a deduplication problem?\"",
          "\"Why is `x in list` slow and how do you fix it?\"",
          "\"Explain Python's built-in data structures and their complexity.\""
        ],
        interviewContexts: [
          "Asked at nearly every junior Python data engineering screen",
          "Entry-level data engineer loop at a Series A analytics company",
          "Python fundamentals round at an e-commerce data platform team"
        ]
      },
      {
        category: "deep-dives",
        riskLevel: "high",
        asked: 25,
        questionText:
          "What is the mutable default argument gotcha in Python? Show me the bug and the fix.",
        code: [
          {
            accent: "bug",
            lang: "python",
            lines: [
              "def add_row(row, batch=[]):",
              "    batch.append(row)   # shared!",
              "    return batch",
              "add_row('a')   # ['a']",
              "add_row('b')   # ['a','b'] leaked",
            ],
          },
          {
            accent: "fix",
            lang: "python",
            lines: [
              "def add_row(row, batch=None):",
              "    if batch is None:",
              "        batch = []   # fresh call",
              "    batch.append(row)",
              "    return batch",
              "add_row('a')   # ['a']",
              "add_row('b')   # ['b']  independent",
            ],
          },
        ],
        answerStructured:
          "- **The bug**: `def append_to(element, to=[]):` — the default list `[]` is created **once when the function is defined**, not on each call. Every call that uses the default shares the same list object.\n- Calling `append_to(1)` then `append_to(2)` yields `[1, 2]` on the second call, not `[2]`. Silent, surprising, and hard to debug in pipelines.\n- **The fix**: use `None` as the sentinel and create the mutable object inside the function body:\n  ```python\n  def append_to(element, to=None):\n      if to is None:\n          to = []\n      to.append(element)\n      return to\n  ```\n- The same gotcha applies to any mutable default: `dict`, `set`, a custom object.\n- **Why it matters for data engineering**: factory functions and ETL helpers with mutable defaults accumulate state across pipeline runs, producing wrong results that are extremely hard to trace.",
        explanationDeep:
          "This is one of the most famous Python gotchas because it violates the intuition that 'default means fresh.' The root cause is that Python evaluates default argument expressions exactly once — when the `def` statement is executed — and binds the result to the function object's `__defaults__` attribute. The same object lives there for the lifetime of the function. Mutable objects mutate in place, so every call that uses the default sees all prior mutations.\n\nIn data engineering this bites in pipeline code: an ETL function that accumulates records into a default list will carry over records from a previous pipeline run if the function isn't reloaded. Worse, this is not caught by unit tests that only call the function once.\n\nThe `None` sentinel pattern is universal Python idiom: `if param is None: param = []`. The `is None` check (identity, not equality) is intentional — it correctly handles the case where a caller explicitly passes `None` to mean 'give me the default.' You can also check `param is None or param` but the simple `is None` is canonical and clear.",
        interviewerLens:
          "I expect every Python candidate to know this gotcha by name. What separates junior from mid is whether they can explain *why* it happens (evaluated once at `def` time, bound to `__defaults__`) and whether they can name a realistic scenario where it causes a silent data bug in a pipeline. If they just say 'use None instead' without explaining the mechanism, they've memorized the answer, not understood it.",
        followupChain: [
          {
            question: "How can you inspect a function's default values at runtime?",
            answer: "Access `fn.__defaults__` for positional defaults and `fn.__kwdefaults__` for keyword-only defaults. You can see the mutable list object there and watch it grow — useful for debugging this exact bug."
          },
          {
            question: "Does the same problem apply to `*args` and `**kwargs`?",
            answer: "No — `*args` and `**kwargs` are always freshly created tuples and dicts on each call. The gotcha only applies to explicit default values in the function signature."
          }
        ],
        redFlags: [
          {
            junior: "\"I'd just be careful not to modify the default.\"",
            senior: "\"That's not reliable in a team — the canonical fix is `None` as the sentinel and creating the mutable object inside the function body, every time, unconditionally.\""
          },
          {
            junior: "\"I'm not sure why it behaves that way.\"",
            senior: "\"Default arguments are evaluated once when `def` executes and stored in `__defaults__` — mutable objects there accumulate state across calls.\""
          }
        ],
        alternatePhrasings: [
          "\"Why does this Python function behave unexpectedly? `def f(items=[]):`\"",
          "\"What's wrong with using a list as a default argument?\"",
          "\"Explain Python's function default evaluation timing.\""
        ],
        interviewContexts: [
          "Junior Python screen at a data engineering bootcamp-to-hire",
          "Python fundamentals loop at a Series B analytics company",
          "Asked in 3 separate Python screening calls at data-heavy startups"
        ]
      },
      {
        category: "deep-dives",
        riskLevel: "medium",
        asked: 20,
        questionText:
          "Explain list comprehensions vs for loops vs map/filter. When would you choose each, and what are their performance characteristics?",
        answerStructured:
          "- **List comprehension**: `[expr for x in iterable if condition]` — concise, Pythonic, typically **faster than an equivalent for loop** because it's optimized in C and avoids repeated `list.append()` call overhead.\n- **For loop**: most flexible; necessary when you need multi-step logic, side effects, early exit (`break`), or accumulating to something other than a list. Not inherently slow — just more verbose.\n- **map/filter**: `map(fn, iterable)` and `filter(pred, iterable)` return lazy iterators (Python 3), so they're memory-efficient for large sequences. But they require `lambda` or a named function, reducing readability for complex transforms.\n- **Generator expression**: `(expr for x in iterable)` — like a list comprehension but lazy/streaming. Use when you only need to iterate once and don't need a materialized list.\n- **Rule of thumb**: list comprehension for simple transformations; for loop when logic is complex or you need side effects; generator expression when the result feeds a single-pass consumer (sum, max, a file write loop).",
        explanationDeep:
          "List comprehensions beat explicit for loops in CPython benchmarks by 10-30% for simple operations because the interpreter uses a specialized `LIST_APPEND` bytecode and avoids the attribute lookup of `list.append` on each iteration. But this difference is negligible compared to algorithmic choices (a set lookup vs list lookup) or vectorization (NumPy/pandas vs Python loops entirely). Don't micro-optimize between comprehension and loop; fix the algorithm or move to vectorization.\n\nThe memory distinction matters for large data: `[x for x in range(10_000_000)]` materializes 10M ints in memory; `(x for x in range(10_000_000))` is a generator that yields one at a time. If you're feeding a `sum()` or writing rows to a file, the generator version uses constant memory and is correct, while the list version can OOM on a constrained machine.\n\n`map` and `filter` with lambdas are considered less readable in PEP 8-aligned Python; Guido van Rossum has publicly preferred comprehensions. But `map(str, numbers)` is idiomatic and clear when the function already exists by name. Know the pattern, use your judgment on readability.",
        interviewerLens:
          "I'm checking two things: the memory difference between a list comprehension (eager) and a generator expression (lazy), and whether you know not to obsess over comprehension vs loop micro-performance when the real win is algorithmic. Candidates who say 'comprehensions are always faster' without nuance haven't profiled Python code. The generator-for-streaming answer is the data-engineering differentiator.",
        followupChain: [
          {
            question: "When would a generator expression be the wrong choice?",
            answer: "When you need to iterate the result more than once — generators are exhausted after a single pass. If you need to sort it, index into it, or iterate it twice, materialize it into a list. Also wrong when the consumer needs a `len()` — generators have no length."
          },
          {
            question: "How does a nested list comprehension work and when is it too clever?",
            answer: "`[x for row in matrix for x in row]` flattens a 2D list. It reads inside-out (outer loop first), which surprises most readers. When the nesting goes beyond two levels, a for loop is more readable and maintainable — 'clever' comprehensions that nobody can maintain in a week are tech debt."
          }
        ],
        redFlags: [
          {
            junior: "\"List comprehensions are always the fastest and best choice.\"",
            senior: "\"They're faster than equivalent for loops for simple ops, but the big wins are algorithmic (O(n) vs O(n²)) or vectorization (NumPy/pandas vs Python). And if I only iterate once, a generator expression uses less memory.\""
          }
        ],
        alternatePhrasings: [
          "\"Is a list comprehension faster than a for loop?\"",
          "\"When would you use a generator expression instead of a list comprehension?\"",
          "\"Explain map and filter and when you'd reach for them.\""
        ],
        interviewContexts: [
          "Junior Python screen at a data analytics startup",
          "Python coding round at a data engineering bootcamp placement",
          "Asked at an entry-level data analyst interview"
        ]
      },
      // ── decision-frameworks ───────────────────────────────────
      {
        category: "decision-frameworks",
        riskLevel: "medium",
        asked: 18,
        questionText:
          "How do *args and **kwargs work, and when would you design a function to use them?",
        code: [
          {
            lang: "python",
            label: "pass-through wrapper",
            lines: [
              "def timed(fn):",
              "    def wrap(*args, **kwargs):",
              "        # args: tuple, kwargs: dict",
              "        return fn(*args, **kwargs)",
              "    return wrap",
            ],
          },
        ],
        answerStructured:
          "- `*args` collects extra **positional** arguments into a **tuple**. The function receives a single `args` tuple, iterable, of whatever the caller passes positionally beyond the named parameters.\n- `**kwargs` collects extra **keyword** arguments into a **dict**. Good for optional config, pass-through wrappers, and decorators.\n- Use `*args` when the number of positional inputs is variable but semantically homogeneous (e.g., a sum, a concatenation, a merge of N DataFrames).\n- Use `**kwargs` when you're building a wrapper that forwards options to an underlying function without enumerating every parameter explicitly.\n- Combine: `def fn(*args, **kwargs)` is the universal pass-through — used heavily in decorators and middleware.\n- **Anti-pattern**: using `**kwargs` to hide required parameters — it makes the API opaque. Explicit named parameters with type hints are better for APIs that humans read.",
        explanationDeep:
          "The two concrete use cases every data engineer should name: (1) a `merge_dataframes(*dfs)` function that accepts any number of DataFrames and concatenates them — `*args` is cleaner than asking for a list, and the caller's site reads `merge(df1, df2, df3)` rather than `merge([df1, df2, df3])`; (2) a logging or retry decorator that needs to forward all original arguments to the wrapped function — `def wrapper(*args, **kwargs): return original(*args, **kwargs)` without knowing what the original takes.\n\nThe ordering rule is worth knowing: `def f(a, b, *args, **kwargs)` — positional required params first, then `*args`, then keyword-only params, then `**kwargs`. You can also have keyword-only params between `*args` and `**kwargs`: `def f(*args, sep=',', **kwargs)` makes `sep` keyword-only.\n\nFor type hints: `*args: str` annotates the type of each element (not the tuple), and `**kwargs: int` annotates the type of each value. In strict codebases, `TypedDict` or explicit keyword parameters are preferred over `**kwargs` for clarity.",
        interviewerLens:
          "I want a concrete use case for each — not just the definition. 'It collects extra arguments' is the lookup answer. 'I use *args when merging a variable number of DataFrames' and 'I use **kwargs in decorators to pass arguments through transparently' shows you've actually used them in production code.",
        followupChain: [
          {
            question: "What's the difference between `*args` in a function definition and `*iterable` in a function call?",
            answer: "In a definition, `*args` gathers extra positional arguments into a tuple. In a call, `*iterable` unpacks the iterable as positional arguments — the opposite operation. Both use the `*` operator but in opposite directions: gather vs scatter."
          },
          {
            question: "How do you enforce keyword-only arguments in Python?",
            answer: "Put a bare `*` in the parameter list: `def f(a, b, *, c, d)` — everything after the `*` must be passed as keyword arguments. Useful for APIs where positional ordering would be confusing (e.g., `pd.read_csv(path, *, sep=',', header=0)`)."
          }
        ],
        redFlags: [
          {
            junior: "\"*args is just a list of extra arguments.\"",
            senior: "\"*args is a tuple (immutable) of extra positional arguments, and **kwargs is a dict of extra keyword arguments. I reach for *args when the number of homogeneous inputs is variable, and **kwargs for wrapper/decorator pass-through.\""
          }
        ],
        alternatePhrasings: [
          "\"Explain *args and **kwargs with an example from a data pipeline.\"",
          "\"How would you write a function that accepts any number of DataFrames and merges them?\"",
          "\"When would you use **kwargs in a decorator?\""
        ],
        interviewContexts: [
          "Python screen at a junior data engineer position",
          "Asked at a data engineering fundamentals round at a Series A startup"
        ]
      },
      {
        category: "decision-frameworks",
        riskLevel: "low",
        asked: 14,
        questionText:
          "When would you use a set vs a list for a deduplication or membership-test problem in a data pipeline?",
        code: [
          {
            lang: "python",
            label: "order-preserving dedup",
            lines: [
              "seen = set()",
              "out = [x for x in rows",
              "       if not (x in seen",
              "               or seen.add(x))]",
              "# one-liner, hashable only:",
              "out = list(dict.fromkeys(rows))",
            ],
          },
        ],
        answerStructured:
          "- **Use a set** when: (1) you need to test `in` repeatedly — O(1) vs O(n); (2) you need unique elements and don't care about order; (3) you want set operations (intersection/difference/union) for record reconciliation.\n- **Use a list** when: (1) order must be preserved; (2) duplicates are meaningful (e.g., event counts); (3) you need index access or slicing.\n- **Dedup preserving order** (common pipeline need): `seen = set(); result = [x for x in items if not (x in seen or seen.add(x))]` — iterate the list once, track seen in a set. O(n) time, O(n) space.\n- **Set from list** before a membership loop: `allowed_ids = set(lookup_table['id'])` — then `df['valid'] = df['user_id'].isin(allowed_ids)` is O(n) not O(n×m).\n- In pandas, `.isin(set)` is faster than `.isin(list)` for large lookup tables — pandas converts to a hash-set internally, but an explicit set makes the intent clear.",
        explanationDeep:
          "The most common pipeline performance regression from this question: an inner join that's implemented as 'for each row in table_a, check if row.id in list_of_table_b_ids' — O(n×m). Converting to `set(table_b_ids)` makes it O(n). For pandas, `.isin()` accepts both iterables but signals membership intent; passing a `frozenset` or `set` is idiomatic and avoids any conversion inside pandas.\n\nOrder-preserving dedup without sorting comes up in pipeline deduplication of records where insertion order matters (e.g., streaming event logs). The `seen.add(x)` trick works because `set.add` returns `None`, which is falsy, so the `or` short-circuit only reaches `seen.add(x)` when `x` is not already in `seen`. It's a compact idiom; in production, I'd factor it into a named function for readability.\n\nFrozensets are worth knowing for advanced use: a `frozenset` is immutable and hashable, so you can use it as a dict key (e.g., keying aggregations on a set of tags per record).",
        interviewerLens:
          "I want to hear O(1) vs O(n) membership named explicitly, and I want the order-preserving dedup pattern — that tells me you've written production ETL deduplication logic, not just toy examples. The pandas `.isin(set)` nuance is a bonus.",
        followupChain: [
          {
            question: "How does `set.add()` return a value, and why does the dedup idiom exploit it?",
            answer: "`set.add()` always returns None (falsy). The idiom `x in seen or seen.add(x)` short-circuits: if `x` is already in `seen`, the `or` right side never evaluates (x is filtered out). If `x` is not in `seen`, `seen.add(x)` runs (adding it) and returns None (falsy) — the comprehension includes x. It's a one-line, order-preserving dedup."
          }
        ],
        redFlags: [
          {
            junior: "\"I'd use list.remove() to deduplicate.\"",
            senior: "\"list.remove() is O(n) per element, making dedup O(n²). I'd use a seen-set for O(n) dedup, or dict.fromkeys() if I want the simplest one-liner (though that doesn't work for unhashable items).\""
          }
        ],
        alternatePhrasings: [
          "\"How do you deduplicate a list while preserving order?\"",
          "\"Why is `in` faster on a set than a list?\"",
          "\"You have two lists of IDs. How do you find which IDs are in both without a double loop?\""
        ],
        interviewContexts: [
          "Junior Python data engineering screen at a fintech startup",
          "Python performance question at a data analytics company"
        ]
      },
      // ── tool-comparison ───────────────────────────────────────
      {
        category: "tool-comparison",
        riskLevel: "medium",
        isComparison: true,
        comparisonTools: ["list comprehension", "for loop", "generator expression"],
        asked: 15,
        questionText:
          "List comprehension vs for loop vs generator expression — which produces the least memory overhead and why does it matter for data pipelines?",
        code: [
          {
            lang: "python",
            label: "O(n) vs O(1) memory",
            lines: [
              "# [] builds full list: O(n) mem",
              "nums = [int(x) for x in lines]",
              "# () is lazy: O(1) mem, 1 pass",
              "total = sum(int(x)",
              "            for x in lines)",
            ],
          },
        ],
        answerStructured:
          "- **List comprehension**: eagerly builds the full list in memory. Memory = O(n) of the result. Fast due to C-level `LIST_APPEND` optimization.\n- **For loop with append**: also O(n), slightly slower than comprehension due to repeated `.append()` attribute lookups, but more flexible.\n- **Generator expression**: lazy, yields one item at a time. Memory = O(1) of the result — only the current item lives in memory at a time.\n- **Winner for memory**: generator expression. It doesn't matter how large the input is — the generator never materializes the full result.\n- **When it actually matters**: reading 10GB of logs line-by-line and computing a per-line statistic; processing paginated API results; streaming records to a file. All cases where you only need one pass and don't need random access.\n- **When to materialize**: if you need to sort, index, iterate twice, or pass to something expecting a list — then a list comprehension or `list(generator)` is correct.",
        explanationDeep:
          "In CPython, a list comprehension executes a specialized `BUILD_LIST` / `LIST_APPEND` loop that's faster than the equivalent `for` loop with `list.append` because it avoids re-resolving the `append` attribute on each iteration. The difference is 10-30% on simple transforms — meaningful but not the primary optimization lever.\n\nThe generator vs list distinction is the data-engineering differentiator. `sum(x*x for x in range(10_000_000))` uses a generator expression that feeds the C-implemented `sum()` builtin one value at a time, keeping memory flat. `sum([x*x for x in range(10_000_000)])` first builds a 10M-element list, consuming ~80MB (on 64-bit Python), then sums it. For a pipeline processing log files on a machine with 8GB RAM, the generator version never risks OOM; the list version might.\n\nThe rule for pipelines: prefer generators/iterators for data streams; materialize into lists only when random access, sorting, or multiple passes are needed. Libraries like `itertools` (chain, islice, groupby) compose generator pipelines elegantly without materializing intermediates.",
        interviewerLens:
          "I want the O(1) memory vs O(n) memory distinction stated clearly, with a concrete scenario where it matters (large file processing, streaming). Candidates who only know 'comprehensions are faster than loops' have the benchmark story right but the data-engineering story wrong — the memory cost of eagerly materializing large sequences is the real issue.",
        followupChain: [
          {
            question: "How would you pipeline three transformations on a large iterable without materializing intermediates?",
            answer: "Chain generator expressions: `result = (transform3(x) for x in (transform2(x) for x in (transform1(x) for x in raw_data)))`. Or use `map()` chaining: `map(t3, map(t2, map(t1, raw_data)))`. Either approach keeps one item in memory at a time across all three transforms."
          }
        ],
        redFlags: [
          {
            junior: "\"I always use list comprehensions — they're Pythonic and fast.\"",
            senior: "\"List comprehensions are O(n) memory — for large data streams I use generator expressions which are O(1) memory and only iterate once. I only materialize when I need sorting, indexing, or multiple passes.\""
          }
        ],
        alternatePhrasings: [
          "\"What's the memory difference between `[x for x in data]` and `(x for x in data)`?\"",
          "\"How do you process a large file without loading it all into memory using pure Python?\"",
          "\"When would you choose a generator over a list?\""
        ],
        interviewContexts: [
          "Python fundamentals screen at an entry-level data engineer role",
          "Asked at a junior Python coding round at a logistics data platform"
        ]
      }
    ],
    topics: {
      moreDeepDives: [
        "Explain Python's `is` vs `==` and when they give different results.",
        "What is a decorator and write a simple timer decorator from scratch.",
        "How does Python's `with` statement (context manager) work and why use it for file I/O?",
        "What is the difference between `==` and `is` for None comparison?",
        "Explain `enumerate` and `zip` — write a function that pairs two lists and handles unequal lengths.",
        "What does `dict.get(key, default)` buy you over `dict[key]` and when does it matter in ETL code?"
      ],
      decisions: [
        "When do you reach for `defaultdict` vs a plain `dict` with `.get()`?",
        "List vs deque — when does the O(1) left-append of deque matter?",
        "When is a tuple a better return type than a list from a function?"
      ],
      quickRef: [
        "What is O(1) vs O(n) membership — which Python type gives each?",
        "Mutable default argument fix in one line?",
        "What does `*args` collect — a list or a tuple?",
        "What does `**kwargs` collect — a list or a dict?",
        "List comprehension vs generator expression — what's the memory difference?",
        "What does `Counter.most_common(3)` return?",
        "Why can't a list be a dict key?",
        "What does `set.add()` return?",
        "What is a frozenset?",
        "What does `enumerate(iterable, start=1)` do?"
      ],
      redFlags: [
        {
          junior: "\"I use a list for everything — it's simpler.\"",
          senior: "\"Membership tests on a list are O(n). I convert to a set before any loop that checks `in` — that's the difference between O(n²) and O(n).\""
        },
        {
          junior: "\"def f(items=[]):\" — mutable default argument.\"",
          senior: "\"Mutable defaults are shared across all calls — the canonical fix is `items=None` and `if items is None: items = []` inside the function body.\""
        },
        {
          junior: "\"List comprehensions are always the most efficient.\"",
          senior: "\"They're O(n) memory. For large data I prefer generator expressions — O(1) memory and fine for any single-pass consumer.\""
        },
        {
          junior: "\"*args is a list of extra arguments.\"",
          senior: "\"*args is a tuple (immutable), **kwargs is a dict. I use *args for variable-length homogeneous inputs and **kwargs for wrapper/pass-through patterns.\""
        }
      ],
      checklist: [
        "Know Big-O of list/set/dict/tuple for membership, insert, and access",
        "Explain mutable default argument: mechanism (evaluated once at def), fix (None sentinel)",
        "Know list comprehension vs generator expression memory trade-off",
        "Know *args (tuple) vs **kwargs (dict) and name a real use case for each",
        "Order-preserving dedup with a seen-set: O(n) time and space"
      ],
      behavioral: [
        "Tell me about a time a Python performance bug bit you — how did you diagnose it?",
        "Describe a data pipeline script you wrote that you had to refactor for correctness.",
        "How do you explain a Python gotcha (like mutable defaults) to a junior teammate?"
      ],
      reverse: [
        "What Python version are you running in production and are there plans to upgrade?",
        "Is the Python layer used for ETL, ML, or both?",
        "Do you use type hints and static analysis (mypy, pyright) in the codebase?"
      ]
    }
  },

  // ─────────────────────────────────────────────────────────────
  // MID — generators/streaming for large data, the GIL (threading
  //       vs multiprocessing vs asyncio), pandas vectorization vs
  //       loops, shallow vs deep copy
  // ─────────────────────────────────────────────────────────────
  mid: {
    authored: [
      // ── deep-dives ────────────────────────────────────────────
      {
        category: "deep-dives",
        riskLevel: "high",
        freePreview: true,
        asked: 30,
        questionText:
          "Explain Python's GIL and tell me when you'd choose threading vs multiprocessing vs asyncio for a data engineering task.",
        answerStructured:
          "- The **GIL** (Global Interpreter Lock) is a mutex in CPython that allows only one thread to execute Python bytecodes at a time. It simplifies memory management but means **threads do not achieve true parallelism for CPU-bound work**.\n- **Threading**: releases the GIL during I/O waits, so multiple threads can overlap I/O. Right choice for I/O-bound tasks (S3 uploads, API calls, DB queries). Wrong choice for CPU-bound transforms — the GIL serializes them.\n- **Multiprocessing**: spawns separate OS processes, each with its own GIL and memory space. True parallelism across CPU cores. Right choice for CPU-bound transforms (large data cleaning, encryption, serialization). Cost: process startup overhead and IPC serialization.\n- **asyncio**: single thread, event loop, cooperative multitasking via `async/await`. Right choice for I/O-bound tasks with many concurrent connections (hundreds of async API calls, streaming). No OS-thread overhead. Requires libraries to be async-native (aiohttp, aiobotocore).\n- **Decision rule**: CPU-bound → multiprocessing. I/O-bound + async libraries → asyncio. I/O-bound + sync libraries → threading.",
        explanationDeep:
          "The GIL is specific to CPython (the reference implementation). Jython and PyPy-STM don't have it, and Python 3.13+ introduced an experimental free-threaded build (PEP 703) — worth mentioning if the interviewer asks about the future. But in standard CPython production code, the GIL is the reality you design around.\n\nThe core confusion in interviews is 'I/O-bound vs CPU-bound.' The GIL is released during system calls (file reads, network I/O, sleep) — so threading *does* work for I/O concurrency. A thread waiting for an S3 response releases the GIL, letting another thread run. But a thread doing a tight Python computation loop never releases the GIL voluntarily (it's only released on a bytecode count interval), so threads contend and you get worse performance than single-threaded.\n\nFor data engineering the practical heuristic: if you're running many HTTP requests to fetch data, threading or asyncio. If you're processing fetched data (transforming, encoding, hashing), multiprocessing. A common pattern is a pipeline that uses asyncio or threading for fetching and then sends work to a `ProcessPoolExecutor` for CPU-heavy transforms.\n\nPython 3.13's free-threaded CPython (no-GIL build) is real and opt-in but not production-default yet — mention it to show you're current, but don't design around it for today's production code.",
        interviewerLens:
          "The phrase I'm waiting for is 'CPU-bound vs I/O-bound' as the decision axis, not 'threads vs multiprocessing vs asyncio' as a preference debate. If you can name a concrete scenario for each (S3 uploads → threading/asyncio; DataFrame transforms → multiprocessing; 500 concurrent API calls → asyncio) you've shown you've made this choice in production. Bonus points for mentioning the experimental free-threaded Python 3.13 build — shows you follow the language.",
        followupChain: [
          {
            question: "When would you combine asyncio and multiprocessing in the same application?",
            answer: "Fetch/network phase: asyncio for hundreds of concurrent I/O-bound requests. Processing phase: asyncio's `loop.run_in_executor(ProcessPoolExecutor)` to offload CPU-bound transforms to worker processes without blocking the event loop. This is the fan-out/gather pattern in data ingestion pipelines."
          },
          {
            question: "How does `concurrent.futures` fit in?",
            answer: "`ThreadPoolExecutor` and `ProcessPoolExecutor` from `concurrent.futures` give a uniform high-level API over both threading and multiprocessing. `submit()` returns a `Future`, and `as_completed()` yields results as they finish. They're the practical choice over raw `threading.Thread` and `multiprocessing.Process` for most pipeline use cases."
          },
          {
            question: "What happens to shared memory between multiprocessing workers?",
            answer: "Workers get a copy of the parent's memory at fork time (copy-on-write on Unix, but Windows/macOS spawn new processes). They do not share Python objects. Communication happens through Queues, Pipes, or shared memory (mmap/multiprocessing.shared_memory in Python 3.8+). Pickling is the serialization step — large DataFrames are expensive to pickle/unpickle across process boundaries."
          }
        ],
        redFlags: [
          {
            junior: "\"Threading makes Python faster for CPU-heavy data processing.\"",
            senior: "\"The GIL serializes CPU-bound threads — I'd use multiprocessing for true parallelism on CPU work. Threading only helps when threads are waiting on I/O.\""
          },
          {
            junior: "\"asyncio is the modern way and replaces multiprocessing.\"",
            senior: "\"asyncio is great for I/O concurrency but it's single-threaded — it doesn't parallelize CPU computation. For CPU-bound work, multiprocessing is still the right tool.\""
          }
        ],
        alternatePhrasings: [
          "\"Why doesn't Python threading speed up my pandas transforms?\"",
          "\"What's the GIL and how do you work around it?\"",
          "\"When would you use asyncio vs multiprocessing for a data pipeline?\""
        ],
        interviewContexts: [
          "Mid-level Python screen at a data engineering company",
          "Asked at a Series C fintech data platform interview",
          "Python concurrency deep-dive at a streaming data team"
        ]
      },
      {
        category: "deep-dives",
        riskLevel: "high",
        asked: 26,
        questionText:
          "Explain Python generators: how they work under the hood, and why they matter for streaming large datasets.",
        code: [
          {
            lang: "python",
            label: "lazy, stateful resume",
            lines: [
              "def read(path):",
              "    with open(path) as f:",
              "        for line in f:   # O(1) mem",
              "            yield line.strip()",
              "g = read('huge.log')",
              "next(g)  # runs to 1st yield, pauses",
            ],
          },
        ],
        answerStructured:
          "- A **generator function** uses `yield` instead of `return`. Calling it returns a **generator object** — it does not execute the body immediately.\n- Each call to `next()` on the generator resumes execution from the last `yield`, pausing again at the next one. State (local variables, execution pointer) is preserved between calls.\n- Memory footprint: **O(1) relative to dataset size**. Only the current item and local state exist in memory, not the entire collection.\n- `yield from` delegates to a sub-generator, composing generator pipelines without flattening.\n- **Data engineering use cases**: streaming a 50GB log file line-by-line, reading paginated API responses, transforming records in a pipeline without materializing the full result, generating synthetic test data lazily.\n- Key limitation: **single-pass** — you can't restart or index a generator. If you need multiple passes, materialize to a list or re-call the function.",
        explanationDeep:
          "Under the hood, a generator function is compiled to a code object that is wrapped in a generator object when called. The generator object stores the frame (local variables, bytecode position) — essentially a paused coroutine. Each `next()` call resumes the frame from the saved bytecode position until the next `yield` or `StopIteration`.\n\nThis is functionally equivalent to an iterator class with `__iter__` and `__next__`, but generators compile automatically from the function body. The `yield` expression is not just a value emitter — it can also *receive* values via `generator.send(value)`, which is how coroutines work and is the foundation of Python's asyncio before `async/await` syntax was added.\n\nFor data engineering, the streaming pattern is: `def read_chunks(path, size=10_000): with open(path) as f: reader = csv.reader(f); yield next(reader)  # header; batch = []; for row in reader: batch.append(row); if len(batch) == size: yield batch; batch = []; if batch: yield batch`. This reads 50GB in bounded memory regardless of file size. Pandas `read_csv(chunksize=N)` returns a similar generator of DataFrames under the hood.\n\nGenerators compose with `itertools` (chain, islice, takewhile, groupby) to build multi-stage lazy pipelines — none of the stages allocate a full collection. This is the Python equivalent of Spark's lazy evaluation graph.",
        interviewerLens:
          "I want 'lazy — yields one item at a time, O(1) memory' stated immediately, and then a real data-engineering scenario (file streaming, pagination, chunked transforms). The `send()` / coroutine mention is a senior bonus. Candidates who say 'generators are like list comprehensions but with parentheses' understand the syntax but not the execution model.",
        followupChain: [
          {
            question: "What is `yield from` and when do you use it?",
            answer: "`yield from subgenerator` delegates iteration to another generator, transparently forwarding values and the send/throw/close protocol. Use it when building a generator that's composed of multiple sub-generators, e.g., `yield from chunk_file(part1); yield from chunk_file(part2)`. Without `yield from` you'd need an explicit `for item in subgenerator: yield item` loop."
          },
          {
            question: "What happens when you call `list()` on a generator?",
            answer: "It exhausts the generator, materializing all yielded values into a list. After that the generator is empty — `next()` raises `StopIteration`. This is useful for debugging (inspect the full output) but defeats the memory benefit for large sequences."
          },
          {
            question: "How is a generator different from an iterator?",
            answer: "All generators are iterators (they implement `__iter__` and `__next__`), but not all iterators are generators. A generator is specifically created by a generator function (with `yield`) or a generator expression. You can also write an iterator as a class with `__iter__`/`__next__` — more verbose but sometimes needed for complex state."
          }
        ],
        redFlags: [
          {
            junior: "\"Generators are just like list comprehensions with parentheses.\"",
            senior: "\"The syntax is similar but the execution model is fundamentally different — generators are lazy and stateful, yielding one value at a time with O(1) memory. List comprehensions eagerly materialize O(n) memory.\""
          },
          {
            junior: "\"I'd load the 10GB file with pd.read_csv() and process it.\"",
            senior: "\"That would likely OOM. I'd use pd.read_csv(chunksize=N) which returns a generator of DataFrames, or a plain generator reading lines, to keep memory flat.\""
          }
        ],
        alternatePhrasings: [
          "\"What is `yield` and why would you use it instead of return?\"",
          "\"How do you process a file too large to fit in memory using Python?\"",
          "\"Explain lazy evaluation in Python.\""
        ],
        interviewContexts: [
          "Mid-level Python data engineering screen at a cloud infrastructure company",
          "Python generators deep-dive at a Series B data startup",
          "Asked at an ML platform engineering loop"
        ]
      },
      {
        category: "deep-dives",
        riskLevel: "high",
        asked: 24,
        questionText:
          "Why is a vectorized pandas operation so much faster than a Python for loop? What does 'vectorized' mean and how does it apply to a data cleaning pipeline?",
        code: [
          {
            accent: "bug",
            lang: "python",
            lines: [
              "# Series built per row, ~1000x slow",
              "for i, row in df.iterrows():",
              "    df.at[i, 'clean'] = (",
              "        row['name'].strip().lower())",
            ],
          },
          {
            accent: "fix",
            lang: "python",
            lines: [
              "# vectorized, runs in C",
              "df['clean'] = (",
              "    df['name'].str.strip()",
              "              .str.lower())",
            ],
          },
        ],
        answerStructured:
          "- **Vectorized operation**: the computation is applied to the entire array in one call, executed in compiled C/Fortran (via NumPy), with no Python-level looping and no interpreter overhead per element.\n- A Python `for` loop over a DataFrame row iterates through Python objects, involves the interpreter, attribute lookups, and boxing/unboxing — roughly **100x–1000x slower** than a vectorized equivalent.\n- **Hierarchy of speed** (fastest → slowest): compiled C (NumPy/pandas built-ins) → vectorized pandas operations → `df.apply()` (row-wise Python function, still interpreted) → `iterrows()` (extremely slow, creates a new Series per row) → `itertuples()` (slightly better than iterrows, still Python-level).\n- **Data cleaning pipeline**: instead of `for idx, row in df.iterrows(): df.at[idx, 'clean'] = row['name'].strip().lower()`, write `df['clean'] = df['name'].str.strip().str.lower()` — one vectorized call that runs in C.\n- When a vectorized built-in doesn't exist: `df.apply()` is the escape hatch. Use `np.vectorize` or Cython/Numba for custom numeric logic that must be fast.",
        explanationDeep:
          "Pandas is a thin Python wrapper over NumPy arrays, which are contiguous blocks of typed C memory. When you call `df['col'] * 2`, pandas calls NumPy's C-level multiply on the entire array in one shot. No Python objects are created per element — the loop runs at CPU-cache-friendly C speed, often SIMD-vectorized by the compiler.\n\nThe `iterrows()` disaster: for a 1M-row DataFrame, `iterrows()` creates 1M new Series objects (one per row), each with a copy of the row's index — massive object allocation overhead. Even `itertuples()` (which yields namedtuples) is orders of magnitude faster but still Python-level. The benchmark: a million-row multiplication that takes 5ms vectorized takes 5 seconds with `iterrows()` — a 1000x difference.\n\n`df.apply(fn, axis=1)` applies a Python function row-by-row — still interpreted, but avoids Series creation. For string operations, `.str.method()` is the pandas vectorized accessor (also runs C-level). For custom math, `np.vectorize` is convenience syntax but still calls the Python function per element. For real speed on custom numeric transforms, Numba `@jit` compiles to LLVM machine code and can match NumPy speed.\n\nThe practical pipeline design: profile with `%timeit` or `cProfile` to find the bottleneck; then replace `iterrows` → vectorized pandas → if needed, Numba. Most data cleaning operations (string normalization, date parsing, arithmetic) have vectorized pandas equivalents — reach for them first.",
        interviewerLens:
          "I want to hear 'NumPy C-level, no Python-per-element loop' as the mechanism, and `iterrows()` named as the worst anti-pattern. Candidates who know the speed hierarchy (built-ins > apply > iterrows) and can name a real column operation that was slow and how they fixed it have clearly profiled production pandas code.",
        followupChain: [
          {
            question: "When is `df.apply()` acceptable?",
            answer: "When there's no vectorized pandas or NumPy equivalent for the logic, and the DataFrame is not so large that the row-by-row Python overhead is prohibitive. For prototype/exploratory code, `apply` is fine. For production pipelines on millions of rows, profile it — if it's the bottleneck, rewrite in NumPy or Numba."
          },
          {
            question: "How does Numba speed up custom numeric functions?",
            answer: "Numba's `@jit` decorator compiles Python+NumPy code to LLVM machine code at runtime on first call. The compiled function runs at near-C speed without leaving Python. It works best on numeric operations; it doesn't handle arbitrary Python objects. Use it when you have a custom rolling or element-wise computation with no NumPy built-in."
          }
        ],
        redFlags: [
          {
            junior: "\"I'd use iterrows() to apply a transform to each row.\"",
            senior: "\"iterrows() is one of the slowest pandas patterns — it creates a Series per row. I'd write it as a vectorized column operation like `df['col'].str.strip()` which runs in C and is 1000x faster.\""
          },
          {
            junior: "\"df.apply() is vectorized.\"",
            senior: "\"apply() is still a Python-level loop over rows or columns — it avoids Series creation overhead vs iterrows, but it's not C-vectorized like built-in NumPy/pandas operations.\""
          }
        ],
        alternatePhrasings: [
          "\"Your pandas pipeline is slow — what do you check first?\"",
          "\"Why should you avoid iterrows() in production?\"",
          "\"How does NumPy make pandas operations fast?\""
        ],
        interviewContexts: [
          "Mid-level data engineer at a data platform company",
          "pandas optimization question at a fintech analytics team",
          "Asked at a data scientist / data engineer crossover role interview"
        ]
      },
      {
        category: "deep-dives",
        riskLevel: "medium",
        asked: 19,
        questionText:
          "Explain shallow copy vs deep copy in Python. When does shallow copy silently corrupt a data pipeline?",
        code: [
          {
            accent: "bug",
            lang: "python",
            lines: [
              "df2 = df          # alias, not copy",
              "df2['x'] = 0      # mutates df too!",
              "sub = df[df.a > 0]",
              "sub['x'] = 0      # SettingWithCopy",
            ],
          },
          {
            accent: "fix",
            lang: "python",
            lines: [
              "df2 = df.copy()   # independent",
              "df2['x'] = 0      # df untouched",
              "sub = df[df.a > 0].copy()",
              "sub['x'] = 0      # safe",
            ],
          },
        ],
        answerStructured:
          "- **Shallow copy** (`copy.copy()`, slice `[:]`, `list()`, `dict()`, `.copy()`): creates a new container but shares references to the nested objects inside. Mutating a nested mutable object in the copy also mutates it in the original.\n- **Deep copy** (`copy.deepcopy()`): recursively duplicates everything — the container and all nested objects. Completely independent of the original.\n- **The gotcha**: `df2 = df` is not a copy — it's a reference alias. `df2 = df.copy()` is a shallow copy (for DataFrames, usually fine because columns are a dict of arrays). `df2 = df.copy(deep=True)` (default) copies the underlying arrays.\n- **Pipeline corruption pattern**: `def process(record, state={'errors': [], 'count': 0}): ...` — the nested list `errors` is shared across calls. Adding to `state['errors']` in one call corrupts the state for the next. Fix: deep copy the template or use `None` sentinel.\n- **pandas-specific**: `df[df['col'] > 0]` returns a view or copy depending on context (the SettingWithCopyWarning). Use `.copy()` explicitly when you plan to modify the result.",
        explanationDeep:
          "The shallow/deep copy distinction matters whenever your data structures contain mutable nested objects — lists of dicts, dicts of lists, DataFrames inside dicts. The confusion comes from the fact that many 'copy' operations in Python produce shallow copies: `list[:]`, `list()`, `dict.copy()`, `set.copy()` are all shallow. `json.loads(json.dumps(obj))` is a deep copy for JSON-serializable objects (useful trick in pinches, but slower and only works for serializable types).\n\nThe pandas SettingWithCopyWarning is the production manifestation: `sub = df[df['status'] == 'active']; sub['cleaned'] = sub['name'].str.strip()` — pandas may warn because `sub` might be a view into `df`, and writing to `sub` may or may not modify `df` depending on internal internals. The safe pattern is `sub = df[df['status'] == 'active'].copy()` — explicitly independent.\n\nFor custom objects, `__copy__` and `__deepcopy__` control shallow and deep copy behavior respectively — relevant when building custom data containers in an ETL framework.",
        interviewerLens:
          "The SettingWithCopyWarning signal is the production tell — candidates who know to add `.copy()` after slicing a DataFrame before modification have been burned by silent data mutation in pandas. The state-dict pattern is the ETL-specific version. Candidates who only know 'deep copy = fully independent' without naming a scenario where shallow copy bites have memorized the definition.",
        followupChain: [
          {
            question: "When is `copy.copy()` enough vs requiring `copy.deepcopy()`?",
            answer: "Shallow copy is enough when the container holds immutable objects (ints, strings, tuples of immutables) — there's nothing to mutate. Deep copy is required when the container holds nested mutable objects (lists of lists, dicts of lists) that you intend to modify independently in the copy."
          },
          {
            question: "What does `df.copy(deep=False)` give you in pandas?",
            answer: "A new DataFrame object with the same column index, but the underlying NumPy arrays are shared. Modifying values in the shallow copy modifies the original's arrays. This is rarely what you want — the default `df.copy()` (deep=True) copies the arrays."
          }
        ],
        redFlags: [
          {
            junior: "\"I'd just do `df2 = df` to make a copy.\"",
            senior: "\"That's an alias — both names point to the same object. Any mutation to df2 affects df. I use `df.copy()` for an independent copy, or `df[condition].copy()` when slicing before modifying.\""
          },
          {
            junior: "\"copy.copy() and copy.deepcopy() do the same thing.\"",
            senior: "\"Shallow copy duplicates the container but shares nested object references — mutating a nested list in the copy affects the original. Deep copy recursively duplicates everything for full independence.\""
          }
        ],
        alternatePhrasings: [
          "\"You modified a DataFrame slice and got a SettingWithCopyWarning — what's happening?\"",
          "\"What's the difference between `list2 = list1` and `list2 = list1.copy()`?\"",
          "\"Explain shallow vs deep copy with a pandas example.\""
        ],
        interviewContexts: [
          "Mid-level Python data engineering screen at a healthcare data company",
          "Asked at an ETL-focused data engineering interview",
          "pandas gotcha question at a Series B fintech"
        ]
      },
      // ── decision-frameworks ───────────────────────────────────
      {
        category: "decision-frameworks",
        riskLevel: "high",
        asked: 21,
        questionText:
          "Your pandas pipeline is slow on 500MB DataFrames. Walk me through your optimization process.",
        answerStructured:
          "- **Step 1: Profile first.** `%timeit` in a notebook or `cProfile`/`line_profiler` to find the bottleneck. Never optimize without a measurement.\n- **Step 2: Eliminate `iterrows()` / `apply(axis=1)`.** Replace with vectorized column operations. This alone is often the 10x–1000x fix.\n- **Step 3: Reduce memory.** Downcast numeric types (`pd.to_numeric(df['col'], downcast='integer')`), convert low-cardinality string columns to `category` (can reduce memory by 50–90%). Fewer bytes = fewer cache misses = faster compute.\n- **Step 4: Use `.str` / `.dt` accessors** for string and datetime operations — they're vectorized C extensions, not Python loops.\n- **Step 5: Filter early.** Push `df = df[condition]` before joins and heavy transforms to shrink the working set.\n- **Step 6: If pandas hits a wall**, try **Polars** (lazy API, Rust-based, multithreaded by default) or **DuckDB** (SQL engine, handles files larger than RAM). For multi-machine, PySpark.",
        explanationDeep:
          "The profiling discipline is the senior differentiator — don't guess, measure. `line_profiler` (via `%lprun` in Jupyter) shows line-by-line time in a function, immediately revealing whether the bottleneck is the groupby, the apply, or the merge. Without measurement, optimizations are guesses.\n\nMemory reduction is underrated. A float64 column holding only integers up to 255 uses 8 bytes per value; downcast to uint8 and it's 1 byte — an 8x reduction that translates to 8x less data flowing through CPU caches. The `category` dtype is even more dramatic for string columns with repeated values: instead of storing 'California' 1 million times, it stores 1 integer code per row and maps codes to strings — potentially 90% memory reduction and faster groupby operations.\n\nThe Polars / DuckDB escalation decision: if the data fits in RAM and the bottleneck is pandas single-threaded limitations, Polars's lazy API automatically parallelizes and optimizes the query plan — often 5–20x faster than pandas on multi-core machines with no code restructuring beyond translating the API. If the data is larger than RAM or the bottleneck is complex SQL-like analytics, DuckDB's vectorized SQL engine handles it with out-of-core spilling and is often faster than either.",
        interviewerLens:
          "I want 'profile first' as the opening move — candidates who immediately say 'switch to Polars' or 'use Dask' without profiling have a hammer in search of a nail. The memory-reduction techniques (downcasting, category dtype) are the mid-level signal — they show you've actually sized pandas DataFrames in production. Naming Polars/DuckDB as the escalation path shows you know when Python itself is the right boundary.",
        followupChain: [
          {
            question: "How do you profile a pandas pipeline in a Jupyter notebook?",
            answer: "`%timeit` for quick cell timing; `%%prun` for cProfile on a cell; `%lprun -f fn fn(args)` (requires line_profiler) for line-by-line breakdown. For memory: `%memit` (memory_profiler) or `tracemalloc` snapshots before and after. The combination of time + memory profiling gives you a complete picture."
          },
          {
            question: "When does converting to `category` dtype hurt performance?",
            answer: "When cardinality is high (nearly unique values, like UUIDs) — the encoding overhead and the code→value lookup cancel out the memory benefit. Category pays off for low-to-medium cardinality columns (country, status, product category) where the same strings repeat thousands of times."
          }
        ],
        redFlags: [
          {
            junior: "\"I'd switch to PySpark to handle large data.\"",
            senior: "\"PySpark is a distributed system — for 500MB on one machine I'd first profile, eliminate iterrows, downcast types, and try Polars. Spark's overhead is overkill for single-machine data.\""
          },
          {
            junior: "\"I'd add more RAM to the server.\"",
            senior: "\"More RAM buys time but doesn't fix the root cause. I profile first — if iterrows is the bottleneck, vectorization costs nothing and gives a 1000x speedup. If it's memory-bound, dtype optimization can cut footprint by 50–90%.\""
          }
        ],
        alternatePhrasings: [
          "\"How do you optimize memory usage in a large pandas DataFrame?\"",
          "\"Your ETL pipeline takes 20 minutes on 500MB of data — what do you do?\"",
          "\"Walk me through making a pandas pipeline production-efficient.\""
        ],
        interviewContexts: [
          "Mid-level data engineer screen at a data-heavy analytics company",
          "pandas optimization deep-dive at a Series C startup",
          "ETL performance discussion at a retail data engineering team"
        ]
      },
      {
        category: "decision-frameworks",
        riskLevel: "medium",
        asked: 16,
        questionText:
          "How do you decide between threading and asyncio for a Python I/O-bound data ingestion task?",
        answerStructured:
          "- **asyncio**: best when the libraries you're calling support `async/await` (aiohttp, aiobotocore, asyncpg). Single thread, event loop, cooperative multitasking — no thread-switching overhead. Handles hundreds–thousands of concurrent I/O operations efficiently.\n- **threading** (`ThreadPoolExecutor`): best when the libraries are sync-only (requests, boto3, psycopg2). Threads work around blocking calls. Practical upper bound: tens to low-hundreds of threads before OS overhead matters.\n- **Decision trigger**: does your HTTP/DB library have an async version? Yes → asyncio. No → threading with a pool.\n- **Mixing**: use `asyncio.get_event_loop().run_in_executor(ThreadPoolExecutor)` to call sync blocking code from an async context without blocking the event loop.\n- **Don't use threading for CPU work** — GIL throttles it. Use multiprocessing there.\n- **Practical throughput**: asyncio handles more concurrent I/O per CPU core than threads because there's no context-switch cost; threads have lower code complexity because you don't need async/await everywhere.",
        explanationDeep:
          "The async vs thread decision comes down to library support and scale. If you're using `requests` (sync), you're blocked — threads let you overlap the waits. If you're using `aiohttp`, asyncio is better: the event loop manages thousands of concurrent connections as a state machine without OS threads, with dramatically lower overhead per concurrent operation.\n\nIn practice for data engineering, many cloud SDKs (boto3, google-cloud-*) are sync. `ThreadPoolExecutor(max_workers=20)` with `concurrent.futures.as_completed()` is a practical pattern: 20 threads making S3/GCS/SFTP calls in parallel, bounded by the pool, with clean result collection. For REST APIs with 1000+ concurrent calls, asyncio + aiohttp is the right architecture.\n\nThe mixing pattern is important for modern pipelines: an asyncio-based ingestion loop that needs to call a legacy sync library can use `loop.run_in_executor(None, blocking_fn, args)` — this dispatches the blocking call to a thread pool, returns a coroutine that resolves when the thread finishes, and doesn't block the event loop.",
        interviewerLens:
          "I want the library-support axis named as the decision criterion, not a vague 'asyncio is modern.' Candidates who know `run_in_executor` for mixing sync and async code have clearly written production async pipelines. The thread-upper-bound (hundreds) vs asyncio (thousands) claim is worth knowing to size the solution.",
        followupChain: [
          {
            question: "What is backpressure and how do you implement it with asyncio?",
            answer: "Backpressure limits the number of concurrent tasks to prevent overwhelming downstream systems. With asyncio, use `asyncio.Semaphore(n)` as an async context manager: `async with semaphore: await fetch(url)`. This ensures at most n concurrent fetches regardless of how many tasks are created."
          }
        ],
        redFlags: [
          {
            junior: "\"I'd just use asyncio — it's the modern way.\"",
            senior: "\"I check if the libraries I need have async versions. If boto3 is the library, I'd use ThreadPoolExecutor. If I can use aiobotocore, asyncio is better for high concurrency.\""
          }
        ],
        alternatePhrasings: [
          "\"How do you fetch 1000 API endpoints concurrently in Python?\"",
          "\"When would threading be better than asyncio for a data ingestion pipeline?\"",
          "\"What is the event loop in asyncio?\""
        ],
        interviewContexts: [
          "Mid-level data engineer screen at a cloud-native data company",
          "Python concurrency question at a streaming data engineering team"
        ]
      },
      // ── tool-comparison ───────────────────────────────────────
      {
        category: "tool-comparison",
        riskLevel: "high",
        isComparison: true,
        comparisonTools: ["threading", "multiprocessing", "asyncio"],
        asked: 23,
        questionText:
          "threading vs multiprocessing vs asyncio — give me a concrete scenario for each and explain why the other two would be wrong.",
        answerStructured:
          "- **threading** — scenario: **parallel uploads of 50 CSV files to S3 using boto3 (sync library)**. Why threading: the uploads are I/O-bound (network waits); the GIL is released during I/O; a `ThreadPoolExecutor(20)` overlaps the waits with no code restructuring. Why not asyncio: boto3 is sync — asyncio can't natively await sync blocking calls. Why not multiprocessing: uploading is I/O-bound, not CPU-bound — process overhead is wasted.\n- **multiprocessing** — scenario: **applying a complex feature-engineering transform (hashing, encoding, rolling stats) to 10 partitions of a 10GB DataFrame**. Why multiprocessing: the transform is CPU-bound; the GIL would serialize threads; separate processes run on separate cores. Why not threading: GIL throttles CPU work. Why not asyncio: it's single-threaded, CPU work blocks the event loop.\n- **asyncio** — scenario: **concurrently calling 500 REST API endpoints using aiohttp**. Why asyncio: I/O-bound, async library available, thousands of concurrent coroutines with near-zero overhead. Why not threading: 500 threads would consume significant memory and OS context-switch overhead. Why not multiprocessing: I/O-bound work doesn't need CPU parallelism.",
        explanationDeep:
          "The three-scenario test is the definitive way to evaluate whether someone truly understands the distinctions. Each choice is wrong for the other two use cases — that's the clean signal.\n\nA common real-world combination: an ingestion pipeline that uses asyncio (with aiohttp) to fetch 500 API responses concurrently, then dispatches the fetched data to a `ProcessPoolExecutor` for CPU-bound parsing/transformation, then writes the results to S3 via `ThreadPoolExecutor` (because boto3 is sync). Each phase uses the right model for its workload type.\n\nThe memory consideration for multiprocessing: each process is forked (Unix) or spawned (Windows/macOS), and large DataFrames must be serialized (pickled) to cross process boundaries. For very large objects, this serialization cost can negate the parallelism benefit. `multiprocessing.shared_memory` (Python 3.8+) and Apache Arrow's shared memory design allow zero-copy sharing between processes, which is the state-of-the-art for heavy data parallelism in Python.",
        interviewerLens:
          "The three concrete scenarios are the test — abstract answers about 'I/O vs CPU' without examples tell me you've memorized the rule, not applied it. I'm listening for 'boto3 is sync so I can't use asyncio without a wrapper' and 'multiprocessing for CPU because the GIL serializes threads.' The combined pipeline scenario (async fetch + process transform + thread upload) is the senior answer.",
        followupChain: [
          {
            question: "How do you share a large NumPy array between multiprocessing workers without pickling?",
            answer: "Use `multiprocessing.shared_memory.SharedMemory` (Python 3.8+) to allocate a shared memory block and reconstruct a NumPy array from it in each worker. Alternatively, `numpy.memmap` on a file-backed memory map that workers can open read-only. Both approaches avoid serialization overhead — the workers share the same physical memory."
          }
        ],
        redFlags: [
          {
            junior: "\"I'd just use multiprocessing for all parallel tasks.\"",
            senior: "\"Multiprocessing has process-startup and pickling overhead — for I/O-bound tasks, threading or asyncio are lighter and usually faster. I match the model to the bottleneck type.\""
          }
        ],
        alternatePhrasings: [
          "\"Explain the three concurrency models in Python and when each applies.\"",
          "\"Why doesn't threading speed up a CPU-bound pandas transform?\"",
          "\"When would you use asyncio vs ThreadPoolExecutor for fetching API data?\""
        ],
        interviewContexts: [
          "Mid-level Python concurrency screen at a data platform startup",
          "Asked at every Python-heavy data engineering loop since 2023",
          "Python design question at a real-time data ingestion company"
        ]
      }
    ],
    topics: {
      moreDeepDives: [
        "Explain Python's memory model: reference counting, garbage collection, and `__del__`.",
        "How do you use `functools.lru_cache` and `functools.cache` for memoization in ETL code?",
        "What are dataclasses and when do they replace regular classes in pipeline code?",
        "Explain the iterator protocol (`__iter__`/`__next__`) and write a custom file chunker.",
        "How does `itertools.groupby` work and what is the sorting prerequisite?",
        "What is a context manager and write one using `__enter__`/`__exit__` for a database connection."
      ],
      decisions: [
        "When do you use `ProcessPoolExecutor` vs `Pool.map()` from the multiprocessing module?",
        "pandas `groupby().apply()` vs `groupby().agg()` — when does each win on performance?",
        "When do you use `asyncio.gather` vs `asyncio.as_completed`?"
      ],
      quickRef: [
        "What does `yield` do vs `return`?",
        "GIL — which operations release it?",
        "threading vs multiprocessing — one-line decision rule?",
        "iterrows() — why is it slow?",
        "pandas `category` dtype — what does it save?",
        "shallow vs deep copy — one-line distinction?",
        "What does `copy.deepcopy()` do for a nested dict?",
        "What is `asyncio.Semaphore` used for?",
        "What does `concurrent.futures.as_completed()` return?",
        "What does `df.copy()` default to — deep or shallow?"
      ],
      redFlags: [
        {
          junior: "\"Threading speeds up my pandas transforms.\"",
          senior: "\"The GIL serializes CPU-bound threads — for pandas transforms I'd use multiprocessing or switch to Polars which is multithreaded natively.\""
        },
        {
          junior: "\"I use iterrows() to apply transforms row by row.\"",
          senior: "\"iterrows() creates a Series per row — it's one of the slowest pandas patterns. I replace it with vectorized column operations or apply() at worst.\""
        },
        {
          junior: "\"df2 = df makes a copy.\"",
          senior: "\"That's an alias — same object in memory. I use df.copy() or df[condition].copy() to get an independent DataFrame.\""
        },
        {
          junior: "\"asyncio is always better than threading for I/O.\"",
          senior: "\"Only when the library supports async. If I'm using boto3 (sync), threading with a pool is the practical choice without a library change.\""
        }
      ],
      checklist: [
        "GIL: CPU-bound → multiprocessing, I/O-bound → threading or asyncio",
        "Generator: yields one item at a time, O(1) memory, single-pass, `yield from` for composition",
        "pandas vectorization hierarchy: NumPy built-ins > vectorized ops > apply > iterrows",
        "Shallow copy shares nested references; deep copy is fully independent; `df[cond].copy()` in pandas",
        "Profile before optimizing: `line_profiler`, `cProfile`, `tracemalloc`"
      ],
      behavioral: [
        "Tell me about a time your pandas pipeline was too slow — how did you diagnose and fix it?",
        "Describe a Python concurrency mistake you made and what you learned.",
        "A time you used generators to handle data that wouldn't fit in memory."
      ],
      reverse: [
        "What concurrency model do your Python pipelines use — threads, async, or multiprocessing?",
        "Are you on pandas, Polars, or both? Is there appetite to migrate?",
        "Do you use memory profiling in CI or only reactively in production?"
      ]
    }
  },

  // ─────────────────────────────────────────────────────────────
  // SENIOR — processing data larger than RAM (chunking, DuckDB),
  //          parallelism choices at scale, memory profiling,
  //          when to leave Python
  // ─────────────────────────────────────────────────────────────
  senior: {
    authored: [
      // ── deep-dives ────────────────────────────────────────────
      {
        category: "deep-dives",
        riskLevel: "high",
        freePreview: true,
        asked: 29,
        questionText:
          "You need to aggregate a 200GB Parquet dataset on a single machine. Walk me through your architecture and tool choice.",
        code: [
          {
            lang: "python",
            label: "DuckDB on Parquet",
            lines: [
              "import duckdb",
              "duckdb.sql('''",
              "  SELECT region, sum(amt)",
              "  FROM read_parquet('s3://b/*.pq')",
              "  GROUP BY region''').df()",
              "# parallel scan, spills to disk",
            ],
          },
        ],
        answerStructured:
          "- **First question**: does this need to be Python, or can I use the right tool? For a SQL-shaped aggregate on Parquet, **DuckDB** is the senior first move: it reads Parquet natively, executes vectorized parallel queries, spills to disk automatically, and finishes a 200GB aggregation in minutes on a modern laptop.\n- `duckdb.sql(\"SELECT key, SUM(value) FROM read_parquet('data/*.parquet') GROUP BY key\")` — zero Python loop, parallelized by DuckDB's engine, memory-safe.\n- If DuckDB is off the table: **chunked pandas** with `pd.read_parquet(path, filters=[...])` (PyArrow predicate pushdown to skip partitions), accumulate running aggregates in a dict, never load the full 200GB.\n- If the aggregation requires complex Python logic DuckDB can't express: **Polars lazy API** — `pl.scan_parquet('data/*.parquet').filter(...).group_by(...).agg(...)`, which builds a lazy query plan, optimizes it, executes in parallel threads, and streams chunks to stay within memory bounds.\n- **Never**: `pd.read_parquet('all_200gb.parquet')` followed by groupby — that materializes 200GB into RAM and OOMs.\n- Monitor memory with `tracemalloc` or `memray` during development to catch unexpected materializations.",
        explanationDeep:
          "The senior answer to 'process 200GB in Python' is to immediately question whether Python needs to be in the hot path. DuckDB is an in-process OLAP SQL engine that reads Parquet directly, uses a vectorized columnar engine (like BigQuery under the hood), executes on all cores, and automatically spills intermediate data to disk when it exceeds memory. It finishes what would take pandas hours in minutes, with a one-liner SQL query. Knowing to reach for DuckDB rather than writing a chunked loop is the tool-selection judgment that separates seniors.\n\nWhen DuckDB can't express the logic (complex Python UDFs, ML inference per record), Polars' lazy/streaming API is the next choice. `pl.scan_parquet()` returns a `LazyFrame` — no data is read yet. Each transformation adds to a logical plan. When `.collect(streaming=True)` is called, Polars executes the plan in parallel threads, processing data in chunks that fit in memory. It's significantly faster than pandas and handles larger-than-RAM datasets for many workloads.\n\nChunked pandas is the fallback for maximum compatibility: `pd.read_csv(chunksize=N)` or `pd.read_parquet()` with predicate filters. The key is accumulating only the aggregate state (a dict of key→running sum/count), not intermediate rows. The memory footprint is O(distinct keys), not O(input rows).\n\nMemory profiling should be a development habit, not just a production debugging tool. `memray` (Bloomberg's memory profiler, open-sourced 2022) gives a flame graph of Python allocations — invaluable for catching unexpected materialization (e.g., a `list()` call on a generator inside a library function).",
        interviewerLens:
          "DuckDB as the opening answer is the senior tell. Candidates who immediately say 'chunked pandas with chunksize' are correct but mid-level — they know the workaround but haven't internalized that DuckDB eliminates the need for the workaround entirely. If you say 'I'd use Polars lazy API' that's also senior — but DuckDB for a SQL-shaped aggregate on Parquet is cleaner. The memory-profiling discipline (tracemalloc/memray during development) separates engineers who have owned production OOM incidents from those who haven't.",
        followupChain: [
          {
            question: "How does DuckDB handle data that exceeds RAM?",
            answer: "DuckDB uses a buffer manager that spills intermediates (hash tables for joins/aggregations, sort buffers) to a temp file on disk when they exceed the configured memory limit (`SET memory_limit='8GB'`). It uses compressed spill files and re-reads them in chunks, so you trade speed for memory safety. It's transparent — the query still runs, just slower when spilling."
          },
          {
            question: "When does Polars streaming mode fail?",
            answer: "Polars' streaming engine (`.collect(streaming=True)`) doesn't support all operations — complex joins, certain window functions, and some custom expressions fall back to non-streaming (in-memory) execution with a warning. Check the output for 'does not support streaming' messages and handle those operations separately or restructure the query."
          },
          {
            question: "How would you handle a 200GB file where the aggregation key has 100 million distinct values — more than fit in a Python dict?",
            answer: "DuckDB handles this naturally via its spilling hash aggregation. In chunked pandas, 100M keys would be a problem — the accumulator dict itself would consume tens of GB. The right answer is DuckDB or a proper distributed system (Spark). A sort-and-merge approach (external sort the file by key, then linear-scan summing per key) works in bounded memory but is complex to implement correctly."
          }
        ],
        redFlags: [
          {
            junior: "\"I'd use pd.read_parquet() and then groupby.\"",
            senior: "\"That tries to load 200GB into memory and OOMs. I'd use DuckDB's SQL on the Parquet files directly — it reads in parallel, spills to disk, and finishes in minutes.\""
          },
          {
            junior: "\"I'd spin up a Spark cluster.\"",
            senior: "\"Spark is a distributed system — the setup overhead is not justified for a single-machine 200GB problem. DuckDB or Polars lazy API handles this on one machine with no cluster.\""
          }
        ],
        alternatePhrasings: [
          "\"Process a file larger than RAM in Python — walk me through your options.\"",
          "\"How would you aggregate 200GB of Parquet files on a single server?\"",
          "\"What's the limit of pandas and what do you reach for next?\""
        ],
        interviewContexts: [
          "Senior data engineer at a data-intensive analytics company",
          "Staff engineer Python design round at a Series D fintech",
          "Python + data processing deep-dive at a cloud platform company"
        ]
      },
      {
        category: "deep-dives",
        riskLevel: "high",
        asked: 24,
        questionText:
          "How do you memory-profile a Python data pipeline and what are the common causes of memory leaks in long-running pipelines?",
        code: [
          {
            lang: "python",
            label: "find the leaking line",
            lines: [
              "import tracemalloc",
              "tracemalloc.start()",
              "s1 = tracemalloc.take_snapshot()",
              "run_pipeline()",
              "s2 = tracemalloc.take_snapshot()",
              "for d in s2.compare_to(s1, 'lineno'):",
              "    print(d)  # top growth first",
            ],
          },
        ],
        answerStructured:
          "- **Tools**: `tracemalloc` (stdlib, no install needed — take snapshots, compare to find allocations by file/line); `memray` (Bloomberg open-source, flame-graph visualization of allocations); `memory_profiler` (`@profile` decorator, line-by-line memory in MB).\n- **Workflow**: snapshot before, run the suspect code, snapshot after, `tracemalloc.compare_to()` — sort by size difference to find the allocating lines.\n- **Common memory leak causes in pipelines**:\n  1. **Accumulator lists/dicts that grow unboundedly** — a list appended per record and never flushed.\n  2. **Generator exhaustion without cleanup** — keeping a reference to an exhausted generator's frame.\n  3. **pandas reference cycles** — holding references to intermediate DataFrames in closures or class attributes after they're no longer needed; Python's reference-count GC can't break cycles without the cyclic collector running.\n  4. **Logging handler buffers** — log handlers that batch in memory without flushing.\n  5. **Matplotlib / plot figure accumulation** — forgetting `plt.close('all')` in a loop creates zombie figures.\n  6. **Global caches that grow without eviction** — `lru_cache` with `maxsize=None` or a custom cache with no TTL.",
        explanationDeep:
          "Python's primary memory management is reference counting: when an object's reference count drops to zero, it's immediately freed. The cyclic garbage collector handles reference cycles (objects that reference each other, keeping both counts non-zero). For well-written code, this is transparent. Memory leaks in Python almost always come from inadvertently holding references — not true leaks in the C/malloc sense.\n\nThe most common data pipeline pattern is an accumulator: `results = []; for chunk in stream: results.extend(process(chunk)); final = aggregate(results)`. If the pipeline runs continuously (or the stream is very long), `results` grows without bound. Fix: either flush and write incrementally, or aggregate in-place (running totals in a dict) rather than accumulating all rows.\n\n`tracemalloc` is the pragmatic first tool: no installation, available in the stdlib since Python 3.4. The pattern: `tracemalloc.start(); run_pipeline(); snapshot = tracemalloc.take_snapshot(); stats = snapshot.statistics('lineno'); print(stats[:10])`. The top lines are your biggest allocators. Compare two snapshots to find what's growing.\n\n`memray` provides a richer view — it records every allocation and deallocation with a call stack, allowing a flame graph that shows which call paths are responsible for peak memory. It's the tool of choice when `tracemalloc` identifies the line but not why it's being called.",
        interviewerLens:
          "I'm listening for `tracemalloc` named as the stdlib tool (no install) and at least two concrete memory leak patterns from real pipelines. Candidates who say 'I'd use the `memory_profiler` decorator' know one tool; candidates who know `tracemalloc` + `memray` and can name the accumulator-list and cache-growth patterns have debugged production memory issues. The reference-counting vs cyclic GC distinction is a bonus that shows language depth.",
        followupChain: [
          {
            question: "How does Python's cyclic garbage collector work and when does it fail to collect?",
            answer: "The cyclic GC runs periodically and identifies groups of objects that reference each other in a cycle but are not reachable from any root. It breaks the cycle and frees them. It fails when objects have `__del__` methods — finalizable objects in a reference cycle were not collected (Python < 3.4) or are collected but the order of `__del__` calls is undefined, so the GC marks them as uncollectable. In Python 3.4+, PEP 442 allows `__del__` objects in cycles to be collected, but it's still risky to rely on."
          },
          {
            question: "How would you detect a memory leak in a long-running Airflow task?",
            answer: "Add `tracemalloc` snapshots at task start and end (or at regular intervals for long tasks). Log the top growing allocations. In production, monitor the process RSS (resident set size) via Prometheus metrics or CloudWatch. If RSS grows monotonically per task run without leveling off, there's a leak — compare snapshots from task run 1 vs run 10 to find the growing allocation."
          }
        ],
        redFlags: [
          {
            junior: "\"Python doesn't have memory leaks because it has garbage collection.\"",
            senior: "\"Python's GC handles reference cycles, but if you hold a reference to a growing list or a cache without eviction, memory grows — it's a leak even though GC is running. tracemalloc identifies the allocating lines.\""
          },
          {
            junior: "\"I'd restart the process to fix a memory issue.\"",
            senior: "\"Restarting treats the symptom. I'd profile with tracemalloc to find what's allocating — usually an accumulator that should be flushed, a cache that needs a max size, or a reference kept alive in a closure.\""
          }
        ],
        alternatePhrasings: [
          "\"Your Airflow task's memory grows with each run — how do you debug it?\"",
          "\"What tools do you use to profile Python memory usage?\"",
          "\"Explain how Python's garbage collector works.\""
        ],
        interviewContexts: [
          "Senior Python data engineer at a platform company with long-running pipelines",
          "Staff engineer memory optimization discussion at a Series D analytics firm",
          "Asked at an ML platform engineering senior loop"
        ]
      },
      {
        category: "deep-dives",
        riskLevel: "high",
        asked: 20,
        questionText:
          "When would you leave Python entirely for a data task, and how do you frame that decision to a team?",
        answerStructured:
          "- **Signs Python is the bottleneck**: CPU-bound code that's already parallelized with multiprocessing and still too slow; memory consumption that requires more RAM than the machine has even with chunking + DuckDB/Polars; latency requirements (sub-millisecond) that Python's interpreter overhead can't meet.\n- **Alternatives and when they apply**:\n  - **DuckDB / SQL engine**: for analytical aggregations, joins, and filtering — often eliminates the need for Python entirely in the hot path.\n  - **Rust** (via PyO3/maturin): for custom hot-loop code that needs C-level speed with memory safety — write the bottleneck function in Rust, call it from Python. Arrow/DataFusion are Rust-based and already do this.\n  - **Go**: for high-throughput, low-latency services (API servers, streaming processors) where Python's async/GIL story doesn't scale to the concurrency requirement.\n  - **JVM (Spark, Flink, Trino)**: for multi-machine distributed compute — when the data truly doesn't fit on one machine and SQL or streaming logic is the job.\n- **Framing to the team**: 'Python is the right glue and orchestration layer. For this specific aggregation/transform, DuckDB executes it 50x faster without changing the pipeline architecture. We call it from Python — we don't lose Python, we use the right engine for the hot path.'\n- **Don't leave Python for orchestration, config, and glue** — Python excels there and the cost of switching is high relative to the gain.",
        explanationDeep:
          "The wrong frame is 'Python is slow, let's rewrite in Go.' The right frame is 'identify the bottleneck, pick the right tool for that specific hot path, and keep everything else in Python.' Most data pipelines spend 90% of wall-clock time in I/O (network, disk) or in library calls (DuckDB, NumPy, pandas C extensions) — Python is not the bottleneck there. The 10% that is Python-level CPU can often be addressed by Numba, Cython, or a targeted Rust extension before a full rewrite.\n\nWhen the answer truly is 'leave Python': real-time streaming with microsecond SLAs (Kafka Streams in Java/Scala, Flink), multi-terabyte distributed computation (Spark on a cluster — though PySpark keeps Python as the API layer), or performance-critical microservices where GC pauses matter (Rust, Go).\n\nThe key cultural point: Python's ecosystem (pandas, NumPy, scikit-learn, PyTorch, dbt adapters, Airflow, Prefect) has a flywheel effect — there are more libraries, more documentation, more engineers who know it than any data alternative. The cost of rewriting a pipeline in Rust is not just the implementation — it's the loss of the ecosystem and the team's ability to maintain it. That cost must be weighed against the performance gain.",
        interviewerLens:
          "I'm hiring a senior who knows when Python is the right tool and when it isn't — not someone who defaults to Python for everything or someone who always reaches for the 'faster' language. The DuckDB insight ('use it from Python, don't leave Python') is the pragmatic answer. Framing the Rust/Go decision as 'only for the hot path, after profiling proves it' shows judgment. If you say 'rewrite everything in Rust' without profiling data, I know you're optimizing hypothetically.",
        followupChain: [
          {
            question: "How would you introduce a Rust extension to a Python data pipeline without disrupting the team?",
            answer: "Use maturin + PyO3 to build a Python wheel from Rust code — the team calls it like a regular Python import. Start with a single bottleneck function that has a clean interface (takes arrays, returns arrays). Keep the Rust code in the repo with CI that builds the wheel. The rest of the pipeline stays Python; only the hot function changes internally."
          },
          {
            question: "PySpark keeps Python as the API but runs on the JVM — how does that work?",
            answer: "PySpark uses Py4J to communicate between the Python driver process and the JVM. The actual data processing happens in JVM processes on the cluster. Python UDFs (not using pandas_udf) cross the Py4J bridge per row and are slow. Pandas UDFs (Arrow-based) batch data across the bridge as Arrow buffers — much faster. The pattern: keep business logic in SQL/DataFrame API (JVM-optimized); only use pandas UDFs when truly necessary."
          }
        ],
        redFlags: [
          {
            junior: "\"Python is always fast enough with the right libraries.\"",
            senior: "\"Python's C extensions (NumPy, DuckDB) are fast, but Python-level code in a tight loop has real overhead. I profile to find the bottleneck and consider Numba, Rust extensions, or a purpose-built engine before deciding Python can't do it.\""
          },
          {
            junior: "\"We should rewrite the pipeline in Go — Python is too slow.\"",
            senior: "\"I'd profile first. In my experience, 90% of pipeline time is in I/O or C-extension calls — not Python. The 10% that is Python can often be fixed with Numba or DuckDB. A full rewrite has a high maintenance cost that needs to be justified by profiling data, not intuition.\""
          }
        ],
        alternatePhrasings: [
          "\"How do you know when Python is the wrong tool for a data task?\"",
          "\"A stakeholder says your Python pipeline is too slow — walk me through your escalation path.\"",
          "\"Have you ever replaced Python with another language in a data pipeline? When and why?\""
        ],
        interviewContexts: [
          "Senior staff data engineer at a platform company deciding on language strategy",
          "Principal engineer architecture review at a high-scale data company",
          "Asked at a Python-vs-Rust trade-off discussion at a Series D data infrastructure team"
        ]
      },
      {
        category: "deep-dives",
        riskLevel: "medium",
        asked: 17,
        questionText:
          "How does Python's parallelism story work for a pipeline that ingests data (I/O), transforms it (CPU), and writes results (I/O)? Design the concurrency architecture.",
        answerStructured:
          "- **Stage 1 — Ingestion (I/O-bound)**: use asyncio (if the source SDK is async) or a `ThreadPoolExecutor` (if sync). Fetch many sources concurrently. Bound concurrency with `asyncio.Semaphore` or pool size to avoid overwhelming the source.\n- **Stage 2 — Transform (CPU-bound)**: submit batches to a `ProcessPoolExecutor`. Each worker process gets a chunk of data, runs the transform, returns the result. Workers bypass the GIL. Use `executor.map()` or `as_completed()` for non-blocking submission.\n- **Stage 3 — Write (I/O-bound)**: back to async or threads. Write results to the destination concurrently.\n- **Connecting stages**: use a `queue.Queue` (thread-safe) or `asyncio.Queue` to buffer between stages, decoupling producer and consumer rates (backpressure).\n- **Sizing**: pool sizes — threads for I/O can be 10–50 per core (blocked most of the time); processes for CPU should be `min(cores, data_partitions)` (typically 4–16); queue depth controls backpressure.\n- **Practical alternative**: for many pipelines, Polars lazy API + DuckDB replaces stages 2 and 3 without a custom concurrency architecture — prefer tools over DIY parallelism.",
        explanationDeep:
          "The producer-consumer-with-queue architecture is a classic concurrent pipeline pattern. The queue decouples producer rate from consumer rate: if the fetcher is faster than the transformer, the queue absorbs the burst; if the transformer is faster, workers drain the queue and can idle. The queue depth is the backpressure lever — a bounded queue (`Queue(maxsize=N)`) blocks the producer when the consumer is full, preventing runaway memory growth.\n\nIn Python, `queue.Queue` is thread-safe (GIL provides the necessary atomicity). For asyncio, `asyncio.Queue` serves the same purpose for coroutines. The two don't mix cleanly — bridging async and thread queues requires `loop.run_in_executor` or `asyncio.wrap_future`.\n\nThe practical shortcut for most pipelines: this architecture is complex to implement and debug. If Polars or DuckDB can handle the transform stage, use them — they implement parallelism internally using Rust/C++ threads with no GIL concerns, with a far simpler API than a hand-rolled multi-stage concurrent pipeline. The custom architecture is justified only when the transform requires complex Python logic that tools can't express.",
        interviewerLens:
          "I want the three-stage model named (I/O → CPU → I/O), with the concurrency mechanism for each stage (threading/async for I/O, multiprocessing for CPU), and the queue as the decoupling mechanism. The 'use Polars/DuckDB instead' shortcut is the senior pragmatism signal — knowing when not to build the complex architecture is as important as knowing how to.",
        followupChain: [
          {
            question: "How do you handle exceptions in a multi-stage concurrent pipeline?",
            answer: "Each stage should catch exceptions locally, log them with context, and either emit a sentinel (e.g., push an error object to the queue) or increment an error counter and skip. With `concurrent.futures`, exceptions in workers are captured in the `Future` and re-raised when you call `.result()` — wrap that in a try/except. For asyncio, use `asyncio.gather(return_exceptions=True)` to collect all exceptions without stopping the other coroutines."
          }
        ],
        redFlags: [
          {
            junior: "\"I'd put everything in threads and have them call each other.\"",
            senior: "\"I'd separate the I/O stages (threads/async) from the CPU stage (processes), connect them with a bounded queue for backpressure, and size each pool to the bottleneck. And I'd first check whether Polars or DuckDB can replace the CPU stage entirely.\""
          }
        ],
        alternatePhrasings: [
          "\"Design a concurrent Python pipeline for fetch → transform → load.\"",
          "\"How do you prevent memory from growing unboundedly in a concurrent pipeline?\"",
          "\"What is backpressure and how do you implement it in Python?\""
        ],
        interviewContexts: [
          "Senior data engineer system design round at a real-time data platform",
          "Python architecture discussion at a staff engineer interview"
        ]
      },
      // ── decision-frameworks ───────────────────────────────────
      {
        category: "decision-frameworks",
        riskLevel: "high",
        asked: 22,
        questionText:
          "How do you decide between pandas, Polars, and DuckDB for a new data transformation task?",
        answerStructured:
          "- **pandas**: reach for it when data fits comfortably in RAM (< ~2GB, ~50GB with optimization), the team knows it, and you need the broadest library ecosystem compatibility (sklearn, matplotlib, statsmodels).\n- **Polars**: reach for it when pandas is too slow or too memory-hungry on single-machine data. Polars is Rust-based, multithreaded by default (no GIL), uses Apache Arrow for zero-copy I/O, and its lazy API supports streaming beyond RAM. Typically 5–20x faster than pandas on multi-core machines. API is similar to pandas but not identical.\n- **DuckDB**: reach for it when the task is SQL-shaped (aggregations, joins, window functions, GROUP BY). DuckDB reads Parquet/CSV/JSON directly, executes in parallel with a cost-based optimizer, spills to disk for larger-than-RAM workloads, and runs embedded in-process. For analytics-heavy transforms, DuckDB is often the fastest single-machine option.\n- **Decision flow**: is it SQL-shaped? → DuckDB. Is it DataFrame-shaped and the data is large / performance matters? → Polars. Is it DataFrame-shaped, small, and needs ecosystem compatibility? → pandas.\n- **Combine**: DuckDB for aggregations → Polars for post-processing → pandas or Arrow for handoff to ML libraries.",
        explanationDeep:
          "The wrong answer is 'pandas is what I know, so I use pandas.' The right answer positions the three tools as complementary, each optimized for a niche.\n\nDuckDB's killer feature for data engineering: it can `SELECT * FROM read_parquet('s3://bucket/path/*.parquet')` — reading directly from object storage Parquet files in parallel with predicate pushdown, without any ETL step to load data first. For a job that is 'run this complex SQL query on these Parquet files,' DuckDB is frequently 10–50x faster than pandas groupby because it uses a vectorized columnar engine with a cost-based optimizer.\n\nPolars' killer feature: the lazy API with streaming. `pl.scan_parquet().filter().group_by().agg().collect(streaming=True)` builds a logical plan, optimizes it (predicate/projection pushdown), and executes it in parallel Rust threads, streaming chunks to stay memory-safe. The Rust execution means no GIL — all cores are used. On a 32-core machine, Polars routinely outperforms pandas by an order of magnitude on large joins and groupbys.\n\nThe benchmark reality (2024–2025): on a 10M-row analytical task, DuckDB and Polars are typically 5–20x faster than pandas. On 100M rows where pandas OOMs, both Polars (streaming) and DuckDB (spilling) finish where pandas can't. Knowing these bounds — when pandas is fine, when Polars pays, when DuckDB is the right choice — is the senior judgment call.",
        interviewerLens:
          "I'm testing whether you've actually used all three or just heard of them. 'Polars is fast and Rust-based' is a marketing answer. 'I'd use DuckDB because the task is a GROUP BY on Parquet files and its columnar engine will be 20x faster than pandas with no extra infrastructure' is a tool-selection judgment. The combination answer (DuckDB → Polars → pandas handoff) is the senior architecture pattern.",
        followupChain: [
          {
            question: "How does Polars' lazy API avoid loading the full dataset into memory?",
            answer: "Polars' lazy API builds a logical query plan from the operations you chain. When `.collect(streaming=True)` is called, Polars' query optimizer applies predicate and projection pushdown (reads only needed columns/rows from Parquet), then executes the plan in parallel threads, processing data in bounded-size chunks and streaming results. Only the output (and any required sort/join buffers) lives in memory — not the full input."
          },
          {
            question: "Can DuckDB and Polars interoperate without data copying?",
            answer: "Yes — via Apache Arrow. Both DuckDB and Polars use Arrow as their in-memory format. You can pass a Polars DataFrame to DuckDB: `duckdb.arrow(polars_df.to_arrow())` — DuckDB gets a zero-copy view of the Polars memory. This is the practical integration pattern: Polars for DataFrame-style transforms, DuckDB for SQL analytics, Arrow as the zero-copy interchange."
          }
        ],
        redFlags: [
          {
            junior: "\"I always use pandas — it's what everyone knows.\"",
            senior: "\"For SQL-shaped tasks on Parquet, DuckDB is the right choice — typically 10–50x faster. For DataFrame-shaped tasks at scale, Polars' lazy API handles larger-than-RAM with multithreading. I use pandas when the data is small and ecosystem compatibility matters.\""
          },
          {
            junior: "\"DuckDB is just a database — I'd use it for storage, not transforms.\"",
            senior: "\"DuckDB is an analytical query engine embedded in-process — it's meant for transforms, not storage. I'd run a `SELECT ... FROM read_parquet(...)` and get the result as an Arrow table back in Python.\""
          }
        ],
        alternatePhrasings: [
          "\"pandas vs Polars — when would you switch?\"",
          "\"What is DuckDB and why would a data engineer use it instead of pandas?\"",
          "\"How does Polars handle datasets larger than RAM?\""
        ],
        interviewContexts: [
          "Senior data engineer tool selection discussion at a cloud analytics company",
          "Asked at a Python-heavy data platform interview in 2024–2025",
          "Staff engineer Python ecosystem question at a Series D data startup"
        ]
      },
      {
        category: "decision-frameworks",
        riskLevel: "medium",
        asked: 15,
        questionText:
          "How do you design a Python ETL pipeline that is testable, idempotent, and memory-safe at scale?",
        answerStructured:
          "- **Testability**: pure functions that take data in and return data out — no global state, no side effects inside transforms. Inject dependencies (database connections, file handles) rather than importing them. Use `pytest` with `unittest.mock` to mock I/O; test the transform logic with in-memory fixtures.\n- **Idempotency**: every write operation must be safe to re-run. Use MERGE/upsert semantics (not append) at the destination, or write to a deterministic partition path (e.g., `output/date=2024-01-15/`) that is overwritten on re-run. Avoid `INSERT`-only writers without a dedup step.\n- **Memory safety**: use generators for data streams; never accumulate all records in a list before writing. Process in chunks: read a chunk, transform in-place using vectorized ops, write immediately, release the reference. Use `del df; gc.collect()` after writing large intermediates when the GC might not run promptly.\n- **Observability**: emit row counts and byte counts at each stage (log or metrics). A count that drops by 20% unexpectedly is a bug — catching it in the pipeline is better than a downstream data quality alert.\n- **Error handling**: use dead-letter queues or error files for bad records rather than failing the whole run. Log the failing record with context (not just the exception).",
        explanationDeep:
          "The three properties work together. Testability requires pure functions — if a transform function only depends on its input, you can test it with synthetic data without an S3 bucket or a database. That same purity enables idempotency testing: run the function twice with the same input, assert the output is identical and the destination isn't doubled. Memory safety requires generators and chunking — which also makes idempotency easier because you're writing partitioned outputs rather than a single large file.\n\nThe most common violation of these properties in production pipelines: a class with `self.records = []` that accumulates in a for loop, with a final `self.flush()` call — this fails all three. It accumulates memory, it's not idempotent (flush() appends), and it's hard to test (you need a full class instance). The fix: replace with a generator that yields chunks, and a writer that calls MERGE on each chunk.\n\nThe observability point is underrated: a pipeline that silently drops records is worse than one that fails noisily. Emit row counts at each stage, alert on unexpected drops. `pipeline_records_in / pipeline_records_out` monitored over time catches schema changes, filter bugs, and upstream data issues before they reach stakeholders.",
        interviewerLens:
          "I want all three properties named and operationalized — not just listed. 'Pure functions for testability' is the insight (not 'use pytest'). 'MERGE not INSERT for idempotency' is the implementation detail. 'Generator chunks, not accumulated lists' is the memory-safety pattern. Candidates who can say 'and I emit row counts at each stage to catch silent drops' have owned production pipelines.",
        followupChain: [
          {
            question: "How do you test a pipeline that reads from S3 and writes to a database?",
            answer: "Abstract I/O behind interfaces (or use dependency injection with functions as parameters). In tests, pass a mock reader that returns in-memory fixture data and a mock writer that asserts on what was written. Test the transform function in isolation with unit tests. Add an integration test that runs against a local file + test database. Never hit production systems in unit tests."
          }
        ],
        redFlags: [
          {
            junior: "\"I'd test the whole pipeline end-to-end in a staging environment.\"",
            senior: "\"E2E tests are slow and brittle. I'd isolate the transform logic into pure functions, unit-test them with fixtures, mock the I/O boundaries, and have a single E2E smoke test that verifies integration — not logic.\""
          }
        ],
        alternatePhrasings: [
          "\"How do you make a Python ETL pipeline production-ready?\"",
          "\"How do you write testable data pipeline code in Python?\"",
          "\"What makes a data pipeline safe to re-run?\""
        ],
        interviewContexts: [
          "Senior data engineer engineering practices round",
          "Staff engineer Python architecture discussion at a data platform team"
        ]
      },
      // ── tool-comparison ───────────────────────────────────────
      {
        category: "tool-comparison",
        riskLevel: "high",
        isComparison: true,
        comparisonTools: ["pandas", "Polars", "DuckDB"],
        asked: 27,
        questionText:
          "pandas vs Polars vs DuckDB — explain the architectural difference, benchmark reality, and which you'd use for a 50GB Parquet aggregation on a single machine.",
        answerStructured:
          "- **pandas**: eager, single-threaded (mostly), NumPy-backed, row-major internals. Great ecosystem, but limited by Python GIL and eager evaluation — tries to load the full dataset into RAM. 50GB would OOM or be very slow.\n- **Polars**: columnar (Apache Arrow), Rust-based, multithreaded (no GIL). Lazy API with a query optimizer. Streaming execution for larger-than-RAM. Typically 5–20x faster than pandas on analytical workloads. For 50GB: use `pl.scan_parquet(...).group_by(...).agg(...).collect(streaming=True)` — reads in parallel threads, streams chunks, constant memory.\n- **DuckDB**: in-process OLAP SQL engine (C++), vectorized columnar execution, cost-based optimizer, parallel scans, automatic disk spilling. Reads Parquet files natively via `read_parquet()`. For 50GB: `duckdb.sql(\"SELECT key, SUM(value) FROM read_parquet('*.parquet') GROUP BY key\")` — parallel, spills if needed, returns Arrow or pandas. Often fastest for SQL-shaped analytics.\n- **For a 50GB aggregation**: DuckDB is the first choice (SQL aggregate, vectorized engine, spilling, minimal code). If the transform needs complex Python logic, Polars streaming. pandas alone would OOM.\n- **Interop**: Arrow is the zero-copy interchange. Polars → Arrow → DuckDB → Arrow → pandas is a no-copy pipeline across all three.\n- **Benchmark reality (2024–2025)**: DuckDB and Polars are neck-and-neck on most benchmarks, both 10–50x faster than pandas at scale. pandas wins only on small data with ecosystem integration needs.",
        explanationDeep:
          "The architectural root of pandas' performance limitations: pandas is built on NumPy's row-major memory layout, which is suboptimal for columnar analytical operations (aggregations, filters on one column). It runs operations in a single thread (the GIL limits even NumPy's internal threading for Python-level operations), and it evaluates eagerly — every operation materializes a result, creating intermediate DataFrames that consume memory.\n\nPolars redesigned from scratch: Apache Arrow's columnar format (column data is contiguous in memory — ideal for SIMD), Rust execution (no GIL, true multithreading), lazy evaluation with a Volcano-model query optimizer (predicate and projection pushdown). On a 4-core machine, Polars routinely processes 4x the data per second of pandas on GROUP BY operations.\n\nDuckDB adds a SQL engine layer: a cost-based optimizer that picks join strategies, builds hash tables in vectorized chunks, and automatically decides when to spill to disk. For complex multi-table joins and aggregations, DuckDB's optimizer outperforms even Polars (which has a simpler optimizer). For simple single-table aggregations, they're similar. DuckDB's advantage for data engineers: you write SQL (familiar), it handles parallelism and memory automatically, and it integrates with Python via a simple API.\n\nThe future convergence: pandas 2.0+ uses Arrow as the backend optionally (ArrowDtype), narrowing the gap with Polars on memory efficiency. DuckDB can exchange Arrow objects zero-copy with both Polars and pandas 2.0. The ecosystem is converging on Arrow as the universal in-process interchange format.",
        interviewerLens:
          "I want the architectural reason pandas is slow (single-threaded, eager, NumPy-backed non-columnar) before the performance numbers. 'Polars is faster because it uses Rust' is the marketing answer; 'Polars uses Apache Arrow's columnar layout with Rust multithreading and a lazy optimizer — that's why it's 10x faster on GROUP BY' is the technical answer. For the 50GB scenario, 'DuckDB with `read_parquet()`' in one sentence is the senior move. Knowing Arrow as the zero-copy interchange between all three is the systems-thinking signal.",
        followupChain: [
          {
            question: "What is Apache Arrow and why does it matter for all three tools?",
            answer: "Apache Arrow is a language-independent, in-memory columnar data format with a defined binary layout. When pandas (ArrowDtype), Polars, DuckDB, and PyArrow all use the same memory layout, they can share data without serialization — zero-copy interchange. A Polars DataFrame passed to DuckDB as `duckdb.arrow(df.to_arrow())` is not copied — DuckDB reads the same physical memory. This eliminates serialization bottlenecks between tools in a multi-tool pipeline."
          },
          {
            question: "When would DuckDB be slower than Polars?",
            answer: "For DataFrame-style operations that don't map cleanly to SQL (complex element-wise transforms, ML feature engineering, custom rolling window logic), Polars' DataFrame API is more expressive and avoids SQL string construction overhead. DuckDB's strength is SQL analytics; for non-SQL transforms, Polars' lazy DataFrame API can be faster and cleaner."
          }
        ],
        redFlags: [
          {
            junior: "\"I'd use pandas with chunking to handle 50GB.\"",
            senior: "\"Chunked pandas for 50GB is possible but slow and complex to implement correctly. DuckDB reads 50GB Parquet files natively in parallel with a one-line SQL query and handles spilling automatically — that's the right tool for this job.\""
          },
          {
            junior: "\"Polars is just a faster pandas.\"",
            senior: "\"Polars is architecturally different: Apache Arrow columnar format, Rust execution without the GIL, lazy evaluation with a query optimizer. 'Faster pandas' understates the difference in design.\""
          }
        ],
        alternatePhrasings: [
          "\"Should I use pandas or Polars for my data pipeline?\"",
          "\"What is DuckDB and how does it compare to a DataFrame library?\"",
          "\"What's wrong with pandas for large data, and what do you use instead?\""
        ],
        interviewContexts: [
          "Senior data engineer tool comparison at a Python-heavy data platform",
          "Staff engineer Python ecosystem discussion at a Series D analytics company",
          "Asked at 4 separate senior Python data engineering interviews in 2024–2025"
        ]
      }
    ],
    topics: {
      moreDeepDives: [
        "Explain Polars' lazy execution model and how the query optimizer applies predicate pushdown.",
        "How does DuckDB's buffer manager handle spilling to disk for larger-than-RAM aggregations?",
        "Design an incremental Python pipeline that processes new Parquet partitions without reprocessing old ones.",
        "How does Python 3.13's free-threaded (no-GIL) build change the threading vs multiprocessing decision?",
        "Explain memray's allocation flame graph and how you use it to diagnose a production memory leak.",
        "When and how would you use PyO3 to write a Rust extension for a Python data pipeline bottleneck?"
      ],
      decisions: [
        "When does DuckDB's spilling make it preferable to Polars streaming for a larger-than-RAM workload?",
        "ProcessPoolExecutor vs Ray for distributing Python CPU-bound transforms — when does Ray pay off?",
        "When does adding Numba JIT to a pandas pipeline make sense vs rewriting in Polars?"
      ],
      quickRef: [
        "DuckDB read_parquet() — one-line syntax to aggregate a directory of Parquet files?",
        "Polars lazy scan — how do you trigger execution and enable streaming mode?",
        "tracemalloc snapshot comparison — what three lines do you always write?",
        "pandas category dtype — what cardinality threshold makes it worth it?",
        "How do you share a NumPy array between processes without pickling?",
        "What is Apache Arrow and why does it enable zero-copy between Polars and DuckDB?",
        "asyncio.Semaphore — how do you use it to bound concurrency?",
        "What does `del df; gc.collect()` buy you in a memory-constrained pipeline?",
        "memray vs tracemalloc — what does each show that the other doesn't?",
        "ProcessPoolExecutor max_workers — what is the typical rule of thumb?"
      ],
      redFlags: [
        {
          junior: "\"I'd use pd.read_parquet() on the whole 200GB file.\"",
          senior: "\"That materializes 200GB into RAM and OOMs. I'd use DuckDB's read_parquet() — it reads in parallel, spills automatically, and returns a result in minutes.\""
        },
        {
          junior: "\"Python doesn't have memory leaks.\"",
          senior: "\"Holding references to growing lists or caches without eviction is a leak even with GC running. I profile with tracemalloc to find the allocating line and fix the root cause.\""
        },
        {
          junior: "\"Polars is just faster pandas.\"",
          senior: "\"Polars uses Arrow columnar format and Rust multithreading — architecturally different, not just optimized. The lazy optimizer and streaming mode handle larger-than-RAM data that pandas can't.\""
        },
        {
          junior: "\"We should rewrite the pipeline in Go for performance.\"",
          senior: "\"I'd profile first. Most pipeline time is in I/O or C-extension calls. If Python is the bottleneck, DuckDB or Polars often eliminate it without a rewrite. A Go rewrite is a last resort justified by profiling data.\""
        }
      ],
      checklist: [
        "DuckDB for SQL-shaped analytics on Parquet: one-liner, parallel, spill-safe",
        "Polars lazy API: scan → filter → agg → collect(streaming=True) pattern",
        "Memory profiling: tracemalloc (stdlib) → memray (flame graph) → fix the allocating line",
        "Concurrency architecture: asyncio/threads for I/O, multiprocessing for CPU, queue for backpressure",
        "When to leave Python: profile first, try DuckDB/Polars/Numba, escalate to Rust extension or distributed system only with data"
      ],
      behavioral: [
        "Tell me about a time you diagnosed a production memory issue in a Python pipeline — what tool did you use and what did you find?",
        "Describe a decision you made to use a non-pandas tool for a data task — how did you justify it to the team?",
        "A time you had to decide whether to optimize a Python pipeline or replace it — what was your process?"
      ],
      reverse: [
        "Are you using DuckDB or Polars in production or are you all-pandas? Is there appetite to modernize?",
        "How do you handle data that exceeds RAM today — chunking, distributed compute, or a different engine?",
        "Do you memory-profile pipelines during development or only investigate after production OOMs?"
      ]
    }
  }
};
