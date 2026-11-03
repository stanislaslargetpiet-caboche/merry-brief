"use client";

// Réunir des organisateurs d'une même famille (« Léa et ses parents comptent pour 1 ») : une fois réunis,
// ils comptent ensemble dans « Par personne » et plus aucun virement ne leur est suggéré entre eux.
// weddings.layouts.payerGroups = [[id, id, …], …], ≥ 2 ids chacun ; un organisateur sans groupe reste seul.

import { useState } from "react";
import { useDash } from "@/lib/dash/store";
import { groupLabel, groupedPayers } from "@/lib/dash/partage";
import { Avatar, Btn, Faces, Modal } from "./ui";

export default function PayerGroupsModal({ byPayer, groups, onClose }) {
  const dash = useDash();
  const [local, setLocal] = useState(groups);
  const [selected, setSelected] = useState(new Set());
  const rows = groupedPayers(byPayer, local);
  const grouped = rows.filter((r) => r.members.length > 1);
  const alone = rows.filter((r) => r.members.length === 1);

  async function save(next) {
    setLocal(next);
    await dash.saveLayout("payerGroups", next);
  }

  function merge() {
    if (selected.size < 2) return;
    save([...local, [...selected]]);
    setSelected(new Set());
  }

  function split(row) {
    save(local.filter((g) => !row.members.some((m) => g.includes(m.id))));
  }

  function toggle(id) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <Modal title="Réunir des organisateurs" onClose={onClose}>
      <div className="d-col" style={{ gap: 18 }}>
        <p className="d-small d-muted" style={{ margin: 0 }}>
          Une fois réunis, ils comptent comme une seule personne dans « Par personne » et dans les virements à faire.
        </p>
        {grouped.length ? (
          <ul className="d-pay-list">
            {grouped.map((r) => (
              <li key={r.key}>
                <span className="d-pay-text" style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <Faces members={r.members} size={26} />
                  <strong>{groupLabel(r)}</strong>
                </span>
                <button type="button" className="d-link" style={{ fontSize: 13 }} onClick={() => split(r)}>
                  Séparer
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        {alone.length > 1 ? (
          <div className="d-col" style={{ gap: 10 }}>
            <div className="d-filters" role="group" aria-label="Choisir qui réunir">
              {alone.map((r) => (
                <button key={r.key} type="button" className={`d-pill d-pill-person${selected.has(r.key) ? " is-on" : ""}`} aria-pressed={selected.has(r.key)} onClick={() => toggle(r.key)}>
                  <Avatar member={r.members[0]} size={22} />
                  {r.members[0].display_name}
                </button>
              ))}
            </div>
            <Btn kind="ghost" small icon="check" onClick={merge} disabled={selected.size < 2}>
              Réunir {selected.size > 1 ? `(${selected.size})` : ""}
            </Btn>
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
