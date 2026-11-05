"use client";

// Briques de la page de pilotage : tuiles, barres par jour, tableaux, entonnoir. Encre et greige, un seul aplat
// citron pour la période courante ; aucune couleur décorative (DESIGN.md).

import { createContext, useContext, useEffect, useState } from "react";
import { delta, fmtDay, fmtInt } from "@/lib/server/pilotage/shape";

export function Tile({ label, value, prev, sub, format = fmtInt, inverse = false, hint }) {
  const missing = value === null || value === undefined;
  const d = missing || prev === undefined || prev === null ? null : delta(value, prev);
  const good = d && (inverse ? d.sens === "baisse" : d.sens === "hausse");
  const bad = d && (inverse ? d.sens === "hausse" : d.sens === "baisse");
  return (
    <div className="pl-tile" title={hint}>
      <span className="pl-tile-value">{missing ? "–" : format(value)}</span>
      <span className="pl-tile-label">{label}</span>
      {d ? (
        <span className={`pl-tile-delta${good ? " is-good" : bad ? " is-bad" : ""}`}>
          {d.sens === "stable" ? "=" : d.diff > 0 ? "+" : "−"}
          {d.sens === "stable" ? "" : format(Math.abs(d.diff))}
          {d.pct !== null && d.sens !== "stable" ? ` (${d.pct > 0 ? "+" : ""}${d.pct} %)` : ""}
          <span className="pl-tile-delta-sub"> vs période précédente</span>
        </span>
      ) : sub ? (
        <span className="pl-tile-sub">{sub}</span>
      ) : null}
    </div>
  );
}

// Barres par jour. `series` : [{ jour, ...valeurs }] ; `keys` : une ou deux mesures, la première en encre, la
// seconde en greige derrière ; `days` sépare la période courante (encre) de la précédente (greige clair).
export function DayBars({ series, keys, labels, days, format = fmtInt, height = 96 }) {
  const [hover, setHover] = useState(null);
  const rows = series || [];
  if (!rows.length) return <div className="pl-empty">Pas encore de données</div>;
  const main = keys[0];
  const max = Math.max(1, ...rows.map((r) => Math.max(...keys.map((k) => Number(r[k]) || 0))));
  const W = 600;
  const H = height;
  const pad = 2;
  const bw = W / rows.length;
  const cut = rows.length - days;
  const hovered = hover !== null ? rows[hover] : null;
  return (
    <div className="pl-bars" onMouseLeave={() => setHover(null)}>
      <div className="pl-bars-head">
        {hovered ? (
          <span>
            <strong>{fmtDay(hovered.jour)}</strong>
            {keys.map((k, i) => (
              <span key={k}>
                {" · "}
                {labels?.[i] || k} <strong>{format(hovered[k])}</strong>
              </span>
            ))}
          </span>
        ) : (
          <span className="pl-muted">
            {labels?.[0] || main} par jour, période courante en encre
            {keys[1] ? `, ${labels?.[1] || keys[1]} en retrait` : ""}
          </span>
        )}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="pl-bars-svg" role="img" aria-label={`${labels?.[0] || main} par jour`}>
        {rows.map((r, i) => {
          const x = i * bw + pad;
          const w = Math.max(1, bw - pad * 2);
          const current = i >= cut;
          const v1 = Number(r[main]) || 0;
          const h1 = (v1 / max) * (H - 4);
          const v2 = keys[1] ? Number(r[keys[1]]) || 0 : 0;
          const h2 = (v2 / max) * (H - 4);
          return (
            <g key={r.jour} onMouseEnter={() => setHover(i)} onTouchStart={() => setHover(i)}>
              <rect x={i * bw} y={0} width={bw} height={H} fill="transparent" />
              {keys[1] ? <rect x={x} y={H - h2} width={w} height={h2} rx={2} fill={current ? "#d9d7cf" : "#ecebe6"} /> : null}
              <rect
                x={x}
                y={H - h1}
                width={w}
                height={h1}
                rx={2}
                fill={hover === i ? "#6b6a63" : current ? "#1c1c1a" : "#b8b6ad"}
              />
            </g>
          );
        })}
      </svg>
      <div className="pl-bars-axis">
        <span>{fmtDay(rows[0].jour)}</span>
        {cut > 0 ? <span className="pl-bars-cut">{fmtDay(rows[cut].jour)} →</span> : null}
        <span>{fmtDay(rows[rows.length - 1].jour)}</span>
      </div>
    </div>
  );
}

// Liste à barres horizontales : [{ label, n, sub? }], la plus grande donne l'échelle.
export function Ranked({ rows, label = "label", value = "n", format = fmtInt, empty = "Rien sur la période", max: maxRows = 10 }) {
  const list = (rows || []).slice(0, maxRows);
  if (!list.length) return <div className="pl-empty">{empty}</div>;
  const max = Math.max(1, ...list.map((r) => Number(r[value]) || 0));
  return (
    <ul className="pl-ranked">
      {list.map((r, i) => (
        <li key={`${r[label]}-${i}`}>
          <span className="pl-ranked-label" title={String(r[label])}>
            {r[label]}
            {r.sub ? <span className="pl-muted"> · {r.sub}</span> : null}
          </span>
          <span className="pl-ranked-bar">
            <span style={{ width: `${((Number(r[value]) || 0) / max) * 100}%` }} />
          </span>
          <span className="pl-ranked-value">{format(r[value])}</span>
        </li>
      ))}
    </ul>
  );
}

