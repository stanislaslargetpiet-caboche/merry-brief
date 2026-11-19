-- Relances des prestataires à T+5 h puis T+24 h (D-371), lues chaque heure par /api/interne/relances-prestataires.
-- Demandes envoyées il y a 5 à 48 h, sans aucun message du prestataire au couple. Rejoue sans risque.

create or replace function public.merry_job_demandes_heures()
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
  where p.requested_at between now() - interval '48 hours' and now() - interval '5 hours'
    and p.catalog_ref ~ '^catalog:[0-9a-f-]{36}$'
    and not exists (
      select 1 from public.vendor_messages m
      where m.wedding_id = p.wedding_id and m.vendor_id = p.vendor_id and m.from_vendor);
$$;

revoke all on function public.merry_job_demandes_heures() from public, anon, authenticated;
grant execute on function public.merry_job_demandes_heures() to service_role;
