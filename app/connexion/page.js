"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { SITE_URL } from "@/lib/site";
import { INVITE_KEY } from "@/lib/dash/store";

/*
 * Connexion au tableau de bord, depuis le bouton « Connexion » du site.
 * Gère aussi le lien d'invitation d'un organisateur (?invitation=…) et
 * le mot de passe oublié.
 */

function safeNext(raw) {
  // Uniquement des chemins internes au tableau de bord
  return raw && /^\/dashboard(\/|$|\?)/.test(raw) ? raw : "/dashboard";
}

export default function Connexion() {
  const [mode, setMode] = useState("login"); // login | signup | forgot | reset | sent | confirm
  const [invited, setInvited] = useState(false);
  const [next, setNext] = useState("/dashboard");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setNext(safeNext(params.get("next")));
    const token = params.get("invitation");
    if (token && /^[0-9a-f-]{36}$/i.test(token)) {
      try {
        window.localStorage.setItem(INVITE_KEY, token);
      } catch {
        /* ignore */
      }
      setInvited(true);
      setMode("signup");
    }
    if (!supabase) return undefined;
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setMode("reset");
    });
    // Déjà connecté : direction le tableau de bord (sauf retour de « mot de passe oublié »)
    supabase.auth.getSession().then(({ data }) => {
      const recovering = window.location.hash.includes("type=recovery");
      if (data?.session && !recovering) window.location.replace(safeNext(params.get("next")));
    });
    return () => sub?.subscription?.unsubscribe();
  }, []);

  async function submit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (mode === "login") {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password });
        if (err) throw new Error("Email ou mot de passe incorrect.");
        window.location.replace(next);
      } else if (mode === "signup") {
        if (password.length < 8) throw new Error("Le mot de passe doit faire au moins 8 caractères.");
        const { data, error: err } = await supabase.auth.signUp({ email, password, options: { data: { first_name: firstName } } });
        if (err) throw new Error(/registered|already/i.test(err.message) ? "Ce mail a déjà un compte : connectez-vous." : "La création du compte n'a pas marché. Réessayez.");
        if (!data.session) setMode("confirm");
        else window.location.replace("/dashboard");
      } else if (mode === "forgot") {
        await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/connexion` });
        setMode("sent");
      } else if (mode === "reset") {
        if (password.length < 8) throw new Error("Le mot de passe doit faire au moins 8 caractères.");
        const { error: err } = await supabase.auth.updateUser({ password });
        if (err) throw new Error("Le lien a expiré. Redemandez un mot de passe.");
        window.location.replace("/dashboard");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const titles = {
    login: "Content de te revoir.",
    signup: invited ? "Rejoins l'organisation." : "Crée ton accès.",
    forgot: "Mot de passe oublié.",
    reset: "Nouveau mot de passe.",
    sent: "Regarde ta boîte mail.",
    confirm: "Plus qu'un clic.",
  };

  return (
    <div className="shell">
      <aside className="panel">
        <a className="panel-logo" href={SITE_URL} aria-label="Merry, retour au site">
          Merry
        </a>
        <div className="panel-word" aria-hidden="true">
          Ton mariage.
        </div>
        <div className="panel-caption" aria-hidden="true">
          Merry - Experience Crafting Group
        </div>
      </aside>
      <main className="stage">
        <section className="card">
          <div className="eyebrow">{mode === "signup" && invited ? "Invitation" : "Connexion"}</div>
          <h1 className="question">{titles[mode]}</h1>

          {!supabase ? (
            <>
              <p className="help">Les comptes ne sont pas encore branchés sur cet environnement.</p>
              <div className="actions">
                <a className="btn" href="/dashboard?demo=1">
                  Voir la démo
                </a>
              </div>
            </>
          ) : mode === "sent" ? (
            <p className="help">Si un compte existe pour {email}, un lien pour choisir un nouveau mot de passe vient d'arriver.</p>
          ) : mode === "confirm" ? (
            <p className="help">Un mail de confirmation est parti à {email}. Clique sur le lien, puis reviens te connecter : tu arriveras directement sur le tableau de bord.</p>
          ) : (
            <form onSubmit={submit} className="fields">
              {mode === "signup" && invited ? (
                <p className="help" style={{ gridColumn: "1 / -1", margin: 0 }}>
                  On t'a invité à organiser un mariage sur Merry. Crée ton accès : tu verras les invités, le rétroplanning et le budget.
                </p>
              ) : null}
              {mode === "signup" ? (
                <div className="field full">
                  <label htmlFor="c-first">Prénom</label>
                  <input id="c-first" value={firstName} onChange={(e) => setFirstName(e.target.value)} autoComplete="given-name" required />
                </div>
              ) : null}
              {mode !== "reset" ? (
                <div className="field full">
                  <label htmlFor="c-email">Email</label>
                  <input id="c-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
                </div>
              ) : null}
              {mode !== "forgot" ? (
                <div className="field full">
                  <label htmlFor="c-password">{mode === "reset" ? "Nouveau mot de passe" : "Mot de passe"}</label>
                  <input
                    id="c-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete={mode === "login" ? "current-password" : "new-password"}
                    minLength={mode === "login" ? undefined : 8}
                    required
                  />
                </div>
              ) : null}
              {error ? <p className="error">{error}</p> : null}
              <div className="actions" style={{ gridColumn: "1 / -1" }}>
                {mode === "login" ? (
                  <button type="button" className="skip" onClick={() => setMode("forgot")}>
                    Mot de passe oublié ?
                  </button>
                ) : mode === "signup" ? (
                  <button type="button" className="skip" onClick={() => setMode("login")}>
                    J'ai déjà un compte
                  </button>
                ) : (
                  <button type="button" className="skip" onClick={() => setMode("login")}>
                    Retour
                  </button>
                )}
                <button type="submit" className="btn" disabled={busy}>
                  {mode === "login" ? "Se connecter" : mode === "signup" ? "Créer mon accès" : mode === "forgot" ? "Recevoir le lien" : "Enregistrer"}
                </button>
              </div>
            </form>
          )}

          {mode === "login" ? (
            <p className="footnote">
              Pas encore de compte ? <a href="/">Raconte-nous ton mariage</a>, Merry prépare ton tableau de bord.
            </p>
          ) : null}
        </section>
      </main>
    </div>
  );
}
