// Génération du rétroplanning à partir des quatre questions de l'accueil
// (écran « 1d · Générer le rétroplanning » du canvas Claude Design).

import { addDays, isoDate, today, toDate } from "./format";

export const VENDOR_CHOICES = [
  { id: "lieu", label: "Lieu", icon: "lieu" },
  { id: "traiteur", label: "Traiteur", icon: "traiteur" },
  { id: "photographe", label: "Photographe", icon: "photo" },
  { id: "videaste", label: "Vidéaste", icon: "photo" },
  { id: "dj", label: "DJ ou musiciens", icon: "musique" },
  { id: "fleuriste", label: "Fleuriste", icon: "fleurs" },
  { id: "robe", label: "Robe", icon: "tenues" },
  { id: "costume", label: "Costume", icon: "tenues" },
  { id: "officiant", label: "Officiant", icon: "autre" },
  { id: "hebergement", label: "Hébergement des invités", icon: "lit" },
  { id: "fairepart", label: "Faire-part", icon: "enveloppe" },
];

export const GUEST_COUNTS = [
  { id: "inconnu", label: "Pas encore d'idée" },
  { id: "<50", label: "Moins de 50" },
  { id: "50-100", label: "50 à 100" },
  { id: "100-150", label: "100 à 150" },
  { id: "150-200", label: "150 à 200" },
  { id: ">200", label: "Plus de 200" },
];

export const LIST_STATES = [
  { id: "complete", label: "Oui, elle est complète" },
  { id: "encours", label: "Oui, en cours" },
  { id: "non", label: "Pas encore" },
];

