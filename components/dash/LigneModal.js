"use client";

// Ajouter une ligne dans un poste : un prestataire de plus dans la même catégorie
// (Lieu : tentiste, groupe électrogène, foodtruck…). La ligne a ses devis, paiements et documents.

import { useState } from "react";
import { useDash } from "@/lib/dash/store";
import { groupItems } from "@/lib/dash/model";
import { normalize, parseAmount, todayIso, uid } from "@/lib/dash/format";
import { Btn, Field, Modal } from "./ui";

// Types de dépense proposés d'un clic, selon le poste
const SUGGESTIONS = [
  [/lieu|domaine|salle|chateau|reception/, ["Tentiste", "Groupe électrogène (GE)", "Foodtruck", "Mobilier", "Sono et lumière", "Sécurité"]],
  [/traiteur|repas|buffet|cocktail/, ["Boissons", "Gâteau", "Personnel de service", "Location de vaisselle"]],
  [/photo|video/, ["Album", "Tirages", "Seconde personne", "Drone"]],
  [/fleur|deco/, ["Bouquet", "Arche", "Centres de table", "Location de mobilier"]],
  [/dj|musique|musicien|orchestre|animation/, ["Sono", "Lumières", "Musiciens de la cérémonie"]],
  [/hebergement|chambre|gite|logement/, ["Chambres des mariés", "Gîte des proches", "Navettes"]],
];
const FALLBACK = ["Location de matériel", "Livraison", "Personnel", "Assurance"];

// category : nom du poste (« Lieu »)
export default function LigneModal({ category, onClose }) {
  const dash = useDash();
  const { items, vendors, payments } = dash.data;
  const group = groupItems(items).find((g) => normalize(g.name) === normalize(category) || g.items.some((i) => normalize(i.category) === normalize(category)));
  const siblings = group ? group.items : [];
  const taken = new Set(siblings.map((i) => normalize(i.label)));
  const suggestions = (SUGGESTIONS.find(([re]) => re.test(normalize(category)))?.[1] || FALLBACK).filter((s) => !taken.has(normalize(s)));
  const [kind, setKind] = useState("");
  const [vendorName, setVendorName] = useState("");
  const [paid, setPaid] = useState("");
  const [full, setFull] = useState(true); // paiement intégral, sinon acompte avec un reste
  const [rest, setRest] = useState("");
  const [busy, setBusy] = useState(false);

  const paidAmount = parseAmount(paid);
  const restAmount = full ? 0 : parseAmount(rest) || 0;
  const dup = kind.trim() && taken.has(normalize(kind));
  const ready = kind.trim() && paidAmount !== null && paidAmount > 0;

  async function save(e) {
    e?.preventDefault();
    if (!ready || busy) return;
    setBusy(true);
    let vendorId = null;
    const vName = vendorName.trim();
    if (vName) {
      const existing = vendors.find((v) => normalize(v.name) === normalize(vName));
      if (existing) vendorId = existing.id;
      else {
        vendorId = uid();
        await dash.insert("vendors", { id: vendorId, name: vName, category: kind.trim() });
      }
    }
    const itemId = uid();
    await dash.insert("budget_items", {
      id: itemId,
      label: kind.trim().slice(0, 80),
      category: String(category).trim(),
      icon: siblings[0]?.icon || null,
      vendor_id: vendorId,
      quote_amount: paidAmount + restAmount,
      position: items.length,
    });
    await dash.insert("payments", { budget_item_id: itemId, label: vName || "Paiement", amount: paidAmount, paid_at: todayIso(), payer_id: null, due_date: null });
    dash.setToast({ kind: "ok", text: `Ligne « ${kind.trim()} » ajoutée dans ${category}.` });
    onClose();
  }

  return (
    <Modal
      title={`Ajouter une ligne dans « ${category} »`}
      onClose={onClose}
      footer={
        <>
          <Btn kind="ghost" onClick={onClose}>
            Annuler
          </Btn>
          <Btn onClick={save} disabled={!ready || busy}>
            Ajouter la ligne
          </Btn>
        </>
      }
    >
      <form onSubmit={save} className="d-col" style={{ gap: 16 }}>
        <p className="d-small d-muted" style={{ margin: 0 }}>
          Pour un prestataire de plus dans la même catégorie.
        </p>
        <Field label="Type de dépense" hint={dup ? "Une ligne porte déjà ce nom dans ce poste." : undefined}>
          <input className="d-input" value={kind} onChange={(e) => setKind(e.target.value)} placeholder="Tentiste, foodtruck…" maxLength={80} autoFocus />
        </Field>
        <div className="d-filters" role="group" aria-label="Types de dépense proposés">
          {suggestions.map((s) => (
            <button key={s} type="button" className={`d-pill${normalize(kind) === normalize(s) ? " is-on" : ""}`} aria-pressed={normalize(kind) === normalize(s)} onClick={() => setKind(s)}>
              {s}
            </button>
          ))}
        </div>
        <Field label="Prestataire · facultatif">
          <input className="d-input" value={vendorName} onChange={(e) => setVendorName(e.target.value)} placeholder="Tentes & Co" list="d-line-vendors" />
          <datalist id="d-line-vendors">
            {vendors.map((v) => (
              <option key={v.id} value={v.name} />
            ))}
          </datalist>
        </Field>
        <Field label="Montant payé (€)">
          <input className="d-input" inputMode="decimal" value={paid} onChange={(e) => setPaid(e.target.value)} placeholder="4 200" autoFocus={false} />
        </Field>
        <div className="d-filters" role="radiogroup" aria-label="Paiement intégral ou acompte">
          <button type="button" className={`d-pill${full ? " is-on" : ""}`} aria-pressed={full} onClick={() => setFull(true)}>
            Paiement intégral
          </button>
          <button type="button" className={`d-pill${!full ? " is-on" : ""}`} aria-pressed={!full} onClick={() => setFull(false)}>
            Acompte
          </button>
        </div>
        {!full ? (
          <Field label="Reste à payer (€)">
            <input className="d-input" inputMode="decimal" value={rest} onChange={(e) => setRest(e.target.value)} placeholder="2 000" />
          </Field>
        ) : null}
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}
