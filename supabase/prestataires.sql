-- Merry · prestataires : sélection du couple, envies et demandes de devis
-- À coller dans Supabase > SQL Editor > New query, puis Run, APRÈS dashboard.sql.
-- Le fichier peut être relancé sans risque : il ne supprime aucune donnée.
--
-- Les prestataires proposés viennent du catalogue Merry (supabase/catalog.sql, schéma « catalog ») ;
-- ici, seulement ce qui appartient au mariage. Une demande envoyée crée (ou retrouve) le prestataire
-- dans « vendors » et range le message sur sa fiche (vendor_messages) : les réponses arrivent dans Budget.

-- ---------------------------------------------------------------------------
-- A. Demandes de devis : un message envoyé à plusieurs prestataires
-- ---------------------------------------------------------------------------

create table if not exists public.quote_requests (
  id            uuid primary key default gen_random_uuid(),
  wedding_id    uuid not null references public.weddings (id) on delete cascade,
  message       text not null check (length(message) between 1 and 5000),
  questions     jsonb not null default '{}'::jsonb,        -- {lieu: [...], traiteur: [...]}
  dates         text[] not null default '{}',              -- date souhaitée puis dates de repli
  share_budget  boolean not null default false,
  sent_by       uuid,                                      -- wedding_members.id
  created_at    timestamptz not null default now(),
  unique (wedding_id, id),
  foreign key (wedding_id, sent_by) references public.wedding_members (wedding_id, id) on delete set null (sent_by)
);
create index if not exists quote_requests_wedding_idx on public.quote_requests (wedding_id);

-- ---------------------------------------------------------------------------
-- B. Mes prestataires : ceux que le couple a gardés (le cœur), avec où il en est
-- ---------------------------------------------------------------------------

create table if not exists public.vendor_picks (
  id            uuid primary key default gen_random_uuid(),
  wedding_id    uuid not null references public.weddings (id) on delete cascade,
  catalog_ref   text not null check (length(catalog_ref) between 1 and 120),  -- « catalog:<id> » ou « exemple:<nom> »
  category      text not null check (category in ('lieu', 'traiteur', 'dj', 'fleuriste', 'photographe', 'autre')),
  data          jsonb not null default '{}'::jsonb,        -- nom, région, photo, prix… au moment du choix
  checked       boolean not null default true,             -- à inclure dans la prochaine demande
  note          text check (note is null or length(note) <= 1000),  -- un mot pour ce prestataire
  vendor_id     uuid,                                      -- fiche créée à l'envoi de la demande
  request_id    uuid,
  requested_at  timestamptz,
  quote_amount  numeric(12, 2),                            -- devis reçu, s'il n'est pas encore dans le budget
  quote_at      date,
  added_by      uuid,                                      -- wedding_members.id
  position      integer not null default 0,
  created_at    timestamptz not null default now(),
  unique (wedding_id, id),
  unique (wedding_id, catalog_ref),
  foreign key (wedding_id, vendor_id) references public.vendors (wedding_id, id) on delete set null (vendor_id),
  foreign key (wedding_id, request_id) references public.quote_requests (wedding_id, id) on delete set null (request_id),
  foreign key (wedding_id, added_by) references public.wedding_members (wedding_id, id) on delete set null (added_by)
);
create index if not exists vendor_picks_wedding_idx on public.vendor_picks (wedding_id);

-- ---------------------------------------------------------------------------
-- C. Préciser mes envies : une ligne par mariage, partagée entre les organisateurs
-- ---------------------------------------------------------------------------

create table if not exists public.vendor_wishes (
  wedding_id    uuid primary key references public.weddings (id) on delete cascade,
  wishes        jsonb not null default '{}'::jsonb,        -- accès, places, couchages, traiteur, style
  skipped       text[] not null default '{}',              -- catégories « Pas besoin »
  updated_by    uuid,
  updated_at    timestamptz not null default now(),
  foreign key (wedding_id, updated_by) references public.wedding_members (wedding_id, id) on delete set null (updated_by)
);

-- ---------------------------------------------------------------------------
-- Mêmes droits pour tous les organisateurs du mariage
-- ---------------------------------------------------------------------------

do $$
declare t text;
begin
  foreach t in array array['quote_requests', 'vendor_picks', 'vendor_wishes']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "organisateurs: tout" on public.%I', t);
    execute format('create policy "organisateurs: tout" on public.%I for all to authenticated
                    using (public.is_wedding_member(wedding_id))
                    with check (public.is_wedding_member(wedding_id))', t);
  end loop;
end $$;
