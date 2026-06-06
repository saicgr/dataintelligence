import "server-only";

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
  "never-ordered": {
    name: "NULL foreign key",
    hiddenSetupSql: `CREATE TABLE customers (id INTEGER, name VARCHAR);
CREATE TABLE orders (id INTEGER, customer_id INTEGER, amount DOUBLE);
INSERT INTO customers VALUES (1,'Ava'),(2,'Ben'),(3,'Cleo'),(4,'Dina'),(5,'Eli');
INSERT INTO orders VALUES (10,1,50),(11,1,20),(12,3,75),(13,5,10);
INSERT INTO orders VALUES (14, NULL, 99);`,
    referenceSolution: `SELECT c.id, c.name
FROM customers c
LEFT JOIN orders o ON o.customer_id = c.id
WHERE o.id IS NULL
ORDER BY c.id;`,
    orderMatters: false,
    explanation: "The orders table has a row with a NULL customer_id. `NOT IN (… NULL …)` evaluates to UNKNOWN for every customer, so the filter keeps no rows. Use NOT EXISTS or a LEFT JOIN … WHERE o.id IS NULL — both are null-safe.",
  },
  "airbnb-top-rated-listings": {
    name: "Off-by-one on the threshold",
    hiddenSetupSql: `CREATE TABLE listings (id INTEGER, name VARCHAR, avg_rating DOUBLE, reviews_count INTEGER);
INSERT INTO listings VALUES
 (1,'Ocean Loft',4.92,128),
 (2,'City Studio',4.81,52),
 (3,'Mountain Cabin',4.79,300),
 (4,'Garden Suite',4.95,40),
 (5,'Downtown Flat',4.50,500),
 (6,'Lake House',4.88,77);
INSERT INTO listings VALUES (7, 'Budget Inn', 4.90, 50);`,
    referenceSolution: `SELECT id, name, avg_rating
FROM listings
WHERE avg_rating >= 4.8 AND reviews_count >= 50
ORDER BY avg_rating DESC, id ASC;`,
    orderMatters: false,
    explanation: "The bar is 'at least 50 reviews', so a listing with exactly 50 qualifies. `reviews_count > 50` is exclusive and drops it. Use >= for an inclusive threshold.",
  },
  "meta-marketplace-price-by-city": {
    name: "NULL in the average",
    hiddenSetupSql: `CREATE TABLE marketplace_items (id INTEGER, city VARCHAR, category VARCHAR, price DOUBLE);
INSERT INTO marketplace_items VALUES
 (1,'Austin','Furniture',120.0),
 (2,'Austin','Electronics',300.0),
 (3,'Denver','Furniture',80.0),
 (4,'Denver','Electronics',220.0),
 (5,'Denver','Toys',20.0),
 (6,'Miami','Electronics',500.0);
INSERT INTO marketplace_items VALUES (7, 'Austin', 'Furniture', NULL);`,
    referenceSolution: `SELECT city, ROUND(AVG(price), 2) AS avg_price
FROM marketplace_items
GROUP BY city
ORDER BY avg_price DESC;`,
    orderMatters: false,
    explanation: "An item listed with no price (NULL) isn't a $0 item. AVG divides by the number of priced items; SUM(price)/COUNT(*) divides by every row and counts the unpriced one as zero. Use AVG.",
  },
  "netflix-employee-satisfaction": {
    name: "NULL in the average",
    hiddenSetupSql: `CREATE TABLE employees (id INTEGER, department VARCHAR, job_category VARCHAR, satisfaction_score INTEGER);
INSERT INTO employees VALUES
 (1,'Engineering','IC',8),
 (2,'Engineering','IC',6),
 (3,'Engineering','Manager',9),
 (4,'Content','IC',7),
 (5,'Content','IC',5),
 (6,'Content','Manager',4);
INSERT INTO employees VALUES (7, 'Engineering', 'IC', NULL);`,
    referenceSolution: `SELECT department, job_category, ROUND(AVG(satisfaction_score), 2) AS avg_score
FROM employees
GROUP BY department, job_category
ORDER BY department, job_category;`,
    orderMatters: false,
    explanation: "One employee hasn't been surveyed yet (NULL score). AVG divides by the count of non-null scores; SUM(score)/COUNT(*) divides by every row, counting the unsurveyed person as a zero and dragging the average down. Use AVG.",
  },
  "google-search-quality": {
    name: "NULL in the average",
    hiddenSetupSql: `CREATE TABLE search_sessions (id INTEGER, user_id INTEGER, clicked_link BOOLEAN, time_on_page_sec INTEGER, satisfied BOOLEAN);
INSERT INTO search_sessions VALUES
 (1,1,TRUE,40,TRUE),
 (2,2,TRUE,55,TRUE),
 (3,3,TRUE,30,FALSE),
 (4,4,FALSE,8,FALSE),
 (5,5,FALSE,12,FALSE),
 (6,6,FALSE,20,TRUE);
INSERT INTO search_sessions VALUES (7, 7, TRUE, NULL, TRUE);`,
    referenceSolution: `SELECT clicked_link,
       COUNT(*) AS sessions,
       ROUND(AVG(time_on_page_sec), 1) AS avg_time,
       ROUND(AVG(CASE WHEN satisfied THEN 1.0 ELSE 0 END), 2) AS satisfied_rate
FROM search_sessions
GROUP BY clicked_link
ORDER BY clicked_link;`,
    orderMatters: false,
    explanation: "A session with no recorded dwell time (NULL) isn't a 0-second session. AVG skips it; SUM(time)/COUNT(*) counts it as zero and deflates the average.",
  },
  "google-gmail-labels": {
    name: "Counting rows, not people",
    hiddenSetupSql: `CREATE TABLE labels (id INTEGER, user_id INTEGER, label_name VARCHAR, emails_tagged INTEGER);
INSERT INTO labels VALUES
 (1,1,'Work',120),
 (2,2,'Work',80),
 (3,3,'Travel',15),
 (4,1,'Receipts',45),
 (5,2,'Receipts',30),
 (6,4,'Work',60);
INSERT INTO labels VALUES (7, 1, 'Work', 30);`,
    referenceSolution: `SELECT label_name,
       SUM(emails_tagged) AS total_tagged,
       COUNT(DISTINCT user_id) AS users
FROM labels
GROUP BY label_name
ORDER BY total_tagged DESC, label_name;`,
    orderMatters: false,
    explanation: "A user can hold the same label across rows. COUNT(user_id) counts rows; the metric is how many people use the label, so use COUNT(DISTINCT user_id).",
  },
  "amazon-brand-perception": {
    name: "NULL in the average",
    hiddenSetupSql: `CREATE TABLE segments (id INTEGER, segment VARCHAR, brand_perception_score INTEGER);
INSERT INTO segments VALUES
 (1,'Retail',82),(2,'Retail',78),
 (3,'AWS',91),(4,'AWS',88),
 (5,'Entertainment',70),(6,'Entertainment',74);
INSERT INTO segments VALUES (7, 'Retail', NULL);`,
    referenceSolution: `SELECT segment, ROUND(AVG(brand_perception_score), 2) AS avg_perception
FROM segments
GROUP BY segment
ORDER BY avg_perception DESC;`,
    orderMatters: false,
    explanation: "A segment with no recorded perception score (NULL) shouldn't count as a zero. AVG ignores it; SUM/COUNT(*) doesn't. Use AVG.",
  },
  "google-cloud-early-adopters": {
    name: "NULL in the average",
    hiddenSetupSql: `CREATE TABLE customers (id INTEGER, premium_early_adopter BOOLEAN, monthly_spend DOUBLE, months_active INTEGER);
INSERT INTO customers VALUES
 (1,TRUE,5000.0,30),
 (2,TRUE,4200.0,26),
 (3,FALSE,1500.0,10),
 (4,FALSE,1800.0,8),
 (5,TRUE,6100.0,34),
 (6,FALSE,900.0,5);
INSERT INTO customers VALUES (7, TRUE, NULL, 20);`,
    referenceSolution: `SELECT premium_early_adopter,
       ROUND(AVG(monthly_spend), 2) AS avg_spend,
       ROUND(AVG(months_active), 1) AS avg_months
FROM customers
GROUP BY premium_early_adopter
ORDER BY premium_early_adopter;`,
    orderMatters: false,
    explanation: "A customer with no recorded spend (NULL) isn't a $0 customer. AVG divides by customers with a known spend; SUM/COUNT(*) divides by all rows. Use AVG.",
  },
  "airbnb-host-response-time": {
    name: "NULL in the average",
    hiddenSetupSql: `CREATE TABLE messages (id INTEGER, host_id INTEGER, response_minutes INTEGER);
INSERT INTO messages VALUES
 (1,1,15),(2,1,25),
 (3,2,5),(4,2,7),
 (5,3,120),(6,3,90),
 (7,4,40);
INSERT INTO messages VALUES (8, 4, NULL);`,
    referenceSolution: `SELECT host_id, ROUND(AVG(response_minutes), 1) AS avg_response
FROM messages
GROUP BY host_id
ORDER BY avg_response ASC, host_id ASC;`,
    orderMatters: false,
    explanation: "A message a host never answered has no response time (NULL). AVG ignores it; SUM/COUNT(*) treats it as an instant (0-minute) reply and understates the average.",
  },
  "openai-gpt4-context-depth": {
    name: "NULL in the average",
    hiddenSetupSql: `CREATE TABLE responses (id INTEGER, domain VARCHAR, context_tokens_retained INTEGER);
INSERT INTO responses VALUES
 (1,'Legal',4000),(2,'Legal',6000),
 (3,'Medical',5500),(4,'Medical',7000),
 (5,'Code',8000),(6,'Code',9000);
INSERT INTO responses VALUES (7, 'Legal', NULL);`,
    referenceSolution: `SELECT domain,
       ROUND(AVG(context_tokens_retained), 0) AS avg_tokens,
       MAX(context_tokens_retained) AS peak_tokens
FROM responses
GROUP BY domain
ORDER BY domain;`,
    orderMatters: false,
    explanation: "A response with no recorded retention (NULL) shouldn't count as zero tokens. AVG skips it; SUM/COUNT(*) divides by every row. Use AVG.",
  },
  "ubereats-partner-delay": {
    name: "NULL in the average",
    hiddenSetupSql: `CREATE TABLE deliveries (id INTEGER, partner_id INTEGER, expected_min INTEGER, actual_min INTEGER);
INSERT INTO deliveries VALUES
 (1,1,30,28),(2,1,25,40),
 (3,2,20,20),(4,2,35,33),
 (5,3,15,45),(6,3,20,50);
INSERT INTO deliveries VALUES (7, 3, 20, NULL);`,
    referenceSolution: `SELECT partner_id,
       ROUND(AVG(actual_min - expected_min), 1) AS avg_delay
FROM deliveries
GROUP BY partner_id
ORDER BY avg_delay DESC;`,
    orderMatters: false,
    explanation: "An in-progress delivery has no actual time yet (NULL), so its delay is unknown. AVG ignores it; SUM(...)/COUNT(*) treats the gap as zero delay and skews the partner's average.",
  },
  "ea-game-library-health": {
    name: "Dropping a predicate",
    hiddenSetupSql: `CREATE TABLE library (id INTEGER, user_id INTEGER, game_id INTEGER, installed BOOLEAN, hours_played DOUBLE);
INSERT INTO library VALUES
 (1,1,10,TRUE,12.0),
 (2,1,11,TRUE,0.0),
 (3,1,12,FALSE,0.0),
 (4,2,10,TRUE,40.0),
 (5,2,13,TRUE,3.5),
 (6,3,14,FALSE,0.0);
INSERT INTO library VALUES (7, 1, 15, FALSE, 5.0);`,
    referenceSolution: `SELECT user_id,
       COUNT(*) FILTER (WHERE installed) AS installed_games,
       COUNT(*) FILTER (WHERE installed AND hours_played > 0) AS active_games
FROM library
GROUP BY user_id
ORDER BY user_id;`,
    orderMatters: false,
    explanation: "A game can have play time but be uninstalled (a stale row). Counting active games by hours_played > 0 alone includes those; 'actively play' means installed AND played. Keep both predicates in the filter.",
  },
  "apple-recommended-track-adds": {
    name: "Counting rows, not people",
    hiddenSetupSql: `CREATE TABLE playlist_actions (id INTEGER, user_id INTEGER, track_id INTEGER, source VARCHAR);
INSERT INTO playlist_actions VALUES
 (1,1,100,'recommended'),
 (2,1,101,'manual'),
 (3,2,102,'manual'),
 (4,3,103,'recommended'),
 (5,4,104,'manual'),
 (6,5,105,'recommended');
INSERT INTO playlist_actions VALUES (7, 1, 106, 'recommended');`,
    referenceSolution: `SELECT COUNT(DISTINCT user_id) AS total_users,
       COUNT(DISTINCT user_id) FILTER (WHERE source = 'recommended') AS adopters,
       ROUND(COUNT(DISTINCT user_id) FILTER (WHERE source = 'recommended') * 1.0
             / COUNT(DISTINCT user_id), 2) AS adoption_rate
FROM playlist_actions;`,
    orderMatters: false,
    explanation: "Adopters means distinct users who added a recommended track. COUNT(user_id) counts add-events, so a user who adds several recommendations is counted multiple times. Use COUNT(DISTINCT user_id).",
  },
  "amazon-playlist-size-vs-listen": {
    name: "NULL in the average",
    hiddenSetupSql: `CREATE TABLE playlists (id INTEGER, user_id INTEGER, track_count INTEGER, listen_minutes INTEGER);
INSERT INTO playlists VALUES
 (1,1,10,40),(2,2,15,55),
 (3,3,25,120),(4,4,40,160),
 (5,5,60,300),(6,6,80,350);
INSERT INTO playlists VALUES (7, 7, 30, NULL);`,
    referenceSolution: `SELECT CASE WHEN track_count < 20 THEN 'small (<20)'
            WHEN track_count <= 50 THEN 'medium (20-50)'
            ELSE 'large (>50)' END AS size_bucket,
       ROUND(AVG(listen_minutes), 1) AS avg_listen
FROM playlists
GROUP BY size_bucket
ORDER BY MIN(track_count);`,
    orderMatters: false,
    explanation: "A playlist with no recorded listen time (NULL) isn't a 0-minute playlist. AVG ignores it; SUM/COUNT(*) divides by every playlist. Use AVG.",
  },
  "apple-artist-rec-actions": {
    name: "Counting rows, not people",
    hiddenSetupSql: `CREATE TABLE rec_interactions (id INTEGER, user_id INTEGER, artist_id INTEGER, action VARCHAR);
INSERT INTO rec_interactions VALUES
 (1,1,10,'view'),(2,1,11,'follow'),
 (3,2,10,'view'),(4,2,12,'skip'),
 (5,3,13,'view'),(6,3,13,'follow'),
 (7,4,14,'skip');
INSERT INTO rec_interactions VALUES (8, 1, 15, 'view');`,
    referenceSolution: `SELECT action,
       COUNT(*) AS events,
       COUNT(DISTINCT user_id) AS users
FROM rec_interactions
GROUP BY action
ORDER BY events DESC, action;`,
    orderMatters: false,
    explanation: "A user can perform the same action many times. COUNT(user_id) counts events; the metric is distinct users, so use COUNT(DISTINCT user_id).",
  },
  "netflix-recommendation-watchtime": {
    name: "NULL in the average",
    hiddenSetupSql: `CREATE TABLE sessions (id INTEGER, user_id INTEGER, from_recommendation BOOLEAN, watch_minutes INTEGER);
INSERT INTO sessions VALUES
 (1,1,TRUE,90),(2,2,TRUE,120),(3,3,TRUE,45),
 (4,4,FALSE,30),(5,5,FALSE,20),(6,6,FALSE,60);
INSERT INTO sessions VALUES (7, 7, TRUE, NULL);`,
    referenceSolution: `SELECT from_recommendation,
       COUNT(*) AS sessions,
       SUM(watch_minutes) AS total_minutes,
       ROUND(AVG(watch_minutes), 1) AS avg_minutes
FROM sessions
GROUP BY from_recommendation
ORDER BY from_recommendation DESC;`,
    orderMatters: false,
    explanation: "A session with no recorded watch time (NULL) isn't a 0-minute session. AVG skips it; SUM/COUNT(*) divides by every session and deflates the average.",
  },
  "microsoft-teams-coediting": {
    name: "NULL in the average",
    hiddenSetupSql: `CREATE TABLE files (id INTEGER, org_segment VARCHAR, file_name VARCHAR, co_editors INTEGER);
INSERT INTO files VALUES
 (1,'Sales','deck.pptx',1),(2,'Sales','quota.xlsx',4),
 (3,'Eng','spec.docx',3),(4,'Eng','design.docx',5),
 (5,'HR','policy.docx',1),(6,'HR','review.docx',2);
INSERT INTO files VALUES (7, 'Sales', 'draft.docx', NULL);`,
    referenceSolution: `SELECT org_segment,
       ROUND(AVG(co_editors), 2) AS avg_co_editors,
       COUNT(*) FILTER (WHERE co_editors > 1) AS multi_editor_files
FROM files
GROUP BY org_segment
ORDER BY avg_co_editors DESC;`,
    orderMatters: false,
    explanation: "A file with an unknown co-editor count (NULL) shouldn't count as zero collaborators. AVG ignores it; SUM/COUNT(*) divides by every file. Use AVG.",
  },
  "airbnb-work-travel-expense": {
    name: "NULL in the average",
    hiddenSetupSql: `CREATE TABLE bookings (id INTEGER, company VARCHAR, booking_cost DOUBLE, days_in_advance INTEGER);
INSERT INTO bookings VALUES
 (1,'Acme',300.0,14),(2,'Acme',450.0,7),
 (3,'Globex',200.0,30),(4,'Globex',250.0,21),
 (5,'Initech',600.0,2),(6,'Initech',550.0,3);
INSERT INTO bookings VALUES (7, 'Acme', NULL, 10);`,
    referenceSolution: `SELECT company,
       ROUND(AVG(booking_cost), 2) AS avg_cost,
       ROUND(AVG(days_in_advance), 1) AS avg_advance
FROM bookings
GROUP BY company
ORDER BY avg_cost DESC;`,
    orderMatters: false,
    explanation: "A booking with no recorded cost (NULL) isn't a $0 booking. AVG divides by bookings with a known cost; SUM/COUNT(*) divides by all rows. Use AVG.",
  },
  "airbnb-amenity-pricing": {
    name: "NULL in the average",
    hiddenSetupSql: `CREATE TABLE listings (id INTEGER, has_pool BOOLEAN, has_ocean_view BOOLEAN, price DOUBLE, cleaning_fee DOUBLE);
INSERT INTO listings VALUES
 (1,TRUE,TRUE,400.0,90.0),
 (2,TRUE,FALSE,320.0,75.0),
 (3,FALSE,TRUE,250.0,60.0),
 (4,FALSE,FALSE,180.0,40.0),
 (5,TRUE,TRUE,500.0,100.0),
 (6,FALSE,FALSE,160.0,35.0);
INSERT INTO listings VALUES (7, TRUE, TRUE, NULL, 80.0);`,
    referenceSolution: `SELECT has_pool,
       ROUND(AVG(price), 2) AS avg_price,
       ROUND(AVG(cleaning_fee), 2) AS avg_cleaning_fee
FROM listings
GROUP BY has_pool
ORDER BY has_pool DESC;`,
    orderMatters: false,
    explanation: "A listing with no nightly price set (NULL) isn't a $0 listing. AVG ignores it; SUM/COUNT(*) divides by every listing. Use AVG.",
  },
  "stripe-connect-payout-success": {
    name: "Unseen column values",
    hiddenSetupSql: `CREATE TABLE payouts (id INTEGER, seller_segment VARCHAR, status VARCHAR);
INSERT INTO payouts VALUES
 (1,'SMB','success'),(2,'SMB','success'),(3,'SMB','failed'),
 (4,'Enterprise','success'),(5,'Enterprise','success'),
 (6,'New','failed'),(7,'New','failed'),(8,'New','success');
INSERT INTO payouts VALUES (9, 'SMB', 'pending'), (10, 'New', 'pending');`,
    referenceSolution: `SELECT seller_segment,
       COUNT(*) AS total,
       ROUND(COUNT(*) FILTER (WHERE status = 'success') * 1.0 / COUNT(*), 2) AS success_rate
FROM payouts
GROUP BY seller_segment
ORDER BY success_rate ASC;`,
    orderMatters: false,
    explanation: "Payouts can also be 'pending'. Dividing only by success+failed silently drops them and overstates the success rate. The denominator is COUNT(*) — don't assume status is binary.",
  },
  "stripe-tier-retention": {
    name: "NULL in the average",
    hiddenSetupSql: `CREATE TABLE subscriptions (id INTEGER, tier VARCHAR, months_active INTEGER, active BOOLEAN);
INSERT INTO subscriptions VALUES
 (1,'Basic',6,FALSE),(2,'Basic',8,TRUE),(3,'Basic',4,FALSE),
 (4,'Pro',18,TRUE),(5,'Pro',24,TRUE),(6,'Pro',12,FALSE),
 (7,'Premium',36,TRUE),(8,'Premium',30,TRUE);
INSERT INTO subscriptions VALUES (9, 'Basic', NULL, TRUE);`,
    referenceSolution: `SELECT tier,
       ROUND(AVG(months_active), 1) AS avg_months,
       ROUND(AVG(CASE WHEN active THEN 1.0 ELSE 0 END), 2) AS active_rate
FROM subscriptions
GROUP BY tier
ORDER BY avg_months DESC;`,
    orderMatters: false,
    explanation: "A subscription whose tenure isn't recorded yet (NULL) shouldn't count as zero months. AVG ignores it; SUM/COUNT(*) divides by every subscription. Use AVG.",
  },
  "x-sports-engagement": {
    name: "NULL in the average",
    hiddenSetupSql: `CREATE TABLE interactions (id INTEGER, content_type VARCHAR, user_id INTEGER, engagement INTEGER);
INSERT INTO interactions VALUES
 (1,'commentary',1,40),(2,'commentary',2,60),(3,'commentary',1,20),
 (4,'highlight',3,100),(5,'highlight',4,80),(6,'highlight',3,50);
INSERT INTO interactions VALUES (7, 'commentary', 5, NULL);`,
    referenceSolution: `SELECT content_type,
       COUNT(DISTINCT user_id) AS users,
       SUM(engagement) AS total_engagement,
       ROUND(AVG(engagement), 1) AS avg_engagement
FROM interactions
GROUP BY content_type
ORDER BY total_engagement DESC;`,
    orderMatters: false,
    explanation: "An interaction with no engagement score recorded (NULL) isn't a zero. AVG skips it; SUM/COUNT(*) divides by every interaction. Use AVG.",
  },
  "openai-codex-language-quality": {
    name: "NULL in the average",
    hiddenSetupSql: `CREATE TABLE suggestions (id INTEGER, language VARCHAR, accepted BOOLEAN, errors_introduced INTEGER);
INSERT INTO suggestions VALUES
 (1,'Python',TRUE,0),(2,'Python',TRUE,1),(3,'Python',FALSE,3),
 (4,'JavaScript',TRUE,1),(5,'JavaScript',FALSE,2),
 (6,'Rust',FALSE,4),(7,'Rust',TRUE,0);
INSERT INTO suggestions VALUES (8, 'Python', TRUE, NULL);`,
    referenceSolution: `SELECT language,
       ROUND(AVG(CASE WHEN accepted THEN 1.0 ELSE 0 END), 2) AS accept_rate,
       ROUND(AVG(errors_introduced), 2) AS avg_errors
FROM suggestions
GROUP BY language
ORDER BY accept_rate DESC;`,
    orderMatters: false,
    explanation: "A suggestion whose error count wasn't measured (NULL) shouldn't count as zero errors. AVG ignores it; SUM/COUNT(*) divides by every suggestion. Use AVG.",
  },
  "ubereats-route-clustering": {
    name: "NULL in the average",
    hiddenSetupSql: `CREATE TABLE pickups (id INTEGER, partner_id INTEGER, route_id INTEGER, orders_in_route INTEGER);
INSERT INTO pickups VALUES
 (1,1,10,3),(2,1,11,4),
 (3,2,12,1),(4,2,13,2),(5,2,14,1),
 (6,3,15,5),(7,3,16,6);
INSERT INTO pickups VALUES (8, 1, 17, NULL);`,
    referenceSolution: `SELECT partner_id,
       COUNT(*) AS routes,
       ROUND(AVG(orders_in_route), 2) AS avg_orders
FROM pickups
GROUP BY partner_id
ORDER BY avg_orders DESC;`,
    orderMatters: false,
    explanation: "A route with an unrecorded order count (NULL) shouldn't count as zero orders. AVG ignores it; SUM/COUNT(*) divides by every route. Use AVG.",
  },
  "paypal-venmo-social-bands": {
    name: "NULL in the average",
    hiddenSetupSql: `CREATE TABLE users (id INTEGER, social_interactions INTEGER, transactions INTEGER);
INSERT INTO users VALUES
 (1,0,2),(2,0,1),
 (3,3,8),(4,5,10),
 (5,8,20),(6,12,30);
INSERT INTO users VALUES (7, 3, NULL);`,
    referenceSolution: `SELECT CASE WHEN social_interactions = 0 THEN 'none (0)'
            WHEN social_interactions <= 5 THEN 'low (1-5)'
            ELSE 'high (6+)' END AS social_band,
       COUNT(*) AS users,
       ROUND(AVG(transactions), 1) AS avg_txns
FROM users
GROUP BY social_band
ORDER BY MIN(social_interactions);`,
    orderMatters: false,
    explanation: "A user with no transaction count recorded (NULL) isn't a zero-transaction user. AVG ignores it; SUM/COUNT(*) divides by every user in the band. Use AVG.",
  },
  "ea-starwars-narrative": {
    name: "NULL in the average",
    hiddenSetupSql: `CREATE TABLE choices (id INTEGER, narrative_element VARCHAR, player_id INTEGER, time_spent_sec INTEGER);
INSERT INTO choices VALUES
 (1,'Dialogue',1,120),(2,'Dialogue',2,90),(3,'Dialogue',1,60),
 (4,'Combat',3,200),(5,'Combat',4,180),
 (6,'Exploration',5,300),(7,'Exploration',5,150);
INSERT INTO choices VALUES (8, 'Dialogue', 2, NULL);`,
    referenceSolution: `SELECT narrative_element,
       COUNT(DISTINCT player_id) AS players,
       SUM(time_spent_sec) AS total_time,
       ROUND(AVG(time_spent_sec), 1) AS avg_time
FROM choices
GROUP BY narrative_element
ORDER BY total_time DESC;`,
    orderMatters: false,
    explanation: "An interaction with no recorded time (NULL) isn't zero seconds. AVG skips it; SUM/COUNT(*) divides by every interaction and deflates the average.",
  },
  "google-pay-failure-rate": {
    name: "Unseen column values",
    hiddenSetupSql: `CREATE TABLE transactions (id INTEGER, merchant_category VARCHAR, status VARCHAR);
INSERT INTO transactions VALUES
 (1,'Travel','success'),(2,'Travel','failed'),(3,'Travel','failed'),
 (4,'Retail','success'),(5,'Retail','success'),(6,'Retail','failed'),
 (7,'Gaming','success'),(8,'Gaming','success');
INSERT INTO transactions VALUES (9, 'Travel', 'pending'), (10, 'Gaming', 'pending');`,
    referenceSolution: `SELECT merchant_category,
       COUNT(*) AS total,
       COUNT(*) FILTER (WHERE status = 'failed') AS failures,
       ROUND(COUNT(*) FILTER (WHERE status = 'failed') * 1.0 / COUNT(*), 2) AS failure_rate
FROM transactions
GROUP BY merchant_category
ORDER BY failure_rate DESC;`,
    orderMatters: false,
    explanation: "Production data also contains 'pending' transactions. Building the denominator from only success+failed silently drops them and inflates the failure rate. 'Total transactions' means COUNT(*) — never assume a column holds only the values in your sample.",
  },
  "linkedin-top-endorsed-skills": {
    name: "Counting rows, not people",
    hiddenSetupSql: `CREATE TABLE endorsements (id INTEGER, user_id INTEGER, skill VARCHAR, endorsement_count INTEGER);
INSERT INTO endorsements VALUES
 (1,1,'SQL',20),(2,2,'SQL',15),
 (3,3,'Python',30),(4,4,'Python',25),
 (5,5,'Leadership',10),(6,6,'Excel',8),
 (7,7,'Spark',12),(8,8,'SQL',9);
INSERT INTO endorsements VALUES (9, 1, 'SQL', 5);`,
    referenceSolution: `SELECT skill,
       SUM(endorsement_count) AS total_endorsements,
       COUNT(DISTINCT user_id) AS users
FROM endorsements
GROUP BY skill
ORDER BY total_endorsements DESC, skill
LIMIT 5;`,
    orderMatters: false,
    explanation: "A user can endorse the same skill more than once. COUNT(user_id) counts endorsement rows, so a repeat endorser inflates the unique-user count. Use COUNT(DISTINCT user_id).",
  },
  "google-ads-roi-by-segment": {
    name: "Counting rows, not distinct formats",
    hiddenSetupSql: `CREATE TABLE campaigns (id INTEGER, segment VARCHAR, ad_format VARCHAR, reach INTEGER, spend DOUBLE, revenue DOUBLE);
INSERT INTO campaigns VALUES
 (1,'Retail','search',100000,2000.0,8000.0),
 (2,'Retail','display',50000,1000.0,2000.0),
 (3,'Retail','video',80000,3000.0,9000.0),
 (4,'Travel','search',60000,1500.0,3000.0),
 (5,'Travel','display',40000,1000.0,1200.0);
INSERT INTO campaigns VALUES (6, 'Retail', 'search', 30000, 500.0, 1500.0);`,
    referenceSolution: `SELECT segment,
       COUNT(DISTINCT ad_format) AS formats,
       SUM(reach) AS reach,
       ROUND((SUM(revenue) - SUM(spend)) / SUM(spend), 2) AS roi
FROM campaigns
GROUP BY segment
ORDER BY roi DESC;`,
    orderMatters: false,
    explanation: "A segment can run the same ad format across several campaigns. COUNT(ad_format) counts campaigns; format diversity needs COUNT(DISTINCT ad_format).",
  },
  "netflix-telecom-partner-retention": {
    name: "NULL in the average",
    hiddenSetupSql: `CREATE TABLE bundles (id INTEGER, partner VARCHAR, subscriber_id INTEGER, converted BOOLEAN, retained BOOLEAN, watch_minutes INTEGER);
INSERT INTO bundles VALUES
 (1,'Verizon',1,TRUE,TRUE,400),
 (2,'Verizon',2,TRUE,FALSE,100),
 (3,'Verizon',3,FALSE,FALSE,0),
 (4,'T-Mobile',4,TRUE,TRUE,500),
 (5,'T-Mobile',5,TRUE,TRUE,450),
 (6,'T-Mobile',6,FALSE,FALSE,0);
INSERT INTO bundles VALUES (7, 'Verizon', 7, TRUE, TRUE, NULL);`,
    referenceSolution: `SELECT partner,
       ROUND(AVG(CASE WHEN converted THEN 1.0 ELSE 0 END), 2) AS conv_rate,
       ROUND(COUNT(*) FILTER (WHERE converted AND retained) * 1.0
             / COUNT(*) FILTER (WHERE converted), 2) AS retention_rate,
       ROUND(AVG(watch_minutes), 1) AS avg_watch
FROM bundles
GROUP BY partner
ORDER BY retention_rate DESC;`,
    orderMatters: false,
    explanation: "A subscriber whose watch time isn't recorded yet (NULL) shouldn't count as zero minutes. AVG ignores it; SUM/COUNT(*) divides by every subscriber. Use AVG.",
  },
  "meta-whatsapp-chat-types": {
    name: "NULL in the average",
    hiddenSetupSql: `CREATE TABLE events (id INTEGER, user_id INTEGER, chat_type VARCHAR, is_family BOOLEAN, call_duration_sec INTEGER, participants INTEGER);
INSERT INTO events VALUES
 (1,1,'group',TRUE,300,8),
 (2,2,'group',FALSE,120,5),
 (3,3,'group',TRUE,600,12),
 (4,4,'one-on-one',TRUE,180,2),
 (5,5,'one-on-one',FALSE,90,2);
INSERT INTO events VALUES (6, 6, 'group', FALSE, NULL, 4);`,
    referenceSolution: `SELECT chat_type,
       ROUND(AVG(call_duration_sec), 1) AS avg_call_sec,
       ROUND(AVG(participants), 1) AS avg_participants,
       COUNT(*) FILTER (WHERE is_family) AS family_chats
FROM events
GROUP BY chat_type
ORDER BY avg_participants DESC;`,
    orderMatters: false,
    explanation: "A chat event with no call (NULL duration) isn't a 0-second call. AVG skips it; SUM/COUNT(*) divides by every event and understates the average call length.",
  },
  "walmart-eyewear-style-rank": {
    name: "NULL in the average",
    hiddenSetupSql: `CREATE TABLE products (id INTEGER, style VARCHAR, price DOUBLE, units_sold INTEGER, satisfaction DOUBLE);
INSERT INTO products VALUES
 (1,'Aviator',120.0,500,4.5),
 (2,'Aviator',140.0,300,4.6),
 (3,'Round',90.0,800,4.2),
 (4,'Round',95.0,200,4.0),
 (5,'Cat-eye',150.0,400,4.8);
INSERT INTO products VALUES (6, 'Aviator', 130.0, 100, NULL);`,
    referenceSolution: `WITH agg AS (
  SELECT style,
         SUM(units_sold) AS total_units,
         ROUND(AVG(price), 2) AS avg_price,
         ROUND(AVG(satisfaction), 2) AS avg_satisfaction
  FROM products
  GROUP BY style
)
SELECT style, total_units, avg_price, avg_satisfaction,
       RANK() OVER (ORDER BY total_units DESC) AS rank
FROM agg
ORDER BY rank;`,
    orderMatters: false,
    explanation: "A product with no satisfaction score yet (NULL) shouldn't count as zero. AVG ignores it; SUM/COUNT(*) divides by every product in the style. Use AVG.",
  },
  "walmart-shipping-on-time": {
    name: "NULL in the average",
    hiddenSetupSql: `CREATE TABLE shipments (id INTEGER, category VARCHAR, promised_days INTEGER, actual_days INTEGER);
INSERT INTO shipments VALUES
 (1,'Electronics',3,2),(2,'Electronics',3,5),(3,'Electronics',2,2),
 (4,'Grocery',1,3),(5,'Grocery',1,4),(6,'Grocery',2,2),
 (7,'Apparel',5,4),(8,'Apparel',5,5);
INSERT INTO shipments VALUES (9, 'Grocery', 1, NULL);`,
    referenceSolution: `SELECT category,
       ROUND(AVG(CASE WHEN actual_days <= promised_days THEN 1.0 ELSE 0 END), 2) AS on_time_rate,
       ROUND(AVG(actual_days - promised_days), 2) AS avg_delay
FROM shipments
GROUP BY category
ORDER BY on_time_rate ASC;`,
    orderMatters: false,
    explanation: "A shipment still in transit has no actual delivery time (NULL), so its delay is unknown. AVG ignores it; SUM(...)/COUNT(*) treats the gap as zero delay and skews the average.",
  },
  "linkedin-feed-content-consistency": {
    name: "NULL in the average",
    hiddenSetupSql: `CREATE TABLE posts (id INTEGER, content_type VARCHAR, engagement_score INTEGER, week INTEGER);
INSERT INTO posts VALUES
 (1,'Article',80,1),(2,'Article',82,2),(3,'Article',78,3),
 (4,'Video',95,1),(5,'Video',40,2),(6,'Video',90,3),
 (7,'Poll',60,1),(8,'Poll',62,2);
INSERT INTO posts VALUES (9, 'Article', NULL, 4);`,
    referenceSolution: `SELECT content_type,
       ROUND(AVG(engagement_score), 1) AS avg_engagement,
       ROUND(STDDEV_SAMP(engagement_score), 1) AS engagement_stddev
FROM posts
GROUP BY content_type
ORDER BY avg_engagement DESC;`,
    orderMatters: false,
    explanation: "A post with no engagement score recorded (NULL) isn't a zero. AVG skips it; SUM/COUNT(*) divides by every post and deflates the average.",
  },
  "openai-chatgpt-complexity-balance": {
    name: "NULL in the average",
    hiddenSetupSql: `CREATE TABLE queries (id INTEGER, complexity VARCHAR, satisfaction DOUBLE, response_time_ms INTEGER);
INSERT INTO queries VALUES
 (1,'simple',4.5,300),(2,'simple',4.7,350),
 (3,'moderate',4.6,800),(4,'moderate',4.4,900),
 (5,'complex',4.8,2000),(6,'complex',4.9,2200);
INSERT INTO queries VALUES (7, 'simple', NULL, 320);`,
    referenceSolution: `WITH agg AS (
  SELECT complexity,
         AVG(satisfaction) AS avg_sat_raw,
         AVG(response_time_ms) AS avg_rt_raw
  FROM queries
  GROUP BY complexity
)
SELECT complexity,
       ROUND(avg_sat_raw, 2) AS avg_sat,
       ROUND(avg_rt_raw, 0) AS avg_rt,
       RANK() OVER (ORDER BY avg_sat_raw / avg_rt_raw DESC) AS rank
FROM agg
ORDER BY rank;`,
    orderMatters: false,
    explanation: "A query with no satisfaction rating (NULL) shouldn't count as zero. AVG divides by rated queries; SUM/COUNT(*) divides by all of them — which also distorts the satisfaction-to-latency ranking. Use AVG.",
  },
  "paypal-dispute-resolution": {
    name: "NULL in the average",
    hiddenSetupSql: `CREATE TABLE disputes (id INTEGER, transaction_type VARCHAR, resolution_days INTEGER, resolved BOOLEAN);
INSERT INTO disputes VALUES
 (1,'Goods',5,TRUE),(2,'Goods',7,TRUE),(3,'Goods',30,FALSE),
 (4,'Services',10,TRUE),(5,'Services',14,TRUE),(6,'Services',12,TRUE),
 (7,'Digital',2,TRUE),(8,'Digital',3,FALSE);
INSERT INTO disputes VALUES (9, 'Goods', NULL, FALSE);`,
    referenceSolution: `SELECT transaction_type,
       ROUND(AVG(CASE WHEN resolved THEN 1.0 ELSE 0 END), 2) AS resolution_rate,
       ROUND(AVG(resolution_days), 1) AS avg_days,
       QUANTILE_CONT(resolution_days, 0.5) AS median_days
FROM disputes
GROUP BY transaction_type
ORDER BY avg_days DESC;`,
    orderMatters: false,
    explanation: "An open, unresolved dispute has no resolution time yet (NULL). AVG ignores it; SUM(days)/COUNT(*) treats it as a same-day resolution and understates how long disputes really take. Use AVG (and note the median is also null-safe).",
  },
  "top-customers": {
    name: "Ties slip past your top-N",
    hiddenSetupSql: `CREATE TABLE orders (id INTEGER, customer_id INTEGER, amount DOUBLE, order_date DATE);
INSERT INTO orders VALUES
 (1, 101, 120.00, DATE '2026-01-03'),
 (2, 102, 80.00,  DATE '2026-01-04'),
 (3, 101, 200.00, DATE '2026-01-10'),
 (4, 103, 50.00,  DATE '2026-01-11'),
 (5, 102, 300.00, DATE '2026-01-15'),
 (6, 104, 90.00,  DATE '2026-01-18'),
 (7, 103, 60.00,  DATE '2026-01-20'),
 (8, 101, 40.00,  DATE '2026-01-22');
INSERT INTO orders VALUES (9, 105, 110, DATE '2026-01-25');`,
    referenceSolution: `SELECT customer_id, SUM(amount) AS total_spend
FROM orders
GROUP BY customer_id
ORDER BY total_spend DESC, customer_id ASC
LIMIT 3;`,
    orderMatters: false,
    explanation: "On the sample there's no tie at the boundary, so RANK() <= N and LIMIT N agree. Add a row tied with the Nth and RANK() returns it too — one row too many. Decide whether ties are included; if not, ORDER BY … with a tiebreaker + LIMIT (or ROW_NUMBER) gives a deterministic top-N.",
  },
  "meta-instagram-top-sharers": {
    name: "Ties slip past your top-N",
    hiddenSetupSql: `CREATE TABLE posts (id INTEGER, user_id INTEGER, shares INTEGER, likes INTEGER);
INSERT INTO posts VALUES
 (1,1,40,200),(2,1,30,150),
 (3,2,90,400),(4,3,10,50),
 (5,4,25,90),(6,5,60,300),
 (7,6,5,20),(8,2,20,100);
INSERT INTO posts VALUES (9, 7, 10, 50);`,
    referenceSolution: `SELECT user_id, SUM(shares) AS total_shares
FROM posts
GROUP BY user_id
ORDER BY total_shares DESC, user_id ASC
LIMIT 5;`,
    orderMatters: false,
    explanation: "On the sample there's no tie at the boundary, so RANK() <= N and LIMIT N agree. Add a row tied with the Nth and RANK() returns it too — one row too many. Decide whether ties are included; if not, ORDER BY … with a tiebreaker + LIMIT (or ROW_NUMBER) gives a deterministic top-N.",
  },
  "walmart-photo-gifts": {
    name: "Ties slip past your top-N",
    hiddenSetupSql: `CREATE TABLE products (id INTEGER, product_name VARCHAR, orders_count INTEGER, avg_satisfaction DOUBLE);
INSERT INTO products VALUES
 (1,'Photo Mug',1200,4.5),
 (2,'Canvas Print',900,4.8),
 (3,'Calendar',1500,4.2),
 (4,'Phone Case',600,4.0),
 (5,'Photo Book',2000,4.7),
 (6,'Magnet Set',300,3.9);
INSERT INTO products VALUES (7, 'Sticker Pack', 600, 4.1);`,
    referenceSolution: `SELECT product_name, orders_count
FROM products
ORDER BY orders_count DESC, product_name ASC
LIMIT 5;`,
    orderMatters: false,
    explanation: "On the sample there's no tie at the boundary, so RANK() <= N and LIMIT N agree. Add a row tied with the Nth and RANK() returns it too — one row too many. Decide whether ties are included; if not, ORDER BY … with a tiebreaker + LIMIT (or ROW_NUMBER) gives a deterministic top-N.",
  },
  "netflix-interactive-content": {
    name: "COUNT(column) skips NULLs",
    hiddenSetupSql: `CREATE TABLE interactions (id INTEGER, viewer_id INTEGER, show_id INTEGER, interaction_type VARCHAR);
INSERT INTO interactions VALUES
 (1,101,1,'choice'),
 (2,101,1,'replay'),
 (3,102,1,'choice'),
 (4,103,2,'choice'),
 (5,102,2,'replay'),
 (6,104,2,'pause'),
 (7,101,2,'choice');
INSERT INTO interactions VALUES (8, NULL, 2, 'choice');`,
    referenceSolution: `SELECT interaction_type,
       COUNT(DISTINCT viewer_id) AS unique_viewers,
       COUNT(*) AS total_interactions
FROM interactions
GROUP BY interaction_type
ORDER BY total_interactions DESC;`,
    orderMatters: false,
    explanation: "An anonymous interaction has a NULL viewer_id. COUNT(viewer_id) skips it; total interactions should count every row, so use COUNT(*).",
  },
  "google-photos-categorization": {
    name: "COUNT(column) skips NULLs",
    hiddenSetupSql: `CREATE TABLE photo_events (id INTEGER, user_id INTEGER, photo_id INTEGER, categorized BOOLEAN);
INSERT INTO photo_events VALUES
 (1,1,10,TRUE),
 (2,1,11,FALSE),
 (3,2,12,TRUE),
 (4,3,13,TRUE),
 (5,3,14,TRUE),
 (6,4,15,FALSE);
INSERT INTO photo_events VALUES (7, NULL, 16, TRUE);`,
    referenceSolution: `SELECT COUNT(*) FILTER (WHERE categorized) AS categorized_photos,
       COUNT(DISTINCT user_id) FILTER (WHERE categorized) AS unique_users
FROM photo_events;`,
    orderMatters: false,
    explanation: "A photo auto-categorized with no user attached has a NULL user_id. COUNT(user_id) skips it, undercounting categorized photos — count rows with COUNT(*).",
  },
  "apple-music-new-artists": {
    name: "COUNT(column) skips NULLs",
    hiddenSetupSql: `CREATE TABLE recommendations (id INTEGER, genre VARCHAR, artist_id INTEGER, was_played BOOLEAN);
INSERT INTO recommendations VALUES
 (1,'Indie',10,TRUE),
 (2,'Indie',11,FALSE),
 (3,'Indie',10,TRUE),
 (4,'Jazz',20,TRUE),
 (5,'Jazz',21,FALSE),
 (6,'Pop',30,FALSE);
INSERT INTO recommendations VALUES (7, 'Indie', NULL, TRUE);`,
    referenceSolution: `SELECT genre,
       COUNT(DISTINCT artist_id) AS artists,
       COUNT(*) FILTER (WHERE was_played) AS plays
FROM recommendations
GROUP BY genre
ORDER BY genre;`,
    orderMatters: false,
    explanation: "A played recommendation whose artist wasn't resolved has a NULL artist_id. COUNT(artist_id) drops it; count plays with COUNT(*) FILTER (WHERE was_played).",
  },
  "openai-chatgpt-domain-share": {
    name: "COUNT(column) skips NULLs",
    hiddenSetupSql: `CREATE TABLE queries (id INTEGER, user_id INTEGER, domain VARCHAR, month VARCHAR);
INSERT INTO queries VALUES
 (1,1,'technology','2026-01'),
 (2,1,'science','2026-01'),
 (3,2,'cooking','2026-01'),
 (4,3,'technology','2026-02'),
 (5,4,'health','2026-02'),
 (6,5,'science','2026-02');
INSERT INTO queries VALUES (7, 6, NULL, '2026-03');`,
    referenceSolution: `SELECT COUNT(*) AS total_queries,
       COUNT(*) FILTER (WHERE domain IN ('technology','science')) AS tech_sci_queries,
       ROUND(100.0 * COUNT(*) FILTER (WHERE domain IN ('technology','science')) / COUNT(*), 1) AS tech_sci_pct
FROM queries;`,
    orderMatters: false,
    explanation: "An uncategorized query has a NULL domain. COUNT(domain) skips it, so the total (and the percentage) are computed over the wrong base. Total queries is COUNT(*).",
  },
  "google-ads-zero-revenue": {
    name: "Proxy column ≠ the real condition",
    hiddenSetupSql: `CREATE TABLE campaigns (id INTEGER, name VARCHAR, ad_type VARCHAR, conversions INTEGER, revenue DOUBLE, spend DOUBLE);
INSERT INTO campaigns VALUES
 (1,'Spring Sale','search',120,4800.0,1000.0),
 (2,'Brand Lift','display',0,0.0,2500.0),
 (3,'Retarget','display',0,0.0,800.0),
 (4,'Holiday','video',60,3200.0,1500.0),
 (5,'Test Audience','search',0,0.0,300.0);
INSERT INTO campaigns VALUES (6, 'Promo Blitz', 'search', 5, 0.0, 400.0);`,
    referenceSolution: `SELECT name, ad_type, spend
FROM campaigns
WHERE revenue = 0
ORDER BY spend DESC;`,
    orderMatters: false,
    explanation: "Using conversions = 0 as a stand-in for 'no revenue' breaks when a campaign converts but still earns nothing (refunds, non-monetizing conversions). Filter on the actual metric, revenue = 0.",
  },
  "linkedin-messaging-volume": {
    name: "Distinct recipients ≠ message count",
    hiddenSetupSql: `CREATE TABLE messages (id INTEGER, sender_id INTEGER, recipient_id INTEGER, sent_at DATE);
INSERT INTO messages VALUES
 (1,1,5,DATE '2026-05-01'),
 (2,1,6,DATE '2026-05-01'),
 (3,2,5,DATE '2026-05-02'),
 (4,1,7,DATE '2026-05-03'),
 (5,3,1,DATE '2026-05-03'),
 (6,2,4,DATE '2026-05-04');
INSERT INTO messages VALUES (7, 1, 5, DATE '2026-05-05');`,
    referenceSolution: `SELECT sender_id, COUNT(*) AS messages
FROM messages
GROUP BY sender_id
ORDER BY messages DESC, sender_id ASC;`,
    orderMatters: false,
    explanation: "COUNT(DISTINCT recipient_id) counts the people a sender messaged (conversations), not messages — someone who messages the same person repeatedly is undercounted. Use COUNT(*).",
  },
  "meta-ar-filter-engagement": {
    name: "SUM(a + b) drops rows with a NULL part",
    hiddenSetupSql: `CREATE TABLE ar_filters (id INTEGER, filter_name VARCHAR, interactions INTEGER, shares INTEGER);
INSERT INTO ar_filters VALUES
 (1,'Sparkle',1200,300),
 (2,'Sparkle',800,150),
 (3,'Retro',500,600),
 (4,'Neon',2000,100),
 (5,'Retro',400,500);
INSERT INTO ar_filters VALUES (6, 'Neon', 500, NULL);`,
    referenceSolution: `SELECT filter_name,
       SUM(interactions) AS interactions,
       SUM(shares) AS shares,
       SUM(interactions) + SUM(shares) AS total_engagement
FROM ar_filters
GROUP BY filter_name
ORDER BY total_engagement DESC, filter_name;`,
    orderMatters: false,
    explanation: "When one column is NULL, interactions + shares is NULL and SUM skips the whole row — losing the non-null part too. SUM(interactions) + SUM(shares) adds the columns independently and keeps it.",
  },
  "google-play-download-conversion": {
    name: "Unknown outcomes shrink the denominator",
    hiddenSetupSql: `CREATE TABLE app_views (id INTEGER, app_id INTEGER, category VARCHAR, downloaded BOOLEAN);
INSERT INTO app_views VALUES
 (1,1,'Games',TRUE),(2,1,'Games',FALSE),(3,2,'Games',TRUE),
 (4,3,'Finance',TRUE),(5,3,'Finance',FALSE),(6,3,'Finance',FALSE),
 (7,4,'Health',TRUE),(8,4,'Health',TRUE);
INSERT INTO app_views VALUES (9, 5, 'Games', NULL);`,
    referenceSolution: `SELECT category,
       COUNT(*) AS views,
       COUNT(*) FILTER (WHERE downloaded) AS downloads,
       ROUND(COUNT(*) FILTER (WHERE downloaded) * 1.0 / COUNT(*), 2) AS conv_rate
FROM app_views
GROUP BY category
ORDER BY conv_rate DESC;`,
    orderMatters: false,
    explanation: "A view whose download outcome is unknown (NULL) is still a view. Dividing by COUNT(downloaded) drops it and inflates the conversion rate. The denominator is COUNT(*).",
  },
  "amazon-fresh-reorders": {
    name: "Unknown outcomes shrink the denominator",
    hiddenSetupSql: `CREATE TABLE orders (id INTEGER, user_id INTEGER, category VARCHAR, is_reorder BOOLEAN);
INSERT INTO orders VALUES
 (1,1,'Produce',TRUE),(2,1,'Produce',TRUE),(3,2,'Produce',FALSE),
 (4,2,'Dairy',TRUE),(5,3,'Dairy',TRUE),(6,3,'Dairy',TRUE),
 (7,4,'Snacks',FALSE),(8,4,'Snacks',TRUE);
INSERT INTO orders VALUES (9, 4, 'Produce', NULL);`,
    referenceSolution: `SELECT category,
       COUNT(*) FILTER (WHERE is_reorder) AS reorders,
       ROUND(COUNT(*) FILTER (WHERE is_reorder) * 1.0 / COUNT(*), 2) AS reorder_rate
FROM orders
GROUP BY category
ORDER BY reorders DESC;`,
    orderMatters: false,
    explanation: "An order whose reorder flag is unknown (NULL) is still an order. Dividing by COUNT(is_reorder) drops it and inflates the reorder rate. The denominator is COUNT(*).",
  },
  "meta-photo-sharing-age-group": {
    name: "Off-by-one bucket boundary",
    hiddenSetupSql: `CREATE TABLE users (id INTEGER, age INTEGER, country VARCHAR, photos_shared INTEGER);
INSERT INTO users VALUES
 (1,16,'US',50),(2,17,'CA',30),
 (3,25,'US',120),(4,40,'UK',80),
 (5,55,'US',20),(6,60,'IN',10);
INSERT INTO users VALUES (7, 50, 'US', 30);`,
    referenceSolution: `SELECT CASE WHEN age < 18 THEN '<18'
            WHEN age <= 50 THEN '18-50'
            ELSE '>50' END AS age_group,
       COUNT(DISTINCT id) AS users,
       SUM(photos_shared) AS photos
FROM users
GROUP BY age_group
ORDER BY MIN(age);`,
    orderMatters: false,
    explanation: "The 18-50 band is inclusive of 50. `age < 50` pushes a 50-year-old into '>50'. Use <= for inclusive upper bounds.",
  },
  "walmart-price-band-sales": {
    name: "Off-by-one bucket boundary",
    hiddenSetupSql: `CREATE TABLE products (id INTEGER, name VARCHAR, price DOUBLE, units_sold INTEGER);
INSERT INTO products VALUES
 (1,'Soap',3.0,5000),(2,'Toothpaste',4.5,3000),
 (3,'Detergent',12.0,2000),(4,'Shampoo',8.0,2500),
 (5,'Vacuum',45.0,300),(6,'Blender',25.0,500);
INSERT INTO products VALUES (7, 'Mop', 15.0, 1000);`,
    referenceSolution: `SELECT CASE WHEN price < 5 THEN 'budget (<$5)'
            WHEN price <= 15 THEN 'mid ($5-$15)'
            ELSE 'premium (>$15)' END AS price_band,
       COUNT(*) AS products,
       SUM(units_sold) AS total_units
FROM products
GROUP BY price_band
ORDER BY MIN(price);`,
    orderMatters: false,
    explanation: "The mid band is '$5-$15' inclusive. `price < 15` pushes a $15 item into premium. Use <= for an inclusive upper bound.",
  },
  "google-play-revenue-per-download": {
    name: "Average of ratios ≠ ratio of totals",
    hiddenSetupSql: `CREATE TABLE apps (id INTEGER, category VARCHAR, monetization_model VARCHAR, revenue DOUBLE, downloads INTEGER);
INSERT INTO apps VALUES
 (1,'Games','in-app',50000.0,100000),
 (2,'Games','paid',20000.0,10000),
 (3,'Games','ads',15000.0,200000),
 (4,'Productivity','subscription',40000.0,20000),
 (5,'Productivity','paid',10000.0,5000);
INSERT INTO apps VALUES (6, 'Games', 'in-app', 10000.0, 50000);`,
    referenceSolution: `WITH agg AS (
  SELECT category, monetization_model,
         SUM(revenue) AS total_revenue,
         ROUND(SUM(revenue) / SUM(downloads), 2) AS rev_per_download
  FROM apps
  GROUP BY category, monetization_model
)
SELECT category, monetization_model, total_revenue, rev_per_download,
       RANK() OVER (PARTITION BY category ORDER BY total_revenue DESC) AS rank
FROM agg
ORDER BY category, rank;`,
    orderMatters: false,
    explanation: "Revenue per download must divide total revenue by total downloads. AVG(revenue / downloads) averages per-app rates, over-weighting low-volume apps. Use SUM(revenue) / SUM(downloads).",
  },
  "walmart-pharmacy-privacy": {
    name: "NULL in the average",
    hiddenSetupSql: `CREATE TABLE consultations (id INTEGER, room_type VARCHAR, privacy_level VARCHAR, comfort_score INTEGER);
INSERT INTO consultations VALUES
 (1,'Private Room','high',9),
 (2,'Private Room','high',8),
 (3,'Semi-Private','medium',6),
 (4,'Semi-Private','medium',7),
 (5,'Open Counter','low',3),
 (6,'Open Counter','low',4);
INSERT INTO consultations VALUES (7, 'Private Room', 'high', NULL);`,
    referenceSolution: `SELECT room_type, ROUND(AVG(comfort_score), 2) AS avg_comfort
FROM consultations
GROUP BY room_type
ORDER BY avg_comfort DESC;`,
    orderMatters: false,
    explanation: "A consultation with no comfort score recorded (NULL) shouldn't count as zero. AVG ignores it; SUM/COUNT(*) divides by every consultation. Use AVG.",
  },
  "microsoft-windows-update": {
    name: "Unknown outcomes in the denominator",
    hiddenSetupSql: `CREATE TABLE updates (id INTEGER, user_id INTEGER, install_time_sec INTEGER, error_free BOOLEAN);
INSERT INTO updates VALUES
 (1,1,420,TRUE),
 (2,2,650,TRUE),
 (3,3,310,FALSE),
 (4,4,500,TRUE),
 (5,5,720,FALSE);
INSERT INTO updates VALUES (6, 6, 800, NULL);`,
    referenceSolution: `SELECT MIN(install_time_sec) AS fastest_sec,
       ROUND(AVG(CASE WHEN error_free THEN 1.0 ELSE 0 END), 2) AS error_free_rate
FROM updates;`,
    orderMatters: false,
    explanation: "An update whose outcome isn't recorded yet (NULL error_free) still happened. AVG(CASE …) divides by COUNT(*); COUNT(error_free) drops the unknown and overstates the error-free rate.",
  },
  "stripe-churn-by-tier": {
    name: "Unknown outcomes in the denominator",
    hiddenSetupSql: `CREATE TABLE subscriptions (id INTEGER, tier VARCHAR, churned BOOLEAN);
INSERT INTO subscriptions VALUES
 (1,'Starter',TRUE),(2,'Starter',TRUE),(3,'Starter',FALSE),
 (4,'Growth',FALSE),(5,'Growth',TRUE),(6,'Growth',FALSE),
 (7,'Enterprise',FALSE),(8,'Enterprise',FALSE);
INSERT INTO subscriptions VALUES (9, 'Starter', NULL);`,
    referenceSolution: `SELECT tier,
       ROUND(AVG(CASE WHEN churned THEN 1.0 ELSE 0 END), 2) AS churn_rate
FROM subscriptions
GROUP BY tier
ORDER BY churn_rate DESC;`,
    orderMatters: false,
    explanation: "A subscription whose churn status is undecided (NULL) is still a subscription. Dividing by COUNT(churned) drops it and distorts the churn rate. The denominator is COUNT(*).",
  },
  "uber-ride-acceptance-by-zone": {
    name: "Unknown outcomes in the denominator",
    hiddenSetupSql: `CREATE TABLE ride_requests (id INTEGER, zone VARCHAR, accepted BOOLEAN);
INSERT INTO ride_requests VALUES
 (1,'Downtown',TRUE),(2,'Downtown',TRUE),(3,'Downtown',FALSE),
 (4,'Airport',TRUE),(5,'Airport',TRUE),(6,'Airport',TRUE),
 (7,'Suburb',FALSE),(8,'Suburb',FALSE),(9,'Suburb',TRUE);
INSERT INTO ride_requests VALUES (10, 'Suburb', NULL);`,
    referenceSolution: `SELECT zone,
       ROUND(AVG(CASE WHEN accepted THEN 1.0 ELSE 0 END), 2) AS acceptance_rate
FROM ride_requests
GROUP BY zone
ORDER BY acceptance_rate ASC;`,
    orderMatters: false,
    explanation: "A request that expired without a decision (NULL accepted) is still a request. Dividing by COUNT(accepted) drops it and inflates the acceptance rate. The denominator is COUNT(*).",
  },
  "paypal-onetouch-conversion": {
    name: "Unknown outcomes in the denominator",
    hiddenSetupSql: `CREATE TABLE checkouts (id INTEGER, login_method VARCHAR, completed BOOLEAN);
INSERT INTO checkouts VALUES
 (1,'One Touch',TRUE),(2,'One Touch',TRUE),(3,'One Touch',FALSE),(4,'One Touch',TRUE),
 (5,'Password',TRUE),(6,'Password',FALSE),(7,'Password',FALSE),
 (8,'Guest',FALSE),(9,'Guest',TRUE);
INSERT INTO checkouts VALUES (10, 'Guest', NULL);`,
    referenceSolution: `SELECT login_method,
       ROUND(AVG(CASE WHEN completed THEN 1.0 ELSE 0 END), 2) AS conversion_rate
FROM checkouts
GROUP BY login_method
ORDER BY conversion_rate DESC;`,
    orderMatters: false,
    explanation: "A checkout still in progress (NULL completed) is still an attempt. Dividing by COUNT(completed) drops it and overstates the conversion rate. The denominator is COUNT(*).",
  },
  "stripe-capital-revenue-variability": {
    name: "Unknown outcomes in the denominator",
    hiddenSetupSql: `CREATE TABLE loans (id INTEGER, revenue_variability VARCHAR, repaid BOOLEAN);
INSERT INTO loans VALUES
 (1,'low',TRUE),(2,'low',TRUE),(3,'low',TRUE),(4,'low',FALSE),
 (5,'medium',TRUE),(6,'medium',FALSE),(7,'medium',TRUE),
 (8,'high',FALSE),(9,'high',FALSE),(10,'high',TRUE);
INSERT INTO loans VALUES (11, 'high', NULL);`,
    referenceSolution: `SELECT revenue_variability,
       COUNT(*) AS loans,
       ROUND(AVG(CASE WHEN repaid THEN 1.0 ELSE 0 END), 2) AS repayment_rate
FROM loans
GROUP BY revenue_variability
ORDER BY repayment_rate DESC;`,
    orderMatters: false,
    explanation: "A loan still outstanding (NULL repaid) is still a loan. Dividing by COUNT(repaid) drops it and overstates the repayment rate. The denominator is COUNT(*).",
  },
  "amazon-prime-early-access-funnel": {
    name: "Unknown outcomes in the denominator",
    hiddenSetupSql: `CREATE TABLE engagements (id INTEGER, member_id INTEGER, promo_id INTEGER, clicked BOOLEAN, purchased BOOLEAN, early_access BOOLEAN);
INSERT INTO engagements VALUES
 (1,1,10,TRUE,TRUE,TRUE),
 (2,2,10,TRUE,FALSE,TRUE),
 (3,3,11,FALSE,FALSE,TRUE),
 (4,4,12,TRUE,FALSE,FALSE),
 (5,5,12,FALSE,FALSE,FALSE),
 (6,6,13,TRUE,TRUE,FALSE);
INSERT INTO engagements VALUES (7, 7, 14, NULL, FALSE, FALSE);`,
    referenceSolution: `SELECT early_access,
       COUNT(*) AS total,
       ROUND(AVG(CASE WHEN clicked THEN 1.0 ELSE 0 END), 2) AS click_rate,
       ROUND(COUNT(*) FILTER (WHERE clicked AND purchased) * 1.0
             / COUNT(*) FILTER (WHERE clicked), 2) AS purchase_rate
FROM engagements
GROUP BY early_access
ORDER BY early_access DESC;`,
    orderMatters: false,
    explanation: "A promo impression whose click wasn't logged (NULL clicked) is still an impression. The click rate is over all impressions — COUNT(*) — so dividing by COUNT(clicked) overstates it.",
  },
  "airbnb-transparency-cancellation": {
    name: "Unknown outcomes in the denominator",
    hiddenSetupSql: `CREATE TABLE bookings (id INTEGER, transparent_pricing BOOLEAN, cancellation_policy VARCHAR, completed BOOLEAN, booking_date DATE);
INSERT INTO bookings VALUES
 (1,TRUE,'flexible',TRUE,DATE '2026-04-01'),
 (2,TRUE,'flexible',TRUE,DATE '2026-04-01'),
 (3,TRUE,'strict',FALSE,DATE '2026-04-02'),
 (4,FALSE,'flexible',FALSE,DATE '2026-04-02'),
 (5,FALSE,'strict',FALSE,DATE '2026-04-03'),
 (6,FALSE,'strict',TRUE,DATE '2026-04-03');
INSERT INTO bookings VALUES (7, TRUE, 'flexible', NULL, DATE '2026-04-04');`,
    referenceSolution: `SELECT transparent_pricing,
       cancellation_policy,
       COUNT(*) AS bookings,
       ROUND(AVG(CASE WHEN completed THEN 1.0 ELSE 0 END), 2) AS completion_rate
FROM bookings
GROUP BY transparent_pricing, cancellation_policy
ORDER BY completion_rate DESC, cancellation_policy;`,
    orderMatters: false,
    explanation: "A booking still pending (NULL completed) is still a booking. Dividing by COUNT(completed) drops it and inflates the completion rate. The denominator is COUNT(*).",
  },
  "airbnb-response-band-booking": {
    name: "Unknown outcomes in the denominator",
    hiddenSetupSql: `CREATE TABLE bookings (id INTEGER, host_id INTEGER, response_minutes INTEGER, booked BOOLEAN);
INSERT INTO bookings VALUES
 (1,1,10,TRUE),(2,1,20,TRUE),(3,2,25,TRUE),
 (4,3,60,TRUE),(5,3,90,FALSE),(6,4,100,FALSE),
 (7,5,200,FALSE),(8,5,300,FALSE);
INSERT INTO bookings VALUES (9, 1, 15, NULL);`,
    referenceSolution: `SELECT CASE WHEN response_minutes < 30 THEN 'fast (<30)'
            WHEN response_minutes <= 120 THEN 'medium (30-120)'
            ELSE 'slow (>120)' END AS response_band,
       COUNT(*) AS inquiries,
       ROUND(AVG(CASE WHEN booked THEN 1.0 ELSE 0 END), 2) AS booking_rate
FROM bookings
GROUP BY response_band
ORDER BY MIN(response_minutes);`,
    orderMatters: false,
    explanation: "An inquiry with no decision yet (NULL booked) is still an inquiry. Dividing by COUNT(booked) drops it and inflates the booking rate. The denominator is COUNT(*).",
  },
  "rolling-7d-revenue": {
    name: "Row window vs time window",
    hiddenSetupSql: `CREATE TABLE daily_revenue (day DATE, revenue INTEGER);
INSERT INTO daily_revenue VALUES
 (DATE '2026-03-01',100),(DATE '2026-03-02',120),(DATE '2026-03-03',90),
 (DATE '2026-03-05',200),(DATE '2026-03-06',170),(DATE '2026-03-07',130),
 (DATE '2026-03-08',160),(DATE '2026-03-12',300);`,
    referenceSolution: `SELECT day,
       ROUND(AVG(revenue) OVER (ORDER BY day ROWS BETWEEN 6 PRECEDING AND CURRENT ROW), 2) AS rolling_avg
FROM daily_revenue
ORDER BY day;`,
    orderMatters: false,
    explanation: "The prompt is 'today + the 6 prior rows', i.e. a ROWS frame. A RANGE … INTERVAL 6 DAY frame is a calendar window — identical while days are consecutive, but once a day is missing the two diverge. Use ROWS BETWEEN 6 PRECEDING AND CURRENT ROW.",
  },
  "mom-growth": {
    name: "Window frame needs ORDER BY",
    hiddenSetupSql: `CREATE TABLE monthly_revenue (month VARCHAR, revenue DOUBLE);
INSERT INTO monthly_revenue VALUES ('2026-03',1500),('2026-01',1000),('2026-04',1800),('2026-02',1200);`,
    referenceSolution: `WITH m AS (
  SELECT month, revenue,
         LAG(revenue) OVER (ORDER BY month) AS prev
  FROM monthly_revenue
)
SELECT month, revenue,
       ROUND((revenue - prev) * 100.0 / prev, 1) AS growth_pct
FROM m
ORDER BY month;`,
    orderMatters: false,
    explanation: "LAG without an ORDER BY pulls 'the previous row' in arbitrary storage order, not the previous month. It only looked right because the sample was stored in month order. Add ORDER BY month to the window.",
  },
  "stripe-capital-mom-growth": {
    name: "Window frame needs ORDER BY",
    hiddenSetupSql: `CREATE TABLE monthly_revenue (id INTEGER, business_id INTEGER, month VARCHAR, revenue DOUBLE);
INSERT INTO monthly_revenue VALUES
 (2,1,'2026-02',1200.0),(1,1,'2026-01',1000.0),(3,1,'2026-03',1500.0),
 (4,2,'2026-01',2000.0),(5,2,'2026-02',1800.0),(6,2,'2026-03',1980.0),
 (7,3,'2026-01',500.0),(8,3,'2026-02',1000.0);`,
    referenceSolution: `WITH growth AS (
  SELECT business_id,
         (revenue - LAG(revenue) OVER (PARTITION BY business_id ORDER BY month))
           / LAG(revenue) OVER (PARTITION BY business_id ORDER BY month) AS mom_growth
  FROM monthly_revenue
)
SELECT business_id,
       ROUND(AVG(mom_growth), 3) AS avg_mom_growth
FROM growth
WHERE mom_growth IS NOT NULL
GROUP BY business_id
ORDER BY avg_mom_growth DESC;`,
    orderMatters: false,
    explanation: "PARTITION BY business_id without ORDER BY month makes LAG read months in arbitrary order, so 'previous month' is wrong whenever a business's rows aren't stored chronologically. Add ORDER BY month inside the window.",
  },
  "x-influencer-revenue-trend": {
    name: "Window frame needs ORDER BY",
    hiddenSetupSql: `CREATE TABLE content (id INTEGER, content_type VARCHAR, week INTEGER, revenue DOUBLE, engagement INTEGER);
INSERT INTO content VALUES
 (2,'Sponsored',2,1500.0,6000),(1,'Sponsored',1,1000.0,5000),(3,'Sponsored',3,1200.0,6000),
 (4,'Organic',1,200.0,4000),(5,'Organic',2,300.0,5000);`,
    referenceSolution: `WITH rpe AS (
  SELECT content_type, week,
         revenue * 1.0 / engagement AS rev_per_eng
  FROM content
)
SELECT content_type, week,
       ROUND(rev_per_eng, 3) AS rev_per_eng,
       ROUND(rev_per_eng - LAG(rev_per_eng) OVER (PARTITION BY content_type ORDER BY week), 3) AS wow_change
FROM rpe
ORDER BY content_type, week;`,
    orderMatters: false,
    explanation: "LAG OVER (PARTITION BY content_type) with no ORDER BY week compares against an arbitrary prior row, not the previous week. Add ORDER BY week so week-over-week change is actually week-over-week.",
  },
  "apple-camera-vs-overall": {
    name: "Average of averages ≠ grand mean",
    hiddenSetupSql: `CREATE TABLE captures (id INTEGER, user_segment VARCHAR, photo_quality INTEGER, video_quality INTEGER);
INSERT INTO captures VALUES
 (1,'Pro',95,90),(2,'Pro',92,88),(3,'Casual',70,65),(4,'Casual',75,70),
 (5,'New',60,55),(6,'New',65,60),(7,'Pro',95,90),(8,'Pro',93,89);`,
    referenceSolution: `SELECT user_segment,
       ROUND(AVG(photo_quality), 2) AS avg_photo,
       ROUND(AVG(photo_quality) - AVG(AVG(photo_quality)) OVER (), 2) AS vs_overall
FROM captures
GROUP BY user_segment
ORDER BY vs_overall DESC;`,
    orderMatters: false,
    explanation: "The reference compares each segment to the mean of the per-segment averages (equal weight per segment). The row-level grand average (SELECT AVG(photo_quality) FROM captures) weights big segments more — identical only when all segments are the same size. Use AVG(AVG(photo_quality)) OVER ().",
  },
  "meta-ad-segment-efficiency": {
    name: "Defensive WHERE filter silently drops zero-conversion rows",
    hiddenSetupSql: `CREATE TABLE ad_segments (id INTEGER, segment_type VARCHAR, acquisitions INTEGER, conversions INTEGER, spend DOUBLE);
INSERT INTO ad_segments VALUES
 (1,'Custom',50,30,1000.0),
 (2,'Custom',40,20,800.0),
 (3,'Lookalike',90,40,3000.0),
 (4,'Lookalike',60,25,2000.0),
 (5,'Broad',20,5,1500.0),
 (6,'Custom',100,0,2000.0);`,
    referenceSolution: `SELECT segment_type,
       SUM(conversions) AS conversions,
       ROUND(SUM(conversions) * 1.0 / SUM(spend), 4) AS conv_per_dollar
FROM ad_segments
GROUP BY segment_type
ORDER BY conv_per_dollar DESC;`,
    orderMatters: false,
    explanation: "A candidate who distrusts data quality often adds WHERE conversions > 0 to 'guard against bad rows'. On the public sample every row has at least one conversion, so the filter is a no-op and the output is identical. On the hidden dataset a new Custom row carries 2 000 spend but 0 conversions; the naive excludes it from both SUM(conversions) and SUM(spend), inflating conv_per_dollar for Custom from 0.0132 to 0.0278 — the reference correctly dilutes the denominator.",
  },
  "netflix-emerging-market-cac": {
    name: "Defensive WHERE filter on new_subscribers skews CAC denominator",
    hiddenSetupSql: `CREATE TABLE marketing (id INTEGER, market VARCHAR, spend DOUBLE, new_subscribers INTEGER);
INSERT INTO marketing VALUES
 (1,'India',50000.0,25000),
 (2,'India',30000.0,12000),
 (3,'Brazil',40000.0,8000),
 (4,'Brazil',20000.0,5000),
 (5,'Nigeria',15000.0,10000),
 (6,'India',5000.0,0);`,
    referenceSolution: `SELECT market,
       SUM(spend) AS spend,
       SUM(new_subscribers) AS new_subscribers,
       ROUND(SUM(spend) / SUM(new_subscribers), 2) AS cac
FROM marketing
GROUP BY market
ORDER BY cac ASC;`,
    orderMatters: false,
    explanation: "A cautious candidate adds WHERE new_subscribers > 0 to avoid dividing by zero. On the public sample all rows have positive subscriber counts, so the filter changes nothing. The hidden dataset adds an India row with 5 000 spend but 0 new_subscribers; the naive drops that row entirely, computing India's CAC as 80 000/37 000 = 2.16, while the reference correctly includes the spend in the numerator, raising India's CAC to 85 000/37 000 = 2.30.",
  },
  "stripe-payout-fee-burden": {
    name: "Phantom HAVING filter silently drops low-fee platform types",
    hiddenSetupSql: `CREATE TABLE payouts (id INTEGER, platform_type VARCHAR, payout_amount DOUBLE, fee DOUBLE, compliance_cost DOUBLE);
INSERT INTO payouts VALUES
 (1,'Marketplace',10000.0,250.0,100.0),
 (2,'Marketplace',5000.0,120.0,60.0),
 (3,'SaaS',8000.0,160.0,200.0),
 (4,'SaaS',4000.0,80.0,120.0),
 (5,'On-demand',6000.0,210.0,30.0),
 (6,'Freelance',4000.0,80.0,50.0);`,
    referenceSolution: `SELECT platform_type,
       SUM(payout_amount) AS total_payout,
       ROUND(100.0 * SUM(fee) / SUM(payout_amount), 2) AS fee_pct,
       ROUND(100.0 * SUM(compliance_cost) / SUM(payout_amount), 2) AS compliance_pct
FROM payouts
GROUP BY platform_type
ORDER BY fee_pct DESC;`,
    orderMatters: false,
    explanation: "A candidate trying to focus on 'significant' platform types adds HAVING SUM(fee) > 100. On the public sample every segment (Marketplace 370, SaaS 240, On-demand 210) clears that threshold, so the output is unchanged. The hidden dataset introduces a Freelance segment with total fee of 80, which the HAVING clause silently discards; the reference correctly includes it with fee_pct = 2.00 %, changing the result set from 3 rows to 4.",
  },
  "x-advertiser-segment-funnel": {
    name: "RANK by CTR instead of CVR",
    hiddenSetupSql: `
CREATE TABLE campaigns (id INTEGER, audience_segment VARCHAR, impressions INTEGER, clicks INTEGER, conversions INTEGER);
INSERT INTO campaigns VALUES
 (1,'Tech',100000,8000,400),
 (2,'Sports',200000,3000,600),
 (3,'Finance',50000,1000,40);
`,
    referenceSolution: `WITH agg AS (
  SELECT audience_segment,
         ROUND(SUM(clicks) * 1.0 / SUM(impressions), 3) AS ctr,
         ROUND(SUM(conversions) * 1.0 / SUM(clicks), 3) AS cvr
  FROM campaigns
  GROUP BY audience_segment
)
SELECT audience_segment, ctr, cvr,
       RANK() OVER (ORDER BY cvr DESC) AS rank
FROM agg
ORDER BY rank;`,
    orderMatters: false,
    explanation: "On the public sample, CTR and CVR happen to rank the three audience segments in the same order (Finance > Tech > Sports for both metrics). A candidate who writes RANK() OVER (ORDER BY ctr DESC) instead of ORDER BY cvr DESC gets identical output. The hidden dataset reverses the relationship: Tech has the highest CTR (0.08) but only the 2nd-best CVR (0.05), while Sports has the lowest CTR (0.015) but the best CVR (0.20). The naive query ranks Tech first; the reference ranks Sports first.",
  },
  "meta-creator-followers-per-engagement": {
    name: "DENSE_RANK instead of RANK",
    hiddenSetupSql: `
CREATE TABLE posts (id INTEGER, creator_id INTEGER, content_type VARCHAR, engagement INTEGER, new_followers INTEGER);
INSERT INTO posts VALUES
 (1,1,'Live',1000,200),
 (2,2,'Reels',1000,100),
 (3,3,'Photos',2000,200),
 (4,4,'Stories',1000,50);
`,
    referenceSolution: `WITH agg AS (
  SELECT content_type,
         SUM(engagement) AS total_engagement,
         SUM(new_followers) AS total_followers,
         ROUND(SUM(new_followers) * 1.0 / SUM(engagement), 4) AS followers_per_eng
  FROM posts
  GROUP BY content_type
)
SELECT content_type, total_engagement, total_followers, followers_per_eng,
       RANK() OVER (ORDER BY followers_per_eng DESC) AS rank
FROM agg
ORDER BY rank;`,
    orderMatters: false,
    explanation: "The reference uses RANK() which skips rank numbers after ties (e.g., two rows tied at rank 2 make the next row rank 4). DENSE_RANK() never skips. On the public sample every content type has a unique followers_per_eng ratio, so RANK and DENSE_RANK produce identical integers. The hidden dataset gives Reels and Photos the same ratio (0.1000), creating a tie at rank 2. With RANK, Stories gets rank=4; with DENSE_RANK it gets rank=3. The single-column difference in the Stories row makes the result sets differ as a set.",
  },
  "uber-driver-earnings-per-hour": {
    name: "Intermediate ROUND of active_hours before division",
    hiddenSetupSql: `
CREATE TABLE trips (id INTEGER, driver_id INTEGER, start_time TIMESTAMP, end_time TIMESTAMP, earnings DOUBLE);
INSERT INTO trips VALUES
 (1,1,TIMESTAMP '2026-05-01 08:00:00',TIMESTAMP '2026-05-01 08:49:00',10.0),
 (2,2,TIMESTAMP '2026-05-01 10:00:00',TIMESTAMP '2026-05-01 11:00:00',12.22);
`,
    referenceSolution: `SELECT driver_id,
       SUM(earnings) AS total_earnings,
       ROUND(SUM(epoch(end_time) - epoch(start_time)) / 3600.0, 2) AS active_hours,
       ROUND(SUM(earnings) / (SUM(epoch(end_time) - epoch(start_time)) / 3600.0), 2) AS earnings_per_hour
FROM trips
GROUP BY driver_id
ORDER BY earnings_per_hour DESC;`,
    orderMatters: false,
    explanation: "The reference computes earnings_per_hour as ROUND(SUM(earnings) / (SUM(epoch_diff)/3600.0), 2), keeping full floating-point precision in the denominator. A naive candidate writes ROUND(SUM(earnings) / ROUND(SUM(epoch_diff)/3600.0, 2), 2), rounding active_hours to 2 decimals before using it as the divisor. On the public sample both drivers have trip durations summing to exact two-decimal-place hour values (1.25h and 1.50h), so the intermediate rounding is a no-op. In the hidden dataset driver 1 works 49 minutes = 0.81666...h, which rounds to 0.82h. The reference gives EPH = ROUND(10/0.81666, 2) = 12.24; the naive gives ROUND(10/0.82, 2) = 12.20. Driver 2 earns 12.22 over exactly 1.0h (EPH=12.22 in both). The reference ranks driver 1 first (12.24 > 12.22); the naive ranks driver 2 first (12.22 > 12.20). Both the rank order and the EPH value for driver 1 differ.",
  },
  "apple-top-supplier-per-region": {
    name: "Wrong ranking column: on_time instead of deliveries",
    hiddenSetupSql: `CREATE TABLE suppliers (id INTEGER, supplier_name VARCHAR, region VARCHAR, deliveries INTEGER, on_time INTEGER);
INSERT INTO suppliers VALUES
 (1,'Foxconn','Asia',5000,4800),
 (2,'Pegatron','Asia',3000,2900),
 (3,'TSMC','Asia',4500,4900),
 (4,'Flex','Americas',1200,1100),
 (5,'Jabil','Americas',900,850),
 (6,'Bosch','Europe',700,690),
 (7,'Celestica','Europe',500,495);`,
    referenceSolution: `WITH ranked AS (
  SELECT region, supplier_name, deliveries,
         ROW_NUMBER() OVER (PARTITION BY region ORDER BY deliveries DESC) AS rn
  FROM suppliers
)
SELECT region, supplier_name, deliveries
FROM ranked
WHERE rn = 1
ORDER BY region;`,
    orderMatters: false,
    explanation: "A candidate who notices 'deliveries' and 'on_time' are correlated in the sample data might accidentally ORDER BY on_time DESC instead of deliveries DESC inside the window function. On the public sample every supplier that leads in deliveries also leads in on_time within its region, so the naive returns the identical result set. The hidden dataset introduces a new Asia supplier (TSMC) with fewer deliveries than Foxconn (4500 vs 5000) but a higher on_time count (4900 vs 4800). The naive then promotes TSMC as Asia's top supplier while the correct answer remains Foxconn. No ties exist in either metric column across the hidden data.",
  },
  "walmart-checkout-peak-hour": {
    name: "Wrong ORDER BY column: hour number instead of avg_wait",
    hiddenSetupSql: `CREATE TABLE checkouts (id INTEGER, store_id INTEGER, hour INTEGER, wait_minutes INTEGER);
INSERT INTO checkouts VALUES
 (1,1,12,5),(2,1,12,7),(3,1,18,15),(4,1,18,17),
 (5,2,9,3),(6,2,9,4),(7,2,17,20),(8,2,17,22),
 (9,3,8,24),(10,3,8,26),(11,3,14,12),(12,3,14,14);`,
    referenceSolution: `WITH hourly AS (
  SELECT store_id, hour, AVG(wait_minutes) AS avg_wait
  FROM checkouts
  GROUP BY store_id, hour
),
ranked AS (
  SELECT store_id, hour, avg_wait,
         ROW_NUMBER() OVER (PARTITION BY store_id ORDER BY avg_wait DESC) AS rn
  FROM hourly
)
SELECT store_id, hour, ROUND(avg_wait, 1) AS avg_wait
FROM ranked
WHERE rn = 1
ORDER BY store_id;`,
    orderMatters: false,
    explanation: "A candidate might sort by the hour column descending (assuming 'later hours are busier') instead of by avg_wait descending. On the public sample, each store's peak-wait hour (18 for store 1, 17 for store 2) also happens to be the latest hour, so the naive and reference return identical rows with identical avg_wait values. The hidden dataset adds a store 3 whose highest-wait hour is the morning (hour 8, avg_wait=25.0) while the latest hour (hour 14, avg_wait=13.0) has much lower waits. The naive picks hour 14 for store 3 while the reference correctly picks hour 8. No ties exist in avg_wait per store in the hidden data.",
  },
  "netflix-mobile-top-resume-show": {
    name: "COUNT(DISTINCT user_id) instead of COUNT(*) for resume events",
    hiddenSetupSql: `CREATE TABLE resume_events (id INTEGER, user_id INTEGER, show_id INTEGER, platform VARCHAR, resumed_at DATE);
INSERT INTO resume_events VALUES
 (1,1,100,'iOS',DATE '2026-05-01'),
 (2,1,100,'iOS',DATE '2026-05-02'),
 (3,1,100,'iOS',DATE '2026-05-03'),
 (4,2,101,'iOS',DATE '2026-05-04'),
 (5,3,101,'iOS',DATE '2026-05-05'),
 (6,4,200,'Android',DATE '2026-05-01'),
 (7,5,200,'Android',DATE '2026-05-02'),
 (8,6,200,'Android',DATE '2026-05-03'),
 (9,7,201,'Android',DATE '2026-05-03');`,
    referenceSolution: `WITH counts AS (
  SELECT platform, show_id, COUNT(*) AS resume_count
  FROM resume_events
  GROUP BY platform, show_id
),
ranked AS (
  SELECT platform, show_id, resume_count,
         ROW_NUMBER() OVER (PARTITION BY platform ORDER BY resume_count DESC) AS rn
  FROM counts
)
SELECT platform, show_id, resume_count
FROM ranked
WHERE rn = 1
ORDER BY platform;`,
    orderMatters: false,
    explanation: "A candidate focused on 'which show has the most engaged users' might write COUNT(DISTINCT user_id) instead of COUNT(*). On the public sample every user appears exactly once, so both counts are identical per (platform, show_id) group and the naive returns the same winner. The hidden dataset introduces a single power-user (user 1) who resumes show 100 on iOS three separate times (three distinct resumed_at dates). Show 100 then has COUNT(*)=3 vs show 101's COUNT(*)=2, so the reference correctly selects show 100. But show 100 has only 1 distinct user while show 101 has 2, so the naive incorrectly selects show 101 with resume_count=2. No ties exist in either count metric per platform in the hidden data.",
  },
  "amazon-seller-cumulative-txns": {
    name: "COUNT(column) vs COUNT(*) in window function",
    hiddenSetupSql: `
CREATE TABLE transactions (id INTEGER, seller_id INTEGER, amount DOUBLE, fee_pct DOUBLE, txn_date DATE);
INSERT INTO transactions VALUES
 (1,1,100.0,0.10,DATE '2026-01-01'),
 (2,1,200.0,0.10,DATE '2026-01-03'),
 (3,1,NULL,0.08,DATE '2026-01-05'),
 (4,2,500.0,0.05,DATE '2026-01-02'),
 (5,2,300.0,0.05,DATE '2026-01-04');
`,
    referenceSolution: `SELECT seller_id,
       txn_date,
       ROUND(amount * fee_pct, 2) AS fee,
       COUNT(*) OVER (PARTITION BY seller_id ORDER BY txn_date
                      ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS cum_txns
FROM transactions
ORDER BY seller_id, txn_date;`,
    orderMatters: false,
    explanation: "The candidate uses COUNT(amount) OVER (...) instead of COUNT(*) OVER (...). When all amounts are non-NULL (as in the public sample), both produce identical cumulative counts. However, when a transaction has a NULL amount — a realistic edge case when a refund or pending transaction has no recorded amount — COUNT(amount) skips that row in the running tally, producing an undercount for that seller from that point onward.",
  },
  "microsoft-teams-daily-delta": {
    name: "COUNT(DISTINCT user_id) instead of COUNT(*) for daily message volume",
    hiddenSetupSql: `
CREATE TABLE messages (id INTEGER, user_id INTEGER, channel VARCHAR, sent_at DATE);
INSERT INTO messages VALUES
 (1,1,'general',DATE '2026-05-01'),
 (2,2,'general',DATE '2026-05-01'),
 (3,3,'random',DATE '2026-05-01'),
 (4,1,'general',DATE '2026-05-02'),
 (5,1,'random',DATE '2026-05-02'),
 (6,2,'general',DATE '2026-05-02'),
 (7,3,'random',DATE '2026-05-02'),
 (8,1,'general',DATE '2026-05-03'),
 (9,2,'random',DATE '2026-05-03');
`,
    referenceSolution: `WITH daily AS (
  SELECT sent_at AS day, COUNT(*) AS messages
  FROM messages
  GROUP BY sent_at
)
SELECT day,
       messages,
       messages - LAG(messages) OVER (ORDER BY day) AS delta
FROM daily
ORDER BY day;`,
    orderMatters: false,
    explanation: "The candidate counts distinct users per day instead of total messages, reasoning that the question is about 'daily activity' and conflating unique senders with message volume. When each user sends exactly one message per day (as in the public sample), COUNT(DISTINCT user_id) equals COUNT(*) and produces identical results. However, when a user sends multiple messages in a day — a common real-world pattern — the distinct-user count undercounts total messages, causing the delta values to diverge from the correct day-over-day message change.",
  },
  "amazon-prime-video-genres": {
    name: "SUM(DISTINCT) Deduplication Collapse",
    hiddenSetupSql: `CREATE TABLE content (id INTEGER, category VARCHAR, views INTEGER, watch_minutes INTEGER);
INSERT INTO content VALUES
 (1,'Drama',5000,420000),
 (2,'Drama',3000,250000),
 (3,'Comedy',8000,300000),
 (4,'Documentary',1500,90000),
 (5,'Comedy',2000,80000),
 (6,'Drama',5000,180000),
 (7,'Comedy',8000,120000);`,
    referenceSolution: `SELECT category,
       SUM(views) AS total_views,
       SUM(watch_minutes) AS total_minutes
FROM content
GROUP BY category
ORDER BY total_views DESC;`,
    orderMatters: false,
    explanation: "A candidate worried about double-counting might write SUM(DISTINCT views) and SUM(DISTINCT watch_minutes) to 'deduplicate'. On the public sample every (category, views) pair happens to be unique, so SUM(DISTINCT) == SUM. On the hidden dataset two rows per category share the same views value (e.g., two Drama rows both have views=5000), so SUM(DISTINCT) drops one, giving a lower total than SUM and producing wrong totals for Drama and Comedy.",
  },
  "meta-events-category-share": {
    name: "Premature NULL Filter Hides a Category",
    hiddenSetupSql: `CREATE TABLE event_clicks (id INTEGER, event_category VARCHAR, clicks INTEGER);
INSERT INTO event_clicks VALUES
 (1,'Music',500),(2,'Music',300),
 (3,'Sports',400),(4,'Sports',200),
 (5,'Food',100),(6,'Tech',150),
 (7,'Gaming',NULL);`,
    referenceSolution: `SELECT event_category,
       SUM(clicks) AS total_clicks,
       ROUND(100.0 * SUM(clicks) / SUM(SUM(clicks)) OVER (), 1) AS pct_of_total
FROM event_clicks
GROUP BY event_category
ORDER BY total_clicks DESC;`,
    orderMatters: false,
    explanation: "A candidate who defensively adds WHERE clicks IS NOT NULL before grouping produces identical results on the public sample (which has no NULL clicks rows). On the hidden dataset a new category 'Gaming' has a single row with clicks=NULL. The reference correctly includes it as (Gaming, NULL, NULL) in the output. The naive query silently drops the entire Gaming category, returning one fewer row and a different result set.",
  },
  "amazon-device-prime-video-share": {
    name: "LIKE '%Prime%' Over-Inclusive Service Match",
    hiddenSetupSql: `CREATE TABLE device_usage (id INTEGER, device_type VARCHAR, service VARCHAR, minutes INTEGER);
INSERT INTO device_usage VALUES
 (1,'Fire TV','Prime Video',300),
 (2,'Fire TV','Amazon Music',60),
 (3,'Echo','Amazon Music',200),
 (4,'Echo','Alexa',150),
 (5,'Kindle','Reading',400),
 (6,'Fire TV','Prime Video',240),
 (7,'Fire TV','Prime Music',100);`,
    referenceSolution: `SELECT device_type,
       SUM(minutes) AS total_min,
       SUM(minutes) FILTER (WHERE service = 'Prime Video') AS prime_min,
       ROUND(100.0 * SUM(minutes) FILTER (WHERE service = 'Prime Video') / SUM(minutes), 1) AS prime_pct
FROM device_usage
GROUP BY device_type
ORDER BY total_min DESC;`,
    orderMatters: false,
    explanation: "A candidate might use LIKE '%Prime%' instead of = 'Prime Video' thinking it is a safer or more readable match. On the public sample the only service starting with 'Prime' is 'Prime Video', so both forms return identical results. On the hidden dataset a 'Prime Music' service row is added to Fire TV (100 minutes). The naive LIKE query counts those 100 minutes as prime_min (640 instead of 540) and reports prime_pct=91.4% instead of the correct 77.1%.",
  },
  "second-highest-salary": {
    name: "Spurious row-count guard: AND cnt >= 3",
    hiddenSetupSql: `CREATE TABLE employees (id INTEGER, name VARCHAR, dept VARCHAR, salary INTEGER);
INSERT INTO employees VALUES
 (1,'Ada','Data',180000),
 (2,'Bo','Data',180000),
 (3,'Cy','Data',150000),
 (4,'Di','Data',140000),
 (5,'Ed','Platform',200000),
 (6,'Fi','Platform',170000),
 (7,'Gus','Platform',170000),
 (8,'Ha','Ops',90000),
 (9,'Ivy','Analytics',130000),
 (10,'Jay','Analytics',100000);`,
    referenceSolution: `WITH ranked AS (
  SELECT name, dept, salary,
         DENSE_RANK() OVER (PARTITION BY dept ORDER BY salary DESC) AS rk
  FROM employees
)
SELECT dept, name, salary
FROM ranked
WHERE rk = 2
ORDER BY dept, name;`,
    orderMatters: false,
    explanation: "A candidate who reasons 'you need at least 3 employees to have a second-highest salary' adds AND COUNT(*) OVER (PARTITION BY dept) >= 3 inside the DENSE_RANK CTE. On the public sample every dept that has a rank-2 row also has >=3 employees, so the extra guard is silent. On the hidden dataset the Analytics dept has exactly 2 employees (Ivy=130k, Jay=100k): the reference correctly returns Jay as the second-highest earner, but the naive query discards Analytics entirely.",
  },
  "login-streak": {
    name: "Omit SELECT DISTINCT — phantom-streak from duplicate login dates",
    hiddenSetupSql: `CREATE TABLE logins (user_id INTEGER, login_date DATE);
INSERT INTO logins VALUES
 (1, DATE '2026-02-01'),(1, DATE '2026-02-02'),(1, DATE '2026-02-03'),
 (1, DATE '2026-02-05'),(1, DATE '2026-02-06'),
 (2, DATE '2026-02-01'),(2, DATE '2026-02-01'),(2, DATE '2026-02-02'),
 (3, DATE '2026-02-10'),(3, DATE '2026-02-12'),(3, DATE '2026-02-13'),(3, DATE '2026-02-14'),
 (4, DATE '2026-02-01'),(4, DATE '2026-02-01'),(4, DATE '2026-02-03');`,
    referenceSolution: `WITH d AS (
  SELECT DISTINCT user_id, login_date FROM logins
),
grouped AS (
  SELECT user_id, login_date,
         (login_date - DATE '2000-01-01')
           - ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY login_date) AS grp
  FROM d
),
streaks AS (
  SELECT user_id, grp, COUNT(*) AS streak
  FROM grouped GROUP BY user_id, grp
)
SELECT user_id, MAX(streak) AS longest_streak
FROM streaks GROUP BY user_id ORDER BY user_id;`,
    orderMatters: false,
    explanation: "A candidate skips the SELECT DISTINCT deduplication and applies the ROW_NUMBER gaps-and-islands formula directly on the raw logins table. On the public sample user 2 has a duplicate 2026-02-01 entry; the two 02-01 rows get consecutive ROW_NUMBERs so one of them shares its grp value with the 02-02 row, accidentally yielding the correct max_streak of 2. On the hidden dataset user 4 logs in on 2026-02-01 (duplicated) and 2026-02-03 (a one-day gap). Without DISTINCT the third ROW_NUMBER shifts 02-03 into the same grp as the first 02-01 occurrence, making the naive query report a streak of 2 when the true longest streak is 1.",
  },
  "apple-mac-creative-tools": {
    name: "Defensive WHERE minutes IS NOT NULL erases a real user from the denominator",
    hiddenSetupSql: `CREATE TABLE usage (id INTEGER, user_id INTEGER, tool VARCHAR, minutes INTEGER);
INSERT INTO usage VALUES
 (1,1,'Final Cut',120),(2,1,'Final Cut',80),
 (3,2,'Final Cut',200),(4,3,'Logic',300),
 (5,4,'Logic',150),(6,5,'Motion',60),
 (7,6,'Logic',NULL);`,
    referenceSolution: `SELECT tool,
       COUNT(DISTINCT user_id) AS users,
       SUM(minutes) AS total_min,
       ROUND(SUM(minutes) * 1.0 / COUNT(DISTINCT user_id), 1) AS avg_per_user
FROM usage
GROUP BY tool
ORDER BY total_min DESC;`,
    orderMatters: false,
    explanation: "A candidate who defensively filters WHERE minutes IS NOT NULL to 'sanitize' data produces correct results when every session has a recorded duration. On the hidden dataset user 6 opened Logic but the session was never closed, leaving minutes as NULL. The reference counts user 6 in COUNT(DISTINCT user_id)=3 and SUM naturally ignores the NULL, giving Logic avg_per_user=150.0. The naive query silently drops user 6's row entirely, counts only 2 Logic users, and reports avg_per_user=225.0.",
  },
  "apple-csr-program-share": {
    name: "ROW_NUMBER breaks ties arbitrarily",
    hiddenSetupSql: `CREATE TABLE participation (id INTEGER, community VARCHAR, program VARCHAR, participants INTEGER);
INSERT INTO participation VALUES
 (1,'Austin','Coding Camp',200),
 (2,'Austin','Mentorship',100),
 (3,'Austin','Grants',50),
 (4,'Detroit','Coding Camp',120),
 (5,'Detroit','Mentorship',180);
INSERT INTO participation VALUES (6,'Portland','Trail Camp',150),(7,'Portland','River Mentor',150);`,
    referenceSolution: `SELECT community,
       program,
       participants,
       ROUND(100.0 * participants / SUM(participants) OVER (PARTITION BY community), 1) AS pct_of_community,
       RANK() OVER (PARTITION BY community ORDER BY participants DESC) AS rank
FROM participation
ORDER BY community, rank;`,
    orderMatters: false,
    explanation: "ROW_NUMBER() forces a 1,2,3 sequence, so two programs tied on participants get different ranks — an arbitrary winner. The prompt ranks by participants, so tied programs must share a rank: use RANK() (or DENSE_RANK()), not ROW_NUMBER().",
  },
};

export function getAdversarialCase(problemId: string): AdversarialCase | null {
  return ADVERSARIAL_CASES[problemId] ?? null;
}
