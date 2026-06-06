import type { ConvItem } from "./types";

/**
 * Python practice items — conversational / code-editor mode (no in-browser
 * execution). Questions sourced from real 2024-2025 data-engineer interview
 * reports: StrataScratch, DataDriven, DataEngineerAcademy, Glassdoor/Amazon
 * flatten-JSON question, interviewquery.com, and verified against CPython /
 * pandas docs.  `free: true` = available without Practice Pro.
 */
export const PYTHON_ITEMS: ConvItem[] = [
  // ── JUNIOR ───────────────────────────────────────────────────────────────

  {
    id: "py-dedup-order-preserving",
    category: "python",
    executes: false,
    mode: "code",
    free: true,
    level: "junior",
    title: "Order-preserving deduplication",
    company: "Marketplace · Junior screen",
    difficulty: "easy",
    prompt:
      "You receive a list of user IDs that may contain duplicates (e.g., from a raw event log).\n\n" +
      "**Task:** Write a function `dedup_preserve_order(items)` that returns a new list with duplicates removed **while preserving the first occurrence order**. " +
      "Do not use `dict.fromkeys` or any third-party library — show the logic explicitly.\n\n" +
      "```python\n" +
      "assert dedup_preserve_order([3, 1, 4, 1, 5, 9, 2, 6, 5]) == [3, 1, 4, 5, 9, 2, 6]\n" +
      "assert dedup_preserve_order([])                            == []\n" +
      "assert dedup_preserve_order([\"a\", \"b\", \"a\"])              == [\"a\", \"b\"]\n" +
      "```\n\n" +
      "What is the time and space complexity of your solution?",
    hints: [
      "A `set` gives O(1) average-case membership tests — use one to track items you have already seen.",
      "Iterate the original list once; append to the result list only when the element is not yet in your `seen` set. This is O(n) time and O(n) space.",
      "Edge-case: unhashable types (lists, dicts) cannot go in a set — mention this trade-off if the interviewer pushes on it.",
    ],
    starter:
      "def dedup_preserve_order(items: list) -> list:\n" +
      "    \"\"\"Return a new list with duplicates removed, first occurrences kept.\"\"\"\n" +
      "    # your code here\n" +
      "    pass\n",
    idealAnswer:
      "def dedup_preserve_order(items: list) -> list:\n" +
      "    seen = set()\n" +
      "    result = []\n" +
      "    for item in items:\n" +
      "        if item not in seen:\n" +
      "            seen.add(item)\n" +
      "            result.append(item)\n" +
      "    return result\n" +
      "\n" +
      "# Time:  O(n) - one pass, set membership is O(1) average\n" +
      "# Space: O(n) - seen set + result list each up to n elements\n",
    rubric: [
      "Uses a set for O(1) membership checks (not O(n) `in list`).",
      "Single pass — does not sort or call any dedup helper implicitly.",
      "Correctly handles empty list and single-element list edge cases.",
      "States O(n) time and O(n) space with justification.",
      "Mentions the unhashable-element caveat or suggests a workaround (e.g., convert to tuple before hashing).",
    ],
    tests: [
      { name: "removes duplicates, preserves first-occurrence order", code: "assert dedup_preserve_order([3, 1, 4, 1, 5, 9, 2, 6, 5]) == [3, 1, 4, 5, 9, 2, 6]" },
      { name: "empty list returns empty list", code: "assert dedup_preserve_order([]) == []" },
      { name: "strings — removes duplicates", code: "assert dedup_preserve_order(['a', 'b', 'a']) == ['a', 'b']" },
      { name: "single element list", code: "assert dedup_preserve_order([42]) == [42]" },
      { name: "all unique — list unchanged", code: "assert dedup_preserve_order([1, 2, 3]) == [1, 2, 3]" },
    ],
  },

  {
    id: "py-mutable-default-arg",
    category: "python",
    executes: false,
    mode: "code",
    free: false,
    level: "junior",
    title: "The mutable-default-argument gotcha",
    company: "Fintech · Junior technical phone screen",
    difficulty: "easy",
    prompt:
      "A new teammate committed this ETL helper. It passes unit tests but **silently corrupts data in production** after the first run.\n\n" +
      "```python\n" +
      "def append_record(record, log=[]):\n" +
      "    log.append(record)\n" +
      "    return log\n" +
      "\n" +
      "print(append_record(\"order_1\"))  # ['order_1']\n" +
      "print(append_record(\"order_2\"))  # ???\n" +
      "```\n\n" +
      "1. **Explain** what Python actually prints on the second call and *why*.\n" +
      "2. **Fix** the function so each call gets a fresh log unless a caller explicitly passes one.\n" +
      "3. Bonus: name one other common mutable-default pitfall (dict, set, or custom object).",
    hints: [
      "Default argument values are evaluated **once** when the `def` statement runs — not on each call. The same list object is reused across calls.",
      "The idiomatic fix is to default to `None` and create a new list inside the function body when no log is provided.",
      "Think about what happens if you default to a `{}` dict in a caching function — state accumulates across calls unintentionally.",
    ],
    starter:
      "# Broken version — explain why, then rewrite it correctly.\n" +
      "def append_record(record, log=[]):\n" +
      "    log.append(record)\n" +
      "    return log\n" +
      "\n" +
      "# Fixed version:\n" +
      "def append_record_fixed(record, log=None):\n" +
      "    # your fix here\n" +
      "    pass\n",
    idealAnswer:
      "# Why it breaks:\n" +
      "# Default argument values are bound at function-definition time in CPython.\n" +
      "# The same list object is reused on every call that omits log,\n" +
      "# so state accumulates across invocations.\n" +
      "\n" +
      "# Second call prints: ['order_1', 'order_2']\n" +
      "\n" +
      "def append_record_fixed(record, log=None):\n" +
      "    if log is None:\n" +
      "        log = []          # fresh list each time\n" +
      "    log.append(record)\n" +
      "    return log\n" +
      "\n" +
      "# Bonus pitfall - mutable default dict used as a cache:\n" +
      "# def get_or_create(key, cache={}):\n" +
      "#     if key not in cache:\n" +
      "#         cache[key] = expensive_call(key)\n" +
      "#     return cache[key]\n" +
      "# This leaks state across test runs and parallel workers.\n",
    rubric: [
      "Correctly states that the default list is shared across calls and why (evaluated once at def time).",
      "Predicts the second print output as `['order_1', 'order_2']`.",
      "Fixes using `None` sentinel and creates a new list inside the function body.",
      "Does not use a class-level default or global variable as the fix.",
      "Offers at least one additional mutable-default example (dict, set, or custom object).",
    ],
    tests: [
      { name: "each call with no log gets a fresh list", code: "assert append_record_fixed('order_1') == ['order_1']" },
      { name: "second independent call does not accumulate", code: "append_record_fixed('order_1'); result = append_record_fixed('order_2'); assert result == ['order_2']" },
      { name: "explicit log passed is appended to", code: "existing = ['order_0']; assert append_record_fixed('order_1', existing) == ['order_0', 'order_1']" },
      { name: "returns the list with the record inside", code: "r = append_record_fixed('x'); assert len(r) == 1 and r[0] == 'x'" },
    ],
  },

  {
    id: "py-word-frequency",
    category: "python",
    executes: false,
    mode: "code",
    free: false,
    level: "junior",
    title: "Word frequency counter",
    company: "Media analytics · Junior take-home",
    difficulty: "easy",
    prompt:
      "Given a string of text (e.g., a log line or article body), write a function `top_n_words(text, n)` that returns the " +
      "**top-n most frequent words** as a list of `(word, count)` tuples, sorted by count descending. Ties should be broken alphabetically ascending.\n\n" +
      "Requirements:\n" +
      "- Lowercase all words before counting.\n" +
      "- Strip punctuation (you may assume only ASCII punctuation).\n" +
      "- Ignore empty tokens.\n\n" +
      "```python\n" +
      "text = \"To be or not to be, that is the question. To be!\"\n" +
      "top_n_words(text, 3)\n" +
      "# Expected: [(\"be\", 3), (\"to\", 3), (\"is\", 1)]  -- \"be\" & \"to\" tie at 3; next is \"is\"\n" +
      "```\n\n" +
      "What stdlib class makes this cleanest?",
    hints: [
      "`str.translate()` with `str.maketrans('', '', string.punctuation)` efficiently strips all ASCII punctuation in one pass.",
      "`collections.Counter` counts frequencies in a single constructor call. Its `.most_common()` method returns sorted (word, count) pairs — but it does not break ties alphabetically, so you need a secondary sort.",
      "Sort the final list with `key=lambda x: (-x[1], x[0])` to get descending count, then ascending alpha for ties.",
    ],
    starter:
      "import string\n" +
      "from collections import Counter\n" +
      "\n" +
      "def top_n_words(text: str, n: int) -> list[tuple[str, int]]:\n" +
      "    \"\"\"Return the n most frequent words; ties broken alphabetically.\"\"\"\n" +
      "    # your code here\n" +
      "    pass\n",
    idealAnswer:
      "import string\n" +
      "from collections import Counter\n" +
      "\n" +
      "def top_n_words(text: str, n: int) -> list[tuple[str, int]]:\n" +
      "    # Strip punctuation, lowercase, split\n" +
      "    cleaned = text.lower().translate(str.maketrans(\"\", \"\", string.punctuation))\n" +
      "    words = [w for w in cleaned.split() if w]\n" +
      "    counts = Counter(words)\n" +
      "    # Sort: descending count, then ascending alpha to break ties\n" +
      "    sorted_counts = sorted(counts.items(), key=lambda x: (-x[1], x[0]))\n" +
      "    return sorted_counts[:n]\n",
    rubric: [
      "Lowercases before counting and handles punctuation stripping.",
      "Uses `collections.Counter` (or an equivalent manual dict) — not a nested loop.",
      "Applies a two-key sort: descending count then ascending alphabetical for tie-breaking.",
      "Handles empty string and n > vocabulary size without error.",
      "Explains time complexity: O(k log k) for the sort, where k is unique word count.",
    ],
    tests: [
      { name: "top-3 with tie broken alphabetically", code: "assert top_n_words('To be or not to be, that is the question. To be!', 3) == [('be', 3), ('to', 3), ('is', 1)]" },
      { name: "n=1 returns single most frequent word", code: "assert top_n_words('cat dog cat cat dog', 1) == [('cat', 3)]" },
      { name: "empty string returns empty list", code: "assert top_n_words('', 5) == []" },
      { name: "n larger than vocabulary returns all words", code: "result = top_n_words('hello world', 10); assert len(result) == 2" },
      { name: "punctuation is stripped before counting", code: "assert top_n_words('hello, hello! hello.', 1) == [('hello', 3)]" },
    ],
  },

  // ── MID ──────────────────────────────────────────────────────────────────

  {
    id: "py-generator-large-file",
    category: "python",
    executes: false,
    mode: "code",
    free: true,
    level: "mid",
    title: "Stream-process a file larger than RAM",
    company: "Logistics · Mid-level data engineer screen",
    difficulty: "medium",
    prompt:
      "You have a **multi-GB CSV file** of delivery events on a machine with only 2 GB of RAM. " +
      "Each row has the fields `driver_id,event_type,revenue`. You need to compute the **total revenue per driver** and write the result to a new CSV.\n\n" +
      "**Task:** Implement `aggregate_revenue(input_path, output_path)` using a generator so the file is never fully loaded into memory.\n\n" +
      "```\n" +
      "# Input (delivery_events.csv)\n" +
      "driver_id,event_type,revenue\n" +
      "D1,PICKUP,0\n" +
      "D1,DROPOFF,18.50\n" +
      "D2,DROPOFF,22.00\n" +
      "D1,DROPOFF,10.00\n" +
      "```\n\n" +
      "Expected output CSV:\n" +
      "```\n" +
      "driver_id,total_revenue\n" +
      "D1,28.5\n" +
      "D2,22.0\n" +
      "```\n\n" +
      "Constraints:\n" +
      "- No pandas — use only the stdlib (`csv`, `collections`).\n" +
      "- Explain why your approach is memory-safe even for a 100 GB file.",
    hints: [
      "Open the file with `open()` and wrap it in `csv.DictReader`. Iterating the reader is already lazy (one row at a time) — you don't need an explicit `yield`, but you must not call `list()` on it.",
      "`collections.defaultdict(float)` accumulates per-driver totals in O(unique drivers) space — much smaller than O(rows).",
      "The accumulator dict holds at most as many entries as there are unique drivers (thousands), not rows (billions). That is why it's memory-safe regardless of file size.",
    ],
    starter:
      "import csv\n" +
      "from collections import defaultdict\n" +
      "\n" +
      "def aggregate_revenue(input_path: str, output_path: str) -> None:\n" +
      "    \"\"\"Stream the CSV, accumulate per-driver revenue, write results.\"\"\"\n" +
      "    totals: dict[str, float] = defaultdict(float)\n" +
      "\n" +
      "    # Step 1: stream the input\n" +
      "    # your code here\n" +
      "\n" +
      "    # Step 2: write output\n" +
      "    # your code here\n",
    idealAnswer:
      "import csv\n" +
      "from collections import defaultdict\n" +
      "\n" +
      "def aggregate_revenue(input_path: str, output_path: str) -> None:\n" +
      "    totals: dict[str, float] = defaultdict(float)\n" +
      "\n" +
      "    # Stream: csv.DictReader iterates lazily - one row in memory at a time.\n" +
      "    with open(input_path, newline=\"\", encoding=\"utf-8\") as fh:\n" +
      "        reader = csv.DictReader(fh)\n" +
      "        for row in reader:\n" +
      "            totals[row[\"driver_id\"]] += float(row[\"revenue\"])\n" +
      "\n" +
      "    # Write results\n" +
      "    with open(output_path, \"w\", newline=\"\", encoding=\"utf-8\") as fh:\n" +
      "        writer = csv.writer(fh)\n" +
      "        writer.writerow([\"driver_id\", \"total_revenue\"])\n" +
      "        for driver_id, total in sorted(totals.items()):\n" +
      "            writer.writerow([driver_id, total])\n" +
      "\n" +
      "# Memory profile:\n" +
      "# - Only one CSV row object in memory per iteration.\n" +
      "# - totals dict is O(D) where D = unique drivers (e.g., 10k), not O(N rows).\n" +
      "# - Safe for a 100GB file as long as unique drivers fit in RAM.\n",
    rubric: [
      "Reads the file lazily row-by-row — never calls `list(reader)` or `readlines()`.",
      "Uses `defaultdict(float)` or equivalent to accumulate per-driver totals in O(drivers) space.",
      "Correctly parses `revenue` as float and handles the header row (via `DictReader` or manual skip).",
      "Writes the output CSV with the correct header and sorted rows.",
      "Articulates *why* this is memory-safe: accumulator size is proportional to unique keys, not total rows.",
    ],
  },

  {
    id: "py-pandas-vectorization",
    category: "python",
    executes: false,
    mode: "code",
    free: false,
    level: "mid",
    title: "Vectorization vs iterrows — fix the slow pipeline",
    company: "Ride-share · Mid data engineer screen",
    difficulty: "medium",
    prompt:
      "A data pipeline applies a **fare calculation** to a trips DataFrame. " +
      "The current code is too slow for production (10M rows takes >5 minutes):\n\n" +
      "```python\n" +
      "import pandas as pd\n" +
      "\n" +
      "def calculate_fares_slow(df: pd.DataFrame) -> pd.Series:\n" +
      "    fares = []\n" +
      "    for _, row in df.iterrows():\n" +
      "        base = 2.50\n" +
      "        per_mile = row[\"distance_miles\"] * 1.25\n" +
      "        surge = per_mile * row[\"surge_multiplier\"]\n" +
      "        fares.append(base + surge)\n" +
      "    return pd.Series(fares, index=df.index)\n" +
      "```\n\n" +
      "**Tasks:**\n" +
      "1. Explain *why* `iterrows()` is slow (two reasons).\n" +
      "2. Rewrite `calculate_fares_fast(df)` using vectorized pandas/NumPy operations. It must produce identical output.\n" +
      "3. How much faster do you expect the vectorized version to be, and why?",
    hints: [
      "`iterrows()` boxes each row into a Python `Series` object on every iteration and then calls Python-level bytecode per row — both operations incur heavy interpreter overhead.",
      "Vectorized pandas operations (column arithmetic like `df['a'] + df['b']`) delegate to NumPy C-level routines that operate on contiguous memory arrays without the per-row Python overhead.",
      "For 10M rows the speedup is typically 50-200x. You can confirm with `%timeit` in a notebook or `time.perf_counter()` in a script.",
    ],
    starter:
      "import pandas as pd\n" +
      "\n" +
      "def calculate_fares_fast(df: pd.DataFrame) -> pd.Series:\n" +
      "    \"\"\"Vectorized replacement for the iterrows version.\"\"\"\n" +
      "    # your code here\n" +
      "    pass\n",
    idealAnswer:
      "import pandas as pd\n" +
      "\n" +
      "def calculate_fares_fast(df: pd.DataFrame) -> pd.Series:\n" +
      "    base = 2.50\n" +
      "    # All arithmetic operates on entire NumPy arrays - no Python loop.\n" +
      "    return base + (df[\"distance_miles\"] * 1.25 * df[\"surge_multiplier\"])\n" +
      "\n" +
      "# Why iterrows() is slow:\n" +
      "# 1. Each iteration materializes a new pandas Series object (row boxing) -\n" +
      "#    ~100 microseconds of Python-object overhead per row.\n" +
      "# 2. The loop runs in CPython bytecode; there is no SIMD, no cache locality,\n" +
      "#    and the GIL is held the entire time.\n" +
      "#\n" +
      "# Vectorized version delegates to NumPy C extensions that:\n" +
      "# - Operate on contiguous memory arrays (CPU cache-friendly).\n" +
      "# - Use SIMD instructions where hardware supports them.\n" +
      "# - Release the GIL during the C computation.\n" +
      "# Speedup: typically 50-200x for arithmetic-heavy workloads.\n",
    rubric: [
      "Correctly identifies both slowness causes: per-row Series boxing + Python bytecode loop overhead.",
      "Rewrites using pure column arithmetic (`df['col'] * scalar`) with no loops or `apply()`.",
      "Output Series has the same dtype and index as the original.",
      "Quantifies the expected speedup (50-200x range) and explains the mechanism (NumPy C arrays, SIMD, cache locality).",
      "Mentions that `.apply()` is still slower than pure vectorization and notes when numba/Cython would be warranted.",
    ],
    tests: [
      { name: "matches the fare formula", code: "import pandas as pd\ndf = pd.DataFrame({'distance_miles':[10.0,0.0,4.0],'surge_multiplier':[1.0,2.0,1.5]})\nassert [round(x,2) for x in calculate_fares_fast(df)] == [15.0, 2.5, 10.0]" },
      { name: "preserves the index", code: "import pandas as pd\ndf = pd.DataFrame({'distance_miles':[2.0],'surge_multiplier':[3.0]}, index=[42])\nassert list(calculate_fares_fast(df).index) == [42]" },
      { name: "empty frame returns empty", code: "import pandas as pd\ndf = pd.DataFrame({'distance_miles':[],'surge_multiplier':[]})\nassert len(calculate_fares_fast(df)) == 0" },
    ],
  },

  {
    id: "py-groupby-without-pandas",
    category: "python",
    executes: false,
    mode: "code",
    free: false,
    level: "mid",
    title: "Group-by aggregation without pandas",
    company: "Healthcare data · Mid screen (no external libs)",
    difficulty: "medium",
    prompt:
      "You are given a list of dicts representing patient records and **cannot use pandas or any third-party library**. " +
      "Implement `summarize_by_region(records)` that groups by `region` and returns a list of dicts with " +
      "`region`, `patient_count`, and `avg_age` (rounded to 1 decimal).\n\n" +
      "```python\n" +
      "records = [\n" +
      "    {\"patient_id\": \"P1\", \"region\": \"West\",  \"age\": 34},\n" +
      "    {\"patient_id\": \"P2\", \"region\": \"East\",  \"age\": 52},\n" +
      "    {\"patient_id\": \"P3\", \"region\": \"West\",  \"age\": 29},\n" +
      "    {\"patient_id\": \"P4\", \"region\": \"East\",  \"age\": 41},\n" +
      "    {\"patient_id\": \"P5\", \"region\": \"West\",  \"age\": 60},\n" +
      "]\n" +
      "\n" +
      "summarize_by_region(records)\n" +
      "# [\n" +
      "#   {\"region\": \"East\",  \"patient_count\": 2, \"avg_age\": 46.5},\n" +
      "#   {\"region\": \"West\",  \"patient_count\": 3, \"avg_age\": 41.0},\n" +
      "# ]  <- sorted by region ascending\n" +
      "```",
    hints: [
      "Use a `defaultdict` with a dict value to accumulate `total_age` and `count` per region in a single pass.",
      "After the accumulation pass, compute `avg_age = total_age / count` and round to 1 decimal.",
      "Sort the final list by `region` with `sorted(..., key=lambda r: r['region'])` to produce deterministic output.",
    ],
    starter:
      "from collections import defaultdict\n" +
      "\n" +
      "def summarize_by_region(records: list[dict]) -> list[dict]:\n" +
      "    \"\"\"Group by region; return patient_count and avg_age per region.\"\"\"\n" +
      "    # your code here\n" +
      "    pass\n",
    idealAnswer:
      "from collections import defaultdict\n" +
      "\n" +
      "def summarize_by_region(records: list[dict]) -> list[dict]:\n" +
      "    acc: dict[str, dict] = defaultdict(lambda: {\"count\": 0, \"total_age\": 0})\n" +
      "\n" +
      "    for rec in records:\n" +
      "        region = rec[\"region\"]\n" +
      "        acc[region][\"count\"] += 1\n" +
      "        acc[region][\"total_age\"] += rec[\"age\"]\n" +
      "\n" +
      "    result = [\n" +
      "        {\n" +
      "            \"region\": region,\n" +
      "            \"patient_count\": data[\"count\"],\n" +
      "            \"avg_age\": round(data[\"total_age\"] / data[\"count\"], 1),\n" +
      "        }\n" +
      "        for region, data in acc.items()\n" +
      "    ]\n" +
      "    return sorted(result, key=lambda r: r[\"region\"])\n",
    rubric: [
      "Single-pass accumulation with a `defaultdict` or plain dict — no nested loops or repeated list scans.",
      "Correctly computes `avg_age` as `total_age / count` (not mean of means).",
      "Rounds to exactly 1 decimal place using `round(..., 1)`.",
      "Returns results sorted by `region` ascending.",
      "Handles edge case of empty `records` list without error.",
    ],
    tests: [
      {
        name: "correct counts and avg_ages, sorted by region",
        code: "records = [{'patient_id': 'P1', 'region': 'West', 'age': 34}, {'patient_id': 'P2', 'region': 'East', 'age': 52}, {'patient_id': 'P3', 'region': 'West', 'age': 29}, {'patient_id': 'P4', 'region': 'East', 'age': 41}, {'patient_id': 'P5', 'region': 'West', 'age': 60}]; result = summarize_by_region(records); assert result == [{'region': 'East', 'patient_count': 2, 'avg_age': 46.5}, {'region': 'West', 'patient_count': 3, 'avg_age': 41.0}]",
      },
      {
        name: "empty list returns empty list",
        code: "assert summarize_by_region([]) == []",
      },
      {
        name: "single record returns one region entry",
        code: "result = summarize_by_region([{'patient_id': 'P1', 'region': 'North', 'age': 30}]); assert result == [{'region': 'North', 'patient_count': 1, 'avg_age': 30.0}]",
      },
      {
        name: "avg_age is rounded to 1 decimal",
        code: "records = [{'patient_id': 'P1', 'region': 'South', 'age': 10}, {'patient_id': 'P2', 'region': 'South', 'age': 20}, {'patient_id': 'P3', 'region': 'South', 'age': 30}]; result = summarize_by_region(records); assert result[0]['avg_age'] == 20.0",
      },
    ],
  },

  // ── SENIOR ───────────────────────────────────────────────────────────────

  {
    id: "py-flatten-nested-json",
    category: "python",
    executes: false,
    mode: "code",
    free: false,
    level: "senior",
    title: "Flatten deeply nested API payloads",
    company: "E-commerce platform · Senior data engineer (Amazon-style)",
    difficulty: "hard",
    prompt:
      "Your ingestion pipeline receives **deeply nested JSON payloads** from a product API. " +
      "Before loading into a columnar warehouse you must flatten each payload to a single-level dict where nested keys become dot-joined paths.\n\n" +
      "**Task:** Implement `flatten_json(obj, separator=\".\")`.\n\n" +
      "```python\n" +
      "payload = {\n" +
      "    \"order\": {\n" +
      "        \"id\": \"ORD-42\",\n" +
      "        \"customer\": {\"id\": \"C-7\", \"tier\": \"gold\"},\n" +
      "        \"items\": [{\"sku\": \"A1\", \"qty\": 2}, {\"sku\": \"B3\", \"qty\": 1}],\n" +
      "    },\n" +
      "    \"ts\": \"2025-03-01T12:00:00Z\",\n" +
      "}\n" +
      "\n" +
      "flatten_json(payload)\n" +
      "# {\n" +
      "#   \"order.id\":            \"ORD-42\",\n" +
      "#   \"order.customer.id\":   \"C-7\",\n" +
      "#   \"order.customer.tier\": \"gold\",\n" +
      "#   \"order.items.0.sku\":   \"A1\",\n" +
      "#   \"order.items.0.qty\":   2,\n" +
      "#   \"order.items.1.sku\":   \"B3\",\n" +
      "#   \"order.items.1.qty\":   1,\n" +
      "#   \"ts\":                  \"2025-03-01T12:00:00Z\",\n" +
      "# }\n" +
      "```\n\n" +
      "Requirements:\n" +
      "- Handle arbitrary nesting depth and mixed dict/list structures.\n" +
      "- List elements should be indexed numerically (`items.0`, `items.1`, ...).\n" +
      "- Do **not** use any flattening library (`flatten_dict`, `pd.json_normalize` internals, etc.).\n" +
      "- What is the worst-case time and space complexity?",
    hints: [
      "A recursive helper that carries a `prefix` string is the cleanest approach. When you hit a `dict`, recurse with `prefix + key`. When you hit a `list`, recurse with `prefix + str(index)`.",
      "An iterative version using a stack of `(prefix, value)` tuples avoids Python's recursion limit for very deeply nested payloads — mention this as a production concern.",
      "Worst case: O(N) time and O(N) space where N is the total number of primitive leaf values (you visit every node exactly once; each key string is at most O(depth) long — typically negligible).",
    ],
    starter:
      "def flatten_json(obj: dict | list, separator: str = \".\") -> dict:\n" +
      "    \"\"\"Recursively flatten a nested JSON object into a single-level dict.\"\"\"\n" +
      "    result: dict = {}\n" +
      "\n" +
      "    def _flatten(current, prefix: str) -> None:\n" +
      "        # your code here\n" +
      "        pass\n" +
      "\n" +
      "    _flatten(obj, \"\")\n" +
      "    return result\n",
    idealAnswer:
      "def flatten_json(obj: dict | list, separator: str = \".\") -> dict:\n" +
      "    result: dict = {}\n" +
      "\n" +
      "    def _flatten(current, prefix: str) -> None:\n" +
      "        if isinstance(current, dict):\n" +
      "            for key, value in current.items():\n" +
      "                new_key = f\"{prefix}{separator}{key}\" if prefix else key\n" +
      "                _flatten(value, new_key)\n" +
      "        elif isinstance(current, list):\n" +
      "            for idx, value in enumerate(current):\n" +
      "                new_key = f\"{prefix}{separator}{idx}\" if prefix else str(idx)\n" +
      "                _flatten(value, new_key)\n" +
      "        else:\n" +
      "            # Leaf node - write the flattened key\n" +
      "            result[prefix] = current\n" +
      "\n" +
      "    _flatten(obj, \"\")\n" +
      "    return result\n" +
      "\n" +
      "# Complexity:\n" +
      "# Time:  O(N) - every leaf visited exactly once.\n" +
      "# Space: O(N) output dict + O(D) recursion stack where D = max nesting depth.\n" +
      "# Production note: for depth > ~500 swap to an explicit stack to avoid\n" +
      "# Python's default recursion limit (sys.getrecursionlimit() == 1000).\n",
    rubric: [
      "Handles dicts and lists with separate branches — not a single `isinstance(dict)` check.",
      "List indices are stringified integers in the key path (e.g., `items.0.sku`).",
      "Correctly builds the prefix, avoiding a leading separator when `prefix` is empty.",
      "Does not mutate the input object.",
      "Discusses Python recursion-limit risk and mentions an iterative stack-based alternative for production use.",
    ],
    tests: [
      {
        name: "flattens nested dicts and lists to dot-joined keys",
        code: "payload = {'order': {'id': 'ORD-42', 'customer': {'id': 'C-7', 'tier': 'gold'}, 'items': [{'sku': 'A1', 'qty': 2}, {'sku': 'B3', 'qty': 1}]}, 'ts': '2025-03-01T12:00:00Z'}; result = flatten_json(payload); assert result['order.id'] == 'ORD-42'; assert result['order.customer.id'] == 'C-7'; assert result['order.customer.tier'] == 'gold'; assert result['order.items.0.sku'] == 'A1'; assert result['order.items.0.qty'] == 2; assert result['order.items.1.sku'] == 'B3'; assert result['order.items.1.qty'] == 1; assert result['ts'] == '2025-03-01T12:00:00Z'",
      },
      {
        name: "flat dict is unchanged",
        code: "assert flatten_json({'a': 1, 'b': 2}) == {'a': 1, 'b': 2}",
      },
      {
        name: "empty dict returns empty dict",
        code: "assert flatten_json({}) == {}",
      },
      {
        name: "custom separator is applied",
        code: "result = flatten_json({'a': {'b': 1}}, separator='__'); assert result == {'a__b': 1}",
      },
      {
        name: "top-level list is indexed numerically",
        code: "result = flatten_json([10, 20, 30]); assert result == {'0': 10, '1': 20, '2': 30}",
      },
    ],
  },

  {
    id: "py-50gb-chunking-duckdb",
    category: "python",
    executes: false,
    mode: "code",
    free: false,
    level: "senior",
    title: "Process a 50 GB log file — chunking, DuckDB, and architecture trade-offs",
    company: "Cloud infra · Senior / Staff screen",
    difficulty: "hard",
    prompt:
      "You are asked to compute the **P50 and P99 response latency per service endpoint** from a 50 GB uncompressed CSV access log on a single machine with 16 GB RAM. " +
      "The CSV has the columns: `timestamp, endpoint, status_code, latency_ms`.\n\n" +
      "**Part A — Code:** Implement `compute_latency_percentiles(path)` using **DuckDB** so the file is never fully loaded into Python's heap.\n\n" +
      "**Part B — Architecture trade-offs:** In 3-4 sentences explain:\n" +
      "- When you would choose pandas `chunksize` streaming instead.\n" +
      "- When you would move this to Spark or a cloud warehouse.\n" +
      "- What DuckDB cannot do that those options can.\n\n" +
      "```python\n" +
      "# Expected return value (example):\n" +
      "# [\n" +
      "#   {\"endpoint\": \"/api/orders\", \"p50_ms\": 42.0, \"p99_ms\": 210.0},\n" +
      "#   {\"endpoint\": \"/api/users\",  \"p50_ms\": 18.0, \"p99_ms\":  95.0},\n" +
      "# ]\n" +
      "```",
    hints: [
      "DuckDB can `read_csv_auto()` directly from a file path and execute SQL — it streams data through its own vectorised execution engine without loading everything into Python RAM. Use `duckdb.connect()` and `.execute().fetchdf()`.",
      "The SQL you need uses `PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY latency_ms)` — the ANSI ordered-set aggregate. Pass the file path as a query parameter to avoid SQL injection.",
      "For Part B: pandas `chunksize` is useful when you need Python-level row transformations between chunks. Spark shines when the job must run in parallel across a cluster. DuckDB is single-node only.",
    ],
    starter:
      "import duckdb\n" +
      "\n" +
      "def compute_latency_percentiles(path: str) -> list[dict]:\n" +
      "    \"\"\"\n" +
      "    Compute P50 and P99 latency_ms per endpoint from a 50 GB CSV\n" +
      "    without loading it into Python memory.\n" +
      "    \"\"\"\n" +
      "    con = duckdb.connect()\n" +
      "    # your SQL here\n" +
      "    pass\n",
    idealAnswer:
      "import duckdb\n" +
      "\n" +
      "def compute_latency_percentiles(path: str) -> list[dict]:\n" +
      "    con = duckdb.connect()  # in-memory DuckDB instance\n" +
      "\n" +
      "    # DuckDB streams the CSV through its own vectorised engine.\n" +
      "    # PERCENTILE_CONT uses ANSI ordered-set aggregates.\n" +
      "    sql = \"\"\"\n" +
      "        SELECT\n" +
      "            endpoint,\n" +
      "            PERCENTILE_CONT(0.5)  WITHIN GROUP (ORDER BY latency_ms) AS p50_ms,\n" +
      "            PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY latency_ms) AS p99_ms\n" +
      "        FROM read_csv_auto(?)\n" +
      "        GROUP BY endpoint\n" +
      "        ORDER BY endpoint\n" +
      "    \"\"\"\n" +
      "    df = con.execute(sql, [path]).fetchdf()\n" +
      "    return df.to_dict(orient=\"records\")\n" +
      "\n" +
      "# Part B - Architecture trade-offs:\n" +
      "#\n" +
      "# Pandas chunksize: choose when you need Python-level transformations between\n" +
      "# chunks (custom parsing, Python regex, UDFs) that DuckDB SQL cannot express.\n" +
      "# Memory usage is O(chunk_size), not O(file_size).\n" +
      "#\n" +
      "# Spark / cloud warehouse (BigQuery, Redshift): move here when the file is\n" +
      "# distributed across many nodes, when you need fault tolerance mid-job, or\n" +
      "# when the aggregation requires a shuffle larger than one machine's disk.\n" +
      "#\n" +
      "# DuckDB limits: single-node only; no distributed shuffle; no streaming writes\n" +
      "# to external sinks (Kafka, HDFS) without additional tooling.\n",
    rubric: [
      "Uses `duckdb.connect()` and `read_csv_auto(?)` — DuckDB streams the file; Python heap stays small.",
      "SQL uses `PERCENTILE_CONT(0.5/0.99) WITHIN GROUP (ORDER BY latency_ms)` (the ANSI ordered-set aggregate, not an approximation).",
      "Returns results as a list of dicts with correct keys `endpoint`, `p50_ms`, `p99_ms`.",
      "Articulates when pandas chunking is preferred (Python-level transforms, no external deps) vs. Spark/warehouse (multi-node, distributed data).",
      "Identifies DuckDB's core limitation: single-machine, no distributed execution.",
    ],
  },
];
