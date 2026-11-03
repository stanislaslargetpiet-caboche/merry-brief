-- Collaborateurs de l'espace prestataire (demande de Stan le 3 nov. 2026 : « copier davantage ce
-- qu'il y a à l'espace couple », sur le modèle de wedding_members/Organisers.js). pro_members
-- existait déjà (comptes déjà liés) mais sans invitation en attente : on l'aligne sur
-- wedding_members (jeton d'invitation, user_id vide tant que l'invité n'a pas rejoint).
-- Rejoue sans risque ; à coller après espace-prestataire.sql.

alter table public.pro_members alter column user_id drop not null;
alter table public.pro_members add column if not exists display_name text;
alter table public.pro_members add column if not exists invite_token uuid not null default gen_random_uuid();
alter table public.pro_members add column if not exists invited_at timestamptz not null default now();
alter table public.pro_members add column if not exists joined_at timestamptz;
create unique index if not exists pro_members_token_idx on public.pro_members (invite_token);

-- Le premier membre (celui qui a revendiqué ou créé la fiche) est déjà rejoint
update public.pro_members set joined_at = coalesce(joined_at, created_at) where user_id is not null and joined_at is null;

alter table public.pro_members enable row level security;
drop policy if exists "prestataire: inviter" on public.pro_members;
create policy "prestataire: inviter" on public.pro_members for insert to authenticated with check (public.is_pro_member(vendor_id));
drop policy if exists "prestataire: retirer" on public.pro_members;
create policy "prestataire: retirer" on public.pro_members for delete to authenticated using (public.is_pro_member(vendor_id));

-- Ce qu'on montre avant de rejoindre : le nom de l'établissement, rien d'autre
create or replace function public.pro_invite_info(token uuid)
returns table (vendor_name text)
language sql
stable
security definer
set search_path = public
as $$
  select v.name
    from public.pro_members m
    join catalog.vendors v on v.id = m.vendor_id
   where m.invite_token = token and m.user_id is null and auth.uid() is not null;
$$;
revoke all on function public.pro_invite_info(uuid) from public, anon;
grant execute on function public.pro_invite_info(uuid) to authenticated;

-- Rejoindre l'équipe d'un établissement avec un jeton d'invitation ; renvoie le vendor_id
create or replace function public.pro_join(token uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  target public.pro_members%rowtype;
begin
  if me is null then
    raise exception 'Connexion requise';
  end if;
  select * into target from public.pro_members where invite_token = token;
  if not found then
    return null;
  end if;
  if exists (select 1 from public.pro_members where vendor_id = target.vendor_id and user_id = me) then
    return target.vendor_id;
  end if;
  if target.user_id is not null then
    return null; -- invitation déjà utilisée par quelqu'un d'autre
  end if;
  update public.pro_members
     set user_id = me, joined_at = now(), invite_token = gen_random_uuid()
   where id = target.id and user_id is null;
  if not found then
    return null;
  end if;
  return target.vendor_id;
end;
$$;
revoke all on function public.pro_join(uuid) from public, anon;
grant execute on function public.pro_join(uuid) to authenticated;

-- Nouveau jeton (si un lien a circulé par erreur)
create or replace function public.pro_renew_invite(member uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v uuid;
  t uuid := gen_random_uuid();
begin
  select vendor_id into v from public.pro_members where id = member and user_id is null;
  if v is null or not public.is_pro_member(v) then
    raise exception 'Invitation introuvable';
  end if;
  update public.pro_members set invite_token = t where id = member;
  return t;
end;
$$;
revoke all on function public.pro_renew_invite(uuid) from public, anon;
grant execute on function public.pro_renew_invite(uuid) to authenticated;
