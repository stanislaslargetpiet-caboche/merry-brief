-- Pilotage, filtre 24 h : série heure par heure des mesures qui viennent de pilotage_stats (supabase/pilotage.sql),
-- pour que leurs graphes se dessinent comme ceux du Site (DayLine, courbes des 24 dernières heures contre les 24
-- d'avant). Reprend les mêmes CTE que pilotage_stats, à l'heure plutôt qu'au jour, toujours sur les 48 dernières
-- heures (pas de paramètre `days` : le filtre 24 h seul en a besoin).
-- Supabase > SQL Editor > New query, colle ce fichier, Run (après pilotage.sql).

create or replace function public.pilotage_stats_heures()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  since timestamptz := date_trunc('hour', now()) - interval '47 hours';
  out jsonb;
begin
  with
  heures as (
    select generate_series(since, date_trunc('hour', now()), interval '1 hour') as h
  ),
  mariages as (
    select date_trunc('hour', created_at) as h, count(*)::int as n
    from public.weddings where created_at >= since group by 1
  ),
  demandes as (
    select date_trunc('hour', created_at) as h, count(*)::int as n
    from public.quote_requests where created_at >= since group by 1
  ),
  -- Réponses au formulaire invités : une personne qui répond compte une fois par heure, quel que soit le nombre de moments
  reponses_formulaire as (
    select date_trunc('hour', created_at) as h, count(distinct guest_id)::int as n
    from public.guest_response_log where source = 'formulaire' and created_at >= since group by 1
  ),
  vues_pro as (
    select date_trunc('hour', viewed_at) as h, count(*)::int as n
    from public.pro_views where viewed_at >= since group by 1
  ),
  -- Couples qui ont ouvert Merry pendant cette heure : même définition que pilotage_stats, à l'heure
  comptes_couples as (
    select user_id::text as uid, wedding_id from public.wedding_members where user_id is not null
    union select created_by::text, id from public.weddings where created_by is not null
  ),
  presences as (
    select user_id::text as uid, created_at as at from auth.refresh_tokens where created_at >= since
    union all select user_id::text, created_at from auth.sessions where created_at >= since
    union all select user_id::text, refreshed_at at time zone 'UTC' from auth.sessions where refreshed_at at time zone 'UTC' >= since
    union all select id::text, last_sign_in_at from auth.users where last_sign_in_at >= since
  ),
  couples_connectes as (
    select date_trunc('hour', p.at) as h, count(distinct c.wedding_id)::int as n
    from presences p join comptes_couples c on c.uid = p.uid group by 1
  ),
  series as (
    select jsonb_agg(jsonb_build_object(
      'jour', to_char(h.h at time zone 'Europe/Paris', 'YYYY-MM-DD"T"HH24'),
      'mariages', coalesce(m.n, 0),
      'demandes', coalesce(q.n, 0),
      'reponses_formulaire', coalesce(rf.n, 0),
      -- Formulaires en ligne à la fin de cette heure-là : publiés et créés avant (un formulaire dépublié depuis n'est plus compté)
      'formulaires_live', (select count(*)::int from public.guest_forms f where f.published and f.created_at <= h.h + interval '1 hour'),
      'vues_pro', coalesce(vp.n, 0),
      'couples_connectes', coalesce(cc.n, 0)
    ) order by h.h) as rows
    from heures h
    left join mariages m on m.h = h.h
    left join demandes q on q.h = h.h
    left join reponses_formulaire rf on rf.h = h.h
    left join vues_pro vp on vp.h = h.h
    left join couples_connectes cc on cc.h = h.h
  )
  select jsonb_build_object('series', coalesce((select rows from series), '[]'::jsonb)) into out;
  return out;
end;
$$;
revoke all on function public.pilotage_stats_heures() from public, anon, authenticated;
grant execute on function public.pilotage_stats_heures() to service_role;
