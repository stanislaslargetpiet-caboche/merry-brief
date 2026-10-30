// Site de mariage : modèles, couleurs, polices, rubriques et contenu.
// Partagé entre les réglages (tableau de bord, /dashboard/site) et la page des invités (/s/[slug]).
// Maquettes : canvas « Merry · Carte brief », page « 4 - sites refs » (socle commun, trois structures).

import { normalize } from "@/lib/dash/format";
import { withExamples } from "./examples";

// ---------------------------------------------------------------------------
// Rubriques : l'en-tête et le pied de page sont fixes, le reste se déplace et se masque
// ---------------------------------------------------------------------------

export const SECTIONS = {
  mot: { label: "Le mot d'accueil", hint: "Quelques mots pour vos invités" },
  jour: { label: "Le jour", hint: "Date, heure, compte à rebours" },
  programme: { label: "Le programme", hint: "Les moments du week-end" },
  lieu: { label: "Le lieu", hint: "Adresse, photo, itinéraire" },
  pratique: { label: "Venir, se loger, les enfants", hint: "Trajets, hébergements, enfants" },
  reponse: { label: "Le formulaire", hint: "Vos invités répondent directement depuis le site, sans repartir sur un autre lien" },
};
export const SECTION_KEYS = Object.keys(SECTIONS);

// Modèles : ordre et rubriques affichées d'après chaque maquette ; span = place sur ordinateur
// (full : toute la largeur, half : deux par ligne, third : trois par ligne)
// Trois structures sur un socle commun (30 octobre 2026). Les identifiants restent ceux que la base
// accepte (check sur wedding_sites.template) : moisson = plein cadre, colline = éditorial, terracotta = côte à côte.
export const TEMPLATES = [
  {
    id: "moisson",
    structure: "cadre",
    name: "Plein cadre",
    style: "La photo en grand",
    vibes: ["Intime", "Champêtre"],
    palette: "ble",
    fonts: "cormorant",
    labels: "socle",
    order: ["mot", "programme", "lieu", "pratique", "reponse"],
    nav: { programme: "Programme", lieu: "Le lieu", pratique: "Bon à savoir", reponse: "Répondre" },
  },
  {
    id: "colline",
    structure: "edito",
    name: "Éditorial",
    style: "Titre de journal",
    vibes: ["Chic", "Moderne", "Urbain"],
    palette: "ble",
    fonts: "cormorant",
    labels: "socle",
    order: ["mot", "programme", "lieu", "pratique", "reponse"],
    nav: { programme: "Programme", lieu: "Le lieu", pratique: "Bon à savoir", reponse: "Répondre" },
  },
  {
    id: "terracotta",
    structure: "cote",
    name: "Côte à côte",
    style: "Photo et texte",
    vibes: ["Bohème"],
    palette: "ble",
    fonts: "cormorant",
    labels: "socle",
    order: ["mot", "programme", "lieu", "pratique", "reponse"],
    nav: { programme: "Programme", lieu: "Le lieu", pratique: "Bon à savoir", reponse: "Répondre" },
  },
];

// Anciens modèles retirés du catalogue : chacun retrouve la structure la plus proche
const LEGACY = { horizon: "moisson", embarquement: "moisson", belvedere: "colline", perle: "colline", rivage: "colline" };

export function templateOf(id) {
  return TEMPLATES.find((t) => t.id === (LEGACY[id] || id)) || TEMPLATES[0];
}

// Structure proposée d'après le style choisi dans le brief, sinon le plein cadre
export function templateForBrief(brief) {
  const vibes = (brief?.vibes || []).map((v) => normalize(v));
  const hit = TEMPLATES.find((t) => (t.vibes || []).some((v) => vibes.some((x) => x.includes(normalize(v)))));
  return hit?.id || "moisson";
}

// Toutes les rubriques, dans l'ordre enregistré ; les nouvelles (ou celles d'un autre modèle) à la fin, masquées
export function sectionsOf(site) {
  const t = templateOf(site?.template);
  const saved = Array.isArray(site?.sections) && site.sections.length ? site.sections.filter((s) => SECTIONS[s.key]) : t.order.map((key) => ({ key, hidden: false }));
  const seen = new Set(saved.map((s) => s.key));
  return [...saved.map((s) => ({ key: s.key, hidden: !!s.hidden })), ...SECTION_KEYS.filter((k) => !seen.has(k)).map((key) => ({ key, hidden: true }))];
}

