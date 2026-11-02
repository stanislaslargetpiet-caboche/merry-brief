"use client";

// Flux « Créer la fiche » (recherche Google puis confirmation) partagé entre la barre de recherche
// « Ajouter un prestataire » (VendorSearchBar) et, depuis le Budget, la proposition d'ajouter au
// catalogue Merry un prestataire tapé à la main sur un poste. Toujours le même geste : on cherche sur
// Google pendant une courte animation, on montre ce qui a été trouvé (ou rien), le couple confirme.

import { useState } from "react";
import { useDash } from "@/lib/dash/store";
import { supabase } from "@/lib/supabase";
import { catFromCatalog, customVendorId, searchGoogleVendor } from "@/lib/dash/catalog";
import { Icon } from "./icons";
import { CloseBtn, Layer, Thumb, usePicks } from "./Prestataires";
import { Btn } from "./ui";

// linkVendorId (facultatif) : une fiche public.vendors déjà existante (ex. créée depuis un poste du
// budget) à raccrocher au pick créé, pour que « Mes prestataires » et ce poste pointent sur le même
// prestataire au lieu de deux fiches séparées.
export function useCreateFiche() {
  const dash = useDash();
  const { add } = usePicks();
  const [creating, setCreating] = useState(null); // null | { phase, name, category, area, match, linkVendorId, fallback }
  const [busy, setBusy] = useState(false);

  async function runCreate(name, category, area, opts = {}) {
    setCreating({ phase: "search", name, category, area, match: opts.match || null, linkVendorId: opts.linkVendorId || null, fallback: opts.fallback || null });
    const start = Date.now();
    let match = opts.match || null;
    if (!match && dash.mode === "live" && supabase) {
      const token = (await supabase.auth.getSession()).data?.session?.access_token || null;
      const results = await searchGoogleVendor(dash.mode, area ? `${name} ${area}` : name, token);
      match = results[0] || null;
    }
    const elapsed = Date.now() - start;
    const minDelay = 1700;
    if (elapsed < minDelay) await new Promise((r) => setTimeout(r, minDelay - elapsed));
    setCreating((c) => (c ? { ...c, phase: "confirm", match } : c));
  }

  function cancelCreate() {
    if (busy) return;
    setCreating(null);
  }

  // Renvoie le prestataire créé (ou réutilisé) pour que l'appelant sache que ça a marché, null sinon.
  async function confirmCreate() {
    if (!creating || creating.phase !== "confirm" || busy) return null;
    const { name, category, area, match, linkVendorId, fallback } = creating;
    const city = match?.city || area;
    setBusy(true);
    try {
      let v;
      if (dash.mode === "live" && supabase) {
        const { data: newId, error } = await supabase.rpc("merry_add_vendor_manual", {
          w: dash.data.wedding.id,
          vname: name,
          category,
          city: city || null,
          phone: match?.phone || fallback?.phone || null,
          website: match?.website || fallback?.website || null,
          vlat: match?.lat ?? fallback?.lat ?? null,
          vlng: match?.lng ?? fallback?.lng ?? null,
        });
        if (error) throw error;
        v = { id: `catalog:${newId}`, category: catFromCatalog(category), name, area: city || undefined };
      } else {
        v = { id: customVendorId(), category: catFromCatalog(category), name, area: city || undefined };
      }
      const pick = await add(v);
      if (linkVendorId && dash.mode === "live" && pick && !pick.vendor_id) {
        await dash.update("vendor_picks", pick.id, { vendor_id: linkVendorId });
      }
      dash.setToast({ kind: "ok", text: `${name} est ajouté au catalogue Merry et à vos prestataires.` });
      setCreating(null);
      return v;
    } catch (e) {
      console.error("[merry] merry_add_vendor_manual", e);
      dash.setToast({ kind: "error", text: `Ce prestataire n'a pas pu être créé${e?.message ? ` : ${e.message}` : " : collez supabase/prestataires-ajout-manuel-google.sql dans Supabase (SQL Editor)."}` });
      setCreating(null);
      return null;
    } finally {
      setBusy(false);
    }
  }

  return { creating, busy, runCreate, cancelCreate, confirmCreate };
}

export function CreateFicheDialog({ creating, busy, onCancel, onConfirm }) {
  if (!creating) return null;
  return (
    <Layer kind="dialog" labelledBy="creer-titre" onClose={onCancel}>
      <div className="d-pr-panel-head is-dialog">
        <h2 id="creer-titre">Création de la fiche</h2>
        <CloseBtn onClose={onCancel} />
      </div>
      <div className="d-pr-panel-body d-pr-create">
        {creating.phase === "search" ? (
          <>
            <h3>
              On cherche « {creating.name} »{creating.area ? ` à ${creating.area}` : ""}…
            </h3>
            <div className="d-create-chips" aria-hidden="true">
              <span className="d-create-chip" style={{ "--i": 0, "--x": "-130px", "--y": "-60px", "--r": "-6deg" }}>
                Recherche internet
              </span>
              <span className="d-create-chip" style={{ "--i": 1, "--x": "125px", "--y": "-65px", "--r": "5deg" }}>
                Photos
              </span>
              <span className="d-create-chip" style={{ "--i": 2, "--x": "-135px", "--y": "55px", "--r": "4deg" }}>
                Carte
              </span>
              <span className="d-create-chip" style={{ "--i": 3, "--x": "120px", "--y": "60px", "--r": "-5deg" }}>
                Téléphone
              </span>
              <div className="d-create-core" />
            </div>
            <div className="d-create-lines">
              <p className="d-create-ln is-0">On cherche sur internet…</p>
              <p className="d-create-ln is-1">On récupère ses photos et sa position…</p>
              <p className="d-create-ln is-2">On repère son téléphone ou son e-mail…</p>
            </div>
          </>
        ) : (
          <>
            <h3>Est-ce bien ce prestataire&nbsp;?</h3>
            {creating.match ? (
              <div className="d-create-card">
                <div className="d-create-card-head">
                  <Thumb v={{ name: creating.match.name }} size={52} />
                  <div>
                    <span className="d-create-card-name">{creating.match.name}</span>
                    <span className="d-create-card-addr">{creating.match.address || creating.area || ""}</span>
                  </div>
                </div>
                {creating.match.phone || creating.match.website ? (
                  <div className="d-create-card-contact">
                    {creating.match.phone ? (
                      <span>
                        <Icon name="phone" size={15} sw={2} />
                        {creating.match.phone}
                      </span>
                    ) : null}
                    {creating.match.website ? (
                      <span>
                        <Icon name="globe" size={15} sw={2} />
                        {creating.match.website}
                      </span>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : (
              <span className="d-small-muted">
                Aucune fiche trouvée sur Google pour « {creating.name} »{creating.area ? ` à ${creating.area}` : ""}. On peut quand même créer la fiche telle quelle.
              </span>
            )}
          </>
        )}
      </div>
      {creating.phase === "confirm" ? (
        <div className="d-pr-panel-foot is-devis">
          <Btn kind="ghost" onClick={onCancel} disabled={busy}>
            Non, ce n'est pas ça
          </Btn>
          <Btn onClick={onConfirm} disabled={busy}>
            {creating.match ? "Oui, c'est elle" : "Créer quand même"}
          </Btn>
        </div>
      ) : null}
    </Layer>
  );
}
