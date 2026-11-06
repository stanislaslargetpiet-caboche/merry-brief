"use client";

// Collaborateurs de l'espace prestataire (maquette V1, Compte) : sur le modèle des organisateurs
// côté couple (components/dash/Organisers.js), via pro_members avec jeton d'invitation.

import { Fragment, useEffect, useRef, useState } from "react";
import { usePro } from "@/lib/pro/store";
import { uid } from "@/lib/dash/format";
import { MEMBER_COLORS, memberColor, memberInitial, memberName } from "@/lib/pro/format";
import { pastel } from "@/lib/dash/theme";
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
  const [editing, setEditing] = useState(null);
  const [draft, setDraft] = useState({ first: "", last: "", color: "" });
  const [saving, setSaving] = useState(false);
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

  // Prénom, nom et couleur d'avatar : chaque collaborateur de la fiche peut modifier les autres
  function startEdit(m) {
    setMenu(null);
    const parts = (m.display_name || "").trim().split(/\s+/);
    setDraft({
      first: m.first_name ?? (m.display_name ? parts[0] : ""),
      last: m.last_name ?? (parts.length > 1 ? parts.slice(1).join(" ") : ""),
      color: MEMBER_COLORS.includes(m.color) ? m.color : MEMBER_COLORS.find((k) => pastel(k).mid === memberColor(m).mid) || MEMBER_COLORS[0],
    });
    setEditing(m.id);
  }

  async function save(e, m) {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    const first = draft.first.trim();
    const last = draft.last.trim();
    const full = [first, last].filter(Boolean).join(" ");
    try {
      const ok = await pro.updateRow("pro_members", "members", m.id, { first_name: first || null, last_name: last || null, color: draft.color, display_name: full || m.display_name || null });
      if (ok) setEditing(null);
    } finally {
      setSaving(false);
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
          <Fragment key={m.id}>
            <li className="d-org-row">
              <span
                aria-hidden="true"
                style={{
                  flex: "none",
                  width: 38,
                  height: 38,
                  borderRadius: 999,
                  background: memberColor(m).mid,
                  color: memberColor(m).ink,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                {memberInitial(m)}
              </span>
              <span className="d-org-who">
                <strong>
                  {memberName(m) || "Invitation en attente"}
                  {m.user_id === user?.id ? <span className="p-muted" style={{ fontWeight: 400 }}> (vous)</span> : null}
                </strong>
                <span className="d-org-meta">
                  <span className={`d-org-status${m.user_id ? " is-on" : ""}`}>{m.user_id ? "Connecté" : "Invitation envoyée"}</span>
                  {memberName(m) !== m.email && m.email ? <span className="p-muted d-org-mail">{m.email}</span> : null}
                </span>
              </span>
              <span className="d-org-actions">
                <button type="button" className="p-btn p-btn-ghost is-135" onClick={() => (editing === m.id ? setEditing(null) : startEdit(m))} aria-expanded={editing === m.id}>
                  Modifier
                </button>
                {!m.user_id || m.user_id !== user?.id ? (
                  <span className="d-anchor">
                    <button type="button" className="d-icon-btn is-flat" aria-label={`Options pour ${memberName(m) || m.email}`} aria-haspopup="menu" aria-expanded={menu === m.id} onClick={() => setMenu(menu === m.id ? null : m.id)}>
                      <Icon name="dots" size={16} sw={2.4} />
                    </button>
                    <Popover open={menu === m.id} onClose={() => setMenu(null)} align="right">
                      {!m.user_id ? (
                        <>
                          <button
                            type="button"
                            className="d-pop-item"
                            onClick={() => {
                              setMenu(null);
                              sendMail(m);
                            }}
                            disabled={sending === m.id}
                          >
                            {sent[m.id] ? "Invitation renvoyée" : "Renvoyer l’invitation"}
                          </button>
                          <button
                            type="button"
                            className="d-pop-item"
                            onClick={() => {
                              setMenu(null);
                              copy(m);
                            }}
                          >
                            {copied === m.id ? "Lien copié" : "Copier le lien"}
                          </button>
                        </>
                      ) : null}
                      <button type="button" className="d-pop-item is-danger" onClick={() => remove(m)}>
                        {m.user_id ? "Retirer des collaborateurs" : "Retirer l’invitation"}
                      </button>
                    </Popover>
                  </span>
                ) : null}
              </span>
            </li>
            {editing === m.id ? (
              <li className="p-collab-edit">
                <form onSubmit={(e) => save(e, m)}>
                  <div className="p-field">
                    <label htmlFor={`collab-first-${m.id}`}>Prénom</label>
                    <input id={`collab-first-${m.id}`} className="p-input" value={draft.first} onChange={(e) => setDraft((d) => ({ ...d, first: e.target.value }))} autoComplete="off" />
                  </div>
                  <div className="p-field">
                    <label htmlFor={`collab-last-${m.id}`}>Nom</label>
                    <input id={`collab-last-${m.id}`} className="p-input" value={draft.last} onChange={(e) => setDraft((d) => ({ ...d, last: e.target.value }))} autoComplete="off" />
                  </div>
                  <div className="p-field p-collab-colors">
                    <span id={`collab-color-${m.id}`}>Couleur de l’avatar</span>
                    <div role="radiogroup" aria-labelledby={`collab-color-${m.id}`}>
                      {MEMBER_COLORS.map((k) => (
                        <button
                          key={k}
                          type="button"
                          role="radio"
                          aria-checked={draft.color === k}
                          aria-label={k}
                          className={`p-collab-swatch${draft.color === k ? " is-on" : ""}`}
                          style={{ background: pastel(k).mid, color: pastel(k).ink }}
                          onClick={() => setDraft((d) => ({ ...d, color: k }))}
                        >
                          {(draft.first || m.display_name || m.email || "?").trim()[0]?.toUpperCase()}
                        </button>
                      ))}
                    </div>
                  </div>
                  <span className="p-collab-edit-actions">
                    <button type="button" className="p-btn p-btn-ghost is-135" onClick={() => setEditing(null)}>
                      Annuler
                    </button>
                    <button type="submit" className="p-btn p-btn-primary is-135" disabled={saving}>
                      {saving ? <BusyDots /> : "Enregistrer"}
                    </button>
                  </span>
                </form>
              </li>
            ) : null}
          </Fragment>
        ))}
      </ul>
      <form className="d-org-form p-collab-invite" onSubmit={add}>
        <strong className="p-collab-invite-title">Inviter un collaborateur</strong>
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
