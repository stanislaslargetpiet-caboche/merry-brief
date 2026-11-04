-- Messagerie : le badge « non lus » (bouton de navigation) et la pastille de chaque fil restaient
-- allumés une fois le message ouvert, faute d'un endroit où noter la lecture (demande de Stan, 4 nov.
-- 2026). Une colonne suffit : la messagerie la pose à l'ouverture du fil (app/dashboard/prestataires/
-- messagerie/page.js) ; la RLS existante sur vendors (« organisateurs: tout ») couvre déjà son écriture.
-- Rejoue sans risque ; à coller après dashboard.sql.

alter table public.vendors add column if not exists messages_read_at timestamptz;
