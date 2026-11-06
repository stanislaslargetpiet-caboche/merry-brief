-- Édition complète de News of the Day et Feature of the Day, affichée dans la page Aujourd'hui du pilotage.
-- À coller après supabase/pilotage-items.sql. Relançable sans risque.
-- Supabase > SQL Editor > New query, colle ce fichier, Run.

alter table public.pilotage_items add column if not exists contenu text not null default '' check (length(contenu) <= 12000);
