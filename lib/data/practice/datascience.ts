import type { ConvItem } from "./types";

/**
 * Data Science / ML interview practice questions.
 * Researched from InterviewQuery, DataLemur, StrataScratch, Towards Data Science,
 * InterviewNode, DataInterview.com, and ML interview guides (2023-2026).
 * Topics: A/B testing design, p-value/CI/Type I&II, bias-variance & regularization,
 * imbalanced classification metrics, feature engineering & leakage,
 * ML system design (recommendation + churn), offline vs online eval, drift monitoring.
 * `free: true` items are playable without a Practice Pro subscription.
 */
export const DATASCIENCE_ITEMS: ConvItem[] = [
  // ─── JUNIOR ────────────────────────────────────────────────────────────────

  {
    id: "ds-pvalue-ci-types",
    category: "datascience",
    executes: false,
    free: true,
    level: "junior",
    title: "Explain p-value, confidence intervals, and Type I vs. Type II errors",
    company: "Consumer analytics startup · early-stage",
    difficulty: "easy",
    mode: "text",
    prompt:
      "A product manager asks you: 'We ran an A/B test and got a p-value of 0.03. Does that mean there is a 97% chance our new feature actually works?' How do you respond? Along the way, explain what a p-value really means, how confidence intervals relate to it, and distinguish Type I from Type II errors. Use a concrete example from a product or business context.",
    hints: [
      "A p-value is NOT the probability that the hypothesis is true — clarify what conditional probability it actually describes.",
      "Connect confidence intervals to the p-value threshold: if a 95% CI for the effect size excludes zero, that directly corresponds to p < 0.05.",
      "For Type I vs. Type II: anchor them to real consequences — a false positive means shipping a feature that does nothing; a false negative means killing a feature that would have worked.",
    ],
    starter: "",
    idealAnswer:
      "The PM is confusing the p-value with the probability the hypothesis is true — a common mistake. A p-value of 0.03 means: assuming the null hypothesis is true (the feature has no effect), there is a 3% chance of observing a result at least as extreme as ours by random chance. It says nothing about the probability the alternative hypothesis is true; that requires a Bayesian framework. Concrete example: if we ran 100 A/B tests on features that actually have zero effect, we would expect about 5 of them to produce p < 0.05 just by luck (with alpha = 0.05). A confidence interval is complementary: a 95% CI for the lift is a range of plausible effect sizes consistent with our data. If that CI is [+0.5%, +3.2%] for click-through rate, we can report both statistical significance and a meaningful range for business planning — the effect is probably small but real. Type I error (false positive, alpha): we conclude the feature works when it does not. Cost: wasted engineering effort shipping a useless change. Type II error (false negative, beta): we conclude the feature has no effect when it actually does. Cost: we miss a genuine improvement. The relationship: lowering alpha (e.g., from 0.05 to 0.01) reduces Type I errors but increases Type II errors for the same sample size; to control both, we need to increase sample size. Statistical power (1 - beta) is the probability of detecting a true effect. A well-designed experiment pre-specifies alpha, desired power (typically 0.8 or 0.9), and the minimum detectable effect (MDE) to compute the required sample size before running the test.",
    rubric: [
      "Correctly defines p-value as a conditional probability under H0, not the probability H1 is true",
      "Connects confidence intervals to the significance threshold (CI excluding zero ↔ p < alpha)",
      "Defines Type I error (false positive) and Type II error (false negative) with real business consequences",
      "Mentions statistical power and its relationship to sample size or the alpha/beta tradeoff",
      "Uses a concrete numeric or product example to ground the explanation",
    ],
  },

  {
    id: "ds-bias-variance-regularization",
    category: "datascience",
    executes: false,
    free: true,
    level: "junior",
    title: "Bias-variance tradeoff and when to use L1 vs. L2 regularization",
    company: "Fintech lender · Series B",
    difficulty: "easy",
    mode: "text",
    prompt:
      "You trained a gradient boosted model to predict loan default. On the training set you get 98% accuracy; on the held-out test set you get 72% accuracy. Your manager suggests adding L2 regularization. A colleague says to switch to L1. (1) Diagnose what is wrong with the model. (2) Explain the bias-variance tradeoff in plain terms. (3) Explain the difference between L1 and L2 regularization and when each is preferred. (4) What other techniques besides regularization would you try first?",
    hints: [
      "A large train-test accuracy gap is the textbook symptom of one specific problem — name it precisely using bias-variance vocabulary.",
      "L1 (Lasso) adds the absolute value of coefficients to the loss; L2 (Ridge) adds the squared magnitude. Think about what happens to small coefficients in each case.",
      "For tree-based models like GBMs, regularization via the loss function is less standard than other controls — what hyperparameters directly govern complexity?",
    ],
    starter: "",
    idealAnswer:
      "The 98% train / 72% test gap is a clear sign of overfitting — the model has high variance. It has memorized the training data, including noise, and fails to generalize. Bias-variance tradeoff: bias is the error from incorrect assumptions in the model (underfitting — model too simple to capture the true pattern). Variance is the error from sensitivity to small fluctuations in training data (overfitting — model too complex). As model complexity increases, bias decreases but variance increases; the sweet spot minimizes total test error. L1 vs. L2 regularization: both add a penalty term to the loss function to discourage large coefficients. L1 (Lasso) penalty = lambda * sum(|w_i|): it drives some coefficients exactly to zero, producing sparse models — effectively performs feature selection. Preferred when you suspect many features are irrelevant and want an interpretable, sparse model. L2 (Ridge) penalty = lambda * sum(w_i^2): it shrinks all coefficients toward zero but rarely to exactly zero — tends to produce more stable models when features are correlated. Preferred when most features are relevant and multicollinearity is a concern. For a gradient boosted model specifically, L1/L2 on linear weights is less natural than controlling tree-specific hyperparameters: max_depth (tree depth), min_samples_leaf (minimum observations per leaf), n_estimators + learning_rate (lower learning rate + more trees), and subsampling (row and column sampling per tree, analogous to dropout). Other techniques to try: (1) Cross-validation to get an unbiased test error estimate. (2) Learning curves to confirm overfitting diagnosis. (3) Reduce feature dimensionality — check for near-zero-variance or highly correlated features. (4) Increase training data if feasible. (5) Early stopping on a validation set. The right first move is to reduce tree depth and increase min_samples_leaf before resorting to loss-level regularization.",
    rubric: [
      "Correctly diagnoses the train-test gap as high variance / overfitting",
      "Explains bias-variance tradeoff with the complexity tradeoff (simple model = high bias, complex model = high variance)",
      "Distinguishes L1 (sparsity, feature selection, exact zeros) from L2 (shrinkage, stability, correlated features)",
      "Recommends tree-specific hyperparameters (max_depth, min_samples_leaf, subsampling) as the more direct remedy for a GBM",
      "Mentions at least one additional technique: learning curves, cross-validation, early stopping, or data augmentation",
    ],
  },

  // ─── MID ────────────────────────────────────────────────────────────────────

  {
    id: "ds-ab-test-design",
    category: "datascience",
    executes: false,
    free: false,
    level: "mid",
    title: "Design an A/B test for a checkout flow change",
    company: "E-commerce platform · Series C",
    difficulty: "medium",
    mode: "text",
    prompt:
      "The product team wants to test a redesigned checkout flow they believe will increase purchase conversion rate from 4% to 5%. Walk me through how you would design this A/B test end-to-end: (1) Define the hypothesis and success metric. (2) Calculate the required sample size and explain every input. (3) How long should the test run, and why running it only one day is dangerous? (4) What is p-hacking and how do you prevent it? (5) The novelty effect — what is it, and how would you detect or mitigate it?",
    hints: [
      "Sample size formula: n ≈ (z_alpha/2 + z_beta)^2 * 2 * p_bar * (1 - p_bar) / delta^2. Walk through each term — do not just quote the formula.",
      "P-hacking happens when you check results repeatedly and stop as soon as p < 0.05. Name the correction strategies: pre-registration, sequential testing, or Bonferroni.",
      "Novelty effect: users may click on the new UI simply because it is new. How do you separate genuine long-term lift from initial curiosity?",
    ],
    starter: "",
    idealAnswer:
      "Hypothesis: H0 — the new checkout flow does not change conversion rate. H1 — the new flow increases conversion rate (one-tailed, since we only care about improvement). Primary metric: purchase conversion rate = unique purchasers / unique sessions entering checkout. Guard-rail metrics: revenue per session, cart abandonment rate, page load time. Sample size: Using a two-proportion z-test. Inputs: baseline conversion p1 = 0.04, target conversion p2 = 0.05, MDE (minimum detectable effect) = delta = p2 - p1 = 0.01, significance level alpha = 0.05 (z_alpha/2 = 1.96 for two-tailed, 1.645 for one-tailed), power 1 - beta = 0.80 (z_beta = 0.84). Using the formula n = 2 * p_bar * (1 - p_bar) * (z_alpha + z_beta)^2 / delta^2 where p_bar = (p1+p2)/2 = 0.045, n ≈ 2 * 0.045 * 0.955 * (1.645+0.84)^2 / 0.0001 ≈ 25,400 per arm, so ~50,800 total checkout sessions needed. At 10,000 sessions/day entering checkout, that is approximately 5 days, but we should run for at least 1-2 full weeks to capture day-of-week effects (weekday vs. weekend purchasing behavior differs substantially). One day is dangerous because it captures only one day-of-week pattern and misses weekly periodicity, leading to a biased effect estimate. P-hacking: if you peek at results every day and stop the test when p < 0.05, you inflate the false positive rate well beyond 5%. After 5 peeks at alpha = 0.05, the actual false positive rate approaches 19%. Prevention: pre-register the hypothesis and stopping criterion before launch, use sequential testing methods (e.g., always-valid p-values or mSPRT), or apply Bonferroni correction for the number of planned analyses. Novelty effect: users are initially attracted to a new UI simply because it is different — conversions spike then return to baseline. Detection: compare the treatment effect in the first 3 days vs. the last 3 days of the test window; a declining treatment effect over time indicates novelty. Mitigation: run the test longer (3-4 weeks) so novelty wears off, or analyze new vs. returning users separately (novelty primarily affects returning users who are familiar with the old UI).",
    rubric: [
      "States hypothesis with primary and guard-rail metrics before calculating anything",
      "Explains all sample size inputs: baseline rate, MDE, alpha, power — and derives an approximate n",
      "Justifies minimum test duration with weekly seasonality (day-of-week effects)",
      "Defines p-hacking correctly and names at least one mitigation: pre-registration, sequential testing, or Bonferroni",
      "Explains novelty effect and describes a concrete detection method (e.g., effect decay over time or new vs. returning user split)",
    ],
  },

  {
    id: "ds-imbalanced-classification",
    category: "datascience",
    executes: false,
    free: false,
    level: "mid",
    title: "Metrics and strategies for imbalanced fraud classification",
    company: "Payments company · Series D",
    difficulty: "medium",
    mode: "text",
    prompt:
      "You are building a fraud detection model on a dataset where only 0.2% of transactions are fraudulent. Your colleague trains a logistic regression and reports 99.8% accuracy. (1) Why is accuracy a misleading metric here? (2) What metrics should you use instead, and what does each measure? (3) What is the PR-AUC and why is it preferable to ROC-AUC for this problem? (4) Describe at least two strategies to handle the class imbalance during training. (5) How do you choose the classification threshold for deployment — and who should be involved in that decision?",
    hints: [
      "The '99.8% accuracy' model can be beaten by a model that always predicts non-fraud — compute that baseline to make the point concrete.",
      "Precision = TP / (TP + FP); Recall = TP / (TP + FN). In fraud, which error type is more costly? That shapes your threshold choice.",
      "ROC-AUC uses all thresholds and both classes equally; PR-AUC focuses only on the positive class — this matters when the negative class dominates.",
    ],
    starter: "",
    idealAnswer:
      "Accuracy is misleading because a trivial model that predicts 'not fraud' for every transaction achieves 99.8% accuracy — it catches zero fraud. It is not a useful signal when classes are this imbalanced. Better metrics: Precision = TP / (TP + FP): of all transactions the model flags as fraud, what fraction is actually fraud? High precision means fewer false alarms. Recall (Sensitivity) = TP / (TP + FN): of all actual fraud, what fraction did we catch? High recall means fewer missed frauds. F1 score = harmonic mean of precision and recall: useful single metric when both matter. False positive rate = FP / (FP + TN): how often do we wrongly block legitimate transactions — this affects customer experience. ROC-AUC vs. PR-AUC: ROC-AUC plots True Positive Rate vs. False Positive Rate across all thresholds. On severely imbalanced data, a large pool of true negatives makes it easy to achieve a high ROC-AUC even with poor positive-class performance (the FPR denominator is large, so many false positives look small). PR-AUC plots Precision vs. Recall, focusing entirely on the positive (fraud) class. A random classifier has a PR-AUC equal to the prevalence (0.002), so any improvement above that baseline is meaningful. PR-AUC is the preferred metric for highly imbalanced problems like fraud. Strategies for class imbalance: (1) Oversampling the minority class: SMOTE (Synthetic Minority Oversampling Technique) generates synthetic fraud examples by interpolating between existing fraud samples in feature space — avoids simple duplication. (2) Undersampling the majority class: randomly remove non-fraud examples. Risk: information loss. A hybrid approach (SMOTE + undersampling) often works best. (3) Class-weight adjustment: most scikit-learn models accept a class_weight parameter — setting class_weight='balanced' scales the loss contribution of the minority class inversely proportional to its frequency. This is simpler and often sufficient. (4) Threshold-sensitive loss functions: use focal loss (originally from object detection) which down-weights easy negatives. Threshold choice for deployment: the model outputs a probability score; the threshold converts that to a binary decision. The optimal threshold depends on the business cost of a false positive (blocking a legitimate transaction, angering a customer) vs. a false negative (missing fraud, financial loss). A cost-benefit analysis: if blocking a legit transaction costs $5 in customer churn risk and missing fraud costs $200 on average, you should set the threshold to maximize expected profit. This decision involves business stakeholders (risk, product, finance), not just data scientists.",
    rubric: [
      "Exposes the accuracy paradox by calculating the trivial-majority-class baseline (99.8%)",
      "Defines precision, recall, and F1 with correct formulas and explains the precision-recall tradeoff in the fraud context",
      "Explains why PR-AUC is preferred over ROC-AUC for severely imbalanced problems",
      "Describes at least two concrete imbalance strategies: SMOTE, class weighting, undersampling, or focal loss",
      "Explains threshold selection as a business cost-benefit decision involving stakeholders, not a purely statistical choice",
    ],
  },

  {
    id: "ds-feature-engineering-leakage",
    category: "datascience",
    executes: false,
    free: false,
    level: "mid",
    title: "Feature engineering and detecting data leakage",
    company: "HR tech SaaS · Series B",
    difficulty: "medium",
    mode: "text",
    prompt:
      "You are building a model to predict whether a job applicant will be hired within 30 days of applying. Your feature set includes: days_since_application, num_interviews_completed, interviewer_rating_avg, resume_length_words, years_of_experience, and job_category. The model achieves 0.97 AUC on the test set. Your tech lead is suspicious and thinks the model is 'too good to be true.' (1) Which features are likely causing data leakage and why? (2) Explain the different types of data leakage. (3) Describe how you would redesign the feature pipeline to prevent leakage. (4) Name two high-value features you would engineer from scratch for this problem.",
    hints: [
      "Think about the timeline: what information would you actually have available at the moment of application, before any interviews have happened?",
      "Target leakage vs. temporal leakage are the two main types — map each to a specific feature in this example.",
      "A good sanity check: if AUC drops dramatically after you remove a suspected leaky feature, that feature was carrying leakage signal.",
    ],
    starter: "",
    idealAnswer:
      "The 0.97 AUC is a red flag — leakage is almost certain. Leaky features: (1) num_interviews_completed: interviews happen after application and after a hiring decision has begun. A completed offer implies multiple interviews; a rejection often means fewer. This feature encodes outcome information available only after the label is known — classic temporal/target leakage. (2) interviewer_rating_avg: interview ratings are generated during the hiring process, after the prediction point. This directly encodes the decision outcome. (3) days_since_application: if computed at prediction time as 'today minus application date,' this is fine for features about application freshness. But if it is computed relative to the hire/rejection date, it leaks future time information. Types of data leakage: Target leakage: a feature is causally downstream of the target (e.g., interviewer rating is caused by the hiring process, not a cause of it). Temporal leakage: future information is used to predict a past label — using data collected after the event to predict whether the event occurred. Preprocessing leakage: normalization or imputation computed on the full dataset before the train-test split, allowing test set statistics to influence training (e.g., scaling with mean computed on train + test). Train-test contamination: rows from the same user or entity appear in both train and test sets, inflating apparent performance. Redesigned pipeline: define the prediction point as the moment of application submission. Only include features knowable at that instant: resume_length_words, years_of_experience, job_category, applicant location, education level, time-of-day/day-of-week of application. Implement a strict temporal split: train on applications before date T, test on applications after T (not random shuffle). Use pipelines that fit transformers only on the training fold during cross-validation. Feature engineering ideas: (1) text-based resume quality score: TF-IDF or embedding of resume text against a corpus of successful applicant resumes, capturing semantic match to the job description at application time. (2) historical hiring rate by job category × experience bucket: what fraction of past applicants with similar years of experience in the same category were hired? This encodes base rate signal without leaking individual outcome. These features are entirely knowable at application time and have genuine predictive signal.",
    rubric: [
      "Identifies num_interviews_completed and interviewer_rating_avg as leaky because they are generated after the outcome is known",
      "Distinguishes at least two types of leakage: target leakage, temporal leakage, and optionally preprocessing leakage",
      "Describes a temporal train-test split (by date cutoff) as the structural fix",
      "Proposes at least two genuinely predictive, non-leaky features available at application time",
      "Mentions the 'too good AUC' heuristic as a diagnostic signal and describes how to confirm leakage by feature ablation",
    ],
  },

  // ─── SENIOR ─────────────────────────────────────────────────────────────────

  {
    id: "ds-churn-model-end-to-end",
    category: "datascience",
    executes: false,
    free: false,
    level: "senior",
    title: "Design a churn prediction model end-to-end for a subscription product",
    company: "B2B SaaS platform · Series D",
    difficulty: "hard",
    mode: "text",
    prompt:
      "Design a production churn prediction system for a B2B SaaS product with 50,000 business accounts. The Customer Success (CS) team will use model outputs to prioritize outreach to at-risk accounts. Monthly subscription revenue is $200/account on average. (1) How do you define churn — and why does this decision matter for modeling? (2) What features would you engineer and what data sources would you join? (3) Walk through the full modeling pipeline: train/test split, model selection, and evaluation. (4) How does the model output reach the CS team — describe the serving architecture. (5) Once deployed, how do you detect model drift and decide when to retrain?",
    hints: [
      "Defining churn is not trivial — 'cancellation within 30 days' versus 'cancellation within 90 days' produces different label distributions and different model behaviors. Ask what action the CS team takes and what lead time they need.",
      "B2B churn features differ from B2C: think about account-level signals (number of seats, admin logins, support tickets) rather than individual user activity.",
      "Drift comes in two forms: data drift (feature distributions shift) and concept drift (the churn signal itself changes — e.g., a recession makes price-sensitive behavior more predictive). Distinguish these.",
    ],
    starter: "",
    idealAnswer:
      "Churn definition: churn = account cancels or does not renew within the prediction window. The window choice is critical: if CS needs 60 days to run a retention campaign (email + meeting + offer), the model must predict churn 60+ days in advance. Define label: 1 if the account churned within the next 90 days, 0 otherwise. Label leakage risk: exclude any event-level data from the future 90-day label window from the feature set. Negative labels for still-active accounts are assigned at the prediction date. Class imbalance: in B2B SaaS, monthly churn is typically 1-3%, so use PR-AUC and precision/recall at the CS team's operational recall threshold (e.g., the team can contact 200 accounts/month — what precision do we get at recall = 0.6?). Features by data source: (1) Product usage (data warehouse): logins in last 30/60/90 days, feature adoption breadth, API call volume trend, number of active users / contracted seats, days since last admin login. (2) Support data (CRM/Zendesk): open ticket count, ticket severity, NPS score if available, days since last support contact. (3) Billing (Stripe/billing system): payment failures, plan downgrades, days to renewal, contract value trend. (4) Engagement (marketing): email open rates, webinar attendance, community forum activity. (5) Account metadata: company size, industry, tenure, CSM assignment, expansion revenue history. Feature engineering: rolling mean/std of login trend, percent change in usage over 30 days, 'time since last meaningful interaction' composite score. Modeling pipeline: temporal train/test split by account creation or prediction date — never random shuffle (would cause future leakage). Train on predictions made before date T, test on predictions made after T. Model selection: start with gradient boosted trees (XGBoost/LightGBM) — handles missing values, non-linear interactions, mixed feature types. Compare against logistic regression (interpretable baseline) and random forest. Hyperparameter tuning via time-series cross-validation (rolling window). Evaluation: PR-AUC primary metric; calibration (reliability diagram) is critical because CS needs calibrated probabilities to prioritize, not just rankings. Serving architecture: a weekly batch Spark job scores all 50,000 active accounts and writes risk scores + top feature contributions (SHAP values) to a Snowflake table. A Salesforce integration (Fivetran or custom API push) surfaces the churn risk score and top 3 churn drivers directly on the Account page. CS team sees a ranked queue. Daily refresh for high-risk (score > 0.7) accounts; weekly refresh for the rest. Drift detection and retraining: (1) Data drift: weekly PSI (Population Stability Index) on top-10 features vs. training distribution. PSI > 0.2 triggers a retraining candidate flag. (2) Concept drift: monthly model performance on accounts that have since churned or renewed — compare predicted vs. actual churn rate. If PR-AUC drops more than 5 points vs. baseline, trigger retraining. (3) Business change triggers: product launches, pricing changes, and macro events (e.g., economic downturn) that alter churn patterns should trigger proactive retraining outside the scheduled cycle. Retraining cadence: quarterly scheduled retraining on a 12-month rolling window, or triggered by drift metrics above.",
    rubric: [
      "Defines churn window precisely and connects it to the CS team's lead-time requirement (business alignment)",
      "Names feature sources across at least 3 data domains (usage, billing, support) with specific B2B feature examples",
      "Uses temporal train-test split and justifies why random split is invalid here",
      "Describes calibrated probability output and explains why calibration matters for prioritization by CS",
      "Distinguishes data drift from concept drift and specifies concrete retraining triggers (PSI threshold, AUC drop, or business event)",
    ],
  },

  {
    id: "ds-recommendation-system-design",
    category: "datascience",
    executes: false,
    free: false,
    level: "senior",
    title: "Design a two-stage recommendation system for a content platform",
    company: "Media streaming platform · FAANG-adjacent",
    difficulty: "hard",
    mode: "text",
    prompt:
      "Design a recommendation system for a video streaming platform with 10 million monthly active users and 2 million content items. The goal is to maximize 7-day retention via the home screen carousel. (1) What is the two-stage retrieval-ranking architecture and why is it needed at this scale? (2) What signals and features power each stage? (3) How do you handle the cold-start problem for new users and new content? (4) How would you run an offline evaluation before deploying any model change? (5) How do you set up an online experiment to measure business impact, and what are the pitfalls unique to recommendation A/B tests?",
    hints: [
      "At 2 million items, scoring every item for every user at request time is infeasible — the retrieval stage narrows the candidate set to ~100-1000 items before the ranker.",
      "Offline evaluation with precision@K or NDCG on held-out interactions is necessary but not sufficient — explain why offline metrics can diverge from online lift.",
      "Recommendation A/B tests have unique pitfalls: novelty effect in content recommendations, and interaction effects if treatment users' behavior changes the training data for the control model.",
    ],
    starter: "",
    idealAnswer:
      "Two-stage architecture: at 2 million items, scoring every item for every user request is impossible at production latency (<200ms). The two-stage approach separates the problem: (1) Retrieval (candidate generation): fast approximate nearest-neighbor search reduces 2M items to ~500 candidates per user. Methods: matrix factorization embeddings (ALS, BPR) where user and item vectors are pre-computed offline; approximate nearest-neighbor index (FAISS, ScaNN) enables sub-millisecond lookup. Also include popularity-based candidates and recently-published content to avoid filter bubbles. (2) Ranking: a more expensive model (gradient boosted trees or a shallow neural network) scores only the ~500 candidates using rich features. Features for retrieval: user embedding (learned from watch history via matrix factorization or two-tower neural network), item content embedding (from video metadata, genre, tags, or video frame embeddings). Features for ranker: user-item interaction signals (past watch time, completion rate, explicit ratings), user context (time of day, device, recent session), item freshness, predicted watch time (separate regression), diversity penalty (avoid 5 identical episodes in a row). Cold-start: new users — use demographic signals, onboarding preferences, and popularity-based recommendations. After 3-5 interactions, switch to personalized retrieval. Progressive personalization: blend popular content with learned preferences as interaction count grows. New content — content-based retrieval using item embeddings from metadata/genre/cast before any watch history accumulates. Seed the new item with a 'explore budget' in the ranker to force exposure and gather signal. Offline evaluation: temporal holdout — train on interactions before date T, evaluate on interactions after T (simulate production). Metrics: Precision@K (fraction of top-K recommendations the user actually watched), Recall@K, NDCG@K (normalized discounted cumulative gain — rewards relevant items ranked higher). Coverage and diversity metrics: what fraction of the catalog gets recommended? However, offline metrics often diverge from online lift because: (a) offline evaluation only tests against observed interactions — items not shown are neither positive nor negative in ground truth; (b) offline cannot capture novelty, serendipity, or the effect of fresh content the user has not yet seen. Therefore offline evaluation is a necessary gate (don't deploy if offline regresses) but not sufficient — online A/B test is required. Online A/B test: randomly split users into control (current model) and treatment (new model) groups at the user level. Primary metric: 7-day retention rate (user is active again within 7 days). Secondary metrics: total watch time, session depth (number of items watched per session), explicit engagement (likes/shares). Pitfalls unique to recommendation A/B tests: (1) Novelty effect: users in treatment may engage more simply because recommendations look different. Mitigate by running the test for at least 4 weeks and checking if effect stabilizes. (2) Training data contamination: if the treatment model is retrained on production data that includes treatment user interactions, the control model's training data distribution shifts over time — compare against a holdback group trained only on control data. (3) Cannibalization: a better recommendation of one show may reduce watch time of another — measure total watch time, not just individual show metrics. (4) Long-term vs. short-term tradeoff: a model optimized for immediate clicks may harm 30-day retention. Always monitor both short-term engagement and longer-horizon retention simultaneously.",
    rubric: [
      "Explains the two-stage retrieval-ranking architecture with correct motivation (latency/scale constraint) and names a concrete retrieval method (ALS, two-tower, ANN index)",
      "Describes the cold-start strategy separately for new users and new content with concrete fallbacks",
      "Uses temporal holdout for offline evaluation and names at least one ranking metric (NDCG, Precision@K) with an explanation of its limitation",
      "Identifies at least two pitfalls specific to recommendation A/B tests: novelty effect, training contamination, or cannibalization",
      "Connects the primary metric (retention) to the model objective and explains why click-through rate alone is insufficient",
    ],
  },

  {
    id: "ds-offline-online-eval-drift",
    category: "datascience",
    executes: false,
    free: false,
    level: "senior",
    title: "Offline vs. online evaluation and drift monitoring in production ML",
    company: "Ad targeting platform · public company",
    difficulty: "hard",
    mode: "text",
    prompt:
      "Your team maintains a click-through-rate (CTR) prediction model that powers ad targeting. The model was trained 6 months ago and offline AUC was 0.82. A business analyst reports that CTR has dropped 18% over the past month. (1) Distinguish offline vs. online model evaluation — why can a model have high offline AUC but degrade in production? (2) What is feature drift and concept drift? Which is more likely causing this degradation, and how do you diagnose it? (3) Walk through a concrete monitoring architecture: what you track, how you alert, and how frequently. (4) What triggers model retraining — and how do you validate a retrained model before it goes live?",
    hints: [
      "Offline AUC is computed on a fixed historical dataset; production performance is computed on a live, shifting data distribution. Enumerate the ways these can diverge.",
      "Feature drift: P(X) changes. Concept drift: P(Y|X) changes. For ad targeting, think about what would cause each — seasonal behavior, new advertiser verticals, platform feature launches.",
      "When ground-truth labels are delayed (clicks take time to be recorded), you need proxy metrics or delayed evaluation windows to monitor model performance online.",
    ],
    starter: "",
    idealAnswer:
      "Offline vs. online evaluation: offline evaluation computes metrics on a static historical dataset — AUC, log-loss, calibration. It answers: 'how well did the model perform on past data?' Online evaluation measures live production performance: actual CTR uplift, revenue per thousand impressions (RPM), A/B test lift. They can diverge for several reasons: (1) Distribution shift: the production data distribution P(X) has drifted from the training distribution — the static test set no longer reflects live traffic. (2) Concept drift: P(Y|X) has changed — user behavior in response to the same features has evolved (new advertising categories, seasonal behavioral shifts). (3) Training-serving skew: features computed differently in the offline pipeline vs. the production serving pipeline (e.g., different normalization, stale lookup tables). (4) Feedback loops: the model's predictions influence future training data — if the model bids more aggressively on certain user segments, it sees more clicks from those segments, potentially overfitting to them. (5) Label delay: clicks take time to record; if offline evaluation uses finalized labels but online evaluation uses early-window labels, there is a systematic discrepancy. Feature drift vs. concept drift diagnosis: feature drift = input distribution P(X) changes (e.g., new advertiser categories appear in the feature space, mobile traffic fraction increases). Concept drift = relationship P(Y|X) changes (e.g., users become less responsive to the same ad formats). For a 6-month-old ad model, both are plausible: feature drift from new ad formats or seasonality, concept drift from changing user preferences. Diagnosis: (1) Run PSI on top-20 features: PSI = sum((P_train - P_current) * ln(P_train / P_current)). PSI > 0.2 = significant feature drift. (2) Slice performance by feature dimensions — if AUC degrades specifically on 'new_advertiser' category = 1, that is a feature distribution mismatch. (3) Compare predicted CTR vs. actual CTR by time segment: if both move together (calibration holds) but overall CTR drops, it may be demand-side changes rather than model degradation. Monitoring architecture: data pipeline layer: (a) Feature distribution dashboard — daily PSI on top features, alerts on PSI > 0.2. (b) Prediction distribution — daily mean predicted CTR, std, histogram. Alerts on mean shift > 10%. (c) Label distribution — daily actual CTR by advertiser category, ad type, device. Alerts on absolute CTR drop > 15% week-over-week. Model performance layer (requires labeled data): (d) Daily AUC and log-loss on the previous day's finalized clicks (24-hour delay label window). (e) Calibration: predicted CTR vs. actual CTR in decile buckets — if the calibration curve tilts, the model is systematically biased. Business layer: (f) RPM, revenue, win rate — if these metrics align with CTR drop, it confirms real business impact. Alert routing: data drift alerts → ML engineering on-call. Business metric alerts → ML + product on-call. Retraining triggers: scheduled retraining: weekly retraining on a 90-day rolling window (standard for ad models with fast-changing behavioral data). Signal-based triggers: PSI > 0.25 on any top-5 feature, AUC drop > 0.03 from baseline, calibration error > 15% on any major segment, or a major product launch/advertiser category change. Validation before promotion: shadow mode — deploy retrained model as a shadow alongside production; compare prediction distributions. Offline A/B comparison on held-out data from the last 14 days (should show AUC improvement). Online A/B test (1-3% traffic holdback): compare CTR, RPM, and calibration. Rollout gated on: new model must match or exceed production AUC, show improvement in at least one business metric, and pass calibration checks.",
    rubric: [
      "Enumerates at least three specific reasons offline AUC can diverge from online performance (distribution shift, concept drift, training-serving skew, feedback loops, label delay)",
      "Distinguishes feature drift (P(X)) from concept drift (P(Y|X)) with specific ad-targeting examples for each",
      "Describes a monitoring architecture across at least two layers: feature distribution (PSI) and model performance (AUC/calibration on delayed labels)",
      "Specifies concrete retraining triggers — both scheduled and signal-based — with quantitative thresholds",
      "Describes a shadow mode or A/B validation gate before the retrained model goes live in production",
    ],
  },
];
