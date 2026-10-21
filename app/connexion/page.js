"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { SITE_URL } from "@/lib/site";
import { INVITE_KEY, RESET_KEY } from "@/lib/dash/store";

/*
 * Connexion au tableau de bord, depuis le bouton « Connexion » du site.
 * Gère aussi le lien d'invitation d'un organisateur (?invitation=…) : on
 * montre le mariage concerné et on ne rejoint qu'après confirmation.
 */

const TOKEN_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Supabase lit puis efface le #… de l'adresse au chargement : on le garde avant.
const INITIAL_HASH = typeof window !== "undefined" ? window.location.hash : "";

function safeNext(raw) {
  // Uniquement des chemins internes au tableau de bord
  return raw && /^\/dashboard(\/|$|\?)/.test(raw) ? raw : "/dashboard";
}

function readToken() {
  try {
    const t = window.localStorage.getItem(INVITE_KEY);
    return t && TOKEN_RE.test(t) ? t : null;
  } catch {
    return null;
  }
}

function dropToken() {
  try {
    window.localStorage.removeItem(INVITE_KEY);
  } catch {
    /* ignore */
  }
}

export default function Connexion() {
  // checking | login | signup | forgot | reset | sent | confirm | join | badlink | signedin | expired
  const [mode, setMode] = useState("checking");
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [invite, setInvite] = useState(null); // { partner1, partner2, invited_as }
  const [next, setNext] = useState("/dashboard");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function showJoin(t) {
    const { data } = await supabase.rpc("merry_invite_info", { token: t });
    if (data && data.length) {
      setInvite(data[0]);
      setMode("join");
    } else {
      dropToken();
      setMode("badlink");
    }
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setNext(safeNext(params.get("next")));
    let t = params.get("invitation");
    if (t && TOKEN_RE.test(t)) {
      try {
        window.localStorage.setItem(INVITE_KEY, t);
      } catch {
        /* ignore */
      }
      // Le lien ne reste pas dans la barre d'adresse ni dans l'historique
      params.delete("invitation");
      const q = params.toString();
      window.history.replaceState(null, "", `/connexion${q ? `?${q}` : ""}${window.location.hash}`);
    } else t = readToken();
    setToken(t);
    const isReset = params.get("reset") === "1" || INITIAL_HASH.includes("type=recovery");
    const linkError = /error=|error_code=/.test(INITIAL_HASH);
    if (!supabase) {
      setMode(t ? "signup" : "login");
      return undefined;
    }
    // Rien ne s'affiche avant de savoir si une session existe déjà
    supabase.auth.getSession().then(({ data }) => {
      const session = data?.session;
      let pending = null;
      try {
        pending = window.localStorage.getItem(RESET_KEY);
      } catch {
        /* ignore */
      }
      if (isReset) {
        if (session && !linkError) {
          try {
            window.localStorage.setItem(RESET_KEY, session.user.id);
          } catch {
            /* ignore */
          }
          setUser(session.user);
          setMode("reset");
        } else setMode("expired");
        return;
      }
      if (!session) {
        setMode(t ? "signup" : "login");
        return;
      }
      setUser(session.user);
      if (pending && pending === session.user.id) setMode("reset");
      else if (t) showJoin(t);
      // Retour du lien de confirmation du mail : direction le tableau de bord
      else if (INITIAL_HASH.includes("type=signup")) window.location.replace(safeNext(params.get("next")));
      else setMode("signedin");
    });
    return undefined;
  }, []);

  function afterAuth() {
    if (token) showJoin(token);
    else window.location.replace(next);
  }

  async function join() {
    setBusy(true);
    setError("");
    const { data: w, error: err } = await supabase.rpc("merry_join", { token });
    setBusy(false);
    dropToken();
    if (err || !w) {
      setMode("badlink");
      return;
    }
    try {
      window.localStorage.setItem("merry-wedding", w);
    } catch {
      /* ignore */
    }
    window.location.replace("/dashboard");
  }

  async function submit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (mode === "login") {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password });
        if (err) throw new Error("Email ou mot de passe incorrect.");
        afterAuth();
      } else if (mode === "signup") {
        if (password.length < 8) throw new Error("Le mot de passe doit faire au moins 8 caractères.");
        const { data, error: err } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { first_name: firstName }, emailRedirectTo: `${window.location.origin}/connexion` },
        });
        if (err) throw new Error(/registered|already/i.test(err.message) ? "Ce mail a déjà un compte : connectez-vous." : "La création du compte n'a pas marché. Réessayez.");
        if (!data.session) setMode("confirm");
        else afterAuth();
      } else if (mode === "forgot") {
        await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/connexion?reset=1` });
        setMode("sent");
      } else if (mode === "reset") {
        if (password.length < 8) throw new Error("Le mot de passe doit faire au moins 8 caractères.");
        const { error: err } = await supabase.auth.updateUser({ password });
        if (err) throw new Error(/same|different/i.test(err.message || "") ? "Choisis un mot de passe différent de l'ancien." : "Le lien a expiré. Redemande un mot de passe.");
        try {
          window.localStorage.removeItem(RESET_KEY);
        } catch {
          /* ignore */
        }
        window.location.replace("/dashboard");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const couple = invite ? [invite.partner1, invite.partner2].filter(Boolean).join(" et ") : "";
  const titles = {
    login: "Content de te revoir.",
    signup: token ? "Rejoins l'organisation." : "Crée ton accès.",
    forgot: "Mot de passe oublié.",
    reset: "Nouveau mot de passe.",
    sent: "Regarde ta boîte mail.",
    confirm: "Plus qu'un clic.",
    join: `Le mariage de ${couple}.`,
    badlink: "Ce lien ne marche plus.",
    signedin: "Tu es déjà connecté.",
    expired: "Ce lien a expiré.",
    checking: "Connexion.",
  };

  async function signOut() {
    await supabase.auth.signOut();
    try {
      window.localStorage.removeItem(RESET_KEY);
    } catch {
      /* ignore */
    }
    setUser(null);
    setPassword("");
    setMode(token ? "signup" : "login");
  }

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
          <div className="eyebrow">{token && mode !== "login" ? "Invitation" : "Connexion"}</div>
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
          ) : mode === "checking" ? (
            <p className="help">Un instant…</p>
          ) : mode === "signedin" ? (
            <>
              <p className="help">Tu es connecté avec {user?.email}.</p>
              <div className="actions">
                <button type="button" className="skip" onClick={signOut}>
                  Se déconnecter
                </button>
                <a className="btn" href={next}>
                  Aller au tableau de bord
                </a>
              </div>
            </>
          ) : mode === "expired" ? (
            <>
              <p className="help">Le lien pour changer de mot de passe ne sert qu'une fois et expire au bout d'une heure. Demande un nouveau lien.</p>
              <div className="actions">
                <button type="button" className="btn" onClick={() => setMode("forgot")}>
                  Recevoir un nouveau lien
                </button>
              </div>
            </>
          ) : mode === "join" ? (
            <>
              <p className="help">
                Tu es invité{invite?.invited_as ? ` en tant que « ${invite.invited_as} »` : ""} à organiser ce mariage sur Merry, avec les mêmes droits que le couple : invités, rétroplanning et budget.
              </p>
              <div className="actions">
                <button
                  type="button"
                  className="skip"
                  onClick={() => {
                    dropToken();
                    window.location.replace("/dashboard");
                  }}
                >
                  Pas maintenant
                </button>
                <button type="button" className="btn" onClick={join} disabled={busy}>
                  Rejoindre
                </button>
              </div>
            </>
          ) : mode === "badlink" ? (
            <>
              <p className="help">Ce lien d'invitation a déjà servi ou a été remplacé. Demande un nouveau lien à la personne qui t'a invité.</p>
              <div className="actions">
                <a className="btn" href="/dashboard">
                  Aller au tableau de bord
                </a>
              </div>
            </>
          ) : mode === "sent" ? (
            <p className="help">Si un compte existe pour {email}, un lien pour choisir un nouveau mot de passe vient d'arriver.</p>
          ) : mode === "confirm" ? (
            <p className="help">Un mail de confirmation est parti à {email}. Clique sur le lien : tu reviendras ici pour rejoindre l'organisation.</p>
          ) : (
            <form onSubmit={submit} className="fields">
              {mode === "reset" ? (
                <p className="help" style={{ gridColumn: "1 / -1", margin: 0 }}>
                  Choisis un nouveau mot de passe pour {user?.email}. Tu accèdes au tableau de bord juste après.
                </p>
              ) : null}
              {mode === "signup" && token ? (
                <p className="help" style={{ gridColumn: "1 / -1", margin: 0 }}>
                  On t'a invité à organiser un mariage sur Merry. Crée ton accès, ou connecte-toi si tu as déjà un compte.
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
                ) : mode === "reset" ? (
                  <button type="button" className="skip" onClick={signOut}>
                    Annuler
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

          {mode === "login" && !token ? (
            <p className="footnote">
              Pas encore de compte ? <a href="/">Raconte-nous ton mariage</a>, Merry prépare ton tableau de bord.
            </p>
          ) : null}
        </section>
      </main>
    </div>
  );
}
