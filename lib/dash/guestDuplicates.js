// Doublons dans la liste des invités : un invité qui répond au formulaire avec un autre nom que celui de la
// liste (« Ali dLM » pour « Ali de La Marre ») est ajouté en double. Ce module repère les paires qui se
// ressemblent et prépare la fusion ; rien n'est fusionné sans que le couple l'ait accepté.
// Pur et sans base : testé dans tests/guestDuplicates.test.js.

const PARTICLES = new Set(["de", "du", "des", "la", "le", "les", "d", "l", "van", "von", "der", "den", "el", "al", "di", "da", "dos"]);
// Surnoms les plus courants : le prénom d'un côté commence par le surnom de l'autre (alex / alexandre) ;
// ces paires couvrent les cas où il ne commence pas pareil
const NICKNAMES = [
  ["alex", "alexandre"],
  ["alex", "alexandra"],
  ["sacha", "alexandre"],
  ["fred", "frederic"],
  ["fred", "frederique"],
  ["jp", "jeanpierre"],
  ["jb", "jeanbaptiste"],
  ["jf", "jeanfrancois"],
  ["mick", "michel"],
  ["bastien", "sebastien"],
  ["manu", "emmanuel"],
  ["manu", "emmanuelle"],
  ["nico", "nicolas"],
  ["tom", "thomas"],
  ["greg", "gregory"],
  ["greg", "gregoire"],
  ["chris", "christophe"],
  ["chris", "christian"],
  ["chris", "christine"],
  ["chris", "christelle"],
  ["lili", "elisabeth"],
  ["liz", "elisabeth"],
  ["marie", "maria"],
];

// Paul et Pauline, Louis et Louise : le masculin et le féminin d'un prénom sont deux personnes
const GENDER_SUFFIX = ["e", "a", "ne", "te", "le", "ine", "ette", "elle"];
const isGenderPair = (x, y) => {
  const [s, l] = x.length <= y.length ? [x, y] : [y, x];
  return GENDER_SUFFIX.some((suf) => s + suf === l);
};

function words(s) {
  return String(s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
}

// « De La Marre » → { all: "delamarre", core: "marre", initials: "dlm" }
const keyCache = new Map();
function nameKey(s) {
  const raw = String(s || "");
  const hit = keyCache.get(raw);
  if (hit) return hit;
  const w = words(raw);
  const core = w.filter((x) => !PARTICLES.has(x));
  const key = { all: w.join(""), core: (core.length ? core : w).join(""), initials: w.map((x) => x[0]).join("") };
  if (keyCache.size > 20000) keyCache.clear();
  keyCache.set(raw, key);
  return key;
}

export function normEmail(e) {
  const v = String(e || "").trim().toLowerCase();
  const at = v.lastIndexOf("@");
  if (at < 1) return "";
  let local = v.slice(0, at);
  let domain = v.slice(at + 1);
  if (domain === "googlemail.com") domain = "gmail.com";
  local = local.split("+")[0];
  if (domain === "gmail.com") local = local.replace(/\./g, "");
  return `${local}@${domain}`;
}

export function normPhone(p) {
  const d = String(p || "").replace(/\D/g, "");
  return d.length >= 9 ? d.slice(-9) : "";
}

function lev(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length];
}

function close(a, b) {
  if (!a || !b) return false;
  if (a === b) return true;
  const tol = Math.min(a.length, b.length) >= 9 ? 2 : Math.min(a.length, b.length) >= 4 ? 1 : 0;
  return tol > 0 && lev(a, b) <= tol;
}

// 1 : même prénom ; 0.8 : surnom, début de prénom ou faute ; 0 : autre
function firstScore(a, b) {
  const x = nameKey(a).all;
  const y = nameKey(b).all;
  if (!x || !y) return 0;
  if (x === y) return 1;
  if (NICKNAMES.some((g) => g.includes(x) && g.includes(y))) return 0.8;
  if (isGenderPair(x, y)) return 0;
  return close(x, y) ? 0.8 : 0;
}

