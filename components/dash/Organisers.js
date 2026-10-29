"use client";

import { useState } from "react";
import { useDash } from "@/lib/dash/store";
import { PASTEL_KEYS } from "@/lib/dash/theme";
import { uid } from "@/lib/dash/format";
import { Icon } from "./icons";
import { supabase } from "@/lib/supabase";
import { Avatar, Btn, Field, Modal, Popover, BusyDots } from "./ui";

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
  const [menu, setMenu] = useState(null);

  const meName = (members.find((x) => x.id === meId)?.display_name || "").trim();
  const couple = [wedding.partner1, wedding.partner2].filter(Boolean).join(" et ");

  async function add(e) {
    e.preventDefault();
    if (!name.trim()) return;
    const used = new Set(members.map((m) => m.color));
    const color = PASTEL_KEYS.find((k) => !used.has(k)) || "gris";
    const id = uid();
    const role = /^parents?\b/i.test(name.trim()) ? "parents" : "organisateur";
    const [row] = await dash.insert("wedding_members", {
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
    // Avec un mail, l'invitation part tout de suite (le serveur relit le lien à jour de la base)
    if (row?.email) sendMail(row);
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
    const subject = meName ? `${meName} t'invite à rejoindre Merry` : "Tu es invité(e) à rejoindre Merry";
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

  const remove = (m) => {
    setMenu(null);
    if (window.confirm(m.user_id ? `Retirer ${m.display_name} des organisateurs ? Il n'aura plus accès à ce mariage.` : `Retirer l'invitation de ${m.display_name} ?`)) dash.remove("wedding_members", m.id);
  };

  // Artboard 5a : la liste avec le statut de chacun, puis « Inviter un organisateur »
  return (
    <Modal title="Les organisateurs" onClose={onClose} wide>
      <ul className="d-org-list">
        {members.map((m) => (
          <li key={m.id} className="d-org-row">
            <Avatar member={m} size={38} />
            <div className="d-org-who">
              <strong>
                {m.display_name}
                {m.id === meId ? <span className="d-muted" style={{ fontWeight: 400 }}> (vous)</span> : null}
              </strong>
              <span className="d-org-meta">
                <span className={`d-org-status${m.user_id ? " is-on" : ""}`}>{m.user_id ? "Connecté" : "Invitation envoyée"}</span>
                {m.email ? <span className="d-small d-muted d-org-mail">{m.email}</span> : null}
              </span>
            </div>
            {!m.user_id ? (
              <div className="d-org-actions">
                <Btn kind="ghost" small icon={copied === m.id ? "check" : "copy"} onClick={() => copy(m)}>
                  {copied === m.id ? "Lien copié" : "Copier le lien"}
                </Btn>
                <span className="d-desk-only-inline">
                  <Btn kind="ghost" small icon={sent[m.id] ? "check" : "mail"} onClick={() => sendMail(m)} disabled={sending === m.id}>
                    {sending === m.id ? <BusyDots /> : sent[m.id] ? "Envoyée" : "Renvoyer"}
                  </Btn>
                </span>
                <button type="button" className="d-icon-btn is-flat" title="Retirer l'invitation" aria-label={`Retirer ${m.display_name}`} onClick={() => remove(m)}>
                  <Icon name="x" size={14} sw={2.4} />
                </button>
              </div>
            ) : m.id !== meId ? (
              <span className="d-anchor">
                <button type="button" className="d-icon-btn is-flat" aria-label={`Options pour ${m.display_name}`} onClick={() => setMenu(menu === m.id ? null : m.id)}>
                  <Icon name="dots" size={16} sw={2.4} />
                </button>
                <Popover open={menu === m.id} onClose={() => setMenu(null)} align="right">
                  <button type="button" className="d-pop-item is-danger" onClick={() => remove(m)}>
                    <span className="d-pop-label">
                      <Icon name="trash" size={14} sw={2} />
                      Retirer des organisateurs
                    </span>
                  </button>
                </Popover>
              </span>
            ) : null}
          </li>
        ))}
      </ul>
      <form className="d-org-invite" onSubmit={add}>
        <strong>Inviter un organisateur</strong>
        <div className="d-org-form">
          <Field label="Qui ?">
            <input className="d-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Léa, témoin" required />
          </Field>
          <Field label="Son mail">
            <input className="d-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="prenom@exemple.fr" />
          </Field>
          <Btn type="submit">Inviter</Btn>
        </div>
      </form>
    </Modal>
  );
}
