-- Persona (D-398) : le script Google Ads envoie aussi les clics par sexe, tranche d'âge, région et appareil
-- (niveaux « sexe », « age », « region », « appareil », valeur dans `terme`), lus dans Acquisition › Persona.
-- Après supabase/google-ads.sql. Relançable sans risque.
-- Supabase > SQL Editor > New query, colle ce fichier, Run.

alter table public.google_ads_jours drop constraint if exists google_ads_jours_niveau_check;
alter table public.google_ads_jours add constraint google_ads_jours_niveau_check
  check (niveau in ('campagne', 'mot_cle', 'recherche', 'sexe', 'age', 'region', 'appareil'));
