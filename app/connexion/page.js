"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { SITE_URL } from "@/lib/site";
import { INVITE_KEY, RESET_KEY } from "@/lib/dash/store";
import { useLang } from "@/lib/lang";
import { CONNEXION_TEXT } from "@/lib/i18n/connexion";
import LangSwitch from "@/components/LangSwitch";

/*
 * Connexion au tableau de bord, depuis le bouton « Connexion » du site.
 * Gère aussi le lien d'invitation d'un organisateur (?invitation=…) : on
 * montre le mariage concerné et on ne rejoint qu'après confirmation.
 * Textes FR/EN : voir lib/i18n/connexion.js.
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
  const { lang } = useLang();
  const s = CONNEXION_TEXT[lang];

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
        if (err) throw new Error(s.errors.badLogin);
        afterAuth();
      } else if (mode === "signup") {
        if (password.length < 8) throw new Error(s.errors.passwordTooShort);
        const { data, error: err } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { first_name: firstName }, emailRedirectTo: `${window.location.origin}/connexion` },
        });
        if (err) throw new Error(/registered|already/i.test(err.message) ? s.errors.alreadyRegistered : s.errors.signupFailed);
        if (!data.session) setMode("confirm");
        else afterAuth();
      } else if (mode === "forgot") {
        await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/connexion?reset=1` });
        setMode("sent");
      } else if (mode === "reset") {
        if (password.length < 8) throw new Error(s.errors.passwordTooShort);
        const { error: err } = await supabase.auth.updateUser({ password });
        if (err) throw new Error(/same|different/i.test(err.message || "") ? s.errors.samePassword : s.errors.resetExpired);
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
    login: s.titles.login,
    signup: token ? s.titles.signupInvited : s.titles.signupNew,
    forgot: s.titles.forgot,
    reset: s.titles.reset,
    sent: s.titles.sent,
    confirm: s.titles.confirm,
    join: s.titles.join(couple),
    badlink: s.titles.badlink,
    signedin: s.titles.signedin,
    expired: s.titles.expired,
    checking: s.titles.checking,
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

  const isForm = !["checking", "signedin", "expired", "join", "badlink", "sent", "confirm"].includes(mode);

  return (
    <div className="ob cx">
      <div className="cx-glow" aria-hidden="true" />
      <header className="ob-header">
        <a className="ob-logo" href={SITE_URL} aria-label={s.logoAria}>
          Merry
        </a>
        <div className="ob-header-right">
          <LangSwitch />
          <a className="cx-site" href={SITE_URL}>
            <span className="cx-site-long">{s.backToSite}</span>
            <span className="cx-site-short">{s.backToSiteShort}</span>
          </a>
        </div>
      </header>

      <main className="ob-main cx-main">
        <div className="cx-head">
          <span className="ob-tag">{token && mode !== "login" ? s.eyebrowInvitation : s.eyebrowLogin}</span>
          <h1 className="cx-title">{titles[mode]}</h1>
        </div>

        {!supabase ? (
          <>
            <p className="cx-help">{s.noSupabase}</p>
            <a className="ob-btn accent cx-wide" href="/dashboard?demo=1">
              {s.seeDemo}
            </a>
          </>
        ) : mode === "checking" ? (
          <p className="cx-help">{s.oneMoment}</p>
        ) : mode === "signedin" ? (
          <>
            <p className="cx-help">{s.signedInAs(user?.email)}</p>
            <a className="ob-btn accent cx-wide" href={next}>
              {s.goToDashboard}
            </a>
            <button type="button" className="ob-link cx-center" onClick={signOut}>
              {s.signOut}
            </button>
          </>
        ) : mode === "expired" ? (
          <>
            <p className="cx-help">{s.expiredHelp}</p>
            <button type="button" className="ob-btn accent cx-wide" onClick={() => setMode("forgot")}>
              {s.getNewLink}
            </button>
          </>
        ) : mode === "join" ? (
          <>
            <p className="cx-help">{s.joinHelp(invite?.invited_as)}</p>
            <button type="button" className="ob-btn accent cx-wide" onClick={join} disabled={busy}>
              {s.join}
            </button>
            <button
              type="button"
              className="ob-link cx-center"
              onClick={() => {
                dropToken();
                window.location.replace("/dashboard");
              }}
            >
              {s.notNow}
            </button>
          </>
        ) : mode === "badlink" ? (
          <>
            <p className="cx-help">{s.badlinkHelp}</p>
            <a className="ob-btn accent cx-wide" href="/dashboard">
              {s.goToDashboard}
            </a>
          </>
        ) : mode === "sent" ? (
          <p className="cx-help">{s.sentHelp(email)}</p>
        ) : mode === "confirm" ? (
          <p className="cx-help">{s.confirmHelp(email)}</p>
        ) : null}

        {supabase && isForm ? (
          <form onSubmit={submit} className="cx-form">
            {mode === "reset" ? <p className="cx-help">{s.resetHelp(user?.email)}</p> : null}
            {mode === "signup" && token ? <p className="cx-help">{s.signupInvitedHelp}</p> : null}
            {mode === "signup" ? (
              <div className="ob-field">
                <label htmlFor="c-first">{s.firstNameLabel}</label>
                <input id="c-first" className="ob-input" value={firstName} onChange={(e) => setFirstName(e.target.value)} autoComplete="given-name" required />
              </div>
            ) : null}
            {mode !== "reset" ? (
              <div className="ob-field">
                <label htmlFor="c-email">{s.emailLabel}</label>
                <input
                  id="c-email"
                  className="ob-input"
                  type="email"
                  placeholder={s.emailPlaceholder}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                />
              </div>
            ) : null}
            {mode !== "forgot" ? (
              <div className="ob-field">
                <div className="cx-label-row">
                  <label htmlFor="c-password">{mode === "reset" ? s.newPasswordLabel : s.passwordLabel}</label>
                  {mode === "login" ? (
                    <button type="button" className="ob-link" onClick={() => setMode("forgot")}>
                      {s.forgotPassword}
                    </button>
                  ) : null}
                </div>
                <input
                  id="c-password"
                  className="ob-input"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  minLength={mode === "login" ? undefined : 8}
                  required
                />
              </div>
            ) : null}
            {error ? <p className="ob-error">{error}</p> : null}
            <button type="submit" className="ob-btn accent cx-wide" disabled={busy}>
              {mode === "login" ? s.submit.login : mode === "signup" ? s.submit.signup : mode === "forgot" ? s.submit.forgot : s.submit.reset}
            </button>
            {mode === "signup" ? (
              <button type="button" className="ob-link cx-center" onClick={() => setMode("login")}>
                {s.haveAccount}
              </button>
            ) : mode === "reset" ? (
              <button type="button" className="ob-link cx-center" onClick={signOut}>
                {s.cancel}
              </button>
            ) : mode === "forgot" ? (
              <button type="button" className="ob-link cx-center" onClick={() => setMode("login")}>
                {s.back}
              </button>
            ) : null}
          </form>
        ) : null}

        {mode === "login" && !token ? (
          <p className="cx-foot">
            {s.footnoteLead}
            <a href="/">{s.footnoteLink}</a>
          </p>
        ) : null}
      </main>
    </div>
  );
}
