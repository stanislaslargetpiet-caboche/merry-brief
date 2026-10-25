-- Merry · merry_brief sans la colonne help
-- À coller dans Supabase > SQL Editor > New query, puis Run, APRÈS dashboard.sql et onboarding-simplifie.sql.
-- Le fichier peut être relancé sans risque.
--
-- onboarding-simplifie.sql supprime briefs.help, mais merry_brief la renvoyait encore : la fonction
-- échouait (« column b.help does not exist ») et le tableau de bord n'avait plus de brief (page Brief
-- vide, région et style absents). Le type de retour change, d'où le drop avant de la recréer.

drop function if exists public.merry_brief(uuid);
create function public.merry_brief(w uuid)
returns table (stage text, team text, first_name text, partner_first_name text, wedding_date date,
               region text, guests text, format text, vibes text[], budget text)
language sql
stable
security definer
set search_path = public
as $$
  select b.stage, b.team, b.first_name, b.partner_first_name, b.wedding_date,
         b.region, b.guests, b.format, b.vibes, b.budget
    from public.weddings wd
    join public.briefs b on b.id = wd.brief_id
   where wd.id = w and public.is_wedding_member(w);
$$;
revoke all on function public.merry_brief(uuid) from public, anon;
grant execute on function public.merry_brief(uuid) to authenticated;
