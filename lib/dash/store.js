"use client";

// Données du tableau de bord : chargées en une fois pour le mariage du compte
// connecté, modifiées en local tout de suite puis enregistrées dans Supabase.
// Sans Supabase (en local) ou avec ?demo=1, on tourne sur les données d'exemple.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { supabase, flushPendingBrief } from "@/lib/supabase";
import { identifyUser, resetAnalytics } from "@/lib/analytics";
import { buildDemo } from "./demo";
import { uid } from "./format";
import { tasksDoneByQuote } from "./links";

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
};

// Fichiers déposés dans les dossiers : 25 Mo au plus par fichier (limite du stockage)
export const DOCUMENT_MAX_BYTES = 25 * 1024 * 1024;

// Colonnes qu'un organisateur peut écrire sur wedding_members (le reste passe par les fonctions SQL)
const MEMBER_COLUMNS = ["id", "wedding_id", "display_name", "initial", "color", "role", "email", "position", "invited_at"];

const DEMO_KEY = "merry-demo-v1";
const DEMO_FLAG = "merry-demo";
const WEDDING_KEY = "merry-wedding";
const PAGE = 1000;
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
      if (saved && saved.wedding && saved.version === 1) return { comments: [], folders: [], ...saved.data, commentsOn: true, documentsSetup: true, fieldsSetup: true, datesSetup: true, retroSetup: true, categoriesSetup: true };
    }
  } catch {
    /* stockage indisponible */
  }
  return buildDemo();
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

function pick(obj, keys) {
  const out = {};
  for (const k of keys) if (k in obj) out[k] = obj[k];
  return out;
}

