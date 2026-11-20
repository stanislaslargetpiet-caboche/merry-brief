-- Mails de démarrage des prestataires (D-378, V66 à V68) : leur propre type de désinscription, « Ne plus recevoir
-- ces conseils ». Sans ce type en base, le lien du mail échoue : à coller avant le premier envoi (20 h). Rejoue sans
-- risque. Les autres types sont repris tels quels depuis mails-demarrage.sql.
alter table public.mail_optouts drop constraint if exists mail_optouts_kind_check;
alter table public.mail_optouts add constraint mail_optouts_kind_check
  check (kind in ('couple_reply', 'new_member', 'form_reply', 'vendor_message', 'vendor_account', 'nouveautes', 'activite', 'demarrage', 'demarrage_pro'));
