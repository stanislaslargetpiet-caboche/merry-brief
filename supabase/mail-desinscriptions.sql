-- Désinscriptions des mails de notification, par adresse et par type de mail : réglages du couple et
-- du prestataire, lien « Se désinscrire » des mails. Les mails indispensables (codes de connexion,
-- mot de passe, invitations) ne passent pas par cette table.
create table if not exists public.mail_optouts (
  email       text not null check (email = lower(email)),
  kind        text not null check (kind in ('couple_reply', 'new_member', 'vendor_message')),
  created_at  timestamptz not null default now(),
  primary key (email, kind)
);
-- Aucune politique : lecture et écriture passent par les fonctions ci-dessous ou par le serveur
alter table public.mail_optouts enable row level security;

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