export function DashProvider({ children }) {
  const [state, setState] = useState({ status: "loading", mode: null, data: null, error: null, user: null });
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

  const fail = useCallback((err) => {
    console.error("[merry]", err);
    setToast({ kind: "error", text: "La modification n'a pas pu être enregistrée. Vérifiez votre connexion et réessayez." });
  }, []);

  const load = useCallback(async () => {
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
      // Supabase renvoie 1 000 lignes au plus par requête : on lit par pages
      const all = async (table, order) => {
        const rows = [];
        for (let from = 0; ; from += PAGE) {
          let req = supabase.from(table).select("*").eq("wedding_id", weddingId);
          if (order) req = req.order(order);
          req = req.order(table === "guest_responses" ? "event_id" : "id"); // ordre stable entre les pages
          const { data: page, error } = await req.range(from, from + PAGE - 1);
          if (error) return { data: null, error };
          rows.push(...page);
          if (page.length < PAGE) return { data: rows, error: null };
        }
      };
      const [w, members, groups, events, fields, guests, responses, tasks, vendors, items, payments, documents, messages, prefs, briefRes] = await Promise.all([
        supabase.from("weddings").select("*").eq("id", weddingId).single(),
        all("wedding_members", "position"),
        all("guest_groups", "position"),
        all("events", "position"),
        all("guest_fields", "position"),
        all("guests", "position"),
        all("guest_responses", "guest_id"),
        all("tasks", "position"),
        all("vendors", "created_at"),
        all("budget_items", "position"),
        all("payments", "created_at"),
        all("documents", "created_at"),
        all("vendor_messages", "sent_at"),
        supabase.from("kpi_prefs").select("*").eq("wedding_id", weddingId),
        supabase.rpc("merry_brief", { w: weddingId }),
      ]);
      // Commentaires des tâches : table ajoutée après coup ; sans elle, le reste fonctionne
      const comments = await all("task_comments", "created_at");
      if (comments.error) console.warn("[merry] commentaires indisponibles", comments.error.message);
      // Dossiers de documents : table ajoutée par supabase/documents.sql ; sans elle, le
      // bloc Documents explique quoi faire et le reste du tableau de bord fonctionne.
      const folders = await all("document_folders", "position");
      if (folders.error) console.warn("[merry] dossiers indisponibles", folders.error.message);
      // Pense-bête : table ajoutée par supabase/pense-bete.sql ; sans elle, l'onglet explique quoi faire
      const notes = await all("pense_bete_items", "position");
      if (notes.error) console.warn("[merry] pense-bête indisponible", notes.error.message);
      const err = [w, members, groups, events, fields, guests, responses, tasks, vendors, items, payments, documents, messages, prefs].find((r) => r.error);
      if (err) throw err.error;
      const brief = briefRes.data?.[0] || null;
      // Formulaire invités : table ajoutée par supabase/formulaire.sql. Si le fichier
      // n'a pas encore été lancé, le reste du tableau de bord fonctionne quand même.
      const formRes = await supabase.from("guest_forms").select("*").eq("wedding_id", weddingId).maybeSingle();
      const form = formRes.error ? null : formRes.data || null;
      const formSetup = !formRes.error;
      // Format des colonnes ajoutées (supabase/colonnes.sql) : sans lui, les colonnes restent du texte libre
      const fieldsRes = await supabase.from("guest_fields").select("source").eq("wedding_id", weddingId).limit(1);
      const fieldsSetup = !fieldsRes.error;
      const datesRes = await supabase.from("events").select("event_date").eq("wedding_id", weddingId).limit(1);
      const datesSetup = !datesRes.error;
      // Réponses du rétroplanning gardées entre appareils (supabase/reponses-et-lignes.sql) ;
      // sans la table, elles restent sur cet appareil.
      const retroRes = await supabase.from("retro_answers").select("*").eq("wedding_id", weddingId).limit(1);
      const retroSetup = !retroRes.error;
      let retro = retroRes.error ? null : retroRes.data?.[0] || null;
      if (!retroSetup) retro = readLocalRetro(weddingId);
      // Plusieurs lignes dans un même poste du budget : colonne « category » du même fichier
      const catRes = await supabase.from("budget_items").select("category").eq("wedding_id", weddingId).limit(1);
      const categoriesSetup = !catRes.error;
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
        kpiPrefs,
        brief,
        form,
        formSetup,
        fieldsSetup,
        datesSetup,
        retro,
        retroSetup,
        categoriesSetup,
        meId: me?.id || null,
        weddings,
      };
      dataRef.current = data;
      identifyUser(user, { display_name: me?.display_name || null });
      setState({ status: "ready", mode: "live", data, error: null, user });
    } catch (error) {
      console.error("[merry] chargement du tableau de bord", error);
      const missing = /function .*merry_bootstrap|relation .* does not exist|Could not find the function/i.test(error?.message || "");
      setState({ status: "error", mode: "live", data: null, error: missing ? "setup" : "load", user });
    }
  }, []);

  useEffect(() => {
    load();
    if (!supabase) return undefined;
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT" && modeRef.current === "live") setState((s) => ({ ...s, status: "signedout", data: null }));
    });
    return () => sub?.subscription?.unsubscribe();
  }, [load]);

  // ------------------------------------------------------------------
  // Écritures génériques (optimistes)
  // ------------------------------------------------------------------

  const persist = useCallback(
    async (fn) => {
      if (modeRef.current !== "live") return true;
      try {
        const { error } = await fn();
        if (error) throw error;
        return true;
      } catch (e) {
        fail(e);
        return false;
      }
    },
    [fail],
  );

  // Un devis signé vaut « prestataire réservé » : les tâches type correspondantes se cochent (et on le dit)
  const afterQuote = useCallback(
    (item) => {
      const ids = tasksDoneByQuote(item, dataRef.current);
      if (!ids.length) return;
      const now = new Date().toISOString();
      const titles = dataRef.current.tasks.filter((t) => ids.includes(t.id)).map((t) => `« ${t.title} »`);
      setData((d) => ({ ...d, tasks: d.tasks.map((t) => (ids.includes(t.id) ? { ...t, done: true, done_at: now } : t)) }));
      persist(() => supabase.from("tasks").update({ done: true, done_at: now }).in("id", ids));
      setToast({ kind: "ok", text: `Devis signé : ${titles.join(", ")} ${titles.length > 1 ? "sont cochées" : "est cochée"} dans le rétroplanning.` });
    },
    [persist, setData],
  );

  const insert = useCallback(
    async (table, rows) => {
      const list = (Array.isArray(rows) ? rows : [rows]).map((r) => ({ id: r.id || uid(), wedding_id: dataRef.current.wedding.id, ...r }));
      const key = TABLES[table];
      setData((d) => ({ ...d, [key]: [...d[key], ...list] }));
      let payload = table === "wedding_members" ? list.map((r) => pick(r, MEMBER_COLUMNS)) : list;
      if (table === "guest_fields" && !dataRef.current.fieldsSetup) payload = payload.map(({ source, kind, options, ...r }) => r);
      if (table === "payments" && !dataRef.current.fieldsSetup) payload = payload.map(({ note, ...r }) => r);
      if (table === "events" && !dataRef.current.datesSetup) payload = payload.map(({ event_date, kind, ...r }) => r);
      if (table === "budget_items" && !dataRef.current.categoriesSetup) payload = payload.map(({ category, ...r }) => r);
      const clean = table === "guest_responses" ? payload.map(({ id, ...r }) => r) : payload;
      await persist(() => supabase.from(table).insert(clean));
      if (table === "budget_items") list.forEach((row) => afterQuote(row));
      return list;
    },
    [persist, setData, afterQuote],
  );

  const update = useCallback(
    async (table, id, patch) => {
      const key = TABLES[table];
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
      const ok = await persist(() => supabase.from(table).update(payload).eq("id", id));
      if (ok && table === "budget_items" && "quote_amount" in patch) afterQuote({ ...dataRef.current.items.find((i) => i.id === id), ...patch });
      return ok;
    },
    [persist, setData, afterQuote],
  );

  const remove = useCallback(
    async (table, id) => {
      setData((d) => {
        const next = { ...d };
        const key = TABLES[table];
        next[key] = d[key].filter((r) => r.id !== id);
        // Suppressions en cascade, comme en base
        if (table === "guests") {
          next.responses = d.responses.filter((r) => r.guest_id !== id);
          next.guests = next.guests.filter((g) => g.plus_one_of !== id);
        }
        if (table === "events") next.responses = d.responses.filter((r) => r.event_id !== id);
        if (table === "guest_groups") next.guests = d.guests.map((g) => (g.group_id === id ? { ...g, group_id: null } : g));
        if (table === "budget_items") {
          next.payments = d.payments.filter((p) => p.budget_item_id !== id);
          next.documents = d.documents.filter((x) => x.budget_item_id !== id);
        }
        if (table === "vendors") {
          next.items = d.items.map((i) => (i.vendor_id === id ? { ...i, vendor_id: null } : i));
          next.documents = d.documents.filter((x) => x.vendor_id !== id);
          next.messages = d.messages.filter((x) => x.vendor_id !== id);
        }
        if (table === "wedding_members") {
          next.tasks = d.tasks.map((t) => ({ ...t, assignees: (t.assignees || []).filter((a) => a !== id) }));
          next.payments = d.payments.map((p) => (p.payer_id === id ? { ...p, payer_id: null } : p));
          next.documents = d.documents.map((x) => (x.added_by === id ? { ...x, added_by: null } : x));
          next.notes = d.notes.map((x) => (x.added_by === id ? { ...x, added_by: null } : x));
        }
        if (table === "document_folders") next.documents = d.documents.filter((x) => x.folder_id !== id);
        if (table === "guest_fields") next.guests = d.guests.map((g) => {
          if (!g.custom || !(id in g.custom)) return g;
          const { [id]: _drop, ...rest } = g.custom;
          return { ...g, custom: rest };
        });
        return next;
      });
      return persist(() => supabase.from(table).delete().eq("id", id));
    },
    [persist, setData],
  );

  const setResponse = useCallback(
    async (guestId, eventId, status) => {
      const row = { wedding_id: dataRef.current.wedding.id, guest_id: guestId, event_id: eventId, status, updated_at: new Date().toISOString() };
      setData((d) => {
        const exists = d.responses.some((r) => r.guest_id === guestId && r.event_id === eventId);
        return {
          ...d,
          responses: exists ? d.responses.map((r) => (r.guest_id === guestId && r.event_id === eventId ? row : r)) : [...d.responses, row],
        };
      });
      return persist(() => supabase.from("guest_responses").upsert(row, { onConflict: "guest_id,event_id" }));
    },
    [persist, setData],
  );

  // Actions groupées sur les invités (sélection dans le tableau) : une requête par paquet de 200
  const chunks = (ids) => Array.from({ length: Math.ceil(ids.length / 200) }, (_, i) => ids.slice(i * 200, i * 200 + 200));

  const removeGuests = useCallback(
    async (ids) => {
      const gone = new Set(ids);
      setData((d) => {
        // Les accompagnants d'un invité retiré partent avec lui, comme en base
        d.guests.forEach((g) => g.plus_one_of && gone.has(g.plus_one_of) && gone.add(g.id));
        return { ...d, guests: d.guests.filter((g) => !gone.has(g.id)), responses: d.responses.filter((r) => !gone.has(r.guest_id)) };
      });
      let ok = true;
      for (const part of chunks(ids)) ok = (await persist(() => supabase.from("guests").delete().in("id", part))) && ok;
      return ok;
    },
    [persist, setData],
  );

  const updateGuests = useCallback(
    async (ids, patch) => {
      const set = new Set(ids);
      setData((d) => ({ ...d, guests: d.guests.map((g) => (set.has(g.id) ? { ...g, ...patch } : g)) }));
      let ok = true;
      for (const part of chunks(ids)) ok = (await persist(() => supabase.from("guests").update(patch).in("id", part))) && ok;
      return ok;
    },
    [persist, setData],
  );

  const setResponses = useCallback(
    async (ids, eventId, status) => {
      const now = new Date().toISOString();
      const wedding_id = dataRef.current.wedding.id;
      const rows = ids.map((guest_id) => ({ wedding_id, guest_id, event_id: eventId, status, updated_at: now }));
      const set = new Set(ids);
      setData((d) => ({ ...d, responses: [...d.responses.filter((r) => !(r.event_id === eventId && set.has(r.guest_id))), ...rows] }));
      let ok = true;
      for (const part of chunks(rows)) ok = (await persist(() => supabase.from("guest_responses").upsert(part, { onConflict: "guest_id,event_id" }))) && ok;
      return ok;
    },
    [persist, setData],
  );

  const updateWedding = useCallback(
    async (patch) => {
      setData((d) => ({ ...d, wedding: { ...d.wedding, ...patch } }));
      return persist(() => supabase.from("weddings").update(patch).eq("id", dataRef.current.wedding.id));
    },
    [persist, setData],
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
  const saveForm = useCallback(
    async (form) => {
      const row = { ...form, wedding_id: dataRef.current.wedding.id, updated_at: new Date().toISOString() };
      delete row.submissions;
      delete row.created_at;
      setData((d) => ({ ...d, form: { ...(d.form || {}), ...row } }));
      if (modeRef.current !== "live") return { ok: true };
      const { error } = await supabase.from("guest_forms").upsert(row, { onConflict: "wedding_id" });
      if (error) {
        console.error("[merry] formulaire", error);
        return { ok: false, error };
      }
      return { ok: true };
    },
    [setData],
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
      reload: load,
      insert,
      update,
      remove,
      removeGuests,
      updateGuests,
      setResponses,
      setResponse,
      updateWedding,
      saveKpis,
      saveLayout,
      saveForm,
      saveRetro,
      uploadCover,
      uploadDocument,
      documentUrl,
      removeDocument,
      removeFolder,
      renewInvite,
      refreshMember,
      resetDemo,
      signOut,
      setData,
      switchWedding,
      leaveWedding,
    }),
    [state, toast, load, insert, update, remove, removeGuests, updateGuests, setResponses, setResponse, updateWedding, saveKpis, saveLayout, saveForm, saveRetro, uploadCover, uploadDocument, documentUrl, removeDocument, removeFolder, renewInvite, refreshMember, resetDemo, signOut, setData, switchWedding, leaveWedding],
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
