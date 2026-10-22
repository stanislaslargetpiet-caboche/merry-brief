"use client";

import { useState } from "react";
import { useDash } from "@/lib/dash/store";
import { normalize, parseAmount, todayIso, uid } from "@/lib/dash/format";
import { guessIcon } from "./icons";
import { refineIcon } from "@/lib/dash/aiIcon";
import { groupItems, posteName } from "@/lib/dash/model";
import { Btn, Field, Modal } from "./ui";

// Créer ou modifier un poste de budget : budget prévu, prestataire, devis signé et son lien.
export default function PosteModal({ item, onClose, focusQuote }) {
  const dash = useDash();
  const { vendors, documents, items } = dash.data;
  const vendor = item?.vendor_id ? vendors.find((v) => v.id === item.vendor_id) : null;
  const quoteDoc = item ? documents.find((d) => d.budget_item_id === item.id && d.kind === "devis") : null;
  const canGroup = dash.mode === "demo" || dash.data.categoriesSetup;
  // Postes déjà utilisés comme catégorie ou comme poste seul, proposés pour regrouper
  const groupNames = groupItems(items.filter((i) => i.id !== item?.id))
    .map((g) => g.name.split(" · ")[0])
    .filter((n, i, all) => n && all.indexOf(n) === i);
  const [form, setForm] = useState({
    label: item?.label || "",
    category: item?.category || "",
    budgeted: item?.budgeted ?? "",
    vendorName: vendor?.name || "",
    quote: item?.quote_amount ?? "",
    signed: item?.quote_signed_at || (item?.quote_amount ? "" : todayIso()),
    quoteUrl: quoteDoc?.url || "",
  });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function save(e) {
    e?.preventDefault();
    if (!form.label.trim()) return;
    const quote = parseAmount(form.quote);
    let vendorId = item?.vendor_id || null;
    const vName = form.vendorName.trim();
    if (vName) {
      const existing = vendors.find((v) => v.name.toLowerCase() === vName.toLowerCase());
      if (existing) vendorId = existing.id;
      else if (vendor && vendor.id === vendorId) await dash.update("vendors", vendor.id, { name: vName });
      else {
        vendorId = uid();
        await dash.insert("vendors", { id: vendorId, name: vName, category: form.label.trim() });
      }
    } else vendorId = null;
    const patch = {
      label: form.label.trim(),
      ...(canGroup ? { category: form.category.trim() || null } : {}),
      budgeted: parseAmount(form.budgeted),
      vendor_id: vendorId,
      quote_amount: quote,
      quote_signed_at: quote !== null ? form.signed || todayIso() : null,
    };
    let itemId = item?.id;
    // Une ligne d'un poste garde l'icône du poste ; seul un poste seul change d'icône avec son nom
    const grouped = Boolean(patch.category);
    const renamed = !item || item.label !== patch.label;
    if (item) await dash.update("budget_items", item.id, renamed && !grouped ? { ...patch, icon: guessIcon(patch.label) } : patch);
    else {
      itemId = uid();
      const siblingIcon = grouped ? items.find((i) => normalize(i.category || i.label) === normalize(patch.category))?.icon : null;
      await dash.insert("budget_items", { id: itemId, ...patch, icon: siblingIcon || guessIcon(grouped ? patch.category : form.label), position: items.length });
    }
    if (renamed && !grouped) refineIcon(dash, "budget_items", itemId, patch.label, guessIcon(patch.label));
    const url = form.quoteUrl.trim();
    if (url && /^https?:\/\//i.test(url)) {
      if (quoteDoc) await dash.update("documents", quoteDoc.id, { url, vendor_id: vendorId });
      else await dash.insert("documents", { budget_item_id: itemId, vendor_id: vendorId, kind: "devis", name: "Devis signé", url });
    } else if (!url && quoteDoc) await dash.remove("documents", quoteDoc.id);
    onClose();
  }

  const badUrl = form.quoteUrl.trim() && !/^https?:\/\//i.test(form.quoteUrl.trim());

  return (
    <Modal
      title={item ? posteName(item) : "Ajouter un poste"}
      onClose={onClose}
      footer={
        <>
          {item ? (
            <Btn
              kind="ghost"
              icon="trash"
              onClick={() => {
                if (window.confirm(`Supprimer ${item.category ? "la ligne" : "le poste"} « ${posteName(item)} » et ses paiements ?`)) {
                  dash.remove("budget_items", item.id);
                  onClose();
                }
              }}
            >
              Supprimer
            </Btn>
          ) : null}
          <span className="d-spacer" />
          <Btn kind="ghost" onClick={onClose}>
            Annuler
          </Btn>
          <Btn onClick={save} disabled={!!badUrl}>
            Enregistrer
          </Btn>
        </>
      }
    >
      <form className="d-form-grid" onSubmit={save}>
        <Field label={form.category.trim() ? "Type de dépense" : "Poste"}>
          <input className="d-input" value={form.label} onChange={set("label")} placeholder={form.category.trim() ? "Tentiste" : "Traiteur"} required autoFocus={!focusQuote} />
        </Field>
        {canGroup ? (
          <Field label="Regroupé dans le poste · facultatif" full hint="Plusieurs prestataires dans un même poste ? Indiquez le poste, par exemple « Lieu » pour un tentiste, un groupe électrogène, un foodtruck…">
            <input className="d-input" value={form.category} onChange={set("category")} placeholder="Lieu" list="d-categories" maxLength={80} />
            <datalist id="d-categories">
              {groupNames.map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>
          </Field>
        ) : null}
        <Field label="Budget prévu (€)">
          <input className="d-input" inputMode="decimal" value={form.budgeted} onChange={set("budgeted")} placeholder="12 000" />
        </Field>
        <Field label="Prestataire" full>
          <input className="d-input" value={form.vendorName} onChange={set("vendorName")} placeholder="Maison Lemoine" list="d-vendors" autoFocus={!!focusQuote} />
          <datalist id="d-vendors">
            {vendors.map((v) => (
              <option key={v.id} value={v.name} />
            ))}
          </datalist>
        </Field>
        <Field label="Devis signé (€)">
          <input className="d-input" inputMode="decimal" value={form.quote} onChange={set("quote")} placeholder="Montant du devis" />
        </Field>
        <Field label="Signé le">
          <input className="d-input" type="date" value={form.signed} onChange={set("signed")} />
        </Field>
        <Field label="Lien du devis" full hint={badUrl ? "Le lien doit commencer par https://" : "Drive, Dropbox, pièce jointe d'un mail… n'importe quel lien."}>
          <input className="d-input" type="url" value={form.quoteUrl} onChange={set("quoteUrl")} placeholder="https://" />
        </Field>
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}
