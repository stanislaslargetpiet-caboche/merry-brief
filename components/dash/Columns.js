"use client";

// Colonnes d'un tableau que l'utilisateur peut élargir (poignée à droite de l'en-tête)
// et déplacer (glisser l'en-tête). L'ordre, les largeurs, les colonnes masquées et les en-têtes
// renommés sont gardés avec le mariage (les organisateurs voient la même chose) ; tant que
// supabase/mise-en-page.sql n'est pas lancé, ils restent dans le navigateur.

import { useCallback, useEffect, useRef, useState } from "react";
import { useDash } from "@/lib/dash/store";

const MIN = 70;
const MAX = 640;

function readLayout(key) {
  try {
    const raw = window.localStorage.getItem(key);
    if (raw) {
      const v = cleanLayout(JSON.parse(raw));
      if (v) return v;
    }
  } catch {
    /* stockage indisponible */
  }
  return { order: [], widths: {}, hidden: [], labels: {} };
}

function writeLayout(key, layout) {
  try {
    window.localStorage.setItem(key, JSON.stringify(layout));
  } catch {
    /* stockage indisponible */
  }
}

const EMPTY = { order: [], widths: {}, hidden: [], labels: {} };
const isCustom = (l) => l.order.length > 0 || Object.keys(l.widths).length > 0 || l.hidden.length > 0 || Object.keys(l.labels).length > 0;

function cleanLayout(v) {
  if (!v || typeof v !== "object") return null;
  return {
    order: Array.isArray(v.order) ? v.order : [],
    widths: v.widths && typeof v.widths === "object" ? v.widths : {},
    hidden: Array.isArray(v.hidden) ? v.hidden : [],
    labels: v.labels && typeof v.labels === "object" ? v.labels : {},
  };
}

