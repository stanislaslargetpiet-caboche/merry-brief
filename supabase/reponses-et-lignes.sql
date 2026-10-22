-- Merry · réponses du rétroplanning gardées + plusieurs lignes dans un même poste du budget
-- À coller dans Supabase > SQL Editor > New query, puis Run, APRÈS dashboard.sql.
-- Le fichier peut être relancé sans risque : il ne supprime aucune donnée.
-- (Si l'éditeur tronque le script, lancez chaque partie séparément : A puis B.)

-- ---------------------------------------------------------------------------
-- A. Réponses aux quatre questions du rétroplanning
--    Une ligne par mariage, partagée entre les organisateurs et entre leurs appareils :
--    on répond sur le téléphone, on retrouve tout sur l'ordinateur.
-- ---------------------------------------------------------------------------

create table if not exists public.retro_answers (
  wedding_id      uuid primary key references public.weddings (id) on delete cascade,
  answers         jsonb not null default '{}'::jsonb,   -- {vendors, guests, list, moments}
  updated_by      uuid,                                 -- wedding_members.id
  device          text check (device is null or device in ('telephone', 'ordinateur')),
  updated_at      timestamptz not null default now(),
  foreign key (wedding_id, updated_by) references public.wedding_members (wedding_id, id) on delete set null (updated_by)
);

alter table public.retro_answers enable row level security;
drop policy if exists "organisateurs: tout" on public.retro_answers;
create policy "organisateurs: tout" on public.retro_answers for all to authenticated
  using (public.is_wedding_member(wedding_id))
  with check (public.is_wedding_member(wedding_id));

-- ---------------------------------------------------------------------------
-- B. Budget : plusieurs lignes dans un même poste
--    category = le poste (« Lieu ») ; label reste le type de dépense de la ligne
--    (« Tentiste », « Groupe électrogène (GE) », « Foodtruck »). Vide = poste à une seule
--    ligne, comme avant : rien ne change pour les budgets existants.
-- ---------------------------------------------------------------------------

alter table public.budget_items add column if not exists category text;
alter table public.budget_items drop constraint if exists budget_items_category_check;
alter table public.budget_items add constraint budget_items_category_check
  check (category is null or length(category) between 1 and 80);
create index if not exists budget_items_category_idx on public.budget_items (wedding_id, category);
