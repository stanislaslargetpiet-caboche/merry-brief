"use client";

// Données du tableau de bord : chargées en une fois pour le mariage du compte
// connecté, modifiées en local tout de suite puis enregistrées dans Supabase.
// Sans Supabase (en local) ou avec ?demo=1, on tourne sur les données d'exemple.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { supabase, flushPendingBrief } from "@/lib/supabase";
import { identifyUser, resetAnalytics } from "@/lib/analytics";
import { buildDemo } from "./demo";
import { applyChange, subscribeWedding, SYNC_TABLES } from "./sync";
import { normalize, uid } from "./format";
import { tasksDoneByQuote } from "./links";
import { catOf } from "./catalog";
import { guestsLabel, requestBody, signature } from "./picks";
import { notifyVendor } from "./vendorMail";
import { ACTIVITY_DAYS } from "./activity";

const DashContext = createContext(null);

const TABLES = {
  wedding_members: "members",
  guest_groups: "groups",
  events: "events",
  guest_fields: "fields",
  guests: "guests",
  guest_responses: "responses",
  tasks: "tasks",
  vendors: "vendors",
  budget_items: "items",
  payments: "payments",
  documents: "documents",
  document_folders: "folders",
  vendor_messages: "messages",
  task_comments: "comments",
  pense_bete_items: "notes",
  vendor_picks: "picks",
  quote_requests: "requests",
  vendor_comments: "vendorComments",
  seating_tables: "tables",
  seating: "seating",
  guest_activity: "activity",
};

// Fichiers déposés dans les dossiers : 25 Mo au plus par fichier (limite du stockage)
export const DOCUMENT_MAX_BYTES = 25 * 1024 * 1024;

// Colonnes qu'un organisateur peut écrire sur wedding_members (le reste passe par les fonctions SQL)
const MEMBER_COLUMNS = ["id", "wedding_id", "display_name", "initial", "color", "role", "email", "position", "invited_at"];

const DEMO_KEY = "merry-demo-v1";
const DEMO_FLAG = "merry-demo";
const WEDDING_KEY = "merry-wedding";
const PAGE = 1000;
// Colonne de départage pour lire par pages : les tables sans colonne id (clé composée) ont la leur
const TIE_BREAK = { guest_responses: "event_id", seating: "guest_id" };
// Tri de lecture de chaque table (le même au chargement et quand une table est relue après un échec)
const ORDER = {
  wedding_members: "position",
  guest_groups: "position",
  events: "position",
  guest_fields: "position",
  guests: "position",
  guest_responses: "guest_id",
  tasks: "position",
  vendors: "created_at",
  budget_items: "position",
  payments: "created_at",
  documents: "created_at",
  vendor_messages: "sent_at",
  task_comments: "created_at",
  document_folders: "position",
  pense_bete_items: "position",
  vendor_picks: "position",
  quote_requests: "created_at",
  vendor_comments: "created_at",
  guest_response_log: "created_at",
  guest_activity: "created_at",
  seating_tables: "position",
  seating: "position",
};
// Tables touchées en cascade par une suppression (comme les clés étrangères en base) : ce sont elles
// qu'on remet en place si l'écriture échoue
const CASCADE = {
  guests: ["guest_responses", "seating"],
  events: ["guest_responses", "seating_tables", "seating"],
  seating_tables: ["seating"],
  guest_groups: ["guests"],
  budget_items: ["payments", "documents"],
  vendors: ["budget_items", "vendor_picks", "documents", "vendor_messages"],
  wedding_members: ["tasks", "payments", "documents", "pense_bete_items", "vendor_picks"],
  document_folders: ["documents"],
  guest_fields: ["guests"],
};
// L'historique des réponses sert au bandeau « nouvelles réponses depuis votre dernière visite » et à la
// fiche invité : trois mois suffisent, la table grandit à chaque réponse
const LOG_DAYS = 90;

// Supabase renvoie 1 000 lignes au plus par requête : on lit par pages, dans un ordre stable
async function readAll(weddingId, table, order, refine) {
  const rows = [];
  for (let from = 0; ; from += PAGE) {
    let req = supabase.from(table).select("*").eq("wedding_id", weddingId);
    if (refine) req = refine(req);
    if (order) req = req.order(order);
    req = req.order(TIE_BREAK[table] || "id");
    const { data: page, error } = await req.range(from, from + PAGE - 1);
    if (error) return { data: null, error };
    rows.push(...page);
    if (page.length < PAGE) return { data: rows, error: null };
  }
}
const logSince = () => new Date(Date.now() - LOG_DAYS * 86400000).toISOString();
// Modifications de l'équipe (pastille de la liste des invités) : les 3 derniers jours seulement
const activitySince = () => new Date(Date.now() - ACTIVITY_DAYS * 86400000).toISOString();
// Actions groupées sur les invités (sélection dans le tableau) : une requête par paquet de 200
const chunks = (ids) => Array.from({ length: Math.ceil(ids.length / 200) }, (_, i) => ids.slice(i * 200, i * 200 + 200));
export const INVITE_KEY = "merry-invite";
// Le lien « mot de passe oublié » ouvre une session : tant que le nouveau mot de
// passe n'est pas choisi, cette marque renvoie vers le formulaire de /connexion.
export const RESET_KEY = "merry-reset-pending";

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
      if (saved && saved.wedding && saved.version === 1) return withPrestataires({ comments: [], folders: [], vendorComments: [], log: [], activity: [], tables: [], seating: [], ...saved.data, commentsOn: true, vendorCommentsOn: true, documentsSetup: true, fieldsSetup: true, datesSetup: true, retroSetup: true, categoriesSetup: true, viewsSetup: true, guestNoteSetup: true, historySetup: true, seatingSetup: true });
    }
  } catch {
    /* stockage indisponible */
  }
  return buildDemo();
}

// Démo enregistrée avant l'onglet Prestataires : on ajoute la sélection d'exemple (et ses fiches)
function withPrestataires(data) {
  if (data.picks) return data;
  const fresh = buildDemo();
  const has = (list) => new Set(list.map((x) => x.id));
  const vendorIds = has(data.vendors);
  const messageIds = has(data.messages);
  return {
    ...data,
    vendors: [...data.vendors, ...fresh.vendors.filter((v) => !vendorIds.has(v.id))],
    messages: [...data.messages, ...fresh.messages.filter((m) => !messageIds.has(m.id))],
    picks: fresh.picks,
    requests: fresh.requests,
    wishes: fresh.wishes,
    picksSetup: true,
  };
}

function saveDemo(data) {
  try {
    window.localStorage.setItem(DEMO_KEY, JSON.stringify({ version: 1, wedding: true, data }));
  } catch {
    /* stockage indisponible */
  }
}

