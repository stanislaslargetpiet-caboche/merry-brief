"use client";

// Bloc Documents : fenêtre de dossier, zone de dépôt, ligne de document.

import Link from "next/link";
import { useRef, useState } from "react";
import { DOCUMENT_MAX_BYTES, useDash } from "@/lib/dash/store";
import { BUDGET_FOLDER, FOLDER_SUGGESTIONS, docTitle, docType, fileSize, nextFolderColor } from "@/lib/dash/documents";
import { shortDate } from "@/lib/dash/format";
import { pastel, PASTEL_KEYS } from "@/lib/dash/theme";
import { Icon } from "./icons";
import { Avatar, Btn, Field, Modal, Popover } from "./ui";

// Créer ou renommer un dossier
export function FolderModal({ folder, onClose, onCreated }) {
  const dash = useDash();
  const folders = dash.data.folders || [];
  const [name, setName] = useState(folder?.name || "");
  const [color, setColor] = useState(folder?.color || nextFolderColor(folders));
  const existing = new Set(folders.map((f) => f.name.toLowerCase()));
  const suggestions = FOLDER_SUGGESTIONS.filter((s) => !existing.has(s.toLowerCase()));

  const save = async (e) => {
    e?.preventDefault();
    const label = name.trim().slice(0, 80);
    if (!label) return;
    if (folder) {
      await dash.update("document_folders", folder.id, { name: label, color });
      onClose();
      return;
    }
    const position = folders.reduce((a, f) => Math.max(a, f.position), -1) + 1;
    const [row] = await dash.insert("document_folders", { name: label, color, position, created_by: dash.data.meId || null, created_at: new Date().toISOString() });
    onClose();
    onCreated?.(row);
  };

  return (
    <Modal
      title={folder ? "Renommer le dossier" : "Nouveau dossier"}
      onClose={onClose}
      footer={
        <>
          <Btn kind="ghost" onClick={onClose}>
            Annuler
          </Btn>
          <Btn onClick={save} disabled={!name.trim()}>
            {folder ? "Enregistrer" : "Créer le dossier"}
          </Btn>
        </>
      }
    >
      <form onSubmit={save} className="d-col" style={{ gap: 16 }}>
        <Field label="Nom du dossier">
          <input className="d-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Factures et devis, Mairie, Préparation religieuse…" maxLength={80} />
        </Field>
        {!folder && suggestions.length ? (
          <div className="d-col" style={{ gap: 8 }}>
            <span className="d-small d-muted">Suggestions</span>
            <div className="d-filters">
              {suggestions.map((s) => (
                <button key={s} type="button" className={`d-pill${name === s ? " is-on" : ""}`} onClick={() => setName(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : null}
        <Field label="Couleur" group>
          <div className="d-filters">
            {PASTEL_KEYS.map((k) => (
              <button
                key={k}
                type="button"
                className={`d-swatch${color === k ? " is-on" : ""}`}
                style={{ background: pastel(k).mid }}
                onClick={() => setColor(k)}
                aria-label={k}
                aria-pressed={color === k}
              />
            ))}
          </div>
        </Field>
      </form>
    </Modal>
  );
}

// Zone de dépôt : glisser des fichiers ou cliquer pour les choisir
export function DropZone({ folderId, compact, onDone }) {
  const dash = useDash();
  const input = useRef(null);
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(null);

  const send = async (files) => {
    const list = Array.from(files || []).filter(Boolean);
    if (!list.length) return;
    setBusy({ done: 0, total: list.length });
    let ok = 0;
    let setup = false;
    let tooBig = 0;
    for (const f of list) {
      const res = await dash.uploadDocument(f, { folderId });
      if (res.ok) ok += 1;
      else if (res.reason === "size") tooBig += 1;
      else if (res.reason === "setup") setup = true;
      setBusy((b) => ({ ...b, done: b.done + 1 }));
    }
    setBusy(null);
    if (setup) dash.setToast({ kind: "error", text: "Le stockage des documents n'est pas encore installé : lancez supabase/documents.sql dans Supabase." });
    else if (ok && !tooBig) dash.setToast({ kind: "ok", text: ok > 1 ? `${ok} documents ajoutés.` : "Document ajouté." });
    else if (tooBig) dash.setToast({ kind: "error", text: `${tooBig > 1 ? `${tooBig} fichiers dépassent` : "Un fichier dépasse"} ${fileSize(DOCUMENT_MAX_BYTES)}${ok ? `, ${ok} ajouté${ok > 1 ? "s" : ""}` : ""}.` });
    else if (!ok) dash.setToast({ kind: "error", text: "Le dépôt n'a pas abouti. Vérifiez votre connexion et réessayez." });
    if (ok) onDone?.();
  };

  return (
    <div
      className={`d-drop-big d-docdrop${over ? " is-over" : ""}${compact ? " is-compact" : ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        send(e.dataTransfer.files);
      }}
    >
      <input ref={input} type="file" multiple hidden onChange={(e) => send(e.target.files)} />
      <span className="d-docdrop-icon">
        <Icon name="upload" size={20} sw={2} />
      </span>
      {busy ? (
        <strong>
          Envoi {busy.done + 1 > busy.total ? busy.total : busy.done + 1} sur {busy.total}…
        </strong>
      ) : (
        <>
          <strong>Glissez vos fichiers ici, ou choisissez-les sur votre ordinateur</strong>
          <p>PDF, images, Word, Excel · {fileSize(DOCUMENT_MAX_BYTES)} par fichier</p>
          <Btn kind="ghost" small icon="upload" onClick={() => input.current?.click()}>
            Choisir des fichiers
          </Btn>
        </>
      )}
    </div>
  );
}

// Pastille du type de fichier (PDF, JPG…)
export function TypeBadge({ doc, size = 38 }) {
  const t = docType(doc);
  const p = pastel(t.key);
  return (
    <span className="d-file-badge" style={{ width: size, height: size, background: p.bg, color: p.ink, fontSize: t.label.length > 3 ? 9 : 10 }}>
      {t.label}
    </span>
  );
}

// Une ligne de document : type, nom, rattachement, qui, date, taille, menu
export function DocumentRow({ doc, showFolder, folderName }) {
  const dash = useDash();
  const { members, vendors, items, folders } = dash.data;
  const [open, setOpen] = useState(false);
  const [moving, setMoving] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(doc.name);
  const by = members.find((m) => m.id === doc.added_by);
  const vendor = vendors.find((v) => v.id === doc.vendor_id);
  const item = items.find((i) => i.id === doc.budget_item_id);
  const linked = vendor || item;

  const openDoc = async () => {
    const url = await dash.documentUrl(doc);
    if (!url) {
      dash.setToast({ kind: "error", text: "Ce document n'a pas pu être ouvert." });
      return;
    }
    window.open(url, "_blank", "noopener");
  };

  const rename = async (e) => {
    e?.preventDefault();
    const label = name.trim().slice(0, 120);
    setRenaming(false);
    if (label && label !== doc.name) await dash.update("documents", doc.id, { name: label });
  };

  const destroy = async () => {
    if (!window.confirm(`Supprimer « ${doc.name} » ?`)) return;
    await dash.removeDocument(doc);
    dash.setToast({ kind: "ok", text: "Document supprimé." });
  };

  const sub = [vendor?.name || item?.label, showFolder ? folderName : null].filter(Boolean).join(" · ");

  return (
    <div className="d-docrow">
      <span className="d-docrow-main">
        <TypeBadge doc={doc} />
        <span className="d-docrow-text">
          {renaming ? (
            <form onSubmit={rename} style={{ display: "flex", gap: 8 }}>
              <input className="d-input" value={name} autoFocus onChange={(e) => setName(e.target.value)} onBlur={rename} onKeyDown={(e) => e.key === "Escape" && setRenaming(false)} aria-label="Nom du document" />
            </form>
          ) : (
            <button type="button" className="d-docrow-name" onClick={openDoc} title="Ouvrir">
              {docTitle(doc)}
            </button>
          )}
          <span className="d-docrow-sub">
            {sub ? <span>{sub}</span> : null}
            {linked ? (
              <Link href={vendor ? `/dashboard/budget/prestataires/${vendor.id}` : "/dashboard/budget"} className="d-doc-budget">
                <Icon name="wallet" size={11} sw={2.2} />
                Dans le budget
              </Link>
            ) : null}
          </span>
        </span>
      </span>
      <span className="d-docrow-by">
        {by ? (
          <>
            <Avatar member={by} size={24} />
            <span className="d-hide-mobile">{by.display_name}</span>
          </>
        ) : (
          <span className="d-muted">–</span>
        )}
      </span>
      <span className="d-docrow-date">{doc.created_at ? shortDate(doc.created_at.slice(0, 10)) : ""}</span>
      <span className="d-docrow-size">{doc.size_bytes ? fileSize(doc.size_bytes) : doc.url && !doc.storage_path ? "Lien" : ""}</span>
      <span className="d-anchor">
        <button type="button" className="d-icon-btn" aria-label={`Options de ${doc.name}`} onClick={() => setOpen((o) => !o)}>
          <Icon name="dots" size={18} sw={2.4} />
        </button>
        <Popover open={open} onClose={() => setOpen(false)} align="right">
          <button type="button" className="d-pop-item" onClick={() => (setOpen(false), openDoc())}>
            <span className="d-pop-label">
              <Icon name="external" size={14} sw={2} />
              Ouvrir
            </span>
          </button>
          <button type="button" className="d-pop-item" onClick={() => (setOpen(false), setName(doc.name), setRenaming(true))}>
            <span className="d-pop-label">
              <Icon name="pencil" size={14} sw={2} />
              Renommer
            </span>
          </button>
          {folders.length ? (
            <button type="button" className="d-pop-item" onClick={() => (setOpen(false), setMoving(true))}>
              <span className="d-pop-label">
                <Icon name="folder" size={14} sw={2} />
                Déplacer vers…
              </span>
            </button>
          ) : null}
          <button type="button" className="d-pop-item is-danger" onClick={() => (setOpen(false), destroy())}>
            <span className="d-pop-label">
              <Icon name="trash" size={14} sw={2} />
              Supprimer
            </span>
          </button>
        </Popover>
      </span>
      {moving ? (
        <Modal title="Déplacer le document" onClose={() => setMoving(false)}>
          <div className="d-col" style={{ gap: 6 }}>
            {[...folders, ...(linked ? [BUDGET_FOLDER] : [])].map((f) => {
              const on = f.virtual ? !doc.folder_id : doc.folder_id === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  className={`d-choice${on ? " is-on" : ""}`}
                  onClick={async () => {
                    setMoving(false);
                    if (!on) await dash.update("documents", doc.id, { folder_id: f.virtual ? null : f.id });
                  }}
                >
                  <span className="d-radio" />
                  <span className="d-choice-text">
                    <strong>{f.name}</strong>
                  </span>
                </button>
              );
            })}
          </div>
        </Modal>
      ) : null}
    </div>
  );
}

// Carte d'un dossier dans la grille
export function FolderCard({ folder, docs, members }) {
  const p = pastel(folder.color);
  const who = members.filter((m) => docs.some((d) => d.added_by === m.id));
  const last = docs.reduce((a, d) => (d.created_at > a ? d.created_at : a), "");
  const linked = docs.filter((d) => d.vendor_id || d.budget_item_id).length;
  return (
    <Link href={`/dashboard/documents/${folder.id}`} className="d-folder">
      <span className="d-tile" style={{ width: 48, height: 48, borderRadius: 14, background: p.bg }}>
        <Icon name="folder" size={24} stroke={p.ink} sw={1.7} />
      </span>
      <span className="d-folder-text">
        <strong>{folder.name}</strong>
        <span className="d-small d-muted">
          {docs.length ? `${docs.length} document${docs.length > 1 ? "s" : ""} · ${last ? `mis à jour le ${shortDate(last.slice(0, 10))}` : ""}` : "Vide pour l'instant"}
        </span>
      </span>
      <span className="d-folder-foot">
        <span className="d-faces">
          {who.slice(0, 4).map((m, i) => (
            <span key={m.id} style={{ marginLeft: i ? -8 : 0, display: "inline-flex" }}>
              <Avatar member={m} size={26} ring="#ffffff" />
            </span>
          ))}
        </span>
        {linked ? (
          <span className="d-doc-budget">
            <Icon name="wallet" size={11} sw={2.2} />
            {linked} dans le budget
          </span>
        ) : null}
      </span>
    </Link>
  );
}

// Lien qui ouvre un document, fichier déposé (lien signé) ou lien externe
export function DocLink({ doc, className, style, children }) {
  const dash = useDash();
  const open = async (e) => {
    e.preventDefault();
    const url = await dash.documentUrl(doc);
    if (!url) {
      dash.setToast({ kind: "error", text: "Ce document n'a pas pu être ouvert." });
      return;
    }
    window.open(url, "_blank", "noopener");
  };
  return (
    <a href={doc.url || "#"} onClick={open} className={className} style={style} target="_blank" rel="noreferrer">
      {children}
    </a>
  );
}
