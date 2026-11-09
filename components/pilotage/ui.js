"use client";

// Briques de la page de pilotage : tuiles, barres, courbes, tableaux, entonnoir, menus déroulants. Encre et greige
// dans les graphes, l'accent seulement pour aujourd'hui, toujours cerclé d'encre : seul sur blanc il ne se lit pas
// (DESIGN.md). Une page tient en cinq chiffres au plus, un graphe, puis ses menus.

import { Children, createContext, Fragment, isValidElement, useContext, useEffect, useRef, useState } from "react";
import { PilotIcon } from "@/components/pilotage/icons";
import { barPath, courbePath, echelle, indicesAxe, pasAxe } from "@/lib/pilotage/graphes";
import { delta, fmtDay, fmtInt } from "@/lib/server/pilotage/shape";

export function Tile({ label, value, prev, sub, format = fmtInt, inverse = false, hint, sansPct = false, selected, onSelect, href, onGo }) {
  const missing = value === null || value === undefined;
  const d = missing || prev === undefined || prev === null ? null : delta(value, prev);
  const good = d && (inverse ? d.sens === "baisse" : d.sens === "hausse");
  const bad = d && (inverse ? d.sens === "hausse" : d.sens === "baisse");
  const contenu = (
    <>
      <span className="pl-tile-value">{missing ? "–" : format(value)}</span>
      <span className="pl-tile-label">{label}</span>
      {d ? (
        <span className={`pl-tile-delta${good ? " is-good" : bad ? " is-bad" : ""}`} title="Par rapport à la période précédente">
          {d.sens === "stable" ? "=" : d.diff > 0 ? "+" : "−"}
          {d.sens === "stable" ? "" : format(Math.abs(d.diff))}
          {!sansPct && d.pct !== null && d.sens !== "stable" ? ` (${d.pct > 0 ? "+" : ""}${d.pct} %)` : ""}
        </span>
      ) : sub ? (
        <span className="pl-tile-sub">{sub}</span>
      ) : null}
    </>
  );
  if (href) return <a className="pl-tile is-link" href={href} title={hint} onClick={onGo ? (e) => onGo(e, href) : undefined}>{contenu}</a>;
  if (!onSelect) return <div className="pl-tile" title={hint}>{contenu}</div>;
  return (
    <button type="button" className={`pl-tile is-tab${selected ? " is-on" : ""}`} title={hint} aria-pressed={Boolean(selected)} onClick={onSelect}>
      {contenu}
    </button>
  );
}

function aplatir(children) {
  return Children.toArray(children).flatMap((c) => (isValidElement(c) && c.type === Fragment ? aplatir(c.props.children) : [c]));
}

// Les chiffres de la page servent d'onglets à son unique graphe : une tuile qui reçoit `chart` se clique, `ouvert` la
// choisit au chargement (sinon la première), `note` s'affiche sous le graphe. Une tuile sans `chart` reste un chiffre.
export function TileChart({ children }) {
  const tuiles = aplatir(children).filter((c) => isValidElement(c));
  const [choix, setChoix] = useState(null);
  const avecGraphe = tuiles.filter((t) => t.props.chart);
  const active = avecGraphe.find((t) => t.props.label === choix) || avecGraphe.find((t) => t.props.ouvert) || avecGraphe[0];
  const position = tuiles.indexOf(active);
  return (
    <div className="pl-bloc">
      <div className="pl-tabs">
        {tuiles.map((t) => {
          const { chart, ouvert, note, ...props } = t.props;
          return <Tile key={props.label} {...props} selected={t === active} onSelect={chart ? () => setChoix(props.label) : undefined} />;
        })}
      </div>
      {active ? (
        <div className={`pl-plot${position === 0 ? " is-first" : ""}${position === tuiles.length - 1 ? " is-last" : ""}`}>
          {active.props.chart}
          {active.props.note ? <p className="pl-note">{active.props.note}</p> : null}
        </div>
      ) : null}
    </div>
  );
}

const JOUR_PARIS = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Paris" });
const jourLong = (jour) => {
  const texte = new Date(`${jour}T12:00:00Z`).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
  return texte.charAt(0).toUpperCase() + texte.slice(1);
};
const largeurTexte = (texte) => String(texte).length * 6.4;

