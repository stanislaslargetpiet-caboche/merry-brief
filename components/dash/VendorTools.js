"use client";

// Fiche prestataire : « Remplir avec l'IA » (lit les devis et factures) et le bloc Documents
// (import d'un fichier ou choix dans la bibliothèque Documents).

import { useRef, useState } from "react";
import { DOCUMENT_MAX_BYTES, useDash } from "@/lib/dash/store";
import { fetchDocumentFile, readVendorDocument, VENDOR_FIELDS } from "@/lib/dash/vendorRead";
import { docTitle, fileSize, findFolder } from "@/lib/dash/documents";
import { euros, shortDate } from "@/lib/dash/format";
import { Icon } from "./icons";
import { Btn, Field, Modal } from "./ui";
import { DocLink, TypeBadge } from "./Documents";

const KIND_LABEL = { devis: "Devis", facture: "Facture", autre: "Document" };

function folderFor(folders) {
  return folders.find((x) => /facture|devis/i.test(x.name)) || null;
}

// Bouton « Remplir avec l'IA » : lit les documents du prestataire, ou en demande un
export function AiFillButton({ vendor, item, docs }) {
  const dash = useDash();
  const input = useRef(null);
  const [busy, setBusy] = useState(null);
  const [preview, setPreview] = useState(null); // { found, fields: [[key, label, value]], file, uploaded }

  const readable = docs.filter((d) => d.storage_path).sort((a, z) => (a.kind === "devis" ? -1 : 1) - (z.kind === "devis" ? -1 : 1) || String(z.created_at).localeCompare(String(a.created_at)));

  async function run(file, { uploaded = false } = {}) {
    setBusy("Lecture du document…");
    const res = await readVendorDocument(file, vendor);
    setBusy(null);
    if (!res.ok) {
      const text =
        res.reason === "off"
          ? "La lecture par l'IA n'est pas activée : ajoutez ANTHROPIC_API_KEY dans Vercel."
          : res.reason === "quota"
            ? "Quota de lectures atteint pour aujourd'hui."
            : res.note || "Le document n'a pas pu être lu.";
      dash.setToast({ kind: "error", text });
      return;
    }
    const f = res.found;
    const fields = VENDOR_FIELDS.map(([k, label]) => [k, label, f[k] ? String(f[k]).trim() : null]).filter((x) => x[2] && x[2] !== (vendor[x[0]] || ""));
    setPreview({ found: f, fields, file, uploaded });
  }

  async function start() {
    if (dash.mode !== "live") {
      dash.setToast({ kind: "error", text: "La lecture par l'IA n'est disponible qu'en ligne, pas en mode démo." });
      return;
    }
    if (readable.length) {
      setBusy("Récupération du document…");
      const file = await fetchDocumentFile(dash, readable[0]);
      if (!file) {
        setBusy(null);
        dash.setToast({ kind: "error", text: "Le document n'a pas pu être récupéré." });
        return;
      }
      await run(file);
    } else input.current?.click();
  }

  async function onPick(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > DOCUMENT_MAX_BYTES) {
      dash.setToast({ kind: "error", text: `Le fichier dépasse ${fileSize(DOCUMENT_MAX_BYTES)}.` });
      return;
    }
    await run(file, { uploaded: true });
  }

  async function apply() {
    const { found, fields, file, uploaded } = preview;
    setPreview(null);
    const patch = {};
    for (const [k, , v] of fields) patch[k] = v;
    if (Object.keys(patch).length) await dash.update("vendors", vendor.id, patch);
    // Devis : montant signé sur le poste, si rien n'y est encore
    if (item && found.kind === "devis" && found.amount && !item.quote_amount) await dash.update("budget_items", item.id, { quote_amount: found.amount, quote_signed_at: found.date || null });
    // Échéances lues, si le poste n'en a pas
    if (item && found.installments?.length && !dash.data.payments.some((p) => p.budget_item_id === item.id)) {
      const rows = found.installments.filter((x) => x.amount).map((x) => ({ budget_item_id: item.id, label: String(x.label || "Échéance").slice(0, 60), amount: x.amount, due_date: x.due_date || null, paid_at: null, payer_id: null }));
      if (rows.length) await dash.insert("payments", rows);
    }
    // Fichier déposé pour l'occasion : rangé dans Documents, rattaché au prestataire
    if (uploaded && file) {
      const folder = folderFor(dash.data.folders || []);
      const name = found.title ? `${found.title}${file.name.match(/\.[a-z0-9]+$/i)?.[0] || ""}` : file.name;
      const res = await dash.uploadDocument(file, { folderId: folder?.id || null, kind: found.kind || "autre", budgetItemId: item?.id || null, vendorId: vendor.id, name });
      if (!res.ok) dash.setToast({ kind: "error", text: "La fiche est remplie, mais le fichier n'a pas pu être rangé dans Documents." });
    }
    dash.setToast({ kind: "ok", text: fields.length ? `${fields.length} champ${fields.length > 1 ? "s" : ""} rempli${fields.length > 1 ? "s" : ""} depuis le document.` : "Rien de nouveau dans ce document." });
  }

  return (
    <>
      <input ref={input} type="file" accept=".pdf,image/*,.doc,.docx" hidden onChange={onPick} />
      <Btn kind="lime" small icon="sparkle" onClick={start} disabled={!!busy} title={readable.length ? `Lit ${readable[0].name}` : "Lit un devis ou une facture que vous ajoutez"}>
        {busy || "Remplir avec l'IA"}
      </Btn>
      {preview ? (
        <Modal
          title="Lu dans le document"
          onClose={() => setPreview(null)}
          footer={
            <>
              <Btn kind="ghost" onClick={() => setPreview(null)}>
                Annuler
              </Btn>
              <Btn onClick={apply}>Remplir la fiche</Btn>
            </>
          }
        >
          <div className="d-col" style={{ gap: 6 }}>
            <span className="d-small d-muted">
              {preview.file.name}
              {preview.found.kind ? ` · ${KIND_LABEL[preview.found.kind] || "Document"}` : ""}
              {preview.found.amount ? ` · ${euros(preview.found.amount)} TTC` : ""}
            </span>
            {preview.fields.length ? (
              <div className="d-col" style={{ gap: 0 }}>
                {preview.fields.map(([k, label, v]) => (
                  <div key={k} className="d-contact-row">
                    <div>
                      <small>{label}</small>
                      <span style={{ fontSize: 14 }}>{v}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="d-muted" style={{ margin: 0 }}>
                Rien de nouveau à ajouter à la fiche.
              </p>
            )}
            {preview.found.installments?.length ? (
              <span className="d-small d-muted">
                Échéances lues : {preview.found.installments.map((x) => `${x.label}${x.amount ? ` ${euros(x.amount)}` : ""}${x.due_date ? ` le ${shortDate(x.due_date)}` : ""}`).join(" · ")}
              </span>
            ) : null}
            {preview.uploaded ? <span className="d-small d-muted">Le fichier sera rangé dans Documents et rattaché à ce prestataire.</span> : null}
          </div>
        </Modal>
      ) : null}
    </>
  );
}

// Bloc Documents de la fiche : import ou choix dans la bibliothèque
export function VendorDocuments({ vendor, item, docs }) {
  const dash = useDash();
  const { documents, folders = [] } = dash.data;
  const input = useRef(null);
  const [adding, setAdding] = useState(null); // { kind, file } | { kind, pick: true }
  const [busy, setBusy] = useState(false);

  const library = documents.filter((d) => !d.vendor_id && !d.budget_item_id);
  const folderName = (d) => findFolder(dash.data, d.folder_id || "budget")?.name;

  async function saveFile() {
    if (!adding?.file) return;
    setBusy(true);
    const folder = folderFor(folders);
    const res = await dash.uploadDocument(adding.file, { folderId: folder?.id || null, kind: adding.kind, budgetItemId: item?.id || null, vendorId: vendor.id, name: adding.file.name });
    setBusy(false);
    if (!res.ok) {
      dash.setToast({ kind: "error", text: res.reason === "size" ? `Le fichier dépasse ${fileSize(DOCUMENT_MAX_BYTES)}.` : res.reason === "setup" ? "Le stockage des documents n'est pas installé (supabase/documents.sql)." : "Le dépôt n'a pas abouti." });
      return;
    }
    setAdding(null);
    dash.setToast({ kind: "ok", text: "Document ajouté." });
  }

  async function attach(doc, kind) {
    await dash.update("documents", doc.id, { vendor_id: vendor.id, budget_item_id: item?.id || null, kind });
    setAdding(null);
  }

  return (
    <section className="d-card">
      <h2>Documents</h2>
      <div>
        {docs.map((d) => (
          <div key={d.id} className="d-file">
            <TypeBadge doc={d} size={36} />
            <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
              <strong style={{ fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{docTitle(d)}</strong>
              <span className="d-small-muted">
                {KIND_LABEL[d.kind]} · {shortDate(String(d.created_at || "").slice(0, 10))}
              </span>
            </span>
            <DocLink doc={d} className="d-small" style={{ fontWeight: 600 }}>
              Ouvrir
            </DocLink>
            <button type="button" className="d-icon-btn" style={{ width: 26, height: 26 }} aria-label={`Retirer ${d.name}`} onClick={() => window.confirm(`Retirer « ${d.name} » ?`) && dash.removeDocument(d)}>
              <Icon name="x" size={12} sw={2.2} />
            </button>
          </div>
        ))}
        {!docs.length ? <p className="d-small d-muted" style={{ margin: "4px 0 0" }}>Aucun document pour l'instant.</p> : null}
      </div>
      <input ref={input} type="file" accept=".pdf,image/*,.doc,.docx,.xls,.xlsx" hidden onChange={(e) => {
        const file = e.target.files?.[0];
        e.target.value = "";
        if (file) setAdding({ kind: /factur|re[cç]u/i.test(file.name) ? "facture" : "devis", file });
      }} />
      {adding?.file ? (
        <div className="d-col" style={{ gap: 10 }}>
          <span className="d-filechoice-name">
            <Icon name="file" size={15} sw={2} />
            <span>{adding.file.name}</span>
            <span className="d-muted">{fileSize(adding.file.size)}</span>
          </span>
          <Field label="Type" group>
            <div className="d-filters">
              {["devis", "facture", "autre"].map((k) => (
                <button key={k} type="button" className={`d-pill${adding.kind === k ? " is-on" : ""}`} onClick={() => setAdding((x) => ({ ...x, kind: k }))}>
                  {KIND_LABEL[k]}
                </button>
              ))}
            </div>
          </Field>
          <div className="d-actions-end">
            <Btn kind="ghost" small onClick={() => setAdding(null)}>
              Annuler
            </Btn>
            <Btn small onClick={saveFile} disabled={busy}>
              {busy ? "Envoi…" : "Ajouter"}
            </Btn>
          </div>
        </div>
      ) : adding?.pick ? (
        <div className="d-col" style={{ gap: 8 }}>
          <span className="d-small d-muted">Dans Documents, pas encore rattachés à un prestataire :</span>
          {library.length ? (
            library.map((d) => (
              <div key={d.id} className="d-file" style={{ padding: "8px 0" }}>
                <TypeBadge doc={d} size={32} />
                <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
                  <strong style={{ fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{docTitle(d)}</strong>
                  <span className="d-small-muted">{folderName(d)}</span>
                </span>
                <Btn kind="ghost" small onClick={() => attach(d, "devis")}>
                  Devis
                </Btn>
                <Btn kind="ghost" small onClick={() => attach(d, "facture")}>
                  Facture
                </Btn>
              </div>
            ))
          ) : (
            <p className="d-small d-muted" style={{ margin: 0 }}>Rien de disponible dans la bibliothèque.</p>
          )}
          <div className="d-actions-end">
            <Btn kind="ghost" small onClick={() => setAdding(null)}>
              Fermer
            </Btn>
          </div>
        </div>
      ) : (
        <div className="d-filters">
          <Btn kind="ghost" small icon="upload" onClick={() => input.current?.click()}>
            Importer un fichier
          </Btn>
          <Btn kind="ghost" small icon="folder" onClick={() => setAdding({ pick: true })}>
            Choisir dans Documents
          </Btn>
        </div>
      )}
    </section>
  );
}
