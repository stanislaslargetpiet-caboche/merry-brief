"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useDash } from "@/lib/dash/store";
import { normalize, uid } from "@/lib/dash/format";
import { findCodeColumns, groupsToCreate, resolvePick } from "@/lib/dash/codes";
import { guestKey, rsvpFromCell } from "@/lib/dash/importParse";
import { reasonText, useImports } from "@/lib/dash/imports";
import { badgeOf, pastedEntry, readFile } from "@/lib/dash/importRead";
import { CodeDoubt } from "@/components/dash/CodeDoubt";
import { Icon } from "@/components/dash/icons";
import { PASTEL_KEYS, RSVP } from "@/lib/dash/theme";
import { Btn, GroupChip, InlineEdit, PageHeader, Popover, RsvpMenu, Section } from "@/components/dash/ui";

const MAX_FILES = 15;
const PARALLEL = 3; // parties lues en même temps par l'IA

function plural(n, one, many) {
  return `${n} ${n > 1 ? many : one}`;
}

const YES = /^(oui|o|yes|y|x|ok|present|presente|1|✓|✔)$/;
const NO = /^(non|no|n|0|absent|absente)$/;
function yesNo(v) {
  const n = normalize(v);
  return YES.test(n) ? "oui" : NO.test(n) ? "non" : null;
}

function failureText(code) {
  if (code === "tick" || code === "auth") return "Votre session a expiré ou la base n'est pas à jour : reconnectez-vous puis réessayez.";
  if (code === "too_big") return "Fichier trop lourd : envoyez-le en plusieurs fois.";
  return "Merry n'a pas pu lire ce fichier. Réessayez dans un instant.";
}

// Une cellule compte si elle contient autre chose qu'un tiret ou un blanc
function hasValue(v) {
  const t = String(v ?? "").trim();
  return t !== "" && !/^[-–—_.]+$/.test(t);
}

// Pastille Oui / Non / À confirmer : mêmes pastels que le tableau des invités
function YnChip({ value, onClick, label }) {
  const s = value === "oui" ? RSVP.oui : value === "non" ? RSVP.non : RSVP.attente;
  const text = value === "oui" ? "Oui" : value === "non" ? "Non" : "À confirmer";
  return (
    <button type="button" className="d-rsvp d-yn" style={{ background: s.bg, color: s.ink, fontWeight: s.weight }} onClick={onClick} aria-label={`${label} : ${text}, modifier`} title="Cliquer pour changer">
      {value === "oui" ? <Icon name="check" size={12} sw={2.4} /> : null}
      {text}
    </button>
  );
}

// Compteur coloré du bandeau de synthèse
function Count({ status, n, children }) {
  const s = RSVP[status];
  return (
    <span className="d-rsvp" style={{ background: s.bg, color: s.ink, fontWeight: s.weight }} title={`${s.label} : ${s.hint.toLowerCase()}`}>
      {n} {children}
    </span>
  );
}

// « 93 invités », « 1 vient », « 3 ne viennent pas » : le compteur d'un statut
const STATUS_COUNT = {
  attente: ["invité", "invités"],
  oui: ["vient", "viennent"],
  non: ["ne vient pas", "ne viennent pas"],
  non_invite: ["non invité", "non invités"],
};

// Groupe d'une ligne de l'aperçu : un clic propose les autres groupes
function RowGroup({ group, groups, onPick }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="d-anchor">
      <GroupChip group={group} onClick={() => setOpen((o) => !o)} />
      <Popover open={open} onClose={() => setOpen(false)}>
        {groups.map((g) => (
          <button
            key={g.id}
            type="button"
            className={`d-pop-item${group && g.id === group.id ? " is-on" : ""}`}
            onClick={() => {
              onPick(g.id);
              setOpen(false);
            }}
          >
            <GroupChip group={g} />
            {group && g.id === group.id ? <Icon name="check" size={14} sw={2.2} /> : null}
          </button>
        ))}
        <button
          type="button"
          className="d-pop-item"
          onClick={() => {
            onPick("none");
            setOpen(false);
          }}
        >
          <span className="d-pop-label">Sans groupe</span>
        </button>
      </Popover>
    </span>
  );
}

