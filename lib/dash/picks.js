// Prestataires gardés par le couple (vendor_picks) : où en est chaque demande de devis,
// résumé de la sélection, message et questions de la demande.
// Le statut se lit dans les données existantes : une réponse notée sur la fiche du prestataire
// (vendor_messages) ou un devis dans le budget (budget_items.quote_amount) le fait avancer.

import { CATEGORIES, catOf, countLabel } from "./catalog";
import { euros, shortDate, toDate } from "./format";

export const STATUS = {
  devis: { label: "Devis reçu", cls: "is-quote" },
  reponse: { label: "Réponse reçue", cls: "is-reply" },
  envoyee: { label: "Demande envoyée", cls: "is-sent" },
  todo: { label: "Pas encore contacté", cls: "is-todo" },
};

// { key, line, quote } pour une ligne de Mes prestataires et de Vos demandes de devis
export function pickStatus(pick, data) {
  if (!pick.requested_at) {
    const v = pick.data || {};
    const line = v.price ? `À partir de ${euros(v.price)} ${v.unitWeekend || v.unit || ""}`.trim() : "";
    return { key: "todo", line };
  }
  const item = pick.vendor_id ? data.items.find((i) => i.vendor_id === pick.vendor_id && i.quote_amount) : null;
  const amount = item?.quote_amount ?? pick.quote_amount ?? null;
  if (amount) {
    const at = pick.quote_at || item?.quote_signed_at || null;
    return { key: "devis", line: `Devis de ${euros(amount)}${at ? `, reçu le ${shortDate(at)}` : ""}`, quote: true };
  }
  const replies = pick.vendor_id ? data.messages.filter((m) => m.vendor_id === pick.vendor_id && m.from_vendor) : [];
  if (replies.length) {
    const last = replies.sort((a, z) => String(z.sent_at).localeCompare(String(a.sent_at)))[0];
    return { key: "reponse", line: `« ${last.body.trim()} »` };
  }
  return { key: "envoyee", line: `Envoyée le ${shortDate(pick.requested_at)}` };
}

export function picksBy(picks) {
  const out = {};
  for (const c of CATEGORIES) out[c.key] = [];
  for (const p of picks) (out[p.category] || out.autre).push(p);
  return out;
}

// « 3 lieux · 1 traiteur · 1 DJ »
export function summary(picks) {
  const by = picksBy(picks);
  return CATEGORIES.filter((c) => by[c.key].length)
    .map((c) => countLabel(by[c.key].length, c.key))
    .join(" · ");
}

// Questions ajoutées à chaque demande, selon la catégorie (cochées par défaut)
export const QUESTIONS = {
  lieu: ["Jusqu’à quelle heure la musique est-elle autorisée ?", "Le lieu est-il accessible aux personnes à mobilité réduite ?", "Quels sont les horaires d’arrivée et de départ ?", "Quelle solution est prévue en cas de pluie ?"],
  traiteur: ["Proposez-vous des menus végétariens et adaptés aux allergies ?", "Le service, la vaisselle et le nappage sont-ils compris ?", "À quelle heure se termine le service ?"],
  dj: ["Jusqu’à quelle heure pouvez-vous jouer ?", "Le matériel son et lumière est-il fourni ?", "Combien de temps vous faut-il pour vous installer ?"],
  fleuriste: ["Pouvez-vous venir voir le lieu avant le jour J ?", "L’installation et la reprise des compositions sont-elles comprises ?"],
  photographe: ["Combien d’heures de reportage comprend votre forfait ?", "Sous quel délai recevons-nous les photos ?"],
  autre: ["Quelles sont vos disponibilités à cette date ?"],
};

// « Pour les lieux · envoyé à 3 prestataires »
export function legendFor(key, n) {
  const c = catOf(key);
  return `Pour ${n > 1 ? c.legend : c.legendOne}`;
}

export function coupleNames(wedding) {
  return [wedding.partner1, wedding.partner2].filter(Boolean).join(" et ");
}

const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

// « 14 juin 2027 »
export function dateLong(d) {
  const x = toDate(d);
  return x ? `${x.getDate() === 1 ? "1er" : x.getDate()} ${MONTHS[x.getMonth()]} ${x.getFullYear()}` : "";
}

// « juin 2027 »
export function monthYear(d) {
  const x = toDate(d);
  return x ? `${MONTHS[x.getMonth()]} ${x.getFullYear()}` : "";
}

const GUESTS = { "<50": "moins de 50", "50-100": "50 à 100", "100-150": "100 à 150", "150-200": "150 à 200", ">200": "plus de 200" };
const BUDGETS = { "<15k": "Moins de 15 000 €", "15-30k": "15 000 à 30 000 €", "30-50k": "30 000 à 50 000 €", ">50k": "Plus de 50 000 €" };

