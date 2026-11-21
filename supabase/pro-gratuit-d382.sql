-- D-382 (21 nov. 2026) : répondre aux demandes est gratuit pour les prestataires, les crédits sont suspendus.
-- Interrupteur : pro_offer.credits_on (faux par défaut). Tant qu'il est faux, pro_send ne débite rien et
-- n'écrit rien dans pro_ledger, pro_unlock débloque sans coût. Les soldes restent en base, intacts.
-- Pour remettre les crédits : update public.pro_offer set credits_on = true where id = 1;
-- pro_send repris de pro-collaborateurs-noms.sql (version en production le 21 nov. 2026, auteur de la réponse).
-- Rejoue sans risque ; à coller après espace-prestataire.sql, pro-credits-reponse.sql et pro-collaborateurs-noms.sql.

alter table public.pro_offer add column if not exists credits_on boolean not null default false;

create or replace function public.pro_credits_on()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select credits_on from public.pro_offer where id = 1), false);
$$;
revoke all on function public.pro_credits_on() from public, anon;
grant execute on function public.pro_credits_on() to authenticated;

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
  if first_reply and public.pro_credits_on() then
    cost := public.pro_reply_cost((select primary_category from catalog.vendors where id = x.vendor_id));
    update public.pro_vendors set credits = credits - cost where vendor_id = x.vendor_id and credits >= cost returning credits into bal;
    if bal is null then
      raise exception 'crédits insuffisants' using errcode = 'P0001';
    end if;
    insert into public.pro_ledger (vendor_id, kind, label, delta, balance)
      values (x.vendor_id, 'utilisation', 'Réponse à ' || coalesce(nullif(trim(x.names), ''), 'un couple'), -cost, bal);
  elsif not first_reply then
    update public.pro_clients set updated_at = now() where id = c;
  end if;

  insert into public.vendor_messages (wedding_id, vendor_id, from_vendor, body, pro_author_id)
    values (x.wedding_id, x.couple_vendor, true, trim(body),
            (select m.id from public.pro_members m where m.vendor_id = x.vendor_id and m.user_id = auth.uid() limit 1))
    returning id into out_id;
  return out_id;
end;
$$;
revoke all on function public.pro_send(uuid, text) from public, anon;
grant execute on function public.pro_send(uuid, text) to authenticated;

create or replace function public.pro_unlock(v uuid, w uuid)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  cost integer := case when public.pro_credits_on() then (select unlock_cost from public.pro_offer where id = 1) else 0 end;
  bal integer;
begin
  if not public.is_pro_member(v) then
    raise exception 'pas votre fiche' using errcode = '42501';
  end if;
  if cost is null then
    raise exception 'tarif du déblocage à définir (pro_offer.unlock_cost)' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.vendor_wishes where wedding_id = w and open_to_vendors) then
    raise exception 'projet fermé' using errcode = 'P0002';
  end if;
  if exists (select 1 from public.pro_unlocks where vendor_id = v and wedding_id = w) then
    return (select credits from public.pro_vendors where vendor_id = v);
  end if;
  if cost > 0 then
    update public.pro_vendors set credits = credits - cost where vendor_id = v and credits >= cost returning credits into bal;
    if bal is null then
      raise exception 'crédits insuffisants' using errcode = 'P0001';
    end if;
  else
    select credits into bal from public.pro_vendors where vendor_id = v;
  end if;
  insert into public.pro_unlocks (vendor_id, wedding_id, credits) values (v, w, cost);
  if cost > 0 then
    insert into public.pro_ledger (vendor_id, kind, label, delta, balance) values (v, 'utilisation', 'Projet de mariage débloqué', -cost, bal);
  end if;
  return coalesce(bal, 0);
end;
$$;
revoke all on function public.pro_unlock(uuid, uuid) from public, anon;
grant execute on function public.pro_unlock(uuid, uuid) to authenticated;
