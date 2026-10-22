"use client";

// Import des devis signés et des factures réglées : Merry lit chaque document, puis
// pose trois questions par document (devis ou facture ? qui a payé ? on a bien lu ?)
// avant de remplir le budget, l'échéancier et le dossier « Factures et devis ».

import Link from "next/link";
import { useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useDash } from "@/lib/dash/store";
import { budgetTotals } from "@/lib/dash/model";
import { euros, normalize, parseAmount, shortDate, todayIso, uid } from "@/lib/dash/format";
import { readQuoteFile } from "@/lib/dash/importRead";
import { FOLDER_SUGGESTIONS, nextFolderColor } from "@/lib/dash/documents";
import { posteLook } from "@/lib/dash/theme";
import { Icon, guessIcon } from "@/components/dash/icons";
import { Avatar, Btn, PageHeader } from "@/components/dash/ui";

const MAX_FILES = 12;
const FOLDER_NAME = FOLDER_SUGGESTIONS[0]; // « Factures et devis »

const TYPES = [
  { k: "devis_signe", label: "Un devis signé", sub: "Le prestataire est réservé" },
  { k: "devis_non_signe", label: "Un devis pas encore signé", sub: "Vous hésitez encore" },
  { k: "facture", label: "Une facture", sub: "C'est déjà réglé" },
];

function extOf(name) {
  const m = String(name || "").match(/\.([a-z0-9]{2,5})$/i);
  return m ? m[1].toUpperCase().slice(0, 4) : "DOC";
}

function sum(list) {
  return (list || []).reduce((a, p) => a + Number(p.amount || 0), 0);
}

function PosteChip({ label }) {
  if (!label) return null;
  const l = posteLook(guessIcon(label));
  return (
    <span className="d-imp-chip" style={{ background: l.bg, color: l.ink }}>
      <span aria-hidden="true">{l.emoji}</span> {label}
    </span>
  );
}

// Champs vérifiés par le couple, préremplis par la lecture
function initialFields(read, file) {
  const paid = sum(read?.paid);
  return {
    vendor: read?.vendor_name || "",
    poste: read?.category || "",
    total: read?.total ?? "",
    date: read?.doc_date || "",
    paid: read ? paid : "",
    file: file.name,
  };
}

