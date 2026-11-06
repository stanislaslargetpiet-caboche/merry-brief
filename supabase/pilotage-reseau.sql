-- Réseau de Merry : les contacts et les échanges que la section « Réseau » du pilotage affiche (/pilotage).
-- Une ligne par personne, un échange par mail, message, appel ou note. L'agent des créneaux Inbound / outbound
-- écrit ici directement ; Stan valide et coche depuis la page. Lue et écrite côté serveur seulement (service_role) :
-- aucune politique, donc ni les visiteurs ni les comptes connectés n'y accèdent. Relançable sans risque.
-- Supabase > SQL Editor > New query, colle ce fichier, Run.

create table if not exists public.pilotage_contacts (
  id uuid primary key default gen_random_uuid(),
  nom text not null check (length(btrim(nom)) between 1 and 120),
  entreprise text not null default '' check (length(entreprise) <= 120),
  role text not null default '' check (length(role) <= 120),
  piste text not null check (piste in ('mille_merci', 'marketplace', 'experientiel', 'angels', 'a_qualifier')),
  statut text not null default 'a_valider' check (statut in ('a_valider', 'a_contacter', 'contacte', 'relance_1', 'relance_2', 'conversation', 'rdv_fixe', 'rdv_fait', 'en_pause', 'ecarte')),
  canal text not null default 'linkedin' check (canal in ('linkedin', 'mail', 'appel', 'intro')),
  email text not null default '' check (length(email) <= 200),
  linkedin text not null default '' check (length(linkedin) <= 300),
  dernier_contact date,
  prochaine_action text not null default '' check (length(prochaine_action) <= 300),
  date_action date,
  notes text not null default '' check (length(notes) <= 2000),
  cree_le timestamptz not null default now(),
  maj_le timestamptz not null default now()
);

create unique index if not exists pilotage_contacts_personne_idx on public.pilotage_contacts (lower(nom), lower(entreprise));
create index if not exists pilotage_contacts_action_idx on public.pilotage_contacts (date_action) where date_action is not null;

create table if not exists public.pilotage_contact_echanges (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.pilotage_contacts (id) on delete cascade,
  jour date not null default current_date,
  sens text not null check (sens in ('entrant', 'sortant', 'note')),
  canal text not null check (canal in ('linkedin', 'mail', 'appel', 'intro')),
  resume text not null default '' check (length(resume) <= 500),
  cree_le timestamptz not null default now()
);

create index if not exists pilotage_contact_echanges_jour_idx on public.pilotage_contact_echanges (jour desc);
create index if not exists pilotage_contact_echanges_contact_idx on public.pilotage_contact_echanges (contact_id);

create or replace function public.pilotage_contacts_maj() returns trigger language plpgsql as $$
begin
  new.maj_le := now();
  return new;
end $$;

revoke all on function public.pilotage_contacts_maj() from public;

drop trigger if exists pilotage_contacts_maj on public.pilotage_contacts;
create trigger pilotage_contacts_maj before update on public.pilotage_contacts for each row execute function public.pilotage_contacts_maj();

alter table public.pilotage_contacts enable row level security;
alter table public.pilotage_contact_echanges enable row level security;
revoke all on public.pilotage_contacts from anon, authenticated;
revoke all on public.pilotage_contact_echanges from anon, authenticated;
