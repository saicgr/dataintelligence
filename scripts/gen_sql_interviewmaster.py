#!/usr/bin/env python3
"""
Generator + verifier for the Interview-Master-inspired SQL practice set.

The source list (questions/questions_interviewmaster.md) is a scraped competitor
catalog: company + title + a vague description only — no schema, no data, no
solution. This script authors a complete, self-contained, runnable SQL problem
for each entry, EXECUTES every reference solution against DuckDB to prove it
runs and returns rows, then emits lib/data/practice/sql-interviewmaster.ts.

Run:  python3 scripts/gen_sql_interviewmaster.py
"""
import json
import sys
import duckdb

PROBLEMS = []


def P(**kw):
    PROBLEMS.append(kw)


# ───────────────────────────── EASY (junior) ─────────────────────────────
# Source #1–24. First four are free; the rest require Practice Pro.

P(
    id="airbnb-top-rated-listings",
    free=True,
    level="junior",
    company="Airbnb · Stays",
    title="Top-rated listings to feature",
    difficulty="easy",
    prompt="Airbnb wants to feature listings guests **love the most**. Return every listing with an `avg_rating` of at least **4.8** and at least **50** reviews. Output `id`, `name`, `avg_rating`, highest rating first, breaking ties by `id` ascending.",
    schemaNote="listings(id, name, avg_rating, reviews_count)",
    setupSql="""CREATE TABLE listings (id INTEGER, name VARCHAR, avg_rating DOUBLE, reviews_count INTEGER);
INSERT INTO listings VALUES
 (1,'Ocean Loft',4.92,128),
 (2,'City Studio',4.81,52),
 (3,'Mountain Cabin',4.79,300),
 (4,'Garden Suite',4.95,40),
 (5,'Downtown Flat',4.50,500),
 (6,'Lake House',4.88,77);""",
    referenceSolution="""SELECT id, name, avg_rating
FROM listings
WHERE avg_rating >= 4.8 AND reviews_count >= 50
ORDER BY avg_rating DESC, id ASC;""",
    orderMatters=True,
    starter="SELECT id, name, avg_rating\nFROM listings\n",
    hints=["Filter on both conditions in the WHERE clause, then ORDER BY avg_rating DESC. The 50-review floor screens out highly-rated listings nobody has reviewed yet."],
)

P(
    id="meta-marketplace-price-by-city",
    free=True,
    level="junior",
    company="Meta · Facebook Marketplace",
    title="Average item price by city",
    difficulty="easy",
    prompt="The Marketplace PM wants to understand how items are priced across cities. Return each `city` with its **average item price** (`avg_price`) rounded to 2 decimals, most expensive city first.",
    schemaNote="marketplace_items(id, city, category, price)",
    setupSql="""CREATE TABLE marketplace_items (id INTEGER, city VARCHAR, category VARCHAR, price DOUBLE);
INSERT INTO marketplace_items VALUES
 (1,'Austin','Furniture',120.0),
 (2,'Austin','Electronics',300.0),
 (3,'Denver','Furniture',80.0),
 (4,'Denver','Electronics',220.0),
 (5,'Denver','Toys',20.0),
 (6,'Miami','Electronics',500.0);""",
    referenceSolution="""SELECT city, ROUND(AVG(price), 2) AS avg_price
FROM marketplace_items
GROUP BY city
ORDER BY avg_price DESC;""",
    orderMatters=True,
    starter="SELECT city, \nFROM marketplace_items\nGROUP BY city\n",
    hints=["GROUP BY city and apply AVG(price). Wrap it in ROUND(..., 2) so the output matches the expected 2-decimal format."],
)

P(
    id="netflix-employee-satisfaction",
    free=True,
    level="junior",
    company="Netflix · People Analytics",
    title="Average satisfaction by department & role",
    difficulty="easy",
    prompt="The HR team wants to pinpoint where to improve retention. Return the **average satisfaction score** (`avg_score`, rounded to 2 decimals) for each combination of `department` and `job_category`, ordered by `department` then `job_category`.",
    schemaNote="employees(id, department, job_category, satisfaction_score)",
    setupSql="""CREATE TABLE employees (id INTEGER, department VARCHAR, job_category VARCHAR, satisfaction_score INTEGER);
INSERT INTO employees VALUES
 (1,'Engineering','IC',8),
 (2,'Engineering','IC',6),
 (3,'Engineering','Manager',9),
 (4,'Content','IC',7),
 (5,'Content','IC',5),
 (6,'Content','Manager',4);""",
    referenceSolution="""SELECT department, job_category, ROUND(AVG(satisfaction_score), 2) AS avg_score
FROM employees
GROUP BY department, job_category
ORDER BY department, job_category;""",
    orderMatters=True,
    starter="SELECT department, job_category, \nFROM employees\nGROUP BY department, job_category\n",
    hints=["Group by both columns at once — GROUP BY department, job_category — so each department/role pair gets its own average."],
)

P(
    id="netflix-interactive-content",
    free=True,
    level="junior",
    company="Netflix · Interactive Content",
    title="Engagement by interaction type",
    difficulty="easy",
    prompt="Analyze viewer engagement with choose-your-own-adventure shows. For each `interaction_type`, return the number of **distinct viewers** (`unique_viewers`) and the **total interactions** (`total_interactions`). Order by `total_interactions` descending.",
    schemaNote="interactions(id, viewer_id, show_id, interaction_type)",
    setupSql="""CREATE TABLE interactions (id INTEGER, viewer_id INTEGER, show_id INTEGER, interaction_type VARCHAR);
INSERT INTO interactions VALUES
 (1,101,1,'choice'),
 (2,101,1,'replay'),
 (3,102,1,'choice'),
 (4,103,2,'choice'),
 (5,102,2,'replay'),
 (6,104,2,'pause'),
 (7,101,2,'choice');""",
    referenceSolution="""SELECT interaction_type,
       COUNT(DISTINCT viewer_id) AS unique_viewers,
       COUNT(*) AS total_interactions
FROM interactions
GROUP BY interaction_type
ORDER BY total_interactions DESC;""",
    orderMatters=True,
    starter="SELECT interaction_type, \nFROM interactions\nGROUP BY interaction_type\n",
    hints=["COUNT(DISTINCT viewer_id) gives unique people; COUNT(*) gives raw event volume. They differ whenever a viewer interacts more than once."],
)

P(
    id="google-photos-categorization",
    free=False,
    level="junior",
    company="Google · Photos ML",
    title="Photos categorized & users reached",
    difficulty="easy",
    prompt="Quantify engagement with automatic photo categorization. Return a single row with the **number of categorized photos** (`categorized_photos`) and the **number of distinct users** who have at least one categorized photo (`unique_users`). A photo is categorized when `categorized` is TRUE.",
    schemaNote="photo_events(id, user_id, photo_id, categorized)",
    setupSql="""CREATE TABLE photo_events (id INTEGER, user_id INTEGER, photo_id INTEGER, categorized BOOLEAN);
INSERT INTO photo_events VALUES
 (1,1,10,TRUE),
 (2,1,11,FALSE),
 (3,2,12,TRUE),
 (4,3,13,TRUE),
 (5,3,14,TRUE),
 (6,4,15,FALSE);""",
    referenceSolution="""SELECT COUNT(*) FILTER (WHERE categorized) AS categorized_photos,
       COUNT(DISTINCT user_id) FILTER (WHERE categorized) AS unique_users
FROM photo_events;""",
    orderMatters=False,
    starter="SELECT \nFROM photo_events\n",
    hints=["The FILTER (WHERE categorized) clause lets you count only the categorized rows without a subquery. Apply it to both COUNT(*) and COUNT(DISTINCT user_id)."],
)

P(
    id="google-search-quality",
    free=False,
    level="junior",
    company="Google · Search Quality",
    title="Satisfaction by click behavior",
    difficulty="easy",
    prompt="Understand how clicking a result relates to satisfaction. Group sessions by whether the user `clicked_link`, and for each group return the session count (`sessions`), average time on page (`avg_time`, rounded to 1 decimal), and the **satisfaction rate** (`satisfied_rate` = fraction of satisfied sessions, rounded to 2 decimals). Order by `clicked_link`.",
    schemaNote="search_sessions(id, user_id, clicked_link, time_on_page_sec, satisfied)",
    setupSql="""CREATE TABLE search_sessions (id INTEGER, user_id INTEGER, clicked_link BOOLEAN, time_on_page_sec INTEGER, satisfied BOOLEAN);
INSERT INTO search_sessions VALUES
 (1,1,TRUE,40,TRUE),
 (2,2,TRUE,55,TRUE),
 (3,3,TRUE,30,FALSE),
 (4,4,FALSE,8,FALSE),
 (5,5,FALSE,12,FALSE),
 (6,6,FALSE,20,TRUE);""",
    referenceSolution="""SELECT clicked_link,
       COUNT(*) AS sessions,
       ROUND(AVG(time_on_page_sec), 1) AS avg_time,
       ROUND(AVG(CASE WHEN satisfied THEN 1.0 ELSE 0 END), 2) AS satisfied_rate
FROM search_sessions
GROUP BY clicked_link
ORDER BY clicked_link;""",
    orderMatters=True,
    starter="SELECT clicked_link, \nFROM search_sessions\nGROUP BY clicked_link\n",
    hints=["A rate is just AVG of a 0/1 flag. CASE WHEN satisfied THEN 1.0 ELSE 0 END turns the boolean into a number AVG can work with."],
)

P(
    id="google-gmail-labels",
    free=False,
    level="junior",
    company="Google · Gmail UX Research",
    title="Most-used Gmail labels",
    difficulty="easy",
    prompt="Analyze how users organize mail with labels. Return each `label_name` with the total emails tagged (`total_tagged`) and the number of distinct users using it (`users`). Order by `total_tagged` descending, then `label_name`.",
    schemaNote="labels(id, user_id, label_name, emails_tagged)",
    setupSql="""CREATE TABLE labels (id INTEGER, user_id INTEGER, label_name VARCHAR, emails_tagged INTEGER);
INSERT INTO labels VALUES
 (1,1,'Work',120),
 (2,2,'Work',80),
 (3,3,'Travel',15),
 (4,1,'Receipts',45),
 (5,2,'Receipts',30),
 (6,4,'Work',60);""",
    referenceSolution="""SELECT label_name,
       SUM(emails_tagged) AS total_tagged,
       COUNT(DISTINCT user_id) AS users
FROM labels
GROUP BY label_name
ORDER BY total_tagged DESC, label_name;""",
    orderMatters=True,
    starter="SELECT label_name, \nFROM labels\nGROUP BY label_name\n",
    hints=["SUM(emails_tagged) aggregates volume across users; COUNT(DISTINCT user_id) tells you how widely the label is adopted."],
)

P(
    id="google-ads-zero-revenue",
    free=False,
    level="junior",
    company="Google · Ads Performance",
    title="Campaigns that generated no revenue",
    difficulty="easy",
    prompt="Pinpoint campaigns that spent budget but produced nothing. Return every campaign with **zero revenue**. Output `name`, `ad_type`, `spend`, ordered by `spend` descending.",
    schemaNote="campaigns(id, name, ad_type, conversions, revenue, spend)",
    setupSql="""CREATE TABLE campaigns (id INTEGER, name VARCHAR, ad_type VARCHAR, conversions INTEGER, revenue DOUBLE, spend DOUBLE);
INSERT INTO campaigns VALUES
 (1,'Spring Sale','search',120,4800.0,1000.0),
 (2,'Brand Lift','display',0,0.0,2500.0),
 (3,'Retarget','display',0,0.0,800.0),
 (4,'Holiday','video',60,3200.0,1500.0),
 (5,'Test Audience','search',0,0.0,300.0);""",
    referenceSolution="""SELECT name, ad_type, spend
FROM campaigns
WHERE revenue = 0
ORDER BY spend DESC;""",
    orderMatters=True,
    starter="SELECT name, ad_type, spend\nFROM campaigns\n",
    hints=["Filter WHERE revenue = 0, then sort by spend so the most wasteful campaigns surface first."],
)

P(
    id="amazon-brand-perception",
    free=False,
    level="junior",
    company="Amazon · Brand Strategy",
    title="Brand perception by segment",
    difficulty="easy",
    prompt="Evaluate brand consistency across Amazon's business segments. Return each `segment` with its **average brand-perception score** (`avg_perception`, rounded to 2 decimals), strongest perception first.",
    schemaNote="segments(id, segment, brand_perception_score)",
    setupSql="""CREATE TABLE segments (id INTEGER, segment VARCHAR, brand_perception_score INTEGER);
INSERT INTO segments VALUES
 (1,'Retail',82),(2,'Retail',78),
 (3,'AWS',91),(4,'AWS',88),
 (5,'Entertainment',70),(6,'Entertainment',74);""",
    referenceSolution="""SELECT segment, ROUND(AVG(brand_perception_score), 2) AS avg_perception
FROM segments
GROUP BY segment
ORDER BY avg_perception DESC;""",
    orderMatters=True,
    starter="SELECT segment, \nFROM segments\nGROUP BY segment\n",
    hints=["Standard GROUP BY segment with AVG, rounded to 2 decimals, ordered descending."],
)

P(
    id="amazon-prime-video-genres",
    free=False,
    level="junior",
    company="Amazon · Prime Video",
    title="Most-engaging genres",
    difficulty="easy",
    prompt="Identify which genres viewers engage with most to guide content acquisition. Return each `category` with total `views` (`total_views`) and total watch minutes (`total_minutes`), ordered by `total_views` descending.",
    schemaNote="content(id, category, views, watch_minutes)",
    setupSql="""CREATE TABLE content (id INTEGER, category VARCHAR, views INTEGER, watch_minutes INTEGER);
INSERT INTO content VALUES
 (1,'Drama',5000,420000),
 (2,'Drama',3000,250000),
 (3,'Comedy',8000,300000),
 (4,'Documentary',1500,90000),
 (5,'Comedy',2000,80000);""",
    referenceSolution="""SELECT category,
       SUM(views) AS total_views,
       SUM(watch_minutes) AS total_minutes
FROM content
GROUP BY category
ORDER BY total_views DESC;""",
    orderMatters=True,
    starter="SELECT category, \nFROM content\nGROUP BY category\n",
    hints=["Sum both metrics per category. Views measures reach; watch minutes measures depth of engagement."],
)

