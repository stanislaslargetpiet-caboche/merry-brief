-- Merry · site de mariage : remplace le modèle Horizon par Moisson (catalogue).
-- À coller dans Supabase > SQL Editor > New query, puis Run, APRÈS site-mariage.sql.
-- Le fichier peut être relancé sans risque : il ne supprime aucune donnée.

-- Les sites déjà créés avec un modèle retiré du catalogue (horizon, perle, et les autres retirés
-- plus tôt : embarquement, belvedere, moisson avant son retour, rivage) basculent sur l'équivalent
-- le plus proche encore disponible ; tout le reste (au cas où) tombe sur moisson, le choix par défaut.
update public.wedding_sites set template = 'moisson' where template = 'horizon';
update public.wedding_sites set template = 'colline' where template = 'perle';
update public.wedding_sites set template = 'moisson' where template not in ('moisson', 'terracotta', 'colline');

alter table public.wedding_sites alter column template set default 'moisson';
alter table public.wedding_sites drop constraint if exists wedding_sites_template_check;
alter table public.wedding_sites add constraint wedding_sites_template_check
  check (template in ('moisson', 'terracotta', 'colline'));
