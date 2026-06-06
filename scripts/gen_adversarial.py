#!/usr/bin/env python3
"""
Generator + verifier for the adversarial ("looks right, but watch this") cases.

For each question we author a HIDDEN dataset (public sample + a few extra rows
engineered to break a common mistake) and the common WRONG query. The script:

  1. Pulls the PUBLIC sample setup, reference solution, and orderMatters straight
     from lib/data/practice/sql{,-interviewmaster}.ts (no transcription drift).
  2. Derives the naive/wrong query (mechanically for the AVG-NULL and
     COUNT-DISTINCT families; explicitly otherwise).
  3. Verifies the WEDGE PROPERTY in DuckDB: the naive query matches the reference
     on the sample but diverges on the hidden dataset, and the reference runs on
     the hidden dataset. Cases that fail are rejected (not emitted).
  4. Emits lib/data/practice/adversarial.server.ts with the verified cases.

Run:  python3 scripts/gen_adversarial.py
"""
import json
import re
import sys
import duckdb

# ── Pull public setup / reference / orderMatters from the TS source ──────────
SOURCES = [
    "lib/data/practice/sql.ts",
    "lib/data/practice/sql-interviewmaster.ts",
]


def load_public():
    blobs = "\n".join(open(p).read() for p in SOURCES)
    out = {}
    for m in re.finditer(r'id:\s*"([^"]+)"', blobs):
        pid = m.group(1)
        block = blobs[m.start(): m.start() + 3000]
        setup = re.search(r"setupSql:\s*`(.*?)`", block, re.S)
        ref = re.search(r"referenceSolution:\s*`(.*?)`", block, re.S)
        order = re.search(r"orderMatters:\s*(true|false)", block)
        if setup and ref and order:
            out[pid] = {
                "setupSql": setup.group(1),
                "referenceSolution": ref.group(1),
                "orderMatters": order.group(1) == "true",
            }
    return out


PUBLIC = load_public()

CASES = []


def avg_null(id, col, extra, name, explanation):
    """A naive SUM(col)/COUNT(*) counts NULL rows as zero; AVG(col) ignores them."""
    CASES.append({"id": id, "type": "avg_null", "col": col, "extra": extra, "name": name, "explanation": explanation})


def distinct(id, expr, replacement, extra, name, explanation):
    """A naive COUNT(x) counts rows; COUNT(DISTINCT x) counts entities."""
    CASES.append({"id": id, "type": "distinct", "expr": expr, "replacement": replacement, "extra": extra, "name": name, "explanation": explanation})


def explicit(id, naive, extra, name, explanation, hidden=None):
    CASES.append({"id": id, "type": "explicit", "naive": naive, "extra": extra, "name": name, "explanation": explanation, "hidden": hidden})


ROB_EXPL = ("We re-ran your query on a larger hidden dataset — more groups, more rows, and a "
            "wider range of values than the sample. Your result didn't match the expected output "
            "on this tougher set, which usually means the logic overfits the small sample. Re-check "
            "that it generalizes: extra groups, larger volumes, and boundary values.")


def robustness(id, extra, explanation=ROB_EXPL):
    """No single 'common mistake' survives this question's sample, so instead of a
    named trap we validate the answer on a larger hidden dataset (set comparison,
    so a correct answer always matches and only genuine errors are caught)."""
    CASES.append({"id": id, "type": "robustness", "extra": extra, "name": "Scale & edge cases", "explanation": explanation, "hidden": None})


def bool_rate(id, col, extra, explanation):
    """A rate AVG(CASE WHEN col …) divides by COUNT(*); a naive FILTER/COUNT(col)
    drops rows where the outcome is unknown (NULL), inflating the rate."""
    CASES.append({"id": id, "type": "bool_rate", "col": col, "extra": extra,
                  "name": "Unknown outcomes in the denominator", "explanation": explanation})


# ───────────────────────────── EASY ─────────────────────────────
explicit(
    "never-ordered",
    naive="SELECT id, name\nFROM customers\nWHERE id NOT IN (SELECT customer_id FROM orders)\nORDER BY id;",
    extra="INSERT INTO orders VALUES (14, NULL, 99);",
    name="NULL foreign key",
    explanation="The orders table has a row with a NULL customer_id. `NOT IN (… NULL …)` evaluates to UNKNOWN for every customer, so the filter keeps no rows. Use NOT EXISTS or a LEFT JOIN … WHERE o.id IS NULL — both are null-safe.",
)
explicit(
    "airbnb-top-rated-listings",
    naive="SELECT id, name, avg_rating\nFROM listings\nWHERE avg_rating >= 4.8 AND reviews_count > 50\nORDER BY avg_rating DESC, id ASC;",
    extra="INSERT INTO listings VALUES (7, 'Budget Inn', 4.90, 50);",
    name="Off-by-one on the threshold",
    explanation="The bar is 'at least 50 reviews', so a listing with exactly 50 qualifies. `reviews_count > 50` is exclusive and drops it. Use >= for an inclusive threshold.",
)
avg_null("meta-marketplace-price-by-city", "AVG(price)", "INSERT INTO marketplace_items VALUES (7, 'Austin', 'Furniture', NULL);",
         "NULL in the average", "An item listed with no price (NULL) isn't a $0 item. AVG divides by the number of priced items; SUM(price)/COUNT(*) divides by every row and counts the unpriced one as zero. Use AVG.")
avg_null("netflix-employee-satisfaction", "AVG(satisfaction_score)", "INSERT INTO employees VALUES (7, 'Engineering', 'IC', NULL);",
         "NULL in the average", "One employee hasn't been surveyed yet (NULL score). AVG divides by the count of non-null scores; SUM(score)/COUNT(*) divides by every row, counting the unsurveyed person as a zero and dragging the average down. Use AVG.")
avg_null("google-search-quality", "AVG(time_on_page_sec)", "INSERT INTO search_sessions VALUES (7, 7, TRUE, NULL, TRUE);",
         "NULL in the average", "A session with no recorded dwell time (NULL) isn't a 0-second session. AVG skips it; SUM(time)/COUNT(*) counts it as zero and deflates the average.")
