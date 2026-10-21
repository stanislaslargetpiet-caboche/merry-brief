"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { useDash } from "@/lib/dash/store";
import { itemFinance } from "@/lib/dash/model";
import { euros, initials, shortDate } from "@/lib/dash/format";
import { pastel } from "@/lib/dash/theme";
import { Icon, Tile, guessIcon } from "@/components/dash/icons";
import { Avatar, Bar, Btn, Field, InlineEdit, OkPill, PageHeader, PersonChip } from "@/components/dash/ui";

const KIND_LABEL = { devis: "Devis", facture: "Facture", autre: "Document" };

function telHref(phone) {
  return `tel:${String(phone || "").replace(/[^\d+]/g, "")}`;
}

function siteHref(site) {
  if (!site) return null;
  return /^https?:\/\//i.test(site) ? site : `https://${site}`;
}

export default function Prestataire() {
  const { id } = useParams();
  const dash = useDash();
  const { vendors, items, payments, documents, messages, members, wedding, meId } = dash.data;
  const vendor = vendors.find((v) => v.id === id);
  const [editSummary, setEditSummary] = useState(false);
  const [summary, setSummary] = useState(vendor?.summary || "");
  const [draft, setDraft] = useState("");
  const [docForm, setDocForm] = useState(null);

  if (!vendor) return <PageHeader back={{ href: "/dashboard/budget", label: "Le budget" }} title="Prestataire introuvable." />;

  const item = items.find((i) => i.vendor_id === vendor.id);
  const f = item ? itemFinance(item, payments) : null;
  const docs = documents.filter((d) => d.vendor_id === vendor.id || (item && d.budget_item_id === item.id));
  const thread = messages.filter((m) => m.vendor_id === vendor.id).sort((a, z) => String(a.sent_at).localeCompare(String(z.sent_at)));
  const memberById = new Map(members.map((m) => [m.id, m]));
  const couple = [wedding.partner1, wedding.partner2].filter(Boolean).join(" et ");
  const firstName = (vendor.contact_name || "").split(" ")[0];
  const bullets = (vendor.summary || "").split("\n").map((l) => l.trim()).filter(Boolean);

  function mailto(body) {
    const subject = `Mariage de ${couple}${wedding.wedding_date ? ` · ${shortDate(wedding.wedding_date, { year: true })}` : ""}`;
    return `mailto:${encodeURIComponent(vendor.email || "")}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body || "")}`;
  }

  async function send(fromVendor) {
    const body = draft.trim();
    if (!body) return;
    await dash.insert("vendor_messages", { vendor_id: vendor.id, from_vendor: fromVendor, author_id: fromVendor ? null : meId, body, sent_at: new Date().toISOString() });
    setDraft("");
    if (!fromVendor && vendor.email) window.location.href = mailto(body);
  }

  async function addDoc(e) {
    e.preventDefault();
    if (!docForm.url.trim() || !/^https?:\/\//i.test(docForm.url.trim())) return;
    await dash.insert("documents", { vendor_id: vendor.id, budget_item_id: item?.id || null, kind: docForm.kind, name: docForm.name.trim() || KIND_LABEL[docForm.kind], url: docForm.url.trim() });
    setDocForm(null);
  }

  return (
    <>
      <PageHeader back={{ href: "/dashboard/budget", label: "Le budget" }} />
      <div className="d-vendor-head" style={{ marginTop: -14 }}>
        <div className="d-vendor-id">
          <Tile name={item?.icon || guessIcon(vendor.category || vendor.name)} size={60} />
          <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
            <h1 className="d-title">{vendor.name}.</h1>
            <span style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, fontSize: 14, color: "var(--d-muted)" }}>
              <InlineEdit value={vendor.category} placeholder="Catégorie" label="catégorie" width={140} onSave={(v) => dash.update("vendors", vendor.id, { category: v })} />
              {f?.quote !== null && f?.quote !== undefined ? <span>· devis signé de {euros(f.quote)}</span> : null}
              {f?.quote !== null && f?.quote !== undefined ? <OkPill small>Réservé</OkPill> : null}
            </span>
          </div>
        </div>
        <div className="d-header-actions">
          {vendor.phone ? (
            <Btn kind="strong" icon="phone" href={telHref(vendor.phone)}>
              Appeler
            </Btn>
          ) : null}
          {vendor.email ? (
            <Btn icon="send" href={mailto(firstName ? `Bonjour ${firstName},\n\n` : "Bonjour,\n\n")}>
              Envoyer un message
            </Btn>
          ) : null}
        </div>
      </div>

      <div className="d-grid-side d-grid-vendor">
        <div className="d-col">
          <section className="d-card">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
              <h2>Résumé des échanges</h2>
              {!editSummary ? (
                <button type="button" className="d-link" onClick={() => setEditSummary(true)}>
                  Modifier
                </button>
              ) : null}
            </div>
            {editSummary ? (
              <div className="d-col" style={{ gap: 10 }}>
                <textarea className="d-textarea" value={summary} onChange={(e) => setSummary(e.target.value)} placeholder={"Une idée par ligne :\nReportage de 10 h, des préparatifs à la soirée\nAcompte de 30 % à la signature"} autoFocus />
                <div className="d-actions-end">
                  <Btn kind="ghost" small onClick={() => setEditSummary(false)}>
                    Annuler
                  </Btn>
                  <Btn
                    small
                    onClick={() => {
                      dash.update("vendors", vendor.id, { summary: summary.trim() || null });
                      setEditSummary(false);
                    }}
                  >
                    Enregistrer
                  </Btn>
                </div>
              </div>
            ) : bullets.length ? (
              <ul className="d-bullets">
                {bullets.map((l, i) => (
                  <li key={i}>{l}</li>
                ))}
              </ul>
            ) : (
              <p className="d-small d-muted" style={{ margin: 0 }}>
                Notez ici l'essentiel : ce qui est prévu, ce qui est signé, ce qu'il reste à caler.
              </p>
            )}
            <div className="d-todo">
              <Icon name="send" size={16} sw={2} />
              <span style={{ flex: 1, minWidth: 0 }}>
                <InlineEdit value={vendor.next_action ? `À faire : ${vendor.next_action}` : ""} placeholder="Ajouter la prochaine chose à faire" label="prochaine chose à faire" onSave={(v) => dash.update("vendors", vendor.id, { next_action: v ? v.replace(/^à faire\s*:\s*/i, "") : null })} />
              </span>
            </div>
          </section>

          <section className="d-card">
            <h2>Messages</h2>
            {thread.length ? (
              <div className="d-col" style={{ gap: 16 }}>
                {thread.map((m) => {
                  const author = m.from_vendor ? null : memberById.get(m.author_id);
                  const name = m.from_vendor ? `${firstName || vendor.name}, ${vendor.name}` : author?.display_name || "Vous";
                  return (
                    <div key={m.id} className={`d-msg${m.from_vendor ? "" : " is-ours"}`}>
                      {author ? (
                        <Avatar member={author} size={32} />
                      ) : (
                        <span className="d-avatar" style={{ width: 32, height: 32, background: "#e4e2dc", fontSize: 12 }}>
                          {initials(vendor.contact_name || vendor.name)}
                        </span>
                      )}
                      <div className="d-msg-body">
                        <span className="d-msg-meta">
                          <strong>{name}</strong> <span className="d-muted">· {shortDate(m.sent_at.slice(0, 10))}</span>
                        </span>
                        <div className="d-msg-bubble">{m.body}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="d-small d-muted" style={{ margin: 0 }}>
                Le fil garde les messages envoyés depuis Merry et les réponses que vous notez.
              </p>
            )}
            <div className="d-composer">
              <textarea value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={vendor.email ? `Écrire à ${firstName || vendor.name}…` : "Noter un échange…"} aria-label="Message" />
              <div className="d-composer-foot">
                <button type="button" className="d-link" style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6, color: "var(--d-muted)" }} onClick={() => send(true)} disabled={!draft.trim()}>
                  <Icon name="pencil" size={14} />
                  Noter sa réponse
                </button>
                <Btn small icon="send" onClick={() => send(false)} disabled={!draft.trim()}>
                  {vendor.email ? "Envoyer" : "Ajouter au fil"}
                </Btn>
              </div>
            </div>
            {vendor.email ? <p className="d-small d-muted" style={{ margin: 0 }}>« Envoyer » ouvre votre messagerie avec le texte prêt, et le garde dans le fil.</p> : null}
          </section>
        </div>

        <div className="d-col">
          <section className="d-card">
            <h2>Contact</h2>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span className="d-avatar" style={{ width: 40, height: 40, background: "#e4e2dc", fontSize: 14 }}>
                {initials(vendor.contact_name || vendor.name)}
              </span>
              <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                <InlineEdit value={vendor.contact_name} placeholder="Nom de votre interlocuteur" label="interlocuteur" onSave={(v) => dash.update("vendors", vendor.id, { contact_name: v })} />
                <span className="d-small d-muted">
                  <InlineEdit value={vendor.contact_role} placeholder="Son rôle" label="rôle" onSave={(v) => dash.update("vendors", vendor.id, { contact_role: v })} />
                </span>
              </div>
            </div>
            <div>
              {[
                ["phone", "Téléphone", "phone"],
                ["email", "Mail", "mail"],
                ["website", "Site", "globe"],
              ].map(([k, label, icon]) => (
                <div key={k} className="d-contact-row">
                  <Icon name={icon} size={16} style={{ marginTop: 3 }} />
                  <div>
                    <small>{label}</small>
                    <InlineEdit value={vendor[k]} placeholder="Ajouter" label={label.toLowerCase()} onSave={(v) => dash.update("vendors", vendor.id, { [k]: v })} />
                    {k === "website" && vendor.website ? (
                      <a href={siteHref(vendor.website)} target="_blank" rel="noreferrer" className="d-small">
                        Ouvrir le site
                      </a>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="d-card">
            <h2>Documents</h2>
            <div>
              {docs.map((d) => (
                <div key={d.id} className="d-file">
                  <span className="d-tile" style={{ width: 36, height: 36, borderRadius: 10, background: "var(--d-panel)" }}>
                    <Icon name="file" size={16} />
                  </span>
                  <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
                    <strong style={{ fontSize: 14 }}>{d.name}</strong>
                    <span className="d-small-muted">
                      {KIND_LABEL[d.kind]} · {shortDate(String(d.created_at || "").slice(0, 10))}
                    </span>
                  </span>
                  <a href={d.url} target="_blank" rel="noreferrer" className="d-small" style={{ fontWeight: 600 }}>
                    Ouvrir
                  </a>
                  <button type="button" className="d-icon-btn" style={{ width: 26, height: 26 }} aria-label={`Retirer ${d.name}`} onClick={() => window.confirm(`Retirer « ${d.name} » ?`) && dash.remove("documents", d.id)}>
                    <Icon name="x" size={12} sw={2.2} />
                  </button>
                </div>
              ))}
            </div>
            {docForm ? (
              <form className="d-col" style={{ gap: 10 }} onSubmit={addDoc}>
                <div className="d-form-grid">
                  <Field label="Type">
                    <select className="d-select" value={docForm.kind} onChange={(e) => setDocForm((x) => ({ ...x, kind: e.target.value }))}>
                      <option value="devis">Devis</option>
                      <option value="facture">Facture</option>
                      <option value="autre">Autre</option>
                    </select>
                  </Field>
                  <Field label="Nom">
                    <input className="d-input" value={docForm.name} onChange={(e) => setDocForm((x) => ({ ...x, name: e.target.value }))} placeholder="Facture d'acompte" />
                  </Field>
                  <Field label="Lien" full>
                    <input className="d-input" type="url" value={docForm.url} onChange={(e) => setDocForm((x) => ({ ...x, url: e.target.value }))} placeholder="https://" required autoFocus />
                  </Field>
                </div>
                <div className="d-actions-end">
                  <Btn kind="ghost" small onClick={() => setDocForm(null)}>
                    Annuler
                  </Btn>
                  <Btn small type="submit">
                    Ajouter
                  </Btn>
                </div>
              </form>
            ) : (
              <button type="button" className="d-link" style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 8, alignSelf: "flex-start" }} onClick={() => setDocForm({ kind: "facture", name: "", url: "" })}>
                <Icon name="plus" size={14} sw={2} />
                Ajouter un document
              </button>
            )}
          </section>

          {item ? (
            <section className="d-card is-panel">
              <h2>Paiements</h2>
              {f.quote !== null ? (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
                    <span className="d-muted">Payé</span>
                    <span>
                      <strong>{euros(f.paid)}</strong> sur {euros(f.quote)}
                    </span>
                  </div>
                  <Bar value={f.quote ? (f.paid / f.quote) * 100 : 0} color={f.payers[0] ? pastel(memberById.get(f.payers[0])?.color).mid : "#1c1c1a"} />
                </>
              ) : (
                <span className="d-small d-muted">Pas encore de devis signé.</span>
              )}
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <span style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {f.payers.map((pid) => (
                    <PersonChip key={pid} members={[memberById.get(pid)].filter(Boolean)} />
                  ))}
                </span>
                {f.next ? (
                  <span className="d-small d-muted">
                    {f.next.label} de {euros(f.next.amount)} {f.next.due_date === wedding.wedding_date ? "le jour J" : f.next.due_date ? `le ${shortDate(f.next.due_date)}` : ""}
                  </span>
                ) : null}
              </div>
              <Link href={`/dashboard/budget/paiement/${item.id}${f.next ? `?echeance=${f.next.id}` : ""}`} className="d-link" style={{ alignSelf: "flex-start" }}>
                Noter un paiement
              </Link>
            </section>
          ) : null}
        </div>
      </div>
    </>
  );
}
