// Pages SEO : lecture du catalogue côté serveur, avec la clé de service (le schéma « catalog » et les photos
// ne sont pas lisibles par la clé publique). Seules des colonnes publiques sortent d'ici : jamais email,
// téléphone, site ni SIRET. Les comptes et médianes sont recalculés une fois par jour.

import { createClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";
import { coverFirst } from "@/lib/dash/catalog";
import { DEPARTMENTS, FRANCE, REGIONS, codesOf, departmentOf, regionZone, zoneOf } from "./geo";
import { CANDIDATES, pickVendors } from "./selection";
import { MIN_PRICED, MIN_VENDORS, PRICE_UNIT, TRADES, tradeOf, tradeOfCategory } from "./trades";

// Adresse publique des pages SEO (canonical, sitemap, données structurées) : le domaine principal
export const PUBLIC_URL = "https://www.withmerry.com";
export const REVALIDATE = 86400;
// Étiquette des caches SEO : /api/interne/seo-rafraichir les vide d'un coup après un enrichissement du catalogue
export const SEO_TAG = "seo";
const PHOTO_TTL = 8 * 86400;

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !service) return null;
  return createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
}

const CATEGORIES = TRADES.flatMap((t) => t.catalog);

const keyOf = (zone) => (zone.kind === "france" ? "france" : zone.kind === "region" ? `r:${zone.region}` : `d:${zone.code}`);

function median(list) {
  const s = [...list].sort((a, b) => a - b);
  const m = s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
  return Math.round(m / 10) * 10;
}

const PAGE = 500;

async function readPage(db, last) {
  for (let attempt = 0; ; attempt += 1) {
    let query = db
      .schema("catalog")
      .from("vendors")
      .select("id, primary_category, department, price_min, price_unit")
      .eq("status", "active")
      .in("primary_category", CATEGORIES)
      .order("id")
      .limit(PAGE);
    if (last) query = query.gt("id", last);
    const { data, error } = await query;
    if (!error) return data;
    if (attempt >= 3) throw new Error(`[seo] catalogue illisible : ${error.message}`);
    await new Promise((resolve) => setTimeout(resolve, 1500 * (attempt + 1)));
  }
}

// Lecture normale : une requête agrégée (supabase/seo-stats.sql). Les lignes sont groupées par métier,
// département et unité de prix ; null si la fonction n'est pas encore installée.
async function readGroups(db) {
  const { data, error } = await db.rpc("seo_catalog_stats");
  if (error) {
    const missing = String(error.code) === "PGRST202" || String(error.code) === "42883";
    if (!missing) console.warn(`[seo] seo_catalog_stats : ${error.message}`);
    return null;
  }
  // Un tableau JSON en une seule valeur : pas de limite de lignes à craindre
  return Array.isArray(data) ? data : null;
}

// Repli tant que supabase/seo-stats.sql n'est pas collé : toutes les fiches, par pages courtes reprises
// après le dernier id, avec réessais. Plus lent, et fragile quand la base lit ces lignes à froid.
async function readRowsAsGroups(db) {
  const rows = [];
  for (let last = null; ; last = rows[rows.length - 1].id) {
    const data = await readPage(db, last);
    rows.push(...data);
    if (data.length < PAGE) break;
  }
  return rows.map((r) => ({ primary_category: r.primary_category, department: r.department, price_unit: r.price_unit, n: 1, prices: Number(r.price_min) > 0 ? [Number(r.price_min)] : [] }));
}

// Des groupes (métier du catalogue, département, unité de prix) aux comptes et médianes par métier et par
// zone : fonction pure, testée. Un prix ne compte que dans l'unité retenue pour le métier.
export function buildStats(groups) {
  const acc = {};
  const add = (trade, key, n, prices) => {
    const zones = (acc[trade] ||= {});
    const s = (zones[key] ||= { n: 0, prices: [] });
    s.n += n;
    if (prices.length) s.prices.push(...prices);
  };
  for (const g of groups || []) {
    const trade = tradeOfCategory(g.primary_category);
    const dep = departmentOf(g.department);
    if (!trade || !dep) continue;
    const prices = g.price_unit === trade.unit ? (g.prices || []).map(Number).filter((p) => p > 0) : [];
    for (const key of ["france", `r:${dep.region}`, `d:${dep.code}`]) add(trade.slug, key, Number(g.n) || 0, prices);
  }
  const stats = {};
  for (const [trade, zones] of Object.entries(acc)) {
    stats[trade] = {};
    for (const [key, s] of Object.entries(zones)) {
      stats[trade][key] = { n: s.n, priced: s.prices.length, median: s.prices.length >= MIN_PRICED ? median(s.prices) : null };
    }
  }
  return stats;
}

async function loadStats() {
  const db = admin();
  if (!db) return null;
  const groups = (await readGroups(db)) || (await readRowsAsGroups(db));
  return { at: new Date().toISOString(), stats: buildStats(groups) };
}

export const getStats = unstable_cache(loadStats, ["seo-stats-v1"], { revalidate: REVALIDATE, tags: [SEO_TAG] });

export function statOf(stats, trade, zone) {
  return stats?.stats?.[trade.slug]?.[keyOf(zone)] || { n: 0, priced: 0, median: null };
}

export function hasPage(stats, trade, zone) {
  return statOf(stats, trade, zone).n >= MIN_VENDORS;
}

export function hrefOf(trade, zone) {
  return zone.kind === "france" ? `/mariage/${trade.slug}` : `/mariage/${trade.slug}/${zone.slug}`;
}