distinct("google-gmail-labels", "COUNT(DISTINCT user_id)", "COUNT(user_id)", "INSERT INTO labels VALUES (7, 1, 'Work', 30);",
         "Counting rows, not people", "A user can hold the same label across rows. COUNT(user_id) counts rows; the metric is how many people use the label, so use COUNT(DISTINCT user_id).")
avg_null("amazon-brand-perception", "AVG(brand_perception_score)", "INSERT INTO segments VALUES (7, 'Retail', NULL);",
         "NULL in the average", "A segment with no recorded perception score (NULL) shouldn't count as a zero. AVG ignores it; SUM/COUNT(*) doesn't. Use AVG.")
avg_null("google-cloud-early-adopters", "AVG(monthly_spend)", "INSERT INTO customers VALUES (7, TRUE, NULL, 20);",
         "NULL in the average", "A customer with no recorded spend (NULL) isn't a $0 customer. AVG divides by customers with a known spend; SUM/COUNT(*) divides by all rows. Use AVG.")
avg_null("airbnb-host-response-time", "AVG(response_minutes)", "INSERT INTO messages VALUES (8, 4, NULL);",
         "NULL in the average", "A message a host never answered has no response time (NULL). AVG ignores it; SUM/COUNT(*) treats it as an instant (0-minute) reply and understates the average.")
avg_null("openai-gpt4-context-depth", "AVG(context_tokens_retained)", "INSERT INTO responses VALUES (7, 'Legal', NULL);",
         "NULL in the average", "A response with no recorded retention (NULL) shouldn't count as zero tokens. AVG skips it; SUM/COUNT(*) divides by every row. Use AVG.")
avg_null("ubereats-partner-delay", "AVG(actual_min - expected_min)", "INSERT INTO deliveries VALUES (7, 3, 20, NULL);",
         "NULL in the average", "An in-progress delivery has no actual time yet (NULL), so its delay is unknown. AVG ignores it; SUM(...)/COUNT(*) treats the gap as zero delay and skews the partner's average.")
explicit(
    "ea-game-library-health",
    naive="SELECT user_id,\n       COUNT(*) FILTER (WHERE installed) AS installed_games,\n       COUNT(*) FILTER (WHERE hours_played > 0) AS active_games\nFROM library\nGROUP BY user_id\nORDER BY user_id;",
    extra="INSERT INTO library VALUES (7, 1, 15, FALSE, 5.0);",
    name="Dropping a predicate",
    explanation="A game can have play time but be uninstalled (a stale row). Counting active games by hours_played > 0 alone includes those; 'actively play' means installed AND played. Keep both predicates in the filter.",
)

# ───────────────────────────── MEDIUM ─────────────────────────────
distinct("apple-recommended-track-adds", "COUNT(DISTINCT user_id) FILTER (WHERE source = 'recommended')", "COUNT(user_id) FILTER (WHERE source = 'recommended')",
         "INSERT INTO playlist_actions VALUES (7, 1, 106, 'recommended');",
         "Counting rows, not people", "Adopters means distinct users who added a recommended track. COUNT(user_id) counts add-events, so a user who adds several recommendations is counted multiple times. Use COUNT(DISTINCT user_id).")
avg_null("amazon-playlist-size-vs-listen", "AVG(listen_minutes)", "INSERT INTO playlists VALUES (7, 7, 30, NULL);",
         "NULL in the average", "A playlist with no recorded listen time (NULL) isn't a 0-minute playlist. AVG ignores it; SUM/COUNT(*) divides by every playlist. Use AVG.")
distinct("apple-artist-rec-actions", "COUNT(DISTINCT user_id)", "COUNT(user_id)", "INSERT INTO rec_interactions VALUES (8, 1, 15, 'view');",
         "Counting rows, not people", "A user can perform the same action many times. COUNT(user_id) counts events; the metric is distinct users, so use COUNT(DISTINCT user_id).")
avg_null("netflix-recommendation-watchtime", "AVG(watch_minutes)", "INSERT INTO sessions VALUES (7, 7, TRUE, NULL);",
         "NULL in the average", "A session with no recorded watch time (NULL) isn't a 0-minute session. AVG skips it; SUM/COUNT(*) divides by every session and deflates the average.")
avg_null("microsoft-teams-coediting", "AVG(co_editors)", "INSERT INTO files VALUES (7, 'Sales', 'draft.docx', NULL);",
         "NULL in the average", "A file with an unknown co-editor count (NULL) shouldn't count as zero collaborators. AVG ignores it; SUM/COUNT(*) divides by every file. Use AVG.")
avg_null("airbnb-work-travel-expense", "AVG(booking_cost)", "INSERT INTO bookings VALUES (7, 'Acme', NULL, 10);",
         "NULL in the average", "A booking with no recorded cost (NULL) isn't a $0 booking. AVG divides by bookings with a known cost; SUM/COUNT(*) divides by all rows. Use AVG.")
avg_null("airbnb-amenity-pricing", "AVG(price)", "INSERT INTO listings VALUES (7, TRUE, TRUE, NULL, 80.0);",
         "NULL in the average", "A listing with no nightly price set (NULL) isn't a $0 listing. AVG ignores it; SUM/COUNT(*) divides by every listing. Use AVG.")
explicit(
    "stripe-connect-payout-success",
    naive="SELECT seller_segment,\n       COUNT(*) AS total,\n       ROUND(COUNT(*) FILTER (WHERE status = 'success') * 1.0 / COUNT(*) FILTER (WHERE status IN ('success','failed')), 2) AS success_rate\nFROM payouts\nGROUP BY seller_segment\nORDER BY success_rate ASC;",
    extra="INSERT INTO payouts VALUES (9, 'SMB', 'pending'), (10, 'New', 'pending');",
    name="Unseen column values",
    explanation="Payouts can also be 'pending'. Dividing only by success+failed silently drops them and overstates the success rate. The denominator is COUNT(*) — don't assume status is binary.",
)
avg_null("stripe-tier-retention", "AVG(months_active)", "INSERT INTO subscriptions VALUES (9, 'Basic', NULL, TRUE);",
         "NULL in the average", "A subscription whose tenure isn't recorded yet (NULL) shouldn't count as zero months. AVG ignores it; SUM/COUNT(*) divides by every subscription. Use AVG.")