P(
    id="apple-music-new-artists",
    free=False,
    level="junior",
    company="Apple · Music Discovery",
    title="New-artist recommendation reach by genre",
    difficulty="easy",
    prompt="Evaluate the diversity of new-artist recommendations. For each `genre`, return the number of **distinct artists recommended** (`artists`) and how many recommendations were actually played (`plays`, where `was_played` is TRUE). Order by `genre`.",
    schemaNote="recommendations(id, genre, artist_id, was_played)",
    setupSql="""CREATE TABLE recommendations (id INTEGER, genre VARCHAR, artist_id INTEGER, was_played BOOLEAN);
INSERT INTO recommendations VALUES
 (1,'Indie',10,TRUE),
 (2,'Indie',11,FALSE),
 (3,'Indie',10,TRUE),
 (4,'Jazz',20,TRUE),
 (5,'Jazz',21,FALSE),
 (6,'Pop',30,FALSE);""",
    referenceSolution="""SELECT genre,
       COUNT(DISTINCT artist_id) AS artists,
       COUNT(*) FILTER (WHERE was_played) AS plays
FROM recommendations
GROUP BY genre
ORDER BY genre;""",
    orderMatters=True,
    starter="SELECT genre, \nFROM recommendations\nGROUP BY genre\n",
    hints=["COUNT(DISTINCT artist_id) measures diversity; COUNT(*) FILTER (WHERE was_played) measures whether the recommendations landed."],
)

P(
    id="meta-instagram-top-sharers",
    free=False,
    level="junior",
    company="Meta · Instagram Stories",
    title="Top 5 users by shares",
    difficulty="easy",
    prompt="Find the most engaged sharers of creative content. Return the top **5 users by total shares**. Output `user_id` and `total_shares`, highest first, breaking ties by `user_id` ascending.",
    schemaNote="posts(id, user_id, shares, likes)",
    setupSql="""CREATE TABLE posts (id INTEGER, user_id INTEGER, shares INTEGER, likes INTEGER);
INSERT INTO posts VALUES
 (1,1,40,200),(2,1,30,150),
 (3,2,90,400),(4,3,10,50),
 (5,4,25,90),(6,5,60,300),
 (7,6,5,20),(8,2,20,100);""",
    referenceSolution="""SELECT user_id, SUM(shares) AS total_shares
FROM posts
GROUP BY user_id
ORDER BY total_shares DESC, user_id ASC
LIMIT 5;""",
    orderMatters=True,
    starter="SELECT user_id, \nFROM posts\nGROUP BY user_id\n",
    hints=["Aggregate shares per user, ORDER BY the total descending, and LIMIT 5. The tie-breaker on user_id keeps the output deterministic."],
)

P(
    id="google-cloud-early-adopters",
    free=False,
    level="junior",
    company="Google · Cloud",
    title="Premium early adopters vs the rest",
    difficulty="easy",
    prompt="See how early adoption of premium tiers affects behavior. Group customers by `premium_early_adopter`, and for each group return average monthly spend (`avg_spend`, rounded to 2 decimals) and average months active (`avg_months`, rounded to 1 decimal). Order by `premium_early_adopter`.",
    schemaNote="customers(id, premium_early_adopter, monthly_spend, months_active)",
    setupSql="""CREATE TABLE customers (id INTEGER, premium_early_adopter BOOLEAN, monthly_spend DOUBLE, months_active INTEGER);
INSERT INTO customers VALUES
 (1,TRUE,5000.0,30),
 (2,TRUE,4200.0,26),
 (3,FALSE,1500.0,10),
 (4,FALSE,1800.0,8),
 (5,TRUE,6100.0,34),
 (6,FALSE,900.0,5);""",
    referenceSolution="""SELECT premium_early_adopter,
       ROUND(AVG(monthly_spend), 2) AS avg_spend,
       ROUND(AVG(months_active), 1) AS avg_months
FROM customers
GROUP BY premium_early_adopter
ORDER BY premium_early_adopter;""",
    orderMatters=True,
    starter="SELECT premium_early_adopter, \nFROM customers\nGROUP BY premium_early_adopter\n",
    hints=["Grouping on a boolean produces two rows. Compare the spend and tenure between adopters and non-adopters."],
)

P(
    id="microsoft-windows-update",
    free=False,
    level="junior",
    company="Microsoft · Windows Update",
    title="Fastest install & error-free rate",
    difficulty="easy",
    prompt="Summarize update reliability. Return a single row with the **fastest installation time** (`fastest_sec`) and the **error-free rate** (`error_free_rate` = fraction of installs that were error-free, rounded to 2 decimals).",
    schemaNote="updates(id, user_id, install_time_sec, error_free)",
    setupSql="""CREATE TABLE updates (id INTEGER, user_id INTEGER, install_time_sec INTEGER, error_free BOOLEAN);
INSERT INTO updates VALUES
 (1,1,420,TRUE),
 (2,2,650,TRUE),
 (3,3,310,FALSE),
 (4,4,500,TRUE),
 (5,5,720,FALSE);""",
    referenceSolution="""SELECT MIN(install_time_sec) AS fastest_sec,
       ROUND(AVG(CASE WHEN error_free THEN 1.0 ELSE 0 END), 2) AS error_free_rate
FROM updates;""",
    orderMatters=False,
    starter="SELECT \nFROM updates\n",
    hints=["MIN gives the fastest install; the error-free rate is AVG of a 0/1 flag built from the boolean."],
)

P(
    id="airbnb-host-response-time",
    free=False,
    level="junior",
    company="Airbnb · Stays",
    title="Fastest-responding hosts",
    difficulty="easy",
    prompt="Understand how quickly hosts reply to inquiries. Return each `host_id` with their **average response time** in minutes (`avg_response`, rounded to 1 decimal), fastest hosts first, breaking ties by `host_id`.",
    schemaNote="messages(id, host_id, response_minutes)",
    setupSql="""CREATE TABLE messages (id INTEGER, host_id INTEGER, response_minutes INTEGER);
INSERT INTO messages VALUES
 (1,1,15),(2,1,25),
 (3,2,5),(4,2,7),
 (5,3,120),(6,3,90),
 (7,4,40);""",
    referenceSolution="""SELECT host_id, ROUND(AVG(response_minutes), 1) AS avg_response
FROM messages
GROUP BY host_id
ORDER BY avg_response ASC, host_id ASC;""",
    orderMatters=True,
    starter="SELECT host_id, \nFROM messages\nGROUP BY host_id\n",
    hints=["AVG(response_minutes) per host, ordered ascending so the most responsive hosts appear first."],
)

P(
    id="stripe-churn-by-tier",
    free=False,
    level="junior",
    company="Stripe · Billing",
    title="Churn rate by subscription tier",
    difficulty="easy",
    prompt="Find which tiers lose the most customers. Return each `tier` with its **churn rate** (`churn_rate` = fraction of subscriptions where `churned` is TRUE, rounded to 2 decimals), highest churn first.",
    schemaNote="subscriptions(id, tier, churned)",
    setupSql="""CREATE TABLE subscriptions (id INTEGER, tier VARCHAR, churned BOOLEAN);
INSERT INTO subscriptions VALUES
 (1,'Starter',TRUE),(2,'Starter',TRUE),(3,'Starter',FALSE),
 (4,'Growth',FALSE),(5,'Growth',TRUE),(6,'Growth',FALSE),
 (7,'Enterprise',FALSE),(8,'Enterprise',FALSE);""",
    referenceSolution="""SELECT tier,
       ROUND(AVG(CASE WHEN churned THEN 1.0 ELSE 0 END), 2) AS churn_rate
FROM subscriptions
GROUP BY tier
ORDER BY churn_rate DESC;""",
    orderMatters=True,
    starter="SELECT tier, \nFROM subscriptions\nGROUP BY tier\n",
    hints=["Churn rate is the average of a 0/1 churned flag. Order descending to spotlight the tiers bleeding customers."],
)

P(
    id="walmart-photo-gifts",
    free=False,
    level="junior",
    company="Walmart · Photo Center",
    title="Most-popular personalized gifts",
    difficulty="easy",
    prompt="Find the best-selling personalized photo gifts. Return the top **5 products by orders**. Output `product_name` and `orders_count`, most-ordered first, breaking ties by `product_name`.",
    schemaNote="products(id, product_name, orders_count, avg_satisfaction)",
    setupSql="""CREATE TABLE products (id INTEGER, product_name VARCHAR, orders_count INTEGER, avg_satisfaction DOUBLE);
INSERT INTO products VALUES
 (1,'Photo Mug',1200,4.5),
 (2,'Canvas Print',900,4.8),
 (3,'Calendar',1500,4.2),
 (4,'Phone Case',600,4.0),
 (5,'Photo Book',2000,4.7),
 (6,'Magnet Set',300,3.9);""",
    referenceSolution="""SELECT product_name, orders_count
FROM products
ORDER BY orders_count DESC, product_name ASC
LIMIT 5;""",
    orderMatters=True,
    starter="SELECT product_name, orders_count\nFROM products\n",
    hints=["No aggregation needed — just ORDER BY orders_count DESC and LIMIT 5."],
)

P(
    id="walmart-pharmacy-privacy",
    free=False,
    level="junior",
    company="Walmart · Pharmacy",
    title="Comfort by consultation room type",
    difficulty="easy",
    prompt="See how room type affects patient comfort. Return each `room_type` with its **average comfort score** (`avg_comfort`, rounded to 2 decimals), most comfortable first.",
    schemaNote="consultations(id, room_type, privacy_level, comfort_score)",
    setupSql="""CREATE TABLE consultations (id INTEGER, room_type VARCHAR, privacy_level VARCHAR, comfort_score INTEGER);
INSERT INTO consultations VALUES
 (1,'Private Room','high',9),
 (2,'Private Room','high',8),
 (3,'Semi-Private','medium',6),
 (4,'Semi-Private','medium',7),
 (5,'Open Counter','low',3),
 (6,'Open Counter','low',4);""",
    referenceSolution="""SELECT room_type, ROUND(AVG(comfort_score), 2) AS avg_comfort
FROM consultations
GROUP BY room_type
ORDER BY avg_comfort DESC;""",
    orderMatters=True,
    starter="SELECT room_type, \nFROM consultations\nGROUP BY room_type\n",
    hints=["GROUP BY room_type, average the comfort score, order descending."],
)

P(
    id="linkedin-messaging-volume",
    free=False,
    level="junior",
    company="LinkedIn · Messaging",
    title="Most-active message senders",
    difficulty="easy",
    prompt="Identify the most engaged senders. Return each `sender_id` with the number of messages they sent (`messages`), most active first, breaking ties by `sender_id` ascending.",
    schemaNote="messages(id, sender_id, recipient_id, sent_at)",
    setupSql="""CREATE TABLE messages (id INTEGER, sender_id INTEGER, recipient_id INTEGER, sent_at DATE);
INSERT INTO messages VALUES
 (1,1,5,DATE '2026-05-01'),
 (2,1,6,DATE '2026-05-01'),
 (3,2,5,DATE '2026-05-02'),
 (4,1,7,DATE '2026-05-03'),
 (5,3,1,DATE '2026-05-03'),
 (6,2,4,DATE '2026-05-04');""",
    referenceSolution="""SELECT sender_id, COUNT(*) AS messages
FROM messages
GROUP BY sender_id
ORDER BY messages DESC, sender_id ASC;""",
    orderMatters=True,
    starter="SELECT sender_id, \nFROM messages\nGROUP BY sender_id\n",
    hints=["COUNT(*) per sender_id, ordered descending."],
)

P(
    id="openai-gpt4-context-depth",
    free=False,
    level="junior",
    company="OpenAI · GPT-4",
    title="Average & peak context retention by domain",
    difficulty="easy",
    prompt="Measure GPT-4's context retention per knowledge domain. Return each `domain` with the **average** (`avg_tokens`, rounded to 0 decimals) and **peak** (`peak_tokens`) context tokens retained. Order by `domain`.",
    schemaNote="responses(id, domain, context_tokens_retained)",
    setupSql="""CREATE TABLE responses (id INTEGER, domain VARCHAR, context_tokens_retained INTEGER);
INSERT INTO responses VALUES
 (1,'Legal',4000),(2,'Legal',6000),
 (3,'Medical',5500),(4,'Medical',7000),
 (5,'Code',8000),(6,'Code',9000);""",
    referenceSolution="""SELECT domain,
       ROUND(AVG(context_tokens_retained), 0) AS avg_tokens,
       MAX(context_tokens_retained) AS peak_tokens
FROM responses
GROUP BY domain
ORDER BY domain;""",
    orderMatters=True,
    starter="SELECT domain, \nFROM responses\nGROUP BY domain\n",
    hints=["AVG and MAX in the same GROUP BY give you the typical and best-case behavior side by side."],
)

P(
    id="uber-ride-acceptance-by-zone",
    free=False,
    level="junior",
    company="Uber · Rides",
    title="Lowest ride-acceptance zones",
    difficulty="easy",
    prompt="Find zones where drivers are least likely to accept requests. Return each `zone` with its **acceptance rate** (`acceptance_rate` = fraction of requests where `accepted` is TRUE, rounded to 2 decimals), lowest acceptance first.",
    schemaNote="ride_requests(id, zone, accepted)",
    setupSql="""CREATE TABLE ride_requests (id INTEGER, zone VARCHAR, accepted BOOLEAN);
INSERT INTO ride_requests VALUES
 (1,'Downtown',TRUE),(2,'Downtown',TRUE),(3,'Downtown',FALSE),
 (4,'Airport',TRUE),(5,'Airport',TRUE),(6,'Airport',TRUE),
 (7,'Suburb',FALSE),(8,'Suburb',FALSE),(9,'Suburb',TRUE);""",
    referenceSolution="""SELECT zone,
       ROUND(AVG(CASE WHEN accepted THEN 1.0 ELSE 0 END), 2) AS acceptance_rate
FROM ride_requests
GROUP BY zone
ORDER BY acceptance_rate ASC;""",
    orderMatters=True,
    starter="SELECT zone, \nFROM ride_requests\nGROUP BY zone\n",
    hints=["Acceptance rate is AVG of a 0/1 accepted flag. Order ascending so problem zones rise to the top."],
)

P(
    id="ubereats-partner-delay",
    free=False,
    level="junior",
    company="Uber Eats · Delivery",
    title="Delivery partner delay vs. estimate",
    difficulty="easy",
    prompt="See how accurately partners hit their estimated times. Return each `partner_id` with the **average delay** (`avg_delay` = actual minus expected minutes, rounded to 1 decimal), worst (largest) delay first.",
    schemaNote="deliveries(id, partner_id, expected_min, actual_min)",
    setupSql="""CREATE TABLE deliveries (id INTEGER, partner_id INTEGER, expected_min INTEGER, actual_min INTEGER);
INSERT INTO deliveries VALUES
 (1,1,30,28),(2,1,25,40),
 (3,2,20,20),(4,2,35,33),
 (5,3,15,45),(6,3,20,50);""",
    referenceSolution="""SELECT partner_id,
       ROUND(AVG(actual_min - expected_min), 1) AS avg_delay
FROM deliveries
GROUP BY partner_id
ORDER BY avg_delay DESC;""",
    orderMatters=True,
    starter="SELECT partner_id, \nFROM deliveries\nGROUP BY partner_id\n",
    hints=["Compute the per-row difference actual_min - expected_min, then AVG it per partner. A negative average means the partner beats their estimate."],
)

