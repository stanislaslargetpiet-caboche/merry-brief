"use client";

// Relancer les invités sans réponse : le message avec le lien du formulaire, à envoyer par mail (tous en
// copie cachée, ou un par un), WhatsApp ou SMS, puis « Marquer comme relancés » pour s'en souvenir.
// Merry n'envoie rien : chaque bouton ouvre l'application du couple, texte déjà écrit.

import { useMemo, useState } from "react";
import Link from "next/link";
import { useDash } from "@/lib/dash/store";
import { fullName, shortDate } from "@/lib/dash/format";
import { agoDays, inviteLink, mailHref, reminderSubject, reminderText, smsHref, waDigits, waHref } from "@/lib/dash/relance";
import { Icon } from "./icons";
import { Btn, Modal } from "./ui";

function remindedLabel(g) {
  const d = agoDays(g.reminded_at);
  if (d === null) return null;
  if (d === 0) return "relancé aujourd'hui";
  if (d === 1) return "relancé hier";
  return `relancé le ${shortDate(g.reminded_at.slice(0, 10))}`;
}

export default function RelanceModal({ guests, onClose, onMarked }) {
  const dash = useDash();
  const data = dash.data;
  const link = useMemo(() => inviteLink(data), [data]);
  const [text, setText] = useState(() => reminderText(data, link));
  const [onlyNew, setOnlyNew] = useState(false);
  const [copied, setCopied] = useState(null);
  const list = onlyNew ? guests.filter((g) => !g.reminded_at) : guests;
  const emails = [...new Set(list.map((g) => (g.email || "").trim()).filter(Boolean))];
  const phones = [...new Set(list.map((g) => (g.phone || "").trim()).filter(Boolean))];
  const noWay = list.filter((g) => !(g.email || "").trim() && !(g.phone || "").trim());
  const subject = reminderSubject(data);
  const setup = data.relancesSetup !== false;

  async function copy(what, value) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(what);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      window.prompt("Copiez :", value);
    }
  }

  return (
    <Modal
      title={`Relancer ${list.length} invité${list.length > 1 ? "s" : ""} sans réponse`}
      onClose={onClose}
      footer={
        <>
          <span className="d-small d-muted">{setup ? "Une fois les messages partis :" : "Pour garder la date des relances, lancez supabase/relances-et-foyers.sql."}</span>
          <span className="d-spacer" />
          <Btn kind="ghost" onClick={onClose}>
            Fermer
          </Btn>
          <Btn
            disabled={!setup || !list.length}
            onClick={async () => {
              await onMarked(list.map((g) => g.id));
              onClose();
            }}
          >
            Marquer comme relancés
          </Btn>
        </>
      }
    >
      <div className="d-col" style={{ gap: 18 }}>
        {!link ? (
          <p className="d-small" style={{ margin: 0, padding: 12, borderRadius: 12, background: "#fff4e5" }}>
            Pas encore de lien à envoyer : <Link href="/dashboard/invites/formulaire">créez le formulaire invités</Link> (ou mettez le site en ligne), le message le reprendra tout seul.
          </p>
        ) : null}
        <div className="d-gfilter">
          <div className="d-gfilter-head">
            <strong>Le message</strong>
            <button type="button" className="d-link" onClick={() => copy("text", text)}>
              {copied === "text" ? "Copié" : "Copier le texte"}
            </button>
          </div>
          <textarea className="d-textarea" rows={6} value={text} onChange={(e) => setText(e.target.value)} aria-label="Message de relance" />
        </div>

        <div className="d-gfilter">
          <div className="d-gfilter-head">
            <strong>Tous d'un coup</strong>
            {guests.some((g) => g.reminded_at) ? (
              <label className="d-small" style={{ display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                <input type="checkbox" className="d-check" checked={onlyNew} onChange={(e) => setOnlyNew(e.target.checked)} />
                Seulement ceux jamais relancés
              </label>
            ) : null}
          </div>
          <div className="d-filters">
            <Btn small icon="mail" href={mailHref(emails, subject, text, { bcc: true })} disabled={!emails.length} title="Un seul mail, tous les invités en copie cachée">
              Un mail à {emails.length} adresse{emails.length > 1 ? "s" : ""} (Cci)
            </Btn>
            <button type="button" className="d-pill" disabled={!emails.length} onClick={() => copy("emails", emails.join(", "))}>
              <Icon name="copy" size={14} sw={2} />
              {copied === "emails" ? "Copiées" : "Copier les adresses"}
            </button>
            <button type="button" className="d-pill" disabled={!phones.length} onClick={() => copy("phones", phones.join(", "))}>
              <Icon name="phone" size={14} sw={2} />
              {copied === "phones" ? "Copiés" : phones.length ? `Copier les ${phones.length} numéro${phones.length > 1 ? "s" : ""}` : "Copier les numéros"}
            </button>
          </div>
          {noWay.length ? (
            <p className="d-small d-muted" style={{ margin: 0 }}>
              {noWay.length} sans mail ni téléphone : {noWay.slice(0, 4).map((g) => fullName(g) || "sans nom").join(", ")}
              {noWay.length > 4 ? "…" : ""}. À relancer de vive voix, ou par leur famille.
            </p>
          ) : null}
        </div>

        <div className="d-gfilter">
          <div className="d-gfilter-head">
            <strong>Un par un</strong>
          </div>
          <ul className="d-moments d-relance-list">
            {list.map((g) => {
              const first = (g.first_name || "").trim();
              const perso = first ? text.replace(/^Bonjour !/, `Bonjour ${first} !`) : text;
              const when = remindedLabel(g);
              return (
                <li key={g.id} className="d-moment">
                  <span style={{ flex: "1 1 auto", minWidth: 0, display: "flex", flexDirection: "column", gap: 1 }}>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>{fullName(g) || "Sans nom"}</span>
                    <small className="d-muted">{[g.email, g.phone].filter(Boolean).join(" · ") || "ni mail ni téléphone"}{when ? ` · ${when}` : ""}</small>
                  </span>
                  <span className="d-filters" style={{ flex: "none", gap: 6 }}>
                    {g.email ? (
                      <a className="d-icon-btn" href={mailHref(g.email, subject, perso)} title={`Mail à ${g.email}`} aria-label={`Mail à ${fullName(g)}`}>
                        <Icon name="mail" size={16} sw={2} />
                      </a>
                    ) : null}
                    {waDigits(g.phone) ? (
                      <a className="d-icon-btn" href={waHref(g.phone, perso)} target="_blank" rel="noreferrer" title={`WhatsApp ${g.phone}`} aria-label={`WhatsApp à ${fullName(g)}`}>
                        <Icon name="bubble" size={16} sw={2} />
                      </a>
                    ) : null}
                    {g.phone ? (
                      <a className="d-icon-btn" href={smsHref(g.phone, perso)} title={`SMS au ${g.phone}`} aria-label={`SMS à ${fullName(g)}`}>
                        <Icon name="phone" size={16} sw={2} />
                      </a>
                    ) : null}
                  </span>
                </li>
              );
            })}
            {!list.length ? <li className="d-small d-muted">Personne à relancer.</li> : null}
          </ul>
        </div>
      </div>
    </Modal>
  );
}
