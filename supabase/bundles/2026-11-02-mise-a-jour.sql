-- Merry · mise à jour du 2 novembre 2026 : fichier assemblé par scripts/sql/bundle.sh, ne pas modifier à la main (les sources sont dans supabase/).
-- À coller tel quel dans Supabase > SQL Editor > New query, puis Run. Relançable sans risque.
-- Contenu, dans l'ordre : supabase/quotas.sql supabase/dashboard.sql supabase/sync-et-historique.sql supabase/plan-de-table.sql supabase/formulaire.sql supabase/invites-recherche.sql supabase/site-visites.sql supabase/prestataires.sql supabase/catalog.sql supabase/prestataires-ajout-manuel-fix-ambiguite.sql supabase/espace-prestataire.sql supabase/prestataires-notifier-couple.sql

-- ======================================================================
-- supabase/quotas.sql
-- ======================================================================
-- Merry · quotas et limites d'appels (ajout du 2 novembre 2026)
-- À coller dans Supabase > SQL Editor > New query, puis Run, APRÈS dashboard.sql. Relançable sans risque.
--
-- Une seule table de compteurs à fenêtre glissante, et deux fonctions :
--   merry_rate(kind, max_n, window_seconds)      pour la personne connectée (clé dérivée de auth.uid())
--   merry_throttle(key, max_n, window_seconds)   pour le serveur (clé libre : adresse IP, fiche, mail…),
--                                                réservée au rôle service_role
-- Chacune renvoie true si l'appel est permis (et le compte), false si la limite de la fenêtre est atteinte.
-- Elles servent aux routes qui coûtent de l'argent ou envoient des mails : recherche Google, photos Google,
-- mails aux prestataires et aux organisateurs, codes de connexion de l'espace prestataire, fiches ajoutées
-- à la main dans le catalogue.

create table if not exists public.rate_limits (
  key           text primary key,
  window_start  timestamptz not null default now(),
  n             integer not null default 0
);
alter table public.rate_limits enable row level security;  -- aucune règle : seules les fonctions y touchent
revoke all on public.rate_limits from anon, authenticated;

