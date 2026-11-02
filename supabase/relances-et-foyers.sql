-- Merry · relances des invités sans réponse et foyers
-- À coller dans Supabase > SQL Editor > New query, puis Run, APRÈS dashboard.sql.
-- Le fichier peut être relancé sans risque : il ne supprime aucune donnée.
--
-- 1. guests.reminded_at : la dernière fois qu'on a relancé l'invité (bouton « Relancer » de la liste
--    et de la fiche : mail, WhatsApp ou SMS avec le lien du formulaire, puis « Marquer comme relancés »).
-- 2. guests.household_id : le foyer de l'invité (un faire-part, une adresse, une enveloppe). Les membres
--    d'un même foyer partagent le même identifiant ; pas de table à part, le nom du foyer se déduit des membres.
-- Sans ce fichier, les deux boutons expliquent quoi lancer ; le reste de la liste fonctionne.

alter table public.guests add column if not exists reminded_at timestamptz;
alter table public.guests add column if not exists household_id uuid;
create index if not exists guests_household_idx on public.guests (wedding_id, household_id);
