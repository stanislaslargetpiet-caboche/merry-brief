"use client";

// Frise mois par mois du rétroplanning : tâches faites sur prévues, et les grandes dates épinglées.

import { monthTimeline } from "@/lib/dash/dates";
import { dayMonth } from "@/lib/dash/format";
import { Icon } from "./icons";

export default function Timeline({ data, onPinClick }) {
  const months = monthTimeline(data);
  if (!months.length) return null;
  let lastYear = null;
  const pins = months.flatMap((m) => m.pins);
  return (
    <div className="d-card d-timeline-card">
      <div className="d-timeline" role="list" aria-label="Frise du rétroplanning, mois par mois">
        {months.map((m) => {
          const showYear = m.year !== lastYear;
          lastYear = m.year;
          const pct = m.total ? Math.round((m.done / m.total) * 100) : 0;
          return (
            <div key={m.key} className={`d-tl-month${m.now ? " is-now" : ""}${m.total ? "" : " is-empty"}`} role="listitem" title={m.pins.length ? m.pins.map((p) => `${p.label} · ${dayMonth(p.date)}`).join(", ") : undefined}>
              <div className="d-tl-marks" aria-hidden="true">
                {m.pins.map((p) => (
                  <span key={p.key} className={`d-tl-mark${p.main ? " is-main" : ""}`} />
                ))}
              </div>
              <div className="d-tl-bar" aria-hidden="true">
                <span style={{ width: `${pct}%` }} />
              </div>
              <div className="d-tl-label">
                <strong>
                  {m.label}
                  {showYear ? ` ${String(m.year).slice(2)}` : ""}
                </strong>
                <span className={m.late ? "is-late" : ""}>{m.total ? `${m.done}/${m.total}` : "–"}</span>
              </div>
            </div>
          );
        })}
      </div>
      {pins.length ? (
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
      ) : null}
    </div>
  );
}
