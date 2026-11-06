-- Mail hebdomadaire « Du nouveau sur Merry » : son propre type de désinscription, distinct des notifications
-- du mariage. Sans ce type en base, le lien du mail et l'interrupteur des Réglages échouent : à coller avant
-- le premier envoi.
alter table public.mail_optouts drop constraint if exists mail_optouts_kind_check;
alter table public.mail_optouts add constraint mail_optouts_kind_check
  check (kind in ('couple_reply', 'new_member', 'form_reply', 'vendor_message', 'vendor_account', 'nouveautes'));
