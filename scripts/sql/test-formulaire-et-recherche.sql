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
  ('11111111-1111-1111-1111-111111111111', 'alice-ben-form1', '[{"key":"tel","mode":"opt"},{"key":"adresse","mode":"opt"},{"key":"presence","mode":"req"},{"key":"plusun","mode":"opt"}]', array['33333333-3333-3333-3333-333333333333']::uuid[]);
insert into public.guests (id, wedding_id, first_name, last_name, email, phone, position) values
  ('44444444-4444-4444-4444-444444444444', '11111111-1111-1111-1111-111111111111', 'Marie', 'Dupont', 'marie@example.com', '0600000000', 0),
  ('55555555-5555-5555-5555-555555555555', '11111111-1111-1111-1111-111111111111', 'Camille', 'Dupont', 'camille@example.com', '0600000001', 1);

\echo '--- finder: wildcard must return null'
select public.merry_find_wedding(null, '%', null, '2027-06-12') as wildcard;
\echo '--- finder: one name alone must return null'
select public.merry_find_wedding(null, 'Alice', null, null) as one_name;
\echo '--- finder: two names in any order, accents ignored -> slug'
select public.merry_find_wedding(null, 'ben', 'ALICE', null) ->> 'slug' as two_names;
select public.merry_find_wedding(null, 'zoe', null, '2027-06-12') ->> 'slug' as name_and_date;
\echo '--- finder: code still works'
select public.merry_find_wedding('ALICE-BEN-AB12', null, null, null) ->> 'slug' as by_code;

\echo '--- form: the answer replaces the contact details already in the list'
select public.merry_form_submit('alice-ben-form1', '{"first_name":"Marie","last_name":"Dupont","email":"marie.nouveau@example.com","phone":"0699999999","address":"1 rue X","answers":{"33333333-3333-3333-3333-333333333333":"non"}}');
do $$ begin
  if not exists (select 1 from public.guests where id = '44444444-4444-4444-4444-444444444444' and email = 'marie.nouveau@example.com' and phone = '0699999999' and address = '1 rue X') then
    raise exception 'answer did not replace contact details';
  end if;
end $$;
\echo '--- form: a field left empty keeps its value; the reply gives no hint about the list'
select public.merry_form_submit('alice-ben-form1', '{"first_name":"marie","last_name":"DUPONT","email":"marie.nouveau@example.com","phone":"","answers":{"33333333-3333-3333-3333-333333333333":"oui"}}') ->> 'known' as known_must_be_null;
do $$ begin
  if not exists (select 1 from public.guests where id = '44444444-4444-4444-4444-444444444444' and phone = '0699999999' and address = '1 rue X') then
    raise exception 'empty field erased a value';
  end if;
end $$;
\echo '--- form: a plus-one already in the list updates that guest, without a second row'
select public.merry_form_submit('alice-ben-form1', '{"first_name":"Marie","last_name":"Dupont","email":"marie.nouveau@example.com","answers":{"33333333-3333-3333-3333-333333333333":"oui"},"plus_one":{"first_name":"camille","last_name":"DUPONT","email":"camille.nouveau@example.com","phone":"0688888888","same_address":false}}');
do $$ begin
  if (select count(*) from public.guests where wedding_id = '11111111-1111-1111-1111-111111111111' and lower(first_name) = 'camille') <> 1 then
    raise exception 'plus-one duplicated a guest of the list';
  end if;
  if not exists (select 1 from public.guests g join public.guest_responses r on r.guest_id = g.id
                  where g.id = '55555555-5555-5555-5555-555555555555' and g.first_name = 'Camille' and g.email = 'camille.nouveau@example.com'
                    and g.phone = '0688888888' and g.plus_one_of is null and r.status = 'oui') then
    raise exception 'plus-one in the list did not receive the answer';
  end if;
end $$;
\echo '--- form: a plus-one unknown to the list becomes a +1 of the guest'
select public.merry_form_submit('alice-ben-form1', '{"first_name":"Marie","last_name":"Dupont","email":"marie.nouveau@example.com","answers":{},"plus_one":{"first_name":"Jean","last_name":"Durand","email":"jean@example.com"}}');
do $$ begin
  if not exists (select 1 from public.guests where first_name = 'Jean' and email = 'jean@example.com' and plus_one_of = '44444444-4444-4444-4444-444444444444') then
    raise exception 'new plus-one not created';
  end if;
end $$;
\echo '--- form: new guest -> created with its contact'
select public.merry_form_submit('alice-ben-form1', '{"first_name":"Paul","last_name":"Martin","email":"paul@example.com","answers":{}}');
select first_name, email from public.guests where wedding_id = '11111111-1111-1111-1111-111111111111' order by position;
\echo '--- couple: names split into two people'
select * from public.merry_split_couple('Lucie et Hugo', 'Lambert');
select * from public.merry_split_couple('Max & Anaïs', 'du Plessis');
select * from public.merry_split_couple('Lucie Lambert, Hugo', 'Lambert');
select * from public.merry_split_couple('Lucie', 'Lambert et Hugo Lambert');
select * from public.merry_split_couple('Jean-Baptiste', 'Saint-Exupéry');
do $$ begin
  if (select string_agg(first_name || '|' || last_name, ';') from public.merry_split_couple('Claire', 'et Pierre Morel')) <> 'Claire|Morel;Pierre|Morel' then
    raise exception 'one-line couple not split';
  end if;