// Changer de modèle reprend l'ordre et les rubriques de sa maquette
export function defaultSections(templateId) {
  const t = templateOf(templateId);
  return [...t.order.map((key) => ({ key, hidden: false })), ...SECTION_KEYS.filter((k) => !t.order.includes(k)).map((key) => ({ key, hidden: true }))];
}

// ---------------------------------------------------------------------------
// Couleurs : celles de chaque maquette, un blanc pur, un fond très clair et trois teintes
// ---------------------------------------------------------------------------

// Jetons utilisés par les modèles (app/s/site.css) : fond, texte sur le fond, panneaux, accent,
// bande teintée, bande sombre, ornements, tons des photos en attente
const ORIGINS = {
  lin: { name: "Lin", bg: "#ece6de", onBg: "#2a2522", onBgSoft: "#6b625a", bgLine: "#e0d8cd", panel: "#f7f4ef", ink: "#2a2522", soft: "#6b625a", line: "#e0d8cd", accent: "#2a2522", onAccent: "#f7f4ef", accent2: "#6b625a", tint: "#f7f4ef", band: "#e0d8cd", deep: "#5b5048", onDeep: "#f6efe6", onDeepSoft: "#ece5db", orn: "#6b625a", orn2: "#6b625a", ph1: "#b49c86", ph2: "#5b5048", ph3: "#d7c9b8" },
  terre: { name: "Terre cuite", bg: "#f5eee4", onBg: "#4a3426", onBgSoft: "#6e5544", bgLine: "#d8c3ae", panel: "#f5eee4", ink: "#4a3426", soft: "#6e5544", line: "#d8c3ae", accent: "#9c4f2e", onAccent: "#ffffff", accent2: "#9c4f2e", tint: "#efe4d6", band: "#d8c3ae", deep: "#4a3426", onDeep: "#ffffff", onDeepSoft: "#f5eee4", orn: "#8f9a7e", orn2: "#b9714f", ph1: "#c9b29b", ph2: "#a88f78", ph3: "#e0d0bd" },
  perle: { name: "Perle", bg: "#f2eee7", onBg: "#1f1d1a", onBgSoft: "#5f584f", bgLine: "#d6cfc3", panel: "#faf8f3", ink: "#1f1d1a", soft: "#5f584f", line: "#d6cfc3", accent: "#1f1d1a", onAccent: "#fbf8f2", accent2: "#5f584f", tint: "#faf8f3", band: "#e3dccd", deep: "#766a5d", onDeep: "#fbf8f2", onDeepSoft: "#ece6dc", orn: "#b4a998", orn2: "#a59a8a", ph1: "#bcb8b1", ph2: "#a7a39b", ph3: "#d9d5ce" },
  nuit: { name: "Nuit", bg: "#14213a", onBg: "#f1ece2", onBgSoft: "#c3c9d6", bgLine: "#2a3753", panel: "#f1ece2", ink: "#1b2337", soft: "#525a6a", line: "#c9c2b4", accent: "#1b2337", onAccent: "#f1ece2", accent2: "#a8322b", tint: "#f1ece2", band: "#f1ece2", deep: "#14213a", onDeep: "#f1ece2", onDeepSoft: "#c3c9d6", orn: "#1b2337", orn2: "#a8322b", ph1: "#33405a", ph2: "#4a5670", ph3: "#6b7590" },
  argile: { name: "Argile", bg: "#ffffff", onBg: "#3d3530", onBgSoft: "#6b5f56", bgLine: "#d8ccbf", panel: "#ffffff", ink: "#3d3530", soft: "#6b5f56", line: "#d8ccbf", accent: "#84634f", onAccent: "#ffffff", accent2: "#84634f", tint: "#ebe3d8", band: "#ddd1c2", deep: "#3d3530", onDeep: "#ffffff", onDeepSoft: "#ebe3d8", orn: "#3d3530", orn2: "#3d3530", ph1: "#7b6b5c", ph2: "#cbbcaa", ph3: "#a8998a" },
  lac: { name: "Lac", bg: "#f7f5f1", onBg: "#26231f", onBgSoft: "#625d56", bgLine: "#dcd6cc", panel: "#f7f5f1", ink: "#26231f", soft: "#625d56", line: "#dcd6cc", accent: "#1f1d1a", onAccent: "#ffffff", accent2: "#625d56", tint: "#dfe5ea", band: "#c3ccd4", deep: "#26231f", onDeep: "#ffffff", onDeepSoft: "#f7f5f1", orn: "#8e8a83", orn2: "#8e8a83", ph1: "#6b6d67", ph2: "#d3cfc8", ph3: "#9a9890" },
  ble: { name: "Blé", bg: "#ffffff", onBg: "#4b3f37", onBgSoft: "#6b5e55", bgLine: "#e6dbd0", panel: "#ffffff", ink: "#4b3f37", soft: "#6b5e55", line: "#e6dbd0", accent: "#9a6a4f", onAccent: "#ffffff", accent2: "#a88a74", tint: "#f6f1ec", band: "#e6dbd0", deep: "#4b3f37", onDeep: "#ffffff", onDeepSoft: "#f6f1ec", orn: "#9a6a4f", orn2: "#a88a74", ph1: "#8a6f58", ph2: "#c8b294", ph3: "#a88f74" },
  sable: { name: "Sable", bg: "#f6f2ec", onBg: "#2b2622", onBgSoft: "#6a6158", bgLine: "#ddd4c8", panel: "#fbf8f4", ink: "#2b2622", soft: "#6a6158", line: "#ddd4c8", accent: "#2b2622", onAccent: "#fbf8f4", accent2: "#a26f63", tint: "#fbf8f4", band: "#ddd4c8", deep: "#3f342b", onDeep: "#ffffff", onDeepSoft: "#f6f2ec", orn: "#6a6158", orn2: "#a26f63", ph1: "#b39b86", ph2: "#4f4a45", ph3: "#d8cbbb" },
};

