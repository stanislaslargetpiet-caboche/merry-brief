"use client";

// Les groupes d'invités (famille, amis…) : renommer, recolorer, supprimer.
// Un invité n'a qu'un seul groupe à la fois (contrairement aux moments).

import { useState } from "react";
import { useDash } from "@/lib/dash/store";
import { uid } from "@/lib/dash/format";
import { PASTEL_KEYS, pastel } from "@/lib/dash/theme";
import { Icon } from "./icons";
import { Btn, Modal } from "./ui";

function GroupField({ value, onSave }) {
  const [draft, setDraft] = useState(value || "");
  const commit = () => {
    const next = draft.trim();
    if (!next) {
      setDraft(value || "");
      return;
    }
    if (next !== value) onSave(next);
  };
  return (
    <label className="d-moment-field">
      <span>Nom du groupe</span>
      <input
        className="d-input"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            e.currentTarget.blur();
          }
          if (e.key === "Escape") {
            e.stopPropagation();
            setDraft(value || "");
          }
        }}
        maxLength={60}
      />
    </label>
  );
}

export default function GroupsModal({ onClose }) {
  const dash = useDash();
  const { groups, guests } = dash.data;
  const sorted = [...groups].sort((a, b) => a.position - b.position);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const countIn = (groupId) => guests.filter((g) => g.group_id === groupId).length;

  function recolor(group) {
    const i = PASTEL_KEYS.indexOf(group.color);
    const next = PASTEL_KEYS[(i + 1) % PASTEL_KEYS.length];
    dash.update("guest_groups", group.id, { color: next });
  }

  async function del(group) {
    const n = countIn(group.id);
    const msg = n ? `Supprimer le groupe « ${group.name} » ? ${n} invité${n > 1 ? "s" : ""} repasse${n > 1 ? "nt" : ""} « Sans groupe ».` : `Supprimer le groupe « ${group.name} » ?`;
    if (window.confirm(msg)) await dash.remove("guest_groups", group.id);
  }

  async function add(e) {
    e.preventDefault();
    const n = name.trim();
    if (!n || busy) return;
    setBusy(true);
    const position = sorted.length ? Math.max(...sorted.map((x) => x.position)) + 1 : 0;
    await dash.insert("guest_groups", { id: uid(), name: n, color: PASTEL_KEYS[sorted.length % PASTEL_KEYS.length], position });
    setName("");
    setBusy(false);
  }

  return (
    <Modal title="Les groupes d'invités" onClose={onClose} wide footer={<Btn onClick={onClose}>Terminé</Btn>}>
      <ul className="d-moments d-groups-list">
        {sorted.map((g) => {
          const p = pastel(g.color);
          const n = countIn(g.id);
          return (
            <li key={g.id} className="d-moment d-groups-row">
              <button type="button" className="d-group-swatch" style={{ background: p.mid }} onClick={() => recolor(g)} aria-label={`Changer la couleur de ${g.name}`} title="Changer la couleur" />
              <GroupField value={g.name} onSave={(v) => dash.update("guest_groups", g.id, { name: v })} />
              <span className="d-small d-muted d-moment-count">
                {n} invité{n > 1 ? "s" : ""}
              </span>
              <button type="button" className="d-icon-btn is-flat is-danger" onClick={() => del(g)} aria-label={`Supprimer le groupe ${g.name}`} title="Supprimer ce groupe">
                <Icon name="trash" size={16} sw={2} />
              </button>
            </li>
          );
        })}
        {!sorted.length ? <p className="d-muted d-small" style={{ margin: 0, padding: "10px 0" }}>Pas encore de groupe.</p> : null}
      </ul>
      <form className="d-moment-add" onSubmit={add}>
        <strong style={{ fontSize: 14 }}>Ajouter un groupe</strong>
        <div className="d-moment-add-row">
          <label className="d-moment-field" style={{ flex: "1 1 220px" }}>
            <span>Nom du groupe</span>
            <input className="d-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Collègues, témoins, voisins…" maxLength={60} />
          </label>
          <Btn type="submit" small icon="plus" disabled={!name.trim() || busy}>
            Ajouter
          </Btn>
        </div>
      </form>
    </Modal>
  );
}
