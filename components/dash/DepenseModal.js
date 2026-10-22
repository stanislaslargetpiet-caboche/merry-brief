"use client";

// Ajouter une dépense déjà payée : pour quel poste, quoi, combien, payée par qui et quand.
// Elle s'inscrit dans le poste (tableau « Par poste ») et dans « Qui a payé quoi ».

import { useState } from "react";
import { useDash } from "@/lib/dash/store";
import { itemFinance } from "@/lib/dash/model";
import { euros, parseAmount, todayIso, uid } from "@/lib/dash/format";
import { guessIcon } from "./icons";
import { Avatar, Btn, Field, Modal } from "./ui";

const KINDS = ["Acompte", "Solde", "Paiement"];

export default function DepenseModal({ onClose, itemId: initialItem }) {
  const dash = useDash();
  const { items, members, meId, payments } = dash.data;
  const [itemId, setItemId] = useState(initialItem || items[0]?.id || "new");
  const [newLabel, setNewLabel] = useState("");
  const [kind, setKind] = useState("Acompte");
  const [other, setOther] = useState("");
  const [amount, setAmount] = useState("");
  const [paidAt, setPaidAt] = useState(todayIso());
  const [payerId, setPayerId] = useState(meId || members[0]?.id || null);
  const [url, setUrl] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const isNew = itemId === "new" || !items.length;
  const item = items.find((i) => i.id === itemId);
  const value = parseAmount(amount);
  const payer = members.find((m) => m.id === payerId);
  const badUrl = url.trim() && !/^https?:\/\//i.test(url.trim());
  const label = kind === "Autre" ? other.trim() || "Paiement" : kind;
  const ready = value !== null && value > 0 && (!isNew || newLabel.trim()) && !badUrl;

  async function save(e) {
    e?.preventDefault();
    if (!ready || busy) return;
    setBusy(true);
    let id = item?.id;
    if (isNew) {
      id = uid();
      await dash.insert("budget_items", { id, label: newLabel.trim(), icon: guessIcon(newLabel), position: items.length });
    }
    await dash.insert("payments", { budget_item_id: id, label, amount: value, paid_at: paidAt || todayIso(), payer_id: payerId || null, due_date: null, note: note.trim().slice(0, 500) || null });
    if (url.trim()) await dash.insert("documents", { budget_item_id: id, vendor_id: item?.vendor_id || null, kind: "facture", name: `Facture · ${label}`, url: url.trim() });
    dash.setToast({ kind: "ok", text: `${euros(value)} ajoutés à ${isNew ? newLabel.trim() : item.label}.` });
    onClose();
  }

  const f = item ? itemFinance(item, payments) : null;
  const total = f ? f.quote ?? f.budgeted : null;

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
        <Field label="Pour quel poste ?" full>
          <select className="d-select" value={isNew ? "new" : itemId} onChange={(e) => setItemId(e.target.value)} autoFocus>
            {items.map((i) => (
              <option key={i.id} value={i.id}>
                {i.label}
              </option>
            ))}
            <option value="new">Nouveau poste…</option>
          </select>
        </Field>
        {isNew ? (
          <Field label="Nom du nouveau poste" full>
            <input className="d-input" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="Faire-part, coiffure, navette…" />
          </Field>
        ) : null}
        <Field label="Quoi ?" full group>
          <div className="d-filters">
            {[...KINDS, "Autre"].map((k) => (
              <button key={k} type="button" className={`d-pill${kind === k ? " is-on" : ""}`} aria-pressed={kind === k} onClick={() => setKind(k)}>
                {k}
              </button>
            ))}
            {kind === "Autre" ? <input className="d-input" style={{ flex: "1 1 160px", width: "auto" }} value={other} onChange={(e) => setOther(e.target.value)} placeholder="Essayage, location…" aria-label="Quoi" /> : null}
          </div>
        </Field>
        <Field label="Montant (€)">
          <input className="d-input" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="690" />
        </Field>
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
        <Field label="Descriptif (facultatif)" full>
          <textarea className="d-textarea" rows={2} value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="Acompte réglé à la signature, chèque remis en main propre, remise de 10 % négociée…" />
        </Field>
        <Field label="Lien de la facture (facultatif)" full hint={badUrl ? "Le lien doit commencer par https://" : "Drive, Dropbox, pièce jointe d'un mail… n'importe quel lien."}>
          <input className="d-input" type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" />
        </Field>
        <button type="submit" hidden />
      </form>
      {value && (item || newLabel.trim()) ? (
        <div className="d-note-ok">
          Elle s'ajoute au poste <b>{isNew ? newLabel.trim() : item.label}</b>
          {f && total ? ` (${euros(f.paid + value)} payés sur ${euros(total)})` : ""}
          {payer ? (
            <>
              {" "}et à la part de <b>{payer.display_name}</b> dans « Qui a payé quoi ».
            </>
          ) : (
            "."
          )}
        </div>
      ) : null}
    </Modal>
  );
}
