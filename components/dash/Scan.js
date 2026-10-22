"use client";

// Scanner un papier : plusieurs photos réunies en un seul PDF, déposé dans le dossier.
// Sur téléphone, « Ajouter une page » ouvre directement l'appareil photo.

import { useEffect, useRef, useState } from "react";
import { DOCUMENT_MAX_BYTES, useDash } from "@/lib/dash/store";
import { fileSize } from "@/lib/dash/documents";
import { scanToPdf } from "@/lib/dash/pdf";
import { Icon } from "./icons";
import { Btn, Field, Modal } from "./ui";

const MAX_PAGES = 20;

// Aperçu en noir et blanc : même effet que le PDF, sans recalcul
const BW_FILTER = "grayscale(1) contrast(1.5) brightness(1.08)";

export function ScanModal({ initial = [], folderId, folderName, onClose, onDone }) {
  const dash = useDash();
  const camera = useRef(null);
  const gallery = useRef(null);
  const seq = useRef(0);
  const [pages, setPages] = useState(() => initial.map((file) => ({ id: ++seq.current, file, url: URL.createObjectURL(file) })));
  const [at, setAt] = useState(0);
  const [bw, setBw] = useState(true);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState(() => {
    const d = new Date();
    const when = `${d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" })} à ${d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`;
    return `${folderName ? `${folderName} · ` : ""}scan du ${when}`;
  });

  // Libère les aperçus à la fermeture
  const urls = useRef([]);
  urls.current = pages.map((p) => p.url);
  useEffect(() => () => urls.current.forEach((u) => URL.revokeObjectURL(u)), []);

  const add = (files) => {
    const list = Array.from(files || []).filter((f) => /^image\//.test(f.type) || /\.(jpe?g|png|heic|heif|webp)$/i.test(f.name || ""));
    if (!list.length) {
      dash.setToast({ kind: "error", text: "Choisissez des photos ou des images : un scan se compose d'images." });
      return;
    }
    const room = MAX_PAGES - pages.length;
    if (list.length > room) dash.setToast({ kind: "error", text: `${MAX_PAGES} pages au plus dans un même scan.` });
    const next = list.slice(0, Math.max(room, 0)).map((file) => ({ id: ++seq.current, file, url: URL.createObjectURL(file) }));
    if (!next.length) return;
    setPages((p) => [...p, ...next]);
    setAt(pages.length + next.length - 1);
  };

  const removeAt = (i) => {
    const gone = pages[i];
    if (gone) URL.revokeObjectURL(gone.url);
    setPages((p) => p.filter((_, k) => k !== i));
    setAt((a) => Math.max(0, Math.min(a, pages.length - 2)));
  };

  const save = async () => {
    if (!pages.length || busy) return;
    setBusy(true);
    try {
      const label = (name.trim() || "Scan").slice(0, 110);
      const blob = await scanToPdf(
        pages.map((p) => p.file),
        { bw },
      );
      if (blob.size > DOCUMENT_MAX_BYTES) {
        dash.setToast({ kind: "error", text: `Le PDF fait ${fileSize(blob.size)}, au-delà de ${fileSize(DOCUMENT_MAX_BYTES)}. Retirez des pages ou gardez le noir et blanc.` });
        setBusy(false);
        return;
      }
      const file = new File([blob], `${label}.pdf`, { type: "application/pdf" });
      const res = await dash.uploadDocument(file, { folderId, name: `${label}.pdf` });
      if (res.ok) {
        dash.setToast({ kind: "ok", text: pages.length > 1 ? `Scan ajouté : ${pages.length} pages en un PDF.` : "Scan ajouté en PDF." });
        onDone?.();
        onClose();
        return;
      }
      dash.setToast({
        kind: "error",
        text: res.reason === "setup" ? "Le stockage des documents n'est pas encore installé : lancez supabase/documents.sql dans Supabase." : "Le scan n'a pas pu être enregistré. Vérifiez votre connexion et réessayez.",
      });
    } catch (e) {
      console.error("[merry] scan", e);
      dash.setToast({ kind: "error", text: "Une photo n'a pas pu être lue. Reprenez-la, ou choisissez-en une autre." });
    }
    setBusy(false);
  };

  const current = pages[at];

  return (
    <Modal
      title="Scanner un papier"
      onClose={busy ? () => {} : onClose}
      footer={
        <>
          <Btn kind="ghost" onClick={onClose} disabled={busy}>
            Annuler
          </Btn>
          <Btn icon="check" onClick={save} disabled={!pages.length || busy}>
            {busy ? "Création du PDF…" : `Enregistrer en PDF${pages.length ? ` · ${pages.length} page${pages.length > 1 ? "s" : ""}` : ""}`}
          </Btn>
        </>
      }
    >
      <input ref={camera} type="file" accept="image/*" capture="environment" hidden onChange={(e) => (add(e.target.files), (e.target.value = ""))} />
      <input ref={gallery} type="file" accept="image/*" multiple hidden onChange={(e) => (add(e.target.files), (e.target.value = ""))} />

      <div className="d-col" style={{ gap: 14 }}>
        {current ? (
          <div className="d-scan-stage">
            <img src={current.url} alt={`Page ${at + 1} sur ${pages.length}`} style={{ filter: bw ? BW_FILTER : "none" }} />
            <span className="d-scan-badge">
              Page {at + 1} sur {pages.length}
            </span>
            <button type="button" className="d-scan-del" onClick={() => removeAt(at)} aria-label="Supprimer cette page" disabled={busy}>
              <Icon name="trash" size={18} sw={2} />
            </button>
          </div>
        ) : (
          <div className="d-scan-stage is-empty">
            <strong>Aucune page pour l'instant</strong>
            <span className="d-small d-muted">Photographiez le papier, ou choisissez des images.</span>
          </div>
        )}

        <div className="d-scan-strip" aria-label="Pages du scan">
          {pages.map((p, i) => (
            <button key={p.id} type="button" className={`d-scan-thumb${i === at ? " is-on" : ""}`} onClick={() => setAt(i)} aria-label={`Page ${i + 1}`} aria-pressed={i === at}>
              <img src={p.url} alt="" style={{ filter: bw ? BW_FILTER : "none" }} />
              <span>{i + 1}</span>
            </button>
          ))}
          {pages.length < MAX_PAGES ? (
            <button type="button" className="d-scan-thumb is-add" onClick={() => camera.current?.click()} aria-label="Ajouter une page" disabled={busy}>
              <Icon name="plus" size={20} sw={2} />
            </button>
          ) : null}
        </div>

        <div className="d-scan-actions">
          <Btn kind="ghost" small icon="camera" onClick={() => camera.current?.click()} disabled={busy || pages.length >= MAX_PAGES}>
            Ajouter une page
          </Btn>
          <Btn kind="ghost" small icon="upload" onClick={() => gallery.current?.click()} disabled={busy || pages.length >= MAX_PAGES}>
            Choisir des images
          </Btn>
        </div>

        <div className="d-scan-switch">
          <span className="d-col" style={{ gap: 1 }}>
            <strong>Noir et blanc</strong>
            <span className="d-small d-muted">Plus lisible et plus léger</span>
          </span>
          <button type="button" role="switch" aria-checked={bw} aria-label="Noir et blanc" className={`d-switch${bw ? " is-on" : ""}`} onClick={() => setBw((x) => !x)} disabled={busy}>
            <span />
          </button>
        </div>

        <Field label="Nom du document">
          <input className="d-input" value={name} onChange={(e) => setName(e.target.value)} maxLength={110} />
        </Field>
      </div>
    </Modal>
  );
}
