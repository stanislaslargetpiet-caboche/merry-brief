// La vue de la liste des invités (recherche, filtres, tri) tient dans l'adresse de la page :
// elle survit à « Voir la fiche » puis retour, au rechargement, et se partage par un lien
// (« /dashboard/invites?st=attente » : ceux qui n'ont pas répondu).

export const LIST_PATH = "/dashboard/invites";
const STORE_KEY = "merry.invites.view";
const STATUSES = ["oui", "non", "attente", "non_invite"];

// « ?q=…&g=id,id&st=attente&m=evId:oui,evId:non&f=fieldId:valeur&rl=0&tri=-ev:id »
export function readView(search) {
  const p = new URLSearchParams(search || "");
  const pair = (s) => {
    const i = String(s).indexOf(":");
    return i > 0 ? [s.slice(0, i), s.slice(i + 1)] : null;
  };
  const moments = {};
  for (const part of (p.get("m") || "").split(",")) {
    const kv = part ? pair(part) : null;
    if (kv && STATUSES.includes(kv[1])) moments[kv[0]] = kv[1];
  }
  const f = p.get("f") ? pair(p.get("f")) : null;
  const tri = p.get("tri") || "";
  const sortKey = tri.replace(/^-/, "");
  return {
    query: p.get("q") || "",
    groups: (p.get("g") || "").split(",").filter(Boolean),
    status: STATUSES.includes(p.get("st")) ? p.get("st") : null,
    moments,
    field: f && f[1] ? { fieldId: f[0], key: f[1] } : null,
    relance: ["0", "1"].includes(p.get("rl")) ? p.get("rl") : null,
    sort: sortKey ? { key: sortKey, dir: tri.startsWith("-") ? -1 : 1 } : null,
  };
}

export function writeView(v) {
  const p = new URLSearchParams();
  if (v.query) p.set("q", v.query);
  if (v.groups?.length) p.set("g", v.groups.join(","));
  if (v.status) p.set("st", v.status);
  const m = Object.entries(v.moments || {}).map(([id, st]) => `${id}:${st}`);
  if (m.length) p.set("m", m.join(","));
  if (v.field) p.set("f", `${v.field.fieldId}:${v.field.key}`);
  if (v.relance) p.set("rl", v.relance);
  if (v.sort) p.set("tri", `${v.sort.dir === -1 ? "-" : ""}${v.sort.key}`);
  return p.toString();
}

// Gardée aussi pour la session : le lien « Invités » de la fiche ramène à la même vue
export function rememberView(qs) {
  try {
    if (qs) window.sessionStorage.setItem(STORE_KEY, qs);
    else window.sessionStorage.removeItem(STORE_KEY);
  } catch {
    // stockage indisponible (navigation privée…) : la fiche ramène simplement à la liste entière
  }
}

export function listHref() {
  try {
    const qs = window.sessionStorage.getItem(STORE_KEY);
    return qs ? `${LIST_PATH}?${qs}` : LIST_PATH;
  } catch {
    return LIST_PATH;
  }
}
