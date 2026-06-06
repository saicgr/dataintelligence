import type { Authored, ToolTopics } from "../content-de";
import type { Level } from "../../types";

export const levels: Partial<Record<Level, { authored: Authored[]; topics: ToolTopics }>> = {
  // ─────────────────────────────────────────────────────────────
  // JUNIOR — DAGs/tasks/operators, scheduler basics, execution/logical date, retries
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
          "What is an Airflow DAG and how does the scheduler decide when to run it?",
        code: [
          {
            lang: "airflow",
            label: "catchup off",
            lines: [
              "dag = DAG(",
              "  dag_id='daily_etl',",
              "  start_date=datetime(2024,1,1),",
              "  schedule='@daily',",
              "  catchup=False,  # only latest",
              ")",
            ],
          },
        ],
        answerStructured:
          "- A **DAG (Directed Acyclic Graph)** is a collection of tasks with defined dependencies — acyclic means no task can depend on itself, directly or indirectly.\n- Required parameters: `dag_id`, `start_date`, and `schedule` (cron expression or preset like `@daily`).\n- The scheduler creates a **DAG run** for each interval where `data_interval_end` has passed in wall-clock time. A DAG scheduled `@daily` with `start_date=2024-01-01` won't produce January 1st's run until January 2nd — because the interval `[Jan 1, Jan 2)` is complete.\n- **`catchup=True`** (default): all missed intervals between `start_date` and now are backfilled automatically. **`catchup=False`**: only the most recent interval runs.\n- The DAG file is parsed by the scheduler every few seconds — keep top-level code lightweight; never make DB calls or network requests at parse time.",
        explanationDeep:
          "The most common junior confusion is thinking the DAG runs *on* the start_date. It doesn't — it runs *after* the data interval that starts on the start_date ends. This is the execution/logical date model: Airflow schedules backwards-looking intervals. A daily DAG's first run at midnight Jan 2nd processes the interval Jan 1 00:00 → Jan 2 00:00, and its `logical_date` (formerly `execution_date`) is Jan 1.\n\nThe other key concept is `catchup`. A new DAG with a start_date six months ago and `catchup=True` will immediately create hundreds of DAG runs, hammering whatever system the tasks touch. The safe default for most production DAGs is `catchup=False` plus explicit backfills when you need historical data.\n\nThe parse-time side-effect trap matters too: the scheduler parses every DAG file every few seconds. Any code that runs at the module level (importing, connecting to DBs, calling APIs) runs on every parse cycle — not just at task execution time. This is a frequent source of subtle bugs and scheduler overload.",
        interviewerLens:
          "I'm listening for the 'logical date is the start of the interval, not wall-clock now' insight. Juniors who say the DAG runs on the start_date have a fundamental misconception that will cause real bugs. I also want to hear `catchup` mentioned with an awareness of the risk — someone who says `catchup=True` is the default and moves on hasn't thought about what that means for a new DAG with an old start_date.",
        followupChain: [
          {
            question: "What does the scheduler actually do — is it the same thing that runs the tasks?",
            answer: "No. The scheduler parses DAGs, determines what should run, and submits tasks to the executor. The executor is what actually dispatches tasks to workers (or runs them locally). The scheduler never executes tasks directly."
          },
          {
            question: "Why does my DAG not run even though the start_date is in the past?",
            answer: "Check three things: (1) `catchup=False` may have skipped historical intervals, (2) the DAG is paused — check the toggle in the UI, (3) the schedule interval hasn't elapsed yet — remember, the run triggers at data_interval_end, not start."
          },
          {
            question: "What happens if the scheduler is down when a run was supposed to trigger?",
            answer: "When the scheduler comes back up, it catches up on any missed intervals (if catchup=True) or skips to the latest interval (if catchup=False). The scheduler is stateless about wall-clock drift — it decides based on the DAG schedule and existing DAG run records in the metadata DB."
          }
        ],
        redFlags: [
          {
            junior: "\"The DAG runs on the start_date.\"",
            senior: "\"The first run triggers after data_interval_end passes — a daily DAG with start_date Jan 1 first runs on Jan 2, processing the Jan 1 interval.\""
          },
          {
            junior: "\"I put my database connection at the top of the DAG file.\"",
            senior: "\"Top-level code in DAG files runs on every scheduler parse cycle — connections go inside tasks or operators, not at module level.\""
          }
        ],
        alternatePhrasings: [
          "\"What is a DAG in Airflow?\"",
          "\"How does Airflow scheduling work?\"",
          "\"Why didn't my DAG run when I expected it to?\""
        ],
        interviewContexts: [
          "Asked at nearly every junior data engineering screen with Airflow",
          "Entry-level DE role at a Series B logistics company"
        ]
      },
      {
        category: "deep-dives",
        riskLevel: "high",
        asked: 22,
        questionText:
          "What is the difference between execution_date, logical_date, and data_interval_start in Airflow?",
        code: [
          {
            accent: "bug",
            lang: "python",
            lines: [
              "@task",
              "def load():",
              "  day = datetime.now().date()",
              "  # backfill uses TODAY -> wrong",
            ],
          },
          {
            accent: "fix",
            lang: "python",
            lines: [
              "@task",
              "def load(ds=None):",
              "  day = ds  # data_interval_start",
              "  # correct for any backfill date",
            ],
          },
        ],
        answerStructured:
          "- **`execution_date`** is the legacy name (Airflow 1.x) for the logical date — still exposed as a template macro for backward compatibility.\n- **`logical_date`** (Airflow 2.2+) is the canonical name for the same concept: the *start* of the data interval being processed, not the wall-clock time the task actually ran.\n- **`data_interval_start`** and **`data_interval_end`** are the explicit interval bounds available in Airflow 2.2+. Use these for clarity — `{{ data_interval_start }}` is unambiguous.\n- Template macros: `{{ ds }}` = `data_interval_start` formatted as `YYYY-MM-DD`. Use it in SQL to filter the partition you're processing.\n- **Never use `datetime.now()` inside a task** — it returns wall-clock time, not the logical date. A backfill running today for last month's data will use today's date and produce wrong results.",
        explanationDeep:
          "The naming evolution from `execution_date` to `logical_date` + `data_interval_*` reflects Airflow fixing confusing semantics. `execution_date` sounds like when the task executed, but it actually means when the interval started. The 2.2+ names are unambiguous.\n\nThe practical implication: every task that touches time-partitioned data should use `{{ ds }}` (or `{{ data_interval_start }}`) in its SQL queries, not a hardcoded date or `datetime.now()`. This is what makes backfills work correctly — when you replay January from December, the logical date macros produce January values, not December. Using `datetime.now()` silently breaks this guarantee.\n\nFor non-cron schedules (timetable plugins or dataset-triggered DAGs in Airflow 2.4+), `data_interval_start` and `data_interval_end` are still populated but may not represent a regular calendar window. Understanding the interval model is foundational to writing correct Airflow tasks.",
        interviewerLens:
          "The interview signal here is whether you mention `datetime.now()` as an anti-pattern. Candidates who just explain what execution_date is have memorized a definition; candidates who say 'and this is why you never use now() in a task — it breaks backfills' understand how Airflow is actually used in production. The Airflow 2.2 naming change is a secondary bonus point.",
        followupChain: [
          {
            question: "How do you use the logical date in a SQL query inside a task?",
            answer: "Use Jinja templating: `WHERE event_date = '{{ ds }}'` in the SQL string passed to operators like PostgresOperator or BigQueryInsertJobOperator. The template is rendered at task execution time with the actual logical date for that DAG run."
          },
          {
            question: "What is ds_nodash and when would you use it?",
            answer: "ds_nodash is {{ ds }} without the dashes — YYYYMMDD format. Useful for partition paths in cloud storage (e.g., gs://bucket/date={{ ds_nodash }}/data.parquet) where hyphens in the path cause issues."
          }
        ],
        redFlags: [
          {
            junior: "\"I use datetime.now() to get today's date in my task.\"",
            senior: "\"datetime.now() breaks backfills — I use {{ ds }} or {{ data_interval_start }} so the task processes the correct interval regardless of when it actually runs.\""
          },
          {
            junior: "\"execution_date is when the task runs.\"",
            senior: "\"execution_date / logical_date is the start of the data interval — not when the task executed. The task may run well after that timestamp.\""
          }
        ],
        alternatePhrasings: [
          "\"What is execution_date in Airflow?\"",
          "\"How do you get the current date inside an Airflow task?\"",
          "\"What's the difference between logical_date and data_interval_start?\""
        ],
        interviewContexts: [
          "Asked at a data engineering interview at a healthcare analytics startup",
          "Came up in 3 Airflow-specific technical screens"
        ]
      },
      {
        category: "deep-dives",
        riskLevel: "medium",
        asked: 18,
        questionText:
          "What are Airflow operators and how do you choose between PythonOperator, BashOperator, and a provider operator like BigQueryInsertJobOperator?",
        answerStructured:
          "- An **operator** defines a single unit of work — it's the template; a running instance is a **task instance**.\n- **PythonOperator**: executes a Python callable directly in the Airflow worker process. Simple, but the callable runs in the same environment — memory/dependency bloat can affect the scheduler.\n- **BashOperator**: runs a shell command. Useful for calling CLI tools, scripts, or spark-submit, but watch for environment variable injection via Jinja templates (security risk if inputs are untrusted).\n- **Provider operators** (e.g., `BigQueryInsertJobOperator`, `S3CopyObjectOperator`): thin wrappers that push work to external services, returning quickly. Preferred for cloud-native workloads — the worker isn't blocked on compute, just API calls.\n- **Rule of thumb**: use provider operators when work happens in an external system; use PythonOperator for lightweight Python logic; avoid PythonOperator for heavy compute (use it to trigger an external job and poll for completion instead).",
        explanationDeep:
          "The main mistake juniors make is using PythonOperator for everything, including spawning large Spark jobs or loading multi-GB datasets directly in the callable. Airflow workers are orchestration workers — they're not meant to do heavy compute. When you run heavy work inside PythonOperator, you saturate the worker pool and the task is non-restartable at the step level (the whole callable re-runs on retry).\n\nProvider operators exist for exactly this reason: they submit work to an external system (BigQuery, Databricks, Snowflake, Spark) and wait for it to finish via API polling. The Airflow worker is barely loaded — it's just calling an API. This also makes tasks idempotent at the operator level (submitting the same job twice is usually safe).\n\nBashOperator's security caveat is worth knowing: if you use `bash_command = f'load.sh {user_input}'` and user_input comes from an XCom or DAG parameter, a malicious value can inject shell commands. Template inputs should always be validated or escaped.",
        interviewerLens:
          "I'm listening for awareness that Airflow workers are for orchestration, not compute. Juniors who say 'I'd use PythonOperator to run my Spark job' reveal they don't understand the role division. Provider operators for external systems, PythonOperator for lightweight glue — that's the right mental model. The BashOperator injection risk is a bonus signal.",
        followupChain: [
          {
            question: "How do you pass parameters to a PythonOperator callable?",
            answer: "Use op_args (positional) or op_kwargs (keyword arguments). To pass the execution context (ds, logical_date, etc.), either accept **kwargs in the callable and access context['ds'], or set provide_context=True in older Airflow versions. In Airflow 2+, the context is available via kwargs by default."
          },
          {
            question: "What is TaskFlow API and how is it different from PythonOperator?",
            answer: "TaskFlow API (@task decorator, Airflow 2.0+) is syntactic sugar over PythonOperator. It auto-creates XCom dependencies based on function return values and inputs, removing boilerplate. The generated task is still a PythonOperator under the hood — same scheduling semantics, cleaner Python syntax."
          }
        ],
        redFlags: [
          {
            junior: "\"I use PythonOperator for my Spark job because Python is easier.\"",
            senior: "\"PythonOperator runs in the Airflow worker — heavy compute belongs in an external system. I'd use SparkSubmitOperator or the Databricks operator to submit the job and let Airflow poll for completion.\""
          }
        ],
        alternatePhrasings: [
          "\"When would you use PythonOperator vs a provider operator?\"",
          "\"What types of operators does Airflow support?\"",
          "\"How do you run a SQL query as an Airflow task?\""
        ],
        interviewContexts: [
          "Junior DE screen at a cloud-native data platform team",
          "Asked at a mid-market analytics company Airflow onboarding interview"
        ]
      },
      {
        category: "deep-dives",
        riskLevel: "medium",
        asked: 15,
        questionText:
          "How do retries work in Airflow, and how do you configure alerting on task failure?",
        code: [
          {
            lang: "airflow",
            label: "task config",
            lines: [
              "task = PythonOperator(",
              "  task_id='load',",
              "  retries=3,",
              "  retry_delay=timedelta(minutes=5),",
              "  retry_exponential_backoff=True,",
              "  execution_timeout=timedelta(hours=1),",
              "  on_failure_callback=alert_slack)",
            ],
          },
        ],
        answerStructured:
          "- **Retries**: set `retries=N` on a task (or at the DAG default level). Airflow waits `retry_delay` (default 5 min, set as `timedelta`) between attempts. Failed tasks show `up_for_retry` status before the next attempt.\n- **Max retries**: once `retries` attempts are exhausted, the task moves to `failed` state and stops retrying.\n- **`retry_exponential_backoff=True`**: each retry waits progressively longer — useful for transient API rate limits.\n- **Alerting**: set `on_failure_callback` on the task or DAG with a callable that sends Slack/email/PagerDuty alerts. Airflow also has `email_on_failure=True` + an SMTP connection configured.\n- **SLA misses**: set `sla=timedelta(hours=2)` on a task — if it hasn't completed within 2 hours of the DAG run start, the `sla_miss_callback` fires (this is not the same as a timeout).\n- **`execution_timeout`**: kills the task if it exceeds the duration. Prevents zombie tasks from holding a worker slot indefinitely.",
        explanationDeep:
          "Retries and alerting are the basic reliability primitives in Airflow. The key mental model: retries handle transient failures (network blips, rate limits, temporary DB unavailability), while `on_failure_callback` is your production alerting hook. An alert on first failure with 3 retries is the standard pattern — don't alert until the task is truly failed, or you'll be paged every time a flaky API has a momentary outage.\n\nSLA misses are a subtler concept: they fire based on wall-clock duration since the DAG run started, not on failure. A slow task that runs 3 hours instead of 30 minutes will trigger the SLA miss even if it eventually succeeds. This is useful for long-tail detection (the task ran but was unacceptably slow) without having to predict max duration exactly.\n\n`execution_timeout` is the hard kill switch. Without it, a hung task (a network connection that never times out, a DB lock) will hold a worker slot forever, starving other tasks. Always set a reasonable timeout on tasks with external calls.",
        interviewerLens:
          "I want to see the distinction between retries (transient recovery) and alerting callbacks (notification). Candidates who only know `email_on_failure=True` haven't integrated Airflow into a production monitoring stack. SLA miss vs execution_timeout is a bonus — it shows you know both the soft (latency) and hard (timeout) reliability mechanisms.",
        followupChain: [
          {
            question: "How do you alert on DAG-level failure vs individual task failure?",
            answer: "DAG-level: set on_failure_callback on the DAG object — fires when the entire DAG run fails (all retries exhausted on a non-skipped task). Task-level: on_failure_callback on the task — fires per task failure. For production, I typically alert at the task level so I know which task is failing, not just that 'the DAG failed.'"
          }
        ],
        redFlags: [
          {
            junior: "\"I just set email_on_failure=True and leave it.\"",
            senior: "\"I configure on_failure_callback with the team's Slack/PagerDuty integration so the alert goes to the right channel with context, plus execution_timeout to prevent hung tasks from blocking the pool.\""
          }
        ],
        alternatePhrasings: [
          "\"How do you handle task failures in Airflow?\"",
          "\"What is an SLA miss in Airflow?\"",
          "\"How do you set up Airflow alerting?\""
        ],
        interviewContexts: [
          "Asked at a junior-to-mid data engineering transition role",
          "Reliability-focused interview at an e-commerce platform"
        ]
      },
      // ── decision-frameworks ───────────────────────────────────
      {
        category: "decision-frameworks",
        riskLevel: "medium",
        asked: 14,
        questionText:
          "catchup=True vs catchup=False — how do you decide which to set for a new DAG?",
        answerStructured:
          "- **`catchup=True`** (Airflow default): all intervals between `start_date` and now are scheduled as DAG runs. Safe if the DAG is idempotent and the pipeline genuinely needs historical data.\n- **`catchup=False`**: only the most recent interval runs on activation. Use this for: monitoring/alerting DAGs (running yesterday's alert today is useless), near-real-time ingestion where gaps don't matter, or any DAG where replaying history isn't required.\n- **Risk of `catchup=True` with an old `start_date`**: activating the DAG floods the scheduler with hundreds of runs simultaneously, hammering the source system and filling the executor queue.\n- **Pattern**: set `catchup=False` by default, pair with explicit `max_active_runs=1` for idempotent pipelines, and use `airflow dags backfill` CLI to replay specific intervals when genuinely needed.",
        explanationDeep:
          "The `catchup` decision is really a question about the semantics of historical data: does your pipeline produce anything meaningful by running an old interval, and does it need to? For an ETL that loads daily partitions into a data warehouse, historical intervals matter — set `catchup=True` and ensure idempotency. For a DAG that sends a daily email digest or checks an alert threshold, running last month's digest today is meaningless — set `catchup=False`.\n\nThe operational risk of `catchup=True` is underappreciated by juniors: a DAG with `start_date=2020-01-01` and `catchup=True` activated in 2024 will attempt to create ~1,400 daily DAG runs immediately. Even with concurrency limits, this floods the scheduler's task queue and can cause scheduler performance degradation. The safe practice is to set `start_date` to a recent date when enabling `catchup=True`, or to use `catchup=False` and run explicit backfills in controlled chunks.",
        interviewerLens:
          "I'm checking whether you understand the production risk of `catchup=True` with an old start_date. Candidates who say 'just use the default' without awareness of the flood risk have never activated a DAG with a six-month-old start_date. The 'decide based on whether replaying history is meaningful' framing shows real judgment.",
        followupChain: [
          {
            question: "How do you safely backfill a year of data without hammering the source?",
            answer: "Use `airflow dags backfill --start-date X --end-date Y dag_id` but control concurrency with `max_active_runs` on the DAG and a pool on the tasks. Run in chunks (month at a time) rather than all at once. This lets you monitor progress and abort if the source shows strain."
          }
        ],
        redFlags: [
          {
            junior: "\"I just leave it as the default (True) and don't think about it.\"",
            senior: "\"I default to catchup=False for most DAGs and use explicit backfills when I need historical data — an old start_date + catchup=True is a flood risk I avoid by design.\""
          }
        ],
        alternatePhrasings: [
          "\"What does catchup do in Airflow?\"",
          "\"Why is my new DAG running hundreds of times instantly?\"",
          "\"When would you want catchup enabled?\""
        ],
        interviewContexts: [
          "Junior DE interview at a fintech data team",
          "Airflow fundamentals screen at a mid-size SaaS company"
        ]
      },
      {
        category: "decision-frameworks",
        riskLevel: "low",
        asked: 11,
        questionText:
          "How do you set task dependencies in Airflow, and when would you use trigger rules other than the default?",
        code: [
          {
            lang: "airflow",
            label: "branch join",
            lines: [
              "branch >> [path_a, path_b] >> join",
              "",
              "join = EmptyOperator(",
              "  task_id='join',",
              "  # skipped branch won't cascade",
              "  trigger_rule='none_failed')",
            ],
          },
        ],
        answerStructured:
          "- Set dependencies with `>>` operator (`task_a >> task_b`) or `.set_downstream()`. For multiple: `[task_a, task_b] >> task_c`.\n- **Default trigger rule: `all_success`** — a task runs only when all upstream tasks succeeded. This is correct for most pipelines.\n- **Other rules**:\n  - `all_done`: run regardless of upstream success/failure/skip — good for cleanup tasks.\n  - `one_success`: run when at least one upstream succeeds — useful after branch operators.\n  - `none_failed`: run if no upstream failed (skipped is OK) — common after branching where some paths are skipped.\n  - `all_failed`: run only when all upstreams failed — good for 'send alert only if everything broke.'\n- **BranchPythonOperator** + `none_failed` downstream is the standard branching pattern.",
        explanationDeep:
          "Trigger rules are the mechanism Airflow uses to handle non-linear pipeline control flow. The default (`all_success`) assumes a linear happy path; the moment you introduce branching, parallel paths, or optional steps, you need to think about what the downstream tasks should do when some upstream tasks are skipped.\n\nThe most common non-default case is after a `BranchPythonOperator`: it marks the non-chosen path as `skipped`. With `all_success`, any task after the branch will also be skipped (because one of its upstreams was skipped, not succeeded). To let a final task (e.g., 'send completion notification') run regardless of which branch was taken, set its trigger rule to `none_failed` — runs if no upstream actually failed, but skips are OK.\n\n`all_done` is the cleanup rule: it runs even if upstreams failed, making it ideal for teardown steps (deleting temp files, releasing locks) that should always execute regardless of pipeline status.",
        interviewerLens:
          "Knowing `>>` syntax is table stakes. The senior signal at this level is knowing why `none_failed` exists after a branch — candidates who've shipped a pipeline with BranchPythonOperator have definitely hit the 'my downstream task is mysteriously skipped' bug and know the trigger rule fix.",
        followupChain: [
          {
            question: "What happens to downstream tasks when you skip a branch?",
            answer: "Tasks with the default all_success rule are skipped if any upstream is skipped. To prevent this from cascading through the DAG, tasks after the branch join should use none_failed or all_done, depending on whether they should also run on upstream failure."
          }
        ],
        redFlags: [
          {
            junior: "\"My tasks after the branch are always skipped — I don't know why.\"",
            senior: "\"That's the default all_success trigger rule — when a branch marks a path as skipped, downstream tasks see a non-success upstream and skip too. The join task needs none_failed.\""
          }
        ],
        alternatePhrasings: [
          "\"How do you set dependencies between Airflow tasks?\"",
          "\"What is a trigger rule?\"",
          "\"Why is my task being skipped even though the upstream ran?\""
        ],
        interviewContexts: [
          "Airflow fundamentals screen at a data platform team",
          "Junior DE role at a retail analytics company"
        ]
      },
      // ── tool-comparison ───────────────────────────────────────
      {
        category: "tool-comparison",
        riskLevel: "medium",
        isComparison: true,
        comparisonTools: ["TaskFlow API", "Classic Operators"],
        asked: 12,
        questionText:
          "TaskFlow API vs classic PythonOperator — what's the difference and when do you use each?",
        code: [
          {
            lang: "python",
            label: "Before",
            lines: [
              "def _f(**ctx):",
              "  return fetch()",
              "t = PythonOperator(",
              "  task_id='f', python_callable=_f)",
              "# pull XCom manually downstream",
            ],
          },
          {
            lang: "python",
            label: "After",
            lines: [
              "@task",
              "def f():",
              "  return fetch()  # auto XCom",
              "g(f())  # auto dependency",
            ],
          },
        ],
        answerStructured:
          "- **Classic PythonOperator**: explicitly define the task, pass `python_callable`, pass `op_kwargs`, and manually push/pull XComs to share data between tasks.\n- **TaskFlow API** (`@task` decorator, Airflow 2.0+): write plain Python functions decorated with `@task`. Return values are automatically pushed to XCom; calling one `@task` function from another auto-declares the dependency and pulls the XCom.\n- **TaskFlow DAG structure**: use `with DAG(...) as dag: ...` and call decorated functions — far less boilerplate.\n- **When to use TaskFlow**: Python-heavy pipelines where most tasks are Python callables. Cleaner code, auto-XCom, easier testing.\n- **When to stick with classic operators**: when using provider operators (BigQueryOperator, etc.) that have no `@task` equivalent, or when mixing Python tasks and external-system operators in the same DAG (you can mix both styles).",
        explanationDeep:
          "TaskFlow API is syntactic sugar — under the hood, `@task` creates a PythonOperator. The same Airflow scheduler semantics apply: the logical date model, retries, pools, and SLAs all work identically. The real gain is developer ergonomics: the XCom push/pull boilerplate disappears, dependencies are expressed as natural function calls, and the DAG reads more like Python code than XML-style task orchestration.\n\nThe tradeoff: because XComs are used for return values, any non-trivial data returned from a `@task` function goes through the metadata database. A function returning a 10-MB DataFrame will bloat the metadata DB and slow XCom pushes. The rule is the same as classic XComs: return small metadata (IDs, counts, file paths), not bulk data.\n\nMixing styles within a DAG is fully supported and common: a classic `BigQueryInsertJobOperator` can be a dependency of a `@task` function and vice versa. You're not forced to convert everything.",
        interviewerLens:
          "I want to know you understand TaskFlow is syntactic sugar over PythonOperator, not a fundamentally different execution model. Candidates who say 'TaskFlow is faster' or 'more scalable' reveal they don't know what it actually does. The 'XComs still go through the metadata DB' awareness is the correctness check.",
        followupChain: [
          {
            question: "How does dependency declaration differ between TaskFlow and classic operators?",
            answer: "In TaskFlow, calling task_b(task_a()) declares the dependency implicitly — Airflow sees that task_b depends on task_a's XCom output. In classic operators, you explicitly write task_a >> task_b with separate XCom.pull() calls. Same resulting DAG structure, different syntax."
          }
        ],
        redFlags: [
          {
            junior: "\"TaskFlow runs tasks differently / is faster than classic operators.\"",
            senior: "\"TaskFlow is syntactic sugar over PythonOperator — same execution model, less boilerplate. The scheduler and executor work identically.\""
          }
        ],
        alternatePhrasings: [
          "\"What is the @task decorator in Airflow?\"",
          "\"How do I share data between tasks in Airflow 2?\"",
          "\"Should I use TaskFlow or classic operators?\""
        ],
        interviewContexts: [
          "Airflow 2.x migration interview at a Series B data team",
          "Asked at a Python-heavy data engineering role"
        ]
      }
    ],
    topics: {
      moreDeepDives: [
        "What is a pool and how does it limit resource contention in Airflow?",
        "How does Airflow's metadata database work and what are the implications for scalability?",
        "What is the difference between a sensor in poke mode vs reschedule mode?",
        "How do you use Airflow Variables and Connections securely?",
        "What is a SubDAG and why is it generally discouraged in Airflow 2.x?"
      ],
      decisions: [
        "When should you split logic into multiple DAGs vs a single DAG with many tasks?",
        "start_date: how far back should you set it for a new production DAG?",
        "When do you use a FileSensor vs a TimeDeltaSensor vs an ExternalTaskSensor?"
      ],
      quickRef: [
        "What is execution_date / logical_date?",
        "What does catchup=True do when a DAG has an old start_date?",
        "What does >> operator do in a DAG definition?",
        "What is a pool in Airflow?",
        "What is an XCom?",
        "What is the default trigger rule?",
        "What is a task instance vs a task?",
        "What does the scheduler do vs the executor?",
        "What does @daily expand to as a cron expression?",
        "What is a DAG run vs a task instance?"
      ],
      redFlags: [
        {
          junior: "\"I use datetime.now() to get the current date in tasks.\"",
          senior: "\"I use {{ ds }} / {{ data_interval_start }} — datetime.now() breaks backfills since it returns wall-clock time, not the logical date.\""
        },
        {
          junior: "\"I set catchup=True on my DAG with a start_date from last year.\"",
          senior: "\"That creates a flood of historical runs instantly — I default to catchup=False and use explicit backfill CLI commands for historical data.\""
        },
        {
          junior: "\"I run my Spark job directly inside PythonOperator.\"",
          senior: "\"Airflow workers are for orchestration — heavy compute goes in an external system. I use SparkSubmitOperator or Databricks operator and let Airflow poll for completion.\""
        },
        {
          junior: "\"The DAG runs on the start_date.\"",
          senior: "\"The first run triggers after data_interval_end passes — a daily DAG with start_date Jan 1 first runs on Jan 2, processing the Jan 1–Jan 2 interval.\""
        },
        {
          junior: "\"I connect to the database at the top of my DAG file.\"",
          senior: "\"Top-level code runs on every scheduler parse cycle — all connections and I/O belong inside task callables or operators.\""
        },
        {
          junior: "\"My downstream task is skipped for no reason.\"",
          senior: "\"With all_success (default), a skipped upstream also skips the downstream — after a branch, downstream join tasks need trigger_rule='none_failed'.\""
        }
      ],
      checklist: [
        "Explain logical_date vs wall-clock time and why datetime.now() is wrong",
        "Know catchup risk with old start_date and how to control with max_active_runs",
        "Understand operator vs task instance vs DAG run semantics",
        "Know retry + on_failure_callback + execution_timeout pattern for production reliability",
        "Be able to explain TaskFlow API as syntactic sugar over PythonOperator"
      ],
      behavioral: [
        "Tell me about a time an Airflow DAG misbehaved in production — what happened and how did you fix it?",
        "Describe how you'd migrate a cron job to Airflow.",
        "How do you test an Airflow DAG before deploying to production?"
      ],
      reverse: [
        "What executor is the team running — Local, Celery, or Kubernetes?",
        "How do you deploy DAG code changes — CI/CD pipeline or manual sync?",
        "What's the biggest source of DAG reliability issues today?"
      ]
    }
  },

  // ─────────────────────────────────────────────────────────────
  // MID — Idempotency + partition overwrite, backfills + catchup,
  //        sensors vs deferrable operators, XComs + size limits, pools
  // ─────────────────────────────────────────────────────────────
  mid: {
    authored: [
      // ── deep-dives ────────────────────────────────────────────
      {
        category: "deep-dives",
        riskLevel: "high",
        freePreview: true,
        asked: 24,
        questionText:
          "What makes an Airflow DAG idempotent, and why does it matter for backfills?",
        code: [
          {
            accent: "bug",
            lang: "sql",
            lines: [
              "INSERT INTO sales",
              "SELECT * FROM staging;",
              "-- retry/backfill duplicates rows",
            ],
          },
          {
            accent: "fix",
            lang: "sql",
            lines: [
              "INSERT OVERWRITE sales",
              "PARTITION (dt = '{{ ds }}')",
              "SELECT * FROM staging;",
              "-- rerun converges, no dupes",
            ],
          },
        ],
        answerStructured:
          "- **Idempotent** = re-running a task for the same logical date produces the same result — no duplicates, no drift.\n- Achieve it by partitioning work on the **logical date** (`{{ ds }}` / `{{ data_interval_start }}`) and writing to a **deterministic partition you overwrite**, not append.\n- Use **`INSERT OVERWRITE` / delete-by-partition / MERGE** keyed on the logical date — never blind `INSERT`.\n- Keep tasks **atomic**: write to a temp location, then swap/rename so a mid-task failure never leaves partial state.\n- This makes **backfills and retries safe**: you can rerun any date range and get correct, identical results.\n- Anti-pattern: `datetime.now()` inside a task — a backfill of Jan 1 run on Feb 15 will use Feb 15's date, silently corrupting the partition.",
        explanationDeep:
          "Backfills are the core reason idempotency matters. Airflow's scheduler model lets you replay any historical interval — but only if your tasks are safe to rerun. If a task blindly appends rows, every retry and backfill doubles the data. If it overwrites the partition keyed on the logical date, reruns are harmless.\n\nThe partition overwrite pattern: write output to `s3://bucket/date={{ ds }}/` or `INSERT OVERWRITE partition(date='{{ ds }}')` in a Hive-style warehouse. The logical date macro binds the task to the interval it's processing, not when it ran. A backfill of 30 days will correctly write to 30 distinct partitions, each overwriting any prior run for that date.\n\nAtomicity is the second half: write to `_tmp/{{ ds }}/` then move to the final path, or use a BEGIN/COMMIT transaction. A task that fails halfway through and leaves partial data in the destination will cause wrong results on the next retry — which would overwrite the partial data with fresh partial data if atomicity is broken. Stage-then-swap is the safest pattern.",
        interviewerLens:
          "The phrases I'm waiting for are 'keyed on the logical date' and 'overwrite the partition.' If you say you INSERT rows, I know your backfills double-write and you've probably been burned by it or will be soon. Mentioning datetime.now() as an anti-pattern is a strong mid-level signal. Atomicity (staging write + swap) is the senior-level follow-up.",
        followupChain: [
          {
            question: "Why is datetime.now() inside a task a correctness bug?",
            answer: "A backfill of a historical date runs today but should process that historical interval. datetime.now() returns today's date, so the task reads or writes today's data for an old partition — silently corrupting or duplicating. Use {{ ds }} / {{ data_interval_start }} which binds to the logical date of the run, not wall-clock time."
          },
          {
            question: "How do you make a task that calls an external API idempotent?",
            answer: "Include the logical date as a deduplication key in the API call or write an idempotency key to the destination before calling. On retry, check if the key already exists and skip the API call if the work is done. Many APIs also accept an idempotency-key header for exactly this pattern."
          },
          {
            question: "Backfilling 2 years of data is hammering the source DB — what do you do?",
            answer: "Bound concurrency: set max_active_runs=1 or a small number on the DAG to limit parallel date runs. Add a pool with limited slots shared across the tasks that touch the source. Run the backfill in monthly chunks via CLI rather than all at once. Consider adding a rate-limit sleep or exponential backoff between calls."
          }
        ],
        redFlags: [
          {
            junior: "\"I just INSERT the new rows each run.\"",
            senior: "\"I overwrite the date partition keyed on the logical date — blind INSERT means every retry and backfill duplicates data.\""
          },
          {
            junior: "\"I use datetime.now() to get the run date.\"",
            senior: "\"I use {{ ds }} — datetime.now() breaks backfills since it returns wall-clock time instead of the logical interval date.\""
          }
        ],
        alternatePhrasings: [
          "\"How do you make a pipeline safe to re-run?\"",
          "\"Design an Airflow DAG that can be backfilled safely.\"",
          "\"What does idempotent mean in the context of Airflow?\""
        ],
        interviewContexts: [
          "Asked at a logistics company, Mid-level DE loop",
          "Came up in 3 separate orchestration-focused interviews",
          "Mid-level screen at a Series C data platform team"
        ]
      },
      {
        category: "deep-dives",
        riskLevel: "high",
        asked: 20,
        questionText:
          "How do XComs work in Airflow, and what are the size limit pitfalls you have to manage in production?",
        code: [
          {
            accent: "bug",
            lang: "python",
            lines: [
              "@task",
              "def extract():",
              "  return big_df  # bloats meta DB",
            ],
          },
          {
            accent: "fix",
            lang: "python",
            lines: [
              "@task",
              "def extract():",
              "  df.to_parquet(path)",
              "  return path  # pass a reference",
            ],
          },
        ],
        answerStructured:
          "- **XCom (Cross-Communication)**: a key-value store in the Airflow metadata database that tasks use to pass small data between each other.\n- A task pushes: `ti.xcom_push(key='record_count', value=1234)` or by returning a value in TaskFlow API. A downstream task pulls: `ti.xcom_pull(task_ids='upstream_task', key='record_count')`.\n- **Size limits matter**: XCom values are serialized and stored in the metadata DB (typically SQLite/MySQL/Postgres). SQLite has a 2 GB blob limit, Postgres BYTEA is effectively unconstrained but large values degrade scheduler performance — **the practical rule is keep XComs under ~48 KB**.\n- **Anti-pattern**: passing DataFrames, query results, or file contents through XCom. This bloats the metadata DB, slows scheduler queries, and can cause OOM on the worker during serialization.\n- **Correct pattern**: pass a reference (S3 path, GCS URI, BigQuery table name, row ID) through XCom; let the downstream task fetch the actual data from storage.\n- Airflow 2.7+ supports a custom XCom backend (e.g., S3-backed) to bypass metadata DB size limits for larger payloads.",
        explanationDeep:
          "XCom's storage location is the key constraint: values go into the metadata database, not a dedicated object store. The metadata DB is also used for task state, DAG run state, scheduler heartbeats, and log pointers — it's a shared, performance-critical resource. Stuffing multi-MB DataFrames into XCom increases the size of every scheduler DB query and can cause table bloat that degrades the entire Airflow installation over time.\n\nThe solution is the 'pointer pattern': tasks produce data in object storage or a data warehouse and push only the location reference (a path, a table name, a job ID) to XCom. The downstream task receives the pointer and fetches the data from the fast, scalable storage layer — not from the metadata DB. This also makes tasks naturally idempotent: the storage location is deterministic (keyed on the logical date and task ID), so retries read from the same path.\n\nTaskFlow API implicitly uses XCom for return values — this is convenient but means large return values from @task functions still hit the metadata DB. If you're returning a list of 50,000 record IDs, use a file pointer instead. Airflow 2.7+ custom XCom backends (S3, GCS) let you store large XCom values in object storage transparently, but the default behavior still applies to most installations.",
        interviewerLens:
          "Anyone can explain XCom push/pull. The production signal is knowing the size limit and the pointer pattern — 'pass a path, not the data.' Candidates who say 'I pass my DataFrame through XCom' have never run this at scale and caused metadata DB bloat. Knowing about custom XCom backends is a strong senior/mid-senior signal.",
        followupChain: [
          {
            question: "How does TaskFlow API interact with XComs?",
            answer: "TaskFlow @task functions automatically push return values to XCom and pull them when called from another @task. This is convenient but doesn't bypass the metadata DB — a function returning a large object still stores it in XCom. Use the pointer pattern: return a path or ID, not the data itself."
          },
          {
            question: "What is the XCom backend and when would you configure it?",
            answer: "The XCom backend is a configurable storage class for XCom values. The default stores in the metadata DB. Custom backends (e.g., Astronomer's S3 or GCS backend) redirect XCom storage to object storage, enabling larger payloads without DB bloat. Use it when tasks legitimately need to pass larger intermediate data and can't be refactored to use the pointer pattern."
          }
        ],
        redFlags: [
          {
            junior: "\"I pass my query results / DataFrame through XCom to the next task.\"",
            senior: "\"XCom stores in the metadata DB — I pass a file path or table name, not the data. The downstream task fetches from storage.\""
          },
          {
            junior: "\"XCom doesn't have size limits.\"",
            senior: "\"XCom values land in the metadata DB. Large values degrade scheduler performance — I keep XComs under ~48 KB and use the pointer pattern for anything larger.\""
          }
        ],
        alternatePhrasings: [
          "\"How do you share data between Airflow tasks?\"",
          "\"What are the limitations of XCom?\"",
          "\"How do you pass a file path from one task to another?\""
        ],
        interviewContexts: [
          "Mid-level DE screen at a Series B analytics company",
          "Asked at an Airflow architecture review at a data platform team"
        ]
      },
      {
        category: "deep-dives",
        riskLevel: "high",
        asked: 18,
        questionText:
          "Sensors vs deferrable operators — what is the resource difference and when do you use each?",
        code: [
          {
            lang: "airflow",
            label: "free the slot",
            lines: [
              "wait = S3KeySensor(",
              "  task_id='wait',",
              "  bucket_key='s3://b/{{ ds }}/_OK',",
              "  deferrable=True,  # frees slot",
              "  poke_interval=300)",
              "# Triggerer runs the async poll",
            ],
          },
        ],
        answerStructured:
          "- **Sensor (poke mode)**: holds a worker slot for the entire wait period, polling the condition every `poke_interval` seconds. Simple but wasteful — a sensor waiting 4 hours ties up a worker slot the whole time.\n- **Sensor (reschedule mode)**: `mode='reschedule'` — the task releases its worker slot between poke intervals, re-queuing when the interval elapses. Much more efficient for long waits; adds latency of one poke interval on completion.\n- **Deferrable operators** (Airflow 2.2+): the task suspends itself (`raise AirflowException` internally with `defer()`), releases the worker slot entirely, and registers a **Trigger** with the **Triggerer** process. The Triggerer runs an asyncio event loop and fires when the condition is met — hundreds of deferred tasks can run in a single Triggerer process.\n- **Decision**: prefer deferrable operators when available; use reschedule mode as a fallback (no Triggerer available); avoid poke mode for waits longer than a few minutes.",
        explanationDeep:
          "The core insight is what occupies a worker slot. Worker slots are finite — every sensor in poke mode burns a slot whether it's doing anything useful or not. At scale, if you have 50 DAGs each waiting for an S3 file upload, you've burned 50 worker slots for tasks that are literally sleeping. This starves actual compute tasks of slots.\n\nReschedule mode fixes this: the sensor marks itself as `up_for_reschedule`, releases the slot, and gets re-queued after the interval. Only one slot is needed at the moment of the actual poke. The downside is added latency: if the file lands 1 second after a poke, the sensor won't notice until the next poke interval.\n\nDeferrable operators are the architecture-level solution: they hand off the polling responsibility to the Triggerer, a separate asyncio process that can efficiently multiplex thousands of async polls. The worker slot is freed immediately on deferral. When the condition is met (the file exists, the job finishes), the Triggerer fires, and the task is re-queued to a worker to complete execution. This is dramatically more resource-efficient than either sensor mode for large-scale deployments.",
        interviewerLens:
          "I'm listening for the worker-slot framing — 'poke mode ties up a worker slot for the entire wait.' Candidates who know about the Triggerer component and asyncio event loop for deferrable operators show they understand Airflow 2.x architecture, not just 1.x. Reschedule mode as a middle ground is the practical fallback answer.",
        followupChain: [
          {
            question: "What Airflow infrastructure component does a deferrable operator require?",
            answer: "The Triggerer — a separate Airflow service that runs an asyncio event loop. You must deploy it alongside the scheduler and workers. Without it, deferrable operators will fail. On Astronomer and most managed Airflow providers, the Triggerer is included by default."
          },
          {
            question: "You have 200 sensors waiting for files — how does this affect worker slot availability?",
            answer: "In poke mode: 200 slots consumed with zero useful work. In reschedule mode: slots are released between polls, so effectively 1 slot in use at a time per sensor. With deferrable operators: 0 worker slots — all polling is in the Triggerer's asyncio loop. Deferrable scales linearly; poke mode hits the slot ceiling quickly."
          }
        ],
        redFlags: [
          {
            junior: "\"I use sensors in poke mode — it's simpler.\"",
            senior: "\"Poke mode holds a worker slot for the entire wait. For anything over a few minutes, I use reschedule mode or a deferrable operator to free the slot.\""
          },
          {
            junior: "\"Sensors and deferrable operators do the same thing.\"",
            senior: "\"Sensors in poke mode occupy a worker slot while waiting. Deferrable operators release the slot and delegate polling to the Triggerer's asyncio event loop — far more resource efficient at scale.\""
          }
        ],
        alternatePhrasings: [
          "\"What is a deferrable operator in Airflow?\"",
          "\"What is the Triggerer component?\"",
          "\"How do you wait for an external event in Airflow without wasting resources?\""
        ],
        interviewContexts: [
          "Mid-level DE screen at a cloud-scale data platform",
          "Airflow 2.x architecture interview at a Series C company"
        ]
      },
      {
        category: "deep-dives",
        riskLevel: "medium",
        asked: 14,
        questionText:
          "How do Airflow pools work, and when do you reach for them to manage resource contention?",
        code: [
          {
            lang: "airflow",
            label: "throttle a shared API",
            lines: [
              "# pool 'api_pool' has 5 slots",
              "call = PythonOperator(",
              "  task_id='call_api',",
              "  python_callable=hit_api,",
              "  pool='api_pool',",
              "  pool_slots=1)  # <=5 across DAGs",
            ],
          },
        ],
        answerStructured:
          "- A **pool** is a named slot bucket in Airflow that limits how many task instances using that pool can run concurrently across all DAGs.\n- Tasks declare membership: `PythonOperator(pool='snowflake_pool', pool_slots=1, ...)`.\n- A pool with `slots=5` allows at most 5 tasks using that pool to run simultaneously — regardless of how many DAGs or workers are active.\n- **Use cases**: throttle calls to a rate-limited API, limit concurrent queries to a shared database, prevent backfills from overwhelming a source system.\n- Configure via UI (Admin → Pools) or `airflow pools set <name> <slots> <description>` CLI.\n- Default pool (`default_pool`) has 128 slots — all tasks that don't specify a pool share it.",
        explanationDeep:
          "Pools solve a problem that concurrency settings alone can't: cross-DAG resource contention. `max_active_tasks` limits tasks within a single DAG; `parallelism` limits total tasks in the deployment. Neither gives you fine-grained control over a specific shared resource like 'this Snowflake account can only handle 10 concurrent queries across all my pipelines.'\n\nA pool named `snowflake_prod` with 10 slots, applied to every task that queries Snowflake, ensures at most 10 Snowflake queries run at once — regardless of how many DAGs are running, how many backfills are in flight, or what the overall parallelism setting is. This is the right tool for protecting downstream systems during peak load or backfill storms.\n\n`pool_slots` (how many slots a single task instance claims) is useful for tasks that are unusually resource-intensive: a heavy export task might claim 3 slots to model that it uses 3x the resources of a normal query. This gives coarse-grained resource weighting within a pool.",
        interviewerLens:
          "I want to see that you know pools operate at the cross-DAG level — that's the key insight. Candidates who only know about `max_active_tasks` haven't needed to protect a shared resource across multiple DAGs. The backfill use case ('limit the backfill from hammering the source') is the most concrete real-world application.",
        followupChain: [
          {
            question: "Pools vs priority weights — when do you use each?",
            answer: "Pools limit concurrency (hard cap). Priority weights determine which queued tasks run first when slots open up (soft ordering). Use pools to protect a resource; use priority weights to ensure critical DAGs get slots before low-priority backfills when the pool is contended."
          }
        ],
        redFlags: [
          {
            junior: "\"I use max_active_runs to limit how much hits the database.\"",
            senior: "\"max_active_runs limits parallel DAG runs of a single DAG. Pools control concurrency across all DAGs that share a resource — that's what I reach for to protect a shared DB or API.\""
          }
        ],
        alternatePhrasings: [
          "\"How do you prevent too many concurrent queries to a shared DB?\"",
          "\"What is an Airflow pool?\"",
          "\"How do you throttle task execution in Airflow?\""
        ],
        interviewContexts: [
          "Mid-level DE interview at a company with many concurrent DAGs and a shared Redshift cluster",
          "Asked at an Airflow production operations discussion"
        ]
      },
      // ── decision-frameworks ───────────────────────────────────
      {
        category: "decision-frameworks",
        riskLevel: "medium",
        asked: 13,
        questionText:
          "A task is writing rows to a database every run. Walk me through how you'd make it idempotent.",
        code: [
          {
            accent: "bug",
            lang: "sql",
            lines: [
              "ALTER TABLE t",
              "  ADD UNIQUE (id);",
              "-- rerun ERRORS, not idempotent",
            ],
          },
          {
            accent: "fix",
            lang: "sql",
            lines: [
              "DELETE FROM t",
              "WHERE dt = '{{ ds }}';",
              "INSERT INTO t SELECT * FROM stg;",
              "-- rerun converges to same state",
            ],
          },
        ],
        answerStructured:
          "- **Step 1: Identify the partition key** — usually the logical date (`{{ ds }}`). What uniquely identifies the data this task produces?\n- **Step 2: Replace append with overwrite**: `DELETE FROM table WHERE date = '{{ ds }}'; INSERT ...` (atomic delete+insert) or `MERGE` with the date as a match key, or partition overwrite if the warehouse supports it.\n- **Step 3: Make the delete/insert transactional** — wrap in a BEGIN/COMMIT or use the warehouse's atomic partition replace so a mid-task failure doesn't leave the date partially deleted.\n- **Step 4: Remove datetime.now()** — replace with `{{ ds }}` everywhere. Any hardcoded or dynamic 'today' date breaks backfills.\n- **Step 5: Test by running the task twice for the same date** — row counts should be identical both times.",
        explanationDeep:
          "The core transformation is from append semantics to upsert/overwrite semantics. An append task says 'add these rows'; an idempotent task says 'make this partition look exactly like this, regardless of what was there before.' The outcome is the same on first run; on subsequent runs for the same date, an append accumulates while an overwrite converges.\n\nThe transactional wrapper is what separates a robust implementation from a fragile one: if you delete and then the insert fails halfway, the partition is now empty — worse than the duplicate state you were trying to fix. Wrapping in a transaction (or using atomic partition swap in a columnar warehouse like BigQuery or Snowflake) ensures you never leave the destination in a degraded state.\n\nThe double-run test is the idempotency acceptance test: if running a task twice for `ds=2024-01-15` produces the same row count and values both times, the task is idempotent. If it doubles the row count, it's not. This is a fast and definitive check you can run in development before pushing to production.",
        interviewerLens:
          "I'm looking for the systematic approach: identify the partition key, replace append with overwrite, add transactional safety, remove datetime.now(). Candidates who say 'use a unique constraint to deduplicate' without changing the write pattern are solving the symptom, not the cause — unique constraints cause insert errors rather than preventing duplicate writes.",
        followupChain: [
          {
            question: "How do you handle idempotency when writing to object storage instead of a database?",
            answer: "Write to a path keyed on the logical date: s3://bucket/table/date={{ ds }}/. On rerun, the file is overwritten (S3 PUT is inherently idempotent — last writer wins). If the task writes multiple files, write to a _tmp path and rename to final atomically after all files are written, to avoid partially-complete partitions being read by downstream."
          }
        ],
        redFlags: [
          {
            junior: "\"I'd add a unique constraint to the table to prevent duplicates.\"",
            senior: "\"A unique constraint causes errors, not idempotency. The right fix is delete-then-insert or MERGE on the partition key so reruns converge to the correct state instead of erroring.\""
          }
        ],
        alternatePhrasings: [
          "\"How do you prevent duplicate data in an Airflow pipeline?\"",
          "\"Your task ran twice due to a retry — now there's double the rows. How do you fix it?\""
        ],
        interviewContexts: [
          "Mid-level DE screen at a data quality-focused team",
          "Asked during an Airflow production design discussion"
        ]
      },
      {
        category: "decision-frameworks",
        riskLevel: "medium",
        asked: 11,
        questionText:
          "How do you decide whether to use `depends_on_past=True` vs controlling rerun behavior with other Airflow primitives?",
        code: [
          {
            lang: "airflow",
            label: "stateful only",
            lines: [
              "running_total = PythonOperator(",
              "  task_id='cum_sum',",
              "  python_callable=add_day,",
              "  # needs prior run to succeed",
              "  depends_on_past=True)",
              "# stateless? use max_active_runs",
            ],
          },
        ],
        answerStructured:
          "- **`depends_on_past=True`**: a task instance will only run if the **same task in the previous DAG run** succeeded. Creates a sequential dependency across time — Jan 3's run won't start until Jan 2's run for that task completed successfully.\n- **Use it when**: tasks are inherently sequential and state-dependent across dates — e.g., a cumulative counter that builds on the previous day's state.\n- **Avoid it when**: tasks are stateless/idempotent — `depends_on_past` serializes runs unnecessarily and can block backfills entirely (if Jan 1 fails, Jan 2 through Jan 30 all queue up waiting).\n- **Better alternatives for most cases**: idempotent partition-overwrite tasks + `max_active_runs=1` (limits parallelism without creating a blocking dependency chain); pools (throttles concurrency).\n- **Risk**: a single `failed` task instance with `depends_on_past=True` blocks all future runs of that task — manual intervention required to clear the failed instance.",
        explanationDeep:
          "The practical problem with `depends_on_past=True` is that it creates fragile dependency chains across time. If day N fails, days N+1, N+2, ... all pile up in the `waiting` state. For a genuinely cumulative process (an incrementing counter, a forward-fill of state), this chain is necessary and correct — you can't compute day N+1 without day N's output. But for idempotent ETL tasks that just partition-overwrite a date, the serial chain is unnecessary friction.\n\nThe safer default is: design tasks to be idempotent, use `max_active_runs` to prevent overwhelming the source system, and use pools for resource throttling. Only reach for `depends_on_past=True` when there is a genuine data dependency between adjacent runs — and when you do, add monitoring and a runbook for clearing the blocking failure.",
        interviewerLens:
          "I want to know you understand the cascading-block risk of depends_on_past. 'It's useful when tasks depend on previous state' is correct but incomplete. The production signal is the awareness that a single failed instance blocks all future runs and the recognition that most idempotent tasks don't need it — they just need max_active_runs or a pool.",
        followupChain: [
          {
            question: "How do you unblock a DAG that's stuck because depends_on_past is failing?",
            answer: "Clear the failed task instance (or the whole DAG run) in the Airflow UI or CLI: `airflow tasks clear dag_id -t task_id -s start_date`. Once cleared, the task is re-queued and the dependency chain unblocks. Alternatively, mark the failed instance as 'success' if you've determined the failure was transient and the data is actually correct."
          }
        ],
        redFlags: [
          {
            junior: "\"I use depends_on_past=True on all my tasks to keep things ordered.\"",
            senior: "\"depends_on_past is for genuinely stateful tasks. For idempotent partition-overwrite tasks, it's unnecessary and creates cascading blocks — I use max_active_runs or pools instead.\""
          }
        ],
        alternatePhrasings: [
          "\"What does depends_on_past do in Airflow?\"",
          "\"Why are all my task instances stuck in the 'waiting' state?\""
        ],
        interviewContexts: [
          "Mid-level DE interview at a company with complex backfill requirements",
          "Asked during an Airflow troubleshooting scenario question"
        ]
      },
      // ── tool-comparison ───────────────────────────────────────
      {
        category: "tool-comparison",
        riskLevel: "high",
        isComparison: true,
        comparisonTools: ["Sensor (poke)", "Sensor (reschedule)", "Deferrable Operator"],
        asked: 16,
        questionText:
          "Compare sensor poke mode, reschedule mode, and deferrable operators. When do you use each and what are the infrastructure implications?",
        answerStructured:
          "- **Poke mode**: sensor holds the worker slot, polls every `poke_interval`. Simple but slot-expensive. Use only for short waits (seconds to a few minutes) where slot waste is acceptable.\n- **Reschedule mode** (`mode='reschedule'`): sensor releases the slot between polls, status becomes `up_for_reschedule`. Good for longer waits (hours) when a Triggerer isn't available. Adds latency of one poke interval on wakeup.\n- **Deferrable operator** (Airflow 2.2+): task suspends via `self.defer()`, releases slot immediately, registers a **Trigger** in the Triggerer's asyncio event loop. Worker slot is 0 while waiting. Hundreds of deferrable tasks run per Triggerer process.\n- **Infrastructure requirement**: deferrable operators require the **Triggerer** service running. Poke/reschedule modes have no extra infrastructure requirement.\n- **Cost ordering** (best to worst, slot efficiency): Deferrable > Reschedule > Poke.\n- **Recommendation**: always prefer deferrable when available; use reschedule as a fallback; avoid long-duration poke mode in production.",
        explanationDeep:
          "The worker slot is the finite resource in Airflow. Every slot occupied by a waiting sensor is a slot unavailable for actual compute tasks. At small scale (2-3 DAGs, 10 workers) this doesn't matter. At medium-large scale (dozens of DAGs, common in data platforms), sensors in poke mode can consume the majority of worker slots, causing compute tasks to queue up behind sleeping sensors.\n\nReschedule mode was the pragmatic fix before Airflow 2.2: tasks release slots between polls. The scheduler re-queues the task when the poll interval elapses, but the slot is available in between. The downside is that re-queuing adds latency — if the file appears 1 second after a poke, the sensor won't notice until the next poke interval (which might be 60 seconds or more).\n\nDeferrable operators are the architectural solution: they move all polling entirely out of the worker process and into the Triggerer, an asyncio-based service. asyncio is non-blocking, so a single Triggerer can efficiently multiplex thousands of concurrent async polls with minimal CPU. When a condition is met, the Triggerer fires a signal, and the task is re-queued to a worker to complete its final logic. Worker slots are freed immediately on deferral and only consumed again when the condition is met.",
        interviewerLens:
          "The key discriminator is 'what occupies the worker slot.' Candidates who only know about poke and reschedule modes are working from an Airflow 1.x mental model. Knowing the Triggerer and asyncio architecture shows you're current with Airflow 2.2+ production patterns. The infrastructure requirement caveat (Triggerer must be running) shows operational awareness.",
        followupChain: [
          {
            question: "How do you convert an existing sensor to use deferrable mode?",
            answer: "Most official Airflow providers (S3Sensor, BigQueryTableExistenceSensor, etc.) now have deferrable versions or a deferrable=True parameter. For custom sensors, inherit from BaseSensorOperator and implement the execute_complete method alongside standard execute — when the condition isn't met, call self.defer(trigger=MyTrigger(...), method_name='execute_complete')."
          },
          {
            question: "What happens to deferred tasks if the Triggerer crashes?",
            answer: "Deferred tasks are stateless by design — the Trigger state is stored in the metadata DB. When the Triggerer restarts, it re-registers all pending triggers and resumes polling. Deferred tasks won't fail due to a Triggerer restart, only if the Triggerer stays down long enough for the task's execution timeout to expire."
          }
        ],
        redFlags: [
          {
            junior: "\"I use sensors in poke mode — they're easier to understand.\"",
            senior: "\"Poke mode holds a worker slot for the entire wait. In production with many DAGs, I use reschedule mode as a minimum, or deferrable operators if the Triggerer is available.\""
          }
        ],
        alternatePhrasings: [
          "\"What are the different modes for Airflow sensors?\"",
          "\"What is a deferrable operator?\"",
          "\"How do you efficiently wait for an external file or event in Airflow?\""
        ],
        interviewContexts: [
          "Mid-to-senior DE screen at a data platform with dozens of DAGs",
          "Airflow 2.x architecture deep-dive at a Series C company"
        ]
      }
    ],
    topics: {
      moreDeepDives: [
        "How do you implement cross-DAG dependencies with ExternalTaskSensor and what are the gotchas?",
        "Dynamic task mapping with expand() — how does it work and what are the limits?",
        "How do you debug a DAG that's stuck with tasks in the queued state?",
        "TaskGroup vs SubDAG — why is SubDAG deprecated and what do you use instead?",
        "How do you manage Airflow Variables and Connections at scale across multiple environments?"
      ],
      decisions: [
        "Pools vs priority_weight vs max_active_runs — which lever for which problem?",
        "When is a monolithic DAG vs multiple smaller DAGs the right choice?",
        "ExternalTaskSensor vs Dataset triggers (Airflow 2.4+) for cross-DAG dependencies?"
      ],
      quickRef: [
        "What is execution_date / logical_date vs data_interval_start?",
        "What does catchup=True do with an old start_date?",
        "What is a pool and how is it different from max_active_tasks?",
        "Sensor poke mode vs reschedule mode — what's the slot difference?",
        "What does an XCom store and where?",
        "What does depends_on_past=True block on?",
        "What is the Triggerer component in Airflow 2.2+?",
        "What is a trigger rule and what is the default?",
        "How large should XCom values be in practice?",
        "What does max_active_runs control on a DAG?"
      ],
      redFlags: [
        {
          junior: "\"I pass DataFrames through XCom between tasks.\"",
          senior: "\"XCom values go into the metadata DB — I pass a file path or table name and let the downstream task fetch the data from storage.\""
        },
        {
          junior: "\"I use poke mode for all my sensors.\"",
          senior: "\"Poke mode holds a worker slot for the entire wait — I use reschedule mode for longer waits, or deferrable operators with the Triggerer when available.\""
        },
        {
          junior: "\"I use datetime.now() in my task to get the partition date.\"",
          senior: "\"datetime.now() breaks backfills — I use {{ ds }} / {{ data_interval_start }} so the task processes the correct logical interval.\""
        },
        {
          junior: "\"I use depends_on_past=True on everything to keep tasks ordered.\"",
          senior: "\"depends_on_past creates cascading blocks — a single failure stalls all future runs. For idempotent tasks, max_active_runs or pools are the right throttle.\""
        },
        {
          junior: "\"I use max_active_runs to protect my shared database.\"",
          senior: "\"max_active_runs limits a single DAG's parallel runs. To throttle cross-DAG resource usage on a shared DB, I use a pool shared across all relevant tasks.\""
        },
        {
          junior: "\"I blind INSERT rows in each run.\"",
          senior: "\"Blind INSERT duplicates on every retry and backfill — I use partition overwrite or MERGE keyed on the logical date to make the task idempotent.\""
        }
      ],
      checklist: [
        "Idempotency: logical date as partition key, overwrite not append, atomic staging",
        "XCom: metadata DB storage, pointer pattern, ~48 KB practical limit",
        "Sensor modes: slot occupation difference between poke, reschedule, and deferrable",
        "Pools: cross-DAG concurrency throttling, difference from max_active_runs",
        "depends_on_past: when to use it, cascading-block risk, how to clear"
      ],
      behavioral: [
        "Describe a time a backfill went wrong in production — what happened and how did you fix it?",
        "How did you reduce DAG flakiness or task retries on a pipeline you owned?",
        "Tell me about a time you hit XCom or pool limits — what was the impact and what did you do?"
      ],
      reverse: [
        "What executor is the platform running — are deferrable operators / Triggerer available?",
        "How do you handle shared resource contention across many DAGs today?",
        "What does the DAG deployment process look like — GitOps, manual sync, Astronomer?"
      ]
    }
  },

  // ─────────────────────────────────────────────────────────────
  // SENIOR — Backfill concurrency, executors, cross-DAG deps,
  //           datetime.now() anti-pattern, dynamic task mapping
  // ─────────────────────────────────────────────────────────────
  senior: {
    authored: [
      // ── deep-dives ────────────────────────────────────────────
      {
        category: "deep-dives",
        riskLevel: "high",
        freePreview: true,
        asked: 21,
        questionText:
          "You need to backfill 18 months of daily data. Walk me through how you control concurrency to avoid overwhelming the source system and the Airflow scheduler.",
        code: [
          {
            accent: "bug",
            lang: "airflow",
            lines: [
              "DAG(start_date=datetime(2024,1,1),",
              "    schedule='@daily',",
              "    catchup=True)",
              "# 547 runs queued at once",
            ],
          },
          {
            accent: "fix",
            lang: "airflow",
            lines: [
              "DAG(catchup=False,",
              "    max_active_runs=3)",
              "# then chunked CLI backfill:",
              "# airflow dags backfill -s ... -e ...",
            ],
          },
        ],
        answerStructured:
          "- **`max_active_runs`** on the DAG: limits how many DAG runs (i.e., date intervals) can execute simultaneously. Setting `max_active_runs=3` means at most 3 dates run in parallel — the rest queue.\n- **Pool** on the tasks: cross-DAG resource throttle. Create a pool with a slot count matched to what the source can handle; assign every task touching the source to that pool.\n- **`depends_on_past=True`** (use sparingly): serializes runs to one-at-a-time. Only use if there's a genuine sequential data dependency — for idempotent tasks it's overkill and creates blocking chains.\n- **Chunked backfill via CLI**: `airflow dags backfill -s 2023-01-01 -e 2023-03-31 dag_id` — run month by month, monitor between chunks.\n- **Catchup risk**: `catchup=True` with a backfill-length start_date floods the scheduler queue immediately. Use `catchup=False` + explicit `backfill` command to control the release rate.\n- **Monitor**: watch the source DB connection count, Airflow scheduler heartbeat, and metadata DB query latency throughout.",
        explanationDeep:
          "An 18-month daily backfill creates 547 DAG runs. If the executor can parallelize 100 tasks at once and each DAG run has 5 tasks, you could theoretically have 2,735 tasks queued simultaneously. The Airflow scheduler has to track all of them, and the source database sees hundreds of parallel queries — most source systems aren't designed for this.\n\nThe layered concurrency control is the senior answer: `max_active_runs` controls DAG-level parallelism (date slots), pools control resource-level parallelism (DB connections), and the chunked backfill CLI approach controls the total queue depth. These three mechanisms in combination give precise control over the blast radius of the backfill.\n\nThe scheduler's metadata DB is also a constraint often missed: hundreds of simultaneously queued task instances produce frequent state-update queries. In a high-concurrency backfill, the scheduler heartbeat can slow or fail, causing cascading delays. Monitoring the scheduler's heartbeat and the metadata DB's query latency is part of managing a large backfill — not just the source system.\n\nDependency sequencing matters too: if the backfill is for a table that downstream DAGs query, you need to decide whether to pause those downstream DAGs during the backfill or accept that they'll see a partially-backfilled table. The safest approach is to backfill in a staging environment or alternate table name, validate, and swap.",
        interviewerLens:
          "I'm looking for the three-layer approach: max_active_runs + pool + chunked CLI. Candidates who say 'just run the backfill and wait' have never managed a large-scale backfill in production. The scheduler metadata DB as a constraint is a bonus signal — it shows operational depth beyond just the source system. Mentioning downstream DAG impact is the architecture-level thinking I want to see.",
        followupChain: [
          {
            question: "max_active_runs=1 vs depends_on_past=True — what's the difference?",
            answer: "max_active_runs=1 limits the whole DAG to one active run at a time, but tasks within that run can still parallel-execute. depends_on_past=True adds a task-to-task sequential dependency across DAG runs — task N for date D won't run until task N for date D-1 succeeded. max_active_runs is simpler and less fragile; depends_on_past creates cascading blocks on failure."
          },
          {
            question: "How do you monitor a backfill without constantly watching the UI?",
            answer: "Set up alerts on pool slot utilization (custom metrics), track scheduler heartbeat latency, and query the task_instance table for failed/stuck instances. In production, I'd set on_failure_callback on the backfill DAG to page me immediately on any failure so I can triage before the 547-run queue gets further ahead of the problem."
          }
        ],
        redFlags: [
          {
            junior: "\"I'd set catchup=True with the old start_date and let Airflow handle it.\"",
            senior: "\"That floods the scheduler with 547 queued DAG runs instantly. I use max_active_runs + a pool + chunked backfill CLI to control the release rate and protect both the source and the scheduler.\""
          },
          {
            junior: "\"I'd just run the backfill and hope the source handles it.\"",
            senior: "\"The source system and the Airflow scheduler are both constraints. I measure what the source can handle, set pool slots accordingly, and monitor scheduler heartbeat throughout.\""
          }
        ],
        alternatePhrasings: [
          "\"How do you safely backfill historical data in Airflow?\"",
          "\"A backfill is hammering the source database — what do you do?\"",
          "\"Walk me through max_active_runs and when you use it.\""
        ],
        interviewContexts: [
          "Senior DE loop at a Series C data infrastructure team",
          "Came up in 3 production Airflow operations interviews",
          "Staff-level Airflow architecture discussion at a logistics company"
        ]
      },
      {
        category: "deep-dives",
        riskLevel: "high",
        asked: 19,
        questionText:
          "Compare LocalExecutor, CeleryExecutor, and KubernetesExecutor. What are the real trade-offs and how do you choose?",
        answerStructured:
          "- **LocalExecutor**: runs tasks as subprocesses on the same machine as the scheduler. Simple, low ops overhead, fine for small teams with low task volume. Single point of failure; doesn't scale horizontally.\n- **CeleryExecutor**: distributes tasks to a pool of Celery workers via a message broker (Redis or RabbitMQ). Workers are pre-provisioned, so task startup is fast (~1s). Scales horizontally by adding workers. Con: idle workers cost money when the queue is empty; worker environment drift if workers aren't kept in sync; harder to debug worker failures.\n- **KubernetesExecutor**: launches a fresh Kubernetes Pod per task. No idle workers — you only pay for compute when tasks run. Full task isolation (separate environment per task). Con: pod startup latency (15-60s per task), more Kubernetes complexity, requires a K8s cluster.\n- **CeleryKubernetesExecutor**: hybrid — most tasks go to Celery workers (fast), specific tasks route to Kubernetes pods via `queue='kubernetes'` (isolation/resources).\n- **Decision framework**: LocalExecutor for dev/small teams; CeleryExecutor for steady high-throughput with latency requirements; KubernetesExecutor for bursty workloads, cost sensitivity, or strong isolation requirements.",
        explanationDeep:
          "The core trade-off is startup latency vs idle cost. Celery workers are always-on: they pick up tasks instantly but cost money 24/7 even when idle. Kubernetes pods are on-demand: zero idle cost but 15-60 seconds of pod creation latency before a task starts. For a pipeline with tight SLAs (a task must start within 30 seconds of trigger), Celery wins. For a pipeline with burst patterns (hundreds of tasks for an hour, nothing for 23 hours), Kubernetes wins on cost.\n\nEnvironment management is the operational asymmetry: all Celery workers must run the same Python environment as the scheduler. Keeping them in sync (same package versions, same secrets mounted) is ops work that grows with team size. Kubernetes pods can each have a different Docker image — a task that needs a specific library version or a specific memory profile gets its own image, independent of all other tasks. This is the 'strong isolation' benefit.\n\nThe CeleryKubernetesExecutor hybrid is worth knowing for senior conversations: route time-sensitive standard tasks to always-on Celery workers, and route resource-intensive or environment-specific tasks to Kubernetes pods. This is the pattern Astronomer and large-scale Airflow deployments use to balance latency and cost.\n\nFor Airflow 2.6+, there's also the concept of executor plugins and multi-executor support (experimental), but the three classic executors remain the standard production choice.",
        interviewerLens:
          "I'm looking for the startup latency vs idle cost framing first — that's the core decision driver. Environment isolation is the second axis. Candidates who say 'Kubernetes is always better' haven't operated a Celery deployment with tight task latency requirements. The hybrid CeleryKubernetesExecutor shows you know how real-world deployments balance the trade-offs.",
        followupChain: [
          {
            question: "Your KubernetesExecutor tasks take 45 seconds to start — your SLA is 60 seconds. What do you do?",
            answer: "Several options: pre-pull the container image on all nodes (eliminates image pull time, reduces to pod scheduling latency). Use smaller base images. Switch critical-path tasks to CeleryExecutor (hybrid executor). Use a node pool with pre-warmed nodes. The 15-45s pod startup budget is real and must be accounted for in SLA design."
          },
          {
            question: "How do you prevent worker environment drift in CeleryExecutor?",
            answer: "Bake a consistent Docker image for all workers and update it in CI/CD alongside DAG deployments. Pin all package versions in requirements.txt. Use Airflow's KubernetumExecutor PodTemplateFile to standardize the worker environment. Never let workers update packages independently."
          }
        ],
        redFlags: [
          {
            junior: "\"KubernetesExecutor is always best because it's cloud-native.\"",
            senior: "\"KubernetesExecutor has 15-60s pod startup latency — for high-frequency, latency-sensitive tasks, CeleryExecutor with always-on workers is often the right call. I pick based on throughput pattern and SLA requirements.\""
          },
          {
            junior: "\"LocalExecutor scales fine.\"",
            senior: "\"LocalExecutor runs on a single machine — if that machine goes down, your entire Airflow deployment is down and no tasks run. For any production-grade setup, Celery or Kubernetes provides worker redundancy.\""
          }
        ],
        alternatePhrasings: [
          "\"What Airflow executor would you choose for a production setup and why?\"",
          "\"What are the trade-offs between Celery and Kubernetes executors?\"",
          "\"How does the executor affect Airflow scalability?\""
        ],
        interviewContexts: [
          "Senior DE architecture interview at a cloud-native data platform",
          "Infrastructure-focused DE interview at a company migrating from EC2 to Kubernetes",
          "Came up in 2 senior Airflow platform design discussions"
        ]
      },
      {
        category: "deep-dives",
        riskLevel: "high",
        asked: 17,
        questionText:
          "How do you implement cross-DAG dependencies in Airflow, and what are the failure modes of ExternalTaskSensor at scale?",
        code: [
          {
            lang: "airflow",
            label: "map across schedules",
            lines: [
              "ExternalTaskSensor(",
              "  task_id='wait_up',",
              "  external_dag_id='hourly',",
              "  external_task_id='done',",
              "  # align differing logical dates",
              "  execution_delta=timedelta(hours=1),",
              "  timeout=3600)",
            ],
          },
        ],
        answerStructured:
          "- **ExternalTaskSensor**: polls the metadata DB until the target task in a different DAG has a specified status (`allowed_states=['success']`). Configured with `external_dag_id`, `external_task_id`, and critically **`execution_date_fn`** to map logical dates between DAGs with different schedules.\n- **`execution_date_fn`**: required when the upstream and downstream DAGs run on different schedules. Without it, the sensor looks for an upstream run with the exact same logical date — works for same-schedule DAGs, breaks for mismatched schedules.\n- **Failure modes**: (1) Sensor stuck waiting if upstream fails — you need `on_failure_callback` or a `timeout` on the sensor. (2) Sensor in poke mode holds worker slots. (3) The sensor polls the metadata DB — at high frequency across many sensors, this can stress the DB.\n- **Airflow 2.4+ alternative — Dataset triggers**: declare that a DAG is triggered when a Dataset (logical data asset) is produced. The upstream task marks the Dataset as updated; downstream DAGs trigger automatically. Decoupled, event-driven, no polling.\n- **Best practice**: use Datasets for simple 'run when upstream produces data' patterns; use ExternalTaskSensor when you need fine-grained control over state and scheduling logic.",
        explanationDeep:
          "Cross-DAG dependencies are one of the trickiest Airflow patterns because they couple two independently scheduled DAGs. The coupling is implicit — if the upstream DAG's schedule changes, the `execution_date_fn` in every downstream ExternalTaskSensor breaks silently until a sensor times out. This is the main operational fragility.\n\nThe `execution_date_fn` is where most bugs hide. If DAG A runs hourly and DAG B runs daily, and B wants to wait for A's last run of the day, the function must map B's logical date (2024-01-15) to A's logical date (2024-01-15T23:00:00). Getting this mapping wrong — off by one interval, wrong timezone — causes the sensor to wait indefinitely for a run that will never have the expected logical date.\n\nDataset triggers (Airflow 2.4+) solve this coupling differently: tasks declare what data they produce (`@task(outlets=[my_dataset])`), and downstream DAGs declare what data they need (`schedule=[my_dataset]`). Airflow handles the triggering without polling. This is more correct from an architectural standpoint — dependencies are data-based, not schedule-based — but it requires all producers to opt in, which isn't always feasible for existing DAGs.\n\nAt scale, ExternalTaskSensors in poke mode add DB load from constant polling of the task_instance table. Using reschedule mode and setting a reasonable poke_interval (300s rather than 60s) reduces this significantly. Alternatively, deferrable ExternalTaskSensors are available in the providers package.",
        interviewerLens:
          "I'm looking for `execution_date_fn` as the correctness key — candidates who don't mention it haven't shipped a cross-DAG dependency between DAGs with different schedules. The Dataset trigger alternative shows you know Airflow 2.4+ architecture. The poke-mode-on-metadata-DB scaling concern is the operational depth I want from senior candidates.",
        followupChain: [
          {
            question: "ExternalTaskSensor is waiting but the upstream DAG always succeeds — what could be wrong?",
            answer: "Almost always execution_date mismatch: the sensor is looking for an upstream run with a logical date that doesn't exist. Debug by checking what logical date the sensor is looking for (log output) vs what logical dates actually exist in the upstream DAG run history. Fix execution_date_fn."
          },
          {
            question: "How would you redesign a cross-DAG dependency to remove the ExternalTaskSensor entirely?",
            answer: "Use Airflow 2.4+ Datasets: the upstream task declares outlet=[Dataset('my-table')]; the downstream DAG declares schedule=[Dataset('my-table')]. Airflow triggers the downstream DAG whenever the Dataset is updated, without any polling. This breaks the schedule coupling and is more resilient to upstream schedule changes."
          }
        ],
        redFlags: [
          {
            junior: "\"I use ExternalTaskSensor with the same execution_date as the upstream.\"",
            senior: "\"That only works when both DAGs share the same schedule interval. For different schedules, you need execution_date_fn to map between the two — without it the sensor waits forever for a logical date that never exists.\""
          },
          {
            junior: "\"ExternalTaskSensor is the only way to create cross-DAG dependencies.\"",
            senior: "\"Airflow 2.4+ Dataset triggers are often cleaner — declare what data an upstream task produces and the downstream DAG triggers automatically, without polling the metadata DB.\""
          }
        ],
        alternatePhrasings: [
          "\"How do you create dependencies between two different DAGs?\"",
          "\"Why is my ExternalTaskSensor stuck waiting forever?\"",
          "\"What are Airflow Datasets and how do they replace sensors?\""
        ],
        interviewContexts: [
          "Senior DE loop at a company with a complex multi-DAG dependency graph",
          "Airflow architecture deep-dive at a data platform team"
        ]
      },
      {
        category: "deep-dives",
        riskLevel: "high",
        asked: 15,
        questionText:
          "Explain dynamic task mapping in Airflow 2.3+. When is it the right pattern and what are the operational pitfalls?",
        code: [
          {
            accent: "bug",
            lang: "python",
            lines: [
              "for f in list_files():",
              "  process(f)",
              "# parse-time, static, hits DB early",
            ],
          },
          {
            accent: "fix",
            lang: "python",
            lines: [
              "files = list_files()",
              "process.partial(env='prod') \\",
              "  .expand(path=files)",
              "# runtime fan-out per item",
            ],
          },
        ],
        answerStructured:
          "- **Dynamic task mapping**: creates a variable number of task instances at **runtime** based on the output of an upstream task, rather than at DAG parse time. Uses `.expand()` on an operator call.\n- Syntax: `process.expand(filename=get_file_list())` — creates one `process` task instance per filename returned by `get_file_list`.\n- **`partial()`** for fixed arguments: `process.partial(conn_id='my_db').expand(filename=file_list)` — `conn_id` is constant, `filename` varies.\n- **`expand_kwargs()`**: map over a list of dicts to vary multiple arguments simultaneously.\n- **Empty list**: if the upstream returns an empty list, the mapped task is marked `SKIPPED`.\n- **Limit**: default max 1,024 mapped task instances per task (`max_map_length` config).\n- **Pitfalls**: (1) mapped task output is a lazy sequence — downstream tasks can't index into it easily. (2) Mapped tasks significantly increase task_instance table rows — can degrade scheduler on very large maps. (3) The number of instances is unknown at parse time — alerting and SLA thresholds can't anticipate it.",
        explanationDeep:
          "Before dynamic task mapping (Airflow 2.3), handling a variable-size workload required either generating the full task list at parse time (Python for-loops in DAG code — re-parsed every N seconds with the full list) or a single task that looped internally. Both are suboptimal: the parse-time loop makes the DAG definition unstable (it changes every time the list changes), and the internal loop is a black box to Airflow's UI and logging.\n\nDynamic task mapping gives each work item its own task instance, with individual logs, individual retries, and individual state tracking in the UI. A mapped task failure for one file doesn't block the others — each item is independently scheduled. This is the right pattern for fan-out workloads: process a list of S3 objects, run a query per region, load one file per partition.\n\nThe operational pitfalls are real at scale. If `get_file_list()` returns 50,000 items, you've created 50,000 task instances — the metadata DB tables grow dramatically, scheduler polling is more expensive, and the UI becomes hard to use. The 1,024 default cap (`max_map_length`) protects against this, but teams raise it without understanding the metadata DB implications. The right design for very large fan-outs is to batch the work in the upstream task (return 100 batches of 500 files rather than 50,000 individual files) and keep mapped instances to a reasonable count.",
        interviewerLens:
          "I'm looking for the 'runtime vs parse-time' distinction — dynamic mapping defers task creation until execution, which is the key difference from Python for-loops at parse time. Knowing the empty-list skip behavior, the max_map_length limit, and the metadata DB scaling concern shows operational experience with the feature, not just knowledge of the syntax.",
        followupChain: [
          {
            question: "How do you aggregate results from all mapped task instances downstream?",
            answer: "A downstream task that depends on a mapped task receives the mapped task's XCom as a lazy sequence. Use expand_kwargs to pass the aggregated sequence, or write each mapped task's output to a shared storage location (S3/GCS) and have the aggregation task scan that location. Direct XCom aggregation of large mapped outputs still goes through the metadata DB."
          },
          {
            question: "Your get_file_list() task returns 5,000 filenames. What's the scaling risk and how do you handle it?",
            answer: "5,000 task instances is significant metadata DB overhead and will slow scheduler polling. Batch the files: return 100 batches of 50 files each. The mapped task receives a list of 50 files and processes them in a loop internally — Airflow sees 100 task instances instead of 5,000, keeping the scheduler healthy while still parallelizing the work."
          }
        ],
        redFlags: [
          {
            junior: "\"I use a Python for-loop in the DAG file to create dynamic tasks.\"",
            senior: "\"Python for-loops in DAG code run at parse time — the task list is static and regenerated every few seconds. Dynamic task mapping creates instances at runtime based on actual data, which is cleaner and scalable.\""
          },
          {
            junior: "\"Dynamic task mapping can handle any number of items.\"",
            senior: "\"The default max is 1,024 instances (max_map_length) — more than that causes errors. Even within the limit, very large maps stress the scheduler's metadata DB polling. I batch upstream outputs to keep instance counts reasonable.\""
          }
        ],
        alternatePhrasings: [
          "\"How do you create tasks dynamically based on upstream data in Airflow?\"",
          "\"What is .expand() and when do you use it?\"",
          "\"How do you parallelize processing of a variable-size list in Airflow?\""
        ],
        interviewContexts: [
          "Senior DE screen at a company processing variable-volume daily file ingestion",
          "Airflow 2.3+ feature knowledge check at a data platform interview"
        ]
      },
      // ── decision-frameworks ───────────────────────────────────
      {
        category: "decision-frameworks",
        riskLevel: "high",
        asked: 16,
        questionText:
          "A pipeline has been double-writing data for 3 weeks due to non-idempotent tasks. Walk me through your incident response and long-term fix.",
        answerStructured:
          "- **Immediate triage**: quantify the blast radius — which tables, which date partitions, how many rows are duplicated. Query `COUNT(*) GROUP BY date, primary_key` to measure.\n- **Stop the bleeding**: pause the DAG immediately. Don't let it continue writing duplicates while you investigate.\n- **Root cause**: trace back to the task — is it a blind INSERT without a unique key or partition overwrite? Is `datetime.now()` replacing the logical date? Are retries triggering re-inserts?\n- **Data remediation**: for each affected partition, run a deduplication — `CREATE TABLE clean AS SELECT DISTINCT/ROW_NUMBER()=1 ... FROM dirty`, validate, then swap. Test on one partition before running all 3 weeks.\n- **Fix the task**: change the write logic to partition overwrite or MERGE keyed on the logical date. Remove any `datetime.now()` references. Add a uniqueness assertion test.\n- **Prevention**: add a post-task row-count check and a uniqueness test that fails the DAG run if duplicates are detected before they propagate downstream.",
        explanationDeep:
          "The ordering of incident response matters: stop the bleeding before remediating. Attempting to clean duplicates while the pipeline is still writing new ones is chasing a moving target. Pause the DAG, take a snapshot of the current state, quantify the damage, and then fix in controlled stages.\n\nDeduplication at scale requires the same care as any large data operation: CTAS + swap, not in-place DELETE (which locks and can overflow transaction logs). Test the deduplication logic on a single partition first, validate the output row count and key uniqueness, then run across all affected partitions.\n\nThe long-term fix is architectural: the task should be idempotent by design so that even if it runs 10 times for the same date, the result is always the same. The signal path is: logical date → partition key → deterministic overwrite. Anything that deviates from this pattern — blind INSERT, datetime.now(), non-atomic multi-step write — is a future incident waiting to happen.\n\nAddng automated checks (row-count assertions, uniqueness checks) as part of the pipeline turns idempotency from a design principle into a testable, enforced contract.",
        interviewerLens:
          "I want to see 'stop the bleeding first' — candidates who jump straight to 'fix the task' without stopping writes are letting the incident worsen. The CTAS + swap deduplication pattern shows scale awareness. The 'add automated uniqueness checks' prevention step shows systems thinking: not just fixing this incident, but making the class of incidents impossible to repeat silently.",
        followupChain: [
          {
            question: "How do you communicate a 3-week data quality incident to stakeholders?",
            answer: "Immediate notification that the issue is known and contained (DAG paused). Quantify impact clearly: which tables, which dates, what the duplication ratio is. Give an ETA for remediation. After fix, post a postmortem with root cause, timeline, and prevention measures. Avoid minimizing — stakeholders who relied on the data need to re-validate their work."
          }
        ],
        redFlags: [
          {
            junior: "\"I'd just delete the duplicate rows.\"",
            senior: "\"First I'd pause the DAG to stop new duplicates. Then I'd use CTAS + swap to safely deduplicate each partition — not in-place DELETE which can lock large tables. Then fix the task's write logic to be idempotent, and add automated uniqueness checks.\""
          }
        ],
        alternatePhrasings: [
          "\"A data pipeline has been double-writing for a month. What do you do?\"",
          "\"How do you handle a production data quality incident in Airflow?\"",
          "\"How do you clean up data after a non-idempotent task writes duplicates?\""
        ],
        interviewContexts: [
          "Senior DE incident response question at a Series D company",
          "On-call experience interview at a high-scale data platform"
        ]
      },
      {
        category: "decision-frameworks",
        riskLevel: "medium",
        asked: 12,
        questionText:
          "How do you design an Airflow architecture for a team with 50+ DAGs and multiple data domains? What are the organizational and technical decisions?",
        answerStructured:
          "- **DAG organization**: use a monorepo with folders per domain (e.g., `dags/marketing/`, `dags/finance/`) and DAG-level naming conventions (`domain__pipeline__frequency`). Avoid a flat folder with 50 unsorted files.\n- **Executor choice**: CeleryExecutor or KubernetesExecutor depending on task latency requirements and infrastructure. 50+ DAGs often means bursty load — Kubernetes is attractive for cost, Celery for latency.\n- **Shared infrastructure**: one Airflow deployment serving all domains, with pools per domain/resource to isolate impact. Domain A's backfill shouldn't starve Domain B's production tasks.\n- **CI/CD**: test DAG load (no import errors, correct schedule), run unit tests on operators, deploy to a staging Airflow before production. DagBag integrity check in CI is minimum.\n- **Access control**: use Airflow RBAC to limit which teams can edit/trigger which DAGs. Editors for their domain, viewer for others.\n- **Alerting**: centralized alerting with DAG-level tagging so on-call routing goes to the right team. Don't route all DAG failures to a shared channel.\n- **Scaling the scheduler**: at 50+ DAGs with high task volume, the scheduler can be a bottleneck — monitor heartbeat latency and consider the High Availability Scheduler (Airflow 2.1+).",
        explanationDeep:
          "The organizational questions — folder structure, naming conventions, RBAC, alerting routing — are as important as the technical decisions at team scale. A flat `dags/` folder with 50 files becomes unmanageable within months: no ownership clarity, no domain isolation, alert fatigue from shared channels.\n\nPool isolation is the key technical mechanism for multi-domain fairness: each domain gets a pool allocation for its most resource-intensive tasks. Domain A's backfill consuming all slots should not starve Domain B's SLA-bound production run. This requires governance: someone owns the pool configuration and must arbitrate when domains compete for slots.\n\nThe Airflow HA Scheduler (active-active mode, Airflow 2.1+) becomes relevant at high DAG and task volume. With 50+ DAGs and hundreds of concurrent tasks, a single scheduler can have heartbeat delays, causing task dispatch latency. Two schedulers in HA mode use optimistic locking on the metadata DB to coordinate — no single point of failure and better throughput. This is worth mentioning in senior architectural discussions.",
        interviewerLens:
          "The organizational decisions (folder structure, naming, RBAC, per-domain alerting) are the signals I'm looking for — these show you've managed Airflow at team scale, not just written a few personal DAGs. The HA Scheduler mention is a technical depth indicator. Pool-per-domain for fairness is the resource governance answer.",
        followupChain: [
          {
            question: "How do you prevent one team's DAG from destabilizing the shared Airflow deployment?",
            answer: "Pool isolation (domain-specific pools with slot caps), max_active_runs limits on high-volume DAGs, and CI/CD gates that prevent broken DAG imports from deploying. For truly isolated requirements, consider separate Airflow deployments per domain — more ops overhead but complete blast radius isolation."
          }
        ],
        redFlags: [
          {
            junior: "\"Just put all DAGs in one folder and give everyone access.\"",
            senior: "\"At 50+ DAGs, flat structure and shared access creates ownership ambiguity and blast radius problems. I'd use domain folders, RBAC, domain-specific pools, and per-team alerting routing from the start.\""
          }
        ],
        alternatePhrasings: [
          "\"How do you scale Airflow for a large organization?\"",
          "\"What are best practices for managing many DAGs?\"",
          "\"How do you ensure fair resource allocation across teams in a shared Airflow cluster?\""
        ],
        interviewContexts: [
          "Senior / Staff DE architecture interview at a large data platform company",
          "Airflow platform ownership interview at a company with multiple data teams"
        ]
      },
      // ── tool-comparison ───────────────────────────────────────
      {
        category: "tool-comparison",
        riskLevel: "high",
        isComparison: true,
        comparisonTools: ["Airflow", "Prefect", "Dagster"],
        asked: 14,
        questionText:
          "Airflow vs Prefect vs Dagster — when would you choose each for a new data engineering team?",
        answerStructured:
          "- **Airflow**: battle-tested, massive ecosystem, dominant industry adoption, excellent provider library. Best for: teams with existing Airflow expertise, shops needing a huge library of integrations, organizations on managed platforms (MWAA, Cloud Composer, Astronomer). Weaknesses: DAG-as-code model is verbose, scheduler-as-single-source-of-truth creates scaling headaches, testing is harder than Dagster.\n- **Prefect**: Python-first, minimal boilerplate, hybrid execution model (cloud orchestration + local workers). Best for: Python-fluent teams wanting rapid iteration, smaller pipelines, teams that want managed orchestration with minimal infrastructure ops. Weaknesses: smaller provider ecosystem than Airflow, less institutional knowledge available.\n- **Dagster**: asset-first philosophy — pipelines are defined in terms of the data assets they produce, not the tasks. Built-in data lineage, integrated testing, type annotations. Best for: teams building a modern data platform who prioritize data quality, lineage, and software engineering discipline. Weaknesses: steeper learning curve, younger ecosystem, migration cost from existing Airflow DAGs.\n- **Decision**: Airflow for ecosystem and operator breadth; Dagster for engineering rigor and asset lineage; Prefect for simplicity and Python-native experience.",
        explanationDeep:
          "The philosophical difference is deeper than features: Airflow is task-centric (you define what tasks run and in what order), Dagster is asset-centric (you define what data assets should exist and how to produce them). This changes how you think about pipelines. In Dagster, the scheduler and backfill model is driven by 'which assets are out of date' rather than 'which time intervals haven't run' — a fundamentally different mental model that works well for data mesh and data product architectures.\n\nPrefect's hybrid model (cloud-hosted orchestration + local workers) is attractive for teams that don't want to manage Airflow infrastructure. The tradeoff is vendor dependence for the control plane. Airflow can be entirely self-hosted (open source, no cloud dependency).\n\nMigration cost is real: switching from Airflow to Dagster or Prefect means rewriting all DAGs. In practice, most organizations stick with Airflow once adopted because the switching cost is high and Airflow's ecosystem is vast. The decision matters most at greenfield — once a platform is established, the inertia is significant. The honest recommendation is: if greenfield and the team is Python-fluent with a focus on data quality, Dagster deserves serious evaluation; if you need maximum operator coverage and have existing Airflow expertise, stay with Airflow.",
        interviewerLens:
          "I'm listening for the philosophical framing (task-centric vs asset-centric) rather than a feature checklist. Candidates who say 'Airflow is better' or 'Dagster is better' without tying it to team context, maturity, and use case haven't thought about this architecturally. The migration cost point is the practical constraint that shows operational judgment.",
        followupChain: [
          {
            question: "What does Dagster's asset-based model give you that Airflow doesn't?",
            answer: "Built-in data lineage: every asset knows what it was produced from and what it produces. Native backfilling by 'which assets are stale' rather than 'which time intervals are missing.' Integrated type-checked inputs/outputs. The result is a tighter feedback loop between pipeline code and data quality — bugs are caught earlier and lineage is automatic, not bolt-on."
          },
          {
            question: "Would you choose Airflow for a greenfield data platform in 2025?",
            answer: "It depends on team expertise and integration needs. If the team knows Airflow and needs a wide provider library (Snowflake, Databricks, BigQuery, Kubernetes, 70+ integrations), Airflow is the low-risk choice. If starting fresh with a Python-native team focused on data quality and lineage, Dagster deserves serious evaluation. I wouldn't choose Airflow by default just because it's popular — the asset model in Dagster genuinely reduces the class of data quality bugs."
          }
        ],
        redFlags: [
          {
            junior: "\"Airflow is the industry standard so I'd always use it.\"",
            senior: "\"Airflow has the broadest ecosystem and most operator support, but Dagster's asset model and built-in lineage are worth evaluating for a modern platform. I'd base the decision on team expertise, integration needs, and how much data quality infrastructure I want out of the box.\""
          }
        ],
        alternatePhrasings: [
          "\"Why would you pick Dagster over Airflow?\"",
          "\"Is Prefect better than Airflow for a small team?\"",
          "\"What orchestrator would you choose for a new data platform?\""
        ],
        interviewContexts: [
          "Senior DE architecture discussion at a Series B startup choosing their first orchestration tool",
          "Platform engineering review at a company evaluating an Airflow migration"
        ]
      }
    ],
    topics: {
      moreDeepDives: [
        "How does Airflow's High Availability Scheduler (active-active) work and when do you need it?",
        "How do you implement a DAG factory pattern to generate many similar DAGs programmatically?",
        "What is the metadata DB schema and which tables matter most for scheduler performance?",
        "How do you debug a scheduler that's slow to dispatch tasks (heartbeat delays)?",
        "Airflow 2.4+ Datasets vs ExternalTaskSensor — when does the event-driven model win?"
      ],
      decisions: [
        "KubernetesExecutor vs CeleryExecutor vs CeleryKubernetesExecutor — decision tree by SLA and workload pattern",
        "DAG factory pattern vs individual DAG files — when does the factory approach become necessary?",
        "Separate Airflow deployments per team vs shared cluster with pool isolation — ops vs blast-radius trade-off"
      ],
      quickRef: [
        "What does max_active_runs control at the DAG level?",
        "How does a pool differ from max_active_tasks?",
        "What is the Triggerer and what Airflow version introduced it?",
        "What does execution_date_fn do in ExternalTaskSensor?",
        "What is the default max_map_length for dynamic task mapping?",
        "What is the CeleryKubernetesExecutor?",
        "What does depends_on_past=True block on specifically?",
        "What is a Dataset in Airflow 2.4+ and how does it trigger DAGs?",
        "What does SKIPPED state mean for a dynamically mapped task with an empty input list?",
        "What is the HA Scheduler and how many schedulers can run concurrently?"
      ],
      redFlags: [
        {
          junior: "\"I just set catchup=True and let Airflow backfill.\"",
          senior: "\"With an old start_date that floods the scheduler. I use max_active_runs + pool + chunked CLI backfill to control concurrency and protect both the source and the scheduler.\""
        },
        {
          junior: "\"KubernetesExecutor is always better than Celery.\"",
          senior: "\"Kubernetes has 15-60s pod startup latency — for latency-sensitive tasks, Celery's always-on workers are faster. I choose based on throughput pattern and SLA requirements.\""
        },
        {
          junior: "\"I use ExternalTaskSensor with the same execution_date as the upstream DAG.\"",
          senior: "\"That only works for same-schedule DAGs. For different schedules, I set execution_date_fn to map between the two — without it, the sensor waits forever.\""
        },
        {
          junior: "\"Dynamic task mapping can handle 50,000 items.\"",
          senior: "\"The default max_map_length is 1,024 — and even within the limit, large maps stress the scheduler's metadata DB. I batch upstream outputs to keep instance counts reasonable.\""
        },
        {
          junior: "\"I'd fix a non-idempotent pipeline by deleting the duplicates.\"",
          senior: "\"First I pause the DAG to stop new writes. Then I use CTAS + swap to safely deduplicate each partition, validate, then swap. Then I fix the task logic to use partition overwrite keyed on the logical date.\""
        },
        {
          junior: "\"All 50 DAGs share the same pool and concurrency settings.\"",
          senior: "\"At scale, shared pools create unfair resource competition. I assign domain-specific pools so one team's backfill can't starve another team's SLA-bound production run.\""
        }
      ],
      checklist: [
        "Backfill concurrency: max_active_runs + pool + chunked CLI — know all three levers",
        "Executor trade-offs: startup latency (K8s) vs idle cost (Celery) vs no horizontal scale (Local)",
        "ExternalTaskSensor: execution_date_fn requirement, failure modes, Dataset alternative",
        "Dynamic task mapping: runtime vs parse-time, max_map_length, batching strategy for large inputs",
        "Incident response: pause first, quantify, deduplicate with CTAS+swap, fix idempotency, add automated checks"
      ],
      behavioral: [
        "Describe a production Airflow incident you owned — what went wrong, how did you diagnose it, and what prevented recurrence?",
        "Tell me about a time you had to backfill a large amount of historical data — how did you manage the risk?",
        "How have you scaled an Airflow deployment as team and DAG count grew?"
      ],
      reverse: [
        "How many DAGs and task instances run at peak, and has the scheduler been a bottleneck?",
        "What executor is the platform using and has the team evaluated alternatives?",
        "How does the team handle cross-DAG dependencies — ExternalTaskSensor, Datasets, or something else?"
      ]
    }
  }
};
