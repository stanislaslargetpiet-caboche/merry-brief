"use client";

// Les grandes dates du rétroplanning en pastilles (civil, veille, jour J, brunch) ; la frise des mois est retirée.

import { monthTimeline } from "@/lib/dash/dates";
import { dayMonth } from "@/lib/dash/format";
import { Icon } from "./icons";

export default function Timeline({ data, onPinClick }) {
  const pins = monthTimeline(data).flatMap((m) => m.pins);
  if (!pins.length) return null;
  return (
    <div className="d-tl-pins">
      {pins.map((p) => (
        <button key={p.key} type="button" className={`d-tl-pin${p.main ? " is-main" : ""}`} title={p.full || p.label} onClick={onPinClick}>
          <Icon name="pin" size={11} sw={2.2} />
          <span>
            {p.label} · {dayMonth(p.date)}
          </span>
        </button>
      ))}
    </div>
  );
}
