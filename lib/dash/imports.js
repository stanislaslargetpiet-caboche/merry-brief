"use client";

// Imports de listes d'invités qui continuent en arrière-plan.
// Chaque fichier devient un « import » en base (guest_imports) lu morceau par morceau par le serveur
// (guest_import_parts) : l'organisateur peut quitter la page, changer d'onglet ou verrouiller son
// téléphone, la lecture se termine côté serveur et le résultat l'attend à son retour.
// Ce fournisseur vit dans le tableau de bord (Shell), donc il survit aux changements de page.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useDash } from "@/lib/dash/store";
import { uid } from "@/lib/dash/format";

const STALE_MS = 150000; // un morceau « en cours » depuis plus longtemps est considéré comme perdu
const POLL_MS = 2500;
const MAX_LOCAL_BYTES = 900000;

const Ctx = createContext(null);
const EMPTY = { jobs: [], available: false, start: async () => ({ ok: false, reason: "off" }), remove: async () => {}, reload: async () => {} };
export const useImports = () => useContext(Ctx) || EMPTY;

export function reasonText(code) {
  if (code === "quota") return "Limite de lectures du jour atteinte : réessayez demain.";
  if (code === "tick" || code === "auth") return "Votre session a expiré ou la base n'est pas à jour : reconnectez-vous, puis relancez supabase/dashboard.sql si le problème reste.";
  if (code === "too_big") return "Fichier trop lourd : envoyez-le en plusieurs fois.";
  if (code === "no_ai") return "La lecture par l'IA n'est pas activée.";
  return "Merry n'a pas pu lancer la lecture. Réessayez dans un instant.";
}

// Résumé d'un import : avancement, personnes lues (IA, sinon lecture colonne par colonne)
export function summarize(job, now = Date.now()) {
  const total = job.total;
  const created = Date.parse(job.created_at) || now;
  const parts = Array.from({ length: total }, (_, i) => job.parts[i] || null);
  const state = parts.map((p) => {
    if (!p) return now - created > STALE_MS ? "failed" : "pending";
    if (p.status === "running" && now - (Date.parse(p.updated_at) || now) > STALE_MS) return "failed";
    return p.status;
  });
  const done = state.filter((x) => x === "done").length;
  const failed = state.filter((x) => x === "failed").length;
  const active = total - done - failed;
  const firstError = parts.find((p, i) => state[i] === "failed" && p?.error)?.error || (failed ? "Envoi interrompu avant la fin de la lecture." : "");
  const ai = parts.filter((p, i) => state[i] === "done" && p?.result).map((p) => p.result);
  const aiGuests = ai.flatMap((r) => (r.guests || []).map((g) => ({ ...g, extra: g.extra || {} })));
  const aiColumns = [...new Set(ai.flatMap((r) => r.extraColumns || []))];
  const local = job.local && job.local.guests?.length ? job.local : null;
  const base = { id: job.id, name: job.name, kind: job.kind || "txt", note: job.note || "", parts: { done: done + failed, total }, job: true };

  if (active > 0) {
    // Lecture en cours : la lecture colonne par colonne s'affiche déjà, l'IA la remplace quand elle a fini
    return local
      ? { ...base, status: "encours", guests: local.guests, extraColumns: local.extraColumns || [], columns: local.columns || [], byAi: false, provisional: true }
      : { ...base, status: "encours", guests: [], extraColumns: [], columns: [], byAi: false };
  }
  if (failed === 0) {
    const truncated = ai.some((r) => r.truncated);
    return { ...base, status: "lue", guests: aiGuests, extraColumns: aiColumns, columns: ai[0]?.columns || [], byAi: true, why: truncated ? "Liste très longue : vérifiez qu'elle est complète." : null };
  }
  if (local) {
    return { ...base, status: "lue", guests: local.guests, extraColumns: local.extraColumns || [], columns: local.columns || [], byAi: false, why: `${firstError} Merry a lu le tableau colonne par colonne.` };
  }
  if (done > 0) {
    return { ...base, status: "lue", guests: aiGuests, extraColumns: aiColumns, columns: ai[0]?.columns || [], byAi: true, why: `${done} partie${done > 1 ? "s" : ""} sur ${total} lue${done > 1 ? "s" : ""} : ${firstError}` };
  }
  return { ...base, status: "erreur", guests: [], extraColumns: [], columns: [], byAi: false, why: firstError || "Merry n'a pas pu lire ce fichier." };
}

