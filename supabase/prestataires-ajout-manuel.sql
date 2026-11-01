-- Merry · « Ajouter un prestataire » (Mes prestataires) : un couple qui a déjà trouvé un prestataire
-- ailleurs le cherche d'abord dans le catalogue Merry ; s'il n'y est pas, sa saisie à la main (nom,
-- catégorie, ville) crée une vraie fiche dans catalog.vendors, active tout de suite (décision de Stan,
-- 1er nov. 2026) : visible dans les recommandations et les recherches de tous les couples, sans relecture.
-- À coller dans Supabase > SQL Editor > New query, puis Run, APRÈS prestataires.sql et lieux-rapides.sql.
--
-- Premier insert de l'appli dans catalog.vendors (jusqu'ici rempli seulement par l'import Google/Firecrawl
-- d'Hugues) : à tester une fois après avoir collé ce fichier (bouton « Ajouter un prestataire » > saisie
-- à la main, sur un prestataire test), et prévenir si ça échoue.
--
-- Garde-fou contre les doublons : une fiche déjà active avec le même nom et la même ville (ou sans ville
-- des deux côtés), dans la même catégorie précise, est réutilisée plutôt que recréée.

create or replace function public.merry_add_vendor_manual(w uuid, vname text, category text, city text)
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
  v_lat double precision;
  v_lng double precision;
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

  select id into new_id from catalog.vendors
    where status = 'active' and primary_category = category and public.merry_norm(name) = public.merry_norm(clean_name)
      and (clean_city is null or city is null or public.merry_norm(city) = public.merry_norm(clean_city))
    limit 1;
  if new_id is not null then
    return new_id;
  end if;

  if clean_city is not null then
    select p.lat, p.lng into v_lat, v_lng from public.merry_place(clean_city) p limit 1;
  end if;

  insert into catalog.vendors (name, primary_category, status, city, categories, lat, lng)
  values (clean_name, category, 'active', clean_city, array[category], v_lat, v_lng)
  returning id into new_id;

  return new_id;
end;
$$;

revoke all on function public.merry_add_vendor_manual(uuid, text, text, text) from public, anon;
grant execute on function public.merry_add_vendor_manual(uuid, text, text, text) to authenticated;
