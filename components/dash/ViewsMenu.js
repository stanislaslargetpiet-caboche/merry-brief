"use client";

// Vues enregistrées de la liste des invités : la recherche, les filtres et le tri du moment, gardés
// sous un nom (« Traiteur », « Faire-part à envoyer », « En attente pour le dîner ») pour y revenir
// d'un clic. Partagées entre organisateurs quand la base est à jour, sinon gardées sur l'appareil.

import { useState } from "react";
import { Icon } from "./icons";
import { Btn, Popover } from "./ui";

export default function ViewsMenu({ views, currentQs, onApply, onReset, onSave, onDelete, shared }) {
  const [open, setOpen] = useState(false);
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("");
  const active = views.find((v) => v.qs === currentQs) || null;
  const close = () => {
    setOpen(false);
    setNaming(false);
    setName("");
  };
  const save = (e) => {
    e.preventDefault();
    const v = name.trim();
    if (!v) return;
    onSave(v.slice(0, 40));
    close();
  };
  return (
    <span className="d-anchor">
      <button type="button" className={`d-group-pick${active ? " is-on" : ""}`} onClick={() => (open ? close() : setOpen(true))} aria-haspopup="menu" aria-expanded={open}>
        <Icon name="eye" size={14} sw={2.2} />
        {active ? active.name : "Vues"}
        <Icon name="chevDown" size={12} sw={2.2} />
      </button>
      <Popover open={open} onClose={close} align="left">
        {views.length ? (
          views.map((v) => (
            <span key={v.id} className={`d-pop-item d-view-item${v.id === active?.id ? " is-on" : ""}`}>
              <button
                type="button"
                className="d-view-apply"
                onClick={() => {
                  onApply(v.qs);
                  close();
                }}
              >
                {v.id === active?.id ? <Icon name="check" size={14} sw={2.2} /> : null}
                {v.name}
              </button>
              <button
                type="button"
                className="d-icon-btn d-view-del"
                aria-label={`Supprimer la vue ${v.name}`}
                title="Supprimer cette vue"
                onClick={() => {
                  if (window.confirm(`Supprimer la vue « ${v.name} » ?`)) onDelete(v.id);
                }}
              >
                <Icon name="x" size={13} sw={2.2} />
              </button>
            </span>
          ))
        ) : (
          <span className="d-pop-label d-muted d-small" style={{ padding: "4px 8px", maxWidth: 240, whiteSpace: "normal" }}>
            Pas encore de vue. Filtrez ou triez la liste, puis enregistrez-la pour y revenir d'un clic.
          </span>
        )}
        <span style={{ height: 1, background: "var(--d-line)", margin: "4px 2px" }} />
        {naming ? (
          <form onSubmit={save} style={{ display: "flex", gap: 6, padding: "4px 2px" }}>
            <input className="d-input" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom de la vue" maxLength={40} aria-label="Nom de la vue" style={{ minWidth: 170 }} />
            <Btn type="submit" small disabled={!name.trim()}>
              Enregistrer
            </Btn>
          </form>
        ) : (
          <button type="button" className="d-pop-item" disabled={!currentQs || !!active} onClick={() => setNaming(true)} title={!currentQs ? "Filtrez ou triez d'abord la liste" : active ? "Cette vue est déjà enregistrée" : undefined}>
            <span className="d-pop-label">
              <Icon name="plus" size={14} sw={2.2} />
              Enregistrer la vue actuelle
            </span>
          </button>
        )}
        {currentQs ? (
          <button
            type="button"
            className="d-pop-item"
            onClick={() => {
              onReset();
              close();
            }}
          >
            <span className="d-pop-label">
              <Icon name="x" size={14} sw={2.2} />
              Toute la liste
            </span>
          </button>
        ) : null}
        {!shared ? (
          <span className="d-pop-label d-muted d-small" style={{ padding: "4px 8px", maxWidth: 240, whiteSpace: "normal" }}>
            Vues gardées sur cet appareil : lancez supabase/fiche-et-vues-invites.sql pour les partager.
          </span>
        ) : null}
      </Popover>
    </span>
  );
}
