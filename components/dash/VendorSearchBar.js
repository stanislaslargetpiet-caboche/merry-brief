"use client";

// Barre de recherche « Ajouter un prestataire » (Mes prestataires et Trouver des prestataires) : un
// couple qui a déjà trouvé son traiteur ou son photographe ailleurs le cherche d'abord dans le
// catalogue Merry ; s'il n'y est pas, Merry cherche sur Google et propose une fiche déjà remplie ;
// sinon, la saisie à la main. La liste ne montre que des résultats ; le formulaire s'ouvre dans une
// fenêtre à part (il ne disparaît plus au moindre clic à côté), et la fiche s'ouvre une fois ajouté.

import { useEffect, useRef, useState } from "react";
import { useDash } from "@/lib/dash/store";
import { supabase } from "@/lib/supabase";
import { CATALOG_CATEGORIES, CATEGORIES, catOf, cityPostalCode, searchCatalogByName, searchCities, searchGoogleVendor } from "@/lib/dash/catalog";
import { Icon } from "./icons";
import { CloseBtn, DevisDialog, FichePanel, Layer, Thumb, usePicks } from "./Prestataires";
import { useCreateFiche } from "./CreateFiche";
import { Btn, BusyDots } from "./ui";

const IDLE = { q: "", loading: false, catalog: [], google: [] };

async function tokenOf(dash) {
  if (dash.mode !== "live" || !supabase) return null;
  return (await supabase.auth.getSession()).data?.session?.access_token || null;
}

