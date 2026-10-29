"use client";

// Bloc Documents : fenêtre de dossier, zone de dépôt, ligne de document.

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { DOCUMENT_MAX_BYTES, useDash } from "@/lib/dash/store";
import { BUDGET_FOLDER, FOLDER_SUGGESTIONS, docTitle, docType, fileSize, linkName, nextFolderColor, normalizeLink } from "@/lib/dash/documents";
import { currentDevice } from "@/lib/dash/retro";
import { shortDate } from "@/lib/dash/format";
import { pastel, PASTEL_KEYS } from "@/lib/dash/theme";
import { Icon } from "./icons";
import { Avatar, Btn, Field, Modal, Popover } from "./ui";
import { ScanModal } from "./Scan";

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

// Coller l'adresse d'un fichier rangé ailleurs (Drive, Dropbox, iCloud, WeTransfer…) : Merry garde le lien
function LinkModal({ folderId, onClose, onDone }) {
  const dash = useDash();
  const [url, setUrl] = useState("");
  const [name, setName] = useState("");
  const [touched, setTouched] = useState(false);
  const clean = normalizeLink(url);
  const shownName = name || (clean ? linkName(clean) : "");

  const save = async (e) => {
    e?.preventDefault();
    if (!clean) {
      setTouched(true);
      return;
    }
    if (dash.mode === "live" && !dash.data.documentsSetup) {
      dash.setToast({ kind: "error", text: "Le stockage des documents n'est pas encore installé : lancez supabase/documents.sql dans Supabase." });
      return;
    }
    await dash.insert("documents", {
      folder_id: folderId,
      budget_item_id: null,
      vendor_id: null,
      kind: "autre",
      name: shownName.trim().slice(0, 120) || "Lien",
      url: clean,
      storage_path: null,
      size_bytes: null,
      mime: null,
      added_by: dash.data.meId || null,
      created_at: new Date().toISOString(),
    });
    dash.setToast({ kind: "ok", text: "Lien ajouté." });
    onDone?.();
    onClose();
  };

  return (
    <Modal
      title="Ajouter un lien"
      onClose={onClose}
      footer={
        <>
          <Btn kind="ghost" onClick={onClose}>
            Annuler
          </Btn>
          <Btn icon="link" onClick={save} disabled={!url.trim()}>
            Ajouter le lien
          </Btn>
        </>
      }
    >
      <form onSubmit={save} className="d-col" style={{ gap: 16 }}>
        <Field label="Adresse du fichier" hint={touched && !clean ? "Collez une adresse web complète, par exemple https://drive.google.com/…" : "Google Drive, Dropbox, iCloud, OneDrive, WeTransfer… Pensez à autoriser l'accès à vos co-organisateurs."}>
          <input className="d-input" inputMode="url" autoCapitalize="none" autoCorrect="off" spellCheck={false} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://drive.google.com/…" autoFocus aria-invalid={touched && !clean} />
        </Field>
        <Field label="Nom">
          <input className="d-input" value={name} onChange={(e) => setName(e.target.value)} placeholder={shownName || "Dossier de mariage, devis du traiteur…"} maxLength={120} />
        </Field>
      </form>
    </Modal>
  );
}

