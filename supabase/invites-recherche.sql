-- Merry · retrouver la fête (flux « J'ai un code » / « Je cherche par prénoms », site vitrine /onboarding)
-- À coller dans Supabase > SQL Editor > New query, puis Run, APRÈS site-mariage.sql.
-- Le fichier peut être relancé sans risque : il ne supprime aucune donnée.
--
-- Le code donné aux invités est l'adresse du site (wedding_sites.slug) : pas de champ séparé à
-- maintenir. La recherche par prénoms compare partner1/partner2 (weddings), dans n'importe quel
-- ordre, à la date du mariage en option pour lever l'ambiguïté. Un site non publié ne ressort
-- d'aucune des deux recherches : les invités ne doivent pas tomber sur un site encore en travaux.

create or replace function public.merry_find_wedding(p_code text default null, p_name1 text default null, p_name2 text default null, p_date date default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  s public.wedding_sites%rowtype;
  w public.weddings%rowtype;
  n1 text := nullif(trim(p_name1), '');
  n2 text := nullif(trim(p_name2), '');
  hits uuid[];
begin
  if p_code is not null and trim(p_code) <> '' then
    select * into s from public.wedding_sites where lower(slug) = lower(trim(p_code)) and published;
    if not found then
      return null;
    end if;
  elsif n1 is not null then
    select array_agg(ww.id) into hits
      from public.wedding_sites ws
      join public.weddings ww on ww.id = ws.wedding_id
     where ws.published
       and (
             (ww.partner1 ilike n1 and (n2 is null or ww.partner2 ilike n2))
          or (ww.partner2 ilike n1 and (n2 is null or ww.partner1 ilike n2))
       )
       and (p_date is null or ww.wedding_date = p_date);
    -- Plus d'un couple porte ces prénoms : on ne montre rien plutôt qu'un mauvais mariage,
    -- l'invité est invité à préciser la date pour trancher.
    if hits is null or array_length(hits, 1) <> 1 then
      return null;
    end if;
    select * into s from public.wedding_sites where wedding_id = hits[1];
  else
    return null;
  end if;

  select * into w from public.weddings where id = s.wedding_id;

  return jsonb_build_object(
    'slug', s.slug,
    'partner1', w.partner1,
    'partner2', w.partner2,
    'wedding_date', w.wedding_date,
    'venue', w.venue,
    'region', w.region,
    'cover', s.content #>> '{photos,cover}'
  );
end;
$$;

revoke all on function public.merry_find_wedding(text, text, text, date) from public;
grant execute on function public.merry_find_wedding(text, text, text, date) to anon, authenticated;
