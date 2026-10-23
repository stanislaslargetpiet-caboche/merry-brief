"use client";

import { useState } from "react";
import { useDash } from "@/lib/dash/store";
import { Icon } from "@/components/dash/icons";
import { Btn, PageHeader, Section } from "@/components/dash/ui";
import NoteRow from "@/components/dash/PenseBete";

export default function PenseBete() {
  const dash = useDash();
  const { notes = [], notesSetup, meId } = dash.data;
  const [adding, setAdding] = useState(false);
  const [text, setText] = useState("");

  const todo = notes.filter((n) => !n.done);
  const done = notes.filter((n) => n.done);

  async function addNote(e) {
    e.preventDefault();
    const value = text.trim();
    if (!value) return;
    setText("");
    setAdding(false);
    await dash.insert("pense_bete_items", { text: value, done: false, added_by: meId, position: notes.length });
  }

  return (
    <>
      <PageHeader
        title="Pense-bête."
        actions={
          <Btn icon="plus" onClick={() => setAdding((x) => !x)}>
            Ajouter
          </Btn>
        }
      />

      {dash.mode === "live" && !notesSetup ? (
        <div className="d-card is-panel">
          <strong>Le pense-bête n'est pas encore installé sur la base.</strong>
          <span className="d-small" style={{ lineHeight: 1.5, color: "#43423c" }}>
            Collez le fichier <code>supabase/pense-bete.sql</code> dans Supabase (SQL Editor), puis rechargez la page.
          </span>
        </div>
      ) : null}

      {adding ? (
        <form className="d-card is-panel" style={{ flexDirection: "row", alignItems: "center", gap: 10, padding: "10px 10px 10px 18px" }} onSubmit={addNote}>
          <input
            className="d-input"
            style={{ flex: 1, minWidth: 0, border: "none", background: "transparent", padding: 0 }}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Qu'est-ce qu'il ne faut pas oublier ?"
            autoFocus
            maxLength={300}
            aria-label="Ajouter un pense-bête"
          />
          <Btn type="submit" small disabled={!text.trim()}>
            Ajouter
          </Btn>
        </form>
      ) : null}

      <div className="d-col" style={{ gap: 12 }}>
        <Section title="À faire" count={todo.length} />
        {todo.length ? (
          <div className="d-tasks">
            {todo.map((n) => (
              <NoteRow key={n.id} note={n} />
            ))}
          </div>
        ) : (
          <div className="d-empty">
            <p>Rien pour l'instant.</p>
          </div>
        )}
      </div>

      {done.length ? (
        <div className="d-col" style={{ gap: 12 }}>
          <Section title="Cochées" count={done.length} />
          <div className="d-tasks">
            {done.map((n) => (
              <NoteRow key={n.id} note={n} />
            ))}
          </div>
        </div>
      ) : null}

      {!adding ? (
        <button type="button" className="d-fab" aria-label="Ajouter un pense-bête" onClick={() => setAdding(true)}>
          <Icon name="plus" size={22} sw={2.4} />
        </button>
      ) : null}
    </>
  );
}
