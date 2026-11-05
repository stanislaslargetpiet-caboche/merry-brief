-- Coûts de Merry : le registre des dépenses que la section « Coûts » du pilotage totalise (en haut de /pilotage).
-- Une ligne par dépense, en euros (convertir à la main les factures en dollars, comme Google Places).
-- Les quatre catégories suivent les plafonds de l'année 1 décidés le 9 octobre 2026 : tech 5 000 €, juridique 10 000 €,
-- acquisition 30 000 €, divers 5 000 €. Lue et écrite côté serveur seulement (service_role) : aucune politique, donc
-- ni les visiteurs ni les comptes connectés n'y accèdent. Relançable sans risque.
-- Supabase > SQL Editor > New query, colle ce fichier, Run.

create table if not exists public.pilotage_couts (
  id uuid primary key default gen_random_uuid(),
  jour date not null default current_date,
  fournisseur text not null check (length(btrim(fournisseur)) between 1 and 80),
  libelle text not null default '' check (length(libelle) <= 200),
  categorie text not null check (categorie in ('tech', 'juridique', 'acquisition', 'divers')),
  montant_eur numeric(10, 2) not null check (montant_eur >= 0),
  cree_le timestamptz not null default now()
);

create index if not exists pilotage_couts_jour_idx on public.pilotage_couts (jour desc);

alter table public.pilotage_couts enable row level security;
revoke all on public.pilotage_couts from anon, authenticated;
