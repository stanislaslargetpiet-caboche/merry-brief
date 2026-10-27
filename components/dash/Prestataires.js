"use client";

// Prestataires (canvas « Merry · Carte brief », artboards 7 à 7j et 7m à 7v) : briques partagées
// entre « Trouver des prestataires », la carte, la page Lieux, « Autour de votre lieu »,
// « Mes prestataires » et « Vos demandes de devis ».

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useDash } from "@/lib/dash/store";
import { supabase } from "@/lib/supabase";
import { CATEGORIES, catOf, freshCovers, initialsOf, inWords, loadRecommendations, mapPoint, pageSize, SAMPLE_BY_ID, snapshot } from "@/lib/dash/catalog";
import { BEST_SCORE, coupleContext, contextKey, MIN_SCORE, scoreVendors } from "@/lib/dash/match";
import { cityFilter, hardFilters } from "@/lib/dash/filters";
import { budgetLabel, chosenVenue, coupleNames, dateLong, defaultMessage, flexibleDates, signature, splitSignature, guestsLabel, legendFor, monthYear, periodLabel, pickStatus, picksBy, QUESTIONS, requestBody, STATUS, summary } from "@/lib/dash/picks";
import { isOff, searchWishes, venueFacts } from "@/lib/dash/criteria";
import { MAP_BG, PRICE_BARS, project } from "@/lib/dash/provenceMap";
import { euros, toDate, withArticle } from "@/lib/dash/format";
import { Icon } from "./icons";
import { FactChips } from "./Criteria";
import VendorComments from "./VendorComments";

// ---------------------------------------------------------------------------
// Sélection du mariage (vendor_picks)
// ---------------------------------------------------------------------------

