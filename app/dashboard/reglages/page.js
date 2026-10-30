"use client";

// Réglages (section 6 du canvas) : la couleur du tableau de bord, propre à chaque organisateur,
// ses informations (prénom, adresse mail, mot de passe) et la suppression de son compte.

import { useState } from "react";
import { useDash } from "@/lib/dash/store";
import { ACCENTS, saveAccent, useAccent } from "@/lib/dash/accent";
import { supabase } from "@/lib/supabase";
import { Icon } from "@/components/dash/icons";
import { Btn, Field, Modal, Section } from "@/components/dash/ui";

export default function Reglages() {
  const dash = useDash();
  const data = dash.data;
  const live = dash.mode === "live";
  const accent = useAccent();
  const me = data.members.find((m) => m.id === data.meId);
  const [name, setName] = useState(me?.display_name || "");
  const [email, setEmail] = useState(dash.user?.email || "");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function pick(key) {
    const ok = await saveAccent(key, live);
    if (!ok) dash.setToast({ kind: "error", text: "La couleur n'a pas pu être enregistrée sur ton compte." });
  }

  async function save(e) {
    e.preventDefault();
    if (password && password.length < 8) {
      dash.setToast({ kind: "error", text: "Le mot de passe doit faire au moins 8 caractères." });
      return;
    }
    setSaving(true);
    const notes = [];
    const cleanName = name.trim();
    if (me && cleanName && cleanName !== me.display_name) {
      await dash.update("wedding_members", me.id, { display_name: cleanName, initial: cleanName.charAt(0).toUpperCase() });
    }
    const cleanEmail = email.trim();
    if (cleanEmail && cleanEmail !== dash.user?.email) {
      if (!live) notes.push("en démo, l'adresse mail ne change pas");
      else {
        const { error } = await supabase.auth.updateUser({ email: cleanEmail });
        notes.push(error ? "l'adresse mail n'a pas pu être changée" : `un lien de confirmation est parti à ${cleanEmail}`);
      }
    }
    if (password) {
      if (!live) notes.push("en démo, le mot de passe ne change pas");
      else {
        const { error } = await supabase.auth.updateUser({ password });
        notes.push(error ? "le mot de passe n'a pas pu être changé" : "le mot de passe est changé");
        if (!error) setPassword("");
      }
    }
    setSaving(false);
    const text = notes.length ? `C'est enregistré ; ${notes.join(", ")}.` : "C'est enregistré.";
    dash.setToast({ kind: notes.some((n) => /pas pu/.test(n)) ? "error" : "ok", text });
  }

  async function removeAccount() {
    if (!live) {
      setConfirm(false);
      dash.setToast({ kind: "ok", text: "En démo, le compte n'est pas supprimé." });
      return;
    }
    setDeleting(true);
    const { data: s } = await supabase.auth.getSession();
    const res = await fetch("/api/compte", { method: "DELETE", headers: { authorization: `Bearer ${s?.session?.access_token || ""}` } }).catch(() => null);
    if (!res?.ok) {
      setDeleting(false);
      dash.setToast({ kind: "error", text: "Le compte n'a pas pu être supprimé. Écris-nous à bonjour@withmerry.com." });
      return;
    }
    await supabase.auth.signOut();
    window.location.href = "/connexion";
  }

  return (
    <>
      <h1 className="d-title">Réglages.</h1>

      <Section title="Couleur du tableau de bord" />
      <div className="d-accents" role="radiogroup" aria-label="Couleur du tableau de bord">
        {ACCENTS.map((a) => (
          <button key={a.key} type="button" role="radio" aria-checked={accent === a.key} className={`d-accent${accent === a.key ? " is-on" : ""}`} onClick={() => pick(a.key)}>
            <span className="d-accent-preview" aria-hidden="true">
              <span className="d-accent-side" style={{ background: a.color }}>
                <b>Merry</b>
              </span>
              <span className="d-accent-main">
                <span className="d-accent-tag" style={{ background: a.color }} />
                <span className="d-accent-pill" style={{ background: a.tint, borderColor: a.color }} />
                <span className="d-accent-tile" style={{ background: a.tint }}>
                  <Icon name="home" size={14} sw={2} stroke={a.ink} />
                </span>
              </span>
            </span>
            <span className="d-accent-name">
              {a.label}
              {accent === a.key ? <Icon name="check" size={16} sw={2.4} /> : null}
            </span>
          </button>
        ))}
      </div>

      <Section title="Tes informations" />
      <form className="d-card d-settings" onSubmit={save}>
        <div className="d-form-grid">
          <Field label="Ton prénom">
            <input className="d-input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="given-name" />
          </Field>
          <Field label="Adresse mail">
            <input className="d-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          </Field>
          <Field label="Nouveau mot de passe">
            <input className="d-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" placeholder="Laisser vide pour le garder" />
          </Field>
        </div>
        <div className="d-settings-actions">
          <Btn type="submit" disabled={saving}>
            {saving ? "Enregistrement…" : "Enregistrer"}
          </Btn>
        </div>
      </form>

      <Section title="Ton compte" />
      <div className="d-card d-settings d-settings-danger">
        <strong>Supprimer mon compte</strong>
        <button type="button" className="d-btn d-btn-danger" onClick={() => setConfirm(true)}>
          <Icon name="trash" size={16} sw={2} />
          Supprimer
        </button>
      </div>

      {confirm ? (
        <Modal
          title="Supprimer ton compte ?"
          onClose={() => setConfirm(false)}
          footer={
            <>
              <Btn kind="ghost" onClick={() => setConfirm(false)}>
                Annuler
              </Btn>
              <button type="button" className="d-btn d-btn-danger" onClick={removeAccount} disabled={deleting}>
                {deleting ? "Suppression…" : "Supprimer définitivement"}
              </button>
            </>
          }
        >
          <p className="d-settings-warn">Tu ne pourras plus te connecter à Merry. Le mariage et ses données restent accessibles aux autres organisateurs.</p>
        </Modal>
      ) : null}
    </>
  );
}
