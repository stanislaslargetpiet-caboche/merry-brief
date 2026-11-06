// Réseau de Merry pour la section « Réseau » du pilotage : les contacts et les échanges de
// supabase/pilotage-reseau.sql, classés en actions du jour, noms à valider et pipeline par piste.
// La cadence vient de notes/reseau.md : relance à J+7, puis à J+14, puis pause.

export const PISTES = [
  { id: "mille_merci", label: "Mille Merci" },
  { id: "marketplace", label: "Marketplaces" },
  { id: "experientiel", label: "Expérientiel" },
  { id: "angels", label: "Angels" },
  { id: "a_qualifier", label: "À qualifier" },
];

export const STATUTS = [
  { id: "a_valider", label: "À valider" },
  { id: "a_contacter", label: "À contacter" },
  { id: "contacte", label: "Contacté" },
  { id: "relance_1", label: "Relance 1" },
  { id: "relance_2", label: "Relance 2" },
  { id: "conversation", label: "Conversation" },
  { id: "rdv_fixe", label: "RDV fixé" },
  { id: "rdv_fait", label: "RDV fait" },
  { id: "en_pause", label: "En pause" },
  { id: "ecarte", label: "Écarté" },
];

export const CRENEAUX = [
  { id: "repondre", label: "10 h 30 · Répondre" },
  { id: "ecrire", label: "14 h 00 · Écrire" },
  { id: "consolider", label: "18 h 00 · Consolider" },
];

const PISTE_IDS = new Set(PISTES.map((p) => p.id));
const STATUT_IDS = new Set(STATUTS.map((s) => s.id));
const HORS_ACTIONS = new Set(["a_valider", "en_pause", "ecarte"]);
const DAY = 86400 * 1000;
const NOON = "T12:00:00Z";

export function parisDay(ts) {
  return new Date(ts).toLocaleDateString("sv-SE", { timeZone: "Europe/Paris" }); // AAAA-MM-JJ
}

const addDays = (jour, n) => new Date(Date.parse(`${jour}${NOON}`) + n * DAY).toISOString().slice(0, 10);

// Jour ouvré suivant : samedi et dimanche passent au lundi
export function nextWorkday(jour) {
  let d = addDays(jour, 1);
  while ([0, 6].includes(new Date(`${d}${NOON}`).getUTCDay())) d = addDays(d, 1);
  return d;
}

// Valide un contact saisi sur la page ; renvoie { ok, valeur } ou { ok: false, erreur }
export function validateContact(body) {
  const nom = String(body?.nom ?? "").trim();
  const entreprise = String(body?.entreprise ?? "").trim();
  const piste = String(body?.piste ?? "");
  if (!nom || nom.length > 120) return { ok: false, erreur: "nom" };
  if (entreprise.length > 120) return { ok: false, erreur: "entreprise" };
  if (!PISTE_IDS.has(piste)) return { ok: false, erreur: "piste" };
  return { ok: true, valeur: { nom, entreprise, piste, statut: "a_valider" } };
}

// Ce que change « Fait » : le message est parti, la relance suivante se cale toute seule
export function apresEnvoi(contact, jour) {
  const base = { dernier_contact: jour };
  if (contact.statut === "a_contacter") return { ...base, statut: "contacte", prochaine_action: "Relance J+7", date_action: addDays(jour, 7) };
  if (contact.statut === "contacte") return { ...base, statut: "relance_1", prochaine_action: "Relance J+14 sur un autre canal", date_action: addDays(jour, 7) };
  if (contact.statut === "relance_1") return { ...base, statut: "relance_2", prochaine_action: "", date_action: null };
  return { ...base, prochaine_action: "", date_action: null };
}

// Traduit une action de la page en champs à écrire ; renvoie { ok, valeur, echange? } ou { ok: false, erreur }
export function planAction(contact, body, now = Date.now()) {
  const jour = parisDay(now);
  const action = String(body?.action ?? "");
  if (action === "fait") {
    return { ok: true, valeur: apresEnvoi(contact, jour), echange: { contact_id: contact.id, jour, sens: "sortant", canal: contact.canal, resume: contact.prochaine_action || "" } };
  }
  if (action === "reporter") return { ok: true, valeur: { date_action: nextWorkday(jour) } };
  if (action === "valider") return { ok: true, valeur: { statut: "a_contacter", prochaine_action: contact.prochaine_action || "Premier message", date_action: nextWorkday(jour) } };
  if (action === "ecarter") return { ok: true, valeur: { statut: "ecarte", prochaine_action: "", date_action: null } };
  if (action === "statut") {
    const statut = String(body?.statut ?? "");
    if (!STATUT_IDS.has(statut)) return { ok: false, erreur: "statut" };
    return { ok: true, valeur: HORS_ACTIONS.has(statut) ? { statut, date_action: null } : { statut } };
  }
  return { ok: false, erreur: "action" };
}

// Lien d'envoi d'une action : seulement LinkedIn ou Gmail, en https, car il vient de ce que l'agent a lu
export function safeLink(url) {
  try {
    const u = new URL(String(url || ""));
    const ok = u.protocol === "https:" && (["www.linkedin.com", "linkedin.com", "mail.google.com"].includes(u.hostname));
    return ok ? u.href : "";
  } catch {
    return "";
  }
}

