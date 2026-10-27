-- Merry · espace prestataire (/pro) : les prestataires prennent la main sur leur fiche du catalogue
-- À coller dans Supabase > SQL Editor > New query, puis Run, APRÈS catalog.sql, catalog-filtres.sql,
-- prestataires.sql et lieux-rapides.sql. Le fichier peut être relancé sans risque : il ne supprime aucune donnée.
--
-- A. Comptes : qui gère quelle fiche (pro_vendors, pro_members, is_pro_member)
-- B. Revendiquer sa fiche : recherche publique (pro_search) ; le code par mail passe par /api/pro/claim
-- C. Ma fiche : modifications écrites dans catalog.vendors (pro_save_fiche, pro_set_photos), photos et fichiers
-- D. Tarifs (pro_formulas, pro_options) : le prix le plus bas devient le « À partir de » des couples
-- E. Disponibilités (pro_dates) et lien d'agenda (iCal)
-- F. Clients (pro_clients, pro_documents) et demandes des couples (pro_requests, pro_thread, pro_send)
-- G. Projets de mariage (accord des couples, pro_projects, pro_unlock, pro_propose)
-- H. Crédits et formules (pro_offer, pro_ledger) : montants à remplir, paiement à brancher
-- I. Propositions de fonctionnalités (pro_feedback) et chiffres du mois (pro_views, pro_stats)

-- ---------------------------------------------------------------------------
-- A. Comptes
-- ---------------------------------------------------------------------------

create table if not exists public.pro_vendors (
  vendor_id     uuid primary key references catalog.vendors (id) on delete cascade,
  plan          text not null default 'essentiel' check (plan in ('essentiel', 'confort', 'pro')),
  billing       text not null default 'mensuel' check (billing in ('mensuel', 'annuel')),
  renews_on     date,
  credits       integer not null default 0 check (credits >= 0),
  high_from     text not null default '1 mai',             -- saisons des tarifs, en toutes lettres
  high_to       text not null default '30 septembre',
  low_from      text not null default '1 octobre',
  low_to        text not null default '30 avril',
  ical_token    uuid not null default gen_random_uuid(),   -- lien d'agenda privé
  claimed_at    timestamptz not null default now()
);

