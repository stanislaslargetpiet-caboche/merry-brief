"use client";

// Gérer les groupes (depuis le lien du même nom dans Filtres, artboard 1f2) : renommer, changer la couleur, supprimer.
// On range un invité dans un groupe depuis sa pastille (GroupCell) ; on gère la liste des groupes ici.

import { useState } from "react";
import { useDash } from "@/lib/dash/store";
import { normalize, uid } from "@/lib/dash/format";
import { PASTEL_KEYS, pastel } from "@/lib/dash/theme";
import { Icon } from "./icons";
import { Btn, Modal } from "./ui";

function GroupRow({ group, count, onDelete }) {
  const dash = useDash();
  const [name, setName] = useState(group.name);

  const commitName = () => {
    const n = name.trim();
    if (!n) {
      setName(group.name);
      return;
    }
    if (n !== group.name) dash.update("guest_groups", group.id, { name: n.slice(0, 60) });
  };

  return (
    <li className="d-moment">
      <input
        className="d-input"
        style={{ flex: "1 1 220px" }}
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={commitName}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            e.currentTarget.blur();
          }
        }}
        maxLength={60}
        aria-label={`Nom du groupe ${group.name}`}
      />
      <span className="d-group-colors" role="radiogroup" aria-label={`Couleur du groupe ${group.name}`}>
        {PASTEL_KEYS.map((k) => (
          <button key={k} type="button" role="radio" aria-checked={group.color === k} aria-label={k} className={`d-group-color${group.color === k ? " is-on" : ""}`} style={{ background: pastel(k).bg }} onClick={() => dash.update("guest_groups", group.id, { color: k })} />
        ))}
      </span>
      <span className="d-small d-muted d-moment-count">
        {count} invité{count > 1 ? "s" : ""}
      </span>
      <button type="button" className="d-icon-btn is-flat is-danger" onClick={onDelete} aria-label={`Supprimer le groupe ${group.name}`} title="Supprimer ce groupe">
        <Icon name="trash" size={16} sw={2} />
      </button>
    </li>
  );
}

export default function GroupsModal({ onClose }) {
  const dash = useDash();
  const { groups, guests } = dash.data;
  const sorted = [...groups].sort((a, b) => a.position - b.position);
  const countOf = (id) => guests.filter((g) => g.group_id === id).length;
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  async function destroy(group) {
    const count = countOf(group.id);
    const msg = count ? `Supprimer le groupe « ${group.name} » ? ${count} invité${count > 1 ? "s" : ""} repasse${count > 1 ? "nt" : ""} « Sans groupe ».` : `Supprimer le groupe « ${group.name} » ?`;
    if (!window.confirm(msg)) return;
    await dash.remove("guest_groups", group.id);
  }

  async function add(e) {
    e.preventDefault();
    const n = name.trim();
    if (!n || busy) return;
    const exists = groups.find((g) => normalize(g.name) === normalize(n));
    if (exists) {
      setName("");
      return;
    }
    setBusy(true);
    const color = PASTEL_KEYS[groups.length % PASTEL_KEYS.length];
    await dash.insert("guest_groups", { id: uid(), name: n, color, position: groups.length });
    setName("");
    setBusy(false);
  }

  return (
    <Modal title="Gérer les groupes" onClose={onClose} wide footer={<Btn onClick={onClose}>Terminé</Btn>}>
      {sorted.length ? (
        <ul className="d-moments">
          {sorted.map((g) => (
            <GroupRow key={g.id} group={g} count={countOf(g.id)} onDelete={() => destroy(g)} />
          ))}
        </ul>
      ) : (
        <p className="d-small d-muted" style={{ margin: 0 }}>
          Aucun groupe pour l'instant.
        </p>
      )}
      <form className="d-moment-add" onSubmit={add}>
        <strong style={{ fontSize: 14 }}>Ajouter un groupe</strong>
        <div className="d-moment-add-row">
          <label className="d-moment-field" style={{ flex: "1 1 220px" }}>
            <span>Nom du groupe</span>
            <input className="d-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Famille de Léo, Amis de Léa…" maxLength={60} />
          </label>
          <Btn type="submit" small icon="plus" disabled={!name.trim() || busy}>
            Ajouter
          </Btn>
        </div>
      </form>
      <p className="d-small d-muted" style={{ margin: 0 }}>
        Supprimer un groupe ne supprime pas les invités : ils repassent « Sans groupe ».
      </p>
    </Modal>
  );
}
