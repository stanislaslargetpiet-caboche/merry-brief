"use client";

import { useState } from "react";
import { useDash } from "@/lib/dash/store";
import { PASTEL_KEYS } from "@/lib/dash/theme";
import { uid } from "@/lib/dash/format";
import { Icon } from "./icons";
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

  function mailto(m) {
    const subject = `Rejoins l'organisation du mariage de ${couple} sur Merry`;
    const body = `Bonjour,\n\nOn organise notre mariage sur Merry : invités, rétroplanning et budget au même endroit. Tu y as le même accès que nous.\n\nPour nous rejoindre, crée ton accès ici :\n${inviteLink(m.invite_token)}\n\nÀ très vite !`;
    return `mailto:${encodeURIComponent(m.email || "")}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
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
            {!m.user_id ? (
              <div className="d-org-actions">
                <Btn kind="ghost" small icon={copied === m.id ? "check" : "copy"} onClick={() => copy(m)}>
                  {copied === m.id ? "Lien copié" : "Copier le lien"}
                </Btn>
                <Btn kind="ghost" small icon="mail" href={mailto(m)}>
                  Envoyer par mail
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
