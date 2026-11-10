-- Pilotage, Couples › Par couple : dernière session Supabase de chaque compte, lue par /api/interne/pilotage.
-- Tant qu'un onglet Merry reste ouvert, Supabase rafraîchit la session environ chaque heure, même quand le couple a
-- refusé les cookies et que PostHog ne voit rien ; last_sign_in_at, lui, ne bouge qu'à la connexion. La date dit
-- « Merry était ouvert », pas « le couple a fait quelque chose ». Réservée au service_role, relançable sans risque.
-- Supabase > SQL Editor > New query, colle ce fichier, Run.
create or replace function public.pilotage_dernieres_sessions()
returns table (user_id uuid, dernier timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  -- refreshed_at est enregistré sans fuseau, en UTC
  select s.user_id, max(greatest(s.refreshed_at at time zone 'UTC', s.updated_at, s.created_at)) as dernier
  from auth.sessions s
  group by s.user_id;
$$;
revoke all on function public.pilotage_dernieres_sessions() from public, anon, authenticated;
grant execute on function public.pilotage_dernieres_sessions() to service_role;
