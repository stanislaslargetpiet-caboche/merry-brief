\set ON_ERROR_STOP on
begin;
insert into public.weddings (id, partner1, partner2, wedding_date, venue, region) values
  ('11111111-1111-1111-1111-111111111111', 'Alice', 'Ben', '2027-06-12', 'Mas', 'Provence'),
  ('22222222-2222-2222-2222-222222222222', 'Zoé', 'Yann', '2027-06-12', 'Château', 'Bretagne');
insert into public.wedding_sites (wedding_id, slug, published) values
  ('11111111-1111-1111-1111-111111111111', 'alice-ben-ab12', true),
  ('22222222-2222-2222-2222-222222222222', 'zoe-yann-zy34', true);
insert into public.events (id, wedding_id, name, short_name, position) values ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'Dîner', 'Dîner', 0);
insert into public.guest_forms (wedding_id, slug, fields, event_ids) values
  ('11111111-1111-1111-1111-111111111111', 'alice-ben-form1', '[{"key":"tel","mode":"opt"},{"key":"adresse","mode":"opt"},{"key":"presence","mode":"req"}]', array['33333333-3333-3333-3333-333333333333']::uuid[]);
insert into public.guests (id, wedding_id, first_name, last_name, email, phone, position) values
  ('44444444-4444-4444-4444-444444444444', '11111111-1111-1111-1111-111111111111', 'Marie', 'Dupont', 'marie@example.com', '0600000000', 0);

\echo '--- finder: wildcard must return null'
select public.merry_find_wedding(null, '%', null, '2027-06-12') as wildcard;
\echo '--- finder: one name alone must return null'
select public.merry_find_wedding(null, 'Alice', null, null) as one_name;
\echo '--- finder: two names in any order, accents ignored -> slug'
select public.merry_find_wedding(null, 'ben', 'ALICE', null) ->> 'slug' as two_names;
select public.merry_find_wedding(null, 'zoe', null, '2027-06-12') ->> 'slug' as name_and_date;
\echo '--- finder: code still works'
select public.merry_find_wedding('ALICE-BEN-AB12', null, null, null) ->> 'slug' as by_code;

\echo '--- form: stranger with same name and other email must NOT overwrite, only fill blanks'
select public.merry_form_submit('alice-ben-form1', '{"first_name":"Marie","last_name":"Dupont","email":"attacker@evil.com","phone":"0699999999","address":"1 rue X","answers":{"33333333-3333-3333-3333-333333333333":"non"}}');
select email, phone, address from public.guests where id = '44444444-4444-4444-4444-444444444444';
\echo '--- form: same email -> trusted, replaces phone'
select public.merry_form_submit('alice-ben-form1', '{"first_name":"marie","last_name":"DUPONT","email":"Marie@example.com","phone":"0611111111","answers":{"33333333-3333-3333-3333-333333333333":"oui"}}') ->> 'known' as known_must_be_null;
select email, phone, address from public.guests where id = '44444444-4444-4444-4444-444444444444';
\echo '--- form: new guest -> created with its contact'
select public.merry_form_submit('alice-ben-form1', '{"first_name":"Paul","last_name":"Martin","email":"paul@example.com","answers":{}}');
select first_name, email from public.guests where wedding_id = '11111111-1111-1111-1111-111111111111' order by position;
\echo '--- form: throttle at 200/h'
update public.guest_forms set rate_window_count = 200, rate_window_start = now() where slug = 'alice-ben-form1';
do $$ begin
  perform public.merry_form_submit('alice-ben-form1', '{"first_name":"Bot","last_name":"One","answers":{}}');
  raise exception 'throttle did not fire';
exception when others then
  if sqlerrm like 'Trop de réponses%' then raise notice 'throttle ok: %', sqlerrm; else raise; end if;
end $$;
\echo '--- form: window resets after an hour'
update public.guest_forms set rate_window_start = now() - interval '2 hours' where slug = 'alice-ben-form1';
select (public.merry_form_submit('alice-ben-form1', '{"first_name":"Bot","last_name":"Two","answers":{}}')) ->> 'ok' as after_reset;
select rate_window_count from public.guest_forms where slug = 'alice-ben-form1';
\echo '--- seating has no id column (why the pager tie-break matters)'
select count(*) filter (where column_name = 'id') as id_cols, count(*) filter (where column_name = 'guest_id') as guest_id_cols from information_schema.columns where table_name = 'seating';
rollback;
