"use client";

// Réglages (section 6 du canvas) : la couleur du tableau de bord, propre à chaque organisateur,
// ses informations (prénom, adresse mail, mot de passe), l'effacement des données du mariage (le compte reste) et
// la suppression de son compte, qui emporte le mariage si personne d'autre n'y a de compte (D-130).

import { useState } from "react";
import { useDash } from "@/lib/dash/store";
import { ACCENTS, saveAccent, useAccent } from "@/lib/dash/accent";
import { trackEvent } from "@/lib/analytics";
import { supabase, sendPasswordChangedMail } from "@/lib/supabase";
import { Icon } from "@/components/dash/icons";
import { Btn, Field, Modal, Section } from "@/components/dash/ui";
import MailPrefs from "@/components/MailPrefs";
import PasswordFields from "@/components/PasswordFields";

const WEDDING_KEY = "merry-wedding";

// « Léa », « Léa et Paul », « Léa, Paul et Marc »
const liste = (noms) => (noms.length < 2 ? noms.join("") : `${noms.slice(0, -1).join(", ")} et ${noms[noms.length - 1]}`);

async function jeton() {
  const { data: s } = await supabase.auth.getSession();
  return s?.session?.access_token || "";
}

export default function Reglages() {
  const dash = useDash();
  const data = dash.data;
  const live = dash.mode === "live";
  const accent = useAccent();
  const me = data.members.find((m) => m.id === data.meId);
  const [name, setName] = useState(me?.display_name || "");
  const [email, setEmail] = useState(dash.user?.email || "");
  const [changePassword, setChangePassword] = useState(false);
  const [password, setPassword] = useState("");
  const [passwordAgain, setPasswordAgain] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [plan, setPlan] = useState(null);
  const [effacer, setEffacer] = useState(false);
  const [effacing, setEffacing] = useState(false);
  // Les autres organisateurs qui ont un compte sur le mariage affiché : ils perdent aussi ce qu'efface « Effacer »
  const autres = data.members.filter((m) => m.user_id && m.id !== data.meId).map((m) => m.display_name);
  const couple = [data.wedding?.partner1, data.wedding?.partner2].filter(Boolean).join(" et ");

  async function pick(key) {
    const ok = await saveAccent(key, live);
    if (ok) trackEvent("accent_changed", { accent: key });
    if (!ok) dash.setToast({ kind: "error", text: "La couleur n'a pas pu être enregistrée sur ton compte." });
  }

  async function save(e) {
    e.preventDefault();
    if (changePassword && password.length < 8) {
      dash.setToast({ kind: "error", text: "Le mot de passe doit faire au moins 8 caractères." });
      return;
    }
    if (changePassword && password !== passwordAgain) {
      dash.setToast({ kind: "error", text: "Les deux mots de passe ne sont pas identiques." });
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
    if (changePassword) {
      if (!live) notes.push("en démo, le mot de passe ne change pas");
      else {
        const { error } = await supabase.auth.updateUser({ password });
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
    dash.setToast({ kind: notes.some((n) => /pas pu/.test(n)) ? "error" : "ok", text });
  }

  // Ce que la suppression du compte emportera, relu en base : chaque mariage part, sauf si un autre organisateur y a un compte
  async function openConfirm() {
    setConfirm(true);
    setPlan(live ? null : [{ couple, autres }]);
    if (!live) return;
    const res = await fetch("/api/compte", { headers: { authorization: `Bearer ${await jeton()}` } }).catch(() => null);
    const body = res?.ok ? await res.json().catch(() => null) : null;
    setPlan(body?.mariages || "inconnu");
  }

  async function eraseData() {
    if (!live) {
      setEffacer(false);
      dash.setToast({ kind: "ok", text: "En démo, les données ne sont pas effacées." });
      return;
    }
    setEffacing(true);
    const res = await fetch("/api/compte/donnees", { method: "DELETE", headers: { authorization: `Bearer ${await jeton()}`, "content-type": "application/json" }, body: JSON.stringify({ mariage: data.wedding?.id }) }).catch(() => null);
    if (!res?.ok) {
      setEffacing(false);
      dash.setToast({ kind: "error", text: "Les données n'ont pas pu être effacées. Écris-nous à bonjour@withmerry.com." });
      return;
    }
    try {
      window.localStorage.removeItem(WEDDING_KEY);
    } catch {
      /* ignore */
    }
    window.location.href = "/dashboard";
  }

  async function removeAccount() {
    if (!live) {
      setConfirm(false);
      dash.setToast({ kind: "ok", text: "En démo, le compte n'est pas supprimé." });
      return;
    }
    setDeleting(true);
    const res = await fetch("/api/compte", { method: "DELETE", headers: { authorization: `Bearer ${await jeton()}` } }).catch(() => null);
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

      <Section title="Votre mariage" />
      <div className="d-card d-settings">
        <strong>Date, lieu, budget</strong>
        <Btn href="/dashboard/brief" kind="ghost">
          Modifier
        </Btn>
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
          { kind: "couple_reply", label: "Un prestataire m'a répondu" },
          { kind: "new_member", label: "Un organisateur a rejoint le mariage" },
          { kind: "form_reply", label: "Un invité a répondu au formulaire" },
          { kind: "activite", label: "Le mail de 20 h sur l'activité de mon compte" },
          { kind: "nouveautes", label: "Les nouveautés de Merry" },
        ]}
        onError={() => dash.setToast({ kind: "error", text: "Ce réglage n'a pas pu être enregistré." })}
      />

      <Section title="Ton compte" />
      <div className="d-settings-pair">
        <div className="d-card d-settings d-settings-danger">
          <strong>Effacer mes données</strong>
          <button type="button" className="d-btn d-btn-danger" onClick={() => setEffacer(true)}>
            <Icon name="trash" size={16} sw={2} />
            Effacer
          </button>
        </div>
        <div className="d-card d-settings d-settings-danger">
          <strong>Supprimer mon compte</strong>
          <button type="button" className="d-btn d-btn-danger" onClick={openConfirm}>
            <Icon name="trash" size={16} sw={2} />
            Supprimer
          </button>
        </div>
      </div>

      {effacer ? (
        <Modal
          title="Effacer les données du mariage ?"
          onClose={() => setEffacer(false)}
          footer={
            <>
              <Btn kind="ghost" onClick={() => setEffacer(false)}>
                Annuler
              </Btn>
              <button type="button" className="d-btn d-btn-danger" onClick={eraseData} disabled={effacing}>
                {effacing ? "Effacement…" : "Effacer définitivement"}
              </button>
            </>
          }
        >
          <p className="d-settings-warn">
            Invités, réponses, tâches, budget, devis, documents et site sont supprimés. Ton compte reste et tu repars d&apos;un mariage neuf.
            {autres.length ? ` ${liste(autres)} ${autres.length > 1 ? "perdent" : "perd"} aussi ces données.` : ""}
          </p>
        </Modal>
      ) : null}

      {confirm ? (
        <Modal
          title="Supprimer ton compte ?"
          onClose={() => setConfirm(false)}
          footer={
            <>
              <Btn kind="ghost" onClick={() => setConfirm(false)}>
                Annuler
              </Btn>
              <button type="button" className="d-btn d-btn-danger" onClick={removeAccount} disabled={deleting || !plan}>
                {deleting ? "Suppression…" : "Supprimer définitivement"}
              </button>
            </>
          }
        >
          <p className="d-settings-warn">
            Tu ne pourras plus te connecter à Merry.
            {Array.isArray(plan)
              ? plan.map((m, i) => {
                  const nom = plan.length > 1 ? `Le mariage ${m.couple}` : "Ton mariage";
                  return <span key={i}> {m.autres.length ? `${nom} reste accessible à ${liste(m.autres)}.` : `${nom} et toutes ses données sont supprimés.`}</span>;
                })
              : plan
                ? " Le mariage part avec lui, sauf si un autre organisateur y a un compte."
                : null}
          </p>
        </Modal>
      ) : null}
    </>
  );
}