avg_null("x-sports-engagement", "AVG(engagement)", "INSERT INTO interactions VALUES (7, 'commentary', 5, NULL);",
         "NULL in the average", "An interaction with no engagement score recorded (NULL) isn't a zero. AVG skips it; SUM/COUNT(*) divides by every interaction. Use AVG.")
avg_null("openai-codex-language-quality", "AVG(errors_introduced)", "INSERT INTO suggestions VALUES (8, 'Python', TRUE, NULL);",
         "NULL in the average", "A suggestion whose error count wasn't measured (NULL) shouldn't count as zero errors. AVG ignores it; SUM/COUNT(*) divides by every suggestion. Use AVG.")
avg_null("ubereats-route-clustering", "AVG(orders_in_route)", "INSERT INTO pickups VALUES (8, 1, 17, NULL);",
         "NULL in the average", "A route with an unrecorded order count (NULL) shouldn't count as zero orders. AVG ignores it; SUM/COUNT(*) divides by every route. Use AVG.")
avg_null("paypal-venmo-social-bands", "AVG(transactions)", "INSERT INTO users VALUES (7, 3, NULL);",
         "NULL in the average", "A user with no transaction count recorded (NULL) isn't a zero-transaction user. AVG ignores it; SUM/COUNT(*) divides by every user in the band. Use AVG.")
avg_null("ea-starwars-narrative", "AVG(time_spent_sec)", "INSERT INTO choices VALUES (8, 'Dialogue', 2, NULL);",
         "NULL in the average", "An interaction with no recorded time (NULL) isn't zero seconds. AVG skips it; SUM/COUNT(*) divides by every interaction and deflates the average.")
explicit(
    "google-pay-failure-rate",
    naive="SELECT merchant_category,\n       COUNT(*) FILTER (WHERE status IN ('success','failed')) AS total,\n       COUNT(*) FILTER (WHERE status = 'failed') AS failures,\n       ROUND(COUNT(*) FILTER (WHERE status = 'failed') * 1.0 / COUNT(*) FILTER (WHERE status IN ('success','failed')), 2) AS failure_rate\nFROM transactions\nGROUP BY merchant_category\nORDER BY failure_rate DESC;",
    extra="INSERT INTO transactions VALUES (9, 'Travel', 'pending'), (10, 'Gaming', 'pending');",
    name="Unseen column values",
    explanation="Production data also contains 'pending' transactions. Building the denominator from only success+failed silently drops them and inflates the failure rate. 'Total transactions' means COUNT(*) — never assume a column holds only the values in your sample.",
)
distinct("linkedin-top-endorsed-skills", "COUNT(DISTINCT user_id)", "COUNT(user_id)", "INSERT INTO endorsements VALUES (9, 1, 'SQL', 5);",
         "Counting rows, not people", "A user can endorse the same skill more than once. COUNT(user_id) counts endorsement rows, so a repeat endorser inflates the unique-user count. Use COUNT(DISTINCT user_id).")

# ───────────────────────────── HARD ─────────────────────────────
distinct("google-ads-roi-by-segment", "COUNT(DISTINCT ad_format)", "COUNT(ad_format)", "INSERT INTO campaigns VALUES (6, 'Retail', 'search', 30000, 500.0, 1500.0);",
         "Counting rows, not distinct formats", "A segment can run the same ad format across several campaigns. COUNT(ad_format) counts campaigns; format diversity needs COUNT(DISTINCT ad_format).")
avg_null("netflix-telecom-partner-retention", "AVG(watch_minutes)", "INSERT INTO bundles VALUES (7, 'Verizon', 7, TRUE, TRUE, NULL);",
         "NULL in the average", "A subscriber whose watch time isn't recorded yet (NULL) shouldn't count as zero minutes. AVG ignores it; SUM/COUNT(*) divides by every subscriber. Use AVG.")
avg_null("meta-whatsapp-chat-types", "AVG(call_duration_sec)", "INSERT INTO events VALUES (6, 6, 'group', FALSE, NULL, 4);",
         "NULL in the average", "A chat event with no call (NULL duration) isn't a 0-second call. AVG skips it; SUM/COUNT(*) divides by every event and understates the average call length.")
avg_null("walmart-eyewear-style-rank", "AVG(satisfaction)", "INSERT INTO products VALUES (6, 'Aviator', 130.0, 100, NULL);",
         "NULL in the average", "A product with no satisfaction score yet (NULL) shouldn't count as zero. AVG ignores it; SUM/COUNT(*) divides by every product in the style. Use AVG.")
avg_null("walmart-shipping-on-time", "AVG(actual_days - promised_days)", "INSERT INTO shipments VALUES (9, 'Grocery', 1, NULL);",
         "NULL in the average", "A shipment still in transit has no actual delivery time (NULL), so its delay is unknown. AVG ignores it; SUM(...)/COUNT(*) treats the gap as zero delay and skews the average.")
avg_null("linkedin-feed-content-consistency", "AVG(engagement_score)", "INSERT INTO posts VALUES (9, 'Article', NULL, 4);",
         "NULL in the average", "A post with no engagement score recorded (NULL) isn't a zero. AVG skips it; SUM/COUNT(*) divides by every post and deflates the average.")
avg_null("openai-chatgpt-complexity-balance", "AVG(satisfaction)", "INSERT INTO queries VALUES (7, 'simple', NULL, 320);",
         "NULL in the average", "A query with no satisfaction rating (NULL) shouldn't count as zero. AVG divides by rated queries; SUM/COUNT(*) divides by all of them — which also distorts the satisfaction-to-latency ranking. Use AVG.")
