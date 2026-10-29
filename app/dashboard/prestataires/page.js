"use client";

// Trouver des prestataires (canvas 7, 7c, 7d, 7e, 7g, 7h et leurs versions téléphone 7m, 7o, 7p, 7q, 7s, 7t)

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useDash } from "@/lib/dash/store";
import { catOf, countLabel, mapPoint, rank, sampleClusters } from "@/lib/dash/catalog";
import { project, unproject } from "@/lib/dash/provenceMap";
import { chosenVenue } from "@/lib/dash/picks";
import { searchWishes } from "@/lib/dash/criteria";
import { Icon } from "@/components/dash/icons";
import { FiltersPanel, SearchSummary, activeFilters, inPrice } from "@/components/dash/Filtres";
import {
  BestMatch,
  CategoryTabs,
  ConfirmDivider,
  DevisDialog,
  FichePanel,
  FiltersNote,
  Heart,
  MapCanvas,
  PrHead,
  Price,
  PricePin,
  SampleNote,
  SelectionBar,
  Thumb,
  ToConfirm,
  MAP_MIN_SCALE,
  MoreButton,
  useIsPhone,
  usePicks,
  useRecommendations,
  VendorCard,
  ViewToggle,
} from "@/components/dash/Prestataires";

function readParams() {
  if (typeof window === "undefined") return {};
  const p = new URLSearchParams(window.location.search);
  return { cat: p.get("cat"), vue: p.get("vue"), fiche: p.get("fiche"), envies: p.get("envies"), lieu: p.get("lieu") };
}

function writeParams(patch) {
  const p = new URLSearchParams(window.location.search);
  for (const [k, v] of Object.entries(patch)) {
    if (v) p.set(k, v);
    else p.delete(k);
  }
  const q = p.toString();
  window.history.replaceState(null, "", `${window.location.pathname}${q ? `?${q}` : ""}`);
}

