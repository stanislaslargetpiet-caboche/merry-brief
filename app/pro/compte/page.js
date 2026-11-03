"use client";

// Compte (maquette V2e, Mon profil) : adresse mail et mot de passe de connexion, collaborateurs,
// suppression du compte. La connexion (app/connexion) utilise un mot de passe (supabase.auth.signInWithPassword) ;
// ce formulaire le change directement (updateUser) plutôt que de renvoyer par le lien « mot de passe oublié ».

import { useState } from "react";
import { usePro } from "@/lib/pro/store";
import { supabase } from "@/lib/supabase";
import { ProSubnav } from "@/components/pro/ui";
import { PRO_PROFIL_TABS } from "@/components/pro/Shell";
import { Btn, Field, Modal, Section } from "@/components/dash/ui";
import { Icon } from "@/components/dash/icons";
import { ACCENTS, saveAccent, useAccent } from "@/lib/dash/accent";
import Collaborators from "@/components/pro/Collaborators";

export default function Compte() {
  const pro = usePro();
  const live = pro.mode === "live";
  const accent = useAccent();

  async function pick(key) {
    const ok = await saveAccent(key, live);
    if (!ok) pro.setToast({ kind: "error", text: "La couleur n’a pas pu être enregistrée sur votre compte." });
  }
  const [email, setEmail] = useState(pro.data.user?.email || "");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function save(e) {
    e.preventDefault();
    const cleanPassword = password.trim();
    if (cleanPassword && cleanPassword.length < 8) {
      pro.setToast({ kind: "error", text: "Le mot de passe doit faire au moins 8 caractères." });
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
    if (cleanPassword) {
      if (!live) notes.push("en démo, le mot de passe ne change pas");
      else {
        const { error } = await supabase.auth.updateUser({ password: cleanPassword });
        failed = failed || !!error;
        notes.push(error ? "le mot de passe n'a pas pu être changé" : "le mot de passe est changé");
        if (!error) setPassword("");
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
          <Field label="Nouveau mot de passe" hint="Laissez vide pour ne pas le changer">
            <input className="d-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" placeholder="••••••••" />
          </Field>
        </div>
        <div className="d-settings-actions">
          <Btn type="submit" disabled={saving}>
            {saving ? "Enregistrement…" : "Enregistrer"}
          </Btn>
        </div>
      </form>

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
