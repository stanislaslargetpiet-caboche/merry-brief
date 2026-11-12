-- Mails de démarrage J+1 à J+3 (D-285) : leur propre type de désinscription, « Ne plus recevoir ces conseils ».
-- Sans ce type en base, le lien du mail échoue : à coller avant le premier envoi. Rejoue sans risque. Les autres
-- types sont repris tels quels depuis mails-activite.sql.
alter table public.mail_optouts drop constraint if exists mail_optouts_kind_check;
alter table public.mail_optouts add constraint mail_optouts_kind_check
  check (kind in ('couple_reply', 'new_member', 'form_reply', 'vendor_message', 'vendor_account', 'nouveautes', 'activite', 'demarrage'));

-- Couples › Funnel du pilotage (D-289) : un couple sorti de la séquence (etape « tout ») ou un mail retiré un à un.
-- Lu par la tâche de 20 h avant chaque envoi, écrit par le pilotage avec la clé de service : aucune règle d'accès,
-- donc rien de lisible depuis l'appli.
create table if not exists public.demarrage_retraits (
  wedding_id uuid not null references public.weddings(id) on delete cascade,
  etape      text not null check (etape in ('tout', 'invites', 'equipe', 'budget', 'stan')),
  par        text,
  created_at timestamptz not null default now(),
  primary key (wedding_id, etape)
);
alter table public.demarrage_retraits enable row level security;
