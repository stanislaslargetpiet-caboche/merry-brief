-- Invitations prestataires (audit du 6 nov. 2026) : le jeton ne suffit plus pour rejoindre une équipe.
-- pro_join exige que le compte connecté ait l'adresse invitée et refuse une invitation de plus de
-- 14 jours ; pro_renew_invite remet le compteur à zéro. Rejoue sans risque ; à coller après
-- pro-collaborateurs.sql. Aligné sur app/api/pro/invitation/route.js.

create or replace function public.pro_join(token uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  my_email text := lower(trim(coalesce(auth.jwt() ->> 'email', '')));
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
  if target.invited_at < now() - interval '14 days' then
    return null; -- invitation expirée
  end if;
  if my_email = '' or lower(trim(coalesce(target.email, ''))) <> my_email then
    return null; -- invitation adressée à un autre compte
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
  update public.pro_members set invite_token = t, invited_at = now() where id = member;
  return t;
end;
$$;
revoke all on function public.pro_renew_invite(uuid) from public, anon;
grant execute on function public.pro_renew_invite(uuid) to authenticated;
