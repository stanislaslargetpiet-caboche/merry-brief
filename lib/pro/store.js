"use client";

// Espace prestataire : la fiche du catalogue que gère le prestataire connecté, et tout ce qui va avec
// (tarifs, dates, clients, demandes des couples, crédits). Séparé du tableau de bord des couples :
// mêmes comptes Supabase, mais seules les fiches de pro_members s'ouvrent ici.
// Avec ?demo=1 (ou sans Supabase), on tourne sur les données d'exemple des maquettes.

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { uid } from "@/lib/dash/format";
import { buildProDemo } from "./demo";

const ProContext = createContext(null);

const DEMO_KEY = "merry-pro-demo-v1";
const DEMO_FLAG = "merry-pro-demo";
const VENDOR_KEY = "merry-pro-vendor";
export const PHOTO_MAX_BYTES = 5 * 1024 * 1024;
export const FILE_MAX_BYTES = 50 * 1024 * 1024;

// Fichier SQL pas encore lancé : la fonction ou la table n'existe pas
const isMissing = (error) => error && /PGRST202|PGRST205|42P01|42883|Could not find/i.test(`${error.code} ${error.message}`);

function readDemoFlag() {
  if (typeof window === "undefined") return false;
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get("demo") === "1") window.sessionStorage.setItem(DEMO_FLAG, "1");
    if (params.get("demo") === "0") window.sessionStorage.removeItem(DEMO_FLAG);
    return window.sessionStorage.getItem(DEMO_FLAG) === "1";
  } catch {
    return false;
  }
}

function loadDemo() {
  try {
    const raw = window.localStorage.getItem(DEMO_KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      if (saved?.version === 1 && saved.data?.vendor) return saved.data;
    }
  } catch {
    /* stockage indisponible */
  }
  return buildProDemo();
}

function saveDemo(data) {
  try {
    window.localStorage.setItem(DEMO_KEY, JSON.stringify({ version: 1, data }));
  } catch {
    /* stockage indisponible */
  }
}

// Liens signés des photos et fichiers privés
async function signed(bucket, paths, seconds = 3600) {
  if (!paths.length) return new Map();
  const { data } = await supabase.storage.from(bucket).createSignedUrls(paths, seconds);
  return new Map((data || []).filter((x) => x.signedUrl).map((x) => [x.path, x.signedUrl]));
}

const extOf = (file) => (file.name.match(/\.([a-z0-9]{1,5})$/i)?.[1] || "bin").toLowerCase();