avg_null("paypal-dispute-resolution", "AVG(resolution_days)", "INSERT INTO disputes VALUES (9, 'Goods', NULL, FALSE);",
         "NULL in the average", "An open, unresolved dispute has no resolution time yet (NULL). AVG ignores it; SUM(days)/COUNT(*) treats it as a same-day resolution and understates how long disputes really take. Use AVG (and note the median is also null-safe).")


# ───────────── Batch 2: ship-all coverage (ties / boundaries / NULL-counts / rates) ─────────────
# Ties slip past a top-N: RANK() <= N returns every tied row; LIMIT N + tiebreaker keeps exactly N.
TIES_EXPL = "On the sample there's no tie at the boundary, so RANK() <= N and LIMIT N agree. Add a row tied with the Nth and RANK() returns it too — one row too many. Decide whether ties are included; if not, ORDER BY … with a tiebreaker + LIMIT (or ROW_NUMBER) gives a deterministic top-N."
explicit("top-customers",
         "WITH t AS (\n  SELECT customer_id, SUM(amount) AS total_spend FROM orders GROUP BY customer_id\n)\nSELECT customer_id, total_spend\nFROM (SELECT customer_id, total_spend, RANK() OVER (ORDER BY total_spend DESC) AS rk FROM t)\nWHERE rk <= 3\nORDER BY total_spend DESC, customer_id ASC;",
         "INSERT INTO orders VALUES (9, 105, 110, DATE '2026-01-25');", "Ties slip past your top-N", TIES_EXPL)
explicit("meta-instagram-top-sharers",
         "WITH t AS (\n  SELECT user_id, SUM(shares) AS total_shares FROM posts GROUP BY user_id\n)\nSELECT user_id, total_shares\nFROM (SELECT user_id, total_shares, RANK() OVER (ORDER BY total_shares DESC) AS rk FROM t)\nWHERE rk <= 5\nORDER BY total_shares DESC, user_id ASC;",
         "INSERT INTO posts VALUES (9, 7, 10, 50);", "Ties slip past your top-N", TIES_EXPL)
explicit("walmart-photo-gifts",
         "SELECT product_name, orders_count\nFROM (SELECT product_name, orders_count, RANK() OVER (ORDER BY orders_count DESC) AS rk FROM products)\nWHERE rk <= 5\nORDER BY orders_count DESC, product_name ASC;",
         "INSERT INTO products VALUES (7, 'Sticker Pack', 600, 4.1);", "Ties slip past your top-N", TIES_EXPL)

# COUNT(column) silently skips NULLs; COUNT(*) counts the row.
explicit("netflix-interactive-content",
         "SELECT interaction_type, COUNT(DISTINCT viewer_id) AS unique_viewers, COUNT(viewer_id) AS total_interactions\nFROM interactions GROUP BY interaction_type ORDER BY total_interactions DESC;",
         "INSERT INTO interactions VALUES (8, NULL, 2, 'choice');", "COUNT(column) skips NULLs",
         "An anonymous interaction has a NULL viewer_id. COUNT(viewer_id) skips it; total interactions should count every row, so use COUNT(*).")
explicit("google-photos-categorization",
         "SELECT COUNT(user_id) FILTER (WHERE categorized) AS categorized_photos,\n       COUNT(DISTINCT user_id) FILTER (WHERE categorized) AS unique_users\nFROM photo_events;",
         "INSERT INTO photo_events VALUES (7, NULL, 16, TRUE);", "COUNT(column) skips NULLs",
         "A photo auto-categorized with no user attached has a NULL user_id. COUNT(user_id) skips it, undercounting categorized photos — count rows with COUNT(*).")
explicit("apple-music-new-artists",
         "SELECT genre, COUNT(DISTINCT artist_id) AS artists, COUNT(artist_id) FILTER (WHERE was_played) AS plays\nFROM recommendations GROUP BY genre ORDER BY genre;",
         "INSERT INTO recommendations VALUES (7, 'Indie', NULL, TRUE);", "COUNT(column) skips NULLs",
         "A played recommendation whose artist wasn't resolved has a NULL artist_id. COUNT(artist_id) drops it; count plays with COUNT(*) FILTER (WHERE was_played).")
explicit("openai-chatgpt-domain-share",
         "SELECT COUNT(domain) AS total_queries,\n       COUNT(*) FILTER (WHERE domain IN ('technology','science')) AS tech_sci_queries,\n       ROUND(100.0 * COUNT(*) FILTER (WHERE domain IN ('technology','science')) / COUNT(domain), 1) AS tech_sci_pct\nFROM queries;",
         "INSERT INTO queries VALUES (7, 6, NULL, '2026-03');", "COUNT(column) skips NULLs",
         "An uncategorized query has a NULL domain. COUNT(domain) skips it, so the total (and the percentage) are computed over the wrong base. Total queries is COUNT(*).")

# Proxy column ≠ the real condition.
explicit("google-ads-zero-revenue",
         "SELECT name, ad_type, spend FROM campaigns WHERE conversions = 0 ORDER BY spend DESC;",
         "INSERT INTO campaigns VALUES (6, 'Promo Blitz', 'search', 5, 0.0, 400.0);", "Proxy column ≠ the real condition",
         "Using conversions = 0 as a stand-in for 'no revenue' breaks when a campaign converts but still earns nothing (refunds, non-monetizing conversions). Filter on the actual metric, revenue = 0.")

# Distinct recipients counts conversations, not messages.
explicit("linkedin-messaging-volume",
         "SELECT sender_id, COUNT(DISTINCT recipient_id) AS messages\nFROM messages GROUP BY sender_id ORDER BY messages DESC, sender_id ASC;",
         "INSERT INTO messages VALUES (7, 1, 5, DATE '2026-05-05');", "Distinct recipients ≠ message count",
         "COUNT(DISTINCT recipient_id) counts the people a sender messaged (conversations), not messages — someone who messages the same person repeatedly is undercounted. Use COUNT(*).")

