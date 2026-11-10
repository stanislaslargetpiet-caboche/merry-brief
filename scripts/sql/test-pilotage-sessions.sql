\set ON_ERROR_STOP on
begin;
\echo '--- pilotage : la dernière session de chaque compte, la plus récente de ses sessions et de leurs rafraîchissements'
insert into auth.sessions (user_id, created_at, updated_at, refreshed_at) values
  ('00000000-0000-0000-0000-0000000000a1', '2026-11-04 17:41+00', '2026-11-04 17:41+00', null),
  ('00000000-0000-0000-0000-0000000000a1', '2026-11-05 09:00+00', '2026-11-05 09:00+00', '2026-11-10 13:06'),
  ('00000000-0000-0000-0000-0000000000b2', '2026-11-08 08:00+00', '2026-11-09 07:30+00', null);
-- refreshed_at, sans fuseau, est lu en UTC quel que soit le fuseau de la connexion
set local time zone 'Europe/Paris';
do $$
begin
  if (select count(*) from public.pilotage_dernieres_sessions()) <> 2 then raise exception 'expected one row per account'; end if;
  if (select dernier from public.pilotage_dernieres_sessions() where user_id = '00000000-0000-0000-0000-0000000000a1') <> '2026-11-10 13:06+00' then
    raise exception 'refresh not read as UTC: %', (select dernier from public.pilotage_dernieres_sessions() where user_id = '00000000-0000-0000-0000-0000000000a1');
  end if;
  if (select dernier from public.pilotage_dernieres_sessions() where user_id = '00000000-0000-0000-0000-0000000000b2') <> '2026-11-09 07:30+00' then raise exception 'session without refresh not read'; end if;
  if has_function_privilege('anon', 'public.pilotage_dernieres_sessions()', 'execute')
     or has_function_privilege('authenticated', 'public.pilotage_dernieres_sessions()', 'execute')
     or not has_function_privilege('service_role', 'public.pilotage_dernieres_sessions()', 'execute') then
    raise exception 'function not reserved to service_role';
  end if;
end $$;
rollback;
