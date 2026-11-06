-- Espace prestataire : suite de l'audit du 6 nov. 2026. Rejoue sans risque ; à coller après pro-securite.sql.
-- Aucun code ne dépend de ce fichier : il peut être collé tout de suite.

-- 1. Le fil d'un client survit quand le couple retire le prestataire. pro_clients.pick_id passe à vide à la
-- suppression de la sélection : le fil, payé en crédits, devenait illisible (cas Stan & Margue).
alter table public.pro_clients add column if not exists couple_vendor_id uuid;
alter table public.pro_clients drop constraint if exists pro_clients_couple_vendor_fk;
alter table public.pro_clients add constraint pro_clients_couple_vendor_fk
  foreign key (wedding_id, couple_vendor_id) references public.vendors (wedding_id, id) on delete set null (couple_vendor_id);

-- Les fils déjà perdus : la fiche côté couple porte le nom du prestataire
update public.pro_clients c set couple_vendor_id = x.id
from catalog.vendors cv, public.vendors x
where c.pick_id is null and c.source = 'merry' and c.couple_vendor_id is null and c.wedding_id is not null
  and cv.id = c.vendor_id and x.wedding_id = c.wedding_id and x.name = cv.name;

create or replace function public.pro_keep_couple_vendor()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.pro_clients set couple_vendor_id = old.vendor_id where pick_id = old.id and old.vendor_id is not null;
  return old;
end;
$$;
revoke all on function public.pro_keep_couple_vendor() from public, anon, authenticated;
drop trigger if exists vendor_picks_keep_thread on public.vendor_picks;
create trigger vendor_picks_keep_thread before delete on public.vendor_picks
  for each row execute function public.pro_keep_couple_vendor();

-- Lecture seule : pro_send continue de refuser d'écrire à un couple qui a retiré le prestataire
create or replace function public.pro_thread(c uuid)
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
  left join public.vendor_picks p on p.id = x.pick_id
  join public.vendor_messages m on m.wedding_id = coalesce(p.wedding_id, x.wedding_id) and m.vendor_id = coalesce(p.vendor_id, x.couple_vendor_id)
  left join public.pro_members a on a.id = m.pro_author_id
  where x.id = c and public.is_pro_member(x.vendor_id)
  order by m.sent_at;
$$;

-- 2. Le métier fixe le coût d'une réponse (pro_reply_cost) : il se verrouille à la première réponse payée,
-- sinon un lieu passe fleuriste, répond pour 8 crédits au lieu de 25, puis revient.
create or replace function public.pro_set_category(v uuid, category text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if not public.is_pro_member(v) then
    raise exception 'pas votre fiche' using errcode = '42501';
  end if;
  if not exists (select 1 from catalog.categories c where c.slug = category) then
    raise exception 'catégorie inconnue' using errcode = '22023';
  end if;
  if exists (select 1 from public.pro_ledger l where l.vendor_id = v and l.kind = 'utilisation') then
    raise exception 'métier verrouillé après la première réponse' using errcode = '42501';
  end if;
  update catalog.vendors set
    categories     = array(select distinct unnest(array_remove(categories, primary_category) || category)),
    primary_category = category,
    -- Même règle que le déclencheur de pro_formulas : un lieu se loue, les autres métiers sont au forfait
    price_unit     = case
      when price_unit = 'location' and category <> 'lieu' then 'forfait'
      when price_unit = 'forfait' and category = 'lieu' then 'location'
      else price_unit
    end,
    updated_at     = now()
  where id = v;
end;
$$;