// Teintes proposées pour tous les modèles (le texte reste foncé sur un fond clair)
const TINTS = {
  sauge: { name: "Sauge", bg: "#eef0e8", panel: "#f8f9f4", ink: "#2f3326", soft: "#5d6352", line: "#d5dacb", accent: "#5a6b45", onAccent: "#ffffff", accent2: "#5a6b45", tint: "#e4e8dc", band: "#d5dacb", deep: "#5a6b45", onDeep: "#ffffff", onDeepSoft: "#e4e8dc", orn: "#7d8a6a", orn2: "#5a6b45", ph1: "#a3ab92", ph2: "#6c7353", ph3: "#c9cfbc" },
  rose: { name: "Rose poudré", bg: "#f8efeb", panel: "#fdf8f6", ink: "#3d2a25", soft: "#7a5d55", line: "#e8d3cb", accent: "#9a5a4a", onAccent: "#ffffff", accent2: "#9a5a4a", tint: "#f1ddd6", band: "#e8d3cb", deep: "#8c5e52", onDeep: "#ffffff", onDeepSoft: "#f8efeb", orn: "#c49a8c", orn2: "#9a5a4a", ph1: "#d9b7ab", ph2: "#a67c70", ph3: "#ecd6ce" },
  brume: { name: "Bleu brume", bg: "#eef2f5", panel: "#f8fafb", ink: "#1f2a35", soft: "#5a6672", line: "#cfd8e0", accent: "#3e5a72", onAccent: "#ffffff", accent2: "#3e5a72", tint: "#dfe5ea", band: "#c3ccd4", deep: "#3e5a72", onDeep: "#ffffff", onDeepSoft: "#dfe5ea", orn: "#8a9aaa", orn2: "#3e5a72", ph1: "#9fb0bf", ph2: "#5f7487", ph3: "#c7d2dc" },
};