export function ImportsProvider({ children }) {
  const dash = useDash();
  const live = dash.mode === "live" && !!supabase;
  const weddingId = dash.data?.wedding?.id;
  const [raw, setRaw] = useState([]);
  const [available, setAvailable] = useState(null); // null : pas encore su
  const [tick, setTick] = useState(0);
  const localCache = useRef(new Map());
  const busy = useRef(false);

  const load = useCallback(async () => {
    if (!live || !weddingId || busy.current) return;
    busy.current = true;
    try {
      const jr = await supabase.from("guest_imports").select("id,name,kind,note,total,created_at").eq("wedding_id", weddingId).order("created_at");
      if (jr.error) {
        setAvailable(false); // table absente : supabase/imports.sql n'est pas encore installé
        return;
      }
      setAvailable(true);
      const ids = jr.data.map((j) => j.id);
      let parts = [];
      if (ids.length) {
        const pr = await supabase.from("guest_import_parts").select("import_id,idx,status,result,error,updated_at").eq("wedding_id", weddingId);
        if (!pr.error) parts = pr.data;
        const need = ids.filter((id) => !localCache.current.has(id));
        if (need.length) {
          const lr = await supabase.from("guest_imports").select("id,local").in("id", need);
          (lr.data || []).forEach((r) => localCache.current.set(r.id, r.local || null));
        }
      }
      setRaw(
        jr.data.map((j) => ({
          ...j,
          local: localCache.current.get(j.id) || null,
          parts: Object.fromEntries(parts.filter((p) => p.import_id === j.id).map((p) => [p.idx, p])),
        })),
      );
    } finally {
      busy.current = false;
    }
  }, [live, weddingId]);

  const jobs = useMemo(() => raw.map((j) => summarize(j)), [raw, tick]); // eslint-disable-line react-hooks/exhaustive-deps
  const running = jobs.some((j) => j.status === "encours");

  // Au chargement, au retour sur l'onglet (téléphone déverrouillé) et toutes les 2,5 s tant qu'une lecture est en cours
  useEffect(() => {
    if (!live) return undefined;
    load();
    supabase.rpc("merry_imports_cleanup").then(() => {}, () => {});
    const back = () => document.visibilityState === "visible" && load();
    document.addEventListener("visibilitychange", back);
    window.addEventListener("focus", back);
    return () => {
      document.removeEventListener("visibilitychange", back);
      window.removeEventListener("focus", back);
    };
  }, [live, load]);

  useEffect(() => {
    if (!live || !running) return undefined;
    const t = setInterval(() => {
      setTick((n) => n + 1); // fait vieillir les morceaux perdus même sans nouveau résultat
      load();
    }, POLL_MS);
    return () => clearInterval(t);
  }, [live, running, load]);

  const markFailed = useCallback(
    async (id, idx, text) => {
      await supabase
        .from("guest_import_parts")
        .upsert({ import_id: id, idx, wedding_id: weddingId, status: "failed", result: null, error: text, updated_at: new Date().toISOString() }, { onConflict: "import_id,idx" });
    },
    [weddingId],
  );

  // Lance l'import d'un fichier déjà découpé : { name, kind, note, units, local }. Renvoie { ok } ou { ok: false, reason }.
  const start = useCallback(
    async (entry, ctx) => {
      if (!live || !weddingId || !entry.units?.length) return { ok: false, reason: "off" };
      const id = uid();
      let local = entry.local ? { guests: entry.local.guests, extraColumns: entry.local.extraColumns || [], columns: entry.local.columns || [] } : null;
      if (local && JSON.stringify(local).length > MAX_LOCAL_BYTES) local = null;
      const ins = await supabase.from("guest_imports").insert({ id, wedding_id: weddingId, name: String(entry.name || "Liste").slice(0, 200), kind: entry.kind || null, note: entry.note || null, total: Math.min(entry.units.length, 200), local });
      if (ins.error) return { ok: false, reason: "tables", detail: ins.error.message };
      localCache.current.set(id, local);
      const { data: sess } = await supabase.auth.getSession();
      const token = sess?.session?.access_token;
      const post = (i) =>
        fetch("/api/import-invites", {
          method: "POST",
          headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
          body: JSON.stringify({ import_id: id, idx: i, source: { name: entry.name, ...entry.units[i] }, groups: ctx.groups, fields: ctx.fields, events: ctx.events }),
        });
      // Première partie seule : on sait tout de suite si l'IA répond (clé absente, session, quota)
      let res;
      try {
        res = await post(0);
      } catch {
        await supabase.from("guest_imports").delete().eq("id", id);
        return { ok: false, reason: "network" };
      }
      if (res.status !== 202) {
        const j = await res.json().catch(() => ({}));
        await supabase.from("guest_imports").delete().eq("id", id);
        return { ok: false, reason: j.error || String(res.status) };
      }
      // Les autres parties partent en parallèle ; même si la page change, ce code continue
      const rest = entry.units.slice(1).map((_, k) => k + 1);
      Promise.all(
        rest.map(async (i) => {
          try {
            const r = await post(i);
            if (r.status !== 202) {
              const j = await r.json().catch(() => ({}));
              await markFailed(id, i, j.error === "quota" ? "Limite de lectures du jour atteinte." : `Envoi refusé (${r.status}).`);
            }
          } catch {
            await markFailed(id, i, "Envoi interrompu : réessayez.");
          }
        }),
      ).then(load, load);
      await load();
      return { ok: true, id };
    },
    [live, weddingId, markFailed, load],
  );

  const remove = useCallback(
    async (ids) => {
      const list = Array.isArray(ids) ? ids : [ids];
      if (!list.length) return;
      setRaw((r) => r.filter((j) => !list.includes(j.id)));
      if (live) await supabase.from("guest_imports").delete().in("id", list);
    },
    [live],
  );

  const value = useMemo(() => ({ jobs, available, start, remove, reload: load }), [jobs, available, start, remove, load]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
