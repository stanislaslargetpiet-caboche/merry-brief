"use client";

// Recherche de prestataires : une ligne de résumé (« Bretagne · 25 sept. 2027 · 150 à 200 invités ») et un
// bouton « Filtres » qui ouvre un panneau (plein écran sur téléphone, tiroir à droite sur ordinateur).
// Tout ce qu'on touche dans le panneau est un brouillon : rien ne change avant « Rechercher ».
// Remplace la boîte « Vos critères » (puces) et « Préciser mes envies ». Retours mobile de Stan, octobre 2026.

import { useEffect, useRef, useState } from "react";
import { searchTowns } from "@/lib/places";
import { useDash } from "@/lib/dash/store";
import { REGIONS } from "@/lib/dash/filters";
import { BRIEF_KEYS, BUDGET_RANGES, GUEST_RANGES, VIBES, criteriaList } from "@/lib/dash/criteria";
import { PRICE_BARS } from "@/lib/dash/provenceMap";
import { euros, toDate, withArticle } from "@/lib/dash/format";
import { Icon } from "./icons";
import { ACCESS, CATERER, Choice, CloseBtn, EMPTY_WISHES, Layer, MaxRow, OtherNumber, VENUE, styleCriteria } from "./Prestataires";

export const PRICE_MAX = 30000;
const MONTHS = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
const fmt = (n) => Math.round(n).toLocaleString("fr-FR").replace(/\s/g, " ");


// Nombre de filtres en place (badge du bouton) : critères du couple non retirés, et le prix
export function activeFilters(data, price) {
  return criteriaList(data).filter((c) => !c.off && !c.empty).length + (price ? 1 : 0);
}

// La ligne de résumé : ce qui compte pour la recherche, en court
export function SearchSummary({ price, onOpen, busy }) {
  const data = useDash().data;
  const n = activeFilters(data, price);
  // Le bouton Filtres seul : les critères se lisent et se changent dans le panneau
  return (
    <div className="d-pr-summary">
      <button type="button" className={`d-pr-filters-btn${n ? " is-on" : ""}`} onClick={onOpen} aria-haspopup="dialog">
        <Icon name="list" size={16} sw={2} />
        Filtres
        {n ? <span className="d-pr-filters-badge" aria-label={`${n} filtres actifs`}>{n}</span> : null}
      </button>
      {busy ? <span className="d-pr-summary-busy" aria-live="polite">Recherche…</span> : null}
    </div>
  );
}

