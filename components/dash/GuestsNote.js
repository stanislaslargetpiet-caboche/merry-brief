"use client";

// Post-it partagé au-dessus de la liste des invités : les règles de remplissage
// (« Faire-part : coché seulement une fois l'adresse confirmée »…), à la vue de
// tous les organisateurs, modifiable par n'importe lequel d'entre eux.

import { useEffect, useState } from "react";
import { useDash } from "@/lib/dash/store";
import { pastel } from "@/lib/dash/theme";
import { Icon } from "./icons";

const collapsedKey = (id) => `merry-note-collapsed-${id}`;

export default function GuestsNote() {
  const dash = useDash();
  const { wedding, members, meId } = dash.data;
  const note = wedding.guests_note || null;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(note?.text || "");
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    if (!editing) setDraft(note?.text || "");
  }, [note?.text, editing]);
  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(collapsedKey(wedding.id)) === "1");
    } catch {}
  }, [wedding.id]);
  function toggleCollapsed() {
    const next = !collapsed;
    setCollapsed(next);
    try {
      if (next) localStorage.setItem(collapsedKey(wedding.id), "1");
      else localStorage.removeItem(collapsedKey(wedding.id));
    } catch {}
  }

  const p = pastel("jaune");
  const author = note?.updated_by ? members.find((m) => m.id === note.updated_by) : null;

  function commit() {
    setEditing(false);
    const text = draft.trim();
    if (text === (note?.text || "")) return;
    dash.updateWedding({ guests_note: text ? { text, updated_by: meId, updated_at: new Date().toISOString() } : null });
  }

  if (!editing && !note?.text) {
    return (
      <button type="button" className="d-note is-empty" onClick={() => setEditing(true)} style={{ background: p.bg, color: p.ink }}>
        <Icon name="pencil" size={14} sw={2} />
        Ajouter une note pour l'équipe
      </button>
    );
  }

  return (
    <div className="d-note" style={{ background: p.bg, color: p.ink }}>
      {editing ? (
        <textarea
          className="d-note-input"
          autoFocus
          rows={3}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setDraft(note?.text || "");
              setEditing(false);
            }
          }}
          placeholder="Règles de remplissage à partager avec les autres organisateurs…"
          maxLength={600}
        />
      ) : collapsed ? null : (
        <p className="d-note-text">{note.text}</p>
      )}
      <div className="d-note-foot">
        {note?.updated_by ? (
          <span className="d-note-meta">Modifié par {author?.display_name || "quelqu'un"}</span>
        ) : (
          <span />
        )}
        {!editing ? (
          <span style={{ display: "inline-flex", gap: 6 }}>
            <button type="button" className="d-note-edit" onClick={toggleCollapsed} aria-label={collapsed ? "Afficher la note" : "Réduire la note"} aria-expanded={!collapsed}>
              <Icon name={collapsed ? "chevDown" : "chevUp"} size={13} sw={2.2} />
            </button>
            {!collapsed ? (
              <button type="button" className="d-note-edit" onClick={() => setEditing(true)} aria-label="Modifier la note">
                <Icon name="pencil" size={13} sw={2.2} />
              </button>
            ) : null}
          </span>
        ) : null}
      </div>
    </div>
  );
}