P(
    id="paypal-onetouch-conversion",
    free=False,
    level="junior",
    company="PayPal · One Touch",
    title="Checkout conversion by login method",
    difficulty="easy",
    prompt="Compare how login methods affect checkout completion. Return each `login_method` with its **conversion rate** (`conversion_rate` = fraction of checkouts where `completed` is TRUE, rounded to 2 decimals), best-converting method first.",
    schemaNote="checkouts(id, login_method, completed)",
    setupSql="""CREATE TABLE checkouts (id INTEGER, login_method VARCHAR, completed BOOLEAN);
INSERT INTO checkouts VALUES
 (1,'One Touch',TRUE),(2,'One Touch',TRUE),(3,'One Touch',FALSE),(4,'One Touch',TRUE),
 (5,'Password',TRUE),(6,'Password',FALSE),(7,'Password',FALSE),
 (8,'Guest',FALSE),(9,'Guest',TRUE);""",
    referenceSolution="""SELECT login_method,
       ROUND(AVG(CASE WHEN completed THEN 1.0 ELSE 0 END), 2) AS conversion_rate
FROM checkouts
GROUP BY login_method
ORDER BY conversion_rate DESC;""",
    orderMatters=True,
    starter="SELECT login_method, \nFROM checkouts\nGROUP BY login_method\n",
    hints=["Conversion rate is AVG of the completed flag, ordered descending."],
)

P(
    id="ea-game-library-health",
    free=False,
    level="junior",
    company="Electronic Arts · EA Desktop",
    title="Installed vs. actively-played games per user",
    difficulty="easy",
    prompt="Understand library engagement. For each `user_id`, return how many games they have **installed** (`installed_games`, where `installed` is TRUE) and how many they **actively play** (`active_games`, installed AND `hours_played` > 0). Order by `user_id`.",
    schemaNote="library(id, user_id, game_id, installed, hours_played)",
    setupSql="""CREATE TABLE library (id INTEGER, user_id INTEGER, game_id INTEGER, installed BOOLEAN, hours_played DOUBLE);
INSERT INTO library VALUES
 (1,1,10,TRUE,12.0),
 (2,1,11,TRUE,0.0),
 (3,1,12,FALSE,0.0),
 (4,2,10,TRUE,40.0),
 (5,2,13,TRUE,3.5),
 (6,3,14,FALSE,0.0);""",
    referenceSolution="""SELECT user_id,
       COUNT(*) FILTER (WHERE installed) AS installed_games,
       COUNT(*) FILTER (WHERE installed AND hours_played > 0) AS active_games
FROM library
GROUP BY user_id
ORDER BY user_id;""",
    orderMatters=True,
    starter="SELECT user_id, \nFROM library\nGROUP BY user_id\n",
    hints=["Two FILTERed counts: one on installed alone, one on installed AND hours_played > 0. The gap between them is shelf-ware."],
)


# ───────────────────────────── MEDIUM (mid) ──────────────────────────────
# Source #25–54. All Practice-Pro gated.

P(
    id="meta-ar-filter-engagement",
    free=False,
    level="mid",
    company="Meta · Marketing Analytics",
    title="Top AR filters by total engagement",
    difficulty="medium",
    prompt="Find which branded AR filters drive the most engagement. For each `filter_name`, return total `interactions`, total `shares`, and their sum as `total_engagement`. Order by `total_engagement` descending, then `filter_name`.",
    schemaNote="ar_filters(id, filter_name, interactions, shares)",
    setupSql="""CREATE TABLE ar_filters (id INTEGER, filter_name VARCHAR, interactions INTEGER, shares INTEGER);
INSERT INTO ar_filters VALUES
 (1,'Sparkle',1200,300),
 (2,'Sparkle',800,150),
 (3,'Retro',500,600),
 (4,'Neon',2000,100),
 (5,'Retro',400,500);""",
    referenceSolution="""SELECT filter_name,
       SUM(interactions) AS interactions,
       SUM(shares) AS shares,
       SUM(interactions) + SUM(shares) AS total_engagement
FROM ar_filters
GROUP BY filter_name
ORDER BY total_engagement DESC, filter_name;""",
    orderMatters=True,
    starter="SELECT filter_name, \nFROM ar_filters\nGROUP BY filter_name\n",
    hints=["Sum interactions and shares separately, then add the two sums for a combined engagement score. You can reference SUM(...) + SUM(...) directly in the SELECT and ORDER BY."],
)

P(
    id="meta-ad-segment-efficiency",
    free=False,
    level="mid",
    company="Meta · Marketing Performance",
    title="Conversions per dollar by segment type",
    difficulty="medium",
    prompt="Compare custom audiences against lookalikes. For each `segment_type`, return total `conversions` and **conversions per dollar of spend** (`conv_per_dollar` = total conversions / total spend, rounded to 4 decimals), most efficient first.",
    schemaNote="ad_segments(id, segment_type, acquisitions, conversions, spend)",
    setupSql="""CREATE TABLE ad_segments (id INTEGER, segment_type VARCHAR, acquisitions INTEGER, conversions INTEGER, spend DOUBLE);
INSERT INTO ad_segments VALUES
 (1,'Custom',50,30,1000.0),
 (2,'Custom',40,20,800.0),
 (3,'Lookalike',90,40,3000.0),
 (4,'Lookalike',60,25,2000.0),
 (5,'Broad',20,5,1500.0);""",
    referenceSolution="""SELECT segment_type,
       SUM(conversions) AS conversions,
       ROUND(SUM(conversions) * 1.0 / SUM(spend), 4) AS conv_per_dollar
FROM ad_segments
GROUP BY segment_type
ORDER BY conv_per_dollar DESC;""",
    orderMatters=True,
    starter="SELECT segment_type, \nFROM ad_segments\nGROUP BY segment_type\n",
    hints=["Aggregate conversions and spend first, then divide the totals (SUM/SUM), not the per-row ratios. Multiply by 1.0 to stay in floating point."],
)

P(
    id="apple-top-supplier-per-region",
    free=False,
    level="mid",
    company="Apple · Supply Chain",
    title="Top supplier in each region",
    difficulty="medium",
    prompt="Identify which supplier dominates each manufacturing region by delivery volume. Return the **single supplier with the most deliveries per region**. Output `region`, `supplier_name`, `deliveries`, ordered by `region`. Assume no ties.",
    schemaNote="suppliers(id, supplier_name, region, deliveries, on_time)",
    setupSql="""CREATE TABLE suppliers (id INTEGER, supplier_name VARCHAR, region VARCHAR, deliveries INTEGER, on_time INTEGER);
INSERT INTO suppliers VALUES
 (1,'Foxconn','Asia',5000,4800),
 (2,'Pegatron','Asia',3000,2900),
 (3,'Flex','Americas',1200,1100),
 (4,'Jabil','Americas',900,850),
 (5,'Bosch','Europe',700,690);""",
    referenceSolution="""WITH ranked AS (
  SELECT region, supplier_name, deliveries,
         ROW_NUMBER() OVER (PARTITION BY region ORDER BY deliveries DESC) AS rn
  FROM suppliers
)
SELECT region, supplier_name, deliveries
FROM ranked
WHERE rn = 1
ORDER BY region;""",
    orderMatters=True,
    starter="WITH ranked AS (\n  SELECT region, supplier_name, deliveries,\n         /* rank within each region */\n  FROM suppliers\n)\nSELECT region, supplier_name, deliveries\nFROM ranked\n",
    hints=["ROW_NUMBER() OVER (PARTITION BY region ORDER BY deliveries DESC) numbers each region's suppliers; keep rn = 1 to get the leader per region."],
)

P(
    id="apple-recommended-track-adds",
    free=False,
    level="mid",
    company="Apple · Music Personalization",
    title="Adoption of recommended tracks",
    difficulty="medium",
    prompt="Measure how many users add recommended tracks. Return a single row with the total distinct users (`total_users`), the distinct users who added at least one **recommended** track (`adopters`, where `source = 'recommended'`), and the **adoption rate** (`adoption_rate`, rounded to 2 decimals).",
    schemaNote="playlist_actions(id, user_id, track_id, source)",
    setupSql="""CREATE TABLE playlist_actions (id INTEGER, user_id INTEGER, track_id INTEGER, source VARCHAR);
INSERT INTO playlist_actions VALUES
 (1,1,100,'recommended'),
 (2,1,101,'manual'),
 (3,2,102,'manual'),
 (4,3,103,'recommended'),
 (5,4,104,'manual'),
 (6,5,105,'recommended');""",
    referenceSolution="""SELECT COUNT(DISTINCT user_id) AS total_users,
       COUNT(DISTINCT user_id) FILTER (WHERE source = 'recommended') AS adopters,
       ROUND(COUNT(DISTINCT user_id) FILTER (WHERE source = 'recommended') * 1.0
             / COUNT(DISTINCT user_id), 2) AS adoption_rate
FROM playlist_actions;""",
    orderMatters=False,
    starter="SELECT \nFROM playlist_actions\n",
    hints=["COUNT(DISTINCT user_id) FILTER (WHERE source = 'recommended') counts adopters; divide by the overall distinct-user count for the rate."],
)

P(
    id="amazon-playlist-size-vs-listen",
    free=False,
    level="mid",
    company="Amazon · Music",
    title="Listening time by playlist size",
    difficulty="medium",
    prompt="See how playlist length correlates with listening time. Bucket playlists by `track_count` into `'small (<20)'`, `'medium (20-50)'`, and `'large (>50)'`, and return each `size_bucket` with the average listen minutes (`avg_listen`, rounded to 1 decimal). Order from smallest bucket to largest.",
    schemaNote="playlists(id, user_id, track_count, listen_minutes)",
    setupSql="""CREATE TABLE playlists (id INTEGER, user_id INTEGER, track_count INTEGER, listen_minutes INTEGER);
INSERT INTO playlists VALUES
 (1,1,10,40),(2,2,15,55),
 (3,3,25,120),(4,4,40,160),
 (5,5,60,300),(6,6,80,350);""",
    referenceSolution="""SELECT CASE WHEN track_count < 20 THEN 'small (<20)'
            WHEN track_count <= 50 THEN 'medium (20-50)'
            ELSE 'large (>50)' END AS size_bucket,
       ROUND(AVG(listen_minutes), 1) AS avg_listen
FROM playlists
GROUP BY size_bucket
ORDER BY MIN(track_count);""",
    orderMatters=True,
    starter="SELECT CASE WHEN track_count < 20 THEN 'small (<20)'\n            /* more buckets */\n       END AS size_bucket,\nFROM playlists\nGROUP BY size_bucket\n",
    hints=["Build the bucket label with CASE, GROUP BY that label, and ORDER BY MIN(track_count) so the buckets come out in size order rather than alphabetically."],
)

P(
    id="apple-artist-rec-actions",
    free=False,
    level="mid",
    company="Apple · Music Personalization",
    title="Artist recommendation actions",
    difficulty="medium",
    prompt="Analyze how users react to recommended artists. For each `action`, return the number of events (`events`) and the number of distinct users (`users`). Order by `events` descending, then `action`.",
    schemaNote="rec_interactions(id, user_id, artist_id, action)",
    setupSql="""CREATE TABLE rec_interactions (id INTEGER, user_id INTEGER, artist_id INTEGER, action VARCHAR);
INSERT INTO rec_interactions VALUES
 (1,1,10,'view'),(2,1,11,'follow'),
 (3,2,10,'view'),(4,2,12,'skip'),
 (5,3,13,'view'),(6,3,13,'follow'),
 (7,4,14,'skip');""",
    referenceSolution="""SELECT action,
       COUNT(*) AS events,
       COUNT(DISTINCT user_id) AS users
FROM rec_interactions
GROUP BY action
ORDER BY events DESC, action;""",
    orderMatters=True,
    starter="SELECT action, \nFROM rec_interactions\nGROUP BY action\n",
    hints=["COUNT(*) is total events; COUNT(DISTINCT user_id) is reach. The 'follow' rate vs 'skip' rate tells you whether recommendations resonate."],
)

P(
    id="netflix-emerging-market-cac",
    free=False,
    level="mid",
    company="Netflix · Marketing Data",
    title="Customer acquisition cost by market",
    difficulty="medium",
    prompt="Assess marketing efficiency in emerging markets. For each `market`, return total `spend`, total `new_subscribers`, and the **cost per acquisition** (`cac` = total spend / total new subscribers, rounded to 2 decimals), cheapest CAC first.",
    schemaNote="marketing(id, market, spend, new_subscribers)",
    setupSql="""CREATE TABLE marketing (id INTEGER, market VARCHAR, spend DOUBLE, new_subscribers INTEGER);
INSERT INTO marketing VALUES
 (1,'India',50000.0,25000),
 (2,'India',30000.0,12000),
 (3,'Brazil',40000.0,8000),
 (4,'Brazil',20000.0,5000),
 (5,'Nigeria',15000.0,10000);""",
    referenceSolution="""SELECT market,
       SUM(spend) AS spend,
       SUM(new_subscribers) AS new_subscribers,
       ROUND(SUM(spend) / SUM(new_subscribers), 2) AS cac
FROM marketing
GROUP BY market
ORDER BY cac ASC;""",
    orderMatters=True,
    starter="SELECT market, \nFROM marketing\nGROUP BY market\n",
    hints=["CAC divides total spend by total subscribers — aggregate both first, then divide. Lowest CAC is the most efficient market."],
)

P(
    id="netflix-recommendation-watchtime",
    free=False,
    level="mid",
    company="Netflix · Content Discovery",
    title="Watch time: recommended vs not",
    difficulty="medium",
    prompt="Evaluate whether recommendations lift engagement. Group sessions by `from_recommendation`, and for each group return the session count (`sessions`), total watch minutes (`total_minutes`), and average watch minutes (`avg_minutes`, rounded to 1 decimal). Order by `from_recommendation` descending.",
    schemaNote="sessions(id, user_id, from_recommendation, watch_minutes)",
    setupSql="""CREATE TABLE sessions (id INTEGER, user_id INTEGER, from_recommendation BOOLEAN, watch_minutes INTEGER);
INSERT INTO sessions VALUES
 (1,1,TRUE,90),(2,2,TRUE,120),(3,3,TRUE,45),
 (4,4,FALSE,30),(5,5,FALSE,20),(6,6,FALSE,60);""",
    referenceSolution="""SELECT from_recommendation,
       COUNT(*) AS sessions,
       SUM(watch_minutes) AS total_minutes,
       ROUND(AVG(watch_minutes), 1) AS avg_minutes
FROM sessions
GROUP BY from_recommendation
ORDER BY from_recommendation DESC;""",
    orderMatters=True,
    starter="SELECT from_recommendation, \nFROM sessions\nGROUP BY from_recommendation\n",
    hints=["Group on the boolean and compare totals and averages between recommended and non-recommended sessions."],
)

