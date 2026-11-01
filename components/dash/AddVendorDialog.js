"use client";

// « Ajouter un prestataire » (Mes prestataires) : un couple qui a déjà trouvé son traiteur ou son
// photographe ailleurs le cherche d'abord dans le catalogue Merry, pour récupérer sa fiche ; s'il n'y
// est pas, il le saisit à la main (nom, catégorie, ville).

import { useEffect, useState } from "react";
import { useDash } from "@/lib/dash/store";
import { CATEGORIES, catOf, customVendorId, searchCatalogByName } from "@/lib/dash/catalog";
import { Thumb, usePicks } from "./Prestataires";
import { Btn, BusyDots, Field, Modal } from "./ui";

export default function AddVendorDialog({ onClose, onAdded }) {
  const dash = useDash();
  const { add } = usePicks();
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [manual, setManual] = useState(false);
  const [form, setForm] = useState({ name: "", category: "autre", area: "" });
  const [busy, setBusy] = useState(false);
  const searched = q.trim().length >= 2;

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

  async function pick(v) {
    setBusy(true);
    await add(v);
    setBusy(false);
    dash.setToast({ kind: "ok", text: `${v.name} est ajouté à vos prestataires.` });
    onAdded?.();
  }

  async function submitManual(e) {
    e.preventDefault();
    const name = form.name.trim();
    if (!name || busy) return;
    setBusy(true);
    await add({ id: customVendorId(), category: form.category, name, area: form.area.trim() || undefined });
    setBusy(false);
    dash.setToast({ kind: "ok", text: `${name} est ajouté à vos prestataires.` });
    onAdded?.();
  }

  return (
    <Modal title="Ajouter un prestataire" onClose={onClose} footer={!manual ? <Btn kind="ghost" onClick={onClose}>Fermer</Btn> : null}>
      <Field label="Vous l’avez déjà ? Cherchez-le" full hint="Dans le catalogue Merry, pour récupérer sa fiche.">
        <input className="d-input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nom du prestataire" autoFocus />
      </Field>
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
      {!searching && searched && !results.length ? <span className="d-small d-muted">Aucun prestataire ne correspond dans le catalogue Merry.</span> : null}
      {manual ? (
        <form className="d-form-grid d-pr-addvendor-form" onSubmit={submitManual}>
          <Field label="Nom" full>
            <input className="d-input" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Maison Lemoine" maxLength={120} autoFocus required />
          </Field>
          <Field label="Catégorie">
            <select className="d-input" value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}>
              {CATEGORIES.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Ville ou région · facultatif">
            <input className="d-input" value={form.area} onChange={(e) => setForm((f) => ({ ...f, area: e.target.value }))} placeholder="Luberon" maxLength={80} />
          </Field>
          <div className="d-pr-addvendor-actions">
            <Btn kind="ghost" onClick={() => setManual(false)}>
              Annuler
            </Btn>
            <Btn type="submit" disabled={busy || !form.name.trim()}>
              Ajouter à mes prestataires
            </Btn>
          </div>
        </form>
      ) : (
        <button type="button" className="d-pr-arrowlink is-13 d-pr-addvendor-link" onClick={() => setManual(true)}>
          Vous ne le trouvez pas ? Ajoutez-le à la main
        </button>
      )}
    </Modal>
  );
}
