-- Merry · Prestataires : commentaires des organisateurs, et critères du brief modifiables par tous
-- À coller dans Supabase > SQL Editor > New query, puis Run, APRÈS dashboard.sql et prestataires.sql.
-- Le fichier peut être relancé sans risque : il ne supprime aucune donnée.
--
-- A. vendor_comments : un fil par prestataire (Mes prestataires, fiche du prestataire), avec réponses,
--    comme les commentaires des tâches du rétroplanning
-- B. merry_save_brief : la boîte « Vos critères » modifie les réponses du brief (invités, budget, style) ;
--    sans cette fonction, seul l'organisateur qui a rempli le brief peut les changer

-- ---------------------------------------------------------------------------
-- A. Commentaires sur les prestataires
-- ---------------------------------------------------------------------------

create table if not exists public.vendor_comments (
  id          uuid primary key default gen_random_uuid(),
  wedding_id  uuid not null references public.weddings (id) on delete cascade,
  vendor_ref  text not null check (length(vendor_ref) between 1 and 120),   -- « catalog:<id> » ou « exemple:<nom> », comme vendor_picks.catalog_ref
  parent_id   uuid,                                                          -- réponse à un commentaire
  author_id   uuid,                                                          -- wedding_members.id
  body        text not null check (char_length(btrim(body)) between 1 and 2000),
  created_at  timestamptz not null default now(),
  unique (wedding_id, id),
  foreign key (wedding_id, parent_id) references public.vendor_comments (wedding_id, id) on delete cascade,
  foreign key (wedding_id, author_id) references public.wedding_members (wedding_id, id) on delete set null (author_id)
);
create index if not exists vendor_comments_wedding_idx on public.vendor_comments (wedding_id, vendor_ref);

alter table public.vendor_comments enable row level security;
revoke all on public.vendor_comments from anon;
revoke update on public.vendor_comments from authenticated;
grant select, insert, delete on public.vendor_comments to authenticated;

drop policy if exists "commentaires prestataires: lecture" on public.vendor_comments;
create policy "commentaires prestataires: lecture" on public.vendor_comments for select to authenticated
  using (public.is_wedding_member(wedding_id));

drop policy if exists "commentaires prestataires: écrire en son nom" on public.vendor_comments;
create policy "commentaires prestataires: écrire en son nom" on public.vendor_comments for insert to authenticated
  with check (
    public.is_wedding_member(wedding_id)
    and author_id = (select m.id from public.wedding_members m
                     where m.wedding_id = vendor_comments.wedding_id and m.user_id = auth.uid())
  );

drop policy if exists "commentaires prestataires: supprimer les siens" on public.vendor_comments;
create policy "commentaires prestataires: supprimer les siens" on public.vendor_comments for delete to authenticated
  using (author_id in (select m.id from public.wedding_members m where m.user_id = auth.uid()));

-- ---------------------------------------------------------------------------
-- B. Critères du brief : invités, budget, style (et la région du brief)
-- ---------------------------------------------------------------------------

create or replace function public.merry_save_brief(w uuid, patch jsonb)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  b uuid := (select brief_id from public.weddings where id = w);
begin
  if not public.is_wedding_member(w) then
    raise exception 'pas votre mariage' using errcode = '42501';
  end if;
  if b is null then
    raise exception 'ce mariage n''a pas de brief' using errcode = 'P0002';
  end if;
  update public.briefs set
    guests = case when patch ? 'guests' and patch ->> 'guests' in ('<50', '50-100', '100-150', '150-200', '>200') then patch ->> 'guests' else guests end,
    budget = case when patch ? 'budget' and patch ->> 'budget' in ('<15k', '15-30k', '30-50k', '>50k', 'aucune_idee') then patch ->> 'budget' else budget end,
    vibes  = case when patch ? 'vibes' and jsonb_typeof(patch -> 'vibes') = 'array'
                  then array(select left(x, 60) from jsonb_array_elements_text(patch -> 'vibes') x limit 6) else vibes end,
    region = case when patch ? 'region' then nullif(left(patch ->> 'region', 200), '') else region end
  where id = b;
end;
$$;
revoke all on function public.merry_save_brief(uuid, jsonb) from public, anon;
grant execute on function public.merry_save_brief(uuid, jsonb) to authenticated;
