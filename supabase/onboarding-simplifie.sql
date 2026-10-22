-- Merry · onboarding simplifié (canvas « Merry · Carte brief », page Onboarding, validé le 22 oct. 2026)
-- À coller dans Supabase > SQL Editor > New query, puis Run, APRÈS schema.sql.
-- Le fichier peut être relancé sans risque.
--
-- Le brief passe de 8 à 7 écrans : « Vous deux » devient « Lieu et date » (sans prénoms ni âges),
-- « Un coup de main » disparaît, et l'écran compte ne demande plus le téléphone, seulement les
-- prénoms, l'email et le mot de passe. Les colonnes retirées ci-dessous ne sont plus écrites par
-- le code ; comme Merry est encore pré-produit, elles sont supprimées plutôt que laissées vides.

alter table public.briefs drop column if exists first_age;
alter table public.briefs drop column if exists partner_age;
alter table public.briefs drop column if exists weekend;
alter table public.briefs drop column if exists honeymoon;
alter table public.briefs drop column if exists honeymoon_vibes;
alter table public.briefs drop column if exists help;
alter table public.briefs alter column phone drop not null;
