-- Merry · fiche invité complète et vues enregistrées de la liste
-- À coller dans Supabase > SQL Editor > New query, puis Run, APRÈS dashboard.sql.
-- Le fichier peut être relancé sans risque : il ne supprime aucune donnée.
--
-- 1. guests.note : un mot des organisateurs sur un invité (« Allergique aux noix, vérifier
--    avec le traiteur », « Vient avec sa mère »), visible sur sa fiche, jamais par l'invité.
-- 2. weddings.guest_views : les vues enregistrées de la liste des invités, partagées entre
--    organisateurs : [{ "id": "…", "name": "Traiteur", "qs": "st=oui&m=…", "created_by": "<wedding_members.id>" }].
--    Sans ce fichier, les vues restent dans le navigateur de chacun.

alter table public.guests add column if not exists note text;
alter table public.weddings add column if not exists guest_views jsonb not null default '[]'::jsonb;

-- Les organisateurs modifient déjà quelques colonnes du mariage (dashboard.sql) ; celle-ci s'ajoute
grant update (guest_views) on public.weddings to authenticated;
