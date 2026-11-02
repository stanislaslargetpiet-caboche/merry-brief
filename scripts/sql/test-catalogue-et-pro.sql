\set ON_ERROR_STOP on
begin;
-- Un organisateur connecté (auth.uid() via le shim), membre d'un mariage
insert into auth.users (id, email) values ('99999999-9999-9999-9999-999999999999', 'orga@example.com');
insert into public.weddings (id, partner1, partner2) values ('11111111-1111-1111-1111-111111111111', 'Alice', 'Ben');
insert into public.wedding_members (wedding_id, user_id, display_name, initial, color, position) values ('11111111-1111-1111-1111-111111111111', '99999999-9999-9999-9999-999999999999', 'Alice', 'A', 'jaune', 0);
select set_config('request.jwt.claim.sub', '99999999-9999-9999-9999-999999999999', true);

\echo '--- ajout manuel : fiche créée avec created_by_wedding, site vérifié'
select (public.merry_add_vendor_manual('11111111-1111-1111-1111-111111111111', 'Mas des Tests', 'lieu', 'Gordes', '04 90 00 00 00', 'mas-des-tests.fr') is not null) as created;
select created_by_wedding = '11111111-1111-1111-1111-111111111111' as owned, website from catalog.vendors where name = 'Mas des Tests';
\echo '--- ajout manuel : même nom = même fiche (pas de doublon)'
select count(*) as fiches from catalog.vendors where name = 'Mas des Tests'
  and public.merry_add_vendor_manual('11111111-1111-1111-1111-111111111111', 'mas des tests', 'lieu', 'Gordes') = id;
\echo '--- ajout manuel : site invalide refusé'
do $$ begin
  perform public.merry_add_vendor_manual('11111111-1111-1111-1111-111111111111', 'Autre Lieu', 'lieu', 'Gordes', null, 'pas un site');
  raise exception 'website check did not fire';
exception when others then
  if sqlerrm = 'invalid website' then raise notice 'website check ok'; else raise; end if;
end $$;
\echo '--- ajout manuel : quota du jour (30)'
update public.rate_limits set n = 30 where key like 'user:99999999-9999-9999-9999-999999999999:vendor_manual';
do $$ begin
  perform public.merry_add_vendor_manual('11111111-1111-1111-1111-111111111111', 'Encore Un Lieu', 'lieu', 'Gordes');
  raise exception 'quota did not fire';
exception when others then
  if sqlerrm = 'too many vendors today' then raise notice 'quota ok'; else raise; end if;
end $$;

\echo '--- espace prestataire : pro_set_photos garde les métadonnées des photos conservées'
insert into catalog.vendors (id, name, primary_category, status) values ('22222222-2222-2222-2222-222222222222', 'Domaine Pro', 'lieu', 'active');
insert into public.pro_vendors (vendor_id) values ('22222222-2222-2222-2222-222222222222');
insert into public.pro_members (vendor_id, user_id, email) values ('22222222-2222-2222-2222-222222222222', '99999999-9999-9999-9999-999999999999', 'orga@example.com');
insert into catalog.vendor_photos (vendor_id, position, storage_path, width, height, screenshot, shot_type, classified_at) values
  ('22222222-2222-2222-2222-222222222222', 0, '22222222-2222-2222-2222-222222222222/a.jpg', 1600, 900, false, 'exterieur', now()),
  ('22222222-2222-2222-2222-222222222222', 1, '22222222-2222-2222-2222-222222222222/b.jpg', 800, 600, true, 'autre', now());
select public.pro_set_photos('22222222-2222-2222-2222-222222222222', array['22222222-2222-2222-2222-222222222222/b.jpg', '22222222-2222-2222-2222-222222222222/c.jpg']);
select storage_path, position, width, screenshot, (classified_at is not null) as classified from catalog.vendor_photos where vendor_id = '22222222-2222-2222-2222-222222222222' order by position;
select photos_count from catalog.vendors where id = '22222222-2222-2222-2222-222222222222';

\echo '--- espace prestataire : pro_notify_couple_payload réservée au serveur'
select has_function_privilege('authenticated', 'public.pro_notify_couple_payload(uuid)', 'execute') as auth_can, has_function_privilege('service_role', 'public.pro_notify_couple_payload(uuid)', 'execute') as service_can;

\echo '--- espace prestataire : pro_propose réutilise la fiche du couple et refuse un second envoi immédiat'
insert into public.pro_unlocks (vendor_id, wedding_id, credits) values ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 10);
select (public.pro_propose('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'Bonjour, voici notre proposition.') is not null) as proposed;
select count(*) as fiches_chez_le_couple from public.vendors where wedding_id = '11111111-1111-1111-1111-111111111111' and name = 'Domaine Pro';
do $$ begin
  perform public.pro_propose('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'Et encore une.');
  raise exception 'second proposal was accepted';
exception when others then
  if sqlerrm like 'proposition déjà envoyée%' then raise notice 'propose throttle ok'; else raise; end if;
end $$;
update public.pro_unlocks set proposed_at = now() - interval '1 hour' where vendor_id = '22222222-2222-2222-2222-222222222222';
select (public.pro_propose('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'Une heure plus tard.') is not null) as proposed_again;
select count(*) as fiches_chez_le_couple_toujours from public.vendors where wedding_id = '11111111-1111-1111-1111-111111111111' and name = 'Domaine Pro';
rollback;
