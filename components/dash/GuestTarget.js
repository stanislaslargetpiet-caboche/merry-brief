"use client";

// Cible et réalité : ce que le couple avait en tête (la fourchette d'invités du brief) face à la liste
// (ceux qui viennent, ceux qui n'ont pas répondu) et une projection, pour savoir tôt si on sera dans les clous.

import { useState } from "react";
import { useDash } from "@/lib/dash/store";
import { guestStats } from "@/lib/dash/model";
import { GUEST_RANGES, guestsOf } from "@/lib/dash/criteria";
import { Icon } from "./icons";
import { Popover } from "./ui";

export function projection(g) {
  // Taux de oui parmi ceux qui ont répondu ; sans réponse encore, on table sur 85 % (ordre de grandeur habituel)
  const rate = g.answered >= 10 ? g.oui / g.answered : 0.85;
  return { rate, value: Math.round(g.oui + g.attente * rate) };
}

export default function GuestTarget({ data, filtered }) {
  const dash = useDash();
  const [open, setOpen] = useState(false);
  const g = guestStats(data);
  const { range } = guestsOf(data);
  const p = projection(g);
  if (!g.invited) return null;
  const scale = Math.max(g.invited, range?.max || 0, 1);
  const w = (x) => `${(x / scale) * 100}%`;
  const verdict = !range ? null : p.value > range.max ? { tone: "over", text: `au-dessus de la cible de ${p.value - range.max}` } : p.value < range.min ? { tone: "under", text: `sous la cible de ${range.min - p.value}` } : { tone: "ok", text: "dans la cible" };
  return (
    <div className={`d-target${filtered ? " is-filtered" : ""}`} aria-label="Cible et projection">
      <div className="d-target-line">
        <span className="d-target-main">
          <b>{g.oui}</b> {g.oui > 1 ? "viennent" : "vient"}
          {g.attente ? (
            <>
              {" · "}
              <b>{g.attente}</b> en attente
            </>
          ) : null}
          {g.non ? (
            <>
              {" · "}
              <b>{g.non}</b> {g.non > 1 ? "ne viennent pas" : "ne vient pas"}
            </>
          ) : null}
        </span>
        <span className="d-target-right">
          {g.attente ? (
            <span className={`d-target-proj${verdict ? ` is-${verdict.tone}` : ""}`} title={`${g.oui} qui viennent + ${Math.round(p.rate * 100)} % des ${g.attente} en attente (${g.answered >= 10 ? "taux de oui parmi ceux qui ont répondu" : "ordre de grandeur, en attendant plus de réponses"})`}>
              Projection ≈ {p.value}
              {verdict ? ` · ${verdict.text}` : ""}
            </span>
          ) : null}
          <span className="d-anchor">
            <button type="button" className="d-target-pick" onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open} title="Modifier la cible (c'est la fourchette du brief)">
              <Icon name="users" size={13} sw={2.2} />
              {range ? `Cible : ${range.label.toLowerCase()}` : "Fixer une cible"}
              <Icon name="chevDown" size={11} sw={2.2} />
            </button>
            <Popover open={open} onClose={() => setOpen(false)} align="right">
              {GUEST_RANGES.map((r) => (
                <button
                  key={r.code}
                  type="button"
                  className={`d-pop-item${range?.code === r.code ? " is-on" : ""}`}
                  onClick={() => {
                    dash.saveBrief({ guests: r.code });
                    setOpen(false);
                  }}
                >
                  <span className="d-pop-label">{r.label}</span>
                  {range?.code === r.code ? <Icon name="check" size={14} sw={2.2} /> : null}
                </button>
              ))}
              <span className="d-pop-label d-muted d-small" style={{ padding: "4px 8px", maxWidth: 240, whiteSpace: "normal" }}>
                La cible est celle du brief : la changer ici la change aussi pour les prestataires.
              </span>
            </Popover>
          </span>
        </span>
      </div>
      <div className="d-target-bar" role="img" aria-label={`${g.oui} viennent, ${g.attente} en attente${range ? `, cible ${range.min} à ${range.max}` : ""}`}>
        <span className="d-target-oui" style={{ width: w(g.oui) }} />
        <span className="d-target-proj-seg" style={{ left: w(g.oui), width: w(Math.max(0, p.value - g.oui)) }} />
        <span className="d-target-attente" style={{ left: w(p.value), width: w(Math.max(0, g.oui + g.attente - p.value)) }} />
        {range ? <span className="d-target-range" style={{ left: w(range.min), width: w(range.max - range.min) }} title={`Cible : ${range.min} à ${range.max}`} /> : null}
      </div>
    </div>
  );
}