// Réponses du rétroplanning gardées sur l'appareil quand la table n'existe pas encore
const RETRO_KEY = "merry-retro-answers";
function readLocalRetro(weddingId) {
  try {
    const raw = window.localStorage.getItem(`${RETRO_KEY}:${weddingId}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
function writeLocalRetro(weddingId, row) {
  try {
    if (row) window.localStorage.setItem(`${RETRO_KEY}:${weddingId}`, JSON.stringify(row));
    else window.localStorage.removeItem(`${RETRO_KEY}:${weddingId}`);
  } catch {
    /* stockage indisponible */
  }
}

// Vues enregistrées de la liste des invités, sur l'appareil quand la colonne n'existe pas encore (supabase/fiche-et-vues-invites.sql)
const VIEWS_KEY = "merry-guest-views";
function readLocalViews(weddingId) {
  try {
    const raw = window.localStorage.getItem(`${VIEWS_KEY}:${weddingId}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}
function writeLocalViews(weddingId, views) {
  try {
    window.localStorage.setItem(`${VIEWS_KEY}:${weddingId}`, JSON.stringify(views));
  } catch {
    /* stockage indisponible */
  }
}

function pick(obj, keys) {
  const out = {};
  for (const k of keys) if (k in obj) out[k] = obj[k];
  return out;
}

export function DashProvider({ children }) {
  const [state, setState] = useState({ status: "loading", mode: null, data: null, error: null, user: null });
  const [toast, setToast] = useState(null);
  // Direct entre organisateurs : canal Realtime du mariage, et qui est sur quelle page en ce moment
  const channelRef = useRef(null);
  const [presence, setPresence] = useState([]);
  const dataRef = useRef(null);
  const modeRef = useRef(null);
  // Chaque chargement a son numéro : un chargement dépassé (changement de mariage rapide) n'écrit rien
  const loadSeq = useRef(0);
  const demoTimer = useRef(null);

  // Les données de référence vivent dans dataRef (à jour tout de suite, pour les écritures qui se suivent) ;
  // l'état React ne fait que publier. L'updater ne fait donc aucun effet de bord (React peut le rejouer).
  const setData = useCallback((updater) => {
    const current = dataRef.current;
    if (!current) return;
    const next = typeof updater === "function" ? updater(current) : updater;
    if (next === current) return;
    dataRef.current = next;
    setState((s) => (s.data ? { ...s, data: next } : s));
    if (modeRef.current === "demo") {
      clearTimeout(demoTimer.current);
      demoTimer.current = setTimeout(() => saveDemo(dataRef.current), 300);
    }
  }, []);
  useEffect(() => {
    const flush = () => {
      if (modeRef.current === "demo" && demoTimer.current) {
        clearTimeout(demoTimer.current);
        demoTimer.current = null;
        saveDemo(dataRef.current);
      }
    };
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, []);

  const fail = useCallback((err) => {
    console.error("[merry]", err);
    setToast({ kind: "error", text: "La modification n'a pas pu être enregistrée. Vérifiez votre connexion et réessayez." });
  }, []);

  // Relit une table du mariage et remplace sa copie locale (après un échec d'écriture, ou un retour du canal)
  const refetch = useCallback(
    async (table) => {
      const d = dataRef.current;
      if (modeRef.current !== "live" || !d || !supabase) return;
      const weddingId = d.wedding.id;
      const refine = table === "guest_response_log" ? (q) => q.gte("created_at", logSince()) : table === "guest_activity" ? (q) => q.gte("created_at", activitySince()) : undefined;
      const { data, error } = await readAll(weddingId, table, ORDER[table], refine);
      if (error || !data) return;
      setData((x) => (x.wedding.id === weddingId ? { ...x, [TABLES[table]]: data } : x));
    },
    [setData],
  );

  const load = useCallback(async () => {
    const seq = (loadSeq.current += 1);
    const current = () => seq === loadSeq.current;
    const demo = !supabase || readDemoFlag();
    if (demo) {
      modeRef.current = "demo";
      const data = loadDemo();
      dataRef.current = data;
      setState({ status: "ready", mode: "demo", data, error: null, user: { id: "demo-user", email: "stanislas@exemple.fr" } });
      return;
    }
    modeRef.current = "live";
    const { data: sess } = await supabase.auth.getSession();
    const user = sess?.session?.user;
    if (!user) {
      setState({ status: "signedout", mode: "live", data: null, error: null, user: null });
      return;
    }
    // Identifié dès la connexion confirmée, pas seulement une fois le tableau de bord
    // chargé : laisser trop longtemps un visiteur sous un identifiant anonyme fait
    // courir le risque que PostHog refuse ensuite de le fusionner avec son compte.
    identifyUser(user);
    try {
      if (window.localStorage.getItem(RESET_KEY) === user.id) {
        setState({ status: "mustreset", mode: "live", data: null, error: null, user });
        return;
      }
    } catch {
      /* ignore */
    }
    try {
      // Brief resté en attente d'une confirmation d'email
      try {
        const pending = window.localStorage.getItem("merry-brief-pending");
        if (pending) {
          const res = await flushPendingBrief(JSON.parse(pending));
          if (res.ok) window.localStorage.removeItem("merry-brief-pending");
        }
      } catch {
        /* ignore */
      }
      // (Les liens d'invitation se valident sur /connexion, après confirmation.)
      // Un compte prestataire sans mariage ni brief s'est trompé de porte : on le renvoie vers son espace
      // au lieu de lui créer un mariage vide (test du 5 nov. 2026). Un compte qui a les deux garde les deux.
      const [mineAlready, fiches, briefs] = await Promise.all([
        supabase.from("wedding_members").select("wedding_id").eq("user_id", user.id).limit(1),
        supabase.rpc("pro_me"),
        supabase.from("briefs").select("id").eq("user_id", user.id).limit(1),
      ]);
      const proOnly = !mineAlready.error && !briefs.error && !(mineAlready.data || []).length && !(briefs.data || []).length && (fiches.data || []).length > 0;
      if (proOnly) {
        window.location.replace("/pro");
        return;
      }
      const { data: boot, error: bootErr } = await supabase.rpc("merry_bootstrap");
      if (bootErr) throw bootErr;
      // Un compte peut organiser plusieurs mariages : on garde le dernier choisi
      const { data: mine, error: mineErr } = await supabase.from("wedding_members").select("wedding_id, weddings(partner1, partner2)").eq("user_id", user.id);
      if (mineErr) throw mineErr;
      const weddings = (mine || []).map((m) => ({ id: m.wedding_id, name: [m.weddings?.partner1, m.weddings?.partner2].filter(Boolean).join(" & ") }));
      let stored = null;
      try {
        stored = window.localStorage.getItem(WEDDING_KEY);
      } catch {
        /* ignore */
      }
      const weddingId = weddings.some((x) => x.id === stored) ? stored : boot;
      const all = (table, refine) => readAll(weddingId, table, ORDER[table], refine);
      // Tout se lit en même temps : les tables de base, puis celles ajoutées par un fichier SQL après coup
      // (sans elles, la page concernée explique quoi faire et le reste fonctionne) et les sondes de colonnes
      const [
        w, members, groups, events, fields, guests, responses, tasks, vendors, items, payments, documents, messages, prefs, briefRes,
        comments, folders, notes, picks, requests, wishesRes, vendorComments, formRes, siteRes,
        fieldsRes, datesRes, retroRes, catRes, noteRes, logRes, tablesRes, seatingRes, activityRes,
      ] = await Promise.all([
        supabase.from("weddings").select("*").eq("id", weddingId).single(),
        all("wedding_members"),
        all("guest_groups"),
        all("events"),
        all("guest_fields"),
        all("guests"),
        all("guest_responses"),
        all("tasks"),
        all("vendors"),
        all("budget_items"),
        all("payments"),
        all("documents"),
        all("vendor_messages"),
        supabase.from("kpi_prefs").select("*").eq("wedding_id", weddingId),
        supabase.rpc("merry_brief", { w: weddingId }),
        // Commentaires des tâches (table ajoutée après coup)
        all("task_comments"),
        // Dossiers de documents (supabase/documents.sql)
        all("document_folders"),
        // Pense-bête (supabase/pense-bete.sql)
        all("pense_bete_items"),
        // Prestataires (supabase/prestataires.sql)
        all("vendor_picks"),
        all("quote_requests"),
        supabase.from("vendor_wishes").select("*").eq("wedding_id", weddingId).maybeSingle(),
        // Commentaires des organisateurs sur les prestataires (supabase/commentaires-prestataires.sql)
        all("vendor_comments"),
        // Formulaire invités (supabase/formulaire.sql) et site de mariage (supabase/site-mariage.sql)
        supabase.from("guest_forms").select("*").eq("wedding_id", weddingId).maybeSingle(),
        supabase.from("wedding_sites").select("*").eq("wedding_id", weddingId).maybeSingle(),
        // Sondes : la colonne existe-t-elle ? (colonnes.sql, reponses-et-lignes.sql, fiche-et-vues-invites.sql)
        supabase.from("guest_fields").select("source").eq("wedding_id", weddingId).limit(1),
        supabase.from("events").select("event_date").eq("wedding_id", weddingId).limit(1),
        supabase.from("retro_answers").select("*").eq("wedding_id", weddingId).limit(1),
        supabase.from("budget_items").select("category").eq("wedding_id", weddingId).limit(1),
        supabase.from("guests").select("note").eq("wedding_id", weddingId).limit(1),
        // Historique des réponses (supabase/sync-et-historique.sql), trois mois
        all("guest_response_log", (q) => q.gte("created_at", logSince())),
        // Plan de table (supabase/plan-de-table.sql)
        all("seating_tables"),
        all("seating"),
        // Modifications de l'équipe (supabase/modifications-equipe.sql), trois jours
        all("guest_activity", (q) => q.gte("created_at", activitySince())),
      ]);
      if (!current()) return;
      const err = [w, members, groups, events, fields, guests, responses, tasks, vendors, items, payments, documents, messages, prefs].find((r) => r.error);
      if (err) throw err.error;
      for (const [label, res] of [["commentaires", comments], ["dossiers", folders], ["pense-bête", notes], ["prestataires", picks]]) {
        if (res.error) console.warn(`[merry] ${label} indisponibles`, res.error.message);
      }
      const brief = briefRes.data?.[0] || null;
      const form = formRes.error ? null : formRes.data || null;
      const formSetup = !formRes.error;
      const site = siteRes.error ? null : siteRes.data || null;
      const siteSetup = !siteRes.error;
      const fieldsSetup = !fieldsRes.error;
      const datesSetup = !datesRes.error;
      const retroSetup = !retroRes.error;
      let retro = retroRes.error ? null : retroRes.data?.[0] || null;
      if (!retroSetup) retro = readLocalRetro(weddingId);
      const categoriesSetup = !catRes.error;
      const guestNoteSetup = !noteRes.error;
      const historySetup = !logRes.error;
      if (!tablesRes.error && seatingRes.error) console.error("[merry] plan de table : placements illisibles", seatingRes.error.message);
      const seatingSetup = !tablesRes.error && !seatingRes.error;
      const viewsSetup = "guest_views" in w.data;
      if (!viewsSetup) w.data.guest_views = readLocalViews(weddingId);
      else if (!Array.isArray(w.data.guest_views)) w.data.guest_views = [];
      const kpiPrefs = {};
      for (const p of prefs.data) kpiPrefs[p.scope] = p.kpis;
      const me = members.data.find((m) => m.user_id === user.id);
      const data = {
        wedding: w.data,
        members: members.data,
        groups: groups.data,
        events: events.data,
        fields: fields.data,
        guests: guests.data,
        responses: responses.data,
        tasks: tasks.data,
        vendors: vendors.data,
        items: items.data,
        payments: payments.data,
        documents: documents.data,
        messages: messages.data,
        comments: comments.error ? [] : comments.data,
        commentsOn: !comments.error,
        folders: folders.error ? [] : folders.data,
        documentsSetup: !folders.error,
        notes: notes.error ? [] : notes.data,
        notesSetup: !notes.error,
        picks: picks.error ? [] : picks.data,
        requests: requests.error ? [] : requests.data || [],
        wishes: wishesRes.data || null,
        vendorComments: vendorComments.error ? [] : vendorComments.data,
        vendorCommentsOn: !vendorComments.error,
        picksSetup: !picks.error,
        kpiPrefs,
        brief,
        form,
        site,
        siteSetup,
        formSetup,
        fieldsSetup,
        datesSetup,
        retro,
        retroSetup,
        categoriesSetup,
        guestNoteSetup,
        viewsSetup,
        log: logRes.error ? [] : logRes.data,
        historySetup,
        activity: activityRes.error ? [] : activityRes.data,
        tables: tablesRes.error ? [] : tablesRes.data,
        seating: seatingRes.error ? [] : seatingRes.data || [],
        seatingSetup,
        meId: me?.id || null,
        weddings,
      };
      if (!current()) return;
      dataRef.current = data;
      identifyUser(user, { display_name: me?.display_name || null });
      setState({ status: "ready", mode: "live", data, error: null, user });
      // Direct : les changements des autres organisateurs arrivent sans recharger ; sans publication
      // Realtime sur les tables (supabase/sync-et-historique.sql), le canal reste simplement silencieux
      channelRef.current?.close();
      setPresence([]);
      channelRef.current = subscribeWedding(supabase, weddingId, me, {
        onChange: (table, payload) => setData((d) => applyChange(d, table, payload)),
        onPresence: setPresence,
        // Canal revenu après une coupure (veille, réseau) : on relit les tables partagées, les changements
        // des autres organisateurs faits pendant la coupure ne sont jamais rejoués par Realtime
        onReconnect: () => {
          for (const table of SYNC_TABLES) {
            if (dataRef.current?.[TABLES[table]] !== undefined) refetch(table);
          }
        },
      });
    } catch (error) {
      if (!current()) return;
      console.error("[merry] chargement du tableau de bord", error);
      const missing = /function .*merry_bootstrap|relation .* does not exist|Could not find the function/i.test(error?.message || "");
      setState({ status: "error", mode: "live", data: null, error: missing ? "setup" : "load", user });
    }
  }, [setData, refetch]);

  useEffect(() => {
    load();
    if (!supabase) return undefined;
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT" && modeRef.current === "live") setState((s) => ({ ...s, status: "signedout", data: null }));
    });
    return () => {
      sub?.subscription?.unsubscribe();
      channelRef.current?.close();
      channelRef.current = null;
    };
  }, [load]);
  // La page où l'on est, pour les autres organisateurs (« Léa est aussi sur la liste »)
  const trackPage = useCallback((page) => channelRef.current?.track(page), []);

  // ------------------------------------------------------------------
  // Écritures génériques (optimistes)
  // ------------------------------------------------------------------

  // Écrit en base ; si ça échoue, l'écran revient à l'état d'avant (before) pour les tables touchées, puis
  // ces tables sont relues pour être sûr d'afficher ce que la base contient vraiment
  const persist = useCallback(
    async (fn, rollback) => {
      if (modeRef.current !== "live") return true;
      try {
        const { error } = await fn();
        if (error) throw error;
        return true;
      } catch (e) {
        fail(e);
        if (rollback?.before) {
          const tables = [...new Set((rollback.tables || []).flatMap((t) => [t, ...(CASCADE[t] || [])]))];
          setData((d) => {
            const next = { ...d };
            for (const t of tables) if (TABLES[t] in rollback.before) next[TABLES[t]] = rollback.before[TABLES[t]];
            if (rollback.keys) for (const k of rollback.keys) next[k] = rollback.before[k];
            return next;
          });
          tables.forEach((t) => refetch(t));
        }
        return false;
      }
    },
    [fail, setData, refetch],
  );

  // Un devis signé vaut « prestataire réservé » : les tâches type correspondantes se cochent (et on le dit)
  const afterQuote = useCallback(
    (item) => {
      const ids = tasksDoneByQuote(item, dataRef.current);
      if (!ids.length) return;
      const now = new Date().toISOString();
      const titles = dataRef.current.tasks.filter((t) => ids.includes(t.id)).map((t) => `« ${t.title} »`);
      const before = dataRef.current;
      setData((d) => ({ ...d, tasks: d.tasks.map((t) => (ids.includes(t.id) ? { ...t, done: true, done_at: now } : t)) }));
      persist(() => supabase.from("tasks").update({ done: true, done_at: now }).in("id", ids), { before, tables: ["tasks"] });
      setToast({ kind: "ok", text: `Devis signé : ${titles.join(", ")} ${titles.length > 1 ? "sont cochées" : "est cochée"} dans le rétroplanning.` });
    },
    [persist, setData],
  );

  // Colonnes des invités ajoutées après coup : retirées des écritures tant que leur fichier SQL n'est pas lancé
  const cleanGuest = useCallback((row) => {
    const d = dataRef.current;
    if (d.guestNoteSetup) return row;
    const { note, ...rest } = row;
    return rest;
  }, []);

  const insert = useCallback(
    async (table, rows, opts = {}) => {
      const list = (Array.isArray(rows) ? rows : [rows]).map((r) => ({ id: r.id || uid(), wedding_id: dataRef.current.wedding.id, ...r }));
      const key = TABLES[table];
      const before = dataRef.current;
      setData((d) => ({ ...d, [key]: [...d[key], ...list] }));
      let payload = table === "wedding_members" ? list.map((r) => pick(r, MEMBER_COLUMNS)) : list;
      if (table === "guest_fields" && !dataRef.current.fieldsSetup) payload = payload.map(({ source, kind, options, ...r }) => r);
      if (table === "payments" && !dataRef.current.fieldsSetup) payload = payload.map(({ note, ...r }) => r);
      if (table === "guests") payload = payload.map(cleanGuest);
      if (table === "events" && !dataRef.current.datesSetup) payload = payload.map(({ event_date, kind, ...r }) => r);
      if (table === "budget_items" && !dataRef.current.categoriesSetup) payload = payload.map(({ category, ...r }) => r);
      const clean = table === "guest_responses" || table === "seating" ? payload.map(({ id, ...r }) => r) : payload;
      const ok = await persist(() => supabase.from(table).insert(clean), { before, tables: [table] });
      if (ok && table === "budget_items" && opts.quoteHook !== false) list.forEach((row) => afterQuote(row));
      // Les lignes (avec leurs identifiants) et, à côté, si la base les a bien prises : list.ok
      list.ok = ok;
      return list;
    },
    [persist, setData, afterQuote, cleanGuest],
  );

  // opts.quoteHook = false : un montant posé sur le poste sans devis signé (une dépense notée)
  // ne coche pas les tâches « Réserver… » du rétroplanning
  const update = useCallback(
    async (table, id, patch, opts = {}) => {
      const key = TABLES[table];
      const before = dataRef.current;
      setData((d) => {
        const rows = d[key].map((r) => (r.id === id ? { ...r, ...patch } : r));
        // Les moments restent dans l'ordre choisi (onglets et colonnes)
        if (table === "events" && "position" in patch) rows.sort((a, b) => a.position - b.position);
        return { ...d, [key]: rows };
      });
      let payload = table === "wedding_members" ? pick(patch, MEMBER_COLUMNS) : patch;
      if (table === "guest_fields" && !dataRef.current.fieldsSetup) {
        const { source, kind, options, ...rest } = payload;
        payload = rest;
        if (!Object.keys(payload).length) return true;
      }
      if (table === "payments" && !dataRef.current.fieldsSetup) {
        const { note, ...rest } = payload;
        payload = rest;
        if (!Object.keys(payload).length) return true;
      }
      if (table === "guests") {
        payload = cleanGuest(payload);
        if (!Object.keys(payload).length) return true;
      }
      if (table === "events" && !dataRef.current.datesSetup) {
        const { event_date, kind, ...rest } = payload;
        payload = rest;
        if (!Object.keys(payload).length) return true;
      }
      if (table === "budget_items" && !dataRef.current.categoriesSetup) {
        const { category, ...rest } = payload;
        payload = rest;
        if (!Object.keys(payload).length) return true;
      }
      if (table === "vendors" && !dataRef.current.fieldsSetup) {
        const { iban, bic, account_holder, ...rest } = payload;
        payload = rest;
        if (!Object.keys(payload).length) return true;
      }
      const ok = await persist(() => supabase.from(table).update(payload).eq("id", id), { before, tables: [table] });
      if (ok && table === "budget_items" && "quote_amount" in patch && opts.quoteHook !== false) afterQuote({ ...dataRef.current.items.find((i) => i.id === id), ...patch });
      return ok;
    },
    [persist, setData, afterQuote, cleanGuest],
  );

  const remove = useCallback(
    async (table, id) => {
      const before = dataRef.current;
      setData((d) => {
        const next = { ...d };
        const key = TABLES[table];
        next[key] = d[key].filter((r) => r.id !== id);
        // Suppressions en cascade, comme en base
        if (table === "guests") {
          next.responses = d.responses.filter((r) => r.guest_id !== id);
          next.guests = next.guests.filter((g) => g.plus_one_of !== id);
        }
        if (table === "events") {
          next.responses = d.responses.filter((r) => r.event_id !== id);
          next.tables = (d.tables || []).filter((t) => t.event_id !== id);
          next.seating = (d.seating || []).filter((x) => x.event_id !== id);
        }
        if (table === "seating_tables") next.seating = (d.seating || []).filter((x) => x.table_id !== id);
        if (table === "guest_groups") next.guests = d.guests.map((g) => (g.group_id === id ? { ...g, group_id: null } : g));
        if (table === "budget_items") {
          next.payments = d.payments.filter((p) => p.budget_item_id !== id);
          // Les devis et factures restent dans Documents, détachés du poste supprimé
          next.documents = d.documents.map((x) => (x.budget_item_id === id ? { ...x, budget_item_id: null } : x));
        }
        if (table === "vendors") {
          next.items = d.items.map((i) => (i.vendor_id === id ? { ...i, vendor_id: null } : i));
          next.picks = (d.picks || []).map((p) => (p.vendor_id === id ? { ...p, vendor_id: null } : p));
          next.documents = d.documents.filter((x) => x.vendor_id !== id);
          next.messages = d.messages.filter((x) => x.vendor_id !== id);
        }
        if (table === "wedding_members") {
          next.tasks = d.tasks.map((t) => ({ ...t, assignees: (t.assignees || []).filter((a) => a !== id) }));
          next.payments = d.payments.map((p) => (p.payer_id === id ? { ...p, payer_id: null } : p));
          next.documents = d.documents.map((x) => (x.added_by === id ? { ...x, added_by: null } : x));
          next.notes = d.notes.map((x) => (x.added_by === id ? { ...x, added_by: null } : x));
          next.picks = (d.picks || []).map((x) => (x.added_by === id ? { ...x, added_by: null } : x));
        }
        if (table === "document_folders") next.documents = d.documents.filter((x) => x.folder_id !== id);
        if (table === "guest_fields") next.guests = d.guests.map((g) => {
          if (!g.custom || !(id in g.custom)) return g;
          const { [id]: _drop, ...rest } = g.custom;
          return { ...g, custom: rest };
        });
        return next;
      });
      // En base, la suppression d'un poste emporterait ses documents (on delete cascade) : on les détache d'abord
      const rollback = { before, tables: [table] };
      if (table === "budget_items") {
        const kept = await persist(() => supabase.from("documents").update({ budget_item_id: null }).eq("budget_item_id", id), rollback);
        if (!kept) return false;
      }
      return persist(() => supabase.from(table).delete().eq("id", id), rollback);
    },
    [persist, setData],
  );

  const setResponse = useCallback(
    async (guestId, eventId, status) => {
      const row = { wedding_id: dataRef.current.wedding.id, guest_id: guestId, event_id: eventId, status, updated_at: new Date().toISOString() };
      const before = dataRef.current;
      setData((d) => {
        const exists = d.responses.some((r) => r.guest_id === guestId && r.event_id === eventId);
        return {
          ...d,
          responses: exists ? d.responses.map((r) => (r.guest_id === guestId && r.event_id === eventId ? row : r)) : [...d.responses, row],
        };
      });
      return persist(() => supabase.from("guest_responses").upsert(row, { onConflict: "guest_id,event_id" }), { before, tables: ["guest_responses"] });
    },
    [persist, setData],
  );

  const removeGuests = useCallback(
    async (ids) => {
      const gone = new Set(ids);
      const before = dataRef.current;
      setData((d) => {
        // Les accompagnants d'un invité retiré partent avec lui, comme en base
        d.guests.forEach((g) => g.plus_one_of && gone.has(g.plus_one_of) && gone.add(g.id));
        return { ...d, guests: d.guests.filter((g) => !gone.has(g.id)), responses: d.responses.filter((r) => !gone.has(r.guest_id)), seating: (d.seating || []).filter((x) => !gone.has(x.guest_id)) };
      });
      let ok = true;
      for (const part of chunks(ids)) ok = (await persist(() => supabase.from("guests").delete().in("id", part), { before, tables: ["guests"] })) && ok;
      return ok;
    },
    [persist, setData],
  );

  const updateGuests = useCallback(
    async (ids, patch) => {
      const set = new Set(ids);
      const before = dataRef.current;
      setData((d) => ({ ...d, guests: d.guests.map((g) => (set.has(g.id) ? { ...g, ...patch } : g)) }));
      const payload = cleanGuest(patch);
      if (!Object.keys(payload).length) return true;
      let ok = true;
      for (const part of chunks(ids)) ok = (await persist(() => supabase.from("guests").update(payload).in("id", part), { before, tables: ["guests"] })) && ok;
      return ok;
    },
    [persist, setData, cleanGuest],
  );

  // Une modification différente par invité (colonnes ajoutées pour toute une sélection, collage) :
  // un seul rendu, et six requêtes à la fois plutôt que des centaines lancées d'un coup
  const patchGuests = useCallback(
    async (list) => {
      if (!list.length) return true;
      const byId = new Map(list.map((x) => [x.id, x.patch]));
      const before = dataRef.current;
      setData((d) => ({ ...d, guests: d.guests.map((g) => (byId.has(g.id) ? { ...g, ...byId.get(g.id) } : g)) }));
      let ok = true;
      let next = 0;
      const worker = async () => {
        while (next < list.length) {
          const { id, patch } = list[next];
          next += 1;
          const payload = cleanGuest(patch);
          if (Object.keys(payload).length) ok = (await persist(() => supabase.from("guests").update(payload).eq("id", id), { before, tables: ["guests"] })) && ok;
        }
      };
      await Promise.all(Array.from({ length: Math.min(6, list.length) }, worker));
      return ok;
    },
    [persist, setData, cleanGuest],
  );

  // Plan de table : asseoir des invités à une table (ou les en retirer, table null), pour un moment
  const seatGuests = useCallback(
    async (ids, eventId, tableId) => {
      const wedding_id = dataRef.current.wedding.id;
      const set = new Set(ids);
      const base = (dataRef.current.seating || []).filter((x) => x.event_id === eventId && x.table_id === tableId).length;
      const rows = tableId ? ids.map((guest_id, i) => ({ wedding_id, event_id: eventId, guest_id, table_id: tableId, position: base + i })) : [];
      const before = dataRef.current;
      setData((d) => ({ ...d, seating: [...(d.seating || []).filter((x) => !(x.event_id === eventId && set.has(x.guest_id))), ...rows] }));
      if (modeRef.current !== "live") return true;
      let ok = true;
      const rollback = { before, tables: ["seating"] };
      if (tableId) {
        for (const part of chunks(rows)) ok = (await persist(() => supabase.from("seating").upsert(part, { onConflict: "event_id,guest_id" }), rollback)) && ok;
      } else {
        for (const part of chunks(ids)) ok = (await persist(() => supabase.from("seating").delete().eq("event_id", eventId).in("guest_id", part), rollback)) && ok;
      }
      return ok;
    },
    [persist, setData],
  );

  // Remettre des invités retirés (Annuler) : mêmes identifiants, mêmes réponses, à leur place dans la liste.
  // Un groupe ou un moment supprimé entre-temps n'est pas recréé.
  const restoreGuests = useCallback(
    async (rows, responses) => {
      const d0 = dataRef.current;
      const have = new Set(d0.guests.map((g) => g.id));
      const groupIds = new Set(d0.groups.map((g) => g.id));
      const eventIds = new Set(d0.events.map((e) => e.id));
      // Les invités principaux d'abord, leurs accompagnants ensuite (clé plus_one_of)
      const back = rows
        .filter((g) => !have.has(g.id))
        .map((g) => ({ ...g, group_id: groupIds.has(g.group_id) ? g.group_id : null }))
        .sort((a, b) => (a.plus_one_of ? 1 : 0) - (b.plus_one_of ? 1 : 0));
      if (!back.length) return true;
      const ids = new Set(back.map((g) => g.id));
      const resp = responses.filter((r) => ids.has(r.guest_id) && eventIds.has(r.event_id));
      const before = dataRef.current;
      setData((d) => ({
        ...d,
        guests: [...d.guests, ...back].sort((a, b) => (a.position ?? 0) - (b.position ?? 0)),
        responses: [...d.responses.filter((r) => !ids.has(r.guest_id)), ...resp],
      }));
      const rollback = { before, tables: ["guests"] };
      let ok = true;
      for (const part of chunks(back.map(cleanGuest))) ok = (await persist(() => supabase.from("guests").insert(part), rollback)) && ok;
      if (ok) for (const part of chunks(resp)) ok = (await persist(() => supabase.from("guest_responses").upsert(part, { onConflict: "guest_id,event_id" }), rollback)) && ok;
      return ok;
    },
    [persist, setData, cleanGuest],
  );

  const setResponses = useCallback(
    async (ids, eventId, status) => {
      const now = new Date().toISOString();
      const wedding_id = dataRef.current.wedding.id;
      const rows = ids.map((guest_id) => ({ wedding_id, guest_id, event_id: eventId, status, updated_at: now }));
      const set = new Set(ids);
      const before = dataRef.current;
      setData((d) => ({ ...d, responses: [...d.responses.filter((r) => !(r.event_id === eventId && set.has(r.guest_id))), ...rows] }));
      let ok = true;
      for (const part of chunks(rows)) ok = (await persist(() => supabase.from("guest_responses").upsert(part, { onConflict: "guest_id,event_id" }), { before, tables: ["guest_responses"] })) && ok;
      return ok;
    },
    [persist, setData],
  );

  const updateWedding = useCallback(
    async (patch) => {
      const before = dataRef.current;
      setData((d) => ({ ...d, wedding: { ...d.wedding, ...patch } }));
      return persist(() => supabase.from("weddings").update(patch).eq("id", dataRef.current.wedding.id), { before, keys: ["wedding"] });
    },
    [persist, setData],
  );

  // Vues enregistrées de la liste des invités : partagées entre organisateurs quand la colonne existe,
  // sinon gardées sur cet appareil
  const saveGuestViews = useCallback(
    async (views) => {
      setData((d) => ({ ...d, wedding: { ...d.wedding, guest_views: views } }));
      if (modeRef.current !== "live") return true;
      if (!dataRef.current.viewsSetup) {
        writeLocalViews(dataRef.current.wedding.id, views);
        return true;
      }
      return persist(() => supabase.from("weddings").update({ guest_views: views }).eq("id", dataRef.current.wedding.id));
    },
    [persist, setData],
  );

  // Réponses du brief modifiées depuis « Vos critères » (invités, budget, style) : le Brief les montre aussitôt.
  // merry_save_brief (supabase/commentaires-prestataires.sql) laisse chaque organisateur les modifier ;
  // sans elle, seul l'auteur du brief le peut.
  const saveBrief = useCallback(
    async (patch) => {
      setData((d) => ({ ...d, brief: { ...(d.brief || {}), ...patch } }));
      if (modeRef.current === "demo") return true;
      const w = dataRef.current.wedding;
      const rpc = await supabase.rpc("merry_save_brief", { w: w.id, patch });
      if (!rpc.error) return true;
      const missing = /PGRST202|42883|Could not find/i.test(`${rpc.error.code} ${rpc.error.message}`);
      if (missing && w.brief_id) {
        const { data, error } = await supabase.from("briefs").update(patch).eq("id", w.brief_id).select("id");
        if (!error && data?.length) return true;
      }
      setToast({
        kind: "error",
        text: missing ? "Le brief ne peut être modifié ici que par celui qui l'a rempli : collez supabase/commentaires-prestataires.sql dans Supabase (SQL Editor)." : "Le brief n'a pas pu être enregistré. Réessayez.",
      });
      return false;
    },
    [setData],
  );

  // Disposition des colonnes d'un tableau, partagée entre les organisateurs (supabase/mise-en-page.sql)
  const saveLayout = useCallback(
    async (key, layout) => {
      const layouts = { ...(dataRef.current.wedding.layouts || {}), [key]: layout };
      setData((d) => ({ ...d, wedding: { ...d.wedding, layouts } }));
      return persist(() => supabase.from("weddings").update({ layouts }).eq("id", dataRef.current.wedding.id));
    },
    [persist, setData],
  );

  const saveKpis = useCallback(
    async (scope, kpis) => {
      setData((d) => ({ ...d, kpiPrefs: { ...d.kpiPrefs, [scope]: kpis } }));
      return persist(() =>
        supabase.from("kpi_prefs").upsert({ wedding_id: dataRef.current.wedding.id, scope, kpis, updated_at: new Date().toISOString() }, { onConflict: "user_id,wedding_id,scope" }),
      );
    },
    [persist, setData],
  );

  // Formulaire invités : une ligne par mariage, créée au premier enregistrement
  // Une ligne par mariage (formulaire, site) écrite entière par l'éditeur. Deux organisateurs ou deux onglets
  // peuvent l'éditer en même temps : la mise à jour n'est acceptée que si la ligne n'a pas bougé depuis sa
  // lecture (updated_at), sinon { conflict: true, row } avec la version en base, que l'éditeur reprend.
  const saveOneRow = useCallback(
    async (table, key, value, drop) => {
      const weddingId = dataRef.current.wedding.id;
      const row = { ...value, wedding_id: weddingId, updated_at: new Date().toISOString() };
      for (const k of drop) delete row[k];
      const known = dataRef.current[key];
      setData((d) => ({ ...d, [key]: { ...(d[key] || {}), ...row } }));
      if (modeRef.current !== "live") return { ok: true };
      let res;
      if (known?.updated_at) {
        res = await supabase.from(table).update(row).eq("wedding_id", weddingId).eq("updated_at", known.updated_at).select("*");
        if (!res.error && !res.data?.length) {
          // Quelqu'un d'autre a enregistré entre-temps : on reprend sa version
          const { data: fresh } = await supabase.from(table).select("*").eq("wedding_id", weddingId).maybeSingle();
          if (fresh) {
            setData((d) => ({ ...d, [key]: fresh }));
            return { ok: false, conflict: true, row: fresh };
          }
          res = await supabase.from(table).upsert(row, { onConflict: "wedding_id" }).select("*");
        }
      } else {
        res = await supabase.from(table).upsert(row, { onConflict: "wedding_id" }).select("*");
      }
      if (res.error) {
        console.error(`[merry] ${table}`, res.error);
        return { ok: false, error: res.error };
      }
      // La version en base fait foi (updated_at tel que PostgREST le renvoie, pour la prochaine comparaison)
      const saved = res.data?.[0];
      if (saved) setData((d) => ({ ...d, [key]: { ...(d[key] || {}), ...saved } }));
      return { ok: true, row: saved || row };
    },
    [setData],
  );

  const saveForm = useCallback(
    async (form) => saveOneRow("guest_forms", "form", form, ["submissions", "created_at", "rate_window_start", "rate_window_count"]),
    [saveOneRow],
  );

  // Site de mariage : une ligne par mariage, créée à la première visite des réglages
  const saveSite = useCallback(
    async (site) => saveOneRow("wedding_sites", "site", site, ["created_at"]),
    [saveOneRow],
  );

  // Photo d'en-tête : envoyée dans le dossier du mariage, renvoie son adresse publique
  const uploadCover = useCallback(async (blob) => {
    if (modeRef.current !== "live") return { ok: true, url: URL.createObjectURL(blob) };
    const path = `${dataRef.current.wedding.id}/couverture-${Date.now()}.jpg`;
    const { error } = await supabase.storage.from("merry-covers").upload(path, blob, { contentType: "image/jpeg", upsert: false });
    if (error) {
      console.error("[merry] photo d'en-tête", error);
      return { ok: false, error };
    }
    const { data: pub } = supabase.storage.from("merry-covers").getPublicUrl(path);
    return { ok: true, url: pub.publicUrl };
  }, []);

  // ------------------------------------------------------------------
  // Réponses du rétroplanning : enregistrées à chaque changement, partagées entre appareils
  // ------------------------------------------------------------------

  // answers = null : on efface et on repart des réponses déduites du brief.
  // Renvoie false si l'enregistrement a échoué (la page le signale, sans interrompre).
  const saveRetro = useCallback(
    async (answers, device = null) => {
      const d = dataRef.current;
      if (!d) return false;
      const row = answers ? { wedding_id: d.wedding.id, answers, updated_by: d.meId || null, device, updated_at: new Date().toISOString() } : null;
      setData((x) => ({ ...x, retro: row }));
      if (modeRef.current !== "live") return true;
      if (!d.retroSetup) {
        writeLocalRetro(d.wedding.id, row);
        return true;
      }
      try {
        const { error } = row ? await supabase.from("retro_answers").upsert(row, { onConflict: "wedding_id" }) : await supabase.from("retro_answers").delete().eq("wedding_id", d.wedding.id);
        if (error) throw error;
        return true;
      } catch (e) {
        console.warn("[merry] réponses du rétroplanning non enregistrées", e?.message || e);
        return false;
      }
    },
    [setData],
  );

  // ------------------------------------------------------------------
  // Documents : fichiers déposés dans les dossiers (stockage privé merry-documents)
  // ------------------------------------------------------------------

  // Dépose un fichier et crée sa ligne. En démo, le fichier reste dans le navigateur.
  const uploadDocument = useCallback(
    async (file, { folderId = null, name, kind = "autre", budgetItemId = null, vendorId = null } = {}) => {
      const d = dataRef.current;
      const label = (name || file.name || "Document").trim().slice(0, 120);
      if (file.size > DOCUMENT_MAX_BYTES) return { ok: false, reason: "size" };
      const row = {
        id: uid(),
        folder_id: folderId,
        budget_item_id: budgetItemId,
        vendor_id: vendorId,
        kind,
        name: label,
        url: null,
        storage_path: null,
        size_bytes: file.size,
        mime: file.type || null,
        added_by: d.meId || null,
        created_at: new Date().toISOString(),
      };
      if (modeRef.current !== "live") {
        row.url = URL.createObjectURL(file);
        setData((x) => ({ ...x, documents: [...x.documents, { wedding_id: x.wedding.id, ...row }] }));
        return { ok: true, doc: row };
      }
      const safe = (file.name || "document").replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "document";
      row.storage_path = `${d.wedding.id}/${folderId || "sans-dossier"}/${row.id}-${safe}`;
      const { error: upErr } = await supabase.storage.from("merry-documents").upload(row.storage_path, file, { contentType: file.type || undefined, upsert: false });
      if (upErr) {
        console.error("[merry] dépôt du fichier", upErr);
        const setup = /bucket not found|not found/i.test(upErr.message || "");
        return { ok: false, reason: setup ? "setup" : "upload", error: upErr };
      }
      const list = await insert("documents", row);
      if (!list.ok) {
        await supabase.storage.from("merry-documents").remove([row.storage_path]).catch(() => {});
        return { ok: false, reason: "db" };
      }
      return { ok: true, doc: list[0] };
    },
    [insert, setData],
  );

  // Lien pour ouvrir un document : signé (une heure) pour un fichier déposé, tel quel pour un lien
  const documentUrl = useCallback(async (doc) => {
    if (doc.url) return doc.url;
    if (!doc.storage_path || modeRef.current !== "live") return null;
    const { data: signed, error } = await supabase.storage.from("merry-documents").createSignedUrl(doc.storage_path, 3600);
    if (error) {
      console.error("[merry] lien du document", error);
      return null;
    }
    return signed?.signedUrl || null;
  }, []);

  // Retire le fichier du stockage, puis sa ligne
  const removeDocument = useCallback(
    async (doc) => {
      if (doc.storage_path && modeRef.current === "live") {
        const { error } = await supabase.storage.from("merry-documents").remove([doc.storage_path]);
        if (error) console.warn("[merry] fichier non retiré du stockage", error.message);
      }
      return remove("documents", doc.id);
    },
    [remove],
  );

  // Supprime un dossier et tout ce qu'il contient
  const removeFolder = useCallback(
    async (folderId) => {
      const docs = dataRef.current.documents.filter((x) => x.folder_id === folderId);
      const paths = docs.map((x) => x.storage_path).filter(Boolean);
      if (paths.length && modeRef.current === "live") {
        const { error } = await supabase.storage.from("merry-documents").remove(paths);
        if (error) console.warn("[merry] fichiers non retirés du stockage", error.message);
      }
      return remove("document_folders", folderId);
    },
    [remove],
  );

  const renewInvite = useCallback(
    async (memberId) => {
      if (modeRef.current !== "live") {
        const token = uid();
        setData((d) => ({ ...d, members: d.members.map((m) => (m.id === memberId ? { ...m, invite_token: token } : m)) }));
        return token;
      }
      const { data: token, error } = await supabase.rpc("merry_renew_invite", { member: memberId });
      if (error) {
        fail(error);
        return null;
      }
      setData((d) => ({ ...d, members: d.members.map((m) => (m.id === memberId ? { ...m, invite_token: token } : m)) }));
      return token;
    },
    [fail, setData],
  );

  // Les membres ajoutés reçoivent leur jeton d'invitation de la base : on relit la ligne.
  const refreshMember = useCallback(
    async (memberId) => {
      if (modeRef.current !== "live") return;
      const { data: row } = await supabase.from("wedding_members").select("*").eq("id", memberId).maybeSingle();
      if (row) setData((d) => ({ ...d, members: d.members.map((m) => (m.id === memberId ? row : m)) }));
    },
    [setData],
  );

  // ------------------------------------------------------------------
  // Prestataires : envies (une ligne par mariage) et demandes de devis
  // ------------------------------------------------------------------

  const saveWishes = useCallback(
    async (patch) => {
      const d = dataRef.current;
      const row = { wishes: {}, skipped: [], ...(d.wishes || {}), ...patch, wedding_id: d.wedding.id, updated_by: d.meId || null, updated_at: new Date().toISOString() };
      const before = dataRef.current;
      setData((x) => ({ ...x, wishes: row }));
      return persist(() => supabase.from("vendor_wishes").upsert(row, { onConflict: "wedding_id" }), { before, keys: ["wishes"] });
    },
    [persist, setData],
  );

  // Une demande = un message adapté à chaque prestataire. Chacun reçoit sa fiche (vendors) et le
  // message sur cette fiche : ses réponses s'y notent, comme pour les autres prestataires du budget.
  const sendQuotes = useCallback(
    async ({ picks, message, questions, dates, budget, notes, sign }) => {
      const d = dataRef.current;
      const now = new Date().toISOString();
      const requests = await insert("quote_requests", { message, questions, dates: dates.filter(Boolean), share_budget: !!budget, sent_by: d.meId || null, created_at: now });
      if (!requests.ok) return false;
      const [request] = requests;
      let all = true;
      for (const pick of picks) {
        const v = pick.data || {};
        const name = (v.name || "Prestataire").trim();
        let vendor = dataRef.current.vendors.find((x) => x.id === pick.vendor_id) || dataRef.current.vendors.find((x) => normalize(x.name) === normalize(name));
        if (!vendor) {
          const created = await insert("vendors", { name, category: catOf(pick.category).label, phone: v.phone || null, email: v.email || null, website: v.website || null, created_at: now });
          if (!created.ok) {
            all = false;
            continue;
          }
          [vendor] = created;
        }
        const sendSign = sign?.trim() || signature(d.wedding);
        const body = requestBody({ message, note: notes[pick.id], questions: questions[pick.category] || [], dates, budget, sign: sendSign });
        const msg = await insert("vendor_messages", { vendor_id: vendor.id, from_vendor: false, author_id: d.meId || null, body, sent_at: now });
        const linked = await update("vendor_picks", pick.id, { vendor_id: vendor.id, request_id: request.id, requested_at: now, note: notes[pick.id]?.trim() || null, checked: false });
        if (!msg.ok || !linked) {
          all = false;
          continue;
        }
        // Le prestataire n'est prévenu par mail que si sa demande est bien enregistrée dans Merry
        if (modeRef.current === "live") notifyVendor(vendor.id, { message: message.trim(), dates, budget, questions: questions[pick.category] || [], sign: sendSign, guests: guestsLabel(d) });
      }
      return all;
    },
    [insert, update],
  );

  const resetDemo = useCallback(() => {
    try {
      window.localStorage.removeItem(DEMO_KEY);
    } catch {
      /* ignore */
    }
    const data = buildDemo();
    dataRef.current = data;
    setState((s) => ({ ...s, data }));
  }, []);

  const switchWedding = useCallback(
    (id) => {
      try {
        window.localStorage.setItem(WEDDING_KEY, id);
      } catch {
        /* ignore */
      }
      setState((s) => ({ ...s, status: "loading" }));
      load();
    },
    [load],
  );

  const leaveWedding = useCallback(async () => {
    if (modeRef.current !== "live") return { ok: false };
    const { error } = await supabase.rpc("merry_leave", { w: dataRef.current.wedding.id });
    if (error) return { ok: false, last: /Dernier/.test(error.message || "") };
    try {
      window.localStorage.removeItem(WEDDING_KEY);
    } catch {
      /* ignore */
    }
    setState((s) => ({ ...s, status: "loading" }));
    load();
    return { ok: true };
  }, [load]);

  const signOut = useCallback(async () => {
    resetAnalytics();
    if (modeRef.current === "demo") {
      try {
        window.sessionStorage.removeItem(DEMO_FLAG);
      } catch {
        /* ignore */
      }
      window.location.href = "/connexion";
      return;
    }
    await supabase.auth.signOut();
    window.location.href = "/connexion";
  }, []);

  const value = useMemo(
    () => ({
      ...state,
      toast,
      setToast,
      presence,
      trackPage,
      reload: load,
      insert,
      update,
      remove,
      removeGuests,
      updateGuests,
      patchGuests,
      restoreGuests,
      seatGuests,
      setResponses,
      setResponse,
      updateWedding,
      saveGuestViews,
      saveBrief,
      saveKpis,
      saveLayout,
      saveForm,
      saveSite,
      saveRetro,
      uploadCover,
      uploadDocument,
      documentUrl,
      removeDocument,
      removeFolder,
      saveWishes,
      sendQuotes,
      renewInvite,
      refreshMember,
      resetDemo,
      signOut,
      setData,
      switchWedding,
      leaveWedding,
    }),
    [state, toast, presence, trackPage, load, insert, update, remove, removeGuests, updateGuests, patchGuests, restoreGuests, seatGuests, setResponses, setResponse, updateWedding, saveGuestViews, saveBrief, saveKpis, saveLayout, saveForm, saveSite, saveRetro, uploadCover, uploadDocument, documentUrl, removeDocument, removeFolder, saveWishes, sendQuotes, renewInvite, refreshMember, resetDemo, signOut, setData, switchWedding, leaveWedding],
  );

  return <DashContext.Provider value={value}>{children}</DashContext.Provider>;
}

export function useDash() {
  return useContext(DashContext);
}

// Raccourci pour les pages : renvoie les données (toujours présentes une fois chargées)
export function useData() {
  return useContext(DashContext).data;
}
