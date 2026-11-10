\set ON_ERROR_STOP on
begin;
\echo '--- pilotage : les compteurs du catalogue viennent de la vue précalculée, en retard jusqu au rafraîchissement'
insert into catalog.vendors (name, primary_category, status, photos_count, email)
  select 'Fiche test ' || g, 'lieu', 'active', 3, 'a@b.c' from generate_series(1, 5) g;
select (public.pilotage_stats(7)->'totaux'->>'catalogue_actifs')::int as avant_rafraichissement;
-- refresh concurrently est interdit dans une transaction : le test rafraîchit sans « concurrently »
refresh materialized view catalog.pilotage_catalogue;
select (public.pilotage_stats(7)->'totaux'->>'catalogue_actifs')::int - (select count(*) from catalog.vendors where status = 'active') as ecart_apres_rafraichissement;
select (public.pilotage_stats(7)->'totaux'->>'catalogue_photos3')::int >= 5 as photos3_comptees;
select (public.pilotage_stats(7)->>'catalogue_calcule') is not null as date_de_calcul;
rollback;
