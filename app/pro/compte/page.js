"use client";

// Compte (maquette V2e, Mon profil) : adresse mail et mot de passe de connexion, collaborateurs,
// suppression du compte. La connexion (app/connexion) utilise un mot de passe (supabase.auth.signInWithPassword) ;
// ce formulaire le change directement (updateUser) plutôt que de renvoyer par le lien « mot de passe oublié ».

import { useState } from "react";
import { usePro } from "@/lib/pro/store";
import { supabase, sendPasswordChangedMail } from "@/lib/supabase";
import { Pills, ProSubnav } from "@/components/pro/ui";
import { PRO_PROFIL_TABS } from "@/components/pro/Shell";
import { Btn, Field, Modal, Section } from "@/components/dash/ui";
import { Icon } from "@/components/dash/icons";
import { ACCENTS, saveAccent, useAccent } from "@/lib/dash/accent";
import { CATALOG_CATEGORIES } from "@/lib/dash/catalog";
import Collaborators from "@/components/pro/Collaborators";
import MailPrefs from "@/components/MailPrefs";
import PasswordFields from "@/components/PasswordFields";

export default function Compte() {
  const pro = usePro();
  const live = pro.mode === "live";
  const accent = useAccent();

  async function pick(key) {
    const ok = await saveAccent(key, live);
    if (!ok) pro.setToast({ kind: "error", text: "La couleur n’a pas pu être enregistrée sur votre compte." });
  }

  const category = pro.data.vendor?.primary_category;
  const [savingCategory, setSavingCategory] = useState(false);
  async function pickCategory(key) {
    if (key === category) return;
    setSavingCategory(true);
    const ok = await pro.setCategory(key);
    setSavingCategory(false);
    if (ok) pro.setToast({ kind: "ok", text: "Activité mise à jour : Ma fiche s’adapte à votre métier." });
  }
  const [email, setEmail] = useState(pro.data.user?.email || "");
  const [changePassword, setChangePassword] = useState(false);
  const [password, setPassword] = useState("");
  const [passwordAgain, setPasswordAgain] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function save(e) {
    e.preventDefault();
    const cleanPassword = password.trim();
    if (changePassword && cleanPassword.length < 8) {
      pro.setToast({ kind: "error", text: "Le mot de passe doit faire au moins 8 caractères." });
      return;
    }
    if (changePassword && cleanPassword !== passwordAgain.trim()) {
      pro.setToast({ kind: "error", text: "Les deux mots de passe ne sont pas identiques." });
      return;
    }
    setSaving(true);
    const notes = [];
    let failed = false;
    const cleanEmail = email.trim();
    if (cleanEmail && cleanEmail !== pro.data.user?.email) {
      if (!live) notes.push("en démo, l'adresse mail ne change pas");
      else {
        const { error } = await supabase.auth.updateUser({ email: cleanEmail });
        failed = failed || !!error;
        notes.push(error ? "l'adresse mail n'a pas pu être changée" : `un lien de confirmation est parti à ${cleanEmail}`);
      }
    }
    if (changePassword) {
      if (!live) notes.push("en démo, le mot de passe ne change pas");
      else {
        const { error } = await supabase.auth.updateUser({ password: cleanPassword, data: { merry_password: true } });
        failed = failed || !!error;
        notes.push(error ? "le mot de passe n'a pas pu être changé" : "le mot de passe est changé");
        if (!error) {
          setPassword("");
          setPasswordAgain("");
          setChangePassword(false);
          sendPasswordChangedMail();
        }
      }
    }
    setSaving(false);
    const text = notes.length ? `C'est enregistré ; ${notes.join(", ")}.` : "C'est enregistré.";
    pro.setToast({ kind: failed ? "error" : "ok", text });
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
      <h1 className="p-h1 is-page">Compte.</h1>
      <ProSubnav items={PRO_PROFIL_TABS} label="Sections de Mon profil" />

      <Section title="Activité" />
      <div className="d-card">
        <p className="p-hint">Détermine les questions de Ma fiche et l’onglet où les couples vous trouvent.</p>
        <Pills
          label="Activité"
          options={CATALOG_CATEGORIES.map((c) => ({ value: c.key, label: c.label }))}
          value={category}
          onChange={pickCategory}
        />
        {savingCategory ? <p className="p-hint">Enregistrement…</p> : null}
      </div>

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
      <form className="d-card d-settings" onSubmit={save}>
        <div className="d-form-grid">
          <Field label="Adresse mail">
            <input className="d-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          </Field>
        </div>
        <PasswordFields on={changePassword} setOn={setChangePassword} password={password} setPassword={setPassword} again={passwordAgain} setAgain={setPasswordAgain} />
        <div className="d-settings-actions">
          <Btn type="submit" disabled={saving}>
            {saving ? "Enregistrement…" : "Enregistrer"}
          </Btn>
        </div>
      </form>

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
