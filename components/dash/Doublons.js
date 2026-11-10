"use client";

// Doublons possibles dans la liste des invités : chaque ligne propose de fusionner un invité avec celui
// de la liste qui lui ressemble (nom proche, même adresse email). Rien n'est fusionné sans un clic.

import { useState } from "react";
import { guestLabel } from "@/lib/dash/model";
import { Icon } from "./icons";

const WHY = { email: "même adresse email", phone: "même téléphone", name_exact: "même nom", name_close: "nom proche" };

export default function Doublons({ suggestions, byId, onMerge, onReject }) {
  const [open, setOpen] = useState(false);
  const rows = suggestions.filter((s) => byId.get(s.keepId) && byId.get(s.dropId));
  if (!rows.length) return null;
  const shown = open ? rows : rows.slice(0, 1);
  return (
    <div className="d-dup" role="status">
      <div className="d-dup-head">
        <Icon name="users" size={15} sw={2.2} />
        <b>{rows.length > 1 ? `${rows.length} doublons possibles` : "Un doublon possible"}</b>
        {rows.length > 1 ? (
          <button type="button" className="d-pill" onClick={() => setOpen((v) => !v)}>
            {open ? "Réduire" : "Tout voir"}
          </button>
        ) : null}
      </div>
      {shown.map((s) => {
        const keep = byId.get(s.keepId);
        const drop = byId.get(s.dropId);
        return (
          <div className="d-dup-row" key={`${s.keepId}|${s.dropId}`}>
            <span>
              <b>{guestLabel(drop, byId)}</b> ressemble à <b>{guestLabel(keep, byId)}</b>
              <span className="d-dup-why"> · {WHY[s.reason] || "nom proche"}</span>
            </span>
            <button type="button" className="d-pill is-on" onClick={() => onMerge(s)}>
              Fusionner
            </button>
            <button type="button" className="d-pill" onClick={() => onReject(s)}>
              Ce n'est pas lui
            </button>
          </div>
        );
      })}
    </div>
  );
}
