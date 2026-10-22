-- Merry · note partagée au-dessus de la liste des invités
-- À coller dans Supabase > SQL Editor > New query, puis Run, APRÈS dashboard.sql.
-- Le fichier peut être relancé sans risque : il ne supprime aucune donnée.
--
-- Un post-it partagé entre tous les organisateurs, pour fixer les règles de
-- remplissage de la liste (« Faire-part = Oui dès l'adresse confirmée »…) :
-- { "text": "...", "updated_by": "<wedding_members.id>", "updated_at": "..." }.
-- Sans ce fichier, la note reste dans le navigateur de chacun.

alter table public.weddings add column if not exists guests_note jsonb;

-- Les organisateurs modifient déjà quelques colonnes du mariage (dashboard.sql) ; celle-ci s'ajoute
grant update (guests_note) on public.weddings to authenticated;
