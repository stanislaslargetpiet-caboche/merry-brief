// Couples › Funnel du pilotage : l'étape la plus avancée de chaque couple, et ce qui le rend peut-être hors sujet
// (mariage passé, jamais revenu, doublon). Fonctions pures, testées (tests/pilotageFunnel.test.js), sur les lignes
// `mariages` de buildUtilisateurs (lib/server/pilotage/utilisateurs.js).

const DAY = 86400000;
const ts = (iso) => (iso ? Date.parse(iso) : 0);

// Même seuil que le mail de démarrage J+1 (D-285) : en dessous, la liste d'invités reste à faire
export const MIN_INVITES = 10;

// Dans l'ordre : un couple est à l'étape la plus avancée qu'il a atteinte, même s'il en a sauté une
export const ETAPES = [
  { id: "inscrit", label: "Inscrits", pastille: "Inscrit", detail: "Compte et mariage créés, rien d'autre" },
  { id: "geste", label: "Premier geste", pastille: "Premier geste", detail: "Un invité, une tâche cochée, le budget, l'équipe, le site ou le formulaire ouvert" },
  { id: "invites", label: "Invités", pastille: "Invités", detail: `Au moins ${MIN_INVITES} invités` },
  { id: "reponses", label: "Réponses", pastille: "Réponses", detail: "Au moins une réponse au formulaire" },
  { id: "devis", label: "Devis", pastille: "Devis", detail: "Au moins une demande de devis" },
];

export function stade(m) {
  if (m.devis > 0) return 4;
  if (m.reponses_formulaire > 0) return 3;
  if (m.invites >= MIN_INVITES) return 2;
  if (m.invites > 0 || m.taches_faites > 0 || m.budget_touche || m.equipe > 0 || m.site || m.formulaire) return 1;
  return 0;
}

// « Marie et Florian » et « Florian et Marie » : mêmes prénoms, dans le désordre, sans accents ni majuscules
const prenoms = (couple) =>
  String(couple || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .split(/\s+et\s+/)
    .map((p) => p.trim())
    .filter(Boolean)
    .sort()
    .join("|");

// Un autre mariage qui partage un compte, ou les mêmes deux prénoms. Un vrai couple n'est comparé qu'aux vrais : un
// compte invité dans une démo de Stan (Emma et Hugo dans « Léo et Léa ») n'en fait pas un doublon.
function doublon(m, tous) {
  const cle = prenoms(m.couple);
  const emails = new Set(m.emails || []);
  return tous.find((o) => o.id !== m.id && (m.test || !o.test) && ((cle.includes("|") && prenoms(o.couple) === cle) || (o.emails || []).some((e) => emails.has(e))));
}

// Ce qui peut faire retirer un couple d'un envoi : [{ id, label, tone, title }]
export function signaux(m, tous = [], now = Date.now()) {
  const out = [];
  if (m.date && ts(`${m.date}T23:59:59Z`) < now) out.push({ id: "passe", label: "mariage passé", tone: "bad", title: `Mariage prévu le ${m.date}` });
  const cree = ts(m.cree);
  const venu = ts(m.derniere_visite === undefined ? m.derniere_connexion : m.derniere_visite);
  if (cree && now - cree > 2 * DAY && venu - cree < DAY) out.push({ id: "revenu", label: "jamais revenu", tone: "warn", title: "Aucune visite après le jour de l'inscription" });
  const autre = doublon(m, tous);
  if (autre) out.push({ id: "doublon", label: `doublon de ${autre.couple}`, tone: "warn", title: "Un autre mariage a le même compte ou les mêmes prénoms" });
  return out;
}

// Étapes de l'entonnoir (n : couples arrivés au moins là ; ici : couples arrêtés là) et lignes du tableau, les tests
// hors des comptes et en bas de la liste, sinon les plus avancés d'abord puis les plus récemment venus
export function buildFunnel(mariages = [], now = Date.now()) {
  const lignes = mariages.map((m) => ({ ...m, stade: stade(m), signaux: signaux(m, mariages, now) }));
  const vrais = lignes.filter((m) => !m.test);
  const etapes = ETAPES.map((e, i) => ({ ...e, n: vrais.filter((m) => m.stade >= i).length, ici: vrais.filter((m) => m.stade === i).length }));
  const visite = (m) => ts(m.derniere_visite === undefined ? m.derniere_connexion : m.derniere_visite);
  lignes.sort((a, b) => Number(a.test) - Number(b.test) || b.stade - a.stade || visite(b) - visite(a));
  return { etapes, lignes };
}
