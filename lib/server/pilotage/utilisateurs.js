// Section « Utilisateurs » du pilotage : qui s'est connecté récemment, et où en est chaque couple (site créé,
// invités saisis, formulaire, devis). Tout est lu en direct dans les tables de l'appli et agrégé ici, sans fonction
// SQL à coller : la fenêtre (1 h, 24 h, 7 j, 30 j) est donc exacte à la minute, ce que les séries par jour de
// pilotage_stats ne permettent pas.

const PAGE = 1000;
const MAX_PAGES = 30;

// PostgREST rend 1000 lignes au plus par requête : on pagine
async function readAll(admin, table, columns) {
  const rows = [];
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const { data, error } = await admin.from(table).select(columns).range(page * PAGE, page * PAGE + PAGE - 1);
    if (error) throw new Error(`${table} : ${error.message}`);
    rows.push(...(data || []));
    if ((data || []).length < PAGE) break;
  }
  return rows;
}

async function listUsers(admin) {
  const users = [];
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(`auth : ${error.message}`);
    users.push(...data.users);
    if (data.users.length < 1000) break;
  }
  return users;
}

const ts = (iso) => (iso ? Date.parse(iso) : 0);
const inWindow = (iso, from, to) => {
  const t = ts(iso);
  return t >= from && t < to;
};