P(
    id="google-play-download-conversion",
    free=False,
    level="mid",
    company="Google · Play Store",
    title="Browse-to-download conversion by category",
    difficulty="medium",
    prompt="See which app categories convert browses into downloads. For each `category`, return total views (`views`), total downloads (`downloads`, where `downloaded` is TRUE), and the **conversion rate** (`conv_rate` = downloads / views, rounded to 2 decimals), best-converting first.",
    schemaNote="app_views(id, app_id, category, downloaded)",
    setupSql="""CREATE TABLE app_views (id INTEGER, app_id INTEGER, category VARCHAR, downloaded BOOLEAN);
INSERT INTO app_views VALUES
 (1,1,'Games',TRUE),(2,1,'Games',FALSE),(3,2,'Games',TRUE),
 (4,3,'Finance',TRUE),(5,3,'Finance',FALSE),(6,3,'Finance',FALSE),
 (7,4,'Health',TRUE),(8,4,'Health',TRUE);""",
    referenceSolution="""SELECT category,
       COUNT(*) AS views,
       COUNT(*) FILTER (WHERE downloaded) AS downloads,
       ROUND(COUNT(*) FILTER (WHERE downloaded) * 1.0 / COUNT(*), 2) AS conv_rate
FROM app_views
GROUP BY category
ORDER BY conv_rate DESC;""",
    orderMatters=True,
    starter="SELECT category, \nFROM app_views\nGROUP BY category\n",
    hints=["Each row is one browse; COUNT(*) FILTER (WHERE downloaded) counts the ones that converted. Divide for the rate."],
)

P(
    id="meta-events-category-share",
    free=False,
    level="mid",
    company="Meta · Events Discovery",
    title="Event category share of clicks",
    difficulty="medium",
    prompt="Find which event categories draw the most clicks and their share of the total. For each `event_category`, return total `clicks` (`total_clicks`) and its **percentage of all clicks** (`pct_of_total`, rounded to 1 decimal). Order by `total_clicks` descending.",
    schemaNote="event_clicks(id, event_category, clicks)",
    setupSql="""CREATE TABLE event_clicks (id INTEGER, event_category VARCHAR, clicks INTEGER);
INSERT INTO event_clicks VALUES
 (1,'Music',500),(2,'Music',300),
 (3,'Sports',400),(4,'Sports',200),
 (5,'Food',100),(6,'Tech',150);""",
    referenceSolution="""SELECT event_category,
       SUM(clicks) AS total_clicks,
       ROUND(100.0 * SUM(clicks) / SUM(SUM(clicks)) OVER (), 1) AS pct_of_total
FROM event_clicks
GROUP BY event_category
ORDER BY total_clicks DESC;""",
    orderMatters=True,
    starter="SELECT event_category, \nFROM event_clicks\nGROUP BY event_category\n",
    hints=["SUM(SUM(clicks)) OVER () computes the grand total alongside each group's total — a window over an aggregate. Divide group total by grand total for the share."],
)

P(
    id="amazon-device-prime-video-share",
    free=False,
    level="mid",
    company="Amazon · Devices",
    title="Prime Video's share of device usage",
    difficulty="medium",
    prompt="Quantify how much Prime Video drives engagement per device type. For each `device_type`, return total minutes (`total_min`), Prime Video minutes (`prime_min`, where `service = 'Prime Video'`), and Prime Video's **share** (`prime_pct`, rounded to 1 decimal). Order by `total_min` descending.",
    schemaNote="device_usage(id, device_type, service, minutes)",
    setupSql="""CREATE TABLE device_usage (id INTEGER, device_type VARCHAR, service VARCHAR, minutes INTEGER);
INSERT INTO device_usage VALUES
 (1,'Fire TV','Prime Video',300),
 (2,'Fire TV','Amazon Music',60),
 (3,'Echo','Amazon Music',200),
 (4,'Echo','Alexa',150),
 (5,'Kindle','Reading',400),
 (6,'Fire TV','Prime Video',240);""",
    referenceSolution="""SELECT device_type,
       SUM(minutes) AS total_min,
       SUM(minutes) FILTER (WHERE service = 'Prime Video') AS prime_min,
       ROUND(100.0 * SUM(minutes) FILTER (WHERE service = 'Prime Video') / SUM(minutes), 1) AS prime_pct
FROM device_usage
GROUP BY device_type
ORDER BY total_min DESC;""",
    orderMatters=True,
    starter="SELECT device_type, \nFROM device_usage\nGROUP BY device_type\n",
    hints=["SUM(minutes) FILTER (WHERE service = 'Prime Video') isolates Prime Video minutes within each device's total. Then take the ratio."],
)

P(
    id="amazon-fresh-reorders",
    free=False,
    level="mid",
    company="Amazon · Fresh",
    title="Most-reordered grocery categories",
    difficulty="medium",
    prompt="Find which categories customers reorder most. For each `category`, return the number of reorders (`reorders`, where `is_reorder` is TRUE) and the **reorder rate** (`reorder_rate` = reorders / total orders, rounded to 2 decimals). Order by `reorders` descending.",
    schemaNote="orders(id, user_id, category, is_reorder)",
    setupSql="""CREATE TABLE orders (id INTEGER, user_id INTEGER, category VARCHAR, is_reorder BOOLEAN);
INSERT INTO orders VALUES
 (1,1,'Produce',TRUE),(2,1,'Produce',TRUE),(3,2,'Produce',FALSE),
 (4,2,'Dairy',TRUE),(5,3,'Dairy',TRUE),(6,3,'Dairy',TRUE),
 (7,4,'Snacks',FALSE),(8,4,'Snacks',TRUE);""",
    referenceSolution="""SELECT category,
       COUNT(*) FILTER (WHERE is_reorder) AS reorders,
       ROUND(COUNT(*) FILTER (WHERE is_reorder) * 1.0 / COUNT(*), 2) AS reorder_rate
FROM orders
GROUP BY category
ORDER BY reorders DESC;""",
    orderMatters=True,
    starter="SELECT category, \nFROM orders\nGROUP BY category\n",
    hints=["Count reorders with a FILTER, then divide by the category's total order count for the rate."],
)

P(
    id="apple-mac-creative-tools",
    free=False,
    level="mid",
    company="Apple · Mac Software",
    title="Time spent in creative tools",
    difficulty="medium",
    prompt="Understand engagement with multimedia tools. For each `tool`, return the number of distinct users (`users`), total minutes (`total_min`), and average minutes **per user** (`avg_per_user` = total minutes / distinct users, rounded to 1 decimal). Order by `total_min` descending.",
    schemaNote="usage(id, user_id, tool, minutes)",
    setupSql="""CREATE TABLE usage (id INTEGER, user_id INTEGER, tool VARCHAR, minutes INTEGER);
INSERT INTO usage VALUES
 (1,1,'Final Cut',120),(2,1,'Final Cut',80),
 (3,2,'Final Cut',200),(4,3,'Logic',300),
 (5,4,'Logic',150),(6,5,'Motion',60);""",
    referenceSolution="""SELECT tool,
       COUNT(DISTINCT user_id) AS users,
       SUM(minutes) AS total_min,
       ROUND(SUM(minutes) * 1.0 / COUNT(DISTINCT user_id), 1) AS avg_per_user
FROM usage
GROUP BY tool
ORDER BY total_min DESC;""",
    orderMatters=True,
    starter="SELECT tool, \nFROM usage\nGROUP BY tool\n",
    hints=["Average-per-user is total minutes divided by the DISTINCT user count — not AVG(minutes), which would average per session/row instead."],
)

P(
    id="meta-photo-sharing-age-group",
    free=False,
    level="mid",
    company="Meta · Facebook Photos",
    title="Photo sharing by age group",
    difficulty="medium",
    prompt="Compare photo-sharing across age segments. Bucket users into `'<18'`, `'18-50'`, and `'>50'` by `age`, and for each `age_group` return distinct users (`users`) and total photos shared (`photos`). Order from youngest bucket to oldest.",
    schemaNote="users(id, age, country, photos_shared)",
    setupSql="""CREATE TABLE users (id INTEGER, age INTEGER, country VARCHAR, photos_shared INTEGER);
INSERT INTO users VALUES
 (1,16,'US',50),(2,17,'CA',30),
 (3,25,'US',120),(4,40,'UK',80),
 (5,55,'US',20),(6,60,'IN',10);""",
    referenceSolution="""SELECT CASE WHEN age < 18 THEN '<18'
            WHEN age <= 50 THEN '18-50'
            ELSE '>50' END AS age_group,
       COUNT(DISTINCT id) AS users,
       SUM(photos_shared) AS photos
FROM users
GROUP BY age_group
ORDER BY MIN(age);""",
    orderMatters=True,
    starter="SELECT CASE WHEN age < 18 THEN '<18'\n            /* more buckets */\n       END AS age_group,\nFROM users\nGROUP BY age_group\n",
    hints=["ORDER BY MIN(age) keeps the buckets in chronological order instead of alphabetical ('<18' would otherwise sort oddly)."],
)

P(
    id="google-pay-failure-rate",
    free=False,
    level="mid",
    company="Google · Pay Security",
    title="Transaction failure rate by merchant category",
    difficulty="medium",
    prompt="Spot friction in payments. For each `merchant_category`, return total transactions (`total`), failures (`failures`, where `status = 'failed'`), and the **failure rate** (`failure_rate` = failures / total, rounded to 2 decimals). Highest failure rate first.",
    schemaNote="transactions(id, merchant_category, status)",
    setupSql="""CREATE TABLE transactions (id INTEGER, merchant_category VARCHAR, status VARCHAR);
INSERT INTO transactions VALUES
 (1,'Travel','success'),(2,'Travel','failed'),(3,'Travel','failed'),
 (4,'Retail','success'),(5,'Retail','success'),(6,'Retail','failed'),
 (7,'Gaming','success'),(8,'Gaming','success');""",
    referenceSolution="""SELECT merchant_category,
       COUNT(*) AS total,
       COUNT(*) FILTER (WHERE status = 'failed') AS failures,
       ROUND(COUNT(*) FILTER (WHERE status = 'failed') * 1.0 / COUNT(*), 2) AS failure_rate
FROM transactions
GROUP BY merchant_category
ORDER BY failure_rate DESC;""",
    orderMatters=True,
    starter="SELECT merchant_category, \nFROM transactions\nGROUP BY merchant_category\n",
    hints=["Filter the failed status into its own count, divide by total. Order descending to surface the riskiest merchant categories."],
)

P(
    id="microsoft-teams-coediting",
    free=False,
    level="mid",
    company="Microsoft · Teams",
    title="Co-editing intensity by org segment",
    difficulty="medium",
    prompt="Understand collaboration patterns in file sharing. For each `org_segment`, return the average number of co-editors (`avg_co_editors`, rounded to 2 decimals) and the count of files with **more than one** co-editor (`multi_editor_files`). Order by `avg_co_editors` descending.",
    schemaNote="files(id, org_segment, file_name, co_editors)",
    setupSql="""CREATE TABLE files (id INTEGER, org_segment VARCHAR, file_name VARCHAR, co_editors INTEGER);
INSERT INTO files VALUES
 (1,'Sales','deck.pptx',1),(2,'Sales','quota.xlsx',4),
 (3,'Eng','spec.docx',3),(4,'Eng','design.docx',5),
 (5,'HR','policy.docx',1),(6,'HR','review.docx',2);""",
    referenceSolution="""SELECT org_segment,
       ROUND(AVG(co_editors), 2) AS avg_co_editors,
       COUNT(*) FILTER (WHERE co_editors > 1) AS multi_editor_files
FROM files
GROUP BY org_segment
ORDER BY avg_co_editors DESC;""",
    orderMatters=True,
    starter="SELECT org_segment, \nFROM files\nGROUP BY org_segment\n",
    hints=["AVG(co_editors) for intensity; COUNT(*) FILTER (WHERE co_editors > 1) for how many files are genuinely collaborative."],
)

P(
    id="airbnb-work-travel-expense",
    free=False,
    level="mid",
    company="Airbnb · for Work",
    title="Corporate travel spend by company",
    difficulty="medium",
    prompt="Analyze corporate booking patterns. For each `company`, return average booking cost (`avg_cost`, rounded to 2 decimals) and average days booked in advance (`avg_advance`, rounded to 1 decimal). Most expensive average first.",
    schemaNote="bookings(id, company, booking_cost, days_in_advance)",
    setupSql="""CREATE TABLE bookings (id INTEGER, company VARCHAR, booking_cost DOUBLE, days_in_advance INTEGER);
INSERT INTO bookings VALUES
 (1,'Acme',300.0,14),(2,'Acme',450.0,7),
 (3,'Globex',200.0,30),(4,'Globex',250.0,21),
 (5,'Initech',600.0,2),(6,'Initech',550.0,3);""",
    referenceSolution="""SELECT company,
       ROUND(AVG(booking_cost), 2) AS avg_cost,
       ROUND(AVG(days_in_advance), 1) AS avg_advance
FROM bookings
GROUP BY company
ORDER BY avg_cost DESC;""",
    orderMatters=True,
    starter="SELECT company, \nFROM bookings\nGROUP BY company\n",
    hints=["Two averages per company. A low avg_advance next to a high avg_cost suggests last-minute booking is driving up spend."],
)

P(
    id="airbnb-amenity-pricing",
    free=False,
    level="mid",
    company="Airbnb · Stays",
    title="How a pool affects price & cleaning fee",
    difficulty="medium",
    prompt="See whether premium amenities lift earnings. Group listings by `has_pool`, and for each group return average `price` (`avg_price`, rounded to 2 decimals) and average `cleaning_fee` (`avg_cleaning_fee`, rounded to 2 decimals). Order by `has_pool` descending.",
    schemaNote="listings(id, has_pool, has_ocean_view, price, cleaning_fee)",
    setupSql="""CREATE TABLE listings (id INTEGER, has_pool BOOLEAN, has_ocean_view BOOLEAN, price DOUBLE, cleaning_fee DOUBLE);
INSERT INTO listings VALUES
 (1,TRUE,TRUE,400.0,90.0),
 (2,TRUE,FALSE,320.0,75.0),
 (3,FALSE,TRUE,250.0,60.0),
 (4,FALSE,FALSE,180.0,40.0),
 (5,TRUE,TRUE,500.0,100.0),
 (6,FALSE,FALSE,160.0,35.0);""",
    referenceSolution="""SELECT has_pool,
       ROUND(AVG(price), 2) AS avg_price,
       ROUND(AVG(cleaning_fee), 2) AS avg_cleaning_fee
FROM listings
GROUP BY has_pool
ORDER BY has_pool DESC;""",
    orderMatters=True,
    starter="SELECT has_pool, \nFROM listings\nGROUP BY has_pool\n",
    hints=["Group on has_pool and compare the two averages between pool and no-pool listings."],
)