// Largeur réelle du graphe : le dessin se fait en pixels, pour garder des textes de 11 px sur téléphone comme à l'écran
function useLargeur() {
  const ref = useRef(null);
  const [largeur, setLargeur] = useState(0);
  useEffect(() => {
    if (!ref.current) return undefined;
    const observer = new ResizeObserver(([e]) => setLargeur(Math.round(e.contentRect.width)));
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  return [ref, largeur];
}

function ChartHead({ title, children }) {
  return (
    <div className="pl-chart-head">
      {title ? <h3>{title}</h3> : null}
      <span className="pl-legend">{children}</span>
    </div>
  );
}

function Grille({ W, top, base, left, right = W, max, ticks, format }) {
  return ticks.map((t) => {
    const y = base - (t / max) * (base - top);
    return (
      <g key={t}>
        <path d={`M${left},${y}H${right}`} className={t ? "pl-c-grid" : "pl-c-base"} />
        <text x={left - 8} y={y + 4} textAnchor="end" className="pl-c-tick">
          {format(t)}
        </text>
      </g>
    );
  });
}

function Bulle({ x, W, jour, children }) {
  const aGauche = x > W * 0.66;
  return (
    <div className="pl-tip" style={{ left: aGauche ? x - 12 : x + 12, transform: aGauche ? "translateX(-100%)" : undefined }}>
      {jourLong(jour)}
      {children}
    </div>
  );
}

const periodes = (days) => (days === 1 ? ["Aujourd'hui", "La veille"] : [`${days} derniers jours`, `${days} jours d'avant`]);

// Barres par jour. `series` : [{ jour, ...valeurs }] couvrant 2 × `days` jours ; `keys` : une ou deux mesures, côte à
// côte. Encre pour la période en cours, greige pour la précédente, accent pour aujourd'hui, qui n'est pas fini.
export function DayBars({ series, keys, labels, days, format = fmtInt, height = 240, title }) {
  const [ref, W] = useLargeur();
  const [hover, setHover] = useState(null);
  const rows = series || [];
  const num = (r, k) => Number(r[k]) || 0;
  if (!rows.length) {
    return (
      <>
        {title ? <ChartHead title={title} /> : null}
        <div className="pl-empty">Pas encore de données</div>
      </>
    );
  }
  const H = W && W < 480 ? Math.min(height, 200) : height;
  const { max, ticks } = echelle(Math.max(...rows.map((r) => Math.max(...keys.map((k) => num(r, k))))));
  const left = largeurTexte(format(max)) + 10;
  const top = 18;
  const base = H - 22;
  const band = W ? (W - left) / rows.length : 0;
  const cut = rows.length - days;
  const auj = JOUR_PARIS();
  const seul = keys.length === 1;
  const bw = Math.min(seul ? 24 : 14, (band * 0.62) / keys.length);
  const pic = Math.max(...rows.slice(cut).map((r) => num(r, keys[0])));
  const jourPic = rows.findIndex((r, i) => i >= cut && num(r, keys[0]) === pic);
  const y = (v) => base - (v / max) * (base - top);
  const hovered = hover !== null ? rows[hover] : null;
  const unite = (i) => (labels?.[i] || keys[i]).toLowerCase();
  const aAuj = rows.some((r) => r.jour === auj);
  const [cettePeriode, avant] = periodes(days);
  return (
    <div className="pl-chart">
      <ChartHead title={title}>
        <span><i style={{ background: "var(--ink)" }} />{seul ? cettePeriode : labels?.[0] || keys[0]}</span>
        {seul ? null : <span><i style={{ background: "var(--ink-muted)" }} />{labels?.[1] || keys[1]}</span>}
        {cut > 0 ? <span><i style={{ background: "var(--border-strong)" }} />{seul ? avant : "Période d'avant"}</span> : null}
        {aAuj ? <span><i className="is-now" />Aujourd'hui, en cours</span> : null}
      </ChartHead>
      <div ref={ref} className="pl-plot-box" style={{ height: H }} onMouseLeave={() => setHover(null)}>
        {W ? (
          <svg width={W} height={H} role="img" aria-label={`${title || labels?.[0] || keys[0]}, par jour`}>
            <Grille W={W} top={top} base={base} left={left} max={max} ticks={ticks} format={format} />
            {rows.map((r, i) => {
              const courant = i >= cut;
              const debut = left + i * band + (band - bw * keys.length - (keys.length - 1) * 2) / 2;
              const num0 = num(r, keys[0]);
              return (
                <g key={r.jour}>
                  {hover === i ? <rect x={left + i * band + 2} y={top - 12} width={band - 4} height={base - top + 12} rx={8} className="pl-c-band" /> : null}
                  {keys.map((k, j) => {
                    const v = num(r, k);
                    const x = debut + j * (bw + 2);
                    if (!v) return seul ? <path key={k} d={`M${x},${base - 1}h${bw}`} className="pl-c-zero" /> : null;
                    if (j === 0 && r.jour === auj) return <path key={k} d={barPath(x + 0.75, y(v) + 0.75, bw - 1.5, base - y(v) - 0.75, base)} className="pl-c-now" />;
                    return <path key={k} d={barPath(x, y(v), bw, base - y(v), base)} className={courant ? (j ? "pl-c-second" : "pl-c-cur") : j ? "pl-c-prev2" : "pl-c-prev"} />;
                  })}
                  {seul && num0 && (i === jourPic || r.jour === auj) ? (
                    <text x={debut + bw / 2} y={y(num0) - 6} textAnchor="middle" className="pl-c-value">
                      {format(num0)}
                    </text>
                  ) : null}
                </g>
              );
            })}
            {indicesAxe(rows.length, band, cut).map((i) => {
              const large = band >= 44;
              const bord = !large && i === rows.length - 1 ? "end" : !large && i === 0 ? "start" : "middle";
              const x = large ? left + (i + 0.5) * band : bord === "start" ? left : bord === "end" ? W : left + (i + 0.5) * band;
              const jour = rows[i].jour;
              const texte = large && i > 0 && !jour.endsWith("-01") ? String(Number(jour.slice(8))) : fmtDay(jour);
              return (
                <text key={i} x={x} y={H - 5} textAnchor={bord} className={`pl-c-tick${jour === auj ? " is-now" : ""}`}>
                  {texte}
                </text>
              );
            })}
            {rows.map((r, i) => (
              <rect key={r.jour} x={left + i * band} y={0} width={band} height={H} fill="transparent" onMouseEnter={() => setHover(i)} onTouchStart={() => setHover(i)} />
            ))}
          </svg>
        ) : null}
        {hovered ? (
          <Bulle x={left + (hover + 0.5) * band + bw / 2} W={W} jour={hovered.jour}>
            {keys.map((k, j) => (
              <strong key={k}>
                {format(num(hovered, k))} {unite(j)}
              </strong>
            ))}
            {seul && hover >= cut && rows[hover - days] ? <small>{format(num(rows[hover - days], keys[0]))} {days === 1 ? "la veille" : `il y a ${days} jours`}</small> : null}
          </Bulle>
        ) : null}
      </div>
    </div>
  );
}

// Courbe par jour, pour ce qui se lit comme un niveau : taux, durée, position, cumul. La période en cours en encre, la
// précédente en greige, jour pour jour. `valeur` : la clé ; un jour sans mesure vaut null et la courbe le saute.
// `cumul` : toute la série, seule, avec son aire ; une courbe seule a son aire, deux courbes n'en ont pas.
export function DayLine({ series, valeur, label, days, format = fmtInt, height = 240, title, cumul = false }) {
  const [ref, W] = useLargeur();
  const [hover, setHover] = useState(null);
  const rows = series || [];
  const lire = (r) => (r?.[valeur] === null || r?.[valeur] === undefined ? null : Number(r[valeur]));
  const courant = cumul ? rows : rows.slice(-days);
  const passe = cumul ? [] : rows.slice(Math.max(0, rows.length - 2 * days), Math.max(0, rows.length - days));
  const vus = [...courant, ...passe].map(lire).filter((v) => v !== null);
  if (!cumul && days < 2) return <DayBars series={rows} keys={[valeur]} labels={[label]} days={days} format={format} height={height} title={title} />;
  if (courant.length < 2 || !vus.length) {
    return (
      <>
        {title ? <ChartHead title={title} /> : null}
        <div className="pl-empty">Pas encore de données</div>
      </>
    );
  }
  const H = W && W < 480 ? Math.min(height, 200) : height;
  const { max, ticks } = echelle(Math.max(...vus));
  const auj = JOUR_PARIS();
  const dernier = courant[courant.length - 1];
  const finLue = [...courant].reverse().find((r) => lire(r) !== null);
  const left = Math.max(...ticks.map((t) => largeurTexte(format(t)))) + 10;
  const right = finLue ? largeurTexte(format(lire(finLue))) + 20 : 12;
  const top = 10;
  const base = H - 22;
  const pas = W ? (W - left - right) / (courant.length - 1) : 0;
  const X = (i) => left + i * pas;
  const Y = (v) => base - (v / max) * (base - top);
  const points = (liste) => liste.flatMap((r, i) => (lire(r) === null ? [] : [{ x: X(i), y: Y(lire(r)), i }]));
  const lignes = W ? points(courant) : [];
  const avant = W ? points(passe.slice(-courant.length)) : [];
  const trace = courbePath(lignes);
  const fin = lignes[lignes.length - 1];
  const hovered = hover !== null ? courant[hover] : null;
  const pointHover = hover !== null ? lignes.find((p) => p.i === hover) : null;
  const [cettePeriode, periodeAvant] = periodes(days);
  const axe = pasAxe(courant.length, W - left - right);
  return (
    <div className="pl-chart">
      <ChartHead title={title}>
        {cumul ? null : <span><i className="is-line" style={{ background: "var(--ink)" }} />{cettePeriode}</span>}
        {avant.length ? <span><i className="is-line" style={{ background: "var(--border-strong)" }} />{periodeAvant}</span> : null}
        {dernier.jour === auj && lire(dernier) !== null ? <span><i className="is-now" />Aujourd'hui, en cours</span> : null}
      </ChartHead>
      <div ref={ref} className="pl-plot-box" style={{ height: H }} onMouseLeave={() => setHover(null)}>
        {W ? (
          <svg width={W} height={H} role="img" aria-label={`${title || label}, par jour`}>
            <Grille W={W} top={top} base={base} left={left} right={W - right + 12} max={max} ticks={ticks} format={format} />
            {!avant.length && lignes.length > 1 ? <path d={`${trace}V${base}H${lignes[0].x}Z`} className="pl-c-aire" /> : null}
            {avant.length > 1 ? <path d={courbePath(avant)} className="pl-c-ligne-prev" /> : null}
            <path d={trace} className="pl-c-ligne" />
            {pointHover ? (
              <>
                <path d={`M${pointHover.x},${top}V${base}`} className="pl-c-cross" />
                <circle cx={pointHover.x} cy={pointHover.y} r={4} className="pl-c-point" />
              </>
            ) : null}
            {fin ? (
              <>
                {courant[fin.i].jour === auj ? <circle cx={fin.x} cy={fin.y} r={5} className="pl-c-fin" /> : <circle cx={fin.x} cy={fin.y} r={4} className="pl-c-point" />}
                <text x={fin.x + 12} y={fin.y + 5} className="pl-c-value">
                  {format(lire(courant[fin.i]))}
                </text>
              </>
            ) : null}
            {axe.map((i) => (
              <text key={i} x={X(i)} y={H - 5} textAnchor={i === 0 ? "start" : i === courant.length - 1 ? "end" : "middle"} className={`pl-c-tick${courant[i].jour === auj ? " is-now" : ""}`}>
                {fmtDay(courant[i].jour)}
              </text>
            ))}
            {courant.map((r, i) => (
              <rect key={r.jour} x={X(i) - pas / 2} y={0} width={pas} height={H} fill="transparent" onMouseEnter={() => setHover(i)} onTouchStart={() => setHover(i)} />
            ))}
          </svg>
        ) : null}
        {hovered ? (
          <Bulle x={X(hover)} W={W} jour={hovered.jour}>
            <strong>{lire(hovered) === null ? "Pas de mesure" : format(lire(hovered))}</strong>
            {!cumul && lire(passe[hover]) !== null && passe[hover] ? <small>{format(lire(passe[hover]))} il y a {days} jours</small> : null}
          </Bulle>
        ) : null}
      </div>
    </div>
  );
}

// Colonnes étiquetées : [{ label, n }], pour ce qui ne se lit pas par jour (mois de dépenses) ; `courant` : le libellé
// de la colonne en cours, en accent comme aujourd'hui sur les barres par jour
export function ColBars({ rows, format = fmtInt, empty = "Rien pour l'instant", height = 160, title, courant }) {
  const list = rows || [];
  if (!list.length) return <div className="pl-empty">{empty}</div>;
  const max = Math.max(1, ...list.map((r) => Number(r.n) || 0));
  return (
    <div className="pl-chart">
      {title ? <ChartHead title={title} /> : null}
      <ol className="pl-cols" style={{ "--h": `${height}px` }}>
        {list.map((r) => (
          <li key={r.label} title={`${r.label} : ${format(r.n)}`}>
            <span className="pl-cols-value">{format(r.n)}</span>
            <span className={`pl-cols-bar${r.label === courant ? " is-now" : ""}`} style={{ height: `${((Number(r.n) || 0) / max) * height}px` }} />
            <span className="pl-cols-label">{r.label}</span>
          </li>
        ))}
      </ol>
    </div>
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
  // Colonnes voisines au même `group` : un intitulé commun au-dessus d'elles
  const groups = cols.some((c) => c.group)
    ? cols.reduce((acc, c) => {
        const last = acc[acc.length - 1];
        if (last && c.group && last.label === c.group) last.span += 1;
        else acc.push({ label: c.group || "", span: 1 });
        return acc;
      }, [])
    : null;
  return (
    <div className="pl-table-wrap">
      <table className={groups ? "pl-table has-groups" : "pl-table"}>
        <thead>
          {groups ? (
            <tr className="pl-table-groups">
              {groups.map((g, i) => (
                <th key={i} colSpan={g.span}>
                  {g.label}
                </th>
              ))}
            </tr>
          ) : null}
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

// Chargements : le logo et la barre citron à l'ouverture, trois points pour une lecture en cours
export function PilotLoader() {
  return (
    <div className="pl-loader" role="status" aria-label="Chargement">
      <span className="pl-loader-word">Merry</span>
      <span className="pl-loadbar">
        <span />
      </span>
    </div>
  );
}

export function PilotDots({ label = "Chargement" }) {
  return (
    <span className="pl-dots" role="status" aria-label={label}>
      <span />
      <span />
      <span />
    </span>
  );
}
