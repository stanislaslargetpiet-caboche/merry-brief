"use client";

// Post-it partagé au-dessus de la liste des invités : les règles de remplissage
// (« Faire-part : coché seulement une fois l'adresse confirmée »…), à la vue de
// tous les organisateurs, modifiable par n'importe lequel d'entre eux.

import { useEffect, useState } from "react";
import { useDash } from "@/lib/dash/store";
import { pastel } from "@/lib/dash/theme";
import { Icon } from "./icons";

// « à l'instant », « il y a 5 min », « il y a 2 h », « hier », puis la date
function ago(iso) {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "";
  const min = Math.round((Date.now() - t) / 60000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24 && new Date(t).toDateString() === new Date().toDateString()) return `à ${new Date(t).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`;
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (new Date(t).toDateString() === yesterday.toDateString()) return `hier à ${new Date(t).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`;
  return new Date(t).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

export default function GuestsNote() {
  const dash = useDash();
  const { wedding, members, meId } = dash.data;
  const note = wedding.guests_note || null;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(note?.text || "");
  useEffect(() => {
    if (!editing) setDraft(note?.text || "");
  }, [note?.text, editing]);

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
      ) : (
        <p className="d-note-text">{note.text}</p>
      )}
      <div className="d-note-foot">
        {note?.updated_at ? (
          <span className="d-note-meta">
            Modifié par {author?.display_name || "quelqu'un"} · {ago(note.updated_at)}
          </span>
        ) : (
          <span />
        )}
        {!editing ? (
          <button type="button" className="d-note-edit" onClick={() => setEditing(true)} aria-label="Modifier la note">
            <Icon name="pencil" size={13} sw={2.2} />
          </button>
        ) : null}
      </div>
    </div>
  );
}
