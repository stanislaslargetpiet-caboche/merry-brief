-- Rapports des agents du pilotage : le compte rendu d'un audit ou d'une réparation, renvoyé par l'agent en fin de travail
-- et affiché derrière le bouton Rapport de la carte. Une ligne par bug ou alerte (cle = celle du fil d'Aujourd'hui).
-- Lue et écrite côté serveur seulement (service_role) : aucune politique. Relançable sans risque.
-- Supabase > SQL Editor > New query, colle ce fichier, Run.

create table if not exists public.pilotage_rapports (
  id uuid primary key default gen_random_uuid(),
  cle text not null unique check (length(cle) between 1 and 320),
  mode text not null check (mode in ('audit', 'reparer')),
  statut text not null default 'en_cours' check (statut in ('en_cours', 'pret')),
  session text not null default '' check (length(session) <= 500),
  jeton text not null default '',
  texte text not null default '' check (length(texte) <= 20000),
  cree_le timestamptz not null default now(),
  maj_le timestamptz not null default now()
);

alter table public.pilotage_rapports enable row level security;
revoke all on public.pilotage_rapports from anon, authenticated;
