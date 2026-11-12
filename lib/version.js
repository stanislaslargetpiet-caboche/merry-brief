// Version de l'appli chargée dans un onglet, comparée à celle en ligne (components/NouvelleVersion.js).
// Un onglet resté ouvert garde le code qu'il a chargé : sur iPhone, Safari rouvre l'onglet de la veille tel quel,
// et la personne voit l'ancien écran même après un déploiement (replay du 11 nov. 2026, page Invités).
// La version est le commit déployé par Vercel : la même pour le code de l'onglet (fixée au build, next.config.mjs)
// et pour /api/version (lue au moment de la requête). En local, les deux sont vides et rien ne se recharge.

export const VERSION_ONGLET = process.env.NEXT_PUBLIC_VERSION || "";
// Pas plus d'une vérification par minute, quels que soient les allers-retours entre onglets
export const CHECK_EVERY_MS = 60 * 1000;
// En dessous, la personne est juste allée voir une autre appli (copier une adresse…) : on ne recharge pas sous ses yeux
export const AWAY_MS = 10 * 60 * 1000;
// Une navigation interne vient d'avoir lieu : la page qui s'affiche n'a encore rien reçu de la personne
export const NAV_FRESH_MS = 3 * 1000;
const RELOADED_KEY = "merry.version.rechargee";

// L'onglet tourne avec un autre code que celui en ligne (versions connues des deux côtés)
export const isStale = (onglet, enLigne) => Boolean(onglet && enLigne && onglet !== enLigne);

// Recharger ne fait rien perdre : pas de saisie en cours, pas de fenêtre ouverte (fiche, ajout, message…)
export function canReloadNow(doc) {
  const el = doc?.activeElement;
  if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName || ""))) return false;
  if (doc?.querySelector?.('[aria-modal="true"], dialog[open]')) return false;
  return true;
}

// Quand recharger un onglet en retard : au retour après une vraie absence, ou juste après une navigation interne
export function shouldReload({ stale, awayMs = 0, sinceNavMs = Infinity, safe }) {
  if (!stale || !safe) return false;
  return awayMs >= AWAY_MS || sinceNavMs <= NAV_FRESH_MS;
}

// Un seul rechargement par version en ligne et par onglet : si le code servi ne suit pas, on ne boucle pas.
// Sans stockage de session (navigation privée stricte), pas de garde-fou, donc pas de rechargement automatique.
export function claimReload(enLigne, storage) {
  try {
    if (!storage || storage.getItem(RELOADED_KEY) === enLigne) return false;
    storage.setItem(RELOADED_KEY, enLigne);
    return storage.getItem(RELOADED_KEY) === enLigne;
  } catch {
    return false;
  }
}