export const MOMENT_CHOICES = [
  { id: "mairie", label: "Mairie", name: "Mairie", short: "Mairie", match: /mairie|civil/i },
  { id: "ceremonie", label: "Cérémonie religieuse ou laïque", name: "Cérémonie", short: "Cérémonie", match: /c[ée]r[ée]monie|[ée]glise|laïque|laique/i },
  { id: "veille", label: "Dîner de la veille", name: "Dîner de la veille", short: "Veille", match: /veille/i },
  { id: "cocktail", label: "Cocktail", name: "Cocktail", short: "Cocktail", match: /cocktail|vin d'honneur/i },
  { id: "diner", label: "Dîner", name: "Dîner", short: "Dîner", match: /^d[îi]ner$|^repas$|soir[ée]e/i },
  { id: "brunch", label: "Brunch du lendemain", name: "Brunch", short: "Brunch", match: /brunch|lendemain/i },
  { id: "autre", label: "Autre moment", name: "Autre moment", short: "Autre", match: /^autre/i },
];

// Les réponses de départ, tirées de ce que le couple a déjà dit (brief, moments existants)
export function defaultAnswers(data) {
  const brief = data.brief || {};
  const stage = brief.stage;
  const guests = GUEST_COUNTS.some((g) => g.id === brief.guests) ? brief.guests : "inconnu";
  const moments = MOMENT_CHOICES.filter((m) => (data.events || []).some((e) => m.match.test(e.name || ""))).map((m) => m.id);
  return {
    vendors: stage === "lieu_reserve" || stage === "details" ? ["lieu"] : [],
    guests,
    list: (data.guests || []).length >= 10 ? "encours" : "non",
    moments: moments.length ? moments : ["mairie", "cocktail", "diner"],
  };
}

// [titre, icône, jours avant le mariage, condition]
function template(a, data) {
  const booked = (id) => a.vendors.includes(id);
  const has = (id) => a.moments.includes(id);
  const list = [];
  const add = (title, icon, days, when = true) => {
    if (when) list.push({ title, icon, days });
  };
  const budgetSet = data.wedding?.budget_total !== null && data.wedding?.budget_total !== undefined;

  add("Fixer le budget", "wallet", 365, !budgetSet);
  add("Réserver le lieu", "lieu", 330, !booked("lieu"));
  add("Établir la liste d'invités", "users", 330, a.list === "non");
  add("Terminer la liste d'invités", "users", 300, a.list === "encours");
  add("Choisir le traiteur", "traiteur", 300, !booked("traiteur"));
  add("Réserver le photographe", "photo", 300, !booked("photographe"));
  add("Choisir le vidéaste", "photo", 270, !booked("videaste"));
  add("Choisir le DJ ou les musiciens", "musique", 270, !booked("dj"));
  add("Choisir la robe", "tenues", 270, !booked("robe"));
  add("Bloquer des chambres près du lieu", "lit", 240, !booked("hebergement"));
  add("Envoyer les save-the-date", "enveloppe", 240);
  add("Récupérer les adresses des invités", "adresse", 210);
  add("Choisir le costume", "tenues", 210, !booked("costume"));
  add("Prévoir le transport des invités", "lit", 200, a.guests === "150-200" || a.guests === ">200");
  add("Choisir le fleuriste", "fleurs", 180, !booked("fleuriste"));
  add("Réserver le dîner de la veille", "traiteur", 150, has("veille"));
  add("Premiers essayages", "tenues", 150, !(booked("robe") && booked("costume")));
  add("Trouver l'officiant", "autre", 150, has("ceremonie") && !booked("officiant"));
  add("Commander les faire-part", "enveloppe", 120, !booked("fairepart"));
  add("Choisir les alliances", "alliances", 120);
  add("Réserver le brunch du lendemain", "traiteur", 90, has("brunch"));
  add("Préparer la cérémonie (textes, musique)", "autre", 60, has("ceremonie"));
  add("Déposer le dossier à la mairie", "mairie", 60, has("mairie"));
  add("Essai coiffure et maquillage", "beaute", 60);
  add("Relancer les invités sans réponse", "users", 45);
  for (const v of VENDOR_CHOICES) {
    if (booked(v.id) && ["lieu", "traiteur", "photographe", "videaste", "dj", "fleuriste"].includes(v.id)) {
      add(`Confirmer les derniers détails : ${v.label.toLowerCase()}`, v.icon, 30);
    }
  }
  add("Faire le plan de table", "table", 30);
  add("Liste des photos de groupe", "photo", 30);
  add("Envoyer le déroulé aux prestataires", "horloge", 10);

  // Du plus lointain au plus proche
  return list.sort((x, y) => y.days - x.days);
}

export function countTasks(a, data) {
  return template(a, data).length;
}

// Les tâches à insérer, datées à rebours du mariage ; ce qui serait déjà en retard est étalé
// sur les semaines qui viennent plutôt qu'empilé le même jour.
export function buildTasks(a, data) {
  const d = toDate(data.wedding?.wedding_date);
  const t0 = today();
  const couple = (data.members || []).filter((m) => m.role === "couple").map((m) => m.id);
  return template(a, data).map((x, i) => {
    let due = null;
    if (d) {
      const target = addDays(d, -x.days);
      const floor = addDays(t0, 14);
      due = target >= floor ? target : d < addDays(t0, 14 + i * 3) ? d : addDays(t0, 14 + i * 3);
    }
    return { title: x.title, icon: x.icon, due_date: due ? isoDate(due) : null, done: false, assignees: couple, added_by_merry: true, position: i };
  });
}

// Les moments choisis qui n'ont pas encore leur colonne dans la liste des invités
export function missingEvents(a, data) {
  const start = (data.events || []).length;
  const kinds = { mairie: "civil", ceremonie: "ceremonie", veille: "veille", cocktail: "cocktail", diner: "diner", brunch: "brunch", autre: "autre" };
  return MOMENT_CHOICES.filter((m) => a.moments.includes(m.id) && !(data.events || []).some((e) => m.match.test(e.name || ""))).map((m, i) => ({
    name: m.name,
    short_name: m.short,
    position: start + i,
    kind: kinds[m.id] || null,
  }));
}
