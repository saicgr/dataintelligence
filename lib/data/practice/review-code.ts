/**
 * CLIENT-SAFE review artifacts: the code / prompt / trace UNDER REVIEW for
 * interactive review items, keyed by problem id. This is attached onto
 * codereview/aireview items as `item.review` in index.ts, so the whole review
 * track becomes interactive without editing each item inline.
 *
 * The artifact itself is shown to the candidate (not secret). The planted
 * issues, escalating follow-ups and revealable facts live SERVER-ONLY in
 * review-scenarios.server.ts (resolved by problemId).
 *
 * GENERATED (seeded by hand for the flagship item; scripts/gen_review.py
 * regenerates this from scripts/review_items.json).
 */
import type { ConvItem } from "./types";
import { GENERATED_REVIEW_CODE } from "./review-code.generated";

type ReviewCode = NonNullable<ConvItem["review"]>;

const lc = (code: string): number => code.split("\n").length;

// ── Flagship: the PySpark OOM screenshot (cr-pyspark-multi-fault-perf) ────────
const PYSPARK_OOM = `from spark.sql import SparkSession
import pyspark.sql.functions as F

# Initialize Spark Session
spark = SparkSession.builder.appName("pyspark exam").getOrCreate()

# Read in datasets
customers = spark.read.parquet("test_data/customers.parquet")
policies = spark.read.parquet("test_data/policies.parquet")

# Join datasets
joined_df = customers.join(policies)

# filter data
filtered_df = joined_df.filter(F.col("Region") == "North")

# Logging for QA purposes
filtered_df.show(1)
filtered_df.count()

# Write data
filtered_df.repartition(1).write.parquet("prod_data/full_customer_table.parquet")`;

export const REVIEW_CODE: Record<string, ReviewCode> = {
  ...GENERATED_REVIEW_CODE,
  "cr-pyspark-multi-fault-perf": { code: PYSPARK_OOM, language: "python", lineCount: lc(PYSPARK_OOM) },
};
