import type { ConvItem } from "./types";

/**
 * Incident Debugging — ML Engineer role set. Production "find the root cause"
 * scenarios for an MLE on call: great offline / poor in prod (train-serve skew),
 * constant predictions, label leakage, a bad retrain shipped without an eval gate,
 * stale online features, GPU OOM past a batch threshold, and "drift" that's really
 * a unit change. The candidate reads artifacts (training/serving code, feature
 * specs, monitoring logs), investigates with a Python scratchpad and/or SQL over
 * feature/prediction tables, then submits a root-cause + fix. The diagnosed answer
 * lives server-side in incident-mle.server.ts (resolved by problemId).
 */

/* ------------------------------------------------------------------ */
/* 1 — TRAIN-SERVE SKEW (hard)                                        */
/* ------------------------------------------------------------------ */

const SKEW_TRAIN_PY = `# train_features.py — OFFLINE feature build (batch, Spark/pandas).
# Builds the "amount_vs_user_avg" feature used by the fraud model.
def build_amount_vs_user_avg(df):
    # df has all of a user's history available at train time.
    user_avg = df.groupby("user_id")["amount"].transform("mean")
    # ratio of this txn to the user's average spend
    df["amount_vs_user_avg"] = df["amount"] / user_avg
    return df
`;

const SKEW_SERVE_PY = `# serve_features.py — ONLINE feature build (request path, per-transaction).
# Must produce the SAME "amount_vs_user_avg" feature the model trained on.
def amount_vs_user_avg(txn, user_profile):
    # user_profile.avg_amount comes from the online store, refreshed nightly.
    avg = user_profile.get("avg_amount") or 0.0
    if avg == 0.0:
        # cold-start / missing profile -> default the ratio to 1.0
        return 1.0
    # BUG hides here: offline divides amount by the *mean including this txn*,
    # online divides by a profile average that EXCLUDES the current txn and is
    # a day stale. Same feature name, two different computations.
    return txn["amount"] / avg
`;

const SKEW_SPEC = `# feature_spec.md — amount_vs_user_avg
# Definition (intended): amount / (trailing 30-day mean of the user's amount,
#   AS OF the transaction time, excluding the current transaction).
# Offline source: warehouse table user_txn_history (full history, leak-prone groupby mean).
# Online source : online_store.user_profile.avg_amount (refreshed nightly batch).
# Owner: fraud-ml. Last reviewed: 8 months ago.
`;

const SKEW_LOG = `[2026-05-30 09:00] eval        INFO  offline holdout AUC=0.94, PR-AUC=0.71 (unchanged from last 4 retrains)
[2026-05-30 12:10] serving     INFO  model v37 promoted to 100% traffic
[2026-05-31 02:00] monitoring  WARN  prod precision@review dropped 0.62 -> 0.38 vs offline 0.71
[2026-05-31 02:05] monitoring  WARN  feature amount_vs_user_avg: train mean=1.04 sd=0.6 | serve mean=1.81 sd=2.9
[2026-05-31 08:30] oncall      NOTE  model is fine offline. retrained twice, no change in prod. ???
`;

const SKEW_SETUP = `CREATE TABLE feature_log (
  txn_id            INTEGER,
  source            VARCHAR,        -- 'train' or 'serve'
  amount            DECIMAL(10,2),
  amount_vs_user_avg DECIMAL(10,4)  -- the feature value actually fed to the model
);
-- Same 6 transactions, logged from BOTH the offline build and the online path.
-- Compare the feature value per txn_id across sources: they should match, they don't.
INSERT INTO feature_log VALUES
  (1,'train', 50.00, 1.0204),   (1,'serve', 50.00, 2.5000),
  (2,'train', 20.00, 0.8163),   (2,'serve', 20.00, 1.0000),  -- serve cold-start defaulted to 1.0
  (3,'train',200.00, 1.6949),   (3,'serve',200.00, 4.4444),
  (4,'train', 35.00, 0.9211),   (4,'serve', 35.00, 1.7500),
  (5,'train', 18.00, 0.7660),   (5,'serve', 18.00, 1.0000),  -- serve cold-start defaulted to 1.0
  (6,'train',120.00, 1.3636),   (6,'serve',120.00, 3.0000);
`;

/* ------------------------------------------------------------------ */
/* 2 — CONSTANT FEATURE -> IDENTICAL PREDICTIONS (standard)           */
/* ------------------------------------------------------------------ */

const CONST_SERVE_PY = `# score.py — serving entrypoint for the ranking model.
FEATURES = ["recency_days", "country", "device", "session_clicks", "ad_score"]

def featurize(req, store):
    row = {
        "recency_days":   req["recency_days"],
        "country":        req["country"],
        "device":         req["device"],
        "session_clicks": req["session_clicks"],
        # ad_score is read from the online feature store by key.
        # Upstream the producing job renamed the column; this key now misses
        # and the store returns its default, the same value for everyone.
        "ad_score":       store.get_feature("ad_score", default=0.5),
    }
    return [row[f] for f in FEATURES]
`;