// Couleurs d'un modèle : ses couleurs d'origine, un blanc pur, un fond très clair, puis les teintes
export function palettesFor(templateId) {
  const t = templateOf(templateId);
  const o = ORIGINS[t.palette];
  const light = (id, name, bg, panelBg) => ({
    id,
    name,
    swatch: [bg, o.accent],
    vars: {
      ...o,
      bg,
      onBg: o.ink,
      onBgSoft: o.soft,
      bgLine: o.line,
      // Panneaux de la couleur du fond dans la maquette : ils suivent le nouveau fond
      panel: o.panel === o.bg ? bg : panelBg || o.panel,
      tint: o.tint === o.bg ? bg : o.tint,
    },
  });
  const list = [
    { id: "origine", name: `${o.name}, d'origine`, swatch: [o.bg, o.accent], vars: o },
    light("blanc", "Blanc pur", "#ffffff", "#ffffff"),
    ...Object.entries(TINTS).map(([id, p]) => ({ id, name: p.name, swatch: [p.bg, p.accent], vars: { ...o, ...p, onBg: p.ink, onBgSoft: p.soft, bgLine: p.line } })),
  ];
  return list;
}

export function paletteOf(templateId, paletteId) {
  const list = palettesFor(templateId);
  return list.find((p) => p.id === paletteId) || list[0];
}

const CSS_NAMES = { onBg: "on-bg", onBgSoft: "on-bg-soft", bgLine: "bg-line", onAccent: "on-accent", onDeep: "on-deep", onDeepSoft: "on-deep-soft" };
export function paletteStyle(vars) {
  const out = {};
  for (const [k, v] of Object.entries(vars)) if (k !== "name") out[`--s-${CSS_NAMES[k] || k}`] = v;
  return out;
}

// ---------------------------------------------------------------------------
// Polices : un accord titre, écriture manuscrite, texte et petites capitales
// ---------------------------------------------------------------------------

// Un titre sobre au choix, Inter pour le texte ; pas d'écriture manuscrite
export const FONT_PAIRS = [
  { id: "cormorant", name: "Cormorant", display: "Cormorant Garamond", serif: "Cormorant Garamond", sans: "Inter", script: "Cormorant Garamond" },
  { id: "fraunces", name: "Fraunces", display: "Fraunces", serif: "Fraunces", sans: "Inter", script: "Fraunces" },
  { id: "gilda", name: "Gilda", display: "Gilda Display", serif: "Gilda Display", sans: "Inter", script: "Gilda Display" },
];

export function fontsOf(site) {
  const t = templateOf(site?.template);
  return FONT_PAIRS.find((f) => f.id === site?.fonts) || FONT_PAIRS.find((f) => f.id === t.fonts) || FONT_PAIRS[0];
}

const FALLBACK = { display: "serif", serif: "serif", sans: "sans-serif", script: "cursive" };
export function fontStyle(pair) {
  const out = {};
  for (const role of ["display", "serif", "sans", "script"]) out[`--f-${role}`] = `'${pair[role]}', ${FALLBACK[role]}`;
  out["--f-mono"] = "'DM Mono', monospace";
  return out;
}

// Graisses demandées à Google Fonts (une graisse absente fait échouer toute la feuille)
const FONT_SPECS = {
  Inter: "Inter:wght@300;400;500;600",
  Fraunces: "Fraunces:opsz,wght@9..144,300..500",
  Italiana: "Italiana",
  "Cormorant Garamond": "Cormorant+Garamond:ital,wght@0,300;0,400;0,500;1,300;1,400;1,500",
  Jost: "Jost:ital,wght@0,300;0,400;0,500;1,300",
  "Pinyon Script": "Pinyon+Script",
  "Bodoni Moda": "Bodoni+Moda:ital,opsz,wght@0,6..96,400;0,6..96,500;1,6..96,400",
  "Monsieur La Doulaise": "Monsieur+La+Doulaise",
  Cinzel: "Cinzel:wght@400;500;600",
  "DM Mono": "DM+Mono:wght@400;500",
  Mulish: "Mulish:wght@400;600",
  Allura: "Allura",
  "Mrs Saint Delafield": "Mrs+Saint+Delafield",
  Gloock: "Gloock",
  "Gilda Display": "Gilda+Display",
  "Playfair Display": "Playfair+Display:ital,wght@0,400;0,500;1,400",
  "Great Vibes": "Great+Vibes",
  Lora: "Lora:ital,wght@0,400;0,500;1,400",
  Karla: "Karla:wght@300;400;500",
  Marcellus: "Marcellus",
  "EB Garamond": "EB+Garamond:ital,wght@0,400;0,500;1,400",
  Montserrat: "Montserrat:wght@300;400;500",
  Parisienne: "Parisienne",
};