// Test de la lecture par l'IA : clé, modèle, base et un vrai petit appel, pour savoir d'où vient un problème
function Diagnostic() {
  const [state, setState] = useState(null); // null | "wait" | { lines }
  async function run() {
    setState("wait");
    try {
      const { data: sess } = await supabase.auth.getSession();
      const res = await fetch("/api/import-invites?ping=1", { headers: { authorization: `Bearer ${sess?.session?.access_token}` } });
      const j = await res.json();
      if (!res.ok) return setState({ lines: [[false, "Session non reconnue : reconnectez-vous."]] });
      setState({
        lines: [
          [j.key, j.key ? "Clé Anthropic présente" : "Clé Anthropic absente : ajoutez ANTHROPIC_API_KEY dans Vercel (Settings > Environment Variables), puis redéployez"],
          [j.tick === "ok", j.tick === "ok" ? "Compteur de lectures de la base : ok" : `Compteur de lectures de la base indisponible (${j.tick || "inconnu"}) : relancez supabase/dashboard.sql dans Supabase`],
          [j.ai === "ok", j.ai === "ok" ? `Lecture par l'IA : ok (modèle ${j.model})` : `Lecture par l'IA : ${j.ai === "no_key" ? "impossible sans clé" : j.ai}`],
          [j.background === "ok", j.background === "ok" ? "Lecture en arrière-plan : activée" : "Lecture en arrière-plan : non installée, exécutez supabase/imports.sql dans Supabase (l'import marche quand même, mais pas si vous quittez la page)"],
        ],
      });
    } catch {
      setState({ lines: [[false, "Impossible de joindre le serveur."]] });
    }
  }
  return (
    <div className="d-col" style={{ gap: 8, alignItems: "flex-start" }}>
      <button type="button" className="d-link" onClick={run} disabled={state === "wait"} style={{ fontSize: 13 }}>
        {state === "wait" ? "Test en cours…" : "Un souci de lecture ? Tester la connexion à l'IA"}
      </button>
      {state && state !== "wait" ? (
        <ul className="d-small" style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 4 }}>
          {state.lines.map(([ok, text], i) => (
            <li key={i} style={{ color: ok ? "inherit" : "#9b2c2c" }}>
              {ok ? "✓ " : "✗ "}
              {text}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export default function Importer() {
  const dash = useDash();
  const router = useRouter();
  const { guests, groups, events, fields } = dash.data;
  const imports = useImports();
  const [localFiles, setFiles] = useState([]); // lectures dans cette page (démo, secours) : { id, name, kind, note, status, parts, guests, extraColumns, byAi }
  // Les imports du serveur (lus en arrière-plan) s'ajoutent aux lectures locales
  const files = useMemo(() => [...localFiles, ...imports.jobs], [localFiles, imports.jobs]);
  const [noBackground, setNoBackground] = useState(false);
  const [aiOff, setAiOff] = useState(false);
  const [pasted, setPasted] = useState("");
  const [showPaste, setShowPaste] = useState(false);
  const [over, setOver] = useState(false);
  const [saving, setSaving] = useState(false);
  const [extraOn, setExtraOn] = useState({});
  const [view, setView] = useState("all"); // all | todo : lignes incomplètes seulement
  const [showHow, setShowHow] = useState(false);
  const [codeAnswers, setCodeAnswers] = useState({}); // colonne de codes -> { mode: "groups" | "keep", map, keep }
  const tableRef = useRef(null);
  const [edits, setEdits] = useState({}); // rowId -> champs corrigés
  const [removed, setRemoved] = useState({}); // rowId -> true
  const [selected, setSelected] = useState({}); // rowId -> true
  const inputRef = useRef(null);
  const aiOffRef = useRef(false);

  // Quand l'IA remplace l'aperçu rapide d'un import, les lignes changent : les corrections faites sur l'aperçu sont abandonnées
  const jobMode = useRef(new Map());
  useEffect(() => {
    for (const j of imports.jobs) {
      const mode = `${j.status}:${j.byAi}`;
      const before = jobMode.current.get(j.id);
      jobMode.current.set(j.id, mode);
      if (before && before !== mode) {
        const gone = (o) => Object.fromEntries(Object.entries(o).filter(([k]) => !k.startsWith(`${j.id}:`)));
        setEdits(gone);
        setRemoved(gone);
        setSelected(gone);
      }
    }
  }, [imports.jobs]);

  // À l'ouverture : la clé IA est-elle installée ? (évite de découvrir le problème après avoir déposé un fichier)
  useEffect(() => {
    if (dash.mode !== "live" || !supabase) return;
    (async () => {
      try {
        const { data: sess } = await supabase.auth.getSession();
        const res = await fetch("/api/import-invites", { headers: { authorization: `Bearer ${sess?.session?.access_token}` } });
        if (!res.ok) return;
        const j = await res.json();
        if (!j.key) {
          aiOffRef.current = true;
          setAiOff(true);
        }
        if (j.background === "missing") setNoBackground(true);
      } catch {
        /* hors ligne : on verra à l'envoi */
      }
    })();
  }, [dash.mode]);

  const patchFile = (id, patch) => setFiles((x) => x.map((f) => (f.id === id ? { ...f, ...(typeof patch === "function" ? patch(f) : patch) } : f)));

  const groupIdFor = useMemo(() => {
    const list = groups.map((g) => [normalize(g.name), g.id]);
    return (name) => {
      const n = normalize(name || "");
      if (!n) return null;
      const exact = list.find(([k]) => k === n);
      if (exact) return exact[1];
      const near = list.find(([k]) => k.includes(n) || n.includes(k));
      return near ? near[1] : null;
    };
  }, [groups]);

  // Lecture locale (sans IA) : tableaux et texte ; les PDF et photos attendent l'IA
  function fallbackLocal(entry, why) {
    if (entry.local && entry.local.guests.length) {
      patchFile(entry.id, { status: "lue", guests: entry.local.guests, extraColumns: entry.local.extraColumns || [], columns: entry.local.columns || [], byAi: false, why });
    } else if (entry.local) {
      patchFile(entry.id, { status: "erreur", why: "Aucun nom trouvé dans ce fichier." });
    } else {
      patchFile(entry.id, { status: "erreur", why: why || "Les PDF et les photos se lisent avec l'IA, pas encore activée." });
    }
  }

  async function readWithAi(entry) {
    if (dash.mode !== "live" || !supabase || aiOffRef.current) return fallbackLocal(entry);
    const { data: sess } = await supabase.auth.getSession();
    const token = sess?.session?.access_token;
    const units = entry.units;
    const results = new Array(units.length).fill(null);
    let done = 0;
    let stop = null;
    patchFile(entry.id, { status: "encours", parts: { done: 0, total: units.length } });
    let guide = "";
    let lastCode = null;
    let lastMessage = "";

    async function one(i) {
      for (let attempt = 0; attempt < 2; attempt += 1) {
        if (stop) return;
        try {
          const res = await fetch("/api/import-invites", {
            method: "POST",
            headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
            body: JSON.stringify({
              source: { name: entry.name, ...units[i] },
              groups: groups.map((g) => g.name),
              fields: fields.map((f) => f.name),
              events: events.map((e) => e.name),
              guide: i > 0 ? guide : undefined,
            }),
          });
          if (res.status === 501) {
            stop = "off";
            return;
          }
          if (res.status === 429) {
            stop = "quota";
            return;
          }
          if (!res.ok) {
            const j = await res.json().catch(() => ({}));
            lastCode = j.error || String(res.status);
            if (j.message) lastMessage = j.message;
            if (res.status === 401 || res.status === 403) {
              attempt = 1; // inutile de réessayer
            }
            throw new Error(lastCode);
          }
          results[i] = await res.json();
          if (i === 0) guide = results[0].guide || "";
          done += 1;
          patchFile(entry.id, { parts: { done, total: units.length } });
          return;
        } catch {
          if (attempt === 1) results[i] = { failed: true };
        }
      }
    }

    // La première partie fixe la façon de lire le fichier (colonnes, sens du nombre et du statut) ; les suivantes la reprennent
    await one(0);
    let next = 1;
    await Promise.all(
      Array.from({ length: Math.min(PARALLEL, Math.max(units.length - 1, 0)) }, async () => {
        while (next < units.length && !stop) await one(next++);
      }),
    );

    if (stop === "off") {
      aiOffRef.current = true;
      setAiOff(true);
      return fallbackLocal(entry);
    }
    const ok = results.filter((r) => r && !r.failed);
    if (stop === "quota" && !ok.length) return fallbackLocal(entry, "Limite de lectures du jour atteinte : réessayez demain.");
    if (!ok.length) return fallbackLocal(entry, lastMessage || failureText(lastCode));
    if (ok.length < units.length && entry.local?.guests.length) return fallbackLocal(entry, "Lu en partie par l'IA : Merry a lu le tableau colonne par colonne.");
    const found = ok.flatMap((r) => r.guests || []).map((g) => ({ ...g, extra: g.extra || {} }));
    patchFile(entry.id, {
      status: "lue",
      byAi: true,
      guests: found,
      extraColumns: [...new Set(ok.flatMap((r) => r.extraColumns || []))],
      columns: ok[0]?.columns || [],
      why: ok.length < units.length ? `${ok.length} parties sur ${units.length} lues : retirez le fichier et réessayez pour le reste.` : null,
    });
  }

  // Envoie la lecture au serveur : elle continue même si l'on quitte la page. Secours : lecture depuis cette page.
  async function launch(entry) {
    if (dash.mode !== "live" || !supabase || aiOffRef.current) return fallbackLocal(entry);
    const res = await imports.start(entry, { groups: groups.map((g) => g.name), fields: fields.map((f) => f.name), events: events.map((e) => e.name) });
    if (res.ok) {
      setFiles((x) => x.filter((f) => f.id !== entry.id));
      return undefined;
    }
    if (res.reason === "no_ai") {
      aiOffRef.current = true;
      setAiOff(true);
      return fallbackLocal(entry);
    }
    if (["quota", "tick", "auth", "too_big"].includes(res.reason)) return fallbackLocal(entry, reasonText(res.reason));
    if (res.reason === "tables") setNoBackground(true);
    return readWithAi(entry);
  }

  async function addFiles(list) {
    const picked = Array.from(list).slice(0, MAX_FILES);
    const entries = picked.map((f) => ({ id: uid(), name: f.name, kind: "txt", status: "lecture", guests: [], extraColumns: [], file: f }));
    setFiles((x) => [...x, ...entries.map(({ file, ...e }) => e)]);
    for (const e of entries) {
      try {
        const read = await readFile(e.file);
        const entry = { ...e, ...read };
        patchFile(e.id, { kind: read.kind, note: read.note });
        launch(entry);
      } catch (err) {
        patchFile(e.id, { kind: err.kind || "txt", status: "erreur", why: err.note || (err.message === "PDF trop lourd" ? "PDF trop lourd : envoyez-le en plusieurs fois ou en photos." : "Impossible de lire ce fichier.") });
      }
    }
  }

  function addPasted() {
    const text = pasted.trim();
    if (!text) return;
    const entry = { id: uid(), name: "Liste collée", status: "lecture", guests: [], extraColumns: [], ...pastedEntry(text) };
    setFiles((x) => [...x, { ...entry, units: undefined, local: undefined }]);
    setPasted("");
    setShowPaste(false);
    launch(entry);
  }

  // Colonne de présence reconnue = un moment du mariage (nom identique) : « Dîner » remplit « Invités à » ligne par ligne
  const eventForColumn = useMemo(() => {
    const names = new Set(files.flatMap((f) => [...(f.extraColumns || []), ...f.guests.flatMap((g) => Object.keys(g.extra || {}))]));
    const m = new Map();
    for (const c of names) {
      const n = normalize(c);
      const hit = events.filter((e) => normalize(e.name) === n || (e.short_name && normalize(e.short_name) === n));
      if (hit.length === 1) m.set(c, hit[0]);
    }
    return m;
  }, [files, events]);

  // Groupes que les réponses sur les colonnes de codes obligent à créer (« Famille Dormeuil ») : ils n'existent en base qu'à l'ajout
  const newGroups = useMemo(
    () =>
      groupsToCreate(
        Object.values(codeAnswers).filter((a) => a.mode === "groups").map((a) => a.map),
        groups,
        PASTEL_KEYS,
      ),
    [codeAnswers, groups],
  );
  const allGroups = useMemo(() => [...groups, ...newGroups], [groups, newGroups]);

  // Lignes de l'aperçu, avec détection des doublons
  const rows = useMemo(() => {
    const existingByKey = new Map(guests.map((g) => [guestKey(g), g]));
    const existingByEmail = new Map(guests.filter((g) => g.email).map((g) => [normalize(g.email), g]));
    const seen = new Set();
    const out = [];
    files.forEach((f) => {
      f.guests.forEach((g, i) => {
        const id = `${f.id}:${i}`;
        const row = { id, file: f.name, ...g, ...(edits[id] || {}) };
        if (!row.group_id && row.group) row.group_id = groupIdFor(row.group);
        // Colonne de codes expliquée par l'organisateur : le groupe vient de la lettre, sauf s'il l'a corrigé à la main sur cette ligne
        if (!edits[id] || !("group_id" in edits[id])) {
          for (const [col, ans] of Object.entries(codeAnswers)) {
            if (ans.mode !== "groups" || !hasValue((row.extra || {})[col])) continue;
            const hit = resolvePick(ans.map[normalize(row.extra[col])], groups);
            if (hit) row.group_id = hit.id || hit.vid;
          }
        }
        const key = guestKey(row);
        const named = row.first_name || row.last_name;
        if (named && key && seen.has(key)) return; // même personne dans deux fichiers
        if (named && key) seen.add(key);
        const dup = (named && key && existingByKey.get(key)) || (row.email && existingByEmail.get(normalize(row.email)));
        row.dup = dup || null;
        row.presence = {};
        for (const [c, ev] of eventForColumn) {
          const v = rsvpFromCell((row.extra || {})[c]);
          if (v) row.presence[ev.id] = v;
        }
        row.toName = !dup && !named && (row.plus_one_of || row.plusOneOfIndex !== undefined);
        row.check = !dup && (row.uncertain || (!named && !row.plus_one_of && row.plusOneOfIndex === undefined));
        out.push(row);
      });
    });
    return out;
  }, [files, guests, edits, groupIdFor, eventForColumn, codeAnswers, groups]);

  const active = rows.filter((r) => !removed[r.id]);
  const dups = active.filter((r) => r.dup);
  const news = active.filter((r) => !r.dup);
  const checks = active.filter((r) => r.check);
  const toName = active.filter((r) => r.toName);
  const todo = active.filter((r) => r.check || r.toName); // lignes incomplètes
  const removedCount = rows.length - active.length;
  // Colonnes de lettres (D, P, L…) : Merry ne devine pas leur sens, il le demande avant d'ajouter quoi que ce soit
  const codeDoubts = findCodeColumns(active.map((r) => r.extra), new Set(eventForColumn.keys()));
  const pendingDoubts = codeDoubts.filter((d) => !codeAnswers[d.column]);
  const answerCode = (column, ans) => {
    setCodeAnswers((x) => ({ ...x, [column]: ans }));
    setExtraOn((x) => ({ ...x, [column]: ans.mode === "groups" ? !!ans.keep : true })); // la colonne ne devient une colonne de la liste que si on le demande
  };
  const reading = files.some((f) => f.status === "lecture" || f.status === "encours");

  // Le document ne génère que les colonnes qui contiennent quelque chose : Régime, Adresse, Mail, Téléphone et colonnes ajoutées
  const has = (get) => active.some((r) => hasValue(get(r)));
  const showDiet = has((r) => r.diet);
  const showAddress = has((r) => r.address);
  const showMail = has((r) => r.email);
  const showPhone = has((r) => r.phone);
  const filled = (c) => has((r) => (r.extra || {})[c]);
  const allNames = [...new Set(files.flatMap((f) => [...(f.extraColumns || []), ...f.guests.flatMap((g) => Object.keys(g.extra || {}))]))];
  const extraColumns = allNames.filter((c) => !eventForColumn.has(c) && !fields.some((x) => normalize(x.name) === normalize(c)) && filled(c));
  const found = [...[...eventForColumn.keys()].filter(filled), ...extraColumns];
  const info = found.map((c) => {
    const vals = active.map((r) => (r.extra || {})[c]).filter(hasValue);
    const ev = eventForColumn.get(c);
    return { key: c, label: ev ? ev.short_name || ev.name : c, yn: !ev && vals.length > 0 && vals.every((v) => yesNo(v)), ev, count: vals.length, off: !ev && extraOn[c] === false };
  });
  const dataColumns = info.filter((c) => !c.off); // colonnes affichées dans l'aperçu
  const shownExtra = extraColumns.filter((c) => extraOn[c] !== false);
  // Sans moment reconnu dans le document, tout le monde est invité à tout ; sinon seulement aux moments que le document décrit
  const mappedEvents = dataColumns.filter((c) => c.ev).map((c) => c.ev);
  const invitedTo = (mappedEvents.length ? mappedEvents : events).map((e) => e.id);
  const groupById = new Map(allGroups.map((g) => [g.id, g]));
  // « +1 de Brune » : on sait de qui il s'agit sans quitter la ligne
  const nameOf = (r) => `${r.first_name || ""} ${r.last_name || ""}`.trim();
  const hostOf = (r) => {
    if (r.plus_one_of) return String(r.plus_one_of);
    if (r.plusOneOfIndex === undefined) return "";
    const host = rows.find((x) => x.id === `${r.id.split(":")[0]}:${r.plusOneOfIndex}`);
    return host ? nameOf(host) : "";
  };
  // Statut de chaque personne pour un moment : celui du document, sinon « Invité » (réponse attendue)
  const statusOf = (r, ev) => r.presence[ev.id] || "attente";
  const statusCounts = (ev) => {
    const n = { attente: 0, oui: 0, non: 0, non_invite: 0 };
    for (const r of active) n[statusOf(r, ev)] += 1;
    return n;
  };
  const ynCounts = (c) => {
    let oui = 0;
    let non = 0;
    for (const r of active) {
      const v = yesNo((r.extra || {})[c]);
      if (v === "oui") oui += 1;
      else if (v === "non") non += 1;
    }
    return { oui, non, blank: active.length - oui - non };
  };
  const understood = files.flatMap((f) => f.columns || []).slice(0, 6);
  const notes = [...new Set(files.filter((f) => f.status === "lue" && f.why).map((f) => f.why))];
  const shown = view === "todo" && todo.length ? todo : active;
  const selectedIds = active.filter((r) => selected[r.id]).map((r) => r.id);
  const toggleYn = (r, c) => {
    const cur = yesNo((r.extra || {})[c]);
    const next = cur === "oui" ? "Non" : cur === "non" ? "" : "Oui";
    edit(r.id, { extra: { ...(r.extra || {}), [c]: next } });
  };

  const edit = (id, patch) => setEdits((x) => ({ ...x, [id]: { ...(x[id] || {}), ...patch } }));
  const removeRows = (ids) => {
    setRemoved((x) => ({ ...x, ...Object.fromEntries(ids.map((i) => [i, true])) }));
    setSelected((x) => {
      const n = { ...x };
      ids.forEach((i) => delete n[i]);
      return n;
    });
  };
  const allSelected = shown.length > 0 && shown.every((r) => selected[r.id]);
  const showTodo = () => {
    setView("todo");
    setSelected({});
    setTimeout(() => tableRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  };

  async function commit() {
    setSaving(true);
    // Colonnes nouvelles retenues
    const fieldIdByName = new Map(fields.map((f) => [normalize(f.name), f.id]));
    const newFields = shownExtra.map((c, i) => ({ id: uid(), name: c, position: fields.length + i }));
    if (newFields.length) await dash.insert("guest_fields", newFields);
    newFields.forEach((f) => fieldIdByName.set(normalize(f.name), f.id));
    const toCustom = (extra) => {
      const c = {};
      for (const [k, v] of Object.entries(extra || {})) {
        const fid = fieldIdByName.get(normalize(k));
        if (fid && v) c[fid] = String(v);
      }
      return c;
    };
    // Groupes nés des colonnes de codes : créés seulement s'ils servent à au moins un nouvel invité
    const usedGroups = new Set(news.map((r) => r.group_id));
    const madeGroups = newGroups.filter((g) => usedGroups.has(g.id)).map((g, i) => ({ id: uid(), name: g.name, color: g.color, position: groups.length + i, vid: g.id }));
    if (madeGroups.length) await dash.insert("guest_groups", madeGroups.map(({ vid, ...g }) => g));
    const realGroup = new Map(madeGroups.map((g) => [g.vid, g.id]));
    // Nouveaux invités (+1 rattachés à la personne qu'ils accompagnent)
    const created = [];
    const idByRow = new Map();
    let pos = guests.length;
    for (const r of news) {
      const id = uid();
      idByRow.set(r.id, id);
      created.push({
        id,
        first_name: r.first_name || "",
        last_name: r.last_name || "",
        age: Number.isFinite(Number(r.age)) && r.age !== null && r.age !== "" ? Number(r.age) : null,
        diet: r.diet || null,
        address: r.address || null,
        email: r.email || null,
        phone: r.phone || null,
        group_id: r.group_id === "none" ? null : realGroup.get(r.group_id) || r.group_id || null,
        custom: toCustom(r.extra),
        position: pos++,
        _row: r,
      });
    }
    for (const c of created) {
      const r = c._row;
      if (r.plusOneOfIndex !== undefined) {
        const [fid] = r.id.split(":");
        c.plus_one_of = idByRow.get(`${fid}:${r.plusOneOfIndex}`) || null;
      } else if (r.plus_one_of) {
        const host = created.find((x) => guestKey(x) === normalize(r.plus_one_of)) || guests.find((x) => guestKey(x) === normalize(r.plus_one_of));
        c.plus_one_of = host?.id || null;
      }
      delete c._row;
    }
    if (created.length) {
      await dash.insert("guests", created);
      const responses = [];
      const now = new Date().toISOString();
      const presenceById = new Map(news.map((r) => [idByRow.get(r.id), r.presence || {}]));
      for (const g of created) {
        const pres = presenceById.get(g.id) || {};
        for (const ev of events) {
          const own = pres[ev.id]; // statut lu dans le document
          responses.push({ guest_id: g.id, event_id: ev.id, status: own || (invitedTo.includes(ev.id) ? "attente" : "non_invite"), updated_at: now });
        }
      }
      if (responses.length) await dash.insert("guest_responses", responses);
    }
    // Doublons : on complète seulement ce qui manque
    for (const r of dups) {
      const patch = {};
      for (const k of ["address", "email", "phone", "diet"]) if (r[k] && !r.dup[k]) patch[k] = r[k];
      if (r.age && !r.dup.age) patch.age = Number(r.age) || null;
      const custom = { ...toCustom(r.extra), ...(r.dup.custom || {}) };
      if (Object.keys(custom).length !== Object.keys(r.dup.custom || {}).length) patch.custom = custom;
      if (Object.keys(patch).length) await dash.update("guests", r.dup.id, patch);
    }
    setSaving(false);
    dash.setToast({ kind: "ok", text: `${plural(created.length, "invité ajouté", "invités ajoutés")}${dups.length ? `, ${plural(dups.length, "fusionné", "fusionnés")}` : ""}.` });
    imports.remove(files.filter((f) => f.job).map((f) => f.id));
    router.push("/dashboard/invites");
  }

  return (
    <>
      <PageHeader back={{ href: "/dashboard/invites", label: "Invités" }} title="Importer une liste." />

      <div
        className={`d-drop-big${over ? " is-over" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          addFiles(e.dataTransfer.files);
        }}
      >
        <span className="d-tile" style={{ width: 52, height: 52, borderRadius: 15, background: "#ffffff" }}>
          <Icon name="upload" size={24} />
        </span>
        <strong>Déposez vos listes ici</strong>
        <p>N'importe quel format : Excel ou Google Sheets (toutes les feuilles), CSV, Word, PDF, photo d'une liste écrite à la main, capture d'écran, notes du téléphone.</p>
        <div className="d-filters" style={{ justifyContent: "center" }}>
          <Btn icon="upload" onClick={() => inputRef.current?.click()}>
            Choisir des fichiers
          </Btn>
          <Btn kind="ghost" icon="copy" onClick={() => setShowPaste((v) => !v)}>
            Coller une liste
          </Btn>
        </div>
        <input
          ref={inputRef}
          type="file"
          multiple
          hidden
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {showPaste ? (
        <div className="d-col" style={{ gap: 10 }}>
          <textarea
            className="d-textarea"
            value={pasted}
            onChange={(e) => setPasted(e.target.value)}
            placeholder={"Collez votre liste telle quelle (notes, mail, message, tableau copié) :\nM. et Mme Jean Dupont\nClaire Morel, claire.morel@gmail.com\nLouise Martin +1"}
            autoFocus
            rows={7}
          />
          <div className="d-actions-end">
            <Btn kind="ghost" small onClick={() => setShowPaste(false)}>
              Annuler
            </Btn>
            <Btn small onClick={addPasted} disabled={!pasted.trim()}>
              Lire la liste
            </Btn>
          </div>
        </div>
      ) : null}

      {files.length ? (
        <div className="d-file-chips">
          {files.map((f) => {
            const [label, bg, ink] = badgeOf(f.kind);
            const n = rows.filter((r) => r.id.startsWith(`${f.id}:`)).length;
            const meta =
              f.status === "lue"
                ? plural(n, "personne", "personnes")
                : f.status === "encours" && f.parts?.total > 1
                  ? `partie ${Math.min(f.parts.done + 1, f.parts.total)} sur ${f.parts.total}`
                  : f.status === "erreur"
                    ? f.why
                    : "Lecture…";
            return (
              <div key={f.id} className={`d-file-chip${f.status === "erreur" ? " is-error" : ""}`}>
                <span className="d-file-badge" style={{ background: bg, color: ink }}>
                  {label}
                </span>
                <span className="d-file-chip-text">
                  <strong title={f.name}>{f.name}</strong>
                  <span className="d-small-muted">{meta}</span>
                </span>
                {f.status === "lue" ? (
                  <span className="d-file-state is-ok" title="Lue" aria-label="Lue">
                    <Icon name="check" size={13} sw={2.6} />
                  </span>
                ) : f.status === "erreur" ? (
                  <span className="d-status" style={{ background: "#fde0de", color: "#9b2c2c" }}>
                    Non lue
                  </span>
                ) : (
                  <span className="d-file-state is-busy" title="Merry lit…" aria-label="Merry lit…" />
                )}
                <button type="button" className="d-icon-btn is-flat" aria-label={`Retirer ${f.name}`} onClick={() => (f.job ? imports.remove(f.id) : setFiles((x) => x.filter((y) => y.id !== f.id)))}>
                  <Icon name="x" size={14} sw={2.2} />
                </button>
              </div>
            );
          })}
        </div>
      ) : null}

      {aiOff ? (
        <div className="d-card" style={{ background: "var(--d-panel)", border: 0, gap: 6 }}>
          <strong style={{ fontSize: 14 }}>La lecture par l'IA n'est pas encore activée.</strong>
          <span className="d-small d-muted">
            En attendant, Merry lit les tableaux et le texte colonne par colonne. Les PDF et les photos seront lus dès qu'elle sera activée. Vérifiez l'aperçu avant d'ajouter.
          </span>
        </div>
      ) : null}

      {imports.jobs.some((j) => j.status === "encours") ? (
        <div className="d-card" style={{ background: "var(--d-limetint, #f4f5d6)", border: 0, gap: 4 }}>
          <strong style={{ fontSize: 14 }}>Merry lit votre liste.</strong>
          <span className="d-small d-muted">Vous pouvez quitter cette page ou fermer l'application : la lecture continue, et la liste vous attend ici à votre retour.</span>
        </div>
      ) : null}

      {noBackground ? (
        <div className="d-card" style={{ background: "var(--d-panel)", border: 0, gap: 4 }}>
          <strong style={{ fontSize: 14 }}>Lecture en arrière-plan non installée.</strong>
          <span className="d-small d-muted">Pour que l'import continue quand vous quittez la page, exécutez supabase/imports.sql dans Supabase (SQL Editor). En attendant, restez sur cette page pendant la lecture.</span>
        </div>
      ) : null}

      {rows.length ? (
        <>
          {codeDoubts.map((d) => (
            <CodeDoubt key={d.column} doubt={d} answer={codeAnswers[d.column]} groups={groups} onAnswer={(a) => answerCode(d.column, a)} />
          ))}
          <div className={`d-readout${todo.length ? "" : " is-clean"}`}>
            <div className="d-readout-top">
              <span className={`d-readout-mark${reading ? " is-busy" : ""}`}>{reading ? null : <Icon name="check" size={16} sw={2.6} />}</span>
              <div className="d-readout-title">
                <strong>
                  {reading ? "Lecture en cours" : "Liste lue"} : {plural(active.length, "personne", "personnes")}
                </strong>
                {dups.length ? <span className="d-small d-muted">{plural(dups.length, "est déjà dans votre liste et sera fusionnée", "sont déjà dans votre liste et seront fusionnées")}</span> : null}
              </div>
              <Btn onClick={commit} disabled={saving || reading || !active.length || pendingDoubts.length > 0} title={pendingDoubts.length ? "Répondez d'abord à la question de Merry sur la colonne" : undefined}>
                {reading ? "Merry lit encore…" : pendingDoubts.length ? "Répondez à Merry d'abord" : news.length ? "Ajouter à la liste" : "Fusionner les doublons"}
              </Btn>
            </div>

            {info.length ? (
              <div className="d-readout-cols">
                {info.map((c) => {
                  const sc = c.ev ? statusCounts(c.ev) : null;
                  const n = c.yn ? ynCounts(c.key) : null;
                  return (
                    <div key={c.key} className={`d-readout-col${c.off ? " is-off" : ""}`}>
                      <strong>{c.label}</strong>
                      {sc ? (
                        <span className="d-readout-counts">
                          {["attente", "oui", "non", "non_invite"]
                            .filter((k) => sc[k])
                            .map((k) => (
                              <Count key={k} status={k} n={sc[k]}>
                                {STATUS_COUNT[k][sc[k] > 1 ? 1 : 0]}
                              </Count>
                            ))}
                        </span>
                      ) : n ? (
                        <span className="d-readout-counts">
                          {n.oui ? (
                            <Count status="oui" n={n.oui}>
                              oui
                            </Count>
                          ) : null}
                          {n.non ? (
                            <Count status="non" n={n.non}>
                              non
                            </Count>
                          ) : null}
                          {n.blank ? (
                            <Count status="attente" n={n.blank}>
                              à confirmer
                            </Count>
                          ) : null}
                        </span>
                      ) : (
                        <span className="d-small d-muted">{plural(c.count, "valeur", "valeurs")}</span>
                      )}
                      {!c.ev ? (
                        <button type="button" className={`d-pill d-pill-sm${c.off ? "" : " is-on"}`} aria-pressed={!c.off} onClick={() => setExtraOn((x) => ({ ...x, [c.key]: c.off }))} title={c.off ? "Ajouter cette colonne à votre liste" : "Ne pas ajouter cette colonne"}>
                          {c.off ? "Ignorée" : "Nouvelle colonne"}
                          {c.off ? null : <Icon name="check" size={12} sw={2.4} />}
                        </button>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : null}

            {todo.length ? (
              <div className="d-readout-todo">
                <span className="d-readout-alert" aria-hidden="true">
                  !
                </span>
                <span className="d-readout-todo-text">
                  <strong>{plural(todo.length, "ligne incomplète", "lignes incomplètes")}</strong>
                  <span className="d-small d-muted">{[checks.length ? `${checks.length} à vérifier` : "", toName.length ? `${toName.length} +1 à nommer` : ""].filter(Boolean).join(" · ")}</span>
                </span>
                <Btn kind="ghost" small onClick={showTodo}>
                  Voir les lignes incomplètes
                </Btn>
              </div>
            ) : reading ? null : (
              <div className="d-readout-todo is-ok">
                <span className="d-small">Aucune ligne à vérifier.</span>
              </div>
            )}

            {notes.length || understood.length ? (
              <div className="d-readout-foot">
                {notes.map((t, i) => (
                  <span key={i} className="d-small d-muted">
                    {t}
                  </span>
                ))}
                {understood.length ? (
                  <button type="button" className="d-link" style={{ fontSize: 12 }} onClick={() => setShowHow((v) => !v)}>
                    {showHow ? "Masquer comment Merry a lu le fichier" : "Comment Merry a lu le fichier"}
                  </button>
                ) : null}
                {showHow && understood.length ? (
                  <ul className="d-readout-how">
                    {understood.map((u, i) => (
                      <li key={i}>
                        « {u.source} » : {u.meaning}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}
          </div>

          <div ref={tableRef} style={{ scrollMarginTop: 16 }}>
            <Section
              title="Aperçu"
              right={
                todo.length ? (
                  <span className="d-seg" role="group" aria-label="Lignes affichées">
                    <button type="button" className={`d-pill d-pill-sm${shown === active ? " is-on" : ""}`} aria-pressed={shown === active} onClick={() => (setView("all"), setSelected({}))}>
                      Toutes ({active.length})
                    </button>
                    <button type="button" className={`d-pill d-pill-sm${shown !== active ? " is-on" : ""}`} aria-pressed={shown !== active} onClick={showTodo}>
                      Incomplètes ({todo.length})
                    </button>
                  </span>
                ) : (
                  <span className="d-small d-muted" style={{ whiteSpace: "nowrap" }}>
                    {plural(active.length, "ligne", "lignes")}
                  </span>
                )
              }
            />
          </div>

          {selectedIds.length ? (
            <div className="d-selbar" role="region" aria-label="Lignes sélectionnées">
              <strong>{plural(selectedIds.length, "ligne sélectionnée", "lignes sélectionnées")}</strong>
              <span className="d-selbar-actions">
                <button type="button" onClick={() => setSelected({})}>
                  Tout désélectionner
                </button>
                <button type="button" className="is-danger" onClick={() => removeRows(selectedIds)}>
                  <Icon name="trash" size={14} sw={2} />
                  {selectedIds.length > 1 ? `Supprimer les ${selectedIds.length} lignes` : "Supprimer la ligne"}
                </button>
              </span>
            </div>
          ) : null}

          <div className="d-table-wrap">
            <table className="d-table d-guests">
              <thead>
                <tr>
                  <th className="d-col-check">
                    <input
                      type="checkbox"
                      className="d-check"
                      checked={allSelected}
                      onChange={() => setSelected(allSelected ? {} : Object.fromEntries(active.map((r) => [r.id, true])))}
                      aria-label="Tout sélectionner"
                    />
                  </th>
                  <th>Invités</th>
                  {showDiet ? <th>Régime</th> : null}
                  {showAddress ? <th>Adresse</th> : null}
                  {showMail ? <th>Mail</th> : null}
                  {showPhone ? <th>Téléphone</th> : null}
                  {dataColumns.map((c) => (
                    <th key={c.key} className="d-col-custom">
                      {c.label}
                    </th>
                  ))}
                  <th>Import</th>
                  <th aria-label="Supprimer" />
                </tr>
              </thead>
              <tbody>
                {shown.map((r, rowIndex) => {
                  const group = groupById.get(r.group_id || (r.dup ? r.dup.group_id : null));
                  const label = `${r.first_name || ""} ${r.last_name || ""}`.trim();
                  const isSel = !!selected[r.id];
                  return (
                    <tr key={r.id} className={`d-row-in ${isSel ? "d-row-selected" : r.dup ? "d-row-dup" : r.check ? "d-row-check" : ""}`} style={{ animationDelay: `${Math.min(rowIndex, 14) * 35}ms` }}>
                      <td className="d-col-check">
                        <input type="checkbox" className="d-check" checked={isSel} onChange={() => setSelected((x) => ({ ...x, [r.id]: !isSel }))} aria-label={`Sélectionner ${label || "cette ligne"}`} />
                      </td>
                      <td>
                        <div className="d-guest-name">
                          <InlineEdit
                            value={label}
                            placeholder={r.plusOneOfIndex !== undefined || r.plus_one_of ? (hostOf(r) ? `+1 de ${hostOf(r)}` : "+1 à nommer") : "Sans nom"}
                            label="nom"
                            width={170}
                            onSave={(v) => {
                              const parts = String(v || "").trim().split(/\s+/);
                              edit(r.id, { first_name: parts.shift() || "", last_name: parts.join(" "), uncertain: false, note: null });
                            }}
                          />
                          <span className="d-guest-sub">
                            {r.age ? <span>{r.age} ans</span> : null}
                            <RowGroup group={group} groups={allGroups} onPick={(id) => edit(r.id, { group_id: id })} />
                          </span>
                        </div>
                      </td>
                      {showDiet ? (
                        <td>
                          <InlineEdit value={r.diet} label="régime" width={110} onSave={(v) => edit(r.id, { diet: v })} className="d-cell-clip" />
                        </td>
                      ) : null}
                      {showAddress ? (
                        <td>
                          <InlineEdit value={r.address} label="adresse" width={200} onSave={(v) => edit(r.id, { address: v })} className="d-cell-clip" />
                        </td>
                      ) : null}
                      {showMail ? (
                        <td>
                          <InlineEdit value={r.email} label="mail" width={170} onSave={(v) => edit(r.id, { email: v })} className="d-cell-clip" />
                        </td>
                      ) : null}
                      {showPhone ? (
                        <td>
                          <InlineEdit value={r.phone} label="téléphone" width={130} onSave={(v) => edit(r.id, { phone: v })} className="d-cell-clip" />
                        </td>
                      ) : null}
                      {dataColumns.map((c) => {
                        const v = (r.extra || {})[c.key];
                        const yn = yesNo(v);
                        return (
                          <td key={c.key} className="d-col-custom">
                            {c.ev ? (
                              <RsvpMenu status={statusOf(r, c.ev)} title={`${c.label} : modifier le statut`} onPick={(k) => edit(r.id, { extra: { ...(r.extra || {}), [c.key]: RSVP[k].label } })} />
                            ) : c.yn ? (
                              <YnChip value={yn} label={c.label} onClick={() => toggleYn(r, c.key)} />
                            ) : hasValue(v) ? (
                              v
                            ) : (
                              <span className="d-muted">–</span>
                            )}
                          </td>
                        );
                      })}
                      <td>
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 3 }}>
                          {r.dup ? (
                            <>
                              <span className="d-status" style={{ background: "#f4f5d6", color: "#5d5e12" }}>
                                Sera fusionné
                              </span>
                              <span className="d-small-muted">Déjà dans votre liste</span>
                            </>
                          ) : r.check ? (
                            <>
                              <span className="d-status" style={{ background: "#fde0de", color: "#9b2c2c" }}>
                                À vérifier
                              </span>
                              {r.note ? <span className="d-small-muted">{r.note}</span> : null}
                            </>
                          ) : r.toName ? (
                            <span className="d-status is-todo">+1 à nommer</span>
                          ) : (
                            <span className="d-okpill is-small">
                              <Icon name="plus" size={12} sw={2.4} />
                              Nouveau
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <button type="button" className="d-icon-btn is-flat is-danger" onClick={() => removeRows([r.id])} aria-label={`Supprimer ${label || "cette ligne"}`} title="Supprimer cette ligne">
                          <Icon name="trash" size={16} sw={2} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="d-filters" style={{ justifyContent: "space-between" }}>
            <span className="d-small d-muted">
              {removedCount ? (
                <button type="button" className="d-link" style={{ fontSize: "inherit" }} onClick={() => setRemoved({})}>
                  Rétablir {plural(removedCount, "ligne supprimée", "lignes supprimées")}
                </button>
              ) : null}
            </span>
            <div className="d-filters">
              <Btn kind="ghost" href="/dashboard/invites">
                Annuler
              </Btn>
              <Btn onClick={commit} disabled={saving || reading || !active.length || pendingDoubts.length > 0} title={pendingDoubts.length ? "Répondez d'abord à la question de Merry sur la colonne" : undefined}>
                {reading ? "Merry lit encore…" : pendingDoubts.length ? "Répondez à Merry d'abord" : news.length ? "Ajouter à la liste" : "Fusionner les doublons"}
              </Btn>
            </div>
          </div>
        </>
      ) : reading ? (
        <div className="d-empty">
          <p>Merry lit vos listes…</p>
        </div>
      ) : null}
      {dash.mode === "live" && supabase ? <Diagnostic /> : null}
    </>
  );
}
