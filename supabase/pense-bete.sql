-- Merry · pense-bête (post-it de rappels partagé entre les organisateurs)
-- À coller dans Supabase > SQL Editor > New query, puis Run, APRÈS dashboard.sql.
-- Le fichier peut être relancé sans risque : il ne supprime aucune donnée.
--
-- Une liste à cocher en vrac (courses, idées, question à poser à un
-- prestataire…), visible par tous les organisateurs du mariage.

create table if not exists public.pense_bete_items (
  id          uuid primary key default gen_random_uuid(),
  wedding_id  uuid not null references public.weddings (id) on delete cascade,
  text        text not null check (length(text) between 1 and 300),
  done        boolean not null default false,
  done_at     timestamptz,
  added_by    uuid,                       -- wedding_members.id
  position    integer not null default 0,
  created_at  timestamptz not null default now(),
  unique (wedding_id, id),
  foreign key (wedding_id, added_by) references public.wedding_members (wedding_id, id) on delete set null (added_by)
);
create index if not exists pense_bete_items_wedding_idx on public.pense_bete_items (wedding_id);

-- Mêmes droits pour tous les organisateurs du mariage
alter table public.pense_bete_items enable row level security;
drop policy if exists "organisateurs: tout" on public.pense_bete_items;
create policy "organisateurs: tout" on public.pense_bete_items for all to authenticated
  using (public.is_wedding_member(wedding_id))
  with check (public.is_wedding_member(wedding_id));
