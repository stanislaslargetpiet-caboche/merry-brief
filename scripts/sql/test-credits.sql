\set ON_ERROR_STOP on
-- Débit des crédits d'un prestataire : pro_send (première réponse à une demande, coût selon le métier).
-- Chaque scénario lève une exception s'il est faux, donc check.sh échoue. Base de test uniquement, tout est annulé.
begin;
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

\echo '--- 1. solde suffisant : -25 (lieu), une ligne d''historique'
select public.pro_send('c0000000-0000-0000-0000-000000000001', 'Bonjour, voici notre réponse.');
do $$ begin
  if (select credits from public.pro_vendors where vendor_id = '22222222-2222-2222-2222-222222222222') <> 75 then
    raise exception '1: solde attendu 75, obtenu %', (select credits from public.pro_vendors where vendor_id = '22222222-2222-2222-2222-222222222222');
  end if;
  if (select count(*) from public.pro_ledger where vendor_id = '22222222-2222-2222-2222-222222222222' and kind = 'utilisation' and delta = -25 and balance = 75) <> 1 then
    raise exception '1: une ligne d''historique (-25, solde 75) attendue';
  end if;
end $$;

\echo '--- 3. deux envois de suite sur la même demande : un seul débit (la course réelle à deux sessions est à part)'
select public.pro_send('c0000000-0000-0000-0000-000000000001', 'Et un second message tout de suite.');
do $$ begin
  if (select credits from public.pro_vendors where vendor_id = '22222222-2222-2222-2222-222222222222') <> 75 then
    raise exception '3: second envoi débité, solde %', (select credits from public.pro_vendors where vendor_id = '22222222-2222-2222-2222-222222222222');
  end if;
  if (select count(*) from public.pro_ledger where vendor_id = '22222222-2222-2222-2222-222222222222') <> 1 then
    raise exception '3: une seule ligne d''historique attendue';
  end if;
end $$;

\echo '--- 4. demande déjà répondue : aucun débit'
update public.pro_clients set answered_at = now() - interval '1 day' where id = 'c0000000-0000-0000-0000-000000000002';
select public.pro_send('c0000000-0000-0000-0000-000000000002', 'Réponse à une demande déjà traitée.');
do $$ begin
  if (select credits from public.pro_vendors where vendor_id = '22222222-2222-2222-2222-222222222222') <> 75 then
    raise exception '4: demande déjà répondue débitée, solde %', (select credits from public.pro_vendors where vendor_id = '22222222-2222-2222-2222-222222222222');
  end if;
  if (select count(*) from public.pro_ledger where vendor_id = '22222222-2222-2222-2222-222222222222') <> 1 then
    raise exception '4: aucune ligne d''historique de plus attendue';
  end if;
end $$;

\echo '--- 2. solde insuffisant : erreur claire, solde inchangé, demande toujours sans réponse'
update public.pro_vendors set credits = 10 where vendor_id = '22222222-2222-2222-2222-222222222222';
do $$ begin
  perform public.pro_send('c0000000-0000-0000-0000-000000000003', 'Pas assez de crédits.');
  raise exception '2: l''envoi aurait dû être refusé';
exception when others then
  if sqlerrm <> 'crédits insuffisants' then raise; end if;
end $$;
do $$ begin
  if (select credits from public.pro_vendors where vendor_id = '22222222-2222-2222-2222-222222222222') <> 10 then
    raise exception '2: solde modifié malgré le refus';
  end if;
  if (select answered_at from public.pro_clients where id = 'c0000000-0000-0000-0000-000000000003') is not null then
    raise exception '2: la demande est marquée répondue malgré le refus';
  end if;
  if (select count(*) from public.pro_ledger where vendor_id = '22222222-2222-2222-2222-222222222222') <> 1 then
    raise exception '2: ligne d''historique créée malgré le refus';
  end if;
end $$;

\echo '--- 5. Garantie Merry : une demande remboursée recrédite exactement le montant débité'
-- La Garantie n''est pas encore dans la base : aucune fonction de remboursement n''existe (seul le type
-- d''historique « remboursement » existe). Ce scénario échoue tant qu''elle n''est pas écrite ; quand elle
-- le sera, compléter ici : rembourser la demande c…01 (débitée 25) et vérifier solde +25 et une ligne
-- « remboursement » de +25, un second remboursement ne recréditant rien.
do $$ begin
  if not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                 where n.nspname = 'public' and (p.proname ilike '%garantie%' or p.proname ilike '%refund%' or p.proname ilike '%rembours%')) then
    raise exception '5: aucune fonction de Garantie Merry (remboursement) dans la base';
  end if;
end $$;
rollback;