P(
    id="walmart-checkout-peak-hour",
    free=False,
    level="mid",
    company="Walmart · Store Operations",
    title="Peak wait hour per store",
    difficulty="medium",
    prompt="Find when checkout waits peak at each store. Return the **hour with the highest average wait** for each store. Output `store_id`, `hour`, `avg_wait` (rounded to 1 decimal), ordered by `store_id`. Assume no ties within a store.",
    schemaNote="checkouts(id, store_id, hour, wait_minutes)",
    setupSql="""CREATE TABLE checkouts (id INTEGER, store_id INTEGER, hour INTEGER, wait_minutes INTEGER);
INSERT INTO checkouts VALUES
 (1,1,12,5),(2,1,12,7),(3,1,18,15),(4,1,18,17),
 (5,2,9,3),(6,2,9,4),(7,2,17,20),(8,2,17,22);""",
    referenceSolution="""WITH hourly AS (
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
ORDER BY store_id;""",
    orderMatters=True,
    starter="WITH hourly AS (\n  SELECT store_id, hour, AVG(wait_minutes) AS avg_wait\n  FROM checkouts\n  GROUP BY store_id, hour\n)\n",
    hints=["First aggregate average wait per (store, hour). Then ROW_NUMBER() OVER (PARTITION BY store_id ORDER BY avg_wait DESC) and keep rn = 1 for each store's worst hour."],
)

P(
    id="stripe-connect-payout-success",
    free=False,
    level="mid",
    company="Stripe · Connect",
    title="Payout success rate by seller segment",
    difficulty="medium",
    prompt="Find seller segments that may need intervention. For each `seller_segment`, return total payouts (`total`) and the **success rate** (`success_rate` = fraction where `status = 'success'`, rounded to 2 decimals). Lowest success rate first.",
    schemaNote="payouts(id, seller_segment, status)",
    setupSql="""CREATE TABLE payouts (id INTEGER, seller_segment VARCHAR, status VARCHAR);
INSERT INTO payouts VALUES
 (1,'SMB','success'),(2,'SMB','success'),(3,'SMB','failed'),
 (4,'Enterprise','success'),(5,'Enterprise','success'),
 (6,'New','failed'),(7,'New','failed'),(8,'New','success');""",
    referenceSolution="""SELECT seller_segment,
       COUNT(*) AS total,
       ROUND(COUNT(*) FILTER (WHERE status = 'success') * 1.0 / COUNT(*), 2) AS success_rate
FROM payouts
GROUP BY seller_segment
ORDER BY success_rate ASC;""",
    orderMatters=True,
    starter="SELECT seller_segment, \nFROM payouts\nGROUP BY seller_segment\n",
    hints=["Success rate is the FILTERed success count over total. Order ascending so the segments needing help appear first."],
)

P(
    id="stripe-tier-retention",
    free=False,
    level="mid",
    company="Stripe · Billing & Subscriptions",
    title="Retention & lifecycle by pricing tier",
    difficulty="medium",
    prompt="Compare retention across pricing tiers. For each `tier`, return average months active (`avg_months`, rounded to 1 decimal) and the **active rate** (`active_rate` = fraction where `active` is TRUE, rounded to 2 decimals). Longest-lived tier first.",
    schemaNote="subscriptions(id, tier, months_active, active)",
    setupSql="""CREATE TABLE subscriptions (id INTEGER, tier VARCHAR, months_active INTEGER, active BOOLEAN);
INSERT INTO subscriptions VALUES
 (1,'Basic',6,FALSE),(2,'Basic',8,TRUE),(3,'Basic',4,FALSE),
 (4,'Pro',18,TRUE),(5,'Pro',24,TRUE),(6,'Pro',12,FALSE),
 (7,'Premium',36,TRUE),(8,'Premium',30,TRUE);""",
    referenceSolution="""SELECT tier,
       ROUND(AVG(months_active), 1) AS avg_months,
       ROUND(AVG(CASE WHEN active THEN 1.0 ELSE 0 END), 2) AS active_rate
FROM subscriptions
GROUP BY tier
ORDER BY avg_months DESC;""",
    orderMatters=True,
    starter="SELECT tier, \nFROM subscriptions\nGROUP BY tier\n",
    hints=["AVG(months_active) for lifecycle length; AVG of the active flag for the current retention rate."],
)

P(
    id="stripe-capital-revenue-variability",
    free=False,
    level="mid",
    company="Stripe · Capital",
    title="Loan repayment by revenue variability",
    difficulty="medium",
    prompt="See how revenue stability relates to repayment. For each `revenue_variability` level, return the number of loans (`loans`) and the **repayment rate** (`repayment_rate` = fraction where `repaid` is TRUE, rounded to 2 decimals). Highest repayment rate first.",
    schemaNote="loans(id, revenue_variability, repaid)",
    setupSql="""CREATE TABLE loans (id INTEGER, revenue_variability VARCHAR, repaid BOOLEAN);
INSERT INTO loans VALUES
 (1,'low',TRUE),(2,'low',TRUE),(3,'low',TRUE),(4,'low',FALSE),
 (5,'medium',TRUE),(6,'medium',FALSE),(7,'medium',TRUE),
 (8,'high',FALSE),(9,'high',FALSE),(10,'high',TRUE);""",
    referenceSolution="""SELECT revenue_variability,
       COUNT(*) AS loans,
       ROUND(AVG(CASE WHEN repaid THEN 1.0 ELSE 0 END), 2) AS repayment_rate
FROM loans
GROUP BY revenue_variability
ORDER BY repayment_rate DESC;""",
    orderMatters=True,
    starter="SELECT revenue_variability, \nFROM loans\nGROUP BY revenue_variability\n",
    hints=["Repayment rate is the average of the repaid flag per variability bucket. The trend across low/medium/high is the insight."],
)

P(
    id="walmart-price-band-sales",
    free=False,
    level="mid",
    company="Walmart · Pricing Strategy",
    title="Sales by price band",
    difficulty="medium",
    prompt="Categorize essentials by price and see where volume sits. Bucket products into `'budget (<$5)'`, `'mid ($5-$15)'`, and `'premium (>$15)'` by `price`, and for each `price_band` return the product count (`products`) and total `units_sold` (`total_units`). Order from cheapest band to most expensive.",
    schemaNote="products(id, name, price, units_sold)",
    setupSql="""CREATE TABLE products (id INTEGER, name VARCHAR, price DOUBLE, units_sold INTEGER);
INSERT INTO products VALUES
 (1,'Soap',3.0,5000),(2,'Toothpaste',4.5,3000),
 (3,'Detergent',12.0,2000),(4,'Shampoo',8.0,2500),
 (5,'Vacuum',45.0,300),(6,'Blender',25.0,500);""",
    referenceSolution="""SELECT CASE WHEN price < 5 THEN 'budget (<$5)'
            WHEN price <= 15 THEN 'mid ($5-$15)'
            ELSE 'premium (>$15)' END AS price_band,
       COUNT(*) AS products,
       SUM(units_sold) AS total_units
FROM products
GROUP BY price_band
ORDER BY MIN(price);""",
    orderMatters=True,
    starter="SELECT CASE WHEN price < 5 THEN 'budget (<$5)'\n            /* more bands */\n       END AS price_band,\nFROM products\nGROUP BY price_band\n",
    hints=["Bucket with CASE, then ORDER BY MIN(price) to keep bands in price order."],
)

P(
    id="linkedin-top-endorsed-skills",
    free=False,
    level="mid",
    company="LinkedIn · Recommendations",
    title="Top endorsed skills",
    difficulty="medium",
    prompt="Find which skills get the most recognition. Return the top **5 skills by total endorsements**. Output `skill`, `total_endorsements`, and the distinct users endorsed (`users`). Most-endorsed first, ties broken by `skill`.",
    schemaNote="endorsements(id, user_id, skill, endorsement_count)",
    setupSql="""CREATE TABLE endorsements (id INTEGER, user_id INTEGER, skill VARCHAR, endorsement_count INTEGER);
INSERT INTO endorsements VALUES
 (1,1,'SQL',20),(2,2,'SQL',15),
 (3,3,'Python',30),(4,4,'Python',25),
 (5,5,'Leadership',10),(6,6,'Excel',8),
 (7,7,'Spark',12),(8,8,'SQL',9);""",
    referenceSolution="""SELECT skill,
       SUM(endorsement_count) AS total_endorsements,
       COUNT(DISTINCT user_id) AS users
FROM endorsements
GROUP BY skill
ORDER BY total_endorsements DESC, skill
LIMIT 5;""",
    orderMatters=True,
    starter="SELECT skill, \nFROM endorsements\nGROUP BY skill\n",
    hints=["Sum endorsement_count per skill, count distinct endorsed users, order descending and LIMIT 5."],
)

P(
    id="x-sports-engagement",
    free=False,
    level="mid",
    company="X · Sports",
    title="Live commentary vs highlights engagement",
    difficulty="medium",
    prompt="Compare engagement between content types. For each `content_type`, return distinct users (`users`), total `engagement` (`total_engagement`), and average engagement per interaction (`avg_engagement`, rounded to 1 decimal). Order by `total_engagement` descending.",
    schemaNote="interactions(id, content_type, user_id, engagement)",
    setupSql="""CREATE TABLE interactions (id INTEGER, content_type VARCHAR, user_id INTEGER, engagement INTEGER);
INSERT INTO interactions VALUES
 (1,'commentary',1,40),(2,'commentary',2,60),(3,'commentary',1,20),
 (4,'highlight',3,100),(5,'highlight',4,80),(6,'highlight',3,50);""",
    referenceSolution="""SELECT content_type,
       COUNT(DISTINCT user_id) AS users,
       SUM(engagement) AS total_engagement,
       ROUND(AVG(engagement), 1) AS avg_engagement
FROM interactions
GROUP BY content_type
ORDER BY total_engagement DESC;""",
    orderMatters=True,
    starter="SELECT content_type, \nFROM interactions\nGROUP BY content_type\n",
    hints=["Distinct users measures reach, SUM measures total volume, AVG measures intensity per interaction."],
)

P(
    id="openai-chatgpt-domain-share",
    free=False,
    level="mid",
    company="OpenAI · ChatGPT",
    title="Share of tech & science queries",
    difficulty="medium",
    prompt="Measure how much of ChatGPT usage is technical. Return a single row with total queries (`total_queries`), queries in technology or science domains (`tech_sci_queries`, where `domain IN ('technology','science')`), and their **percentage** (`tech_sci_pct`, rounded to 1 decimal).",
    schemaNote="queries(id, user_id, domain, month)",
    setupSql="""CREATE TABLE queries (id INTEGER, user_id INTEGER, domain VARCHAR, month VARCHAR);
INSERT INTO queries VALUES
 (1,1,'technology','2026-01'),
 (2,1,'science','2026-01'),
 (3,2,'cooking','2026-01'),
 (4,3,'technology','2026-02'),
 (5,4,'health','2026-02'),
 (6,5,'science','2026-02');""",
    referenceSolution="""SELECT COUNT(*) AS total_queries,
       COUNT(*) FILTER (WHERE domain IN ('technology','science')) AS tech_sci_queries,
       ROUND(100.0 * COUNT(*) FILTER (WHERE domain IN ('technology','science')) / COUNT(*), 1) AS tech_sci_pct
FROM queries;""",
    orderMatters=False,
    starter="SELECT \nFROM queries\n",
    hints=["A FILTER with an IN list counts the technical queries; divide by the overall count for the percentage."],
)

P(
    id="openai-codex-language-quality",
    free=False,
    level="mid",
    company="OpenAI · Codex",
    title="Suggestion acceptance & errors by language",
    difficulty="medium",
    prompt="Evaluate code-suggestion quality per language. For each `language`, return the **acceptance rate** (`accept_rate` = fraction where `accepted` is TRUE, rounded to 2 decimals) and average errors introduced (`avg_errors`, rounded to 2 decimals). Best acceptance first.",
    schemaNote="suggestions(id, language, accepted, errors_introduced)",
    setupSql="""CREATE TABLE suggestions (id INTEGER, language VARCHAR, accepted BOOLEAN, errors_introduced INTEGER);
INSERT INTO suggestions VALUES
 (1,'Python',TRUE,0),(2,'Python',TRUE,1),(3,'Python',FALSE,3),
 (4,'JavaScript',TRUE,1),(5,'JavaScript',FALSE,2),
 (6,'Rust',FALSE,4),(7,'Rust',TRUE,0);""",
    referenceSolution="""SELECT language,
       ROUND(AVG(CASE WHEN accepted THEN 1.0 ELSE 0 END), 2) AS accept_rate,
       ROUND(AVG(errors_introduced), 2) AS avg_errors
FROM suggestions
GROUP BY language
ORDER BY accept_rate DESC;""",
    orderMatters=True,
    starter="SELECT language, \nFROM suggestions\nGROUP BY language\n",
    hints=["Acceptance rate is AVG of the accepted flag; pair it with AVG(errors_introduced) to see quality vs noise."],
)

P(
    id="ubereats-route-clustering",
    free=False,
    level="mid",
    company="Uber Eats · Delivery",
    title="Order clustering by delivery partner",
    difficulty="medium",
    prompt="Measure how efficiently partners cluster pickups. For each `partner_id`, return the number of routes (`routes`) and the average orders per route (`avg_orders`, rounded to 2 decimals). Most orders-per-route first.",
    schemaNote="pickups(id, partner_id, route_id, orders_in_route)",
    setupSql="""CREATE TABLE pickups (id INTEGER, partner_id INTEGER, route_id INTEGER, orders_in_route INTEGER);
INSERT INTO pickups VALUES
 (1,1,10,3),(2,1,11,4),
 (3,2,12,1),(4,2,13,2),(5,2,14,1),
 (6,3,15,5),(7,3,16,6);""",
    referenceSolution="""SELECT partner_id,
       COUNT(*) AS routes,
       ROUND(AVG(orders_in_route), 2) AS avg_orders
FROM pickups
GROUP BY partner_id
ORDER BY avg_orders DESC;""",
    orderMatters=True,
    starter="SELECT partner_id, \nFROM pickups\nGROUP BY partner_id\n",
    hints=["COUNT(*) is the number of routes per partner; AVG(orders_in_route) is the clustering efficiency."],
)

P(
    id="paypal-venmo-social-bands",
    free=False,
    level="mid",
    company="PayPal · Venmo",
    title="Transactions by social-interaction level",
    difficulty="medium",
    prompt="See whether social activity drives transactions. Bucket users by `social_interactions` into `'none (0)'`, `'low (1-5)'`, and `'high (6+)'`, and for each `social_band` return the user count (`users`) and average transactions (`avg_txns`, rounded to 1 decimal). Order from least to most social.",
    schemaNote="users(id, social_interactions, transactions)",
    setupSql="""CREATE TABLE users (id INTEGER, social_interactions INTEGER, transactions INTEGER);
INSERT INTO users VALUES
 (1,0,2),(2,0,1),
 (3,3,8),(4,5,10),
 (5,8,20),(6,12,30);""",
    referenceSolution="""SELECT CASE WHEN social_interactions = 0 THEN 'none (0)'
            WHEN social_interactions <= 5 THEN 'low (1-5)'
            ELSE 'high (6+)' END AS social_band,
       COUNT(*) AS users,
       ROUND(AVG(transactions), 1) AS avg_txns
FROM users
GROUP BY social_band
ORDER BY MIN(social_interactions);""",
    orderMatters=True,
    starter="SELECT CASE WHEN social_interactions = 0 THEN 'none (0)'\n            /* more bands */\n       END AS social_band,\nFROM users\nGROUP BY social_band\n",
    hints=["Bucket with CASE, ORDER BY MIN(social_interactions). The rising avg_txns across bands is the relationship you're after."],
)

