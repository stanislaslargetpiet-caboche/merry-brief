"use client";

// Date de saison (Tarifs > Saisons) : un calendrier à cliquer plutôt qu'un champ à taper (demande de
// Stan le 3 nov. 2026, « beaucoup plus delightful »). Le mois et le jour seuls comptent, l'année est
// ignorée (une saison se répète chaque année) ; 2024 sert juste de référence bissextile pour que
// février propose bien 29 jours. Le texte enregistré (« 1 mai ») ne change pas : lib/pro/format.js
// (seasonOf) le relit tel quel.

import { useState } from "react";
import { Popover } from "@/components/dash/ui";
import { ProIcon } from "./icons";

const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const MONTH_INDEX = Object.fromEntries(MONTHS.map((m, i) => [m, i]));

function parse(text) {
  const m = String(text || "")
    .toLowerCase()
    .match(/(\d{1,2})(?:er)?\s+([a-zéû]+)/);
  if (!m || MONTH_INDEX[m[2]] === undefined) return null;
  return { day: Number(m[1]), month: MONTH_INDEX[m[2]] };
}
const format = (day, month) => `${day === 1 ? "1er" : day} ${MONTHS[month]}`;
const daysInMonth = (month) => new Date(2024, month + 1, 0).getDate();

export default function SeasonDatePicker({ id, label, value, onSave }) {
  const parsed = parse(value);
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(parsed?.month ?? 0);

  function pick(day) {
    onSave(format(day, month));
    setOpen(false);
  }

  return (
    <div className="p-field">
      <label htmlFor={id}>{label}</label>
      <span className="d-anchor">
        <button
          id={id}
          type="button"
          className="p-season-btn"
          onClick={() => {
            setMonth(parsed?.month ?? month);
            setOpen((o) => !o);
          }}
        >
          <ProIcon name="calendar" size={15} stroke="#6b6a63" />
          {value || "À définir"}
        </button>
        <Popover open={open} onClose={() => setOpen(false)}>
          <div className="p-season-cal">
            <div className="p-season-cal-head">
              <button type="button" aria-label="Mois précédent" onClick={() => setMonth((m) => (m + 11) % 12)}>
                <ProIcon name="prev" size={14} sw={2} />
              </button>
              <span>{MONTHS[month]}</span>
              <button type="button" aria-label="Mois suivant" onClick={() => setMonth((m) => (m + 1) % 12)}>
                <ProIcon name="next" size={14} sw={2} />
              </button>
            </div>
            <div className="p-season-cal-grid">
              {Array.from({ length: daysInMonth(month) }, (_, i) => i + 1).map((day) => (
                <button key={day} type="button" className={`p-season-cal-day${parsed?.month === month && parsed?.day === day ? " is-on" : ""}`} onClick={() => pick(day)}>
                  {day}
                </button>
              ))}
            </div>
          </div>
        </Popover>
      </span>
    </div>
  );
}
