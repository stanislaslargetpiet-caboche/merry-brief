// Calculs dérivés du tableau de bord : réponses, budget, rétroplanning, indicateurs.

import { euros, pct, pctLabel, toDate, today, daysUntil, shortDate, addDays, isoDate, fullName, normalize } from "./format";

const NNBSP = "\u00a0";

// ---------------------------------------------------------------------------
// Invités
// ---------------------------------------------------------------------------

export function responseIndex(responses) {
  const map = new Map();
  for (const r of responses) {
    if (!map.has(r.guest_id)) map.set(r.guest_id, {});
    map.get(r.guest_id)[r.event_id] = r.status;
  }
  return map;
}

// Statut global d'un invité, pour l'afficher (carte mobile, etc.) : "Confirmé", "En attente", "Décliné"
export const GUEST_STATUS_LABEL = { oui: "Confirmé", attente: "En attente", non: "Décliné", non_invite: "Non invité" };

// Statut global d'un invité : oui s'il vient à au moins un moment, en attente s'il
// reste une réponse attendue, non s'il a décliné tout ce à quoi il est invité.
export function guestStatus(byEvent, events) {
  let invited = 0;
  let oui = 0;
  let attente = 0;
  for (const e of events) {
    const s = (byEvent && byEvent[e.id]) || "non_invite";
    if (s === "non_invite") continue;
    invited += 1;
    if (s === "oui") oui += 1;
    else if (s === "attente") attente += 1;
  }
  if (!invited) return "non_invite";
  if (oui) return "oui";
  if (attente) return "attente";
  return "non";
}

export function guestStats(data) {
  const idx = responseIndex(data.responses);
  const s = { total: data.guests.length, oui: 0, non: 0, attente: 0, addresses: 0, diets: 0, weekAnswers: 0, emails: 0, phones: 0, kids: 0, unnamed: 0 };
  const filled = (x) => x && String(x).trim();
  for (const g of data.guests) {
    const st = guestStatus(idx.get(g.id), data.events);
    if (st in s) s[st] += 1;
    if (filled(g.address)) s.addresses += 1;
    if (filled(g.diet)) s.diets += 1;
    if (filled(g.email)) s.emails += 1;
    if (filled(g.phone)) s.phones += 1;
    if (g.age !== null && g.age !== undefined && g.age !== "") s.kids += 1;
    if (g.plus_one_of && !filled(g.first_name) && !filled(g.last_name)) s.unnamed += 1;
  }
  const monday = addDays(today(), -((today().getDay() + 6) % 7));
  const recent = new Set();
  for (const r of data.responses) {
    if ((r.status === "oui" || r.status === "non") && r.updated_at && new Date(r.updated_at) >= monday) recent.add(r.guest_id);
  }
  s.weekAnswers = recent.size;
  s.answered = s.oui + s.non;
  return s;
}

export function guestLabel(g, guestsById) {
  const name = fullName(g);
  if (name) return name;
  if (g.plus_one_of && guestsById?.get(g.plus_one_of)) return `+1 de ${fullName(guestsById.get(g.plus_one_of))}`;
  return "Sans nom";
}

// ---------------------------------------------------------------------------
// Budget
// ---------------------------------------------------------------------------

export function itemFinance(item, payments) {
  const own = payments.filter((p) => p.budget_item_id === item.id);
  const paidList = own.filter((p) => p.paid_at);
  const paid = paidList.reduce((a, p) => a + Number(p.amount || 0), 0);
  const upcoming = own
    .filter((p) => !p.paid_at)
    .sort((a, b) => String(a.due_date || "9999").localeCompare(String(b.due_date || "9999")));
  const quote = item.quote_amount === null || item.quote_amount === undefined ? null : Number(item.quote_amount);
  const budgeted = item.budgeted === null || item.budgeted === undefined ? null : Number(item.budgeted);
  const payers = [...new Set(paidList.map((p) => p.payer_id).filter(Boolean))];
  const fullyPaid = quote !== null && quote > 0 && paid >= quote - 0.5;
  return {
    paid,
    paidList,
    upcoming,
    next: upcoming[0] || null,
    quote,
    budgeted,
    variance: quote !== null && budgeted !== null ? quote - budgeted : null,
    payers,
    fullyPaid,
    remaining: quote !== null ? Math.max(0, quote - paid) : null,
  };
}

// ---------------------------------------------------------------------------
// Plusieurs lignes dans un même poste (Lieu : tentiste, groupe électrogène, foodtruck…)
// Chaque ligne est un poste du budget (ses devis, paiements, documents) ; la catégorie les réunit.
// Un poste sans catégorie dont le nom est celui d'une catégorie en devient la ligne principale.
// ---------------------------------------------------------------------------

