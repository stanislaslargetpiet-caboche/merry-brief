-- Pages SEO (/mariage/…) : le résumé du catalogue gagne les comptes du bloc « En chiffres » et de la FAQ locale
-- (D-287, 12 nov. 2026) : hébergement, 150 places assises et plus, cérémonie sur place, gare à moins de 30 min,
-- notes et avis Google. Reprend le résumé préparé du 11 nov. (D-268, exports/seo-stats-rapide-2026-11-11.sql) :
-- même vue matérialisée, mêmes fonctions, même tâche horaire pg_cron `seo-stats-refresh`, qui la relit par son nom.
-- Supabase > SQL Editor > New query, colle ce fichier, Run (après seo-stats.sql). Relançable.
-- Tant que ce fichier n'est pas collé, les pages s'affichent sans le bloc ni les questions locales.

drop materialized view if exists catalog.seo_stats_mv;

create materialized view catalog.seo_stats_mv as
  select v.primary_category, v.department, v.price_unit,
         count(*)::int as n,
         coalesce(array_agg(v.price_min) filter (where v.price_min > 0), '{}'::integer[]) as prices,
         count(*) filter (where v.beds > 0)::int as heberg,
         count(*) filter (where v.capacity_seated >= 150)::int as cap150,
         count(*) filter (where v.outdoor_ceremony or v.details->>'ceremony_on_site' = 'true')::int as ceremonie,
         count(*) filter (where v.station_minutes <= 30)::int as gare30,
         count(v.google_rating)::int as notes,
         coalesce(sum(v.google_rating), 0)::numeric as notes_somme,
         coalesce(sum(v.google_review_count) filter (where v.google_rating is not null), 0)::int as avis,
         count(*) filter (where v.google_rating >= 4.8 and v.google_review_count >= 20)::int as tres_bien_notes,
         count(*) filter (where v.google_review_count >= 100)::int as avis100
  from catalog.vendors v
  where v.status = 'active'
  group by v.primary_category, v.department, v.price_unit;

revoke all on catalog.seo_stats_mv from public, anon, authenticated;

create or replace function public.seo_catalog_stats()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'primary_category', g.primary_category, 'department', g.department, 'price_unit', g.price_unit,
    'n', g.n, 'prices', to_jsonb(g.prices),
    'heberg', g.heberg, 'cap150', g.cap150, 'ceremonie', g.ceremonie, 'gare30', g.gare30,
    'notes', g.notes, 'notes_somme', g.notes_somme, 'avis', g.avis,
    'tres_bien_notes', g.tres_bien_notes, 'avis100', g.avis100)), '[]'::jsonb)
  from catalog.seo_stats_mv g;
$$;
revoke all on function public.seo_catalog_stats() from public, anon, authenticated;
grant execute on function public.seo_catalog_stats() to service_role;

create or replace function public.seo_catalog_stats_refresh()
returns void
language sql
security definer
set search_path = ''
as $$ refresh materialized view catalog.seo_stats_mv; $$;
revoke all on function public.seo_catalog_stats_refresh() from public, anon, authenticated;
grant execute on function public.seo_catalog_stats_refresh() to service_role;

-- Contrôle : un groupe avec ses comptes, par exemple les lieux du Morbihan.
-- select g from jsonb_array_elements(public.seo_catalog_stats()) g where g->>'primary_category' = 'lieu' and g->>'department' = '56';
