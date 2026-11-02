"use client";

// Barre de recherche « Ajouter un prestataire » (Mes prestataires et Trouver des prestataires) : un
// couple qui a déjà trouvé son traiteur ou son photographe ailleurs le cherche d'abord dans le
// catalogue Merry (ajout en un clic). S'il n'y est pas, un seul geste : « Rechercher » ouvre une
// fenêtre qui cherche sur internet pendant une courte animation, montre ce qui a été trouvé, et le
// couple valide. La saisie à la main n'arrive qu'en dernier recours, quand rien n'est trouvé.

import { useEffect, useRef, useState } from "react";
import { useDash } from "@/lib/dash/store";
import { supabase } from "@/lib/supabase";
import { CATALOG_CATEGORIES, CATEGORIES, catOf, searchCatalogByName, searchGoogleVendor } from "@/lib/dash/catalog";
import { Icon } from "./icons";
import { CloseBtn, DevisDialog, FichePanel, Layer, Thumb, usePicks } from "./Prestataires";
import { SEARCH_SCENE_MS, SearchingScene, useCreateFiche } from "./CreateFiche";
import { Btn, BusyDots } from "./ui";

const IDLE = { q: "", loading: false, results: [] };

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
  const [lookup, setLookup] = useState(null); // nom cherché dans la fenêtre
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

  // Une seule recherche dans le catalogue par pause de frappe ; les résultats précédents restent
  // affichés (atténués) jusqu'aux suivants, la liste ne clignote pas.
  useEffect(() => {
    if (!searched) {
      setFound(IDLE);
      return undefined;
    }
    let live = true;
    setFound((f) => ({ ...f, loading: true }));
    const t = setTimeout(async () => {
      const results = await searchCatalogByName(dash.mode, text);
      if (live) setFound({ q: text, loading: false, results });
    }, 300);
    return () => {
      live = false;
      clearTimeout(t);
    };
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

  function startLookup() {
    setOpen(false);
    setLookup(text);
  }

  function onCreated(v) {
    setLookup(null);
    reset();
    setShown({ v, notice: v.existed ? "Déjà dans vos prestataires." : "Ajouté à vos prestataires." });
  }

  const settled = !found.loading && found.q === text;
  const stale = found.loading || found.q !== text;
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
          onKeyDown={(e) => {
            if (e.key === "Escape") setOpen(false);
            // Entrée : si Merry ne le connaît pas, on cherche sur internet directement
            if (e.key === "Enter" && searched && settled && !found.results.length) startLookup();
          }}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
        />
        {found.loading ? <BusyDots label="Recherche" /> : null}
      </label>
      {showDrop ? (
        <div className="d-pr-search-drop">
          {found.results.length ? (
            <div className={`d-pr-search-results${stale ? " is-stale" : ""}`}>
              <span className="d-pr-search-sec">Dans le catalogue Merry</span>
              <ul className="d-pr-to">
                {found.results.map((v) => {
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
            </div>
          ) : settled ? (
            <span className="d-small-muted">« {text} » n'est pas encore sur Merry.</span>
          ) : (
            <span className="d-small-muted">Recherche de « {text} »…</span>
          )}
          <button type="button" className="d-pr-search-manual" onClick={startLookup}>
            <Icon name="sparkle" size={15} sw={2} />
            {found.results.length ? `Ce n'est pas lui ? Rechercher « ${text} » sur internet` : `Rechercher « ${text} » sur internet`}
            <Icon name="arrowRight" size={14} sw={2} />
          </button>
        </div>
      ) : null}
      {lookup ? <AddVendorDialog query={lookup} onClose={() => setLookup(null)} onCreated={onCreated} /> : null}
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

function CategorySelect({ value, onChange, autoFocus }) {
  return (
    <select className="d-input" value={value} onChange={(e) => onChange(e.target.value)} autoFocus={autoFocus} required aria-label="Catégorie">
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
  );
}

function GoogleCard({ g, size = 52, children }) {
  return (
    <div className="d-create-card">
      <div className="d-create-card-head">
        <Thumb v={{ name: g.name }} size={size} />
        <div>
          <span className="d-create-card-name">{g.name}</span>
          <span className="d-create-card-addr">{g.address || g.city || ""}</span>
        </div>
      </div>
      {g.phone || g.website ? (
        <div className="d-create-card-contact">
          {g.phone ? (
            <span>
              <Icon name="phone" size={15} sw={2} />
              {g.phone}
            </span>
          ) : null}
          {g.website ? (
            <span>
              <Icon name="globe" size={15} sw={2} />
              {g.website}
            </span>
          ) : null}
        </div>
      ) : null}
      {children}
    </div>
  );
}

// Fenêtre « Ajouter un prestataire » : on cherche le nom sur internet (animation), on montre le
// résultat à valider (la catégorie n'est demandée que si Merry ne l'a pas devinée), et seulement
// si rien n'est trouvé, un court formulaire à la main.
function AddVendorDialog({ query, onClose, onCreated }) {
  const dash = useDash();
  const { busy, createNow } = useCreateFiche();
  const [step, setStep] = useState({ phase: "search", q: query, results: [], index: 0 });
  const [category, setCategory] = useState("");
  const [form, setForm] = useState({ name: query, category: "", area: "", phone: "", website: "" });
  const searchKey = step.phase === "search" ? step.q : null;

  useEffect(() => {
    if (!searchKey) return undefined;
    let live = true;
    (async () => {
      const start = Date.now();
      const results = await searchGoogleVendor(dash.mode, searchKey, await tokenOf(dash));
      const wait = SEARCH_SCENE_MS - (Date.now() - start);
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      if (!live) return;
      if (results.length) {
        setCategory(results[0].category || "");
        setStep({ phase: "pick", q: searchKey, results, index: 0 });
      } else {
        setStep({ phase: "form", q: searchKey, results: [], index: 0 });
      }
    })();
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchKey, dash.mode]);

  const chosen = step.results[step.index] || null;
  const close = () => !busy && onClose();

  function choose(i) {
    setStep((s) => ({ ...s, index: i }));
    setCategory(step.results[i]?.category || "");
  }

  // Pendant la création (fiche, puis ses photos Google), la scène de recherche reprend
  async function confirmChosen() {
    if (!chosen || !category || busy) return;
    setStep((s) => ({ ...s, phase: "saving" }));
    const v = await createNow(chosen.name, category, chosen.city || "", { match: chosen, quiet: true });
    if (v) onCreated(v);
    else setStep((s) => ({ ...s, phase: "pick" }));
  }

  function goManual() {
    setForm((f) => ({ ...f, name: f.name || step.q }));
    setStep((s) => ({ ...s, phase: "form" }));
  }

  function retry() {
    const name = form.name.trim();
    const area = form.area.trim();
    if (!name) return;
    setStep({ phase: "search", q: area ? `${name} ${area}` : name, results: [], index: 0 });
  }

  async function submitManual(e) {
    e.preventDefault();
    const name = form.name.trim();
    if (!name || !form.category || busy) return;
    const v = await createNow(name, form.category, form.area.trim(), {
      quiet: true,
      fallback: { phone: form.phone.trim() || null, website: form.website.trim() || null },
    });
    if (v) onCreated(v);
  }

  return (
    <Layer kind="dialog" labelledBy="ajout-titre" onClose={close}>
      <div className="d-pr-panel-head is-dialog">
        <h2 id="ajout-titre">{step.phase === "form" ? "Ajouter un prestataire" : "Création de la fiche"}</h2>
        <CloseBtn onClose={close} />
      </div>
      {step.phase === "search" ? (
        <div className="d-pr-panel-body d-pr-create">
          <SearchingScene name={step.q} />
        </div>
      ) : null}
      {step.phase === "saving" && chosen ? (
        <div className="d-pr-panel-body d-pr-create">
          <SearchingScene name={chosen.name} title={`On prépare la fiche de « ${chosen.name} »…`} />
        </div>
      ) : null}
      {step.phase === "pick" && chosen ? (
        <>
          <div className="d-pr-panel-body d-pr-create">
            <h3>Est-ce bien ce prestataire&nbsp;?</h3>
            <GoogleCard g={chosen}>
              <label className="d-field">
                <span className="d-field-label">{chosen.category ? "Catégorie" : "Quelle est sa catégorie ?"}</span>
                <CategorySelect value={category} onChange={setCategory} autoFocus={!chosen.category} />
              </label>
            </GoogleCard>
            {step.results.length > 1 ? (
              <div className="d-pr-search-others">
                <span className="d-pr-search-sec">Ce n'est pas lui ? Peut-être plutôt :</span>
                <ul className="d-pr-to">
                  {step.results.map((g, i) =>
                    i === step.index ? null : (
                      <li key={`${g.name}-${i}`}>
                        <Thumb v={{ name: g.name }} size={44} />
                        <div className="d-pr-to-main">
                          <span className="d-pr-to-name">{g.name}</span>
                          <span className="d-pr-to-meta">{g.address || g.city || ""}</span>
                        </div>
                        <Btn kind="ghost" small onClick={() => choose(i)}>
                          C'est lui
                        </Btn>
                      </li>
                    ),
                  )}
                </ul>
              </div>
            ) : null}
            <button type="button" className="d-pr-arrowlink is-13" onClick={goManual}>
              Aucun ne correspond, l'ajouter à la main
            </button>
          </div>
          <div className="d-pr-panel-foot is-devis">
            <Btn kind="ghost" onClick={close} disabled={busy}>
              Annuler
            </Btn>
            <Btn onClick={confirmChosen} disabled={busy || !category}>
              {busy ? "Ajout en cours…" : "Oui, c'est lui"}
            </Btn>
          </div>
        </>
      ) : null}
      {step.phase === "form" ? (
        <form className="d-pr-addvendor" onSubmit={submitManual}>
          <div className="d-pr-panel-body">
            {!step.results.length ? (
              <p className="d-pr-lead">
                Rien trouvé sur internet pour « {step.q} ». Précisez sa ville pour chercher à nouveau, ou ajoutez-le tel quel : vous pourrez compléter sa fiche plus tard.
              </p>
            ) : null}
            <div className="d-form-grid">
              <label className="d-field is-full">
                <span className="d-field-label">Nom</span>
                <input className="d-input" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Maison Lemoine" maxLength={120} required />
              </label>
              <label className="d-field">
                <span className="d-field-label">Catégorie</span>
                <CategorySelect value={form.category} onChange={(c) => setForm((f) => ({ ...f, category: c }))} autoFocus />
              </label>
              <label className="d-field">
                <span className="d-field-label">Ville · facultatif</span>
                <input className="d-input" value={form.area} onChange={(e) => setForm((f) => ({ ...f, area: e.target.value }))} placeholder="Gordes" maxLength={80} autoComplete="off" />
              </label>
              <label className="d-field">
                <span className="d-field-label">Téléphone · facultatif</span>
                <input className="d-input" type="tel" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} maxLength={40} autoComplete="off" />
              </label>
              <label className="d-field">
                <span className="d-field-label">Site internet · facultatif</span>
                <input className="d-input" value={form.website} onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))} maxLength={300} placeholder="maison-lemoine.fr" autoComplete="off" />
              </label>
            </div>
            {dash.mode === "live" ? (
              <button type="button" className="d-pr-arrowlink is-13" onClick={retry} disabled={!form.name.trim()}>
                Chercher à nouveau « {form.name.trim() || "ce nom"} »{form.area.trim() ? ` à ${form.area.trim()}` : ""} sur internet
              </button>
            ) : null}
          </div>
          <div className="d-pr-panel-foot is-devis">
            <Btn kind="ghost" onClick={close} disabled={busy}>
              Annuler
            </Btn>
            <Btn type="submit" disabled={busy || !form.name.trim() || !form.category}>
              {busy ? "Ajout en cours…" : "Ajouter à mes prestataires"}
            </Btn>
          </div>
        </form>
      ) : null}
    </Layer>
  );
}
