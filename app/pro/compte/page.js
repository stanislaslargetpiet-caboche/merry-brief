"use client";

// Compte (maquette V2e, Mon profil) : adresse mail et mot de passe de connexion, collaborateurs,
// suppression du compte. La connexion (app/connexion) utilise un mot de passe (supabase.auth.signInWithPassword) ;
// ce formulaire le change directement (updateUser) plutôt que de renvoyer par le lien « mot de passe oublié ».

import { useState } from "react";
import { usePro } from "@/lib/pro/store";
import { supabase, sendPasswordChangedMail } from "@/lib/supabase";
import { Btn, Field, Modal, Section } from "@/components/dash/ui";
import { Icon } from "@/components/dash/icons";
import { ACCENTS, saveAccent, useAccent } from "@/lib/dash/accent";
import Collaborators from "@/components/pro/Collaborators";
import MailPrefs from "@/components/MailPrefs";

export default function Compte() {
  const pro = usePro();
  const live = pro.mode === "live";
  const accent = useAccent();

  async function pick(key) {
    const ok = await saveAccent(key, live);
    if (!ok) pro.setToast({ kind: "error", text: "La couleur n’a pas pu être enregistrée sur votre compte." });
  }

  const currentEmail = pro.data.user?.email || "";
  const [email, setEmail] = useState(currentEmail);
  const [editingEmail, setEditingEmail] = useState(false);
  const [editingPassword, setEditingPassword] = useState(false);
  const [password, setPassword] = useState("");
  const [passwordAgain, setPasswordAgain] = useState("");
  const [saving, setSaving] = useState(null);
  const [confirm, setConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function saveEmail(e) {
    e.preventDefault();
    const cleanEmail = email.trim();
    if (!cleanEmail || cleanEmail === currentEmail) {
      setEditingEmail(false);
      return;
    }
    if (!live) {
      setEditingEmail(false);
      setEmail(currentEmail);
      pro.setToast({ kind: "ok", text: "En démo, l'adresse mail ne change pas." });
      return;
    }
    setSaving("email");
    const { error } = await supabase.auth.updateUser({ email: cleanEmail });
    setSaving(null);
    if (error) {
      pro.setToast({ kind: "error", text: "L'adresse mail n'a pas pu être changée." });
      return;
    }
    setEditingEmail(false);
    pro.setToast({ kind: "ok", text: `Un lien de confirmation est parti à ${cleanEmail}.` });
  }

  function cancelEmail() {
    setEmail(currentEmail);
    setEditingEmail(false);
  }

  async function savePassword(e) {
    e.preventDefault();
    const cleanPassword = password.trim();
    if (cleanPassword.length < 8) {
      pro.setToast({ kind: "error", text: "Le mot de passe doit faire au moins 8 caractères." });
      return;
    }
    if (cleanPassword !== passwordAgain.trim()) {
      pro.setToast({ kind: "error", text: "Les deux mots de passe ne sont pas identiques." });
      return;
    }
    if (!live) {
      cancelPassword();
      pro.setToast({ kind: "ok", text: "En démo, le mot de passe ne change pas." });
      return;
    }
    setSaving("password");
    const { error } = await supabase.auth.updateUser({ password: cleanPassword, data: { merry_password: true } });
    setSaving(null);
    if (error) {
      pro.setToast({ kind: "error", text: "Le mot de passe n'a pas pu être changé." });
      return;
    }
    cancelPassword();
    sendPasswordChangedMail();
    pro.setToast({ kind: "ok", text: "Le mot de passe est changé." });
  }

  function cancelPassword() {
    setPassword("");
    setPasswordAgain("");
    setEditingPassword(false);
  }

  async function removeAccount() {
    if (!live) {
      setConfirm(false);
      pro.setToast({ kind: "ok", text: "En démo, le compte n'est pas supprimé." });
      return;
    }
    setDeleting(true);
    const { data: s } = await supabase.auth.getSession();
    const res = await fetch("/api/compte", { method: "DELETE", headers: { authorization: `Bearer ${s?.session?.access_token || ""}` } }).catch(() => null);
    if (!res?.ok) {
      setDeleting(false);
      pro.setToast({ kind: "error", text: "Le compte n'a pas pu être supprimé. Écrivez-nous à bonjour@withmerry.com." });
      return;
    }
    await supabase.auth.signOut();
    window.location.href = "/connexion";
  }

  return (
    <div className="p-narrow is-28">
      <h1 className="p-h1 is-page">Réglages.</h1>

      <Section title="Couleur de l’espace prestataire" />
      <div className="d-accents" role="radiogroup" aria-label="Couleur de l’espace prestataire">
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

      <Section title="Connexion" />
      <div className="d-card p-conn">
        {editingEmail ? (
          <form className="p-conn-edit" onSubmit={saveEmail}>
            <Field label="Nouvelle adresse mail">
              <input className="d-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" autoFocus required />
            </Field>
            <p className="p-hint">Un lien de confirmation part à cette adresse ; l’ancienne reste valable jusque-là.</p>
            <div className="p-conn-actions">
              <Btn kind="ghost" onClick={cancelEmail}>
                Annuler
              </Btn>
              <Btn type="submit" disabled={saving === "email"}>
                {saving === "email" ? "Enregistrement…" : "Enregistrer"}
              </Btn>
            </div>
          </form>
        ) : (
          <div className="p-conn-row">
            <span className="p-conn-what">
              <span className="p-conn-label">Adresse mail</span>
              <strong className="p-conn-value">{currentEmail}</strong>
            </span>
            <Btn kind="ghost" onClick={() => setEditingEmail(true)}>
              Changer mon mail
            </Btn>
          </div>
        )}
        <div className="p-conn-sep" />
        {editingPassword ? (
          <form className="p-conn-edit" onSubmit={savePassword}>
            <div className="d-form-grid">
              <Field label="Nouveau mot de passe">
                <input className="d-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" autoFocus />
              </Field>
              <Field label="Confirmer le mot de passe">
                <input className="d-input" type="password" value={passwordAgain} onChange={(e) => setPasswordAgain(e.target.value)} autoComplete="new-password" />
              </Field>
            </div>
            <div className="p-conn-actions">
              <Btn kind="ghost" onClick={cancelPassword}>
                Annuler
              </Btn>
              <Btn type="submit" disabled={saving === "password"}>
                {saving === "password" ? "Enregistrement…" : "Enregistrer"}
              </Btn>
            </div>
          </form>
        ) : (
          <div className="p-conn-row">
            <span className="p-conn-what">
              <span className="p-conn-label">Mot de passe</span>
              <strong className="p-conn-value">••••••••</strong>
            </span>
            <Btn kind="ghost" onClick={() => setEditingPassword(true)}>
              Changer mon mot de passe
            </Btn>
          </div>
        )}
      </div>

      <Section title="Notifications par mail" />
      <MailPrefs
        live={live}
        rows={[
          { kind: "vendor_message", label: "Un couple m’a écrit" },
          { kind: "vendor_account", label: "Mes options et mes crédits" },
        ]}
        onError={() => pro.setToast({ kind: "error", text: "Ce réglage n’a pas pu être enregistré." })}
      />

      <Collaborators />

      <Section title="Votre compte" />
      <div className="d-card d-settings d-settings-danger">
        <strong>Supprimer mon compte</strong>
        <button type="button" className="d-btn d-btn-danger" onClick={() => setConfirm(true)}>
          <Icon name="trash" size={16} sw={2} />
          Supprimer
        </button>
      </div>

      {confirm ? (
        <Modal
          title="Supprimer votre compte ?"
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
          <p className="d-settings-warn">Vous ne pourrez plus vous connecter à votre espace prestataire.</p>
        </Modal>
      ) : null}
    </div>
  );
}
