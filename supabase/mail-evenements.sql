-- Suivi des mails : un événement Resend par ligne (envoyé, délivré, ouvert, cliqué, rebond, plainte), reçu par
-- le webhook /api/interne/resend. Rejoue sans risque. Aucun autre code ne dépend de ce fichier tant que le
-- webhook n'est pas créé dans Resend : le coller avant d'ajouter RESEND_WEBHOOK_SECRET sur Vercel.

create table if not exists public.mail_events (
  id           bigint generated always as identity primary key,
  svix_id      text not null unique,            -- identifiant du message du webhook : un renvoi ne double rien
  email_id     text not null,                   -- identifiant du mail chez Resend
  type         text not null,                   -- email.delivered, email.opened, email.clicked, email.bounced…
  to_email     text,
  subject      text,
  link         text,                            -- lien cliqué (email.clicked)
  bounce_type  text,                            -- Permanent, Transient, Undetermined (email.bounced)
  occurred_at  timestamptz not null,
  created_at   timestamptz not null default now()
);
create index if not exists mail_events_occurred_idx on public.mail_events (occurred_at desc);
create index if not exists mail_events_email_idx on public.mail_events (email_id);

-- Aucune politique : seul le serveur (clé service) écrit et lit
alter table public.mail_events enable row level security;
revoke all on public.mail_events from anon, authenticated;