export function ProProvider({ children }) {
  // loading | claim (pas de fiche : revendiquer) | ready | setup (fichier SQL à lancer) | error
  const [state, setState] = useState({ status: "loading", mode: null, data: null, error: null });
  const [toast, setToast] = useState(null);
  const dataRef = useRef(null);
  const modeRef = useRef(null);

  const setData = useCallback((updater) => {
    setState((s) => {
      if (!s.data) return s;
      const next = typeof updater === "function" ? updater(s.data) : updater;
      dataRef.current = next;
      if (modeRef.current === "demo") saveDemo(next);
      return { ...s, data: next };
    });
  }, []);

  const load = useCallback(async () => {
    if (!supabase || readDemoFlag()) {
      modeRef.current = "demo";
      // Démo de l'écran « Revendiquer sa fiche » (V0) : /pro?demo=1&revendiquer=1
      if (new URLSearchParams(window.location.search).get("revendiquer") === "1") {
        setState({ status: "claim", mode: "demo", data: null, error: null });
        return;
      }
      const data = loadDemo();
      dataRef.current = data;
      setState({ status: "ready", mode: "demo", data, error: null });
      return;
    }
    modeRef.current = "live";
    const { data: auth } = await supabase.auth.getUser();
    if (!auth?.user) {
      setState({ status: "claim", mode: "live", data: null, error: null });
      return;
    }
    const me = await supabase.rpc("pro_me");
    if (isMissing(me.error)) {
      setState({ status: "setup", mode: "live", data: null, error: null });
      return;
    }
    if (me.error) {
      setState({ status: "error", mode: "live", data: null, error: me.error.message });
      return;
    }
    const mine = me.data || [];
    if (!mine.length) {
      setState({ status: "claim", mode: "live", data: { user: { email: auth.user.email } }, error: null });
      return;
    }
    let wanted = null;
    try {
      wanted = window.localStorage.getItem(VENDOR_KEY);
    } catch {
      /* ignore */
    }
    const vid = (mine.find((m) => m.vendor_id === wanted) || mine[0]).vendor_id;
    try {
      const data = await loadLive(vid, auth.user);
      data.vendors = mine.map((m) => m.vendor_id);
      dataRef.current = data;
      setState({ status: "ready", mode: "live", data, error: null });
    } catch (e) {
      setState({ status: "error", mode: "live", data: null, error: e?.message || String(e) });
    }
  }, []);

  useEffect(() => {
    load();
    if (!supabase) return undefined;
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT") load();
    });
    return () => sub.subscription.unsubscribe();
  }, [load]);

  const demo = () => modeRef.current === "demo";
  const vendorId = () => dataRef.current?.vendor?.id;
  const fail = useCallback((error, what) => {
    console.warn(`[merry pro] ${what}`, error?.message || error);
    setToast({ kind: "error", text: `${what} n’a pas pu être enregistré. Vérifiez votre connexion, puis réessayez.` });
  }, []);

  // ---------- Ma fiche ----------

  // Les modifications partent tout de suite à l'écran, puis vers le catalogue (pro_save_fiche)
  const saveFiche = useCallback(
    async (patch) => {
      setData((d) => {
        const { details: dp, ...rest } = splitDetails(patch);
        return { ...d, vendor: { ...d.vendor, ...rest, details: { ...d.vendor.details, ...dp } } };
      });
      if (demo()) return true;
      const { error } = await supabase.rpc("pro_save_fiche", { v: vendorId(), patch });
      if (error) fail(error, "La fiche");
      return !error;
    },
    [setData, fail],
  );

  const setPhotos = useCallback(
    async (photos) => {
      setData((d) => ({ ...d, photos }));
      if (demo()) return true;
      const { error } = await supabase.rpc("pro_set_photos", { v: vendorId(), paths: photos.map((p) => p.path) });
      if (error) fail(error, "L’ordre des photos");
      return !error;
    },
    [setData, fail],
  );

  const addPhotos = useCallback(
    async (files) => {
      const list = [...files].filter((f) => /^image\/(jpeg|png|webp)$/.test(f.type));
      const tooBig = list.filter((f) => f.size > PHOTO_MAX_BYTES);
      if (tooBig.length) setToast({ kind: "error", text: "Une photo dépasse 5 Mo : réduisez-la, puis ajoutez-la de nouveau." });
      const ok = list.filter((f) => f.size <= PHOTO_MAX_BYTES);
      if (!ok.length) return;
      const added = [];
      for (const f of ok) {
        if (demo()) {
          added.push({ path: `demo/${uid()}.${extOf(f)}`, url: URL.createObjectURL(f) });
          continue;
        }
        const path = `${vendorId()}/pro-${uid()}.${extOf(f)}`;
        const { error } = await supabase.storage.from("catalog-photos").upload(path, f, { contentType: f.type });
        if (error) {
          fail(error, "La photo");
          continue;
        }
        const urls = await signed("catalog-photos", [path]);
        added.push({ path, url: urls.get(path) });
      }
      if (added.length) await setPhotos([...(dataRef.current.photos || []), ...added]);
    },
    [setPhotos, fail],
  );

  const removePhoto = useCallback(
    async (path) => {
      await setPhotos(dataRef.current.photos.filter((p) => p.path !== path));
      // Les photos lues par Merry (1.webp…) restent dans le stockage ; celles du prestataire partent
      if (!demo() && /\/pro-/.test(path)) await supabase.storage.from("catalog-photos").remove([path]);
    },
    [setPhotos],
  );

  // Vidéo importée : rangée dans pro-fichiers, son lien privé tient lieu de lien de vidéo
  const uploadVideo = useCallback(
    async (file) => {
      if (file.size > FILE_MAX_BYTES) {
        setToast({ kind: "error", text: "La vidéo dépasse 50 Mo : déposez-la sur YouTube ou Vimeo, puis collez son lien." });
        return;
      }
      if (demo()) {
        await saveFiche({ video_url: `fichier:${file.name}` });
        return;
      }
      const path = `${vendorId()}/video-${uid()}.${extOf(file)}`;
      const { error } = await supabase.storage.from("pro-fichiers").upload(path, file, { contentType: file.type });
      if (error) fail(error, "La vidéo");
      else await saveFiche({ video_url: `fichier:${path}` });
    },
    [saveFiche, fail],
  );

  // ---------- Lignes du prestataire (tarifs, dates, clients…) ----------

  const insertRow = useCallback(
    async (table, key, row) => {
      const full = { id: uid(), vendor_id: vendorId(), created_at: new Date().toISOString(), ...row };
      setData((d) => ({ ...d, [key]: [...d[key], full] }));
      if (demo()) return full;
      const { error } = await supabase.from(table).insert(full);
      if (error) {
        setData((d) => ({ ...d, [key]: d[key].filter((x) => x.id !== full.id) }));
        fail(error, "La modification");
        return null;
      }
      return full;
    },
    [setData, fail],
  );

  const updateRow = useCallback(
    async (table, key, rowId, patch) => {
      setData((d) => ({ ...d, [key]: d[key].map((x) => (x.id === rowId ? { ...x, ...patch } : x)) }));
      if (demo()) return true;
      const { error } = await supabase.from(table).update(patch).eq("id", rowId);
      if (error) fail(error, "La modification");
      return !error;
    },
    [setData, fail],
  );

  const deleteRow = useCallback(
    async (table, key, rowId) => {
      setData((d) => ({ ...d, [key]: d[key].filter((x) => x.id !== rowId) }));
      if (demo()) return true;
      const { error } = await supabase.from(table).delete().eq("id", rowId);
      if (error) fail(error, "La suppression");
      return !error;
    },
    [setData, fail],
  );

  const saveSeasons = useCallback(
    async (patch) => {
      setData((d) => ({ ...d, pro: { ...d.pro, ...patch } }));
      if (demo()) return true;
      const { error } = await supabase.from("pro_vendors").update(patch).eq("vendor_id", vendorId());
      if (error) fail(error, "Les saisons");
      return !error;
    },
    [setData, fail],
  );

  // Une date du calendrier : libre (aucune ligne), option posée ou réservée
  const setDay = useCallback(
    async (day, value) => {
      const current = dataRef.current.dates.find((x) => x.day === day);
      if (!value) return current ? deleteRow("pro_dates", "dates", current.id) : true;
      const row = { status: value.status, client_id: value.client_id || null, label: value.label || null, expires_on: value.status === "option" ? value.expires_on || null : null };
      if (current) return updateRow("pro_dates", "dates", current.id, row);
      return insertRow("pro_dates", "dates", { day, ...row });
    },
    [deleteRow, updateRow, insertRow],
  );

  // ---------- Couples : messages et documents ----------

  const loadThread = useCallback(async (clientId) => {
    const d = dataRef.current;
    if (demo()) return d.threads?.[clientId] || [];
    const { data, error } = await supabase.rpc("pro_thread", { c: clientId });
    if (error) return [];
    return data || [];
  }, []);

  // Répondre à un couple venu par Merry : le message arrive dans son tableau de bord
  const sendMessage = useCallback(
    async (clientId, body) => {
      const text = body.trim();
      if (!text) return false;
      const msg = { id: uid(), from_vendor: true, body: text, sent_at: new Date().toISOString() };
      if (demo()) {
        setData((d) => ({ ...d, threads: { ...d.threads, [clientId]: [...(d.threads?.[clientId] || []), msg] } }));
      } else {
        const { error } = await supabase.rpc("pro_send", { c: clientId, body: text });
        if (error) {
          fail(error, "Le message");
          return false;
        }
      }
      setData((d) => ({
        ...d,
        clients: d.clients.map((c) => (c.id === clientId ? { ...c, answered_at: c.answered_at || msg.sent_at } : c)),
        requests: d.requests.map((r) => (r.client_id === clientId ? { ...r, answered: true } : r)),
      }));
      return true;
    },
    [setData, fail],
  );

  const addDocument = useCallback(
    async (clientId, file) => {
      if (file.size > FILE_MAX_BYTES) {
        setToast({ kind: "error", text: "Ce fichier dépasse 50 Mo." });
        return null;
      }
      const name = file.name.replace(/\.[a-z0-9]{1,5}$/i, "");
      if (demo()) return insertRow("pro_documents", "documents", { client_id: clientId, name, storage_path: `demo/${file.name}`, bytes: file.size });
      const path = `${vendorId()}/${clientId}/${uid()}.${extOf(file)}`;
      const { error } = await supabase.storage.from("pro-fichiers").upload(path, file, { contentType: file.type || "application/octet-stream" });
      if (error) {
        fail(error, "Le document");
        return null;
      }
      return insertRow("pro_documents", "documents", { client_id: clientId, name, storage_path: path, bytes: file.size });
    },
    [insertRow, fail],
  );

  const openDocument = useCallback(async (doc) => {
    if (demo()) {
      setToast({ kind: "ok", text: "En démo, les documents ne s’ouvrent pas." });
      return;
    }
    const urls = await signed("pro-fichiers", [doc.storage_path], 300);
    const url = urls.get(doc.storage_path);
    if (url) window.open(url, "_blank", "noopener");
  }, []);

  // ---------- Projets de mariage et crédits ----------

  const unlockProject = useCallback(
    async (weddingId) => {
      const d = dataRef.current;
      const cost = d.offer?.unlock_cost || 0;
      if (demo()) {
        if (d.pro.credits < cost) return { ok: false, reason: "credits" };
        const balance = d.pro.credits - cost;
        setData((x) => ({
          ...x,
          pro: { ...x.pro, credits: balance },
          projects: x.projects.map((p) => (p.wedding_id === weddingId ? { ...p, unlocked: true, names: p.names || "Lucie & Romain" } : p)),
          ledger: cost ? [{ id: uid(), at: new Date().toISOString(), kind: "utilisation", label: "Projet de mariage débloqué", delta: -cost, balance }, ...x.ledger] : x.ledger,
        }));
        return { ok: true };
      }
      const { data: balance, error } = await supabase.rpc("pro_unlock", { v: d.vendor.id, w: weddingId });
      if (error) return { ok: false, reason: /insuffisant/i.test(error.message) ? "credits" : "error" };
      const projects = await supabase.rpc("pro_projects", { v: d.vendor.id });
      const ledger = await supabase.from("pro_ledger").select("*").eq("vendor_id", d.vendor.id).order("at", { ascending: false });
      setData((x) => ({ ...x, pro: { ...x.pro, credits: balance }, projects: projects.data || x.projects, ledger: ledger.data || x.ledger }));
      return { ok: true };
    },
    [setData],
  );

  const proposeProject = useCallback(
    async (weddingId, body) => {
      if (demo()) {
        setData((d) => ({ ...d, projects: d.projects.map((p) => (p.wedding_id === weddingId ? { ...p, proposed: true } : p)) }));
        return true;
      }
      const { error } = await supabase.rpc("pro_propose", { v: vendorId(), w: weddingId, body });
      if (error) {
        fail(error, "La proposition");
        return false;
      }
      await refresh();
      return true;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [setData, fail],
  );

  const sendFeedback = useCallback(
    async ({ body, file, page }) => {
      let screenshot_path = null;
      if (file && !demo()) {
        const path = `${vendorId()}/fonctionnalites/${uid()}.${extOf(file)}`;
        const { error } = await supabase.storage.from("pro-fichiers").upload(path, file, { contentType: file.type });
        if (!error) screenshot_path = path;
      }
      return insertRow("pro_feedback", "feedback", { body: body.trim(), page, screenshot_path, status: "recue", user_id: undefined });
    },
    [insertRow],
  );

  // Relit tout depuis la base (après une proposition, un changement de fiche…)
  const refresh = useCallback(async () => {
    if (demo() || !dataRef.current?.vendor) return;
    const { data: auth } = await supabase.auth.getUser();
    const data = await loadLive(dataRef.current.vendor.id, auth.user);
    data.vendors = dataRef.current.vendors;
    dataRef.current = data;
    setState((s) => ({ ...s, data }));
  }, []);

  const switchVendor = useCallback(
    (vid) => {
      try {
        window.localStorage.setItem(VENDOR_KEY, vid);
      } catch {
        /* ignore */
      }
      setState((s) => ({ ...s, status: "loading" }));
      load();
    },
    [load],
  );

  const resetDemo = useCallback(() => {
    try {
      window.localStorage.removeItem(DEMO_KEY);
    } catch {
      /* ignore */
    }
    const data = buildProDemo();
    dataRef.current = data;
    setState((s) => ({ ...s, data }));
  }, []);

  const signOut = useCallback(async () => {
    try {
      window.sessionStorage.removeItem(DEMO_FLAG);
    } catch {
      /* ignore */
    }
    if (supabase) await supabase.auth.signOut();
    window.location.href = "/pro";
  }, []);

  const value = {
    ...state,
    toast,
    setToast,
    setData,
    reload: load,
    refresh,
    saveFiche,
    setPhotos,
    addPhotos,
    removePhoto,
    uploadVideo,
    insertRow,
    updateRow,
    deleteRow,
    saveSeasons,
    setDay,
    loadThread,
    sendMessage,
    addDocument,
    openDocument,
    unlockProject,
    proposeProject,
    sendFeedback,
    switchVendor,
    resetDemo,
    signOut,
  };
  return <ProContext.Provider value={value}>{children}</ProContext.Provider>;
}

