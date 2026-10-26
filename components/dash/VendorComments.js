"use client";

// Commentaires des organisateurs sur un prestataire (Mes prestataires, fiche du prestataire), avec réponses.
// Même fil que les commentaires des tâches du rétroplanning (TaskRow) : avatar, date, chacun écrit en son nom.
// Table vendor_comments (supabase/commentaires-prestataires.sql) ; sans elle, le fil explique quoi faire.

import { useState } from "react";
import { useDash } from "@/lib/dash/store";
import { shortDate } from "@/lib/dash/format";
import { Icon } from "./icons";
import { Avatar } from "./ui";

// « à l'instant », « il y a 5 min », « il y a 2 h », « hier », puis la date
export function ago(iso) {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "";
  const min = Math.round((Date.now() - t) / 60000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24 && new Date(t).toDateString() === new Date().toDateString()) return `il y a ${h} h`;
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (new Date(t).toDateString() === yesterday.toDateString()) return "hier";
  return shortDate(iso.slice(0, 10));
}

export function useVendorComments(vendorRef) {
  const { vendorComments = [] } = useDash().data;
  return vendorComments.filter((c) => c.vendor_ref === vendorRef);
}

export default function VendorComments({ vendorRef, name, compact }) {
  const dash = useDash();
  const { members, meId, vendorCommentsOn } = dash.data;
  const all = useVendorComments(vendorRef);
  const [replyTo, setReplyTo] = useState(null);

  if (dash.mode === "live" && !vendorCommentsOn) {
    return (
      <p className="d-small d-muted" style={{ margin: 0, lineHeight: 1.5 }}>
        Les commentaires ne sont pas encore installés : collez <code>supabase/commentaires-prestataires.sql</code> dans Supabase (SQL Editor), puis rechargez la page.
      </p>
    );
  }

  const top = all.filter((c) => !c.parent_id);
  const repliesOf = (id) => all.filter((c) => c.parent_id === id);

  async function send(body, parentId = null) {
    const text = body.trim();
    if (!text) return;
    await dash.insert("vendor_comments", { vendor_ref: vendorRef, parent_id: parentId, author_id: meId, body: text.slice(0, 2000), created_at: new Date().toISOString() });
    setReplyTo(null);
  }

  return (
    <div className={`d-thread d-pr-thread${compact ? " is-compact" : ""}`}>
      {top.map((c) => (
        <div key={c.id} className="d-pr-thread-item">
          <Comment c={c} members={members} meId={meId} onReply={() => setReplyTo(replyTo === c.id ? null : c.id)} />
          {repliesOf(c.id).map((r) => (
            <div key={r.id} className="d-pr-reply">
              <Comment c={r} members={members} meId={meId} />
            </div>
          ))}
          {replyTo === c.id ? (
            <div className="d-pr-reply">
              <Composer members={members} meId={meId} label={`Répondre à ${members.find((m) => m.id === c.author_id)?.display_name || "ce commentaire"}`} placeholder="Votre réponse…" autoFocus onSend={(t) => send(t, c.id)} />
            </div>
          ) : null}
        </div>
      ))}
      <Composer members={members} meId={meId} label={`Commenter : ${name}`} placeholder={top.length ? "Écrire un commentaire…" : "Un avis, une question pour les autres organisateurs…"} onSend={(t) => send(t)} />
    </div>
  );
}

function Comment({ c, members, meId, onReply }) {
  const dash = useDash();
  const who = members.find((m) => m.id === c.author_id);
  return (
    <div className="d-comment">
      {who ? <Avatar member={who} size={28} /> : <span className="d-comment-ghost" />}
      <div className="d-comment-body">
        <div className="d-comment-head">
          <strong>{who?.display_name || "Ancien organisateur"}</strong>
          <span>{ago(c.created_at)}</span>
          {onReply ? (
            <button type="button" className="d-link" onClick={onReply}>
              Répondre
            </button>
          ) : null}
          {c.author_id && c.author_id === meId ? (
            <button
              type="button"
              className="d-link"
              onClick={() => {
                if (window.confirm("Supprimer ce commentaire ?")) dash.remove("vendor_comments", c.id);
              }}
            >
              Supprimer
            </button>
          ) : null}
        </div>
        <p>{c.body}</p>
      </div>
    </div>
  );
}

function Composer({ members, meId, label, placeholder, onSend, autoFocus }) {
  const [text, setText] = useState("");
  const me = members.find((m) => m.id === meId);
  return (
    <form
      className="d-comment-form"
      onSubmit={(e) => {
        e.preventDefault();
        const t = text;
        setText("");
        onSend(t);
      }}
    >
      {me ? <Avatar member={me} size={28} /> : null}
      <input className="d-input" value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder} aria-label={label} maxLength={2000} autoFocus={autoFocus} />
      <button type="submit" className="d-send" aria-label="Envoyer" disabled={!text.trim()}>
        <Icon name="send" size={16} sw={2} />
      </button>
    </form>
  );
}
