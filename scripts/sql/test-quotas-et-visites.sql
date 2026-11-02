\set ON_ERROR_STOP on
begin;
insert into public.weddings (id, partner1, partner2) values ('11111111-1111-1111-1111-111111111111', 'Alice', 'Ben');
insert into public.wedding_sites (wedding_id, slug, published) values ('11111111-1111-1111-1111-111111111111', 'alice-ben-ab12', true);
\echo '--- throttle: 3 allowed then refused'
select public.merry_throttle('ip:1.2.3.4', 3, 60) as a1, public.merry_throttle('ip:1.2.3.4', 3, 60) as a2, public.merry_throttle('ip:1.2.3.4', 3, 60) as a3, public.merry_throttle('ip:1.2.3.4', 3, 60) as a4_refused;
\echo '--- throttle: window reset'
update public.rate_limits set window_start = now() - interval '2 minutes' where key = 'ip:1.2.3.4';
select public.merry_throttle('ip:1.2.3.4', 3, 60) as after_reset;
\echo '--- merry_rate without user -> false'
select public.merry_rate('places', 10, 60) as anon_false;
\echo '--- merry_rate with user'
select set_config('request.jwt.claim.sub', '99999999-9999-9999-9999-999999999999', true);
select public.merry_rate('places', 2, 60) as u1, public.merry_rate('places', 2, 60) as u2, public.merry_rate('places', 2, 60) as u3_refused;
\echo '--- site visit: same visitor twice in an hour = 1 row, two visitors = 2, no visitor id always counts'
select public.merry_site_visit('alice-ben-ab12', 'visitorA');
select public.merry_site_visit('alice-ben-ab12', 'visitorA');
select public.merry_site_visit('alice-ben-ab12', 'visitorB');
select public.merry_site_visit('alice-ben-ab12', null);
select public.merry_site_visit('unknown-slug', 'visitorA');
select count(*) as visits from public.site_visits where wedding_id = '11111111-1111-1111-1111-111111111111';
\echo '--- merry_site_public no longer logs'
select public.merry_site_public('alice-ben-ab12') ->> 'slug';
select count(*) as visits_still from public.site_visits where wedding_id = '11111111-1111-1111-1111-111111111111';
\echo '--- grants: merry_throttle not executable by authenticated'
select has_function_privilege('authenticated', 'public.merry_throttle(text, integer, integer)', 'execute') as auth_can_throttle, has_function_privilege('service_role', 'public.merry_throttle(text, integer, integer)', 'execute') as service_can, has_function_privilege('authenticated', 'public.merry_rate(text, integer, integer)', 'execute') as auth_can_rate;
rollback;