# SUM(a)+SUM(b) ≠ SUM(a+b) when NULLs exist.
explicit("meta-ar-filter-engagement",
         "SELECT filter_name, SUM(interactions) AS interactions, SUM(shares) AS shares, SUM(interactions + shares) AS total_engagement\nFROM ar_filters GROUP BY filter_name ORDER BY total_engagement DESC, filter_name;",
         "INSERT INTO ar_filters VALUES (6, 'Neon', 500, NULL);", "SUM(a + b) drops rows with a NULL part",
         "When one column is NULL, interactions + shares is NULL and SUM skips the whole row — losing the non-null part too. SUM(interactions) + SUM(shares) adds the columns independently and keeps it.")

# Unknown outcomes shrink the denominator (FILTER rate over COUNT(col), not COUNT(*)).
explicit("google-play-download-conversion",
         "SELECT category, COUNT(*) AS views, COUNT(*) FILTER (WHERE downloaded) AS downloads,\n       ROUND(COUNT(*) FILTER (WHERE downloaded) * 1.0 / COUNT(downloaded), 2) AS conv_rate\nFROM app_views GROUP BY category ORDER BY conv_rate DESC;",
         "INSERT INTO app_views VALUES (9, 5, 'Games', NULL);", "Unknown outcomes shrink the denominator",
         "A view whose download outcome is unknown (NULL) is still a view. Dividing by COUNT(downloaded) drops it and inflates the conversion rate. The denominator is COUNT(*).")
explicit("amazon-fresh-reorders",
         "SELECT category, COUNT(*) FILTER (WHERE is_reorder) AS reorders,\n       ROUND(COUNT(*) FILTER (WHERE is_reorder) * 1.0 / COUNT(is_reorder), 2) AS reorder_rate\nFROM orders GROUP BY category ORDER BY reorders DESC;",
         "INSERT INTO orders VALUES (9, 4, 'Produce', NULL);", "Unknown outcomes shrink the denominator",
         "An order whose reorder flag is unknown (NULL) is still an order. Dividing by COUNT(is_reorder) drops it and inflates the reorder rate. The denominator is COUNT(*).")

# Off-by-one on an inclusive bucket boundary.
explicit("meta-photo-sharing-age-group",
         "SELECT CASE WHEN age < 18 THEN '<18' WHEN age < 50 THEN '18-50' ELSE '>50' END AS age_group,\n       COUNT(DISTINCT id) AS users, SUM(photos_shared) AS photos\nFROM users GROUP BY age_group ORDER BY MIN(age);",
         "INSERT INTO users VALUES (7, 50, 'US', 30);", "Off-by-one bucket boundary",
         "The 18-50 band is inclusive of 50. `age < 50` pushes a 50-year-old into '>50'. Use <= for inclusive upper bounds.")
explicit("walmart-price-band-sales",
         "SELECT CASE WHEN price < 5 THEN 'budget (<$5)' WHEN price < 15 THEN 'mid ($5-$15)' ELSE 'premium (>$15)' END AS price_band,\n       COUNT(*) AS products, SUM(units_sold) AS total_units\nFROM products GROUP BY price_band ORDER BY MIN(price);",
         "INSERT INTO products VALUES (7, 'Mop', 15.0, 1000);", "Off-by-one bucket boundary",
         "The mid band is '$5-$15' inclusive. `price < 15` pushes a $15 item into premium. Use <= for an inclusive upper bound.")

# Average of ratios ≠ ratio of totals.
explicit("google-play-revenue-per-download",
         "WITH agg AS (\n  SELECT category, monetization_model, SUM(revenue) AS total_revenue,\n         ROUND(AVG(revenue * 1.0 / downloads), 2) AS rev_per_download\n  FROM apps GROUP BY category, monetization_model\n)\nSELECT category, monetization_model, total_revenue, rev_per_download,\n       RANK() OVER (PARTITION BY category ORDER BY total_revenue DESC) AS rank\nFROM agg ORDER BY category, rank;",
         "INSERT INTO apps VALUES (6, 'Games', 'in-app', 10000.0, 50000);", "Average of ratios ≠ ratio of totals",
         "Revenue per download must divide total revenue by total downloads. AVG(revenue / downloads) averages per-app rates, over-weighting low-volume apps. Use SUM(revenue) / SUM(downloads).")

# AVG-of-metric with a NULL value (one more).
avg_null("walmart-pharmacy-privacy", "AVG(comfort_score)", "INSERT INTO consultations VALUES (7, 'Private Room', 'high', NULL);",
         "NULL in the average", "A consultation with no comfort score recorded (NULL) shouldn't count as zero. AVG ignores it; SUM/COUNT(*) divides by every consultation. Use AVG.")

# Boolean rates: an unknown/pending outcome (NULL) still belongs in the denominator.
bool_rate("microsoft-windows-update", "error_free", "INSERT INTO updates VALUES (6, 6, 800, NULL);",
          "An update whose outcome isn't recorded yet (NULL error_free) still happened. AVG(CASE …) divides by COUNT(*); COUNT(error_free) drops the unknown and overstates the error-free rate.")
bool_rate("stripe-churn-by-tier", "churned", "INSERT INTO subscriptions VALUES (9, 'Starter', NULL);",
          "A subscription whose churn status is undecided (NULL) is still a subscription. Dividing by COUNT(churned) drops it and distorts the churn rate. The denominator is COUNT(*).")
bool_rate("uber-ride-acceptance-by-zone", "accepted", "INSERT INTO ride_requests VALUES (10, 'Suburb', NULL);",
          "A request that expired without a decision (NULL accepted) is still a request. Dividing by COUNT(accepted) drops it and inflates the acceptance rate. The denominator is COUNT(*).")
bool_rate("paypal-onetouch-conversion", "completed", "INSERT INTO checkouts VALUES (10, 'Guest', NULL);",
          "A checkout still in progress (NULL completed) is still an attempt. Dividing by COUNT(completed) drops it and overstates the conversion rate. The denominator is COUNT(*).")
