import { createClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";

// Lecture de Supabase pour la page de pilotage. La voie normale est la fonction pilotage_stats
// (supabase/pilotage.sql) : un appel, tous les compteurs et séries. Tant qu'elle n'est pas collée, un repli
// par l'API REST (service_role) donne les compteurs principaux et la série des inscriptions, et la page le dit.

const DAY = 86400 * 1000;

function parisDay(ts) {
  return new Date(ts).toLocaleDateString("sv-SE", { timeZone: "Europe/Paris" }); // AAAA-MM-JJ
}

async function count(admin, table, modify) {
  let q = admin.from(table).select("*", { count: "exact", head: true });
  if (modify) q = modify(q);
  const { count: n, error } = await q;
  if (error) throw new Error(`${table} : ${error.message}`);
  return n || 0;
}

async function listUsers(admin) {
  const users = [];
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(`auth : ${error.message}`);
    users.push(...data.users);
    if (data.users.length < 1000) break;
  }
  return users;
}

export async function readSupabaseLite(admin, days) {
  const now = Date.now();
  const sinceCur = now - days * DAY;
  const sincePrev = now - 2 * days * DAY;
  const jours = [];
  for (let i = 2 * days - 1; i >= 0; i--) jours.push(parisDay(now - i * DAY));

  const users = await listUsers(admin);
  const byDay = new Map(jours.map((j) => [j, { jour: j, inscriptions: 0, mariages: 0, demandes: 0, messages_pro: 0, messages_couple: 0, reponses_rsvp: 0, visites_sites: 0, vues_pro: 0, appels_ia: 0, mails_planifies: 0 }]));
  for (const u of users) {
    const d = byDay.get(parisDay(u.created_at));
    if (d) d.inscriptions += 1;
  }
  const sinceIso = new Date(sincePrev).toISOString();
  const [weddings, requests, messages] = await Promise.all([
    admin.from("weddings").select("created_at").gte("created_at", sinceIso),
    admin.from("quote_requests").select("created_at").gte("created_at", sinceIso),
    admin.from("vendor_messages").select("sent_at, from_vendor").gte("sent_at", sinceIso),
  ]);
  for (const w of weddings.data || []) {
    const d = byDay.get(parisDay(w.created_at));
    if (d) d.mariages += 1;
  }
  for (const r of requests.data || []) {
    const d = byDay.get(parisDay(r.created_at));
    if (d) d.demandes += 1;
  }
  for (const m of messages.data || []) {
    const d = byDay.get(parisDay(m.sent_at));
    if (d) d[m.from_vendor ? "messages_pro" : "messages_couple"] += 1;
  }

  const lastSignIn = (u) => (u.last_sign_in_at ? Date.parse(u.last_sign_in_at) : 0);
  const totaux = {
    comptes: users.length,
    comptes_actifs: users.filter((u) => lastSignIn(u) >= sinceCur).length,
    comptes_actifs_prec: users.filter((u) => lastSignIn(u) >= sincePrev && lastSignIn(u) < sinceCur).length,
    comptes_jamais_connectes: users.filter((u) => !u.last_sign_in_at).length,
    mariages: await count(admin, "weddings"),
    mariages_avec_date: await count(admin, "weddings", (q) => q.not("wedding_date", "is", null)),
    organisateurs: await count(admin, "wedding_members", (q) => q.not("user_id", "is", null)),
    organisateurs_invites_en_attente: await count(admin, "wedding_members", (q) => q.is("user_id", null).not("invited_at", "is", null)),
    invites: await count(admin, "guests"),
    taches: await count(admin, "tasks"),
    taches_faites: await count(admin, "tasks", (q) => q.eq("done", true)),
    lignes_budget: await count(admin, "budget_items"),
    documents: await count(admin, "documents"),
    formulaires_publies: await count(admin, "guest_forms", (q) => q.eq("published", true)),
    sites_publies: await count(admin, "wedding_sites", (q) => q.eq("published", true)),
    demandes_devis: await count(admin, "quote_requests"),
    messages: await count(admin, "vendor_messages"),
    fiches_revendiquees: await count(admin, "pro_vendors"),
    comptes_pro: await count(admin, "pro_members", (q) => q.not("user_id", "is", null)),
    clients_pro: await count(admin, "pro_clients"),
    desinscriptions_mail: await count(admin, "mail_optouts"),
    mails_planifies: await count(admin, "mail_sent"),
  };
  // Le catalogue (20 000 fiches actives) n'est pas agrégé par l'API REST : seulement les totaux par statut
  try {
    totaux.catalogue_actifs = await count(admin.schema("catalog"), "vendors", (q) => q.eq("status", "active"));
    totaux.catalogue_candidats = await count(admin.schema("catalog"), "vendors", (q) => q.eq("status", "candidate"));
    totaux.catalogue_sans_photo = await count(admin.schema("catalog"), "vendors", (q) => q.eq("status", "active").or("photos_count.is.null,photos_count.eq.0"));
    totaux.catalogue_photos3 = await count(admin.schema("catalog"), "vendors", (q) => q.eq("status", "active").gte("photos_count", 3));
    totaux.catalogue_email = await count(admin.schema("catalog"), "vendors", (q) => q.eq("status", "active").not("email", "is", null).neq("email", ""));
    totaux.catalogue_telephone = await count(admin.schema("catalog"), "vendors", (q) => q.eq("status", "active").not("phone", "is", null).neq("phone", ""));
  } catch {
    /* schéma catalog non exposé : la page le signale */
  }

  const derniers = [...users]
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
    .slice(0, 12)
    .map((u) => ({ email: u.email, cree: u.created_at, derniere_connexion: u.last_sign_in_at, prenoms: null }));

  return {
    repli: true,
    genere: new Date().toISOString(),
    jours: days,
    totaux,
    series: [...byDay.values()],
    catalogue: [],
    derniers_comptes: derniers,
    dernieres_demandes: [],
    fiches_pro: [],
  };
}

