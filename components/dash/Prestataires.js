"use client";

// Prestataires (canvas « Merry · Carte brief », artboards 7 à 7j et 7m à 7v) : briques partagées
// entre « Trouver des prestataires », la carte, la page Lieux, « Autour de votre lieu »,
// « Mes prestataires » et « Vos demandes de devis ».

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useDash } from "@/lib/dash/store";
import { CATEGORIES, catOf, initialsOf, inWords, loadRecommendations, mapPoint, SAMPLE_BY_ID, snapshot } from "@/lib/dash/catalog";
import { briefChips, briefLine, budgetLabel, chosenVenue, coupleNames, dateLong, defaultMessage, guestsLabel, legendFor, monthYear, pickStatus, picksBy, QUESTIONS, STATUS, summary } from "@/lib/dash/picks";
import { MAP_BG, PRICE_BARS, project } from "@/lib/dash/provenceMap";
import { addDays, euros, toDate } from "@/lib/dash/format";
import { Icon } from "./icons";

// ---------------------------------------------------------------------------
// Sélection du mariage (vendor_picks)
// ---------------------------------------------------------------------------

export function usePicks() {
  const dash = useDash();
  const { picks = [], picksSetup, meId } = dash.data;
  const byRef = useMemo(() => new Map(picks.map((p) => [p.catalog_ref, p])), [picks]);

  const ready = useCallback(() => {
    if (dash.mode !== "live" || picksSetup) return true;
    dash.setToast({ kind: "error", text: "La sélection n'est pas encore installée : collez supabase/prestataires.sql dans Supabase (SQL Editor)." });
    return false;
  }, [dash, picksSetup]);

  const add = useCallback(
    async (v) => {
      if (!ready()) return null;
      const existing = byRef.get(v.id);
      if (existing) return existing;
      const [row] = await dash.insert("vendor_picks", {
        catalog_ref: v.id,
        category: v.category,
        data: snapshot(v),
        checked: true,
        note: null,
        vendor_id: null,
        request_id: null,
        requested_at: null,
        quote_amount: null,
        quote_at: null,
        added_by: meId || null,
        position: picks.length,
        created_at: new Date().toISOString(),
      });
      return row;
    },
    [ready, byRef, dash, meId, picks.length],
  );

  const toggle = useCallback(
    async (v) => {
      const existing = byRef.get(v.id);
      if (existing) {
        if (!ready()) return;
        await dash.remove("vendor_picks", existing.id);
      } else await add(v);
    },
    [byRef, add, dash, ready],
  );

  const removeMany = useCallback(
    async (list) => {
      if (!ready()) return;
      for (const p of list) await dash.remove("vendor_picks", p.id);
    },
    [dash, ready],
  );

  return { picks, isPicked: (v) => byRef.has(v.id), pickOf: (v) => byRef.get(v.id), add, toggle, removeMany, ready };
}

export function useIsPhone() {
  const [phone, setPhone] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 700px)");
    const on = () => setPhone(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return phone;
}

// Fiche complète d'un prestataire gardé : catalogue d'exemple si on le connaît, sinon ce qui a été gardé
export function vendorFromPick(p) {
  return { ...(p.data || {}), ...(SAMPLE_BY_ID[p.catalog_ref] || {}), id: p.catalog_ref, category: p.category };
}

