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

alter table public.guest_forms enable row level security;

drop policy if exists "organisateurs: tout" on public.guest_forms;
create policy "organisateurs: tout" on public.guest_forms for all to authenticated
  using (public.is_wedding_member(wedding_id))
  with check (public.is_wedding_member(wedding_id));

-- Le compteur de réponses ne s'écrit que par merry_form_submit.
revoke insert, update on public.guest_forms from authenticated, anon;
grant insert (wedding_id, slug, published, fields, custom, event_ids, message, theme, cover_url, deadline, updated_at)
  on public.guest_forms to authenticated;
grant update (wedding_id, slug, published, fields, custom, event_ids, message, theme, cover_url, deadline, updated_at)
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
           'message', f.message,
           'theme', f.theme,
           'cover_url', f.cover_url,
           'deadline', f.deadline,
           'fields', f.fields,
           'custom', f.custom,
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
as $$
  select nullif(left(btrim(coalesce(v, '')), n), '');
$$;

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
begin
  select * into f from public.guest_forms where slug = form_slug and published;
  if not found then
    raise exception 'Formulaire introuvable';
  end if;
  w := f.wedding_id;
  if pg_column_size(payload) > 20000 then
    raise exception 'Réponse trop longue';
  end if;
  if (select count(*) from public.guests where wedding_id = w) >= 3000 then
    raise exception 'Liste complète';
  end if;

  for item in select * from jsonb_array_elements(f.fields) loop
    modes := modes || jsonb_build_object(item ->> 'key', coalesce(item ->> 'mode', 'off'));
    labels := labels || jsonb_build_object(item ->> 'key', coalesce(item ->> 'label', item ->> 'key'));
  end loop;

  v_first := public.merry_clip(payload ->> 'first_name', 80);
  v_last := public.merry_clip(payload ->> 'last_name', 80);
  if v_first is null or v_last is null then
    raise exception 'Prénom et nom obligatoires';
  end if;

  -- Questions sans colonne dédiée : enfants, hébergement, mot pour les mariés
  foreach val in array array['enfants', 'hebergement', 'mot'] loop
    if coalesce(modes ->> val, 'off') <> 'off' and public.merry_clip(payload ->> val, case when val = 'mot' then 2000 else 300 end) is not null then
      select id into field_id from public.guest_fields where wedding_id = w and lower(name) = lower(labels ->> val) limit 1;
      if field_id is null then
        insert into public.guest_fields (wedding_id, name, position)
        values (w, labels ->> val, coalesce((select max(position) + 1 from public.guest_fields where wedding_id = w), 0))
        returning id into field_id;
      end if;
      custom_out := custom_out || jsonb_build_object(field_id::text, public.merry_clip(payload ->> val, case when val = 'mot' then 2000 else 300 end));
      field_id := null;
    end if;
  end loop;

  -- Questions ajoutées par les organisateurs
  for item in select * from jsonb_array_elements(f.custom) loop
    val := public.merry_clip(payload -> 'custom' ->> (item ->> 'id'), 500);
    if val is not null then
      select id into field_id from public.guest_fields where wedding_id = w and lower(name) = lower(item ->> 'label') limit 1;
      if field_id is null then
        insert into public.guest_fields (wedding_id, name, position)
        values (w, left(item ->> 'label', 120), coalesce((select max(position) + 1 from public.guest_fields where wedding_id = w), 0))
        returning id into field_id;
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

  -- Invité principal : reconnu par son nom, sinon ajouté en fin de liste
  select id into main_id from public.guests
   where wedding_id = w and plus_one_of is null
     and lower(btrim(first_name)) = lower(v_first) and lower(btrim(last_name)) = lower(v_last)
   order by created_at limit 1;
  if main_id is null then
    is_new := true;
    select coalesce(max(position) + 1, 0) into pos from public.guests where wedding_id = w;
    insert into public.guests (wedding_id, first_name, last_name, position)
    values (w, v_first, v_last, pos) returning id into main_id;
  end if;
  update public.guests
     set email   = coalesce(public.merry_clip(payload ->> 'email', 200), email),
         phone   = case when coalesce(modes ->> 'tel', 'off') = 'off' then phone else coalesce(public.merry_clip(payload ->> 'phone', 40), phone) end,
         address = coalesce(addr, address),
         diet    = coalesce(diet_txt, diet),
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
  return jsonb_build_object('ok', true, 'known', not is_new);
end;
$$;
revoke all on function public.merry_form_submit(text, jsonb) from public;
grant execute on function public.merry_form_submit(text, jsonb) to anon, authenticated;