const hasCategory = (it) => Boolean(it?.category && String(it.category).trim());

// Nom complet : « Lieu » pour un poste seul, « Lieu · Tentiste » pour une ligne de la catégorie Lieu
export function posteName(item) {
  if (!item) return "";
  if (!hasCategory(item)) return item.label || "";
  return normalize(item.category) === normalize(item.label) ? String(item.category).trim() : `${String(item.category).trim()} · ${item.label}`;
}

// Intitulé d'une ligne dans son poste : la ligne qui porte le nom du poste est la prestation principale
export function lineLabel(item, groupName) {
  const poste = groupName || item.category;
  return poste && normalize(poste) === normalize(item.label) ? "Prestation principale" : item.label;
}

// [{ key, name, multi, items }] dans l'ordre des postes ; multi = au moins deux lignes à réunir
export function groupItems(items) {
  const cats = new Map();
  for (const it of items) if (hasCategory(it) && !cats.has(normalize(it.category))) cats.set(normalize(it.category), String(it.category).trim());
  const groups = [];
  const byKey = new Map();
  for (const it of items) {
    const k = hasCategory(it) ? normalize(it.category) : cats.has(normalize(it.label)) ? normalize(it.label) : null;
    if (k === null) {
      groups.push({ key: it.id, name: it.label, multi: false, items: [it] });
      continue;
    }
    let g = byKey.get(k);
    if (!g) {
      g = { key: `cat:${k}`, name: cats.get(k), multi: true, items: [] };
      byKey.set(k, g);
      groups.push(g);
    }
    g.items.push(it);
  }
  for (const g of groups) {
    g.multi = g.items.length > 1;
    // La ligne principale (même nom que le poste) d'abord
    g.items.sort((a, b) => Number(normalize(b.label) === normalize(g.name)) - Number(normalize(a.label) === normalize(g.name)));
    if (!g.multi && g.items.length === 1) g.name = posteName(g.items[0]);
  }
  return groups;
}

// Totaux d'un poste à plusieurs lignes
export function groupFinance(group, payments) {
  const fs = group.items.map((it) => itemFinance(it, payments));
  const sum = (pick) => {
    const vals = fs.map(pick).filter((v) => v !== null && v !== undefined);
    return vals.length ? vals.reduce((a, v) => a + v, 0) : null;
  };
  const signed = fs.filter((f) => f.quote !== null);
  return {
    lines: fs,
    budgeted: sum((f) => f.budgeted),
    quote: sum((f) => f.quote),
    variance: sum((f) => f.variance),
    paid: fs.reduce((a, f) => a + f.paid, 0),
    payers: [...new Set(fs.flatMap((f) => f.payers))],
    fullyPaid: signed.length > 0 && signed.length === fs.length && fs.every((f) => f.fullyPaid),
    anyQuote: signed.length > 0,
    nSigned: signed.length,
  };
}

export function budgetTotals(data) {
  const items = data.items;
  const sumBudgeted = items.reduce((a, i) => a + Number(i.budgeted || 0), 0);
  const initial = data.wedding.budget_total !== null && data.wedding.budget_total !== undefined ? Number(data.wedding.budget_total) : sumBudgeted;
  let engaged = 0;
  let paid = 0;
  let variance = 0;
  let projected = 0;
  let signed = 0;
  let noQuote = [];
  for (const it of items) {
    const f = itemFinance(it, data.payments);
    paid += f.paid;
    if (f.quote !== null) {
      engaged += f.quote;
      signed += 1;
      if (f.variance !== null) variance += f.variance;
      projected += f.quote;
    } else {
      projected += f.budgeted || 0;
      noQuote.push(posteName(it));
    }
  }
  const guests = data.guests.length;
  const st = guestStats(data);
  const familyIds = new Set(data.members.filter((m) => m.role === "parents").map((m) => m.id));
  // Part des familles : ce que les parents ont déjà payé, sur tout ce qui est payé
  const familyPaid = data.payments.filter((p) => p.paid_at && familyIds.has(p.payer_id)).reduce((a, p) => a + Number(p.amount || 0), 0);
  const upcoming = data.payments
    .filter((p) => !p.paid_at)
    .sort((a, b) => String(a.due_date || "9999").localeCompare(String(b.due_date || "9999")));
  return {
    initial,
    sumBudgeted,
    engaged,
    paid,
    available: initial - engaged,
    remaining: engaged - paid,
    variance,
    projected,
    perGuest: guests ? projected / guests : null,
    perParticipant: st.oui ? projected / st.oui : null,
    paidVsEngaged: engaged ? pct(paid, engaged) : 0,
    familyShare: paid ? pct(familyPaid, paid) : null,
    nextPayment: upcoming[0] || null,
    upcoming,
    signed,
    noQuote,
  };
}

