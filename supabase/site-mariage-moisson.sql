-- Merry · site de mariage : remplace le modèle Horizon par Moisson (catalogue).
-- À coller dans Supabase > SQL Editor > New query, puis Run, APRÈS site-mariage.sql.
-- Le fichier peut être relancé sans risque : il ne supprime aucune donnée.

-- Les sites déjà créés avec « horizon » passent à « moisson » (modèle équivalent, même place dans le catalogue)
update public.wedding_sites set template = 'moisson' where template = 'horizon';

alter table public.wedding_sites alter column template set default 'moisson';
alter table public.wedding_sites drop constraint if exists wedding_sites_template_check;
alter table public.wedding_sites add constraint wedding_sites_template_check
  check (template in ('moisson', 'terracotta', 'colline'));
