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
  "Forme de la réponse (elle remplace tout autre format de compte rendu). Tu écris à Stan en le tutoyant, jamais à la troisième personne. Il est fondateur, pas développeur : il doit comprendre les rubriques 1 à 3 sans rien connaître du code. Quatre rubriques, dans cet ordre, avec ces intitulés :",
  "1. Verdict : une ou deux phrases sur le produit, pas sur toi. Dis ce qui ne va pas du point de vue de quelqu'un qui utilise le site ou le pilotage (« la page X met 6 secondes à s'ouvrir et échoue au-delà de 8 »), puis où ça en est (corrigé, à corriger, rien à faire).",
  "2. Effet : qui est touché, depuis quand, avec quelle gravité (bloquant, gênant, cosmétique), ce qui s'affiche ou manque aujourd'hui, et ce qui arrive si on ne fait rien. Pas de numéro de PR ni de nom de mécanisme interne : décris ce qu'on voit à l'écran.",
  "3. À faire : ce que Stan fait maintenant, en une phrase à l'impératif, ou « Rien à faire. ». S'il y a un choix, donne deux options au plus, chacune en une phrase simple, avec ce qu'elle apporte et ce qu'elle coûte à Stan en temps ou en risque, puis « Je recommande A parce que… ». Stan doit pouvoir répondre par une seule lettre. Si une option demande du SQL, dis seulement « tu colles un bloc de SQL que je te prépare ». Ne finis jamais par « Stan décide » sans options.",
  "4. Détail technique : cause, fichiers et lignes, mécanismes, numéros de PR, ce qui est vérifié et ce qui ne l'est pas. Tout le jargon va ici et nulle part ailleurs.",
  "Les rubriques 1 à 3 tiennent ensemble en huit lignes. Interdits dans ces rubriques : noms de fichiers, de fonctions et de tables, numéros de PR, sigles (CTE, EXPLAIN, UTC, RSVP, etc.), mots comme index, vue matérialisée, repli, agrégat, ronde. Remplace-les par ce qu'ils font (« un calcul fait à l'avance et mis à jour toutes les 15 minutes »). Si tu t'arrêtes sans corriger, commence par la décision à prendre, pas par ce que tu n'as pas fait. Heures en heure de Paris.",
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