export function fontsHref(pairs) {
  const families = new Set(["DM Mono"]);
  for (const p of pairs) for (const role of ["display", "serif", "sans", "script"]) families.add(p[role]);
  return `https://fonts.googleapis.com/css2?${[...families].map((f) => `family=${FONT_SPECS[f] || f.replace(/ /g, "+")}`).join("&")}&display=swap`;
}

// ---------------------------------------------------------------------------
// Contenu
// ---------------------------------------------------------------------------

export const TRAVEL_KINDS = [
  { id: "train", label: "En train", short: "Train" },
  { id: "avion", label: "En avion", short: "Avion" },
  { id: "voiture", label: "En voiture", short: "Voiture" },
  { id: "navette", label: "Navettes", short: "Navette" },
  { id: "autre", label: "Autrement", short: "Autre" },
];

export const DEFAULT_WELCOME = "Merci d'avoir répondu. Voici tout ce qu'il faut savoir pour le week-end.";
export const DEFAULT_MOT = "Nous sommes si heureux de vous compter parmi nous. Voici le programme et l'essentiel pour le week-end.";

export function emptyContent() {
  return {
    welcome: DEFAULT_WELCOME,
    mot: DEFAULT_MOT,
    tagline: "",
    time: "",
    venue: { name: "", address: "", area: "", text: "" },
    moments: {},
    dress: { title: "", text: "", colors: [] },
    travel: [],
    stays: [],
    kids: { title: "", text: "" },
    story: { title: "", text: "" },
    citation: "",
    faq: [],
    contacts: [],
    whatsapp: "",
    photos: { cover: null, venue: null, citation: null, story: [], moments: [], album: [], ambiance: [] },
    // Écrits sur le site : les prénoms tels qu'ils y paraissent, et les petits titres des modèles remplacés
    names: { p1: "", p2: "" },
    labels: {},
    // Cadrage vertical des photos (20 : haut, 50 : centre, 80 : bas)
    crop: {},
  };
}

// Complète un contenu enregistré avec les champs ajoutés depuis
export function withDefaults(content) {
  const base = emptyContent();
  const c = content && typeof content === "object" ? content : {};
  return {
    ...base,
    ...c,
    venue: { ...base.venue, ...(c.venue || {}) },
    dress: { ...base.dress, ...(c.dress || {}), colors: Array.isArray(c.dress?.colors) ? c.dress.colors : [] },
    kids: { ...base.kids, ...(c.kids || {}) },
    story: { ...base.story, ...(c.story || {}) },
    moments: c.moments && typeof c.moments === "object" ? c.moments : {},
    travel: Array.isArray(c.travel) ? c.travel : [],
    stays: Array.isArray(c.stays) ? c.stays : [],
    faq: Array.isArray(c.faq) ? c.faq : [],
    contacts: Array.isArray(c.contacts) ? c.contacts : [],
    photos: { ...base.photos, ...(c.photos || {}) },
    names: { ...base.names, ...(c.names || {}) },
    labels: c.labels && typeof c.labels === "object" && !Array.isArray(c.labels) ? c.labels : {},
    crop: c.crop && typeof c.crop === "object" && !Array.isArray(c.crop) ? c.crop : {},
  };
}

// Adresse lisible et difficile à deviner : « stanislas-et-margue-k7q2 »
export function makeSiteSlug(wedding) {
  const names = [wedding?.partner1, wedding?.partner2].filter(Boolean).map((n) => normalize(n).replace(/[^a-z0-9]+/g, "-")).filter(Boolean);
  const base = (names.join("-et-") || "mariage").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
  const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
  let suffix = "";
  for (let i = 0; i < 4; i += 1) suffix += alphabet[Math.floor(Math.random() * alphabet.length)];
  return `${base}-${suffix}`;
}

export function siteUrl(slug) {
  if (typeof window === "undefined") return `/s/${slug}`;
  return `${window.location.origin}/s/${slug}`;
}

// Site de départ : le modèle qui va avec le style du brief, ses couleurs et sa police
export function defaultSite(data) {
  const template = templateForBrief(data.brief);
  const content = emptyContent();
  content.venue.name = data.wedding?.venue || "";
  content.venue.area = data.wedding?.region || data.brief?.region || "";
  return { slug: makeSiteSlug(data.wedding), published: true, template, palette: "origine", fonts: null, sections: defaultSections(template), content };
}

