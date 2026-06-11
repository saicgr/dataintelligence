-- ByteShards mobile — 0009: recency for "most asked at <company>" (Company Packs).
-- Extends company_most_asked with `recent` — how many of a topic's mentions landed in the
-- last 90 days — so the pack screen can badge "asked recently". Same k-anonymity gate (>= 20
-- total debriefs); aggregate counts only, never row-level data.
-- NOTE: return type changes, so the old function must be dropped first.

drop function if exists public.company_most_asked(text, int);

create function public.company_most_asked(company_in text, lim int default 8)
returns table (topic text, n int, debriefs int, share real, recent int)
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
    (count(*)::real / nullif(total.cnt, 0)) as share,
    count(*) filter (where d.created_at > now() - interval '90 days')::int as recent
  from public.debriefs d, norm, total, unnest(d.topics) as t(topic)
  where d.company_norm = norm.cn
    and norm.cn <> ''
    and total.cnt >= 20            -- privacy gate: hide everything below the threshold
  group by t.topic, total.cnt
  order by n desc, t.topic
  limit greatest(1, least(coalesce(lim, 8), 25));
$$;

grant execute on function public.company_most_asked(text, int) to anon, authenticated;
