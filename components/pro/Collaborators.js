"use client";

// Collaborateurs de l'espace prestataire (maquette V1, Compte) : sur le modèle des organisateurs
// côté couple (components/dash/Organisers.js), via pro_members avec jeton d'invitation.

import { useEffect, useRef, useState } from "react";
import { usePro } from "@/lib/pro/store";
import { uid } from "@/lib/dash/format";
import { collabColor } from "@/lib/pro/format";
import { Icon } from "@/components/dash/icons";
import { supabase } from "@/lib/supabase";
import { Popover, BusyDots } from "@/components/dash/ui";

function inviteLink(token) {
  if (typeof window === "undefined" || !token) return "";
  return `${window.location.origin}/pro?invitation=${token}`;
}

export default function Collaborators() {
  const pro = usePro();
  const { members, user } = pro.data;
  const vendorName = pro.data.vendor?.name || "";
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [adding, setAdding] = useState(false);
  const [copied, setCopied] = useState(null);
  const [sending, setSending] = useState(null);
  const [sent, setSent] = useState({});
  const [menu, setMenu] = useState(null);
  const sectionRef = useRef(null);

  // Les liens de la barre latérale (#collaborateurs, #inviter) amènent ici ; « Inviter » ouvre le formulaire
  useEffect(() => {
    const show = (invite) => {
      // Saut direct, après le premier rendu : un défilement animé n'aboutit pas toujours à l'arrivée sur la page
      setTimeout(() => {
        sectionRef.current?.scrollIntoView({ block: "start" });
        if (invite) document.getElementById("collab-name")?.focus({ preventScroll: true });
      }, 60);
    };
    const hash = window.location.hash;
    if (hash === "#collaborateurs" || hash === "#inviter") show(hash === "#inviter");
    const onEvent = (e) => show(!!e.detail?.invite);
    window.addEventListener("merry:collab", onEvent);
    return () => window.removeEventListener("merry:collab", onEvent);
  }, []);

  async function add(e) {
    e.preventDefault();
    if (!email.trim() || adding) return;
    setAdding(true);
    try {
      const row = await pro.insertRow("pro_members", "members", {
        display_name: name.trim() || null,
        email: email.trim(),
        role: "collaborateur",
        user_id: null,
        invite_token: uid(), // remplacé par celui de la base en mode réel
        invited_at: new Date().toISOString(),
        joined_at: null,
      });
      setName("");
      setEmail("");
      if (row) sendMail(row);
    } finally {
      setAdding(false);
    }
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

  function openMailClient(m, email) {
    const subject = `Rejoignez ${vendorName} sur Merry`;
    const body = `Bonjour,\n\nJe vous invite à rejoindre notre espace prestataire sur Merry pour ${vendorName}.\n\n${inviteLink(m.invite_token)}`;
    window.location.href = `mailto:${encodeURIComponent(email || "")}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }

  async function sendMail(m) {
    const email = (m.email || "").trim();
    if (!email) return;
    if (pro.mode !== "live" || !supabase) return openMailClient(m, email);
    setSending(m.id);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const res = await fetch("/api/pro/inviter", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${sess?.session?.access_token}` },
        body: JSON.stringify({ memberId: m.id }),
      });
      if (res.status === 501) return openMailClient(m, email);
      if (!res.ok) throw new Error(String(res.status));
      setSent((s) => ({ ...s, [m.id]: true }));
      pro.setToast({ kind: "ok", text: `Invitation envoyée à ${email}.` });
    } catch {
      pro.setToast({ kind: "error", text: "L’invitation n’a pas pu partir. Copiez le lien et envoyez-le vous-même." });
    } finally {
      setSending(null);
    }
  }

  const remove = (m) => {
    setMenu(null);
    if (window.confirm(m.user_id ? `Retirer ${m.email || "cette personne"} des collaborateurs ? Elle n’aura plus accès à cette fiche.` : `Retirer l’invitation de ${m.email} ?`)) pro.deleteRow("pro_members", "members", m.id);
  };

  return (
    <section className="p-card p-options" id="collaborateurs" ref={sectionRef} style={{ scrollMarginTop: 24 }}>
      <h2 className="p-options-title">Collaborateurs</h2>
      <ul className="d-org-list">
        {members.map((m) => (
          <li key={m.id} className="d-org-row">
            <span
              aria-hidden="true"
              style={{
                flex: "none",
                width: 38,
                height: 38,
                borderRadius: 999,
                background: collabColor(m.id).mid,
                color: collabColor(m.id).ink,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              {(m.display_name || m.email || "?")[0].toUpperCase()}
            </span>
            <span className="d-org-who">
              <strong>
                {m.display_name || m.email || "Invitation en attente"}
                {m.user_id === user?.id ? <span className="p-muted" style={{ fontWeight: 400 }}> (vous)</span> : null}
              </strong>
              <span className="d-org-meta">
                <span className={`d-org-status${m.user_id ? " is-on" : ""}`}>{m.user_id ? "Connecté" : "Invitation envoyée"}</span>
                {m.display_name && m.email ? <span className="p-muted d-org-mail">{m.email}</span> : null}
              </span>
            </span>
            {!m.user_id ? (
              <span className="d-org-actions">
                <button type="button" className="p-btn p-btn-ghost is-135" onClick={() => copy(m)}>
                  {copied === m.id ? "Lien copié" : "Copier le lien"}
                </button>
                <button type="button" className="p-btn p-btn-ghost is-135" onClick={() => sendMail(m)} disabled={sending === m.id}>
                  {sending === m.id ? <BusyDots /> : sent[m.id] ? "Envoyée" : "Renvoyer"}
                </button>
                <button type="button" className="d-icon-btn is-flat" aria-label={`Retirer ${m.email}`} onClick={() => remove(m)}>
                  <Icon name="x" size={14} sw={2.4} />
                </button>
              </span>
            ) : m.user_id !== user?.id ? (
              <span className="d-anchor">
                <button type="button" className="d-icon-btn is-flat" aria-label={`Options pour ${m.email}`} onClick={() => setMenu(menu === m.id ? null : m.id)}>
                  <Icon name="dots" size={16} sw={2.4} />
                </button>
                <Popover open={menu === m.id} onClose={() => setMenu(null)} align="right">
                  <button type="button" className="d-pop-item is-danger" onClick={() => remove(m)}>
                    Retirer des collaborateurs
                  </button>
                </Popover>
              </span>
            ) : null}
          </li>
        ))}
      </ul>
      <form className="d-org-form" onSubmit={add}>
        <div className="p-field">
          <label htmlFor="collab-name">Qui ?</label>
          <input id="collab-name" className="p-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Théo, régisseur" />
        </div>
        <div className="p-field">
          <label htmlFor="collab-mail">Son mail</label>
          <input id="collab-mail" className="p-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="prenom@exemple.fr" required />
        </div>
        <button type="submit" className="p-btn p-btn-primary" disabled={adding || !email.trim()}>
          Inviter
        </button>
      </form>
    </section>
  );
}
