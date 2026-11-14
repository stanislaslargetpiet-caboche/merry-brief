// Qui peut lire la page de pilotage : PILOTAGE_EMAILS (adresses séparées par des virgules, sinon celles de Stan),
// accès permanent, et les adresses approuvées dans Coulisses › Accès (table pilotage_acces, supabase/pilotage-acces.sql).

const DEFAULT_EMAILS = ["stanislas.largetpiet@gmail.com", "largetstan@gmail.com"];

export function allowedEmails(env = process.env) {
  const raw = String(env.PILOTAGE_EMAILS || "").trim();
  const list = raw ? raw.split(/[,\s]+/).filter(Boolean) : DEFAULT_EMAILS;
  return new Set(list.map((e) => e.toLowerCase()));
}

const absente = (error) => error && (error.code === "42P01" || error.code === "PGRST205" || /does not exist|schema cache/i.test(error.message || ""));

// Statut d'une adresse : "permanent" | "approuve" | "en_attente" | "refuse" | null (aucune demande)
export async function statutAcces(admin, email) {
  if (allowedEmails().has(email)) return "permanent";
  const { data, error } = await admin.from("pilotage_acces").select("statut").eq("email", email).maybeSingle();
  if (error) {
    if (absente(error)) return null;
    throw new Error(`pilotage_acces : ${error.message}`);
  }
  return data?.statut || null;
}

// Toutes les adresses qui ont accès (permanentes et approuvées) : la corbeille des couples garde leurs comptes
export async function pilotEmails(admin) {
  const set = allowedEmails();
  const { data, error } = await admin.from("pilotage_acces").select("email").eq("statut", "approuve");
  if (error && !absente(error)) throw new Error(`pilotage_acces : ${error.message}`);
  for (const r of data || []) set.add(r.email);
  return set;
}

// Une demande par adresse : une adresse refusée ne redemande pas. Renvoie { statut, nouvelle }.
export async function demanderAcces(admin, email) {
  const avant = await statutAcces(admin, email);
  if (avant) return { statut: avant, nouvelle: false };
  const { error } = await admin.from("pilotage_acces").insert({ email });
  if (error) {
    if (absente(error)) return { error: "indisponible" };
    // Deux demandes au même instant : la seconde trouve la ligne déjà là
    if (error.code === "23505") return { statut: "en_attente", nouvelle: false };
    throw new Error(`pilotage_acces : ${error.message}`);
  }
  return { statut: "en_attente", nouvelle: true };
}

const DECISIONS = { approuver: "approuve", refuser: "refuse", retirer: "refuse" };

export async function deciderAcces(admin, email, decision, par) {
  const statut = DECISIONS[decision];
  if (!statut) return { error: "invalide" };
  if (allowedEmails().has(email)) return { error: "permanent" };
  const { data, error } = await admin
    .from("pilotage_acces")
    .update({ statut, decide_le: new Date().toISOString(), decide_par: par })
    .eq("email", email)
    .select("email, statut")
    .maybeSingle();
  if (error) throw new Error(`pilotage_acces : ${error.message}`);
  if (!data) return { error: "introuvable" };
  return { ok: true, statut };
}

// Pour Coulisses › Accès : demandes en attente (plus anciennes d'abord), accès ouverts, permanents
export async function readAcces(admin) {
  const { data, error } = await admin.from("pilotage_acces").select("*").order("demande_le", { ascending: false }).limit(200);
  if (error) {
    if (absente(error)) return { disponible: false, raison: "la table pilotage_acces n'existe pas encore : colle supabase/pilotage-acces.sql dans le SQL Editor", permanents: [...allowedEmails()] };
    throw new Error(`pilotage_acces : ${error.message}`);
  }
  const rows = data || [];
  return {
    disponible: true,
    en_attente: rows.filter((r) => r.statut === "en_attente").reverse(),
    approuves: rows.filter((r) => r.statut === "approuve"),
    refuses: rows.filter((r) => r.statut === "refuse").slice(0, 10),
    permanents: [...allowedEmails()],
  };
}