const CONST_LOG = `[2026-05-29 14:02] ranker  INFO  p50 score=0.7314 p99 score=0.9120 (healthy spread)
[2026-05-30 03:11] feature-job  INFO  deploy: renamed output column ad_score -> ad_relevance_score
[2026-05-30 06:00] ranker  INFO  p50 score=0.5000 p99 score=0.5000 (variance=0.0)
[2026-05-30 09:40] product  ALERT  every user sees the SAME ranking; CTR -41%
`;

const CONST_SETUP = `CREATE TABLE predictions (
  request_id   INTEGER,
  ts           TIMESTAMP,
  ad_score_feat DECIMAL(6,4),  -- value of ad_score fed to the model
  prediction    DECIMAL(6,4)
);
-- Before the feature-job deploy: ad_score varies, predictions vary.
-- After 2026-05-30 03:11: ad_score is constant 0.5 (store default), predictions collapse.
INSERT INTO predictions VALUES
  (1, TIMESTAMP '2026-05-29 14:00:00', 0.8200, 0.7314),
  (2, TIMESTAMP '2026-05-29 14:01:00', 0.3100, 0.4102),
  (3, TIMESTAMP '2026-05-29 14:02:00', 0.9500, 0.9120),
  (4, TIMESTAMP '2026-05-30 06:00:00', 0.5000, 0.5000),
  (5, TIMESTAMP '2026-05-30 06:01:00', 0.5000, 0.5000),
  (6, TIMESTAMP '2026-05-30 06:02:00', 0.5000, 0.5000),
  (7, TIMESTAMP '2026-05-30 06:03:00', 0.5000, 0.5000);
`;

/* ------------------------------------------------------------------ */
/* 3 — LABEL LEAKAGE (hellish)                                        */
/* ------------------------------------------------------------------ */

const LEAK_TRAIN_PY = `# train.py — loan default model. Offline AUC=0.991 (suspiciously high).
import lightgbm as lgb

FEATURES = [
    "income", "loan_amount", "term_months", "fico",
    "dti_ratio", "employment_years",
    "days_since_disbursement",   # added last sprint, "improved AUC a lot"
    "collections_amount",        # also added last sprint
]
LABEL = "defaulted"

def train(df):
    X, y = df[FEATURES], df[LABEL]
    model = lgb.LGBMClassifier().fit(X, y)
    # offline holdout AUC jumped 0.86 -> 0.99 after the two new features landed
    return model
`;

const LEAK_SPEC = `# feature_dictionary.md (excerpt)
# days_since_disbursement : (event_date - disbursement_date) in days, from the
#     loan_outcomes table. NOTE: loan_outcomes rows are written by the collections
#     system AFTER an account resolves (paid off OR charged off / defaulted).
# collections_amount      : $ sent to collections. Non-zero ONLY for accounts that
#     have already entered collections (i.e. already on the path to default).
# income, fico, dti_ratio, ... : application-time features, known at decision time.
`;

const LEAK_LOG = `[2026-05-15] eval     INFO  challenger AUC=0.991 (champion 0.862). promoted on AUC alone.
[2026-05-22] prod     WARN  approval rate +18%, but realized default rate climbing.
[2026-06-01] finance  ALERT  prod model ranks no better than random on NEW applications.
[2026-06-01] oncall   NOTE  offline it's near-perfect. drift? data quality? the two new
                            features have monster importance though.
`;

const LEAK_SETUP = `CREATE TABLE training_rows (
  loan_id                 INTEGER,
  income                  INTEGER,
  fico                    INTEGER,
  dti_ratio               DECIMAL(4,3),
  days_since_disbursement INTEGER,   -- from loan_outcomes (written post-resolution)
  collections_amount      DECIMAL(10,2),
  defaulted               BOOLEAN     -- the label
);
-- collections_amount is > 0 IFF defaulted is true: the feature perfectly encodes
-- the target. days_since_disbursement is only populated for resolved loans. Both
-- are unavailable at decision time -> classic label leakage, not drift.
INSERT INTO training_rows VALUES
  (1, 60000, 720, 0.220,  90,    0.00, false),
  (2, 42000, 640, 0.410, 110, 3200.00, true),
  (3, 88000, 780, 0.150,  75,    0.00, false),
  (4, 35000, 600, 0.520, 130, 4800.00, true),
  (5, 71000, 700, 0.280,  60,    0.00, false),
  (6, 50000, 660, 0.390, 120, 2750.00, true),
  (7, 95000, 800, 0.120,  50,    0.00, false),
  (8, 38000, 615, 0.470, 140, 5100.00, true);
`;