// ---------------------------------------------------------------------------
// Ce que les modèles affichent, à partir du tableau de bord ou de la fonction publique
// ---------------------------------------------------------------------------

const DAYS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

export function parseDay(iso) {
  if (!iso || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return null;
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d);
}

// « 16:30 » → « 16 h 30 », « 16:00 » → « 16 h »
export function hourText(t) {
  const m = /^(\d{1,2})[:h ]?(\d{2})?/.exec(String(t || "").trim());
  if (!m) return "";
  const h = Number(m[1]);
  const min = m[2] && m[2] !== "00" ? m[2] : "";
  return `${h} h${min ? ` ${min}` : ""}`;
}
export function hourClock(t) {
  const m = /^(\d{1,2})[:h ]?(\d{2})?/.exec(String(t || "").trim());
  return m ? `${m[1].padStart(2, "0")}:${m[2] || "00"}` : "";
}

export function dateParts(iso) {
  const d = parseDay(iso);
  if (!d) return null;
  return {
    date: d,
    day: d.getDate(),
    dd: String(d.getDate()).padStart(2, "0"),
    mm: String(d.getMonth() + 1).padStart(2, "0"),
    year: d.getFullYear(),
    yy: String(d.getFullYear()).slice(2),
    weekday: cap(DAYS[d.getDay()]),
    weekdayShort: `${cap(DAYS[d.getDay()]).slice(0, 3)}.`,
    month: cap(MONTHS[d.getMonth()]),
    monthLower: MONTHS[d.getMonth()],
    monthShort: MONTHS[d.getMonth()].length > 4 ? `${MONTHS[d.getMonth()].slice(0, MONTHS[d.getMonth()] === "juillet" ? 5 : 4)}.` : MONTHS[d.getMonth()],
    long: `${cap(DAYS[d.getDay()])} ${d.getDate() === 1 ? "1er" : d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`,
    noWeekday: `${d.getDate() === 1 ? "1er" : d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`,
    dayMonth: `${cap(DAYS[d.getDay()])} ${d.getDate() === 1 ? "1er" : d.getDate()} ${MONTHS[d.getMonth()]}`,
    dots: `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`,
  };
}

const firstName = (s) => String(s || "").trim().split(/\s+/)[0] || "";
const initialOf = (s) => (firstName(s).charAt(0) || "").toUpperCase();

// Un seul objet pour tous les modèles : noms, date, moments groupés par jour, contenu complété
export function siteView({ site, wedding, events, formSlug = null, preview = false }) {
  const content = withDefaults(site?.content);
  const p1 = content.names.p1 || firstName(wedding?.partner1) || "";
  const p2 = content.names.p2 || firstName(wedding?.partner2) || "";
  const dateIso = wedding?.wedding_date || null;
  const date = dateParts(dateIso);
  const moments = [...(events || [])]
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    .map((e) => {
      const extra = content.moments[e.id] || {};
      return {
        id: e.id,
        name: extra.name || e.name,
        kind: e.kind || null,
        dateIso: e.event_date || dateIso,
        date: dateParts(e.event_date || dateIso),
        time: extra.time || "",
        place: extra.place || "",
        address: extra.address || "",
        text: extra.text || "",
        hidden: !!extra.hidden,
      };
    })
    .filter((m) => !m.hidden);
  const days = [];
  for (const m of moments) {
    const key = m.dateIso || "";
    let day = days.find((d) => d.key === key);
    if (!day) days.push((day = { key, date: m.date, moments: [] }));
    day.moments.push(m);
  }
  days.sort((a, b) => (a.key || "9999").localeCompare(b.key || "9999"));
  for (const d of days) d.moments.sort((a, b) => (a.time || "99").localeCompare(b.time || "99"));
  const main = moments.find((m) => m.dateIso === dateIso && /ceremon|cérémon|laique|laïque|religieu|eglise|église/.test(normalize(m.name))) || moments.find((m) => m.dateIso === dateIso && m.time) || null;
  const time = content.time || main?.time || "";
  const first = days[0]?.date;
  const last = days[days.length - 1]?.date;
  const venueName = content.venue.name || wedding?.venue || "";
  const venueAddress = content.venue.address || "";
  const area = content.venue.area || wedding?.region || "";
  return {
    preview,
    p1,
    p2,
    names: [p1, p2].filter(Boolean).join(" & ") || "Notre mariage",
    namesEt: [p1, p2].filter(Boolean).join(" et "),
    initials: [initialOf(p1), initialOf(p2)].filter(Boolean),
    dateIso,
    date,
    time,
    timeText: hourText(time),
    venueName,
    venueAddress,
    area,
    place: venueAddress ? venueAddress.split(",").pop().replace(/^\s*\d{5}\s*/, "").trim() || area : area,
    weekend: first && last && first.date.getTime() !== last.date.getTime() ? { first, last } : null,
    days,
    moments,
    content,
    // Aperçu du tableau de bord : les emplacements vides montrent une photo d'exemple
    photos: preview ? withExamples(content.photos) : content.photos,
    formSlug,
  };
}

