-- Merry · comptes couples et briefs
-- À coller dans Supabase > SQL Editor > New query, puis Run.
-- Les comptes eux-mêmes sont gérés par Supabase Auth (table auth.users) ;
-- cette table stocke le brief rattaché à chaque compte.

create extension if not exists "pgcrypto";

create table if not exists public.briefs (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users (id) on delete cascade,
  created_at          timestamptz not null default now(),

  -- 1 · Vous en êtes où
  stage               text not null,            -- debut | regarde | lieu_recherche | lieu_reserve | details

  -- 2 · Qui participe à l'organisation
  team                text not null,            -- nous_deux | nous_parents | nous_planner | planner_seul

  -- 3 · Vous deux
  first_name          text not null,
  first_age           smallint,
  partner_first_name  text not null,
  partner_age         smallint,
  wedding_date        date,
  date_unknown        boolean not null default false,
  region              text,
  region_unknown      boolean not null default false,

  -- 4 · Combien de monde
  guests              text not null,            -- <50 | 50-100 | 100-150 | 150-200 | >200
  format              text not null,            -- jour | weekend | inconnu

  -- 5 · Le style
  vibes               text[] not null default '{}',
  pinterest           text,

  -- 6 · Un week-end à deux
  weekend             text[] not null default '{}',

  -- 7 · La lune de miel
  honeymoon           text,
  honeymoon_vibes     text[] not null default '{}',

  -- 8 · Le budget
  budget              text not null,            -- <15k | 15-30k | 30-50k | >50k | aucune_idee

  -- 9 · Un coup de main
  help                text[] not null default '{}',

  -- 10 · Compte
  email               text not null,
  phone               text not null,
  partner_email       text,

  -- Suivi interne
  source              text,                     -- paramètres d'URL à l'arrivée (utm, src=hero…)
  status              text not null default 'nouveau',  -- nouveau | contacte | actif | perdu
  owner               text,                     -- prénom du conseiller
  notes               text
);

create index if not exists briefs_user_idx on public.briefs (user_id);
create index if not exists briefs_created_at_idx on public.briefs (created_at desc);

-- Sécurité : chaque compte ne voit et n'écrit que son propre brief.
alter table public.briefs enable row level security;

drop policy if exists "brief: insertion par son auteur" on public.briefs;
create policy "brief: insertion par son auteur"
  on public.briefs for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "brief: lecture par son auteur" on public.briefs;
create policy "brief: lecture par son auteur"
  on public.briefs for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "brief: modification par son auteur" on public.briefs;
create policy "brief: modification par son auteur"
  on public.briefs for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Pour l'équipe Merry : lecture de tous les briefs dans le dashboard Supabase
-- (Table Editor) ou via la clé service_role côté serveur, jamais exposée au navigateur.