create or replace function public.merry_throttle(k text, max_n integer, window_seconds integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  n_now integer;
begin
  if k is null or length(k) = 0 or length(k) > 200 or max_n is null or max_n < 1 then
    return false;
  end if;
  insert into public.rate_limits as r (key, window_start, n) values (k, now(), 1)
  on conflict (key) do update
    set window_start = case when r.window_start < now() - make_interval(secs => window_seconds) then now() else r.window_start end,
        n = case when r.window_start < now() - make_interval(secs => window_seconds) then 1 else r.n + 1 end
  returning n into n_now;
  return n_now <= max_n;
end;
$$;
revoke all on function public.merry_throttle(text, integer, integer) from public, anon, authenticated;
grant execute on function public.merry_throttle(text, integer, integer) to service_role;

create or replace function public.merry_rate(kind text, max_n integer, window_seconds integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    return false;
  end if;
  return public.merry_throttle('user:' || auth.uid()::text || ':' || coalesce(kind, ''), max_n, window_seconds);
end;
$$;
revoke all on function public.merry_rate(text, integer, integer) from public, anon;
grant execute on function public.merry_rate(text, integer, integer) to authenticated, service_role;

-- Ménage : les compteurs vieux d'un jour ne servent plus (à appeler de temps en temps, ou par pg_cron)
create or replace function public.merry_rate_cleanup()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.rate_limits where window_start < now() - interval '1 day';
$$;
revoke all on function public.merry_rate_cleanup() from public, anon, authenticated;

-- ======================================================================
-- supabase/dashboard.sql
-- ======================================================================
-- Merry · tableau de bord des organisateurs
-- À coller dans Supabase > SQL Editor > New query, puis Run, APRÈS schema.sql.
-- Le fichier peut être relancé sans risque : il ne supprime aucune donnée.
--
-- Principe : tout tourne autour d'un mariage (weddings). Les organisateurs
-- (wedding_members) ont tous les mêmes droits : le couple, les parents, un témoin…
-- Un organisateur peut exister avant d'avoir un compte (user_id vide) : il reçoit
-- un lien d'invitation (invite_token) et le rejoint en se connectant.
-- Les paiements sont seulement suivis (pas d'encaissement par Merry pour l'instant).

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Mariages et organisateurs
-- ---------------------------------------------------------------------------

create table if not exists public.weddings (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  created_by      uuid references auth.users (id) on delete set null,
  brief_id        uuid references public.briefs (id) on delete set null,
  partner1        text not null,
  partner2        text,
  wedding_date    date,
  venue           text,                       -- « Domaine des Oliviers »
  region          text,
  budget_total    numeric(12, 2)              -- budget initial
);

create table if not exists public.wedding_members (
  id              uuid primary key default gen_random_uuid(),
  wedding_id      uuid not null references public.weddings (id) on delete cascade,
  user_id         uuid references auth.users (id) on delete set null,   -- vide tant que l'invitation n'est pas acceptée
  display_name    text not null,              -- « Stanislas », « Parents de Margue »
  initial         text,                       -- lettre de l'avatar
  color           text not null default 'lavande',   -- lavande | peche | bleu | sauge | jaune
  role            text not null default 'organisateur', -- couple | parents | organisateur (libellé, mêmes droits)
  email           text,
  contribution    numeric(12, 2),             -- ce que cette personne finance (« Qui finance le mariage »)
  position        smallint not null default 0,
  invite_token    uuid not null default gen_random_uuid(),
  invited_at      timestamptz,
  joined_at       timestamptz,
  created_at      timestamptz not null default now(),
  unique (wedding_id, id),
  unique (wedding_id, user_id)
);
create index if not exists wedding_members_user_idx on public.wedding_members (user_id);
create unique index if not exists wedding_members_token_idx on public.wedding_members (invite_token);

-- ---------------------------------------------------------------------------
-- Invités
-- ---------------------------------------------------------------------------

create table if not exists public.guest_groups (
  id              uuid primary key default gen_random_uuid(),
  wedding_id      uuid not null references public.weddings (id) on delete cascade,
  name            text not null,              -- « Famille de Stanislas »
  color           text not null default 'lavande',
  position        smallint not null default 0,
  unique (wedding_id, id)
);

create table if not exists public.events (
  id              uuid primary key default gen_random_uuid(),
  wedding_id      uuid not null references public.weddings (id) on delete cascade,
  name            text not null,              -- « Dîner de la veille »
  short_name      text not null,              -- « Veille » (en-tête de colonne)
  position        smallint not null default 0,
  unique (wedding_id, id)
);

-- Colonnes ajoutées par les organisateurs (« Hébergement », « Navette », « Table »…)
create table if not exists public.guest_fields (
  id              uuid primary key default gen_random_uuid(),
  wedding_id      uuid not null references public.weddings (id) on delete cascade,
  name            text not null,
  position        smallint not null default 0,
  unique (wedding_id, id)
);

-- Une ligne par invité (pas par foyer). Les enfants et les +1 sont des invités.
create table if not exists public.guests (
  id              uuid primary key default gen_random_uuid(),
  wedding_id      uuid not null references public.weddings (id) on delete cascade,
  group_id        uuid,
  first_name      text not null default '',
  last_name       text not null default '',
  age             smallint,                   -- renseigné pour les enfants
  plus_one_of     uuid,                       -- « +1 de Louise Martin »
  diet            text,                       -- régime
  address         text,
  email           text,
  phone           text,
  custom          jsonb not null default '{}'::jsonb,   -- { "<guest_fields.id>": "valeur" }
  position        integer not null default 0,
  created_at      timestamptz not null default now(),
  unique (wedding_id, id),
  foreign key (wedding_id, group_id) references public.guest_groups (wedding_id, id) on delete set null (group_id),
  foreign key (wedding_id, plus_one_of) references public.guests (wedding_id, id) on delete cascade
);
create index if not exists guests_wedding_idx on public.guests (wedding_id);

-- Réponse de chaque invité à chaque moment du mariage
create table if not exists public.guest_responses (
  wedding_id      uuid not null references public.weddings (id) on delete cascade,
  guest_id        uuid not null,
  event_id        uuid not null,
  status          text not null default 'attente' check (status in ('oui', 'non', 'attente', 'non_invite')),
  updated_at      timestamptz not null default now(),
  primary key (guest_id, event_id),
  foreign key (wedding_id, guest_id) references public.guests (wedding_id, id) on delete cascade,
  foreign key (wedding_id, event_id) references public.events (wedding_id, id) on delete cascade
);
create index if not exists guest_responses_wedding_idx on public.guest_responses (wedding_id);

-- ---------------------------------------------------------------------------
-- Rétroplanning
-- ---------------------------------------------------------------------------

create table if not exists public.tasks (
  id              uuid primary key default gen_random_uuid(),
  wedding_id      uuid not null references public.weddings (id) on delete cascade,
  title           text not null,
  icon            text,                       -- clé d'icône (traiteur, photo, musique…)
  due_date        date,
  done            boolean not null default false,
  done_at         timestamptz,
  assignees       uuid[] not null default '{}',   -- wedding_members.id
  added_by_merry  boolean not null default false,
  position        integer not null default 0,
  created_at      timestamptz not null default now()
);
create index if not exists tasks_wedding_idx on public.tasks (wedding_id);

-- ---------------------------------------------------------------------------
-- Budget et prestataires
-- ---------------------------------------------------------------------------

create table if not exists public.vendors (
  id              uuid primary key default gen_random_uuid(),
  wedding_id      uuid not null references public.weddings (id) on delete cascade,
  name            text not null,              -- « Atelier Lumen »
  category        text,                       -- « Photo & vidéo »
  contact_name    text,
  contact_role    text,
  phone           text,
  email           text,
  website         text,
  summary         text,                       -- résumé des échanges (une idée par ligne)
  next_action     text,                       -- « Répondre à Julie pour la date de la séance »
  created_at      timestamptz not null default now(),
  unique (wedding_id, id)
);

create table if not exists public.budget_items (
  id              uuid primary key default gen_random_uuid(),
  wedding_id      uuid not null references public.weddings (id) on delete cascade,
  label           text not null,              -- poste : « Traiteur »
  icon            text,
  note            text,                       -- « 10 % du budget »
  budgeted        numeric(12, 2),             -- budget prévu pour ce poste
  vendor_id       uuid,
  quote_amount    numeric(12, 2),             -- devis signé
  quote_signed_at date,
  position        integer not null default 0,
  created_at      timestamptz not null default now(),
  unique (wedding_id, id),
  foreign key (wedding_id, vendor_id) references public.vendors (wedding_id, id) on delete set null (vendor_id)
);

-- Échéances et paiements. paid_at vide = échéance à venir ; rempli = payé.
create table if not exists public.payments (
  id              uuid primary key default gen_random_uuid(),
  wedding_id      uuid not null references public.weddings (id) on delete cascade,
  budget_item_id  uuid not null,
  label           text not null default 'Paiement',   -- Acompte, 2e acompte, Solde…
  amount          numeric(12, 2) not null check (amount >= 0),
  due_date        date,
  paid_at         date,
  payer_id        uuid,                       -- wedding_members.id
  method          text,                       -- carte | virement | cheque | especes
  created_at      timestamptz not null default now(),
  unique (wedding_id, id),
  foreign key (wedding_id, budget_item_id) references public.budget_items (wedding_id, id) on delete cascade,
  foreign key (wedding_id, payer_id) references public.wedding_members (wedding_id, id) on delete set null (payer_id)
);
create index if not exists payments_wedding_idx on public.payments (wedding_id);

-- Devis, factures et autres pièces : des liens (Drive, Dropbox, mail…)
create table if not exists public.documents (
  id              uuid primary key default gen_random_uuid(),
  wedding_id      uuid not null references public.weddings (id) on delete cascade,
  budget_item_id  uuid,
  vendor_id       uuid,
  kind            text not null default 'autre' check (kind in ('devis', 'facture', 'autre')),
  name            text not null,
  url             text not null check (url ~* '^https?://'),
  created_at      timestamptz not null default now(),
  foreign key (wedding_id, budget_item_id) references public.budget_items (wedding_id, id) on delete cascade,
  foreign key (wedding_id, vendor_id) references public.vendors (wedding_id, id) on delete cascade
);

-- Fil des échanges avec un prestataire (messages envoyés par mail et réponses notées)
create table if not exists public.vendor_messages (
  id              uuid primary key default gen_random_uuid(),
  wedding_id      uuid not null references public.weddings (id) on delete cascade,
  vendor_id       uuid not null,
  from_vendor     boolean not null default false,
  author_id       uuid,                       -- wedding_members.id quand c'est un organisateur
  body            text not null,
  sent_at         timestamptz not null default now(),
  foreign key (wedding_id, vendor_id) references public.vendors (wedding_id, id) on delete cascade,
  foreign key (wedding_id, author_id) references public.wedding_members (wedding_id, id) on delete set null (author_id)
);
create index if not exists vendor_messages_thread_idx on public.vendor_messages (wedding_id, vendor_id, sent_at);

-- ---------------------------------------------------------------------------
-- Indicateurs choisis par chaque organisateur (barre de KPIs)
-- ---------------------------------------------------------------------------

create table if not exists public.kpi_prefs (
  user_id         uuid not null default auth.uid() references auth.users (id) on delete cascade,
  wedding_id      uuid not null references public.weddings (id) on delete cascade,
  scope           text not null check (scope in ('accueil', 'invites', 'budget')),
  kpis            text[] not null default '{}',
  updated_at      timestamptz not null default now(),
  primary key (user_id, wedding_id, scope)
);

-- Lecture des listes par l'IA : compteur d'appels par compte et par jour (limite côté serveur)
create table if not exists public.ai_usage (
  user_id         uuid not null references auth.users (id) on delete cascade,
  day             date not null default current_date,
  calls           integer not null default 0,
  primary key (user_id, day)
);

-- ---------------------------------------------------------------------------
-- Droits : un organisateur voit et modifie tout ce qui concerne ses mariages
-- ---------------------------------------------------------------------------

create or replace function public.is_wedding_member(w uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.wedding_members m
    where m.wedding_id = w and m.user_id = auth.uid()
  );
$$;
revoke all on function public.is_wedding_member(uuid) from public, anon;
grant execute on function public.is_wedding_member(uuid) to authenticated;

alter table public.weddings        enable row level security;
alter table public.wedding_members enable row level security;
alter table public.guest_groups    enable row level security;
alter table public.events          enable row level security;
alter table public.guest_fields    enable row level security;
alter table public.guests          enable row level security;
alter table public.guest_responses enable row level security;
alter table public.tasks           enable row level security;
alter table public.vendors         enable row level security;
alter table public.budget_items    enable row level security;
alter table public.payments        enable row level security;
alter table public.documents       enable row level security;
alter table public.vendor_messages enable row level security;
alter table public.kpi_prefs       enable row level security;
alter table public.ai_usage        enable row level security;  -- aucune règle : accessible seulement par merry_ai_tick()

-- Mariage : lecture et modification par ses organisateurs. La création passe par merry_bootstrap().
drop policy if exists "mariage: lecture" on public.weddings;
create policy "mariage: lecture" on public.weddings for select to authenticated
  using (public.is_wedding_member(id));
drop policy if exists "mariage: modification" on public.weddings;
create policy "mariage: modification" on public.weddings for update to authenticated
  using (public.is_wedding_member(id)) with check (public.is_wedding_member(id));

-- Le lien vers le brief et l'auteur du mariage ne se modifient pas depuis l'appli.
revoke insert, update, delete on public.weddings from authenticated, anon;
grant update (partner1, partner2, wedding_date, venue, region, budget_total) on public.weddings to authenticated;

-- Organisateurs : visibles et gérables par les autres organisateurs du même mariage.
drop policy if exists "organisateurs: lecture" on public.wedding_members;
create policy "organisateurs: lecture" on public.wedding_members for select to authenticated
  using (public.is_wedding_member(wedding_id));
drop policy if exists "organisateurs: ajout" on public.wedding_members;
create policy "organisateurs: ajout" on public.wedding_members for insert to authenticated
  with check (public.is_wedding_member(wedding_id) and user_id is null);
drop policy if exists "organisateurs: modification" on public.wedding_members;
create policy "organisateurs: modification" on public.wedding_members for update to authenticated
  using (public.is_wedding_member(wedding_id)) with check (public.is_wedding_member(wedding_id));
drop policy if exists "organisateurs: retrait" on public.wedding_members;
create policy "organisateurs: retrait" on public.wedding_members for delete to authenticated
  using (public.is_wedding_member(wedding_id) and user_id is null);

-- Le compte rattaché et le jeton d'invitation ne se modifient que par les fonctions
-- ci-dessous : personne ne peut s'ajouter lui-même à un mariage ni y ajouter quelqu'un d'autre.
revoke insert, update on public.wedding_members from authenticated, anon;
grant insert (id, wedding_id, display_name, initial, color, role, email, contribution, position, invited_at)
  on public.wedding_members to authenticated;
grant update (display_name, initial, color, role, email, contribution, position, invited_at)
  on public.wedding_members to authenticated;

-- Toutes les autres tables : mêmes droits pour tous les organisateurs du mariage.
do $$
declare t text;
begin
  foreach t in array array['guest_groups', 'events', 'guest_fields', 'guests', 'guest_responses',
                           'tasks', 'vendors', 'budget_items', 'payments', 'documents', 'vendor_messages']
  loop
    execute format('drop policy if exists "organisateurs: tout" on public.%I', t);
    execute format('create policy "organisateurs: tout" on public.%I for all to authenticated
                    using (public.is_wedding_member(wedding_id))
                    with check (public.is_wedding_member(wedding_id))', t);
  end loop;
end $$;

drop policy if exists "indicateurs: les siens" on public.kpi_prefs;
create policy "indicateurs: les siens" on public.kpi_prefs for all to authenticated
  using (user_id = auth.uid() and public.is_wedding_member(wedding_id))
  with check (user_id = auth.uid() and public.is_wedding_member(wedding_id));

-- Les organisateurs lisent les réponses du brief (sans les colonnes de suivi interne
-- status, owner, notes) par cette fonction.
drop policy if exists "brief: lecture par les organisateurs" on public.briefs;

-- drop d'abord : le type de retour a changé (colonne help retirée, voir onboarding-simplifie.sql).
drop function if exists public.merry_brief(uuid);
create function public.merry_brief(w uuid)
returns table (stage text, team text, first_name text, partner_first_name text, wedding_date date,
               region text, guests text, format text, vibes text[], budget text)
language sql
stable
security definer
set search_path = public
as $$
  select b.stage, b.team, b.first_name, b.partner_first_name, b.wedding_date,
         b.region, b.guests, b.format, b.vibes, b.budget
    from public.weddings wd
    join public.briefs b on b.id = wd.brief_id
   where wd.id = w and public.is_wedding_member(w);
$$;
revoke all on function public.merry_brief(uuid) from public, anon;
grant execute on function public.merry_brief(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Rejoindre un mariage avec un lien d'invitation
-- ---------------------------------------------------------------------------

create or replace function public.merry_join(token uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  target public.wedding_members%rowtype;
begin
  if me is null then
    raise exception 'Connexion requise';
  end if;
  select * into target from public.wedding_members where invite_token = token;
  if not found then
    return null;
  end if;
  -- Déjà organisateur de ce mariage : rien à faire.
  if exists (select 1 from public.wedding_members where wedding_id = target.wedding_id and user_id = me) then
    return target.wedding_id;
  end if;
  if target.user_id is not null then
    return null;  -- invitation déjà utilisée par quelqu'un d'autre
  end if;
  update public.wedding_members
     set user_id = me, joined_at = now(), invite_token = gen_random_uuid()
   where id = target.id and user_id is null;
  if not found then
    return null;
  end if;
  return target.wedding_id;
end;
$$;
revoke all on function public.merry_join(uuid) from public, anon;
grant execute on function public.merry_join(uuid) to authenticated;

-- Ce qu'on montre avant de rejoindre : les prénoms du couple, rien d'autre
create or replace function public.merry_invite_info(token uuid)
returns table (partner1 text, partner2 text, invited_as text)
language sql
stable
security definer
set search_path = public
as $$
  select w.partner1, w.partner2, m.display_name
    from public.wedding_members m
    join public.weddings w on w.id = m.wedding_id
   where m.invite_token = token and m.user_id is null and auth.uid() is not null;
$$;
revoke all on function public.merry_invite_info(uuid) from public, anon;
grant execute on function public.merry_invite_info(uuid) to authenticated;

-- Quitter un mariage (impossible pour le dernier organisateur qui a un compte)
create or replace function public.merry_leave(w uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_wedding_member(w) then
    raise exception 'Mariage introuvable';
  end if;
  if (select count(*) from public.wedding_members where wedding_id = w and user_id is not null) < 2 then
    raise exception 'Dernier organisateur';
  end if;
  delete from public.wedding_members where wedding_id = w and user_id = auth.uid();
end;
$$;
revoke all on function public.merry_leave(uuid) from public, anon;
grant execute on function public.merry_leave(uuid) to authenticated;

-- Compte un appel à l'IA ; refuse les comptes sans mariage. Renvoie le nombre d'appels du jour.
create or replace function public.merry_ai_tick()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  if auth.uid() is null or not exists (select 1 from public.wedding_members where user_id = auth.uid()) then
    raise exception 'Réservé aux organisateurs';
  end if;
  insert into public.ai_usage (user_id, day, calls) values (auth.uid(), current_date, 1)
  on conflict (user_id, day) do update set calls = public.ai_usage.calls + 1
  returning calls into n;
  return n;
end;
$$;
revoke all on function public.merry_ai_tick() from public, anon;
grant execute on function public.merry_ai_tick() to authenticated;

-- Nouveau jeton (si un lien a circulé par erreur)
create or replace function public.merry_renew_invite(member uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  w uuid;
  t uuid := gen_random_uuid();
begin
  select wedding_id into w from public.wedding_members where id = member and user_id is null;
  if w is null or not public.is_wedding_member(w) then
    raise exception 'Invitation introuvable';
  end if;
  update public.wedding_members set invite_token = t where id = member;
  return t;
end;
$$;
revoke all on function public.merry_renew_invite(uuid) from public, anon;
grant execute on function public.merry_renew_invite(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Premier passage sur le tableau de bord : on crée le mariage à partir du brief
-- (organisateurs, moments, groupes, postes de budget, rétroplanning).
-- Renvoie l'identifiant du mariage. Sans effet si le compte en a déjà un.
-- ---------------------------------------------------------------------------

create or replace function public.merry_bootstrap()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  me        uuid := auth.uid();
  w         uuid;
  b         public.briefs%rowtype;
  has_brief boolean := false;
  p1        text;
  p2        text;
  m1        uuid := gen_random_uuid();
  m2        uuid := gen_random_uuid();
  total     numeric;
  d         date;
  weekend   boolean;
  rec       record;
  i         int := 0;
begin
  if me is null then
    raise exception 'Connexion requise';
  end if;

  select m.wedding_id into w
    from public.wedding_members m
   where m.user_id = me
   order by m.joined_at desc nulls last, m.created_at desc
   limit 1;
  if w is not null then
    return w;
  end if;

  select * into b from public.briefs where user_id = me order by created_at desc limit 1;
  has_brief := found;

  p1 := coalesce(nullif(trim(b.first_name), ''),
                 nullif(trim((select raw_user_meta_data ->> 'first_name' from auth.users where id = me)), ''),
                 'Moi');
  p2 := nullif(trim(b.partner_first_name), '');
  d := b.wedding_date;
  weekend := coalesce(b.format, '') = 'weekend';
  total := case b.budget
             when '<15k' then 12000 when '15-30k' then 25000 when '30-50k' then 40000
             when '>50k' then 60000 else null end;

  insert into public.weddings (created_by, brief_id, partner1, partner2, wedding_date, region, budget_total)
  values (me, case when has_brief then b.id end, p1, p2, d, b.region, total)
  returning id into w;

  -- Organisateurs
  insert into public.wedding_members (id, wedding_id, user_id, display_name, initial, color, role, email, position, joined_at)
  values (m1, w, me, p1, upper(left(p1, 1)), 'lavande', 'couple', b.email, 0, now());
  if p2 is not null then
    insert into public.wedding_members (id, wedding_id, display_name, initial, color, role, email, position)
    values (m2, w, p2, upper(left(p2, 1)), 'peche', 'couple', nullif(trim(b.partner_email), ''), 1);
  else
    m2 := null;
  end if;
  if b.team = 'nous_parents' then
    insert into public.wedding_members (wedding_id, display_name, initial, color, role, position)
    values (w, 'Parents de ' || p1, 'P', 'bleu', 'parents', 2);
    if p2 is not null then
      insert into public.wedding_members (wedding_id, display_name, initial, color, role, position)
      values (w, 'Parents de ' || p2, 'P', 'sauge', 'parents', 3);
    end if;
  end if;

  -- Moments du mariage
  insert into public.events (wedding_id, name, short_name, position) values (w, 'Mariage civil', 'Civil', 0);
  if weekend then
    insert into public.events (wedding_id, name, short_name, position) values (w, 'Dîner de la veille', 'Veille', 1);
  end if;
  insert into public.events (wedding_id, name, short_name, position) values (w, 'Cocktail', 'Cocktail', 2);
  insert into public.events (wedding_id, name, short_name, position) values (w, 'Dîner', 'Dîner', 3);
  if weekend then
    insert into public.events (wedding_id, name, short_name, position) values (w, 'Brunch', 'Brunch', 4);
  end if;

  -- Groupes d'invités
  insert into public.guest_groups (wedding_id, name, color, position) values (w, 'Famille de ' || p1, 'lavande', 0);
  insert into public.guest_groups (wedding_id, name, color, position) values (w, 'Amis de ' || p1, 'bleu', 1);
  if p2 is not null then
    insert into public.guest_groups (wedding_id, name, color, position) values (w, 'Famille de ' || p2, 'peche', 2);
    insert into public.guest_groups (wedding_id, name, color, position) values (w, 'Amis de ' || p2, 'sauge', 3);
  end if;

  -- Postes de budget (répartition type d'un mariage en France)
  for rec in
    select * from (values
      ('Lieu', 'lieu', null::text, 0.225), ('Traiteur', 'traiteur', null, 0.30),
      ('Photo & vidéo', 'photo', null, 0.0875), ('Fleurs & déco', 'fleurs', null, 0.0625),
      ('Alliances', 'alliances', null, 0.0575), ('Tenues', 'tenues', null, 0.0875),
      ('Musique', 'musique', null, 0.045), ('Papeterie', 'enveloppe', null, 0.0225),
      ('Beauté', 'beaute', null, 0.0125), ('Imprévus', 'imprevus', '10 % du budget', 0.10)
    ) as v(label, icon, note, share)
  loop
    insert into public.budget_items (wedding_id, label, icon, note, budgeted, position)
    values (w, rec.label, rec.icon, rec.note, case when total is null then null else round(total * rec.share / 100) * 100 end, i);
    i := i + 1;
  end loop;

  -- Pas de rétroplanning pré-rempli : le couple le génère depuis l'accueil (quatre questions)
  -- puis Merry crée les tâches, datées à rebours de la date du mariage.

  return w;
end;
$$;
revoke all on function public.merry_bootstrap() from public, anon;
grant execute on function public.merry_bootstrap() to authenticated;

-- ---------------------------------------------------------------------------
-- Commentaires sous les tâches du rétroplanning (ajouté le 21 oct. 2026)
-- Chaque organisateur lit tout le fil, écrit en son nom et ne supprime que les siens.
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'tasks_wedding_id_id_key') then
    alter table public.tasks add constraint tasks_wedding_id_id_key unique (wedding_id, id);
  end if;
end $$;

create table if not exists public.task_comments (
  id              uuid primary key default gen_random_uuid(),
  wedding_id      uuid not null references public.weddings (id) on delete cascade,
  task_id         uuid not null,
  author_id       uuid,                       -- wedding_members.id
  body            text not null check (char_length(btrim(body)) between 1 and 2000),
  created_at      timestamptz not null default now(),
  unique (wedding_id, id),
  foreign key (wedding_id, task_id) references public.tasks (wedding_id, id) on delete cascade,
  foreign key (wedding_id, author_id) references public.wedding_members (wedding_id, id) on delete set null (author_id)
);
create index if not exists task_comments_task_idx on public.task_comments (task_id);
create index if not exists task_comments_wedding_idx on public.task_comments (wedding_id);

alter table public.task_comments enable row level security;
revoke all on public.task_comments from anon;
revoke update on public.task_comments from authenticated;

drop policy if exists "commentaires: lecture" on public.task_comments;
create policy "commentaires: lecture" on public.task_comments for select to authenticated
  using (public.is_wedding_member(wedding_id));

drop policy if exists "commentaires: écrire en son nom" on public.task_comments;
create policy "commentaires: écrire en son nom" on public.task_comments for insert to authenticated
  with check (
    public.is_wedding_member(wedding_id)
    and author_id = (select m.id from public.wedding_members m
                     where m.wedding_id = task_comments.wedding_id and m.user_id = auth.uid())
  );

drop policy if exists "commentaires: supprimer les siens" on public.task_comments;
create policy "commentaires: supprimer les siens" on public.task_comments for delete to authenticated
  using (author_id in (select m.id from public.wedding_members m where m.user_id = auth.uid()));

-- ======================================================================
-- supabase/sync-et-historique.sql
-- ======================================================================
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

-- Ajout du 2 novembre 2026 : les suppressions ne voyagent qu'avec la ligne entière. Sans « replica identity
-- full », l'événement DELETE ne porte que la clé primaire, le filtre wedding_id du canal ne le reconnaît pas,
-- et l'invité retiré par un organisateur reste affiché chez les autres jusqu'au rechargement.
do $$
declare t text;
begin
  foreach t in array array['guests', 'guest_responses', 'guest_groups', 'events', 'guest_fields', 'guest_response_log'] loop
    if to_regclass('public.' || t) is not null then
      execute format('alter table public.%I replica identity full', t);
    end if;
  end loop;
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

-- ======================================================================
-- supabase/plan-de-table.sql
-- ======================================================================
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

-- ======================================================================
-- supabase/formulaire.sql
-- ======================================================================
-- Merry · formulaire invités (un lien à partager sur WhatsApp, Facebook, par message)
-- À coller dans Supabase > SQL Editor > New query, puis Run, APRÈS dashboard.sql.
-- Le fichier peut être relancé sans risque : il ne supprime aucune donnée.
--
-- Principe : un formulaire par mariage (guest_forms). Les organisateurs choisissent
-- les questions (non demandé / facultatif / obligatoire), les moments affichés,
-- un petit mot, une photo d'en-tête et un thème. Le formulaire public est lu et
-- envoyé par deux fonctions ouvertes sans compte (merry_form_public, merry_form_submit) :
-- les visiteurs ne lisent jamais les tables directement.

create table if not exists public.guest_forms (
  wedding_id      uuid primary key references public.weddings (id) on delete cascade,
  slug            text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) between 6 and 80),
  published       boolean not null default true,
  fields          jsonb not null default '[]'::jsonb,   -- [{ key, label, mode: off | opt | req }]
  custom          jsonb not null default '[]'::jsonb,   -- [{ id, label, type: text | choice | yesno, options: [], req }]
  event_ids       uuid[] not null default '{}',         -- moments affichés dans le formulaire
  message         text check (message is null or length(message) <= 300),
  theme           text not null default 'sauge' check (theme in ('sauge', 'jaune', 'perle', 'rose', 'brume')),
  cover_url       text check (cover_url is null or cover_url ~* '^https://'),
  deadline        date,
  submissions     integer not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Ajouts du 21 octobre 2026 (titre de la page, cadrage de la photo, une seule question de présence)
alter table public.guest_forms add column if not exists title text check (title is null or length(title) <= 60);
alter table public.guest_forms add column if not exists cover_position smallint not null default 50 check (cover_position between 0 and 100);
alter table public.guest_forms add column if not exists presence_mode text not null default 'moments' check (presence_mode in ('moments', 'global'));
-- Ajout du 2 novembre 2026 : l'ordre des questions choisi par le couple
-- (« ident » pour prénom, nom et mail, la clé d'une question proposée, l'identifiant d'une question ajoutée).
-- Vide : l'ordre par défaut (la présence d'abord), voir lib/dash/form.js.
alter table public.guest_forms add column if not exists question_order jsonb not null default '[]'::jsonb;

-- Ajout du 2 novembre 2026 : limite de réponses par formulaire et par heure (le formulaire est public)
alter table public.guest_forms add column if not exists rate_window_start timestamptz;
alter table public.guest_forms add column if not exists rate_window_count integer not null default 0;

alter table public.guest_forms enable row level security;

drop policy if exists "organisateurs: tout" on public.guest_forms;
create policy "organisateurs: tout" on public.guest_forms for all to authenticated
  using (public.is_wedding_member(wedding_id))
  with check (public.is_wedding_member(wedding_id));

-- Le compteur de réponses ne s'écrit que par merry_form_submit.
revoke insert, update on public.guest_forms from authenticated, anon;
grant insert (wedding_id, slug, published, title, presence_mode, cover_position, fields, custom, event_ids, message, theme, cover_url, deadline, question_order, updated_at)
  on public.guest_forms to authenticated;
grant update (wedding_id, slug, published, title, presence_mode, cover_position, fields, custom, event_ids, message, theme, cover_url, deadline, question_order, updated_at)
  on public.guest_forms to authenticated;

-- ---------------------------------------------------------------------------
-- Photo d'en-tête : stockage public, chaque mariage écrit dans son dossier
-- (« <wedding_id>/couverture-….jpg »)
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
-- Formulaire public : ce que voit l'invité (rien d'autre que le contenu du formulaire)
-- ---------------------------------------------------------------------------

create or replace function public.merry_form_public(form_slug text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
           'partner1', w.partner1,
           'partner2', w.partner2,
           'wedding_date', w.wedding_date,
           'venue', w.venue,
           'title', f.title,
           'presence_mode', f.presence_mode,
           'message', f.message,
           'theme', f.theme,
           'cover_url', f.cover_url,
           'cover_position', f.cover_position,
           'deadline', f.deadline,
           'question_order', coalesce(f.question_order, '[]'::jsonb),
           'fields', coalesce((select jsonb_agg(e - 'field_id' order by ord) from jsonb_array_elements(f.fields) with ordinality as t(e, ord)), '[]'::jsonb),
           'custom', coalesce((select jsonb_agg(e - 'field_id' order by ord) from jsonb_array_elements(f.custom) with ordinality as t(e, ord)), '[]'::jsonb),
           'events', coalesce((
             select jsonb_agg(jsonb_build_object('id', e.id, 'name', e.name) order by e.position)
               from public.events e
              where e.wedding_id = w.id and e.id = any (f.event_ids)
           ), '[]'::jsonb)
         )
    from public.guest_forms f
    join public.weddings w on w.id = f.wedding_id
   where f.slug = form_slug and f.published;
$$;
revoke all on function public.merry_form_public(text) from public;
grant execute on function public.merry_form_public(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Envoi d'une réponse. Un invité déjà dans la liste est reconnu par son prénom et
-- son nom (sans tenir compte des majuscules ni des espaces) : sa ligne est
-- complétée au lieu d'être dupliquée. L'accompagnant devient un invité « +1 ».
-- ---------------------------------------------------------------------------

create or replace function public.merry_clip(v text, n int)
returns text
language sql
immutable
set search_path = ''
as $$
  select nullif(left(btrim(coalesce(v, '')), n), '');
$$;

-- ---------------------------------------------------------------------------
-- Reconnaître un invité malgré une faute de frappe (ajout du 22 octobre 2026)
-- Sans extension : accents, majuscules, tirets et espaces sont ignorés, l'ordre prénom / nom peut être
-- inversé, et une lettre de différence est tolérée dans un mot de 4 lettres ou plus (2 à partir de 9).
-- Un seul invité doit correspondre : en cas de doute, la personne est ajoutée à part plutôt que
-- fusionnée avec la mauvaise.
-- ---------------------------------------------------------------------------

-- merry_norm_compact : tout en minuscules sans accent, espaces, tirets et ponctuation retirés
-- (« Saint-Georges » → « saintgeorges »). À ne pas confondre avec merry_norm (supabase/prestataires.sql),
-- qui garde un espace entre les mots pour les recherches de villes et de lieux : les deux fonctions ont
-- longtemps porté le même nom, et le dernier fichier collé changeait le sens de l'autre.
create or replace function public.merry_norm_compact(t text)
returns text
language sql
immutable
set search_path = ''
as $$
  select regexp_replace(
           translate(lower(coalesce(t, '')), 'àâäáãåçéèêëíìîïñóòôöõúùûüýÿœæ', 'aaaaaaceeeeiiiinooooouuuuyyoa'),
           '[^a-z0-9]', '', 'g');
$$;

create or replace function public.merry_lev(a text, b text)
returns integer
language plpgsql
immutable
set search_path = ''
as $$
declare
  la integer := length(a);
  lb integer := length(b);
  prev integer[];
  cur integer[];
  i integer;
  j integer;
  cost integer;
begin
  if la = 0 then return lb; end if;
  if lb = 0 then return la; end if;
  if abs(la - lb) > 3 then return abs(la - lb); end if;
  prev := array(select generate_series(0, lb));
  for i in 1..la loop
    cur := array[i];
    for j in 1..lb loop
      cost := case when substr(a, i, 1) = substr(b, j, 1) then 0 else 1 end;
      cur[j + 1] := least(prev[j + 1] + 1, cur[j] + 1, prev[j] + cost);
    end loop;
    prev := cur;
  end loop;
  return prev[lb + 1];
end;
$$;

-- Distance entre deux mots, ou null si elle dépasse ce qu'on tolère pour leur longueur
create or replace function public.merry_name_dist(a text, b text)
returns integer
language plpgsql
immutable
set search_path = ''
as $$
declare
  d integer;
  tol integer := case when least(length(a), length(b)) >= 9 then 2 when least(length(a), length(b)) >= 4 then 1 else 0 end;
begin
  if a = b then return 0; end if;
  if tol = 0 then return null; end if;
  d := public.merry_lev(a, b);
  return case when d <= tol then d else null end;
end;
$$;

create or replace function public.merry_find_guest(w uuid, v_first text, v_last text)
returns uuid
language plpgsql
stable
set search_path = public
as $$
declare
  nf text := public.merry_norm_compact(v_first);
  nl text := public.merry_norm_compact(v_last);
  best integer := null;
  best_id uuid := null;
  ties integer := 0;
  g record;
  cf text;
  cl text;
  d1 integer;
  d2 integer;
  d3 integer;
  d4 integer;
  score integer;
begin
  -- 1. même nom, sans tenir compte des accents, des majuscules ni des tirets
  select id into best_id from public.guests
   where wedding_id = w and plus_one_of is null
     and public.merry_norm_compact(first_name) = nf and public.merry_norm_compact(last_name) = nl
   order by created_at limit 1;
  if best_id is not null then return best_id; end if;

  -- 2. nom proche ou inversé ; un seul candidat doit se détacher
  for g in select id, first_name, last_name from public.guests where wedding_id = w and plus_one_of is null loop
    cf := public.merry_norm_compact(g.first_name);
    cl := public.merry_norm_compact(g.last_name);
    score := null;
    if cl = '' then
      -- liste faite de prénoms seuls : le prénom doit correspondre
      d1 := public.merry_name_dist(nf, cf);
      if d1 is not null and cf <> '' then score := d1 + 1; end if;
    else
      d1 := public.merry_name_dist(nf, cf);
      d2 := public.merry_name_dist(nl, cl);
      d3 := public.merry_name_dist(nf, cl);
      d4 := public.merry_name_dist(nl, cf);
      if d1 is not null and d2 is not null then score := d1 + d2; end if;
      if d3 is not null and d4 is not null and (score is null or d3 + d4 < score) then score := d3 + d4; end if;
    end if;
    if score is not null then
      if best is null or score < best then
        best := score; best_id := g.id; ties := 1;
      elsif score = best then
        ties := ties + 1;
      end if;
    end if;
  end loop;
  if best_id is not null and ties = 1 then return best_id; end if;
  return null;
end;
$$;
revoke all on function public.merry_find_guest(uuid, text, text) from public, anon, authenticated;

create or replace function public.merry_form_submit(form_slug text, payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  f          public.guest_forms%rowtype;
  w          uuid;
  modes      jsonb := '{}'::jsonb;    -- { key: mode }
  labels     jsonb := '{}'::jsonb;    -- { key: label }
  links      jsonb := '{}'::jsonb;    -- { key: guest_fields.id } : question déjà reliée à sa colonne
  item       jsonb;
  v_first    text;
  v_last     text;
  main_id    uuid;
  plus_id    uuid;
  pos        integer;
  custom_out jsonb := '{}'::jsonb;
  field_id   uuid;
  val        text;
  ev         uuid;
  st         text;
  diet_txt   text;
  p          jsonb;
  addr       text;
  is_new     boolean := false;
  trusted    boolean := false;
  n_hour     integer := 0;
begin
  select * into f from public.guest_forms where slug = form_slug and published;
  if not found then
    raise exception 'Formulaire introuvable';
  end if;
  w := f.wedding_id;
  -- Date limite dépassée (le jour même, on répond encore) : la page le dit avant, la base le garantit
  if f.deadline is not null and f.deadline < current_date then
    raise exception 'Date limite dépassée';
  end if;
  if pg_column_size(payload) > 20000 then
    raise exception 'Réponse trop longue';
  end if;
  if (select count(*) from public.guests where wedding_id = w) >= 3000 then
    raise exception 'Liste complète';
  end if;

  -- Au plus 200 réponses par heure et par formulaire : assez pour une liste entière qui répond le soir
  -- même de l'envoi, trop peu pour un script qui remplit la liste de faux invités.
  update public.guest_forms
     set rate_window_start = case when rate_window_start is null or rate_window_start < now() - interval '1 hour' then now() else rate_window_start end,
         rate_window_count = case when rate_window_start is null or rate_window_start < now() - interval '1 hour' then 1 else rate_window_count + 1 end
   where wedding_id = w
   returning rate_window_count into n_hour;
  if n_hour > 200 then
    raise exception 'Trop de réponses pour le moment, réessayez dans une heure';
  end if;

  for item in select * from jsonb_array_elements(f.fields) loop
    modes := modes || jsonb_build_object(item ->> 'key', coalesce(item ->> 'mode', 'off'));
    labels := labels || jsonb_build_object(item ->> 'key', coalesce(item ->> 'label', item ->> 'key'));
    links := links || jsonb_build_object(item ->> 'key', coalesce(item ->> 'field_id', ''));
  end loop;

  v_first := public.merry_clip(payload ->> 'first_name', 80);
  v_last := public.merry_clip(payload ->> 'last_name', 80);
  if v_first is null or v_last is null then
    raise exception 'Prénom et nom obligatoires';
  end if;

  -- Questions sans colonne dédiée : enfants, hébergement, mot pour les mariés
  foreach val in array array['enfants', 'hebergement', 'mot'] loop
    if coalesce(modes ->> val, 'off') <> 'off' and public.merry_clip(payload ->> val, case when val = 'mot' then 2000 else 300 end) is not null then
      -- La question est reliée à sa colonne par identifiant : renommer l'une ou l'autre ne crée plus de doublon.
      -- Sans lien (formulaire existant), on retrouve la colonne par son nom, ou on la crée, puis on mémorise le lien.
      select id into field_id from public.guest_fields where wedding_id = w and id::text = coalesce(links ->> val, '') limit 1;
      if field_id is null then
        select id into field_id from public.guest_fields where wedding_id = w and lower(name) = lower(labels ->> val) limit 1;
      end if;
      if field_id is null then
        insert into public.guest_fields (wedding_id, name, position)
        values (w, labels ->> val, coalesce((select max(position) + 1 from public.guest_fields where wedding_id = w), 0))
        returning id into field_id;
      end if;
      if coalesce(links ->> val, '') <> field_id::text then
        update public.guest_forms
           set fields = (select jsonb_agg(case when e ->> 'key' = val then e || jsonb_build_object('field_id', field_id) else e end order by ord)
                           from jsonb_array_elements(fields) with ordinality as t(e, ord))
         where wedding_id = w;
        links := links || jsonb_build_object(val, field_id::text);
      end if;
      custom_out := custom_out || jsonb_build_object(field_id::text, public.merry_clip(payload ->> val, case when val = 'mot' then 2000 else 300 end));
      field_id := null;
    end if;
  end loop;

  -- Questions ajoutées par les organisateurs
  for item in select * from jsonb_array_elements(f.custom) loop
    val := public.merry_clip(payload -> 'custom' ->> (item ->> 'id'), 500);
    if val is not null then
      -- Colonne reliée par identifiant (field_id, ou l'identifiant de la question quand elle vient d'une colonne),
      -- à défaut par son nom ; le lien trouvé ou créé est mémorisé dans la question.
      select id into field_id from public.guest_fields where wedding_id = w and id::text = coalesce(item ->> 'field_id', item ->> 'id') limit 1;
      if field_id is null then
        select id into field_id from public.guest_fields where wedding_id = w and lower(name) = lower(item ->> 'label') limit 1;
      end if;
      if field_id is null then
        insert into public.guest_fields (wedding_id, name, position)
        values (w, left(item ->> 'label', 120), coalesce((select max(position) + 1 from public.guest_fields where wedding_id = w), 0))
        returning id into field_id;
      end if;
      if coalesce(item ->> 'field_id', '') <> field_id::text then
        update public.guest_forms
           set custom = (select jsonb_agg(case when e ->> 'id' = item ->> 'id' then e || jsonb_build_object('field_id', field_id) else e end order by ord)
                           from jsonb_array_elements(custom) with ordinality as t(e, ord))
         where wedding_id = w;
      end if;
      custom_out := custom_out || jsonb_build_object(field_id::text, val);
      field_id := null;
    end if;
  end loop;

  diet_txt := case when coalesce(modes ->> 'regime', 'off') = 'off' then null else
    nullif(concat_ws(' · ',
      nullif(public.merry_clip(payload ->> 'diet', 60), 'Aucun'),
      case when public.merry_clip(payload ->> 'allergies', 200) is not null then 'allergies : ' || public.merry_clip(payload ->> 'allergies', 200) end), '') end;
  addr := case when coalesce(modes ->> 'adresse', 'off') = 'off' then null else public.merry_clip(payload ->> 'address', 300) end;

  -- Invité principal : reconnu par son nom (fautes de frappe tolérées), sinon ajouté en fin de liste
  main_id := public.merry_find_guest(w, v_first, v_last);
  if main_id is null then
    is_new := true;
    select coalesce(max(position) + 1, 0) into pos from public.guests where wedding_id = w;
    insert into public.guests (wedding_id, first_name, last_name, position)
    values (w, v_first, v_last, pos) returning id into main_id;
  end if;
  -- Un invité reconnu par son nom seulement : ses coordonnées déjà connues ne sont pas écrasées par
  -- un inconnu qui taperait le même nom. Elles ne sont remplacées que si l'adresse mail envoyée est
  -- celle de la fiche (ou si la fiche n'en a pas encore) ; sinon on ne fait que compléter les vides.
  select lower(btrim(coalesce(email, ''))) = lower(coalesce(public.merry_clip(payload ->> 'email', 200), '')) or btrim(coalesce(email, '')) = ''
    into trusted from public.guests where id = main_id;
  trusted := is_new or coalesce(trusted, false);
  update public.guests
     set last_name = case when btrim(last_name) = '' then v_last else last_name end,
         email   = case when trusted then coalesce(public.merry_clip(payload ->> 'email', 200), email) else coalesce(email, public.merry_clip(payload ->> 'email', 200)) end,
         phone   = case when coalesce(modes ->> 'tel', 'off') = 'off' then phone
                        when trusted then coalesce(public.merry_clip(payload ->> 'phone', 40), phone)
                        else coalesce(phone, public.merry_clip(payload ->> 'phone', 40)) end,
         address = case when trusted then coalesce(addr, address) else coalesce(address, addr) end,
         diet    = case when trusted then coalesce(diet_txt, diet) else coalesce(diet, diet_txt) end,
         custom  = custom || custom_out
   where id = main_id;

  -- Réponses aux moments affichés
  if coalesce(modes ->> 'presence', 'off') <> 'off' then
    foreach ev in array f.event_ids loop
      st := payload -> 'answers' ->> ev::text;
      if st in ('oui', 'non') then
        insert into public.guest_responses (wedding_id, guest_id, event_id, status, updated_at)
        values (w, main_id, ev, st, now())
        on conflict (guest_id, event_id) do update set status = excluded.status, updated_at = now();
      end if;
    end loop;
  end if;

  -- Accompagnant
  p := payload -> 'plus_one';
  if coalesce(modes ->> 'plusun', 'off') <> 'off' and jsonb_typeof(p) = 'object' then
    v_first := public.merry_clip(p ->> 'first_name', 80);
    v_last := public.merry_clip(p ->> 'last_name', 80);
    select id into plus_id from public.guests
     where wedding_id = w and plus_one_of = main_id
       and ((lower(btrim(first_name)) = lower(coalesce(v_first, '')) and lower(btrim(last_name)) = lower(coalesce(v_last, '')))
            or (btrim(first_name) = '' and btrim(last_name) = ''))
     order by created_at limit 1;
    if plus_id is null then
      select coalesce(max(position) + 1, 0) into pos from public.guests where wedding_id = w;
      insert into public.guests (wedding_id, group_id, first_name, last_name, plus_one_of, position)
      values (w, (select group_id from public.guests where id = main_id), coalesce(v_first, ''), coalesce(v_last, ''), main_id, pos)
      returning id into plus_id;
    end if;
    update public.guests
       set first_name = coalesce(v_first, first_name),
           last_name  = coalesce(v_last, last_name),
           email      = coalesce(public.merry_clip(p ->> 'email', 200), email),
           phone      = coalesce(public.merry_clip(p ->> 'phone', 40), phone),
           address    = case when coalesce(modes ->> 'adresse', 'off') = 'off' then address
                             when coalesce((p ->> 'same_address')::boolean, true) then coalesce(addr, address)
                             else coalesce(public.merry_clip(p ->> 'address', 300), address) end,
           diet       = case when coalesce(modes ->> 'regime', 'off') = 'off' then diet else
                          coalesce(nullif(concat_ws(' · ',
                            nullif(public.merry_clip(p ->> 'diet', 60), 'Aucun'),
                            case when public.merry_clip(p ->> 'allergies', 200) is not null then 'allergies : ' || public.merry_clip(p ->> 'allergies', 200) end), ''), diet) end
     where id = plus_id;
    -- L'accompagnant vient aux mêmes moments que l'invité
    if coalesce(modes ->> 'presence', 'off') <> 'off' then
      foreach ev in array f.event_ids loop
        st := payload -> 'answers' ->> ev::text;
        if st in ('oui', 'non') then
          insert into public.guest_responses (wedding_id, guest_id, event_id, status, updated_at)
          values (w, plus_id, ev, st, now())
          on conflict (guest_id, event_id) do update set status = excluded.status, updated_at = now();
        end if;
      end loop;
    end if;
  end if;

  update public.guest_forms set submissions = submissions + 1 where wedding_id = w;
  -- Pas d'indice sur la liste : la réponse ne dit pas si ce nom y figurait déjà
  return jsonb_build_object('ok', true);
end;
$$;
revoke all on function public.merry_form_submit(text, jsonb) from public;
grant execute on function public.merry_form_submit(text, jsonb) to anon, authenticated;

-- ======================================================================
-- supabase/invites-recherche.sql
-- ======================================================================
-- Merry · retrouver la fête (flux « J'ai un code » / « Je cherche par prénoms », site vitrine /onboarding)
-- À coller dans Supabase > SQL Editor > New query, puis Run, APRÈS site-mariage.sql et formulaire.sql
-- (merry_norm_compact y est définie).
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
  -- Prénoms comparés sans accent, majuscule ni tiret, jamais comme motif (« % » ne liste rien)
  n1 text := nullif(public.merry_norm_compact(p_name1), '');
  n2 text := nullif(public.merry_norm_compact(p_name2), '');
  hits uuid[];
begin
  if p_code is not null and trim(p_code) <> '' then
    select * into s from public.wedding_sites where lower(slug) = lower(trim(p_code)) and published;
    if not found then
      return null;
    end if;
  elsif n1 is not null then
    -- Un prénom seul ne suffit pas : il faut les deux prénoms, ou un prénom et la date
    if n2 is null and p_date is null then
      return null;
    end if;
    select array_agg(ww.id) into hits
      from public.wedding_sites ws
      join public.weddings ww on ww.id = ws.wedding_id
     where ws.published
       and (
             (public.merry_norm_compact(ww.partner1) = n1 and (n2 is null or public.merry_norm_compact(ww.partner2) = n2))
          or (public.merry_norm_compact(ww.partner2) = n1 and (n2 is null or public.merry_norm_compact(ww.partner1) = n2))
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

-- ======================================================================
-- supabase/site-visites.sql
-- ======================================================================
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

-- ======================================================================
-- supabase/prestataires.sql
-- ======================================================================
-- Merry · prestataires : sélection du couple, envies et demandes de devis
-- À coller dans Supabase > SQL Editor > New query, puis Run, APRÈS dashboard.sql.
-- Le fichier peut être relancé sans risque : il ne supprime aucune donnée.
--
-- Les prestataires proposés viennent du catalogue Merry (supabase/catalog.sql, schéma « catalog ») ;
-- ici, seulement ce qui appartient au mariage. Une demande envoyée crée (ou retrouve) le prestataire
-- dans « vendors » et range le message sur sa fiche (vendor_messages) : les réponses arrivent dans Budget.

-- ---------------------------------------------------------------------------
-- A. Demandes de devis : un message envoyé à plusieurs prestataires
-- ---------------------------------------------------------------------------

create table if not exists public.quote_requests (
  id            uuid primary key default gen_random_uuid(),
  wedding_id    uuid not null references public.weddings (id) on delete cascade,
  message       text not null check (length(message) between 1 and 5000),
  questions     jsonb not null default '{}'::jsonb,        -- {lieu: [...], traiteur: [...]}
  dates         text[] not null default '{}',              -- date souhaitée puis dates de repli
  share_budget  boolean not null default false,
  sent_by       uuid,                                      -- wedding_members.id
  created_at    timestamptz not null default now(),
  unique (wedding_id, id),
  foreign key (wedding_id, sent_by) references public.wedding_members (wedding_id, id) on delete set null (sent_by)
);
create index if not exists quote_requests_wedding_idx on public.quote_requests (wedding_id);

-- ---------------------------------------------------------------------------
-- B. Mes prestataires : ceux que le couple a gardés (le cœur), avec où il en est
-- ---------------------------------------------------------------------------

create table if not exists public.vendor_picks (
  id            uuid primary key default gen_random_uuid(),
  wedding_id    uuid not null references public.weddings (id) on delete cascade,
  catalog_ref   text not null check (length(catalog_ref) between 1 and 120),  -- « catalog:<id> » ou « exemple:<nom> »
  category      text not null check (category in ('lieu', 'traiteur', 'dj', 'fleuriste', 'photographe', 'autre')),
  data          jsonb not null default '{}'::jsonb,        -- nom, région, photo, prix… au moment du choix
  checked       boolean not null default true,             -- à inclure dans la prochaine demande
  note          text check (note is null or length(note) <= 1000),  -- un mot pour ce prestataire
  vendor_id     uuid,                                      -- fiche créée à l'envoi de la demande
  request_id    uuid,
  requested_at  timestamptz,
  quote_amount  numeric(12, 2),                            -- devis reçu, s'il n'est pas encore dans le budget
  quote_at      date,
  added_by      uuid,                                      -- wedding_members.id
  position      integer not null default 0,
  created_at    timestamptz not null default now(),
  unique (wedding_id, id),
  unique (wedding_id, catalog_ref),
  foreign key (wedding_id, vendor_id) references public.vendors (wedding_id, id) on delete set null (vendor_id),
  foreign key (wedding_id, request_id) references public.quote_requests (wedding_id, id) on delete set null (request_id),
  foreign key (wedding_id, added_by) references public.wedding_members (wedding_id, id) on delete set null (added_by)
);
create index if not exists vendor_picks_wedding_idx on public.vendor_picks (wedding_id);

-- ---------------------------------------------------------------------------
-- C. Préciser mes envies : une ligne par mariage, partagée entre les organisateurs
-- ---------------------------------------------------------------------------

create table if not exists public.vendor_wishes (
  wedding_id    uuid primary key references public.weddings (id) on delete cascade,
  wishes        jsonb not null default '{}'::jsonb,        -- accès, places, couchages, traiteur, style
  skipped       text[] not null default '{}',              -- catégories « Pas besoin »
  updated_by    uuid,
  updated_at    timestamptz not null default now(),
  foreign key (wedding_id, updated_by) references public.wedding_members (wedding_id, id) on delete set null (updated_by)
);

-- ---------------------------------------------------------------------------
-- Mêmes droits pour tous les organisateurs du mariage
-- ---------------------------------------------------------------------------

do $$
declare t text;
begin
  foreach t in array array['quote_requests', 'vendor_picks', 'vendor_wishes']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "organisateurs: tout" on public.%I', t);
    execute format('create policy "organisateurs: tout" on public.%I for all to authenticated
                    using (public.is_wedding_member(wedding_id))
                    with check (public.is_wedding_member(wedding_id))', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- D. Où chercher : le lieu ou la région du brief est du texte libre (« Bretagne »,
--    « etretat », « Saint Georges sur Loire (49) », « Alpes-Maritimes, mouans sartoux »).
--    merry_place le traduit en coordonnées, d'après le catalogue : numéro de département,
--    nom d'un lieu, ville, nom de département ou de pays (Luberon, Pays Basque…), région.
--    Ne renvoie que des coordonnées moyennes : rien du catalogue n'est exposé d'autre.
--    Version rapide dans lieux-rapides.sql : si ce fichier-ci est relancé, relancer lieux-rapides.sql après.
-- ---------------------------------------------------------------------------

create or replace function public.merry_norm(t text)
returns text
language sql
immutable
set search_path = ''
as $$
  select trim(regexp_replace(lower(translate(coalesce(t, ''),
    'àâäáãåéèêëíìîïóòôöõúùûüÿçñœæÀÂÄÁÃÅÉÈÊËÍÌÎÏÓÒÔÖÕÚÙÛÜŸÇÑŒÆ',
    'aaaaaaeeeeiiiiooooouuuuycnoaaaaaaaeeeeiiiiooooouuuuycnoa')), '[^a-z0-9]+', ' ', 'g'));
$$;

create or replace function public.merry_place(q text)
returns table (lat double precision, lng double precision, matched text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  accents constant text := 'àâäáãåéèêëíìîïóòôöõúùûüÿçñœÀÂÄÁÃÅÉÈÊËÍÌÎÏÓÒÔÖÕÚÙÛÜŸÇÑŒ''’-';
  plain   constant text := 'aaaaaaeeeeiiiiooooouuuuycnoaaaaaaeeeeiiiiooooouuuuycno   ';
  dep text;
  c text;
  parts text[];
begin
  if q is null or length(trim(q)) = 0 or length(q) > 200 then
    return;
  end if;

  -- Numéro de département : « (49) », « 49 », « 2A »
  dep := upper(substring(q from '(?:^|[^0-9])(2[AaBb]|97[1-6]|[0-9]{2})(?:[^0-9]|$)'));
  if dep is not null then
    return query select avg(v.lat), avg(v.lng), 'departement ' || dep from catalog.vendors v where v.department = dep and v.lat is not null having count(*) > 0;
    if found then return; end if;
  end if;

  parts := array(select public.merry_norm(x) from unnest(string_to_array(q, ',')) x where public.merry_norm(x) <> '');
  if array_length(parts, 1) > 1 then
    parts := parts || public.merry_norm(q);
  end if;

  foreach c in array parts loop
    -- Un lieu du catalogue, par son nom
    return query
      select v.lat, v.lng, 'lieu ' || v.name from catalog.vendors v
      where v.primary_category = 'lieu' and v.lat is not null
        and trim(lower(translate(v.name, accents, plain))) = c
      limit 1;
    if found then return; end if;

    -- Une ville
    return query
      select avg(v.lat), avg(v.lng), 'ville ' || c from catalog.vendors v
      where v.lat is not null and trim(lower(translate(v.city, accents, plain))) = c
      having count(*) > 0;
    if found then return; end if;

    -- Un département, ou un pays connu
    select d.code into dep from (values
      ('ain','01'),('aisne','02'),('allier','03'),('alpes de haute provence','04'),('hautes alpes','05'),('alpes maritimes','06'),('ardeche','07'),('ardennes','08'),('ariege','09'),('aube','10'),
      ('aude','11'),('aveyron','12'),('bouches du rhone','13'),('calvados','14'),('cantal','15'),('charente','16'),('charente maritime','17'),('cher','18'),('correze','19'),('corse du sud','2A'),
      ('haute corse','2B'),('cote d or','21'),('cotes d armor','22'),('creuse','23'),('dordogne','24'),('doubs','25'),('drome','26'),('eure','27'),('eure et loir','28'),('finistere','29'),
      ('gard','30'),('haute garonne','31'),('gers','32'),('gironde','33'),('herault','34'),('ille et vilaine','35'),('indre','36'),('indre et loire','37'),('isere','38'),('jura','39'),
      ('landes','40'),('loir et cher','41'),('loire','42'),('haute loire','43'),('loire atlantique','44'),('loiret','45'),('lot','46'),('lot et garonne','47'),('lozere','48'),('maine et loire','49'),
      ('manche','50'),('marne','51'),('haute marne','52'),('mayenne','53'),('meurthe et moselle','54'),('meuse','55'),('morbihan','56'),('moselle','57'),('nievre','58'),('nord','59'),
      ('oise','60'),('orne','61'),('pas de calais','62'),('puy de dome','63'),('pyrenees atlantiques','64'),('hautes pyrenees','65'),('pyrenees orientales','66'),('bas rhin','67'),('haut rhin','68'),('rhone','69'),
      ('haute saone','70'),('saone et loire','71'),('sarthe','72'),('savoie','73'),('haute savoie','74'),('paris','75'),('seine maritime','76'),('seine et marne','77'),('yvelines','78'),('deux sevres','79'),
      ('somme','80'),('tarn','81'),('tarn et garonne','82'),('var','83'),('vaucluse','84'),('vendee','85'),('vienne','86'),('haute vienne','87'),('vosges','88'),('yonne','89'),
      ('territoire de belfort','90'),('essonne','91'),('hauts de seine','92'),('seine saint denis','93'),('val de marne','94'),('val d oise','95'),
      ('guadeloupe','971'),('martinique','972'),('guyane','973'),('la reunion','974'),('reunion','974'),('mayotte','976'),
      ('luberon','84'),('pays basque','64'),('picardie','80'),('alsace','67'),('lorraine','54'),('champagne','51'),('auvergne','63'),('limousin','87'),('poitou','86'),('perigord','24'),
      ('aquitaine','33'),('languedoc','34'),('roussillon','66'),('cote d azur','06'),('riviera','06'),('camargue','13'),('alpilles','13'),('beaujolais','69'),('touraine','37'),('sologne','41'),
      ('anjou','49'),('berry','18'),('quercy','46'),('bearn','64'),('savoie mont blanc','73'),('franche comte','25'),('cotentin','50'),('pays de caux','76'),('vexin','95'),('brie','77')
    ) as d(name, code) where d.name = c;
    if dep is not null then
      return query select avg(v.lat), avg(v.lng), 'departement ' || dep from catalog.vendors v where v.department = dep and v.lat is not null having count(*) > 0;
      if found then return; end if;
    end if;

    -- Une région (« Provence », « Bretagne », « Bourgogne »…)
    if length(c) >= 4 then
      return query
        select avg(v.lat), avg(v.lng), 'region ' || c from catalog.vendors v
        where v.lat is not null and lower(translate(v.region, accents, plain)) like '%' || c || '%'
        having count(*) > 0;
      if found then return; end if;
    end if;
  end loop;
end;
$$;

revoke all on function public.merry_place(text) from public, anon;
grant execute on function public.merry_place(text) to authenticated;

-- ---------------------------------------------------------------------------
-- E. Ce que l'IA pense de chaque prestataire pour ce couple (app/api/prestataires/match)
--    Gardé par mariage et par « contexte » (empreinte du brief et des envies) : un prestataire n'est
--    noté qu'une fois tant que le couple ne change pas ses envies. Sans cette table, la note est
--    gardée le temps de la session du navigateur.
-- ---------------------------------------------------------------------------

create table if not exists public.vendor_matches (
  wedding_id    uuid not null references public.weddings (id) on delete cascade,
  catalog_id    uuid not null,
  context       text not null check (length(context) between 1 and 64),
  score         smallint not null check (score between 0 and 100),
  why           text check (why is null or length(why) <= 200),
  story         text check (story is null or length(story) <= 1000),
  checks        text[] not null default '{}',
  created_at    timestamptz not null default now(),
  primary key (wedding_id, catalog_id, context)
);

alter table public.vendor_matches enable row level security;
drop policy if exists "organisateurs: tout" on public.vendor_matches;
create policy "organisateurs: tout" on public.vendor_matches for all to authenticated
  using (public.is_wedding_member(wedding_id))
  with check (public.is_wedding_member(wedding_id));

-- ======================================================================
-- supabase/catalog.sql
-- ======================================================================
-- Merry · catalogue des prestataires (schéma « catalog »)
-- À coller dans Supabase > SQL Editor > New query, puis Run, AVANT catalog-filtres.sql, lieux-rapides.sql,
-- qualite-photos.sql, categories-principales.sql et espace-prestataire.sql. Relançable sans risque : sur une base
-- qui a déjà le catalogue (151 000 fiches), chaque instruction est un « si absent » et ne touche aucune donnée.
--
-- Ce fichier a été reconstitué le 2 novembre 2026 à partir de tout ce que l'appli, les scripts et les autres
-- fichiers SQL lisent et écrivent dans le schéma (il manquait au dépôt : la base ne pouvait pas être recréée de
-- zéro, et la CI ne pouvait pas rejouer les fichiers qui en dépendent). Les colonnes d'accès et de filtre
-- (aéroport, gare, traiteur imposé…) sont ajoutées par catalog-filtres.sql ; la qualité des photos par
-- qualite-photos.sql ; created_by_wedding par prestataires-ajout-manuel-fix-ambiguite.sql.
--
-- Après ce fichier : Supabase > Project Settings > API > Exposed schemas, ajouter « catalog » (l'appli lit le
-- catalogue avec la clé publique, sous les règles d'accès ci-dessous).

create schema if not exists catalog;
grant usage on schema catalog to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Catégories (onglets de « Trouver des prestataires », libellés des fiches)
-- ---------------------------------------------------------------------------

create table if not exists catalog.categories (
  slug      text primary key,
  label     text not null,
  position  smallint not null default 0
);
-- Catégories de départ, seulement sur une base vide : la table du catalogue en production a ses propres
-- colonnes en plus (kind…) et ses lignes, on n'y touche pas
do $$
begin
  if not exists (select 1 from catalog.categories) then
    insert into catalog.categories (slug, label, position) values
      ('lieu', 'Lieu de réception', 0), ('traiteur', 'Traiteur', 1), ('photographe', 'Photographe', 2), ('videaste', 'Vidéaste', 3),
      ('dj', 'DJ', 4), ('musiciens', 'Musiciens', 5), ('fleuriste', 'Fleuriste', 6), ('decoration', 'Décoration', 7),
      ('wedding_planner', 'Wedding planner', 8), ('patisserie', 'Pâtisserie', 9), ('beaute', 'Coiffure et maquillage', 10),
      ('robe', 'Robe et tenues', 11), ('transport', 'Transport', 12), ('officiant', 'Officiant', 13);
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Prestataires
-- ---------------------------------------------------------------------------

create table if not exists catalog.vendors (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null check (length(name) between 1 and 200),
  primary_category    text not null references catalog.categories (slug),
  categories          text[] not null default '{}',               -- toutes les catégories (la principale comprise)
  google_categories   text[] not null default '{}',               -- libellés Google tels quels (« Lieu de mariage »)
  description         text,
  address             text,
  postal_code         text,
  city                text,
  department          text,                                       -- « 13 », « 2A »
  region              text,
  lat                 double precision,
  lng                 double precision,
  email               text,
  phone               text,
  website             text,
  siret               text,
  siren               text,
  google_rating       numeric(2, 1),
  google_review_count integer,
  capacity_seated     integer,
  capacity_standing   integer,
  beds                integer,
  price_min           numeric(12, 2),
  price_max           numeric(12, 2),
  price_unit          text check (price_unit is null or price_unit in ('location', 'par_personne', 'forfait', 'par_heure')),
  style_tags          text[] not null default '{}',
  service_radius_km   integer,
  details             jsonb not null default '{}'::jsonb,         -- ce que scripts/catalog/10-structure.mjs a lu sur le site
  wedding_signal      numeric(6, 2) not null default 0,           -- « à quel point c'est un prestataire de mariage », pour le tri
  photos_count        integer not null default 0,
  status              text not null default 'pending' check (status in ('pending', 'active', 'rejected')),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- Position géographique (PostGIS) : seulement si l'extension est là (toujours sur Supabase ; pas dans la CI)
do $$
begin
  if exists (select 1 from pg_extension where extname = 'postgis') and not exists (
    select 1 from information_schema.columns where table_schema = 'catalog' and table_name = 'vendors' and column_name = 'location'
  ) then
    execute 'alter table catalog.vendors add column location extensions.geography(point, 4326)';
    execute 'create index if not exists vendors_location_idx on catalog.vendors using gist (location)';
  end if;
end $$;

create index if not exists vendors_status_category_idx on catalog.vendors (status, primary_category);
create index if not exists vendors_department_idx on catalog.vendors (department) where status = 'active';
create index if not exists vendors_city_idx on catalog.vendors (city) where status = 'active';
create index if not exists vendors_email_idx on catalog.vendors (lower(email)) where email is not null;
create index if not exists vendors_siret_idx on catalog.vendors (siret) where siret is not null;

-- ---------------------------------------------------------------------------
-- Photos : fichiers dans le stockage privé catalog-photos/<vendor_id>/…, servis en liens signés
-- ---------------------------------------------------------------------------

create table if not exists catalog.vendor_photos (
  id            uuid primary key default gen_random_uuid(),
  vendor_id     uuid not null references catalog.vendors (id) on delete cascade,
  position      smallint not null default 0,
  storage_path  text not null,
  width         integer,
  height        integer,
  created_at    timestamptz not null default now(),
  unique (vendor_id, storage_path)
);
create index if not exists vendor_photos_vendor_idx on catalog.vendor_photos (vendor_id, position);

insert into storage.buckets (id, name, public) values ('catalog-photos', 'catalog-photos', false)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Droits : les organisateurs connectés lisent les fiches validées (et leurs photos, les catégories) ;
-- tout le reste passe par des fonctions security definer (espace prestataire) ou par la clé de service
-- (scripts, pages publiques /mariage, revendication de fiche).
-- ---------------------------------------------------------------------------

alter table catalog.categories   enable row level security;
alter table catalog.vendors      enable row level security;
alter table catalog.vendor_photos enable row level security;

grant select on catalog.categories, catalog.vendors, catalog.vendor_photos to authenticated;
grant all on catalog.categories, catalog.vendors, catalog.vendor_photos to service_role;

drop policy if exists "catégories lisibles" on catalog.categories;
create policy "catégories lisibles" on catalog.categories for select to authenticated using (true);

drop policy if exists "fiches validées lisibles" on catalog.vendors;
create policy "fiches validées lisibles" on catalog.vendors for select to authenticated using (status = 'active');

drop policy if exists "photos des fiches validées lisibles" on catalog.vendor_photos;
create policy "photos des fiches validées lisibles" on catalog.vendor_photos for select to authenticated
  using (exists (select 1 from catalog.vendors v where v.id = vendor_id and v.status = 'active'));

-- Liens signés des photos pour les organisateurs connectés (lecture seule du dossier)
drop policy if exists "photos du catalogue lisibles" on storage.objects;
create policy "photos du catalogue lisibles" on storage.objects for select to authenticated
  using (bucket_id = 'catalog-photos');

-- updated_at suit chaque modification
create or replace function catalog.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists vendors_touch_updated_at on catalog.vendors;
create trigger vendors_touch_updated_at before update on catalog.vendors
  for each row execute function catalog.touch_updated_at();

-- ======================================================================
-- supabase/prestataires-ajout-manuel-fix-ambiguite.sql
-- ======================================================================
-- Corrige « column reference "city" is ambiguous » dans merry_add_vendor_manual (signalé par Stan en
-- ajoutant un prestataire à la main) : le paramètre de la fonction s'appelle city, comme la colonne
-- catalog.vendors.city, et Postgres ne sait plus lequel on vise dans la requête de doublon. Même
-- correctif qu'ici : on alias la table (v) et on qualifie ses colonnes, sans changer la signature de
-- la fonction (le nom city reste celui attendu par l'appli).
-- À coller dans Supabase > SQL Editor > New query, puis Run, APRÈS prestataires-ajout-manuel-google.sql
-- (et quotas.sql pour la limite par jour ; sans lui, pas de limite).

-- D'où vient une fiche créée à la main : le mariage qui l'a ajoutée. Les pages publiques (/mariage/…)
-- ne listent pas ces fiches tant qu'elles n'ont pas été relues, et seule l'équipe de ce mariage peut y
-- rattacher des photos Google (/api/prestataires/photos-google).
alter table catalog.vendors add column if not exists created_by_wedding uuid;
create index if not exists vendors_created_by_wedding_idx on catalog.vendors (created_by_wedding) where created_by_wedding is not null;

create or replace function public.merry_add_vendor_manual(
  w uuid, vname text, category text, city text,
  phone text default null, website text default null, vlat double precision default null, vlng double precision default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  new_id uuid;
  clean_name text := nullif(trim(vname), '');
  clean_city text := nullif(trim(left(coalesce(city, ''), 80)), '');
  clean_phone text := nullif(trim(left(coalesce(phone, ''), 40)), '');
  clean_website text := nullif(trim(left(coalesce(website, ''), 300)), '');
  v_lat double precision := vlat;
  v_lng double precision := vlng;
begin
  if not public.is_wedding_member(w) then
    raise exception 'not a wedding member';
  end if;
  if clean_name is null or length(clean_name) > 120 then
    raise exception 'invalid name';
  end if;
  if category not in ('lieu', 'traiteur', 'dj', 'musiciens', 'fleuriste', 'photographe', 'videaste', 'decoration', 'wedding_planner', 'patisserie', 'beaute', 'robe', 'transport', 'officiant') then
    raise exception 'invalid category';
  end if;
  if clean_website is not null and clean_website !~* '^https?://' then
    clean_website := 'https://' || clean_website;
  end if;
  if clean_website is not null and clean_website !~* '^https?://[a-z0-9-]+(\.[a-z0-9-]+)+(/|$)' then
    raise exception 'invalid website';
  end if;
  if clean_phone is not null and clean_phone !~ '^[0-9+][0-9 .()/-]{5,}$' then
    raise exception 'invalid phone';
  end if;
  -- Au plus 30 fiches ajoutées par jour et par personne : le catalogue est partagé par tous les couples
  if to_regprocedure('public.merry_rate(text, integer, integer)') is not null
     and not public.merry_rate('vendor_manual', 30, 86400) then
    raise exception 'too many vendors today';
  end if;

  select v.id into new_id from catalog.vendors v
    where v.status = 'active' and v.primary_category = category and public.merry_norm(v.name) = public.merry_norm(clean_name)
      and (clean_city is null or v.city is null or public.merry_norm(v.city) = public.merry_norm(clean_city))
    limit 1;
  if new_id is not null then
    return new_id;
  end if;

  if v_lat is null and clean_city is not null then
    select p.lat, p.lng into v_lat, v_lng from public.merry_place(clean_city) p limit 1;
  end if;

  insert into catalog.vendors (name, primary_category, status, city, categories, lat, lng, phone, website, created_by_wedding)
  values (clean_name, category, 'active', clean_city, array[category], v_lat, v_lng, clean_phone, clean_website, w)
  returning id into new_id;

  return new_id;
end;
$$;

revoke all on function public.merry_add_vendor_manual(uuid, text, text, text, text, text, double precision, double precision) from public, anon;
grant execute on function public.merry_add_vendor_manual(uuid, text, text, text, text, text, double precision, double precision) to authenticated;

-- ======================================================================
-- supabase/espace-prestataire.sql
-- ======================================================================
-- Merry · espace prestataire (/pro) : les prestataires prennent la main sur leur fiche du catalogue
-- À coller dans Supabase > SQL Editor > New query, puis Run, APRÈS catalog.sql, catalog-filtres.sql,
-- prestataires.sql et lieux-rapides.sql. Le fichier peut être relancé sans risque : il ne supprime aucune donnée.
--
-- A. Comptes : qui gère quelle fiche (pro_vendors, pro_members, is_pro_member)
-- B. Revendiquer sa fiche : recherche publique (pro_search) ; le code par mail passe par /api/pro/claim
-- C. Ma fiche : modifications écrites dans catalog.vendors (pro_save_fiche, pro_set_photos), photos et fichiers
-- D. Tarifs (pro_formulas, pro_options) : le prix le plus bas devient le « À partir de » des couples
-- E. Disponibilités (pro_dates) et lien d'agenda (iCal)
-- F. Clients (pro_clients, pro_documents) et demandes des couples (pro_requests, pro_thread, pro_send)
-- G. Projets de mariage (accord des couples, pro_projects, pro_unlock, pro_propose)
-- H. Crédits et formules (pro_offer, pro_ledger) : montants à remplir, paiement à brancher
-- I. Propositions de fonctionnalités (pro_feedback) et chiffres du mois (pro_views, pro_stats)

-- ---------------------------------------------------------------------------
-- A. Comptes
-- ---------------------------------------------------------------------------

create table if not exists public.pro_vendors (
  vendor_id     uuid primary key references catalog.vendors (id) on delete cascade,
  plan          text not null default 'essentiel' check (plan in ('essentiel', 'confort', 'pro')),
  billing       text not null default 'mensuel' check (billing in ('mensuel', 'annuel')),
  renews_on     date,
  credits       integer not null default 0 check (credits >= 0),
  high_from     text not null default '1 mai',             -- saisons des tarifs, en toutes lettres
  high_to       text not null default '30 septembre',
  low_from      text not null default '1 octobre',
  low_to        text not null default '30 avril',
  ical_token    uuid not null default gen_random_uuid(),   -- lien d'agenda privé
  claimed_at    timestamptz not null default now()
);

create table if not exists public.pro_members (
  id          uuid primary key default gen_random_uuid(),
  vendor_id   uuid not null references public.pro_vendors (vendor_id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  email       text,
  role        text not null default 'gerant',
  created_at  timestamptz not null default now(),
  unique (vendor_id, user_id)
);
create index if not exists pro_members_user_idx on public.pro_members (user_id);

create or replace function public.is_pro_member(v uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.pro_members m where m.vendor_id = v and m.user_id = auth.uid());
$$;
revoke all on function public.is_pro_member(uuid) from public, anon;
grant execute on function public.is_pro_member(uuid) to authenticated;

alter table public.pro_vendors enable row level security;
alter table public.pro_members enable row level security;
drop policy if exists "prestataire: sa fiche" on public.pro_vendors;
create policy "prestataire: sa fiche" on public.pro_vendors for select to authenticated using (public.is_pro_member(vendor_id));
drop policy if exists "prestataire: ses saisons" on public.pro_vendors;
create policy "prestataire: ses saisons" on public.pro_vendors for update to authenticated
  using (public.is_pro_member(vendor_id)) with check (public.is_pro_member(vendor_id));
drop policy if exists "prestataire: son équipe" on public.pro_members;
create policy "prestataire: son équipe" on public.pro_members for select to authenticated using (public.is_pro_member(vendor_id));
-- Formule, crédits et lien d'agenda : seulement par les fonctions ci-dessous (et le paiement, plus tard)
revoke insert, update, delete on public.pro_vendors from authenticated, anon;
grant select on public.pro_vendors to authenticated;
grant update (high_from, high_to, low_from, low_to) on public.pro_vendors to authenticated;
revoke insert, update, delete on public.pro_members from authenticated, anon;
grant select on public.pro_members to authenticated;

-- La fiche et le compte du prestataire connecté (une ligne par fiche gérée)
create or replace function public.pro_me()
returns table (vendor_id uuid, role text)
language sql
stable
security definer
set search_path = ''
as $$
  select m.vendor_id, m.role from public.pro_members m where m.user_id = auth.uid() order by m.created_at;
$$;
revoke all on function public.pro_me() from public, anon;
grant execute on function public.pro_me() to authenticated;

-- Le premier dossier d'un fichier du stockage est la fiche du prestataire (<vendor_id>/…)
create or replace function public.is_pro_path(path text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  return public.is_pro_member(split_part(path, '/', 1)::uuid);
exception when others then
  return false;
end;
$$;
revoke all on function public.is_pro_path(text) from public, anon;
grant execute on function public.is_pro_path(text) to authenticated;

-- ---------------------------------------------------------------------------
-- B. Revendiquer sa fiche : recherche par nom ou SIRET, mail et téléphone masqués
-- ---------------------------------------------------------------------------

drop function if exists public.pro_search(text);
create or replace function public.pro_search(q text)
returns table (id uuid, name text, city text, address text, postal_code text, category text, photo text, email_hint text, phone_hint text, rating numeric, reviews integer, claimed boolean)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  t text := trim(coalesce(q, ''));
  digits text := regexp_replace(t, '[^0-9]', '', 'g');
begin
  if length(t) < 3 or length(t) > 120 then
    return;
  end if;
  return query
    select v.id, v.name, v.city, v.address, v.postal_code, coalesce(c.label, v.primary_category),
           (select p.storage_path from catalog.vendor_photos p where p.vendor_id = v.id order by p.position limit 1),
           case when v.email ~ '@' then left(v.email, 1) || '•••' || substring(v.email from '@.*$') end,
           case when length(regexp_replace(coalesce(v.phone, ''), '[^0-9]', '', 'g')) >= 8
                then left(regexp_replace(v.phone, '[^0-9]', '', 'g'), 2) || ' •• •• •• ' || right(regexp_replace(v.phone, '[^0-9]', '', 'g'), 2) end,
           v.google_rating, v.google_review_count,
           exists (select 1 from public.pro_vendors pv where pv.vendor_id = v.id)
    from catalog.vendors v
    left join catalog.categories c on c.slug = v.primary_category
    where v.status = 'active'
      and (v.name ilike '%' || replace(replace(t, '%', ''), '_', '') || '%'
           or (length(digits) >= 9 and (v.siret = digits or v.siren = left(digits, 9))))
    order by (lower(v.name) = lower(t)) desc, v.photos_count desc, v.wedding_signal desc
    limit 8;
end;
$$;
revoke all on function public.pro_search(text) from public;
grant execute on function public.pro_search(text) to anon, authenticated;

-- La recherche par nom parcourt tout le catalogue (« %mot% ») : un index trigramme la rend immédiate
-- au lieu d'un balayage complet à chaque lettre tapée, par n'importe qui (la fonction est publique)
create extension if not exists pg_trgm with schema extensions;
create index if not exists vendors_name_trgm_idx on catalog.vendors using gin (name extensions.gin_trgm_ops) where status = 'active';
-- pro_sync, pro_stats et pro_projects retrouvent les choix des couples par catalog_ref seul
create index if not exists vendor_picks_ref_idx on public.vendor_picks (catalog_ref);

-- ---------------------------------------------------------------------------
-- C. Ma fiche : les modifications vont droit dans le catalogue que lisent les couples
-- ---------------------------------------------------------------------------

-- Cérémonie en extérieur et parking : le choix du prestataire (details) passe avant ce que Merry a lu
-- sur son site. Les deux colonnes sont recréées en une fois (une seule réécriture de la table).
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'catalog' and table_name = 'vendors' and column_name = 'outdoor_ceremony'
      and generation_expression like '%outdoor_ceremony%'
  ) then
    alter table catalog.vendors
      drop column if exists outdoor_ceremony,
      drop column if exists parking,
      add column outdoor_ceremony boolean generated always as (
        case
          when details ->> 'outdoor_ceremony' in ('true', 'false') then (details ->> 'outdoor_ceremony')::boolean
          when (details ->> 'services') ~* 'c[ée]r[ée]monie[^",]{0,40}(jardin|parc|ext[ée]rieur|plein air|dehors|prairie|pelouse|terrasse|vignes?|verger|bord de)' then true
          when details ->> 'ceremony_on_site' = 'true' and details ->> 'outdoor_space' = 'true' then true
          when details ->> 'ceremony_on_site' = 'false' then false
        end
      ) stored,
      add column parking boolean generated always as (
        case
          when details ->> 'parking' in ('true', 'false') then (details ->> 'parking')::boolean
          when (details ->> 'services') ~* '(parking|stationnement|places de parc)' then true
        end
      ) stored;
  end if;
end $$;

-- Ce qu'un prestataire peut changer sur sa fiche (le reste du catalogue reste celui de Merry)
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
  foreach k in array array['video_url', 'caterer_imposed', 'caterer_mode', 'music_end', 'outdoor_ceremony', 'parking', 'accessible', 'parking_note', 'includes', 'service_area', 'service_radius_km', 'team_size'] loop
    if patch ? k then d := d || jsonb_build_object(k, patch -> k); end if;
  end loop;
  update catalog.vendors set
    description       = case when patch ? 'description' then nullif(left(patch ->> 'description', 3000), '') else description end,
    website            = case when patch ? 'website' then nullif(left(patch ->> 'website', 200), '') else website end,
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

-- La fiche telle que le prestataire la modifie (même une fiche pas encore « active »)
create or replace function public.pro_fiche(v uuid)
returns setof catalog.vendors
language sql
stable
security definer
set search_path = ''
as $$
  select * from catalog.vendors where id = v and public.is_pro_member(v);
$$;
revoke all on function public.pro_fiche(uuid) from public, anon;
grant execute on function public.pro_fiche(uuid) to authenticated;

create or replace function public.pro_photos(v uuid)
returns table (id uuid, storage_path text, "position" smallint)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.storage_path, p.position from catalog.vendor_photos p where p.vendor_id = v and public.is_pro_member(v) order by p.position;
$$;
revoke all on function public.pro_photos(uuid) from public, anon;
grant execute on function public.pro_photos(uuid) to authenticated;

-- Photos dans l'ordre voulu (la première sert de couverture) ; les fichiers sont dans catalog-photos/<vendor_id>/
create or replace function public.pro_set_photos(v uuid, paths text[])
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if not public.is_pro_member(v) then
    raise exception 'pas votre fiche' using errcode = '42501';
  end if;
  if exists (select 1 from unnest(paths) p where p not like v::text || '/%') then
    raise exception 'photo hors de votre dossier' using errcode = '42501';
  end if;
  -- Les photos gardées conservent leurs métadonnées (dimensions, lecture « capture d'écran », classement) :
  -- on retire seulement celles qui ne sont plus listées, on renumérote, on ajoute les nouvelles
  delete from catalog.vendor_photos where vendor_id = v and not (storage_path = any (paths));
  update catalog.vendor_photos ph set position = (t.o - 1)::smallint
    from unnest(paths) with ordinality as t(p, o)
    where ph.vendor_id = v and ph.storage_path = t.p;
  insert into catalog.vendor_photos (vendor_id, position, storage_path)
    select v, (o - 1)::smallint, p from unnest(paths) with ordinality as t(p, o)
    where not exists (select 1 from catalog.vendor_photos x where x.vendor_id = v and x.storage_path = p);
  update catalog.vendors set photos_count = coalesce(array_length(paths, 1), 0), updated_at = now() where id = v;
end;
$$;
revoke all on function public.pro_set_photos(uuid, text[]) from public, anon;
grant execute on function public.pro_set_photos(uuid, text[]) to authenticated;

-- Le prestataire dépose et retire ses photos dans son dossier du stockage des photos du catalogue
drop policy if exists "prestataire: ses photos (ajout)" on storage.objects;
create policy "prestataire: ses photos (ajout)" on storage.objects for insert to authenticated
  with check (bucket_id = 'catalog-photos' and public.is_pro_path(name));
drop policy if exists "prestataire: ses photos (retrait)" on storage.objects;
create policy "prestataire: ses photos (retrait)" on storage.objects for delete to authenticated
  using (bucket_id = 'catalog-photos' and public.is_pro_path(name));

-- Fichiers du prestataire (vidéo, devis, captures) : stockage privé pro-fichiers/<vendor_id>/…
insert into storage.buckets (id, name, public, file_size_limit)
values ('pro-fichiers', 'pro-fichiers', false, 52428800)
on conflict (id) do nothing;
drop policy if exists "prestataire: ses fichiers (lecture)" on storage.objects;
create policy "prestataire: ses fichiers (lecture)" on storage.objects for select to authenticated
  using (bucket_id = 'pro-fichiers' and public.is_pro_path(name));
drop policy if exists "prestataire: ses fichiers (ajout)" on storage.objects;
create policy "prestataire: ses fichiers (ajout)" on storage.objects for insert to authenticated
  with check (bucket_id = 'pro-fichiers' and public.is_pro_path(name));
drop policy if exists "prestataire: ses fichiers (retrait)" on storage.objects;
create policy "prestataire: ses fichiers (retrait)" on storage.objects for delete to authenticated
  using (bucket_id = 'pro-fichiers' and public.is_pro_path(name));

-- ---------------------------------------------------------------------------
-- D. Tarifs
-- ---------------------------------------------------------------------------

create table if not exists public.pro_formulas (
  id          uuid primary key default gen_random_uuid(),
  vendor_id   uuid not null references public.pro_vendors (vendor_id) on delete cascade,
  name        text not null check (length(name) between 1 and 120),
  unit        text not null default 'forfait' check (unit in ('forfait', 'par_invite')),
  includes    text[] not null default '{}',
  price_high  integer check (price_high is null or price_high >= 0),
  price_low   integer check (price_low is null or price_low >= 0),
  position    integer not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists pro_formulas_vendor_idx on public.pro_formulas (vendor_id);

create table if not exists public.pro_options (
  id          uuid primary key default gen_random_uuid(),
  vendor_id   uuid not null references public.pro_vendors (vendor_id) on delete cascade,
  name        text not null check (length(name) between 1 and 120),
  unit        text not null default 'forfait' check (unit in ('forfait', 'nuit', 'par_invite', 'par_heure')),
  price       integer check (price is null or price >= 0),
  position    integer not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists pro_options_vendor_idx on public.pro_options (vendor_id);

-- Le prix le plus bas des formules devient le « À partir de » des couples (catalog.vendors.price_min)
create or replace function public.pro_sync_price()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v uuid := case when tg_op = 'DELETE' then old.vendor_id else new.vendor_id end;
  best_price integer;
  best_unit text;
begin
  -- Un forfait d'abord (le « À partir de » d'un lieu reste un prix de location), sinon le prix par invité le plus bas
  select least(coalesce(f.price_low, f.price_high), coalesce(f.price_high, f.price_low)), f.unit
    into best_price, best_unit
    from public.pro_formulas f
    where f.vendor_id = v and coalesce(f.price_low, f.price_high) is not null
    order by (f.unit = 'par_invite') asc, 1 asc
    limit 1;
  -- Plus aucun prix (formules retirées) : le prix affiché aux couples s'efface aussi
  update catalog.vendors set
    price_min = best_price,
    price_unit = case when best_price is null then price_unit when best_unit = 'par_invite' then 'par_personne' when primary_category = 'lieu' then 'location' else 'forfait' end,
    updated_at = now()
  where id = v and price_min is distinct from best_price;
  return null;
end;
$$;
drop trigger if exists pro_formulas_price on public.pro_formulas;
create trigger pro_formulas_price after insert or update or delete on public.pro_formulas
  for each row execute function public.pro_sync_price();

-- ---------------------------------------------------------------------------
-- E. Disponibilités
-- ---------------------------------------------------------------------------

create table if not exists public.pro_clients (
  id              uuid primary key default gen_random_uuid(),
  vendor_id       uuid not null references public.pro_vendors (vendor_id) on delete cascade,
  pick_id         uuid unique references public.vendor_picks (id) on delete set null,   -- la demande venue par Merry
  wedding_id      uuid references public.weddings (id) on delete set null,
  names           text not null check (length(names) between 1 and 120),               -- « Camille & Jules »
  wedding_date    date,
  date_label      text,                                                                  -- « Dates flexibles : juin 2027 »
  guests          integer,
  budget_label    text,
  source          text not null default 'hors_merry' check (source in ('merry', 'hors_merry')),
  stage           text not null default 'nouvelle' check (stage in ('nouvelle', 'devis', 'visite', 'reserve', 'perdu')),
  next_action     text,
  next_action_on  date,
  notes           text check (notes is null or length(notes) <= 5000),
  email           text,
  phone           text,
  lost_reason     text,
  answered_at     timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists pro_clients_vendor_idx on public.pro_clients (vendor_id);

create table if not exists public.pro_dates (
  id          uuid primary key default gen_random_uuid(),
  vendor_id   uuid not null references public.pro_vendors (vendor_id) on delete cascade,
  day         date not null,
  status      text not null check (status in ('option', 'reserve')),
  client_id   uuid references public.pro_clients (id) on delete set null,
  label       text,                                  -- le couple, s'il n'est pas dans Clients
  expires_on  date,                                  -- fin de l'option
  created_at  timestamptz not null default now(),
  unique (vendor_id, day)
);

create table if not exists public.pro_documents (
  id            uuid primary key default gen_random_uuid(),
  vendor_id     uuid not null references public.pro_vendors (vendor_id) on delete cascade,
  client_id     uuid references public.pro_clients (id) on delete cascade,
  name          text not null,
  storage_path  text not null,
  bytes         integer,
  created_at    timestamptz not null default now()
);
create index if not exists pro_documents_client_idx on public.pro_documents (client_id);

-- ---------------------------------------------------------------------------
-- H. Crédits (avant G : le déblocage d'un projet en dépense)
-- ---------------------------------------------------------------------------

-- Ce que Merry propose : une seule ligne, montants à remplir dans Table Editor (vide = « à définir »)
create table if not exists public.pro_offer (
  id            smallint primary key default 1 check (id = 1),
  plans         jsonb not null default '[
    {"key": "essentiel", "name": "Essentiel", "monthly": null, "yearly": null, "credits": null},
    {"key": "confort", "name": "Confort", "monthly": null, "yearly": null, "credits": null},
    {"key": "pro", "name": "Pro", "monthly": null, "yearly": null, "credits": null}
  ]'::jsonb,
  packs         jsonb not null default '[{"credits": null, "price": null}, {"credits": null, "price": null}, {"credits": null, "price": null}]'::jsonb,
  unlock_cost   integer,                -- crédits pour débloquer un projet de mariage
  explainer     text,                   -- « Comment sont utilisés les crédits »
  payments_on   boolean not null default false
);
insert into public.pro_offer (id) values (1) on conflict (id) do nothing;
alter table public.pro_offer enable row level security;
drop policy if exists "offre lisible" on public.pro_offer;
create policy "offre lisible" on public.pro_offer for select to authenticated using (true);
revoke insert, update, delete on public.pro_offer from authenticated, anon;
grant select on public.pro_offer to authenticated;

create table if not exists public.pro_ledger (
  id          uuid primary key default gen_random_uuid(),
  vendor_id   uuid not null references public.pro_vendors (vendor_id) on delete cascade,
  at          timestamptz not null default now(),
  kind        text not null check (kind in ('abonnement', 'achat', 'utilisation', 'remboursement')),
  label       text not null,
  delta       integer not null,
  balance     integer not null
);
create index if not exists pro_ledger_vendor_idx on public.pro_ledger (vendor_id, at desc);

-- ---------------------------------------------------------------------------
-- I. Propositions de fonctionnalités et chiffres du mois
-- ---------------------------------------------------------------------------

create table if not exists public.pro_feedback (
  id               uuid primary key default gen_random_uuid(),
  vendor_id        uuid not null references public.pro_vendors (vendor_id) on delete cascade,
  user_id          uuid default auth.uid(),
  body             text not null check (length(body) between 1 and 5000),
  page             text,
  screenshot_path  text,
  status           text not null default 'recue' check (status in ('recue', 'prevue', 'disponible')),
  created_at       timestamptz not null default now()
);

create table if not exists public.pro_views (
  id          bigint generated always as identity primary key,
  vendor_id   uuid not null references catalog.vendors (id) on delete cascade,
  wedding_id  uuid references public.weddings (id) on delete set null,
  viewed_at   timestamptz not null default now()
);
create index if not exists pro_views_vendor_idx on public.pro_views (vendor_id, viewed_at);

-- Un couple ouvre une fiche du catalogue : une vue de plus (au plus une par mariage et par jour)
create or replace function public.merry_log_view(v uuid, w uuid)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  insert into public.pro_views (vendor_id, wedding_id)
  select v, w
  where public.is_wedding_member(w)
    and exists (select 1 from catalog.vendors where id = v)
    and not exists (select 1 from public.pro_views x where x.vendor_id = v and x.wedding_id = w and x.viewed_at > now() - interval '1 day');
$$;
revoke all on function public.merry_log_view(uuid, uuid) from public, anon;
grant execute on function public.merry_log_view(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Droits des tables du prestataire : tout, sur sa propre fiche
-- ---------------------------------------------------------------------------

do $$
declare t text;
begin
  foreach t in array array['pro_formulas', 'pro_options', 'pro_clients', 'pro_dates', 'pro_documents', 'pro_feedback']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "prestataire: tout" on public.%I', t);
    execute format('create policy "prestataire: tout" on public.%I for all to authenticated
                    using (public.is_pro_member(vendor_id))
                    with check (public.is_pro_member(vendor_id))', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
  foreach t in array array['pro_ledger', 'pro_views']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "prestataire: lecture" on public.%I', t);
    execute format('create policy "prestataire: lecture" on public.%I for select to authenticated using (public.is_pro_member(vendor_id))', t);
    execute format('revoke insert, update, delete on public.%I from authenticated, anon', t);
    execute format('grant select on public.%I to authenticated', t);
  end loop;
end $$;

-- Le statut d'une proposition (« Reçue », « Prévue », « Disponible ») est celui de l'équipe Merry
revoke update on public.pro_feedback from authenticated;

-- ---------------------------------------------------------------------------
-- F. Demandes des couples : celles envoyées depuis « Demander les devis » à cette fiche
-- ---------------------------------------------------------------------------

-- Chaque nouvelle demande devient un client « Nouvelle demande », à qui répondre
create or replace function public.pro_sync(v uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if not public.is_pro_member(v) then
    return;
  end if;
  insert into public.pro_clients (vendor_id, pick_id, wedding_id, names, wedding_date, date_label, guests, budget_label, source, stage, next_action, next_action_on, created_at)
  select v, p.id, p.wedding_id,
         trim(both ' &' from coalesce(w.partner1, '') || ' & ' || coalesce(w.partner2, '')),
         w.wedding_date,
         nullif(q.dates[1], ''),
         case b.guests when '<50' then 40 when '50-100' then 80 when '100-150' then 120 when '150-200' then 170 when '>200' then 220 end,
         case when q.share_budget then case b.budget when '<15k' then 'Moins de 15 000 €' when '15-30k' then '15 000 à 30 000 €' when '30-50k' then '30 000 à 50 000 €' when '>50k' then 'Plus de 50 000 €' end end,
         'merry', 'nouvelle', 'Répondre', p.requested_at::date, p.requested_at
  from public.vendor_picks p
  join public.weddings w on w.id = p.wedding_id
  left join public.briefs b on b.id = w.brief_id
  left join public.quote_requests q on q.id = p.request_id
  where p.catalog_ref = 'catalog:' || v::text and p.request_id is not null
  on conflict (pick_id) do nothing;
end;
$$;
revoke all on function public.pro_sync(uuid) from public, anon;
grant execute on function public.pro_sync(uuid) to authenticated;

-- Le détail d'une demande : le couple, leur brief, leur message et leurs dates
create or replace function public.pro_requests(v uuid)
returns table (
  client_id uuid, pick_id uuid, wedding_id uuid, names text, requested_at timestamptz,
  wedding_date date, dates text[], guests text, budget text, region text, vibes text[], format text,
  message text, answered boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, p.id, p.wedding_id, c.names, p.requested_at,
         w.wedding_date, coalesce(q.dates, '{}'), b.guests,
         case when q.share_budget then b.budget end,
         coalesce(w.region, b.region), coalesce(b.vibes, '{}'), b.format,
         (select m.body from public.vendor_messages m
           where m.wedding_id = p.wedding_id and m.vendor_id = p.vendor_id and not m.from_vendor
           order by m.sent_at limit 1),
         exists (select 1 from public.vendor_messages m where m.wedding_id = p.wedding_id and m.vendor_id = p.vendor_id and m.from_vendor)
  from public.pro_clients c
  join public.vendor_picks p on p.id = c.pick_id
  join public.weddings w on w.id = p.wedding_id
  left join public.briefs b on b.id = w.brief_id
  left join public.quote_requests q on q.id = p.request_id
  where c.vendor_id = v and public.is_pro_member(v)
  order by p.requested_at desc;
$$;
revoke all on function public.pro_requests(uuid) from public, anon;
grant execute on function public.pro_requests(uuid) to authenticated;

-- Les messages échangés avec un couple venu par Merry (ceux de la fiche prestataire de son Budget)
create or replace function public.pro_thread(c uuid)
returns table (id uuid, from_vendor boolean, body text, sent_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select m.id, m.from_vendor, m.body, m.sent_at
  from public.pro_clients x
  join public.vendor_picks p on p.id = x.pick_id
  join public.vendor_messages m on m.wedding_id = p.wedding_id and m.vendor_id = p.vendor_id
  where x.id = c and public.is_pro_member(x.vendor_id)
  order by m.sent_at;
$$;
revoke all on function public.pro_thread(uuid) from public, anon;
grant execute on function public.pro_thread(uuid) to authenticated;

-- Le prestataire écrit au couple : le message arrive sur la fiche du prestataire, dans le Budget du couple
create or replace function public.pro_send(c uuid, body text)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  x record;
  out_id uuid;
begin
  select pc.vendor_id, p.wedding_id, p.vendor_id as couple_vendor
    into x
    from public.pro_clients pc join public.vendor_picks p on p.id = pc.pick_id
    where pc.id = c;
  if x.vendor_id is null or not public.is_pro_member(x.vendor_id) then
    raise exception 'pas votre client' using errcode = '42501';
  end if;
  if x.couple_vendor is null then
    raise exception 'ce couple n''a pas encore de fiche pour vous' using errcode = 'P0002';
  end if;
  if length(trim(coalesce(body, ''))) = 0 or length(body) > 8000 then
    raise exception 'message vide ou trop long' using errcode = '22023';
  end if;
  insert into public.vendor_messages (wedding_id, vendor_id, from_vendor, body)
    values (x.wedding_id, x.couple_vendor, true, trim(body))
    returning id into out_id;
  update public.pro_clients set answered_at = coalesce(answered_at, now()), updated_at = now() where id = c;
  return out_id;
end;
$$;
revoke all on function public.pro_send(uuid, text) from public, anon;
grant execute on function public.pro_send(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- G. Projets de mariage : des couples qui acceptent d'être contactés
-- ---------------------------------------------------------------------------

-- L'accord du couple et le mot qu'il laisse aux prestataires (écran couple à dessiner : vide en attendant)
alter table public.vendor_wishes add column if not exists open_to_vendors boolean not null default false;
alter table public.vendor_wishes add column if not exists vendor_note text check (vendor_note is null or length(vendor_note) <= 1000);

create table if not exists public.pro_unlocks (
  vendor_id   uuid not null references public.pro_vendors (vendor_id) on delete cascade,
  wedding_id  uuid not null references public.weddings (id) on delete cascade,
  credits     integer not null default 0,
  at          timestamptz not null default now(),
  proposed_at timestamptz,
  primary key (vendor_id, wedding_id)
);
alter table public.pro_unlocks enable row level security;
drop policy if exists "prestataire: lecture" on public.pro_unlocks;
create policy "prestataire: lecture" on public.pro_unlocks for select to authenticated using (public.is_pro_member(vendor_id));
revoke insert, update, delete on public.pro_unlocks from authenticated, anon;
grant select on public.pro_unlocks to authenticated;

-- Les projets ouverts autour du prestataire : prénoms et message masqués tant qu'il n'a pas débloqué
create or replace function public.pro_projects(v uuid, radius_km integer default 60)
returns table (
  wedding_id uuid, unlocked boolean, names text, area text, wedding_date date, date_unknown boolean,
  guests text, budget text, km integer, vibes text[], format text, note text
)
language sql
stable
security definer
set search_path = ''
as $$
  with me as (
    select lat, lng from catalog.vendors where id = v and public.is_pro_member(v)
  ), open_weddings as (
    select w.id, w.partner1, w.partner2, w.wedding_date, coalesce(w.region, b.region) as region,
           b.date_unknown, b.guests, b.budget, b.vibes, b.format, vw.vendor_note,
           (select pl.lat from public.merry_place(coalesce(w.region, b.region)) pl limit 1) as lat,
           (select pl.lng from public.merry_place(coalesce(w.region, b.region)) pl limit 1) as lng
    from public.vendor_wishes vw
    join public.weddings w on w.id = vw.wedding_id
    left join public.briefs b on b.id = w.brief_id
    where vw.open_to_vendors
  )
  select o.id, (u.wedding_id is not null),
         case when u.wedding_id is not null then trim(both ' &' from coalesce(o.partner1, '') || ' & ' || coalesce(o.partner2, '')) end,
         o.region, o.wedding_date, coalesce(o.date_unknown, false), o.guests, o.budget,
         round(2 * 6371 * asin(sqrt(power(sin(radians(o.lat - me.lat) / 2), 2) + cos(radians(me.lat)) * cos(radians(o.lat)) * power(sin(radians(o.lng - me.lng) / 2), 2))))::int,
         coalesce(o.vibes, '{}'), o.format,
         case when u.wedding_id is not null then o.vendor_note end
  from open_weddings o
  cross join me
  left join public.pro_unlocks u on u.vendor_id = v and u.wedding_id = o.id
  where o.lat is not null
    and 2 * 6371 * asin(sqrt(power(sin(radians(o.lat - me.lat) / 2), 2) + cos(radians(me.lat)) * cos(radians(o.lat)) * power(sin(radians(o.lng - me.lng) / 2), 2))) <= radius_km
    and not exists (select 1 from public.vendor_picks p where p.wedding_id = o.id and p.catalog_ref = 'catalog:' || v::text)
  order by 9;
$$;
revoke all on function public.pro_projects(uuid, integer) from public, anon;
grant execute on function public.pro_projects(uuid, integer) to authenticated;

-- Débloquer un projet : les crédits sont retirés une fois, le déblocage reste
create or replace function public.pro_unlock(v uuid, w uuid)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  cost integer := (select unlock_cost from public.pro_offer where id = 1);
  bal integer;
begin
  if not public.is_pro_member(v) then
    raise exception 'pas votre fiche' using errcode = '42501';
  end if;
  if cost is null then
    raise exception 'tarif du déblocage à définir (pro_offer.unlock_cost)' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.vendor_wishes where wedding_id = w and open_to_vendors) then
    raise exception 'projet fermé' using errcode = 'P0002';
  end if;
  if exists (select 1 from public.pro_unlocks where vendor_id = v and wedding_id = w) then
    return (select credits from public.pro_vendors where vendor_id = v);
  end if;
  update public.pro_vendors set credits = credits - cost where vendor_id = v and credits >= cost returning credits into bal;
  if bal is null then
    raise exception 'crédits insuffisants' using errcode = 'P0001';
  end if;
  insert into public.pro_unlocks (vendor_id, wedding_id, credits) values (v, w, cost);
  if cost > 0 then
    insert into public.pro_ledger (vendor_id, kind, label, delta, balance) values (v, 'utilisation', 'Projet de mariage débloqué', -cost, bal);
  end if;
  return bal;
end;
$$;
revoke all on function public.pro_unlock(uuid, uuid) from public, anon;
grant execute on function public.pro_unlock(uuid, uuid) to authenticated;

-- Envoyer une proposition à un projet débloqué : le prestataire arrive dans « Mes prestataires » du couple,
-- avec son message, et devient un client « Devis envoyé » de son côté
create or replace function public.pro_propose(v uuid, w uuid, body text)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  cv record;
  couple_vendor uuid;
  pick uuid;
  client uuid;
begin
  if not public.is_pro_member(v) then
    raise exception 'pas votre fiche' using errcode = '42501';
  end if;
  if not exists (select 1 from public.pro_unlocks where vendor_id = v and wedding_id = w) then
    raise exception 'projet à débloquer d''abord' using errcode = '42501';
  end if;
  -- Une proposition à la fois : pas deux envois au même couple en dix minutes
  if exists (select 1 from public.pro_unlocks where vendor_id = v and wedding_id = w and proposed_at > now() - interval '10 minutes') then
    raise exception 'proposition déjà envoyée, patientez quelques minutes' using errcode = '23505';
  end if;
  if length(trim(coalesce(body, ''))) = 0 or length(body) > 8000 then
    raise exception 'message vide ou trop long' using errcode = '22023';
  end if;
  select x.name, x.primary_category, x.city, x.region, x.phone, x.email, x.website, c.label as category_label
    into cv from catalog.vendors x left join catalog.categories c on c.slug = x.primary_category where x.id = v;
  -- La fiche du prestataire chez ce couple existe peut-être déjà (demande de devis, proposition précédente) :
  -- on la réutilise au lieu d'en créer une nouvelle à chaque envoi
  select p.vendor_id into couple_vendor from public.vendor_picks p
    where p.wedding_id = w and p.catalog_ref = 'catalog:' || v::text and p.vendor_id is not null;
  if couple_vendor is null then
    insert into public.vendors (wedding_id, name, category, phone, email, website)
      values (w, cv.name, coalesce(cv.category_label, 'Prestataire'), cv.phone, cv.email, cv.website)
      returning id into couple_vendor;
  end if;
  insert into public.vendor_messages (wedding_id, vendor_id, from_vendor, body) values (w, couple_vendor, true, trim(body));
  insert into public.vendor_picks (wedding_id, catalog_ref, category, data, checked, vendor_id)
    values (w, 'catalog:' || v::text,
            case when cv.primary_category in ('lieu', 'traiteur', 'dj', 'fleuriste', 'photographe') then cv.primary_category else 'autre' end,
            jsonb_build_object('name', cv.name, 'area', coalesce(cv.city, cv.region), 'catalogId', v),
            false, couple_vendor)
    on conflict (wedding_id, catalog_ref) do update set vendor_id = excluded.vendor_id
    returning id into pick;
  insert into public.pro_clients (vendor_id, pick_id, wedding_id, names, wedding_date, source, stage, next_action, next_action_on, answered_at)
    select v, pick, w, trim(both ' &' from coalesce(wd.partner1, '') || ' & ' || coalesce(wd.partner2, '')), wd.wedding_date,
           'merry', 'devis', 'Relancer', current_date + 3, now()
    from public.weddings wd where wd.id = w
    on conflict (pick_id) do update set stage = 'devis', answered_at = now()
    returning id into client;
  update public.pro_unlocks set proposed_at = now() where vendor_id = v and wedding_id = w;
  return client;
end;
$$;
revoke all on function public.pro_propose(uuid, uuid, text) from public, anon;
grant execute on function public.pro_propose(uuid, uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- I (suite). Les chiffres du mois sur l'accueil
-- ---------------------------------------------------------------------------

create or replace function public.pro_stats(v uuid)
returns table (views integer, picks integer, requests integer)
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select count(*)::int from public.pro_views x where x.vendor_id = v and x.viewed_at >= date_trunc('month', now())),
    (select count(*)::int from public.vendor_picks p where p.catalog_ref = 'catalog:' || v::text and p.created_at >= date_trunc('month', now())),
    (select count(*)::int from public.vendor_picks p where p.catalog_ref = 'catalog:' || v::text and p.requested_at >= date_trunc('month', now()))
  where public.is_pro_member(v);
$$;
revoke all on function public.pro_stats(uuid) from public, anon;
grant execute on function public.pro_stats(uuid) to authenticated;

-- ======================================================================
-- supabase/prestataires-notifier-couple.sql
-- ======================================================================
-- Donne à /api/prestataires/notifier-couple de quoi prévenir le couple par mail quand un
-- prestataire leur répond (pro_send), sans donner au prestataire un accès direct aux tables
-- du couple : weddings et wedding_members restent RLS-only côté couple, cette fonction est
-- security definer et ne renvoie que ce qu'il faut pour l'e-mail.
create or replace function public.pro_notify_couple_payload(c uuid)
returns table (to_email text, to_name text, couple text, vendor_name text)
language sql
stable
security definer
set search_path = ''
as $$
  select m.email, m.display_name,
         trim(both ' &' from coalesce(w.partner1, '') || ' & ' || coalesce(w.partner2, '')),
         v.name
  from public.pro_clients pc
  join public.vendor_picks p on p.id = pc.pick_id
  join public.weddings w on w.id = p.wedding_id
  join public.wedding_members m on m.wedding_id = w.id
  join catalog.vendors v on v.id = pc.vendor_id
  where pc.id = c
    and m.email is not null and m.email <> '';
$$;
-- Réservée au serveur (clé service_role) : un prestataire connecté ne doit pas pouvoir lire lui-même
-- l'adresse de chaque organisateur. La route vérifie d'abord que c'est bien sa fiche (is_pro_member).
revoke all on function public.pro_notify_couple_payload(uuid) from public, anon, authenticated;
grant execute on function public.pro_notify_couple_payload(uuid) to service_role;

-- ======================================================================
-- Positions des lieux, villes et régions : à recalculer après le changement de merry_norm
-- ======================================================================
do $$
begin
  if to_regclass('catalog.place_centers') is not null then
    refresh materialized view catalog.place_centers;
  end if;
end $$;
