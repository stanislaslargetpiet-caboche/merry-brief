\set ON_ERROR_STOP on
-- D-382 (21 nov. 2026) : crédits suspendus. Interrupteur pro_offer.credits_on (supabase/pro-gratuit-d382.sql),
-- scénarios 1 à 3. Chaque scénario lève une exception s'il est faux. Base de test uniquement, tout est annulé.
begin;
-- Version de pro_send en production : collaborateurs (auteur de la réponse), puis l'interrupteur
\i supabase/pro-credits-reponse.sql
\i supabase/pro-collaborateurs.sql
\i supabase/pro-collaborateurs-noms.sql
\i supabase/pro-gratuit-d382.sql
insert into auth.users (id, email) values ('99999999-9999-9999-9999-999999999999', 'presta@example.com');
select set_config('request.jwt.claim.sub', '99999999-9999-9999-9999-999999999999', true);
insert into public.weddings (id, partner1, partner2) values ('11111111-1111-1111-1111-111111111111', 'Alice', 'Ben');
-- Un lieu (25 crédits la première réponse), 100 crédits, géré par l'utilisateur connecté
insert into catalog.vendors (id, name, primary_category, status) values ('22222222-2222-2222-2222-222222222222', 'Domaine Test', 'lieu', 'active');
insert into public.pro_vendors (vendor_id, credits) values ('22222222-2222-2222-2222-222222222222', 100);
insert into public.pro_members (vendor_id, user_id, email) values ('22222222-2222-2222-2222-222222222222', '99999999-9999-9999-9999-999999999999', 'presta@example.com');
-- Trois demandes de couples (une fiche côté couple + un choix + un client côté prestataire chacune)
insert into public.vendors (id, wedding_id, name) values
  ('a0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Domaine Test'),
  ('a0000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'Domaine Test bis'),
  ('a0000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'Domaine Test ter');
insert into public.vendor_picks (id, wedding_id, catalog_ref, category, vendor_id) values
  ('b0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'catalog:1', 'lieu', 'a0000000-0000-0000-0000-000000000001'),
  ('b0000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'catalog:2', 'lieu', 'a0000000-0000-0000-0000-000000000002'),
  ('b0000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'catalog:3', 'lieu', 'a0000000-0000-0000-0000-000000000003');
insert into public.pro_clients (id, vendor_id, pick_id, wedding_id, names, source) values
  ('c0000000-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'b0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Alice & Ben', 'merry'),
  ('c0000000-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 'b0000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'Camille & Jules', 'merry'),
  ('c0000000-0000-0000-0000-000000000003', '22222222-2222-2222-2222-222222222222', 'b0000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'Lou & Max', 'merry');


\echo '--- 1. crédits suspendus (par défaut) : la première réponse part, aucun débit, aucun historique'
select public.pro_send('c0000000-0000-0000-0000-000000000001', 'Bonjour, voici notre réponse.');
do $$ begin
  if (select credits_on from public.pro_offer where id = 1) then
    raise exception '1: credits_on devrait être faux par défaut';
  end if;
  if (select credits from public.pro_vendors where vendor_id = '22222222-2222-2222-2222-222222222222') <> 100 then
    raise exception '1: solde attendu 100, obtenu %', (select credits from public.pro_vendors where vendor_id = '22222222-2222-2222-2222-222222222222');
  end if;
  if exists (select 1 from public.pro_ledger where vendor_id = '22222222-2222-2222-2222-222222222222') then
    raise exception '1: aucune ligne d''historique attendue';
  end if;
  if (select answered_at from public.pro_clients where id = 'c0000000-0000-0000-0000-000000000001') is null then
    raise exception '1: la demande devrait être marquée répondue';
  end if;
  if (select count(*) from public.vendor_messages where vendor_id = 'a0000000-0000-0000-0000-000000000001' and from_vendor) <> 1 then
    raise exception '1: le message devrait être parti';
  end if;
end $$;

\echo '--- 2. solde à zéro et crédits suspendus : répondre reste possible'
update public.pro_vendors set credits = 0 where vendor_id = '22222222-2222-2222-2222-222222222222';
select public.pro_send('c0000000-0000-0000-0000-000000000002', 'Réponse sans crédits.');
do $$ begin
  if (select credits from public.pro_vendors where vendor_id = '22222222-2222-2222-2222-222222222222') <> 0 then
    raise exception '2: solde modifié';
  end if;
end $$;

\echo '--- 3. crédits remis (credits_on vrai) : la première réponse débite de nouveau le coût du métier'
update public.pro_offer set credits_on = true where id = 1;
update public.pro_vendors set credits = 100 where vendor_id = '22222222-2222-2222-2222-222222222222';
select public.pro_send('c0000000-0000-0000-0000-000000000003', 'Réponse payante.');
do $$ begin
  if (select credits from public.pro_vendors where vendor_id = '22222222-2222-2222-2222-222222222222') <> 75 then
    raise exception '3: solde attendu 75, obtenu %', (select credits from public.pro_vendors where vendor_id = '22222222-2222-2222-2222-222222222222');
  end if;
  if (select count(*) from public.pro_ledger where vendor_id = '22222222-2222-2222-2222-222222222222' and delta = -25) <> 1 then
    raise exception '3: une ligne d''historique (-25) attendue';
  end if;
end $$;
rollback;