// « Fleurs & déco » devient « Fleurs » dans les libellés courts (« Fleurs, acompte »)
export function shortPoste(label) {
  return String(label || "").split(/\s+(?:&|et)\s+/)[0];
}

export function paymentTitle(item, payment) {
  return `${shortPoste(posteName(item))}, ${String(payment?.label || "paiement").toLowerCase()}`;
}

// Qui a payé quoi : les dépenses réglées, par organisateur (les plus gros payeurs d'abord)
export function paidByPayer(data) {
  const out = data.members.map((m) => {
    const list = data.payments.filter((p) => p.paid_at && p.payer_id === m.id);
    return { member: m, amount: list.reduce((a, p) => a + Number(p.amount || 0), 0), count: list.length };
  });
  return out.sort((a, b) => b.amount - a.amount);
}

// ---------------------------------------------------------------------------
// Rétroplanning
// ---------------------------------------------------------------------------

export function taskStats(data) {
  const total = data.tasks.length;
  const done = data.tasks.filter((t) => t.done).length;
  const overdue = data.tasks.filter((t) => !t.done && t.due_date && daysUntil(t.due_date) < 0).length;
  const week = data.tasks.filter((t) => !t.done && t.due_date && daysUntil(t.due_date) >= 0 && daysUntil(t.due_date) <= 7).length;
  return { total, done, overdue, week };
}

export function upcomingTasks(data, n = 3) {
  return data.tasks
    .filter((t) => !t.done)
    .sort((a, b) => String(a.due_date || "9999").localeCompare(String(b.due_date || "9999")) || a.position - b.position)
    .slice(0, n);
}

