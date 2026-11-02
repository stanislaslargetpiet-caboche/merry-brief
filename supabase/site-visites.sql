-- Merry · visites du site de mariage (compteur réel) : une ligne par chargement de la page
-- publique /s/<slug>, loguée automatiquement par merry_site_public (site-mariage.sql).
-- À coller dans Supabase > SQL Editor > New query, puis Run, APRÈS site-mariage.sql.
-- Le fichier peut être relancé sans risque : il ne supprime aucune donnée.
--
-- Une visite = une personne (jeton anonyme gardé dans son navigateur) par site et par heure ;
-- un rechargement ne compte pas deux fois, et un site ne peut pas dépasser 5 000 visites par jour
-- (un script qui martèle la page ne gonfle ni la table ni le compteur).

create table if not exists public.site_visits (
  id          bigint generated always as identity primary key,
  wedding_id  uuid not null references public.weddings (id) on delete cascade,
  visited_at  timestamptz not null default now()
);

create index if not exists site_visits_wedding_idx on public.site_visits (wedding_id, visited_at);
alter table public.site_visits add column if not exists visitor text;
create index if not exists site_visits_visitor_idx on public.site_visits (wedding_id, visitor, visited_at);

alter table public.site_visits enable row level security;

drop policy if exists "organisateurs: lecture" on public.site_visits;
create policy "organisateurs: lecture" on public.site_visits for select to authenticated
  using (public.is_wedding_member(wedding_id));

-- Personne n'écrit directement ici (ni anon, ni authenticated) : seule la fonction
-- merry_site_public, en security definer, enregistre une visite.
revoke all on public.site_visits from anon, authenticated;
grant select on public.site_visits to authenticated;

-- Nombre de visites des 7 derniers jours pour un mariage, lu par le tableau de bord
create or replace function public.merry_site_visits_7j(p_wedding_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer
    from public.site_visits
   where wedding_id = p_wedding_id
     and visited_at >= now() - interval '7 days'
     and public.is_wedding_member(p_wedding_id);
$$;
revoke all on function public.merry_site_visits_7j(uuid) from public, anon;
grant execute on function public.merry_site_visits_7j(uuid) to authenticated;

-- merry_site_public (site-mariage.sql) est redéfinie ici en entier (form_slug) ; elle ne journalise
-- plus rien : la visite est enregistrée à part par merry_site_visit, appelée une fois par la page, pour
-- que l'aperçu de lien généré par le serveur, les robots des messageries et les rechargements ne
-- comptent pas (ajout du 2 novembre 2026).
create or replace function public.merry_site_public(site_slug text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  s public.wedding_sites%rowtype;
  w public.weddings%rowtype;
  evs jsonb;
  form_slug text;
begin
  select * into s from public.wedding_sites where slug = site_slug;
  if not found then
    return null;
  end if;
  select * into w from public.weddings where id = s.wedding_id;
  if not s.published then
    return jsonb_build_object('closed', true, 'partner1', w.partner1, 'partner2', w.partner2);
  end if;

  -- Moments : toutes les colonnes présentes (date et type viennent de colonnes.sql), sans le mariage
  select coalesce(jsonb_agg(to_jsonb(e) - 'wedding_id' order by e.position), '[]'::jsonb)
    into evs
    from public.events e
   where e.wedding_id = w.id;

  if to_regclass('public.guest_forms') is not null then
    execute 'select slug from public.guest_forms where wedding_id = $1 and published' into form_slug using w.id;
  end if;

  return jsonb_build_object(
    'slug', s.slug,
    'template', s.template,
    'palette', s.palette,
    'fonts', s.fonts,
    'sections', s.sections,
    'content', s.content,
    'partner1', w.partner1,
    'partner2', w.partner2,
    'wedding_date', w.wedding_date,
    'venue', w.venue,
    'region', w.region,
    'events', evs,
    'form_slug', form_slug
  );
end;
$$;
revoke all on function public.merry_site_public(text) from public;
grant execute on function public.merry_site_public(text) to anon, authenticated;

-- Journalise une visite : appelée une fois par la page du site, avec le jeton anonyme du visiteur
-- (32 caractères, tiré au hasard dans son navigateur). Rien n'est renvoyé.
create or replace function public.merry_site_visit(site_slug text, visitor_id text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  wid uuid;
  vis text := nullif(regexp_replace(coalesce(visitor_id, ''), '[^A-Za-z0-9_-]', '', 'g'), '');
begin
  select wedding_id into wid from public.wedding_sites where slug = site_slug and published;
  if wid is null then
    return;
  end if;
  if vis is not null and length(vis) > 64 then
    vis := left(vis, 64);
  end if;
  if vis is not null and exists (select 1 from public.site_visits where wedding_id = wid and visitor = vis and visited_at > now() - interval '1 hour') then
    return;
  end if;
  if (select count(*) from public.site_visits where wedding_id = wid and visited_at > now() - interval '1 day') >= 5000 then
    return;
  end if;
  insert into public.site_visits (wedding_id, visitor) values (wid, vis);
end;
$$;
revoke all on function public.merry_site_visit(text, text) from public;
grant execute on function public.merry_site_visit(text, text) to anon, authenticated;
