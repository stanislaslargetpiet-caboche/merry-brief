-- Merry · colonnes ajoutées à la liste des invités (qui les remplit, format) et descriptif des paiements
-- À coller dans Supabase > SQL Editor > New query, puis Run, APRÈS dashboard.sql.
-- Le fichier peut être relancé sans risque : il ne supprime aucune donnée.
--
-- source : « invites » (question posée dans le formulaire invités, on attend la réponse)
--          ou « organisateurs » (colonne interne, remplie par les organisateurs).
-- kind   : « text » (texte libre) ou « choice » (réponses prédéfinies, dans options).

alter table public.guest_fields add column if not exists source text not null default 'organisateurs';
alter table public.guest_fields drop constraint if exists guest_fields_source_check;
alter table public.guest_fields add constraint guest_fields_source_check check (source in ('invites', 'organisateurs'));
alter table public.guest_fields add column if not exists kind text not null default 'text';
alter table public.guest_fields drop constraint if exists guest_fields_kind_check;
alter table public.guest_fields add constraint guest_fields_kind_check check (kind in ('text', 'choice'));
alter table public.guest_fields add column if not exists options text[] not null default '{}';

-- Paiements : un petit descriptif libre (« Acompte fleurs, chèque remis en main propre »)
alter table public.payments add column if not exists note text check (note is null or length(note) <= 500);

-- Prestataires : coordonnées bancaires, pour payer de son côté depuis « Noter un paiement »
alter table public.vendors add column if not exists iban text check (iban is null or length(iban) <= 48);
alter table public.vendors add column if not exists bic text check (bic is null or length(bic) <= 16);
alter table public.vendors add column if not exists account_holder text check (account_holder is null or length(account_holder) <= 120);

-- Moments du mariage : date et nature (civil, fiançailles, veille, cérémonie, brunch, fête…)
-- pour les grandes dates du rétroplanning
alter table public.events add column if not exists event_date date;
alter table public.events add column if not exists kind text;
alter table public.events drop constraint if exists events_kind_check;
alter table public.events add constraint events_kind_check
  check (kind is null or kind in ('fiancailles', 'civil', 'veille', 'ceremonie', 'cocktail', 'diner', 'brunch', 'fete', 'autre'));
