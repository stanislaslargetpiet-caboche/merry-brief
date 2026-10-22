-- Merry · colonnes ajoutées à la liste des invités (qui les remplit, format) et descriptif des paiements
-- À coller dans Supabase > SQL Editor > New query, puis Run, APRÈS dashboard.sql.
-- Le fichier peut être relancé sans risque : il ne supprime aucune donnée.
--
-- source : « invites » (question posée dans le formulaire invités, on attend la réponse)
--          ou « organisateurs » (colonne interne, remplie par les organisateurs).
-- kind   : « text » (texte libre) ou « choice » (réponses prédéfinies, dans options).

alter table public.guest_fields add column if not exists source text not null default 'organisateurs';
alter table public.guest_fields drop constraint if exists guest_fields_source_check;
alter table public.guest_fields add constraint guest_fields_source_check check (source in ('invites', 'organisateurs'));
alter table public.guest_fields add column if not exists kind text not null default 'text';
alter table public.guest_fields drop constraint if exists guest_fields_kind_check;
alter table public.guest_fields add constraint guest_fields_kind_check check (kind in ('text', 'choice'));
alter table public.guest_fields add column if not exists options text[] not null default '{}';

-- Paiements : un petit descriptif libre (« Acompte fleurs, chèque remis en main propre »)
alter table public.payments add column if not exists note text check (note is null or length(note) <= 500);
