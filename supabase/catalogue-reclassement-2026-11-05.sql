-- Merry · catalogue : 143 fiches rangées dans le mauvais métier (wedding planners et décoration), liste relue le 5 nov. 2026
-- À coller dans Supabase > SQL Editor > New query, puis Run. Relançable : une fiche déjà déplacée n'est plus retrouvée.
--
-- Source : exports/reclassement-catalogue/propositions-2026-11-05.csv (colonne vers_final). Le catalogue rangeait en
-- « wedding planner » ou « décoration » des lieux, vidéastes, officiants, traiteurs, DJ, fleuristes… surtout à cause de la
-- catégorie Google générique « Prestataire de mariage ». Les pages /mariage/… et les propositions faites aux couples suivent
-- primary_category : les compteurs et les sélections se corrigent d'eux-mêmes (puis « Rafraîchir les pages SEO » dans le pilotage).
--
-- Chaque fiche est désignée par les 8 premiers caractères de son id, avec le métier actuel attendu : si la fiche a changé de
-- métier, de statut, a été revendiquée par son prestataire ou ajoutée à la main par un couple depuis la relecture, elle n'est pas touchée.
-- L'ancien métier reste dans `categories` (métiers secondaires) ; seule la catégorie principale change.
-- Sortie : un NOTICE donne le nombre de fiches déplacées et celles ignorées, avec la raison.

do $$
declare
  deplacees integer;
  introuvables integer;
  ambigus integer;
  ignorees integer;
