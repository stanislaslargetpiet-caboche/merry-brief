-- Mail de 20 h « Nouvelle activité sur ton compte Merry » : son propre type de désinscription (lien du mail et
-- interrupteur des Réglages). Sans ce type en base, ils échouent : à coller avant le premier envoi.
-- Rejoue sans risque. Les autres types sont repris tels quels depuis mails-nouveautes.sql.
alter table public.mail_optouts drop constraint if exists mail_optouts_kind_check;
alter table public.mail_optouts add constraint mail_optouts_kind_check
  check (kind in ('couple_reply', 'new_member', 'form_reply', 'vendor_message', 'vendor_account', 'nouveautes', 'activite'));
