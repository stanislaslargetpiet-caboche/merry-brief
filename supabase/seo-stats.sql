-- Pages SEO (/mariage/…) : les comptes et les prix du catalogue en une seule requête.
-- Avant, lib/seo/data.js relisait les 20 000 fiches actives par pages de 500 (une quarantaine de requêtes) ;
-- quand la base n'avait pas ces lignes en mémoire, plusieurs dépassaient le délai de 8 s de l'API et la
-- page répondait en erreur. L'index ci-dessous contient tout ce que la requête lit : elle ne touche plus la
-- table, et reste rapide à froid. Relançable sans risque.
-- Supabase > SQL Editor > New query, colle ce fichier, Run (après catalog.sql).

create index if not exists vendors_seo_stats_idx
  on catalog.vendors (primary_category, department)
  include (price_min, price_unit)
  where status = 'active';

-- Un groupe par métier, département et unité de prix : le nombre de fiches actives et leurs prix de départ.
-- Renvoie un seul tableau JSON et non des lignes : il y a plus de 1 000 groupes, et l'API tronque à 1 000 lignes.
-- Réservée au service_role (lue côté serveur par les pages SEO, jamais par le navigateur).
create or replace function public.seo_catalog_stats()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'primary_category', g.primary_category, 'department', g.department, 'price_unit', g.price_unit, 'n', g.n, 'prices', to_jsonb(g.prices))), '[]'::jsonb)
  from (
    select v.primary_category, v.department, v.price_unit,
           count(*)::int as n,
           coalesce(array_agg(v.price_min) filter (where v.price_min > 0), '{}'::integer[]) as prices
    from catalog.vendors v
    where v.status = 'active'
    group by v.primary_category, v.department, v.price_unit
  ) g;
$$;
revoke all on function public.seo_catalog_stats() from public, anon, authenticated;
grant execute on function public.seo_catalog_stats() to service_role;
