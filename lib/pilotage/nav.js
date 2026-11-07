// Navigation du pilotage : six boutons, chacun avec ses sous-pages. Fonctions pures, testées
// (tests/pilotageNav.test.js). `periode: false` : page que le choix de période ne change pas.
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
    id: "croissance",
    label: "Croissance",
    icon: "croissance",
    pages: [
      { id: "site", label: "Site" },
      { id: "referencement", label: "Référencement" },
      { id: "agents", label: "Agents IA" },
      { id: "campagnes", label: "Campagnes emails" },
    ],
  },
  {
    id: "utilisateurs",
    label: "Utilisateurs",
    icon: "invites",
    pages: [
      { id: "comptes", label: "Comptes" },
      { id: "appli", label: "Appli" },
      { id: "couples", label: "Couples" },
      { id: "prestataires", label: "Prestataires" },
    ],
  },
  {
    id: "coulisses",
    label: "Coulisses",
    icon: "reglages",
    pages: [
      { id: "sante", label: "Santé" },
      { id: "demandes", label: "Demandes", periode: false },
      { id: "bugs", label: "Bugs" },
      { id: "mails", label: "Mails" },
      { id: "couts", label: "Coûts", periode: false },
    ],
  },
];

export const pilotagePath = (group, page) => `/pilotage/${group}/${page}`;

// Le chemin donne le bouton et la sous-page ; ce qui ne correspond à rien retombe sur la première page du bouton,
// ou sur Aujourd'hui. Santé et Demandes ont quitté Aujourd'hui : leurs anciens chemins mènent à Coulisses ;
// Mail du samedi est devenu Campagnes emails.
export function resolvePage(pathname) {
  const [, , a, b] = (pathname || "").split("/");
  const [g, p] = a === "aujourdhui" && (b === "sante" || b === "demandes") ? ["coulisses", b] : [a, b === "samedi" ? "campagnes" : b];
  const group = PILOTAGE_NAV.find((x) => x.id === g) || PILOTAGE_NAV[0];
  return { group, page: group.pages.find((x) => x.id === p) || group.pages[0] };
}

// Anciens liens de la page unique (/pilotage#demandes) : mails déjà reçus et favoris
const OLD_ANCHORS = { reseau: "plan", nouveautes: "campagnes", samedi: "campagnes", utilisateurs: "comptes", produit: "couples" };

export function pathFromHash(hash) {
  const id = (hash || "").replace(/^#/, "");
  const target = OLD_ANCHORS[id] || id;
  const group = PILOTAGE_NAV.find((x) => x.pages.some((p) => p.id === target));
  return group ? pilotagePath(group.id, target) : null;
}
