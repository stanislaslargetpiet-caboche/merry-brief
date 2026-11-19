// Prestataires › Funnel du pilotage : l'étape la plus avancée de chaque fiche revendiquée, et ce qui demande un coup
// d'œil (aucun compte, jamais revenu, demande restée sans réponse). Fonctions pures, testées
// (tests/pilotageFunnelPros.test.js), sur les lignes `prestataires` de buildPrestataires
// (lib/server/pilotage/prestataires.js). Même logique que le Funnel des couples (lib/pilotage/funnel.js).

const DAY = 86400000;
const ts = (iso) => (iso ? Date.parse(iso) : 0);

// Délai au-delà duquel une demande de couple sans réponse est signalée
export const DELAI_REPONSE_H = 48;

// Dans l'ordre : une fiche est à l'étape la plus avancée qu'elle a atteinte, même si elle en a sauté une
export const ETAPES_PRO = [
  { id: "revendiquee", label: "Revendiquées", pastille: "Revendiquée", detail: "Fiche rattachée à un compte, rien d'autre" },
  { id: "fiche", label: "Fiche travaillée", pastille: "Fiche travaillée", detail: "Photos ajoutées, une formule, des dates, un client saisi ou un collaborateur invité" },
  { id: "demande", label: "Demande reçue", pastille: "Demande reçue", detail: "Au moins une demande d'un couple de Merry" },
  { id: "reponse", label: "Réponse", pastille: "Réponse", detail: "Au moins une réponse à un couple, payée en crédits" },
  { id: "reserve", label: "Réservé", pastille: "Réservé", detail: "Au moins un client passé à « Réservé »" },
];

export function stadePro(p) {
  if (p.reservations > 0) return 4;
  if (p.reponses > 0) return 3;
  if (p.demandes > 0) return 2;
  if (p.photos_pro > 0 || p.formules > 0 || p.dates > 0 || p.clients_manuels > 0 || p.collaborateurs > 0) return 1;
  return 0;
}

const visite = (p) => ts(p.derniere_visite === undefined ? p.derniere_connexion : p.derniere_visite);

// Ce qui demande un coup d'œil : [{ id, label, tone, title }]
export function signauxPro(p, now = Date.now()) {
  const out = [];
  if (!p.comptes?.length) out.push({ id: "compte", label: "sans compte", tone: "warn", title: "Aucun compte rattaché : personne ne peut ouvrir l'espace prestataire de cette fiche" });
  const debut = ts(p.revendiquee);
  if (p.comptes?.length && debut && now - debut > 2 * DAY && visite(p) - debut < DAY) out.push({ id: "revenu", label: "jamais revenu", tone: "warn", title: "Aucune visite après le jour de la revendication" });
  const attente = p.sans_reponse_depuis ? now - ts(p.sans_reponse_depuis) : 0;
  if (attente > DELAI_REPONSE_H * 3600000) {
    const jours = Math.floor(attente / DAY);
    out.push({ id: "attente", label: `sans réponse · ${jours} j`, tone: "bad", title: `${p.sans_reponse} demande(s) sans réponse, la plus ancienne depuis ${jours} jour(s)` });
  }
  return out;
}

// Étapes de l'entonnoir (n : fiches arrivées au moins là ; ici : fiches arrêtées là) et lignes du tableau, les tests
// hors des comptes et en bas de la liste, sinon les plus avancées d'abord puis les plus récemment venues
export function buildFunnelPros(prestataires = [], now = Date.now()) {
  const lignes = prestataires.map((p) => ({ ...p, stade: stadePro(p), signaux: signauxPro(p, now) }));
  const vrais = lignes.filter((p) => !p.test);
  const etapes = ETAPES_PRO.map((e, i) => ({ ...e, n: vrais.filter((p) => p.stade >= i).length, ici: vrais.filter((p) => p.stade === i).length }));
  lignes.sort((a, b) => Number(a.test) - Number(b.test) || b.stade - a.stade || visite(b) - visite(a));
  return { etapes, lignes };
}
