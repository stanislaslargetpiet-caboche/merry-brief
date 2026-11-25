\set ON_ERROR_STOP on
-- Compteur de l'IA (supabase/ia-prestataires.sql) : un gérant de fiche sans mariage est compté, un compte
-- ni organisateur ni prestataire reste refusé. Base de test uniquement, tout est annulé.
begin;
\i supabase/ia-prestataires.sql
insert into auth.users (id, email) values
  ('99999999-9999-9999-9999-999999999999', 'presta@example.com'),
  ('88888888-8888-8888-8888-888888888888', 'personne@example.com');
insert into catalog.vendors (id, name, primary_category, status) values ('22222222-2222-2222-2222-222222222222', 'Domaine Test', 'lieu', 'active');
insert into public.pro_vendors (vendor_id) values ('22222222-2222-2222-2222-222222222222');
insert into public.pro_members (vendor_id, user_id, email) values ('22222222-2222-2222-2222-222222222222', '99999999-9999-9999-9999-999999999999', 'presta@example.com');
do $$
declare
  n integer;
begin
  -- 1. Le prestataire, sans mariage : deux appels comptés
  perform set_config('request.jwt.claim.sub', '99999999-9999-9999-9999-999999999999', true);
  perform public.merry_ai_tick();
  n := public.merry_ai_tick();
  if n <> 2 then
    raise exception '1: deux appels attendus pour le prestataire, %', n;
  end if;
  -- 2. Un compte sans mariage ni fiche : refusé
  perform set_config('request.jwt.claim.sub', '88888888-8888-8888-8888-888888888888', true);
  begin
    perform public.merry_ai_tick();
    raise exception '2: refus attendu';
  exception when raise_exception then
    if sqlerrm = '2: refus attendu' then
      raise;
    end if;
  end;
end $$;
rollback;