export default function Trouver() {
  const dash = useDash();
  const router = useRouter();
  const phone = useIsPhone();
  const { picks, isPicked, toggle, add, removeMany } = usePicks();
  const [cat, setCat] = useState("lieu");
  const [view, setView] = useState("liste");
  const [filters, setFilters] = useState(false);
  // Fourchette de prix (panneau Filtres) : appliquée à la liste et à la carte
  const [price, setPrice] = useState(null);
  // « Rechercher » : un état de chargement sur les résultats, le temps que la recherche reparte
  const [searching, setSearching] = useState(false);
  const [ficheId, setFicheId] = useState(null);
  const [devis, setDevis] = useState(null);
  // « Voir sur la carte » : la vue Carte se centre sur ce prestataire
  const [focusId, setFocusId] = useState(null);

  useEffect(() => {
    const p = readParams();
    if (p.cat && catOf(p.cat).key === p.cat) setCat(p.cat);
    if (p.vue === "carte") setView("carte");
    if (p.fiche) setFicheId(p.fiche);
    if (p.envies) setFilters(true);
    if (p.lieu) {
      setView("carte");
      setFocusId(p.lieu);
      writeParams({ lieu: null });
    }
  }, []);

  const venuePick = chosenVenue(dash.data, picks);
  const venueName = venuePick?.data?.name || dash.data.wedding.venue || null;
  // Zone de la carte (« Rechercher dans cette zone ») : remplace la région du brief tant qu'elle est choisie
  const [bbox, setBbox] = useState(null);
  const rec = useRecommendations(cat, cat === "lieu" ? null : venuePick?.data?.lat ? { lat: venuePick.data.lat, lng: venuePick.data.lng } : null, bbox);
  const { vendors, source, loading } = rec;
  const wishes = cat === "lieu" ? searchWishes(dash.data) : null;
  const list = useMemo(() => rank(vendors, wishes, cat).filter((v) => inPrice(v, price)), [vendors, wishes, cat, price]);
  useEffect(() => {
    if (!searching || loading) return undefined;
    const t = setTimeout(() => setSearching(false), 450);
    return () => clearTimeout(t);
  }, [searching, loading]);
  const pending = picks.filter((p) => !p.requested_at);
  const c = catOf(cat);
  const fiche = ficheId ? list.find((v) => v.id === ficheId) || vendors.find((v) => v.id === ficheId) : null;

  const changeCat = (k) => {
    setCat(k);
    setBbox(null);
    writeParams({ cat: k === "lieu" ? null : k });
  };
  const changeView = (v) => {
    setView(v);
    writeParams({ vue: v === "carte" ? "carte" : null });
  };
  const openFiche = (v) => {
    setFicheId(v.id);
    writeParams({ fiche: v.id });
  };
  const closeFiche = () => {
    setFicheId(null);
    writeParams({ fiche: null });
  };
  const showOnMap = (v) => {
    setFicheId(null);
    setFocusId(v.id);
    setView("carte");
    writeParams({ fiche: null, vue: "carte" });
    window.scrollTo({ top: 0 });
  };
  async function requestOne(v) {
    const p = await add(v);
    if (!p) return;
    setFicheId(null);
    writeParams({ fiche: null });
    setDevis([p]);
  }
  async function clearSelection() {
    await removeMany(pending);
    dash.setToast({ kind: "ok", text: "Sélection vidée." });
  }

  const wishesOn = wishes && Object.values(wishes).some((x) => (Array.isArray(x) ? x.length : x && typeof x === "object" ? x.on || x.name : x));
  const subtitle = loading || searching
    ? "Recherche en cours…"
    : list.length
      ? null
      : wishesOn && cat === "lieu"
        ? "Aucun lieu ne tient tous vos critères ici."
        : `Aucun ${c.one} à vous proposer pour l’instant.`;

  const overlays = (
    <>
      {filters ? (
        <FiltersPanel
          category={cat}
          price={price}
          onClose={() => {
            setFilters(false);
            writeParams({ envies: null });
          }}
          onApply={(p) => {
            setPrice(p);
            setSearching(true);
            window.scrollTo({ top: 0 });
          }}
        />
      ) : null}
      {fiche ? <FichePanel v={fiche} index={Math.max(0, list.indexOf(fiche))} total={list.length} onClose={closeFiche} onRequest={requestOne} onMap={showOnMap} /> : null}
      {devis ? <DevisDialog picks={devis} onClose={() => setDevis(null)} onSent={() => router.push("/dashboard/prestataires/demandes")} /> : null}
    </>
  );

  // Téléphone, vue carte : la carte occupe l'écran, la liste dans un tiroir en bas (7p)
  if (view === "carte" && phone) {
    return (
      <>
        <MapView focusId={focusId} list={list} rec={rec} onArea={setBbox} cat={cat} source={source} phone isPicked={isPicked} onToggle={toggle} onOpen={openFiche} onFilters={() => setFilters(true)} filtersCount={activeFilters(dash.data, price)} onList={() => changeView("liste")} pending={pending} />
        {overlays}
      </>
    );
  }

  return (
    <>
      <PrHead on="trouver" />
      <SampleNote source={source} />
      <FiltersNote rec={rec} />
      <SearchSummary price={price} busy={searching} onOpen={() => setFilters(true)} />
      <div className="d-pr-tabrow">
        <CategoryTabs value={cat} onChange={changeCat} />
        <div className="d-pr-tabrow-right">
          <ViewToggle view={view} onChange={changeView} />
        </div>
      </div>

      {view === "carte" ? (
        <MapView focusId={focusId} list={list} rec={rec} onArea={setBbox} cat={cat} source={source} isPicked={isPicked} onToggle={toggle} onOpen={openFiche} onFilters={() => setFilters(true)} filtersCount={activeFilters(dash.data, price)} pending={pending} onRequest={() => setDevis(pending)} onClear={clearSelection} />
      ) : (
        <>
          <div className="d-pr-intro">
            <h2>Recommandations</h2>
            {subtitle ? <p>{subtitle}</p> : null}
          </div>
          <div className={`d-pr-grid${searching ? " is-loading" : ""}`} aria-busy={searching || undefined}>
            {list.map((v, i) => (
              <Fragment key={v.id}>
                <ConfirmDivider list={list} index={i} category={cat} />
                <VendorCard v={v} picked={isPicked(v)} onToggle={() => toggle(v)} onOpen={() => openFiche(v)} onMap={showOnMap} venueName={venueName} />
              </Fragment>
            ))}
          </div>
          <MoreButton rec={rec} category={cat} />
          <SelectionBar picks={pending} onRequest={() => setDevis(pending)} onClear={clearSelection} />
        </>
      )}
      {overlays}
    </>
  );
}

