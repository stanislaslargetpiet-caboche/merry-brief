-- Mails tirés des leçons Zola/Joy/Mariages.net (12 nov. 2026, D-305) : V57 (relance du couple, 3 jours
-- sans réponse à un prestataire) et la colonne guest_forms.shared_at qui sert V59 et V60 (formulaire
-- jamais partagé / formulaire publié). Rejoue sans risque ; à coller une fois dans Supabase.

-- V60/V59 : le moment où le couple a copié ou partagé le lien de son formulaire pour la première fois.
-- `published` reste à true dès la création de la ligne (lib/dash/form.js) ; ça ne dit pas si le lien a
-- déjà été envoyé à quelqu'un.
alter table public.guest_forms add column if not exists shared_at timestamptz;

-- V57 : le dernier message d'un fil (couple ↔ prestataire) vient du prestataire, reçu il y a 3 à 10
-- jours, et le couple n'y a toujours pas répondu. Symétrique de merry_job_demandes (qui relance le
-- prestataire quand c'est le couple qui attend).
create or replace function public.merry_job_demandes_couple()
returns table (wedding_id uuid, vendor_id uuid, vendor_name text, partner1 text, partner2 text, replied_at timestamptz, emails text[])
language sql
stable
security definer
set search_path = ''
as $$
  select m.wedding_id, m.vendor_id, v.name, w.partner1, w.partner2, max(m.sent_at),
         public.merry_job_wedding_emails(m.wedding_id)
  from public.vendor_messages m
  join public.vendors v on v.id = m.vendor_id
  join public.weddings w on w.id = m.wedding_id
  where m.from_vendor
    and m.sent_at between now() - interval '10 days' and now() - interval '3 days'
    and not exists (
      select 1 from public.vendor_messages r
      where r.wedding_id = m.wedding_id and r.vendor_id = m.vendor_id
        and not r.from_vendor and r.sent_at > m.sent_at)
  group by m.wedding_id, m.vendor_id, v.name, w.partner1, w.partner2;
$$;
revoke all on function public.merry_job_demandes_couple() from public, anon, authenticated;
grant execute on function public.merry_job_demandes_couple() to service_role;
