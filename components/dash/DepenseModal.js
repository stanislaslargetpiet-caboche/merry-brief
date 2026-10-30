"use client";

// Ajouter une dépense déjà payée : le poste d'abord, puis le nom de la dépense ou du prestataire,
// combien, payée par qui et quand.
// Elle s'inscrit dans le poste (tableau « Par poste ») et dans « Qui a payé quoi ».

import { useRef, useState } from "react";
import { DOCUMENT_MAX_BYTES, useDash } from "@/lib/dash/store";
import { posteName } from "@/lib/dash/model";
import { euros, parseAmount, todayIso, uid } from "@/lib/dash/format";
import { Tile, guessIcon } from "./icons";
import { refineIcon } from "@/lib/dash/aiIcon";
import { Avatar, Btn, Field, Modal } from "./ui";
import { Icon } from "./icons";
import { fileSize } from "@/lib/dash/documents";

export default function DepenseModal({ onClose, itemId: initialItem }) {
  const dash = useDash();
  const { items, members, meId, folders = [] } = dash.data;
  const [itemId, setItemId] = useState(initialItem || items[0]?.id || "new");
  const [newLabel, setNewLabel] = useState("");
  const [what, setWhat] = useState("");
  const [amount, setAmount] = useState("");
  const [full, setFull] = useState(true); // paiement intégral, sinon acompte avec un reste
  const [rest, setRest] = useState("");
  const [statutPaid, setStatutPaid] = useState(true); // déjà payée, sinon à payer
  const [paidAt, setPaidAt] = useState(todayIso());
  const [payerId, setPayerId] = useState(meId || members[0]?.id || null);
  const [file, setFile] = useState(null);
  const fileInput = useRef(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const isNew = itemId === "new" || !items.length;
  const item = items.find((i) => i.id === itemId);
  const value = parseAmount(amount);
  const vendor = item?.vendor_id ? (dash.data.vendors || []).find((v) => v.id === item.vendor_id) : null;
  const label = what.trim().slice(0, 120) || vendor?.name || "Paiement";
  const ready = value !== null && value > 0 && (!isNew || newLabel.trim());

  async function save(e) {
    e?.preventDefault();
    if (!ready || busy) return;
    setBusy(true);
    let id = item?.id;
    let hadQuote = item?.quote_amount !== null && item?.quote_amount !== undefined;
    if (isNew) {
      id = uid();
      await dash.insert("budget_items", { id, label: newLabel.trim(), icon: guessIcon(newLabel), position: items.length });
      refineIcon(dash, "budget_items", id, newLabel.trim(), guessIcon(newLabel));
      hadQuote = false;
    }
    // Un poste sans montant prévu en reçoit un, à partir de cette dépense (montant + reste si acompte) ;
    // s'il en a déjà un, on ne le touche pas pour ne pas écraser ce que Modifier le poste a pu fixer.
    if (!hadQuote) {
      const restAmount = full ? 0 : parseAmount(rest) || 0;
      await dash.update("budget_items", id, { quote_amount: value + restAmount });
    }
    await dash.insert("payments", {
      budget_item_id: id,
      label,
      amount: value,
      paid_at: statutPaid ? paidAt || todayIso() : null,
      payer_id: statutPaid ? payerId || null : null,
      due_date: null,
      note: note.trim().slice(0, 500) || null,
    });
    if (file) {
      const folder = folders.find((x) => /facture|devis/i.test(x.name)) || null;
      const res = await dash.uploadDocument(file, { folderId: folder?.id || null, kind: "facture", budgetItemId: id, vendorId: item?.vendor_id || null, name: file.name });
      if (!res.ok) dash.setToast({ kind: "error", text: res.reason === "size" ? `La facture dépasse ${fileSize(DOCUMENT_MAX_BYTES)}.` : res.reason === "setup" ? "Le stockage des documents n'est pas installé (supabase/documents.sql) : la dépense est notée sans la facture." : "La facture n'a pas pu être envoyée ; la dépense est notée sans elle." });
    }
    dash.setToast({ kind: "ok", text: `${euros(value)} ${statutPaid ? "payés" : "prévus"} pour ${isNew ? newLabel.trim() : posteName(item)}.` });
    onClose();
  }

  return (
    <Modal
      title="Ajouter une dépense"
      onClose={onClose}
      footer={
        <>
          <Btn kind="ghost" onClick={onClose}>
            Annuler
          </Btn>
          <Btn onClick={save} disabled={!ready || busy}>
            Ajouter la dépense
          </Btn>
        </>
      }
    >
      <form className="d-form-grid" onSubmit={save}>
        <Field label="Pour quel poste ?" full group>
          <div className="d-poste-pick" role="radiogroup" aria-label="Pour quel poste ?">
            {items.map((i) => (
              <button key={i.id} type="button" role="radio" aria-checked={!isNew && itemId === i.id} className={`d-poste-opt${!isNew && itemId === i.id ? " is-on" : ""}`} onClick={() => setItemId(i.id)}>
                <Tile name={i.icon || guessIcon(i.label)} size={28} />
                {posteName(i)}
              </button>
            ))}
            <button type="button" role="radio" aria-checked={isNew} className={`d-poste-opt${isNew ? " is-on" : ""}`} onClick={() => setItemId("new")}>
              <span className="d-tile d-poste-new" style={{ width: 28, height: 28, borderRadius: 8 }}>
                <Icon name="plus" size={14} sw={2.4} />
              </span>
              Nouveau poste
            </button>
          </div>
        </Field>
        {isNew ? (
          <Field label="Nom du nouveau poste" full>
            <input className="d-input" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="Faire-part, coiffure, navette…" />
          </Field>
        ) : null}
        <Field label="Nom de la dépense ou du prestataire" full>
          <input className="d-input" value={what} onChange={(e) => setWhat(e.target.value)} maxLength={120} placeholder={vendor ? `Acompte ${vendor.name}` : "Acompte, robe, Maison Lemoine…"} />
        </Field>
        <Field label="Montant (€)">
          <input className="d-input" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="690" />
        </Field>
        <Field label="Type" full group>
          <div className="d-filters" role="radiogroup" aria-label="Paiement intégral ou acompte">
            <button type="button" className={`d-pill${full ? " is-on" : ""}`} aria-pressed={full} onClick={() => setFull(true)}>
              Paiement intégral
            </button>
            <button type="button" className={`d-pill${!full ? " is-on" : ""}`} aria-pressed={!full} onClick={() => setFull(false)}>
              Acompte
            </button>
          </div>
        </Field>
        {!full ? (
          <Field label="Reste à payer (€)">
            <input className="d-input" inputMode="decimal" value={rest} onChange={(e) => setRest(e.target.value)} placeholder="300" />
          </Field>
        ) : null}
        <Field label="Statut" full group>
          <div className="d-filters" role="radiogroup" aria-label="C'est payé ou à payer">
            <button type="button" className={`d-pill${statutPaid ? " is-on" : ""}`} aria-pressed={statutPaid} onClick={() => setStatutPaid(true)}>
              C&rsquo;est payé
            </button>
            <button type="button" className={`d-pill${!statutPaid ? " is-on" : ""}`} aria-pressed={!statutPaid} onClick={() => setStatutPaid(false)}>
              À payer
            </button>
          </div>
        </Field>
        {statutPaid ? (
          <>
            <Field label="Payé le">
              <input className="d-input" type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
            </Field>
            <Field label="Payé par" full group>
              <div className="d-filters">
                {members.map((m) => (
                  <button key={m.id} type="button" className={`d-pill d-pill-person${payerId === m.id ? " is-on" : ""}`} aria-pressed={payerId === m.id} onClick={() => setPayerId(m.id)}>
                    <Avatar member={m} size={24} />
                    {m.display_name}
                  </button>
                ))}
              </div>
            </Field>
          </>
        ) : null}
        <Field label="Descriptif (facultatif)" full>
          <textarea className="d-textarea" rows={2} value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="Acompte réglé à la signature, chèque remis en main propre, remise de 10 % négociée…" />
        </Field>
        <Field label="Facture ou devis (facultatif)" full group>
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
  );
}
