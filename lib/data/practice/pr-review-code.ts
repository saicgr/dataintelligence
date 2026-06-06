import type { ReviewLang } from "./types";

/**
 * Client-visible files for multi-file PR review items (category "pr"), keyed by
 * problemId. These are the artifacts under review (not secret) — attached to the
 * item's `review.files` in index.ts. The planted cross-file issues stay
 * server-only in review-scenarios.server.ts (resolved by problemId).
 *
 * Flagship is hand-authored; the rest come from scripts/gen_review.py (kind:"pr").
 */
export interface PrFile {
  name: string;
  code: string;
  language: ReviewLang;
  baseCode?: string;
}

const RECON_EXTRACT = `import pandas as pd


def load_source(conn):
    # orders placed "today" from the OLTP system (created_at is a UTC timestamp)
    return pd.read_sql(
        "SELECT order_id, amount FROM orders "
        "WHERE created_at::date = CURRENT_DATE",
        conn,
    )


def load_target(warehouse):
    # the same orders as they landed in the analytics warehouse
    return pd.read_sql(
        "SELECT order_id, amount FROM fct_orders "
        "WHERE order_date = CURRENT_DATE",
        warehouse,
    )
`;

const RECON_COMPARE = `def reconcile(source, target):
    # match orders by id and check the amounts agree
    merged = source.merge(target, on="order_id", suffixes=("_src", "_tgt"))
    merged["match"] = merged["amount_src"] == merged["amount_tgt"]
    mismatches = merged[~merged["match"]]
    # rows in the source that never made it to the target
    missing = len(source) - len(merged)
    return {"mismatches": len(mismatches), "missing": missing}
`;

const RECON_JOB = `def run(conn, warehouse):
    src = load_source(conn)
    tgt = load_target(warehouse)
    report = reconcile(src, tgt)
    # page the on-call only if something looks off
    if report["mismatches"] == 0:
        alert("daily revenue recon clean")
    return report
`;

export const PR_REVIEW_FILES: Record<string, PrFile[]> = {
  "pr-recon-daily-revenue": [
    { name: "recon/extract.py", code: RECON_EXTRACT, language: "python" },
    { name: "recon/compare.py", code: RECON_COMPARE, language: "python" },
    { name: "recon/job.py", code: RECON_JOB, language: "python" },
  ],
};