create table if not exists public.pro_members (
  id          uuid primary key default gen_random_uuid(),
  vendor_id   uuid not null references public.pro_vendors (vendor_id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  email       text,
  role        text not null default 'gerant',
  created_at  timestamptz not null default now(),
  unique (vendor_id, user_id)
);
create index if not exists pro_members_user_idx on public.pro_members (user_id);

create or replace function public.is_pro_member(v uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.pro_members m where m.vendor_id = v and m.user_id = auth.uid());
$$;
revoke all on function public.is_pro_member(uuid) from public, anon;
grant execute on function public.is_pro_member(uuid) to authenticated;

alter table public.pro_vendors enable row level security;
alter table public.pro_members enable row level security;
drop policy if exists "prestataire: sa fiche" on public.pro_vendors;
create policy "prestataire: sa fiche" on public.pro_vendors for select to authenticated using (public.is_pro_member(vendor_id));
drop policy if exists "prestataire: ses saisons" on public.pro_vendors;
create policy "prestataire: ses saisons" on public.pro_vendors for update to authenticated
  using (public.is_pro_member(vendor_id)) with check (public.is_pro_member(vendor_id));
drop policy if exists "prestataire: son équipe" on public.pro_members;
create policy "prestataire: son équipe" on public.pro_members for select to authenticated using (public.is_pro_member(vendor_id));
-- Formule, crédits et lien d'agenda : seulement par les fonctions ci-dessous (et le paiement, plus tard)
revoke insert, update, delete on public.pro_vendors from authenticated, anon;
grant select on public.pro_vendors to authenticated;
grant update (high_from, high_to, low_from, low_to) on public.pro_vendors to authenticated;
revoke insert, update, delete on public.pro_members from authenticated, anon;
grant select on public.pro_members to authenticated;

-- La fiche et le compte du prestataire connecté (une ligne par fiche gérée)
create or replace function public.pro_me()
returns table (vendor_id uuid, role text)
language sql
stable
security definer
set search_path = ''
as $$
  select m.vendor_id, m.role from public.pro_members m where m.user_id = auth.uid() order by m.created_at;
$$;
revoke all on function public.pro_me() from public, anon;
grant execute on function public.pro_me() to authenticated;

-- Le premier dossier d'un fichier du stockage est la fiche du prestataire (<vendor_id>/…)
create or replace function public.is_pro_path(path text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  return public.is_pro_member(split_part(path, '/', 1)::uuid);
exception when others then
  return false;
end;
$$;
revoke all on function public.is_pro_path(text) from public, anon;
grant execute on function public.is_pro_path(text) to authenticated;

-- ---------------------------------------------------------------------------
-- B. Revendiquer sa fiche : recherche par nom ou SIRET, mail et téléphone masqués
-- ---------------------------------------------------------------------------

drop function if exists public.pro_search(text);
create or replace function public.pro_search(q text)
returns table (id uuid, name text, city text, address text, postal_code text, category text, photo text, email_hint text, phone_hint text, rating numeric, reviews integer, claimed boolean)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  t text := trim(coalesce(q, ''));
  digits text := regexp_replace(t, '[^0-9]', '', 'g');
begin
  if length(t) < 3 or length(t) > 120 then
    return;
  end if;
  return query
    select v.id, v.name, v.city, v.address, v.postal_code, coalesce(c.label, v.primary_category),
           (select p.storage_path from catalog.vendor_photos p where p.vendor_id = v.id order by p.position limit 1),
           case when v.email ~ '@' then left(v.email, 1) || '•••' || substring(v.email from '@.*$') end,
           case when length(regexp_replace(coalesce(v.phone, ''), '[^0-9]', '', 'g')) >= 8
                then left(regexp_replace(v.phone, '[^0-9]', '', 'g'), 2) || ' •• •• •• ' || right(regexp_replace(v.phone, '[^0-9]', '', 'g'), 2) end,
           v.google_rating, v.google_review_count,
           exists (select 1 from public.pro_vendors pv where pv.vendor_id = v.id)
    from catalog.vendors v
    left join catalog.categories c on c.slug = v.primary_category
    where v.status = 'active'
      and (v.name ilike '%' || replace(replace(t, '%', ''), '_', '') || '%'
           or (length(digits) >= 9 and (v.siret = digits or v.siren = left(digits, 9))))
    order by (lower(v.name) = lower(t)) desc, v.photos_count desc, v.wedding_signal desc
    limit 8;
end;
$$;
revoke all on function public.pro_search(text) from public;
grant execute on function public.pro_search(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- C. Ma fiche : les modifications vont droit dans le catalogue que lisent les couples
-- ---------------------------------------------------------------------------

-- Cérémonie en extérieur et parking : le choix du prestataire (details) passe avant ce que Merry a lu
-- sur son site. Les deux colonnes sont recréées en une fois (une seule réécriture de la table).
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'catalog' and table_name = 'vendors' and column_name = 'outdoor_ceremony'
      and generation_expression like '%outdoor_ceremony%'
  ) then
    alter table catalog.vendors
      drop column if exists outdoor_ceremony,
      drop column if exists parking,
      add column outdoor_ceremony boolean generated always as (
        case
          when details ->> 'outdoor_ceremony' in ('true', 'false') then (details ->> 'outdoor_ceremony')::boolean
          when (details ->> 'services') ~* 'c[ée]r[ée]monie[^",]{0,40}(jardin|parc|ext[ée]rieur|plein air|dehors|prairie|pelouse|terrasse|vignes?|verger|bord de)' then true
          when details ->> 'ceremony_on_site' = 'true' and details ->> 'outdoor_space' = 'true' then true
          when details ->> 'ceremony_on_site' = 'false' then false
        end
      ) stored,
      add column parking boolean generated always as (
        case
          when details ->> 'parking' in ('true', 'false') then (details ->> 'parking')::boolean
          when (details ->> 'services') ~* '(parking|stationnement|places de parc)' then true
        end
      ) stored;
  end if;
end $$;

-- Ce qu'un prestataire peut changer sur sa fiche (le reste du catalogue reste celui de Merry)
create or replace function public.pro_save_fiche(v uuid, patch jsonb)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  d jsonb := '{}'::jsonb;
  k text;
begin
  if not public.is_pro_member(v) then
    raise exception 'pas votre fiche' using errcode = '42501';
  end if;
  foreach k in array array['video_url', 'caterer_imposed', 'caterer_mode', 'music_end', 'outdoor_ceremony', 'parking', 'accessible', 'parking_note', 'includes'] loop
    if patch ? k then d := d || jsonb_build_object(k, patch -> k); end if;
  end loop;
  update catalog.vendors set
    description       = case when patch ? 'description' then nullif(left(patch ->> 'description', 3000), '') else description end,
    style_tags        = case when patch ? 'style_tags' then array(select jsonb_array_elements_text(patch -> 'style_tags')) else style_tags end,
    capacity_seated   = case when patch ? 'capacity_seated' then (patch ->> 'capacity_seated')::int else capacity_seated end,
    capacity_standing = case when patch ? 'capacity_standing' then (patch ->> 'capacity_standing')::int else capacity_standing end,
    beds              = case when patch ? 'beds' then (patch ->> 'beds')::int else beds end,
    airport_name      = case when patch ? 'airport_name' then nullif(left(patch ->> 'airport_name', 120), '') else airport_name end,
    airport_minutes   = case when patch ? 'airport_minutes' then (patch ->> 'airport_minutes')::smallint else airport_minutes end,
    station_name      = case when patch ? 'station_name' then nullif(left(patch ->> 'station_name', 120), '') else station_name end,
    station_minutes   = case when patch ? 'station_minutes' then (patch ->> 'station_minutes')::smallint else station_minutes end,
    -- une valeur null efface l'information (« je ne sais pas »), les autres la remplacent
    details           = (details - array(select key from jsonb_each(d) where value = 'null'::jsonb)) || jsonb_strip_nulls(d),
    updated_at        = now()
  where id = v;
end;
$$;
revoke all on function public.pro_save_fiche(uuid, jsonb) from public, anon;
grant execute on function public.pro_save_fiche(uuid, jsonb) to authenticated;

-- La fiche telle que le prestataire la modifie (même une fiche pas encore « active »)
create or replace function public.pro_fiche(v uuid)
returns setof catalog.vendors
language sql
stable
security definer
set search_path = ''
as $$
  select * from catalog.vendors where id = v and public.is_pro_member(v);
$$;
revoke all on function public.pro_fiche(uuid) from public, anon;
grant execute on function public.pro_fiche(uuid) to authenticated;

create or replace function public.pro_photos(v uuid)
returns table (id uuid, storage_path text, "position" smallint)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.storage_path, p.position from catalog.vendor_photos p where p.vendor_id = v and public.is_pro_member(v) order by p.position;
$$;
revoke all on function public.pro_photos(uuid) from public, anon;
grant execute on function public.pro_photos(uuid) to authenticated;

-- Photos dans l'ordre voulu (la première sert de couverture) ; les fichiers sont dans catalog-photos/<vendor_id>/
create or replace function public.pro_set_photos(v uuid, paths text[])
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
  if exists (select 1 from unnest(paths) p where p not like v::text || '/%') then
    raise exception 'photo hors de votre dossier' using errcode = '42501';
  end if;
  delete from catalog.vendor_photos where vendor_id = v;
  insert into catalog.vendor_photos (vendor_id, position, storage_path)
    select v, (o - 1)::smallint, p from unnest(paths) with ordinality as t(p, o);
  update catalog.vendors set photos_count = coalesce(array_length(paths, 1), 0), updated_at = now() where id = v;
end;
$$;
revoke all on function public.pro_set_photos(uuid, text[]) from public, anon;
grant execute on function public.pro_set_photos(uuid, text[]) to authenticated;

-- Le prestataire dépose et retire ses photos dans son dossier du stockage des photos du catalogue
drop policy if exists "prestataire: ses photos (ajout)" on storage.objects;
create policy "prestataire: ses photos (ajout)" on storage.objects for insert to authenticated
  with check (bucket_id = 'catalog-photos' and public.is_pro_path(name));
drop policy if exists "prestataire: ses photos (retrait)" on storage.objects;
create policy "prestataire: ses photos (retrait)" on storage.objects for delete to authenticated
  using (bucket_id = 'catalog-photos' and public.is_pro_path(name));

-- Fichiers du prestataire (vidéo, devis, captures) : stockage privé pro-fichiers/<vendor_id>/…
insert into storage.buckets (id, name, public, file_size_limit)
values ('pro-fichiers', 'pro-fichiers', false, 52428800)
on conflict (id) do nothing;
drop policy if exists "prestataire: ses fichiers (lecture)" on storage.objects;
create policy "prestataire: ses fichiers (lecture)" on storage.objects for select to authenticated
  using (bucket_id = 'pro-fichiers' and public.is_pro_path(name));
drop policy if exists "prestataire: ses fichiers (ajout)" on storage.objects;
create policy "prestataire: ses fichiers (ajout)" on storage.objects for insert to authenticated
  with check (bucket_id = 'pro-fichiers' and public.is_pro_path(name));
drop policy if exists "prestataire: ses fichiers (retrait)" on storage.objects;
create policy "prestataire: ses fichiers (retrait)" on storage.objects for delete to authenticated
  using (bucket_id = 'pro-fichiers' and public.is_pro_path(name));

-- ---------------------------------------------------------------------------
-- D. Tarifs
-- ---------------------------------------------------------------------------

create table if not exists public.pro_formulas (
  id          uuid primary key default gen_random_uuid(),
  vendor_id   uuid not null references public.pro_vendors (vendor_id) on delete cascade,
  name        text not null check (length(name) between 1 and 120),
  unit        text not null default 'forfait' check (unit in ('forfait', 'par_invite')),
  includes    text[] not null default '{}',
  price_high  integer check (price_high is null or price_high >= 0),
  price_low   integer check (price_low is null or price_low >= 0),
  position    integer not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists pro_formulas_vendor_idx on public.pro_formulas (vendor_id);

create table if not exists public.pro_options (
  id          uuid primary key default gen_random_uuid(),
  vendor_id   uuid not null references public.pro_vendors (vendor_id) on delete cascade,
  name        text not null check (length(name) between 1 and 120),
  unit        text not null default 'forfait' check (unit in ('forfait', 'nuit', 'par_invite', 'par_heure')),
  price       integer check (price is null or price >= 0),
  position    integer not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists pro_options_vendor_idx on public.pro_options (vendor_id);

-- Le prix le plus bas des formules devient le « À partir de » des couples (catalog.vendors.price_min)
create or replace function public.pro_sync_price()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v uuid := case when tg_op = 'DELETE' then old.vendor_id else new.vendor_id end;
  best_price integer;
  best_unit text;
begin
  select least(coalesce(f.price_low, f.price_high), coalesce(f.price_high, f.price_low)), f.unit
    into best_price, best_unit
    from public.pro_formulas f
    where f.vendor_id = v and coalesce(f.price_low, f.price_high) is not null
    order by 1 asc
    limit 1;
  if best_price is not null then
    update catalog.vendors set
      price_min = best_price,
      price_unit = case when best_unit = 'par_invite' then 'par_personne' when primary_category = 'lieu' then 'location' else 'forfait' end,
      updated_at = now()
    where id = v;
  end if;
  return null;
end;
$$;
drop trigger if exists pro_formulas_price on public.pro_formulas;
create trigger pro_formulas_price after insert or update or delete on public.pro_formulas
  for each row execute function public.pro_sync_price();

-- ---------------------------------------------------------------------------
-- E. Disponibilités
-- ---------------------------------------------------------------------------

create table if not exists public.pro_clients (
  id              uuid primary key default gen_random_uuid(),
  vendor_id       uuid not null references public.pro_vendors (vendor_id) on delete cascade,
  pick_id         uuid unique references public.vendor_picks (id) on delete set null,   -- la demande venue par Merry
  wedding_id      uuid references public.weddings (id) on delete set null,
  names           text not null check (length(names) between 1 and 120),               -- « Camille & Jules »
  wedding_date    date,
  date_label      text,                                                                  -- « Dates flexibles : juin 2027 »
  guests          integer,
  budget_label    text,
  source          text not null default 'hors_merry' check (source in ('merry', 'hors_merry')),
  stage           text not null default 'nouvelle' check (stage in ('nouvelle', 'devis', 'visite', 'reserve', 'perdu')),
  next_action     text,
  next_action_on  date,
  notes           text check (notes is null or length(notes) <= 5000),
  email           text,
  phone           text,
  lost_reason     text,
  answered_at     timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists pro_clients_vendor_idx on public.pro_clients (vendor_id);

create table if not exists public.pro_dates (
  id          uuid primary key default gen_random_uuid(),
  vendor_id   uuid not null references public.pro_vendors (vendor_id) on delete cascade,
  day         date not null,
  status      text not null check (status in ('option', 'reserve')),
  client_id   uuid references public.pro_clients (id) on delete set null,
  label       text,                                  -- le couple, s'il n'est pas dans Clients
  expires_on  date,                                  -- fin de l'option
  created_at  timestamptz not null default now(),
  unique (vendor_id, day)
);

create table if not exists public.pro_documents (
  id            uuid primary key default gen_random_uuid(),
  vendor_id     uuid not null references public.pro_vendors (vendor_id) on delete cascade,
  client_id     uuid references public.pro_clients (id) on delete cascade,
  name          text not null,
  storage_path  text not null,
  bytes         integer,
  created_at    timestamptz not null default now()
);
create index if not exists pro_documents_client_idx on public.pro_documents (client_id);

-- ---------------------------------------------------------------------------
-- H. Crédits (avant G : le déblocage d'un projet en dépense)
-- ---------------------------------------------------------------------------

-- Ce que Merry propose : une seule ligne, montants à remplir dans Table Editor (vide = « à définir »)
create table if not exists public.pro_offer (
  id            smallint primary key default 1 check (id = 1),
  plans         jsonb not null default '[
    {"key": "essentiel", "name": "Essentiel", "monthly": null, "yearly": null, "credits": null},
    {"key": "confort", "name": "Confort", "monthly": null, "yearly": null, "credits": null},
    {"key": "pro", "name": "Pro", "monthly": null, "yearly": null, "credits": null}
  ]'::jsonb,
  packs         jsonb not null default '[{"credits": null, "price": null}, {"credits": null, "price": null}, {"credits": null, "price": null}]'::jsonb,
  unlock_cost   integer,                -- crédits pour débloquer un projet de mariage
  explainer     text,                   -- « Comment sont utilisés les crédits »
  payments_on   boolean not null default false
);
insert into public.pro_offer (id) values (1) on conflict (id) do nothing;
alter table public.pro_offer enable row level security;
drop policy if exists "offre lisible" on public.pro_offer;
create policy "offre lisible" on public.pro_offer for select to authenticated using (true);
revoke insert, update, delete on public.pro_offer from authenticated, anon;
grant select on public.pro_offer to authenticated;

create table if not exists public.pro_ledger (
  id          uuid primary key default gen_random_uuid(),
  vendor_id   uuid not null references public.pro_vendors (vendor_id) on delete cascade,
  at          timestamptz not null default now(),
  kind        text not null check (kind in ('abonnement', 'achat', 'utilisation', 'remboursement')),
  label       text not null,
  delta       integer not null,
  balance     integer not null
);
create index if not exists pro_ledger_vendor_idx on public.pro_ledger (vendor_id, at desc);

-- ---------------------------------------------------------------------------
-- I. Propositions de fonctionnalités et chiffres du mois
-- ---------------------------------------------------------------------------

create table if not exists public.pro_feedback (
  id               uuid primary key default gen_random_uuid(),
  vendor_id        uuid not null references public.pro_vendors (vendor_id) on delete cascade,
  user_id          uuid default auth.uid(),
  body             text not null check (length(body) between 1 and 5000),
  page             text,
  screenshot_path  text,
  status           text not null default 'recue' check (status in ('recue', 'prevue', 'disponible')),
  created_at       timestamptz not null default now()
);

create table if not exists public.pro_views (
  id          bigint generated always as identity primary key,
  vendor_id   uuid not null references catalog.vendors (id) on delete cascade,
  wedding_id  uuid references public.weddings (id) on delete set null,
  viewed_at   timestamptz not null default now()
);
create index if not exists pro_views_vendor_idx on public.pro_views (vendor_id, viewed_at);

-- Un couple ouvre une fiche du catalogue : une vue de plus (au plus une par mariage et par jour)
create or replace function public.merry_log_view(v uuid, w uuid)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  insert into public.pro_views (vendor_id, wedding_id)
  select v, w
  where public.is_wedding_member(w)
    and exists (select 1 from catalog.vendors where id = v)
    and not exists (select 1 from public.pro_views x where x.vendor_id = v and x.wedding_id = w and x.viewed_at > now() - interval '1 day');
$$;
revoke all on function public.merry_log_view(uuid, uuid) from public, anon;
grant execute on function public.merry_log_view(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Droits des tables du prestataire : tout, sur sa propre fiche
-- ---------------------------------------------------------------------------

do $$
declare t text;
begin
  foreach t in array array['pro_formulas', 'pro_options', 'pro_clients', 'pro_dates', 'pro_documents', 'pro_feedback']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "prestataire: tout" on public.%I', t);
    execute format('create policy "prestataire: tout" on public.%I for all to authenticated
                    using (public.is_pro_member(vendor_id))
                    with check (public.is_pro_member(vendor_id))', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
  foreach t in array array['pro_ledger', 'pro_views']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "prestataire: lecture" on public.%I', t);
    execute format('create policy "prestataire: lecture" on public.%I for select to authenticated using (public.is_pro_member(vendor_id))', t);
    execute format('revoke insert, update, delete on public.%I from authenticated, anon', t);
    execute format('grant select on public.%I to authenticated', t);
  end loop;
end $$;

-- Le statut d'une proposition (« Reçue », « Prévue », « Disponible ») est celui de l'équipe Merry
revoke update on public.pro_feedback from authenticated;

-- ---------------------------------------------------------------------------
-- F. Demandes des couples : celles envoyées depuis « Demander les devis » à cette fiche
-- ---------------------------------------------------------------------------

-- Chaque nouvelle demande devient un client « Nouvelle demande », à qui répondre
create or replace function public.pro_sync(v uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if not public.is_pro_member(v) then
    return;
  end if;
  insert into public.pro_clients (vendor_id, pick_id, wedding_id, names, wedding_date, date_label, guests, budget_label, source, stage, next_action, next_action_on, created_at)
  select v, p.id, p.wedding_id,
         trim(both ' &' from coalesce(w.partner1, '') || ' & ' || coalesce(w.partner2, '')),
         w.wedding_date,
         nullif(q.dates[1], ''),
         case b.guests when '<50' then 40 when '50-100' then 80 when '100-150' then 120 when '150-200' then 170 when '>200' then 220 end,
         case when q.share_budget then case b.budget when '<15k' then 'Moins de 15 000 €' when '15-30k' then '15 000 à 30 000 €' when '30-50k' then '30 000 à 50 000 €' when '>50k' then 'Plus de 50 000 €' end end,
         'merry', 'nouvelle', 'Répondre', p.requested_at::date, p.requested_at
  from public.vendor_picks p
  join public.weddings w on w.id = p.wedding_id
  left join public.briefs b on b.id = w.brief_id
  left join public.quote_requests q on q.id = p.request_id
  where p.catalog_ref = 'catalog:' || v::text and p.request_id is not null
  on conflict (pick_id) do nothing;
end;
$$;
revoke all on function public.pro_sync(uuid) from public, anon;
grant execute on function public.pro_sync(uuid) to authenticated;

-- Le détail d'une demande : le couple, leur brief, leur message et leurs dates
create or replace function public.pro_requests(v uuid)
returns table (
  client_id uuid, pick_id uuid, wedding_id uuid, names text, requested_at timestamptz,
  wedding_date date, dates text[], guests text, budget text, region text, vibes text[], format text,
  message text, answered boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, p.id, p.wedding_id, c.names, p.requested_at,
         w.wedding_date, coalesce(q.dates, '{}'), b.guests,
         case when q.share_budget then b.budget end,
         coalesce(w.region, b.region), coalesce(b.vibes, '{}'), b.format,
         (select m.body from public.vendor_messages m
           where m.wedding_id = p.wedding_id and m.vendor_id = p.vendor_id and not m.from_vendor
           order by m.sent_at limit 1),
         exists (select 1 from public.vendor_messages m where m.wedding_id = p.wedding_id and m.vendor_id = p.vendor_id and m.from_vendor)
  from public.pro_clients c
  join public.vendor_picks p on p.id = c.pick_id
  join public.weddings w on w.id = p.wedding_id
  left join public.briefs b on b.id = w.brief_id
  left join public.quote_requests q on q.id = p.request_id
  where c.vendor_id = v and public.is_pro_member(v)
  order by p.requested_at desc;
$$;
revoke all on function public.pro_requests(uuid) from public, anon;
grant execute on function public.pro_requests(uuid) to authenticated;

-- Les messages échangés avec un couple venu par Merry (ceux de la fiche prestataire de son Budget)
create or replace function public.pro_thread(c uuid)
returns table (id uuid, from_vendor boolean, body text, sent_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select m.id, m.from_vendor, m.body, m.sent_at
  from public.pro_clients x
  join public.vendor_picks p on p.id = x.pick_id
  join public.vendor_messages m on m.wedding_id = p.wedding_id and m.vendor_id = p.vendor_id
  where x.id = c and public.is_pro_member(x.vendor_id)
  order by m.sent_at;
$$;
revoke all on function public.pro_thread(uuid) from public, anon;
grant execute on function public.pro_thread(uuid) to authenticated;

-- Le prestataire écrit au couple : le message arrive sur la fiche du prestataire, dans le Budget du couple
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
begin
  select pc.vendor_id, p.wedding_id, p.vendor_id as couple_vendor
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
  insert into public.vendor_messages (wedding_id, vendor_id, from_vendor, body)
    values (x.wedding_id, x.couple_vendor, true, trim(body))
    returning id into out_id;
  update public.pro_clients set answered_at = coalesce(answered_at, now()), updated_at = now() where id = c;
  return out_id;
end;
$$;
revoke all on function public.pro_send(uuid, text) from public, anon;
grant execute on function public.pro_send(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- G. Projets de mariage : des couples qui acceptent d'être contactés
-- ---------------------------------------------------------------------------

-- L'accord du couple et le mot qu'il laisse aux prestataires (écran couple à dessiner : vide en attendant)
alter table public.vendor_wishes add column if not exists open_to_vendors boolean not null default false;
alter table public.vendor_wishes add column if not exists vendor_note text check (vendor_note is null or length(vendor_note) <= 1000);

create table if not exists public.pro_unlocks (
  vendor_id   uuid not null references public.pro_vendors (vendor_id) on delete cascade,
  wedding_id  uuid not null references public.weddings (id) on delete cascade,
  credits     integer not null default 0,
  at          timestamptz not null default now(),
  proposed_at timestamptz,
  primary key (vendor_id, wedding_id)
);
alter table public.pro_unlocks enable row level security;
drop policy if exists "prestataire: lecture" on public.pro_unlocks;
create policy "prestataire: lecture" on public.pro_unlocks for select to authenticated using (public.is_pro_member(vendor_id));
revoke insert, update, delete on public.pro_unlocks from authenticated, anon;
grant select on public.pro_unlocks to authenticated;

-- Les projets ouverts autour du prestataire : prénoms et message masqués tant qu'il n'a pas débloqué
create or replace function public.pro_projects(v uuid, radius_km integer default 60)
returns table (
  wedding_id uuid, unlocked boolean, names text, area text, wedding_date date, date_unknown boolean,
  guests text, budget text, km integer, vibes text[], format text, note text
)
language sql
stable
security definer
set search_path = ''
as $$
  with me as (
    select lat, lng from catalog.vendors where id = v and public.is_pro_member(v)
  ), open_weddings as (
    select w.id, w.partner1, w.partner2, w.wedding_date, coalesce(w.region, b.region) as region,
           b.date_unknown, b.guests, b.budget, b.vibes, b.format, vw.vendor_note,
           (select pl.lat from public.merry_place(coalesce(w.region, b.region)) pl limit 1) as lat,
           (select pl.lng from public.merry_place(coalesce(w.region, b.region)) pl limit 1) as lng
    from public.vendor_wishes vw
    join public.weddings w on w.id = vw.wedding_id
    left join public.briefs b on b.id = w.brief_id
    where vw.open_to_vendors
  )
  select o.id, (u.wedding_id is not null),
         case when u.wedding_id is not null then trim(both ' &' from coalesce(o.partner1, '') || ' & ' || coalesce(o.partner2, '')) end,
         o.region, o.wedding_date, coalesce(o.date_unknown, false), o.guests, o.budget,
         round(2 * 6371 * asin(sqrt(power(sin(radians(o.lat - me.lat) / 2), 2) + cos(radians(me.lat)) * cos(radians(o.lat)) * power(sin(radians(o.lng - me.lng) / 2), 2))))::int,
         coalesce(o.vibes, '{}'), o.format,
         case when u.wedding_id is not null then o.vendor_note end
  from open_weddings o
  cross join me
  left join public.pro_unlocks u on u.vendor_id = v and u.wedding_id = o.id
  where o.lat is not null
    and 2 * 6371 * asin(sqrt(power(sin(radians(o.lat - me.lat) / 2), 2) + cos(radians(me.lat)) * cos(radians(o.lat)) * power(sin(radians(o.lng - me.lng) / 2), 2))) <= radius_km
    and not exists (select 1 from public.vendor_picks p where p.wedding_id = o.id and p.catalog_ref = 'catalog:' || v::text)
  order by 9;
$$;
revoke all on function public.pro_projects(uuid, integer) from public, anon;
grant execute on function public.pro_projects(uuid, integer) to authenticated;

-- Débloquer un projet : les crédits sont retirés une fois, le déblocage reste
create or replace function public.pro_unlock(v uuid, w uuid)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  cost integer := (select unlock_cost from public.pro_offer where id = 1);
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
  update public.pro_vendors set credits = credits - cost where vendor_id = v and credits >= cost returning credits into bal;
  if bal is null then
    raise exception 'crédits insuffisants' using errcode = 'P0001';
  end if;
  insert into public.pro_unlocks (vendor_id, wedding_id, credits) values (v, w, cost);
  if cost > 0 then
    insert into public.pro_ledger (vendor_id, kind, label, delta, balance) values (v, 'utilisation', 'Projet de mariage débloqué', -cost, bal);
  end if;
  return bal;
end;
$$;
revoke all on function public.pro_unlock(uuid, uuid) from public, anon;
grant execute on function public.pro_unlock(uuid, uuid) to authenticated;

-- Envoyer une proposition à un projet débloqué : le prestataire arrive dans « Mes prestataires » du couple,
-- avec son message, et devient un client « Devis envoyé » de son côté
create or replace function public.pro_propose(v uuid, w uuid, body text)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  cv record;
  couple_vendor uuid;
  pick uuid;
  client uuid;
begin
  if not public.is_pro_member(v) then
    raise exception 'pas votre fiche' using errcode = '42501';
  end if;
  if not exists (select 1 from public.pro_unlocks where vendor_id = v and wedding_id = w) then
    raise exception 'projet à débloquer d''abord' using errcode = '42501';
  end if;
  if length(trim(coalesce(body, ''))) = 0 or length(body) > 8000 then
    raise exception 'message vide ou trop long' using errcode = '22023';
  end if;
  select x.name, x.primary_category, x.city, x.region, x.phone, x.email, x.website, c.label as category_label
    into cv from catalog.vendors x left join catalog.categories c on c.slug = x.primary_category where x.id = v;
  insert into public.vendors (wedding_id, name, category, phone, email, website)
    values (w, cv.name, coalesce(cv.category_label, 'Prestataire'), cv.phone, cv.email, cv.website)
    returning id into couple_vendor;
  insert into public.vendor_messages (wedding_id, vendor_id, from_vendor, body) values (w, couple_vendor, true, trim(body));
  insert into public.vendor_picks (wedding_id, catalog_ref, category, data, checked, vendor_id)
    values (w, 'catalog:' || v::text,
            case when cv.primary_category in ('lieu', 'traiteur', 'dj', 'fleuriste', 'photographe') then cv.primary_category else 'autre' end,
            jsonb_build_object('name', cv.name, 'area', coalesce(cv.city, cv.region), 'catalogId', v),
            false, couple_vendor)
    on conflict (wedding_id, catalog_ref) do update set vendor_id = excluded.vendor_id
    returning id into pick;
  insert into public.pro_clients (vendor_id, pick_id, wedding_id, names, wedding_date, source, stage, next_action, next_action_on, answered_at)
    select v, pick, w, trim(both ' &' from coalesce(wd.partner1, '') || ' & ' || coalesce(wd.partner2, '')), wd.wedding_date,
           'merry', 'devis', 'Relancer', current_date + 3, now()
    from public.weddings wd where wd.id = w
    on conflict (pick_id) do update set stage = 'devis', answered_at = now()
    returning id into client;
  update public.pro_unlocks set proposed_at = now() where vendor_id = v and wedding_id = w;
  return client;
end;
$$;
revoke all on function public.pro_propose(uuid, uuid, text) from public, anon;
grant execute on function public.pro_propose(uuid, uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- I (suite). Les chiffres du mois sur l'accueil
-- ---------------------------------------------------------------------------

create or replace function public.pro_stats(v uuid)
returns table (views integer, picks integer, requests integer)
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select count(*)::int from public.pro_views x where x.vendor_id = v and x.viewed_at >= date_trunc('month', now())),
    (select count(*)::int from public.vendor_picks p where p.catalog_ref = 'catalog:' || v::text and p.created_at >= date_trunc('month', now())),
    (select count(*)::int from public.vendor_picks p where p.catalog_ref = 'catalog:' || v::text and p.requested_at >= date_trunc('month', now()))
  where public.is_pro_member(v);
$$;
revoke all on function public.pro_stats(uuid) from public, anon;
grant execute on function public.pro_stats(uuid) to authenticated;
