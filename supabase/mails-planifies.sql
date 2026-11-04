-- Relances et résumés envoyés chaque jour par /api/interne/relances, et prestataire joignable
-- (Messagerie). Rejoue sans risque. À coller après mail-desinscriptions.sql, ou à la place : ce fichier
-- crée aussi la table mail_optouts si elle manque.

create table if not exists public.mail_optouts (
  email       text not null check (email = lower(email)),
  kind        text not null,
  created_at  timestamptz not null default now(),
  primary key (email, kind)
);
alter table public.mail_optouts enable row level security;
alter table public.mail_optouts drop constraint if exists mail_optouts_kind_check;
alter table public.mail_optouts add constraint mail_optouts_kind_check
  check (kind in ('couple_reply', 'new_member', 'form_reply', 'vendor_message', 'vendor_account'));

create or replace function public.merry_mail_optouts()
returns setof text
language sql
stable
security definer
set search_path = ''
as $$
  select o.kind
  from public.mail_optouts o
  join auth.users u on lower(u.email) = o.email
  where u.id = auth.uid();
$$;
revoke all on function public.merry_mail_optouts() from public, anon;
grant execute on function public.merry_mail_optouts() to authenticated;

create or replace function public.merry_set_mail_optout(k text, opted_out boolean)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  mail text;
begin
  select lower(u.email) into mail from auth.users u where u.id = auth.uid();
  if mail is null then
    raise exception 'Connexion requise' using errcode = '42501';
  end if;
  if opted_out then
    insert into public.mail_optouts (email, kind) values (mail, k) on conflict do nothing;
  else
    delete from public.mail_optouts where email = mail and kind = k;
  end if;
end;
$$;
revoke all on function public.merry_set_mail_optout(text, boolean) from public, anon;
grant execute on function public.merry_set_mail_optout(text, boolean) to authenticated;

-- Ce qui est déjà parti : une relance n'est jamais envoyée deux fois
create table if not exists public.mail_sent (
  key      text primary key,
  sent_at  timestamptz not null default now()
);
alter table public.mail_sent enable row level security;

-- Messagerie : le prestataire sera-t-il prévenu ? (adresse sur la fiche, ou compte qui la gère)
create or replace function public.merry_vendor_reachable(v uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(nullif(trim(x.email), ''), '') <> ''
      or exists (
        select 1 from public.vendor_picks p
        join public.pro_members m on 'catalog:' || m.vendor_id::text = p.catalog_ref
        where p.vendor_id = x.id)
  from public.vendors x
  where x.id = v and public.is_wedding_member(x.wedding_id);
$$;
revoke all on function public.merry_vendor_reachable(uuid) from public, anon;
grant execute on function public.merry_vendor_reachable(uuid) to authenticated;

-- V31 : demandes restées sans réponse depuis 2 jours (au plus 7, pour ne pas relancer l'historique)
create or replace function public.merry_job_demandes()
returns table (pick_id uuid, catalog_id uuid, vendor_email text, partner1 text, partner2 text, requested_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, substring(p.catalog_ref from 9)::uuid, v.email, w.partner1, w.partner2, p.requested_at
  from public.vendor_picks p
  join public.vendors v on v.id = p.vendor_id
  join public.weddings w on w.id = p.wedding_id
  where p.requested_at between now() - interval '7 days' and now() - interval '2 days'
    and p.catalog_ref ~ '^catalog:[0-9a-f-]{36}$'
    and not exists (
      select 1 from public.vendor_messages m
      where m.wedding_id = p.wedding_id and m.vendor_id = p.vendor_id and m.from_vendor);
$$;

-- Adresses des comptes qui gèrent une fiche, regroupées
create or replace function public.merry_job_vendor_emails(v uuid)
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(distinct coalesce(nullif(m.email, ''), u.email)::text), '{}')
  from public.pro_members m
  join auth.users u on u.id = m.user_id
  where m.vendor_id = v;
$$;

-- V32 : options qui expirent dans les 2 jours
create or replace function public.merry_job_options()
returns table (date_id uuid, vendor_id uuid, day date, expires_on date, names text, emails text[])
language sql
stable
security definer
set search_path = ''
as $$
  select d.id, d.vendor_id, d.day, d.expires_on, coalesce(nullif(pc.names, ''), d.label), public.merry_job_vendor_emails(d.vendor_id)
  from public.pro_dates d
  left join public.pro_clients pc on pc.id = d.client_id
  where d.status = 'option' and d.expires_on between current_date and current_date + 2;
$$;

-- Une option arrivée à son terme libère la date
create or replace function public.merry_job_release_options()
returns integer
language sql
volatile
security definer
set search_path = ''
as $$
  with gone as (
    delete from public.pro_dates where status = 'option' and expires_on < current_date returning 1
  )
  select count(*)::integer from gone;
$$;

-- V33 : plus assez de crédits pour répondre à une demande
create or replace function public.merry_job_credits()
returns table (vendor_id uuid, credits integer, cost integer, emails text[])
language sql
stable
security definer
set search_path = ''
as $$
  select pv.vendor_id, pv.credits, public.pro_reply_cost(v.primary_category), public.merry_job_vendor_emails(pv.vendor_id)
  from public.pro_vendors pv
  join catalog.vendors v on v.id = pv.vendor_id
  where pv.credits < public.pro_reply_cost(v.primary_category);
$$;

-- V34 : réponses reçues par le formulaire depuis 24 h, une ligne par invité
create or replace function public.merry_job_formulaire()
returns table (wedding_id uuid, first_name text, last_name text, comes boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select l.wedding_id, g.first_name, g.last_name, bool_or(l.status = 'oui')
  from public.guest_response_log l
  join public.guests g on g.id = l.guest_id
  where l.source = 'formulaire' and l.created_at > now() - interval '24 hours' and l.status in ('oui', 'non')
  group by l.wedding_id, g.id, g.first_name, g.last_name;
$$;

-- Adresses des organisateurs inscrits d'un mariage
create or replace function public.merry_job_wedding_emails(w uuid)
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(distinct coalesce(nullif(m.email, ''), u.email)::text), '{}')
  from public.wedding_members m
  join auth.users u on u.id = m.user_id
  where m.wedding_id = w;
$$;

-- V35 : invitations envoyées il y a 3 à 10 jours, jamais acceptées
create or replace function public.merry_job_invitations()
returns table (member_id uuid, email text, invite_token uuid, partner1 text, partner2 text)
language sql
stable
security definer
set search_path = ''
as $$
  select m.id, m.email, m.invite_token, w.partner1, w.partner2
  from public.wedding_members m
  join public.weddings w on w.id = m.wedding_id
  where m.user_id is null
    and m.email is not null and m.email <> ''
    and m.invited_at between now() - interval '10 days' and now() - interval '3 days';
$$;

-- Réservées au serveur (clé service_role)
do $$
declare
  f text;
begin
  foreach f in array array[
    'merry_job_demandes()', 'merry_job_vendor_emails(uuid)', 'merry_job_options()', 'merry_job_release_options()',
    'merry_job_credits()', 'merry_job_formulaire()', 'merry_job_wedding_emails(uuid)', 'merry_job_invitations()'
  ] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to service_role', f);
  end loop;
end;
$$;
