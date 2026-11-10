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

// Une alerte du fil qui parle de bugs (erreurs JavaScript, clics de rage, bug vu dans un replay) peut aussi partir à l'agent
export const estAlerteBug = (titre) => /clic|javascript|bug|replay/i.test(String(titre ?? ""));

const REGLES = [
  "Travaille sur une copie de origin/main dans un worktree git à part, jamais dans le dossier partagé Merry/code.",
  "Ne fusionne rien, ne déploie rien, n'écris rien en base : le SQL à coller reste à Stan.",
  "Écris en français, sans tiret cadratin ; chaque chiffre cité est daté et sourcé.",
];

// Stan lit la réponse dans le pilotage sans ouvrir le code : elle doit dire d'abord quoi faire, le jargon vient en dernier.
const FORMAT_REPONSE = [
  "Forme de la réponse (elle remplace tout autre format de compte rendu). Quatre rubriques, dans cet ordre, avec ces intitulés, en phrases simples :",
  "1. Verdict : une phrase. Le problème est-il réel, qu'as-tu fait (audit rendu, pull request ouverte, rien) et la suite dépend-elle de Stan ?",
  "2. Effet : qui est touché (visiteurs, couples, prestataires, Stan), depuis quand, avec quelle gravité (bloquant, gênant, cosmétique). Dis aussi ce que ce serait de ne rien faire.",
  "3. À faire : l'action de Stan, une seule, à l'impératif, avec le lien ou la commande exacte, ou « Rien à faire. ». Si un choix est nécessaire, donne au plus deux options, dis laquelle tu recommandes et ce que chacune coûte (temps, risque). Ne finis jamais par « Stan décide » sans options.",
  "4. Détail technique : cause, fichiers et lignes, ce qui est vérifié et ce qui ne l'est pas.",
  "Dans les rubriques 1 à 3, aucun nom de fichier, de fonction ni de table, aucun sigle sans explication : dis ce que l'utilisateur voit. Si tu t'arrêtes sans corriger, commence par la décision à prendre, pas par ce que tu n'as pas fait.",
];

const CONSIGNES = {
  audit: [
    "Audite ce bug sans modifier le code.",
    "Reproduis ou localise-le dans le code (fichiers et lignes), vérifie-le dans PostHog et les journaux Supabase quand c'est utile, et dis si l'hypothèse de la tâche tient.",
    "Dans le détail technique, donne : la cause, les fichiers touchés, le correctif proposé, sa taille (petit, moyen, gros), ce qu'il risque de casser, et si une décision de Stan est nécessaire avant de corriger.",
  ],
  reparer: [
    "Répare ce bug.",
    "Commence par le localiser et vérifier la cause, puis fais le plus petit correctif qui la supprime, avec un test qui échoue avant et passe après.",
    "Lance lint, tests et build ; ouvre une pull request (une seule, un seul sujet) sur merry-brief et mets son lien dans la rubrique « À faire » (relire et fusionner). Si la cause demande une décision de Stan, un changement de base ou un correctif large, arrête-toi et explique pourquoi au lieu de corriger.",
  ],
};

// La consigne complète envoyée à l'agent ; `item` est la ligne de pilotage_items du bug
export function briefAgent(item, mode, alerte = false) {
  if (!MODES_AGENT.includes(mode)) throw new Error("mode");
  if (alerte) {
    const corps = String(item?.detail ?? "").trim();
    return [`Merry, pilotage : ${mode === "audit" ? "audit" : "réparation"} d'une alerte.`, "", `Alerte : ${String(item?.titre ?? "").trim()}`, corps ? `Détail : ${corps}` : "", "", ...CONSIGNES[mode].map((c) => c.replace(/ce bug/g, "cette alerte")), "", "Règles :", ...REGLES.map((r) => `- ${r}`), "", ...FORMAT_REPONSE]
      .filter((l, i, tout) => l !== "" || tout[i - 1] !== "")
      .join("\n");
  }
  const corps = String(item?.detail ?? "").trim();
  return [`Merry, pilotage : ${mode === "audit" ? "audit" : "réparation"} d'un bug.`, "", `Bug : ${titreBug(item?.titre)}`, corps ? `Constat de la ronde des bugs : ${corps}` : "", "", ...CONSIGNES[mode], "", "Règles :", ...REGLES.map((r) => `- ${r}`), "", ...FORMAT_REPONSE]
    .filter((l, i, tout) => l !== "" || tout[i - 1] !== "")
    .join("\n");
}
