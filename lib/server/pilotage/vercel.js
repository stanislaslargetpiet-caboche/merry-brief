// Déploiements Vercel du projet merry-brief, pour la section Santé de la page de pilotage.
// Nécessite VERCEL_API_TOKEN (jeton personnel, Vercel > Account Settings > Tokens, portée équipe stan-f307) ;
// sans lui, la section explique comment l'activer et le reste de la page fonctionne.

const PROJECT_ID = process.env.VERCEL_PROJECT_ID || "prj_rFJpMtoajYPJtXxlHbhssNcIu90C";
const TEAM_ID = process.env.VERCEL_TEAM_ID || "team_RtvlD6gTCfkpaZasaByc1870";

export async function readVercel(days, { signal } = {}) {
  const token = process.env.VERCEL_API_TOKEN;
  if (!token) return { disponible: false, raison: "VERCEL_API_TOKEN manquante" };
  const since = Date.now() - days * 86400 * 1000;
  const params = new URLSearchParams({ projectId: PROJECT_ID, teamId: TEAM_ID, limit: "40", since: String(since) });
  const res = await fetch(`https://api.vercel.com/v6/deployments?${params}`, {
    headers: { authorization: `Bearer ${token}` },
    signal,
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`vercel_${res.status}: ${(await res.text()).slice(0, 200)}`);
  const json = await res.json();
  const list = (json.deployments || []).map((d) => ({
    id: d.uid,
    url: d.url,
    etat: d.readyState || d.state,
    cible: d.target || "preview",
    quand: d.createdAt,
    duree: d.ready && d.createdAt ? Math.round((d.ready - d.createdAt) / 1000) : null,
    branche: d.meta?.githubCommitRef || null,
    // Première ligne seulement : un commit fusionné en squash porte tout l'historique de la PR
    message: d.meta?.githubCommitMessage ? String(d.meta.githubCommitMessage).split("\n")[0].slice(0, 120) : null,
    commit: d.meta?.githubCommitSha ? String(d.meta.githubCommitSha).slice(0, 7) : null,
  }));
  const production = list.filter((d) => d.cible === "production");
  const pret = production.findIndex((d) => d.etat === "READY");
  return {
    disponible: true,
    total: list.length,
    erreurs: list.filter((d) => d.etat === "ERROR").length,
    erreurs_production: production.filter((d) => d.etat === "ERROR").length,
    // Du plus récent au plus ancien : un échec suivi d'une production prête ne casse plus rien
    echecs_actifs: (pret < 0 ? production : production.slice(0, pret)).filter((d) => d.etat === "ERROR").length,
    en_cours: list.filter((d) => ["BUILDING", "QUEUED", "INITIALIZING"].includes(d.etat)).length,
    derniere_production: production.find((d) => d.etat === "READY") || null,
    liste: list.slice(0, 15),
  };
}
