"use client";

// Pastille de groupe d'un invité, qui ouvre le choix du groupe (ou en crée un) : dans le tableau
// de la liste et sur la fiche. Retirer l'invité ne se fait pas ici (menu de la ligne ou de la fiche),
// pour qu'un clic de trop en changeant de groupe ne supprime personne.

import { useState } from "react";
import { useDash } from "@/lib/dash/store";
import { normalize, uid } from "@/lib/dash/format";
import { PASTEL_KEYS } from "@/lib/dash/theme";
import { Icon } from "./icons";
import { Btn, GroupChip, Popover } from "./ui";

export default function GroupCell({ guest, group, groups, label, small = true }) {
  const dash = useDash();
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const close = () => {
    setOpen(false);
    setCreating(false);
    setName("");
  };
  const create = async (e) => {
    e.preventDefault();
    const n = name.trim();
    if (!n) return;
    const exists = groups.find((g) => normalize(g.name) === normalize(n));
    let id = exists?.id;
    if (!id) {
      id = uid();
      const color = PASTEL_KEYS[groups.length % PASTEL_KEYS.length];
      await dash.insert("guest_groups", { id, name: n, color, position: groups.length });
    }
    dash.update("guests", guest.id, { group_id: id });
    close();
  };
  return (
    <span className="d-anchor">
      <GroupChip group={group} small={small} onClick={() => (open ? close() : setOpen(true))} />
      <Popover open={open} onClose={close}>
        <span className="d-pop-label d-small d-muted" style={{ padding: "4px 8px" }}>
          Groupe de {label}
        </span>
        {groups.map((g) => (
          <button
            key={g.id}
            type="button"
            className={`d-pop-item${g.id === guest.group_id ? " is-on" : ""}`}
            onClick={() => {
              dash.update("guests", guest.id, { group_id: g.id });
              close();
            }}
          >
            <GroupChip group={g} />
            {g.id === guest.group_id ? <Icon name="check" size={14} sw={2.2} /> : null}
          </button>
        ))}
        {guest.group_id ? (
          <button
            type="button"
            className="d-pop-item"
            onClick={() => {
              dash.update("guests", guest.id, { group_id: null });
              close();
            }}
          >
            <span className="d-pop-label">Sans groupe</span>
          </button>
        ) : null}
        {creating ? (
          <form onSubmit={create} style={{ display: "flex", gap: 6, padding: "4px 2px" }}>
            <input className="d-input" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom du groupe" maxLength={60} aria-label="Nom du nouveau groupe" style={{ minWidth: 150 }} />
            <Btn type="submit" small disabled={!name.trim()}>
              Créer
            </Btn>
          </form>
        ) : (
          <button type="button" className="d-pop-item" onClick={() => setCreating(true)}>
            <span className="d-pop-label">
              <Icon name="plus" size={14} sw={2.2} />
              Nouveau groupe
            </span>
          </button>
        )}
      </Popover>
    </span>
  );
}