// Traduit une action sur une ligne du plan ; renvoie { ok, ligne, contact?, echange? } ou { ok: false, erreur }
export function planStep(item, contact, body, now = Date.now()) {
  const jour = parisDay(now);
  const action = String(body?.action ?? "");
  if (action === "texte") {
    const message = String(body?.message ?? "");
    if (message.length > 4000) return { ok: false, erreur: "message" };
    return { ok: true, ligne: { message } };
  }
  if (action === "reporter") return { ok: true, ligne: { statut: "reporte" }, contact: contact ? { date_action: nextWorkday(jour) } : null };
  if (action === "fait") {
    if (!contact || item.creneau === "consolider") return { ok: true, ligne: { statut: "fait" } };
    const plan = planAction(contact, { action: "fait" }, now);
    const resume = (item.message || contact.prochaine_action || "").slice(0, 300);
    return { ok: true, ligne: { statut: "fait" }, contact: plan.valeur, echange: { ...plan.echange, resume } };
  }
  return { ok: false, erreur: "action" };
}

// Le prochain plan préparé (aujourd'hui, ou le prochain jour ouvré quand l'agent a tourné le soir), rangé par créneau
export function nextPlan(rows, contacts, today) {
  const list = (rows || []).filter((r) => String(r.jour) >= today);
  if (!list.length) return null;
  const jour = list.map((r) => String(r.jour)).sort()[0];
  const byId = new Map((contacts || []).map((c) => [c.id, c]));
  const lignes = list
    .filter((r) => String(r.jour) === jour)
    .sort((a, b) => a.ordre - b.ordre)
    .map((r) => {
      const c = byId.get(r.contact_id);
      return { ...r, lien_envoi: safeLink(r.lien_envoi), nom: c?.nom || "", entreprise: c?.entreprise || "", canal: c?.canal || "", linkedin: safeLink(c?.linkedin), email: c?.email || "" };
    });
  return { jour, creneaux: CRENEAUX.map((x) => ({ ...x, lignes: lignes.filter((l) => l.creneau === x.id) })).filter((x) => x.lignes.length) };
}

const byName = (a, b) => a.nom.localeCompare(b.nom, "fr");

// Regroupe les lignes pour la page ; `now` sert aux tests
export function summarizeReseau(contacts, echanges, now = Date.now(), planRows = []) {
  const list = contacts || [];
  const log = echanges || [];
  const today = parisDay(now);
  const since7 = parisDay(now - 6 * DAY);
  const nameOf = new Map(list.map((c) => [c.id, c.nom]));
  const actifs = list.filter((c) => c.statut !== "ecarte");
  const plan = nextPlan(planRows, list, today);
  const planifies = new Set((plan?.creneaux || []).flatMap((x) => x.lignes.map((l) => l.contact_id)));
  const semaine = log.filter((e) => String(e.jour) >= since7);
  const nouveaux = new Set();
  const dejaVus = new Set(log.filter((e) => e.sens === "sortant" && String(e.jour) < since7).map((e) => e.contact_id));
  for (const e of semaine) if (e.sens === "sortant" && !dejaVus.has(e.contact_id)) nouveaux.add(e.contact_id);
  return {
    disponible: true,
    jour: today,
    plan,
    a_faire: actifs
      .filter((c) => c.date_action && String(c.date_action) <= today && !HORS_ACTIONS.has(c.statut) && !planifies.has(c.id))
      .sort((a, b) => (a.date_action === b.date_action ? byName(a, b) : a.date_action < b.date_action ? -1 : 1)),
    a_valider: actifs.filter((c) => c.statut === "a_valider").sort(byName),
    pistes: PISTES.map((p) => ({ ...p, contacts: actifs.filter((c) => c.piste === p.id).sort(byName) })).filter((p) => p.contacts.length),
    semaine: {
      nouveaux: nouveaux.size,
      reponses: new Set(semaine.filter((e) => e.sens === "entrant").map((e) => e.contact_id)).size,
      rdv: actifs.filter((c) => ["rdv_fixe", "rdv_fait"].includes(c.statut)).length,
    },
    total: actifs.length,
    derniers: log.slice(0, 10).map((e) => ({ ...e, nom: nameOf.get(e.contact_id) || "Contact retiré" })),
  };
}

export async function readReseau(admin, now = Date.now()) {
  const [contacts, echanges, plan] = await Promise.all([
    admin.from("pilotage_contacts").select("id, nom, entreprise, role, piste, statut, canal, email, linkedin, dernier_contact, prochaine_action, date_action, notes").limit(5000),
    admin.from("pilotage_contact_echanges").select("id, contact_id, jour, sens, canal, resume, cree_le").order("jour", { ascending: false }).order("cree_le", { ascending: false }).limit(2000),
    admin.from("pilotage_reseau_plan").select("id, jour, creneau, ordre, contact_id, titre, raison, dernier_message, message, lien_envoi, statut").gte("jour", parisDay(now)).limit(500),
  ]);
  const error = contacts.error || echanges.error;
  if (error) {
    if (error.code === "42P01" || error.code === "PGRST205" || /does not exist|schema cache/i.test(error.message || "")) {
      return { disponible: false, raison: "les tables du réseau n'existent pas encore : colle supabase/pilotage-reseau.sql dans le SQL Editor" };
    }
    throw new Error(`pilotage_contacts : ${error.message}`);
  }
  const sansPlan = plan.error?.code === "42P01" || plan.error?.code === "PGRST205" || /does not exist|schema cache/i.test(plan.error?.message || "");
  if (plan.error && !sansPlan) throw new Error(`pilotage_reseau_plan : ${plan.error.message}`);
  const resume = summarizeReseau(contacts.data, echanges.data, now, plan.data || []);
  return sansPlan ? { ...resume, plan_raison: "le plan du jour n'existe pas encore : colle supabase/pilotage-reseau-plan.sql dans le SQL Editor" } : resume;
}
