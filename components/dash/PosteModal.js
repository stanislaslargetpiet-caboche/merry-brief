"use client";

import { useRef, useState } from "react";
import { DOCUMENT_MAX_BYTES, useDash } from "@/lib/dash/store";
import { normalize, parseAmount, todayIso, uid } from "@/lib/dash/format";
import { guessCatalogCategory } from "@/lib/dash/catalog";
import { fileSize } from "@/lib/dash/documents";
import { guessIcon, Icon } from "./icons";
import { refineIcon } from "@/lib/dash/aiIcon";
import { posteName, removePosteMessage } from "@/lib/dash/model";
import { CloseBtn, Layer } from "./Prestataires";
import { CreateFicheDialog, useCreateFiche } from "./CreateFiche";
import { Btn, Field, Modal } from "./ui";

// Créer ou modifier un poste de budget : budget prévu, prestataire, devis signé et son lien.
export default function PosteModal({ item, onClose, focusQuote }) {
  const dash = useDash();
  const { vendors, documents, items } = dash.data;
  const vendor = item?.vendor_id ? vendors.find((v) => v.id === item.vendor_id) : null;
  const quoteDoc = item ? documents.find((d) => d.budget_item_id === item.id && d.kind === "devis") : null;
  const canGroup = dash.mode === "demo" || dash.data.categoriesSetup;
  const [form, setForm] = useState({
    label: item?.label || "",
    category: item?.category || "",
    budgeted: item?.budgeted ?? "",
    vendorName: vendor?.name || "",
    quote: item?.quote_amount ?? "",
    signed: item?.quote_signed_at || (item?.quote_amount ? "" : todayIso()),
  });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const [merryPrompt, setMerryPrompt] = useState(null); // null | { name, vendorId, category }
  const { creating, busy: creatingBusy, runCreate, cancelCreate, confirmCreate } = useCreateFiche();
  const [file, setFile] = useState(null); // nouveau devis choisi, pas encore envoyé
  const [removeQuoteDoc, setRemoveQuoteDoc] = useState(false); // devis déjà envoyé, qu'on retire
  const fileInput = useRef(null);

  async function save(e) {
    e?.preventDefault();
    if (!form.label.trim()) return;
    const quote = parseAmount(form.quote);
    let vendorId = item?.vendor_id || null;
    const vName = form.vendorName.trim();
    let newVendor = null;
    if (vName) {
      const existing = vendors.find((v) => v.name.toLowerCase() === vName.toLowerCase());
      if (existing) vendorId = existing.id;
      else if (vendor && vendor.id === vendorId) await dash.update("vendors", vendor.id, { name: vName });
      else {
        vendorId = uid();
        await dash.insert("vendors", { id: vendorId, name: vName, category: form.label.trim() });
        newVendor = { name: vName, vendorId, category: guessCatalogCategory(form.label) };
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
    if (file) {
      if (quoteDoc) await dash.remove("documents", quoteDoc.id);
      const res = await dash.uploadDocument(file, { kind: "devis", budgetItemId: itemId, vendorId, name: file.name });
      if (!res.ok) dash.setToast({ kind: "error", text: res.reason === "size" ? `Le devis dépasse ${fileSize(DOCUMENT_MAX_BYTES)}.` : res.reason === "setup" ? "Le stockage des documents n'est pas installé (supabase/documents.sql) : le poste est enregistré sans le devis." : "Le devis n'a pas pu être envoyé ; le poste est enregistré sans lui." });
    } else if (removeQuoteDoc && quoteDoc) await dash.remove("documents", quoteDoc.id);
    // Un nouveau prestataire tapé à la main, dont on reconnaît le métier : propose de le faire rejoindre
    // le catalogue Merry plutôt que de rester une fiche isolée à ce mariage.
    if (newVendor && newVendor.category && dash.mode === "live") setMerryPrompt(newVendor);
    else onClose();
  }

  async function confirmMerry() {
    if (!merryPrompt) return;
    await runCreate(merryPrompt.name, merryPrompt.category, null, { linkVendorId: merryPrompt.vendorId });
    setMerryPrompt(null);
  }

  function dismissMerry() {
    setMerryPrompt(null);
    onClose();
  }

  async function handleConfirmCreate() {
    await confirmCreate();
    onClose();
  }

  function handleCancelCreate() {
    cancelCreate();
    onClose();
  }

  return (
    <>
    <Modal
      title={item ? "Modifier le poste" : "Ajouter un poste"}
      onClose={onClose}
      footer={
        <>
          {item ? (
            <Btn
              kind="ghost"
              icon="trash"
              className="d-poste-delete"
              onClick={() => {
                if (window.confirm(removePosteMessage(item, dash.data))) {
                  dash.remove("budget_items", item.id);
                  onClose();
                }
              }}
            >
              <span className="d-desk-only-inline">Supprimer</span>
              <span className="d-mob-only-inline">Supprimer le poste</span>
            </Btn>
          ) : null}
          <span className="d-spacer" />
          <Btn kind="ghost" onClick={onClose}>
            Annuler
          </Btn>
          <Btn onClick={save}>
            Enregistrer
          </Btn>
        </>
      }
    >
      <form className="d-form-grid" onSubmit={save}>
        <Field label={form.category.trim() ? "Type de dépense" : "Poste"}>
          <input className="d-input" value={form.label} onChange={set("label")} placeholder={form.category.trim() ? "Tentiste" : "Traiteur"} required autoFocus={!focusQuote} />
        </Field>
        <Field label="Prestataire" full>
          <input className="d-input" value={form.vendorName} onChange={set("vendorName")} placeholder="Maison Lemoine" list="d-vendors" autoFocus={!!focusQuote} />
          <datalist id="d-vendors">
            {vendors.map((v) => (
              <option key={v.id} value={v.name} />
            ))}
          </datalist>
        </Field>
        {/* Téléphone : le total se change dans la fiche du poste (« Total prévu »), pas ici (artboard 4e2) */}
        <Field label="Devis signé (€)" className="d-desk-only">
          <input className="d-input" inputMode="decimal" value={form.quote} onChange={set("quote")} placeholder="Montant du devis" />
        </Field>
        <Field label="Signé le" className="d-desk-only">
          <input className="d-input" type="date" value={form.signed} onChange={set("signed")} />
        </Field>
        <Field label="Devis (facultatif)" full group>
          <div className="d-filechoice">
            <input ref={fileInput} type="file" accept=".pdf,image/*,.doc,.docx" hidden onChange={(e) => setFile(e.target.files?.[0] || null)} />
            {file ? (
              <span className="d-filechoice-name">
                <Icon name="file" size={15} sw={2} />
                <span>{file.name}</span>
                <span className="d-muted">{fileSize(file.size)}</span>
                <button type="button" className="d-icon-btn" style={{ width: 26, height: 26 }} aria-label="Retirer le fichier" onClick={() => setFile(null)}>
                  <Icon name="x" size={13} sw={2.2} />
                </button>
              </span>
            ) : quoteDoc && !removeQuoteDoc ? (
              <span className="d-filechoice-name">
                <Icon name="file" size={15} sw={2} />
                <span>{quoteDoc.name}</span>
                <button type="button" className="d-icon-btn" style={{ width: 26, height: 26 }} aria-label="Retirer le devis" onClick={() => setRemoveQuoteDoc(true)}>
                  <Icon name="x" size={13} sw={2.2} />
                </button>
              </span>
            ) : (
              <Btn kind="ghost" small icon="upload" onClick={() => fileInput.current?.click()}>
                Importer un PDF ou une photo
              </Btn>
            )}
          </div>
        </Field>
        <button type="submit" hidden />
      </form>
    </Modal>
    {merryPrompt ? (
      <Layer kind="dialog" labelledBy="merry-titre" onClose={dismissMerry}>
        <div className="d-pr-panel-head is-dialog">
          <h2 id="merry-titre">Ajouter {merryPrompt.name} au catalogue Merry&nbsp;?</h2>
          <CloseBtn onClose={dismissMerry} />
        </div>
        <div className="d-pr-panel-foot is-devis">
          <Btn kind="ghost" onClick={dismissMerry}>
            Non merci
          </Btn>
          <Btn onClick={confirmMerry}>Oui, l'ajouter</Btn>
        </div>
      </Layer>
    ) : null}
    <CreateFicheDialog creating={creating} busy={creatingBusy} onCancel={handleCancelCreate} onConfirm={handleConfirmCreate} />
    </>
  );
}