// columns : [{ key, fixed? }] dans l'ordre par défaut. Renvoie les colonnes dans l'ordre
// choisi, les largeurs, et les fonctions à brancher sur les en-têtes.
export function useColumnLayout(tableKey, columns) {
  const dash = useDash();
  const weddingId = dash.data.wedding.id;
  const shared = "layouts" in dash.data.wedding; // supabase/mise-en-page.sql lancé (ou démo)
  const storageKey = `merry-cols-${tableKey}-${weddingId}`;
  const [layout, setLayout] = useState(EMPTY);
  const [drag, setDrag] = useState(null); // { key, over }
  const loaded = useRef(false);
  const saveRemote = useRef(dash.saveLayout);
  saveRemote.current = dash.saveLayout;
  const pending = useRef(null); // écriture en base en attente (on en regroupe les rafales : glisser une largeur)
  const timer = useRef(null);

  const flush = useCallback(() => {
    clearTimeout(timer.current);
    if (pending.current) {
      const next = pending.current;
      pending.current = null;
      saveRemote.current(tableKey, next);
    }
  }, [tableKey]);

  useEffect(() => {
    loaded.current = false;
    const mine = readLayout(storageKey);
    if (shared) {
      const remote = cleanLayout(dash.data.wedding.layouts?.[tableKey]);
      if (remote) setLayout(remote); // même vide (après « Réinitialiser ») : la base fait foi
      else {
        // Première fois : on reprend la disposition de ce navigateur pour tout le monde
        setLayout(mine);
        if (isCustom(mine)) saveRemote.current(tableKey, mine);
      }
    } else setLayout(mine);
    loaded.current = true;
    return flush;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey, shared, flush]);

  const save = useCallback(
    (updater) => {
      setLayout((l) => {
        const next = updater(l);
        if (loaded.current) {
          writeLayout(storageKey, next);
          if (shared) {
            pending.current = next;
            clearTimeout(timer.current);
            timer.current = setTimeout(flush, 600);
          }
        }
        return next;
      });
    },
    [storageKey, shared, flush],
  );

  // Ordre affiché : les colonnes fixes d'abord, puis l'ordre enregistré, puis les nouvelles
  const byKey = new Map(columns.map((c) => [c.key, c]));
  const firstMovable = columns.findIndex((c) => !c.fixed);
  const fixedStart = columns.filter((c, i) => c.fixed && (firstMovable < 0 || i < firstMovable));
  const fixedEnd = columns.filter((c, i) => c.fixed && firstMovable >= 0 && i > firstMovable);
  const movable = columns.filter((c) => !c.fixed);
  const hidden = layout.hidden || [];
  const labels = layout.labels || {};
  const ordered = [...fixedStart, ...layout.order.map((k) => byKey.get(k)).filter((c) => c && !c.fixed), ...movable.filter((c) => !layout.order.includes(c.key)), ...fixedEnd]
    .filter((c) => c.fixed || !hidden.includes(c.key))
    .map((c) => (labels[c.key] ? { ...c, label: labels[c.key] } : c));
  const hiddenColumns = columns.filter((c) => !c.fixed && hidden.includes(c.key));

  const move = useCallback(
    (fromKey, toKey) => {
      if (fromKey === toKey) return;
      save((l) => {
        const keys = ordered.filter((c) => !c.fixed).map((c) => c.key);
        const from = keys.indexOf(fromKey);
        const to = keys.indexOf(toKey);
        if (from < 0 || to < 0) return l;
        keys.splice(from, 1);
        keys.splice(to, 0, fromKey);
        return { ...l, order: keys };
      });
    },
    [ordered, save],
  );

  const reset = useCallback(() => save(() => ({ order: [], widths: {}, hidden: [], labels: {} })), [save]);

  // Masquer / réafficher une colonne (les informations restent enregistrées), renommer un en-tête
  const hide = useCallback((key) => save((l) => ({ ...l, hidden: [...new Set([...(l.hidden || []), key])] })), [save]);
  const show = useCallback((key) => save((l) => ({ ...l, hidden: (l.hidden || []).filter((k) => k !== key) })), [save]);
  const rename = useCallback(
    (key, label) =>
      save((l) => {
        const labels = { ...(l.labels || {}) };
        if (label) labels[key] = label;
        else delete labels[key];
        return { ...l, labels };
      }),
    [save],
  );

  // Poignée : glisser pour élargir ou rétrécir
  const startResize = useCallback(
    (key, e, th) => {
      e.preventDefault();
      e.stopPropagation();
      const startX = e.clientX;
      const startW = th?.getBoundingClientRect().width || layout.widths[key] || 120;
      const onMove = (ev) => {
        const w = Math.max(MIN, Math.min(MAX, Math.round(startW + ev.clientX - startX)));
        save((l) => ({ ...l, widths: { ...l.widths, [key]: w } }));
      };
      const onUp = () => {
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    },
    [layout.widths, save],
  );

  // Propriétés à poser sur chaque <th>
  const headerProps = (col) => {
    const w = layout.widths[col.key];
    const props = {
      style: w ? { width: w, minWidth: w, maxWidth: w } : undefined,
      className: [drag?.over === col.key && drag.key !== col.key ? "is-drop" : "", drag?.key === col.key ? "is-dragging" : ""].filter(Boolean).join(" ") || undefined,
    };
    if (!col.fixed) {
      props.draggable = true;
      props.onDragStart = (e) => {
        e.dataTransfer.effectAllowed = "move";
        try {
          e.dataTransfer.setData("text/plain", col.key);
        } catch {
          /* ignore */
        }
        setDrag({ key: col.key, over: null });
      };
      props.onDragOver = (e) => {
        if (!drag) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        if (drag.over !== col.key) setDrag((d) => (d ? { ...d, over: col.key } : d));
      };
      props.onDrop = (e) => {
        e.preventDefault();
        if (drag) move(drag.key, col.key);
        setDrag(null);
      };
      props.onDragEnd = () => setDrag(null);
    }
    return props;
  };

  const cellStyle = (col) => {
    const w = layout.widths[col.key];
    return w ? { width: w, minWidth: w, maxWidth: w } : undefined;
  };

  return {
    columns: ordered,
    hiddenColumns,
    widths: layout.widths,
    headerProps,
    cellStyle,
    startResize,
    move,
    reset,
    hide,
    show,
    rename,
    customised: layout.order.length > 0 || Object.keys(layout.widths).length > 0 || hidden.length > 0 || Object.keys(labels).length > 0,
  };
}

// Poignée de redimensionnement à poser dans un <th> (position: relative)
export function ResizeHandle({ onMouseDown, label }) {
  return (
    <span
      className="d-col-resize"
      role="separator"
      aria-orientation="vertical"
      aria-label={label ? `Largeur de la colonne ${label}` : "Largeur de la colonne"}
      title="Glisser pour élargir"
      onMouseDown={onMouseDown}
      onClick={(e) => e.stopPropagation()}
    />
  );
}
