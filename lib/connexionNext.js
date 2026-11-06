// Où renvoyer après la connexion : uniquement des chemins internes au tableau de bord, à l'espace prestataire ou au
// pilotage, jamais une adresse venue de l'extérieur.
export function safeNext(raw) {
  return raw && /^\/(dashboard|pro|pilotage)(\/|$|\?)/.test(raw) ? raw : "/dashboard";
}
