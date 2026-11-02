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
  select m.email, m.display_name,
         trim(both ' &' from coalesce(w.partner1, '') || ' & ' || coalesce(w.partner2, '')),
         v.name
  from public.pro_clients pc
  join public.vendor_picks p on p.id = pc.pick_id
  join public.weddings w on w.id = p.wedding_id
  join public.wedding_members m on m.wedding_id = w.id
  join catalog.vendors v on v.id = pc.vendor_id
  where pc.id = c
    and public.is_pro_member(pc.vendor_id)
    and m.email is not null and m.email <> '';
$$;
revoke all on function public.pro_notify_couple_payload(uuid) from public, anon;
grant execute on function public.pro_notify_couple_payload(uuid) to authenticated;
