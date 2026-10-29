"use client";

// Le crayon d'un groupe dans les filtres de la liste (artboard 1f2) : renommer, changer la couleur, supprimer.
// On crée un groupe en rangeant un invité (menu de sa pastille) ; on le modifie là où on le filtre.

import { useState } from "react";
import { useDash } from "@/lib/dash/store";
import { PASTEL_KEYS, pastel } from "@/lib/dash/theme";
import { Icon } from "./icons";
import { Btn, Popover } from "./ui";

export default function GroupEdit({ group, count }) {
  const dash = useDash();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(group.name);
  const [color, setColor] = useState(group.color);

  const start = () => {
    setName(group.name);
    setColor(group.color);
    setOpen(true);
  };

  const save = async (e) => {
    e.preventDefault();
    const n = name.trim();
    if (!n) return;
    const patch = {};
    if (n !== group.name) patch.name = n.slice(0, 60);
    if (color !== group.color) patch.color = color;
    if (Object.keys(patch).length) await dash.update("guest_groups", group.id, patch);
    setOpen(false);
  };

  const destroy = async () => {
    const msg = count ? `Supprimer le groupe « ${group.name} » ? ${count} invité${count > 1 ? "s" : ""} repasse${count > 1 ? "nt" : ""} « Sans groupe ».` : `Supprimer le groupe « ${group.name} » ?`;
    if (!window.confirm(msg)) return;
    setOpen(false);
    await dash.remove("guest_groups", group.id);
  };

  return (
    <span className="d-anchor">
      <button type="button" className="d-icon-btn is-flat d-group-pen" onClick={() => (open ? setOpen(false) : start())} aria-label={`Modifier le groupe ${group.name}`} title="Modifier le groupe">
        <Icon name="pencil" size={13} sw={2} />
      </button>
      <Popover open={open} onClose={() => setOpen(false)}>
        <form className="d-group-edit" onSubmit={save}>
          <span className="d-group-edit-head">
            <strong>Modifier le groupe</strong>
            <span className="d-small d-muted">
              {count} invité{count > 1 ? "s" : ""}
            </span>
          </span>
          <input className="d-input" autoFocus value={name} onChange={(e) => setName(e.target.value)} maxLength={60} aria-label="Nom du groupe" />
          <span className="d-group-colors" role="radiogroup" aria-label="Couleur du groupe">
            {PASTEL_KEYS.map((k) => (
              <button key={k} type="button" role="radio" aria-checked={color === k} aria-label={k} className={`d-group-color${color === k ? " is-on" : ""}`} style={{ background: pastel(k).bg }} onClick={() => setColor(k)} />
            ))}
          </span>
          <span className="d-group-edit-foot">
            <button type="button" className="d-link is-danger" onClick={destroy}>
              Supprimer le groupe
            </button>
            <Btn type="submit" small disabled={!name.trim()}>
              Enregistrer
            </Btn>
          </span>
        </form>
      </Popover>
    </span>
  );
}
