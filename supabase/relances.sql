-- Merry · relances des invités sans réponse
-- À coller dans Supabase > SQL Editor > New query, puis Run, APRÈS dashboard.sql.
-- Le fichier peut être relancé sans risque : il ne supprime aucune donnée.
-- (Il s'appelait relances-et-foyers.sql : la colonne household_id qu'il créait n'est plus utilisée,
-- elle peut rester.)
--
-- guests.reminded_at : la dernière fois qu'on a relancé l'invité (bouton « Relancer » de la liste
-- et de la fiche : mail, WhatsApp ou SMS avec le lien du formulaire, puis « Marquer comme relancés »).
-- Sans ce fichier, le bouton explique quoi lancer ; le reste de la liste fonctionne.

alter table public.guests add column if not exists reminded_at timestamptz;
