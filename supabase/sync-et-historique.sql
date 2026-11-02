-- Merry · synchronisation en direct entre organisateurs et historique des réponses
-- À coller dans Supabase > SQL Editor > New query, puis Run, APRÈS dashboard.sql (et formulaire.sql
-- si le formulaire invités est installé). Le fichier peut être relancé sans risque.
--
-- 1. Realtime : les changements de la liste des invités (invités, réponses, groupes, moments, colonnes,
--    note et vues du mariage) arrivent chez les autres organisateurs sans recharger. Les règles d'accès
--    (RLS) s'appliquent aussi au direct : un compte ne reçoit que les mariages dont il est organisateur.
-- 2. guest_response_log : qui a changé quoi, et quand. Rempli par un déclencheur sur guest_responses :
--    « formulaire » quand la réponse vient du formulaire invités (pas de compte connecté),
--    « organisateur » (avec lequel) sinon. La fiche invité le montre sous chaque moment, et la liste
--    signale les nouvelles réponses reçues depuis la dernière visite.

-- ---------------------------------------------------------------------------
-- 1. Realtime
-- ---------------------------------------------------------------------------

do $$
declare t text;
begin
  foreach t in array array['guests', 'guest_responses', 'guest_groups', 'events', 'guest_fields', 'weddings', 'guest_response_log']
  loop
    if to_regclass('public.' || t) is not null
       and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
exception when undefined_object then
  raise notice 'publication supabase_realtime absente : activez Realtime dans le projet';
end $$;

-- ---------------------------------------------------------------------------
-- 2. Historique des réponses
-- ---------------------------------------------------------------------------

create table if not exists public.guest_response_log (
  id              uuid primary key default gen_random_uuid(),
  wedding_id      uuid not null references public.weddings (id) on delete cascade,
  guest_id        uuid not null,
  event_id        uuid not null,
  status          text not null,
  source          text not null default 'organisateur' check (source in ('formulaire', 'organisateur')),
  member_id       uuid,                       -- wedding_members.id quand c'est un organisateur
  created_at      timestamptz not null default now(),
  foreign key (wedding_id, guest_id) references public.guests (wedding_id, id) on delete cascade
);
create index if not exists guest_response_log_wedding_idx on public.guest_response_log (wedding_id, created_at);

alter table public.guest_response_log enable row level security;
drop policy if exists "historique: lecture" on public.guest_response_log;
create policy "historique: lecture" on public.guest_response_log for select to authenticated
  using (public.is_wedding_member(wedding_id));
-- Personne n'écrit l'historique à la main : seul le déclencheur ci-dessous le remplit
revoke insert, update, delete on public.guest_response_log from authenticated, anon;

-- Il faut la publication avec la table créée : on la rajoute maintenant qu'elle existe
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'guest_response_log') then
    execute 'alter publication supabase_realtime add table public.guest_response_log';
  end if;
exception when undefined_object then
  null;
end $$;

create or replace function public.merry_log_response()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  who uuid;
begin
  if tg_op = 'UPDATE' and old.status is not distinct from new.status then return new; end if;
  if auth.uid() is not null then
    select id into who from public.wedding_members where wedding_id = new.wedding_id and user_id = auth.uid() limit 1;
  end if;
  insert into public.guest_response_log (wedding_id, guest_id, event_id, status, source, member_id)
  values (new.wedding_id, new.guest_id, new.event_id, new.status, case when auth.uid() is null then 'formulaire' else 'organisateur' end, who);
  return new;
end;
$$;

drop trigger if exists merry_log_response on public.guest_responses;
create trigger merry_log_response
  after insert or update of status on public.guest_responses
  for each row execute function public.merry_log_response();