// Toutes les pages qui existent, pour le sitemap
export function allPages(stats) {
  const zones = [FRANCE, ...REGIONS.map((r) => regionZone(r.name)), ...DEPARTMENTS.map((d) => zoneOf(d.slug))];
  return TRADES.flatMap((trade) => zones.filter((zone) => hasPage(stats, trade, zone)).map((zone) => ({ trade, zone, href: hrefOf(trade, zone) })));
}

const fmt = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });
export const num = (n) => fmt.format(n);
export const euros = (n) => `${fmt.format(n)} €`;

// Les noms viennent de Google : « Kellygraphie | Photographe de mariage », « MOULIN VERT - Salles de Réception ».
// On garde le nom, sans le descriptif ajouté pour le référencement, et sans les capitales d'affiche.
const DESCRIPTOR = /(photo|vid[ée]o|traiteur|mariage|wedding|salle|r[ée]ception|[ée]v[ée]nement|dj\b|musique|fleur|domaine|location|lieu)/i;
export function cleanName(raw) {
  let name = String(raw || "").trim();
  name = name.split(/\s+\|\s+/)[0];
  const parts = name.split(/\s+[-–]\s+/);
  if (parts.length > 1 && parts[0].length >= 3 && parts.slice(1).some((p) => DESCRIPTOR.test(p))) name = parts[0];
  const letters = name.replace(/[^A-Za-zÀ-ÿ]/g, "");
  if (letters.length > 3 && letters === letters.toUpperCase()) {
    name = name.toLowerCase().replace(/(^|[\s'’-])(\p{L})/gu, (_, sep, c) => sep + c.toUpperCase());
  }
  return name.charAt(0).toUpperCase() + name.slice(1);
}

// « 13 min de Paris Gare du Nord », « 21 min de la gare de Mantes-la-Jolie », « 25 min de la gare d'Avignon TGV »
function stationText(minutes, name) {
  const n = String(name || "").trim();
  if (!n) return `${minutes} min d'une gare TGV`;
  if (/\bgare\b/i.test(n) || /^paris\b/i.test(n)) return `${minutes} min de ${n}`;
  return `${minutes} min de la gare ${/^[aeiouyàâéèêîôûh]/i.test(n) ? "d'" : "de "}${n}`;
}

function toCard(row, photo) {
  const dep = departmentOf(row.department);
  const specs = [];
  if (row.capacity_seated) specs.push({ icon: "seats", text: `${num(row.capacity_seated)} places assises` });
  if (row.beds) specs.push({ icon: "beds", text: `${num(row.beds)} couchages` });
  if (row.station_minutes !== null && row.station_minutes !== undefined) specs.push({ icon: "train", text: stationText(row.station_minutes, row.station_name) });
  const price = Number(row.price_min) > 0 ? { value: euros(Number(row.price_min)), unit: PRICE_UNIT[row.price_unit] || "" } : null;
  return { id: row.id, name: cleanName(row.name), area: dep?.name || "", specs, price, photo };
}

// Les prestataires mis en avant (six, ou `cards` pour un petit métier) : ceux qui ont des photos d'abord, puis les plus « mariage »
async function loadVendors(tradeSlug, zoneSlug) {
  const db = admin();
  const trade = tradeOf(tradeSlug);
  const zone = zoneSlug ? zoneOf(zoneSlug) : FRANCE;
  if (!db || !trade || !zone) return [];
  const cards = trade.cards || 6;
  let q = db
    .schema("catalog")
    .from("vendors")
    .select("id, name, department, capacity_seated, beds, price_min, price_unit, station_minutes, station_name, photos_count, google_categories")
    .eq("status", "active")
    // Les fiches ajoutées à la main par un couple restent hors des pages publiques tant qu'elles n'ont pas été relues
    .is("created_by_wedding", null)
    .in("primary_category", trade.catalog);
  if (zone.kind !== "france") q = q.in("department", codesOf(zone));
  const { data: rows, error } = await q
    .order("photos_count", { ascending: false, nullsFirst: false })
    .order("wedding_signal", { ascending: false, nullsFirst: false })
    .order("id")
    .limit(trade.selection ? CANDIDATES : cards);
  if (error) throw new Error(`[seo] prestataires illisibles : ${error.message}`);
  // Métiers aux catalogues mélangés : les fiches qui relèvent du métier passent avant celles qui n'en sont pas
  const data = pickVendors(rows, trade, cards);
  const ids = data.map((v) => v.id);
  const covers = new Map();
  if (ids.length) {
    const { data: ph } = await db.schema("catalog").from("vendor_photos").select("vendor_id, position, storage_path, width, height, screenshot, shot_type").in("vendor_id", ids).order("position");
    const by = new Map();
    for (const p of ph || []) by.set(p.vendor_id, [...(by.get(p.vendor_id) || []), p]);
    const picks = [...by.values()].map((list) => coverFirst(list)[0]);
    if (picks.length) {
      const { data: signed } = await db.storage.from("catalog-photos").createSignedUrls(picks.map((p) => p.storage_path), PHOTO_TTL);
      const urlOf = new Map((signed || []).map((x) => [x.path, x.signedUrl]));
      for (const p of picks) covers.set(p.vendor_id, urlOf.get(p.storage_path) || null);
    }
  }
  return data.map((row) => ({ ...row, photo: covers.get(row.id) || null }));
}

const cachedVendors = unstable_cache(loadVendors, ["seo-vendors-v3"], { revalidate: REVALIDATE, tags: [SEO_TAG] });

// La mise en forme reste hors du cache : une correction de texte se voit au prochain rendu
export async function getVendors(tradeSlug, zoneSlug) {
  return (await cachedVendors(tradeSlug, zoneSlug)).map((row) => toCard(row, row.photo));
}