// Nom de famille : identique, proche, sans particule, ou abrégé en initiales (« dLM » pour « de La Marre »)
function lastScore(a, b) {
  const x = nameKey(a);
  const y = nameKey(b);
  if (!x.all || !y.all) return 0;
  if (x.all === y.all) return 1;
  if (x.core === y.core || close(x.all, y.all) || close(x.core, y.core)) return 0.9;
  const abbreviated = (s, t) => s.all.length >= 2 && s.all.length <= 5 && s.all === t.initials && t.initials.length >= 2;
  if (abbreviated(x, y) || abbreviated(y, x)) return 0.8;
  return 0;
}

const hasAnswer = (responses, id) => responses.some((r) => r.guest_id === id && (r.status === "oui" || r.status === "non"));

// Score d'une paire (0 à 1) et ce qui l'a fait ressortir, ou null s'ils n'ont rien en commun
export function scorePair(a, b, responses = []) {
  const ea = normEmail(a.email);
  const eb = normEmail(b.email);
  if (ea && eb && ea !== eb) return null;

  let f = firstScore(a.first_name, b.first_name);
  let l = lastScore(a.last_name, b.last_name);
  // Prénom et nom saisis dans l'autre sens (« Marre Ali »)
  const swapF = firstScore(a.first_name, b.last_name);
  const swapL = lastScore(a.last_name, b.first_name);
  if (swapF * swapL > f * l) {
    f = swapF;
    l = swapL;
  }

  // Même email ou même téléphone : il faut au moins le prénom en commun, car un couple, des parents et
  // leurs enfants partagent souvent la même adresse sans être la même personne
  const sameContact = (ea && ea === eb) || (normPhone(a.phone) && normPhone(a.phone) === normPhone(b.phone));
  if (sameContact) {
    if (f === 0 && !(swapF > 0)) return null;
    return { score: 1, reason: ea && ea === eb ? "email" : "phone" };
  }

  // Deux invités qui ont chacun répondu restent deux personnes jusqu'à preuve du contraire
  if (hasAnswer(responses, a.id) && hasAnswer(responses, b.id)) return null;
  if (f === 0 || l === 0) return null;
  const score = Math.round((0.45 * f + 0.55 * l) * 100) / 100;
  if (score < 0.8) return null;
  return { score, reason: f === 1 && l === 1 ? "name_exact" : "name_close" };
}

export const pairKey = (a, b) => [a, b].sort().join("|");