/* ------------------------------------------------------------------ */
/* 4 — BAD RETRAIN, NO EVAL GATE (standard)                           */
/* ------------------------------------------------------------------ */

const GATE_PIPELINE_PY = `# retrain_pipeline.py — nightly scheduled retrain + auto-promote.
def nightly_retrain():
    df = load_last_90_days()
    challenger = train(df)
    register(challenger, stage="Production")   # <-- promotes unconditionally
    # NOTE: there is no comparison against the current champion's metrics,
    # no holdout-AUC threshold, no champion-challenger shadow test. Whatever
    # trains tonight goes straight to 100% traffic.
    return challenger
`;

const GATE_LOG = `[2026-05-28 02:00] retrain  INFO  trained on 2026-02-27..2026-05-28
[2026-05-28 02:01] retrain  INFO  rows=812,004  positives=41 (0.005%)  <-- usually ~3%
[2026-05-28 02:01] retrain  INFO  upstream label-join changed; most labels arrived NULL->dropped
[2026-05-28 02:02] retrain  INFO  challenger holdout AUC=0.55 (champion was 0.88)
[2026-05-28 02:02] retrain  INFO  promoted challenger to Production
[2026-05-28 09:00] product  ALERT  conversions -22% overnight; model predicts ~0 for everyone
`;

const GATE_SETUP = `CREATE TABLE model_registry (
  version     INTEGER,
  trained_on  DATE,
  holdout_auc DECIMAL(4,3),
  pos_rate    DECIMAL(6,5),   -- positive-label rate in the training set
  stage       VARCHAR
);
-- v41 trained on a day where the label join broke (pos_rate cratered),
-- yet it was promoted to Production anyway with AUC 0.55 < champion 0.88.
INSERT INTO model_registry VALUES
  (38, DATE '2026-05-25', 0.881, 0.0312, 'Archived'),
  (39, DATE '2026-05-26', 0.879, 0.0298, 'Archived'),
  (40, DATE '2026-05-27', 0.884, 0.0305, 'Archived'),
  (41, DATE '2026-05-28', 0.550, 0.00005, 'Production');
`;

/* ------------------------------------------------------------------ */
/* 5 — STALE ONLINE FEATURE STORE (hard)                              */
/* ------------------------------------------------------------------ */

const STALE_DAG_PY = `# materialize.py — Airflow job that syncs offline features -> online store.
# Runs hourly; writes user_activity features the recommender reads at request time.
def materialize_hour(ts):
    feats = compute_user_activity(window_end=ts)   # last-1h clicks, views, cart adds
    online_store.write("user_activity", feats)      # upsert into Redis
    # Upstream 'compute_user_activity' depends on the events table, which is fed
    # by a Kafka->warehouse sink. If the sink lags, this job still 'succeeds' but
    # writes hours-old aggregates. There is no freshness/age assertion on write.
`;

const STALE_LOG = `[2026-05-31 00:00] materialize  INFO  user_activity sync OK (1.2M keys)
[2026-05-31 01:00] kafka-sink   WARN  consumer lag 5,400,000 and climbing (broker rebalance)
[2026-05-31 02:00] materialize  INFO  user_activity sync OK (1.2M keys)   <- 'OK' but stale input
[2026-05-31 09:00] product      ALERT  recs feel "frozen"; trending items missing; CTR -28%
[2026-05-31 09:15] oncall       NOTE   model unchanged, offline metrics fine. feature values look OLD.
`;

const STALE_SETUP = `CREATE TABLE online_features (
  user_id        INTEGER,
  feature_ts     TIMESTAMP,   -- event-time the feature was computed AS OF
  written_at     TIMESTAMP,   -- wall-clock time the row was written to the store
  clicks_last_1h INTEGER
);
-- written_at advances hourly (job 'succeeds'), but feature_ts is stuck at ~22:00
-- the previous night: the upstream sink lagged, so the store serves stale aggregates.
INSERT INTO online_features VALUES
  (101, TIMESTAMP '2026-05-30 22:00:00', TIMESTAMP '2026-05-31 00:00:00', 7),
  (101, TIMESTAMP '2026-05-30 22:00:00', TIMESTAMP '2026-05-31 01:00:00', 7),
  (101, TIMESTAMP '2026-05-30 22:00:00', TIMESTAMP '2026-05-31 02:00:00', 7),
  (202, TIMESTAMP '2026-05-30 22:05:00', TIMESTAMP '2026-05-31 00:00:00', 3),
  (202, TIMESTAMP '2026-05-30 22:05:00', TIMESTAMP '2026-05-31 01:00:00', 3),
  (202, TIMESTAMP '2026-05-30 22:05:00', TIMESTAMP '2026-05-31 02:00:00', 3);
`;

