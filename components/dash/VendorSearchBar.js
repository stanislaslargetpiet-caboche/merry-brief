"use client";

// Barre de recherche « Ajouter un prestataire » (Mes prestataires et Trouver des prestataires) : un
// couple qui a déjà trouvé son traiteur ou son photographe ailleurs le cherche d'abord dans le
// catalogue Merry, pour récupérer sa fiche ; s'il n'y est pas, Merry cherche sur Google et propose une
// fiche déjà remplie (nom, adresse, téléphone, site) ; en dernier recours, la saisie à la main.

import { useEffect, useRef, useState } from "react";
import { useDash } from "@/lib/dash/store";
import { supabase } from "@/lib/supabase";
import { CATALOG_CATEGORIES, CATEGORIES, catFromCatalog, catOf, customVendorId, searchCatalogByName, searchCities, searchGoogleVendor } from "@/lib/dash/catalog";
import { Icon } from "./icons";
import { Thumb, usePicks } from "./Prestataires";
import { Btn, BusyDots } from "./ui";

const EMPTY_FORM = { name: "", category: "", area: "", phone: "", website: "", lat: null, lng: null };

export default function VendorSearchBar() {
  const dash = useDash();
  const { add } = usePicks();
  const boxRef = useRef(null);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [google, setGoogle] = useState({ searching: false, done: false, results: [] });
  const [manual, setManual] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [refine, setRefine] = useState({ searching: false, results: [], attempted: false });
  const [cities, setCities] = useState({ open: false, searching: false, results: [] });
  const [busy, setBusy] = useState(false);
  const searched = q.trim().length >= 2;
  const noMatch = searched && !searching && !results.length;

  useEffect(() => {
    function onDocClick(e) {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  useEffect(() => {
    if (!searched) {
      setResults([]);
      setSearching(false);
      return undefined;
    }
    let live = true;
    setSearching(true);
    setGoogle({ searching: false, done: false, results: [] });
    const t = setTimeout(async () => {
      const r = await searchCatalogByName(dash.mode, q);
      if (live) {
        setResults(r);
        setSearching(false);
      }
    }, 250);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [q, dash.mode, searched]);

  useEffect(() => {
    if (!noMatch || google.searching || google.done) return undefined;
    let live = true;
    setGoogle((g) => ({ ...g, searching: true }));
    (async () => {
      const token = dash.mode === "live" && supabase ? (await supabase.auth.getSession()).data?.session?.access_token : null;
      const r = await searchGoogleVendor(dash.mode, q, token);
      if (live) setGoogle({ searching: false, done: true, results: r });
    })();
    return () => {
      live = false;
    };
  }, [noMatch, google.searching, google.done, dash.mode, q]);

  const refineArea = manual ? form.area.trim() : "";

  useEffect(() => {
    if (!manual || refineArea.length < 2 || !form.name.trim()) {
      setRefine({ searching: false, results: [], attempted: false });
      return undefined;
    }
    let live = true;
    setRefine((r) => ({ ...r, searching: true, attempted: false }));
    const t = setTimeout(async () => {
      const token = dash.mode === "live" && supabase ? (await supabase.auth.getSession()).data?.session?.access_token : null;
      const r = await searchGoogleVendor(dash.mode, `${form.name.trim()} ${refineArea}`, token);
      if (live) setRefine({ searching: false, results: r, attempted: true });
    }, 400);
    return () => {
      live = false;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manual, refineArea, dash.mode]);

  // Suggestions de villes pendant la saisie (aide, pas une liste fermée) : on ne les propose que
  // si le prestataire n'est pas déjà raccroché à un résultat Google (pickGoogle a déjà sa ville).
  useEffect(() => {
    if (!manual || refineArea.length < 2) {
      setCities({ open: false, searching: false, results: [] });
      return undefined;
    }
    let live = true;
    setCities((c) => ({ ...c, searching: true }));
    const t = setTimeout(async () => {
      const token = dash.mode === "live" && supabase ? (await supabase.auth.getSession()).data?.session?.access_token : null;
      const r = await searchCities(dash.mode, refineArea, token);
      if (live) setCities({ open: true, searching: false, results: r });
    }, 250);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [manual, refineArea, dash.mode]);

  function reset() {
    setQ("");
    setOpen(false);
    setManual(false);
    setForm(EMPTY_FORM);
    setResults([]);
    setGoogle({ searching: false, done: false, results: [] });
    setRefine({ searching: false, results: [], attempted: false });
    setCities({ open: false, searching: false, results: [] });
  }

  async function pick(v) {
    setBusy(true);
    await add(v);
    setBusy(false);
    dash.setToast({ kind: "ok", text: `${v.name} est ajouté à vos prestataires.` });
    reset();
  }

  function startManual() {
    setForm((f) => ({ ...f, name: q.trim() }));
    setManual(true);
  }

  function pickGoogle(g) {
    setForm({ name: g.name, category: "", area: g.city || "", phone: g.phone || "", website: g.website || "", lat: g.lat, lng: g.lng });
    setManual(true);
  }

  function applyRefine(g) {
    setForm((f) => ({ ...f, name: g.name, area: g.city || f.area, phone: g.phone || f.phone, website: g.website || f.website, lat: g.lat, lng: g.lng }));
    setRefine({ searching: false, results: [] });
  }

  async function submitManual(e) {
    e.preventDefault();
    const name = form.name.trim();
    if (!name || !form.category || busy) return;
    const area = form.area.trim();
    setBusy(true);
    try {
      let v;
      if (dash.mode === "live" && supabase) {
        const { data: newId, error } = await supabase.rpc("merry_add_vendor_manual", {
          w: dash.data.wedding.id,
          vname: name,
          category: form.category,
          city: area || null,
          phone: form.phone || null,
          website: form.website || null,
          vlat: form.lat,
          vlng: form.lng,
        });
        if (error) throw error;
        v = { id: `catalog:${newId}`, category: catFromCatalog(form.category), name, area: area || undefined };
      } else {
        v = { id: customVendorId(), category: catFromCatalog(form.category), name, area: area || undefined };
      }
      await add(v);
      dash.setToast({ kind: "ok", text: `${name} est ajouté au catalogue Merry et à vos prestataires.` });
      reset();
    } catch (e) {
      console.error("[merry] merry_add_vendor_manual", e);
      dash.setToast({ kind: "error", text: `Ce prestataire n'a pas pu être créé${e?.message ? ` : ${e.message}` : " : collez supabase/prestataires-ajout-manuel-google.sql dans Supabase (SQL Editor)."}` });
    } finally {
      setBusy(false);
    }
  }

  const showDrop = open && (searched || manual);

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
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
            setManual(false);
          }}
        />
      </label>
      {showDrop ? (
        <div className="d-pr-search-drop">
          {!manual ? (
            <>
              {searching ? <BusyDots label="Recherche" /> : null}
              {!searching && results.length ? (
                <ul className="d-pr-to">
                  {results.map((v) => (
                    <li key={v.id}>
                      <Thumb v={v} size={44} />
                      <div className="d-pr-to-main">
                        <span className="d-pr-to-name">{v.name}</span>
                        <span className="d-pr-to-meta">
                          {catOf(v.category).label}
                          {v.area ? ` · ${v.area}` : ""}
                        </span>
                      </div>
                      <Btn kind="ghost" small disabled={busy} onClick={() => pick(v)}>
                        Ajouter
                      </Btn>
                    </li>
                  ))}
                </ul>
              ) : null}
              {noMatch ? (
                <div className="d-pr-search-empty">
                  <span className="d-small-muted">Aucun prestataire ne correspond dans le catalogue Merry.</span>
                  {google.searching ? <BusyDots label="Recherche sur Google" /> : null}
                  {!google.searching && google.results.length ? (
                    <ul className="d-pr-to">
                      {google.results.map((g, i) => (
                        <li key={i}>
                          <Thumb v={{ name: g.name }} size={44} />
                          <div className="d-pr-to-main">
                            <span className="d-pr-to-name">{g.name}</span>
                            <span className="d-pr-to-meta">{g.address || g.city || ""}</span>
                          </div>
                          <Btn kind="ghost" small onClick={() => pickGoogle(g)}>
                            Ajouter
                          </Btn>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  <button type="button" className="d-pr-arrowlink is-13" onClick={startManual}>
                    {google.done && !google.results.length ? "Toujours rien : ajoutez-le à la main" : "Ce n'est pas ça ? Ajoutez-le à la main"}
                  </button>
                </div>
              ) : null}
            </>
          ) : (
            <form className="d-form-grid d-pr-addvendor-form" onSubmit={submitManual}>
              <div className="d-field is-full">
                <span className="d-field-label">Nom</span>
                <input className="d-input" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Maison Lemoine" maxLength={120} autoFocus required />
              </div>
              <div className="d-field">
                <span className="d-field-label">Catégorie</span>
                <select className="d-input" value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} required>
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
              </div>
              <div className="d-field">
                <span className="d-field-label">Ville ou région · facultatif</span>
                <div className="d-pr-townfield">
                  <div className="d-pr-townsearch">
                    <Icon name="search" size={16} sw={2} />
                    <input
                      className="d-input"
                      value={form.area}
                      placeholder="Luberon"
                      maxLength={80}
                      autoComplete="off"
                      onChange={(e) => setForm((f) => ({ ...f, area: e.target.value }))}
                      onFocus={() => setCities((c) => ({ ...c, open: c.results.length > 0 }))}
                      onBlur={() => setTimeout(() => setCities((c) => ({ ...c, open: false })), 150)}
                    />
                  </div>
                  {cities.open && cities.results.length ? (
                    <ul className="d-pr-townlist">
                      {cities.results.map((c) => (
                        <li
                          key={c}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            setForm((f) => ({ ...f, area: c }));
                            setCities((s) => ({ ...s, open: false }));
                          }}
                        >
                          <Icon name="map" size={16} sw={1.8} />
                          <span>{c}</span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
                <span className="d-small-muted">Pour que Merry cherche la bonne fiche sur Google avec le nom.</span>
              </div>
              {refine.searching || refine.results.length || refine.attempted ? (
                <div className="d-field is-full">
                  {refine.searching ? <BusyDots label="Recherche sur Google" /> : null}
                  {!refine.searching && refine.results.length ? (
                    <>
                      <span className="d-small-muted">Est-ce l’un de ces résultats&nbsp;? Choisissez-le pour reprendre son adresse et son téléphone.</span>
                      <ul className="d-pr-to">
                        {refine.results.map((g, i) => (
                          <li key={i}>
                            <Thumb v={{ name: g.name }} size={44} />
                            <div className="d-pr-to-main">
                              <span className="d-pr-to-name">{g.name}</span>
                              <span className="d-pr-to-meta">{g.address || g.city || ""}</span>
                            </div>
                            <Btn kind="ghost" small type="button" onClick={() => applyRefine(g)}>
                              Utiliser
                            </Btn>
                          </li>
                        ))}
                      </ul>
                    </>
                  ) : null}
                  {!refine.searching && refine.attempted && !refine.results.length ? <span className="d-small-muted">Aucun résultat sur Google pour « {form.name.trim()} » à {refineArea}.</span> : null}
                </div>
              ) : null}
              <span className="d-field is-full d-small-muted">Rejoint le catalogue Merry : les autres couples pourront aussi le trouver.</span>
              <div className="d-pr-addvendor-actions">
                <Btn kind="ghost" onClick={() => setManual(false)}>
                  Annuler
                </Btn>
                <Btn type="submit" disabled={busy || !form.name.trim() || !form.category}>
                  Ajouter à mes prestataires
                </Btn>
              </div>
            </form>
          )}
        </div>
      ) : null}
    </div>
  );
}