// `raw` : lignes brutes des tables ; `windowMs` : longueur de la fenêtre courante (la précédente a la même)
export function buildUtilisateurs(raw, windowMs, now = Date.now()) {
  const { users = [], weddings = [], members = [], sites = [], forms = [], guests = [], tasks = [], budget = [], requests = [] } = raw;
  const from = now - windowMs;
  const fromPrev = now - 2 * windowMs;

  const count = (rows, key) => {
    const map = new Map();
    for (const r of rows) map.set(r[key], (map.get(r[key]) || 0) + 1);
    return map;
  };
  const guestsBy = count(guests, "wedding_id");
  const tasksBy = count(tasks, "wedding_id");
  const doneBy = count(tasks.filter((t) => t.done), "wedding_id");
  const budgetBy = count(budget, "wedding_id");
  const requestsBy = count(requests, "wedding_id");
  const lastGuest = new Map();
  for (const g of guests) if (ts(g.created_at) > (lastGuest.get(g.wedding_id) || 0)) lastGuest.set(g.wedding_id, ts(g.created_at));
  const siteBy = new Map(sites.map((s) => [s.wedding_id, s]));
  const formBy = new Map(forms.map((f) => [f.wedding_id, f]));
  const emailOf = new Map(users.map((u) => [u.id, u.email]));
  const userBy = new Map(users.map((u) => [u.id, u]));

  const membersBy = new Map();
  for (const m of members) {
    if (!m.user_id) continue;
    if (!membersBy.has(m.wedding_id)) membersBy.set(m.wedding_id, []);
    membersBy.get(m.wedding_id).push(m.user_id);
  }

  const mariages = weddings
    .map((w) => {
      const ids = [...new Set([...(membersBy.get(w.id) || []), ...(w.created_by ? [w.created_by] : [])])];
      const site = siteBy.get(w.id);
      const form = formBy.get(w.id);
      const lastLogin = Math.max(0, ...ids.map((id) => ts(userBy.get(id)?.last_sign_in_at)));
      return {
        id: w.id,
        couple: [w.partner1, w.partner2].filter(Boolean).join(" et ") || "Sans nom",
        cree: w.created_at,
        date: w.wedding_date || null,
        lieu: w.venue || null,
        emails: ids.map((id) => emailOf.get(id)).filter(Boolean),
        derniere_connexion: lastLogin ? new Date(lastLogin).toISOString() : null,
        invites: guestsBy.get(w.id) || 0,
        dernier_invite: lastGuest.get(w.id) ? new Date(lastGuest.get(w.id)).toISOString() : null,
        site: site ? (site.published ? "publié" : "brouillon") : null,
        site_slug: site?.slug || null,
        formulaire: form ? (form.published ? "publié" : "brouillon") : null,
        reponses_formulaire: form?.submissions || 0,
        taches: tasksBy.get(w.id) || 0,
        taches_faites: doneBy.get(w.id) || 0,
        budget: budgetBy.get(w.id) || 0,
        devis: requestsBy.get(w.id) || 0,
      };
    })
    .sort((a, b) => ts(b.derniere_connexion) - ts(a.derniere_connexion) || ts(b.cree) - ts(a.cree));

  const weddingOfUser = new Map();
  for (const m of mariages) {
    const w = weddings.find((x) => x.id === m.id);
    for (const id of [...(membersBy.get(m.id) || []), ...(w?.created_by ? [w.created_by] : [])]) if (!weddingOfUser.has(id)) weddingOfUser.set(id, m);
  }

  const utilisateurs = users
    .map((u) => {
      const m = weddingOfUser.get(u.id);
      return {
        id: u.id,
        email: u.email || "sans adresse",
        cree: u.created_at,
        derniere_connexion: u.last_sign_in_at || null,
        couple: m?.couple || null,
        invites: m?.invites ?? null,
        site: m?.site ?? null,
        devis: m?.devis ?? null,
      };
    })
    .sort((a, b) => ts(b.derniere_connexion) - ts(a.derniere_connexion) || ts(b.cree) - ts(a.cree));

  const win = (rows, key) => ({ n: rows.filter((r) => inWindow(r[key], from, now + 1)).length, prec: rows.filter((r) => inWindow(r[key], fromPrev, from)).length });
  const connectes = { n: users.filter((u) => inWindow(u.last_sign_in_at, from, now + 1)).length, prec: users.filter((u) => inWindow(u.last_sign_in_at, fromPrev, from)).length };

  // Qui se cache derrière chaque tuile de la période courante (listes dépliables sous les tuiles)
  const coupleOf = new Map(mariages.map((m) => [m.id, m]));
  const recent = (rows, key) => rows.filter((r) => inWindow(r[key], from, now + 1)).sort((a, b) => ts(b[key]) - ts(a[key]));
  const perWedding = (rows) => {
    const by = new Map();
    for (const r of rows) by.set(r.wedding_id, (by.get(r.wedding_id) || 0) + 1);
    return [...by].map(([id, n]) => ({ couple: coupleOf.get(id)?.couple || "Sans nom", email: coupleOf.get(id)?.emails?.[0] || null, n })).sort((a, b) => b.n - a.n);
  };
  const detail = {
    connectes: recent(users, "last_sign_in_at").map((u) => ({ email: u.email || "sans adresse", couple: weddingOfUser.get(u.id)?.couple || null, at: u.last_sign_in_at })),
    comptes: recent(users, "created_at").map((u) => ({ email: u.email || "sans adresse", couple: weddingOfUser.get(u.id)?.couple || null, at: u.created_at })),
    mariages: recent(weddings, "created_at").map((w) => ({ couple: coupleOf.get(w.id)?.couple, email: coupleOf.get(w.id)?.emails?.[0] || null, at: w.created_at })),
    sites: recent(sites, "created_at").map((x) => ({ couple: coupleOf.get(x.wedding_id)?.couple || "Sans nom", email: coupleOf.get(x.wedding_id)?.emails?.[0] || null, at: x.created_at })),
    invites: perWedding(recent(guests, "created_at")),
    devis: perWedding(recent(requests, "created_at")),
  };

  return {
    fenetre_ms: windowMs,
    detail,
    genere: new Date(now).toISOString(),
    totaux: {
      comptes: users.length,
      mariages: weddings.length,
      avec_site: mariages.filter((m) => m.site).length,
      avec_site_publie: mariages.filter((m) => m.site === "publié").length,
      avec_invites: mariages.filter((m) => m.invites > 0).length,
      avec_formulaire: mariages.filter((m) => m.formulaire).length,
      avec_devis: mariages.filter((m) => m.devis > 0).length,
    },
    fenetre: {
      connectes,
      comptes_crees: win(users, "created_at"),
      mariages_crees: win(weddings, "created_at"),
      sites_crees: win(sites, "created_at"),
      invites_ajoutes: win(guests, "created_at"),
      devis: win(requests, "created_at"),
    },
    utilisateurs: utilisateurs.slice(0, 300),
    mariages: mariages.slice(0, 300),
  };
}

export async function readUtilisateurs(admin, windowMs) {
  const [users, weddings, members, sites, forms, guests, tasks, budget, requests] = await Promise.all([
    listUsers(admin),
    readAll(admin, "weddings", "id, created_at, created_by, partner1, partner2, wedding_date, venue"),
    readAll(admin, "wedding_members", "wedding_id, user_id"),
    readAll(admin, "wedding_sites", "wedding_id, slug, published, created_at"),
    readAll(admin, "guest_forms", "wedding_id, published, submissions"),
    readAll(admin, "guests", "wedding_id, created_at"),
    readAll(admin, "tasks", "wedding_id, done"),
    readAll(admin, "budget_items", "wedding_id"),
    readAll(admin, "quote_requests", "wedding_id, created_at"),
  ]);
  return buildUtilisateurs({ users, weddings, members, sites, forms, guests, tasks, budget, requests }, windowMs);
}