// Groupes : En retard, Cette semaine, puis un groupe par mois, puis Sans date
export function taskGroups(tasks) {
  const groups = new Map();
  const push = (key, label, sort, t) => {
    if (!groups.has(key)) groups.set(key, { key, label, sort, tasks: [] });
    groups.get(key).tasks.push(t);
  };
  const thisYear = today().getFullYear();
  for (const t of tasks) {
    if (!t.due_date) {
      push("none", "Sans date", "9999", t);
      continue;
    }
    const n = daysUntil(t.due_date);
    if (t.done && n < 0) push("done", "Déjà fait", "9998", t);
    else if (!t.done && n < 0) push("late", "En retard", "0000", t);
    else if (n >= 0 && n <= 7 && !t.done) push("week", "Cette semaine", "0001", t);
    else {
      const d = toDate(t.due_date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleDateString("fr-FR", { month: "long" });
      const cap = label.charAt(0).toUpperCase() + label.slice(1) + (d.getFullYear() !== thisYear ? ` ${d.getFullYear()}` : "");
      push(key, cap, key, t);
    }
  }
  const out = [...groups.values()].sort((a, b) => a.sort.localeCompare(b.sort));
  for (const g of out) {
    g.tasks.sort((a, b) => String(a.due_date || "").localeCompare(String(b.due_date || "")) || a.position - b.position);
  }
  return out;
}

// Les deux membres « couple » forment « Vous deux »
export function coupleIds(members) {
  return members.filter((m) => m.role === "couple").map((m) => m.id);
}

export function isBoth(assignees, members) {
  const c = coupleIds(members);
  return c.length === 2 && assignees.length === 2 && c.every((id) => assignees.includes(id));
}

// ---------------------------------------------------------------------------
// Indicateurs (barres de KPIs personnalisables)
// ---------------------------------------------------------------------------

function v(value, sub) {
  return { value, sub };
}

// Chaque mesure n'est définie qu'une fois ici. Les catalogues par page la
// reprennent sous leur propre id (les ids sont gardés tels quels : ils sont
// enregistrés dans les préférences de chaque couple).
const METRICS = {
  invites: { label: "Invités", desc: "Tous les invités, enfants compris", get: (c) => v(String(c.g.total)) },
  oui: { label: "Viennent", desc: "Viennent à au moins un moment", get: (c) => v(String(c.g.oui), `(${pctLabel(c.g.oui, c.g.total)})`) },
  semaine: { label: "Réponses cette semaine", desc: "Nouvelles réponses depuis lundi", get: (c) => v(`+${c.g.weekAnswers}`) },
  adresses: { label: "Adresses reçues", desc: "Pour les faire-part", get: (c) => v(String(c.g.addresses), `(${pctLabel(c.g.addresses, c.g.total)})`) },
  regimes: { label: "Régimes particuliers", desc: "À transmettre au traiteur", get: (c) => v(String(c.g.diets)) },
  paye: { label: "Déjà payé", desc: "Acomptes et factures réglés", get: (c) => v(euros(c.b.paid), `(${pctLabel(c.b.paid, c.b.initial)})`) },
  coutInvite: { label: "Coût par invité", desc: "Devis et budget restant, divisés par les invités", get: (c) => v(c.b.perGuest === null ? "–" : euros(c.b.perGuest)) },
  ecart: { label: "Écart vs budget", desc: "Devis signés comparés au budget prévu", get: (c) => v(euros(c.b.variance, { signed: true })) },
  echeance: {
    label: "Prochaine échéance",
    desc: "Le prochain paiement à faire",
    get: (c) => v(c.b.nextPayment ? `${euros(c.b.nextPayment.amount)}${c.b.nextPayment.due_date ? ` · ${shortDate(c.b.nextPayment.due_date)}` : ""}` : "–"),
  },
};

// Un indicateur du catalogue : la mesure partagée, sous l'id (et au besoin le libellé) de la page
const kpi = (metric, id, over) => ({ id, ...METRICS[metric], ...over });

export const KPI_CATALOG = {
  accueil: [
    {
      family: "Invités",
      items: [
        kpi("invites", "invites"),
        { id: "reponses", label: "Réponses reçues", desc: "Taux de réponse sur l'ensemble", get: (c) => v(String(c.g.answered), `(${pctLabel(c.g.answered, c.g.total)})`) },
        kpi("oui", "participants", { label: "Participants", desc: "Ceux qui viennent" }),
        kpi("semaine", "reponses_semaine"),
        kpi("adresses", "adresses"),
        kpi("regimes", "regimes"),
      ],
    },
    {
      family: "Budget",
      items: [
        kpi("paye", "payes", { label: "Payés", pill: true }),
        kpi("coutInvite", "cout_invite"),
        kpi("ecart", "ecart"),
        kpi("echeance", "prochaine_echeance"),
      ],
    },
    {
      family: "Rétroplanning",
      items: [
        { id: "taches_faites", label: "Tâches faites", desc: "Avancement global", get: (c) => v(`${c.t.done}/${c.t.total}`) },
        { id: "taches_retard", label: "Tâches en retard", desc: "Échéance passée, pas cochée", get: (c) => v(String(c.t.overdue)) },
        { id: "taches_semaine", label: "Cette semaine", desc: "Tâches à faire dans les 7 jours", get: (c) => v(String(c.t.week)) },
      ],
    },
  ],
  budget: [
    {
      family: "Montants",
      items: [
        { id: "budget_initial", label: "Budget initial", desc: "Le budget fixé au départ", get: (c) => v(euros(c.b.initial)) },
        { id: "engage", label: "Engagé (devis signés)", desc: "Ce que vous avez déjà signé", get: (c) => v(euros(c.b.engaged), `(${pctLabel(c.b.engaged, c.b.initial)})`) },
        kpi("paye", "deja_paye"),
        { id: "disponible", label: "Encore disponible", desc: "Budget pas encore engagé", get: (c) => v(euros(c.b.available), `(${pctLabel(c.b.available, c.b.initial)})`) },
        { id: "reste_a_payer", label: "Reste à payer", desc: "Devis signés moins ce qui est réglé", get: (c) => v(euros(c.b.remaining)) },
        kpi("ecart", "ecart"),
      ],
    },
    {
      family: "Invités",
      items: [
        kpi("coutInvite", "cout_invite"),
        { id: "cout_participant", label: "Coût par participant", desc: "Le même total, divisé par ceux qui viennent", get: (c) => v(c.b.perParticipant === null ? "–" : euros(c.b.perParticipant)) },
      ],
    },
    {
      family: "Paiements",
      items: [
        { id: "paye_vs_engage", label: "Payé vs engagé", desc: "Part des devis signés déjà réglée", get: (c) => v(`${c.b.paidVsEngaged}${NNBSP}%`) },
        kpi("echeance", "prochaine_echeance"),
        { id: "part_familles", label: "Part des familles", desc: "Ce que les parents ont déjà payé", get: (c) => v(c.b.familyShare === null ? "–" : `${c.b.familyShare}${NNBSP}%`) },
      ],
    },
    {
      family: "Prestataires",
      items: [
        {
          id: "postes_sans_devis",
          label: "Postes sans devis",
          desc: "",
          descFn: (c) => (c.b.noQuote.length ? `${c.b.noQuote.slice(0, 3).join(", ").toLowerCase().replace(/^./, (x) => x.toUpperCase())}${c.b.noQuote.length > 3 ? "…" : ""}` : "Tous les postes ont un devis"),
          get: (c) => v(String(c.b.noQuote.length)),
        },
        { id: "prestataires_reserves", label: "Prestataires réservés", desc: "Devis signés", get: (c) => v(String(c.b.signed)) },
      ],
    },
  ],
};

KPI_CATALOG.invites = [
  {
    family: "Réponses",
    items: [
      kpi("invites", "invites"),
      kpi("oui", "oui"),
      { id: "non", label: "Ne viennent pas", desc: "Ont décliné tout ce à quoi ils sont invités", get: (c) => v(String(c.g.non), `(${pctLabel(c.g.non, c.g.total)})`) },
      { id: "attente", label: "Sans réponse", desc: "Invités, réponse encore attendue", get: (c) => v(String(c.g.attente), `(${pctLabel(c.g.attente, c.g.total)})`) },
      { id: "taux_reponse", label: "Taux de réponse", desc: "Oui et non, sur l'ensemble", get: (c) => v(pctLabel(c.g.answered, c.g.total)) },
      kpi("semaine", "reponses_semaine"),
    ],
  },
  // « Par moment » : un indicateur par moment du mariage, construit à partir des données (kpiCatalog)
  {
    family: "Logistique",
    items: [
      kpi("adresses", "adresses"),
      { id: "mails", label: "Mails reçus", desc: "Pour les relances", get: (c) => v(String(c.g.emails), `(${pctLabel(c.g.emails, c.g.total)})`) },
      { id: "telephones", label: "Téléphones reçus", desc: "Pour le jour J", get: (c) => v(String(c.g.phones), `(${pctLabel(c.g.phones, c.g.total)})`) },
      kpi("regimes", "regimes"),
      { id: "enfants", label: "Enfants", desc: "Âge renseigné", get: (c) => v(String(c.g.kids)) },
      { id: "plus_un", label: "+1 à nommer", desc: "Accompagnants sans nom", get: (c) => v(String(c.g.unnamed)) },
    ],
  },
];

// Un indicateur « Oui au <moment> » par moment du mariage
function eventKpis(data) {
  return [...(data?.events || [])]
    .sort((a, b) => a.position - b.position)
    .map((ev) => ({
      id: `oui:${ev.id}`,
      label: `Oui · ${ev.name}`,
      desc: "Ceux qui viennent à ce moment",
      get: (c) => v(String(c.d.responses.filter((r) => r.event_id === ev.id && r.status === "oui").length)),
    }));
}

export function kpiCatalog(scope, data) {
  const fams = KPI_CATALOG[scope] || [];
  if (scope !== "invites") return fams;
  const per = eventKpis(data);
  return per.length ? [fams[0], { family: "Par moment", items: per }, ...fams.slice(1)] : fams;
}

export const KPI_DEFAULTS = {
  accueil: ["invites", "reponses", "participants", "payes"],
  budget: ["budget_initial", "engage", "deja_paye", "disponible"],
  invites: ["invites", "oui", "non", "attente"],
};

// Quatre indicateurs au plus par barre (Invités, Budget) : au-delà, la barre se lit mal
export const KPI_MAX = 4;

export function kpiContext(data) {
  return { g: guestStats(data), b: budgetTotals(data), t: taskStats(data), d: data };
}

export function kpiDef(scope, id, data) {
  for (const fam of kpiCatalog(scope, data)) for (const it of fam.items) if (it.id === id) return it;
  return null;
}

export function chosenKpis(data, scope) {
  const ids = data.kpiPrefs?.[scope]?.length ? data.kpiPrefs[scope] : KPI_DEFAULTS[scope];
  return ids.map((id) => kpiDef(scope, id, data)).filter(Boolean).slice(0, KPI_MAX);
}

// Ce que la barre d'indicateurs affiche : une seule façon de la construire pour toutes les pages
export function kpiItem(def, ctx) {
  return { id: def.id, label: def.label, pill: def.pill, ...def.get(ctx) };
}

export function kpiItems(data, scope) {
  const ctx = kpiContext(data);
  return chosenKpis(data, scope).map((def) => kpiItem(def, ctx));
}

export { isoDate };
