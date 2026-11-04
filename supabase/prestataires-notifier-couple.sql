-- Donne à /api/prestataires/notifier-couple de quoi prévenir le couple par mail quand un
-- prestataire leur répond (pro_send), sans donner au prestataire un accès direct aux tables
-- du couple : weddings et wedding_members restent RLS-only côté couple, cette fonction est
-- security definer et ne renvoie que ce qu'il faut pour l'e-mail.
create or replace function public.pro_notify_couple_payload(c uuid)
returns table (to_email text, to_name text, couple text, vendor_name text)
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(nullif(m.email, ''), u.email)::text, m.display_name,
         trim(both ' &' from coalesce(w.partner1, '') || ' & ' || coalesce(w.partner2, '')),
         v.name
  from public.pro_clients pc
  join public.vendor_picks p on p.id = pc.pick_id
  join public.weddings w on w.id = p.wedding_id
  join public.wedding_members m on m.wedding_id = w.id
  join auth.users u on u.id = m.user_id
  join catalog.vendors v on v.id = pc.vendor_id
  where pc.id = c
    and coalesce(nullif(m.email, ''), u.email) is not null;
$$;
-- Réservée au serveur (clé service_role) : un prestataire connecté ne doit pas pouvoir lire lui-même
-- l'adresse de chaque organisateur. La route vérifie d'abord que c'est bien sa fiche (is_pro_member).
revoke all on function public.pro_notify_couple_payload(uuid) from public, anon, authenticated;
grant execute on function public.pro_notify_couple_payload(uuid) to service_role;

-- Les comptes qui gèrent une fiche (gérant et collaborateurs), pour /api/prestataires/notifier-vendor :
-- sans elle, seule l'adresse de la fiche est prévenue d'un message de couple.
create or replace function public.pro_notify_vendor_members(v uuid)
returns table (to_email text)
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(nullif(m.email, ''), u.email)::text
  from public.pro_members m
  join auth.users u on u.id = m.user_id
  where m.vendor_id = v
    and coalesce(nullif(m.email, ''), u.email) is not null;
$$;
revoke all on function public.pro_notify_vendor_members(uuid) from public, anon, authenticated;
grant execute on function public.pro_notify_vendor_members(uuid) to service_role;

-- Aperçu du dernier message, catégorie et zone du prestataire, pour le mail au couple (planche V20)
create or replace function public.pro_notify_couple_details(client_id uuid)
returns table (last_message text, category text, area text)
language sql
stable
security definer
set search_path = ''
as $$
  select (select m.body from public.vendor_messages m
           where m.wedding_id = p.wedding_id and m.vendor_id = p.vendor_id and m.from_vendor
           order by m.sent_at desc limit 1),
         cat.label,
         coalesce(v.city, v.region)
  from public.pro_clients pc
  join public.vendor_picks p on p.id = pc.pick_id
  join catalog.vendors v on v.id = pc.vendor_id
  left join catalog.categories cat on cat.slug = v.primary_category
  where pc.id = client_id;
$$;
revoke all on function public.pro_notify_couple_details(uuid) from public, anon, authenticated;
grant execute on function public.pro_notify_couple_details(uuid) to service_role;