P(
    id="ea-starwars-narrative",
    free=False,
    level="mid",
    company="Electronic Arts · Star Wars",
    title="Narrative element engagement",
    difficulty="medium",
    prompt="Find which story elements hold player attention. For each `narrative_element`, return distinct players (`players`), total time spent (`total_time`), and average time per interaction (`avg_time`, rounded to 1 decimal). Order by `total_time` descending.",
    schemaNote="choices(id, narrative_element, player_id, time_spent_sec)",
    setupSql="""CREATE TABLE choices (id INTEGER, narrative_element VARCHAR, player_id INTEGER, time_spent_sec INTEGER);
INSERT INTO choices VALUES
 (1,'Dialogue',1,120),(2,'Dialogue',2,90),(3,'Dialogue',1,60),
 (4,'Combat',3,200),(5,'Combat',4,180),
 (6,'Exploration',5,300),(7,'Exploration',5,150);""",
    referenceSolution="""SELECT narrative_element,
       COUNT(DISTINCT player_id) AS players,
       SUM(time_spent_sec) AS total_time,
       ROUND(AVG(time_spent_sec), 1) AS avg_time
FROM choices
GROUP BY narrative_element
ORDER BY total_time DESC;""",
    orderMatters=True,
    starter="SELECT narrative_element, \nFROM choices\nGROUP BY narrative_element\n",
    hints=["Distinct players for reach, total time for overall pull, average time for per-interaction depth."],
)


# ───────────────────────────── HARD (senior) ─────────────────────────────
# Source #55–77. Advanced windows, LAG, running totals, percentiles. Pro only.

P(
    id="amazon-seller-cumulative-txns",
    free=False,
    level="senior",
    company="Amazon · Marketplace Analytics",
    title="Per-seller fees & cumulative transaction count",
    difficulty="hard",
    prompt="Track each seller's running activity. For every transaction, return `seller_id`, `txn_date`, the fee charged (`fee` = amount × fee_pct, rounded to 2 decimals), and the **cumulative count of transactions** for that seller up to and including that date (`cum_txns`). Order by `seller_id`, then `txn_date`.",
    schemaNote="transactions(id, seller_id, amount, fee_pct, txn_date)",
    setupSql="""CREATE TABLE transactions (id INTEGER, seller_id INTEGER, amount DOUBLE, fee_pct DOUBLE, txn_date DATE);
INSERT INTO transactions VALUES
 (1,1,100.0,0.10,DATE '2026-01-01'),
 (2,1,200.0,0.10,DATE '2026-01-03'),
 (3,1,150.0,0.08,DATE '2026-01-05'),
 (4,2,500.0,0.05,DATE '2026-01-02'),
 (5,2,300.0,0.05,DATE '2026-01-04');""",
    referenceSolution="""SELECT seller_id,
       txn_date,
       ROUND(amount * fee_pct, 2) AS fee,
       COUNT(*) OVER (PARTITION BY seller_id ORDER BY txn_date
                      ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS cum_txns
FROM transactions
ORDER BY seller_id, txn_date;""",
    orderMatters=True,
    starter="SELECT seller_id, txn_date,\n       ROUND(amount * fee_pct, 2) AS fee,\n       /* running count per seller */\nFROM transactions\nORDER BY seller_id, txn_date;\n",
    hints=["COUNT(*) OVER (PARTITION BY seller_id ORDER BY txn_date ...) gives a running count. The ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW frame makes it cumulative."],
)

P(
    id="apple-csr-program-share",
    free=False,
    level="senior",
    company="Apple · Corporate Social Responsibility",
    title="Program share of community participation",
    difficulty="hard",
    prompt="Break down participation within each community. For every `community`/`program` pair, return total `participants`, the **percentage of that community's participants** the program represents (`pct_of_community`, rounded to 1 decimal), and the program's `rank` within the community by participants (1 = largest). Order by `community`, then `rank`.",
    schemaNote="participation(id, community, program, participants)",
    setupSql="""CREATE TABLE participation (id INTEGER, community VARCHAR, program VARCHAR, participants INTEGER);
INSERT INTO participation VALUES
 (1,'Austin','Coding Camp',200),
 (2,'Austin','Mentorship',100),
 (3,'Austin','Grants',50),
 (4,'Detroit','Coding Camp',120),
 (5,'Detroit','Mentorship',180);""",
    referenceSolution="""SELECT community,
       program,
       participants,
       ROUND(100.0 * participants / SUM(participants) OVER (PARTITION BY community), 1) AS pct_of_community,
       RANK() OVER (PARTITION BY community ORDER BY participants DESC) AS rank
FROM participation
ORDER BY community, rank;""",
    orderMatters=True,
    starter="SELECT community, program, participants,\n       /* share of community total */\n       /* rank within community */\nFROM participation\nORDER BY community, rank;\n",
    hints=["SUM(participants) OVER (PARTITION BY community) gives the community total on every row; divide for the share. RANK() OVER the same partition orders programs within the community."],
)

P(
    id="meta-creator-followers-per-engagement",
    free=False,
    level="senior",
    company="Meta · Creator Growth",
    title="Follower growth per engagement by content type",
    difficulty="hard",
    prompt="Find which content types convert engagement into followers. For each `content_type`, return total `engagement` (`total_engagement`), total `new_followers` (`total_followers`), the **followers-per-engagement ratio** (`followers_per_eng` = total followers / total engagement, rounded to 4 decimals), and a `rank` by that ratio (1 = best). Order by `rank`.",
    schemaNote="posts(id, creator_id, content_type, engagement, new_followers)",
    setupSql="""CREATE TABLE posts (id INTEGER, creator_id INTEGER, content_type VARCHAR, engagement INTEGER, new_followers INTEGER);
INSERT INTO posts VALUES
 (1,1,'Reels',1000,200),
 (2,2,'Reels',2000,500),
 (3,3,'Photos',1500,100),
 (4,4,'Photos',500,40),
 (5,5,'Live',800,300);""",
    referenceSolution="""WITH agg AS (
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
ORDER BY rank;""",
    orderMatters=True,
    starter="WITH agg AS (\n  SELECT content_type,\n         SUM(engagement) AS total_engagement,\n         SUM(new_followers) AS total_followers\n  FROM posts\n  GROUP BY content_type\n)\n",
    hints=["Aggregate per content type in a CTE, compute the ratio there, then RANK() over the ratio in the outer query — you can't rank on an alias defined in the same SELECT."],
)

P(
    id="netflix-telecom-partner-retention",
    free=False,
    level="senior",
    company="Netflix · Partnerships & Bundling",
    title="Conversion & retention by telecom partner",
    difficulty="hard",
    prompt="Compare bundle partners. For each `partner`, return the **conversion rate** (`conv_rate` = fraction of subscribers where `converted` is TRUE, rounded to 2 decimals), the **retention among converted** (`retention_rate` = fraction of converted subscribers who are `retained`, rounded to 2 decimals), and average watch minutes (`avg_watch`, rounded to 1 decimal). Order by `retention_rate` descending.",
    schemaNote="bundles(id, partner, subscriber_id, converted, retained, watch_minutes)",
    setupSql="""CREATE TABLE bundles (id INTEGER, partner VARCHAR, subscriber_id INTEGER, converted BOOLEAN, retained BOOLEAN, watch_minutes INTEGER);
INSERT INTO bundles VALUES
 (1,'Verizon',1,TRUE,TRUE,400),
 (2,'Verizon',2,TRUE,FALSE,100),
 (3,'Verizon',3,FALSE,FALSE,0),
 (4,'T-Mobile',4,TRUE,TRUE,500),
 (5,'T-Mobile',5,TRUE,TRUE,450),
 (6,'T-Mobile',6,FALSE,FALSE,0);""",
    referenceSolution="""SELECT partner,
       ROUND(AVG(CASE WHEN converted THEN 1.0 ELSE 0 END), 2) AS conv_rate,
       ROUND(COUNT(*) FILTER (WHERE converted AND retained) * 1.0
             / COUNT(*) FILTER (WHERE converted), 2) AS retention_rate,
       ROUND(AVG(watch_minutes), 1) AS avg_watch
FROM bundles
GROUP BY partner
ORDER BY retention_rate DESC;""",
    orderMatters=True,
    starter="SELECT partner, \nFROM bundles\nGROUP BY partner\n",
    hints=["Conversion rate is over all subscribers; retention is conditional — divide the converted-and-retained count by the converted count, not the total."],
)

P(
    id="google-ads-roi-by-segment",
    free=False,
    level="senior",
    company="Google · Ads Performance",
    title="Format diversity & ROI by segment",
    difficulty="hard",
    prompt="Optimize campaign strategy. For each `segment`, return the number of distinct ad formats (`formats`), total `reach`, and **ROI** (`roi` = (total revenue − total spend) / total spend, rounded to 2 decimals). Order by `roi` descending.",
    schemaNote="campaigns(id, segment, ad_format, reach, spend, revenue)",
    setupSql="""CREATE TABLE campaigns (id INTEGER, segment VARCHAR, ad_format VARCHAR, reach INTEGER, spend DOUBLE, revenue DOUBLE);
INSERT INTO campaigns VALUES
 (1,'Retail','search',100000,2000.0,8000.0),
 (2,'Retail','display',50000,1000.0,2000.0),
 (3,'Retail','video',80000,3000.0,9000.0),
 (4,'Travel','search',60000,1500.0,3000.0),
 (5,'Travel','display',40000,1000.0,1200.0);""",
    referenceSolution="""SELECT segment,
       COUNT(DISTINCT ad_format) AS formats,
       SUM(reach) AS reach,
       ROUND((SUM(revenue) - SUM(spend)) / SUM(spend), 2) AS roi
FROM campaigns
GROUP BY segment
ORDER BY roi DESC;""",
    orderMatters=True,
    starter="SELECT segment, \nFROM campaigns\nGROUP BY segment\n",
    hints=["ROI uses aggregated totals: (SUM(revenue) - SUM(spend)) / SUM(spend). COUNT(DISTINCT ad_format) captures format diversity."],
)

P(
    id="google-play-revenue-per-download",
    free=False,
    level="senior",
    company="Google · Play Developer",
    title="Revenue per download, ranked within category",
    difficulty="hard",
    prompt="See how monetization models monetize per install. For each `category`/`monetization_model` pair, return total `revenue` (`total_revenue`), the **revenue per download** (`rev_per_download` = total revenue / total downloads, rounded to 2 decimals), and the model's `rank` within its category by total revenue (1 = highest). Order by `category`, then `rank`.",
    schemaNote="apps(id, category, monetization_model, revenue, downloads)",
    setupSql="""CREATE TABLE apps (id INTEGER, category VARCHAR, monetization_model VARCHAR, revenue DOUBLE, downloads INTEGER);
INSERT INTO apps VALUES
 (1,'Games','in-app',50000.0,100000),
 (2,'Games','paid',20000.0,10000),
 (3,'Games','ads',15000.0,200000),
 (4,'Productivity','subscription',40000.0,20000),
 (5,'Productivity','paid',10000.0,5000);""",
    referenceSolution="""WITH agg AS (
  SELECT category, monetization_model,
         SUM(revenue) AS total_revenue,
         ROUND(SUM(revenue) / SUM(downloads), 2) AS rev_per_download
  FROM apps
  GROUP BY category, monetization_model
)
SELECT category, monetization_model, total_revenue, rev_per_download,
       RANK() OVER (PARTITION BY category ORDER BY total_revenue DESC) AS rank
FROM agg
ORDER BY category, rank;""",
    orderMatters=True,
    starter="WITH agg AS (\n  SELECT category, monetization_model,\n         SUM(revenue) AS total_revenue\n  FROM apps\n  GROUP BY category, monetization_model\n)\n",
    hints=["Aggregate in a CTE, then RANK() OVER (PARTITION BY category ORDER BY total_revenue DESC) in the outer query to rank models within each category."],
)

P(
    id="apple-camera-vs-overall",
    free=False,
    level="senior",
    company="Apple · iPhone Camera",
    title="Segment camera quality vs. overall average",
    difficulty="hard",
    prompt="Spot which user segments deviate from the norm. For each `user_segment`, return average photo quality (`avg_photo`, rounded to 2 decimals) and its **difference from the overall photo-quality average** across all captures (`vs_overall`, rounded to 2 decimals — positive means above average). Order by `vs_overall` descending.",
    schemaNote="captures(id, user_segment, photo_quality, video_quality)",
    setupSql="""CREATE TABLE captures (id INTEGER, user_segment VARCHAR, photo_quality INTEGER, video_quality INTEGER);
INSERT INTO captures VALUES
 (1,'Pro',95,90),(2,'Pro',92,88),
 (3,'Casual',70,65),(4,'Casual',75,70),
 (5,'New',60,55),(6,'New',65,60);""",
    referenceSolution="""SELECT user_segment,
       ROUND(AVG(photo_quality), 2) AS avg_photo,
       ROUND(AVG(photo_quality) - AVG(AVG(photo_quality)) OVER (), 2) AS vs_overall
FROM captures
GROUP BY user_segment
ORDER BY vs_overall DESC;""",
    orderMatters=True,
    starter="SELECT user_segment, \nFROM captures\nGROUP BY user_segment\n",
    hints=["AVG(AVG(photo_quality)) OVER () averages the per-segment averages across all groups — a window over an aggregate. Subtract it from each segment's average. (This weights segments equally.)"],
)

