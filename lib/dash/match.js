// Prestataires : la note de l'IA pour chaque prestataire du catalogue, pour ce couple
// (app/api/prestataires/match). Gardée dans vendor_matches (supabase/prestataires.sql, partie E)
// par mariage et par empreinte du contexte : on ne repaie pas une note tant que le brief et
// les envies ne changent pas. Sans la table, gardée le temps de la session du navigateur.

import { supabase } from "@/lib/supabase";

// Ce que l'IA doit savoir du couple : brief, mariage, envies et description libre
export function coupleContext(data) {
  const w = data.wedding || {};
  const b = data.brief || {};
  const wishes = data.wishes?.wishes || {};
  const guests = (data.guests || []).filter((g) => !g.plus_one_of).length;
  const ctx = {
    date: w.wedding_date || b.wedding_date || undefined,
    region: w.region || b.region || undefined,
    lieu_choisi: w.venue || undefined,
    invites: guests || b.guests || undefined,
    budget_total: w.budget_total || b.budget || undefined,
    format: b.format || undefined,
    ambiance: (b.vibes || []).length ? b.vibes : undefined,
    envies: {
      aeroport_max_min: wishes.airport?.on ? wishes.airport.max || "proche" : undefined,
      gare_max_min: wishes.station?.on ? wishes.station.max || "proche" : undefined,
      pres_de: wishes.city?.name ? `${wishes.city.name}${wishes.city.max ? `, ${wishes.city.max} min au plus` : ""}` : undefined,
      acces: (wishes.access || []).length ? wishes.access : undefined,
      places_assises_min: wishes.seats || undefined,
      couchages_min: wishes.beds || undefined,
      lieu: (wishes.venue || []).length ? wishes.venue : undefined,
      traiteur: wishes.caterer || undefined,
      description: wishes.style?.trim() || undefined,
      criteres: (wishes.criteria || []).length ? wishes.criteria : undefined,
    },
  };
  return JSON.parse(JSON.stringify(ctx));
}

// Empreinte courte et stable du contexte (FNV-1a)
export function contextKey(ctx, category) {
  const s = `${category}|${JSON.stringify(ctx)}`;
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return `v1-${h.toString(36)}`;
}

const MEMO = new Map();
let tableMissing = false;
// « off » : pas de clé IA côté serveur (ou quota atteint) ; on ne redemande pas pendant la session
let aiState = "unknown";

function sessionGet(key) {
  try {
    const raw = window.sessionStorage.getItem(`merry-match:${key}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function sessionSet(key, value) {
  try {
    window.sessionStorage.setItem(`merry-match:${key}`, JSON.stringify(value));
  } catch {
    /* stockage indisponible */
  }
}

const INFLIGHT = new Map();

// Appel à la route : { state: "on" | "off" | "error", matches }
async function requestScores(payload) {
  const { data: sess } = await supabase.auth.getSession();
  const token = sess?.session?.access_token;
  if (!token) return { state: "off", matches: [] };
  let res;
  try {
    res = await fetch("/api/prestataires/match", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    });
  } catch {
    return { state: "error", matches: [] };
  }
  if (res.status === 501 || res.status === 429) {
    aiState = "off";
    return { state: "off", matches: [] };
  }
  if (!res.ok) return { state: "error", matches: [] };
  aiState = "on";
  const { matches = [] } = await res.json();
  return { state: "on", matches };
}

// Renvoie { matches: Map(catalogId → { score, why, story, checks }), ai: "on" | "off" | "error" }
export async function scoreVendors({ data, category, vendors, center }) {
  const ids = vendors.map((v) => v.catalogId).filter(Boolean);
  const out = new Map();
  if (!ids.length || !supabase) return { matches: out, ai: "off" };
  const weddingId = data.wedding.id;
  const ctx = coupleContext(data);
  const key = contextKey(ctx, category);
  const memoKey = (id) => `${weddingId}:${key}:${id}`;

  for (const id of ids) {
    const m = MEMO.get(memoKey(id)) || sessionGet(memoKey(id));
    if (m) out.set(id, m);
  }
  let missing = ids.filter((id) => !out.has(id));
  if (missing.length && !tableMissing) {
    const { data: rows, error } = await supabase.from("vendor_matches").select("catalog_id, score, why, story, checks").eq("wedding_id", weddingId).eq("context", key).in("catalog_id", missing);
    if (error) tableMissing = true;
    for (const r of rows || []) {
      const m = { score: r.score, why: r.why, story: r.story, checks: r.checks || [] };
      out.set(r.catalog_id, m);
      MEMO.set(memoKey(r.catalog_id), m);
    }
    missing = ids.filter((id) => !out.has(id));
  }
  if (!missing.length) return { matches: out, ai: "on" };
  if (aiState === "off") return { matches: out, ai: "off" };

  // Même demande déjà en route (deux composants, ou double rendu en développement) : on l'attend
  const flightKey = `${weddingId}:${key}:${[...missing].sort().join(",")}`;
  if (!INFLIGHT.has(flightKey)) {
    INFLIGHT.set(
      flightKey,
      requestScores({ category, ids: missing, couple: ctx, center }).finally(() => setTimeout(() => INFLIGHT.delete(flightKey), 0)),
    );
  }
  const reply = await INFLIGHT.get(flightKey);
  if (reply.state !== "on") return { matches: out, ai: reply.state };
  const matches = reply.matches;
  // Une autre attente sur la même demande l'a déjà gardée : rien à réenregistrer
  const alreadySaved = matches.length && matches.every((m) => MEMO.has(memoKey(m.id)));
  const fresh = [];
  for (const m of matches) {
    const v = { score: m.score, why: m.why || null, story: m.story || null, checks: m.checks || [] };
    out.set(m.id, v);
    MEMO.set(memoKey(m.id), v);
    if (tableMissing) sessionSet(memoKey(m.id), v);
    fresh.push({ wedding_id: weddingId, catalog_id: m.id, context: key, ...v });
  }
  if (fresh.length && !tableMissing && !alreadySaved) {
    const { error } = await supabase.from("vendor_matches").upsert(fresh, { onConflict: "wedding_id,catalog_id,context" });
    if (error) {
      tableMissing = true;
      for (const f of fresh) sessionSet(memoKey(f.catalog_id), { score: f.score, why: f.why, story: f.story, checks: f.checks });
    }
  }
  return { matches: out, ai: "on" };
}

// En dessous, le prestataire n'est pas proposé (pas fait pour un mariage, trop loin, hors sujet)
export const MIN_SCORE = 30;
// Au-dessus, le premier de la liste porte « Meilleur match »
export const BEST_SCORE = 75;