bool_rate("stripe-capital-revenue-variability", "repaid", "INSERT INTO loans VALUES (11, 'high', NULL);",
          "A loan still outstanding (NULL repaid) is still a loan. Dividing by COUNT(repaid) drops it and overstates the repayment rate. The denominator is COUNT(*).")
bool_rate("amazon-prime-early-access-funnel", "clicked", "INSERT INTO engagements VALUES (7, 7, 14, NULL, FALSE, FALSE);",
          "A promo impression whose click wasn't logged (NULL clicked) is still an impression. The click rate is over all impressions — COUNT(*) — so dividing by COUNT(clicked) overstates it.")
bool_rate("airbnb-transparency-cancellation", "completed", "INSERT INTO bookings VALUES (7, TRUE, 'flexible', NULL, DATE '2026-04-04');",
          "A booking still pending (NULL completed) is still a booking. Dividing by COUNT(completed) drops it and inflates the completion rate. The denominator is COUNT(*).")
bool_rate("airbnb-response-band-booking", "booked", "INSERT INTO bookings VALUES (9, 1, 15, NULL);",
          "An inquiry with no decision yet (NULL booked) is still an inquiry. Dividing by COUNT(booked) drops it and inflates the booking rate. The denominator is COUNT(*).")


# ───────────── Batch 3: window/ordering real traps + robustness to reach all 83 ─────────────

# Row window vs time window: ROWS counts 7 rows; a calendar RANGE counts 7 days.
# Identical on a gap-free series; diverges once a date is missing.
explicit("rolling-7d-revenue",
         "SELECT day,\n       ROUND(AVG(revenue) OVER (ORDER BY day RANGE BETWEEN INTERVAL 6 DAY PRECEDING AND CURRENT ROW), 2) AS rolling_avg\nFROM daily_revenue\nORDER BY day;",
         None, "Row window vs time window",
         "The prompt is 'today + the 6 prior rows', i.e. a ROWS frame. A RANGE … INTERVAL 6 DAY frame is a calendar window — identical while days are consecutive, but once a day is missing the two diverge. Use ROWS BETWEEN 6 PRECEDING AND CURRENT ROW.",
         hidden="""CREATE TABLE daily_revenue (day DATE, revenue INTEGER);
INSERT INTO daily_revenue VALUES
 (DATE '2026-03-01',100),(DATE '2026-03-02',120),(DATE '2026-03-03',90),
 (DATE '2026-03-05',200),(DATE '2026-03-06',170),(DATE '2026-03-07',130),
 (DATE '2026-03-08',160),(DATE '2026-03-12',300);""")

# A window function with no ORDER BY uses arbitrary scan order — fine while rows
# happen to be stored in order, wrong the moment they aren't.
explicit("mom-growth",
         "WITH m AS (\n  SELECT month, revenue, LAG(revenue) OVER () AS prev\n  FROM monthly_revenue\n)\nSELECT month, revenue, ROUND((revenue - prev) * 100.0 / prev, 1) AS growth_pct\nFROM m\nORDER BY month;",
         None, "Window frame needs ORDER BY",
         "LAG without an ORDER BY pulls 'the previous row' in arbitrary storage order, not the previous month. It only looked right because the sample was stored in month order. Add ORDER BY month to the window.",
         hidden="""CREATE TABLE monthly_revenue (month VARCHAR, revenue DOUBLE);
INSERT INTO monthly_revenue VALUES ('2026-03',1500),('2026-01',1000),('2026-04',1800),('2026-02',1200);""")

explicit("stripe-capital-mom-growth",
         "WITH growth AS (\n  SELECT business_id,\n         (revenue - LAG(revenue) OVER (PARTITION BY business_id))\n           / LAG(revenue) OVER (PARTITION BY business_id) AS mom_growth\n  FROM monthly_revenue\n)\nSELECT business_id, ROUND(AVG(mom_growth), 3) AS avg_mom_growth\nFROM growth WHERE mom_growth IS NOT NULL\nGROUP BY business_id ORDER BY avg_mom_growth DESC;",
         None, "Window frame needs ORDER BY",
         "PARTITION BY business_id without ORDER BY month makes LAG read months in arbitrary order, so 'previous month' is wrong whenever a business's rows aren't stored chronologically. Add ORDER BY month inside the window.",
         hidden="""CREATE TABLE monthly_revenue (id INTEGER, business_id INTEGER, month VARCHAR, revenue DOUBLE);
INSERT INTO monthly_revenue VALUES
 (2,1,'2026-02',1200.0),(1,1,'2026-01',1000.0),(3,1,'2026-03',1500.0),
 (4,2,'2026-01',2000.0),(5,2,'2026-02',1800.0),(6,2,'2026-03',1980.0),
 (7,3,'2026-01',500.0),(8,3,'2026-02',1000.0);""")

explicit("x-influencer-revenue-trend",
         "WITH rpe AS (\n  SELECT content_type, week, revenue * 1.0 / engagement AS rev_per_eng FROM content\n)\nSELECT content_type, week,\n       ROUND(rev_per_eng, 3) AS rev_per_eng,\n       ROUND(rev_per_eng - LAG(rev_per_eng) OVER (PARTITION BY content_type), 3) AS wow_change\nFROM rpe ORDER BY content_type, week;",
         None, "Window frame needs ORDER BY",
         "LAG OVER (PARTITION BY content_type) with no ORDER BY week compares against an arbitrary prior row, not the previous week. Add ORDER BY week so week-over-week change is actually week-over-week.",
         hidden="""CREATE TABLE content (id INTEGER, content_type VARCHAR, week INTEGER, revenue DOUBLE, engagement INTEGER);
INSERT INTO content VALUES
 (2,'Sponsored',2,1500.0,6000),(1,'Sponsored',1,1000.0,5000),(3,'Sponsored',3,1200.0,6000),
 (4,'Organic',1,200.0,4000),(5,'Organic',2,300.0,5000);""")

