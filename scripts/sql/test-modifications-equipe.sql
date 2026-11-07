\set ON_ERROR_STOP on
begin;
insert into auth.users (id, email) values ('a1111111-1111-1111-1111-111111111111', 'leo@example.com');
insert into public.weddings (id, partner1, partner2) values ('b1111111-1111-1111-1111-111111111111', 'Léo', 'Margue');
insert into public.wedding_members (id, wedding_id, user_id, display_name) values
  ('c1111111-1111-1111-1111-111111111111', 'b1111111-1111-1111-1111-111111111111', 'a1111111-1111-1111-1111-111111111111', 'Léo');
insert into public.events (id, wedding_id, name, short_name) values ('d1111111-1111-1111-1111-111111111111', 'b1111111-1111-1111-1111-111111111111', 'Dîner', 'Dîner');
-- Invité ajouté il y a une heure, par personne (pas de session)
insert into public.guests (id, wedding_id, first_name, last_name, diet, created_at) values
  ('e1111111-1111-1111-1111-111111111111', 'b1111111-1111-1111-1111-111111111111', 'Philippe', 'Martel', 'Végétarien', now() - interval '1 hour');
insert into public.guest_responses (wedding_id, guest_id, event_id, status) values
  ('b1111111-1111-1111-1111-111111111111', 'e1111111-1111-1111-1111-111111111111', 'd1111111-1111-1111-1111-111111111111', 'attente');
delete from public.guest_activity;

\echo '--- an organiser changes a field, a custom column and a response'
select set_config('request.jwt.claim.sub', 'a1111111-1111-1111-1111-111111111111', true);
update public.guests set diet = 'Sans gluten', custom = '{"f1":"Navette"}', position = 4 where id = 'e1111111-1111-1111-1111-111111111111';
update public.guest_responses set status = 'oui' where guest_id = 'e1111111-1111-1111-1111-111111111111';
do $$ begin
  if (select count(*) from public.guest_activity) <> 3 then raise exception 'expected 3 rows, got %', (select count(*) from public.guest_activity); end if;
  if not exists (select 1 from public.guest_activity where kind = 'champ' and field = 'diet' and old_value = 'Végétarien' and new_value = 'Sans gluten' and member_id = 'c1111111-1111-1111-1111-111111111111' and source = 'organisateur' and guest_name = 'Philippe Martel') then
    raise exception 'diet change not logged';
  end if;
  if not exists (select 1 from public.guest_activity where field = 'custom:f1' and old_value is null and new_value = 'Navette') then raise exception 'custom change not logged'; end if;
  if not exists (select 1 from public.guest_activity where kind = 'reponse' and old_value = 'attente' and new_value = 'oui' and event_id = 'd1111111-1111-1111-1111-111111111111') then raise exception 'response not logged'; end if;
end $$;

\echo '--- a new guest logs one addition, not its responses'
delete from public.guest_activity;
insert into public.guests (id, wedding_id, first_name, last_name) values ('e2222222-2222-2222-2222-222222222222', 'b1111111-1111-1111-1111-111111111111', 'Claire', 'Dubois');
insert into public.guest_responses (wedding_id, guest_id, event_id, status) values
  ('b1111111-1111-1111-1111-111111111111', 'e2222222-2222-2222-2222-222222222222', 'd1111111-1111-1111-1111-111111111111', 'oui');
do $$ begin
  if (select count(*) from public.guest_activity) <> 1 or not exists (select 1 from public.guest_activity where kind = 'ajout' and guest_name = 'Claire Dubois') then
    raise exception 'addition not logged alone';
  end if;
end $$;

\echo '--- removing a guest keeps its name'
delete from public.guests where id = 'e2222222-2222-2222-2222-222222222222';
do $$ begin
  if not exists (select 1 from public.guest_activity where kind = 'retrait' and guest_name = 'Claire Dubois' and guest_id = 'e2222222-2222-2222-2222-222222222222') then raise exception 'removal not logged'; end if;
end $$;

\echo '--- without a session the change is marked as coming from the form'
select set_config('request.jwt.claim.sub', '', true);
update public.guests set phone = '0600000000' where id = 'e1111111-1111-1111-1111-111111111111';
do $$ begin
  if not exists (select 1 from public.guest_activity where field = 'phone' and source = 'formulaire' and member_id is null) then raise exception 'form change not marked'; end if;
end $$;

\echo '--- deleting the wedding still works'
delete from public.weddings where id = 'b1111111-1111-1111-1111-111111111111';
do $$ begin
  if exists (select 1 from public.guest_activity where wedding_id = 'b1111111-1111-1111-1111-111111111111') then raise exception 'activity left behind'; end if;
end $$;
rollback;
