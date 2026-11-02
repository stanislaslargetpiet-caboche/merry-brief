-- Merry · quotas et limites d'appels (ajout du 2 novembre 2026)
-- À coller dans Supabase > SQL Editor > New query, puis Run, APRÈS dashboard.sql. Relançable sans risque.
--
-- Une seule table de compteurs à fenêtre glissante, et deux fonctions :
--   merry_rate(kind, max_n, window_seconds)      pour la personne connectée (clé dérivée de auth.uid())
--   merry_throttle(key, max_n, window_seconds)   pour le serveur (clé libre : adresse IP, fiche, mail…),
--                                                réservée au rôle service_role
-- Chacune renvoie true si l'appel est permis (et le compte), false si la limite de la fenêtre est atteinte.
-- Elles servent aux routes qui coûtent de l'argent ou envoient des mails : recherche Google, photos Google,
-- mails aux prestataires et aux organisateurs, codes de connexion de l'espace prestataire, fiches ajoutées
-- à la main dans le catalogue.

create table if not exists public.rate_limits (
  key           text primary key,
  window_start  timestamptz not null default now(),
  n             integer not null default 0
);
alter table public.rate_limits enable row level security;  -- aucune règle : seules les fonctions y touchent
revoke all on public.rate_limits from anon, authenticated;

create or replace function public.merry_throttle(k text, max_n integer, window_seconds integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  n_now integer;
begin
  if k is null or length(k) = 0 or length(k) > 200 or max_n is null or max_n < 1 then
    return false;
  end if;
  insert into public.rate_limits as r (key, window_start, n) values (k, now(), 1)
  on conflict (key) do update
    set window_start = case when r.window_start < now() - make_interval(secs => window_seconds) then now() else r.window_start end,
        n = case when r.window_start < now() - make_interval(secs => window_seconds) then 1 else r.n + 1 end
  returning n into n_now;
  return n_now <= max_n;
end;
$$;
revoke all on function public.merry_throttle(text, integer, integer) from public, anon, authenticated;
grant execute on function public.merry_throttle(text, integer, integer) to service_role;

create or replace function public.merry_rate(kind text, max_n integer, window_seconds integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    return false;
  end if;
  return public.merry_throttle('user:' || auth.uid()::text || ':' || coalesce(kind, ''), max_n, window_seconds);
end;
$$;
revoke all on function public.merry_rate(text, integer, integer) from public, anon;
grant execute on function public.merry_rate(text, integer, integer) to authenticated, service_role;

-- Ménage : les compteurs vieux d'un jour ne servent plus (à appeler de temps en temps, ou par pg_cron)
create or replace function public.merry_rate_cleanup()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.rate_limits where window_start < now() - interval '1 day';
$$;
revoke all on function public.merry_rate_cleanup() from public, anon, authenticated;
