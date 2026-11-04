-- Compte prestataire > Activité : corriger la catégorie après coup. « Créer sa fiche » présélectionnait
-- « Lieu de réception » par défaut (components/pro/Claim.js) ; un prestataire qui n'a pas touché la
-- pastille se retrouvait coincé avec les champs, le calcul de complétude et l'aperçu côté couples d'un
-- lieu, sans aucun moyen de se corriger (audit du 4 nov. 2026). pro_save_fiche ne touche pas à
-- primary_category (la liste blanche de ses colonnes l'exclut volontairement, voir pro-fiche-adresse.sql) :
-- changer de catégorie est une action à part, qui reclasse aussi l'onglet où la fiche apparaît côté
-- couples (Trouver des prestataires), d'où une fonction dédiée plutôt qu'un ajout silencieux à la liste.
-- Rejoue sans risque ; à coller après catalog.sql et espace-prestataire.sql.

create or replace function public.pro_set_category(v uuid, category text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if not public.is_pro_member(v) then
    raise exception 'pas votre fiche' using errcode = '42501';
  end if;
  if not exists (select 1 from catalog.categories c where c.slug = category) then
    raise exception 'catégorie inconnue' using errcode = '22023';
  end if;
  update catalog.vendors set
    categories     = array(select distinct unnest(array_remove(categories, primary_category) || category)),
    primary_category = category,
    -- Même règle que le déclencheur de pro_formulas : un lieu se loue, les autres métiers sont au forfait
    price_unit     = case
      when price_unit = 'location' and category <> 'lieu' then 'forfait'
      when price_unit = 'forfait' and category = 'lieu' then 'location'
      else price_unit
    end,
    updated_at     = now()
  where id = v;
end;
$$;
revoke all on function public.pro_set_category(uuid, text) from public, anon;
grant execute on function public.pro_set_category(uuid, text) to authenticated;

-- Le cercle du goût : classé lieu par le défaut de « Créer sa fiche », recatégorisé le 4 nov. 2026 sans que son
-- unité de prix suive (« la location » pour un traiteur). Seule fiche gérée dans ce cas au 4 nov. 2026.
update catalog.vendors set primary_category = 'traiteur', categories = array['traiteur'], updated_at = now()
where id = '15f47cc8-c007-4bc5-b1e5-9ffa8ee736ad' and primary_category = 'lieu';
update catalog.vendors set price_unit = 'forfait', updated_at = now()
where id = '15f47cc8-c007-4bc5-b1e5-9ffa8ee736ad' and primary_category = 'traiteur' and price_unit = 'location';