# Average of group averages ≠ row-level grand mean once groups are unequal.
explicit("apple-camera-vs-overall",
         "SELECT user_segment,\n       ROUND(AVG(photo_quality), 2) AS avg_photo,\n       ROUND(AVG(photo_quality) - (SELECT AVG(photo_quality) FROM captures), 2) AS vs_overall\nFROM captures GROUP BY user_segment ORDER BY vs_overall DESC;",
         None, "Average of averages ≠ grand mean",
         "The reference compares each segment to the mean of the per-segment averages (equal weight per segment). The row-level grand average (SELECT AVG(photo_quality) FROM captures) weights big segments more — identical only when all segments are the same size. Use AVG(AVG(photo_quality)) OVER ().",
         hidden="""CREATE TABLE captures (id INTEGER, user_segment VARCHAR, photo_quality INTEGER, video_quality INTEGER);
INSERT INTO captures VALUES
 (1,'Pro',95,90),(2,'Pro',92,88),(3,'Casual',70,65),(4,'Casual',75,70),
 (5,'New',60,55),(6,'New',65,60),(7,'Pro',95,90),(8,'Pro',93,89);""")

# Robustness: questions whose own sample already defeats the common mistake (ties,
# multi-row ratios, partitioned windows) — validated on a larger hidden dataset.
robustness("second-highest-salary", "INSERT INTO employees VALUES (9,'Ivy','Sales',300000),(10,'Jon','Sales',250000),(11,'Kim','Sales',200000);")
robustness("login-streak", "INSERT INTO logins VALUES (4, DATE '2026-03-01'),(4, DATE '2026-03-02'),(4, DATE '2026-03-03'),(4, DATE '2026-03-05'),(4, DATE '2026-03-06'),(4, DATE '2026-03-07'),(4, DATE '2026-03-08');")
robustness("amazon-prime-video-genres", "INSERT INTO content VALUES (6,'Thriller',7000,500000),(7,'Thriller',1200,90000),(8,'Horror',400,30000);")
robustness("meta-ad-segment-efficiency", "INSERT INTO ad_segments VALUES (6,'Retargeting',45,28,900),(7,'Retargeting',30,15,600);")
robustness("apple-top-supplier-per-region", "INSERT INTO suppliers VALUES (6,'Tunis Mfg','Africa',420,400),(7,'Cairo Components','Africa',310,300);")
robustness("netflix-emerging-market-cac", "INSERT INTO marketing VALUES (6,'Indonesia',22000,16000),(7,'Vietnam',18000,9000);")
robustness("meta-events-category-share", "INSERT INTO event_clicks VALUES (7,'Gaming',350),(8,'Education',180);")
robustness("amazon-device-prime-video-share", "INSERT INTO device_usage VALUES (7,'Tablet','Prime Video',180),(8,'Tablet','Browser',60),(9,'Echo','Prime Video',45);")
robustness("apple-mac-creative-tools", "INSERT INTO usage VALUES (7,6,'Compressor',90),(8,7,'Compressor',45),(9,8,'Final Cut',150);")
robustness("walmart-checkout-peak-hour", "INSERT INTO checkouts VALUES (9,3,8,4),(10,3,8,6),(11,3,19,25),(12,3,19,30);")
robustness("amazon-seller-cumulative-txns", "INSERT INTO transactions VALUES (6,3,400.0,0.06,DATE '2026-01-01'),(7,3,250.0,0.06,DATE '2026-01-02'),(8,3,300.0,0.06,DATE '2026-01-04');")
robustness("apple-csr-program-share", "INSERT INTO participation VALUES (6,'Seattle','Coding Camp',300),(7,'Seattle','Mentorship',150),(8,'Seattle','Grants',90);")
robustness("meta-creator-followers-per-engagement", "INSERT INTO posts VALUES (6,6,'Stories',1200,280),(7,7,'Stories',900,150);")
robustness("netflix-mobile-top-resume-show", "INSERT INTO resume_events VALUES (8,8,300,'Web',DATE '2026-05-01'),(9,9,300,'Web',DATE '2026-05-02'),(10,10,301,'Web',DATE '2026-05-03');")
robustness("stripe-payout-fee-burden", "INSERT INTO payouts VALUES (6,'Gaming',7000.0,180.0,90.0),(7,'Gaming',3000.0,75.0,40.0);")
robustness("x-advertiser-segment-funnel", "INSERT INTO campaigns VALUES (6,'Entertainment',70000,2800,200),(7,'Entertainment',30000,1500,90);")
robustness("uber-driver-earnings-per-hour", "INSERT INTO trips VALUES (5,3,TIMESTAMP '2026-05-01 14:00:00',TIMESTAMP '2026-05-01 14:40:00',16.0),(6,3,TIMESTAMP '2026-05-01 15:00:00',TIMESTAMP '2026-05-01 15:30:00',14.0);")
robustness("microsoft-teams-daily-delta", "INSERT INTO messages VALUES (7,1,'general',DATE '2026-05-04'),(8,2,'general',DATE '2026-05-04'),(9,3,'random',DATE '2026-05-04'),(10,1,'general',DATE '2026-05-05');")


# ── Agent-authored named traps supersede the robustness placeholders ─────────
# scripts/agent_traps.json is produced by parallel Sonnet agents (see the
# answer-authoring run) and independently re-verified by the harness below.
import os as _os
_ATP = _os.path.join(_os.path.dirname(__file__), "agent_traps.json")
if _os.path.exists(_ATP):
    _agent = json.load(open(_ATP))
    _ids = {a["id"] for a in _agent}
    CASES[:] = [c for c in CASES if c["id"] not in _ids]  # drop robustness for these
    for a in _agent:
        CASES.append({"id": a["id"], "type": "explicit", "naive": a["naive"], "extra": None,
                      "hidden": a["hidden_setup"], "name": a["name"], "explanation": a["explanation"]})