P(
    id="amazon-prime-early-access-funnel",
    free=False,
    level="senior",
    company="Amazon · Prime",
    title="Promo funnel: early access vs. standard",
    difficulty="hard",
    prompt="Measure whether early access lifts the funnel. Group engagements by `early_access`, and for each group return total promos (`total`), the **click rate** (`click_rate` = fraction clicked, rounded to 2 decimals), and the **purchase rate among clicks** (`purchase_rate` = fraction of clicked promos that were purchased, rounded to 2 decimals). Order by `early_access` descending.",
    schemaNote="engagements(id, member_id, promo_id, clicked, purchased, early_access)",
    setupSql="""CREATE TABLE engagements (id INTEGER, member_id INTEGER, promo_id INTEGER, clicked BOOLEAN, purchased BOOLEAN, early_access BOOLEAN);
INSERT INTO engagements VALUES
 (1,1,10,TRUE,TRUE,TRUE),
 (2,2,10,TRUE,FALSE,TRUE),
 (3,3,11,FALSE,FALSE,TRUE),
 (4,4,12,TRUE,FALSE,FALSE),
 (5,5,12,FALSE,FALSE,FALSE),
 (6,6,13,TRUE,TRUE,FALSE);""",
    referenceSolution="""SELECT early_access,
       COUNT(*) AS total,
       ROUND(AVG(CASE WHEN clicked THEN 1.0 ELSE 0 END), 2) AS click_rate,
       ROUND(COUNT(*) FILTER (WHERE clicked AND purchased) * 1.0
             / COUNT(*) FILTER (WHERE clicked), 2) AS purchase_rate
FROM engagements
GROUP BY early_access
ORDER BY early_access DESC;""",
    orderMatters=True,
    starter="SELECT early_access, \nFROM engagements\nGROUP BY early_access\n",
    hints=["Click rate is over all promos; purchase rate is conditional on clicking — divide clicked-and-purchased by clicked, a FILTER over a FILTER."],
)

P(
    id="meta-whatsapp-chat-types",
    free=False,
    level="senior",
    company="Meta · WhatsApp",
    title="Call & group-chat engagement patterns",
    difficulty="hard",
    prompt="Understand engagement by chat type. For each `chat_type`, return average call duration in seconds (`avg_call_sec`, rounded to 1 decimal), average participants (`avg_participants`, rounded to 1 decimal), and the count of **family-focused** chats (`family_chats`, where `is_family` is TRUE). Order by `avg_participants` descending.",
    schemaNote="events(id, user_id, chat_type, is_family, call_duration_sec, participants)",
    setupSql="""CREATE TABLE events (id INTEGER, user_id INTEGER, chat_type VARCHAR, is_family BOOLEAN, call_duration_sec INTEGER, participants INTEGER);
INSERT INTO events VALUES
 (1,1,'group',TRUE,300,8),
 (2,2,'group',FALSE,120,5),
 (3,3,'group',TRUE,600,12),
 (4,4,'one-on-one',TRUE,180,2),
 (5,5,'one-on-one',FALSE,90,2);""",
    referenceSolution="""SELECT chat_type,
       ROUND(AVG(call_duration_sec), 1) AS avg_call_sec,
       ROUND(AVG(participants), 1) AS avg_participants,
       COUNT(*) FILTER (WHERE is_family) AS family_chats
FROM events
GROUP BY chat_type
ORDER BY avg_participants DESC;""",
    orderMatters=True,
    starter="SELECT chat_type, \nFROM events\nGROUP BY chat_type\n",
    hints=["Two averages plus a FILTERed count of family chats, all in one GROUP BY chat_type."],
)

P(
    id="netflix-mobile-top-resume-show",
    free=False,
    level="senior",
    company="Netflix · Mobile Experience",
    title="Most-resumed show per platform",
    difficulty="hard",
    prompt="Find the top show for resumption on each mobile platform. Return the **show with the most resume events per platform**. Output `platform`, `show_id`, `resume_count`, ordered by `platform`. Assume no ties within a platform.",
    schemaNote="resume_events(id, user_id, show_id, platform, resumed_at)",
    setupSql="""CREATE TABLE resume_events (id INTEGER, user_id INTEGER, show_id INTEGER, platform VARCHAR, resumed_at DATE);
INSERT INTO resume_events VALUES
 (1,1,100,'iOS',DATE '2026-05-01'),
 (2,2,100,'iOS',DATE '2026-05-01'),
 (3,3,101,'iOS',DATE '2026-05-02'),
 (4,4,200,'Android',DATE '2026-05-01'),
 (5,5,200,'Android',DATE '2026-05-02'),
 (6,6,200,'Android',DATE '2026-05-03'),
 (7,7,201,'Android',DATE '2026-05-03');""",
    referenceSolution="""WITH counts AS (
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
ORDER BY platform;""",
    orderMatters=True,
    starter="WITH counts AS (\n  SELECT platform, show_id, COUNT(*) AS resume_count\n  FROM resume_events\n  GROUP BY platform, show_id\n)\n",
    hints=["Count resumes per (platform, show), then ROW_NUMBER() OVER (PARTITION BY platform ORDER BY resume_count DESC) and keep rn = 1."],
)

P(
    id="microsoft-teams-daily-delta",
    free=False,
    level="senior",
    company="Microsoft · Teams",
    title="Day-over-day message volume change",
    difficulty="hard",
    prompt="Track daily chat momentum. For each `day`, return the total messages (`messages`) and the **change versus the previous day** (`delta` = today − yesterday; NULL for the first day). Order by `day`.",
    schemaNote="messages(id, user_id, channel, sent_at)",
    setupSql="""CREATE TABLE messages (id INTEGER, user_id INTEGER, channel VARCHAR, sent_at DATE);
INSERT INTO messages VALUES
 (1,1,'general',DATE '2026-05-01'),
 (2,2,'general',DATE '2026-05-01'),
 (3,3,'random',DATE '2026-05-02'),
 (4,1,'general',DATE '2026-05-02'),
 (5,2,'random',DATE '2026-05-02'),
 (6,3,'general',DATE '2026-05-03');""",
    referenceSolution="""WITH daily AS (
  SELECT sent_at AS day, COUNT(*) AS messages
  FROM messages
  GROUP BY sent_at
)
SELECT day,
       messages,
       messages - LAG(messages) OVER (ORDER BY day) AS delta
FROM daily
ORDER BY day;""",
    orderMatters=True,
    starter="WITH daily AS (\n  SELECT sent_at AS day, COUNT(*) AS messages\n  FROM messages\n  GROUP BY sent_at\n)\n",
    hints=["Aggregate per day first, then LAG(messages) OVER (ORDER BY day) gives the prior day's count. Subtract for the delta; the first row is NULL by design."],
)

P(
    id="airbnb-transparency-cancellation",
    free=False,
    level="senior",
    company="Airbnb · Stays",
    title="Completion by transparency & cancellation policy",
    difficulty="hard",
    prompt="See how pricing transparency and cancellation policy interact. For each `transparent_pricing`/`cancellation_policy` pair, return bookings (`bookings`) and the **completion rate** (`completion_rate` = fraction where `completed` is TRUE, rounded to 2 decimals). Order by `completion_rate` descending, then `cancellation_policy`.",
    schemaNote="bookings(id, transparent_pricing, cancellation_policy, completed, booking_date)",
    setupSql="""CREATE TABLE bookings (id INTEGER, transparent_pricing BOOLEAN, cancellation_policy VARCHAR, completed BOOLEAN, booking_date DATE);
INSERT INTO bookings VALUES
 (1,TRUE,'flexible',TRUE,DATE '2026-04-01'),
 (2,TRUE,'flexible',TRUE,DATE '2026-04-01'),
 (3,TRUE,'strict',FALSE,DATE '2026-04-02'),
 (4,FALSE,'flexible',FALSE,DATE '2026-04-02'),
 (5,FALSE,'strict',FALSE,DATE '2026-04-03'),
 (6,FALSE,'strict',TRUE,DATE '2026-04-03');""",
    referenceSolution="""SELECT transparent_pricing,
       cancellation_policy,
       COUNT(*) AS bookings,
       ROUND(AVG(CASE WHEN completed THEN 1.0 ELSE 0 END), 2) AS completion_rate
FROM bookings
GROUP BY transparent_pricing, cancellation_policy
ORDER BY completion_rate DESC, cancellation_policy;""",
    orderMatters=True,
    starter="SELECT transparent_pricing, cancellation_policy, \nFROM bookings\nGROUP BY transparent_pricing, cancellation_policy\n",
    hints=["Group on both dimensions at once. Completion rate is AVG of the completed flag within each combination."],
)

P(
    id="airbnb-response-band-booking",
    free=False,
    level="senior",
    company="Airbnb · Stays",
    title="Booking rate by host response speed",
    difficulty="hard",
    prompt="Quantify how response speed drives bookings. Bucket inquiries by `response_minutes` into `'fast (<30)'`, `'medium (30-120)'`, and `'slow (>120)'`, and for each `response_band` return inquiry count (`inquiries`) and the **booking rate** (`booking_rate` = fraction where `booked` is TRUE, rounded to 2 decimals). Order from fastest band to slowest.",
    schemaNote="bookings(id, host_id, response_minutes, booked)",
    setupSql="""CREATE TABLE bookings (id INTEGER, host_id INTEGER, response_minutes INTEGER, booked BOOLEAN);
INSERT INTO bookings VALUES
 (1,1,10,TRUE),(2,1,20,TRUE),(3,2,25,TRUE),
 (4,3,60,TRUE),(5,3,90,FALSE),(6,4,100,FALSE),
 (7,5,200,FALSE),(8,5,300,FALSE);""",
    referenceSolution="""SELECT CASE WHEN response_minutes < 30 THEN 'fast (<30)'
            WHEN response_minutes <= 120 THEN 'medium (30-120)'
            ELSE 'slow (>120)' END AS response_band,
       COUNT(*) AS inquiries,
       ROUND(AVG(CASE WHEN booked THEN 1.0 ELSE 0 END), 2) AS booking_rate
FROM bookings
GROUP BY response_band
ORDER BY MIN(response_minutes);""",
    orderMatters=True,
    starter="SELECT CASE WHEN response_minutes < 30 THEN 'fast (<30)'\n            /* more bands */\n       END AS response_band,\nFROM bookings\nGROUP BY response_band\n",
    hints=["Bucket with CASE, ORDER BY MIN(response_minutes) for speed order. The falling booking_rate across bands is the takeaway."],
)

P(
    id="walmart-eyewear-style-rank",
    free=False,
    level="senior",
    company="Walmart · Vision Center",
    title="Eyewear styles ranked by units",
    difficulty="hard",
    prompt="Rank eyewear styles by sales. For each `style`, return total `units_sold` (`total_units`), average `price` (`avg_price`, rounded to 2 decimals), average satisfaction (`avg_satisfaction`, rounded to 2 decimals), and a `rank` by total units (1 = best-selling). Order by `rank`.",
    schemaNote="products(id, style, price, units_sold, satisfaction)",
    setupSql="""CREATE TABLE products (id INTEGER, style VARCHAR, price DOUBLE, units_sold INTEGER, satisfaction DOUBLE);
INSERT INTO products VALUES
 (1,'Aviator',120.0,500,4.5),
 (2,'Aviator',140.0,300,4.6),
 (3,'Round',90.0,800,4.2),
 (4,'Round',95.0,200,4.0),
 (5,'Cat-eye',150.0,400,4.8);""",
    referenceSolution="""WITH agg AS (
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
ORDER BY rank;""",
    orderMatters=True,
    starter="WITH agg AS (\n  SELECT style, SUM(units_sold) AS total_units\n  FROM products\n  GROUP BY style\n)\n",
    hints=["Aggregate per style in a CTE, then RANK() OVER (ORDER BY total_units DESC) in the outer query."],
)

P(
    id="walmart-shipping-on-time",
    free=False,
    level="senior",
    company="Walmart · Shipping Experience",
    title="On-time shipping reliability by category",
    difficulty="hard",
    prompt="Assess shipping reliability. For each `category`, return the **on-time rate** (`on_time_rate` = fraction where `actual_days <= promised_days`, rounded to 2 decimals) and the average delay in days (`avg_delay` = average of actual − promised, rounded to 2 decimals). Worst (lowest) on-time rate first.",
    schemaNote="shipments(id, category, promised_days, actual_days)",
    setupSql="""CREATE TABLE shipments (id INTEGER, category VARCHAR, promised_days INTEGER, actual_days INTEGER);
INSERT INTO shipments VALUES
 (1,'Electronics',3,2),(2,'Electronics',3,5),(3,'Electronics',2,2),
 (4,'Grocery',1,3),(5,'Grocery',1,4),(6,'Grocery',2,2),
 (7,'Apparel',5,4),(8,'Apparel',5,5);""",
    referenceSolution="""SELECT category,
       ROUND(AVG(CASE WHEN actual_days <= promised_days THEN 1.0 ELSE 0 END), 2) AS on_time_rate,
       ROUND(AVG(actual_days - promised_days), 2) AS avg_delay
FROM shipments
GROUP BY category
ORDER BY on_time_rate ASC;""",
    orderMatters=True,
    starter="SELECT category, \nFROM shipments\nGROUP BY category\n",
    hints=["On-time rate is AVG of a flag comparing actual to promised; avg_delay is AVG of the raw difference. Order ascending to surface the least reliable categories."],
)

P(
    id="stripe-capital-mom-growth",
    free=False,
    level="senior",
    company="Stripe · Capital",
    title="Month-over-month revenue growth by business",
    difficulty="hard",
    prompt="Inform financing eligibility from growth trends. For each `business_id`, return the **average month-over-month growth rate** (`avg_mom_growth` = average of (this month − prior month) / prior month across consecutive months, rounded to 3 decimals). Only businesses with at least two months appear. Order by `avg_mom_growth` descending.",
    schemaNote="monthly_revenue(id, business_id, month, revenue)",
    setupSql="""CREATE TABLE monthly_revenue (id INTEGER, business_id INTEGER, month VARCHAR, revenue DOUBLE);
INSERT INTO monthly_revenue VALUES
 (1,1,'2026-01',1000.0),(2,1,'2026-02',1200.0),(3,1,'2026-03',1500.0),
 (4,2,'2026-01',2000.0),(5,2,'2026-02',1800.0),(6,2,'2026-03',1980.0),
 (7,3,'2026-01',500.0),(8,3,'2026-02',1000.0);""",
    referenceSolution="""WITH growth AS (
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
ORDER BY avg_mom_growth DESC;""",
    orderMatters=True,
    starter="WITH growth AS (\n  SELECT business_id,\n         /* (rev - prior) / prior using LAG */\n  FROM monthly_revenue\n)\n",
    hints=["LAG(revenue) OVER (PARTITION BY business_id ORDER BY month) gives the prior month. Compute the per-month growth in a CTE, drop the NULL first-month rows, then AVG per business."],
)

P(
    id="stripe-payout-fee-burden",
    free=False,
    level="senior",
    company="Stripe · Connect",
    title="Fee & compliance burden by platform type",
    difficulty="hard",
    prompt="Compare cost burden across platform types. For each `platform_type`, return total payout volume (`total_payout`), the **fee burden** (`fee_pct` = total fee / total payout × 100, rounded to 2 decimals), and the **compliance burden** (`compliance_pct` = total compliance cost / total payout × 100, rounded to 2 decimals). Highest fee burden first.",
    schemaNote="payouts(id, platform_type, payout_amount, fee, compliance_cost)",
    setupSql="""CREATE TABLE payouts (id INTEGER, platform_type VARCHAR, payout_amount DOUBLE, fee DOUBLE, compliance_cost DOUBLE);
INSERT INTO payouts VALUES
 (1,'Marketplace',10000.0,250.0,100.0),
 (2,'Marketplace',5000.0,120.0,60.0),
 (3,'SaaS',8000.0,160.0,200.0),
 (4,'SaaS',4000.0,80.0,120.0),
 (5,'On-demand',6000.0,210.0,30.0);""",
    referenceSolution="""SELECT platform_type,
       SUM(payout_amount) AS total_payout,
       ROUND(100.0 * SUM(fee) / SUM(payout_amount), 2) AS fee_pct,
       ROUND(100.0 * SUM(compliance_cost) / SUM(payout_amount), 2) AS compliance_pct
FROM payouts
GROUP BY platform_type
ORDER BY fee_pct DESC;""",
    orderMatters=True,
    starter="SELECT platform_type, \nFROM payouts\nGROUP BY platform_type\n",
    hints=["Both burdens divide an aggregated cost by aggregated payout volume. Aggregate first, then take the ratios."],
)

