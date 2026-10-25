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
