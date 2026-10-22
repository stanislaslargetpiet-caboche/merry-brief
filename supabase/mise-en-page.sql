-- Merry · disposition des colonnes partagée entre les organisateurs
-- À coller dans Supabase > SQL Editor > New query, puis Run, APRÈS dashboard.sql.
-- Le fichier peut être relancé sans risque : il ne supprime aucune donnée.
--
-- Jusqu'ici l'ordre, la largeur, les colonnes masquées et les en-têtes renommés de la liste des
-- invités n'existaient que dans le navigateur de chacun. Ils sont maintenant gardés avec le
-- mariage : { "invites": { "order": [...], "widths": {...}, "hidden": [...], "labels": {...} } }.
-- Sans ce fichier, le tableau de bord continue de les garder dans le navigateur.

alter table public.weddings add column if not exists layouts jsonb not null default '{}'::jsonb;

-- Les organisateurs modifient déjà quelques colonnes du mariage (dashboard.sql) ; celle-ci s'ajoute
grant update (layouts) on public.weddings to authenticated;
