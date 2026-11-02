"use client";

// Les paiements d'un poste : ce qui reste à payer (avec sa date), ce qui est déjà payé et par qui.
// Une échéance se marque payée d'un clic ; chaque paiement se modifie (montant, date, payeur) ou se supprime.

import { useState } from "react";
import { useDash } from "@/lib/dash/store";
import { itemFinance, posteName } from "@/lib/dash/model";
import { euros, parseAmount, shortDate, todayIso } from "@/lib/dash/format";
import { Icon } from "./icons";
import { Avatar, Btn, Field, Modal } from "./ui";

function PaymentForm({ payment, members, onCancel, onSave }) {
  const [label, setLabel] = useState(payment.label || "");
  const [amount, setAmount] = useState(payment.amount === null || payment.amount === undefined ? "" : String(payment.amount));
  const [paid, setPaid] = useState(Boolean(payment.paid_at));
  const [date, setDate] = useState(payment.paid_at || payment.due_date || "");
  const [payerId, setPayerId] = useState(payment.payer_id || null);
  const [note, setNote] = useState(payment.note || "");
  const value = parseAmount(amount);
  const ready = value !== null && value > 0;

  function submit(e) {
    e?.preventDefault();
    if (!ready) return;
    onSave({
      label: label.trim().slice(0, 120) || "Paiement",
      amount: value,
      paid_at: paid ? date || todayIso() : null,
      due_date: paid ? payment.due_date || null : date || null,
      payer_id: paid ? payerId : null,
      note: note.trim().slice(0, 500) || null,
    });
  }

  return (
    <form className="d-form-grid d-pay-form" onSubmit={submit}>
      <Field label="Libellé">
        <input className="d-input" value={label} onChange={(e) => setLabel(e.target.value)} maxLength={120} placeholder="Acompte, solde…" />
      </Field>
      <Field label="Montant (€)">
        <input className="d-input" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
      </Field>
      <Field label="Statut" full group>
        <div className="d-filters" role="radiogroup" aria-label="C'est payé ou à payer">
          <button type="button" className={`d-pill${paid ? " is-on" : ""}`} aria-pressed={paid} onClick={() => setPaid(true)}>
            C&rsquo;est payé
          </button>
          <button type="button" className={`d-pill${!paid ? " is-on" : ""}`} aria-pressed={!paid} onClick={() => setPaid(false)}>
            À payer
          </button>
        </div>
      </Field>
      <Field label={paid ? "Payé le" : "À payer le · facultatif"}>
        <input className="d-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </Field>
      {paid ? (
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
      ) : null}
      <Field label="Descriptif · facultatif" full>
        <textarea className="d-textarea" rows={2} value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
      </Field>
      <div className="d-pay-form-actions">
        <Btn kind="ghost" small onClick={onCancel}>
          Annuler
        </Btn>
        <Btn small type="submit" disabled={!ready}>
          Enregistrer
        </Btn>
      </div>
    </form>
  );
}

export default function PaiementsModal({ item, onClose, onAdd }) {
  const dash = useDash();
  const { payments, members, meId, wedding } = dash.data;
  const [editing, setEditing] = useState(null); // id du paiement en cours de modification
  const memberById = new Map(members.map((m) => [m.id, m]));
  const f = itemFinance(item, payments);
  const upcoming = f.upcoming;
  const done = [...f.paidList].sort((a, z) => String(z.paid_at).localeCompare(String(a.paid_at)));

  async function markPaid(p) {
    const payer = p.payer_id || meId || members[0]?.id || null;
    await dash.update("payments", p.id, { paid_at: todayIso(), payer_id: payer });
    dash.setToast({ kind: "ok", text: `${euros(p.amount)} marqués payés${memberById.get(payer) ? ` par ${memberById.get(payer).display_name}` : ""}. Vous pouvez changer la date ou le payeur.` });
  }

  async function save(p, patch) {
    await dash.update("payments", p.id, patch);
    setEditing(null);
  }

  async function del(p) {
    if (!window.confirm(`Supprimer le paiement « ${p.label} » de ${euros(p.amount)} ?`)) return;
    await dash.remove("payments", p.id);
  }

  const when = (p) => {
    if (p.paid_at) return `Payé le ${shortDate(p.paid_at)}`;
    if (!p.due_date) return "Date à fixer";
    if (wedding.wedding_date && p.due_date === wedding.wedding_date) return "Le jour J";
    return p.due_date < todayIso() ? `Prévu le ${shortDate(p.due_date)} · en retard` : `Le ${shortDate(p.due_date)}`;
  };

  const row = (p) =>
    editing === p.id ? (
      <li key={p.id} className="is-editing">
        <PaymentForm payment={p} members={members} onCancel={() => setEditing(null)} onSave={(patch) => save(p, patch)} />
      </li>
    ) : (
      <li key={p.id}>
        <span className="d-pay-text">
          <strong>{p.label}</strong>
          <small className={!p.paid_at && p.due_date && p.due_date < todayIso() ? "is-late" : undefined}>
            {when(p)}
            {p.paid_at && memberById.get(p.payer_id) ? ` · ${memberById.get(p.payer_id).display_name}` : p.paid_at ? " · payeur à indiquer" : ""}
          </small>
        </span>
        <strong className="d-pay-amount">{euros(p.amount)}</strong>
        <span className="d-pay-tools">
          {!p.paid_at ? (
            <button type="button" className="d-pill is-small" onClick={() => markPaid(p)}>
              <Icon name="check" size={12} sw={2.4} />
              Marquer payé
            </button>
          ) : null}
          <button type="button" className="d-icon-btn is-flat" onClick={() => setEditing(p.id)} aria-label={`Modifier ${p.label}`} title="Modifier">
            <Icon name="pencil" size={15} sw={2} />
          </button>
          <button type="button" className="d-icon-btn is-flat is-danger" onClick={() => del(p)} aria-label={`Supprimer ${p.label}`} title="Supprimer">
            <Icon name="trash" size={15} sw={2} />
          </button>
        </span>
      </li>
    );

  return (
    <Modal
      title={`Paiements · ${posteName(item)}`}
      onClose={onClose}
      footer={
        <>
          <span className="d-spacer" />
          <Btn kind="ghost" onClick={onClose}>
            Fermer
          </Btn>
          <Btn icon="plus" onClick={onAdd}>
            Ajouter un paiement
          </Btn>
        </>
      }
    >
      <div className="d-col" style={{ gap: 18 }}>
        <div className="d-pay-summary">
          <span>
            <small>Montant prévu</small>
            <strong>{f.quote !== null ? euros(f.quote) : "–"}</strong>
          </span>
          <span>
            <small>Déjà payé</small>
            <strong>{euros(f.paid)}</strong>
          </span>
          <span>
            <small>Reste</small>
            <strong>{f.remaining !== null ? euros(f.remaining) : "–"}</strong>
          </span>
        </div>

        {upcoming.length ? (
          <section className="d-col" style={{ gap: 6 }}>
            <h3 className="d-pay-head">À payer</h3>
            <ul className="d-pay-list">{upcoming.map(row)}</ul>
          </section>
        ) : null}

        {done.length ? (
          <section className="d-col" style={{ gap: 6 }}>
            <h3 className="d-pay-head">Déjà payé</h3>
            <ul className="d-pay-list">{done.map(row)}</ul>
          </section>
        ) : null}

        {!upcoming.length && !done.length ? <p className="d-small d-muted" style={{ margin: 0 }}>Aucun paiement noté pour ce poste.</p> : null}
      </div>
    </Modal>
  );
}
