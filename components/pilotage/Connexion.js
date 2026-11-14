"use client";

// Connexion au pilotage : l'adresse mail, puis le code reçu par mail (/api/interne/pilotage/connexion, modèle
// « Magic Link » de Supabase). Une adresse inconnue reçoit aussi un code : son compte est créé et attend l'accord de Stan.

import { useState } from "react";
import { supabase } from "@/lib/supabase";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Connexion({ onSession }) {
  const [etape, setEtape] = useState("mail"); // mail | code
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const envoyer = async (e) => {
    e?.preventDefault();
    const adresse = email.trim().toLowerCase();
    if (!EMAIL_RE.test(adresse)) return setErr("Cette adresse ne semble pas complète.");
    setBusy(true);
    setErr(null);
    const res = await fetch("/api/interne/pilotage/connexion", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: adresse }) }).catch(() => null);
    setBusy(false);
    if (!res?.ok) return setErr(res?.status === 429 ? "Trop d'essais. Réessaie un peu plus tard." : "Le mail n'est pas parti. Réessaie.");
    setEmail(adresse);
    setCode("");
    setEtape("code");
  };

  const verifier = async (e) => {
    e.preventDefault();
    const token = code.replace(/\D/g, "");
    if (token.length < 6) return setErr("Le code n'est pas complet.");
    setBusy(true);
    setErr(null);
    const { data, error } = await supabase.auth.verifyOtp({ email, token, type: "email" });
    if (error || !data?.session) {
      setBusy(false);
      return setErr("Ce code ne marche pas. Vérifie-le ou demande-en un autre.");
    }
    onSession(data.session);
  };

  return (
    <div className="pl-root">
      <div className="pl-gate">
        <h1>Pilotage</h1>
        {etape === "mail" ? (
          <form className="pl-form pl-gate-form" onSubmit={envoyer} noValidate>
            <p>Entre ton adresse mail, tu recevras un code.</p>
            <input type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="toi@exemple.fr" aria-label="Adresse mail" autoFocus />
            <button type="submit" className="pl-btn is-primary" disabled={busy}>
              {busy ? "Envoi…" : "Recevoir le code"}
            </button>
            {err ? <span className="pl-form-err">{err}</span> : null}
          </form>
        ) : (
          <form className="pl-form pl-gate-form" onSubmit={verifier} noValidate>
            <p>Code envoyé à {email}.</p>
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={8}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              placeholder="Code"
              aria-label="Code reçu par mail"
              autoFocus
            />
            <button type="submit" className="pl-btn is-primary" disabled={busy}>
              {busy ? "Vérification…" : "Me connecter"}
            </button>
            <span className="pl-gate-liens">
              <button type="button" className="pl-link" onClick={() => envoyer()} disabled={busy}>
                Renvoyer un code
              </button>
              <button type="button" className="pl-link" onClick={() => { setEtape("mail"); setErr(null); }} disabled={busy}>
                Changer d'adresse
              </button>
            </span>
            {err ? <span className="pl-form-err">{err}</span> : null}
          </form>
        )}
      </div>
    </div>
  );
}
