// Prestataires › Funnel du pilotage : une ligne par fiche revendiquée (pro_vendors), avec ses comptes, sa dernière
// visite et ce qu'elle a fait dans l'espace prestataire. Lu par readUtilisateurs, qui a déjà la liste des comptes :
// withSessions et withPostHog y ajoutent ensuite la dernière visite réelle et le dernier replay, comme pour un couple.

import { estAdresseTest } from "@/lib/server/comptesTest";

const ts = (iso) => (iso ? Date.parse(iso) : 0);
const iso = (t) => (t ? new Date(t).toISOString() : null);

// Fiche de test : son nom le dit (« Merry Test (ne pas réserver) »), ou tous ses comptes sont des comptes de test
const NOM_TEST = /\b(test|d[ée]mo)\b/i;

// `raw` : lignes brutes ; `users` : comptes Supabase Auth (id, email, last_sign_in_at)
export function buildPrestataires(raw, users = [], env = process.env) {
  const { pros = [], fiches = [], categories = [], members = [], photos = [], formulas = [], options = [], dates = [], clients = [], views = [], ledger = [] } = raw;
  const ficheBy = new Map(fiches.map((f) => [f.id, f]));
  const metier = new Map(categories.map((c) => [c.slug, c.label]));
  const userBy = new Map(users.map((u) => [u.id, u]));
  const group = (rows, key = "vendor_id") => {
    const map = new Map();
    for (const r of rows) {
      if (!map.has(r[key])) map.set(r[key], []);
      map.get(r[key]).push(r);
    }
    return map;
  };
  const membersBy = group(members);
  const photosBy = group(photos);
  const clientsBy = group(clients);
  const ledgerBy = group(ledger);
  const n = (rows) => {
    const map = new Map();
    for (const r of rows) map.set(r.vendor_id, (map.get(r.vendor_id) || 0) + 1);
    return map;
  };
  const formulesBy = n([...formulas, ...options]);
  const datesBy = n(dates);
  const vuesBy = n(views);

  return pros.map((p) => {
    const f = ficheBy.get(p.vendor_id);
    const equipe = membersBy.get(p.vendor_id) || [];
    // Un compte par personne inscrite, le plus récemment connecté d'abord ; les invitations en attente n'en sont pas
    const comptes = equipe
      .filter((m) => m.user_id)
      .map((m) => {
        const u = userBy.get(m.user_id);
        return { id: m.user_id, email: u?.email || m.email || null, role: m.role || null, derniere_connexion: u?.last_sign_in_at || null, derniere_visite: u?.last_sign_in_at || null };
      })
      .sort((a, b) => ts(b.derniere_visite) - ts(a.derniere_visite));
    const emails = comptes.map((c) => c.email).filter(Boolean);
    const leurs = clientsBy.get(p.vendor_id) || [];
    const demandes = leurs.filter((c) => c.source === "merry");
    const attente = demandes.filter((c) => !c.answered_at && c.stage === "nouvelle");
    const mouvements = ledgerBy.get(p.vendor_id) || [];
    const lastLogin = Math.max(0, ...comptes.map((c) => ts(c.derniere_connexion)));
    const nom = f?.name || "Fiche supprimée";
    return {
      id: p.vendor_id,
      nom,
      ville: f?.city || null,
      metier: metier.get(f?.primary_category) || f?.primary_category || null,
      test: NOM_TEST.test(nom) || (emails.length > 0 && emails.every((e) => estAdresseTest(e, env))),
      revendiquee: p.claimed_at || null,
      comptes,
      emails,
      derniere_connexion: iso(lastLogin),
      derniere_visite: iso(lastLogin),
      visite_par: lastLogin ? comptes[0].email : null,
      collaborateurs: Math.max(0, equipe.length - 1),
      photos: (photosBy.get(p.vendor_id) || []).length,
      // Photos déposées depuis l'espace prestataire (pro_set_photos les range sous « <fiche>/pro-… »)
      photos_pro: (photosBy.get(p.vendor_id) || []).filter((x) => /\/pro-/.test(x.storage_path || "")).length,
      formules: formulesBy.get(p.vendor_id) || 0,
      dates: datesBy.get(p.vendor_id) || 0,
      clients_manuels: leurs.length - demandes.length,
      vues: vuesBy.get(p.vendor_id) || 0,
      demandes: demandes.length,
      reponses: demandes.filter((c) => c.answered_at).length,
      reservations: leurs.filter((c) => c.stage === "reserve").length,
      sans_reponse: attente.length,
      sans_reponse_depuis: attente.length ? iso(Math.min(...attente.map((c) => ts(c.created_at)))) : null,
      credits: p.credits ?? null,
      credits_depenses: -mouvements.filter((m) => m.kind === "utilisation").reduce((a, m) => a + (Number(m.delta) || 0), 0),
    };
  });
}

// `readAll` : lecture paginée de readUtilisateurs ; `users` : comptes déjà lus
export async function readPrestataires(admin, users, readAll) {
  const [pros, members, formulas, options, dates, clients, views, ledger] = await Promise.all([
    readAll(admin, "pro_vendors", "vendor_id, claimed_at, credits"),
    readAll(admin, "pro_members", "vendor_id, user_id, email, role"),
    readAll(admin, "pro_formulas", "vendor_id"),
    readAll(admin, "pro_options", "vendor_id"),
    readAll(admin, "pro_dates", "vendor_id"),
    readAll(admin, "pro_clients", "vendor_id, source, stage, answered_at, created_at"),
    readAll(admin, "pro_views", "vendor_id"),
    readAll(admin, "pro_ledger", "vendor_id, kind, delta"),
  ]);
  const ids = pros.map((p) => p.vendor_id);
  const catalog = admin.schema("catalog");
  const [fiches, photos, categories] = ids.length
    ? await Promise.all([
        catalog.from("vendors").select("id, name, city, primary_category").in("id", ids),
        catalog.from("vendor_photos").select("vendor_id, storage_path").in("vendor_id", ids),
        catalog.from("categories").select("slug, label"),
      ]).then((rs) => rs.map((r) => {
        if (r.error) throw new Error(`catalogue : ${r.error.message}`);
        return r.data || [];
      }))
    : [[], [], []];
  return buildPrestataires({ pros, fiches, categories, members, photos, formulas, options, dates, clients, views, ledger }, users);
}
