"use client";

import { useState } from "react";
import { useDash } from "@/lib/dash/store";
import { Btn, PageHeader, Section } from "@/components/dash/ui";
import NoteRow from "@/components/dash/PenseBete";

export default function PenseBete() {
  const dash = useDash();
  const { notes = [], notesSetup, meId } = dash.data;
  const [adding, setAdding] = useState(false);
  const [text, setText] = useState("");
  const [mobText, setMobText] = useState("");

  const todo = notes.filter((n) => !n.done);
  const done = notes.filter((n) => n.done);

  async function create(value) {
    const v = value.trim();
    if (!v) return;
    await dash.insert("pense_bete_items", { text: v, done: false, added_by: meId, position: notes.length });
  }

  async function addNote(e) {
    e.preventDefault();
    await create(text);
    setText("");
    setAdding(false);
  }

  async function addNoteMobile(e) {
    e.preventDefault();
    await create(mobText);
    setMobText("");
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

      {/* Ordinateur : la barre d'ajout se déplie depuis le bouton « Ajouter » de l'en-tête */}
      {adding ? (
        <form className="d-card is-panel d-desk-only" style={{ flexDirection: "row", alignItems: "center", gap: 10, padding: "10px 10px 10px 18px" }} onSubmit={addNote}>
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

      {/* Téléphone : la barre d'ajout reste visible en haut, comme sur le canvas (6m) */}
      <form
        className="d-mob-only"
        style={{ display: "flex", alignItems: "center", gap: 8, background: "#f6f5f1", borderRadius: 999, padding: "4px 4px 4px 14px" }}
        onSubmit={addNoteMobile}
      >
        <input
          style={{ flex: 1, minWidth: 0, border: "none", background: "transparent", padding: 0, font: "inherit", fontSize: 15 }}
          value={mobText}
          onChange={(e) => setMobText(e.target.value)}
          placeholder="À ne pas oublier…"
          maxLength={300}
          aria-label="Ajouter un pense-bête"
        />
        <button
          type="submit"
          aria-label="Ajouter"
          style={{ flex: "none", width: 36, height: 36, borderRadius: 999, border: "none", background: "#1c1c1a", color: "#ffffff", display: "inline-flex", alignItems: "center", justifyContent: "center" }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
      </form>

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
    </>
  );
}
