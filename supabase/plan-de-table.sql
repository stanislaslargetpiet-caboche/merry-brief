-- Merry · plan de table
-- À coller dans Supabase > SQL Editor > New query, puis Run, APRÈS dashboard.sql.
-- Le fichier peut être relancé sans risque : il ne supprime aucune donnée.
--
-- Un plan par moment du mariage (le dîner, le plus souvent) : des tables avec un nom et un nombre de
-- places, et qui s'assoit où. Un invité et ses accompagnants sont gardés ensemble par le placement
-- automatique, et signalés quand ils sont séparés.

create table if not exists public.seating_tables (
  id              uuid primary key default gen_random_uuid(),
  wedding_id      uuid not null references public.weddings (id) on delete cascade,
  event_id        uuid not null,
  name            text not null,               -- « Table 1 », « Table des mariés », « Les cousins »
  capacity        smallint not null default 8,
  position        smallint not null default 0,
  unique (wedding_id, id),
  foreign key (wedding_id, event_id) references public.events (wedding_id, id) on delete cascade
);
create index if not exists seating_tables_wedding_idx on public.seating_tables (wedding_id, event_id);

create table if not exists public.seating (
  wedding_id      uuid not null references public.weddings (id) on delete cascade,
  event_id        uuid not null,
  guest_id        uuid not null,
  table_id        uuid not null,
  position        smallint not null default 0,
  primary key (event_id, guest_id),
  foreign key (wedding_id, guest_id) references public.guests (wedding_id, id) on delete cascade,
  foreign key (wedding_id, table_id) references public.seating_tables (wedding_id, id) on delete cascade
);
create index if not exists seating_wedding_idx on public.seating (wedding_id, event_id);

alter table public.seating_tables enable row level security;
alter table public.seating enable row level security;
do $$
declare t text;
begin
  foreach t in array array['seating_tables', 'seating']
  loop
    execute format('drop policy if exists "organisateurs: tout" on public.%I', t);
    execute format('create policy "organisateurs: tout" on public.%I for all to authenticated
                    using (public.is_wedding_member(wedding_id))
                    with check (public.is_wedding_member(wedding_id))', t);
  end loop;
end $$;

-- Direct entre organisateurs (sync-et-historique.sql) : le plan aussi
do $$
declare t text;
begin
  foreach t in array array['seating_tables', 'seating']
  loop
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
exception when undefined_object then
  null;
end $$;

-- Les suppressions (table retirée, invité enlevé d'une table) voyagent avec la ligne entière, comme pour
-- les autres tables de la liste (voir supabase/sync-et-historique.sql)
alter table public.seating_tables replica identity full;
alter table public.seating replica identity full;
