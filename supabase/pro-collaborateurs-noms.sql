-- Collaborateurs de l'espace prestataire : prénom, nom et couleur d'avatar modifiables, et auteur
-- affiché sur les réponses de la Messagerie (demande de Stan le 6 nov. 2026 : « voir directement qui a
-- répondu »). Rejoue sans risque ; à coller après pro-collaborateurs.sql et pro-credits-reponse.sql.
-- Tant que ce fichier n'est pas collé, l'écran retombe sur display_name et sur « Vous ».

alter table public.pro_members add column if not exists first_name text check (first_name is null or length(first_name) <= 80);
alter table public.pro_members add column if not exists last_name text check (last_name is null or length(last_name) <= 80);
-- Clé pastel de l'avatar (lavande, peche, bleu, sauge, jaune, rose) ; vide = couleur calculée sur l'identifiant
alter table public.pro_members add column if not exists color text check (color is null or color in ('lavande', 'peche', 'bleu', 'sauge', 'jaune', 'rose'));

-- Chaque collaborateur d'une fiche peut renommer les autres ; rien d'autre n'est modifiable en direct
-- (ni user_id, ni vendor_id, ni le jeton d'invitation)
grant update (first_name, last_name, color, display_name) on public.pro_members to authenticated;
drop policy if exists "prestataire: renommer" on public.pro_members;
create policy "prestataire: renommer" on public.pro_members for update to authenticated
  using (public.is_pro_member(vendor_id)) with check (public.is_pro_member(vendor_id));

-- Qui a écrit un message du prestataire
alter table public.vendor_messages add column if not exists pro_author_id uuid references public.pro_members (id) on delete set null;

-- Le prestataire écrit au couple : même fonction que pro-credits-reponse.sql, avec l'auteur en plus
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

  insert into public.vendor_messages (wedding_id, vendor_id, from_vendor, body, pro_author_id)
    values (x.wedding_id, x.couple_vendor, true, trim(body),
            (select m.id from public.pro_members m where m.vendor_id = x.vendor_id and m.user_id = auth.uid() limit 1))
    returning id into out_id;
  return out_id;
end;
$$;
revoke all on function public.pro_send(uuid, text) from public, anon;
grant execute on function public.pro_send(uuid, text) to authenticated;

-- Les messages d'un couple, avec l'auteur des réponses du prestataire (author_id, author_name, author_color)
drop function if exists public.pro_thread(uuid);
create function public.pro_thread(c uuid)
returns table (id uuid, from_vendor boolean, body text, sent_at timestamptz, author_id uuid, author_name text, author_color text)
language sql
stable
security definer
set search_path = ''
as $$
  select m.id, m.from_vendor, m.body, m.sent_at, a.id,
         coalesce(nullif(trim(concat_ws(' ', a.first_name, a.last_name)), ''), a.display_name, a.email),
         a.color
  from public.pro_clients x
  join public.vendor_picks p on p.id = x.pick_id
  join public.vendor_messages m on m.wedding_id = p.wedding_id and m.vendor_id = p.vendor_id
  left join public.pro_members a on a.id = m.pro_author_id
  where x.id = c and public.is_pro_member(x.vendor_id)
  order by m.sent_at;
$$;
revoke all on function public.pro_thread(uuid) from public, anon;
grant execute on function public.pro_thread(uuid) to authenticated;
