-- Réglages ajoutés à la page Tarifs (fusionnée avec Disponibilités, demande de Stan le 3 nov. 2026) :
-- réductions à la semaine/au mois, durée de séjour et délai de réservation, politique d'annulation.
-- Rejoue sans risque (add column if not exists) ; à coller après espace-prestataire.sql.

alter table public.pro_vendors add column if not exists discount_week_pct smallint check (discount_week_pct is null or discount_week_pct between 0 and 90);
alter table public.pro_vendors add column if not exists discount_month_pct smallint check (discount_month_pct is null or discount_month_pct between 0 and 90);
alter table public.pro_vendors add column if not exists min_nights smallint check (min_nights is null or min_nights >= 1);
alter table public.pro_vendors add column if not exists max_nights smallint check (max_nights is null or max_nights >= 1);
alter table public.pro_vendors add column if not exists booking_lead_days smallint not null default 2 check (booking_lead_days >= 0);
alter table public.pro_vendors add column if not exists cancellation_policy text not null default 'flexible' check (cancellation_policy in ('flexible', 'moderee', 'stricte'));
