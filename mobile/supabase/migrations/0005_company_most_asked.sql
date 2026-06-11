-- ByteShards mobile — 0004: "most asked at <company>" community moat.
-- Builds on the existing public.debriefs table (created in 0001) and complements the
-- existing public.most_asked(text) RPC. This adds:
--   1. company_most_asked(company_in, lim) — richer rows (topic, n, debriefs, share)
--      still gated to companies with >= 20 debriefs (k-anonymity privacy threshold).
--   2. company_debrief_counts — a SECURITY DEFINER view listing only companies that
--      have crossed the 20-debrief threshold (for an autocomplete / "covered" list),
--      exposing counts only, never individual rows.
-- Both aggregate across all users WITHOUT exposing any single debrief row.

-- Minimum debriefs before a company's data is surfaced at all (k-anonymity).
-- Kept inline (20) to match the existing most_asked() contract in 0001.

create or replace function public.company_most_asked(company_in text, lim int default 8)
returns table (topic text, n int, debriefs int, share real)
language sql
stable
security definer
set search_path = public
as $$
  with norm as (
    select lower(btrim(company_in)) as cn
  ),
  total as (
    select count(*)::int as cnt
    from public.debriefs d, norm
    where d.company_norm = norm.cn and norm.cn <> ''
  )
  select
    t.topic,
    count(*)::int as n,
    total.cnt as debriefs,
    (count(*)::real / nullif(total.cnt, 0)) as share
  from public.debriefs d, norm, total, unnest(d.topics) as t(topic)
  where d.company_norm = norm.cn
    and norm.cn <> ''
    and total.cnt >= 20            -- privacy gate: hide everything below the threshold
  group by t.topic, total.cnt
  order by n desc, t.topic
  limit greatest(1, least(coalesce(lim, 8), 25));
$$;

grant execute on function public.company_most_asked(text, int) to anon, authenticated;

-- Companies that have crossed the threshold + their debrief count. Counts only — no
-- topics, levels, outcomes, or per-row data. Drives a "we have data on N companies"
-- list / autocomplete without ever revealing who debriefed.
create or replace function public.company_debrief_counts()
returns table (company text, debriefs int)
language sql
stable
security definer
set search_path = public
as $$
  select
    -- a human-readable label: the most common original casing for this norm
    (array_agg(d.company order by d.created_at desc))[1] as company,
    count(*)::int as debriefs
  from public.debriefs d
  where d.company_norm <> ''
  group by d.company_norm
  having count(*) >= 20
  order by count(*) desc;
$$;

grant execute on function public.company_debrief_counts() to anon, authenticated;