export default function ImporterDevis() {
  const dash = useDash();
  const data = dash.data;
  const { members, items, vendors } = data;
  const [docs, setDocs] = useState([]); // { id, file, name, status, why, read, fields, type, payer }
  const [step, setStep] = useState("depot"); // depot | flow | fin
  const [cur, setCur] = useState(0);
  const [q, setQ] = useState("type"); // type | payer | check | compare
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);
  const [aiOff, setAiOff] = useState(false);
  const [tracked, setTracked] = useState({ amount: 0, signed: 0, compare: 0 });
  const inputRef = useRef(null);
  const folderRef = useRef(null);

  const patch = (id, p) => setDocs((x) => x.map((d) => (d.id === id ? { ...d, ...(typeof p === "function" ? p(d) : p) } : d)));
  const ready = docs.filter((d) => d.status === "pret");
  const reading = docs.some((d) => d.status === "lecture");

  async function readOne(entry) {
    let unit;
    try {
      unit = await readQuoteFile(entry.file);
    } catch (e) {
      patch(entry.id, { status: "erreur", why: e.note || "Impossible de lire ce fichier." });
      return;
    }
    let read = null;
    if (dash.mode === "live" && supabase && !aiOff) {
      try {
        const { data: sess } = await supabase.auth.getSession();
        const res = await fetch("/api/read-quote", {
          method: "POST",
          headers: { "content-type": "application/json", authorization: `Bearer ${sess?.session?.access_token}` },
          body: JSON.stringify({ source: { name: entry.name, ...unit }, postes: items.map((i) => i.label), people: members.map((m) => m.display_name) }),
        });
        if (res.status === 501) setAiOff(true);
        else if (res.ok) read = (await res.json()).doc || null;
      } catch {
        read = null;
      }
    }
    // Sans lecture, le couple remplit les champs lui-même à l'étape « On a bien lu ? »
    const hint = normalize(read?.payer_hint || "");
    const payer = hint ? members.find((m) => normalize(m.display_name).split(" ").some((w) => w.length > 2 && hint.includes(w)))?.id || null : null;
    patch(entry.id, { status: "pret", read, fields: initialFields(read, entry.file), type: read?.doc_type || null, payer });
  }

  function addFiles(list) {
    const picked = Array.from(list || []).slice(0, Math.max(0, MAX_FILES - docs.length));
    const entries = picked.map((file) => ({ id: uid(), file, name: file.name, status: "lecture" }));
    setDocs((x) => [...x, ...entries]);
    entries.forEach(readOne);
  }

  const doc = ready[cur] || null;
  const total = doc ? parseAmount(String(doc.fields.total)) || 0 : 0;
  const paid = doc ? parseAmount(String(doc.fields.paid)) || 0 : 0;
  const nextUp = doc?.read?.upcoming?.[0] || null;
  const uncertain = new Set(doc?.read?.uncertain || []);

  function goNext() {
    setEditing(null);
    if (cur + 1 >= ready.length) setStep("fin");
    else {
      setCur(cur + 1);
      setQ("type");
    }
  }

  function back() {
    setEditing(null);
    if (q === "payer" || q === "compare") setQ("type");
    else if (q === "check") setQ(doc.type === "devis_non_signe" ? "type" : "payer");
    else if (cur > 0) {
      setCur(cur - 1);
      setQ("check");
    }
  }

  async function folderId() {
    if (!data.documentsSetup) return null;
    if (folderRef.current) return folderRef.current;
    const found = (dash.data.folders || []).find((f) => normalize(f.name) === normalize(FOLDER_NAME));
    if (found) return (folderRef.current = found.id);
    const [row] = await dash.insert("document_folders", { name: FOLDER_NAME, color: nextFolderColor(dash.data.folders || []), position: (dash.data.folders || []).length, created_by: data.meId || null, created_at: new Date().toISOString() });
    return (folderRef.current = row.id);
  }

  async function storeFile(d, kind, itemId, vendorId) {
    if (!data.documentsSetup && dash.mode === "live") return;
    const fid = await folderId();
    const res = await dash.uploadDocument(d.file, { folderId: fid, name: d.file.name, kind, budgetItemId: itemId, vendorId });
    if (!res.ok) dash.setToast({ kind: "error", text: `« ${d.file.name} » n'a pas pu être rangé dans Documents.` });
  }

  // Devis pas encore signé : rangé dans « Factures et devis », pas dans le budget
  async function keepForCompare() {
    setBusy(true);
    await storeFile(doc, "devis", null, null);
    setTracked((t) => ({ ...t, compare: t.compare + 1 }));
    setBusy(false);
    goNext();
  }

  async function validate() {
    setBusy(true);
    const f = doc.fields;
    const isInvoice = doc.type === "facture";
    const vendorName = f.vendor.trim() || "Prestataire";
    const poste = f.poste.trim() || vendorName;
    const date = f.date || todayIso();

    // Prestataire : celui qui existe déjà sous ce nom, sinon un nouveau
    let vendor = dash.data.vendors.find((v) => normalize(v.name) === normalize(vendorName));
    if (!vendor) [vendor] = await dash.insert("vendors", { name: vendorName, category: poste });
    if (doc.read?.iban && !vendor.iban) await dash.update("vendors", vendor.id, { iban: doc.read.iban, bic: doc.read.bic || null });

    // Poste : le poste du même nom s'il est libre ou déjà chez ce prestataire, sinon un nouveau
    const all = dash.data.items;
    let item = all.find((i) => normalize(i.label) === normalize(poste) && (!i.vendor_id || i.vendor_id === vendor.id));
    if (!item) {
      const taken = all.some((i) => normalize(i.label) === normalize(poste));
      const label = taken ? `${poste} · ${vendorName}` : poste;
      [item] = await dash.insert("budget_items", { label, icon: guessIcon(poste), position: all.length });
    }
    await dash.update("budget_items", item.id, { vendor_id: vendor.id, quote_amount: total || null, quote_signed_at: date });

    // Paiements : ce qui est réglé, puis les échéances à venir
    const rows = [];
    const paidAmount = isInvoice ? total || paid : paid;
    if (paidAmount > 0) {
      const lines = doc.read?.paid?.length && Math.round(sum(doc.read.paid)) === Math.round(paidAmount) ? doc.read.paid : [{ label: isInvoice ? "Règlement" : "Acompte", amount: paidAmount, date }];
      for (const p of lines) rows.push({ budget_item_id: item.id, label: p.label || "Acompte", amount: Number(p.amount), due_date: p.date || date, paid_at: p.date || date, payer_id: doc.payer || null });
    }
    if (!isInvoice) {
      for (const u of doc.read?.upcoming || []) {
        rows.push({ budget_item_id: item.id, label: u.label || "Échéance", amount: Number(u.amount), due_date: u.due_date || null, paid_at: null, payer_id: paidAmount > 0 ? null : doc.payer || null });
      }
    }
    if (rows.length) await dash.insert("payments", rows);

    await storeFile(doc, isInvoice ? "facture" : "devis", item.id, vendor.id);
    setTracked((t) => ({ ...t, amount: t.amount + (total || 0), signed: t.signed + 1 }));
    setBusy(false);
    goNext();
  }

  // ---------------------------------------------------------------- écrans

  const progress = (
    <div className="d-imp-progress" aria-hidden="true">
      {ready.map((d, i) => (
        <span key={d.id} className={i < cur ? "is-done" : i === cur ? "is-on" : ""} />
      ))}
    </div>
  );

  const docCard = doc ? (
    <div className="d-imp-doc">
      <span className="d-imp-ext">{extOf(doc.name)}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="d-imp-docname">{doc.name}</div>
        <div className="d-imp-docmeta">
          <PosteChip label={doc.fields.poste} />
          {[doc.fields.vendor, total ? euros(total) : null].filter(Boolean).join(" · ")}
        </div>
      </div>
    </div>
  ) : null;

  const payerQuestion = !doc
    ? ""
    : doc.type === "facture"
      ? `Qui a réglé ${total ? `les ${euros(total)}` : "cette facture"} ?`
      : paid > 0
        ? `Qui a payé l'acompte de ${euros(paid)} ?`
        : nextUp
          ? `Qui paiera ${String(nextUp.label || "le prochain paiement").toLowerCase().startsWith("acompte") ? "l'acompte" : "le prochain paiement"} de ${euros(nextUp.amount)} ?`
          : "Qui paiera ce prestataire ?";
  const nothingPaid = doc && doc.type !== "facture" && paid <= 0;

  const rows = doc
    ? [
        { key: "vendor", label: "Prestataire", value: doc.fields.vendor, input: "text", flag: uncertain.has("vendor_name") },
        { key: "poste", label: "Poste", value: doc.fields.poste, input: "text", chip: true, flag: uncertain.has("category") },
        { key: "total", label: "Montant total", value: total ? euros(total) : "", raw: doc.fields.total, input: "amount", flag: uncertain.has("total") },
        { key: "date", label: doc.type === "facture" ? "Réglée le" : "Signé le", value: doc.fields.date ? shortDate(doc.fields.date, { year: true }) : "", raw: doc.fields.date, input: "date", flag: uncertain.has("doc_date") },
        doc.type === "facture"
          ? { key: "payer", label: "Payé par", value: members.find((m) => m.id === doc.payer)?.display_name || "À choisir", fixed: true }
          : { key: "paid", label: "Déjà payé", value: paid ? `${euros(paid)}${doc.payer ? ` par ${members.find((m) => m.id === doc.payer)?.display_name || ""}` : ""}` : "Rien pour l'instant", raw: doc.fields.paid, input: "amount" },
        { key: "rest", label: "Reste à payer", value: total ? euros(Math.max(0, total - (doc.type === "facture" ? total : paid))) : "", fixed: true },
      ]
    : [];

  return (
    <div className="d-imp">
      <PageHeader
        back={{ href: "/dashboard/budget", label: "Budget" }}
        title="Devis et factures."
        actions={step === "flow" && tracked.amount ? <span className="d-imp-counter"><strong>{euros(tracked.amount)}</strong> dans le budget</span> : null}
      />

      {step === "depot" ? (
        <div className="d-col" style={{ gap: 18 }}>
          <button
            type="button"
            className={`d-imp-drop${over ? " is-over" : ""}`}
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setOver(true);
            }}
            onDragLeave={() => setOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setOver(false);
              addFiles(e.dataTransfer.files);
            }}
          >
            <span className="d-imp-drop-icon">
              <Icon name="upload" size={28} sw={1.8} />
            </span>
            <strong>Déposez vos devis signés et vos factures</strong>
            <span>PDF, photos ou captures, plusieurs à la fois</span>
          </button>
          <input ref={inputRef} type="file" multiple accept="application/pdf,image/*" hidden onChange={(e) => addFiles(e.target.files)} />

          {docs.length ? (
            <div className="d-imp-files">
              {docs.map((d) => (
                <div key={d.id} className="d-imp-file">
                  <span className="d-imp-ext">{extOf(d.name)}</span>
                  <span className="d-imp-file-name">{d.name}</span>
                  {d.status === "lecture" ? <span className="d-small d-muted">Lecture…</span> : null}
                  {d.status === "pret" ? (
                    <span className="d-okpill is-small">
                      <Icon name="check" size={12} sw={2.4} />
                      Lu
                    </span>
                  ) : null}
                  {d.status === "erreur" ? <span className="d-small" style={{ color: "#9b2c2c" }}>{d.why}</span> : null}
                  <button type="button" className="d-icon-btn" aria-label={`Retirer ${d.name}`} onClick={() => setDocs((x) => x.filter((y) => y.id !== d.id))}>
                    <Icon name="x" size={14} />
                  </button>
                </div>
              ))}
            </div>
          ) : null}

          {ready.length ? (
            <Btn
              className="d-btn-block"
              disabled={reading}
              onClick={() => {
                setCur(0);
                setQ("type");
                setStep("flow");
              }}
            >
              {reading ? "Merry lit vos documents…" : `Vérifier ${ready.length > 1 ? `les ${ready.length} documents` : "le document"}`}
            </Btn>
          ) : null}
          {aiOff ? <p className="d-small d-muted" style={{ margin: 0 }}>La lecture automatique n'est pas encore activée : vous remplirez les montants en un instant.</p> : null}
        </div>
      ) : null}

      {step === "flow" && doc ? (
        <div className="d-col" style={{ gap: 22 }}>
          <div className="d-col" style={{ gap: 10 }}>
            <span className="d-small d-muted" style={{ fontWeight: 600 }}>
              Document {cur + 1} sur {ready.length}
            </span>
            {progress}
          </div>
          {docCard}

          {q === "type" ? (
            <div className="d-col" style={{ gap: 14 }}>
              <h2 className="d-imp-q">C'est un devis ou une facture ?</h2>
              {TYPES.map((t) => (
                <button
                  key={t.k}
                  type="button"
                  className={`d-imp-option${doc.type === t.k ? " is-on" : ""}`}
                  onClick={() => {
                    patch(doc.id, { type: t.k });
                    setQ(t.k === "devis_non_signe" ? "compare" : "payer");
                  }}
                >
                  <span className="d-choice-text">
                    <strong>{t.label}</strong>
                    <span>{t.sub}</span>
                  </span>
                  {doc.read?.doc_type === t.k ? <span className="d-imp-guess">Merry pense que oui</span> : null}
                </button>
              ))}
            </div>
          ) : null}

          {q === "payer" ? (
            <div className="d-col" style={{ gap: 14 }}>
              <h2 className="d-imp-q">{payerQuestion}</h2>
              <div className="d-imp-payers">
                {members.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    className={`d-imp-payer${doc.payer === m.id ? " is-on" : ""}`}
                    onClick={() => {
                      patch(doc.id, { payer: m.id });
                      setQ("check");
                    }}
                  >
                    <Avatar member={m} size={36} />
                    {m.display_name}
                  </button>
                ))}
                <button
                  type="button"
                  className={`d-imp-payer${doc.payer === null && doc.payerSkipped ? " is-on" : ""}`}
                  onClick={() => {
                    patch(doc.id, { payer: null, payerSkipped: true });
                    setQ("check");
                  }}
                >
                  <span className="d-imp-q-avatar">?</span>
                  {nothingPaid ? "On verra plus tard" : "Je ne sais plus"}
                </button>
              </div>
            </div>
          ) : null}

          {q === "check" ? (
            <div className="d-col" style={{ gap: 14 }}>
              <h2 className="d-imp-q">On a bien lu ?</h2>
              <div className="d-imp-fields">
                {rows.map((r) => (
                  <div key={r.key} className={`d-imp-field${r.flag ? " is-flag" : ""}`}>
                    <span className="d-imp-field-label">{r.label}</span>
                    {editing === r.key && !r.fixed ? (
                      <input
                        className="d-input"
                        autoFocus
                        type={r.input === "date" ? "date" : "text"}
                        inputMode={r.input === "amount" ? "decimal" : undefined}
                        defaultValue={r.raw ?? r.value}
                        onBlur={(e) => {
                          patch(doc.id, (d) => ({ fields: { ...d.fields, [r.key]: e.target.value } }));
                          setEditing(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") e.currentTarget.blur();
                        }}
                        style={{ flex: 1, minHeight: 38 }}
                      />
                    ) : (
                      <span className="d-imp-field-value">{r.chip && r.value ? <PosteChip label={r.value} /> : r.value || <span className="d-muted">À compléter</span>}</span>
                    )}
                    {r.flag ? <span className="d-imp-flag">à vérifier</span> : null}
                    {!r.fixed ? (
                      <button type="button" className="d-icon-btn" aria-label={`Modifier ${r.label}`} onClick={() => setEditing(r.key)}>
                        <Icon name="pencil" size={15} />
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>
              <Btn className="d-btn-block d-imp-validate" icon="check" disabled={busy || !doc.fields.vendor.trim() || !total} onClick={validate}>
                {busy ? "Ajout…" : "Tout valider et ajouter au budget"}
              </Btn>
            </div>
          ) : null}

          {q === "compare" ? (
            <div className="d-col" style={{ gap: 14, alignItems: "flex-start" }}>
              <h2 className="d-imp-q">Rangé avec les devis à comparer.</h2>
              <p className="d-muted" style={{ margin: 0 }}>Il entrera dans le budget le jour où vous le signerez.</p>
              <Btn disabled={busy} onClick={keepForCompare}>
                Document suivant
              </Btn>
            </div>
          ) : null}

          <div className="d-imp-nav">
            <button type="button" onClick={back} disabled={cur === 0 && q === "type"}>
              Retour
            </button>
            <button type="button" onClick={goNext}>
              Passer ce document
            </button>
          </div>
        </div>
      ) : null}

      {step === "fin" ? <Fin tracked={tracked} data={dash.data} onMore={() => { setDocs([]); setStep("depot"); setCur(0); }} /> : null}
    </div>
  );
}

function Fin({ tracked, data, onMore }) {
  const b = budgetTotals(data);
  const parts = [];
  if (tracked.signed) parts.push(`${tracked.signed} prestataire${tracked.signed > 1 ? "s" : ""} suivi${tracked.signed > 1 ? "s" : ""}`);
  if (tracked.compare) parts.push(`${tracked.compare} devis à comparer`);
  return (
    <div className="d-imp-fin">
      <span className="d-imp-fin-check">
        <Icon name="check" size={40} sw={2.4} />
      </span>
      <h2>{tracked.signed ? "C'est dans le budget." : "C'est rangé."}</h2>
      <p className="d-muted" style={{ margin: 0 }}>{parts.join(", ") || "Aucun document ajouté."}</p>
      <div className="d-imp-fin-stats">
        <div>
          <span>Engagé</span>
          <strong>{euros(b.engaged)}</strong>
        </div>
        <div>
          <span>Déjà payé</span>
          <strong>{euros(b.paid)}</strong>
        </div>
        <div>
          <span>Prochain paiement</span>
          <strong>{b.nextPayment ? euros(b.nextPayment.amount) : "–"}</strong>
          {b.nextPayment?.due_date ? <small>{shortDate(b.nextPayment.due_date)}</small> : null}
        </div>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 12 }}>
        <Btn href="/dashboard/budget">Voir le budget</Btn>
        <Btn kind="strong" onClick={onMore}>
          Ajouter d'autres documents
        </Btn>
      </div>
      <Link href="/dashboard/documents" className="d-link">
        Retrouver les fichiers dans Documents
      </Link>
    </div>
  );
}
