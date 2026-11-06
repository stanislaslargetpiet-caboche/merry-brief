-- Espace prestataire : la date du dernier message de chaque couple, pour signaler une réponse reçue après la
-- première réponse du prestataire (maquette V1 ter, « À suivre »). Rejoue sans risque ; à coller après
-- pro-fils-et-metier.sql. Tant qu'elle n'est pas collée, l'écran n'affiche simplement pas ces lignes.

create or replace function public.pro_inbox(v uuid)
returns table (client_id uuid, last_couple_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select x.id, max(m.sent_at)
  from public.pro_clients x
  left join public.vendor_picks p on p.id = x.pick_id
  join public.vendor_messages m on m.wedding_id = coalesce(p.wedding_id, x.wedding_id) and m.vendor_id = coalesce(p.vendor_id, x.couple_vendor_id)
  where x.vendor_id = v and public.is_pro_member(v) and not m.from_vendor
  group by x.id;
$$;
revoke all on function public.pro_inbox(uuid) from public, anon;
grant execute on function public.pro_inbox(uuid) to authenticated;
