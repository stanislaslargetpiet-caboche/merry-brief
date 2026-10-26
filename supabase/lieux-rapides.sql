-- Merry · « Près de Bordeaux » en une fraction de seconde
-- À coller dans Supabase > SQL Editor > New query, puis Run, APRÈS prestataires.sql.
-- Le fichier peut être relancé sans risque : il ne supprime aucune donnée.
--
-- merry_place (prestataires.sql) traduit « Bordeaux », « Luberon », « (49) » en coordonnées en lisant
-- tout le catalogue (151 000 prestataires) à chaque appel : 30 s, au-delà du délai de 8 s de l'API.
-- La ville du couple n'avait alors plus de position et la page ne trouvait aucun lieu.
-- Ici, les positions moyennes (lieux, villes, départements, régions) sont calculées une fois dans
-- catalog.place_centers, et merry_place y lit une ligne.
-- Après un nouvel import du catalogue : refresh materialized view catalog.place_centers;

create materialized view if not exists catalog.place_centers as
  select 'lieu'::text as kind, public.merry_norm(v.name) as key, avg(v.lat) as lat, avg(v.lng) as lng, count(*)::int as n
    from catalog.vendors v where v.primary_category = 'lieu' and v.lat is not null and v.lng is not null group by 2
  union all
  select 'ville', public.merry_norm(v.city), avg(v.lat), avg(v.lng), count(*)::int
    from catalog.vendors v where v.city is not null and v.lat is not null and v.lng is not null group by 2
  union all
  select 'departement', upper(v.department), avg(v.lat), avg(v.lng), count(*)::int
    from catalog.vendors v where v.department is not null and v.lat is not null and v.lng is not null group by 2
  union all
  select 'region', public.merry_norm(v.region), avg(v.lat), avg(v.lng), count(*)::int
    from catalog.vendors v where v.region is not null and v.lat is not null and v.lng is not null group by 2;

create unique index if not exists place_centers_key_idx on catalog.place_centers (kind, key);

-- Positions moyennes seulement, lues par merry_place (security definer) : rien d'exposé par l'API
revoke all on catalog.place_centers from public, anon, authenticated;

create or replace function public.merry_place(q text)
returns table (lat double precision, lng double precision, matched text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
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
    return query select p.lat, p.lng, 'departement ' || dep from catalog.place_centers p where p.kind = 'departement' and p.key = dep;
    if found then return; end if;
  end if;

  parts := array(select public.merry_norm(x) from unnest(string_to_array(q, ',')) x where public.merry_norm(x) <> '');
  if array_length(parts, 1) > 1 then
    parts := parts || public.merry_norm(q);
  end if;

  foreach c in array parts loop
    -- Un lieu du catalogue, par son nom
    return query select p.lat, p.lng, 'lieu ' || c from catalog.place_centers p where p.kind = 'lieu' and p.key = c;
    if found then return; end if;

    -- Une ville
    return query select p.lat, p.lng, 'ville ' || c from catalog.place_centers p where p.kind = 'ville' and p.key = c;
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
      return query select p.lat, p.lng, 'departement ' || dep from catalog.place_centers p where p.kind = 'departement' and p.key = dep;
      if found then return; end if;
    end if;

    -- Une région (« Provence », « Bretagne », « Bourgogne »…), moyenne pondérée des régions qui la contiennent
    if length(c) >= 4 then
      return query
        select sum(p.lat * p.n) / sum(p.n), sum(p.lng * p.n) / sum(p.n), 'region ' || c from catalog.place_centers p
        where p.kind = 'region' and p.key like '%' || c || '%'
        having count(*) > 0;
      if found then return; end if;
    end if;
  end loop;
end;
$$;

revoke all on function public.merry_place(text) from public, anon;
grant execute on function public.merry_place(text) to authenticated;

refresh materialized view catalog.place_centers;
