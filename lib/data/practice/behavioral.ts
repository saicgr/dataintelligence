import type { ConvItem } from "./types";

/**
 * Behavioral / leadership interview questions for data & AI engineers.
 * Researched from dataexpert.io, designgurus.io (Amazon LPs), newsletter.systemdesign.one,
 * finalroundai.com, interviewquery.com, igotanoffer.com, and Glassdoor data-engineer reviews
 * (May 2026). Each idealAnswer follows STAR structure tuned to a data/AI engineering context.
 * `free: true` items are playable without a Practice Pro subscription.
 */
export const BEHAVIORAL_ITEMS: ConvItem[] = [
  // ─── JUNIOR ────────────────────────────────────────────────────────────────
  {
    id: "bhv-pipeline-failure-ownership",
    category: "behavioral",
    executes: false,
    free: true,
    level: "junior",
    title: "Owning a data incident end-to-end",
    company: "E-commerce platform · Series B",
    difficulty: "easy",
    mode: "text",
    prompt:
      "Tell me about a time a data pipeline you owned failed in production and impacted downstream consumers. Walk me through how you detected the issue, what you did to fix it, and what changed afterward.",
    hints: [
      "Set the scene quickly (1-2 sentences): what pipeline, what was the blast radius, how was it detected. Interviewers want to know if YOU detected it or a stakeholder did.",
      "Spend most of your time on the Actions: your triage steps, who you looped in, how you communicated status, and the actual fix. Be specific — paste a query you ran, a flag you set, or a rollback you triggered.",
      "Close with a quantified Result AND a concrete process change: not just 'we added monitoring' but 'we added a row-count assertion alert that fires within 5 minutes of a zero-load partition, which has caught two issues since.'",
    ],
    starter: "",
    idealAnswer:
      "STAR model answer (data-eng context):\n\nSituation: At my previous company I owned the nightly dbt pipeline that loaded the `orders_daily` mart table used by three downstream dashboards and the finance team's revenue report. One Monday morning I got a Slack message from the finance lead saying last Friday's revenue looked $0.\n\nTask: As the on-call data engineer I was responsible for triaging, fixing, and communicating the incident within our 2-hour SLA.\n\nAction: I pulled the Airflow task logs first — the dbt run had completed successfully (green). I then queried the raw source table and found that the upstream ETL job had written 0 rows to S3 for the Friday partition due to a boto3 credential rotation that happened at midnight. The dbt model had no NOT NULL or row-count test on the source, so it silently produced an empty output. I rolled back the mart table to Thursday's snapshot using Delta Lake time-travel (`RESTORE TABLE orders_daily TO VERSION AS OF 5`), re-ran the extraction job with the corrected credentials, validated row counts matched the prior-week baseline (within 3%), then re-ran dbt with `--select orders_daily+`. I kept finance updated in the incident Slack channel every 30 minutes.\n\nResult: Finance had corrected data within 1 hour 45 minutes, inside our SLA. In the postmortem I added two dbt source tests — `not_null` on `order_id` and a custom row-count test that asserts the partition has at least 80% of the trailing 7-day average. We also added a credential-rotation run-book that pre-validates the new secret against a test S3 read before cutting over. Zero recurrences in the 6 months since.\n\nWhat the interviewer is assessing: Ownership (you detected or responded quickly, not just 'the team fixed it'), technical depth (rollback mechanism, root-cause accuracy), communication under pressure, and whether you turned the incident into a lasting system improvement.",
    rubric: [
      "Uses STAR structure: distinct Situation, Task, Action, Result sections",
      "Identifies the root cause precisely, not just the symptom",
      "Describes a concrete rollback or mitigation action, not just 'I fixed it'",
      "Communicates the impact to stakeholders during the incident",
      "Closes with a specific preventive change (monitoring, test, runbook) that outlasted the fix",
    ],
  },
  {
    id: "bhv-prioritizing-under-deadline",
    category: "behavioral",
    executes: false,
    free: true,
    level: "junior",
    title: "Prioritizing competing work under a hard deadline",
    company: "FinTech startup · seed stage",
    difficulty: "easy",
    mode: "text",
    prompt:
      "Describe a time when you had multiple high-priority data tasks land at the same time and a hard deadline you could not move. How did you decide what to work on, and what was the outcome?",
    hints: [
      "Name the specific tasks and the stakeholders behind each. Generic answers ('I had lots of work') score poorly — the interviewer wants to see your decision-making criteria.",
      "Explain how you triaged: did you rank by business impact, by dependencies blocking others, by time-to-fix, or by escalation urgency? Make your reasoning explicit.",
      "Quantify the outcome: what shipped on time, what was deliberately deferred, and did the deferral have a stated plan (not just a vague 'later')?",
    ],
    starter: "",
    idealAnswer:
      "STAR model answer:\n\nSituation: During a Black Friday prep sprint I had three items land simultaneously on a Wednesday with a Friday-noon deploy freeze: (1) a new product-sales Looker dashboard the CMO wanted for the Friday war room, (2) a data quality bug where ~4% of orders were missing `discount_code`, impacting a coupon-fraud report, and (3) a request from the analytics team to add three new dimensions to the `dim_product` table.\n\nTask: I was the only data engineer that week (teammate was on PTO) and had roughly 16 working hours before the freeze.\n\nAction: I mapped each task against two axes — business risk (what breaks if I skip this?) and estimated effort. The coupon-fraud bug was highest risk: it was silently corrupting a finance report used for regulatory chargebacks — I estimated 3 hours to fix and test. The Looker dashboard was high visibility but read-only — I estimated 6 hours. The dim_product change was a nice-to-have with no deadline attached — I deprioritized it immediately and communicated that explicitly to the analytics team with a proposed post-freeze date. I fixed the coupon bug first (3 hrs), then built the dashboard (5 hrs, slightly under estimate). I gave the analytics team a written ticket with a committed post-freeze date so it did not fall through the cracks.\n\nResult: Both high-priority items shipped before the Friday freeze. The coupon-fraud report was corrected and the regulatory team signed off. The CMO used the dashboard live in the war room. The dim_product work shipped the following Tuesday as promised, keeping the analytics team's trust.\n\nWhat the interviewer is assessing: Systematic prioritization (not just 'I worked harder'), stakeholder communication about deferrals, and the ability to protect team trust even when saying no.",
    rubric: [
      "Names specific competing tasks with stakeholders, not generic descriptions",
      "Articulates explicit prioritization criteria (risk, impact, effort, or dependency)",
      "Communicates deferrals to affected stakeholders proactively",
      "Quantifies the outcome: what shipped, what was deferred, what the impact was",
      "Demonstrates reflection: would they change anything in retrospect?",
    ],
  },

  // ─── MID ────────────────────────────────────────────────────────────────────
  {
    id: "bhv-stakeholder-conflict",
    category: "behavioral",
    executes: false,
    free: false,
    level: "mid",
    title: "Conflict with a stakeholder over data definitions",
    company: "Retail analytics team · enterprise",
    difficulty: "medium",
    mode: "text",
    prompt:
      "Tell me about a time you had a significant disagreement with a business stakeholder — a product manager, analyst, or business lead — over how a data metric or feature should work. How did you handle the conflict, and what was the resolution?",
    hints: [
      "Frame the conflict specifically: what was the metric or feature, why did you disagree technically, and what was the stakeholder's position? Avoid 'they just didn't understand data' — show empathy for their perspective.",
      "Describe your Actions in detail: did you bring data to the conversation, loop in a third party, or propose a compromise? Show that you listened before you pushed back.",
      "Close with the resolution AND the relationship outcome. Did you rebuild trust? Did the stakeholder later become an advocate for data quality?",
    ],
    starter: "",
    idealAnswer:
      "STAR model answer:\n\nSituation: The VP of Marketing wanted a 'Customer Lifetime Value' metric added to the executive dashboard for a board presentation in two weeks. Her definition was total revenue per customer since signup. My team's analyst lead and I knew that definition double-counted refunded orders and did not discount for cost of goods, making it meaningless for comparing customer cohorts.\n\nTask: As the mid-level data engineer building the metric, I had to either build what was asked (fast, wrong) or push back and risk missing the board deadline.\n\nAction: Instead of immediately rejecting her definition in Slack, I scheduled a 30-minute working session with the VP, her analyst, and our analytics lead. I prepared a two-page doc with three things: (1) a side-by-side comparison of her definition vs. a COGS-adjusted, refund-net LTV on real data — the gap was ~22% on average, up to 40% for high-return cohorts; (2) a risk paragraph explaining that if the board acted on the inflated number, marketing budget allocation could be misdirected by $200K+ in the next quarter; and (3) a proposed compromise: we would ship both numbers — a 'gross revenue LTV' (her definition, clearly labeled) and an 'adjusted LTV' (our definition) — with a tooltip explaining the difference. I offered to have both ready in 5 days.\n\nResult: The VP appreciated the transparency, agreed to the dual metric, and used the adjusted LTV as the primary number in the board deck. Post-presentation, she asked me to lead a company-wide 'metric definitions' initiative, and we now have a governed metrics catalog with 40+ definitions reviewed by Finance and Data. The working relationship became one of the strongest cross-functional partnerships I have had.\n\nWhat the interviewer is assessing: Maturity to push back with data rather than emotion, empathy for the stakeholder's timeline and goals, and the ability to propose a win-win rather than a binary standoff.",
    rubric: [
      "Names the specific metric or feature at the center of the conflict",
      "Shows empathy for the stakeholder position before launching into pushback",
      "Brings data or a structured argument to the conversation — not just opinion",
      "Proposes a concrete compromise or path forward rather than a binary win/lose",
      "Describes the long-term relationship outcome, not just the immediate resolution",
    ],
  },
  {
    id: "bhv-project-failure",
    category: "behavioral",
    executes: false,
    free: false,
    level: "mid",
    title: "A project that failed — and what you took from it",
    company: "Health-tech SaaS · Series C",
    difficulty: "medium",
    mode: "text",
    prompt:
      "Tell me about a data or AI project you worked on that did not go as planned — it was late, cancelled, or delivered something nobody used. What was your role, what went wrong, and what did you personally change as a result?",
    hints: [
      "Pick a real failure, not a 'failure that was secretly a success.' Interviewers can tell when answers are sanitized. Show genuine reflection on what you personally did or did not do.",
      "Diagnose the root cause clearly: was it a requirements problem, a technical underestimate, a communication gap, or a prioritization call that turned out wrong? Be specific.",
      "The most important part is the 'what changed': did you change your process, your approach to scoping, your communication cadence? Concrete behavior changes score much higher than vague lessons.",
    ],
    starter: "",
    idealAnswer:
      "STAR model answer:\n\nSituation: In my second year as a data engineer I led a 3-month project to build a 'churn prediction scoring pipeline' that would run daily and surface the top 500 at-risk accounts to the customer success team in their CRM.\n\nTask: I owned the pipeline design, feature engineering, and CRM integration. An ML engineer owned the model.\n\nAction: We shipped the pipeline on time — technically it worked. The model had 72% AUC on our holdout set, and scores landed in Salesforce by 7am every day. But 6 weeks after launch, usage analytics showed that customer success reps had opened the churn-score field in Salesforce exactly 11 times. I asked three reps why. Their answers were consistent: they did not trust a black-box score they could not explain, they had no playbook for what to do with a 'high risk' label, and the score often flagged accounts they knew were healthy because they had just signed an expansion deal (our training data did not include recent contract changes).\n\nResult: The project was considered a failure by the business: zero measurable retention improvement after 6 months. In my retrospective I identified three things I did wrong: I never ran a pilot with 2-3 CSMs before full rollout to validate usability; I did not include any explainability output (SHAP values or top-3 risk factors); and I did not define a 'success metric' with the business before building. Changes I made: I now write a one-page 'definition of done' that includes a user adoption metric before any analytics product kicks off, and I run a 2-week pilot with real end users before full launch. My next project — a renewal-risk report — hit 78% weekly active usage in its first month.\n\nWhat the interviewer is assessing: Self-awareness (genuine reflection, not a humble-brag), root-cause depth (usability, not just model accuracy), and evidence that you updated your behavior, not just your beliefs.",
    rubric: [
      "Picks a genuine failure, not a reframed success",
      "Diagnoses root cause at the correct level (process, requirements, communication) not just the symptom",
      "Takes personal ownership using 'I' statements, not 'the team' or 'the business'",
      "Describes specific behavior changes adopted after the failure",
      "Shows that the lesson was applied in a subsequent project with a measurable outcome",
    ],
  },
  {
    id: "bhv-handling-ambiguity",
    category: "behavioral",
    executes: false,
    free: false,
    level: "mid",
    title: "Driving forward with incomplete requirements",
    company: "Media startup · growth stage",
    difficulty: "medium",
    mode: "text",
    prompt:
      "Describe a situation where you had to start or continue a data project with significantly incomplete or conflicting requirements. How did you move forward, and how did you manage the risk of building the wrong thing?",
    hints: [
      "Name what was specifically unclear: data source ownership, business logic for a metric, schema of an external system, or stakeholder alignment. Vague ambiguity ('things were unclear') is not enough.",
      "Show how you reduced ambiguity systematically — a spike, an assumption doc, a time-boxed prototype, or a decision-forcing escalation — rather than waiting or guessing.",
      "Quantify the risk you accepted and how it turned out: did the assumption hold, or did you need to pivot? Either outcome is fine — the interviewer is evaluating your judgment and transparency.",
    ],
    starter: "",
    idealAnswer:
      "STAR model answer:\n\nSituation: I was asked to build a 'content performance score' to help editors prioritize which articles to promote. The request came from the Head of Editorial, but the success definition was vague: 'something that tells us which content is doing well.' Three different stakeholders (Editorial, Marketing, Monetization) each had a different opinion on what 'doing well' meant — pageviews, scroll depth, subscription conversions, or ad revenue per article.\n\nTask: As the data engineer I had to design the pipeline and schema. The PM was unavailable for two weeks. We had a 6-week deadline to demo to the board.\n\nAction: I wrote a one-page 'Assumptions and Open Questions' doc that listed five unresolved decisions (e.g., 'Is this score per-article or per-author? Is the lookback window 7 days or 30?') and proposed a default for each with my reasoning. I circulated it via email and asked for a 48-hour response window — any silence would be treated as agreement with the default. I got feedback from two of the three stakeholders within 24 hours. For the third (Monetization) I had a 20-minute call to align. I then built the pipeline using the agreed-upon defaults and modeled the score as three separate sub-components (engagement, conversion, revenue) that could be independently weighted — so if the business later changed the weights, I would only need to update coefficients in a config table, not rebuild the pipeline. I flagged the remaining open assumption (ad revenue data completeness) as a known limitation in the demo deck.\n\nResult: We demoed on time. Editorial adopted the default weighting; Monetization asked for a custom weighting 3 months later, which took 2 hours to ship because of the config-driven design. The explicit assumption doc became a team template we used on every subsequent analytics project.\n\nWhat the interviewer is assessing: Bias for action under ambiguity (moves forward rather than waits), structured risk management (assumption doc, time-bound decisions), and forward-thinking design that absorbs future changes cheaply.",
    rubric: [
      "Names specific ambiguities, not generic 'unclear requirements'",
      "Uses a deliberate method to resolve ambiguity (assumption doc, prototype, forced decision) rather than guessing or waiting",
      "Makes the risk explicit and communicates it to stakeholders",
      "Designs the solution to absorb the remaining uncertainty cheaply",
      "Closes with a result and ideally a reusable process artifact",
    ],
  },

  // ─── SENIOR ─────────────────────────────────────────────────────────────────
  {
    id: "bhv-influencing-without-authority",
    category: "behavioral",
    executes: false,
    free: false,
    level: "senior",
    title: "Influencing a team you do not manage to adopt a standard",
    company: "Enterprise data platform · large corp",
    difficulty: "hard",
    mode: "text",
    prompt:
      "Tell me about a time you needed to get engineers or analysts on another team to change how they worked — adopt a new tool, process, or standard — when you had no direct authority over them. What was your approach, and what did it take to get real adoption?",
    hints: [
      "The core signal here is influence without authority: show that you persuaded through data, empathy, and shared goals — not escalation or mandates. Explain what motivated the other team and how you aligned your proposal with their incentives.",
      "Adoption is not a single event — describe the full arc: early skepticism, how you addressed it, pilots, and what sustained adoption looked like (metrics, not anecdotes).",
      "Senior interviewers also want to hear what you would do differently: did your rollout plan have gaps? Being self-critical signals maturity.",
    ],
    starter: "",
    idealAnswer:
      "STAR model answer:\n\nSituation: As a senior data engineer at a 600-person company, I identified that 7 different product squads were each writing their own ad-hoc Airflow DAGs to load data into our warehouse, with no shared lineage, no standard error-alerting, and no schema validation. Three separate data incidents in one quarter were traced to these bespoke pipelines. I wanted all squads to adopt our platform team's standardized DAG framework.\n\nTask: I had no authority over these squads; they reported to different VPs. My only leverage was the quality of the solution and the relationships I had built.\n\nAction: I started by talking to three squad data leads — not to pitch, but to listen. I wanted to understand what they hated about their current setup. Answers were consistent: their homegrown DAGs were fragile, on-call pagers woke them up at 2am, and they spent 30% of their time on pipeline maintenance. I framed our framework not as 'the platform team's standard' but as 'the solution to your 2am pages' — reorienting the pitch around their pain, not our governance goals. I then ran a 4-week pilot with one willing squad, handled their migration personally, and measured the result: their pipeline-incident rate dropped from 3/month to 0, and maintenance time dropped from 30% to 8%. I turned that into a 2-slide internal case study and presented it at an all-hands data sync. I also made adoption easy: I wrote a step-by-step migration guide, offered 'office hours' every Tuesday for 8 weeks, and created a shared Slack channel where I personally answered questions within 2 hours. Six months later, 5 of 7 squads had migrated. The two remaining squads had legacy pipelines scheduled for decommission.\n\nResult: Company-wide pipeline-incident rate (outside platform-team DAGs) dropped 64% over 6 months. Two of the squad leads who were initially most resistant became vocal advocates and helped onboard the last two squads. Retrospectively, I would have established a shared SLA document earlier — clearer written expectations about incident response times would have accelerated the skeptical squads.\n\nWhat the interviewer is assessing: Influence strategy (listening before pitching, aligning to others' incentives), evidence of real adoption (metrics, not 'they agreed'), willingness to do the work for others (migration guide, office hours), and senior self-awareness (what would you do differently).",
    rubric: [
      "Demonstrates listening and empathy before proposing the solution",
      "Aligns the proposal to the other team's incentives, not just the platform team's goals",
      "Runs a pilot and uses data from it to drive broader adoption",
      "Measures real adoption with metrics, not just agreement in a meeting",
      "Reflects on what they would do differently, showing senior-level self-awareness",
    ],
  },
  {
    id: "bhv-disagree-and-commit",
    category: "behavioral",
    executes: false,
    free: false,
    level: "senior",
    title: "Disagreeing with a technical or architectural decision",
    company: "AI platform team · Series D",
    difficulty: "hard",
    mode: "text",
    prompt:
      "Tell me about a time you strongly disagreed with a technical decision made by your manager or a senior colleague. How did you voice your concerns, and what did you do after the decision went against your recommendation?",
    hints: [
      "The interviewer is testing two things simultaneously: your willingness to speak up (have backbone) and your ability to commit fully once a decision is made (disagree and commit). Both halves are required for a strong answer.",
      "Show that your pushback was evidence-based: you brought data, a proof-of-concept, or a risk analysis — not just intuition. And show that your disagreement was respectful and professional.",
      "For the 'commit' half: show that after the decision was made you executed it as if it were your own idea — no passive resistance, no 'I told you so.' Bonus points if you identified ways to mitigate the risks of the chosen path.",
    ],
    starter: "",
    idealAnswer:
      "STAR model answer:\n\nSituation: At my previous company, the VP of Engineering decided to migrate our data warehouse from Snowflake to an in-house Spark-on-Kubernetes solution, arguing it would cut costs by 60%. I was the senior data engineer responsible for the warehouse and strongly disagreed.\n\nTask: My role was to voice my technical concerns through proper channels and, if the decision stood, lead the migration successfully.\n\nAction: I prepared a 4-page technical risk memo — not a complaint, but a structured analysis. It covered three areas: (1) a cost model showing that our Spark-on-Kubernetes TCO (engineering hours for cluster management, storage IO, networking) would likely close most of the gap within 18 months, based on our actual query patterns; (2) an operational risk section noting that our team had no Kubernetes expertise, which would create a 6-month vulnerability window; and (3) a middle-ground alternative: migrating only the heavy transformation workloads to Spark while keeping Snowflake for BI queries — estimated 35% cost reduction with half the risk. I presented this in a 45-minute architecture review with the VP and CTO. They heard me out, asked good questions, and ultimately decided to proceed with the full migration for strategic reasons (vendor independence) that I had not fully weighted.\n\nOnce the decision was made, I committed fully. I led the migration roadmap, hired a Kubernetes contractor for the first 4 months to close the expertise gap (my suggestion, which the VP approved), and set up weekly migration health reviews. I did not revisit my disagreement in team meetings or say 'I told you so' when we hit the operational challenges I had predicted. I did document the risk items as open tickets and drove their resolution proactively.\n\nResult: The migration completed in 11 months (1 month over plan, not the 6-month delay I had feared). Actual cost reduction landed at 38% — not 60% — but the VP acknowledged that my cost model had been more accurate. The team gained strong Kubernetes expertise. I was promoted to Staff Engineer partly on the strength of this migration.\n\nWhat the interviewer is assessing: Backbone (evidence-based pushback, not silence or passive resistance), commit (full execution once decided, no sabotage), and maturity to turn disagreement into proactive risk mitigation rather than 'I told you so.'",
    rubric: [
      "Pushback is evidence-based: data, cost model, risk analysis — not just intuition",
      "Raises concerns through appropriate channels (written doc, architecture review) before escalating",
      "Clearly demonstrates full commitment post-decision with no passive resistance",
      "Identifies ways to mitigate the risks of the chosen path even after losing the argument",
      "Outcome is honest: acknowledges both where they were right and where the decision had merit",
    ],
  },
  {
    id: "bhv-mentoring",
    category: "behavioral",
    executes: false,
    free: false,
    level: "senior",
    title: "Mentoring a junior engineer through a technical challenge",
    company: "Data platform · scale-up",
    difficulty: "medium",
    mode: "text",
    prompt:
      "Tell me about a time you mentored or coached a junior data or software engineer. What was the challenge they were facing, how did you approach the mentorship, and what did you observe in terms of their growth?",
    hints: [
      "Ground the story in a specific technical challenge the junior engineer faced — not a general 'I was a mentor.' The more concrete the problem (e.g., debugging a Spark skew issue, designing their first dbt model), the more credible the answer.",
      "Describe your mentorship approach: did you pair program, review their PRs with detailed comments, assign structured learning tasks, or give them ownership with guardrails? Interviewers want to see that you have a deliberate method, not just 'I helped them.'",
      "Quantify or characterize the outcome: did they subsequently solve a similar problem independently? Did they mentor someone else? Growth is the signal — not that you solved it for them.",
    ],
    starter: "",
    idealAnswer:
      "STAR model answer:\n\nSituation: I was a senior data engineer when a junior engineer named Alex joined the team. They had a Python background but no prior exposure to distributed systems. Six weeks in, they were assigned to optimize a PySpark job that was running 4 hours per nightly run — it was causing downstream SLA breaches on the reporting layer.\n\nTask: My manager asked me to mentor Alex through this task rather than fix it myself, the goal being to develop Alex's distributed-systems intuition.\n\nAction: I started with a 'diagnose before fix' session: I walked Alex through the Spark UI together, teaching them what to look for — executor skew (one task taking 10x longer than others), shuffle read size, and spill to disk. I asked leading questions rather than stating answers: 'What do you notice about the distribution of task durations in this stage?' Alex identified the skew independently within 20 minutes. I then gave them a structured assignment: read two internal runbooks on salting and broadcast joins, then propose a fix in writing before touching the code. Alex proposed salting the skewed join key, which was correct. I reviewed their proposal in a 30-minute session, pushed back on one assumption (they had chosen a salt factor of 100 — I asked them to calculate the cardinality and explain why 100 was the right number), and they revised to 20. They implemented it, the job dropped from 4 hours to 47 minutes. I gave detailed PR review comments focused on code readability and test coverage, not just correctness. Three months later Alex independently diagnosed and fixed a different skew problem on another pipeline — they did not need to ask me. They also presented the salting technique at our internal data guild meeting.\n\nResult: The pipeline SLA breach was resolved (47-minute runtime vs. a 90-minute limit). More importantly, Alex developed a mental model for distributed debugging that they applied independently and then taught to others. I measured success by the fact that they no longer needed me for this class of problem.\n\nWhat the interviewer is assessing: Whether you develop people or just solve problems for them, whether you have a deliberate teaching method (Socratic questioning, structured assignments, PR feedback), and whether you can articulate observable growth in the mentee.",
    rubric: [
      "Grounds the story in a specific technical challenge, not a generic mentorship narrative",
      "Uses a deliberate mentorship technique (Socratic questioning, structured assignment, guardrails with ownership) rather than just solving it for them",
      "Provides evidence of learning: mentee solved a similar problem independently afterward",
      "Shows patience: did not short-circuit the process even when it would have been faster to fix it directly",
      "Quantifies the technical outcome (pipeline improvement) alongside the developmental outcome (mentee's growth)",
    ],
  },
];
