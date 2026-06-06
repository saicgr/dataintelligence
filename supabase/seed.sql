-- Seed the tools catalog (the source-of-truth content lives in lib/data/seed.ts
-- and is shipped in the app bundle). This populates the relational mirror used
-- for joins / future admin tooling and the free-tool tables.

insert into tools (slug, name, icon, track, sort_order) values
  ('snowflake','Snowflake','❄️','data_engineering',1),
  ('dbt','dbt','🔧','data_engineering',2),
  ('airflow','Apache Airflow','🌀','data_engineering',3),
  ('kafka','Apache Kafka','📡','data_engineering',4),
  ('spark','Apache Spark','⚡','data_engineering',5),
  ('databricks','Databricks','🧱','data_engineering',6),
  ('llms','LLMs & Prompting','🧠','ai_engineering',7),
  ('rag','RAG & Retrieval','🔎','ai_engineering',8),
  ('vectordb','Vector Databases','🧮','ai_engineering',9),
  ('agents','Agents & Evals','🤖','ai_engineering',10),
  ('sql','SQL','🗃️','core_skills',11),
  ('python','Python for Data','🐍','core_skills',12),
  ('systemdesign','System Design','🏗️','core_skills',13),
  ('datamodeling','Data Modeling','📐','core_skills',14)
on conflict (slug) do nothing;

-- A few sample jobs (the cron at /api/jobs/ingest fills in live listings).
insert into jobs (title, company, location, level, tools, url, source, posted_at) values
  ('Senior Data Engineer','Stripe','Remote (US)','senior','["snowflake","dbt","airflow"]','https://example.com/jobs/de-1','greenhouse','2026-05-21'),
  ('Senior AI Engineer','Anthropic','San Francisco, CA','senior','["llms","rag","vectordb"]','https://example.com/jobs/ai-1','greenhouse','2026-05-22'),
  ('Streaming Data Engineer','Confluent','Remote (US)','senior','["kafka","spark"]','https://example.com/jobs/de-2','lever','2026-05-19')
on conflict (url) do nothing;

-- Sample salary benchmarks (full set is generated in lib/data/seed.ts).
insert into salary_benchmarks (role, tool, level, region, currency, min, median, max, year) values
  ('Senior Snowflake Engineer','snowflake','senior','US','USD',140000,165000,200000,2026),
  ('Senior AI Engineer','llms','senior','US','USD',160000,187000,222000,2026),
  ('Mid dbt Engineer','dbt','mid','US','USD',94000,119000,154000,2026)
on conflict do nothing;
