-- Merry · documents (dossiers partagés entre les organisateurs)
-- À coller dans Supabase > SQL Editor > New query, puis Run, APRÈS dashboard.sql.
-- Le fichier peut être relancé sans risque : il ne supprime aucune donnée.
--
-- Principe : chaque mariage a des dossiers (document_folders : Factures et devis,
-- Mairie, Préparation religieuse…) dans lesquels les organisateurs déposent des
-- fichiers. Les fichiers vont dans un stockage privé (merry-documents), un dossier
-- par mariage ; ils se lisent par des liens signés, valables une heure.
-- La table documents existait déjà pour les devis et factures du budget (des liens) :
-- elle accueille maintenant aussi les fichiers déposés, dans un dossier ou non.

create table if not exists public.document_folders (
  id              uuid primary key default gen_random_uuid(),
  wedding_id      uuid not null references public.weddings (id) on delete cascade,
  name            text not null check (length(name) between 1 and 80),
  color           text not null default 'lavande',
  position        integer not null default 0,
  created_by      uuid,                       -- wedding_members.id
  created_at      timestamptz not null default now(),
  unique (wedding_id, id),
  foreign key (wedding_id, created_by) references public.wedding_members (wedding_id, id) on delete set null (created_by)
);
create index if not exists document_folders_wedding_idx on public.document_folders (wedding_id);

-- La table documents : un fichier déposé (storage_path) ou un lien (url)
alter table public.documents add column if not exists folder_id uuid;
alter table public.documents add column if not exists storage_path text;
alter table public.documents add column if not exists size_bytes bigint;
alter table public.documents add column if not exists mime text;
alter table public.documents add column if not exists added_by uuid;
alter table public.documents alter column url drop not null;
alter table public.documents drop constraint if exists documents_url_check;
alter table public.documents add constraint documents_url_check
  check (url is null or url ~* '^https?://');
alter table public.documents drop constraint if exists documents_source_check;
alter table public.documents add constraint documents_source_check
  check (url is not null or storage_path is not null);
alter table public.documents drop constraint if exists documents_folder_fkey;
alter table public.documents add constraint documents_folder_fkey
  foreign key (wedding_id, folder_id) references public.document_folders (wedding_id, id) on delete cascade;
alter table public.documents drop constraint if exists documents_added_by_fkey;
alter table public.documents add constraint documents_added_by_fkey
  foreign key (wedding_id, added_by) references public.wedding_members (wedding_id, id) on delete set null (added_by);
create index if not exists documents_folder_idx on public.documents (wedding_id, folder_id);

-- Mêmes droits pour tous les organisateurs du mariage
alter table public.document_folders enable row level security;
drop policy if exists "organisateurs: tout" on public.document_folders;
create policy "organisateurs: tout" on public.document_folders for all to authenticated
  using (public.is_wedding_member(wedding_id))
  with check (public.is_wedding_member(wedding_id));

-- ---------------------------------------------------------------------------
-- Fichiers : stockage privé, chaque mariage écrit et lit dans son dossier
-- (« <wedding_id>/<dossier>/<fichier> »). 25 Mo par fichier.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit)
values ('merry-documents', 'merry-documents', false, 26214400)
on conflict (id) do nothing;

create or replace function public.merry_document_owner(object_name text)
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
revoke all on function public.merry_document_owner(text) from public, anon;
grant execute on function public.merry_document_owner(text) to authenticated;

drop policy if exists "documents: lecture" on storage.objects;
create policy "documents: lecture" on storage.objects for select to authenticated
  using (bucket_id = 'merry-documents' and public.merry_document_owner(name));
drop policy if exists "documents: ajout" on storage.objects;
create policy "documents: ajout" on storage.objects for insert to authenticated
  with check (bucket_id = 'merry-documents' and public.merry_document_owner(name));
drop policy if exists "documents: modification" on storage.objects;
create policy "documents: modification" on storage.objects for update to authenticated
  using (bucket_id = 'merry-documents' and public.merry_document_owner(name));
drop policy if exists "documents: retrait" on storage.objects;
create policy "documents: retrait" on storage.objects for delete to authenticated
  using (bucket_id = 'merry-documents' and public.merry_document_owner(name));