/* ------------------------------------------------------------------ */
/* 6 — GPU OOM / LATENCY CLIFF PAST A BATCH THRESHOLD (hard)          */
/* ------------------------------------------------------------------ */

const GPU_SERVE_PY = `# server.py — Triton-style dynamic batcher in front of a GPU transformer.
MAX_BATCH = 64          # bumped 16 -> 64 last week "for throughput"
MAX_SEQ_LEN = 2048

def collate(requests):
    # Pad every request in the batch to the LONGEST sequence in that batch.
    longest = max(len(r.tokens) for r in requests)
    padded = [pad(r.tokens, longest) for r in requests]
    return stack(padded)   # shape [batch, longest] -> activations scale with batch*longest^2

# KV/activation memory ~ batch_size * seq_len^2. At batch=64 with one 2048-token
# request in the batch, every request is padded to 2048 -> memory blows past the
# 40GB card. No per-batch token budget; batching is purely count-based.
`;

const GPU_LOG = `[2026-05-30 18:00] serving  INFO  batch_size=16 p99=140ms  gpu_mem=22GB  ok
[2026-05-31 12:00] serving  INFO  config change: max_batch 16 -> 64
[2026-05-31 20:05] serving  WARN  p99 220ms -> 1900ms during traffic peak
[2026-05-31 20:06] serving  ERROR CUDA out of memory: tried to allocate 11.50 GiB (40GB card)
[2026-05-31 20:06] serving  ERROR worker OOMKilled, restarting; requests dropping
[2026-05-31 20:10] oncall   NOTE  same model+weights as yesterday. only the batch config changed.
`;

const GPU_SETUP = `CREATE TABLE batch_metrics (
  ts           TIMESTAMP,
  batch_size   INTEGER,
  max_seq_len  INTEGER,   -- longest request in the batch (everything padded to this)
  gpu_mem_gb   DECIMAL(5,1),
  p99_ms       INTEGER,
  oom          BOOLEAN
);
-- Memory tracks batch_size * max_seq_len. OOM/latency-cliff only when a large batch
-- happens to contain a long sequence (batch 64 x seq 2048). Card is 40GB.
INSERT INTO batch_metrics VALUES
  (TIMESTAMP '2026-05-30 18:00:00', 16, 512,  18.0, 130, false),
  (TIMESTAMP '2026-05-30 18:01:00', 16, 2048, 24.0, 150, false),
  (TIMESTAMP '2026-05-31 20:00:00', 64, 256,  20.0, 160, false),
  (TIMESTAMP '2026-05-31 20:03:00', 64, 1024, 33.0, 900, false),
  (TIMESTAMP '2026-05-31 20:05:00', 64, 2048, 41.0, 1900, true),
  (TIMESTAMP '2026-05-31 20:06:00', 64, 2048, 41.0, 1900, true);
`;

/* ------------------------------------------------------------------ */
/* 7 — "DRIFT" THAT IS REALLY A UNIT CHANGE cents<->dollars (hellish) */
/* ------------------------------------------------------------------ */

const UNIT_SERVE_PY = `# features.py — pricing model serving featurizer.
# transaction_amount feeds the model and several derived features.
def featurize(txn):
    # Upstream the payments service migrated to a new SDK that emits amounts in
    # CENTS (integer minor units) instead of DOLLARS. The model trained on DOLLARS.
    # Nothing errors: a $42.50 txn now arrives as 4250 and is fed straight in.
    amt = txn["transaction_amount"]
    return {
        "transaction_amount": amt,
        "amount_log":         log1p(amt),
        "amount_per_item":    amt / max(txn["item_count"], 1),
    }
`;

const UNIT_MONITOR_LOG = `[2026-05-28] monitoring  INFO  PSI(transaction_amount)=0.02 day-over-day (stable)
[2026-05-29] payments    INFO  rolled out payment-sdk v9 (minor-units migration)
[2026-05-30] monitoring  WARN  PSI(transaction_amount)=0.81 (severe "drift"); mean 47 -> 4700
[2026-05-30] monitoring  WARN  model approval rate collapses; everything flagged high-value
[2026-05-31] oncall      NOTE  looks like a massive data-drift event. retrain on recent data?
`;

