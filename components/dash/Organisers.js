"use client";

import { useState } from "react";
import { useDash } from "@/lib/dash/store";
import { PASTEL_KEYS } from "@/lib/dash/theme";
import { uid } from "@/lib/dash/format";
import { Icon } from "./icons";
import { supabase } from "@/lib/supabase";
import { Avatar, Btn, Field, Modal } from "./ui";

function inviteLink(token) {
  if (typeof window === "undefined") return "";
  return `${window.location.origin}/connexion?invitation=${token}`;
}

export default function Organisers({ onClose }) {
  const dash = useDash();
  const { members, wedding, meId } = dash.data;
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [copied, setCopied] = useState(null);
  const [sending, setSending] = useState(null);
  const [sent, setSent] = useState({});

  const meName = (members.find((x) => x.id === meId)?.display_name || "").trim();
  const couple = [wedding.partner1, wedding.partner2].filter(Boolean).join(" et ");

  async function add(e) {
    e.preventDefault();
    if (!name.trim()) return;
    const used = new Set(members.map((m) => m.color));
    const color = PASTEL_KEYS.find((k) => !used.has(k)) || "gris";
    const id = uid();
    const role = /^parents?\b/i.test(name.trim()) ? "parents" : "organisateur";
    await dash.insert("wedding_members", {
      id,
      display_name: name.trim(),
      initial: name.trim().replace(/^parents? de /i, "P").charAt(0).toUpperCase(),
      color,
      role,
      email: email.trim() || null,
      position: members.length,
      invited_at: new Date().toISOString(),
      invite_token: uid(), // remplacé par celui de la base en mode réel
      user_id: null,
    });
    await dash.refreshMember(id);
    setName("");
    setEmail("");
  }

  async function copy(m) {
    try {
      await navigator.clipboard.writeText(inviteLink(m.invite_token));
      setCopied(m.id);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      window.prompt("Copiez ce lien :", inviteLink(m.invite_token));
    }
  }

  // Repli si l'envoi automatique n'est pas disponible (démo, service de mail non configuré)
  function openMailClient(m, email) {
    const subject = `Rejoins l'organisation du mariage de ${couple} sur Merry`;
    const body = `Hello !\n\nJe t'invite à rejoindre Merry pour organiser notre événement.\n\n${inviteLink(m.invite_token)}${meName ? `\n\n${meName}` : ""}`;
    window.location.href = `mailto:${encodeURIComponent(email || "")}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }

  async function sendMail(m) {
    let email = (m.email || "").trim();
    if (!email) {
      email = (window.prompt(`À quelle adresse envoyer l'invitation de ${m.display_name} ?`) || "").trim();
      if (!email) return;
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        dash.setToast({ kind: "error", text: "Cette adresse mail ne semble pas valide." });
        return;
      }
      await dash.update("wedding_members", m.id, { email });
    }
    if (dash.mode !== "live" || !supabase) return openMailClient(m, email);
    setSending(m.id);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const res = await fetch("/api/inviter", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${sess?.session?.access_token}` },
        body: JSON.stringify({ memberId: m.id }),
      });
      if (res.status === 501) return openMailClient(m, email);
      if (!res.ok) throw new Error(String(res.status));
      setSent((s) => ({ ...s, [m.id]: true }));
      dash.setToast({ kind: "ok", text: `Invitation envoyée à ${email}.` });
    } catch {
      dash.setToast({ kind: "error", text: "L'invitation n'a pas pu partir. Copiez le lien et envoyez-le vous-même." });
    } finally {
      setSending(null);
    }
  }

  return (
    <Modal title="Organisateurs" onClose={onClose} wide>
      <p className="d-muted">Chaque organisateur a les mêmes droits que vous : invités, rétroplanning et budget. Envoyez-lui son lien personnel pour qu'il crée son accès.</p>
      <ul className="d-org-list">
        {members.map((m) => (
          <li key={m.id} className="d-org-row">
            <Avatar member={m} size={34} />
            <div className="d-org-who">
              <strong>
                {m.display_name}
                {m.id === meId ? <span className="d-muted"> (vous)</span> : null}
              </strong>
              <span className="d-small d-muted">{m.user_id ? "A accès au tableau de bord" : m.email ? `Invitation en attente · ${m.email}` : "Invitation en attente"}</span>
            </div>
            {m.id === meId && dash.mode === "live" && members.filter((x) => x.user_id).length > 1 ? (
              <button
                type="button"
                className="d-link"
                style={{ color: "var(--d-muted)" }}
                onClick={async () => {
                  if (!window.confirm("Quitter l'organisation de ce mariage ? Il faudra un nouveau lien pour revenir.")) return;
                  const res = await dash.leaveWedding();
                  if (!res.ok) dash.setToast({ kind: "error", text: "Impossible de quitter ce mariage pour l'instant." });
                }}
              >
                Quitter ce mariage
              </button>
            ) : null}
            {!m.user_id ? (
              <div className="d-org-actions">
                <Btn kind="ghost" small icon={copied === m.id ? "check" : "copy"} onClick={() => copy(m)}>
                  {copied === m.id ? "Lien copié" : "Copier le lien"}
                </Btn>
                <Btn kind="ghost" small icon={sent[m.id] ? "check" : "mail"} onClick={() => sendMail(m)} disabled={sending === m.id}>
                  {sending === m.id ? "Envoi…" : sent[m.id] ? "Invitation envoyée" : "Envoyer par mail"}
                </Btn>
                <button
                  type="button"
                  className="d-icon-btn"
                  title="Retirer cette invitation"
                  aria-label={`Retirer ${m.display_name}`}
                  onClick={() => {
                    if (window.confirm(`Retirer ${m.display_name} des organisateurs ?`)) dash.remove("wedding_members", m.id);
                  }}
                >
                  <Icon name="trash" size={16} />
                </button>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
      <form className="d-org-form" onSubmit={add}>
        <Field label="Qui invitez-vous ?">
          <input className="d-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Parents de Margue, Léa (témoin)…" required />
        </Field>
        <Field label="Son mail (facultatif)">
          <input className="d-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="prenom@exemple.fr" />
        </Field>
        <Btn type="submit" icon="plus">
          Ajouter
        </Btn>
      </form>
      <p className="d-small d-muted">Un lien ne sert qu'une fois. S'il a circulé par erreur, retirez l'invitation et créez-en une nouvelle.</p>
    </Modal>
  );
}
