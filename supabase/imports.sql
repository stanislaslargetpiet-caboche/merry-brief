-- Merry · imports de listes d'invités en arrière-plan
-- À coller dans Supabase > SQL Editor > Run (après dashboard.sql ; peut être relancé sans risque).
--
-- Un import = une ligne dans guest_imports (le fichier déposé) et une ligne par morceau dans
-- guest_import_parts (la lecture de chaque morceau par l'IA). Le serveur écrit les résultats
-- même si l'organisateur a quitté la page ou verrouillé son téléphone ; il les retrouve en revenant.

create table if not exists public.guest_imports (
  id          uuid primary key,
  wedding_id  uuid not null references public.weddings (id) on delete cascade,
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name        text not null check (length(name) <= 200),
  kind        text,
  note        text,
  total       smallint not null check (total between 1 and 200),
  local       jsonb,          -- lecture locale (colonne par colonne) : secours si l'IA échoue
  created_at  timestamptz not null default now()
);
create index if not exists guest_imports_wedding_idx on public.guest_imports (wedding_id, created_at);

create table if not exists public.guest_import_parts (
  import_id   uuid not null references public.guest_imports (id) on delete cascade,
  idx         smallint not null,
  wedding_id  uuid not null references public.weddings (id) on delete cascade,
  status      text not null default 'running' check (status in ('running', 'done', 'failed')),
  result      jsonb,
  error       text,
  updated_at  timestamptz not null default now(),
  primary key (import_id, idx)
);
create index if not exists guest_import_parts_wedding_idx on public.guest_import_parts (wedding_id);

alter table public.guest_imports enable row level security;
alter table public.guest_import_parts enable row level security;

drop policy if exists "imports: organisateurs" on public.guest_imports;
create policy "imports: organisateurs" on public.guest_imports for all to authenticated
  using (public.is_wedding_member(wedding_id))
  with check (public.is_wedding_member(wedding_id) and user_id = auth.uid());

drop policy if exists "morceaux d'import: organisateurs" on public.guest_import_parts;
create policy "morceaux d'import: organisateurs" on public.guest_import_parts for all to authenticated
  using (public.is_wedding_member(wedding_id))
  with check (public.is_wedding_member(wedding_id));

grant select, insert, update, delete on public.guest_imports to authenticated;
grant select, insert, update, delete on public.guest_import_parts to authenticated;

-- Ménage : les imports non terminés depuis plus de trois jours disparaissent à la prochaine lecture
create or replace function public.merry_imports_cleanup()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.guest_imports where created_at < now() - interval '3 days' and public.is_wedding_member(wedding_id);
$$;
revoke all on function public.merry_imports_cleanup() from public, anon;
grant execute on function public.merry_imports_cleanup() to authenticated;