// Une rubrique a-t-elle de quoi s'afficher ? (vide : masquée pour les invités, signalée dans l'aperçu)
export function hasContent(key, v) {
  const c = v.content;
  switch (key) {
    case "mot":
      return !!c.mot?.trim();
    case "jour":
      return !!v.date;
    case "programme":
      return v.moments.length > 0;
    case "lieu":
      return !!(v.venueName || v.venueAddress);
    case "tenue":
      return !!(c.dress.title || c.dress.text || c.dress.colors.length);
    case "pratique":
      return !!(c.travel.length || c.stays.length || c.kids.title || c.kids.text || c.dress.title || c.dress.text);
    case "histoire":
      return !!(c.story.text?.trim() || c.photos.story?.length);
    case "moments":
      return !!c.photos.moments?.length;
    case "citation":
      return !!(c.citation?.trim() || c.photos.citation);
    case "album":
      return true;
    case "reponse":
      return true;
    case "questions":
      return !!(c.faq.length || c.contacts.length);
    case "partage":
      return true;
    default:
      return false;
  }
}

// ---------------------------------------------------------------------------
// Liens utiles : agenda (.ics), itinéraire, écrire à un témoin
// ---------------------------------------------------------------------------

export function mapsUrl(address) {
  return address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}` : null;
}

export function contactHref(c) {
  const x = String(c?.reach || "").trim();
  if (!x) return null;
  if (/^https?:\/\//.test(x)) return x;
  if (/@/.test(x)) return `mailto:${x}`;
  const tel = x.replace(/[^\d+]/g, "");
  return tel.length >= 6 ? `tel:${tel}` : null;
}

const icsText = (s) => String(s || "").replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/[,;]/g, (m) => `\\${m}`);
const icsStamp = (iso, time) => {
  const [y, m, d] = iso.split("-");
  const t = hourClock(time || "") || "";
  return t ? `${y}${m}${d}T${t.replace(":", "")}00` : `${y}${m}${d}`;
};

// Fichier agenda : un événement par moment (heure locale), ou la journée du mariage
export function icsFile(v) {
  const items = v.moments.filter((m) => m.dateIso).length ? v.moments.filter((m) => m.dateIso) : v.dateIso ? [{ id: "jour", name: v.names, dateIso: v.dateIso, time: v.time, place: v.venueName, address: v.venueAddress }] : [];
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Merry//Site de mariage//FR", "CALSCALE:GREGORIAN"];
  for (const m of items) {
    const start = icsStamp(m.dateIso, m.time);
    const allDay = start.length === 8;
    lines.push(
      "BEGIN:VEVENT",
      `UID:${m.id}@merry`,
      `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").slice(0, 15)}Z`,
      allDay ? `DTSTART;VALUE=DATE:${start}` : `DTSTART:${start}`,
      allDay ? "" : `DURATION:PT3H`,
      `SUMMARY:${icsText(`${m.name} · ${v.names}`)}`,
      `LOCATION:${icsText([m.place, m.address].filter(Boolean).join(", "))}`,
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return lines.filter(Boolean).join("\r\n");
}

export function downloadIcs(v) {
  const blob = new Blob([icsFile(v)], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${normalize(v.names).replace(/[^a-z0-9]+/g, "-") || "mariage"}.ics`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Réponse donnée au formulaire invités sur ce navigateur (gardée par /f/[slug] après l'envoi)
export const RESPONSE_KEY = (formSlug) => `merry-reponse:${formSlug}`;
