-- Merry · modifications de l'équipe sur la liste des invités
-- À coller dans Supabase > SQL Editor > New query, puis Run, APRÈS sync-et-historique.sql (et
-- fiche-et-vues-invites.sql si la note des invités est installée). Le fichier peut être relancé sans risque.
--
-- guest_activity : qui a changé quoi sur la liste, avec l'ancienne et la nouvelle valeur. Rempli par des
-- déclencheurs sur guests (ajout, retrait, champ modifié) et guest_responses (réponse à un moment).
-- La pastille « Modifications » de la liste des invités montre celles des 3 derniers jours faites par un
-- autre organisateur ; le formulaire invités (sans compte connecté) est noté « formulaire » et n'y figure pas.

create table if not exists public.guest_activity (
  id              uuid primary key default gen_random_uuid(),
  wedding_id      uuid not null references public.weddings (id) on delete cascade,
  guest_id        uuid,                       -- pas de clé étrangère : un invité retiré garde sa trace
  guest_name      text not null default '',   -- nom au moment du changement
  kind            text not null check (kind in ('ajout', 'retrait', 'champ', 'reponse')),
  field           text,                       -- colonne de guests, « custom:<guest_fields.id> », ou rien
  event_id        uuid,                       -- pour une réponse
  old_value       text,
  new_value       text,
  source          text not null default 'organisateur' check (source in ('formulaire', 'organisateur')),
  member_id       uuid,                       -- wedding_members.id quand c'est un organisateur
  created_at      timestamptz not null default now()
);
create index if not exists guest_activity_wedding_idx on public.guest_activity (wedding_id, created_at);

alter table public.guest_activity enable row level security;
drop policy if exists "activite: lecture" on public.guest_activity;
create policy "activite: lecture" on public.guest_activity for select to authenticated
  using (public.is_wedding_member(wedding_id));
-- Personne n'écrit l'activité à la main : seuls les déclencheurs ci-dessous la remplissent
revoke insert, update, delete on public.guest_activity from authenticated, anon;

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'guest_activity') then
    execute 'alter publication supabase_realtime add table public.guest_activity';
  end if;
exception when undefined_object then
  raise notice 'publication supabase_realtime absente : activez Realtime dans le projet';
end $$;

-- Auteur du changement : l'organisateur connecté, sinon le formulaire
create or replace function public.merry_activity_member(w uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.wedding_members where wedding_id = w and user_id = auth.uid() and auth.uid() is not null limit 1;
$$;
revoke execute on function public.merry_activity_member(uuid) from public, anon, authenticated;

create or replace function public.merry_log_guest()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  w uuid := coalesce(new.wedding_id, old.wedding_id);
  who uuid;
  src text := case when auth.uid() is null then 'formulaire' else 'organisateur' end;
  o jsonb;
  n jsonb;
  k text;
  -- Champs que l'équipe voit dans la liste ; le reste (position, relances, +1 de) ne compte pas
  tracked text[] := array['first_name', 'last_name', 'age', 'diet', 'address', 'email', 'phone', 'group_id', 'note'];
  oc jsonb;
  nc jsonb;
begin
  -- Mariage supprimé en entier : la cascade retire les invités, rien à garder
  if not exists (select 1 from public.weddings where id = w) then return null; end if;
  who := public.merry_activity_member(w);
  if tg_op = 'INSERT' then
    insert into public.guest_activity (wedding_id, guest_id, guest_name, kind, source, member_id)
    values (w, new.id, trim(new.first_name || ' ' || new.last_name), 'ajout', src, who);
    return null;
  end if;
  if tg_op = 'DELETE' then
    insert into public.guest_activity (wedding_id, guest_id, guest_name, kind, source, member_id)
    values (w, old.id, trim(old.first_name || ' ' || old.last_name), 'retrait', src, who);
    return null;
  end if;
  o := to_jsonb(old);
  n := to_jsonb(new);
  foreach k in array tracked loop
    if n ? k and (o -> k) is distinct from (n -> k) then
      insert into public.guest_activity (wedding_id, guest_id, guest_name, kind, field, old_value, new_value, source, member_id)
      values (w, new.id, trim(new.first_name || ' ' || new.last_name), 'champ', k, o ->> k, n ->> k, src, who);
    end if;
  end loop;
  -- Colonnes ajoutées par les organisateurs : une ligne par colonne changée
  oc := coalesce(o -> 'custom', '{}'::jsonb);
  nc := coalesce(n -> 'custom', '{}'::jsonb);
  if oc is distinct from nc then
    for k in select key from jsonb_object_keys(oc || nc) as key loop
      if coalesce(nullif(oc ->> k, ''), '') is distinct from coalesce(nullif(nc ->> k, ''), '') then
        insert into public.guest_activity (wedding_id, guest_id, guest_name, kind, field, old_value, new_value, source, member_id)
        values (w, new.id, trim(new.first_name || ' ' || new.last_name), 'champ', 'custom:' || k, oc ->> k, nc ->> k, src, who);
      end if;
    end loop;
  end if;
  return null;
end;
$$;

drop trigger if exists merry_log_guest on public.guests;
create trigger merry_log_guest
  after insert or update or delete on public.guests
  for each row execute function public.merry_log_guest();

create or replace function public.merry_log_guest_response()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  g record;
begin
  if tg_op = 'UPDATE' and old.status is not distinct from new.status then return null; end if;
  select first_name, last_name, created_at into g from public.guests where id = new.guest_id;
  -- Les réponses posées avec un invité qu'on vient d'ajouter font partie de l'ajout
  if tg_op = 'INSERT' and (g.created_at is null or g.created_at > now() - interval '2 minutes') then return null; end if;
  insert into public.guest_activity (wedding_id, guest_id, guest_name, kind, event_id, old_value, new_value, source, member_id)
  values (
    new.wedding_id, new.guest_id, trim(coalesce(g.first_name, '') || ' ' || coalesce(g.last_name, '')), 'reponse', new.event_id,
    case when tg_op = 'UPDATE' then old.status end, new.status,
    case when auth.uid() is null then 'formulaire' else 'organisateur' end, public.merry_activity_member(new.wedding_id)
  );
  return null;
end;
$$;

drop trigger if exists merry_log_guest_response on public.guest_responses;
create trigger merry_log_guest_response
  after insert or update of status on public.guest_responses
  for each row execute function public.merry_log_guest_response();
