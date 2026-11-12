-- La Corse (2A, 2B) n'a pas de liaison ferroviaire avec le continent : la « gare la plus proche »
-- calculée à vol d'oiseau (lib/pro/geo.js) donnait des trajets absurdes, ex. « 599 min de la gare
-- de Nice » ou « 686 min de la gare d'Antibes » sur les pages SEO. nearestAccess() ne calcule plus
-- de gare pour un point en Corse (voir le commit) ; ceci nettoie les 48 fiches déjà enrichies avec
-- une fausse gare de référence. L'aéroport (Ajaccio, Bastia, Calvi, Figari) n'est pas touché : il
-- reste correct.
update catalog.vendors
set station_id = null, station_name = null, station_km = null, station_minutes = null
where department in ('2A', '2B') and station_minutes is not null;