# ── Verify the wedge property in DuckDB ──────────────────────────────────────
def build(case):
    pub = PUBLIC.get(case["id"])
    if not pub:
        raise KeyError(f"public problem not found: {case['id']}")
    reference = pub["referenceSolution"]
    if case["type"] == "avg_null":
        naive = reference.replace(case["col"], f"(SUM{case['col'][3:]} * 1.0 / COUNT(*))")
    elif case["type"] == "distinct":
        naive = reference.replace(case["expr"], case["replacement"])
    elif case["type"] == "bool_rate":
        col = case["col"]
        naive = reference.replace(
            f"AVG(CASE WHEN {col} THEN 1.0 ELSE 0 END)",
            f"(COUNT(*) FILTER (WHERE {col}) * 1.0 / COUNT({col}))",
        )
    elif case["type"] == "robustness":
        naive = None
    else:
        naive = case["naive"]
    hidden = case.get("hidden") or (pub["setupSql"] + "\n" + case["extra"])
    return pub, reference, naive, hidden


def run(setup, sql):
    con = duckdb.connect()
    con.execute(setup)
    rows = con.execute(sql).fetchall()
    con.close()
    return rows


def normcell(v):
    if v is None:
        return "∅"
    if isinstance(v, float):
        return f"{v:.4f}"
    return str(v)


def key(rows, order_matters):
    norm = [[normcell(c) for c in r] for r in rows]
    return norm if order_matters else sorted(map(str, norm))


def verify():
    rejected, verified = [], []
    for c in CASES:
        try:
            pub, reference, naive, hidden = build(c)
            rs, rh = run(pub["setupSql"], reference), run(hidden, reference)
            ref_ok = len(rh) > 0
            om = pub["orderMatters"]  # sample is graded with the question's real order semantics
            if c["type"] == "robustness":
                # No named trap: just confirm the reference is correct on a genuinely
                # bigger dataset. Hidden grading is set-based, so a correct answer matches.
                differs = key(rh, False) != key(rs, False)
                if ref_ok and differs:
                    verified.append(c)
                    print(f"OK   {c['id']}  [robustness] {c['name']}")
                else:
                    rejected.append((c["id"], f"ref_ok={ref_ok} differs_from_sample={differs}"))
                continue
            if naive == reference:
                rejected.append((c["id"], "naive identical to reference (derivation no-op)"))
                continue
            ns, nh = run(pub["setupSql"], naive), run(hidden, naive)
            passes_sample = key(ns, om) == key(rs, om)        # in-browser sample grading: order matters
            fails_hidden = key(nh, False) != key(rh, False)   # hidden grading: SET comparison (no order false-negatives)
            if passes_sample and fails_hidden and ref_ok:
                verified.append(c)
                print(f"OK   {c['id']}  [{c['type']}] {c['name']}")
            else:
                rejected.append((c["id"], f"sample_ok={passes_sample} hidden_fails={fails_hidden} ref_ok={ref_ok}"))
        except Exception as e:
            rejected.append((c["id"], f"error: {e}"))
    print(f"\n{len(verified)} verified, {len(rejected)} rejected.")
    for rid, why in rejected:
        print(f"  REJECT {rid}: {why}")
    return verified, rejected


# ── Emit lib/data/practice/adversarial.server.ts ─────────────────────────────
OUT = "lib/data/practice/adversarial.server.ts"
HEADER = '''import "server-only";

/**
 * SERVER-ONLY adversarial test data — the heart of the "looks right, but watch
 * this" wedge. For each question we keep a HIDDEN dataset engineered to break
 * the most common mistake, plus the reference solution to grade against it. The
 * `import "server-only"` guard fails the build if any client component imports
 * this — the hidden data and answer key must never reach the browser.
 *
 * GENERATED FILE — every case is verified in DuckDB (the common wrong query
 * passes the visible sample but fails the hidden dataset). Edit
 * scripts/gen_adversarial.py and re-run it instead of hand-editing.
 */
export interface AdversarialCase {
  /** Short label shown to free users as the locked teaser, e.g. "NULL foreign key". */
  name: string;
  /** Setup SQL for the hidden dataset — never sent to the client. */
  hiddenSetupSql: string;
  /** Reference solution graded against the hidden dataset. */
  referenceSolution: string;
  /** Does row order matter when diffing on the hidden dataset? */
  orderMatters: boolean;
  /** Plain-English fallback explanation (used when AI grading is off). */
  explanation: string;
}

export const ADVERSARIAL_CASES: Record<string, AdversarialCase> = {
'''


def tl(s):
    return "`" + s.replace("\\", "\\\\").replace("`", "\\`").replace("${", "\\${") + "`"


def emit(verified):
    parts = [HEADER]
    for c in verified:
        pub = PUBLIC[c["id"]]
        hidden = c.get("hidden") or (pub["setupSql"] + "\n" + c["extra"])
        parts.append(f"  {json.dumps(c['id'])}: {{\n")
        parts.append(f"    name: {json.dumps(c['name'], ensure_ascii=False)},\n")
        parts.append(f"    hiddenSetupSql: {tl(hidden)},\n")
        parts.append(f"    referenceSolution: {tl(pub['referenceSolution'])},\n")
        # Hidden grading is set-based: a correct answer always matches the reference's
        # row set regardless of order, so no correct submission is ever flagged.
        parts.append("    orderMatters: false,\n")
        parts.append(f"    explanation: {json.dumps(c['explanation'], ensure_ascii=False)},\n")
        parts.append("  },\n")
    parts.append("};\n\n")
    parts.append("export function getAdversarialCase(problemId: string): AdversarialCase | null {\n")
    parts.append("  return ADVERSARIAL_CASES[problemId] ?? null;\n}\n")
    with open(OUT, "w") as f:
        f.write("".join(parts))
    print(f"\nWrote {len(verified)} cases to {OUT}")


if __name__ == "__main__":
    verified, rejected = verify()
    if not verified:
        sys.exit(1)
    emit(verified)
