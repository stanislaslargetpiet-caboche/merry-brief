-- Merry · onboarding V2 (canvas « Merry · Carte brief », page « Onboarding & connexion v2 », validé le 27 oct. 2026)
-- À coller dans Supabase > SQL Editor > New query, puis Run, APRÈS schema.sql et onboarding-simplifie.sql.
-- Le fichier peut être relancé sans risque.
--
-- Le brief passe à 4 étapes (la fête, l'équipe, l'essentiel, le compte). Nouveautés :
-- - la date peut être précise ou flexible (un ou plusieurs mois, au format AAAA-MM) ;
-- - les invités et le budget sont des fourchettes min / max au lieu de tranches fixes ;
-- - le lieu est choisi dans une liste de suggestions (OpenStreetMap), avec ses coordonnées ;
-- - le format (journée ou week-end) n'est plus demandé.
-- Les colonnes guests et budget restent remplies avec la tranche la plus proche
-- (<50, 50-100… et <15k, 15-30k…), pour que le tableau de bord continue de les lire.

alter table public.briefs add column if not exists date_mode   text;                     -- precise | flexible
alter table public.briefs add column if not exists flex_months text[] not null default '{}'; -- ex. {2027-06,2027-07}
alter table public.briefs add column if not exists guests_min  smallint;
alter table public.briefs add column if not exists guests_max  smallint;                 -- 300 = « 300 et plus »
alter table public.briefs add column if not exists budget_min  integer;                  -- en euros
alter table public.briefs add column if not exists budget_max  integer;                  -- 100000 = « 100 000 € et plus »

alter table public.briefs add column if not exists region_lat  double precision;         -- lieu choisi dans la liste de suggestions
alter table public.briefs add column if not exists region_lon  double precision;

alter table public.briefs alter column format drop not null;
