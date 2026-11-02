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

// Message lisible pour une erreur de merry_add_vendor_manual : une base pas à jour se répare en
// collant le dernier fichier SQL, le reste est dit tel quel.
function createErrorText(e) {
  const msg = String(e?.message || "");
  if (/ambiguous|does not exist|function .*merry_add_vendor_manual|PGRST202/i.test(`${e?.code} ${msg}`)) {
    return "Ce prestataire n'a pas pu être créé : la base n'est pas à jour. Collez supabase/prestataires-ajout-manuel-fix-ambiguite.sql dans Supabase (SQL Editor), puis réessayez.";
  }
  if (/not a wedding member/i.test(msg)) return "Ce prestataire n'a pas pu être créé : vous n'êtes pas organisateur de ce mariage.";
  if (/invalid category/i.test(msg)) return "Ce prestataire n'a pas pu être créé : choisissez une catégorie.";
  if (/invalid name/i.test(msg)) return "Ce prestataire n'a pas pu être créé : son nom est vide ou trop long.";
  return `Ce prestataire n'a pas pu être créé${msg ? ` : ${msg}` : ""}. Réessayez dans un instant.`;
}

// linkVendorId (facultatif) : une fiche public.vendors déjà existante (ex. créée depuis un poste du
// budget) à raccrocher au pick créé, pour que « Mes prestataires » et ce poste pointent sur le même
// prestataire au lieu de deux fiches séparées.
export function useCreateFiche() {
  const dash = useDash();
  const { add, pickOf, picks } = usePicks();
  const [creating, setCreating] = useState(null); // null | { phase, name, category, area, match, linkVendorId, fallback }
  const [busy, setBusy] = useState(false);

  // Crée (ou retrouve) la fiche catalogue et l'ajoute aux prestataires, sans passer par la fenêtre
  // de confirmation : pour un appelant qui a déjà fait confirmer le résultat autrement. Renvoie le
  // prestataire (avec existed: true s'il était déjà dans la sélection), ou null si ça a échoué.
  async function createNow(name, category, area, opts = {}) {
    if (busy) return null;
    const { match = null, linkVendorId = null, fallback = null, quiet = false } = opts;
    const city = match?.city || area;
    setBusy(true);
    try {
      const details = {
        phone: match?.phone || fallback?.phone || undefined,
        website: match?.website || fallback?.website || undefined,
        lat: match?.lat ?? fallback?.lat ?? undefined,
        lng: match?.lng ?? fallback?.lng ?? undefined,
      };
      let v;
      if (dash.mode === "live" && supabase) {
        const { data: newId, error } = await supabase.rpc("merry_add_vendor_manual", {
          w: dash.data.wedding.id,
          vname: name,
          category,
          city: city || null,
          phone: details.phone || null,
          website: details.website || null,
          vlat: details.lat ?? null,
          vlng: details.lng ?? null,
        });
        if (error) throw error;
        if (!newId) throw new Error("aucune fiche renvoyée");
        v = { id: `catalog:${newId}`, catalogId: newId, category: catFromCatalog(category), name, area: city || undefined, ...details };
      } else {
        const norm = (x) => String(x || "").trim().toLocaleLowerCase("fr");
        const same = picks.find((p) => p.category === catFromCatalog(category) && norm(p.data?.name) === norm(name));
        v = { id: same?.catalog_ref || customVendorId(), category: catFromCatalog(category), name, area: city || undefined, ...details };
      }
      const existed = !!pickOf(v);
      const pick = await add(v);
      if (!pick) return null;
      if (linkVendorId && dash.mode === "live" && !pick.vendor_id) {
        await dash.update("vendor_picks", pick.id, { vendor_id: linkVendorId });
      }
      if (!quiet) dash.setToast({ kind: "ok", text: existed ? `${name} est déjà dans vos prestataires.` : `${name} est ajouté à vos prestataires.` });
      return { ...v, existed };
    } catch (e) {
      console.error("[merry] merry_add_vendor_manual", e);
      dash.setToast({ kind: "error", text: createErrorText(e) });
      return null;
    } finally {
      setBusy(false);
    }
  }

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
    const v = await createNow(name, category, area, { match, linkVendorId, fallback });
    setCreating(null);
    return v;
  }

  return { creating, busy, runCreate, cancelCreate, confirmCreate, createNow };
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
