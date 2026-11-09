// Bugs du pilotage : reconnaître une tâche de bug et écrire la consigne de l'agent qui l'audite ou la répare.
// Fonctions pures, testées (tests/pilotageAgent.test.js). L'envoi à l'agent est dans app/api/interne/pilotage/agent.

export const PROJET_BUGS = "Bugs";
export const MODES_AGENT = ["audit", "reparer"];

export const estBug = (item) => item?.projet === PROJET_BUGS || /^bug à arbitrer/i.test(String(item?.titre ?? ""));

// « Bug à arbitrer : inscription par invitation… » devient « Inscription par invitation… »
export function titreBug(titre) {
  const court = String(titre ?? "").replace(/^bug à arbitrer\s*:\s*/i, "").trim();
  return court ? `${court.charAt(0).toUpperCase()}${court.slice(1)}` : "Bug";
}

const REGLES = [
  "Travaille sur une copie de origin/main dans un worktree git à part, jamais dans le dossier partagé Merry/code.",
  "Ne fusionne rien, ne déploie rien, n'écris rien en base : le SQL à coller reste à Stan.",
  "Écris en français, sans tiret cadratin ; chaque chiffre cité est daté et sourcé.",
];

const CONSIGNES = {
  audit: [
    "Audite ce bug sans modifier le code.",
    "Reproduis ou localise-le dans le code (fichiers et lignes), vérifie-le dans PostHog et les journaux Supabase quand c'est utile, et dis si l'hypothèse de la tâche tient.",
    "Rends : la cause, les fichiers touchés, le correctif proposé, sa taille (petit, moyen, gros), ce qu'il risque de casser, et si une décision de Stan est nécessaire avant de corriger.",
  ],
  reparer: [
    "Répare ce bug.",
    "Commence par le localiser et vérifier la cause, puis fais le plus petit correctif qui la supprime, avec un test qui échoue avant et passe après.",
    "Lance lint, tests et build ; ouvre une pull request (une seule, un seul sujet) sur merry-brief et rends son lien. Si la cause demande une décision de Stan, un changement de base ou un correctif large, arrête-toi et explique pourquoi au lieu de corriger.",
  ],
};

// La consigne complète envoyée à l'agent ; `item` est la ligne de pilotage_items du bug
export function briefAgent(item, mode) {
  if (!MODES_AGENT.includes(mode)) throw new Error("mode");
  const corps = String(item?.detail ?? "").trim();
  return [`Merry, pilotage : ${mode === "audit" ? "audit" : "réparation"} d'un bug.`, "", `Bug : ${titreBug(item?.titre)}`, corps ? `Constat de la ronde des bugs : ${corps}` : "", "", ...CONSIGNES[mode], "", "Règles :", ...REGLES.map((r) => `- ${r}`)]
    .filter((l, i, tout) => l !== "" || tout[i - 1] !== "")
    .join("\n");
}
