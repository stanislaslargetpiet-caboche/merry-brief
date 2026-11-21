// Ce qui a été cliqué, dit sans rien de personnel : la balise et les classes CSS du bouton ou du lien visé
// (« button.gf-pill »), écrites dans le code et jamais par un utilisateur. PostHog masque le texte et tous les
// attributs des éléments cliqués (lib/analytics.js), classes comprises : un clic de rage n'y porte que des balises
// et des rangs, et le pilotage ne pouvait nommer que la page. Ni texte, ni identifiant, ni adresse de lien ici.
const CLIQUABLE = "button, a, summary, label, select, input, textarea, [role=button], [role=tab], [role=link]";
const CLASSE_SURE = /^[a-zA-Z][a-zA-Z0-9_-]{0,39}$/;

function balise(el) {
  const tag = String(el?.tagName || "").toLowerCase();
  if (!/^[a-z][a-z0-9-]*$/.test(tag)) return "";
  // getAttribute et non className : celui d'un élément SVG n'est pas une chaîne
  const classes = String(el.getAttribute?.("class") || "")
    .split(/\s+/)
    .filter((c) => CLASSE_SURE.test(c))
    .slice(0, 3);
  return [tag, ...classes].join(".");
}

// Le bouton ou le lien qui contient le clic ; sinon l'élément lui-même, suivi de son parent quand il n'a pas de
// classe (« span dans div.pp-card ») : un clic de rage sur un élément qui n'est pas un bouton est un indice en soi.
export function decrireCible(el) {
  try {
    if (!el || typeof el.tagName !== "string") return null;
    const cliquable = el.closest?.(CLIQUABLE);
    if (cliquable) return balise(cliquable) || null;
    const soi = balise(el);
    if (!soi) return null;
    const parent = soi.includes(".") ? "" : balise(el.parentElement);
    return parent ? `${soi} dans ${parent}` : soi;
  } catch {
    return null;
  }
}
