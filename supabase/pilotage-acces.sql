-- Accès au pilotage (D-316, 14 nov. 2026) : une adresse qui se connecte à /pilotage sans y être autorisée y laisse
-- une demande ; Stan l'approuve ou la refuse dans Coulisses › Accès. PILOTAGE_EMAILS (Vercel) garde un accès permanent.
-- Lue et écrite par le serveur seulement (clé de service) : RLS sans policy, fermée à anon et authenticated.

create table if not exists public.pilotage_acces (
  email text primary key check (email = lower(email) and length(email) <= 160),
  statut text not null default 'en_attente' check (statut in ('en_attente', 'approuve', 'refuse')),
  demande_le timestamptz not null default now(),
  decide_le timestamptz,
  decide_par text
);

alter table public.pilotage_acces enable row level security;
revoke all on public.pilotage_acces from anon, authenticated;
grant all on public.pilotage_acces to service_role;
