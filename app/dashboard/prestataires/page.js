"use client";

// Trouver des prestataires (canvas 7, 7c, 7d, 7e, 7g, 7h et leurs versions téléphone 7m, 7o, 7p, 7q, 7s, 7t)

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useDash } from "@/lib/dash/store";
import { catOf, countLabel, inWords, mapPoint, rank, sampleClusters } from "@/lib/dash/catalog";
import { project, unproject } from "@/lib/dash/provenceMap";
import { euros } from "@/lib/dash/format";
import { chosenVenue } from "@/lib/dash/picks";
import { Icon } from "@/components/dash/icons";
import {
  BestMatch,
  BriefBar,
  CategoryTabs,
  DevisDialog,
  EnviesPanel,
  FichePanel,
  Heart,
  MapCanvas,
  Negotiated,
  PrHead,
  Price,
  PricePin,
  PRICE_BARS,
  SampleNote,
  SelectionBar,
  Thumb,
  MAP_MIN_SCALE,
  MoreButton,
  PrecisionsBar,
  useIsPhone,
  usePicks,
  useRecommendations,
  VendorCard,
  ViewToggle,
} from "@/components/dash/Prestataires";

function readParams() {
  if (typeof window === "undefined") return {};
  const p = new URLSearchParams(window.location.search);
  return { cat: p.get("cat"), vue: p.get("vue"), fiche: p.get("fiche"), envies: p.get("envies") };
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
  const [envies, setEnvies] = useState(false);
  const [ficheId, setFicheId] = useState(null);
  const [devis, setDevis] = useState(null);

  useEffect(() => {
    const p = readParams();
    if (p.cat && catOf(p.cat).key === p.cat) setCat(p.cat);
    if (p.vue === "carte") setView("carte");
    if (p.fiche) setFicheId(p.fiche);
    if (p.envies) setEnvies(true);
  }, []);

  const venuePick = chosenVenue(dash.data, picks);
  const venueName = venuePick?.data?.name || dash.data.wedding.venue || null;
  // Zone de la carte (« Rechercher dans cette zone ») : remplace la région du brief tant qu'elle est choisie
  const [bbox, setBbox] = useState(null);
  const rec = useRecommendations(cat, cat === "lieu" ? null : venuePick?.data?.lat ? { lat: venuePick.data.lat, lng: venuePick.data.lng } : null, bbox);
  const { vendors, source, loading } = rec;
  const wishes = dash.data.wishes?.wishes || null;
  const list = useMemo(() => rank(vendors, wishes, cat), [vendors, wishes, cat]);
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
  const subtitle = loading
    ? source === "catalogue" || dash.mode === "live"
      ? `Merry compare les ${c.many} proches de chez vous à votre brief…`
      : "Chargement des propositions…"
    : list.length
      ? `${inWords(list.length, cat)} choisi${list.length > 1 ? "s" : ""} d'après votre brief${wishesOn && cat === "lieu" ? " et vos envies" : ""}.`
      : `Aucun ${c.one} à vous proposer pour l’instant.`;

  const overlays = (
    <>
      {envies ? (
        <EnviesPanel
          onClose={() => {
            setEnvies(false);
            writeParams({ envies: null });
          }}
        />
      ) : null}
      {fiche ? <FichePanel v={fiche} index={Math.max(0, list.indexOf(fiche))} total={list.length} onClose={closeFiche} onRequest={requestOne} /> : null}
      {devis ? <DevisDialog picks={devis} onClose={() => setDevis(null)} onSent={() => router.push("/dashboard/prestataires/demandes")} /> : null}
    </>
  );

  // Téléphone, vue carte : la carte occupe l'écran, la liste dans un tiroir en bas (7p)
  if (view === "carte" && phone) {
    return (
      <>
        <MapView list={list} rec={rec} onArea={setBbox} cat={cat} source={source} phone isPicked={isPicked} onToggle={toggle} onOpen={openFiche} onEnvies={() => setEnvies(true)} onList={() => changeView("liste")} pending={pending} />
        {overlays}
      </>
    );
  }

  return (
    <>
      <PrHead on="trouver" />
      <SampleNote source={source} />
      <BriefBar onEnvies={() => setEnvies(true)} />
      <div className="d-pr-tabrow">
        <CategoryTabs value={cat} onChange={changeCat} />
        <div className="d-pr-tabrow-right">
          <ViewToggle view={view} onChange={changeView} />
        </div>
      </div>

      {view === "carte" ? (
        <MapView list={list} rec={rec} onArea={setBbox} cat={cat} source={source} isPicked={isPicked} onToggle={toggle} onOpen={openFiche} onEnvies={() => setEnvies(true)} pending={pending} onRequest={() => setDevis(pending)} onClear={clearSelection} />
      ) : (
        <>
          <div className="d-pr-intro">
            <h2>Nos recommandations pour vous</h2>
            <p>{subtitle}</p>
          </div>
          <PrecisionsBar onOpen={() => setEnvies(true)} />
          <div className="d-pr-grid">
            {list.map((v) => (
              <VendorCard key={v.id} v={v} picked={isPicked(v)} onToggle={() => toggle(v)} onOpen={() => openFiche(v)} venueName={venueName} />
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
// Vue carte (7d, 7p)
// ---------------------------------------------------------------------------

const PRICE_MAX = 30000;

function fmt(n) {
  return Math.round(n).toLocaleString("fr-FR").replace(/\s/g, " ");
}

function PriceFilter({ value, count, onApply, onClose }) {
  const [range, setRange] = useState(value || [7000, 13000]);
  const track = useRef(null);
  const drag = (k) => (e) => {
    e.preventDefault();
    const el = track.current;
    const move = (ev) => {
      const r = el.getBoundingClientRect();
      const pct = Math.min(1, Math.max(0, (ev.clientX - r.left) / r.width));
      const v = Math.round((pct * PRICE_MAX) / 100) * 100;
      setRange((x) => (k === 0 ? [Math.min(v, x[1] - 500), x[1]] : [x[0], Math.max(v, x[0] + 500)]));
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };
  const lo = (range[0] / PRICE_MAX) * 100;
  const hi = (range[1] / PRICE_MAX) * 100;
  const parse = (s) => Number(String(s).replace(/[^\d]/g, "")) || 0;
  return (
    <div role="dialog" aria-label="Fourchette de prix" className="d-pr-pricepop">
      <div className="d-pr-pricepop-t">
        <strong>Fourchette de prix</strong>
        <span>Location du lieu, prix de départ</span>
      </div>
      <div>
        <svg width="236" height="56" viewBox="0 0 236 56" aria-hidden="true" style={{ display: "block", width: "100%" }} preserveAspectRatio="none">
          {PRICE_BARS.map((h, i) => {
            const x = 10.8 + i * 9.83;
            const on = x >= (lo / 100) * 236 && x + 7.8 <= (hi / 100) * 236;
            return <rect key={i} x={x} y={56 - h} width="7.8" height={h} rx="1.5" fill={on ? "#1c1c1a" : "#d9d7cf"} />;
          })}
        </svg>
        <div className="d-pr-slider" ref={track}>
          <span className="d-pr-slider-track" />
          <span className="d-pr-slider-fill" style={{ left: `${lo}%`, width: `${hi - lo}%` }} />
          <button type="button" role="slider" aria-label="Prix minimum" aria-valuemin={0} aria-valuemax={PRICE_MAX} aria-valuenow={range[0]} aria-valuetext={euros(range[0])} style={{ left: `${lo}%` }} onPointerDown={drag(0)} />
          <button type="button" role="slider" aria-label="Prix maximum" aria-valuemin={0} aria-valuemax={PRICE_MAX} aria-valuenow={range[1]} aria-valuetext={euros(range[1])} style={{ left: `${hi}%` }} onPointerDown={drag(1)} />
        </div>
      </div>
      <div className="d-pr-pricepop-inputs">
        <div>
          <label htmlFor="prix-min">Minimum</label>
          <div className="d-pr-eurbox">
            <input id="prix-min" type="text" inputMode="numeric" value={fmt(range[0])} onChange={(e) => setRange((x) => [Math.min(parse(e.target.value), x[1]), x[1]])} />
            <span aria-hidden="true">€</span>
          </div>
        </div>
        <span aria-hidden="true" className="d-pr-pricepop-a">
          à
        </span>
        <div>
          <label htmlFor="prix-max">Maximum</label>
          <div className="d-pr-eurbox">
            <input id="prix-max" type="text" inputMode="numeric" value={fmt(range[1])} onChange={(e) => setRange((x) => [x[0], Math.max(parse(e.target.value), x[0])])} />
            <span aria-hidden="true">€</span>
          </div>
        </div>
      </div>
      <div className="d-pr-pricepop-foot">
        <button
          type="button"
          className="d-pr-textbtn is-small"
          onClick={() => {
            onApply(null);
            onClose();
          }}
        >
          Effacer
        </button>
        <button
          type="button"
          className="d-btn d-btn-primary d-btn-small"
          onClick={() => {
            onApply(range);
            onClose();
          }}
        >
          Voir {count(range)}
        </button>
      </div>
    </div>
  );
}

function MapView({ list, rec, onArea, cat, source, phone, isPicked, onToggle, onOpen, onEnvies, onList, pending, onRequest, onClear }) {
  const c = catOf(cat);
  const [center, setCenter] = useState(phone ? { x: 504.6, y: 755.4 } : { x: 500, y: 550 });
  const [scale, setScale] = useState(phone ? 0.788 : 1);
  const [activeId, setActive] = useState(null);
  const active = activeId ?? list[0]?.id ?? null;
  const [price, setPrice] = useState(null);
  const [priceOpen, setPriceOpen] = useState(false);
  const [zone, setZone] = useState(null);
  const [tall, setTall] = useState(false);
  const boundsRef = useRef(null);

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
    // Toutes les épingles à l'écran : taille de la carte lue sur le dernier rendu (sinon celle du canvas)
    const b = boundsRef.current;
    const w = b ? (b.x1 - b.x0) * scale : phone ? 390 : 670;
    const h = (b ? (b.y1 - b.y0) * scale : phone ? 743 : 940) - (phone ? 360 : 0);
    const fit = Math.min(1, (w - 120) / Math.max(1, maxX - minX), (h - 120) / Math.max(1, maxY - minY));
    const next = Math.max(MAP_MIN_SCALE, fit);
    const y = (minY + maxY) / 2;
    setScale(next);
    // Téléphone : les épingles au-dessus du tiroir de la liste
    setCenter({ x: (minX + maxX) / 2, y: phone ? y + 180 / next : y });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, list, phone, cat]);

  const inPrice =(v, r = price) => !r || (v.price && v.price >= r[0] && v.price <= r[1]);
  const inZone = (v) => {
    if (!zone || source !== "exemple") return true;
    const p = mapPoint(v);
    return p && p.x >= zone.x0 && p.x <= zone.x1 && p.y >= zone.y0 && p.y <= zone.y1;
  };
  const shown = list.filter((v) => inPrice(v) && inZone(v));
  const clusters = source === "exemple" && cat === "lieu" ? sampleClusters() : [];
  const title = `${countLabel(shown.length, cat)} dans cette zone`;
  const priceCount = (r) => {
    const n = list.filter((v) => inPrice(v, r) && inZone(v)).length;
    return `${n} ${n > 1 ? c.many : c.one}`;
  };

  const chips = (
    <div className="d-pr-mapchips">
      <button type="button" aria-haspopup="true" aria-expanded={priceOpen} className={`d-pr-mapchip${price || priceOpen ? " is-on" : ""}`} onClick={() => setPriceOpen((o) => !o)}>
        {price ? `Prix : ${fmt(price[0])} à ${fmt(price[1])} €` : "Prix"}
        <Icon name="chevDown" size={13} sw={2.2} />
      </button>
      {["Capacité", "Style", "Accès"].map((l) => (
        <button key={l} type="button" aria-haspopup="true" aria-expanded={false} className="d-pr-mapchip" onClick={onEnvies}>
          {l}
          <Icon name="chevDown" size={13} sw={2.2} />
        </button>
      ))}
    </div>
  );

  const map = (
    <MapCanvas center={center} scale={scale} onView={onView} label={c.key === "lieu" ? "Carte des lieux" : `Carte des ${c.many}`} className={phone ? "is-phone" : "is-desk"}>
      {({ toScreen, bounds }) => {
        boundsRef.current = bounds;
        const act = shown.find((v) => v.id === active);
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
              return <PricePin key={v.id} v={v} at={toScreen(p)} active={v.id === active} picked={isPicked(v)} small={phone} onClick={() => (v.id === active && phone ? onOpen(v) : setActive(v.id))} />;
            })}
            {!phone && act && mapPoint(act) ? <MapPopup v={act} at={toScreen(mapPoint(act))} /> : null}
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

  if (phone) {
    return (
      <div className="d-pr-mapm">
        {map}
        {chips}
        {priceOpen ? <PriceFilter value={price} count={priceCount} onApply={setPrice} onClose={() => setPriceOpen(false)} /> : null}
        {searchZone}
        <div role="region" aria-label={`${c.tab} dans cette zone`} className={`d-pr-sheet${tall ? " is-tall" : ""}`}>
          <button type="button" className="d-pr-sheet-handle" aria-label={tall ? "Réduire la liste" : "Agrandir la liste"} onClick={() => setTall((t) => !t)}>
            <span />
          </button>
          <div className="d-pr-sheet-head">
            <h2>{title}</h2>
            <span className="d-pr-sheet-links">
              <Link href="/dashboard/prestataires/mes" className="d-pr-pillink">
                <Icon name="heart" size={14} sw={2} />
                Mes prestataires
              </Link>
              <button type="button" className="d-pr-pillink is-plain" onClick={onList}>
                <Icon name="list" size={15} sw={2} />
                Liste
              </button>
            </span>
          </div>
          <div className="d-pr-sheet-list">
            {shown.map((v) => (
              <MiniCard key={v.id} v={v} size={104} picked={isPicked(v)} active={false} onToggle={() => onToggle(v)} onOpen={() => onOpen(v)} />
            ))}
            <MoreButton rec={rec} category={cat} className="is-list" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="d-pr-split">
      <div className="d-pr-split-list">
        <div className="d-pr-split-head">
          <h2>{title}</h2>
          <span>Par pertinence</span>
        </div>
        {shown.map((v) => (
          <MiniCard
            key={v.id}
            v={v}
            size={120}
            picked={isPicked(v)}
            active={v.id === active}
            onToggle={() => onToggle(v)}
            onOpen={() => {
              setActive(v.id);
              onOpen(v);
            }}
            onFocus={() => {
              setActive(v.id);
              const p = mapPoint(v);
              if (p) setCenter(p);
            }}
          />
        ))}
        <MoreButton rec={rec} category={cat} className="is-list" />
        {pending.length ? <CompactBar picks={pending} onRequest={onRequest} /> : null}
      </div>
      <div className="d-pr-split-map">
        {map}
        {chips}
        {priceOpen ? <PriceFilter value={price} count={priceCount} onApply={setPrice} onClose={() => setPriceOpen(false)} /> : null}
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

function MapPopup({ v, at }) {
  const photo = (v.photos || []).find(Boolean);
  return (
    <div role="dialog" aria-label={v.name} className="d-pr-popup" style={{ left: at.left - 24, top: at.top - 24 }}>
      <div role="img" aria-label={`${v.name}, ${v.area}`} className="d-pr-popup-img" style={{ backgroundImage: photo ? `url("${photo}")` : undefined }} />
      <div className="d-pr-popup-body">
        <div className="d-pr-popup-name">
          <strong>{v.name}</strong>
          <span>{v.area}</span>
        </div>
        <div className="d-pr-popup-name">
          <Price v={v} unit=" " />
          {v.priceRange ? <span>{v.priceRange}</span> : null}
        </div>
        <Link href="/dashboard/prestataires/lieux" className="d-pr-arrowlink">
          Voir le lieu
          <Icon name="arrowRight" size={15} sw={2} />
        </Link>
      </div>
    </div>
  );
}

// Carte compacte de la liste à côté de la carte (7d) et du tiroir téléphone (7p)
function MiniCard({ v, size, picked, active, onToggle, onOpen, onFocus }) {
  return (
    <article className={`d-pr-mini${active ? " is-active" : ""}`} onMouseEnter={onFocus}>
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
        {v.best || v.negotiated ? (
          <div className="d-pr-mini-tags">
            {v.best ? <BestMatch small /> : null}
            {v.negotiated ? <Negotiated small /> : null}
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
      <Link href="/dashboard/prestataires/lieux" className="d-pr-bar-ghost is-small">
        Comparer
      </Link>
      <button type="button" className="d-pr-bar-cta is-small" onClick={onRequest}>
        Demander les devis
      </button>
    </div>
  );
}
