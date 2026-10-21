"use client";

// Données du tableau de bord : chargées en une fois pour le mariage du compte
// connecté, modifiées en local tout de suite puis enregistrées dans Supabase.
// Sans Supabase (en local) ou avec ?demo=1, on tourne sur les données d'exemple.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { supabase, flushPendingBrief } from "@/lib/supabase";
import { buildDemo } from "./demo";
import { uid } from "./format";

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
  vendor_messages: "messages",
};

// Colonnes qu'un organisateur peut écrire sur wedding_members (le reste passe par les fonctions SQL)
const MEMBER_COLUMNS = ["id", "wedding_id", "display_name", "initial", "color", "role", "email", "contribution", "position", "invited_at"];

const DEMO_KEY = "merry-demo-v1";
const DEMO_FLAG = "merry-demo";
export const INVITE_KEY = "merry-invite";

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
      if (saved && saved.wedding && saved.version === 1) return saved.data;
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
      // Lien d'invitation d'un organisateur
      let joined = null;
      try {
        const token = window.localStorage.getItem(INVITE_KEY);
        if (token) {
          const { data: w, error } = await supabase.rpc("merry_join", { token });
          if (!error) joined = w;
          window.localStorage.removeItem(INVITE_KEY);
        }
      } catch {
        /* ignore */
      }
      const { data: boot, error: bootErr } = await supabase.rpc("merry_bootstrap");
      if (bootErr) throw bootErr;
      const weddingId = joined || boot;
      const q = (table) => supabase.from(table).select("*").eq("wedding_id", weddingId);
      const [w, members, groups, events, fields, guests, responses, tasks, vendors, items, payments, documents, messages, prefs] = await Promise.all([
        supabase.from("weddings").select("*").eq("id", weddingId).single(),
        q("wedding_members").order("position"),
        q("guest_groups").order("position"),
        q("events").order("position"),
        q("guest_fields").order("position"),
        q("guests").order("position").limit(5000),
        q("guest_responses").limit(20000),
        q("tasks").order("position"),
        q("vendors"),
        q("budget_items").order("position"),
        q("payments"),
        q("documents"),
        q("vendor_messages").order("sent_at"),
        supabase.from("kpi_prefs").select("*").eq("wedding_id", weddingId),
      ]);
      const all = [w, members, groups, events, fields, guests, responses, tasks, vendors, items, payments, documents, messages, prefs];
      const err = all.find((r) => r.error);
      if (err) throw err.error;
      let brief = null;
      if (w.data.brief_id) {
        const { data: b } = await supabase.from("briefs").select("*").eq("id", w.data.brief_id).maybeSingle();
        brief = b || null;
      }
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
        kpiPrefs,
        brief,
        meId: me?.id || null,
      };
      dataRef.current = data;
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

  const insert = useCallback(
    async (table, rows) => {
      const list = (Array.isArray(rows) ? rows : [rows]).map((r) => ({ id: r.id || uid(), wedding_id: dataRef.current.wedding.id, ...r }));
      const key = TABLES[table];
      setData((d) => ({ ...d, [key]: [...d[key], ...list] }));
      const payload = table === "wedding_members" ? list.map((r) => pick(r, MEMBER_COLUMNS)) : list;
      const clean = table === "guest_responses" ? payload.map(({ id, ...r }) => r) : payload;
      await persist(() => supabase.from(table).insert(clean));
      return list;
    },
    [persist, setData],
  );

  const update = useCallback(
    async (table, id, patch) => {
      const key = TABLES[table];
      setData((d) => ({ ...d, [key]: d[key].map((r) => (r.id === id ? { ...r, ...patch } : r)) }));
      const payload = table === "wedding_members" ? pick(patch, MEMBER_COLUMNS) : patch;
      return persist(() => supabase.from(table).update(payload).eq("id", id));
    },
    [persist, setData],
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
        }
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

  const updateWedding = useCallback(
    async (patch) => {
      setData((d) => ({ ...d, wedding: { ...d.wedding, ...patch } }));
      return persist(() => supabase.from("weddings").update(patch).eq("id", dataRef.current.wedding.id));
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

  const signOut = useCallback(async () => {
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
      setResponse,
      updateWedding,
      saveKpis,
      renewInvite,
      refreshMember,
      resetDemo,
      signOut,
      setData,
    }),
    [state, toast, load, insert, update, remove, setResponse, updateWedding, saveKpis, renewInvite, refreshMember, resetDemo, signOut, setData],
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
