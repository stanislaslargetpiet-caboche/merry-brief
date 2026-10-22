"use client";

import { useMemo, useState } from "react";
import { useDash } from "@/lib/dash/store";
import { normalize, parseAmount } from "@/lib/dash/format";
import { syncNames } from "@/lib/dash/names";
import { applyShift, shiftPlan } from "@/lib/dash/shift";
import ShiftOption from "./ShiftOption";
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
  // Changer la date : les tâches de Merry et les moments calés dessus peuvent suivre
  const [shift, setShift] = useState(true);
  const plan = useMemo(() => shiftPlan(dash.data, w.wedding_date || null, form.wedding_date || null), [dash.data, w.wedding_date, form.wedding_date]);

  async function save(e) {
    e.preventDefault();
    const budget = parseAmount(form.budget_total);
    const names = { partner1: form.partner1.trim() || w.partner1, partner2: form.partner2.trim() || null };
    await dash.updateWedding({
      ...names,
      wedding_date: form.wedding_date || null,
      venue: form.venue.trim() || null,
      region: form.region.trim() || null,
      budget_total: budget,
    });
    if (plan && shift) await applyShift(dash, plan);
    // Les copies du prénom (organisateurs, groupes, titre du formulaire) suivent
    await syncNames(dash, { partner1: w.partner1, partner2: w.partner2 }, names);
    // Le budget est fixé : la tâche « Fixer le budget » du rétroplanning est faite, on ne la redemande pas
    if (budget !== null && budget !== undefined) {
      const now = new Date().toISOString();
      for (const t of dash.data.tasks.filter((x) => !x.done && normalize(x.title) === "fixer le budget")) await dash.update("tasks", t.id, { done: true, done_at: now });
    }
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
        <ShiftOption plan={plan} checked={shift} onChange={setShift} />
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
