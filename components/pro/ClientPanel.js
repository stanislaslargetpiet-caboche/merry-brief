"use client";

// Fiche d'un client (maquette V6b/V6m) : panneau à droite sur ordinateur, page entière sur
// téléphone. Partagé entre Réservations (clients actifs) et Anciens clients (historique).

import { useEffect, useRef, useState } from "react";
import { usePro } from "@/lib/pro/store";
import { isoDate, shortDate, toDate } from "@/lib/dash/format";
import { dateLong, faceColor, firstName, messageAuthor, isPastClient, STAGES } from "@/lib/pro/format";
import { ProIcon } from "@/components/pro/icons";
import { Face } from "@/components/pro/ui";
import { CloseBtn } from "@/components/pro/FeatureDialog";

export const NEW_CLIENT = "nouveau";

// « Domaine des Oliviers » → « DO »
const vendorInitials = (name) =>
  String(name || "?")
    .split(/[\s’']+/)
    .filter((w) => w && !/^(de|des|du|la|le|les|d|l|et)$/i.test(w))
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");

export default function ClientPanel({ c, write, onClose, onCreated, backLabel }) {
  const pro = usePro();
  const isNew = !c;
  const fromMerry = c?.source === "merry";
  const [draft, setDraft] = useState(() => ({ names: "", wedding_date: "", guests: "", budget_label: "", email: "", phone: "", stage: "nouvelle", next_action: "", next_action_on: "", notes: "" }));
  const [thread, setThread] = useState([]);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);
  const msgRef = useRef(null);
  const docs = (pro.data.documents || []).filter((x) => c && x.client_id === c.id);
  const save = (patch) => c && pro.updateRow("pro_clients", "clients", c.id, { ...patch, updated_at: new Date().toISOString() });

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    if (fromMerry) pro.loadThread(c.id).then(setThread);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [c?.id, fromMerry]);

  useEffect(() => {
    if (write && fromMerry) setTimeout(() => msgRef.current?.focus(), 200);
  }, [write, fromMerry]);

  async function create() {
    if (!draft.names.trim()) return;
    setBusy(true);
    const row = await pro.insertRow("pro_clients", "clients", {
      names: draft.names.trim(),
      wedding_date: draft.wedding_date || null,
      guests: draft.guests ? Number(draft.guests) || null : null,
      budget_label: draft.budget_label.trim() || null,
      email: draft.email.trim() || null,
      phone: draft.phone.trim() || null,
      stage: draft.stage,
      next_action: draft.next_action.trim() || null,
      next_action_on: draft.next_action_on || null,
      notes: draft.notes.trim() || null,
      source: "hors_merry",
      updated_at: new Date().toISOString(),
    });
    setBusy(false);
    if (row) onCreated(row.id);
  }

  async function send() {
    if (!msg.trim()) return;
    setBusy(true);
    const ok = await pro.sendMessage(c.id, msg);
    setBusy(false);
    if (ok) {
      setMsg("");
      if (pro.mode === "demo") setThread((t) => [...t, { id: String(Date.now()), from_vendor: true, author_id: (pro.data.members || []).find((x) => x.user_id && x.user_id === pro.data.user?.id)?.id, body: msg.trim(), sent_at: new Date().toISOString() }]);
      else pro.loadThread(c.id).then(setThread);
    }
  }

  const v = pro.data.vendor;
  const value = (k) => (isNew ? draft[k] : c[k] ?? "");
  const set = (k, x) => (isNew ? setDraft((d) => ({ ...d, [k]: x })) : save({ [k]: x }));
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Le panneau reste ouvert ; si la nouvelle étape fait changer le client d'onglet, on dit où il est parti
  function setStage(stage) {
    if (isNew) return set("stage", stage);
    const wasPast = isPastClient(c);
    save({ stage });
    const nowPast = isPastClient({ ...c, stage });
    if (wasPast !== nowPast) pro.setToast({ kind: "ok", text: `${c.names} : déplacé dans ${nowPast ? "Anciens clients" : "Réservations"}.` });
  }

  async function remove() {
    if (await pro.deleteRow("pro_clients", "clients", c.id)) {
      pro.setToast({ kind: "ok", text: `${c.names} : supprimé.` });
      onClose();
    }
  }

  return (
    <>
      <div className="p-panel-scrim" aria-hidden="true" onClick={onClose} />
      <aside role="dialog" aria-modal="true" aria-labelledby="client-titre" className="p-panel">
        <div className="p-panel-head">
          <button type="button" className="p-back p-phone-only" onClick={onClose}>
            <ProIcon name="prev" size={16} sw={2} />
            {backLabel || "Clients"}
          </button>
          <div className="p-panel-who">
            {isNew ? null : <Face names={c.names} size={44} />}
            <h2 id="client-titre">{isNew ? "Nouveau client" : c.names}</h2>
          </div>
          <span className="p-desk-only">
            <CloseBtn onClose={onClose} />
          </span>
        </div>
        <div className="p-panel-body">
          {isNew ? (
            <div className="p-field">
              <label htmlFor="cl-names">Le couple</label>
              <input id="cl-names" className="p-input" placeholder="Julie & Paul" value={draft.names} onChange={(e) => setDraft((d) => ({ ...d, names: e.target.value }))} autoFocus />
            </div>
          ) : null}
          <div className="p-field">
            <label htmlFor="stage">Étape</label>
            <select id="stage" className="p-input" value={value("stage")} onChange={(e) => setStage(e.target.value)}>
              {STAGES.map((x) => (
                <option key={x.key} value={x.key}>
                  {x.label}
                </option>
              ))}
            </select>
          </div>
          {value("stage") === "perdu" && !isNew ? <Editable id="lost" label="Pourquoi" value={c.lost_reason} onSave={(t) => save({ lost_reason: t || null })} placeholder="A choisi un autre lieu" /> : null}
          {fromMerry ? (
            <dl className="p-facts2">
              <Fact k="Date du mariage" v={c.date_label && /flexible/i.test(c.date_label) ? c.date_label : dateLong(c.wedding_date) || "À définir"} />
              <Fact k="Invités" v={c.guests || "À définir"} />
              <Fact k="Budget" v={c.budget_label || "Non partagé"} />
              <Fact k="Venue par" v="Merry" />
              <Fact k="Mail" v={c.email || "Par la messagerie Merry"} />
              <Fact k="Téléphone" v={c.phone || "–"} />
            </dl>
          ) : (
            <div className="p-facts2 is-edit">
              <Editable id="cl-date" type="date" label="Date du mariage" value={value("wedding_date")} onSave={(t) => set("wedding_date", t || null)} />
              <Editable id="cl-guests" type="number" label="Invités" value={value("guests")} onSave={(t) => set("guests", t ? Number(t) || null : null)} />
              <Editable id="cl-budget" label="Budget" value={value("budget_label")} onSave={(t) => set("budget_label", t || null)} placeholder="30 000 à 40 000 €" />
              <div className="p-fact">
                <span>Venue par</span>
                <strong>Hors Merry</strong>
              </div>
              <Editable id="cl-mail" type="email" label="Mail" value={value("email")} onSave={(t) => set("email", t || null)} />
              <Editable id="cl-tel" type="tel" label="Téléphone" value={value("phone")} onSave={(t) => set("phone", t || null)} />
            </div>
          )}
          <div className="p-rule is-flat" />
          <div className="p-next">
            <Editable id="na" label="Prochaine action" value={value("next_action")} onSave={(t) => set("next_action", t || null)} />
            <Editable id="nd" type="date" label="Le" value={value("next_action_on")} onSave={(t) => set("next_action_on", t || null)} />
          </div>
          <div className="p-field">
            <label htmlFor="notes" className="p-notes-label">
              Notes
            </label>
            <Editable id="notes" area value={value("notes")} onSave={(t) => set("notes", t || null)} bare />
          </div>
          {isNew ? (
            <div className="p-edit-actions">
              <span />
              <span>
                <button type="button" className="p-btn p-btn-ghost is-40" onClick={onClose}>
                  Annuler
                </button>
                <button type="button" className="p-btn p-btn-primary is-40" onClick={create} disabled={busy || !draft.names.trim()}>
                  Ajouter le client
                </button>
              </span>
            </div>
          ) : (
            <>
              {fromMerry ? (
                <>
                  <div className="p-rule is-flat" />
                  <section className="p-msgs">
                    <h3>Messages</h3>
                    {thread.map((m) => {
                      const a = m.from_vendor ? messageAuthor(m, pro.data.members, pro.data.user) : null;
                      return (
                      <div key={m.id} className="p-msg">
                        <span aria-hidden="true" className="p-msg-face" style={{ background: a ? a.color.mid : m.from_vendor ? "#e4e2dc" : faceColor(c.names), color: a ? a.color.ink : undefined }}>
                          {a ? a.initial : m.from_vendor ? vendorInitials(v.name) : firstName(c.names)[0]}
                        </span>
                        <div>
                          <span className="p-msg-who">
                            <strong>{m.from_vendor ? (a ? (a.mine ? `${a.name} (vous)` : a.name) : "Vous") : firstName(c.names)}</strong> <span className="p-muted">· {shortDate(new Date(m.sent_at))}</span>
                          </span>
                          <span className={`p-msg-body${m.from_vendor ? " is-me" : ""}`}>{m.body}</span>
                        </div>
                      </div>
                      );
                    })}
                    <div className="p-composer">
                      <label htmlFor="msg" className="p-sr">
                        Écrire à {firstName(c.names)}
                      </label>
                      <textarea ref={msgRef} id="msg" rows={2} placeholder={`Écrire à ${firstName(c.names)}…`} value={msg} onChange={(e) => setMsg(e.target.value)} />
                      <button type="button" aria-label="Envoyer" onClick={send} disabled={busy || !msg.trim()}>
                        <ProIcon name="send" size={16} stroke="#ffffff" sw={2} />
                      </button>
                    </div>
                  </section>
                </>
              ) : null}
              <div className="p-rule is-flat" />
              <section className="p-docs">
                <h3>Documents</h3>
                {docs.map((doc) => (
                  <div key={doc.id} className="p-doc">
                    <span className="p-doc-ic">
                      <ProIcon name="file" size={18} />
                    </span>
                    <span className="p-doc-text">
                      <span className="p-doc-name">{doc.name}</span>
                      <span className="p-doc-meta">
                        {(doc.storage_path.match(/\.([a-z0-9]+)$/i)?.[1] || "Fichier").toUpperCase()} · {shortDate(new Date(doc.created_at))}
                      </span>
                    </span>
                    <button type="button" className="p-link is-135" onClick={() => pro.openDocument(doc)}>
                      Ouvrir
                    </button>
                  </div>
                ))}
                <input
                  ref={fileRef}
                  type="file"
                  hidden
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (f) await pro.addDocument(c.id, f);
                    e.target.value = "";
                  }}
                />
                <button type="button" className="p-link is-plain is-135 p-start" onClick={() => fileRef.current?.click()}>
                  <ProIcon name="plus" size={15} sw={2} />
                  Ajouter un document
                </button>
              </section>
              {/* Un client venu par Merry garde son historique ; seul un client ajouté à la main se supprime */}
              {fromMerry ? null : (
                <>
                  <div className="p-rule is-flat" />
                  {confirmDelete ? (
                    <div className="p-edit-actions">
                      <span>Supprimer {c.names} et ses documents ?</span>
                      <span>
                        <button type="button" className="p-btn p-btn-ghost is-40" onClick={() => setConfirmDelete(false)}>
                          Annuler
                        </button>
                        <button type="button" className="p-btn p-btn-primary is-40" onClick={remove}>
                          Supprimer
                        </button>
                      </span>
                    </div>
                  ) : (
                    <button type="button" className="p-link is-small is-muted p-start" onClick={() => setConfirmDelete(true)}>
                      Supprimer le client
                    </button>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </aside>
    </>
  );
}

function Fact({ k, v }) {
  return (
    <div className="p-fact">
      <dt>{k}</dt>
      <dd>{v}</dd>
    </div>
  );
}

// Champ du client : enregistré quand on le quitte
function Editable({ id, label, value, onSave, type = "text", area, placeholder, bare }) {
  const [x, setX] = useState(value ?? "");
  const last = useRef(value);
  useEffect(() => {
    if (value !== last.current) {
      last.current = value;
      setX(value ?? "");
    }
  }, [value]);
  const commit = () => String(x) !== String(value ?? "") && onSave(typeof x === "string" ? x.trim() : x);
  const input = area ? (
    <textarea id={id} rows={3} className="p-textarea is-notes" value={x} placeholder={placeholder} onChange={(e) => setX(e.target.value)} onBlur={commit} />
  ) : (
    <input id={id} type={type} className="p-input" value={type === "date" ? isoDate(toDate(x)) || "" : x} placeholder={placeholder} onChange={(e) => setX(e.target.value)} onBlur={commit} onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()} />
  );
  if (bare) return input;
  return (
    <div className="p-field">
      <label htmlFor={id}>{label}</label>
      {input}
    </div>
  );
}
