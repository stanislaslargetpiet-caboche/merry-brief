"use client";

// Les moments du mariage (mairie, cocktail, dîner, brunch…) : chaque mariage a les siens.
// Chaque moment a sa colonne de réponses dans la liste des invités.

import { useEffect, useState } from "react";
import { useDash } from "@/lib/dash/store";
import { uid } from "@/lib/dash/format";
import { Icon } from "./icons";
import { Btn, Modal } from "./ui";

// « Dîner de la veille » → « Veille », « Après-midi piscine » → « Piscine »
export function shortEventName(name) {
  const n = String(name || "").trim().replace(/\s+/g, " ");
  if (n.length <= 10) return n;
  const words = n.split(" ").filter((w) => w.length >= 4);
  const w = words[words.length - 1] || n.split(" ")[0];
  return (w.charAt(0).toUpperCase() + w.slice(1)).slice(0, 14);
}

function EventField({ value, label, onSave, className = "" }) {
  const [draft, setDraft] = useState(value || "");
  useEffect(() => setDraft(value || ""), [value]);
  const commit = () => {
    const next = draft.trim();
    if (!next) {
      setDraft(value || "");
      return;
    }
    if (next !== value) onSave(next);
  };
  return (
    <label className={`d-moment-field ${className}`}>
      <span>{label}</span>
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

export default function MomentsModal({ onClose }) {
  const dash = useDash();
  const { events, guests, responses } = dash.data;
  const sorted = [...events].sort((a, b) => a.position - b.position);
  const [name, setName] = useState("");
  const [everyone, setEveryone] = useState(true);
  const [busy, setBusy] = useState(false);

  const invitedCount = (evId) => responses.filter((r) => r.event_id === evId && r.status !== "non_invite").length;

  async function move(i, dir) {
    const j = i + dir;
    if (j < 0 || j >= sorted.length) return;
    const next = [...sorted];
    [next[i], next[j]] = [next[j], next[i]];
    for (let k = 0; k < next.length; k += 1) if (next[k].position !== k) await dash.update("events", next[k].id, { position: k });
  }

  async function del(ev) {
    if (sorted.length <= 1) {
      dash.setToast({ kind: "error", text: "Gardez au moins un moment." });
      return;
    }
    const n = invitedCount(ev.id);
    const msg = n
      ? `Supprimer « ${ev.name} » ? Les réponses de ${n} invité${n > 1 ? "s" : ""} à ce moment seront effacées.`
      : `Supprimer « ${ev.name} » ?`;
    if (window.confirm(msg)) await dash.remove("events", ev.id);
  }

  async function add(e) {
    e.preventDefault();
    const n = name.trim();
    if (!n || busy) return;
    setBusy(true);
    const id = uid();
    const position = sorted.length ? Math.max(...sorted.map((x) => x.position)) + 1 : 0;
    await dash.insert("events", { id, name: n, short_name: shortEventName(n), position });
    if (everyone && guests.length) {
      const now = new Date().toISOString();
      await dash.insert("guest_responses", guests.map((g) => ({ guest_id: g.id, event_id: id, status: "attente", updated_at: now })));
    }
    setName("");
    setBusy(false);
  }

  return (
    <Modal
      title="Les moments du mariage"
      onClose={onClose}
      wide
      footer={<Btn onClick={onClose}>Terminé</Btn>}
    >
      <p className="d-muted" style={{ margin: 0 }}>
        Chaque mariage a les siens : renommez, ajoutez, supprimez. L'ordre ici est celui des onglets et des colonnes.
      </p>
      <ul className="d-moments">
        {sorted.map((ev, i) => (
          <li key={ev.id} className="d-moment">
            <span className="d-moment-move">
              <button type="button" className="d-icon-btn is-flat" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Monter ${ev.name}`}>
                <Icon name="arrowUp" size={15} sw={2} />
              </button>
              <button type="button" className="d-icon-btn is-flat" onClick={() => move(i, 1)} disabled={i === sorted.length - 1} aria-label={`Descendre ${ev.name}`}>
                <Icon name="arrowDown" size={15} sw={2} />
              </button>
            </span>
            <EventField value={ev.name} label="Nom du moment" onSave={(v) => dash.update("events", ev.id, { name: v })} className="is-name" />
            <EventField value={ev.short_name} label="En-tête de colonne" onSave={(v) => dash.update("events", ev.id, { short_name: v.slice(0, 14) })} className="is-short" />
            <span className="d-small d-muted d-moment-count">
              {invitedCount(ev.id)} invité{invitedCount(ev.id) > 1 ? "s" : ""}
            </span>
            <button type="button" className="d-icon-btn is-flat is-danger" onClick={() => del(ev)} aria-label={`Supprimer ${ev.name}`} title="Supprimer ce moment">
              <Icon name="trash" size={16} sw={2} />
            </button>
          </li>
        ))}
      </ul>
      <form className="d-moment-add" onSubmit={add}>
        <strong style={{ fontSize: 14 }}>Ajouter un moment</strong>
        <div className="d-moment-add-row">
          <label className="d-moment-field" style={{ flex: "1 1 220px" }}>
            <span>Nom du moment</span>
            <input className="d-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Après-midi piscine, cérémonie laïque…" maxLength={60} />
          </label>
          <div className="d-moment-field">
            <span>Qui est invité ?</span>
            <div className="d-seg" role="radiogroup" aria-label="Qui est invité ?">
              <button type="button" role="radio" aria-checked={everyone} className={everyone ? "is-on" : ""} onClick={() => setEveryone(true)}>
                Tout le monde
              </button>
              <button type="button" role="radio" aria-checked={!everyone} className={!everyone ? "is-on" : ""} onClick={() => setEveryone(false)}>
                Personne pour l'instant
              </button>
            </div>
          </div>
          <Btn type="submit" small icon="plus" disabled={!name.trim() || busy}>
            Ajouter
          </Btn>
        </div>
      </form>
      <p className="d-small d-muted" style={{ margin: 0 }}>
        Supprimer un moment efface aussi les réponses des invités à ce moment.
      </p>
    </Modal>
  );
}
