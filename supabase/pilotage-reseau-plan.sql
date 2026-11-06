-- Plan du jour de la section « Réseau » du pilotage : ce que l'agent prépare chaque matin pour les trois créneaux,
-- avec le texte de chaque message. Une ligne par action. Stan relit, copie, envoie depuis LinkedIn ou Gmail, puis coche.
-- Lue et écrite côté serveur seulement (service_role) : aucune politique. Relançable sans risque.
-- Supabase > SQL Editor > New query, colle ce fichier, Run.

create table if not exists public.pilotage_reseau_plan (
  id uuid primary key default gen_random_uuid(),
  jour date not null,
  creneau text not null check (creneau in ('repondre', 'ecrire', 'consolider')),
  ordre integer not null default 0,
  contact_id uuid references public.pilotage_contacts (id) on delete cascade,
  titre text not null default '' check (length(titre) <= 200),
  raison text not null default '' check (length(raison) <= 500),
  dernier_message text not null default '' check (length(dernier_message) <= 1000),
  message text not null default '' check (length(message) <= 4000),
  lien_envoi text not null default '' check (length(lien_envoi) <= 500),
  statut text not null default 'a_faire' check (statut in ('a_faire', 'fait', 'reporte')),
  cree_le timestamptz not null default now(),
  maj_le timestamptz not null default now(),
  check (contact_id is not null or length(btrim(titre)) > 0)
);

create index if not exists pilotage_reseau_plan_jour_idx on public.pilotage_reseau_plan (jour, creneau, ordre);

drop trigger if exists pilotage_reseau_plan_maj on public.pilotage_reseau_plan;
create trigger pilotage_reseau_plan_maj before update on public.pilotage_reseau_plan for each row execute function public.pilotage_contacts_maj();

alter table public.pilotage_reseau_plan enable row level security;
revoke all on public.pilotage_reseau_plan from anon, authenticated;
