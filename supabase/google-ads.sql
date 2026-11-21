-- Google Ads : dépense, impressions et clics par jour, envoyés par le script collé dans le compte Google Ads
-- (scripts/google-ads/merry-depense.js) vers /api/interne/google-ads, et lus par le bloc Google Ads du pilotage (D-381).
-- Trois niveaux : « campagne » (toute la dépense), « mot_cle » (mots-clés achetés) et « recherche » (ce que les gens ont
-- tapé). Le script renvoie les derniers jours à chaque passage : une ligne est remplacée, jamais doublée.
-- Lue et écrite côté serveur seulement (service_role) : aucune politique. Relançable sans risque.
-- Supabase > SQL Editor > New query, colle ce fichier, Run.

create table if not exists public.google_ads_jours (
  jour date not null,
  niveau text not null check (niveau in ('campagne', 'mot_cle', 'recherche')),
  campagne_id text not null check (length(campagne_id) between 1 and 40),
  campagne text not null default '' check (length(campagne) <= 200),
  groupe text not null default '' check (length(groupe) <= 200),
  terme text not null default '' check (length(terme) <= 200),
  correspondance text not null default '' check (length(correspondance) <= 20),
  impressions integer not null default 0 check (impressions >= 0),
  clics integer not null default 0 check (clics >= 0),
  cout_eur numeric(10, 2) not null default 0 check (cout_eur >= 0),
  conversions numeric(10, 2) not null default 0 check (conversions >= 0),
  maj timestamptz not null default now(),
  primary key (jour, niveau, campagne_id, groupe, terme, correspondance)
);

create index if not exists google_ads_jours_jour_idx on public.google_ads_jours (jour desc);

alter table public.google_ads_jours enable row level security;
revoke all on public.google_ads_jours from anon, authenticated;
grant select, insert, update, delete on public.google_ads_jours to service_role;