begin
  create temporary table _reclassement (prefixe text primary key, de text not null, vers text not null) on commit drop;
  insert into _reclassement (prefixe, de, vers) values
    ('c9177b98', 'wedding_planner', 'beaute'),  -- Zia Make-Up
    ('210907e9', 'wedding_planner', 'beaute'),  -- Anaïs Faure – Maître Artisan | Coiffeuse & Maquilleuse Mar
    ('dbe9cf55', 'wedding_planner', 'beaute'),  -- Ange. J (Angitia)
    ('13c47614', 'wedding_planner', 'beaute'),  -- Béatrice Carroz • BRIDAL MAKEUP & HAIR
    ('5b6bddcb', 'wedding_planner', 'beaute'),  -- Charlotte Frizura - Coiffure mariage
    ('cee18b1a', 'wedding_planner', 'beaute'),  -- Coiffeuse à domicile StudioC
    ('efb1f957', 'wedding_planner', 'beaute'),  -- Maison Marcelle
    ('06058fef', 'wedding_planner', 'beaute'),  -- Omar Bouker
    ('c49efac7', 'wedding_planner', 'beaute'),  -- Sarah Fekir Coiffeuse-Maquilleuse
    ('fa737684', 'wedding_planner', 'beaute'),  -- THE FABULEUSE
    ('6c8341bc', 'wedding_planner', 'dj'),  -- DJ Crystal Events
    ('91ad9bb3', 'wedding_planner', 'dj'),  -- Mick évents sonorisation
    ('e7b1f53e', 'wedding_planner', 'dj'),  -- Miguel Events
    ('30f2b7af', 'wedding_planner', 'dj'),  -- Xn Event
    ('e54395fa', 'wedding_planner', 'dj'),  -- Belles Nuits - DJ & Système son pour Mariage
    ('5d79e6b1', 'wedding_planner', 'dj'),  -- Dav-Animation
    ('98de1342', 'wedding_planner', 'dj'),  -- DJ Léo Animation
    ('9e6e0bb5', 'wedding_planner', 'dj'),  -- Fête24
    ('64c522b2', 'wedding_planner', 'dj'),  -- Magic Event
    ('1680a3dd', 'decoration', 'fleuriste'),  -- A Fl'Eure Déco
    ('bce8f0b1', 'decoration', 'fleuriste'),  -- FLOWERS & DECO
    ('ab500537', 'wedding_planner', 'fleuriste'),  -- Brindilles sauvages | Fleuriste Châteauroux
    ('1de8eabb', 'wedding_planner', 'fleuriste'),  -- Breizhloue
    ('cc7c1dfa', 'wedding_planner', 'fleuriste'),  -- Lily & Bloom Events
    ('9a3413f5', 'wedding_planner', 'fleuriste'),  -- Magnolia - atelier floral
    ('7e0fd896', 'wedding_planner', 'fleuriste'),  -- Poppy et Daisy - fleuriste mariage
    ('a65c4671', 'wedding_planner', 'fleuriste'),  -- Studio Paupiette
    ('2ff2068a', 'decoration', 'lieu'),  -- Domaine des 7 fontaines
    ('2c6bcd33', 'decoration', 'lieu'),  -- Evento 87
    ('f914e8b5', 'decoration', 'lieu'),  -- Events Home
    ('55c4f62f', 'decoration', 'lieu'),  -- Hôtel Kyriad Meaux
    ('632ffaa0', 'decoration', 'lieu'),  -- L'Escapade Nature et Gourmande - Gîtes et chambres d'hôtes
    ('028f25da', 'decoration', 'lieu'),  -- La Ferme Plate
    ('37a37513', 'decoration', 'lieu'),  -- Le Bô-Zine Reception/Location de Salle/Salle de Mariage
    ('ac414391', 'decoration', 'lieu'),  -- Le Domaine de Mauprié
    ('b1fd8411', 'decoration', 'lieu'),  -- Le Domaine des Sources
    ('69d25141', 'decoration', 'lieu'),  -- Le Perce Neige de l'Aubrac
    ('025a4f48', 'decoration', 'lieu'),  -- les salons raphael
    ('d27743a2', 'decoration', 'lieu'),  -- LOCATABLE
    ('0c8c9e05', 'decoration', 'lieu'),  -- O Jardin Du Bonheur
    ('e4f4ba97', 'wedding_planner', 'lieu'),  -- Château de Londigny
    ('655713eb', 'wedding_planner', 'lieu'),  -- Château de Villèle
    ('7db36796', 'wedding_planner', 'lieu'),  -- Château du Blanc Buisson séminaires, évènements, mariages,
    ('d444244b', 'wedding_planner', 'lieu'),  -- Colibri Évent's
    ('eda2f84d', 'wedding_planner', 'lieu'),  -- Domaine de Chapeau
    ('5a54458f', 'wedding_planner', 'lieu'),  -- Ferme Marie Hélène
    ('fc2d570f', 'wedding_planner', 'lieu'),  -- La Villa Montauville- Salle de réception Mariage, Annivers
    ('b2098c91', 'wedding_planner', 'lieu'),  -- Le Carré Saint Pierre
    ('f244ca0c', 'wedding_planner', 'lieu'),  -- Le Château de Mazières
    ('1e0cf1a0', 'wedding_planner', 'lieu'),  -- LE CLOS TALANCONNAIS
    ('a8e52f6c', 'wedding_planner', 'lieu'),  -- Le Domaine de Camelia
    ('624d98e3', 'wedding_planner', 'lieu'),  -- Le palmier d'or 77
    ('9abde10f', 'wedding_planner', 'lieu'),  -- LE PARADIS D'ANJELINA
    ('ff03bfc5', 'wedding_planner', 'lieu'),  -- Le Pavillon Wagram Location salle de réception de prestige
    ('a555d0c3', 'wedding_planner', 'lieu'),  -- Le Quai des Lanternes
    ('c9c42b50', 'wedding_planner', 'lieu'),  -- LE VILLAGE DU PHARE
    ('c9db7e13', 'wedding_planner', 'lieu'),  -- LOT of Happiness
    ('0a9d4758', 'wedding_planner', 'lieu'),  -- Manoir De L'ile Aux Loups
    ('d1d6563f', 'wedding_planner', 'lieu'),  -- Résidence Le One
    ('1afd8fc1', 'decoration', 'lieu'),  -- L'île Enchantée lieu de réception - Jardin extérieur à Lyo
    ('b79f5539', 'wedding_planner', 'lieu'),  -- Château de Bois Rigaud
    ('2ed44a2e', 'wedding_planner', 'lieu'),  -- Château de Crémat
    ('ef046bb3', 'wedding_planner', 'dj'),  -- CLT ÉVENTS
    ('453765a1', 'wedding_planner', 'lieu'),  -- Domaine de Clairbois
    ('0534de4e', 'wedding_planner', 'lieu'),  -- Domaine de Keravel
    ('3bb915ae', 'wedding_planner', 'lieu'),  -- Domaine de Lussau
    ('0c4273f5', 'wedding_planner', 'lieu'),  -- Domaine Des Coteaux D'or
    ('2bdf4ea4', 'wedding_planner', 'lieu'),  -- Domaine du Grand Cerf Blanc
    ('5c2ed7ab', 'wedding_planner', 'lieu'),  -- Hôtel Les Suites - Domaine de Crécy
    ('12e88e5d', 'wedding_planner', 'lieu'),  -- Mariage & Events
    ('4dfa7ed0', 'wedding_planner', 'lieu'),  -- Presqu'île Loc
    ('45f3f497', 'wedding_planner', 'lieu'),  -- Séminaire Villa Belle Rive
    ('628abfe0', 'wedding_planner', 'officiant'),  -- Cérémonie Laïque AMBIANCE EMOTIONS Alsace
    ('b908606d', 'wedding_planner', 'officiant'),  -- Elo'Events
    ('7878cd42', 'wedding_planner', 'officiant'),  -- Emy Cérémonies - Officiante de cérémonie en Isère/Rhône Al
    ('70b82fc9', 'wedding_planner', 'officiant'),  -- Les Bulles de Bonheur - Laetitia GOUX - Officiante de Céré
    ('4c85bd4b', 'wedding_planner', 'officiant'),  -- LES CEREMONIES DE FRED
    ('add9b50d', 'wedding_planner', 'officiant'),  -- Ma Belle Histoire - Officiante de Cérémonie Laïque
    ('3d118e4a', 'wedding_planner', 'officiant'),  -- Marie Dannery - Officiante de cérémonie
    ('8653cfe4', 'wedding_planner', 'officiant'),  -- Nouveau Chapitre - Officiante de cérémonie Centre Val de L
    ('50e591ed', 'wedding_planner', 'officiant'),  -- STL * HAPPY END
    ('9672bdd0', 'wedding_planner', 'officiant'),  -- Un vent d'amour
    ('38aa053a', 'wedding_planner', 'decoration'),  -- Armony Réception (ancien armony valois réception)
    ('68a0b467', 'wedding_planner', 'traiteur'),  -- De l'Evènement dans l'Air
    ('2435a27d', 'wedding_planner', 'officiant'),  -- Lilie événements
    ('9eb7ab0a', 'wedding_planner', 'officiant'),  -- Officiant laïque 'Pommes d'amour cérémonie laïque'
    ('ac38a22c', 'wedding_planner', 'officiant'),  -- Un Soupçon de Magie - Mariage Cérémonie Laïque Maine et Lo
    ('052fb404', 'decoration', 'photographe'),  -- Les mariages d Elo 78
    ('c430cbbb', 'wedding_planner', 'decoration'),  -- A Fleur de Po - Location mobilier, décoration, vaisselle &
    ('1118b059', 'wedding_planner', 'dj'),  -- DJ événements & location photobooth, sonorisation, artific
    ('7cb0c8fa', 'wedding_planner', 'decoration'),  -- Vos Moments - Location vaisselle, mobilier, photobooth...
    ('ff64c53c', 'wedding_planner', 'robe'),  -- Caralys Mariage Nice
    ('1681655a', 'wedding_planner', 'robe'),  -- AIGOUL KOVA
    ('86efbfa8', 'wedding_planner', 'robe'),  -- ANA Des Cabanasses - Robes de mariée sur mesure
    ('0b938b55', 'wedding_planner', 'decoration'),  -- Anim-Decor
    ('6b5096c9', 'wedding_planner', 'robe'),  -- Atelier Couture Cristina - Spécialiste mariage - Robes mar
    ('b445c073', 'wedding_planner', 'robe'),  -- Atelier Fleurdecoton - Robes de mariees sur mesure
    ('54bfb0d0', 'wedding_planner', 'robe'),  -- Au Dé D'Argent by Isabelle Mayrand
    ('99389379', 'wedding_planner', 'robe'),  -- Juliette Flambard - Robes de mariée
    ('9ea08578', 'wedding_planner', 'robe'),  -- KM COUTURE - Robes de mariée sur-mesure & location
    ('b6b86d75', 'wedding_planner', 'decoration'),  -- Le Manoir Evénements
    ('9106457c', 'wedding_planner', 'robe'),  -- Le P’tit Grain de Mil – Robes de mariée sur mesure
    ('228cbebd', 'wedding_planner', 'robe'),  -- Louise Valentine - Robes de mariée sur-mesure
    ('bc51ece8', 'wedding_planner', 'robe'),  -- Luiza Couture
    ('f3e04e92', 'wedding_planner', 'robe'),  -- Maryline Garel
    ('ce7856fc', 'wedding_planner', 'robe'),  -- Oreline
    ('04ccdb7b', 'wedding_planner', 'decoration'),  -- Passion Décor- Fournisseur et Grossiste décoration de mari
    ('74b42a6f', 'wedding_planner', 'robe'),  -- Robe de Créateur
    ('6d7b1117', 'wedding_planner', 'robe'),  -- Robes de mariée à Montpellier- La mariée by Sundus
    ('c36f9422', 'wedding_planner', 'robe'),  -- Secret de mariées
    ('2e8f1910', 'wedding_planner', 'robe'),  -- Un Mariage De Rêve
    ('f5a17816', 'wedding_planner', 'traiteur'),  -- Aux Jardins des Sens - Traiteur
    ('d37b84a0', 'wedding_planner', 'traiteur'),  -- BF EVENT'S
    ('94465a63', 'wedding_planner', 'traiteur'),  -- Eventail Gourmand
    ('4cbc5f86', 'wedding_planner', 'traiteur'),  -- Events Factory Traiteur
    ('814db647', 'wedding_planner', 'traiteur'),  -- EVIDENTIA EVENTS - Artisan Traiteur et Créateur d’évènemen
    ('982b28d7', 'wedding_planner', 'traiteur'),  -- Horace Events
    ('ef5dc069', 'wedding_planner', 'traiteur'),  -- LA BOX A ROTIR
    ('972071e2', 'wedding_planner', 'traiteur'),  -- Love event
    ('5a71a155', 'wedding_planner', 'traiteur'),  -- Mets des Lys Traiteur - Provence Paca - Spécialiste des ma
    ('bf171593', 'wedding_planner', 'traiteur'),  -- Sam et Lili's Events
    ('481bd211', 'wedding_planner', 'traiteur'),  -- Traiteur Halal Dina Events
    ('56ff009a', 'wedding_planner', 'decoration'),  -- Event Rent
    ('d15ad0fd', 'wedding_planner', 'videaste'),  -- 3mh Vidéo
    ('84784626', 'wedding_planner', 'videaste'),  -- dess1 - vidéo mariage
    ('c1b65039', 'wedding_planner', 'videaste'),  -- Eñvor Film - Vidéaste
    ('af8b26d2', 'wedding_planner', 'videaste'),  -- Hélène Vinuesa | Photographe+ Videaste I Biscarrosse | Pho
    ('39943b85', 'wedding_planner', 'videaste'),  -- Hugo Studio - Photographe et vidéaste
    ('6bb6569a', 'wedding_planner', 'videaste'),  -- Judith Gerardin Photographe Vidéaste
    ('078fed3a', 'wedding_planner', 'videaste'),  -- L'instant Prod | Vidéaste de mariage à Saint-Malo et Renne
    ('dbcfa132', 'wedding_planner', 'videaste'),  -- La Pépite Studio - Videaste Mariage Lille
    ('36c05dce', 'wedding_planner', 'videaste'),  -- Lawin Record - Vidéaste Mariage
    ('7d3c8a45', 'wedding_planner', 'videaste'),  -- Lisa Vidéaste | Films & vidéos de mariage
    ('ac757e72', 'wedding_planner', 'dj'),  -- LocaSon 64 LocaSon SAS
    ('d92ce1a1', 'wedding_planner', 'videaste'),  -- Mindset Production - Photographe & Vidéaste - Nice
    ('911c0928', 'wedding_planner', 'videaste'),  -- Pictura Event
    ('dbdbca4e', 'wedding_planner', 'videaste'),  -- Provence Vidéo Mariage
    ('8a93505e', 'wedding_planner', 'videaste'),  -- Sabrina VidéoTouch Vidéaste
    ('4cd294fb', 'wedding_planner', 'dj'),  -- Screen événementiel ( Location et prestation Son, Lumière,
    ('a3612962', 'wedding_planner', 'videaste'),  -- Sublimyze - Vidéaste de mariage en Grand-Est & Provence
    ('48422fd6', 'wedding_planner', 'videaste'),  -- Vidéaste Mariage - Karim Blondeau
    ('d420471e', 'decoration', 'wedding_planner'),  -- Great Colors Day
    ('45cb85eb', 'decoration', 'wedding_planner');  -- Voiles Et Paillettes

  -- Un préfixe de 8 caractères qui désignerait deux fiches arrête tout avant la moindre modification
  select count(*) into ambigus from _reclassement r where (select count(*) from catalog.vendors v where left(v.id::text, 8) = r.prefixe) > 1;
  if ambigus > 0 then
    raise exception 'Reclassement annulé : % préfixe(s) désignent plusieurs fiches', ambigus;
  end if;

  update catalog.vendors v set
    primary_category = r.vers,
    categories = array(select distinct x from unnest(v.categories || array[r.vers]) x),
    price_unit = case
      when v.price_unit = 'location' and r.vers <> 'lieu' then 'forfait'
      when v.price_unit = 'forfait' and r.vers = 'lieu' then 'location'
      else v.price_unit end,
    updated_at = now()
  from _reclassement r
  where left(v.id::text, 8) = r.prefixe
    and v.status = 'active'
    and v.primary_category = r.de
    and v.created_by_wedding is null
    and (to_regclass('public.pro_vendors') is null or not exists (select 1 from public.pro_vendors p where p.vendor_id = v.id));
  get diagnostics deplacees = row_count;

  select count(*) into introuvables from _reclassement r where not exists (select 1 from catalog.vendors v where left(v.id::text, 8) = r.prefixe);
  select count(*) into ignorees from _reclassement r where exists (select 1 from catalog.vendors v where left(v.id::text, 8) = r.prefixe and v.primary_category = r.de);

  raise notice 'Reclassement : % fiche(s) déplacée(s), % introuvable(s), % laissée(s) en place (statut, revendication ou ajout à la main)', deplacees, introuvables, ignorees;
end $$;
