-- Demande d'accès à une fiche prestataire (décision de Stan le 5 nov. 2026) : plus de code par mail ni par
-- SMS. Le prestataire confirme les coordonnées de la fiche (ou donne les bonnes), crée son compte avec un
-- téléphone, et sa demande attend une vérification à la main (mail ou rappel) dans l'heure.
--
-- pro_vendors.verification : 'validee' (toutes les fiches déjà gérées le sont, d'où le défaut) ou
-- 'en_attente' (fiche prise par une demande pas encore vérifiée : 0 crédit, donc aucune réponse payante
-- possible, tant que Stan n'a pas validé ; les crédits de bienvenue sont versés à la validation).
-- pro_claims : une ligne par demande, avec les coordonnées d'origine de la fiche et ce que le prestataire
-- a répondu ou saisi. Seule la clé service_role lit et écrit (route /api/pro/claim, action « request », et
-- /api/interne/pilotage/demandes). Rejoue sans risque ; à coller après espace-prestataire.sql.

alter table public.pro_vendors
  add column if not exists verification text not null default 'validee' check (verification in ('en_attente', 'validee')),
  add column if not exists verified_at  timestamptz;

create table if not exists public.pro_claims (
  id             uuid primary key default gen_random_uuid(),
  vendor_id      uuid not null references catalog.vendors (id) on delete cascade,
  user_id        uuid not null references auth.users (id) on delete cascade,
  status         text not null default 'en_attente' check (status in ('en_attente', 'validee', 'refusee')),
  account_email  text not null,
  account_phone  text not null,
  fiche_email    text,                                        -- coordonnées d'origine de la fiche, au moment de la demande
  fiche_phone    text,
  email_choice   text check (email_choice in ('oui', 'non')), -- null : la fiche n'avait pas d'adresse
  email_given    text,                                        -- l'adresse saisie quand la fiche n'est pas la bonne ou n'en avait pas
  phone_choice   text check (phone_choice in ('oui', 'non')),
  phone_given    text,
  created_at     timestamptz not null default now(),
  decided_at     timestamptz,
  decided_by     text
);

create index if not exists pro_claims_status_idx on public.pro_claims (status, created_at);
create index if not exists pro_claims_vendor_idx on public.pro_claims (vendor_id);

alter table public.pro_claims enable row level security;
revoke all on public.pro_claims from public, anon, authenticated;
