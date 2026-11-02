-- Merry · « Ajouter un prestataire » (Mes prestataires et Trouver des prestataires) : quand la
-- recherche dans le catalogue Merry ne donne rien, l'appli cherche maintenant sur Google (route
-- /api/prestataires/recherche-google, nécessite GOOGLE_PLACES_API_KEY) et propose une fiche déjà
-- remplie (nom, adresse, téléphone, site, position) plutôt qu'un formulaire vide.
-- À coller dans Supabase > SQL Editor > New query, puis Run, APRÈS prestataires-ajout-manuel.sql.
-- Remplace merry_add_vendor_manual par une version qui accepte aussi téléphone, site et position :
-- la fonction à 4 arguments est retirée (son usage aurait été ambigu à côté de celle-ci), le
-- comportement reste le même pour un appel sans ces nouveaux champs (ils sont facultatifs).

drop function if exists public.merry_add_vendor_manual(uuid, text, text, text);

create or replace function public.merry_add_vendor_manual(
  w uuid, vname text, category text, city text,
  phone text default null, website text default null, vlat double precision default null, vlng double precision default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  new_id uuid;
  clean_name text := nullif(trim(vname), '');
  clean_city text := nullif(trim(left(coalesce(city, ''), 80)), '');
  clean_phone text := nullif(trim(left(coalesce(phone, ''), 40)), '');
  clean_website text := nullif(trim(left(coalesce(website, ''), 300)), '');
  v_lat double precision := vlat;
  v_lng double precision := vlng;
begin
  if not public.is_wedding_member(w) then
    raise exception 'not a wedding member';
  end if;
  if clean_name is null or length(clean_name) > 120 then
    raise exception 'invalid name';
  end if;
  if category not in ('lieu', 'traiteur', 'dj', 'musiciens', 'fleuriste', 'photographe', 'videaste', 'decoration', 'wedding_planner', 'patisserie', 'beaute', 'robe', 'transport', 'officiant') then
    raise exception 'invalid category';
  end if;
  if clean_website is not null and clean_website !~* '^https?://' then
    clean_website := 'https://' || clean_website;
  end if;

  select v.id into new_id from catalog.vendors v
    where v.status = 'active' and v.primary_category = category and public.merry_norm(v.name) = public.merry_norm(clean_name)
      and (clean_city is null or v.city is null or public.merry_norm(v.city) = public.merry_norm(clean_city))
    limit 1;
  if new_id is not null then
    return new_id;
  end if;

  if v_lat is null and clean_city is not null then
    select p.lat, p.lng into v_lat, v_lng from public.merry_place(clean_city) p limit 1;
  end if;

  insert into catalog.vendors (name, primary_category, status, city, categories, lat, lng, phone, website)
  values (clean_name, category, 'active', clean_city, array[category], v_lat, v_lng, clean_phone, clean_website)
  returning id into new_id;

  return new_id;
end;
$$;

revoke all on function public.merry_add_vendor_manual(uuid, text, text, text, text, text, double precision, double precision) from public, anon;
grant execute on function public.merry_add_vendor_manual(uuid, text, text, text, text, text, double precision, double precision) to authenticated;