export default function VendorSearchBar() {
  const dash = useDash();
  const { add, isPicked } = usePicks();
  const boxRef = useRef(null);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [found, setFound] = useState(IDLE);
  const [busyId, setBusyId] = useState(null);
  const [dialog, setDialog] = useState(null); // valeurs de départ du formulaire
  const [shown, setShown] = useState(null); // { v, notice } : fiche ouverte après l'ajout
  const [devis, setDevis] = useState(null);
  const text = q.trim();
  const searched = text.length >= 2;

  useEffect(() => {
    function onDocClick(e) {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  // Une seule recherche par pause de frappe : le catalogue d'abord, Google seulement s'il ne donne
  // rien. Les résultats précédents restent affichés (atténués) jusqu'aux suivants : la liste ne
  // clignote plus et ne change de taille qu'une fois par recherche.
  useEffect(() => {
    if (!searched) {
      setFound(IDLE);
      return undefined;
    }
    let live = true;
    setFound((f) => ({ ...f, loading: true }));
    const t = setTimeout(async () => {
      const catalog = await searchCatalogByName(dash.mode, text);
      let google = [];
      if (live && !catalog.length && text.length >= 3) google = await searchGoogleVendor(dash.mode, text, await tokenOf(dash));
      if (live) setFound({ q: text, loading: false, catalog, google });
    }, 300);
    return () => {
      live = false;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, dash.mode, searched]);

  function reset() {
    setQ("");
    setOpen(false);
    setFound(IDLE);
  }

  async function pickCatalog(v) {
    if (isPicked(v)) {
      reset();
      setShown({ v, notice: "Déjà dans vos prestataires." });
      return;
    }
    setBusyId(v.id);
    const p = await add(v);
    setBusyId(null);
    if (!p) return;
    reset();
    setShown({ v, notice: "Ajouté à vos prestataires." });
  }

  function openForm(initial) {
    setOpen(false);
    setDialog(initial);
  }

  function onCreated(v) {
    setDialog(null);
    reset();
    setShown({ v, notice: v.existed ? "Déjà dans vos prestataires." : "Ajouté à vos prestataires." });
  }

  const settled = !found.loading && found.q === text;
  const stale = found.loading || found.q !== text;
  const empty = settled && !found.catalog.length && !found.google.length;
  const showDrop = open && searched;

  return (
    <div className="d-pr-search" ref={boxRef}>
      <label className="d-pr-search-field">
        <Icon name="search" size={16} sw={2} />
        <input
          type="search"
          className="d-pr-search-input"
          placeholder="Ajouter un prestataire que vous avez déjà…"
          value={q}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
        />
        {found.loading ? <BusyDots label="Recherche" /> : null}
      </label>
      {showDrop ? (
        <div className="d-pr-search-drop">
          <div className={`d-pr-search-results${stale ? " is-stale" : ""}`}>
            {found.catalog.length ? (
              <>
                <span className="d-pr-search-sec">Dans le catalogue Merry</span>
                <ul className="d-pr-to">
                  {found.catalog.map((v) => {
                    const mine = isPicked(v);
                    return (
                      <li key={v.id}>
                        <Thumb v={v} size={44} />
                        <div className="d-pr-to-main">
                          <span className="d-pr-to-name">{v.name}</span>
                          <span className="d-pr-to-meta">
                            {catOf(v.category).label}
                            {v.area ? ` · ${v.area}` : ""}
                          </span>
                        </div>
                        <Btn kind="ghost" small disabled={!!busyId} onClick={() => pickCatalog(v)}>
                          {busyId === v.id ? "Ajout…" : mine ? "Voir la fiche" : "Ajouter"}
                        </Btn>
                      </li>
                    );
                  })}
                </ul>
              </>
            ) : null}
            {found.google.length ? (
              <>
                <span className="d-pr-search-sec">Pas encore sur Merry, trouvé sur Google</span>
                <ul className="d-pr-to">
                  {found.google.map((g, i) => (
                    <li key={`${g.name}-${i}`}>
                      <Thumb v={{ name: g.name }} size={44} />
                      <div className="d-pr-to-main">
                        <span className="d-pr-to-name">{g.name}</span>
                        <span className="d-pr-to-meta">{g.address || g.city || ""}</span>
                      </div>
                      <Btn kind="ghost" small onClick={() => openForm(fromGoogle(g))}>
                        C'est lui
                      </Btn>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
            {empty ? <span className="d-small-muted">Aucun prestataire trouvé pour « {text} »{dash.mode === "live" && text.length >= 3 ? ", ni sur Merry ni sur Google" : " dans le catalogue Merry"}.</span> : null}
            {!settled && !found.catalog.length && !found.google.length ? <span className="d-small-muted">Recherche de « {text} »…</span> : null}
          </div>
          <button type="button" className="d-pr-search-manual" onClick={() => openForm({ ...EMPTY_FORM, name: text })}>
            <Icon name="plus" size={15} sw={2.2} />
            {found.catalog.length || found.google.length ? "Ce n'est pas lui ? " : ""}Ajouter « {text} » à la main
          </button>
        </div>
      ) : null}
      {dialog ? <AddVendorDialog initial={dialog} onClose={() => setDialog(null)} onCreated={onCreated} /> : null}
      {shown ? (
        <FichePanel
          v={shown.v}
          notice={shown.notice}
          index={0}
          total={1}
          onClose={() => setShown(null)}
          onRequest={async (v) => {
            const p = await add(v);
            setShown(null);
            if (p) setDevis([p]);
          }}
        />
      ) : null}
      {devis ? <DevisDialog picks={devis} onClose={() => setDevis(null)} onSent={() => setDevis(null)} /> : null}
    </div>
  );
}

const EMPTY_FORM = { name: "", category: "", area: "", phone: "", website: "", lat: null, lng: null, match: null };

function fromGoogle(g, base = EMPTY_FORM) {
  return {
    ...base,
    name: g.name || base.name,
    category: base.category || g.category || "",
    area: g.city || base.area,
    phone: g.phone || "",
    website: g.website || "",
    lat: g.lat ?? null,
    lng: g.lng ?? null,
    match: g,
  };
}

// Fenêtre « Ajouter un prestataire » : nom, catégorie, ville. Si un résultat Google a été choisi, son
// téléphone, son site et sa position sont repris ; sinon on peut le chercher sur Google d'ici.
function AddVendorDialog({ initial, onClose, onCreated }) {
  const dash = useDash();
  const { busy, createNow } = useCreateFiche();
  const [form, setForm] = useState(initial);
  const [more, setMore] = useState(!!(initial.phone || initial.website));
  const [refine, setRefine] = useState({ searching: false, results: [], attempted: false });
  const [cities, setCities] = useState({ open: false, results: [] });
  const pickedAreaRef = useRef(initial.area || null);
  const area = form.area.trim();
  const name = form.name.trim();
  const ready = name && form.category;

  // Suggestions de villes pendant la frappe (une aide, le champ reste libre), jamais juste après en
  // avoir choisi une : sinon la liste se rouvre aussitôt fermée.
  useEffect(() => {
    if (area.length < 2 || area === pickedAreaRef.current) {
      setCities((c) => (c.open ? { open: false, results: [] } : c));
      return undefined;
    }
    let live = true;
    const t = setTimeout(async () => {
      const r = await searchCities(dash.mode, area, await tokenOf(dash));
      if (live) setCities({ open: r.length > 0, results: r });
    }, 250);
    return () => {
      live = false;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [area, dash.mode]);

  // Un changement de nom ou de ville détache le résultat Google choisi : ce n'est plus forcément lui.
  function edit(patch, detach = false) {
    setForm((f) => ({ ...f, ...patch, ...(detach && f.match ? { match: null, lat: null, lng: null } : {}) }));
    if (detach) setRefine({ searching: false, results: [], attempted: false });
  }

  async function pickCity(c) {
    pickedAreaRef.current = c.label;
    edit({ area: c.label }, true);
    setCities({ open: false, results: [] });
    if (!c.placeId) return;
    const postal = await cityPostalCode(dash.mode, c.placeId, await tokenOf(dash));
    if (postal) {
      pickedAreaRef.current = `${c.label} ${postal}`;
      setForm((f) => (f.area === c.label ? { ...f, area: `${c.label} ${postal}` } : f));
    }
  }

  async function runRefine() {
    if (!name || refine.searching) return;
    setRefine({ searching: true, results: [], attempted: false });
    const r = await searchGoogleVendor(dash.mode, area ? `${name} ${area}` : name, await tokenOf(dash));
    setRefine({ searching: false, results: r, attempted: true });
  }

  function applyGoogle(g) {
    if (g.city) pickedAreaRef.current = g.city;
    setForm((f) => fromGoogle(g, f));
    if (g.phone || g.website) setMore(true);
    setRefine({ searching: false, results: [], attempted: false });
  }

  async function submit(e) {
    e.preventDefault();
    if (!ready || busy) return;
    const v = await createNow(name, form.category, area, {
      quiet: true,
      fallback: { phone: form.phone.trim(), website: form.website.trim(), lat: form.lat, lng: form.lng },
    });
    if (v) onCreated(v);
  }

  return (
    <Layer kind="dialog" labelledBy="ajout-titre" onClose={() => !busy && onClose()}>
      <form className="d-pr-addvendor" onSubmit={submit}>
        <div className="d-pr-panel-head is-dialog">
          <h2 id="ajout-titre">Ajouter un prestataire</h2>
          <CloseBtn onClose={() => !busy && onClose()} />
        </div>
        <div className="d-pr-panel-body">
          {form.match ? (
            <div className="d-create-card">
              <div className="d-create-card-head">
                <Thumb v={{ name: form.match.name }} size={44} />
                <div>
                  <span className="d-create-card-name">{form.match.name}</span>
                  <span className="d-create-card-addr">{form.match.address || form.match.city || ""}</span>
                </div>
              </div>
              <button type="button" className="d-pr-arrowlink is-13" onClick={() => edit({ phone: "", website: "" }, true)}>
                Ce n'est pas lui
              </button>
            </div>
          ) : null}
          <div className="d-form-grid">
            <label className="d-field is-full">
              <span className="d-field-label">Nom</span>
              <input className="d-input" value={form.name} onChange={(e) => edit({ name: e.target.value })} placeholder="Maison Lemoine" maxLength={120} autoFocus={!form.name} required />
            </label>
            <label className="d-field">
              <span className="d-field-label">Catégorie</span>
              <select className="d-input" value={form.category} onChange={(e) => edit({ category: e.target.value })} autoFocus={!!form.name && !form.category} required>
                <option value="" disabled>
                  Choisir
                </option>
                {CATEGORIES.map((c) => (
                  <optgroup key={c.key} label={c.group}>
                    {CATALOG_CATEGORIES.filter((x) => x.group === c.key).map((x) => (
                      <option key={x.key} value={x.key}>
                        {x.label}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </label>
            <div className="d-field">
              <span className="d-field-label">Ville ou région · facultatif</span>
              <div className="d-pr-townfield is-float">
                <div className="d-pr-townsearch">
                  <Icon name="search" size={16} sw={2} />
                  <input
                    className="d-input"
                    value={form.area}
                    placeholder="Luberon"
                    maxLength={80}
                    autoComplete="off"
                    aria-label="Ville ou région"
                    onChange={(e) => {
                      pickedAreaRef.current = null;
                      edit({ area: e.target.value }, true);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Escape" && cities.open) {
                        e.stopPropagation();
                        setCities((c) => ({ ...c, open: false }));
                      }
                    }}
                    onFocus={() => setCities((c) => ({ ...c, open: c.results.length > 0 && area !== pickedAreaRef.current }))}
                    onBlur={() => setTimeout(() => setCities((c) => ({ ...c, open: false })), 150)}
                  />
                </div>
                {cities.open ? (
                  <ul className="d-pr-townlist is-float">
                    {cities.results.map((c) => (
                      <li
                        key={c.placeId || c.label}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          pickCity(c);
                        }}
                      >
                        <Icon name="map" size={16} sw={1.8} />
                        <span>
                          <strong>{c.label}</strong>
                          {c.secondary ? <small>{c.secondary}</small> : null}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </div>
            {more ? (
              <>
                <label className="d-field">
                  <span className="d-field-label">Téléphone · facultatif</span>
                  <input className="d-input" type="tel" value={form.phone} onChange={(e) => edit({ phone: e.target.value })} maxLength={40} autoComplete="off" />
                </label>
                <label className="d-field">
                  <span className="d-field-label">Site internet · facultatif</span>
                  <input className="d-input" value={form.website} onChange={(e) => edit({ website: e.target.value })} maxLength={300} placeholder="maison-lemoine.fr" autoComplete="off" />
                </label>
              </>
            ) : (
              <div className="d-field is-full">
                <button type="button" className="d-pr-arrowlink is-13" onClick={() => setMore(true)}>
                  Ajouter son téléphone ou son site
                </button>
              </div>
            )}
          </div>
          {!form.match && dash.mode === "live" ? (
            <div className="d-pr-addvendor-google">
              <Btn kind="ghost" small onClick={runRefine} disabled={!name || refine.searching}>
                Retrouver « {name || "ce nom"} »{area ? ` à ${area}` : ""} sur Google
              </Btn>
              {refine.searching ? <BusyDots label="Recherche sur Google" /> : null}
              {!refine.searching && refine.results.length ? (
                <ul className="d-pr-to">
                  {refine.results.map((g, i) => (
                    <li key={`${g.name}-${i}`}>
                      <Thumb v={{ name: g.name }} size={44} />
                      <div className="d-pr-to-main">
                        <span className="d-pr-to-name">{g.name}</span>
                        <span className="d-pr-to-meta">{g.address || g.city || ""}</span>
                      </div>
                      <Btn kind="ghost" small onClick={() => applyGoogle(g)}>
                        C'est lui
                      </Btn>
                    </li>
                  ))}
                </ul>
              ) : null}
              {!refine.searching && refine.attempted && !refine.results.length ? (
                <span className="d-small-muted">Rien trouvé sur Google pour « {name} »{area ? ` à ${area}` : ""}. Vous pouvez quand même l'ajouter.</span>
              ) : null}
            </div>
          ) : null}
        </div>
        <div className="d-pr-panel-foot is-devis">
          <Btn kind="ghost" onClick={onClose} disabled={busy}>
            Annuler
          </Btn>
          <Btn type="submit" disabled={busy || !ready}>
            {busy ? "Ajout en cours…" : "Ajouter à mes prestataires"}
          </Btn>
        </div>
      </form>
    </Layer>
  );
}