// Les suggestions à montrer : une par paire, la ligne la plus ancienne (celle du couple) est gardée.
// Une personne qui ressemble à plusieurs lignes n'est proposée qu'avec la meilleure, et seulement si elle
// se détache (en cas de doute, on ne propose rien plutôt que la mauvaise fusion).
export function findDuplicates(guests, responses = [], rejected = []) {
  const skip = new Set(rejected);
  const main = guests.filter((g) => !g.plus_one_of);
  // Sur une liste de plusieurs milliers d'invités, on ne compare que ceux dont les initiales (prénom et nom,
  // dans un sens ou dans l'autre), l'adresse email ou le téléphone se recoupent
  const blocks = new Map();
  const put = (k, i) => {
    if (!k) return;
    const list = blocks.get(k);
    if (!list) blocks.set(k, [i]);
    else if (list[list.length - 1] !== i) list.push(i);
  };
  main.forEach((g, i) => {
    // Initiale du prénom + initiale du nom (avec ou sans particule), et la même chose à l'envers
    const f = nameKey(g.first_name);
    const l = nameKey(g.last_name);
    const fs = [f.all[0], f.core[0]].filter(Boolean);
    const ls = [l.all[0], l.core[0]].filter(Boolean);
    for (const a of fs) for (const b of ls) put(`n:${a}${b}`, i);
    for (const a of ls) for (const b of fs) put(`n:${a}${b}`, i);
    const e = normEmail(g.email);
    if (e) put(`e:${e}`, i);
    const p = normPhone(g.phone);
    if (p) put(`p:${p}`, i);
  });
  const seen = new Set();
  const found = [];
  for (const list of blocks.values()) {
    for (let x = 0; x < list.length; x++) {
      for (let y = x + 1; y < list.length; y++) {
        if (list[x] === list[y]) continue;
        const i = Math.min(list[x], list[y]);
        const j = Math.max(list[x], list[y]);
        const k = `${i}|${j}`;
        if (seen.has(k)) continue;
        seen.add(k);
        const a = main[i];
        const b = main[j];
        if (skip.has(pairKey(a.id, b.id))) continue;
        const hit = scorePair(a, b, responses);
        if (hit) found.push({ a, b, ...hit });
      }
    }
  }
  const older = (a, b) => {
    const ta = Date.parse(a.created_at || "") || 0;
    const tb = Date.parse(b.created_at || "") || 0;
    return ta !== tb ? ta - tb : (a.position ?? 0) - (b.position ?? 0);
  };
  const out = found.map(({ a, b, score, reason }) => {
    const [keep, drop] = older(a, b) <= 0 ? [a, b] : [b, a];
    return { keepId: keep.id, dropId: drop.id, score, reason };
  });
  // Ambiguïté : une même ligne à supprimer apparaît dans plusieurs paires proches
  const byDrop = new Map();
  for (const s of out) byDrop.set(s.dropId, [...(byDrop.get(s.dropId) || []), s]);
  return out
    .filter((s) => {
      const rivals = byDrop.get(s.dropId).filter((r) => r !== s);
      return !rivals.some((r) => r.score >= s.score - 0.05 && r.reason !== "email" && s.reason !== "email");
    })
    .sort((x, y) => y.score - x.score);
}

const empty = (v) => v === null || v === undefined || String(v).trim() === "";

// Ce que devient la ligne gardée : le nom du couple reste, ce que l'invité a saisi lui-même prend le pas
// sur les cases vides. Retourne le patch de la fiche, les réponses à reporter (par moment) et le siège.
export function mergePlan(keep, drop, { responses = [], seating = [] } = {}) {
  const patch = {};
  for (const k of ["email", "phone", "address", "diet"]) {
    if (!empty(drop[k]) && (empty(keep[k]) || k === "email" || k === "phone")) patch[k] = drop[k];
  }
  if (empty(keep.first_name) && !empty(drop.first_name)) patch.first_name = drop.first_name;
  if (empty(keep.last_name) && !empty(drop.last_name)) patch.last_name = drop.last_name;
  if (empty(keep.group_id) && !empty(drop.group_id)) patch.group_id = drop.group_id;
  if (!empty(drop.note) && !String(keep.note || "").includes(String(drop.note).trim())) {
    patch.note = empty(keep.note) ? drop.note : `${keep.note}\n${drop.note}`;
  }
  const custom = { ...(keep.custom || {}) };
  let customChanged = false;
  for (const [id, v] of Object.entries(drop.custom || {})) {
    if (!empty(v) && empty(custom[id])) {
      custom[id] = v;
      customChanged = true;
    }
  }
  if (customChanged) patch.custom = custom;

  const mine = new Map(responses.filter((r) => r.guest_id === keep.id).map((r) => [r.event_id, r.status]));
  const carried = responses
    .filter((r) => r.guest_id === drop.id && (r.status === "oui" || r.status === "non") && mine.get(r.event_id) !== r.status)
    .filter((r) => !mine.has(r.event_id) || mine.get(r.event_id) === "attente");
  const seated = new Set(seating.filter((x) => x.guest_id === keep.id).map((x) => x.event_id));
  const seats = seating.filter((x) => x.guest_id === drop.id && !seated.has(x.event_id));
  return { patch, carried, seats };
}