end $$;
do $$ begin
  if (select count(*) from public.merry_split_couple('Jean-Baptiste', 'Saint-Exupéry')) <> 1 then raise exception 'single name was split'; end if;
  if (select string_agg(first_name || '|' || last_name, ';') from public.merry_split_couple('Lucie Lambert, Hugo', 'Lambert')) <> 'Lucie|Lambert;Hugo|Lambert' then
    raise exception 'repeated last name not stripped';
  end if;
end $$;
insert into public.guests (id, wedding_id, first_name, last_name, position) values
  ('66666666-6666-6666-6666-666666666661', '11111111-1111-1111-1111-111111111111', 'Lucie', 'Lambert', 10),
  ('66666666-6666-6666-6666-666666666662', '11111111-1111-1111-1111-111111111111', 'Hugo', 'Lambert', 11),
  ('66666666-6666-6666-6666-666666666663', '11111111-1111-1111-1111-111111111111', 'Inès', 'Lambert', 12),
  ('77777777-7777-7777-7777-777777777771', '11111111-1111-1111-1111-111111111111', 'Maximilien', 'du Plessis', 13),
  ('77777777-7777-7777-7777-777777777772', '11111111-1111-1111-1111-111111111111', 'Anais', 'du Plessis', 14);
\echo '--- couple: one answer fills both rows of the list, no third row'
select public.merry_form_submit('alice-ben-form1', '{"first_name":"Lucie et Hugo","last_name":"Lambert","email":"lucie@example.com","phone":"0611111111","answers":{"33333333-3333-3333-3333-333333333333":"oui"}}');
do $$ begin
  if exists (select 1 from public.guests where first_name ilike '%et%' and last_name = 'Lambert') then raise exception 'couple row created'; end if;
  if (select count(*) from public.guest_responses where guest_id in ('66666666-6666-6666-6666-666666666661', '66666666-6666-6666-6666-666666666662') and status = 'oui') <> 2 then
    raise exception 'both people did not get the answer';
  end if;
  if exists (select 1 from public.guest_responses where guest_id = '66666666-6666-6666-6666-666666666663') then raise exception 'sister got the answer'; end if;
  if (select email from public.guests where id = '66666666-6666-6666-6666-666666666661') <> 'lucie@example.com'
     or (select email from public.guests where id = '66666666-6666-6666-6666-666666666662') is not null then
    raise exception 'email must go to the first person only';
  end if;
end $$;
\echo '--- couple: a shortened first name (Max for Maximilien) is found under the same last name'
select public.merry_form_submit('alice-ben-form1', '{"first_name":"Max et Anaïs","last_name":"du Plessis","answers":{"33333333-3333-3333-3333-333333333333":"non"}}');
do $$ begin
  if (select count(*) from public.guests where last_name = 'du Plessis') <> 2 then raise exception 'du Plessis row added'; end if;
  if (select count(*) from public.guest_responses where guest_id in ('77777777-7777-7777-7777-777777777771', '77777777-7777-7777-7777-777777777772') and status = 'non') <> 2 then
    raise exception 'Max and Anaïs did not both get the answer';
  end if;
end $$;
\echo '--- couple: unknown to the list -> two rows in the same group, each with the answer'
select public.merry_form_submit('alice-ben-form1', '{"first_name":"Marie-Anne et Jean","last_name":"Perrin","answers":{"33333333-3333-3333-3333-333333333333":"oui"}}');
do $$ begin
  if (select count(*) from public.guests where last_name = 'Perrin' and first_name in ('Marie-Anne', 'Jean')) <> 2
     or exists (select 1 from public.guests where last_name = 'Perrin' and first_name like '% et %') then
    raise exception 'unknown couple not split into two rows';
  end if;
  if (select count(*) from public.guest_responses r join public.guests g on g.id = r.guest_id where g.last_name = 'Perrin' and r.status = 'oui') <> 2 then
    raise exception 'unknown couple did not both get the answer';
  end if;
end $$;
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
\echo '--- form: the editor writes back every column it reads (shared_at included), column grants must follow'
do $$ declare col text; begin
  for col in select column_name from information_schema.columns where table_schema = 'public' and table_name = 'guest_forms'
             and column_name not in ('submissions', 'created_at', 'rate_window_start', 'rate_window_count') loop
    if not has_column_privilege('authenticated', 'public.guest_forms', col, 'INSERT') or not has_column_privilege('authenticated', 'public.guest_forms', col, 'UPDATE') then
      raise exception 'authenticated cannot write guest_forms.%: every form save would be refused (42501)', col;
    end if;
  end loop;
end $$;
rollback;