// Ajouter un document : on choisit d'où il vient (ordinateur ou téléphone, lien, papier à scanner)
export function DropZone({ folderId, folderName, onDone }) {
  const dash = useDash();
  const input = useRef(null);
  const camera = useRef(null);
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(null);
  const [linking, setLinking] = useState(false);
  const [scan, setScan] = useState(null);
  const [phone, setPhone] = useState(false);
  useEffect(() => {
    setPhone(currentDevice() === "telephone");
  }, []);

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
      className={`d-drop-big d-docdrop d-source${over ? " is-over" : ""}`}
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
      <input ref={input} type="file" multiple hidden onChange={(e) => (send(e.target.files), (e.target.value = ""))} aria-label="Choisir des fichiers" />
      {/* Sur téléphone, « capture » ouvre l'appareil photo ; sur ordinateur, un sélecteur d'images */}
      <input ref={camera} type="file" accept="image/*" capture="environment" hidden onChange={(e) => {
          const files = Array.from(e.target.files || []);
          e.target.value = "";
          if (files.length) setScan(files);
        }} aria-label="Photographier un papier" />
      {busy ? (
        <strong>
          Envoi {busy.done + 1 > busy.total ? busy.total : busy.done + 1} sur {busy.total}…
        </strong>
      ) : (
        <>
          <div className="d-source-head">
            <strong>D'où vient le document ?</strong>
          </div>
          <div className="d-source-grid">
            <div className="d-source-card">
              <span className="d-docdrop-icon">
                <Icon name="upload" size={20} sw={2} />
              </span>
              <strong>{phone ? "Depuis le téléphone" : "Depuis cet ordinateur"}</strong>
              <p>{phone ? "Photothèque, Fichiers, Google Drive, iCloud." : "Glissez vos fichiers ici, ou parcourez vos dossiers."}</p>
              <Btn kind="ghost" small onClick={() => input.current?.click()}>
                Choisir des fichiers
              </Btn>
            </div>
            <div className="d-source-card">
              <span className="d-docdrop-icon">
                <Icon name="link" size={20} sw={2} />
              </span>
              <strong>Drive, Dropbox ou un lien</strong>
              <p>Collez l'adresse du fichier : Merry garde le lien, sans copie.</p>
              <Btn kind="ghost" small onClick={() => setLinking(true)}>
                Coller un lien
              </Btn>
            </div>
            <div className="d-source-card is-scan">
              <span className="d-docdrop-icon">
                <Icon name="camera" size={20} sw={2} />
              </span>
              <strong>Scanner un papier</strong>
              <p>{phone ? "Appareil photo, plusieurs pages en un seul PDF." : "Plusieurs photos ou images réunies en un seul PDF. Sur téléphone, l'appareil photo s'ouvre directement."}</p>
              <Btn small onClick={() => camera.current?.click()}>
                Scanner
              </Btn>
            </div>
          </div>
        </>
      )}
      {linking ? <LinkModal folderId={folderId} onClose={() => setLinking(false)} onDone={onDone} /> : null}
      {scan ? <ScanModal initial={scan} folderId={folderId} folderName={folderName} onClose={() => setScan(null)} onDone={onDone} /> : null}
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

// Une ligne de document : type, nom, qui, date, menu
// `compact` : version téléphone, empilée (maquette 5n) au lieu de la grille large desktop
export function DocumentRow({ doc, showFolder, folderName, compact }) {
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

  const sub = showFolder ? folderName : null;

  const nameEl = renaming ? (
    <form onSubmit={rename} style={{ display: "flex", gap: 8 }}>
      <input className="d-input" value={name} autoFocus onChange={(e) => setName(e.target.value)} onBlur={rename} onKeyDown={(e) => e.key === "Escape" && setRenaming(false)} aria-label="Nom du document" />
    </form>
  ) : (
    <button type="button" className="d-docrow-name" onClick={openDoc} title="Ouvrir">
      {docTitle(doc)}
    </button>
  );

  const menu = (
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
  );

  const movingModal = moving ? (
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
  ) : null;

  if (compact) {
    const metaBits = [by?.display_name, doc.created_at ? shortDate(doc.created_at.slice(0, 10)) : null].filter(Boolean);
    return (
      <div className="d-docrow-m">
        <TypeBadge doc={doc} size={34} />
        <span className="d-docrow-m-text">
          {nameEl}
          {sub ? <span className="d-docrow-sub">{sub}</span> : null}
          <span className="d-docrow-meta-m">
            {by ? <Avatar member={by} size={16} /> : null}
            {metaBits.length ? <span>{metaBits.join(" · ")}</span> : null}
          </span>
        </span>
        {menu}
        {movingModal}
      </div>
    );
  }

  return (
    <div className="d-docrow">
      <span className="d-docrow-main">
        <TypeBadge doc={doc} />
        <span className="d-docrow-text">
          {nameEl}
          {sub ? <span className="d-docrow-sub">{sub}</span> : null}
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
      {menu}
      {movingModal}
    </div>
  );
}

// Carte d'un dossier dans la grille : son nom et son nombre de documents
export function FolderCard({ folder, docs, color }) {
  const p = pastel(color || folder.color);
  return (
    <Link href={`/dashboard/documents/${folder.id}`} className="d-folder" style={{ background: p.bg, borderColor: "transparent" }}>
      <span className="d-tile" style={{ width: 48, height: 48, borderRadius: 14, background: "#ffffff" }}>
        <Icon name="folder" size={24} stroke={p.ink} sw={1.7} />
      </span>
      <span className="d-folder-text">
        <strong>{folder.name}</strong>
        <span className="d-small d-muted">
          {docs.length} document{docs.length > 1 ? "s" : ""}
        </span>
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
