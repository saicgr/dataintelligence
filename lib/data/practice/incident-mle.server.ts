import "server-only";
import type { IncidentScenario } from "./incidents.server";

/**
 * SERVER-ONLY answer key for the ML Engineer Incident Debugging scenarios.
 * Keyed by problemId (must match the ids in incident-mle.ts). Holds the diagnosed
 * root cause, fix, contributing factors, red herrings (hellish), triage order,
 * grading rubric, and the facts the coach MAY reveal. None of this ships to the
 * client — `import "server-only"` is the enforcement boundary. Merged into
 * INCIDENT_SCENARIOS and resolved by problemId in grade/route.ts + chat/route.ts.
 */
export const INCIDENT_MLE_SCENARIOS: Record<string, IncidentScenario> = {
  "inc-mle-train-serve-skew": {
    actualRootCause:
      "Train-serve skew on the feature amount_vs_user_avg. The offline build (train_features.py) computes amount / groupby('user_id').mean(), a mean that includes the current transaction and uses full history. The online build (serve_features.py) divides the same amount by user_profile.avg_amount — a nightly-refreshed online-store average that EXCLUDES the current txn and is up to a day stale — and on a missing/cold-start profile it defaults the ratio to 1.0. Same feature name, two different computations, so the model is fed a different feature at serving than it trained on. Offline metrics stay strong (the offline feature is internally consistent) while prod precision collapses. Retraining doesn't help because every retrain still trains on the offline definition and serves the divergent one.",
    actualFix:
      "Define the feature once and compute it identically in both paths — a single shared transform (e.g. a feature-store transformation or shared library) that is point-in-time correct: trailing mean as-of the txn time, excluding the current txn, with explicit, identical cold-start handling. Add a train/serve parity check in CI that logs the feature from both paths on the same inputs and fails on divergence; backfill/replay once parity is restored.",
    contributingFactors: [
      "Two separate code paths implementing the 'same' feature (offline groupby mean vs online profile average)",
      "Online average excludes the current txn and is a day stale; offline mean includes it / uses full history",
      "Online cold-start defaults the ratio to 1.0, adding more divergence",
      "No train/serve parity test; feature_spec last reviewed 8 months ago",
    ],
    redHerrings: [
      "Model decay / needing a retrain — but offline metrics are stable across 4 retrains and two retrains didn't move prod",
      "Concept drift in fraud patterns — the offline distribution is unchanged; it's the SERVE-side feature distribution that moved",
    ],
    triageOrder: [
      "Mitigate: fall back to the previous trusted scoring (or raise the review threshold) so bad precision doesn't flood the review queue",
      "Root-cause: diff amount_vs_user_avg per txn across train vs serve (feature_log) and read both build paths",
      "Prevent: unify the feature into one shared, point-in-time transform + add a CI train/serve parity assertion",
    ],
    rubric: [
      "Investigates before concluding — diffs the feature value per txn across train vs serve rather than assuming decay",
      "Names train-serve skew on amount_vs_user_avg and the two divergent computations",
      "Spots the cold-start default-to-1.0 and the stale/excludes-current-txn denominator online",
      "Explains why retraining didn't help (both paths still differ at serve time)",
      "Fix: one shared point-in-time transform computed identically offline+online, with a CI parity check",
      "Triage: mitigate the review-queue impact before chasing root cause",
    ],
    facts: [
      { q: "Did the model artifact or weights change?", a: "No — same trained model; only prod behavior changed. Two retrains since made no difference." },
      { q: "Did the offline holdout distribution move?", a: "No, offline AUC/PR-AUC are unchanged across the last four retrains; only the SERVE-side feature distribution shifted." },
      { q: "Where does the online average come from?", a: "user_profile.avg_amount in the online store, refreshed by a nightly batch; it excludes the current transaction." },
      { q: "What does the online path do when the profile is missing?", a: "It defaults amount_vs_user_avg to 1.0 (cold start)." },
    ],
  },

  "inc-mle-constant-feature": {
    actualRootCause:
      "An input feature went constant upstream, so the model echoes a degenerate input. The feature job that produces ad_score deployed a change renaming its output column ad_score -> ad_relevance_score. The serving featurizer in score.py still looks up 'ad_score' with default=0.5, so the lookup now misses for every request and silently returns 0.5. With this high-importance feature pinned to a single value for everyone, the model's output spread collapses to ~0.5 (p50 = p99 = 0.5000, variance 0), and identical rankings tank CTR.",
    actualFix:
      "Restore the feature contract — either rename the column back or update the consumer key to ad_relevance_score — and stop silently defaulting: a missing required feature should fail loud (error/alert) or trigger fallback to last-known-good, not return a constant. Add a prediction-variance monitor and a per-feature coverage/null-rate alert so a flatlined feature pages immediately; gate feature-schema changes behind a contract/compatibility check.",
    contributingFactors: [
      "Upstream feature job renamed its output column without coordinating with the consumer",
      "store.get_feature(..., default=0.5) silently masks a missing feature instead of failing",
      "ad_score is a high-importance feature, so pinning it collapses the score distribution",
      "No prediction-variance or feature-coverage monitor to catch the flatline",
    ],
    rubric: [
      "Investigates which feature went constant (variance / GROUP BY on the feature) rather than assuming the model broke",
      "Root cause: feature-job column rename -> serving lookup misses -> returns the default 0.5 for every request",
      "Connects the constant input to the constant output",
      "Fix: restore the contract AND fail loud on missing features + add variance/coverage monitors",
    ],
    facts: [
      { q: "Was the model redeployed?", a: "No — the model artifact is unchanged; only a feature job deployed overnight." },
      { q: "What value are predictions stuck at?", a: "0.5000 for every request — p50 equals p99, variance is 0." },
      { q: "What does the store return for a missing key?", a: "The default passed by the caller, which for ad_score is 0.5." },
      { q: "What changed in the feature job?", a: "It renamed its output column from ad_score to ad_relevance_score." },
    ],
  },

  "inc-mle-label-leakage": {
    actualRootCause:
      "Label (target) leakage, not drift. Two features added last sprint leak the outcome: collections_amount is non-zero ONLY for accounts that have already entered collections — i.e. it is essentially 1:1 with defaulted — and days_since_disbursement is sourced from the post-resolution loan_outcomes table, which only exists after a loan resolves. Neither is available at decision time. Offline, both are present, so the model trivially separates classes and AUC inflates to ~0.99 (and the features show 'monster' importance). At serving time, for a NEW application these features are absent/zero, so the model loses its illusory signal and ranks no better than random; approvals rose and realized defaults climbed.",
    actualFix:
      "Drop the leaky features (or recompute them strictly point-in-time, as-of the application date, from data available at decision time), retrain, and re-evaluate on a TIME-SPLIT holdout (train on past, test on future) rather than a random split. Add a leakage guard to the eval gate: per-feature single-feature AUC (flag any feature near-perfect on its own), a future-timestamp/source audit (reject features sourced from outcome tables), and require the challenger to beat the champion on a forward time split — not raw random-split AUC.",
    contributingFactors: [
      "Features sourced from outcome tables (loan_outcomes, collections) that are only populated after the label is known",
      "Promotion on offline AUC alone with a random (not time-based) split",
      "No leakage check / single-feature-AUC audit in the eval gate",
      "Huge feature importance on the new features was treated as a win instead of a red flag",
    ],
    redHerrings: [
      "Data/feature drift — but the offline metric is unchanged and near-perfect; a drift story can't explain offline-perfect / prod-random",
      "Data-quality issues on new applications — the features aren't dirty, they're simply unavailable at decision time (which is the leak)",
      "Approval-rate change as the cause — the +18% approvals is a SYMPTOM of the leaky model over-ranking, not the root cause",
    ],
    triageOrder: [
      "Mitigate: roll back to the 0.862 champion immediately to stop approving bad loans",
      "Root-cause: inspect the two new features' sources and prove collections_amount>0 <=> defaulted in training_rows",
      "Prevent: drop/point-in-time-fix the features, time-split eval, and add a leakage check to the promotion gate",
    ],
    rubric: [
      "Rejects the drift/data-quality framing and names label/target leakage",
      "Identifies the specific leaky features and WHY they're unavailable at decision time",
      "Proves it (single-feature AUC / collections_amount>0 perfectly tracks defaulted)",
      "Explains the offline-perfect / prod-random mechanism and the high-importance tell",
      "Fix: drop or point-in-time-correct features, time-split eval, leakage check in the gate",
      "Triage: roll back to champion before re-engineering",
    ],
    facts: [
      { q: "Where does collections_amount come from?", a: "The collections system — it's non-zero only for accounts that already entered collections, i.e. already defaulting." },
      { q: "Is days_since_disbursement known at application time?", a: "No — it's computed from loan_outcomes, which is written only after a loan resolves." },
      { q: "Did the offline metric drop?", a: "No, offline AUC is still ~0.99; only prod ranking on new applications collapsed." },
      { q: "What was the promotion criterion?", a: "Offline AUC alone, on a random split — the challenger beat the champion's AUC so it shipped." },
    ],
  },

  "inc-mle-no-eval-gate": {
    actualRootCause:
      "No eval gate / champion-challenger comparison. retrain_pipeline.py calls register(stage='Production') unconditionally — there is no holdout-AUC threshold, no comparison to the current champion, and no data-quality assertion. On 2026-05-28 an upstream label-join change caused most labels to arrive NULL and be dropped, crashing the positive rate to 0.005% (usually ~3%). The challenger trained on that near-label-free set learned to predict ~0 for everyone (holdout AUC 0.55 vs champion 0.88) and was still auto-promoted to 100% traffic, dropping conversions 22%.",
    actualFix:
      "Roll back to the champion (v40) immediately. Add a promotion gate before register(stage='Production'): the challenger must beat (or be within epsilon of) the champion on a frozen holdout, plus data-quality assertions on the training set (row count, positive-label rate within expected bounds, label coverage/non-null rate). Add a canary/shadow stage so a new model serves a small slice or logs-only before 100% traffic, and alert on the label-join/positive-rate anomaly upstream.",
    contributingFactors: [
      "Unconditional auto-promote with no champion-challenger comparison or AUC threshold",
      "Upstream label-join change dropped most labels (positive rate 0.005% vs ~3%)",
      "No data-quality gate on the training set (row count / positive rate / label coverage)",
      "Straight to 100% traffic with no canary or shadow stage",
    ],
    rubric: [
      "Identifies the missing eval gate / champion-challenger comparison (unconditional promote)",
      "Identifies the trigger: label-join change -> positives crater -> model predicts ~0",
      "Uses the registry to show 0.55 replaced 0.88 (strictly worse, should never ship)",
      "Fix: rollback + promotion gate (AUC vs champion + data-quality assertions) + canary/shadow",
    ],
    facts: [
      { q: "What guards the promotion in the pipeline?", a: "Nothing — register(stage='Production') runs unconditionally after every nightly train." },
      { q: "What was the new model's holdout AUC?", a: "0.55, versus the champion's 0.88." },
      { q: "What happened to the labels?", a: "An upstream label-join change made most labels arrive NULL and get dropped; the positive rate fell to 0.005% (usually ~3%)." },
      { q: "Was there any canary or shadow before full traffic?", a: "No — the challenger went straight to 100% of traffic." },
    ],
  },

  "inc-mle-stale-feature-store": {
    actualRootCause:
      "Stale online features from upstream pipeline lag — the model and offline metrics are fine. materialize.py reads from the events table fed by a Kafka->warehouse sink; that sink's consumer lag spiked (broker rebalance), so compute_user_activity reads hours-old events. Because the job has no freshness/age assertion, it still 'succeeds' and upserts stale aggregates into the online store. The recommender then serves last-night's user_activity values, so recs feel frozen and miss trending items (CTR -28%). In online_features, written_at advances hourly while feature_ts is pinned near 22:00 the prior night — feature age is growing.",
    actualFix:
      "Clear the Kafka sink backlog / fix the consumer lag to restore event freshness. Add a freshness SLA to materialize: assert max(written_at - feature_ts) below a threshold and DON'T publish (or page) when the input is stale instead of silently writing old aggregates. Add a serving-side staleness monitor on feature_ts age, and surface consumer lag as a first-class pipeline health signal so a lagging sink alerts before features rot.",
    contributingFactors: [
      "Kafka->warehouse sink consumer lag spiked after a broker rebalance",
      "Materialization job has no freshness/age assertion — it 'succeeds' on stale input",
      "Green job status masked a data-freshness failure (job ran, data didn't update)",
      "No serving-side staleness alert on feature age",
    ],
    redHerrings: [
      "Model regression / retrain — the model is unchanged and offline metrics are fine",
      "The materialization job failing — it reports success every run; the problem is stale INPUT, not a failed run",
    ],
    triageOrder: [
      "Mitigate: prioritize clearing the sink backlog (or scale consumers) to restore freshness; consider pausing recs that rely on the stalest features",
      "Root-cause: compare feature_ts vs written_at age in the store and trace it to the lagging sink",
      "Prevent: freshness SLA / max-age assertion on materialize + serving-side staleness monitor + lag alerting",
    ],
    rubric: [
      "Separates 'job succeeded' from 'data is fresh'",
      "Root cause: upstream sink lag -> stale events -> stale online features",
      "Proves it: written_at advances but feature_ts is stuck; feature age grows",
      "Fix: clear backlog + freshness-age assertion on write + serving staleness monitor + lag alerting",
    ],
    facts: [
      { q: "Did the model or offline metrics change?", a: "No — the model is unchanged and offline metrics are fine; only the served feature values are old." },
      { q: "Is the materialization job failing?", a: "No, it reports success every hour — but it's writing stale aggregates because its input is stale." },
      { q: "What's the upstream dependency?", a: "An events table fed by a Kafka->warehouse sink; that sink's consumer lag spiked after a broker rebalance." },
      { q: "What do the two timestamps mean?", a: "feature_ts is the event-time the feature was computed as-of; written_at is when the row was written. They should track; here written_at advances but feature_ts is stuck near last night." },
    ],
  },

  "inc-mle-gpu-oom-batch": {
    actualRootCause:
      "Count-based dynamic batching with no memory/token budget. The batcher's max batch was raised 16 -> 64, and collate() pads every request in a batch to the LONGEST sequence in that batch. GPU activation/KV memory scales roughly with batch_size * seq_len^2, so when a batch of 64 happens to contain a 2048-token request, all 64 are padded to 2048 and the allocation blows past the 40GB card — CUDA OOM, OOMKilled workers, dropped requests, and a latency cliff (the long padded batches also waste compute). The model and weights are unchanged; only the batch config changed. batch_metrics shows OOM only when batch_size AND max_seq_len are both large (64 x 2048), not at batch=64 with short sequences.",
    actualFix:
      "Lower the max batch (or revert to 16) and, more importantly, switch from count-based to a TOKEN/memory budget: cap batch_size * max_seq_len so a batch can't exceed the memory envelope. Length-bucket requests so short and long sequences aren't batched together (limits padding waste), set a memory-aware/dynamic max batch, and add admission control so traffic bursts queue or shed gracefully instead of OOMing.",
    contributingFactors: [
      "Max batch raised 16 -> 64 with no memory headroom analysis",
      "Padding to the longest sequence in the batch makes memory scale with batch * max_seq_len^2",
      "Batching is purely count-based — no token/memory budget per batch",
      "No admission control, so bursts pile into oversized batches",
    ],
    redHerrings: [
      "A model/weights change — the weights are identical to yesterday; only the batch config moved",
      "Generic 'traffic too high' — throughput at batch=64 is fine until a LONG sequence lands in the batch; it's the batch x seq-len product, not raw QPS",
    ],
    triageOrder: [
      "Mitigate: revert max batch to 16 to stop the OOM/restart loop and restore latency",
      "Root-cause: correlate gpu_mem/p99 with batch_size x max_seq_len in batch_metrics and read the collate padding",
      "Prevent: token/memory budget per batch + length bucketing + admission control",
    ],
    rubric: [
      "Isolates the batch-config bump as the trigger (rules out a model/weights change)",
      "Root cause: count-based batching + pad-to-longest -> memory ~ batch * seq_len^2 -> OOM past 40GB",
      "Uses batch_metrics to show OOM tracks the batch_size x max_seq_len product, not batch size alone",
      "Fix: token/memory budget, length bucketing, dynamic max batch, admission control",
    ],
    facts: [
      { q: "Did the model or weights change?", a: "No — same model and weights as yesterday; only the batcher's max batch size changed from 16 to 64." },
      { q: "How does collate pad?", a: "Every request in a batch is padded to the longest sequence in that batch." },
      { q: "How does memory scale?", a: "Roughly batch_size * seq_len^2 for activations/KV; the card is 40GB." },
      { q: "When exactly does it OOM?", a: "Only when a large batch (64) also contains a long sequence (2048) — the product exceeds the card. Batch=64 with short sequences is fine." },
    ],
  },

  "inc-mle-unit-drift": {
    actualRootCause:
      "Not drift — a unit change in the data contract. The payments service rolled out SDK v9, which emits transaction_amount in CENTS (integer minor units) instead of DOLLARS, on the same day the 'drift' alert fired. features.py feeds the raw amount straight to a model trained on DOLLARS, so every value is ~100x larger (mean ~47 -> ~4700, PSI 0.02 -> 0.81). The pricing model then treats ordinary transactions as high-value and approvals collapse. The ~100x jump is a near-exact constant factor aligned to the SDK rollout date — the tell that it's units, not behavioral drift. In amount_samples, post-rollout raw_amount / 100 lands back in the pre-rollout distribution.",
    actualFix:
      "Normalize units at ingestion — convert cents -> dollars to match the training contract — then backfill/re-predict the affected window. Do NOT retrain on the post-rollout data; that would launder a data-contract bug into the model and break on the next unit/SDK change. Add a unit/schema contract test on the payments feed (currency + minor-units flag), and a 'sudden constant-factor shift' detector distinct from the drift monitor so a clean ~100x jump is flagged as a contract break, not concept drift.",
    contributingFactors: [
      "Payments SDK v9 migrated amounts to cents (minor units) without a consumer-side unit contract",
      "Featurizer feeds raw amount with no unit normalization/validation",
      "The drift monitor reads a clean unit rescale as a drift event",
      "transaction_amount also feeds derived features (amount_log, amount_per_item), amplifying the error",
    ],
    redHerrings: [
      "Real concept/data drift — but a clean ~100x overnight jump aligned to an SDK rollout is a unit change, not gradual behavioral drift",
      "Retraining on recent data — tempting and explicitly proposed by on-call, but it would bake in the bug and re-break on the next unit change",
      "A genuine surge in high-value transactions — the SAME real amounts simply arrive in cents (divide by 100 to recover them)",
    ],
    triageOrder: [
      "Mitigate: normalize cents -> dollars at ingestion (or roll back the SDK) to stop mis-flagging, restore approvals",
      "Root-cause: confirm post-rollout amounts / 100 match the pre-rollout distribution and align with the SDK rollout date",
      "Prevent: unit/schema contract test on the feed + a constant-factor-shift guard separate from the drift monitor",
    ],
    rubric: [
      "Resists the 'retrain on recent data' reflex and tests for a clean ~100x factor",
      "Root cause: unit change (cents vs dollars), not drift, aligned to the SDK rollout",
      "Proves it: post-rollout raw_amount / 100 matches the pre-rollout distribution",
      "Explains why retraining is wrong (launders a contract bug, re-breaks next time)",
      "Fix: normalize units at ingestion + backfill + unit/schema contract test + constant-factor guard",
      "Triage: normalize/roll back to restore approvals before any re-engineering",
    ],
    facts: [
      { q: "How fast did the distribution move?", a: "Overnight — mean ~47 to ~4700, a near-exact ~100x jump, not a gradual shift." },
      { q: "What changed on the payments side?", a: "Payment SDK v9 rolled out the same day, migrating amounts to cents (minor units)." },
      { q: "What units did the model train on?", a: "Dollars — the featurizer feeds the raw amount with no unit conversion." },
      { q: "If you divide the new amounts by 100?", a: "They land back in the old dollar distribution — same real amounts, new units." },
    ],
  },
};