P(
    id="linkedin-feed-content-consistency",
    free=False,
    level="senior",
    company="LinkedIn · Feed",
    title="Engagement consistency by content type",
    difficulty="hard",
    prompt="Find content types that drive high *and* consistent engagement. For each `content_type`, return average engagement (`avg_engagement`, rounded to 1 decimal) and the **standard deviation** of engagement (`engagement_stddev`, sample stddev rounded to 1 decimal — lower means more consistent). Order by `avg_engagement` descending.",
    schemaNote="posts(id, content_type, engagement_score, week)",
    setupSql="""CREATE TABLE posts (id INTEGER, content_type VARCHAR, engagement_score INTEGER, week INTEGER);
INSERT INTO posts VALUES
 (1,'Article',80,1),(2,'Article',82,2),(3,'Article',78,3),
 (4,'Video',95,1),(5,'Video',40,2),(6,'Video',90,3),
 (7,'Poll',60,1),(8,'Poll',62,2);""",
    referenceSolution="""SELECT content_type,
       ROUND(AVG(engagement_score), 1) AS avg_engagement,
       ROUND(STDDEV_SAMP(engagement_score), 1) AS engagement_stddev
FROM posts
GROUP BY content_type
ORDER BY avg_engagement DESC;""",
    orderMatters=True,
    starter="SELECT content_type, \nFROM posts\nGROUP BY content_type\n",
    hints=["STDDEV_SAMP measures spread. A high average with a low stddev (like Article) is the consistent winner; Video's high average hides big swings."],
)

P(
    id="x-advertiser-segment-funnel",
    free=False,
    level="senior",
    company="X · for Advertisers",
    title="CTR & conversion ranked by audience segment",
    difficulty="hard",
    prompt="Optimize targeting across audience segments. For each `audience_segment`, return **CTR** (`ctr` = total clicks / total impressions, rounded to 3 decimals), **conversion rate** (`cvr` = total conversions / total clicks, rounded to 3 decimals), and a `rank` by `cvr` (1 = best). Order by `rank`.",
    schemaNote="campaigns(id, audience_segment, impressions, clicks, conversions)",
    setupSql="""CREATE TABLE campaigns (id INTEGER, audience_segment VARCHAR, impressions INTEGER, clicks INTEGER, conversions INTEGER);
INSERT INTO campaigns VALUES
 (1,'Tech',100000,5000,500),
 (2,'Tech',50000,2000,150),
 (3,'Sports',80000,2400,120),
 (4,'Sports',40000,1200,60),
 (5,'Finance',60000,3000,600);""",
    referenceSolution="""WITH agg AS (
  SELECT audience_segment,
         ROUND(SUM(clicks) * 1.0 / SUM(impressions), 3) AS ctr,
         ROUND(SUM(conversions) * 1.0 / SUM(clicks), 3) AS cvr
  FROM campaigns
  GROUP BY audience_segment
)
SELECT audience_segment, ctr, cvr,
       RANK() OVER (ORDER BY cvr DESC) AS rank
FROM agg
ORDER BY rank;""",
    orderMatters=True,
    starter="WITH agg AS (\n  SELECT audience_segment,\n         /* ctr and cvr from aggregated totals */\n  FROM campaigns\n  GROUP BY audience_segment\n)\n",
    hints=["Compute CTR and CVR from summed totals in a CTE, then RANK() OVER (ORDER BY cvr DESC). Finance has low CTR but the best CVR — that's why the funnel split matters."],
)

P(
    id="x-influencer-revenue-trend",
    free=False,
    level="senior",
    company="X · Influencer Growth",
    title="Week-over-week revenue-per-engagement trend",
    difficulty="hard",
    prompt="Track monetization momentum per content type. For each `content_type` and `week`, return the **revenue per engagement** (`rev_per_eng` = revenue / engagement, rounded to 3 decimals) and the **change versus the prior week** (`wow_change`, rounded to 3 decimals; NULL for each type's first week). Order by `content_type`, then `week`.",
    schemaNote="content(id, content_type, week, revenue, engagement)",
    setupSql="""CREATE TABLE content (id INTEGER, content_type VARCHAR, week INTEGER, revenue DOUBLE, engagement INTEGER);
INSERT INTO content VALUES
 (1,'Sponsored',1,1000.0,5000),
 (2,'Sponsored',2,1500.0,6000),
 (3,'Sponsored',3,1200.0,6000),
 (4,'Organic',1,200.0,4000),
 (5,'Organic',2,300.0,5000);""",
    referenceSolution="""WITH rpe AS (
  SELECT content_type, week,
         revenue * 1.0 / engagement AS rev_per_eng
  FROM content
)
SELECT content_type, week,
       ROUND(rev_per_eng, 3) AS rev_per_eng,
       ROUND(rev_per_eng - LAG(rev_per_eng) OVER (PARTITION BY content_type ORDER BY week), 3) AS wow_change
FROM rpe
ORDER BY content_type, week;""",
    orderMatters=True,
    starter="WITH rpe AS (\n  SELECT content_type, week, revenue * 1.0 / engagement AS rev_per_eng\n  FROM content\n)\n",
    hints=["Compute revenue-per-engagement first, then LAG it partitioned by content_type ordered by week to get the prior week's value, and subtract."],
)

P(
    id="openai-chatgpt-complexity-balance",
    free=False,
    level="senior",
    company="OpenAI · ChatGPT",
    title="Best complexity level: satisfaction vs. latency",
    difficulty="hard",
    prompt="Find the complexity level with the best satisfaction-to-latency balance. For each `complexity`, return average satisfaction (`avg_sat`, rounded to 2 decimals), average response time in ms (`avg_rt`, rounded to 0 decimals), and a `rank` by the **balance score** (avg satisfaction / avg response time; 1 = best). Order by `rank`.",
    schemaNote="queries(id, complexity, satisfaction, response_time_ms)",
    setupSql="""CREATE TABLE queries (id INTEGER, complexity VARCHAR, satisfaction DOUBLE, response_time_ms INTEGER);
INSERT INTO queries VALUES
 (1,'simple',4.5,300),(2,'simple',4.7,350),
 (3,'moderate',4.6,800),(4,'moderate',4.4,900),
 (5,'complex',4.8,2000),(6,'complex',4.9,2200);""",
    referenceSolution="""WITH agg AS (
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
ORDER BY rank;""",
    orderMatters=True,
    starter="WITH agg AS (\n  SELECT complexity, AVG(satisfaction) AS avg_sat_raw,\n         AVG(response_time_ms) AS avg_rt_raw\n  FROM queries\n  GROUP BY complexity\n)\n",
    hints=["Keep the raw (unrounded) averages in the CTE so the balance score satisfaction/response_time ranks accurately, then round only in the final projection."],
)

P(
    id="uber-driver-earnings-per-hour",
    free=False,
    level="senior",
    company="Uber · Rides Performance",
    title="Earnings per active hour by driver",
    difficulty="hard",
    prompt="Maximize earnings per active hour. For each `driver_id`, return total earnings (`total_earnings`), total active hours (`active_hours` = sum of (end − start) in hours, rounded to 2 decimals), and **earnings per active hour** (`earnings_per_hour` = total earnings / active hours, rounded to 2 decimals). Highest earnings-per-hour first.",
    schemaNote="trips(id, driver_id, start_time, end_time, earnings)",
    setupSql="""CREATE TABLE trips (id INTEGER, driver_id INTEGER, start_time TIMESTAMP, end_time TIMESTAMP, earnings DOUBLE);
INSERT INTO trips VALUES
 (1,1,TIMESTAMP '2026-05-01 08:00:00',TIMESTAMP '2026-05-01 08:30:00',15.0),
 (2,1,TIMESTAMP '2026-05-01 09:00:00',TIMESTAMP '2026-05-01 09:45:00',22.0),
 (3,2,TIMESTAMP '2026-05-01 10:00:00',TIMESTAMP '2026-05-01 11:00:00',18.0),
 (4,2,TIMESTAMP '2026-05-01 12:00:00',TIMESTAMP '2026-05-01 12:30:00',12.0);""",
    referenceSolution="""SELECT driver_id,
       SUM(earnings) AS total_earnings,
       ROUND(SUM(epoch(end_time) - epoch(start_time)) / 3600.0, 2) AS active_hours,
       ROUND(SUM(earnings) / (SUM(epoch(end_time) - epoch(start_time)) / 3600.0), 2) AS earnings_per_hour
FROM trips
GROUP BY driver_id
ORDER BY earnings_per_hour DESC;""",
    orderMatters=True,
    starter="SELECT driver_id, \nFROM trips\nGROUP BY driver_id\n",
    hints=["epoch(end_time) - epoch(start_time) gives trip seconds; divide by 3600 for hours. Earnings-per-hour divides total earnings by total active hours."],
)

P(
    id="paypal-dispute-resolution",
    free=False,
    level="senior",
    company="PayPal · Buyer Protection",
    title="Dispute resolution speed by transaction type",
    difficulty="hard",
    prompt="Characterize dispute resolution per transaction type. For each `transaction_type`, return the **resolution rate** (`resolution_rate` = fraction where `resolved` is TRUE, rounded to 2 decimals), average resolution days (`avg_days`, rounded to 1 decimal), and the **median** resolution days (`median_days`, using the continuous percentile). Slowest average first.",
    schemaNote="disputes(id, transaction_type, resolution_days, resolved)",
    setupSql="""CREATE TABLE disputes (id INTEGER, transaction_type VARCHAR, resolution_days INTEGER, resolved BOOLEAN);
INSERT INTO disputes VALUES
 (1,'Goods',5,TRUE),(2,'Goods',7,TRUE),(3,'Goods',30,FALSE),
 (4,'Services',10,TRUE),(5,'Services',14,TRUE),(6,'Services',12,TRUE),
 (7,'Digital',2,TRUE),(8,'Digital',3,FALSE);""",
    referenceSolution="""SELECT transaction_type,
       ROUND(AVG(CASE WHEN resolved THEN 1.0 ELSE 0 END), 2) AS resolution_rate,
       ROUND(AVG(resolution_days), 1) AS avg_days,
       QUANTILE_CONT(resolution_days, 0.5) AS median_days
FROM disputes
GROUP BY transaction_type
ORDER BY avg_days DESC;""",
    orderMatters=True,
    starter="SELECT transaction_type, \nFROM disputes\nGROUP BY transaction_type\n",
    hints=["QUANTILE_CONT(resolution_days, 0.5) is the median — more robust to outliers than the mean. Compare it against avg_days to spot skew from stuck disputes."],
)


def verify():
    fails = 0
    ids = [p["id"] for p in PROBLEMS]
    if len(ids) != len(set(ids)):
        dupes = {x for x in ids if ids.count(x) > 1}
        print("DUPLICATE IDS:", dupes)
        fails += 1
    for p in PROBLEMS:
        try:
            con = duckdb.connect()
            con.execute(p["setupSql"])
            rows = con.execute(p["referenceSolution"]).fetchall()
            con.close()
            if len(rows) == 0:
                print(f"  WARN  {p['id']}: reference solution returned 0 rows")
        except Exception as e:
            fails += 1
            print(f"  FAIL  {p['id']}: {e}")
    print(f"\nVerified {len(PROBLEMS)} problems, {fails} hard failures.")
    return fails


OUT_PATH = "lib/data/practice/sql-interviewmaster.ts"

HEADER = '''import type { SqlItem } from "./types";

/**
 * Interview-Master-inspired SQL practice set (77 problems).
 *
 * Adapted from a scraped competitor catalog that listed only company + title +
 * a vague prompt — every schema, seed dataset, reference solution, and hint
 * here is original and self-contained. Each problem runs in-browser via
 * DuckDB-WASM and is graded on correctness; every reference solution was
 * executed against DuckDB before being committed (see
 * scripts/gen_sql_interviewmaster.py).
 *
 * Tiers map to levels: Easy -> junior, Medium -> mid, Hard -> senior.
 *
 * GENERATED FILE — edit scripts/gen_sql_interviewmaster.py and re-run it
 * instead of hand-editing, so solutions stay verified.
 */
export const SQL_INTERVIEWMASTER_ITEMS: SqlItem[] = [
'''


def tl(s: str) -> str:
    """Emit a JS template literal, escaping backslash, backtick and ${."""
    return "`" + s.replace("\\", "\\\\").replace("`", "\\`").replace("${", "\\${") + "`"


def emit() -> None:
    parts = [HEADER]
    for p in PROBLEMS:
        parts.append("  {\n")
        parts.append(f"    id: {json.dumps(p['id'], ensure_ascii=False)},\n")
        parts.append("    category: \"sql\",\n")
        parts.append("    executes: true,\n")
        parts.append(f"    free: {'true' if p['free'] else 'false'},\n")
        parts.append(f"    level: {json.dumps(p['level'], ensure_ascii=False)},\n")
        parts.append(f"    title: {json.dumps(p['title'], ensure_ascii=False)},\n")
        parts.append(f"    company: {json.dumps(p['company'], ensure_ascii=False)},\n")
        parts.append(f"    difficulty: {json.dumps(p['difficulty'], ensure_ascii=False)},\n")
        parts.append(f"    prompt: {json.dumps(p['prompt'], ensure_ascii=False)},\n")
        parts.append(f"    schemaNote: {json.dumps(p['schemaNote'], ensure_ascii=False)},\n")
        parts.append(f"    setupSql: {tl(p['setupSql'])},\n")
        parts.append(f"    referenceSolution: {tl(p['referenceSolution'])},\n")
        parts.append(f"    orderMatters: {'true' if p['orderMatters'] else 'false'},\n")
        parts.append(f"    starter: {tl(p['starter'])},\n")
        parts.append(f"    hints: {json.dumps(p['hints'], ensure_ascii=False)},\n")
        parts.append("  },\n")
    parts.append("];\n")
    with open(OUT_PATH, "w") as f:
        f.write("".join(parts))
    print(f"Wrote {len(PROBLEMS)} items to {OUT_PATH}")


if __name__ == "__main__":
    rc = verify()
    if rc:
        sys.exit(1)
    emit()
