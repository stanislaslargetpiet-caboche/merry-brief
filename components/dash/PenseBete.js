"use client";

import { useState } from "react";
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

export default function NoteRow({ note }) {
  const dash = useDash();
  const { members } = dash.data;
  const [editing, setEditing] = useState(false);
  const who = members.find((m) => m.id === note.added_by);

  const toggle = (done) => dash.update("pense_bete_items", note.id, { done, done_at: done ? new Date().toISOString() : null });
  const del = () => {
    if (window.confirm(`Supprimer « ${note.text} » ?`)) dash.remove("pense_bete_items", note.id);
  };

  return (
    <div className={`d-task${note.done ? " is-done" : ""}`}>
      <div className="d-task-main">
        <Checkbox done={note.done} onChange={toggle} label={note.done ? `Décocher : ${note.text}` : `Cocher : ${note.text}`} />
        <span className="d-task-title">
          <span>{note.text}</span>
        </span>
      </div>
      <div className="d-task-side">
        {who ? (
          <span className="d-desk-only">
            <Avatar member={who} size={26} />
          </span>
        ) : null}
        <button type="button" className="d-icon-btn is-flat" onClick={() => setEditing((x) => !x)} aria-label={`Modifier : ${note.text}`} title="Modifier">
          <Icon name="pencil" size={16} sw={1.9} />
        </button>
        <button type="button" className="d-icon-btn is-flat is-danger" onClick={del} aria-label={`Supprimer : ${note.text}`} title="Supprimer">
          <Icon name="trash" size={16} sw={1.9} />
        </button>
      </div>
      {editing ? <NoteForm note={note} onDone={() => setEditing(false)} /> : null}
    </div>
  );
}
