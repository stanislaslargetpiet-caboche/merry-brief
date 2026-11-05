-- Ma fiche > Présentation : le mail de contact de la fiche se vérifie par un code à 6 chiffres
-- (demande de Stan le 5 nov. 2026, app/api/pro/contact). pro_vendors.email_verified garde l'adresse
-- qui a été prouvée : dès que le prestataire en saisit une autre, la fiche repasse à « non vérifié »
-- sans rien remettre à zéro. Seule la clé service_role écrit ces colonnes et lit les codes.
-- Rejoue sans risque ; à coller après espace-prestataire.sql.

alter table public.pro_vendors
  add column if not exists email_verified    text,
  add column if not exists email_verified_at timestamptz;

create table if not exists public.pro_contact_codes (
  vendor_id   uuid primary key references public.pro_vendors (vendor_id) on delete cascade,
  email       text not null,
  code_hash   text not null,
  attempts    integer not null default 0,
  expires_at  timestamptz not null,
  created_at  timestamptz not null default now()
);
alter table public.pro_contact_codes enable row level security;
revoke all on public.pro_contact_codes from public, anon, authenticated;
