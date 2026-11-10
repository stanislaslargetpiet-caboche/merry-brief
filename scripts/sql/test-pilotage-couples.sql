\set ON_ERROR_STOP on
begin;
\echo '--- pilotage : couples connectés par jour, par connexion ou rafraîchissement de session, chaque couple une fois'
insert into auth.users (id, email, last_sign_in_at) values
  ('00000000-0000-0000-0000-0000000000c1', 'lea@example.com', now() - interval '3 days'),
  ('00000000-0000-0000-0000-0000000000c2', 'tom@example.com', null),
  ('00000000-0000-0000-0000-0000000000c3', 'seul@example.com', null);
insert into public.weddings (id, partner1, partner2, created_by) values ('00000000-0000-0000-0000-0000000000d1', 'Léa', 'Tom', '00000000-0000-0000-0000-0000000000c1');
insert into public.wedding_members (wedding_id, user_id, display_name, initial, color, position) values ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000c2', 'Tom', 'T', 'jaune', 1);
-- Léa et Tom ouvrent Merry le même jour : un seul couple ; un compte sans mariage ne compte pas ; il y a 30 jours, hors des 14 jours lus
insert into auth.refresh_tokens (user_id, created_at) values
  ('00000000-0000-0000-0000-0000000000c1', now()), ('00000000-0000-0000-0000-0000000000c1', now()),
  ('00000000-0000-0000-0000-0000000000c2', now()), ('00000000-0000-0000-0000-0000000000c3', now()),
  ('00000000-0000-0000-0000-0000000000c1', now() - interval '30 days');
insert into auth.sessions (user_id, created_at, refreshed_at) values ('00000000-0000-0000-0000-0000000000c2', now() - interval '9 days', (now() - interval '6 days') at time zone 'UTC');
do $$
declare
  serie jsonb := public.pilotage_stats(7)->'series';
  jour_de text := to_char((now() at time zone 'Europe/Paris')::date, 'YYYY-MM-DD');
  n_de int;
begin
  if jsonb_array_length(serie) <> 14 then raise exception 'expected 14 days, got %', jsonb_array_length(serie); end if;
  select (e->>'couples_connectes')::int into n_de from jsonb_array_elements(serie) e where e->>'jour' = jour_de;
  if n_de <> 1 then raise exception 'today: expected 1 couple, got %', n_de; end if;
  if (select sum((e->>'couples_connectes')::int) from jsonb_array_elements(serie) e) <> 4 then
    raise exception 'expected 4 couple-days (today, 3, 6 and 9 days ago), got %', (select sum((e->>'couples_connectes')::int) from jsonb_array_elements(serie) e);
  end if;
end $$;
rollback;