const UNIT_SETUP = `CREATE TABLE amount_samples (
  txn_id       INTEGER,
  sampled_on   DATE,
  raw_amount   INTEGER,   -- value as received from payments (units changed mid-stream)
  item_count   INTEGER
);
-- Before 2026-05-29 amounts are DOLLARS (~10-200). After payment-sdk v9 they are
-- CENTS: the SAME real amounts, multiplied by ~100. Not a behavior shift -- a unit
-- change. Distribution "moved" by exactly ~100x, a tell that it's units not drift.
INSERT INTO amount_samples VALUES
  (1, DATE '2026-05-28',   42,  3),
  (2, DATE '2026-05-28',  150,  1),
  (3, DATE '2026-05-28',   18,  2),
  (4, DATE '2026-05-28',   97,  4),
  (5, DATE '2026-05-30', 4200,  3),   -- same $42 txn, now in cents
  (6, DATE '2026-05-30',15000,  1),   -- same $150
  (7, DATE '2026-05-30', 1800,  2),   -- same $18
  (8, DATE '2026-05-30', 9700,  4);   -- same $97
`;

export const INCIDENT_MLE_ITEMS: ConvItem[] = [
  {
    id: "inc-mle-train-serve-skew",
    category: "incident",
    level: "senior",
    title: "Great offline AUC, prod precision tanks — a feature differs online vs batch",
    company: "Fintech ML",
    difficulty: "hard",
    free: true,
    executes: false,
    mode: "text",
    starter: "",
    prompt:
      "SEV-2: the fraud model holds AUC 0.94 / PR-AUC 0.71 on the offline holdout, unchanged across the last four retrains — yet prod precision@review just fell from 0.62 to 0.38. Retraining twice didn't move prod. Monitoring flags one feature, amount_vs_user_avg, with train mean 1.04 / sd 0.6 but serve mean 1.81 / sd 2.9. You have the offline build, the online build, the feature spec, the on-call log, and a feature_log table with the same txns scored from both paths. Find the root cause and the fix.",
    hints: [
      "Offline-good / prod-bad with stable offline metrics is the signature of train-serve skew: the model is fine, the feature it's fed in prod isn't what it trained on.",
      "Open train_features.py and serve_features.py side by side. Is amount_vs_user_avg computed the same way — same denominator, same as-of time, same cold-start handling?",
      "Run SQL over feature_log: SELECT for matching txn_id across source='train' vs 'serve' and diff the amount_vs_user_avg value. They should be identical; they aren't.",
    ],
    idealAnswer: "",
    rubric: [
      "Investigates before concluding — diffs the feature value per txn across train vs serve (SQL or Python) rather than guessing model decay",
      "Identifies train-serve skew on amount_vs_user_avg: offline divides by a groupby mean that includes the current txn / full history; online divides by a stale nightly profile average that excludes it",
      "Spots the online cold-start path that defaults the ratio to 1.0, further diverging from the offline computation",
      "Explains why retraining didn't help: both paths compute different values, so a fresh model still sees a different feature at serve time",
      "Fix: a single shared feature transform (one definition computed identically offline and online), point-in-time-correct (as-of, excluding current txn), with a train/serve parity check in CI",
    ],
    incident: {
      brief:
        "Fraud model: offline AUC 0.94 / PR-AUC 0.71 (stable across 4 retrains), but prod precision@review dropped 0.62 -> 0.38. Monitoring flags amount_vs_user_avg with very different train vs serve distributions. The model 'is fine offline' and two retrains didn't help. Root cause + fix.",
      severity: "SEV-2 · fraud-facing",
      tier: "hard",
      artifacts: [
        { name: "features/train_features.py", kind: "code", language: "python", content: SKEW_TRAIN_PY },
        { name: "features/serve_features.py", kind: "code", language: "python", content: SKEW_SERVE_PY },
        { name: "features/feature_spec.md", kind: "config", language: "text", content: SKEW_SPEC },
        { name: "logs/oncall.log", kind: "log", language: "text", content: SKEW_LOG },
      ],
      sql: { setupSql: SKEW_SETUP, tables: ["feature_log"] },
      python: true,
    },
  },
  {
    id: "inc-mle-constant-feature",
    category: "incident",
    level: "mid",
    title: "Every user gets the same ranking — predictions collapsed to one value",
    company: "FAANG · social",
    difficulty: "medium",
    free: true,
    executes: false,
    mode: "text",
    starter: "",
    prompt:
      "SEV-2: overnight, the ranking model started returning the identical score for everyone (p50 = p99 = 0.5000, variance 0.0) and CTR fell 41%. The model artifact wasn't redeployed. You have the serving featurizer, the on-call log, and a predictions table. Find what made the output go constant and how to fix it.",
    hints: [
      "Identical predictions for all inputs usually means an INPUT feature went constant — the model is just echoing a degenerate input. Find which feature flatlined.",
      "Read score.py: ad_score is fetched from the online store by key, with default=0.5. Now read the feature-job deploy line in the log — what changed about that key?",
      "Run SQL on predictions: GROUP BY the ad_score feature value before vs after the deploy timestamp, or compute its variance. It should vary; after the deploy it's pinned at 0.5 (the default).",
    ],
    idealAnswer: "",
    rubric: [
      "Investigates which feature went constant (variance/GROUP BY on the feature) rather than assuming the model broke",
      "Root cause: the upstream feature job renamed its output column (ad_score -> ad_relevance_score), so the serving lookup misses and returns the store default 0.5 for every request",
      "Connects the constant input to the constant output: a single near-constant high-importance feature collapses the score spread",
      "Fix: restore the key/contract (rename back or update the consumer), AND fail loud on a missing feature instead of silently defaulting; add a prediction-variance + feature-coverage monitor",
    ],
    incident: {
      brief:
        "Ranking model returns the same score for everyone (p50 = p99 = 0.5000, variance 0). CTR -41%. The model wasn't redeployed. A feature job deployed overnight. Find the root cause and the fix.",
      severity: "SEV-2 · customer-facing",
      tier: "standard",
      artifacts: [
        { name: "serving/score.py", kind: "code", language: "python", content: CONST_SERVE_PY },
        { name: "logs/oncall.log", kind: "log", language: "text", content: CONST_LOG },
      ],
      sql: { setupSql: CONST_SETUP, tables: ["predictions"] },
      python: true,
    },
  },
  {
    id: "inc-mle-label-leakage",
    category: "incident",
    level: "senior",
    title: "Offline AUC 0.99, prod ranks no better than random",
    company: "Fintech ML",
    difficulty: "hard",
    free: false,
    executes: false,
    mode: "text",
    starter: "",
    prompt:
      "SEV-1: the new loan-default challenger hit AUC 0.991 offline (champion was 0.862) and was promoted on AUC alone. In prod it ranks new applications no better than random and realized defaults are climbing after an 18% approval bump. Offline it's still near-perfect; the team suspects drift or data quality. Two features added last sprint have 'monster' importance. You have train.py, the feature dictionary, the log, and a training_rows table. Find the real root cause and the fix.",
    hints: [
      "AUC ~0.99 offline that collapses to random in prod is the textbook signature of label leakage, not drift — a feature is carrying information that only exists AFTER the outcome.",
      "Read the feature dictionary for the two new features. days_since_disbursement and collections_amount come from loan_outcomes / collections — are those known at DECISION time, or only after a loan resolves?",
      "Run SQL on training_rows: check the correlation between collections_amount > 0 and defaulted. If a feature is non-zero exactly when the label is true, it's encoding the target.",
    ],
    idealAnswer: "",
    rubric: [
      "Rejects the drift/data-quality framing and names label (target) leakage as the root cause",
      "Identifies the specific leaky features: collections_amount is non-zero only for accounts already in collections (perfectly correlated with default), and days_since_disbursement comes from post-resolution loan_outcomes",
      "Proves it by inspection + a query (e.g. collections_amount>0 <=> defaulted; the feature is unavailable at decision time)",
      "Explains the mechanism: offline both features are present so AUC is inflated; at decision time they're absent/zero, so prod degrades to random — and why high feature importance was the tell",
      "Fix: drop the leaky features (or recompute strictly point-in-time / as-of the application date), retrain, re-evaluate on a time-split holdout, and add a leakage check (per-feature AUC / future-timestamp audit) to the eval gate",
    ],
    incident: {
      brief:
        "Loan-default challenger: offline AUC 0.991 (champion 0.862), promoted on AUC alone. In prod it ranks new applications ~randomly and realized defaults are climbing. Offline still near-perfect. Two new features have huge importance. Find the real root cause and the fix.",
      severity: "SEV-1 · credit-decisioning",
      tier: "hellish",
      artifacts: [
        { name: "model/train.py", kind: "code", language: "python", content: LEAK_TRAIN_PY },
        { name: "model/feature_dictionary.md", kind: "config", language: "text", content: LEAK_SPEC },
        { name: "logs/oncall.log", kind: "log", language: "text", content: LEAK_LOG },
      ],
      sql: { setupSql: LEAK_SETUP, tables: ["training_rows"] },
      python: true,
    },
  },
  {
    id: "inc-mle-no-eval-gate",
    category: "incident",
    level: "mid",
    title: "A nightly retrain shipped a worse model to 100% traffic",
    company: "Marketplace",
    difficulty: "medium",
    free: false,
    executes: false,
    mode: "text",
    starter: "",
    prompt:
      "SEV-1: conversions fell 22% overnight and the model now predicts ~0 for everyone. The nightly retrain promoted a new version automatically. Its holdout AUC was 0.55 (champion was 0.88) and the training set had almost no positive labels. You have the retrain pipeline, the log, and the model_registry table. Explain how a worse model reached production and how to prevent it.",
    hints: [
      "Look at retrain_pipeline.py: what condition guards register(stage='Production')? Is there ANY comparison to the champion before promotion?",
      "Read the log: the label join changed and positives dropped to 0.005% (usually ~3%), so the challenger learned to predict ~0. Yet it still got promoted.",
      "Query model_registry: compare v41's holdout_auc and pos_rate to the previous versions. A promotion that lets 0.55 replace 0.88 means there's no eval gate.",
    ],
    idealAnswer: "",
    rubric: [
      "Identifies the missing eval gate / champion-challenger comparison: the pipeline promotes unconditionally regardless of metrics",
      "Identifies the proximate trigger: an upstream label-join change dropped most labels, crashing the positive rate (0.005% vs ~3%), so the challenger trains to predict ~0",
      "Uses the registry to show the promoted model (AUC 0.55) is strictly worse than the champion (0.88) — confirms it should never have shipped",
      "Fix: immediate rollback to the champion; add a promotion gate (holdout AUC must beat/within-epsilon of champion + data-quality assertions on row count, positive rate, label coverage) and ideally a shadow/canary before 100% traffic",
    ],
    incident: {
      brief:
        "Conversions -22% overnight; model predicts ~0 for everyone. The nightly retrain auto-promoted a version with holdout AUC 0.55 (champion 0.88) trained on a set with almost no positive labels. How did it reach prod, and how do you prevent it?",
      severity: "SEV-1 · revenue-impacting",
      tier: "standard",
      artifacts: [
        { name: "pipeline/retrain_pipeline.py", kind: "code", language: "python", content: GATE_PIPELINE_PY },
        { name: "logs/retrain.log", kind: "log", language: "text", content: GATE_LOG },
      ],
      sql: { setupSql: GATE_SETUP, tables: ["model_registry"] },
      python: true,
    },
  },
  {
    id: "inc-mle-stale-feature-store",
    category: "incident",
    level: "senior",
    title: "Recommendations feel frozen — online features stopped updating",
    company: "Marketplace",
    difficulty: "hard",
    free: false,
    executes: false,
    mode: "text",
    starter: "",
    prompt:
      "SEV-2: recommendations feel 'frozen' — trending items are missing and CTR is down 28%. The model is unchanged and offline metrics are fine, but feature values served online look old. The hourly materialization job reports success every run. You have the materialization job, the log, and an online_features table with both the feature event-time and the write time. Find why features are stale and how to fix it.",
    hints: [
      "Model fine + offline fine + 'values look OLD' points at feature freshness, not the model. Distinguish 'the job ran' from 'the job wrote FRESH data'.",
      "Read materialize.py: it depends on the events table fed by a Kafka->warehouse sink, and writes with no freshness/age assertion. Now read the kafka-sink consumer-lag warning in the log.",
      "Query online_features: written_at advances hourly but feature_ts is stuck near last night. The age (written_at - feature_ts) is growing — the store is serving stale aggregates.",
    ],
    idealAnswer: "",
    rubric: [
      "Separates 'job succeeded' from 'data is fresh' — recognizes a green job can still write stale features",
      "Root cause: the upstream Kafka->warehouse sink lagged (consumer lag climbing), so compute_user_activity reads hours-old events; the materialization 'succeeds' and writes stale aggregates to the online store",
      "Proves it with the data: written_at advances but feature_ts is pinned to ~last night; feature age (written_at - feature_ts) grows over time",
      "Fix: clear the sink backlog / fix the consumer lag to restore freshness; add a freshness SLA — a max-age assertion on materialize that fails (or doesn't publish) when feature_ts lags written_at, plus a serving-side staleness monitor/alert",
    ],
    incident: {
      brief:
        "Recommendations feel frozen; trending items missing; CTR -28%. Model unchanged, offline metrics fine, but online feature values look old. The hourly materialization job reports success every run. Find why features are stale and the fix.",
      severity: "SEV-2 · customer-facing",
      tier: "hard",
      artifacts: [
        { name: "pipeline/materialize.py", kind: "code", language: "python", content: STALE_DAG_PY },
        { name: "logs/oncall.log", kind: "log", language: "text", content: STALE_LOG },
      ],
      sql: { setupSql: STALE_SETUP, tables: ["online_features"] },
      python: true,
    },
  },
  {
    id: "inc-mle-gpu-oom-batch",
    category: "incident",
    level: "senior",
    title: "GPU serving OOMs and latency cliffs past a batch-size threshold",
    company: "FAANG · streaming",
    difficulty: "hard",
    free: false,
    executes: false,
    mode: "text",
    starter: "",
    prompt:
      "SEV-1: the GPU inference service started throwing CUDA out-of-memory and p99 latency spiked from ~220ms to ~1900ms during peak, with workers OOMKilled and requests dropping. Same model and weights as yesterday — only the batcher's max batch size changed (16 -> 64). You have the serving/batcher code, the log, and a batch_metrics table. Find the root cause and the fix.",
    hints: [
      "Same weights, only the batch config changed — so this is a serving/memory problem, not a model problem. Think about how memory scales with batch size AND sequence length.",
      "Read server.py: collate() pads every request to the LONGEST sequence in the batch, and activation/KV memory ~ batch_size * seq_len^2. Batching is count-based with no token budget.",
      "Query batch_metrics: gpu_mem_gb and p99_ms vs batch_size and max_seq_len. OOM only fires when a big batch (64) also contains a long sequence (2048) — the product blows past the 40GB card.",
    ],
    idealAnswer: "",
    rubric: [
      "Rules out a model/weights change — isolates the batch-size config bump as the trigger",
      "Root cause: count-based batching with no token/memory budget; padding to the longest sequence makes memory scale with batch_size * max_seq_len^2, so batch=64 with a 2048-token request exceeds the 40GB card -> OOM and a latency cliff",
      "Uses batch_metrics to show OOM correlates with the batch_size x max_seq_len product (not batch size alone) and that padding wastes compute on short sequences",
      "Fix: lower max batch (or revert to 16) and add a per-batch TOKEN budget (cap batch_size * max_seq_len), length-bucket requests to limit padding, set a memory-aware/dynamic max batch, and add admission control so bursts queue instead of OOMing",
    ],
    incident: {
      brief:
        "GPU inference: CUDA OOM and p99 220ms -> 1900ms at peak, workers OOMKilled, requests dropping. Same model/weights as yesterday; only max batch size changed 16 -> 64. Find the root cause and the fix.",
      severity: "SEV-1 · customer-facing",
      tier: "hard",
      artifacts: [
        { name: "serving/server.py", kind: "code", language: "python", content: GPU_SERVE_PY },
        { name: "logs/serving.log", kind: "log", language: "text", content: GPU_LOG },
      ],
      sql: { setupSql: GPU_SETUP, tables: ["batch_metrics"] },
      python: true,
    },
  },
  {
    id: "inc-mle-unit-drift",
    category: "incident",
    level: "senior",
    title: "Sudden 'data drift' — or is it cents vs dollars?",
    company: "Fintech ML",
    difficulty: "hard",
    free: false,
    executes: false,
    mode: "text",
    starter: "",
    prompt:
      "SEV-1: the monitoring dashboard fired a severe drift alert — PSI on transaction_amount jumped from 0.02 to 0.81 and the mean leapt from ~47 to ~4700 overnight. The pricing model now flags nearly everything as high-value and approval rate collapsed. The on-call wants to retrain on recent data. You have the serving featurizer, the monitoring log, and an amount_samples table. Decide whether this is really drift, and give the root cause and the fix.",
    hints: [
      "A mean that jumps ~100x literally overnight is not how real behavioral drift looks — that's an almost-exact constant factor. Check whether the shift is a clean multiple.",
      "Read features.py and the monitoring log together: the payments service rolled out an SDK that emits CENTS (minor units) the same day the 'drift' started. The model trained on DOLLARS.",
      "Query amount_samples: compare raw_amount before vs after the rollout for comparable txns. After divides cleanly by ~100 back to the old range — same real amounts, new units. Retraining would bake in a bug.",
    ],
    idealAnswer: "",
    rubric: [
      "Resists the 'retrain on recent data' reflex and tests whether the shift is a clean ~100x factor rather than genuine behavioral drift",
      "Root cause: a unit change, not drift — the payments SDK migrated to cents (minor units) while the model expects dollars; values are ~100x larger but represent the same real amounts",
      "Proves it with the data: post-rollout raw_amount / 100 lands back in the pre-rollout distribution (a clean constant factor, exactly aligned with the SDK rollout date)",
      "Explains why retraining is the wrong fix: it would launder a data-contract bug into the model and break again on the next unit/SDK change",
      "Fix: normalize units at ingestion (convert cents -> dollars to match the training contract), backfill/repredict the affected window, and add a unit/schema contract test + a 'sudden constant-factor shift' guard distinct from the drift monitor",
    ],
    incident: {
      brief:
        "Drift alert: PSI(transaction_amount) 0.02 -> 0.81, mean ~47 -> ~4700 overnight; pricing model flags everything high-value, approvals collapse. On-call wants to retrain on recent data. Is it really drift? Give the root cause and the fix.",
      severity: "SEV-1 · revenue-impacting",
      tier: "hellish",
      artifacts: [
        { name: "serving/features.py", kind: "code", language: "python", content: UNIT_SERVE_PY },
        { name: "logs/monitoring.log", kind: "log", language: "text", content: UNIT_MONITOR_LOG },
      ],
      sql: { setupSql: UNIT_SETUP, tables: ["amount_samples"] },
      python: true,
    },
  },
];
