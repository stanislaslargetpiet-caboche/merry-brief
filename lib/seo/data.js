// Pages SEO : lecture du catalogue côté serveur, avec la clé de service (le schéma « catalog » et les photos
// ne sont pas lisibles par la clé publique). Seules des colonnes publiques sortent d'ici : jamais email,
// téléphone, site ni SIRET. Les comptes et médianes sont recalculés une fois par jour.

import { createClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";
import { coverFirst } from "@/lib/dash/catalog";
import { DEPARTMENTS, FRANCE, REGIONS, codesOf, departmentOf, regionZone, zoneOf } from "./geo";
import { MIN_PRICED, MIN_VENDORS, PRICE_UNIT, TRADES, tradeOf, tradeOfCategory } from "./trades";

export const APP_URL = "https://app.withmerry.com";
export const REVALIDATE = 86400;
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

async function loadStats() {
  const db = admin();
  if (!db) return null;
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db
      .schema("catalog")
      .from("vendors")
      .select("primary_category, department, price_min, price_unit")
      .eq("status", "active")
      .in("primary_category", CATEGORIES)
      .order("id")
      .range(from, from + 999);
    if (error) throw new Error(`[seo] catalogue illisible : ${error.message}`);
    rows.push(...data);
    if (data.length < 1000) break;
  }
  const acc = {};
  const add = (trade, key, price) => {
    const zones = (acc[trade] ||= {});
    const s = (zones[key] ||= { n: 0, prices: [] });
    s.n += 1;
    if (price) s.prices.push(price);
  };
  for (const r of rows) {
    const trade = tradeOfCategory(r.primary_category);
    const dep = departmentOf(r.department);
    if (!trade || !dep) continue;
    const price = r.price_unit === trade.unit && Number(r.price_min) > 0 ? Number(r.price_min) : null;
    for (const key of ["france", `r:${dep.region}`, `d:${dep.code}`]) add(trade.slug, key, price);
  }
  const stats = {};
  for (const [trade, zones] of Object.entries(acc)) {
    stats[trade] = {};
    for (const [key, s] of Object.entries(zones)) {
      stats[trade][key] = { n: s.n, priced: s.prices.length, median: s.prices.length >= MIN_PRICED ? median(s.prices) : null };
    }
  }
  return { at: new Date().toISOString(), stats };
}

export const getStats = unstable_cache(loadStats, ["seo-stats-v1"], { revalidate: REVALIDATE });

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
export const euros = (n) => `${fmt.format(n)} €`;

function toCard(row, photo) {
  const dep = departmentOf(row.department);
  const specs = [];
  if (row.capacity_seated) specs.push({ icon: "seats", text: `${row.capacity_seated} places assises` });
  if (row.beds) specs.push({ icon: "beds", text: `${row.beds} couchages` });
  if (row.station_minutes !== null && row.station_minutes !== undefined) specs.push({ icon: "train", text: `${row.station_minutes} min de la gare ${row.station_name || "TGV"}` });
  const price = Number(row.price_min) > 0 ? { value: euros(Number(row.price_min)), unit: PRICE_UNIT[row.price_unit] || "" } : null;
  return { id: row.id, name: row.name, area: dep?.name || "", specs, price, photo };
}

// Les six prestataires mis en avant : ceux qui ont des photos d'abord, puis les plus « mariage »
async function loadVendors(tradeSlug, zoneSlug) {
  const db = admin();
  const trade = tradeOf(tradeSlug);
  const zone = zoneSlug ? zoneOf(zoneSlug) : FRANCE;
  if (!db || !trade || !zone) return [];
  let q = db
    .schema("catalog")
    .from("vendors")
    .select("id, name, department, capacity_seated, beds, price_min, price_unit, station_minutes, station_name, photos_count")
    .eq("status", "active")
    .in("primary_category", trade.catalog);
  if (zone.kind !== "france") q = q.in("department", codesOf(zone));
  const { data, error } = await q
    .order("photos_count", { ascending: false, nullsFirst: false })
    .order("wedding_signal", { ascending: false, nullsFirst: false })
    .order("id")
    .limit(6);
  if (error) throw new Error(`[seo] prestataires illisibles : ${error.message}`);
  const ids = data.map((v) => v.id);
  const covers = new Map();
  if (ids.length) {
    const { data: ph } = await db.schema("catalog").from("vendor_photos").select("vendor_id, position, storage_path, width, height").in("vendor_id", ids).order("position");
    const by = new Map();
    for (const p of ph || []) by.set(p.vendor_id, [...(by.get(p.vendor_id) || []), p]);
    const picks = [...by.values()].map((list) => coverFirst(list)[0]);
    if (picks.length) {
      const { data: signed } = await db.storage.from("catalog-photos").createSignedUrls(picks.map((p) => p.storage_path), PHOTO_TTL);
      const urlOf = new Map((signed || []).map((x) => [x.path, x.signedUrl]));
      for (const p of picks) covers.set(p.vendor_id, urlOf.get(p.storage_path) || null);
    }
  }
  return data.map((row) => toCard(row, covers.get(row.id) || null));
}

export const getVendors = unstable_cache(loadVendors, ["seo-vendors-v1"], { revalidate: REVALIDATE });
