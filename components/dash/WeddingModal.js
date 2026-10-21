"use client";

import { useState } from "react";
import { useDash } from "@/lib/dash/store";
import { parseAmount } from "@/lib/dash/format";
import { Btn, Field, Modal } from "./ui";

export default function WeddingModal({ onClose }) {
  const dash = useDash();
  const w = dash.data.wedding;
  const [form, setForm] = useState({
    partner1: w.partner1 || "",
    partner2: w.partner2 || "",
    wedding_date: w.wedding_date || "",
    venue: w.venue || "",
    region: w.region || "",
    budget_total: w.budget_total ?? "",
  });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function save(e) {
    e.preventDefault();
    await dash.updateWedding({
      partner1: form.partner1.trim() || w.partner1,
      partner2: form.partner2.trim() || null,
      wedding_date: form.wedding_date || null,
      venue: form.venue.trim() || null,
      region: form.region.trim() || null,
      budget_total: parseAmount(form.budget_total),
    });
    onClose();
  }

  return (
    <Modal
      title="Votre mariage"
      onClose={onClose}
      footer={
        <>
          <Btn kind="ghost" onClick={onClose}>
            Annuler
          </Btn>
          <Btn type="submit" onClick={save}>
            Enregistrer
          </Btn>
        </>
      }
    >
      <form className="d-form-grid" onSubmit={save}>
        <Field label="Prénom">
          <input className="d-input" value={form.partner1} onChange={set("partner1")} required />
        </Field>
        <Field label="Prénom de votre moitié">
          <input className="d-input" value={form.partner2} onChange={set("partner2")} />
        </Field>
        <Field label="Date du mariage">
          <input className="d-input" type="date" value={form.wedding_date} onChange={set("wedding_date")} />
        </Field>
        <Field label="Budget initial (€)">
          <input className="d-input" inputMode="decimal" value={form.budget_total} onChange={set("budget_total")} placeholder="40 000" />
        </Field>
        <Field label="Lieu" full>
          <input className="d-input" value={form.venue} onChange={set("venue")} placeholder="Domaine des Oliviers" />
        </Field>
        <Field label="Région" full>
          <input className="d-input" value={form.region} onChange={set("region")} placeholder="Provence" />
        </Field>
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}
