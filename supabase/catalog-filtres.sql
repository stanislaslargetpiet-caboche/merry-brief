-- Merry · catalogue : de quoi respecter les filtres des couples (« Préciser mes envies »)
-- À coller dans Supabase > SQL Editor > New query, puis Run, APRÈS catalog.sql.
-- Le fichier peut être relancé sans risque : il ne supprime aucune donnée.
--
-- A. Aéroports et gares TGV de référence (remplis par scripts/catalog/11-acces.mjs)
-- B. Pour chaque prestataire : aéroport et gare TGV les plus proches, avec le temps de route réel
--    (OSRM, d'après OpenStreetMap), calculés par le même script
-- C. Colonnes de filtre tirées de « details » (rempli par scripts/catalog/10-structure.mjs) :
--    colonnes générées, donc toujours à jour, sans changer le script de lecture des sites.
--    Valeur vide = information inconnue (le lieu est alors montré « à confirmer », jamais écarté).

-- ---------------------------------------------------------------------------
-- A. Aéroports (vols réguliers, OurAirports, domaine public) et gares TGV
--    (« Gares desservies par le TGV en France », data.gouv.fr, Licence Ouverte 2.0)
-- ---------------------------------------------------------------------------

create table if not exists catalog.transport_hubs (
  id          text primary key,                 -- « aeroport:MRS », « gare:87751008 »
  kind        text not null check (kind in ('aeroport', 'gare_tgv')),
  name        text not null,
  code        text,                              -- IATA ou identifiant SNCF
  city        text,
  lat         double precision not null,
  lng         double precision not null,
  seasonal    boolean not null default false,    -- gare desservie seulement en saison
  updated_at  timestamptz not null default now()
);

alter table catalog.transport_hubs enable row level security;
grant select on catalog.transport_hubs to authenticated;
grant all on catalog.transport_hubs to service_role;
drop policy if exists "aeroports et gares lisibles" on catalog.transport_hubs;
create policy "aeroports et gares lisibles" on catalog.transport_hubs for select to authenticated using (true);

-- ---------------------------------------------------------------------------
-- B. Accès de chaque prestataire (lieux d'abord) : le plus proche en temps de route
-- ---------------------------------------------------------------------------

alter table catalog.vendors add column if not exists airport_id text references catalog.transport_hubs (id) on delete set null;
alter table catalog.vendors add column if not exists airport_name text;
alter table catalog.vendors add column if not exists airport_km numeric(6, 1);
alter table catalog.vendors add column if not exists airport_minutes smallint;
alter table catalog.vendors add column if not exists station_id text references catalog.transport_hubs (id) on delete set null;
alter table catalog.vendors add column if not exists station_name text;
alter table catalog.vendors add column if not exists station_km numeric(6, 1);
alter table catalog.vendors add column if not exists station_minutes smallint;
alter table catalog.vendors add column if not exists access_computed_at timestamptz;

create index if not exists vendors_airport_minutes_idx on catalog.vendors (airport_minutes);
create index if not exists vendors_station_minutes_idx on catalog.vendors (station_minutes);
create index if not exists vendors_lat_lng_idx on catalog.vendors (lat, lng);

-- ---------------------------------------------------------------------------
-- C. Filtres tirés de « details » (générés : se mettent à jour avec details)
-- ---------------------------------------------------------------------------

-- Traiteur imposé (true), libre (false), inconnu (vide)
alter table catalog.vendors add column if not exists caterer_imposed boolean
  generated always as (case when details ? 'caterer_imposed' then (details ->> 'caterer_imposed')::boolean end) stored;

-- Accessible aux personnes à mobilité réduite
alter table catalog.vendors add column if not exists accessible boolean
  generated always as (
    case
      when details ->> 'accessible' = 'true' then true
      when details ->> 'accessible' = 'false' then false
      when (details ->> 'services') ~* '(pmr|mobilit[ée] r[ée]duite|accessible (aux )?(fauteuil|handicap))' then true
    end
  ) stored;

-- Cérémonie possible sur place, en extérieur
alter table catalog.vendors add column if not exists outdoor_ceremony boolean
  generated always as (
    case
      when (details ->> 'services') ~* 'c[ée]r[ée]monie[^",]{0,40}(jardin|parc|ext[ée]rieur|plein air|dehors|prairie|pelouse|terrasse|vignes?|verger|bord de)' then true
      when details ->> 'ceremony_on_site' = 'true' and details ->> 'outdoor_space' = 'true' then true
      when details ->> 'ceremony_on_site' = 'false' then false
    end
  ) stored;

-- Lieu loué en exclusivité (privatisation)
alter table catalog.vendors add column if not exists exclusive_use boolean
  generated always as (
    case when (details ->> 'services') ~* '(exclusivit[ée]|en exclusif|location exclusive|privatisation|privatis[ée]|rien que pour vous)' then true end
  ) stored;

-- Parking sur place
alter table catalog.vendors add column if not exists parking boolean
  generated always as (
    case when (details ->> 'services') ~* '(parking|stationnement|places de parc)' then true end
  ) stored;

-- Fin de soirée après 2 h : « sans limite », « jusqu'à l'aube », « aucune heure de fin imposée »…,
-- ou une heure après 2 h (2 h 30, 3 h… 8 h). Une colonne générée ne se modifie pas : on la recrée
-- (elle ne contient rien d'autre que ce qu'elle calcule depuis details).
alter table catalog.vendors drop column if exists late_party;
alter table catalog.vendors add column late_party boolean
  generated always as (
    case
      when details ->> 'music_end' is null then null
      when (details ->> 'music_end') ~* '(sans|pas de|pas d.|aucune?|ni) ?(heure|limit|couvre|horaire|restriction|contrainte)|illimit|bout de la nuit|aube|aurore|lever du (jour|soleil)|petit (matin|jour)|jusqu.au matin|premi.res heures|heure de fin (impos|fix)|toute la nuit' then true
      when (details ->> 'music_end') ~ '(^|[^0-9])0?([3-8])\s*(h|heures?|:)' then true
      when (details ->> 'music_end') ~ '(^|[^0-9])0?2\s*(h|:)\s*[0-5]?[1-9]' then true
      when (details ->> 'music_end') ~* 'minuit' then false
      when (details ->> 'music_end') ~ '(^|[^0-9])(2[0-3]|1[0-9]|0?[0-2])\s*(h|heures?|:)' then false
    end
  ) stored;

create index if not exists vendors_filters_idx on catalog.vendors (primary_category, status, capacity_seated, beds);
