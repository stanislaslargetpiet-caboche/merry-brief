-- Merry · site de mariage (le lien que le couple donne à ses invités : programme, lieu, pratique)
-- À coller dans Supabase > SQL Editor > New query, puis Run, APRÈS dashboard.sql.
-- Le fichier peut être relancé sans risque : il ne supprime aucune donnée.
--
-- Principe : un site par mariage (wedding_sites). Les organisateurs choisissent un modèle, des
-- couleurs, une police, l'ordre et l'affichage des rubriques, et remplissent leur contenu (jsonb).
-- Les moments du programme sont ceux de la liste d'invités (events) ; le site ajoute l'heure, le
-- lieu et un petit mot. La page publique /s/<adresse> est lue par une fonction ouverte sans compte
-- (merry_site_public) : les visiteurs ne lisent jamais les tables directement.
-- La liste et la cagnotte viendront plus tard.

create table if not exists public.wedding_sites (
  wedding_id      uuid primary key references public.weddings (id) on delete cascade,
  slug            text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) between 6 and 80),
  published       boolean not null default true,
  template        text not null default 'horizon'
                  check (template in ('horizon', 'terracotta', 'perle', 'embarquement', 'colline', 'belvedere', 'moisson', 'rivage')),
  palette         text not null default 'origine' check (palette ~ '^[a-z0-9-]{2,30}$'),
  fonts           text check (fonts is null or fonts ~ '^[a-z0-9-]{2,30}$'),     -- vide : la police du modèle
  sections        jsonb not null default '[]'::jsonb,                              -- [{ key, hidden }] dans l'ordre du site
  content         jsonb not null default '{}'::jsonb check (octet_length(content::text) < 200000),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table public.wedding_sites enable row level security;

drop policy if exists "organisateurs: tout" on public.wedding_sites;
create policy "organisateurs: tout" on public.wedding_sites for all to authenticated
  using (public.is_wedding_member(wedding_id))
  with check (public.is_wedding_member(wedding_id));

revoke all on public.wedding_sites from anon;
grant select, insert, update, delete on public.wedding_sites to authenticated;

-- ---------------------------------------------------------------------------
-- Photos du site : même stockage public que la photo du formulaire (« merry-covers »),
-- chaque mariage écrit dans son dossier. Repris ici pour que le site marche sans formulaire.sql.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('merry-covers', 'merry-covers', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create or replace function public.merry_cover_owner(object_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  folder text := split_part(object_name, '/', 1);
begin
  if folder !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;
  return public.is_wedding_member(folder::uuid);
end;
$$;
revoke all on function public.merry_cover_owner(text) from public, anon;
grant execute on function public.merry_cover_owner(text) to authenticated;

drop policy if exists "couvertures: ajout" on storage.objects;
create policy "couvertures: ajout" on storage.objects for insert to authenticated
  with check (bucket_id = 'merry-covers' and public.merry_cover_owner(name));
drop policy if exists "couvertures: modification" on storage.objects;
create policy "couvertures: modification" on storage.objects for update to authenticated
  using (bucket_id = 'merry-covers' and public.merry_cover_owner(name));
drop policy if exists "couvertures: retrait" on storage.objects;
create policy "couvertures: retrait" on storage.objects for delete to authenticated
  using (bucket_id = 'merry-covers' and public.merry_cover_owner(name));

-- ---------------------------------------------------------------------------
-- Site public : ce que voit l'invité. Site éteint : seulement les prénoms, pour dire
-- « ce site n'est pas encore ouvert ». Le lien du formulaire invités est joint s'il est en ligne.
-- ---------------------------------------------------------------------------

create or replace function public.merry_site_public(site_slug text)
returns jsonb
language plpgsql
stable
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
