"use client";

// Barre de recherche « Ajouter un prestataire » (Mes prestataires) : un couple qui a déjà trouvé son
// traiteur ou son photographe ailleurs le cherche d'abord dans le catalogue Merry, pour récupérer sa
// fiche ; s'il n'y est pas, il le saisit à la main (nom, catégorie, ville), directement sous la barre.

import { useEffect, useRef, useState } from "react";
import { useDash } from "@/lib/dash/store";
import { supabase } from "@/lib/supabase";
import { CATALOG_CATEGORIES, CATEGORIES, catFromCatalog, catOf, customVendorId, searchCatalogByName } from "@/lib/dash/catalog";
import { Icon } from "./icons";
import { Thumb, usePicks } from "./Prestataires";
import { Btn, BusyDots } from "./ui";

export default function VendorSearchBar() {
  const dash = useDash();
  const { add } = usePicks();
  const boxRef = useRef(null);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [manual, setManual] = useState(false);
  const [form, setForm] = useState({ name: "", category: "", area: "" });
  const [busy, setBusy] = useState(false);
  const searched = q.trim().length >= 2;

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

  function reset() {
    setQ("");
    setOpen(false);
    setManual(false);
    setForm({ name: "", category: "", area: "" });
    setResults([]);
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
        });
        if (error) throw error;
        v = { id: `catalog:${newId}`, category: catFromCatalog(form.category), name, area: area || undefined };
      } else {
        v = { id: customVendorId(), category: catFromCatalog(form.category), name, area: area || undefined };
      }
      await add(v);
      dash.setToast({ kind: "ok", text: `${name} est ajouté au catalogue Merry et à vos prestataires.` });
      reset();
    } catch {
      dash.setToast({ kind: "error", text: "Ce prestataire n'a pas pu être créé : collez supabase/prestataires-ajout-manuel.sql dans Supabase (SQL Editor)." });
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
              {!searching && !results.length ? (
                <div className="d-pr-search-empty">
                  <span className="d-small-muted">Aucun prestataire ne correspond dans le catalogue Merry.</span>
                  <button type="button" className="d-pr-arrowlink is-13" onClick={startManual}>
                    Ajoutez-le à la main
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
                <input className="d-input" value={form.area} onChange={(e) => setForm((f) => ({ ...f, area: e.target.value }))} placeholder="Luberon" maxLength={80} />
              </div>
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
