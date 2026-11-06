-- Espace prestataire : les droits relevés par l'audit du 6 nov. 2026. Rejoue sans risque.
-- À coller après pro-demande-acces.sql, pro-collaborateurs.sql et pro-collaborateurs-noms.sql, et APRÈS le
-- déploiement du code de la même PR (l'écran n'écrit plus answered_at sur pro_clients).

-- 1. Une fiche en attente n'ouvre rien tant que la demande d'accès n'est pas validée. is_pro_member sert à
-- toutes les règles et fonctions : il exige désormais une fiche validée. is_pro_attached garde le simple
-- rattachement, pour les deux lectures de l'écran d'attente (la vérification et le nom de la fiche).
create or replace function public.is_pro_attached(v uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.pro_members m where m.vendor_id = v and m.user_id = auth.uid());
$$;
revoke all on function public.is_pro_attached(uuid) from public, anon;
grant execute on function public.is_pro_attached(uuid) to authenticated;

create or replace function public.is_pro_member(v uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.pro_members m
    join public.pro_vendors p on p.vendor_id = m.vendor_id
    where m.vendor_id = v and m.user_id = auth.uid() and p.verification = 'validee'
  );
$$;

drop policy if exists "prestataire: sa fiche" on public.pro_vendors;
create policy "prestataire: sa fiche" on public.pro_vendors for select to authenticated using (public.is_pro_attached(vendor_id));

create or replace function public.pro_fiche(v uuid)
returns setof catalog.vendors
language sql
stable
security definer
set search_path = ''
as $$
  select * from catalog.vendors where id = v and public.is_pro_attached(v);
$$;

-- 2. Collaborateurs : inviter et retirer étaient bloqués (le revoke de espace-prestataire.sql, rejoué par le
-- bundle du 5 nov., avait repris ces droits). Tout membre invite un collaborateur et annule une invitation ;
-- seul un gérant retire un compte déjà rejoint, et personne ne se retire soi-même : une fiche garde son gérant.
create or replace function public.is_pro_gerant(v uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_pro_member(v) and exists (select 1 from public.pro_members m where m.vendor_id = v and m.user_id = auth.uid() and m.role = 'gerant');
$$;
revoke all on function public.is_pro_gerant(uuid) from public, anon;
grant execute on function public.is_pro_gerant(uuid) to authenticated;

grant insert, delete on public.pro_members to authenticated;
revoke update on public.pro_members from authenticated, anon;
grant update (first_name, last_name, color, display_name) on public.pro_members to authenticated;

drop policy if exists "prestataire: inviter" on public.pro_members;
create policy "prestataire: inviter" on public.pro_members for insert to authenticated
  with check (public.is_pro_member(vendor_id) and user_id is null and joined_at is null and role = 'collaborateur');
drop policy if exists "prestataire: retirer" on public.pro_members;
create policy "prestataire: retirer" on public.pro_members for delete to authenticated
  using (public.is_pro_member(vendor_id) and (user_id is null or (user_id <> auth.uid() and public.is_pro_gerant(vendor_id))));
-- Doublon au nom mal encodé, laissé par un collage
drop policy if exists "prestataire: son √©quipe" on public.pro_members;

-- 3. pro_clients : answered_at décide du débit de la première réponse (pro_send), pick_id et wedding_id
-- désignent le fil du couple. Ils ne s'écrivent plus que par les fonctions.
revoke insert, update on public.pro_clients from authenticated, anon;
grant insert (id, vendor_id, names, wedding_date, date_label, guests, budget_label, source, stage, next_action, next_action_on, notes, email, phone, lost_reason, created_at, updated_at)
  on public.pro_clients to authenticated;
grant update (names, wedding_date, date_label, guests, budget_label, stage, next_action, next_action_on, notes, email, phone, lost_reason, updated_at)
  on public.pro_clients to authenticated;
