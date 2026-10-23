"use client";

import { useRef, useState } from "react";
import { useDash } from "@/lib/dash/store";
import { Icon } from "./icons";
import { Avatar, Btn, Checkbox, Field } from "./ui";

function NoteForm({ note, onDone }) {
  const dash = useDash();
  const [text, setText] = useState(note.text);

  async function save(e) {
    e.preventDefault();
    const value = text.trim();
    if (!value) return;
    await dash.update("pense_bete_items", note.id, { text: value });
    onDone();
  }

  return (
    <form className="d-task-edit" onSubmit={save}>
      <Field label="Pense-bête" full>
        <input className="d-input" value={text} onChange={(e) => setText(e.target.value)} autoFocus required maxLength={300} />
      </Field>
      <div className="d-actions-end" style={{ gridColumn: "1 / -1" }}>
        <Btn kind="ghost" small onClick={onDone}>
          Annuler
        </Btn>
        <Btn type="submit" small>
          Enregistrer
        </Btn>
      </div>
    </form>
  );
}

// Ordinateur : ligne classique, crayon et poubelle toujours visibles (conforme à 6)
function DesktopRow({ note, who, onEdit, onDelete }) {
  const dash = useDash();
  const toggle = (done) => dash.update("pense_bete_items", note.id, { done, done_at: done ? new Date().toISOString() : null });

  return (
    <div className={`d-task d-desk-only${note.done ? " is-done" : ""}`}>
      <div className="d-task-main">
        <Checkbox done={note.done} onChange={toggle} label={note.done ? `Décocher : ${note.text}` : `Cocher : ${note.text}`} />
        <span className="d-task-title">
          <span>{note.text}</span>
        </span>
      </div>
      <div className="d-task-side">
        {who ? <Avatar member={who} size={26} /> : null}
        <button type="button" className="d-icon-btn is-flat" onClick={onEdit} aria-label={`Modifier : ${note.text}`} title="Modifier">
          <Icon name="pencil" size={16} sw={1.9} />
        </button>
        <button type="button" className="d-icon-btn is-flat is-danger" onClick={onDelete} aria-label={`Supprimer : ${note.text}`} title="Supprimer">
          <Icon name="trash" size={16} sw={1.9} />
        </button>
      </div>
    </div>
  );
}

// Téléphone : ligne nue (case + texte), glisser à gauche révèle Supprimer, à droite révèle Modifier (conforme à 6m)
function MobileRow({ note, onEdit, onDelete }) {
  const dash = useDash();
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const drag = useRef(null);
  const toggle = (done) => dash.update("pense_bete_items", note.id, { done, done_at: done ? new Date().toISOString() : null });

  const onPointerDown = (e) => {
    drag.current = { x: e.clientX, y: e.clientY, startDx: dx, axis: null };
  };
  const onPointerMove = (e) => {
    const d = drag.current;
    if (!d) return;
    const deltaX = e.clientX - d.x;
    const deltaY = e.clientY - d.y;
    if (!d.axis) {
      if (Math.abs(deltaX) < 8 && Math.abs(deltaY) < 8) return;
      d.axis = Math.abs(deltaX) > Math.abs(deltaY) ? "x" : "y";
      if (d.axis === "x") {
        try {
          e.currentTarget.setPointerCapture?.(e.pointerId);
        } catch {
          /* ignore: pointer already released or unsupported */
        }
        setDragging(true);
      }
    }
    if (d.axis !== "x") return;
    e.preventDefault();
    setDx(Math.max(-72, Math.min(72, d.startDx + deltaX)));
  };
  const onPointerUp = () => {
    const d = drag.current;
    drag.current = null;
    setDragging(false);
    if (d?.axis !== "x") return;
    setDx((cur) => (cur <= -36 ? -72 : cur >= 36 ? 72 : 0));
  };

  return (
    <div className="d-pb-swipe d-mob-only">
      <div className="d-pb-swipe-del">
        <button type="button" onClick={onDelete} aria-label={`Supprimer : ${note.text}`}>
          <Icon name="trash" size={18} sw={2} stroke="#ffffff" />
        </button>
      </div>
      <div className="d-pb-swipe-edit">
        <button type="button" onClick={onEdit} aria-label={`Modifier : ${note.text}`}>
          <Icon name="pencil" size={18} sw={2} stroke="#ffffff" />
        </button>
      </div>
      <label
        className="d-pb-swipe-row"
        style={{ transform: `translateX(${dx}px)`, transition: dragging ? "none" : "transform 160ms ease" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <input type="checkbox" checked={note.done} onChange={(e) => toggle(e.target.checked)} aria-label={note.done ? `Décocher : ${note.text}` : `Cocher : ${note.text}`} />
        <span className={note.done ? "is-done" : ""}>{note.text}</span>
      </label>
    </div>
  );
}

export default function NoteRow({ note }) {
  const dash = useDash();
  const { members } = dash.data;
  const [editing, setEditing] = useState(false);
  const who = members.find((m) => m.id === note.added_by);
  const toggleEdit = () => setEditing((x) => !x);
  const del = () => {
    if (window.confirm(`Supprimer « ${note.text} » ?`)) dash.remove("pense_bete_items", note.id);
  };

  return (
    <>
      <DesktopRow note={note} who={who} onEdit={toggleEdit} onDelete={del} />
      <MobileRow note={note} onEdit={toggleEdit} onDelete={del} />
      {editing ? <NoteForm note={note} onDone={() => setEditing(false)} /> : null}
    </>
  );
}