export function Table({ cols, rows, empty = "Rien sur la période", max = 12 }) {
  const list = (rows || []).slice(0, max);
  if (!list.length) return <div className="pl-empty">{empty}</div>;
  return (
    <div className="pl-table-wrap">
      <table className="pl-table">
        <thead>
          <tr>
            {cols.map((c) => (
              <th key={c.key} className={c.num ? "is-num" : ""}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {list.map((r, i) => (
            <tr key={r.id || i}>
              {cols.map((c) => (
                <td key={c.key} className={c.num ? "is-num" : ""}>
                  {c.render ? c.render(r) : r[c.key] ?? "–"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Entonnoir : étapes en ordre, chaque barre relative à la première
export function Funnel({ steps }) {
  const list = steps || [];
  const first = Math.max(1, Number(list[0]?.n) || 0);
  if (!list.some((s) => s.n > 0)) return <div className="pl-empty">Aucun onboarding suivi sur la période (PostHog ne voit que les visiteurs qui acceptent les cookies)</div>;
  return (
    <ol className="pl-funnel">
      {list.map((s, i) => {
        const prev = i > 0 ? Number(list[i - 1].n) || 0 : null;
        const lost = prev !== null && prev > 0 ? Math.round(((prev - s.n) / prev) * 100) : null;
        return (
          <li key={s.label}>
            <span className="pl-funnel-label">{s.label}</span>
            <span className="pl-funnel-bar">
              <span style={{ width: `${(s.n / first) * 100}%` }} />
            </span>
            <span className="pl-funnel-value">
              {fmtInt(s.n)}
              {lost !== null && lost > 0 ? <span className="pl-muted"> · −{lost} %</span> : null}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

// Sections et cartes repliables : l'état de chacune est gardé dans le navigateur (localStorage, clé pl-fold), le
// menu du haut ouvre la section visée, et « Tout déplier » / « Tout replier » agissent sur toute la page.
const FOLD_KEY = "pl-fold";
const SectionContext = createContext("");

function readFold(key) {
  try {
    const v = JSON.parse(window.localStorage.getItem(FOLD_KEY) || "{}")[key];
    return typeof v === "boolean" ? v : null;
  } catch {
    return null;
  }
}

function writeFold(key, open) {
  try {
    const all = JSON.parse(window.localStorage.getItem(FOLD_KEY) || "{}");
    all[key] = open;
    window.localStorage.setItem(FOLD_KEY, JSON.stringify(all));
  } catch {
    /* navigation privée : l'état ne dure que le temps de la page */
  }
}

// `onEvent` : réaction aux ordres de la page (ouvrir une section précise, tout déplier, tout replier)
function useFold(key, defaultOpen, { id, isSection, enabled = true }) {
  const [open, setOpenState] = useState(defaultOpen);
  useEffect(() => {
    if (!enabled) return undefined;
    const saved = readFold(key);
    const target = typeof window !== "undefined" && window.location.hash === `#${id}`;
    setOpenState(target ? true : saved ?? defaultOpen);
    const onOpen = (e) => {
      if (isSection && e.detail === id) setOpenState(true);
    };
    const onAll = (e) => {
      if (e.detail) {
        setOpenState(true);
        writeFold(key, true);
      } else if (isSection) {
        setOpenState(false);
        writeFold(key, false);
      }
    };
    window.addEventListener("pilotage:open", onOpen);
    window.addEventListener("pilotage:all", onAll);
    return () => {
      window.removeEventListener("pilotage:open", onOpen);
      window.removeEventListener("pilotage:all", onAll);
    };
  }, [key, id, defaultOpen, isSection, enabled]);
  const set = (next) => {
    setOpenState(next);
    writeFold(key, next);
  };
  return [open, set];
}

export function Section({ id, title, kicker, children, right, defaultOpen = true }) {
  const [open, setOpen] = useFold(`section:${id}`, defaultOpen, { id, isSection: true });
  return (
    <section className={`pl-section${open ? "" : " is-folded"}`} id={id}>
      <header className="pl-section-head">
        <div>
          {kicker ? <span className="pl-kicker">{kicker}</span> : null}
          <h2>
            <button type="button" className="pl-fold" aria-expanded={open} aria-controls={`${id}-corps`} onClick={() => setOpen(!open)}>
              <span className="pl-chev" aria-hidden="true" />
              {title}
            </button>
          </h2>
        </div>
        {open ? right : null}
      </header>
      <div id={`${id}-corps`} hidden={!open}>
        <SectionContext.Provider value={id}>{children}</SectionContext.Provider>
      </div>
    </section>
  );
}

// `fold` : "open" ou "closed" rend la carte repliable, dans l'état indiqué la première fois
export function Card({ title, children, wide, note, fold }) {
  const section = useContext(SectionContext);
  const key = `card:${section}/${title}`;
  const foldable = Boolean(fold && title);
  const [open, setOpen] = useFold(key, fold !== "closed", { id: key, isSection: false, enabled: foldable });
  const shown = !foldable || open;
  return (
    <div className={`pl-card${wide ? " is-wide" : ""}${shown ? "" : " is-folded"}`}>
      {title ? (
        <h3>
          {foldable ? (
            <button type="button" className="pl-fold" aria-expanded={open} onClick={() => setOpen(!open)}>
              <span className="pl-chev" aria-hidden="true" />
              {title}
            </button>
          ) : (
            title
          )}
        </h3>
      ) : null}
      <div hidden={!shown}>
        {children}
        {note ? <p className="pl-note">{note}</p> : null}
      </div>
    </div>
  );
}

export function Pill({ tone = "neutral", children }) {
  return <span className={`pl-pill is-${tone}`}>{children}</span>;
}
