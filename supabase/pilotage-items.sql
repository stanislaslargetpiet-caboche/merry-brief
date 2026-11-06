-- Liste d'actions du pilotage : tâches et décisions de Stan, et ce que les agents y déposent (campagne à relire,
-- lecture, mot du matin). Une ligne « alerte » garde en mémoire une alerte déjà vue. Lue et écrite côté serveur
-- seulement (service_role) : aucune politique. Relançable sans risque.
-- À coller après supabase/pilotage-reseau.sql, dont vient le déclencheur de maj_le.
-- Supabase > SQL Editor > New query, colle ce fichier, Run.

create table if not exists public.pilotage_items (
  id uuid primary key default gen_random_uuid(),
  type text not null default 'tache' check (type in ('tache', 'decision', 'campagne', 'lecture', 'mot', 'alerte')),
  titre text not null check (length(btrim(titre)) between 1 and 300),
  detail text not null default '' check (length(detail) <= 1000),
  projet text not null default '' check (length(projet) <= 40),
  priorite smallint not null default 0 check (priorite in (0, 1)),
  echeance date,
  recurrence text not null default '' check (recurrence in ('', 'quotidien', 'hebdo', 'mensuel')),
  lien text not null default '' check (length(lien) <= 500),
  statut text not null default 'a_faire' check (statut in ('a_faire', 'fait')),
  cle text not null default '' check (length(cle) <= 320),
  fait_le timestamptz,
  cree_le timestamptz not null default now(),
  maj_le timestamptz not null default now()
);

create index if not exists pilotage_items_statut_idx on public.pilotage_items (statut, echeance);
create unique index if not exists pilotage_items_cle_idx on public.pilotage_items (cle) where cle <> '';

drop trigger if exists pilotage_items_maj on public.pilotage_items;
create trigger pilotage_items_maj before update on public.pilotage_items for each row execute function public.pilotage_contacts_maj();

alter table public.pilotage_items enable row level security;
revoke all on public.pilotage_items from anon, authenticated;
