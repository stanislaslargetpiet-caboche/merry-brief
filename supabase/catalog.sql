-- Merry · catalogue des prestataires (schéma « catalog »)
-- À coller dans Supabase > SQL Editor > New query, puis Run, AVANT catalog-filtres.sql, lieux-rapides.sql,
-- qualite-photos.sql, categories-principales.sql et espace-prestataire.sql. Relançable sans risque : sur une base
-- qui a déjà le catalogue (151 000 fiches), chaque instruction est un « si absent » et ne touche aucune donnée.
--
-- Ce fichier a été reconstitué le 2 novembre 2026 à partir de tout ce que l'appli, les scripts et les autres
-- fichiers SQL lisent et écrivent dans le schéma (il manquait au dépôt : la base ne pouvait pas être recréée de
-- zéro, et la CI ne pouvait pas rejouer les fichiers qui en dépendent). Les colonnes d'accès et de filtre
-- (aéroport, gare, traiteur imposé…) sont ajoutées par catalog-filtres.sql ; la qualité des photos par
-- qualite-photos.sql ; created_by_wedding par prestataires-ajout-manuel-fix-ambiguite.sql.
--
-- Après ce fichier : Supabase > Project Settings > API > Exposed schemas, ajouter « catalog » (l'appli lit le
-- catalogue avec la clé publique, sous les règles d'accès ci-dessous).

create schema if not exists catalog;
grant usage on schema catalog to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Catégories (onglets de « Trouver des prestataires », libellés des fiches)
-- ---------------------------------------------------------------------------

create table if not exists catalog.categories (
  slug      text primary key,
  label     text not null,
  position  smallint not null default 0
);
insert into catalog.categories (slug, label, position) values
  ('lieu', 'Lieu de réception', 0), ('traiteur', 'Traiteur', 1), ('photographe', 'Photographe', 2), ('videaste', 'Vidéaste', 3),
  ('dj', 'DJ', 4), ('musiciens', 'Musiciens', 5), ('fleuriste', 'Fleuriste', 6), ('decoration', 'Décoration', 7),
  ('wedding_planner', 'Wedding planner', 8), ('patisserie', 'Pâtisserie', 9), ('beaute', 'Coiffure et maquillage', 10),
  ('robe', 'Robe et tenues', 11), ('transport', 'Transport', 12), ('officiant', 'Officiant', 13)
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------------
-- Prestataires
-- ---------------------------------------------------------------------------

create table if not exists catalog.vendors (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null check (length(name) between 1 and 200),
  primary_category    text not null references catalog.categories (slug),
  categories          text[] not null default '{}',               -- toutes les catégories (la principale comprise)
  google_categories   text[] not null default '{}',               -- libellés Google tels quels (« Lieu de mariage »)
  description         text,
  address             text,
  postal_code         text,
  city                text,
  department          text,                                       -- « 13 », « 2A »
  region              text,
  lat                 double precision,
  lng                 double precision,
  email               text,
  phone               text,
  website             text,
  siret               text,
  siren               text,
  google_place_id     text,
  google_rating       numeric(2, 1),
  google_review_count integer,
  capacity_seated     integer,
  capacity_standing   integer,
  beds                integer,
  price_min           numeric(12, 2),
  price_max           numeric(12, 2),
  price_unit          text check (price_unit is null or price_unit in ('location', 'par_personne', 'forfait', 'par_heure')),
  style_tags          text[] not null default '{}',
  service_radius_km   integer,
  details             jsonb not null default '{}'::jsonb,         -- ce que scripts/catalog/10-structure.mjs a lu sur le site
  wedding_signal      numeric(6, 2) not null default 0,           -- « à quel point c'est un prestataire de mariage », pour le tri
  photos_count        integer not null default 0,
  status              text not null default 'pending' check (status in ('pending', 'active', 'rejected')),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- Position géographique (PostGIS) : seulement si l'extension est là (toujours sur Supabase ; pas dans la CI)
do $$
begin
  if exists (select 1 from pg_extension where extname = 'postgis') and not exists (
    select 1 from information_schema.columns where table_schema = 'catalog' and table_name = 'vendors' and column_name = 'location'
  ) then
    execute 'alter table catalog.vendors add column location extensions.geography(point, 4326)';
    execute 'create index if not exists vendors_location_idx on catalog.vendors using gist (location)';
  end if;
end $$;

create index if not exists vendors_status_category_idx on catalog.vendors (status, primary_category);
create index if not exists vendors_department_idx on catalog.vendors (department) where status = 'active';
create index if not exists vendors_city_idx on catalog.vendors (city) where status = 'active';
create index if not exists vendors_email_idx on catalog.vendors (lower(email)) where email is not null;
create index if not exists vendors_siret_idx on catalog.vendors (siret) where siret is not null;
create index if not exists vendors_google_place_idx on catalog.vendors (google_place_id) where google_place_id is not null;

-- ---------------------------------------------------------------------------
-- Photos : fichiers dans le stockage privé catalog-photos/<vendor_id>/…, servis en liens signés
-- ---------------------------------------------------------------------------

create table if not exists catalog.vendor_photos (
  id            uuid primary key default gen_random_uuid(),
  vendor_id     uuid not null references catalog.vendors (id) on delete cascade,
  position      smallint not null default 0,
  storage_path  text not null,
  width         integer,
  height        integer,
  created_at    timestamptz not null default now(),
  unique (vendor_id, storage_path)
);
create index if not exists vendor_photos_vendor_idx on catalog.vendor_photos (vendor_id, position);

insert into storage.buckets (id, name, public) values ('catalog-photos', 'catalog-photos', false)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Droits : les organisateurs connectés lisent les fiches validées (et leurs photos, les catégories) ;
-- tout le reste passe par des fonctions security definer (espace prestataire) ou par la clé de service
-- (scripts, pages publiques /mariage, revendication de fiche).
-- ---------------------------------------------------------------------------

alter table catalog.categories   enable row level security;
alter table catalog.vendors      enable row level security;
alter table catalog.vendor_photos enable row level security;

grant select on catalog.categories, catalog.vendors, catalog.vendor_photos to authenticated;
grant all on catalog.categories, catalog.vendors, catalog.vendor_photos to service_role;

drop policy if exists "catégories lisibles" on catalog.categories;
create policy "catégories lisibles" on catalog.categories for select to authenticated using (true);

drop policy if exists "fiches validées lisibles" on catalog.vendors;
create policy "fiches validées lisibles" on catalog.vendors for select to authenticated using (status = 'active');

drop policy if exists "photos des fiches validées lisibles" on catalog.vendor_photos;
create policy "photos des fiches validées lisibles" on catalog.vendor_photos for select to authenticated
  using (exists (select 1 from catalog.vendors v where v.id = vendor_id and v.status = 'active'));

-- Liens signés des photos pour les organisateurs connectés (lecture seule du dossier)
drop policy if exists "photos du catalogue lisibles" on storage.objects;
create policy "photos du catalogue lisibles" on storage.objects for select to authenticated
  using (bucket_id = 'catalog-photos');

-- updated_at suit chaque modification
create or replace function catalog.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists vendors_touch_updated_at on catalog.vendors;
create trigger vendors_touch_updated_at before update on catalog.vendors
  for each row execute function catalog.touch_updated_at();
