"use client";

// Case à cocher affichée quand changer la date du mariage déplacerait des tâches ou des moments.

const plural = (n, one, many) => `${n} ${n > 1 ? many : one}`;

export default function ShiftOption({ plan, checked, onChange }) {
  if (!plan) return null;
  const n = plan.tasks.length;
  const m = plan.events.length;
  const parts = [n ? plural(n, "tâche ajoutée par Merry", "tâches ajoutées par Merry") : "", m ? plural(m, "moment", "moments") : ""].filter(Boolean).join(" et ");
  const text =
    plan.mode === "date"
      ? n > 1
        ? `Dater les ${n} tâches que Merry a créées sans date`
        : "Dater la tâche que Merry a créée sans date"
      : `Décaler aussi de ${plan.days > 0 ? "+" : ""}${plural(plan.days, "jour", "jours")} : ${parts}`;
  return (
    <label className="d-check-line" style={{ gridColumn: "1 / -1" }}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{text}</span>
    </label>
  );
}
