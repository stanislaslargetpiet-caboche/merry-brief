"use client";

import Link from "next/link";
import { safeNext } from "@/lib/connexionNext";
import "@/app/onboarding.css";

import { useEffect, useState } from "react";
import { supabase, sendPasswordChangedMail, sendWelcomeMail } from "@/lib/supabase";
import { SITE_URL } from "@/lib/site";
import { INVITE_KEY, RESET_KEY } from "@/lib/dash/store";
import { useLang } from "@/lib/lang";
import { CONNEXION_TEXT } from "@/lib/i18n/connexion";
import { formError } from "@/lib/connexionForm";
import LangSwitch from "@/components/LangSwitch";

/*
 * Connexion au tableau de bord, depuis le bouton « Connexion » du site.
 * Gère aussi le lien d'invitation d'un organisateur ou d'un collaborateur
 * prestataire (?invitation=…) : on montre le mariage ou l'établissement
 * concerné et on ne rejoint qu'après confirmation.
 * Textes FR/EN : voir lib/i18n/connexion.js.
 */

const TOKEN_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Supabase lit puis efface le #… de l'adresse au chargement : on le garde avant.
const INITIAL_HASH = typeof window !== "undefined" ? window.location.hash : "";

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
  // Compte créé à l'instant depuis un lien d'invitation : la bienvenue part après merry_join
  const [freshAccount, setFreshAccount] = useState(false);
  const [invite, setInvite] = useState(null); // { partner1, partner2, invited_as } ou { vendor_name }
  const [inviteKind, setInviteKind] = useState("wedding"); // wedding | pro
  const [next, setNext] = useState("/dashboard");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function showJoin(t) {
    const wedding = await supabase.rpc("merry_invite_info", { token: t });
    if (wedding.data && wedding.data.length) {
      setInvite(wedding.data[0]);
      setInviteKind("wedding");
      setMode("join");
      return;
    }
    // Pas une invitation de mariage : peut-être une invitation de collaborateur prestataire
    const pro = await supabase.rpc("pro_invite_info", { token: t });
    if (pro.data && pro.data.length) {
      setInvite(pro.data[0]);
      setInviteKind("pro");
      setMode("join");
      return;
    }
    dropToken();
    setMode("badlink");
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
      // Retour du lien de confirmation, si la confirmation d'adresse est activée dans Supabase
      else if (INITIAL_HASH.includes("type=signup")) {
        sendWelcomeMail(session.access_token);
        window.location.replace(safeNext(params.get("next")));
      }
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
    const { data: id, error: err } = await supabase.rpc(inviteKind === "pro" ? "pro_join" : "merry_join", { token });
    setBusy(false);
    dropToken();
    if (err || !id) {
      setMode("badlink");
      return;
    }
    if (inviteKind === "pro") {
      try {
        window.localStorage.setItem("merry-pro-vendor", id);
      } catch {
        /* ignore */
      }
      window.location.replace("/pro");
      return;
    }
    try {
      window.localStorage.setItem("merry-wedding", id);
    } catch {
      /* ignore */
    }
    // Prévient le reste de l'équipe (best-effort, n'attend pas la réponse)
    supabase.auth.getSession().then(({ data }) => {
      const at = data?.session?.access_token;
      if (freshAccount) sendWelcomeMail(at, id);
      if (at) fetch("/api/nouveau-membre", { method: "POST", headers: { authorization: `Bearer ${at}`, "content-type": "application/json" }, body: JSON.stringify({ weddingId: id }) }).catch(() => {});
    });
    window.location.replace("/dashboard");
  }

  async function submit(e) {
    e.preventDefault();
    const invalide = formError(mode, { firstName, email, password });
    if (invalide) {
      setError(s.errors[invalide]);
      return;
    }
    setError("");
    setBusy(true);
    try {
      if (mode === "login") {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password });
        if (err) throw new Error(s.errors.badLogin);
        afterAuth();
      } else if (mode === "signup") {
        const { data, error: err } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { first_name: firstName }, emailRedirectTo: `${window.location.origin}/connexion` },
        });
        if (err) throw new Error(/registered|already/i.test(err.message) ? s.errors.alreadyRegistered : s.errors.signupFailed);
        if (!data.session) setMode("confirm");
        else {
          if (token) setFreshAccount(true);
          else sendWelcomeMail(data.session.access_token);
          afterAuth();
        }
      } else if (mode === "forgot") {
        const { error: err } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/connexion?reset=1` });
        if (err) throw new Error(s.errors.resetRequestFailed);
        setMode("sent");
      } else if (mode === "reset") {
        if (password.length < 8) throw new Error(s.errors.passwordTooShort);
        const { error: err } = await supabase.auth.updateUser({ password });
        if (err) throw new Error(/same|different/i.test(err.message || "") ? s.errors.samePassword : s.errors.resetExpired);
        sendPasswordChangedMail();
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
    join: inviteKind === "pro" ? s.titles.joinPro(invite?.vendor_name || "") : s.titles.join(couple),
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
            <p className="cx-help">{inviteKind === "pro" ? s.joinHelpPro(invite?.vendor_name || "") : s.joinHelp(invite?.invited_as)}</p>
            <button type="button" className="ob-btn accent cx-wide" onClick={join} disabled={busy}>
              {s.join}
            </button>
            <button
              type="button"
              className="ob-link cx-center"
              onClick={() => {
                dropToken();
                window.location.replace(inviteKind === "pro" ? "/pro" : "/dashboard");
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
          <form onSubmit={submit} className="cx-form" noValidate>
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
            <Link href="/">{s.footnoteLink}</Link>
          </p>
        ) : null}
        {/* Un prestataire arrivé ici par erreur : sa porte est /pro (tests du 5 nov. 2026) */}
        {(mode === "login" || mode === "forgot") && !token ? (
          <p className="cx-foot">
            {s.proLead}
            <a href="/pro">{s.proLink}</a>
          </p>
        ) : null}
      </main>
    </div>
  );
}
