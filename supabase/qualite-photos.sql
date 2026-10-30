-- Merry · catalogue : qualité des photos de fiche (écarter captures d'écran et logos, repérer l'extérieur des lieux)
-- À coller dans Supabase > SQL Editor > New query, puis Run, APRÈS prestataires.sql.
-- Le fichier peut être relancé sans risque : il ne supprime aucune donnée.
--
-- Rempli par scripts/catalog/12-photos-qualite.mjs (lot sur les photos déjà en base, puis sur les nouvelles).
-- screenshot  : vrai si la photo est une capture d'écran, un logo ou un visuel promo texte/graphique,
--               jamais une vraie photo du prestataire ; ne doit jamais servir de couverture.
-- shot_type   : pour un lieu de réception, "exterieur" ou "interieur" ; "autre" sinon ou si non pertinent.
-- classified_at : null = pas encore passée par le script (la couverture retombe sur l'heuristique de ratio).

alter table catalog.vendor_photos
  add column if not exists screenshot boolean,
  add column if not exists shot_type text,
  add column if not exists classified_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'vendor_photos_shot_type_check'
  ) then
    alter table catalog.vendor_photos
      add constraint vendor_photos_shot_type_check check (shot_type is null or shot_type in ('exterieur', 'interieur', 'autre'));
  end if;
end $$;

create index if not exists vendor_photos_classified_at_idx on catalog.vendor_photos (classified_at) where classified_at is null;
