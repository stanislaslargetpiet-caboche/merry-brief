-- La première réponse à une demande coûte des crédits selon le métier (décision de Stan le 3 nov. 2026,
-- modèle à crédits du 27 oct. : 25 lieu, 20 traiteur, 15 photographe, 10 DJ, 8 fleuriste). Avant, seul le
-- déblocage d'un projet de mariage débitait ; répondre était gratuit. Même grille à l'écran
-- (lib/pro/format.js, REPLY_COSTS). Rejoue sans risque ; à coller après espace-prestataire.sql.

create or replace function public.pro_reply_cost(category text)
returns integer
language sql
immutable
as $$
  select case category
    when 'lieu' then 25
    when 'traiteur' then 20
    when 'photographe' then 15
    when 'videaste' then 15
    when 'dj' then 10
    when 'musiciens' then 10
    when 'fleuriste' then 8
    else 10
  end;
$$;

create or replace function public.pro_send(c uuid, body text)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  x record;
  out_id uuid;
  first_reply boolean;
  cost integer;
  bal integer;
begin
  select pc.vendor_id, pc.names, p.wedding_id, p.vendor_id as couple_vendor
    into x
    from public.pro_clients pc join public.vendor_picks p on p.id = pc.pick_id
    where pc.id = c;
  if x.vendor_id is null or not public.is_pro_member(x.vendor_id) then
    raise exception 'pas votre client' using errcode = '42501';
  end if;
  if x.couple_vendor is null then
    raise exception 'ce couple n''a pas encore de fiche pour vous' using errcode = 'P0002';
  end if;
  if length(trim(coalesce(body, ''))) = 0 or length(body) > 8000 then
    raise exception 'message vide ou trop long' using errcode = '22023';
  end if;

  -- Première réponse : marquée d'un coup (deux envois simultanés ne débitent qu'une fois)
  update public.pro_clients set answered_at = now(), updated_at = now() where id = c and answered_at is null;
  first_reply := found;
  if first_reply then
    cost := public.pro_reply_cost((select primary_category from catalog.vendors where id = x.vendor_id));
    update public.pro_vendors set credits = credits - cost where vendor_id = x.vendor_id and credits >= cost returning credits into bal;
    if bal is null then
      raise exception 'crédits insuffisants' using errcode = 'P0001';
    end if;
    insert into public.pro_ledger (vendor_id, kind, label, delta, balance)
      values (x.vendor_id, 'utilisation', 'Réponse à ' || coalesce(nullif(trim(x.names), ''), 'un couple'), -cost, bal);
  else
    update public.pro_clients set updated_at = now() where id = c;
  end if;

  insert into public.vendor_messages (wedding_id, vendor_id, from_vendor, body)
    values (x.wedding_id, x.couple_vendor, true, trim(body))
    returning id into out_id;
  return out_id;
end;
$$;
revoke all on function public.pro_send(uuid, text) from public, anon;
grant execute on function public.pro_send(uuid, text) to authenticated;