// Recommandations d'une catégorie (catalogue Merry, ou sélection d'exemple), page par page :
// more() ajoute la page suivante ; bbox ({ south, north, west, east }) cherche dans la zone de la carte.
export function useRecommendations(category, near, bbox = null) {
  const dash = useDash();
  const region = dash.data.wedding.region || dash.data.brief?.region;
  const venue = dash.data.wedding.venue;
  // Lieux : autour de la région choisie ; autres catégories : autour du lieu s'il est connu
  const places = [category === "lieu" ? region : venue, category === "lieu" ? venue : region].filter(Boolean);
  const key = [dash.mode, category, places.join("|"), near ? `${near.lat},${near.lng}` : "", bbox ? Object.values(bbox).map((x) => x.toFixed(3)).join(",") : ""].join("/");
  const [state, setState] = useState({ vendors: [], source: null, center: null, loading: true, hasMore: false, loadingMore: false });
  const keyRef = useRef(key);
  keyRef.current = key;
  const args = { mode: dash.mode, category, places, near, bbox };

  useEffect(() => {
    let live = true;
    setState((s) => ({ ...s, loading: true }));
    loadRecommendations(args).then((res) => live && setState({ ...res, loading: false, loadingMore: false }));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const more = useCallback(async () => {
    if (!state.hasMore || state.loadingMore) return;
    const at = keyRef.current;
    setState((s) => ({ ...s, loadingMore: true }));
    const res = await loadRecommendations({ ...args, offset: state.vendors.length });
    if (keyRef.current !== at) return;
    setState((s) => {
      const seen = new Set(s.vendors.map((v) => v.id));
      return { ...s, vendors: [...s.vendors, ...res.vendors.filter((v) => !seen.has(v.id))], hasMore: res.hasMore, loadingMore: false };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.hasMore, state.loadingMore, state.vendors.length, key]);

  return { ...state, more };
}

// « Voir plus de lieux » : page suivante du catalogue
export function MoreButton({ rec, category, className = "" }) {
  if (!rec.hasMore) return null;
  const c = catOf(category);
  return (
    <div className={`d-pr-more ${className}`}>
      <button type="button" className="d-btn d-btn-ghost" onClick={rec.more} disabled={rec.loadingMore}>
        {rec.loadingMore ? "Chargement…" : `Voir plus de ${c.many}`}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// En-tête : « Prestataires. » et les deux onglets
// ---------------------------------------------------------------------------

export function PrHead({ on }) {
  return (
    <div className="d-pr-head">
      <h1 className="d-title">Prestataires.</h1>
      <Segment on={on} />
    </div>
  );
}

export function Segment({ on }) {
  return (
    <nav aria-label="Prestataires" className="d-pr-seg">
      <Link href="/dashboard/prestataires" className={on === "trouver" ? "is-on" : ""} aria-current={on === "trouver" ? "page" : undefined}>
        Trouver des prestataires
      </Link>
      <Link href="/dashboard/prestataires/mes" className={on === "mes" ? "is-on" : ""} aria-current={on === "mes" ? "page" : undefined}>
        Mes prestataires
      </Link>
    </nav>
  );
}

// « Votre brief » : une puce par réponse, chacune mène au brief
export function BriefBar({ onEnvies }) {
  const data = useDash().data;
  const chips = briefChips(data);
  return (
    <div className="d-pr-briefrow">
      <div className="d-pr-brief">
        <span className="d-pr-brief-label">Votre brief</span>
        <div className="d-pr-brief-chips">
          {chips.map((c) => (
            <Link key={c} href="/dashboard/brief" className="d-pr-chip" aria-label={`Modifier : ${c}`}>
              {c}
              <Icon name="edit" size={12} sw={2} stroke="#6b6a63" />
            </Link>
          ))}
        </div>
      </div>
      <button type="button" className="d-btn d-btn-ghost d-pr-envies-btn" onClick={onEnvies}>
        <Icon name="sparkle" size={15} sw={2} />
        Préciser mes envies
      </button>
    </div>
  );
}

export function CategoryTabs({ value, onChange }) {
  return (
    <div role="tablist" aria-label="Catégories" className="d-pr-tabs">
      {CATEGORIES.map((c) => (
        <button key={c.key} type="button" role="tab" aria-selected={value === c.key} className={value === c.key ? "is-on" : ""} onClick={() => onChange(c.key)}>
          {c.tab}
        </button>
      ))}
    </div>
  );
}

export function ViewToggle({ view, onChange }) {
  return (
    <div role="group" aria-label="Affichage" className="d-pr-view">
      <button type="button" aria-pressed={view === "liste"} className={view === "liste" ? "is-on" : ""} onClick={() => onChange("liste")}>
        <Icon name="list" size={15} sw={2} />
        Liste
      </button>
      <button type="button" aria-pressed={view === "carte"} className={view === "carte" ? "is-on" : ""} onClick={() => onChange("carte")}>
        <Icon name="map" size={15} sw={2} />
        Carte
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Petits éléments
// ---------------------------------------------------------------------------

export function Heart({ on, onClick, label, size = 20, className = "d-pr-heart" }) {
  return (
    <button type="button" className={className} aria-label={label || (on ? "Retirer de ma sélection" : "Ajouter à ma sélection")} aria-pressed={!!on} onClick={onClick}>
      <Icon name="heart" size={size} sw={1.8} stroke="#1c1c1a" fill={on ? "#1c1c1a" : "none"} />
    </button>
  );
}

export function Negotiated({ small }) {
  return <span className={`d-pr-nego${small ? " is-small" : ""}`}>Tarif négocié</span>;
}

export function BestMatch({ small }) {
  return <span className={`d-pr-best${small ? " is-small" : ""}`}>Meilleur match</span>;
}

// Vignette : la photo, sinon les initiales
export function Thumb({ v, size = 56, ring, className = "" }) {
  const photo = (v?.photos || []).find(Boolean);
  return (
    <span
      role="img"
      aria-label={v?.name}
      className={`d-pr-thumb ${className}`}
      style={{ width: size, height: size, backgroundImage: photo ? `url("${photo}")` : undefined, borderColor: ring || undefined, borderWidth: ring ? 2 : 0 }}
    >
      {photo ? null : initialsOf(v?.name)}
    </span>
  );
}

export function StatusChip({ k }) {
  const s = STATUS[k] || STATUS.todo;
  return <span className={`d-pr-status ${s.cls}`}>{s.label}</span>;
}

export function Price({ v, unit, big }) {
  if (!v.price) return null;
  return (
    <span className="d-pr-price">
      <span className="d-pr-price-from">À partir de</span>
      <span className={`d-pr-price-v${big ? " is-big" : ""}`}>{euros(v.price)}</span>
      {unit || v.unit ? <span className="d-pr-price-from">{unit || v.unit}</span> : null}
    </span>
  );
}

// Détail d'une carte : « 140 places assises · 32 couchages · 35 min de l'aéroport de Marseille »
export function details(v, venueName) {
  if (v.category === "lieu") return [v.seats ? `${v.seats} places assises` : null, v.beds !== undefined ? `${v.beds} couchages` : null, v.access].filter(Boolean).join(" · ");
  if (v.km !== undefined) return `${v.works && venueName ? `Intervient au ${venueName}` : "Près de votre lieu"} · ${v.km} km`;
  return v.area || "";
}

// ---------------------------------------------------------------------------
// Carte d'un prestataire (grille des recommandations) avec ses photos
// ---------------------------------------------------------------------------

export function Photos({ v, height, children, onOpen }) {
  const photos = v.photos?.length ? v.photos : [null];
  const [i, setI] = useState(0);
  const start = useRef(null);
  const n = Math.max(photos.length, 5);
  const cur = photos[i] || null;
  const go = (d) => setI((x) => (x + d + photos.length) % photos.length);
  return (
    <div
      className="pc d-pr-photo"
      style={{ height, backgroundImage: cur ? `url("${cur}")` : undefined }}
      onPointerDown={(e) => (start.current = e.clientX)}
      onPointerUp={(e) => {
        if (start.current !== null && Math.abs(e.clientX - start.current) > 40 && photos.length > 1) go(e.clientX < start.current ? 1 : -1);
        start.current = null;
      }}
    >
      <button type="button" className="d-pr-photo-open" aria-label={`${cur ? v.name : `Photo à venir, ${v.name}`}, photo ${i + 1} sur ${n}`} onClick={onOpen}>
        {cur ? null : <span>{v.category === "lieu" ? "Photo du lieu à venir" : "Photo à venir"}</span>}
      </button>
      {children}
      <button type="button" className="pc-arrow d-pr-arrow is-prev" aria-label="Photo précédente" onClick={() => go(-1)}>
        <Icon name="prev" size={16} sw={2.2} stroke="#1c1c1a" />
      </button>
      <button type="button" className="pc-arrow d-pr-arrow is-next" aria-label="Photo suivante" onClick={() => go(1)}>
        <Icon name="next" size={16} sw={2.2} stroke="#1c1c1a" />
      </button>
      <div className={`d-pr-dots${cur ? "" : " is-dark"}`} aria-hidden="true">
        {Array.from({ length: n }, (_, k) => (
          <span key={k} className={k === i ? "is-on" : ""} />
        ))}
      </div>
    </div>
  );
}

export function VendorCard({ v, picked, onToggle, onOpen, venueName }) {
  return (
    <article className="d-pr-card">
      <Photos v={v} onOpen={onOpen}>
        {v.best ? <span className="d-pr-best d-pr-best-on-photo">Meilleur match</span> : null}
        <Heart on={picked} onClick={onToggle} />
      </Photos>
      <div className="d-pr-card-body">
        <div className="d-pr-card-top">
          <div className="d-pr-card-name">
            <h3>
              <button type="button" onClick={onOpen}>
                {v.name}
              </button>
            </h3>
            <div className="d-pr-area">{v.area}</div>
          </div>
          {v.negotiated ? <Negotiated /> : null}
        </div>
        {details(v, venueName) ? <div className="d-pr-details">{details(v, venueName)}</div> : null}
        {v.why ? (
          <div className="d-pr-why">
            <span>{v.category === "lieu" ? "Pourquoi ce lieu :" : "Pourquoi :"}</span> {v.why}
          </div>
        ) : null}
        {v.price ? (
          <div className="d-pr-card-price">
            <Price v={v} />
          </div>
        ) : null}
      </div>
    </article>
  );
}

// ---------------------------------------------------------------------------
// Bandeau « Ma sélection » : noir pour une seule catégorie (7), blanc pour plusieurs (7g)
// ---------------------------------------------------------------------------

export function SelectionBar({ picks, onRequest, onClear }) {
  const by = picksBy(picks);
  const groups = CATEGORIES.filter((c) => by[c.key].length);
  if (!picks.length) return null;
  if (groups.length === 1) {
    const c = groups[0];
    const list = by[c.key];
    const names = list.map((p) => p.data?.name).join(", ");
    return (
      <div role="region" aria-label="Ma sélection" className="d-pr-bar is-dark">
        <div className="d-pr-bar-main">
          <span className="d-pr-stack">
            {list.slice(0, 3).map((p, i) => (
              <Thumb key={p.id} v={p.data} size={44} ring="#1c1c1a" className={i ? "is-stacked" : ""} />
            ))}
          </span>
          <span className="d-pr-bar-text">
            <strong>
              {list.length} {list.length > 1 ? `${c.many} sélectionnés` : `${c.short || c.one} sélectionné`}
            </strong>
            <span>{names}</span>
          </span>
        </div>
        <span className="d-pr-bar-actions">
          <button type="button" className="d-pr-bar-clear" onClick={onClear}>
            Tout retirer
          </button>
          <Link href="/dashboard/prestataires/lieux" className="d-pr-bar-ghost">
            Comparer
          </Link>
          <button type="button" className="d-pr-bar-cta" onClick={onRequest}>
            Demander les devis
          </button>
        </span>
      </div>
    );
  }
  return (
    <div role="region" aria-label="Ma sélection" className="d-pr-bar is-light">
      <div className="d-pr-bar-groups">
        {groups.map((c, gi) => (
          <span key={c.key} className="d-pr-bar-groupwrap">
            {gi ? <span aria-hidden="true" className="d-pr-bar-sep" /> : null}
            <span className="d-pr-bar-group">
              <span className="d-pr-stack">
                {by[c.key].slice(0, 3).map((p, i) => (
                  <Thumb key={p.id} v={p.data} size={40} ring="#ffffff" className={i ? "is-stacked" : ""} />
                ))}
              </span>
              <span className="d-pr-bar-glabel">{by[c.key].length > 1 ? c.group : c.short || c.groupOne}</span>
            </span>
          </span>
        ))}
      </div>
      <span className="d-pr-stack d-pr-bar-mobthumbs" aria-hidden="true">
        {picks.slice(0, 5).map((p, i) => (
          <Thumb key={p.id} v={p.data} size={34} ring="#ffffff" className={i ? "is-stacked" : ""} />
        ))}
      </span>
      <div className="d-pr-bar-text">
        <strong>{summary(picks)}</strong>
        <span>
          <span className="d-desk-only">Votre sélection, toutes catégories</span>
          <span className="d-mob-only">Votre sélection</span>
        </span>
      </div>
      <div className="d-pr-bar-actions">
        <button type="button" className="d-pr-bar-clear is-ink d-desk-only" onClick={onClear}>
          Tout retirer
        </button>
        <button type="button" className="d-btn d-btn-primary d-pr-bar-send" onClick={onRequest}>
          Demander les devis ({picks.length})
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Panneaux : tiroir à droite (envies, fiche) et fenêtre centrée (demande de devis)
// ---------------------------------------------------------------------------

function Layer({ kind, label, labelledBy, onClose, children }) {
  const [host, setHost] = useState(null);
  const ref = useRef(null);
  useEffect(() => setHost(document.querySelector(".d-root") || document.body), []);
  useEffect(() => {
    if (!host) return undefined;
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.activeElement;
    ref.current?.querySelector("button")?.focus();
    document.body.classList.add("d-noscroll");
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.classList.remove("d-noscroll");
      prev?.focus?.();
    };
  }, [host, onClose]);
  if (!host) return null;
  return createPortal(
    <div className={`d-pr-layer is-${kind}`}>
      <div className="d-pr-scrim" aria-hidden="true" onClick={onClose} />
      <div ref={ref} role="dialog" aria-modal="true" aria-label={label} aria-labelledby={labelledBy} className={`d-pr-panel is-${kind}`}>
        {children}
      </div>
    </div>,
    host,
  );
}

function CloseBtn({ onClose, label = "Fermer" }) {
  return (
    <button type="button" className="d-pr-close" aria-label={label} onClick={onClose}>
      <Icon name="x" size={18} sw={2} stroke="#1c1c1a" />
    </button>
  );
}

// ---------------------------------------------------------------------------
// Préciser mes envies (7c et 7o)
// ---------------------------------------------------------------------------

const ACCESS = [
  { key: "parking", label: "Parking sur place" },
  { key: "goudron", label: "Pas de chemin de terre" },
  { key: "pmr", label: "Accessible PMR" },
];
const VENUE = [
  { key: "ceremonie_exterieur", label: "Cérémonie en extérieur" },
  { key: "exclusivite", label: "Lieu en exclusivité" },
  { key: "fin_tardive", label: "Fin de soirée après 2 h" },
];
const CATERER = [
  { key: "libre", label: "Libre" },
  { key: "impose", label: "Imposé" },
  { key: "indifferent", label: "Indifférent" },
];

// Mots de la description → critères (retirables). Simple lecture de mots-clés, sans IA.
const STYLE_WORDS = [
  [/pierre/, "Pierre apparente"],
  [/(arbres?|sous les|dehors|plein air|exterieur)/, "Dîner sous les arbres"],
  [/(guinde|decontract|simple|detendu)/, "Ambiance décontractée"],
  [/vignes?|vignoble/, "Vue sur les vignes"],
  [/chateau/, "Château"],
  [/(grange|ferme|bergerie)/, "Grange ou ferme"],
  [/(mer|plage|bord de l.eau)/, "Vue sur la mer"],
  [/(lac|riviere)/, "Au bord de l’eau"],
  [/piscine/, "Piscine"],
  [/(oliviers?|oliveraie)/, "Oliviers"],
  [/lavande/, "Champs de lavande"],
  [/(moderne|contemporain)/, "Lieu contemporain"],
  [/(boheme|boho)/, "Esprit bohème"],
];

export function styleCriteria(text) {
  const t = String(text || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
  return STYLE_WORDS.filter(([re]) => re.test(t)).map(([, label]) => label);
}

const MINUTES = [30, 45, 60];

function Choice({ on, children, onClick, role = "button", small }) {
  const props = role === "radio" ? { role: "radio", "aria-checked": on } : { "aria-pressed": on };
  return (
    <button type="button" {...props} className={`d-pr-opt${on ? " is-on" : ""}${small ? " is-small" : ""}`} onClick={onClick}>
      {on && role !== "radio" ? <Icon name="check" size={13} sw={2.6} stroke="#ffffff" /> : null}
      {children}
    </button>
  );
}

function OtherNumber({ value, presets, onChange, label, suffix }) {
  const custom = value && !presets.includes(value);
  return (
    <label className={`d-pr-other${custom ? " is-on" : ""}`}>
      <input type="number" inputMode="numeric" placeholder="Autre" aria-label={label} value={custom ? value : ""} onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)} />
      {suffix ? <span aria-hidden="true">{suffix}</span> : null}
    </label>
  );
}

function MaxRow({ value, onChange, label }) {
  return (
    <div role="radiogroup" aria-label={label} className="d-pr-optrow is-indent">
      <span className="d-pr-optrow-label">Au plus</span>
      {MINUTES.map((m) => (
        <Choice key={m} role="radio" small on={value === m} onClick={() => onChange(value === m ? null : m)}>
          {m} min
        </Choice>
      ))}
      <OtherNumber value={value} presets={MINUTES} onChange={onChange} label="Autre durée maximum, en minutes" suffix="min" />
    </div>
  );
}

const EMPTY_WISHES = { airport: { on: false, max: null }, station: { on: false, max: null }, city: { name: "", max: null }, access: [], seats: null, beds: null, venue: [], caterer: null, style: "", removed: [] };

export function EnviesPanel({ onClose }) {
  const dash = useDash();
  const [w, setW] = useState(() => ({ ...EMPTY_WISHES, ...(dash.data.wishes?.wishes || {}) }));
  const set = (patch) => setW((x) => ({ ...x, ...patch }));
  const toggleIn = (key, v) => set({ [key]: w[key].includes(v) ? w[key].filter((x) => x !== v) : [...w[key], v] });
  const criteria = styleCriteria(w.style).filter((c) => !w.removed.includes(c));

  async function save() {
    if (dash.mode === "live" && !dash.data.picksSetup) {
      dash.setToast({ kind: "error", text: "Vos envies ne peuvent pas encore être enregistrées : collez supabase/prestataires.sql dans Supabase (SQL Editor)." });
      return;
    }
    await dash.saveWishes({ wishes: { ...w, criteria } });
    dash.setToast({ kind: "ok", text: "Recommandations mises à jour d'après vos envies." });
    onClose();
  }

  return (
    <Layer kind="drawer" labelledBy="envies-titre" onClose={onClose}>
      <div className="d-pr-panel-head">
        <h2 id="envies-titre">Préciser mes envies</h2>
        <CloseBtn onClose={onClose} />
      </div>
      <div className="d-pr-panel-body d-pr-envies">
        <p className="d-pr-lead">Vos recommandations partent de votre brief. Ajoutez ce qui compte pour vous.</p>
        <section className="d-pr-wsec">
          <div className="d-pr-wsec-head">
            <h3>Accès</h3>
            <span>Facultatif</span>
          </div>
          <div className="d-pr-wgroup">
            <span className="d-pr-wlabel">Près d'un aéroport</span>
            <div className="d-pr-optrow">
              <Choice on={w.airport.on} onClick={() => set({ airport: { ...w.airport, on: !w.airport.on } })}>
                Près d'un aéroport
              </Choice>
            </div>
            {w.airport.on ? <MaxRow label="Temps de trajet maximum depuis l'aéroport" value={w.airport.max} onChange={(max) => set({ airport: { ...w.airport, max } })} /> : null}
          </div>
          <div className="d-pr-wgroup">
            <span className="d-pr-wlabel">Près d'une gare</span>
            <div className="d-pr-optrow">
              <Choice on={w.station.on} onClick={() => set({ station: { ...w.station, on: !w.station.on } })}>
                Près d'une gare TGV
              </Choice>
            </div>
            {w.station.on ? <MaxRow label="Temps de trajet maximum depuis la gare" value={w.station.max} onChange={(max) => set({ station: { ...w.station, max } })} /> : null}
          </div>
          <div className="d-pr-wgroup">
            <span className="d-pr-wlabel">Près d'une ville</span>
            <label htmlFor="envies-ville" className="d-sr">
              Ville
            </label>
            <input id="envies-ville" className="d-input d-pr-field" type="text" value={w.city.name} placeholder="Ville, par ex. Aix-en-Provence" onChange={(e) => set({ city: { ...w.city, name: e.target.value } })} />
            {w.city.name.trim() ? <MaxRow label="Temps de route maximum depuis la ville" value={w.city.max} onChange={(max) => set({ city: { ...w.city, max } })} /> : null}
          </div>
          <div className="d-pr-wgroup">
            <span className="d-pr-wlabel">Accès facile</span>
            <div className="d-pr-optrow">
              {ACCESS.map((a) => (
                <Choice key={a.key} on={w.access.includes(a.key)} onClick={() => toggleIn("access", a.key)}>
                  {a.label}
                </Choice>
              ))}
            </div>
          </div>
        </section>

        <section className="d-pr-wsec is-ruled">
          <div className="d-pr-wsec-head">
            <h3>Le lieu</h3>
            <span>Facultatif</span>
          </div>
          <div className="d-pr-wgroup">
            <span className="d-pr-wlabel">Places assises, au moins</span>
            <div role="radiogroup" aria-label="Places assises, au moins" className="d-pr-optrow">
              {[80, 120, 160].map((n) => (
                <Choice key={n} role="radio" small on={w.seats === n} onClick={() => set({ seats: w.seats === n ? null : n })}>
                  {n}
                </Choice>
              ))}
              <OtherNumber value={w.seats} presets={[80, 120, 160]} onChange={(seats) => set({ seats })} label="Autre nombre de places" />
            </div>
          </div>
          <div className="d-pr-wgroup">
            <span className="d-pr-wlabel">Couchages sur place, au moins</span>
            <div role="radiogroup" aria-label="Couchages sur place, au moins" className="d-pr-optrow">
              {[10, 20, 30].map((n) => (
                <Choice key={n} role="radio" small on={w.beds === n} onClick={() => set({ beds: w.beds === n ? null : n })}>
                  {n}
                </Choice>
              ))}
              <OtherNumber value={w.beds} presets={[10, 20, 30]} onChange={(beds) => set({ beds })} label="Autre nombre de couchages" />
            </div>
          </div>
          <div className="d-pr-optrow">
            {VENUE.map((a) => (
              <Choice key={a.key} on={w.venue.includes(a.key)} onClick={() => toggleIn("venue", a.key)}>
                {a.label}
              </Choice>
            ))}
          </div>
        </section>

        <section className="d-pr-wsec is-ruled">
          <div className="d-pr-wsec-head">
            <h3>Traiteur</h3>
            <span>Facultatif</span>
          </div>
          <div role="radiogroup" aria-label="Traiteur" className="d-pr-optrow">
            {CATERER.map((c) => (
              <Choice key={c.key} role="radio" on={w.caterer === c.key} onClick={() => set({ caterer: w.caterer === c.key ? null : c.key })}>
                {c.label}
              </Choice>
            ))}
          </div>
        </section>

        <section className="d-pr-wsec is-ruled">
          <div className="d-pr-wsec-head">
            <h3>Votre style</h3>
            <span>Facultatif</span>
          </div>
          <div className="d-pr-wgroup is-10">
            <label htmlFor="envies-style" className="d-pr-wlabel">
              Décrivez votre lieu idéal en quelques mots
            </label>
            <textarea id="envies-style" rows={3} className="d-textarea d-pr-field" placeholder="Décrivez votre lieu idéal en quelques mots" value={w.style} onChange={(e) => set({ style: e.target.value })} />
            {criteria.length ? (
              <>
                <div className="d-pr-hint">
                  <Icon name="sparkle" size={14} sw={2} stroke="#35520a" style={{ flex: "none", marginTop: 2 }} />
                  <span>Merry transforme votre description en critères. Retirez ceux qui ne vous ressemblent pas.</span>
                </div>
                <div className="d-pr-optrow">
                  {criteria.map((c) => (
                    <span key={c} className="d-pr-crit">
                      {c}
                      <button type="button" aria-label={`Retirer ${c}`} onClick={() => set({ removed: [...w.removed, c] })}>
                        <Icon name="x" size={11} sw={2.6} stroke="#35520a" />
                      </button>
                    </span>
                  ))}
                </div>
              </>
            ) : null}
          </div>
        </section>
      </div>
      <div className="d-pr-panel-foot is-split">
        <button type="button" className="d-pr-textbtn" onClick={() => setW(EMPTY_WISHES)}>
          Effacer
        </button>
        <button type="button" className="d-btn d-btn-primary d-pr-big" onClick={save}>
          Mettre à jour mes recommandations
        </button>
      </div>
    </Layer>
  );
}

// ---------------------------------------------------------------------------
// Fond de carte (7d, 7e, 7p, 7q) : un repère commun, chaque vue choisit son centre et son échelle
// ---------------------------------------------------------------------------

function useSize(ref) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return size;
}

// Fond de France (lib/dash/franceMap.js, 130 Ko) : chargé seulement quand une carte s'affiche
let franceSvg = null;
function useFranceSvg() {
  const [svg, setSvg] = useState(franceSvg);
  useEffect(() => {
    if (franceSvg) return undefined;
    let live = true;
    import("@/lib/dash/franceMap").then((m) => {
      franceSvg = m.FRANCE_SVG;
      if (live) setSvg(franceSvg);
    });
    return () => {
      live = false;
    };
  }, []);
  return svg;
}

// Villes affichées sur la carte : les grandes toujours, les autres une fois zoomé
const CITIES = [
  ["Paris", 48.8566, 2.3522, 1],
  ["Lyon", 45.764, 4.8357, 1],
  ["Marseille", 43.2965, 5.3698, 1],
  ["Toulouse", 43.6047, 1.4442, 1],
  ["Nice", 43.7102, 7.262, 1],
  ["Nantes", 47.2184, -1.5536, 1],
  ["Bordeaux", 44.8378, -0.5792, 1],
  ["Lille", 50.6292, 3.0573, 1],
  ["Strasbourg", 48.5734, 7.7521, 1],
  ["Montpellier", 43.6108, 3.8767, 1],
  ["Rennes", 48.1173, -1.6778, 1],
  ["Avignon", 43.9493, 4.8055, 0],
  ["Nîmes", 43.8367, 4.3601, 0],
  ["Toulon", 43.1242, 5.928, 0],
  ["Grenoble", 45.1885, 5.7245, 0],
  ["Aix-en-Provence", 43.5297, 5.4474, 0],
  ["Dijon", 47.322, 5.0415, 0],
  ["Tours", 47.3941, 0.6848, 0],
  ["Clermont-Ferrand", 45.7772, 3.087, 0],
  ["Rouen", 49.4432, 1.0999, 0],
  ["Caen", 49.1829, -0.3707, 0],
  ["Reims", 49.2583, 4.0317, 0],
  ["Brest", 48.3904, -4.4861, 0],
  ["Biarritz", 43.4832, -1.5586, 0],
  ["Annecy", 45.8992, 6.1294, 0],
  ["Perpignan", 42.6887, 2.8948, 0],
  ["Angers", 47.4784, -0.5632, 0],
  ["Limoges", 45.8336, 1.2611, 0],
  ["Ajaccio", 41.9192, 8.7386, 0],
].map(([name, lat, lng, major]) => ({ name, major: !!major, ...project(lat, lng) }));

export const MAP_MIN_SCALE = 0.12; // toute la France sur un écran de téléphone
const MAP_MAX_SCALE = 6;
const clampScale = (s) => Math.min(MAP_MAX_SCALE, Math.max(MAP_MIN_SCALE, s));

// Carte : glisser pour se déplacer ; pincer (pavé tactile, ou deux doigts sur téléphone), Ctrl + molette
// ou les boutons pour zoomer. onView reçoit { center, scale } ; sans onView, la carte est figée.
export function MapCanvas({ center, scale, className = "", children, onView, label, role = "region", fixedSize }) {
  const ref = useRef(null);
  const measured = useSize(ref);
  const size = fixedSize || measured;
  const svg = useFranceSvg();
  const view = useRef({ center, scale, size });
  view.current = { center, scale, size };
  const pointers = useRef(new Map());
  const gesture = useRef(null);
  const x0 = center.x - size.w / 2 / scale;
  const y0 = center.y - size.h / 2 / scale;
  const toScreen = (p) => ({ left: (p.x - x0) * scale, top: (p.y - y0) * scale });

  // Zoom autour d'un point de l'écran (px, py) : ce point de la carte reste sous les doigts
  const zoomAt = useCallback(
    (factor, px, py, from = view.current) => {
      const { center: c, scale: s, size: sz } = from;
      const next = clampScale(s * factor);
      const mx = c.x - sz.w / 2 / s + px / s;
      const my = c.y - sz.h / 2 / s + py / s;
      onView?.({ scale: next, center: { x: mx - px / next + sz.w / 2 / next, y: my - py / next + sz.h / 2 / next } });
    },
    [onView],
  );

  // Molette et pavé tactile : écouteurs non passifs, pour empêcher la page de défiler ou de zoomer
  useEffect(() => {
    const el = ref.current;
    if (!el || !onView) return undefined;
    const local = (e) => {
      const r = el.getBoundingClientRect();
      return [e.clientX - r.left, e.clientY - r.top];
    };
    const onWheel = (e) => {
      e.preventDefault();
      const [px, py] = local(e);
      const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
      const dx = e.deltaMode === 1 ? e.deltaX * 16 : e.deltaX;
      // Pincement sur le pavé tactile (Chrome, Firefox, Edge) ou Ctrl + molette : zoom
      if (e.ctrlKey || e.metaKey) zoomAt(Math.exp(-dy * 0.01), px, py);
      else {
        const { center: c, scale: s } = view.current;
        onView({ scale: s, center: { x: c.x + dx / s, y: c.y + dy / s } });
      }
    };
    // Safari : le pincement arrive en « gesture »
    const onGestureStart = (e) => {
      e.preventDefault();
      gesture.current = { from: view.current, at: local(e) };
    };
    const onGestureChange = (e) => {
      e.preventDefault();
      if (!gesture.current) return;
      zoomAt(e.scale, gesture.current.at[0], gesture.current.at[1], gesture.current.from);
    };
    const onGestureEnd = (e) => {
      e.preventDefault();
      gesture.current = null;
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("gesturestart", onGestureStart);
    el.addEventListener("gesturechange", onGestureChange);
    el.addEventListener("gestureend", onGestureEnd);
    return () => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("gesturestart", onGestureStart);
      el.removeEventListener("gesturechange", onGestureChange);
      el.removeEventListener("gestureend", onGestureEnd);
    };
  }, [onView, zoomAt]);

  // Glisser (souris, un doigt) et pincer (deux doigts sur écran tactile)
  const local = (e) => {
    const r = ref.current.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const startGesture = () => {
    const pts = [...pointers.current.values()];
    if (pts.length === 1) gesture.current = { kind: "pan", start: pts[0], from: view.current };
    else if (pts.length === 2) {
      const [a, b] = pts;
      gesture.current = { kind: "pinch", dist: Math.hypot(a.x - b.x, a.y - b.y) || 1, mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, from: view.current };
    } else gesture.current = null;
  };
  const handlers = onView
    ? {
        onPointerDown: (e) => {
          if (e.target.closest("button, a, input, [role=dialog]")) return;
          pointers.current.set(e.pointerId, local(e));
          try {
            e.currentTarget.setPointerCapture?.(e.pointerId);
          } catch {
            /* pointeur déjà relâché : le geste continue sans capture */
          }
          startGesture();
        },
        onPointerMove: (e) => {
          if (!pointers.current.has(e.pointerId)) return;
          pointers.current.set(e.pointerId, local(e));
          const g = gesture.current;
          if (!g) return;
          const pts = [...pointers.current.values()];
          if (g.kind === "pan" && pts.length === 1) {
            const s = g.from.scale;
            onView({ scale: s, center: { x: g.from.center.x - (pts[0].x - g.start.x) / s, y: g.from.center.y - (pts[0].y - g.start.y) / s } });
          } else if (g.kind === "pinch" && pts.length === 2) {
            const [a, b] = pts;
            zoomAt(Math.hypot(a.x - b.x, a.y - b.y) / g.dist, g.mid.x, g.mid.y, g.from);
          }
        },
        onPointerUp: (e) => {
          pointers.current.delete(e.pointerId);
          startGesture();
        },
        onPointerCancel: (e) => {
          pointers.current.delete(e.pointerId);
          startGesture();
        },
      }
    : {};

  return (
    <div ref={ref} className={`d-pr-map ${className}${onView ? " is-live" : ""}`} role={role} aria-label={label} style={{ background: MAP_BG }} {...handlers}>
      {size.w && svg ? (
        <svg width={size.w} height={size.h} viewBox={`${x0} ${y0} ${size.w / scale} ${size.h / scale}`} aria-hidden="true" className="d-pr-map-svg">
          <g dangerouslySetInnerHTML={{ __html: svg }} />
        </svg>
      ) : null}
      {size.w
        ? CITIES.filter((c) => c.major || scale >= 0.7).map((c) => {
            const at = toScreen(c);
            if (at.left < -60 || at.top < -20 || at.left > size.w + 60 || at.top > size.h + 20) return null;
            return (
              <span key={c.name} className="d-pr-city" style={at} aria-hidden="true">
                <i />
                {c.name}
              </span>
            );
          })
        : null}
      {size.w ? children({ toScreen, bounds: { x0, y0, x1: x0 + size.w / scale, y1: y0 + size.h / scale }, size, zoomAt }) : null}
    </div>
  );
}

// Étiquette de prix d'un lieu sur la carte
export function PricePin({ v, at, active, picked, onClick, small }) {
  const photo = (v.photos || []).find(Boolean);
  return (
    <button
      type="button"
      className={`d-pr-pin${active ? " is-active" : picked ? " is-picked" : ""}${small ? " is-small" : ""}`}
      style={{ left: at.left, top: at.top }}
      aria-label={`${v.name}${v.price ? `, à partir de ${euros(v.price)}` : ""}${picked ? ", dans votre sélection" : ""}`}
      onClick={onClick}
    >
      <span aria-hidden="true" className="d-pr-pin-img" style={{ backgroundImage: photo ? `url("${photo}")` : undefined }} />
      <span className="d-pr-pin-label">{v.price ? euros(v.price) : v.name}</span>
    </button>
  );
}

export function MiniMap({ v, height = 220, width = 600 }) {
  const p = mapPoint(v);
  if (!p) return null;
  return (
    <div className="d-pr-minimap" style={{ height }} role="img" aria-label={`Carte : ${v.name}${v.whereLabel ? `, ${v.whereLabel}` : ""}`}>
      <MapCanvas center={p} scale={1.036} role="presentation" className="is-mini">
        {({ toScreen }) => (
          <span className="d-pr-pin is-active is-static" style={toScreen(p)}>
            <span aria-hidden="true" className="d-pr-pin-img" style={{ backgroundImage: (v.photos || []).find(Boolean) ? `url("${(v.photos || []).find(Boolean)}")` : undefined }} />
            {v.price ? euros(v.price) : v.name}
          </span>
        )}
      </MapCanvas>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Fiche lieu (7e et 7q)
// ---------------------------------------------------------------------------

function factsOf(v) {
  if (v.facts) return v.facts;
  const out = [];
  if (v.seats) out.push(["seat", "Places assises", `${v.seats} invités`]);
  if (v.beds !== undefined) out.push(["bed", "Couchages", `${v.beds} sur place`]);
  if (v.airport) out.push(["plane", "Aéroport le plus proche", v.access]);
  else if (v.station) out.push(["train", "Gare", v.access]);
  if (v.tags?.includes("parking")) out.push(["parking", "Parking", "Sur place"]);
  if (v.tags?.includes("traiteur_libre")) out.push(["chef", "Traiteur", "Libre, vous choisissez"]);
  if (v.category !== "lieu" && v.km !== undefined) out.push(["parking", "Distance", `${v.km} km de votre lieu`]);
  return out;
}

export function FichePanel({ v, index, total, list, onClose, onRequest, onMes }) {
  const dash = useDash();
  const { isPicked, toggle } = usePicks();
  const picked = isPicked(v);
  const c = catOf(v.category);
  const photos = v.photos?.length ? v.photos : [null];
  const [i, setI] = useState(0);
  const n = Math.max(photos.length, 5);
  const cur = photos[i] || null;
  const facts = factsOf(v);
  const guests = guestsLabel(dash.data);
  const guestsN = Number(String(guests).match(/\d+/)?.[0] || 0);
  return (
    <Layer kind="fiche" labelledBy="fiche-titre" onClose={onClose}>
      <div className="d-pr-panel-head is-fiche">
        <span className="d-pr-fiche-pos">
          <span>
            {list || c.tab} · {index + 1} sur {total}
          </span>
          <Link href="/dashboard/prestataires/mes" className="d-pr-pillink d-mob-only-inline" onClick={onMes}>
            <Icon name="heart" size={14} sw={2} />
            Mes prestataires
          </Link>
        </span>
        <CloseBtn onClose={onClose} label="Fermer la fiche" />
      </div>
      <div className="d-pr-panel-body d-pr-fiche">
        <div className="d-pr-gallery">
          <div role="img" aria-label={`${v.name}, photo ${i + 1} sur ${n}`} className="d-pr-gallery-main" style={{ backgroundImage: cur ? `url("${cur}")` : undefined }}>
            {cur ? null : <span className="d-pr-gallery-empty">Photo à venir</span>}
            <button type="button" className="d-pr-garrow is-prev d-desk-only" aria-label="Photo précédente" onClick={() => setI((x) => (x - 1 + photos.length) % photos.length)}>
              <Icon name="prev" size={16} sw={2.2} stroke="#1c1c1a" />
            </button>
            <button type="button" className="d-pr-garrow is-next d-desk-only" aria-label="Photo suivante" onClick={() => setI((x) => (x + 1) % photos.length)}>
              <Icon name="next" size={16} sw={2.2} stroke="#1c1c1a" />
            </button>
            <span className="d-pr-gcount">
              {i + 1} / {n}
            </span>
          </div>
          <div className="d-pr-gthumbs">
            {Array.from({ length: n - 1 }, (_, k) => {
              const ph = photos[k + 1] || null;
              return (
                <button key={k} type="button" aria-label={`Photo ${k + 2} sur ${n}`} style={{ backgroundImage: ph ? `url("${ph}")` : undefined }} onClick={() => photos[k + 1] !== undefined && setI(k + 1)}>
                  {ph ? null : "Photo à venir"}
                </button>
              );
            })}
          </div>
        </div>
        <div className="d-pr-fiche-title">
          <div>
            {v.best ? <BestMatch /> : null}
            <h1 id="fiche-titre">{v.name}</h1>
            <div className="d-pr-fiche-place">{v.place || v.area}</div>
          </div>
          <Heart on={picked} onClick={() => toggle(v)} size={20} className="d-pr-heart is-outline" />
        </div>
        {facts.length ? (
          <div className="d-pr-facts">
            {facts.map(([icon, k, val]) => (
              <div key={k} className="d-pr-fact">
                <Icon name={icon} size={18} sw={1.7} stroke="#1c1c1a" style={{ flex: "none", marginTop: 1 }} />
                <span>
                  <small>{k}</small>
                  <strong>{val}</strong>
                </span>
              </div>
            ))}
          </div>
        ) : null}
        {v.price ? (
          <section className="d-pr-offer">
            <div className="d-pr-offer-top">
              <span className="d-pr-price">
                <span className="d-pr-price-from is-13">À partir de</span>
                <span className="d-pr-price-v is-28">{euros(v.price)}</span>
                <span className="d-pr-price-from is-13">{v.unitWeekend || v.unit}</span>
              </span>
              {v.negotiated ? <Negotiated /> : null}
            </div>
            {v.included ? (
              <div className="d-pr-included">
                <div className="d-pr-included-t">Ce qui est compris</div>
                <ul>
                  {v.included.map((t) => (
                    <li key={t}>
                      <Icon name="check" size={15} sw={2.4} stroke="#35520a" style={{ flex: "none", marginTop: 2 }} />
                      <span>{t}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {v.estimate && guestsN ? (
              <div className="d-pr-estimate">
                <div className="d-pr-estimate-top">
                  <span>Pour vos {guests}</span>
                  <strong>environ {euros(v.price + v.estimate.extra)}</strong>
                </div>
                <div className="d-pr-estimate-note">
                  Location {euros(v.price)} et {v.estimate.note} {euros(v.estimate.extra)}. Estimation Merry, à confirmer par devis.
                </div>
              </div>
            ) : null}
          </section>
        ) : null}
        {v.story || v.why ? (
          <section className="d-pr-fsec">
            <h2>{v.category === "lieu" ? "Pourquoi ce lieu" : "Pourquoi ce prestataire"}</h2>
            <p>{v.story || `${v.why.charAt(0).toUpperCase()}${v.why.slice(1)}.`}</p>
          </section>
        ) : null}
        {v.rating ? (
          <section className="d-pr-reviews">
            <div>
              <h2>Ce qu’en disent les couples</h2>
              <span className="d-pr-stars">
                <Icon name="star" size={14} stroke="#1c1c1a" style={{ color: "#1c1c1a" }} />
                <strong>{v.rating.score}</strong> · {v.rating.count} avis
              </span>
            </div>
            <button type="button" className="d-pr-linkbtn" onClick={() => dash.setToast({ kind: "ok", text: "Les avis des couples arrivent bientôt dans Merry." })}>
              Lire les avis
            </button>
          </section>
        ) : null}
        {mapPoint(v) ? (
          <section className="d-pr-fsec">
            <h2>{v.category === "lieu" ? "Où se trouve le domaine" : "Où le trouver"}</h2>
            <MiniMap v={v} />
            {v.where ? <div className="d-pr-where">{v.where}</div> : null}
          </section>
        ) : null}
      </div>
      <div className="d-pr-panel-foot is-fiche">
        <button type="button" className="d-btn d-btn-primary d-pr-big" aria-pressed={picked} onClick={() => toggle(v)}>
          <Icon name="heart" size={17} sw={2} stroke="#ffffff" fill={picked ? "#ffffff" : "none"} />
          {picked ? "Dans ma sélection" : "Ajouter à ma sélection"}
        </button>
        <button type="button" className="d-btn d-btn-ghost d-pr-big" onClick={() => onRequest(v)}>
          Demander un devis
        </button>
      </div>
    </Layer>
  );
}

// ---------------------------------------------------------------------------
// Demander les devis (7h et 7t)
// ---------------------------------------------------------------------------

function plusDays(d, n) {
  const x = toDate(d);
  return x ? dateLong(addDays(x, n)) : "";
}

export function DevisDialog({ picks: initial, onClose, onSent }) {
  const dash = useDash();
  const data = dash.data;
  const [list, setList] = useState(initial);
  const [message, setMessage] = useState(() => defaultMessage(data));
  const [notes, setNotes] = useState(() => Object.fromEntries(initial.filter((p) => p.note).map((p) => [p.id, p.note])));
  const [noteOpen, setNoteOpen] = useState(() => new Set(initial.filter((p) => p.note).map((p) => p.id)));
  const cats = CATEGORIES.filter((c) => list.some((p) => p.category === c.key));
  const [questions, setQuestions] = useState(() => Object.fromEntries(CATEGORIES.map((c) => [c.key, (QUESTIONS[c.key] || []).map((q) => ({ q, on: true }))])));
  const [adding, setAdding] = useState({});
  const [dates, setDates] = useState(() => [dateLong(data.wedding.wedding_date), plusDays(data.wedding.wedding_date, 5), plusDays(data.wedding.wedding_date, 12)]);
  const [share, setShare] = useState(false);
  const [busy, setBusy] = useState(false);
  const budget = budgetLabel(data);
  const by = picksBy(list);

  async function send() {
    if (!list.length || !message.trim()) return;
    if (dash.mode === "live" && !data.picksSetup) {
      dash.setToast({ kind: "error", text: "Les demandes ne peuvent pas encore être enregistrées : collez supabase/prestataires.sql dans Supabase (SQL Editor)." });
      return;
    }
    setBusy(true);
    const q = Object.fromEntries(cats.map((c) => [c.key, questions[c.key].filter((x) => x.on && x.q.trim()).map((x) => x.q.trim())]));
    await dash.sendQuotes({ picks: list, message: message.trim(), questions: q, dates, budget: share ? budget : null, notes });
    setBusy(false);
    dash.setToast({ kind: "ok", text: `${list.length > 1 ? `${list.length} demandes enregistrées` : "Demande enregistrée"}, sur la fiche de chaque prestataire dans Budget.` });
    onSent?.();
  }

  return (
    <Layer kind="dialog" labelledBy="devis-titre" onClose={onClose}>
      <div className="d-pr-panel-head is-dialog">
        <h2 id="devis-titre">Demander les devis</h2>
        <CloseBtn onClose={onClose} />
      </div>
      <div className="d-pr-panel-body d-pr-devis">
        <p className="d-pr-lead">Un seul message, envoyé à chacun. Merry l’adapte à chaque prestataire.</p>
        <section className="d-pr-dsec">
          <h3>À qui</h3>
          <span className="d-pr-dsub">{summary(list) || "Personne pour l’instant"}</span>
          <ul className="d-pr-to">
            {list.map((p) => {
              const c = catOf(p.category);
              const open = noteOpen.has(p.id);
              return (
                <li key={p.id}>
                  <Thumb v={p.data} size={44} />
                  <div className="d-pr-to-main">
                    <span className="d-pr-to-name">{p.data?.name}</span>
                    <span className="d-pr-to-meta">
                      {c.label}
                      {p.data?.area ? ` · ${p.data.area}` : ""}
                    </span>
                    {open ? (
                      <div className="d-pr-to-note">
                        <label htmlFor={`mot-${p.id}`}>Un mot pour {p.data?.name}</label>
                        <textarea id={`mot-${p.id}`} rows={2} className="d-textarea d-pr-field is-note" value={notes[p.id] || ""} onChange={(e) => setNotes((x) => ({ ...x, [p.id]: e.target.value }))} autoFocus={!notes[p.id]} />
                      </div>
                    ) : (
                      <button type="button" className="d-pr-addbtn" onClick={() => setNoteOpen((s) => new Set([...s, p.id]))}>
                        <Icon name="plus" size={13} sw={2.2} stroke="#1c1c1a" />
                        Ajouter un mot pour ce prestataire
                      </button>
                    )}
                  </div>
                  <button type="button" className="d-pr-close" aria-label={`Retirer ${p.data?.name} de la demande`} onClick={() => setList((l) => l.filter((x) => x.id !== p.id))}>
                    <Icon name="x" size={14} sw={2} stroke="#1c1c1a" />
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
        <section className="d-pr-dsec is-ruled">
          <label htmlFor="devis-message" className="d-pr-dtitle">
            Votre message
          </label>
          <textarea id="devis-message" rows={8} className="d-textarea d-pr-field is-message" value={message} onChange={(e) => setMessage(e.target.value)} />
          {briefLine(data) ? <span className="d-pr-from-brief">Repris de votre brief : {briefLine(data)}</span> : null}
        </section>
        {cats.length ? (
          <section className="d-pr-dsec is-ruled">
            <div className="d-pr-dsec-t">
              <h3>Questions selon le prestataire</h3>
              <span className="d-pr-dnote">Merry ajoute à chaque demande les questions qui le concernent. Décochez celles qui ne vous servent pas.</span>
            </div>
            {cats.map((c) => (
              <fieldset key={c.key} className="d-pr-qset">
                <legend>
                  {legendFor(c.key, by[c.key].length)}{" "}
                  <span>
                    · envoyé à {by[c.key].length} prestataire{by[c.key].length > 1 ? "s" : ""}
                  </span>
                </legend>
                {questions[c.key].map((x, k) => (
                  <label key={k} className="d-pr-q">
                    <input
                      type="checkbox"
                      checked={x.on}
                      onChange={() => setQuestions((qs) => ({ ...qs, [c.key]: qs[c.key].map((y, j) => (j === k ? { ...y, on: !y.on } : y)) }))}
                    />
                    {x.q}
                  </label>
                ))}
                {adding[c.key] !== undefined ? (
                  <form
                    className="d-pr-qadd"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const q = adding[c.key].trim();
                      if (q) setQuestions((qs) => ({ ...qs, [c.key]: [...qs[c.key], { q, on: true }] }));
                      setAdding(({ [c.key]: _drop, ...rest }) => rest);
                    }}
                  >
                    <input className="d-input" autoFocus value={adding[c.key]} onChange={(e) => setAdding((a) => ({ ...a, [c.key]: e.target.value }))} placeholder="Votre question" aria-label={`Nouvelle question ${legendFor(c.key, 2).toLowerCase()}`} />
                    <button type="submit" className="d-btn d-btn-ghost d-btn-small">
                      Ajouter
                    </button>
                  </form>
                ) : (
                  <button type="button" className="d-pr-addbtn" onClick={() => setAdding((a) => ({ ...a, [c.key]: "" }))}>
                    <Icon name="plus" size={13} sw={2.2} stroke="#1c1c1a" />
                    Ajouter une question
                  </button>
                )}
              </fieldset>
            ))}
          </section>
        ) : null}
        <section className="d-pr-dsec is-ruled is-12">
          <h3>Dates</h3>
          {[[0], [1, 2]].map((row, ri) => (
            <div key={ri} className="d-pr-dates">
              {row.map((k) => (
                <div key={k} className="d-pr-date">
                  <label htmlFor={`devis-date-${k}`}>{["Date souhaitée", "Date de repli", "Autre date de repli"][k]}</label>
                  <div className="d-pr-datebox">
                    <Icon name="calendarPlain" size={16} sw={1.8} stroke="#6b6a63" />
                    <input id={`devis-date-${k}`} type="text" value={dates[k]} onChange={(e) => setDates((d) => d.map((x, j) => (j === k ? e.target.value : x)))} />
                  </div>
                </div>
              ))}
            </div>
          ))}
        </section>
        {budget ? (
          <section className="d-pr-dsec is-ruled is-switch">
            <div className="d-pr-dsec-t">
              <span id="devis-budget" className="d-pr-dtitle">
                Partager notre budget
              </span>
              <span className="d-pr-dnote">{budget} au total. Les prestataires ajustent souvent leur proposition quand ils le connaissent.</span>
            </div>
            <button type="button" role="switch" aria-checked={share} aria-labelledby="devis-budget" className={`d-pr-switch${share ? " is-on" : ""}`} onClick={() => setShare((s) => !s)}>
              <span />
            </button>
          </section>
        ) : null}
      </div>
      <div className="d-pr-panel-foot is-devis">
        <span className="d-pr-dnote">Les réponses arrivent dans Budget, sur la fiche de chaque prestataire.</span>
        <button type="button" className="d-btn d-btn-primary d-pr-big" disabled={busy || !list.length || !message.trim()} onClick={send}>
          {list.length > 1 ? `Envoyer les ${list.length} demandes` : "Envoyer la demande"}
        </button>
      </div>
    </Layer>
  );
}

// Liens d'une ligne de Mes prestataires et de Vos demandes de devis, selon où en est la demande
export function RowActions({ p, status, onFiche, onCompare }) {
  const fiche = p.vendor_id ? `/dashboard/budget/prestataires/${p.vendor_id}` : null;
  if (status.key === "todo")
    return (
      <button type="button" className="d-pr-act" onClick={onFiche}>
        Voir la fiche
      </button>
    );
  if (status.key === "envoyee")
    return fiche ? (
      <Link href={fiche} className="d-pr-act is-muted">
        Voir la demande
      </Link>
    ) : null;
  if (status.key === "reponse")
    return fiche ? (
      <Link href={fiche} className="d-pr-act">
        Lire la réponse
      </Link>
    ) : null;
  return (
    <>
      {fiche ? (
        <Link href={fiche} className="d-pr-act">
          Voir le devis
        </Link>
      ) : null}
      <button type="button" className="d-pr-sage" onClick={onCompare}>
        Comparer les devis
      </button>
    </>
  );
}

// Note affichée tant que les recommandations sont celles du canvas (catalogue sans prestataire validé)
export function SampleNote({ source }) {
  const dash = useDash();
  if (dash.mode !== "live") return null;
  return (
    <>
      {!dash.data.picksSetup ? (
        <div className="d-card is-panel">
          <strong>Les prestataires ne sont pas encore installés sur la base.</strong>
          <span className="d-small" style={{ lineHeight: 1.5, color: "#43423c" }}>
            Collez le fichier <code>supabase/prestataires.sql</code> dans Supabase (SQL Editor), puis rechargez la page. Il enregistre votre sélection, vos envies et vos demandes de devis.
          </span>
        </div>
      ) : null}
      {source === "exemple" ? (
        <div className="d-card is-panel">
          <strong>Sélection d'exemple.</strong>
          <span className="d-small" style={{ lineHeight: 1.5, color: "#43423c" }}>
            Le catalogue Merry n'a pas encore de prestataire validé dans votre région : ces propositions illustrent la page. Les demandes de devis s'enregistrent sur la fiche de chaque prestataire, sans mail envoyé.
          </span>
        </div>
      ) : null}
    </>
  );
}

export { inWords, monthYear, coupleNames, chosenVenue, pickStatus, picksBy, PRICE_BARS };
