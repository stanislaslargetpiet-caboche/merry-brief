-- Merry · catalogue : recherche d'un prestataire par son nom (« Ajouter un prestataire déjà trouvé… »)
-- À coller dans Supabase > SQL Editor > New query, puis Run. Peut être relancé sans risque : il ne supprime rien.
--
-- Le 16 novembre 2026 vers 17 h 42 (heure de Paris), trois recherches par nom (« ro », « rob », « robe ») ont dépassé
-- le temps limite de la base (8 s) et répondu 500 (journaux Supabase). pg_stat_statements, relevé le 19 novembre 2026 :
-- 214 recherches par nom, 1,6 s en moyenne, 6,5 s au pire (hors celles coupées à 8 s). La base passe par l'index des
-- statuts et relit les quelque 21 000 fiches actives une à une, au lieu de l'index des noms qui couvre aussi les
-- 137 000 fiches non validées. Cet index ne garde que les fiches actives : la recherche n'en lit plus que quelques
-- centaines.

create index if not exists vendors_name_trgm_active_idx
  on catalog.vendors using gin (name gin_trgm_ops)
  where status = 'active';

analyze catalog.vendors;