// Nombre d'invités : la liste si elle est commencée, sinon la fourchette du brief
// Nombre d'invités : la fourchette du brief fait foi (« 150 à 200 invités ») ; la liste d'invités
// ne sert que si le brief n'en dit rien
export function guestsLabel(data) {
  const b = data.brief?.guests;
  if (b) return `${GUESTS[b] || b} invités`;
  const n = data.guests?.filter((g) => !g.plus_one_of).length || 0;
  return n ? `${n} invités` : "";
}

export function budgetLabel(data) {
  const b = data.brief?.budget;
  if (b && BUDGETS[b]) return BUDGETS[b];
  if (data.wedding.budget_total) return euros(data.wedding.budget_total);
  return "";
}

// Puces « Votre brief » : région, mois, invités, budget, style
export function briefChips(data) {
  const w = data.wedding;
  const b = data.brief || {};
  return [w.region || b.region, monthYear(w.wedding_date || b.wedding_date), guestsLabel(data), budgetLabel(data), (b.vibes || [])[0]].filter(Boolean);
}

// « Repris de votre brief : 14 juin 2027 · 120 invités · Provence »
export function briefLine(data) {
  const w = data.wedding;
  return [dateLong(w.wedding_date), guestsLabel(data), w.region || data.brief?.region].filter(Boolean).join(" · ");
}

// « juin ou juillet 2027 », « juin, en 2027 ou 2028 » : la période choisie quand les dates sont flexibles
// (months : numéros 0 à 11, years : années)
const orList = (xs) => (xs.length > 1 ? `${xs.slice(0, -1).join(", ")} ou ${xs[xs.length - 1]}` : xs[0] || "");
export function periodLabel(months = [], years = []) {
  const m = orList([...months].sort((a, b) => a - b).map((k) => MONTHS[k]));
  const y = orList([...years].sort((a, b) => a - b).map(String));
  if (m && y) return years.length > 1 ? `${m}, en ${y}` : `${m} ${y}`;
  return m || y;
}

// Message par défaut ; period : la période choisie quand les dates sont flexibles
export function defaultMessage(data, period = null) {
  const w = data.wedding;
  const date = period === null ? dateLong(w.wedding_date) : "";
  const where = w.region || data.brief?.region;
  const guests = guestsLabel(data);
  const lead = period !== null ? "Nous souhaitons nous marier" : date ? `Nous nous marions le ${date}` : "Nous préparons notre mariage";
  const first = [lead, where ? ` en ${where}` : "", period ? ` en ${period}` : "", guests ? ` et nous attendons ${/^\d+ invités$/.test(guests) ? "environ " : ""}${guests}` : "", period !== null ? ". Nos dates sont flexibles" : ""].join("");
  const ask = period !== null ? "nous dire à quelles dates vous êtes disponible" : `nous confirmer que vous êtes disponible${date ? " à cette date" : ""}`;
  return `Bonjour,\n\n${first}. Pourriez-vous nous envoyer un devis et ${ask} ?\n\nNous avons aussi quelques questions, juste en dessous.\n\nMerci beaucoup,\n${coupleNames(w)}`;
}

// Dates flexibles : la demande garde la période dans quote_requests.dates, « Dates flexibles : juin 2027 »
export const FLEXIBLE = "Dates flexibles";
export function flexibleDates(months, years) {
  const p = periodLabel(months, years);
  return p ? `${FLEXIBLE} : ${p}` : FLEXIBLE;
}

// Texte envoyé à un prestataire (et gardé sur sa fiche) : message, mot personnel, questions, dates, budget
export function requestBody({ message, note, questions, dates, budget }) {
  const parts = [message.trim()];
  if (note?.trim()) parts.push(note.trim());
  if (questions.length) parts.push(questions.map((q) => `– ${q}`).join("\n"));
  const ds = dates.filter(Boolean);
  // Dates flexibles : une seule ligne, « Dates flexibles : juin ou juillet 2027 »
  if (ds.length && ds[0].startsWith(FLEXIBLE)) parts.push(ds[0]);
  else if (ds.length) parts.push(`Date souhaitée : ${ds[0]}${ds.length > 1 ? `\nAutres dates possibles : ${ds.slice(1).join(", ")}` : ""}`);
  if (budget) parts.push(`Notre budget : ${budget} au total.`);
  return parts.join("\n\n");
}

// Lieu retenu : celui du mariage (Brief > lieu), sinon le premier lieu dont on a reçu le devis
export function chosenVenue(data, picks) {
  const venue = (data.wedding.venue || "").trim().toLowerCase();
  const lieux = picks.filter((p) => p.category === "lieu");
  return (venue && lieux.find((p) => (p.data?.name || "").toLowerCase() === venue)) || lieux.find((p) => pickStatus(p, data).key === "devis") || null;
}