// Fourchette de prix : l'histogramme de la carte (7d), en champ du panneau
export function PriceRange({ value, onChange }) {
  const range = value || [0, PRICE_MAX];
  const track = useRef(null);
  const drag = (k) => (e) => {
    e.preventDefault();
    const el = track.current;
    const move = (ev) => {
      const r = el.getBoundingClientRect();
      const pct = Math.min(1, Math.max(0, (ev.clientX - r.left) / r.width));
      const v = Math.round((pct * PRICE_MAX) / 100) * 100;
      const cur = valueRef.current || [0, PRICE_MAX];
      onChange(k === 0 ? [Math.min(v, cur[1] - 500), cur[1]] : [cur[0], Math.max(v, cur[0] + 500)]);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };
  const valueRef = useRef(value);
  valueRef.current = value;
  const lo = (range[0] / PRICE_MAX) * 100;
  const hi = (range[1] / PRICE_MAX) * 100;
  const parse = (s) => Number(String(s).replace(/[^\d]/g, "")) || 0;
  return (
    <div className="d-pr-pricerange">
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
      <div className="d-pr-pricepop-inputs">
        <div>
          <label htmlFor="prix-min">Minimum</label>
          <div className="d-pr-eurbox">
            <input id="prix-min" type="text" inputMode="numeric" value={fmt(range[0])} onChange={(e) => onChange([Math.min(parse(e.target.value), range[1]), range[1]])} />
            <span aria-hidden="true">€</span>
          </div>
        </div>
        <span aria-hidden="true" className="d-pr-pricepop-a">
          à
        </span>
        <div>
          <label htmlFor="prix-max">Maximum</label>
          <div className="d-pr-eurbox">
            <input id="prix-max" type="text" inputMode="numeric" value={fmt(range[1])} onChange={(e) => onChange([range[0], Math.max(parse(e.target.value), range[0])])} />
            <span aria-hidden="true">€</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// « Où » : une seule recherche, qui propose les régions puis les villes (code postal et département,
// pour choisir la bonne parmi les homonymes). Le choix s'affiche en pastille au-dessus du champ.
const fold = (x) => x.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

function PlaceField({ onPickRegion, onPickTown }) {
  const [q, setQ] = useState("");
  const [towns, setTowns] = useState([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const query = q.trim();
  const regions = query.length >= 2 ? REGIONS.filter((r) => fold(r).includes(fold(query))).map((r) => ({ region: r })) : [];

  useEffect(() => {
    if (query.length < 2) {
      setTowns([]);
      return undefined;
    }
    const ctrl = new AbortController();
    const timer = setTimeout(() => {
      searchTowns(query, { signal: ctrl.signal })
        .then((list) => setTowns(list))
        .catch(() => {});
    }, 250);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [query]);

  const items = [...regions, ...towns];
  const pick = (it) => {
    if (it.region) onPickRegion(it.region);
    else onPickTown(it);
    setQ("");
    setOpen(false);
    setTowns([]);
  };
  const onKeyDown = (e) => {
    if (!open || !items.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (i + 1) % items.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i - 1 + items.length) % items.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      pick(items[Math.min(active, items.length - 1)]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };
  const showList = open && items.length > 0;

  return (
    <div className="d-pr-townfield">
      <div className="d-pr-townsearch">
        <Icon name="search" size={16} sw={2} />
        <input
          className="d-input"
          value={q}
          placeholder="Une région ou une ville"
          aria-label="Où : une région ou une ville"
          role="combobox"
          aria-expanded={showList}
          aria-controls="filtres-lieux"
          aria-autocomplete="list"
          autoComplete="off"
          onChange={(e) => {
            setQ(e.target.value);
            setActive(0);
            setOpen(true);
          }}
          onKeyDown={onKeyDown}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
        />
      </div>
      {showList ? (
        <ul className="d-pr-townlist" id="filtres-lieux" role="listbox">
          {items.map((it, i) => (
            <li
              key={it.region || `${it.name}|${it.sub}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => {
                e.preventDefault();
                pick(it);
              }}
              onMouseEnter={() => setActive(i)}
            >
              <Icon name={it.region ? "map" : "pin"} size={16} sw={1.8} />
              <span>
                <strong>{it.region || it.name}</strong>
                <small>{it.region ? "Région" : it.sub}</small>
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function Section({ title, children, ruled = true }) {
  return (
    <section className={`d-pr-fsect${ruled ? " is-ruled" : ""}`}>
      <h3>{title}</h3>
      {children}
    </section>
  );
}

// Brouillon de départ : les critères enregistrés (envies, brief, mariage) et le prix en cours
function startDraft(data, price) {
  const w = { ...EMPTY_WISHES, off: [], ...(data.wishes?.wishes || {}) };
  const off = new Set(w.off || []);
  // Un lieu écrit à la main dans le brief (« Luberon ») reste une option du panneau
  const place = !w.regions.length && !w.city?.name && data.wedding.region && !REGIONS.includes(data.wedding.region) ? data.wedding.region : null;
  return {
    w,
    place,
    placeOn: !!place && !off.has("lieu"),
    regions: off.has("lieu") ? [] : w.regions.length ? w.regions : REGIONS.includes(data.wedding.region) ? [data.wedding.region] : [],
    city: off.has("lieu") ? "" : w.city?.name || "",
    cityAt: off.has("lieu") || w.city?.lat == null ? null : { lat: w.city.lat, lng: w.city.lng },
    cityMax: w.city?.max || 60,
    flexible: !!w.when,
    when: w.when || { months: [], years: [] },
    date: off.has("date") ? "" : data.wedding.wedding_date || "",
    guests: off.has("invites") ? null : data.brief?.guests || null,
    budget: off.has("budget") ? null : data.brief?.budget || null,
    vibes: off.has("style") ? [] : (data.brief?.vibes || []).filter((x) => !/sait pas/i.test(x)),
    price,
  };
}

export function FiltersPanel({ category, price, onClose, onApply }) {
  const dash = useDash();
  const data = dash.data;
  const lieu = category === "lieu";
  const [d, setD] = useState(() => startDraft(data, price));
  const set = (patch) => setD((x) => ({ ...x, ...(typeof patch === "function" ? patch(x) : patch) }));
  const setW = (patch) => set((x) => ({ w: { ...x.w, ...patch } }));
  const toggle = (xs, v) => (xs.includes(v) ? xs.filter((y) => y !== v) : [...xs, v]);
  const day = toDate(data.wedding.wedding_date);
  const firstYear = day ? day.getFullYear() : new Date().getFullYear() + 1;
  const criteria = styleCriteria(d.w.style).filter((c) => !(d.w.removed || []).includes(c));
  const vibesAll = [...VIBES, ...d.vibes.filter((x) => !VIBES.includes(x))];

  // Tout effacer : chaque critère retiré de la recherche (le brief garde ses réponses)
  const clearAll = () =>
    setD((x) => ({
      ...x,
      w: { ...EMPTY_WISHES, off: BRIEF_KEYS, removed: [...(x.w.removed || []), ...(x.w.criteria || [])], criteria: [], when: null },
      placeOn: false,
      regions: [],
      city: "",
      cityAt: null,
      flexible: false,
      when: { months: [], years: [] },
      date: "",
      guests: null,
      budget: null,
      vibes: [],
      price: null,
    }));

  async function apply() {
    if (dash.mode === "live" && !data.picksSetup) {
      dash.setToast({ kind: "error", text: "Vos critères ne peuvent pas encore être enregistrés : collez supabase/prestataires.sql dans Supabase (SQL Editor)." });
      return;
    }
    const placeSet = d.regions.length || d.city.trim() || d.placeOn;
    const dateSet = d.flexible ? d.when.months.length || d.when.years.length : !!d.date;
    const off = BRIEF_KEYS.filter((k) => ({ lieu: !placeSet, date: !dateSet, invites: !d.guests, budget: !d.budget, style: !d.vibes.length })[k]);
    const wishes = {
      ...d.w,
      off,
      regions: d.regions,
      city: d.city.trim() && !d.regions.length ? { name: d.city.trim(), max: d.cityMax, ...(d.cityAt ? d.cityAt : {}) } : { name: "", max: null },
      when: d.flexible && dateSet ? d.when : null,
      criteria,
    };
    onApply(d.price);
    onClose();
    await dash.saveWishes({ wishes });
    // Réponses du brief et du mariage, seulement si elles changent
    const b = data.brief || {};
    const brief = {};
    if (d.guests && d.guests !== b.guests) brief.guests = d.guests;
    if (d.budget && d.budget !== b.budget) brief.budget = d.budget;
    if (d.vibes.length && d.vibes.join("|") !== (b.vibes || []).join("|")) brief.vibes = d.vibes;
    if (Object.keys(brief).length && dash.saveBrief) dash.saveBrief(brief);
    const wedding = {};
    if (!d.flexible && d.date && d.date !== data.wedding.wedding_date) wedding.wedding_date = d.date;
    const region = d.regions.length ? d.regions.join(", ") : d.city.trim() || (d.placeOn ? d.place : null);
    if (region && region !== data.wedding.region) wedding.region = region;
    if (Object.keys(wedding).length) dash.updateWedding(wedding);
  }

  return (
    <Layer kind="drawer" labelledBy="filtres-titre" onClose={onClose}>
      <div className="d-pr-panel-head">
        <h2 id="filtres-titre">Filtres</h2>
        <CloseBtn onClose={onClose} />
      </div>
      <div className="d-pr-panel-body d-pr-filters">
        <Section title="Où" ruled={false}>
          {d.placeOn || d.regions.length || d.city.trim() ? (
            <div className="d-pr-optrow">
              {d.placeOn ? (
                <Choice on onClick={() => set({ placeOn: false })}>
                  {d.place}
                </Choice>
              ) : null}
              {d.regions.map((r) => (
                <Choice key={r} on onClick={() => set((x) => ({ regions: x.regions.filter((y) => y !== r) }))}>
                  {r}
                </Choice>
              ))}
              {d.city.trim() ? (
                <Choice on onClick={() => set({ city: "", cityAt: null })}>
                  Près {withArticle(d.city.trim(), "de")}
                </Choice>
              ) : null}
            </div>
          ) : null}
          <PlaceField
            onPickRegion={(r) => set((x) => ({ regions: x.regions.includes(r) ? x.regions : [...x.regions, r], city: "", cityAt: null, placeOn: false }))}
            onPickTown={(t) => set({ city: t.name, cityAt: { lat: t.lat, lng: t.lon }, regions: [], placeOn: false })}
          />
          {d.city.trim() ? <MaxRow value={d.cityMax} onChange={(cityMax) => set({ cityMax: cityMax || 60 })} label="Temps de route maximum" /> : null}
        </Section>

        <Section title="Quand">
          <div role="radiogroup" aria-label="Date" className="d-pr-optrow">
            <Choice role="radio" small on={!d.flexible} onClick={() => set({ flexible: false })}>
              Date précise
            </Choice>
            <Choice role="radio" small on={d.flexible} onClick={() => set((x) => ({ flexible: true, when: x.when.months.length || x.when.years.length ? x.when : { months: day ? [day.getMonth()] : [], years: [firstYear] } }))}>
              Dates flexibles
            </Choice>
          </div>
          {d.flexible ? (
            <>
              <div className="d-pr-optrow" role="group" aria-label="Mois">
                {MONTHS.map((m, k) => (
                  <Choice key={m} small on={d.when.months.includes(k)} onClick={() => set((x) => ({ when: { ...x.when, months: toggle(x.when.months, k) } }))}>
                    {m}
                  </Choice>
                ))}
              </div>
              <div className="d-pr-optrow" role="group" aria-label="Année">
                {[firstYear, firstYear + 1, firstYear + 2].map((y) => (
                  <Choice key={y} small on={d.when.years.includes(y)} onClick={() => set((x) => ({ when: { ...x.when, years: toggle(x.when.years, y) } }))}>
                    {y}
                  </Choice>
                ))}
              </div>
            </>
          ) : (
            <input className="d-input d-pr-dateinput" type="date" aria-label="Date du mariage" value={d.date} onChange={(e) => set({ date: e.target.value })} />
          )}
        </Section>

        <Section title="Invités">
          <div role="radiogroup" aria-label="Nombre d'invités" className="d-pr-optrow">
            {GUEST_RANGES.map((r) => (
              <Choice key={r.code} role="radio" small on={d.guests === r.code} onClick={() => set((x) => ({ guests: x.guests === r.code ? null : r.code }))}>
                {r.label}
              </Choice>
            ))}
          </div>
        </Section>

        <Section title="Budget">
          <div role="radiogroup" aria-label="Budget" className="d-pr-optrow">
            {BUDGET_RANGES.map((r) => (
              <Choice key={r.code} role="radio" small on={d.budget === r.code} onClick={() => set((x) => ({ budget: x.budget === r.code ? null : r.code }))}>
                {r.label}
              </Choice>
            ))}
          </div>
        </Section>

        <Section title={lieu ? "Fourchette de prix, location du lieu" : "Fourchette de prix"}>
          <PriceRange value={d.price} onChange={(price) => set({ price })} />
        </Section>

        <Section title="Style, trois au plus">
          <div className="d-pr-optrow">
            {vibesAll.map((x) => (
              <Choice key={x} small on={d.vibes.includes(x)} onClick={() => set((y) => ({ vibes: y.vibes.includes(x) ? y.vibes.filter((z) => z !== x) : [...y.vibes, x].slice(-3) }))}>
                {x}
              </Choice>
            ))}
          </div>
        </Section>

        {lieu ? (
          <>
            <Section title="Capacité">
              <span className="d-pr-wlabel">Places assises, au moins</span>
              <div role="radiogroup" aria-label="Places assises, au moins" className="d-pr-optrow">
                {[80, 120, 160].map((n) => (
                  <Choice key={n} role="radio" small on={d.w.seats === n} onClick={() => setW({ seats: d.w.seats === n ? null : n })}>
                    {n}
                  </Choice>
                ))}
                <OtherNumber value={d.w.seats} presets={[80, 120, 160]} onChange={(seats) => setW({ seats })} label="Autre nombre de places" />
              </div>
              <span className="d-pr-wlabel">Couchages sur place, au moins</span>
              <div role="radiogroup" aria-label="Couchages sur place, au moins" className="d-pr-optrow">
                {[10, 20, 30].map((n) => (
                  <Choice key={n} role="radio" small on={d.w.beds === n} onClick={() => setW({ beds: d.w.beds === n ? null : n })}>
                    {n}
                  </Choice>
                ))}
                <OtherNumber value={d.w.beds} presets={[10, 20, 30]} onChange={(beds) => setW({ beds })} label="Autre nombre de couchages" />
              </div>
            </Section>

            <Section title="Accès">
              <div className="d-pr-optrow">
                <Choice on={d.w.airport.on} onClick={() => setW({ airport: { ...d.w.airport, on: !d.w.airport.on } })}>
                  Près d’un aéroport
                </Choice>
                <Choice on={d.w.station.on} onClick={() => setW({ station: { ...d.w.station, on: !d.w.station.on } })}>
                  Près d’une gare TGV
                </Choice>
                {ACCESS.map((a) => (
                  <Choice key={a.key} on={d.w.access.includes(a.key)} onClick={() => setW({ access: toggle(d.w.access, a.key) })}>
                    {a.label}
                  </Choice>
                ))}
              </div>
              {d.w.airport.on ? <MaxRow label="Temps de trajet maximum depuis l'aéroport" value={d.w.airport.max} onChange={(max) => setW({ airport: { ...d.w.airport, max } })} /> : null}
              {d.w.station.on ? <MaxRow label="Temps de trajet maximum depuis la gare" value={d.w.station.max} onChange={(max) => setW({ station: { ...d.w.station, max } })} /> : null}
            </Section>

            <Section title="Le lieu">
              <div className="d-pr-optrow">
                {VENUE.map((a) => (
                  <Choice key={a.key} on={d.w.venue.includes(a.key)} onClick={() => setW({ venue: toggle(d.w.venue, a.key) })}>
                    {a.label}
                  </Choice>
                ))}
              </div>
              <span className="d-pr-wlabel">Traiteur</span>
              <div role="radiogroup" aria-label="Traiteur" className="d-pr-optrow">
                {CATERER.map((c) => (
                  <Choice key={c.key} role="radio" small on={d.w.caterer === c.key} onClick={() => setW({ caterer: d.w.caterer === c.key ? null : c.key })}>
                    {c.label}
                  </Choice>
                ))}
              </div>
            </Section>

            <Section title="Votre lieu idéal">
              <textarea rows={3} className="d-textarea d-pr-field" aria-label="Décrivez votre lieu idéal en quelques mots" placeholder="Pierre apparente, dîner sous les arbres…" value={d.w.style || ""} onChange={(e) => setW({ style: e.target.value })} />
              {criteria.length ? (
                <div className="d-pr-optrow">
                  {criteria.map((c) => (
                    <span key={c} className="d-pr-crit">
                      {c}
                      <button type="button" aria-label={`Retirer ${c}`} onClick={() => setW({ removed: [...(d.w.removed || []), c] })}>
                        <Icon name="x" size={11} sw={2.6} stroke="var(--d-ok-ink)" />
                      </button>
                    </span>
                  ))}
                </div>
              ) : null}
            </Section>
          </>
        ) : null}
      </div>
      <div className="d-pr-panel-foot is-split">
        <button type="button" className="d-pr-textbtn" onClick={clearAll}>
          Tout effacer
        </button>
        <button type="button" className="d-btn d-btn-primary d-pr-big" onClick={apply}>
          Rechercher
        </button>
      </div>
    </Layer>
  );
}

// Prix inconnu : gardé (« à confirmer »), comme pour les autres critères
export const inPrice = (v, r) => !r || !v.price || (v.price >= r[0] && v.price <= r[1]);
