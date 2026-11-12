// Navigation du pilotage : sept boutons, chacun avec ses sous-pages. Fonctions pures, testées
// (tests/pilotageNav.test.js). `periode: false` : page que le choix de période ne change pas. Les identifiants de
// page sont uniques : un identifiant suffit à retrouver son bouton.
export const PILOTAGE_NAV = [
  {
    id: "aujourdhui",
    label: "Aujourd'hui",
    icon: "accueil",
    pages: [{ id: "jour", label: "Aujourd'hui" }],
  },
  {
    id: "taches",
    label: "Tâches",
    icon: "document",
    pages: [{ id: "liste", label: "Tâches", periode: false }],
  },
  {
    id: "reseau",
    label: "Réseau",
    icon: "messagerie",
    pages: [
      { id: "plan", label: "Plan du jour", periode: false },
      { id: "noms", label: "Noms à valider", periode: false },
      { id: "pipeline", label: "Pipeline", periode: false },
    ],
  },
  {
    id: "couples",
    label: "Couples",
    icon: "invites",
    pages: [
      { id: "activite", label: "Chiffres" },
      { id: "funnel", label: "Funnel", periode: false },
      { id: "comptes", label: "Par couple", periode: false },
    ],
  },
  {
    id: "prestataires",
    label: "Prestataires",
    icon: "boutique",
    pages: [
      { id: "catalogue", label: "Chiffres" },
      { id: "demandes", label: "Demandes d'accès", periode: false },
    ],
  },
  {
    id: "acquisition",
    label: "Acquisition",
    icon: "croissance",
    pages: [
      { id: "site", label: "Site" },
      { id: "publicites", label: "Publicités" },
      { id: "campagnes", label: "Campagnes emails" },
      { id: "referencement", label: "Référencement" },
    ],
  },
  {
    id: "coulisses",
    label: "Coulisses",
    icon: "reglages",
    pages: [
      { id: "sante", label: "Santé" },
      { id: "mails", label: "Mails automatiques" },
      { id: "couts", label: "Coûts", periode: false },
    ],
  },
];

export const pilotagePath = (group, page) => `/pilotage/${group}/${page}`;

// Anciens boutons (Croissance et Utilisateurs jusqu'au 10 novembre 2026) et sous-pages fusionnées ou renommées :
// Agents IA dans Référencement, Bugs dans Santé, Appli et Couples dans Couples › Chiffres, Mail du samedi devenu
// Campagnes emails.
const ANCIENS_BOUTONS = { croissance: "acquisition", utilisateurs: "couples" };
const ANCIENNES_PAGES = { agents: "referencement", bugs: "sante", appli: "activite", couples: "activite", prestataires: "catalogue", samedi: "campagnes" };

// Le chemin donne le bouton et la sous-page. Une sous-page connue mène à son bouton, d'où que vienne le lien (les
// mails et les alertes déjà envoyés gardent les anciens chemins) ; sinon, la première page du bouton, ou Aujourd'hui.
export function resolvePage(pathname) {
  const [, , a, b] = (pathname || "").split("/");
  const id = ANCIENNES_PAGES[b] || b;
  const group = PILOTAGE_NAV.find((x) => x.pages.some((p) => p.id === id)) || PILOTAGE_NAV.find((x) => x.id === (ANCIENS_BOUTONS[a] || a)) || PILOTAGE_NAV[0];
  return { group, page: group.pages.find((x) => x.id === id) || group.pages[0] };
}

// Anciens liens de la page unique (/pilotage#demandes) : mails déjà reçus et favoris
const OLD_ANCHORS = { reseau: "plan", nouveautes: "campagnes", utilisateurs: "comptes", produit: "activite" };

export function pathFromHash(hash) {
  const id = (hash || "").replace(/^#/, "");
  const target = OLD_ANCHORS[id] || ANCIENNES_PAGES[id] || id;
  const group = PILOTAGE_NAV.find((x) => x.pages.some((p) => p.id === target));
  return group ? pilotagePath(group.id, target) : null;
}
