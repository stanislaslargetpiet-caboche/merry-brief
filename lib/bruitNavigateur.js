// Erreurs JavaScript qui ne viennent pas du code de Merry : elles sont lancées par le navigateur ou par ce qu'il
// injecte dans la page (extension, navigateur intégré d'une appli, WebView Android), sans pile d'appels exploitable.
// Alerte du 21 nov. 2026 : « 21 erreur(s) JavaScript sur 21 jours », dont 21 de ce bruit et aucune à corriger.
// La liste sert deux fois : lib/analytics.js ne les envoie plus à PostHog, et le pilotage écarte celles déjà
// enregistrées (lib/server/pilotage/posthog.js). N'y ajouter qu'un message qu'aucun fichier du dépôt ne peut produire.
const BRUITS = [
  // Erreur d'un script d'une autre origine : le navigateur masque le message, le fichier et la ligne.
  { js: /^Script error\.?$/, sql: 'Script error[.]?"' },
  // Script injecté par des navigateurs intégrés sur iOS, qui lit une balise og:type que la page n'a pas.
  { js: /property=.og:type/, sql: "property=.og:type" },
  // Pont Java d'une WebView Android détruit pendant que la page lui parle encore.
  { js: /Java object is gone/, sql: "Java object is gone" },
];

/** Le message d'une erreur (sans son type) est-il du bruit de navigateur ? */
export function estBruitNavigateur(message) {
  const m = String(message ?? "").trim();
  return BRUITS.some((b) => b.js.test(m));
}

/** Un événement `$exception` de posthog-js dont toutes les erreurs sont du bruit : à ne pas envoyer. */
export function estExceptionDeBruit(event) {
  if (event?.event !== "$exception") return false;
  const list = event.properties?.$exception_list;
  if (Array.isArray(list) && list.length) return list.every((e) => estBruitNavigateur(e?.value));
  return estBruitNavigateur(event.properties?.$exception_message);
}

// Même liste pour HogQL (expressions re2, sans apostrophe ni barre oblique inverse), appliquée au JSON brut de
// `$exception_list` et à l'ancien champ `$exception_message`. Vrai pour tout ce qui n'est pas une exception de bruit.
export const MOTIF_BRUIT_SQL = BRUITS.map((b) => b.sql).join("|");
export const SANS_BRUIT_SQL = `NOT (event = '$exception' AND match(concat(coalesce(toString(properties.$exception_list), ''), ' ', coalesce(toString(properties.$exception_message), ''), '"'), '${MOTIF_BRUIT_SQL}'))`;
