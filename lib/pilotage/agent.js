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
  "3. À faire : une seule phrase à l'impératif, ou « Rien à faire. ». Après une réparation, c'est « Relis et fusionne la PR » (avec son lien), plus « colle le bloc de SQL que je te prépare » si la PR en contient un. Après un audit, c'est « Clique Réparer » ou « Rien à faire. ». Ne pose aucune question à Stan et ne lui donne pas d'options à choisir : quand il y a un choix, tu le tranches toi-même et tu dis dans le détail technique ce que tu as choisi et pourquoi. Ne finis jamais par « Stan décide ».",
  "4. Détail technique : cause, fichiers et lignes, mécanismes, numéros de PR, ce qui est vérifié et ce qui ne l'est pas, les choix que tu as tranchés. Tout le jargon va ici et nulle part ailleurs.",
  "Les rubriques 1 à 3 tiennent ensemble en huit lignes. Interdits dans ces rubriques : noms de fichiers, de fonctions et de tables, numéros de PR, sigles (CTE, EXPLAIN, UTC, RSVP, etc.), mots comme index, vue matérialisée, repli, agrégat, ronde. Remplace-les par ce qu'ils font (« un calcul fait à l'avance et mis à jour toutes les 15 minutes »). Heures en heure de Paris.",
];

const CONSIGNES = {
  audit: [
    "Audite ce bug sans modifier le code.",
    "Reproduis ou localise-le dans le code (fichiers et lignes), vérifie-le dans PostHog et les journaux Supabase quand c'est utile, et dis si l'hypothèse de la tâche tient.",
    "Dans le détail technique, donne : la cause, les fichiers touchés, le correctif que tu ferais (tranche toi-même s'il y a plusieurs façons), sa taille (petit, moyen, gros) et ce qu'il risque de casser. Ne demande pas de décision à Stan : s'il veut le correctif, il clique Réparer.",
  ],
  reparer: [
    "Répare ce bug et va jusqu'au bout sans demander l'avis de Stan.",
    "Avant de coder, regarde les pull requests ouvertes sur merry-brief (gh pr list --state open) : si l'une d'elles corrige déjà ce bug, n'en ouvre pas une autre. Vérifie-la, complète-la sur sa branche si elle est incomplète, et mets son lien dans la rubrique « À faire ».",
    "Sinon, localise la cause, vérifie-la, puis fais le plus petit correctif qui la supprime, avec un test qui échoue avant et passe après. Quand il y a plusieurs façons de corriger, choisis toi-même la plus sûre et dis ce que tu as choisi dans le détail technique.",
    "Si le correctif demande du SQL, écris-le dans supabase/ (rejouable sans erreur sur une base où il a déjà été passé), mets-le dans la PR et dis dans « À faire » que Stan le colle. Ne t'arrête pas pour cela.",
    "Lance lint, tests et build ; ouvre une pull request (une seule, un seul sujet) sur merry-brief et mets son lien dans la rubrique « À faire » (relire et fusionner). Le seul cas où tu t'arrêtes sans PR : tu n'as pas trouvé la cause après l'avoir cherchée dans le code, PostHog et les journaux ; dis alors ce que tu as cherché et où regarder.",
  ],
};

// Le retour du compte rendu : l'agent le poste à l'adresse du pilotage avec un jeton à usage unique, et le bouton Rapport apparaît
export function consigneRetour({ url, id, jeton }) {
  return [
    "Quand ta réponse en quatre rubriques est prête, envoie-la aussi au pilotage pour que Stan la lise derrière le bouton Rapport de la carte : une requête POST à l'adresse ci-dessous, en JSON, avec les champs id, jeton et texte (ta réponse complète, en texte brut). N'envoie rien d'autre à cette adresse ; si l'envoi échoue, dis-le dans la réponse.",
    `Adresse : ${url}`,
    `id : ${id}`,
    `jeton : ${jeton}`,
  ];
}

// La consigne complète envoyée à l'agent ; `item` est la ligne de pilotage_items du bug, `retour` { url, id, jeton } quand le compte rendu revient au pilotage
export function briefAgent(item, mode, alerte = false, retour = null) {
  const brief = briefDe(item, mode, alerte);
  return retour ? `${brief}\n\n${consigneRetour(retour).join("\n")}` : brief;
}

function briefDe(item, mode, alerte) {
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

// Où en est un bug une fois l'agent passé. La PR vient de la rubrique « 3. À faire » du compte rendu (son lien complet) ;
// son état (ouverte, fusionnee, fermee) est lu sur GitHub par la route. Une PR fusionnée fait quitter la carte de l'écran.
const DEPOT_PR = /github\.com\/stanislaslargetpiet-caboche\/merry-brief\/pull\/(\d+)/;

export function prDuRapport(texte) {
  const t = String(texte ?? "");
  const debut = t.search(/(^|\n)\s*(3\.\s*)?À faire\b/);
  if (debut < 0) return null;
  const reste = t.slice(debut);
  const fin = reste.search(/\n\s*(4\.\s*)?Détail technique\b/);
  const m = (fin < 0 ? reste : reste.slice(0, fin)).match(DEPOT_PR);
  return m ? Number(m[1]) : null;
}

const rienAFaire = (texte) => /(^|\n)\s*(3\.\s*)?À faire\s*:?\s*\n?\s*Rien à faire/i.test(String(texte ?? ""));

// La pastille d'état d'une carte de bug : { texte, ton, lien? } ou null quand aucun agent n'est passé
export function statutBug(rapport) {
  if (!rapport) return null;
  if (rapport.statut === "en_cours") return { texte: rapport.mode === "audit" ? "Audit en cours" : "Réparation en cours", ton: "info" };
  const pr = rapport.pr;
  if (pr?.numero) {
    const lien = `https://github.com/stanislaslargetpiet-caboche/merry-brief/pull/${pr.numero}`;
    if (pr.etat === "fusionnee") return { texte: "Réparé", ton: "ok", lien };
    if (pr.etat === "fermee") return { texte: `PR ${pr.numero} fermée sans fusion`, ton: "bad", lien };
    return { texte: `Réparé, PR ${pr.numero} à fusionner`, ton: "warn", lien };
  }
  if (rienAFaire(rapport.texte)) return { texte: "Rien à faire", ton: "ok" };
  return { texte: rapport.mode === "audit" ? "Audit rendu" : "Rapport rendu", ton: "neutral" };
}
