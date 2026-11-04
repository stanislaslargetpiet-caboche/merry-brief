-- Donne à /api/nouveau-membre de quoi prévenir l'équipe par mail quand quelqu'un rejoint le
-- mariage via un lien d'invitation (merry_join), sans donner à ce nouveau membre un accès direct
-- aux adresses du reste de l'équipe : wedding_members reste RLS-only, cette fonction est
-- security definer et ne renvoie que ce qu'il faut pour l'e-mail.
create or replace function public.merry_notify_new_member_payload(new_member_id uuid)
returns table (to_email text, to_name text, new_member_name text, couple text)
language sql
stable
security definer
set search_path = ''
as $$
  select other.email, other.display_name,
         joined.display_name,
         trim(both ' &' from coalesce(w.partner1, '') || ' & ' || coalesce(w.partner2, ''))
  from public.wedding_members joined
  join public.weddings w on w.id = joined.wedding_id
  join public.wedding_members other on other.wedding_id = joined.wedding_id and other.id <> joined.id
  where joined.id = new_member_id
    and joined.user_id is not null
    and other.user_id is not null
    and other.email is not null and other.email <> '';
$$;
-- Réservée au serveur (clé service_role) : le nouveau membre ne doit pas pouvoir lire lui-même
-- les adresses du reste de l'équipe. La route vérifie d'abord que c'est bien son propre membre.
revoke all on function public.merry_notify_new_member_payload(uuid) from public, anon, authenticated;
grant execute on function public.merry_notify_new_member_payload(uuid) to service_role;
