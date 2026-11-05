-- Ma fiche > Présentation : téléphone et mail modifiables par le prestataire (demande de Stan le
-- 5 nov. 2026). Reprend aussi l'adresse (pro-fiche-adresse.sql) et le lien vers la brochure, que la
-- fonction en production n'enregistrait pas. Rejoue sans risque ; à coller après espace-prestataire.sql.

create or replace function public.pro_save_fiche(v uuid, patch jsonb)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  d jsonb := '{}'::jsonb;
  k text;
begin
  if not public.is_pro_member(v) then
    raise exception 'pas votre fiche' using errcode = '42501';
  end if;
  foreach k in array array['video_url', 'brochure_url', 'caterer_imposed', 'caterer_mode', 'music_end', 'outdoor_ceremony', 'parking', 'accessible', 'parking_note', 'includes', 'service_area', 'service_radius_km', 'team_size'] loop
    if patch ? k then d := d || jsonb_build_object(k, patch -> k); end if;
  end loop;
  update catalog.vendors set
    description       = case when patch ? 'description' then nullif(left(patch ->> 'description', 3000), '') else description end,
    website            = case when patch ? 'website' then nullif(left(patch ->> 'website', 200), '') else website end,
    address           = case when patch ? 'address' then nullif(left(patch ->> 'address', 200), '') else address end,
    postal_code       = case when patch ? 'postal_code' then nullif(left(patch ->> 'postal_code', 10), '') else postal_code end,
    city              = case when patch ? 'city' then coalesce(nullif(left(patch ->> 'city', 120), ''), city) else city end,
    phone             = case when patch ? 'phone' then nullif(left(patch ->> 'phone', 30), '') else phone end,
    email             = case when patch ? 'email' then nullif(lower(left(patch ->> 'email', 200)), '') else email end,
    style_tags        = case when patch ? 'style_tags' then array(select jsonb_array_elements_text(patch -> 'style_tags')) else style_tags end,
    capacity_seated   = case when patch ? 'capacity_seated' then (patch ->> 'capacity_seated')::int else capacity_seated end,
    capacity_standing = case when patch ? 'capacity_standing' then (patch ->> 'capacity_standing')::int else capacity_standing end,
    beds              = case when patch ? 'beds' then (patch ->> 'beds')::int else beds end,
    airport_name      = case when patch ? 'airport_name' then nullif(left(patch ->> 'airport_name', 120), '') else airport_name end,
    airport_minutes   = case when patch ? 'airport_minutes' then (patch ->> 'airport_minutes')::smallint else airport_minutes end,
    station_name      = case when patch ? 'station_name' then nullif(left(patch ->> 'station_name', 120), '') else station_name end,
    station_minutes   = case when patch ? 'station_minutes' then (patch ->> 'station_minutes')::smallint else station_minutes end,
    -- une valeur null efface l'information (« je ne sais pas »), les autres la remplacent
    details           = (details - array(select key from jsonb_each(d) where value = 'null'::jsonb)) || jsonb_strip_nulls(d),
    updated_at        = now()
  where id = v;
end;
$$;
revoke all on function public.pro_save_fiche(uuid, jsonb) from public, anon;
grant execute on function public.pro_save_fiche(uuid, jsonb) to authenticated;
