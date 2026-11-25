-- Brouillon de réponse par l'IA dans la messagerie prestataire (/api/pro/brouillon) : le compteur quotidien
-- merry_ai_tick() refusait tout compte sans mariage (« Réservé aux organisateurs »), donc tout prestataire.
-- Vu le 23 nov. 2026 : trois refus pour le même gérant de fiche, la route répondait 403 et aucun brouillon
-- ne s'affichait. Le compteur accepte maintenant aussi les gérants d'une fiche (pro_members).
-- À coller dans Supabase > SQL Editor > New query, puis Run, APRÈS espace-prestataire.sql. Relançable,
-- ne touche à aucune donnée.

create or replace function public.merry_ai_tick()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  if auth.uid() is null
     or (not exists (select 1 from public.wedding_members where user_id = auth.uid())
         and not exists (select 1 from public.pro_members where user_id = auth.uid())) then
    raise exception 'Réservé aux organisateurs et aux prestataires';
  end if;
  insert into public.ai_usage (user_id, day, calls) values (auth.uid(), current_date, 1)
  on conflict (user_id, day) do update set calls = public.ai_usage.calls + 1
  returning calls into n;
  return n;
end;
$$;
revoke all on function public.merry_ai_tick() from public, anon;
grant execute on function public.merry_ai_tick() to authenticated;
