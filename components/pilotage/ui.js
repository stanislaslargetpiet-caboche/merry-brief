"use client";

// Briques de la page de pilotage : tuiles, barres, tableaux, entonnoir, menus déroulants. Encre et greige dans les
// graphes ; aucune couleur décorative (DESIGN.md). Une page tient en cinq chiffres au plus, un graphe, puis ses menus.

import { createContext, useContext, useEffect, useState } from "react";
import { PilotIcon } from "@/components/pilotage/icons";
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
        <span className={`pl-tile-delta${good ? " is-good" : bad ? " is-bad" : ""}`} title="Par rapport à la période précédente">
          {d.sens === "stable" ? "=" : d.diff > 0 ? "+" : "−"}
          {d.sens === "stable" ? "" : format(Math.abs(d.diff))}
          {d.pct !== null && d.sens !== "stable" ? ` (${d.pct > 0 ? "+" : ""}${d.pct} %)` : ""}
        </span>
      ) : sub ? (
        <span className="pl-tile-sub">{sub}</span>
      ) : null}
    </div>
  );
}

// Barre à bout arrondi, carrée sur la ligne de base
function barPath(x, y, w, h, base) {
  if (h <= 0) return "";
  const r = Math.min(4, h, w / 2);
  return `M${x},${base}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${base}Z`;
}

function Legend({ items }) {
  return (
    <span className="pl-legend">
      {items.map(([label, color]) => (
        <span key={label}>
          <i style={{ background: color }} />
          {label}
        </span>
      ))}
    </span>
  );
}

// Barres par jour. `series` : [{ jour, ...valeurs }] ; `keys` : une ou deux mesures, la première en encre, la
// seconde en greige derrière ; `days` sépare la période courante (encre) de la précédente (greige clair).
export function DayBars({ series, keys, labels, days, format = fmtInt, height = 120 }) {
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
          <Legend items={keys[1] ? [[labels?.[0] || main, "#1c1c1a"], [labels?.[1] || keys[1], "#d9d7cf"]] : [["Cette période", "#1c1c1a"], ...(cut > 0 ? [["Période précédente", "#b8b6ad"]] : [])]} />
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
              {keys[1] ? <path d={barPath(x, H - h2, w, h2, H)} fill={current ? "#d9d7cf" : "#ecebe6"} /> : null}
              <path d={barPath(x, H - h1, w, h1, H)} fill={hover === i ? "#6b6a63" : current ? "#1c1c1a" : "#b8b6ad"} />
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

// Colonnes étiquetées : [{ label, n }], pour ce qui ne se lit pas par jour (mois de dépenses)
export function ColBars({ rows, format = fmtInt, empty = "Rien pour l'instant", height = 120 }) {
  const list = rows || [];
  if (!list.length) return <div className="pl-empty">{empty}</div>;
  const max = Math.max(1, ...list.map((r) => Number(r.n) || 0));
  return (
    <ol className="pl-cols" style={{ "--h": `${height}px` }}>
      {list.map((r) => (
        <li key={r.label} title={`${r.label} : ${format(r.n)}`}>
          <span className="pl-cols-value">{format(r.n)}</span>
          <span className="pl-cols-bar" style={{ height: `${((Number(r.n) || 0) / max) * height}px` }} />
          <span className="pl-cols-label">{r.label}</span>
        </li>
      ))}
    </ol>
  );
}

// Chiffres de détail dans un menu : [{ label, value, sub? }], une ligne chacun
export function Facts({ rows, format = fmtInt }) {
  return (
    <dl className="pl-facts">
      {rows.filter(Boolean).map((r) => (
        <div key={r.label}>
          <dt>
            {r.label}
            {r.sub ? <span className="pl-muted"> · {r.sub}</span> : null}
          </dt>
          <dd>{r.value === null || r.value === undefined ? "–" : typeof r.value === "number" ? format(r.value) : r.value}</dd>
        </div>
      ))}
    </dl>
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

// Menus repliables : l'état de chacune est gardé dans le navigateur (localStorage, clé pl-fold).
const FOLD_KEY = "pl-fold";
const SectionContext = createContext("");
// La sous-page ouverte : une section ne se dessine que sur la sienne, mais ses composants restent montés
export const PageContext = createContext(null);

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

function useFold(key, defaultOpen, enabled) {
  const [open, setOpenState] = useState(defaultOpen);
  useEffect(() => {
    if (enabled) setOpenState(readFold(key) ?? defaultOpen);
  }, [key, defaultOpen, enabled]);
  const set = (next) => {
    setOpenState(next);
    writeFold(key, next);
  };
  return [open, set];
}

// `right` : le bouton d'action de la page (mail du jour, rafraîchir le SEO)
export function Section({ id, children, right }) {
  if (useContext(PageContext) !== id) return null;
  return (
    <section className="pl-section">
      {right ? <div className="pl-section-head">{right}</div> : null}
      <SectionContext.Provider value={id}>{children}</SectionContext.Provider>
    </section>
  );
}

// Le graphe principal de la page
export function Card({ title, children, note }) {
  return (
    <div className="pl-card">
      {title ? <h3>{title}</h3> : null}
      {children}
      {note ? <p className="pl-note">{note}</p> : null}
    </div>
  );
}

// Les menus déroulants de la page, dans une seule carte
export function Folds({ children }) {
  return <div className="pl-folds">{children}</div>;
}

// Un menu : fermé par défaut, `open` pour le premier ; l'état est gardé dans le navigateur. `value` : le chiffre
// qui le résume, lisible sans l'ouvrir.
export function Fold({ title, icon = "document", value, open: first = false, note, children }) {
  const section = useContext(SectionContext);
  const [open, setOpen] = useFold(`fold:${section}/${title}`, first, true);
  return (
    <div className={`pl-fold-item${open ? " is-open" : ""}`}>
      <button type="button" className="pl-fold" aria-expanded={open} onClick={() => setOpen(!open)}>
        <PilotIcon name={icon} />
        <span className="pl-fold-title">{title}</span>
        {value !== undefined && value !== null ? <span className="pl-fold-value">{value}</span> : null}
        <span className="pl-chev" aria-hidden="true" />
      </button>
      <div className="pl-fold-body" hidden={!open}>
        {children}
        {note ? <p className="pl-note">{note}</p> : null}
      </div>
    </div>
  );
}

export function Pill({ tone = "neutral", children }) {
  return <span className={`pl-pill is-${tone}`}>{children}</span>;
}
