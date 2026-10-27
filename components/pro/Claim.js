"use client";

// Revendiquer sa fiche (maquettes V0 et V0m) : retrouver son établissement dans le catalogue Merry,
// puis prouver que c'est bien soi avec un code reçu à l'adresse mail de la fiche. Sert aussi de connexion :
// un prestataire qui revient refait ces deux étapes et retrouve son espace.

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { usePro } from "@/lib/pro/store";
import { ProIcon } from "./icons";

const CONTACT = "bonjour@merry.fr";

async function call(body) {
  try {
    const res = await fetch("/api/pro/claim", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const json = await res.json().catch(() => ({}));
    return { status: res.status, ...json };
  } catch {
    return { status: 0, error: "network" };
  }
}

// Recherche : par le serveur (photos signées), sinon directement dans la base (sans photo)
async function search(q) {
  const res = await call({ action: "search", q });
  if (res.results) return { results: res.results };
  if (res.error === "setup") return { setup: true, results: [] };
  if (!supabase) return { results: [] };
  const { data, error } = await supabase.rpc("pro_search", { q });
  if (error) return { setup: /PGRST202|Could not find/i.test(error.message), results: [] };
  return { results: (data || []).map((r) => ({ ...r, photo: null })) };
}

const ERRORS = {
  not_configured: "La vérification n’est pas encore branchée sur ce site (clé du serveur manquante). Écrivez-nous et nous l’activons pour vous.",
  no_email: "Nous n’avons pas d’adresse mail pour cette fiche. Écrivez-nous depuis l’adresse de votre établissement : nous vous ouvrons l’accès.",
  wait: "Un code vient déjà de partir. Attendez une minute avant d’en demander un autre.",
  send_failed: "Le code n’a pas pu partir. Réessayez dans un instant.",
  bad_code: "Ce code ne correspond pas, ou il a expiré. Vérifiez-le, ou demandez-en un nouveau.",
  setup: "L’espace prestataire n’est pas encore installé sur la base de données (supabase/espace-prestataire.sql).",
  link_failed: "Le code est bon, mais la fiche n’a pas pu être rattachée à votre compte. Réessayez.",
  network: "La connexion a échoué. Vérifiez votre réseau, puis réessayez.",
};

export default function Claim() {
  const pro = usePro();
  const [step, setStep] = useState(1);
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [setupMissing, setSetupMissing] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [picked, setPicked] = useState(null);
  const [channel, setChannel] = useState("mail");
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [fixNote, setFixNote] = useState(false);
  const boxes = useRef([]);

  // Recherche au fil de la frappe
  useEffect(() => {
    const t = q.trim();
    if (t.length < 3) {
      setResults([]);
      return undefined;
    }
    let live = true;
    setSearching(true);
    const timer = setTimeout(async () => {
      const r = await search(t);
      if (!live) return;
      setResults(r.results);
      setSetupMissing(!!r.setup);
      setSearching(false);
    }, 300);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [q]);

  async function sendCode(target = picked) {
    setError("");
    if (!target?.email_hint) {
      setError(ERRORS.no_email);
      return;
    }
    setBusy(true);
    const res = await call({ action: "send", vendorId: target.id });
    setBusy(false);
    if (res.ok) {
      setSent(true);
      setCode(["", "", "", "", "", ""]);
      setTimeout(() => boxes.current[0]?.focus(), 50);
    } else setError(ERRORS[res.error] || ERRORS.send_failed);
  }

  function choose(r) {
    setPicked(r);
    setStep(2);
    setSent(false);
    setError("");
    setFixNote(false);
    if (r.email_hint) sendCode(r);
  }

  async function validate() {
    const c = code.join("");
    if (c.length < 6) {
      setError("Entrez les 6 chiffres du code.");
      return;
    }
    setBusy(true);
    setError("");
    const res = await call({ action: "verify", vendorId: picked.id, code: c });
    if (!res.ok) {
      setBusy(false);
      setError(ERRORS[res.error] || ERRORS.bad_code);
      return;
    }
    await supabase.auth.setSession(res.session);
    pro.reload();
  }

  function typeDigit(i, raw) {
    const digits = raw.replace(/\D/g, "");
    if (digits.length > 1) {
      // Code collé d'un coup
      const next = [...code];
      digits
        .slice(0, 6 - i)
        .split("")
        .forEach((d, k) => (next[i + k] = d));
      setCode(next);
      boxes.current[Math.min(5, i + digits.length)]?.focus();
      return;
    }
    const next = [...code];
    next[i] = digits;
    setCode(next);
    if (digits && i < 5) boxes.current[i + 1]?.focus();
  }

  const cardTitle = step === 1 ? "Retrouvez votre établissement" : picked?.name;
  const eyebrow = step === 1 ? "Espace prestataire" : "Votre fiche";

  return (
    <div className="p-claim">
      <aside className="p-claim-panel">
        <div className="p-brand">
          <span className="p-brand-logo">Merry</span>
          <span className="p-brand-sub">Espace prestataire</span>
        </div>
        <div className="p-claim-word">{step === 1 ? "Bienvenue." : "C’est à vous."}</div>
        <div className="p-claim-caption">Merry - Experience Crafting Group</div>
      </aside>
      <div className="p-claim-stage">
        <div className="p-claim-band">
          <div className="p-claim-top">
            {step === 2 ? (
              <button type="button" className="p-claim-back" aria-label="Étape précédente" onClick={() => setStep(1)}>
                <ProIcon name="prev" size={18} sw={2} />
              </button>
            ) : (
              <span className="p-claim-back is-empty" />
            )}
            <div className="p-claim-progress">
              <span style={{ width: step === 1 ? "50%" : "100%" }} />
            </div>
            <span className="p-claim-count">{step} / 2</span>
          </div>
          <div className="p-claim-band-title">
            <span className="p-claim-eyebrow">{eyebrow}</span>
            <h1 className="p-claim-h1">{cardTitle}</h1>
          </div>
        </div>
        <div className="p-claim-card">
          <div className="p-claim-eyebrow p-desk-only">{eyebrow}</div>
          <h1 className="p-claim-h1 p-desk-only">{cardTitle}</h1>

          {step === 1 ? (
            <>
              <p className="p-claim-help">Merry a peut-être déjà une fiche pour vous. Retrouvez-la pour en prendre la main.</p>
              {setupMissing ? <p className="p-claim-error">{ERRORS.setup}</p> : null}
              <div className="p-claim-field">
                <label htmlFor="pro-q">Nom ou numéro SIRET</label>
                <div className="p-claim-search">
                  <ProIcon name="search" size={18} stroke="#5f5e58" />
                  <input id="pro-q" type="search" value={q} placeholder="Nom ou numéro SIRET" onChange={(e) => setQ(e.target.value)} autoComplete="organization" autoFocus />
                </div>
              </div>
              {results.length ? (
                <ul className="p-claim-results" aria-label="Résultats">
                  {results.map((r) => (
                    <li key={r.id}>
                      <span role="img" aria-label={`${r.name}, ${r.city || ""}`} className="p-claim-thumb" style={r.photo ? { backgroundImage: `url("${r.photo}")` } : undefined}>
                        {r.photo ? null : <span>Photo</span>}
                      </span>
                      <span className="p-claim-result">
                        <span className="p-claim-name">{r.name}</span>
                        <span className="p-claim-meta">{[r.city, r.category].filter(Boolean).join(" · ")}</span>
                      </span>
                      <button type="button" className="p-btn p-btn-ghost is-40" onClick={() => choose(r)}>
                        C’est moi
                      </button>
                    </li>
                  ))}
                </ul>
              ) : q.trim().length >= 3 && !searching && !setupMissing ? (
                <p className="p-claim-help">Aucune fiche ne porte ce nom. Essayez le nom tel qu’il apparaît sur Google, ou votre numéro SIRET.</p>
              ) : null}
              <div className="p-claim-center">
                <button type="button" className="p-claim-link" onClick={() => setNotFound((x) => !x)}>
                  Mon établissement n’apparaît pas
                </button>
              </div>
              {notFound ? (
                <p className="p-claim-help p-claim-centered">
                  Écrivez-nous à <a href={`mailto:${CONTACT}?subject=Créer ma fiche Merry`}>{CONTACT}</a> avec le nom et la ville de votre établissement : nous créons votre fiche.
                </p>
              ) : null}
            </>
          ) : (
            <>
              <div className="p-claim-vcard">
                <div role="img" aria-label={`${picked.name}, photo de couverture`} className="p-claim-cover" style={picked.photo ? { backgroundImage: `url("${picked.photo}")` } : undefined} />
                <div className="p-claim-vbody">
                  <span className="p-claim-vname">{picked.name}</span>
                  <ul>
                    {picked.address || picked.city ? (
                      <li>
                        <ProIcon name="pin" size={16} stroke="#5f5e58" />
                        <span>{[picked.address, [picked.postal_code, picked.city].filter(Boolean).join(" ")].filter(Boolean).join(", ")}</span>
                      </li>
                    ) : null}
                    {picked.category ? (
                      <li>
                        <ProIcon name="fiche" size={16} stroke="#5f5e58" />
                        <span>{picked.category}</span>
                      </li>
                    ) : null}
                    {picked.rating ? (
                      <li>
                        <ProIcon name="star" size={16} stroke="#5f5e58" />
                        <span>
                          {String(picked.rating).replace(".", ",")} sur Google · {picked.reviews || 0} avis
                        </span>
                      </li>
                    ) : null}
                  </ul>
                  <button type="button" className="p-claim-fix" onClick={() => setFixNote((x) => !x)}>
                    Corriger une information
                  </button>
                  {fixNote ? <p className="p-claim-help is-small">Une fois votre accès ouvert, vous corrigez tout dans Ma fiche.</p> : null}
                </div>
              </div>
              <p className="p-claim-intro">Merry a préparé votre fiche à partir d’informations publiques. Vérifiez-la, complétez-la, elle est à vous.</p>
              <div className="p-claim-rule" />
              <fieldset className="p-claim-channels">
                <legend>Vérifions que c’est bien vous</legend>
                <div>
                  <label className={`p-claim-channel${channel === "mail" ? " is-on" : ""}`}>
                    <input type="radio" name="canal" checked={channel === "mail"} onChange={() => setChannel("mail")} />
                    <ProIcon name="mail" size={20} />
                    <span>
                      <span className="p-claim-ctitle">Recevoir un code par mail</span>
                      <span className="p-claim-chint">{picked.email_hint || "Pas d’adresse sur la fiche"}</span>
                    </span>
                  </label>
                  <label className={`p-claim-channel is-off${channel === "sms" ? " is-on" : ""}`}>
                    <input type="radio" name="canal" checked={channel === "sms"} onChange={() => setChannel("sms")} />
                    <ProIcon name="mobile" size={20} />
                    <span>
                      <span className="p-claim-ctitle">Recevoir un code par SMS</span>
                      <span className="p-claim-chint">{channel === "sms" ? "Bientôt disponible, choisissez le mail" : picked.phone_hint || "Pas de numéro sur la fiche"}</span>
                    </span>
                  </label>
                </div>
              </fieldset>
              {channel === "mail" && picked.email_hint ? (
                <div className="p-claim-code">
                  <span id="code-label">{sent ? "Le code à 6 chiffres reçu par mail" : "Nous envoyons un code à 6 chiffres à cette adresse"}</span>
                  <div role="group" aria-labelledby="code-label" className="p-claim-digits">
                    {code.map((d, i) => (
                      <input
                        key={i}
                        ref={(el) => (boxes.current[i] = el)}
                        type="text"
                        inputMode="numeric"
                        autoComplete={i === 0 ? "one-time-code" : "off"}
                        maxLength={i === 0 ? 6 : 1}
                        value={d}
                        aria-label={`Chiffre ${i + 1} sur 6`}
                        onChange={(e) => typeDigit(i, e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Backspace" && !code[i] && i > 0) boxes.current[i - 1]?.focus();
                          if (e.key === "Enter") validate();
                        }}
                      />
                    ))}
                  </div>
                  <button type="button" className="p-claim-resend" onClick={() => sendCode()} disabled={busy}>
                    {sent ? "Renvoyer le code" : "Envoyer le code"}
                  </button>
                </div>
              ) : null}
              {error ? (
                <p className="p-claim-error" role="alert">
                  {error}{" "}
                  {/Écrivez-nous/.test(error) ? <a href={`mailto:${CONTACT}?subject=Accès à ma fiche Merry : ${picked.name}`}>{CONTACT}</a> : null}
                </p>
              ) : null}
              <div className="p-claim-actions">
                <button type="button" className="p-claim-submit" onClick={validate} disabled={busy || channel !== "mail" || !picked.email_hint}>
                  Valider
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