// ---------------------------------------------------------------------------
// Vue carte (7d, 7p) : marqueurs photo, la liste à côté (ordinateur) ou dans un tiroir à trois hauteurs
// (téléphone : replié, à mi-hauteur, plein écran). Toucher un marqueur met sa carte en avant dans la liste.
// ---------------------------------------------------------------------------

const SHEET = ["peek", "half", "full"];

function MapView({ focusId, list, rec, onArea, cat, source, phone, isPicked, onToggle, onOpen, onFilters, filtersCount, onList, pending, onRequest }) {
  const c = catOf(cat);
  const [center, setCenter] = useState(phone ? { x: 504.6, y: 755.4 } : { x: 500, y: 550 });
  const [scale, setScale] = useState(phone ? 0.788 : 1);
  const [activeId, setActive] = useState(null);
  const active = activeId;
  const [zone, setZone] = useState(null);
  const [sheet, setSheet] = useState("half");
  const boundsRef = useRef(null);
  const listRef = useRef(null);
  const dragRef = useRef(null);

  const onView = ({ center: c2, scale: s2 }) => {
    setCenter(c2);
    setScale(s2);
  };

  // Catalogue : la carte se centre une fois sur les premiers prestataires trouvés (le cadre du canvas
  // montre la Provence) ; ensuite elle reste où on l'a mise (« Voir plus », recherche dans la zone)
  const centeredFor = useRef(null);
  useEffect(() => {
    if (source !== "catalogue" || centeredFor.current === cat) return;
    const pts = list.map(mapPoint).filter(Boolean);
    if (!pts.length) return;
    centeredFor.current = cat;
    const xs = pts.map((p) => p.x);
    const ys = pts.map((p) => p.y);
    const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    const b = boundsRef.current;
    const w = b ? (b.x1 - b.x0) * scale : phone ? 390 : 670;
    const h = (b ? (b.y1 - b.y0) * scale : phone ? 743 : 940) - (phone ? 360 : 0);
    const fit = Math.min(1, (w - 120) / Math.max(1, maxX - minX), (h - 120) / Math.max(1, maxY - minY));
    const next = Math.max(MAP_MIN_SCALE, fit);
    const y = (minY + maxY) / 2;
    setScale(next);
    setCenter({ x: (minX + maxX) / 2, y: phone ? y + 180 / next : y });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, list, phone, cat]);

  // « Voir sur la carte » : centré sur le lieu demandé, plus près, et mis en avant
  const focused = useRef(null);
  useEffect(() => {
    if (!focusId || focused.current === focusId) return;
    const v = list.find((x) => x.id === focusId);
    const p = v && mapPoint(v);
    if (!p) return;
    focused.current = focusId;
    centeredFor.current = cat;
    const next = Math.max(scale, 2.2);
    setScale(next);
    setCenter({ x: p.x, y: phone ? p.y + 180 / next : p.y });
    setActive(v.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusId, list]);

  const inZone = (v) => {
    if (!zone || source !== "exemple") return true;
    const p = mapPoint(v);
    return p && p.x >= zone.x0 && p.x <= zone.x1 && p.y >= zone.y0 && p.y <= zone.y1;
  };
  const shown = list.filter(inZone);
  const clusters = source === "exemple" && cat === "lieu" ? sampleClusters() : [];
  const title = `${countLabel(shown.length, cat)} dans cette zone`;

  // Le marqueur touché : sa carte en avant dans la liste, qui défile jusqu'à elle (tiroir ouvert au besoin)
  const pick = (v) => {
    if (v.id === active && phone) return onOpen(v);
    setActive(v.id);
    if (phone && sheet === "peek") setSheet("half");
    requestAnimationFrame(() => listRef.current?.querySelector(`[data-id="${CSS.escape(v.id)}"]`)?.scrollIntoView({ behavior: "smooth", block: "nearest" }));
  };

  const map = (
    <MapCanvas center={center} scale={scale} onView={onView} label={c.key === "lieu" ? "Carte des lieux" : `Carte des ${c.many}`} className={phone ? "is-phone" : "is-desk"}>
      {({ toScreen, bounds }) => {
        boundsRef.current = bounds;
        return (
          <>
            {clusters.map((k) => {
              const at = toScreen(project(k.lat, k.lng));
              return (
                <button
                  key={k.label}
                  type="button"
                  className="d-pr-cluster"
                  style={at}
                  aria-label={`${k.count} lieux dans ${k.label}, zoomer`}
                  onClick={() => {
                    setCenter(project(k.lat, k.lng));
                    setScale((s) => Math.min(6, s * 1.6));
                  }}
                >
                  {k.count}
                </button>
              );
            })}
            {shown.map((v) => {
              const p = mapPoint(v);
              if (!p) return null;
              return <PricePin key={v.id} v={v} at={toScreen(p)} active={v.id === active} picked={isPicked(v)} small={phone} onClick={() => pick(v)} />;
            })}
          </>
        );
      }}
    </MapCanvas>
  );

  const searchZone = (
    <button
      type="button"
      className="d-pr-zone"
      onClick={() => {
        const b = boundsRef.current;
        // Catalogue : nouvelle recherche dans la zone affichée ; sélection d'exemple : on filtre ce qui est là
        if (source !== "catalogue") return setZone({ ...b });
        const nw = unproject(b.x0, b.y0);
        const se = unproject(b.x1, b.y1);
        onArea({ south: se.lat, north: nw.lat, west: nw.lng, east: se.lng });
      }}
    >
      <Icon name="zoom" size={15} sw={2} stroke="#1c1c1a" />
      Rechercher dans cette zone
    </button>
  );

  const filtersBtn = (
    <button type="button" className={`d-pr-filters-btn is-float${filtersCount ? " is-on" : ""}`} onClick={onFilters} aria-haspopup="dialog">
      <Icon name="list" size={16} sw={2} />
      Filtres
      {filtersCount ? <span className="d-pr-filters-badge">{filtersCount}</span> : null}
    </button>
  );

  const cards = shown.map((v) => (
    <MiniCard key={v.id} v={v} size={phone ? 96 : 120} picked={isPicked(v)} active={v.id === active} onToggle={() => onToggle(v)} onOpen={() => onOpen(v)} onFocus={phone ? undefined : () => setActive(v.id)} />
  ));

  if (phone) {
    // Tiroir : la poignée se tire vers le haut ou le bas, ou se touche pour passer à la hauteur suivante
    const step = (d) => setSheet((s) => SHEET[Math.min(2, Math.max(0, SHEET.indexOf(s) + d))]);
    const onDown = (e) => (dragRef.current = e.clientY);
    const onUp = (e) => {
      const y0 = dragRef.current;
      dragRef.current = null;
      if (y0 === null || y0 === undefined) return;
      const dy = e.clientY - y0;
      if (Math.abs(dy) < 12) step(sheet === "full" ? -2 : 1);
      else step(dy < 0 ? 1 : -1);
    };
    return (
      <div className="d-pr-mapm">
        {map}
        <div className="d-pr-maptop">
          <button type="button" className="d-pr-mapback" onClick={onList} aria-label="Revenir à la liste">
            <Icon name="back" size={18} sw={2.2} />
          </button>
          {filtersBtn}
        </div>
        {sheet !== "full" ? searchZone : null}
        <div role="region" aria-label={`${c.tab} dans cette zone`} className={`d-pr-sheet is-${sheet}`}>
          <button type="button" className="d-pr-sheet-handle" aria-label={sheet === "full" ? "Réduire la liste" : "Agrandir la liste"} onPointerDown={onDown} onPointerUp={onUp}>
            <span />
          </button>
          <div className="d-pr-sheet-head" onPointerDown={onDown} onPointerUp={onUp}>
            <h2>{title}</h2>
          </div>
          <div className="d-pr-sheet-list" ref={listRef}>
            {cards}
            <MoreButton rec={rec} category={cat} className="is-list" />
          </div>
        </div>
        {sheet === "full" ? (
          <button type="button" className="d-pr-maplistbtn" onClick={() => setSheet("peek")}>
            <Icon name="map" size={16} sw={2} />
            Carte
          </button>
        ) : (
          <button type="button" className="d-pr-maplistbtn" onClick={onList}>
            <Icon name="list" size={16} sw={2} />
            Liste
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="d-pr-split">
      <div className="d-pr-split-list" ref={listRef}>
        <div className="d-pr-split-head">
          <h2>{title}</h2>
          <span>Par pertinence</span>
        </div>
        {cards}
        <MoreButton rec={rec} category={cat} className="is-list" />
        {pending.length ? <CompactBar picks={pending} onRequest={onRequest} /> : null}
      </div>
      <div className="d-pr-split-map">
        {map}
        <div className="d-pr-maptop is-desk">{filtersBtn}</div>
        {searchZone}
        <div className="d-pr-zoom">
          <button type="button" aria-label="Zoomer" onClick={() => setScale((s) => Math.min(6, s * 1.4))}>
            <Icon name="plus" size={16} sw={2.2} stroke="#1c1c1a" />
          </button>
          <span aria-hidden="true" />
          <button type="button" aria-label="Dézoomer" onClick={() => setScale((s) => Math.max(MAP_MIN_SCALE, s / 1.4))}>
            <Icon name="minus" size={16} sw={2.2} stroke="#1c1c1a" />
          </button>
        </div>
      </div>
    </div>
  );
}

// Carte compacte de la liste à côté de la carte (7d) et du tiroir téléphone (7p)
function MiniCard({ v, size, picked, active, onToggle, onOpen, onFocus }) {
  return (
    <article className={`d-pr-mini${active ? " is-active" : ""}`} data-id={v.id} onMouseEnter={onFocus}>
      <button type="button" className="d-pr-mini-img" style={{ width: size, height: size, backgroundImage: (v.photos || []).find(Boolean) ? `url("${(v.photos || []).find(Boolean)}")` : undefined }} aria-label={v.name} onClick={onOpen}>
        {(v.photos || []).find(Boolean) ? null : <span>Photo à venir</span>}
      </button>
      <div className="d-pr-mini-body">
        <div>
          <h3>
            <button type="button" onClick={onOpen}>
              {v.name}
            </button>
          </h3>
          <div className="d-pr-area">{v.area}</div>
        </div>
        {v.seats || v.beds !== undefined ? <div className="d-pr-mini-line">{[v.seats ? `${v.seats} places assises` : null, v.beds !== undefined ? `${v.beds} couchages` : null].filter(Boolean).join(" · ")}</div> : null}
        <ToConfirm v={v} />
        {v.best ? (
          <div className="d-pr-mini-tags">
            {v.best ? <BestMatch small /> : null}
          </div>
        ) : null}
        <div className="d-pr-mini-price">
          <Price v={v} unit=" " />
        </div>
      </div>
      <Heart on={picked} onClick={onToggle} className="d-pr-heart is-bare" size={20} />
    </article>
  );
}

function CompactBar({ picks, onRequest }) {
  const one = new Set(picks.map((p) => p.category)).size === 1;
  return (
    <div role="region" aria-label="Ma sélection" className="d-pr-compactbar">
      <span className="d-pr-stack">
        {picks.slice(0, 3).map((p, i) => (
          <Thumb key={p.id} v={p.data} size={36} ring="#1c1c1a" className={i ? "is-stacked" : ""} />
        ))}
      </span>
      <strong>{one ? `${countLabel(picks.length, picks[0].category)} sélectionné${picks.length > 1 ? "s" : ""}` : `${picks.length} sélectionnés`}</strong>
      <Link href="/dashboard/prestataires/mes" className="d-pr-bar-ghost is-small">
        Comparer
      </Link>
      <button type="button" className="d-pr-bar-cta is-small" onClick={onRequest}>
        Demander les devis
      </button>
    </div>
  );
}
