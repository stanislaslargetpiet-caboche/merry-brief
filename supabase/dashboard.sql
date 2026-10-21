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
  url             text not null,
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
revoke all on function public.is_wedding_member(uuid) from public;
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

-- Mariage : lecture et modification par ses organisateurs. La création passe par merry_bootstrap().
drop policy if exists "mariage: lecture" on public.weddings;
create policy "mariage: lecture" on public.weddings for select to authenticated
  using (public.is_wedding_member(id));
drop policy if exists "mariage: modification" on public.weddings;
create policy "mariage: modification" on public.weddings for update to authenticated
  using (public.is_wedding_member(id)) with check (public.is_wedding_member(id));

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
  using (public.is_wedding_member(wedding_id) and user_id is distinct from auth.uid());

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

-- Les organisateurs invités lisent aussi le brief du mariage.
drop policy if exists "brief: lecture par les organisateurs" on public.briefs;
create policy "brief: lecture par les organisateurs" on public.briefs for select to authenticated
  using (exists (select 1 from public.weddings w where w.brief_id = briefs.id and public.is_wedding_member(w.id)));

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
   where id = target.id;
  return target.wedding_id;
end;
$$;
revoke all on function public.merry_join(uuid) from public;
grant execute on function public.merry_join(uuid) to authenticated;

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
revoke all on function public.merry_renew_invite(uuid) from public;
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

  -- Rétroplanning type, calé sur la date du mariage
  i := 0;
  for rec in
    select * from (values
      ('Fixer le budget', 'wallet', 365, false), ('Réserver le lieu', 'lieu', 330, false),
      ('Choisir le traiteur', 'traiteur', 300, false), ('Réserver le photographe', 'photo', 300, false),
      ('Choisir le DJ', 'musique', 270, false), ('Bloquer des chambres près du lieu', 'lit', 240, false),
      ('Envoyer les save-the-date', 'enveloppe', 240, false), ('Choisir le fleuriste', 'fleurs', 180, false),
      ('Premiers essayages', 'tenues', 150, false), ('Commander les faire-part', 'enveloppe', 120, false),
      ('Choisir les alliances', 'alliances', 120, false), ('Réserver le brunch du dimanche', 'traiteur', 90, true),
      ('Déposer le dossier à la mairie', 'mairie', 60, false), ('Essai coiffure et maquillage', 'beaute', 60, false),
      ('Relancer les invités sans réponse', 'users', 45, false), ('Faire le plan de table', 'table', 30, false),
      ('Liste des photos de groupe', 'photo', 30, false), ('Envoyer le déroulé aux prestataires', 'horloge', 10, false)
    ) as v(title, icon, days_before, weekend_only)
  loop
    if rec.weekend_only and not weekend then
      continue;
    end if;
    -- Ce que le brief dit déjà fait est coché ; les tâches en retard sont étalées
    -- sur les semaines qui viennent plutôt qu'empilées le même jour.
    insert into public.tasks (wedding_id, title, icon, due_date, done, done_at, assignees, position)
    values (w, rec.title, rec.icon,
            case when d is null then null
                 when d - rec.days_before >= current_date + 14 then d - rec.days_before
                 else least(d, current_date + 14 + i * 3) end,
            coalesce((rec.title = 'Réserver le lieu' and b.stage in ('lieu_reserve', 'details'))
                     or (rec.title = 'Fixer le budget' and total is not null), false),
            case when coalesce((rec.title = 'Réserver le lieu' and b.stage in ('lieu_reserve', 'details'))
                            or (rec.title = 'Fixer le budget' and total is not null), false) then now() end,
            array_remove(array[m1, m2], null), i);
    i := i + 1;
  end loop;

  return w;
end;
$$;
revoke all on function public.merry_bootstrap() from public;
grant execute on function public.merry_bootstrap() to authenticated;
