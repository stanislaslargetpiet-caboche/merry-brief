-- Pilotage : indicateurs internes de Merry, lus par /api/interne/pilotage (page /pilotage, réservée à Stan).
-- Une seule fonction, réservée au service_role (jamais appelée depuis le navigateur), qui renvoie en un
-- appel les compteurs et les séries par jour dont la page a besoin. Relançable sans risque.
-- Supabase > SQL Editor > New query, colle ce fichier, Run (après mails-planifies.sql).
--
-- pilotage_stats(days) couvre une période de `days` jours et la période précédente de même longueur :
-- les séries par jour s'étendent sur 2 × days jours, la page en déduit la période courante et la précédente.

create or replace function public.pilotage_stats(days integer default 7)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  d integer := greatest(1, least(coalesce(days, 7), 90));
  since timestamptz := date_trunc('day', now() at time zone 'Europe/Paris') at time zone 'Europe/Paris' - make_interval(days => 2 * d - 1);
  cur timestamptz := date_trunc('day', now() at time zone 'Europe/Paris') at time zone 'Europe/Paris' - make_interval(days => d - 1);
  out jsonb;
begin
  with
  jours as (
    select generate_series((since at time zone 'Europe/Paris')::date, (now() at time zone 'Europe/Paris')::date, interval '1 day')::date as jour
  ),
  inscriptions as (
    select (created_at at time zone 'Europe/Paris')::date as jour, count(*)::int as n
    from auth.users where created_at >= since group by 1
  ),
  mariages as (
    select (created_at at time zone 'Europe/Paris')::date as jour, count(*)::int as n
    from public.weddings where created_at >= since group by 1
  ),
  demandes as (
    select (created_at at time zone 'Europe/Paris')::date as jour, count(*)::int as n
    from public.quote_requests where created_at >= since group by 1
  ),
  messages as (
    select (sent_at at time zone 'Europe/Paris')::date as jour,
           count(*) filter (where from_vendor)::int as pro,
           count(*) filter (where not from_vendor)::int as couple
    from public.vendor_messages where sent_at >= since group by 1
  ),
  reponses as (
    select (created_at at time zone 'Europe/Paris')::date as jour, count(*)::int as n
    from public.guest_response_log where created_at >= since group by 1
  ),
  visites_sites as (
    select (visited_at at time zone 'Europe/Paris')::date as jour, count(*)::int as n
    from public.site_visits where visited_at >= since group by 1
  ),
  vues_pro as (
    select (viewed_at at time zone 'Europe/Paris')::date as jour, count(*)::int as n
    from public.pro_views where viewed_at >= since group by 1
  ),
  ia as (
    select day as jour, sum(calls)::int as n from public.ai_usage where day >= (since at time zone 'Europe/Paris')::date group by 1
  ),
  mails as (
    select (sent_at at time zone 'Europe/Paris')::date as jour, count(*)::int as n
    from public.mail_sent where sent_at >= since group by 1
  ),
  series as (
    select jsonb_agg(jsonb_build_object(
      'jour', j.jour,
      'inscriptions', coalesce(i.n, 0),
      'mariages', coalesce(m.n, 0),
      'demandes', coalesce(q.n, 0),
      'messages_pro', coalesce(ms.pro, 0),
      'messages_couple', coalesce(ms.couple, 0),
      'reponses_rsvp', coalesce(r.n, 0),
      'visites_sites', coalesce(v.n, 0),
      'vues_pro', coalesce(vp.n, 0),
      'appels_ia', coalesce(a.n, 0),
      'mails_planifies', coalesce(ml.n, 0)
    ) order by j.jour) as rows
    from jours j
    left join inscriptions i on i.jour = j.jour
    left join mariages m on m.jour = j.jour
    left join demandes q on q.jour = j.jour
    left join messages ms on ms.jour = j.jour
    left join reponses r on r.jour = j.jour
    left join visites_sites v on v.jour = j.jour
    left join vues_pro vp on vp.jour = j.jour
    left join ia a on a.jour = j.jour
    left join mails ml on ml.jour = j.jour
  ),
  catalogue as (
    select jsonb_agg(jsonb_build_object(
      'categorie', c.slug, 'label', c.label,
      'actifs', coalesce(s.actifs, 0), 'candidats', coalesce(s.candidats, 0),
      'photos3', coalesce(s.photos3, 0), 'sans_photo', coalesce(s.sans_photo, 0),
      'email', coalesce(s.email, 0), 'telephone', coalesce(s.telephone, 0),
      'revendiques', coalesce(s.revendiques, 0)
    ) order by coalesce(s.actifs, 0) desc) as rows
    from catalog.categories c
    left join (
      select v.primary_category,
             count(*) filter (where v.status = 'active')::int as actifs,
             count(*) filter (where v.status = 'candidate')::int as candidats,
             count(*) filter (where v.status = 'active' and coalesce(v.photos_count, 0) >= 3)::int as photos3,
             count(*) filter (where v.status = 'active' and coalesce(v.photos_count, 0) = 0)::int as sans_photo,
             count(*) filter (where v.status = 'active' and nullif(v.email, '') is not null)::int as email,
             count(*) filter (where v.status = 'active' and nullif(v.phone, '') is not null)::int as telephone,
             count(*) filter (where v.status = 'active' and p.vendor_id is not null)::int as revendiques
      from catalog.vendors v
      left join public.pro_vendors p on p.vendor_id = v.id
      group by v.primary_category
    ) s on s.primary_category = c.slug
  ),
  derniers_comptes as (
    select jsonb_agg(jsonb_build_object('email', u.email, 'cree', u.created_at, 'derniere_connexion', u.last_sign_in_at,
                                        'mariage', w.partner1 is not null, 'prenoms', nullif(concat_ws(' et ', w.partner1, w.partner2), ''))
                     order by u.created_at desc) as rows
    from (select * from auth.users order by created_at desc limit 12) u
    left join lateral (
      select w.partner1, w.partner2 from public.wedding_members wm join public.weddings w on w.id = wm.wedding_id
      where wm.user_id = u.id order by wm.created_at limit 1
    ) w on true
  ),
  dernieres_demandes as (
    select jsonb_agg(jsonb_build_object('quand', q.created_at, 'couple', nullif(concat_ws(' et ', w.partner1, w.partner2), ''),
                                        'prestataire', coalesce(v.name, 'Prestataire'), 'categorie', v.category)
                     order by q.created_at desc) as rows
    from (select * from public.quote_requests order by created_at desc limit 10) q
    left join public.weddings w on w.id = q.wedding_id
    left join lateral (
      select vd.name, vd.category from public.vendor_picks vp join public.vendors vd on vd.id = vp.vendor_id
      where vp.request_id = q.id limit 1
    ) v on true
  ),
  fiches_pro as (
    select jsonb_agg(jsonb_build_object('nom', cv.name, 'categorie', cv.primary_category, 'revendiquee', p.claimed_at,
                                        'credits', p.credits, 'membres', (select count(*) from public.pro_members m where m.vendor_id = p.vendor_id),
                                        'clients', (select count(*) from public.pro_clients c where c.vendor_id = p.vendor_id),
                                        'vues', (select count(*) from public.pro_views pv where pv.vendor_id = p.vendor_id and pv.viewed_at >= cur))
                     order by p.claimed_at desc nulls last) as rows
    from public.pro_vendors p left join catalog.vendors cv on cv.id = p.vendor_id
  )
  select jsonb_build_object(
    'genere', now(),
    'jours', d,
    'depuis', since,
    'periode_courante', cur,
    'totaux', jsonb_build_object(
      'comptes', (select count(*) from auth.users),
      'comptes_actifs', (select count(*) from auth.users where last_sign_in_at >= cur),
      'comptes_actifs_prec', (select count(*) from auth.users where last_sign_in_at >= since and last_sign_in_at < cur),
      'comptes_jamais_connectes', (select count(*) from auth.users where last_sign_in_at is null),
      'mariages', (select count(*) from public.weddings),
      'mariages_avec_date', (select count(*) from public.weddings where wedding_date is not null),
      'organisateurs', (select count(*) from public.wedding_members where user_id is not null),
      'organisateurs_invites_en_attente', (select count(*) from public.wedding_members where user_id is null and invited_at is not null),
      'briefs', (select count(*) from public.briefs),
      'invites', (select count(*) from public.guests),
      'mariages_avec_invites', (select count(distinct wedding_id) from public.guests),
      'taches', (select count(*) from public.tasks),
      'taches_faites', (select count(*) from public.tasks where done),
      'lignes_budget', (select count(*) from public.budget_items),
      'documents', (select count(*) from public.documents),
      'pense_bete', (select count(*) from public.pense_bete_items),
      'formulaires_publies', (select count(*) from public.guest_forms where published),
      'reponses_formulaires', (select coalesce(sum(submissions), 0) from public.guest_forms),
      'sites_publies', (select count(*) from public.wedding_sites where published),
      'sites_total', (select count(*) from public.wedding_sites),
      'selections_prestataires', (select count(*) from public.vendor_picks),
      'mariages_avec_selection', (select count(distinct wedding_id) from public.vendor_picks),
      'demandes_devis', (select count(*) from public.quote_requests),
      'messages', (select count(*) from public.vendor_messages),
      'commentaires_prestataires', (select count(*) from public.vendor_comments),
      'catalogue_actifs', (select count(*) from catalog.vendors where status = 'active'),
      'catalogue_candidats', (select count(*) from catalog.vendors where status = 'candidate'),
      'catalogue_fermes', (select count(*) from catalog.vendors where status = 'closed'),
      'catalogue_photos3', (select count(*) from catalog.vendors where status = 'active' and coalesce(photos_count, 0) >= 3),
      'catalogue_sans_photo', (select count(*) from catalog.vendors where status = 'active' and coalesce(photos_count, 0) = 0),
      'catalogue_email', (select count(*) from catalog.vendors where status = 'active' and nullif(email, '') is not null),
      'catalogue_telephone', (select count(*) from catalog.vendors where status = 'active' and nullif(phone, '') is not null),
      'catalogue_ajoutes_par_couples', (select count(*) from catalog.vendors where created_by_wedding is not null),
      'fiches_revendiquees', (select count(*) from public.pro_vendors),
      'fiches_revendiquees_periode', (select count(*) from public.pro_vendors where claimed_at >= cur),
      'comptes_pro', (select count(*) from public.pro_members where user_id is not null),
      'credits_en_circulation', (select coalesce(sum(credits), 0) from public.pro_vendors),
      'credits_depenses', (select coalesce(-sum(delta), 0) from public.pro_ledger where kind = 'utilisation'),
      'credits_depenses_periode', (select coalesce(-sum(delta), 0) from public.pro_ledger where kind = 'utilisation' and at >= cur),
      'clients_pro', (select count(*) from public.pro_clients),
      'clients_pro_repondus', (select count(*) from public.pro_clients where answered_at is not null),
      'desinscriptions_mail', (select count(*) from public.mail_optouts),
      'mails_planifies', (select count(*) from public.mail_sent)
    ),
    'series', (select rows from series),
    'catalogue', (select rows from catalogue),
    'derniers_comptes', coalesce((select rows from derniers_comptes), '[]'::jsonb),
    'dernieres_demandes', coalesce((select rows from dernieres_demandes), '[]'::jsonb),
    'fiches_pro', coalesce((select rows from fiches_pro), '[]'::jsonb)
  ) into out;
  return out;
end;
$$;
revoke all on function public.pilotage_stats(integer) from public, anon, authenticated;
grant execute on function public.pilotage_stats(integer) to service_role;