export function isTimeout(error) {
  return Boolean(error) && (String(error.code) === "57014" || /statement timeout/i.test(error.message || ""));
}

// La base lit le catalogue (157 000 fiches) en une seconde quand ses pages sont en mémoire, et en cinq à six
// quand elles n'y sont plus ; l'API coupe à huit secondes. Un essai interrompu a pourtant chargé une partie de
// ces pages : on réessaie jusqu'à trois fois, puis on passe au repli léger plutôt que de laisser la page sans
// chiffres (11 échecs le 8 nov.). `pause` (ms) et `lite` sont réglables pour les tests.
export async function readSupabase(admin, days, { tries = 3, pause = 400, lite = readSupabaseLite, repliSurDelai = true } = {}) {
  let result;
  for (let attempt = 1; attempt <= tries; attempt += 1) {
    result = await admin.rpc("pilotage_stats", { days });
    if (!isTimeout(result.error)) break;
    if (attempt < tries && pause) await new Promise((resolve) => setTimeout(resolve, pause));
  }
  const { data, error } = result;
  if (!error) return data;
  if (repliSurDelai && isTimeout(error)) return { ...(await lite(admin, days)), repli: "delai" };
  // Fonction absente (42883 / PGRST202) : repli léger plutôt qu'une page vide
  const code = String(error.code || "");
  if (code === "42883" || code === "PGRST202" || /pilotage_stats/.test(error.message || "")) return lite(admin, days);
  throw new Error(error.message);
}

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !service) throw new Error("Supabase non configuré");
  return createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
}

// Lecture gardée cinq minutes : au-delà, la valeur précédente est servie pendant que la suivante se recalcule,
// et un recalcul qui échoue la laisse en place : le repli sur délai n'y entre donc pas, il ne sert que sans valeur
// gardée. « Actualiser » passe par readSupabase, sans ce cache.
const readSupabaseGarde = unstable_cache(async (days) => readSupabase(adminClient(), days, { repliSurDelai: false }), ["pilotage-supabase-v1"], { revalidate: 300 });

export async function readSupabaseCached(days) {
  try {
    return await readSupabaseGarde(days);
  } catch (err) {
    if (!isTimeout(err)) throw err;
    return { ...(await readSupabaseLite(adminClient(), days)), repli: "delai" };
  }
}
