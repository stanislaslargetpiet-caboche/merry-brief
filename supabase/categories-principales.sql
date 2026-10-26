-- Merry · catalogue : la bonne catégorie principale (primary_category) pour les lieux et les traiteurs
-- À coller dans Supabase > SQL Editor > New query, puis Run. Relançable : ne touche que les fiches mal classées.
--
-- Les onglets de « Trouver des prestataires » suivent primary_category : un prestataire n'apparaît que
-- dans l'onglet de sa catégorie principale. À l'import, elle venait parfois d'une catégorie secondaire :
-- des lieux de réception classés traiteurs (« La Grange du Lay », Google : « Lieu de mariage ») et des
-- traiteurs classés lieux (« MG Réception - Traiteur »). Les fiches revendiquées par leur prestataire
-- (espace prestataire, s'il est installé) ne sont pas touchées.

do $$
declare
  claimed text := case when to_regclass('public.pro_vendors') is not null
                       then 'and not exists (select 1 from public.pro_vendors p where p.vendor_id = v.id)' else '' end;
  n1 integer;
  n2 integer;
begin
  -- Traiteurs qui sont des lieux : Google les présente d'abord comme lieu, salle ou hébergement
  execute format($q$
    update catalog.vendors v set primary_category = 'lieu', updated_at = now()
    where v.status = 'active'
      and v.primary_category = 'traiteur'
      and 'lieu' = any (v.categories)
      and v.google_categories[1] ~* '^(lieu de mariage|salle de r[ée]ception|salle de banquet|espace [ée]v[ée]nementiel|ch[aâ]teau|domaine|manoir|chambre d.h[ôo]tes|g[îi]te|h[ôo]tel|centre de conf[ée]rence|s[ée]minaire)'
      %s $q$, claimed);
  get diagnostics n1 = row_count;

  -- Lieux qui sont des traiteurs : Google les présente d'abord comme traiteur, rien n'indique un lieu
  execute format($q$
    update catalog.vendors v set primary_category = 'traiteur',
      categories = array(select distinct x from unnest(v.categories || array['traiteur']) x), updated_at = now()
    where v.status = 'active'
      and v.primary_category = 'lieu'
      and v.google_categories[1] ~* '^traiteur'
      and v.capacity_seated is null and v.beds is null
      and v.name !~* '(grange|domaine|ch[aâ]teau|manoir|mas |bastide|moulin|ferme|salle)'
      %s $q$, claimed);
  get diagnostics n2 = row_count;

  raise notice 'Catégories corrigées : % traiteurs devenus lieux, % lieux devenus traiteurs', n1, n2;
end $$;