export function usePicks() {
  const dash = useDash();
  const { picks: saved = [], picksSetup, meId } = dash.data;
  // Photos des lieux du catalogue redemandées : celles gardées avec la sélection ne valent qu'une heure
  const [covers, setCovers] = useState(() => new Map());
  const catalogIds = saved.map((p) => /^catalog:(.+)$/.exec(p.catalog_ref || "")?.[1]).filter(Boolean);
  const idsKey = catalogIds.join(",");
  useEffect(() => {
    if (dash.mode !== "live" || !catalogIds.length) return undefined;
    let live = true;
    freshCovers(catalogIds).then((m) => live && setCovers(m));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey, dash.mode]);
  const picks = useMemo(
    () =>
      saved.map((p) => {
        const url = covers.get(/^catalog:(.+)$/.exec(p.catalog_ref || "")?.[1]);
        return url ? { ...p, data: { ...(p.data || {}), photos: [url] } } : p;
      }),
    [saved, covers],
  );
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

// Recommandations d'une catégorie, page par page. Lieux : les envies du couple sont des filtres stricts
// (lib/dash/filters.js) ; d'abord les lieux qui les tiennent preuve à l'appui, puis ceux dont l'information
// manque (« à confirmer »), jamais ceux qui les contredisent. more() charge la page suivante.
// bbox ({ south, north, west, east }) cherche dans la zone de la carte.
// La comparaison par l'IA (lib/dash/match.js) est en réserve : NEXT_PUBLIC_MERRY_AI_MATCH=1 la rallume.
const AI_MATCH = process.env.NEXT_PUBLIC_MERRY_AI_MATCH === "1";

function withMatch(v, m) {
  if (!m) return v;
  return { ...v, matchScore: m.score, why: m.why || v.why, story: m.story || v.story, checks: m.checks?.length ? m.checks : v.checks };
}

export function useRecommendations(category, near, bbox = null) {
  const dash = useDash();
  const data = dash.data;
  // Lieu retiré des critères : on cherche partout
  const lieuOff = isOff(data, "lieu");
  const region = lieuOff ? null : data.wedding.region || data.brief?.region;
  const venue = data.wedding.venue;
  // Lieux : autour de la région choisie ; autres catégories : autour du lieu s'il est connu
  const places = [category === "lieu" ? region : venue, category === "lieu" && !lieuOff ? venue : region].filter(Boolean);
  const wishes = category === "lieu" ? searchWishes(data) : null;
  const filters = hardFilters(wishes);
  const city = cityFilter(wishes);
  const ctxKey = AI_MATCH ? contextKey(coupleContext(data), category) : "";
  const filterKey = JSON.stringify([filters.map((f) => [f.col, f.op, f.value]), city]);
  const key = [dash.mode, category, places.join("|"), near ? `${near.lat},${near.lng}` : "", bbox ? Object.values(bbox).map((x) => x.toFixed(3)).join(",") : "", filterKey, ctxKey].join("/");
  const step = pageSize(category);
  const empty = { vendors: [], tier: "confirmed", offset: 0, done: false, source: null, center: null, loading: true, loadingMore: false, ai: null, filtersMissing: false };
  const [state, setState] = useState(empty);
  const keyRef = useRef(key);
  keyRef.current = key;
  const dataRef = useRef(data);
  dataRef.current = data;
  const args = { mode: dash.mode, category, places, near, bbox, filters, city };

  // Une page : on lit les lieux confirmés, puis les « à confirmer », jusqu'à en avoir assez à montrer
  const fetchPage = async (from) => {
    let { tier, offset } = from;
    const seen = new Set(from.vendors.map((v) => v.id));
    const got = [];
    let res = null;
    let done = false;
    let filtersMissing = from.filtersMissing;
    for (let guard = 0; got.length < step && guard < 6; guard++) {
      res = await loadRecommendations({ ...args, offset, limit: step, tier });
      filtersMissing = filtersMissing || !!res.filtersMissing;
      if (res.source !== "catalogue") {
        got.push(...res.vendors);
        done = true;
        break;
      }
      offset += step;
      // Deuxième passe : seulement ceux à qui il manque une information (les autres sont déjà là)
      got.push(...res.vendors.filter((v) => !seen.has(v.id) && (tier === "confirmed" || v.unknown?.length)));
      for (const v of res.vendors) seen.add(v.id);
      if (!res.hasMore) {
        if (tier === "confirmed" && filters.length && !res.filtersMissing) {
          tier = "open";
          offset = 0;
        } else {
          done = true;
          break;
        }
      }
    }
    let ai = null;
    let page = got;
    if (AI_MATCH && res?.source === "catalogue" && got.length) {
      const scored = await scoreVendors({ data: dataRef.current, category, vendors: got, center: res.center });
      ai = scored.ai;
      page = got
        .map((v) => withMatch(v, scored.matches.get(v.catalogId)))
        .filter((v) => v.matchScore === undefined || v.matchScore >= MIN_SCORE)
        .sort((a, b) => (b.unknown?.length ? 0 : 1) - (a.unknown?.length ? 0 : 1) || (b.matchScore ?? -1) - (a.matchScore ?? -1));
    }
    return { page, tier, offset, done, source: res?.source || null, center: res?.center || null, ai, filtersMissing };
  };

  useEffect(() => {
    let live = true;
    setState((s) => ({ ...s, loading: true }));
    fetchPage(empty).then((r) => {
      if (!live) return;
      setState({ ...empty, vendors: r.page, tier: r.tier, offset: r.offset, done: r.done, source: r.source, center: r.center, ai: r.ai, filtersMissing: r.filtersMissing, loading: false });
    });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const more = useCallback(async () => {
    if (state.done || state.loadingMore) return;
    const at = keyRef.current;
    setState((s) => ({ ...s, loadingMore: true }));
    const r = await fetchPage(state);
    if (keyRef.current !== at) return;
    setState((s) => {
      const seen = new Set(s.vendors.map((v) => v.id));
      return { ...s, vendors: [...s.vendors, ...r.page.filter((v) => !seen.has(v.id))], tier: r.tier, offset: r.offset, done: r.done, ai: r.ai || s.ai, filtersMissing: r.filtersMissing, loadingMore: false };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, key]);

  // « Meilleur match » (comparaison par l'IA) : le premier, s'il correspond vraiment
  const vendors = state.vendors.map((v, i) => (v.matchScore === undefined ? v : { ...v, best: i === 0 && v.matchScore >= BEST_SCORE }));
  return { vendors, source: state.source, center: state.center, loading: state.loading, loadingMore: state.loadingMore, hasMore: !state.done, ai: state.ai, filtersMissing: state.filtersMissing, filters, city, more };
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
  // Distance au lieu choisi : c'est la référence des prestataires qui ne sont pas des lieux
  if (v.km !== undefined) return v.works && venueName ? `Intervient ${withArticle(venueName)} · à ${v.km} km` : `À ${v.km} km ${venueName ? withArticle(venueName, "de") : "de votre lieu"}`;
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

export function VendorCard({ v, picked, onToggle, onOpen, onMap, venueName }) {
  const data = useDash().data;
  const facts = venueFacts(v, data);
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
        {facts.length ? <FactChips facts={facts} /> : details(v, venueName) ? <div className="d-pr-details">{details(v, venueName)}</div> : null}
        {v.why ? (
          <div className="d-pr-why">
            <span>{v.category === "lieu" ? "Pourquoi ce lieu :" : "Pourquoi :"}</span> {v.why}
          </div>
        ) : null}
        <ToConfirm v={v} />
        {v.price || (onMap && mapPoint(v)) ? (
          <div className="d-pr-card-price">
            <Price v={v} />
            {onMap && mapPoint(v) ? (
              <button type="button" className="d-pr-maplink" onClick={() => onMap(v)}>
                <Icon name="map" size={14} sw={2} />
                Voir sur la carte
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </article>
  );
}

// Critères du couple que ce lieu n'a pas encore publiés (ni tenus, ni contredits)
export function ToConfirm({ v }) {
  if (!v.unknown?.length) return null;
  return (
    <div className="d-pr-confirm">
      <span>À confirmer :</span> {v.unknown.join(", ")}
    </div>
  );
}

// Dans une grille, avant le premier lieu « à confirmer »
export function ConfirmDivider({ list, index, category = "lieu" }) {
  const v = list[index];
  if (!v?.unknown?.length || list[index - 1]?.unknown?.length) return null;
  return (
    <div className="d-pr-tier" role="presentation">
      <strong>À confirmer avec {category === "lieu" ? "le lieu" : "le prestataire"}</strong>
    </div>
  );
}

// Colonnes de filtre absentes du catalogue (supabase/catalog-filtres.sql pas encore lancé)
export function FiltersNote({ rec }) {
  const dash = useDash();
  if (dash.mode !== "live" || !rec.filtersMissing) return null;
  return (
    <div className="d-card is-panel">
      <strong>Vos critères ne peuvent pas encore être appliqués.</strong>
      <span className="d-small" style={{ lineHeight: 1.5, color: "#43423c" }}>
        Collez le fichier <code>supabase/catalog-filtres.sql</code> dans Supabase (SQL Editor), puis rechargez la page. En attendant, les propositions ne tiennent compte que de votre région.
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Bandeau « Ma sélection » : noir pour une seule catégorie (7), blanc pour plusieurs (7g)
// ---------------------------------------------------------------------------

// Bandeau réduit en pastille « 3 ♥ » : mémorisé pour la session
const REDUCED_KEY = "merry-selection-reduite";
export function useReducedBar() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    try {
      setReduced(window.sessionStorage.getItem(REDUCED_KEY) === "1");
    } catch {
      /* stockage indisponible */
    }
  }, []);
  const set = (on) => {
    setReduced(on);
    try {
      if (on) window.sessionStorage.setItem(REDUCED_KEY, "1");
      else window.sessionStorage.removeItem(REDUCED_KEY);
    } catch {
      /* stockage indisponible */
    }
  };
  return [reduced, set];
}

export function SelectionPill({ count, onOpen, label = "Rouvrir ma sélection" }) {
  return (
    <div className="d-pr-selpill-wrap">
      <button type="button" className="d-pr-selpill" aria-label={`${label} : ${count}`} onClick={onOpen}>
        {count}
        <Icon name="heart" size={15} sw={2} />
      </button>
    </div>
  );
}

function ReduceBtn({ onClick, light }) {
  return (
    <button type="button" className={`d-pr-bar-reduce${light ? " is-light" : ""}`} aria-label="Réduire ma sélection" onClick={onClick}>
      <Icon name="x" size={14} sw={2.2} />
    </button>
  );
}

export function SelectionBar({ picks, onRequest, onClear }) {
  const by = picksBy(picks);
  const groups = CATEGORIES.filter((c) => by[c.key].length);
  const [reduced, setReduced] = useReducedBar();
  if (!picks.length) return null;
  if (reduced) return <SelectionPill count={picks.length} onOpen={() => setReduced(false)} />;
  if (groups.length === 1) {
    const c = groups[0];
    const list = by[c.key];
    const names = list.map((p) => p.data?.name).join(", ");
    return (
      <div role="region" aria-label="Ma sélection" className="d-pr-bar is-dark">
        <ReduceBtn onClick={() => setReduced(true)} />
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
          <Link href="/dashboard/prestataires/mes" className="d-pr-bar-ghost">
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
      <ReduceBtn onClick={() => setReduced(true)} light />
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

export function Layer({ kind, label, labelledBy, onClose, children }) {
  const [host, setHost] = useState(null);
  const ref = useRef(null);
  // onClose peut changer pendant que la fenêtre est ouverte (garde de la demande de devis) :
  // lu par une référence, pour ne pas reprendre le focus à chaque changement
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => setHost(document.querySelector(".d-root") || document.body), []);
  useEffect(() => {
    if (!host) return undefined;
    const onKey = (e) => e.key === "Escape" && closeRef.current();
    document.addEventListener("keydown", onKey);
    const prev = document.activeElement;
    ref.current?.querySelector("button")?.focus();
    document.body.classList.add("d-noscroll");
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.classList.remove("d-noscroll");
      prev?.focus?.();
    };
  }, [host]);
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

export function CloseBtn({ onClose, label = "Fermer" }) {
  return (
    <button type="button" className="d-pr-close" aria-label={label} onClick={onClose}>
      <Icon name="x" size={18} sw={2} stroke="#1c1c1a" />
    </button>
  );
}

// ---------------------------------------------------------------------------
// Préciser mes envies (7c et 7o)
// ---------------------------------------------------------------------------

export const ACCESS = [
  { key: "parking", label: "Parking sur place" },
  { key: "pmr", label: "Accessible PMR" },
];
export const VENUE = [
  { key: "ceremonie_exterieur", label: "Cérémonie en extérieur" },
  { key: "exclusivite", label: "Lieu en exclusivité" },
  { key: "fin_tardive", label: "Fin de soirée après 2 h" },
];
export const CATERER = [
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

export function Choice({ on, children, onClick, role = "button", small }) {
  const props = role === "radio" ? { role: "radio", "aria-checked": on } : { "aria-pressed": on };
  return (
    <button type="button" {...props} className={`d-pr-opt${on ? " is-on" : ""}${small ? " is-small" : ""}`} onClick={onClick}>
      {on && role !== "radio" ? <Icon name="check" size={13} sw={2.6} stroke="#ffffff" /> : null}
      {children}
    </button>
  );
}

export function OtherNumber({ value, presets, onChange, label, suffix }) {
  const custom = value && !presets.includes(value);
  return (
    <label className={`d-pr-other${custom ? " is-on" : ""}`}>
      <input type="number" inputMode="numeric" placeholder="Autre" aria-label={label} value={custom ? value : ""} onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)} />
      {suffix ? <span aria-hidden="true">{suffix}</span> : null}
    </label>
  );
}

export function MaxRow({ value, onChange, label }) {
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

export const EMPTY_WISHES = { regions: [], airport: { on: false, max: null }, station: { on: false, max: null }, city: { name: "", max: null }, access: [], seats: null, beds: null, venue: [], caterer: null, style: "", removed: [] };

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
// Marqueur de la carte : la photo du lieu, en rond ; un cœur s'il est dans la sélection. Le nom reste dans la liste.
export function PricePin({ v, at, active, picked, onClick, small }) {
  const photo = (v.photos || []).find(Boolean);
  return (
    <button
      type="button"
      className={`d-pr-pin is-photo${active ? " is-active" : ""}${small ? " is-small" : ""}`}
      style={{ left: at.left, top: at.top }}
      aria-label={`${v.name}${v.price ? `, à partir de ${euros(v.price)}` : ""}${picked ? ", dans votre sélection" : ""}`}
      aria-pressed={active}
      onClick={onClick}
    >
      <span aria-hidden="true" className="d-pr-pin-img" style={{ backgroundImage: photo ? `url("${photo}")` : undefined }}>
        {photo ? null : initialsOf(v.name)}
      </span>
      {picked ? (
        <span aria-hidden="true" className="d-pr-pin-heart">
          <Icon name="heart" size={10} sw={2} stroke="#ffffff" fill="#ffffff" />
        </span>
      ) : null}
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

export function FichePanel({ v, index, total, list, onClose, onRequest, onMes, onMap }) {
  const dash = useDash();
  const { isPicked, toggle } = usePicks();
  const picked = isPicked(v);
  const c = catOf(v.category);
  const photos = v.photos?.length ? v.photos : [null];
  const [i, setI] = useState(0);
  const n = Math.max(photos.length, 5);
  const cur = photos[i] || null;
  // Lieux : les faits avec leur icône, en lime quand ils répondent à un critère du couple
  const vf = venueFacts(v, dash.data, { all: true });
  const facts = vf.length ? vf.map((f) => [f.key, f.label, f.value, f.match]) : factsOf(v).map(([icon, k, val]) => [icon, k, val, false]);
  const matched = vf.filter((f) => f.match);
  const gmaps = v.lat !== undefined && v.lat !== null && v.lng !== undefined && v.lng !== null ? `https://www.google.com/maps/search/?api=1&query=${v.lat},${v.lng}` : null;
  const guests = guestsLabel(dash.data);
  const guestsN = Number(String(guests).match(/\d+/)?.[0] || 0);
  // Une vue de plus sur la fiche du prestataire (« Ce mois-ci » de son espace, supabase/espace-prestataire.sql)
  const weddingId = dash.data.wedding?.id;
  useEffect(() => {
    if (dash.mode !== "live" || !supabase || !v.catalogId || !weddingId) return;
    supabase.rpc("merry_log_view", { v: v.catalogId, w: weddingId }).then(() => {});
  }, [dash.mode, v.catalogId, weddingId]);
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
          // Le détail des faits, replié : la liste « Pourquoi ce lieu » dit déjà l'essentiel
          <details className="d-pr-fdetails">
            <summary>
              Tous les détails
              <Icon name="chevDown" size={14} sw={2.2} />
            </summary>
            <dl>
              {facts.map(([icon, k, val]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd>{val}</dd>
                </div>
              ))}
            </dl>
          </details>
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
        {v.story || v.why || matched.length || vf.length ? (
          <section className="d-pr-fsec">
            <h2>{v.category === "lieu" ? "Pourquoi ce lieu" : "Pourquoi ce prestataire"}</h2>
            {matched.length ? <FactChips facts={matched} className="is-fiche" /> : vf.length ? <FactChips facts={vf.slice(0, 4)} className="is-fiche" /> : null}
            {v.story || v.why ? <p>{v.story || `${v.why.charAt(0).toUpperCase()}${v.why.slice(1)}.`}</p> : null}
            {v.checks?.length ? (
              <div className="d-pr-included">
                <div className="d-pr-included-t">À vérifier avec {v.category === "lieu" ? "le lieu" : "le prestataire"}</div>
                <ul>
                  {v.checks.map((t) => (
                    <li key={t}>
                      <Icon name="arrowRight" size={15} sw={2} stroke="#6b6a63" style={{ flex: "none", marginTop: 2 }} />
                      <span>{t}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {v.matchScore !== undefined ? <span className="d-pr-ai-note">Analyse Merry d'après votre brief et vos envies, à confirmer avec {v.category === "lieu" ? "le lieu" : "le prestataire"}.</span> : null}
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
            <MiniMap v={v} height={180} />
            {v.where ? <div className="d-pr-where">{v.where}</div> : null}
            <div className="d-pr-maplinks">
              {onMap ? (
                <button type="button" className="d-pr-maplink" onClick={() => onMap(v)}>
                  <Icon name="map" size={14} sw={2} />
                  Voir sur la carte
                </button>
              ) : null}
              {gmaps ? (
                <a className="d-pr-maplink" href={gmaps} target="_blank" rel="noopener noreferrer">
                  <Icon name="external" size={14} sw={2} />
                  Ouvrir dans Google Maps
                </a>
              ) : null}
            </div>
          </section>
        ) : null}
        <section className="d-pr-fsec">
          <h2>Vos commentaires</h2>
          <VendorComments vendorRef={v.id} name={v.name} />
        </section>
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


const MONTH_NAMES = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];

const DRAFT_KEY = "merry-devis-brouillon";

function readDraft(weddingId) {
  try {
    const raw = window.sessionStorage.getItem(`${DRAFT_KEY}:${weddingId}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeDraft(weddingId, draft) {
  try {
    if (draft) window.sessionStorage.setItem(`${DRAFT_KEY}:${weddingId}`, JSON.stringify(draft));
    else window.sessionStorage.removeItem(`${DRAFT_KEY}:${weddingId}`);
  } catch {
    /* stockage indisponible : le brouillon vit le temps de la fenêtre */
  }
}

// Le brouillon (message, questions, dates, budget) est gardé jusqu'à l'envoi : fermer la fenêtre ou retirer
// un prestataire ne l'efface jamais. Fermer une demande modifiée demande confirmation.
export function DevisDialog({ picks: initial, onClose, onSent }) {
  const dash = useDash();
  const data = dash.data;
  const weddingId = data.wedding.id;
  const weddingDay = toDate(data.wedding.wedding_date);
  const firstYear = weddingDay ? weddingDay.getFullYear() : new Date().getFullYear() + 1;
  // Dates flexibles choisies dans « Vos critères » : la demande part de cette période
  const when = data.wishes?.wishes?.when;
  const fresh = useMemo(
    () => ({
      message: defaultMessage(data, when ? periodLabel(when.months || [], when.years || []) : null),
      questions: Object.fromEntries(CATEGORIES.map((c) => [c.key, (QUESTIONS[c.key] || []).map((q) => ({ q, on: true }))])),
      dates: [dateLong(data.wedding.wedding_date), "", ""],
      flexible: !!when,
      months: when ? when.months || [] : weddingDay ? [weddingDay.getMonth()] : [],
      years: when ? when.years || [] : [firstYear],
      share: false,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  // Brouillon gardé : un ancien message finissait par la signature, désormais ajoutée en dernier à l'envoi
  const [draft, setDraft] = useState(() => {
    const saved = readDraft(weddingId) || {};
    if (saved.message) {
      const { body, closing } = splitSignature(saved.message);
      if (!closing || /^merci beaucoup/i.test(closing)) saved.message = body;
    }
    return { ...fresh, ...saved };
  });
  const { message, questions, dates, flexible, months, years, share } = draft;
  const set = (patch) => setDraft((d) => ({ ...d, ...(typeof patch === "function" ? patch(d) : patch) }));
  const [list, setList] = useState(initial);
  const [adding, setAdding] = useState({});
  const [busy, setBusy] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const [preview, setPreview] = useState(null);
  const cats = CATEGORIES.filter((c) => list.some((p) => p.category === c.key));
  const budget = budgetLabel(data);
  const by = picksBy(list);
  const changed = JSON.stringify(draft) !== JSON.stringify(fresh);

  useEffect(() => writeDraft(weddingId, changed ? draft : null), [weddingId, draft, changed]);

  const requestClose = useCallback(() => (changed ? setConfirmClose(true) : onClose()), [changed, onClose]);

  // Le message par défaut suit les dates (précises ou flexibles) tant que le couple ne l'a pas réécrit
  function setPeriod(nextFlexible, nextMonths, nextYears) {
    const before = defaultMessage(data, flexible ? periodLabel(months, years) : null);
    set({ flexible: nextFlexible, months: nextMonths, years: nextYears, ...(message === before ? { message: defaultMessage(data, nextFlexible ? periodLabel(nextMonths, nextYears) : null) } : {}) });
  }
  const toggle = (xs, x) => (xs.includes(x) ? xs.filter((y) => y !== x) : [...xs, x]);
  const finalQuestions = () => Object.fromEntries(cats.map((c) => [c.key, questions[c.key].filter((x) => x.on && x.q.trim()).map((x) => x.q.trim())]));
  const finalDates = () => (flexible ? [flexibleDates(months, years)] : dates.filter((d, i) => i === 0 || d.trim()));

  async function send() {
    if (!list.length || !message.trim()) return;
    if (dash.mode === "live" && !data.picksSetup) {
      dash.setToast({ kind: "error", text: "Les demandes ne peuvent pas encore être enregistrées : collez supabase/prestataires.sql dans Supabase (SQL Editor)." });
      return;
    }
    setBusy(true);
    await dash.sendQuotes({ picks: list, message: message.trim(), questions: finalQuestions(), dates: finalDates(), budget: share ? budget : null, notes: {} });
    setBusy(false);
    writeDraft(weddingId, null);
    dash.setToast({ kind: "ok", text: `${list.length > 1 ? `${list.length} demandes enregistrées` : "Demande enregistrée"}, sur la fiche de chaque prestataire dans Budget.` });
    onSent?.();
  }

  const shown = preview ? list.find((p) => p.id === preview) || list[0] : null;

  return (
    <Layer kind="dialog" labelledBy="devis-titre" onClose={requestClose}>
      <div className="d-pr-panel-head is-dialog">
        <h2 id="devis-titre">Demander les devis</h2>
        <CloseBtn onClose={requestClose} />
      </div>
      <div className="d-pr-panel-body d-pr-devis">
        <section className="d-pr-dsec">
          <h3>À qui</h3>
          {list.length ? null : <span className="d-pr-dsub">Personne pour l’instant</span>}
          <ul className="d-pr-to">
            {list.map((p) => {
              const c = catOf(p.category);
              return (
                <li key={p.id}>
                  <Thumb v={p.data} size={44} />
                  <div className="d-pr-to-main">
                    <span className="d-pr-to-name">{p.data?.name}</span>
                    <span className="d-pr-to-meta">
                      {c.label}
                      {p.data?.area ? ` · ${p.data.area}` : ""}
                    </span>
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
          <textarea id="devis-message" rows={8} className="d-textarea d-pr-field is-message" value={message} onChange={(e) => set({ message: e.target.value })} />
        </section>
        {cats.length ? (
          <section className="d-pr-dsec is-ruled">
            <div className="d-pr-dsec-t">
              <h3>Questions selon le prestataire</h3>
            </div>
            {cats.map((c) => (
              <fieldset key={c.key} className="d-pr-qset">
                <legend>{legendFor(c.key, by[c.key].length)}</legend>
                {questions[c.key].map((x, k) => (
                  <label key={k} className="d-pr-q">
                    <input type="checkbox" checked={x.on} onChange={() => set((d) => ({ questions: { ...d.questions, [c.key]: d.questions[c.key].map((y, j) => (j === k ? { ...y, on: !y.on } : y)) } }))} />
                    {x.q}
                  </label>
                ))}
                {adding[c.key] !== undefined ? (
                  <form
                    className="d-pr-qadd"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const q = adding[c.key].trim();
                      if (q) set((d) => ({ questions: { ...d.questions, [c.key]: [...d.questions[c.key], { q, on: true }] } }));
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
          <div className="d-pr-flex">
            <span id="devis-flexible" className="d-pr-flex-t">
              Nos dates sont flexibles
            </span>
            <button type="button" role="switch" aria-checked={flexible} aria-labelledby="devis-flexible" className={`d-pr-switch${flexible ? " is-on" : ""}`} onClick={() => setPeriod(!flexible, months, years)}>
              <span />
            </button>
          </div>
          {flexible ? (
            <>
              <div role="group" aria-labelledby="devis-mois" className="d-pr-period">
                <span id="devis-mois">Mois, un ou plusieurs</span>
                <div className="d-pr-optrow">
                  {MONTH_NAMES.map((m, k) => (
                    <Choice key={m} on={months.includes(k)} onClick={() => setPeriod(true, toggle(months, k), years)}>
                      {m}
                    </Choice>
                  ))}
                </div>
              </div>
              <div role="group" aria-labelledby="devis-annee" className="d-pr-period">
                <span id="devis-annee">Année</span>
                <div className="d-pr-optrow">
                  {[firstYear, firstYear + 1, firstYear + 2].map((y) => (
                    <Choice key={y} on={years.includes(y)} onClick={() => setPeriod(true, months, toggle(years, y))}>
                      {y}
                    </Choice>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="d-pr-dates">
                <div className="d-pr-date">
                  <label htmlFor="devis-date-0">Date souhaitée</label>
                  <div className="d-pr-datebox">
                    <Icon name="calendarPlain" size={16} sw={1.8} stroke="#6b6a63" />
                    <input id="devis-date-0" type="text" value={dates[0]} onChange={(e) => set((d) => ({ dates: [e.target.value, d.dates[1], d.dates[2]] }))} />
                  </div>
                </div>
              </div>
              <div role="group" aria-labelledby="devis-autres" className="d-pr-period">
                <span id="devis-autres">Autres dates possibles</span>
                <div className="d-pr-dates">
                  {[1, 2].map((k) => (
                    <div key={k} className="d-pr-date">
                      <div className="d-pr-datebox">
                        <Icon name="calendarPlain" size={16} sw={1.8} stroke="#6b6a63" />
                        <input type="text" aria-label={`Autre date possible ${k}`} placeholder="Facultatif" value={dates[k]} onChange={(e) => set((d) => ({ dates: d.dates.map((x, j) => (j === k ? e.target.value : x)) }))} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </section>
        {budget ? (
          <section className="d-pr-dsec is-ruled is-switch">
            <div className="d-pr-dsec-t">
              <span id="devis-budget" className="d-pr-dtitle">
                Partager notre budget ({budget})
              </span>
            </div>
            <button type="button" role="switch" aria-checked={share} aria-labelledby="devis-budget" className={`d-pr-switch${share ? " is-on" : ""}`} onClick={() => set((d) => ({ share: !d.share }))}>
              <span />
            </button>
          </section>
        ) : null}
        {list.length ? (
          <section className="d-pr-dsec is-ruled">
            <button type="button" className="d-pr-linkbtn" aria-expanded={!!shown} onClick={() => setPreview(shown ? null : list[0].id)}>
              {shown ? "Masquer le message envoyé" : "Voir ce qui sera envoyé"}
            </button>
            {shown ? (
              <div className="d-pr-preview">
                {list.length > 1 ? (
                  <div className="d-pr-optrow" role="radiogroup" aria-label="Prestataire">
                    {list.map((p) => (
                      <Choice key={p.id} role="radio" small on={p.id === shown.id} onClick={() => setPreview(p.id)}>
                        {p.data?.name}
                      </Choice>
                    ))}
                  </div>
                ) : null}
                <div className="d-pr-preview-to">À {shown.data?.name}</div>
                <p className="d-pr-preview-body">{requestBody({ message, questions: finalQuestions()[shown.category] || [], dates: finalDates(), budget: share ? budget : null, sign: signature(data.wedding) })}</p>
              </div>
            ) : null}
          </section>
        ) : null}
      </div>
      {confirmClose ? (
        <div className="d-pr-panel-foot is-devis is-confirm" role="alertdialog" aria-labelledby="devis-quitter">
          <span id="devis-quitter" className="d-pr-confirm-t">
            Fermer sans envoyer ? Votre message est gardé.
          </span>
          <span className="d-pr-confirm-btns">
            <button type="button" className="d-btn d-btn-ghost" onClick={() => setConfirmClose(false)} autoFocus>
              Continuer
            </button>
            <button type="button" className="d-btn d-btn-primary" onClick={onClose}>
              Fermer
            </button>
          </span>
        </div>
      ) : (
        <div className="d-pr-panel-foot is-devis">
          <button type="button" className="d-btn d-btn-primary d-pr-big" disabled={busy || !list.length || !message.trim()} onClick={send}>
            {list.length > 1 ? `Envoyer les ${list.length} demandes` : "Envoyer la demande"}
          </button>
        </div>
      )}
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
      {source === "exemple" ? <p className="d-pr-samplenote">Exemples : pas encore de prestataire validé dans votre région.</p> : null}
    </>
  );
}

export { inWords, monthYear, coupleNames, chosenVenue, pickStatus, picksBy, PRICE_BARS };