export function usePro() {
  const ctx = useContext(ProContext);
  if (!ctx) throw new Error("usePro hors de ProProvider");
  return ctx;
}

// Champs de la fiche rangés dans details (jsonb) plutôt qu'en colonnes
const DETAIL_KEYS = ["video_url", "caterer_imposed", "caterer_mode", "music_end", "outdoor_ceremony", "parking", "accessible", "parking_note", "includes"];
function splitDetails(patch) {
  const details = {};
  const rest = {};
  for (const [k, v] of Object.entries(patch)) (DETAIL_KEYS.includes(k) ? details : rest)[k] = v;
  return { ...rest, details };
}

// Tout ce que montre l'espace prestataire, pour une fiche
async function loadLive(vid, user) {
  await supabase.rpc("pro_sync", { v: vid });
  const [fiche, photos, pro, formulas, options, dates, clients, requests, documents, ledger, offer, feedback, stats, projects, cats] = await Promise.all([
    supabase.rpc("pro_fiche", { v: vid }),
    supabase.rpc("pro_photos", { v: vid }),
    supabase.from("pro_vendors").select("*").eq("vendor_id", vid).maybeSingle(),
    supabase.from("pro_formulas").select("*").eq("vendor_id", vid).order("position").order("created_at"),
    supabase.from("pro_options").select("*").eq("vendor_id", vid).order("position").order("created_at"),
    supabase.from("pro_dates").select("*").eq("vendor_id", vid).order("day"),
    supabase.from("pro_clients").select("*").eq("vendor_id", vid).order("created_at", { ascending: false }),
    supabase.rpc("pro_requests", { v: vid }),
    supabase.from("pro_documents").select("*").eq("vendor_id", vid).order("created_at", { ascending: false }),
    supabase.from("pro_ledger").select("*").eq("vendor_id", vid).order("at", { ascending: false }).limit(200),
    supabase.from("pro_offer").select("*").eq("id", 1).maybeSingle(),
    supabase.from("pro_feedback").select("*").eq("vendor_id", vid).order("created_at", { ascending: false }),
    supabase.rpc("pro_stats", { v: vid }),
    supabase.rpc("pro_projects", { v: vid }),
    supabase.schema("catalog").from("categories").select("slug, label"),
  ]);
  for (const r of [fiche, photos, pro, formulas, options, dates, clients, requests, documents, ledger, offer, feedback, stats, projects]) {
    if (r.error) throw r.error;
  }
  const vendor = (fiche.data || [])[0];
  if (!vendor) throw new Error("Fiche introuvable");
  vendor.details = vendor.details || {};
  vendor.category_label = (cats.data || []).find((c) => c.slug === vendor.primary_category)?.label || vendor.primary_category;
  const urls = await signed("catalog-photos", (photos.data || []).map((p) => p.storage_path));
  return {
    vendor,
    photos: (photos.data || []).map((p) => ({ path: p.storage_path, url: urls.get(p.storage_path) || null })),
    pro: pro.data,
    formulas: formulas.data || [],
    options: options.data || [],
    dates: dates.data || [],
    clients: clients.data || [],
    requests: requests.data || [],
    threads: {},
    documents: documents.data || [],
    ledger: ledger.data || [],
    offer: offer.data || { plans: [], packs: [], unlock_cost: null, explainer: null, payments_on: false },
    feedback: feedback.data || [],
    stats: (stats.data || [])[0] || { views: 0, picks: 0, requests: 0 },
    projects: projects.data || [],
    user: { email: user?.email },
    setup: true,
  };
}
