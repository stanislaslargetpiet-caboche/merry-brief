"use client";

// Revendiquer sa fiche (maquettes V0 et V0m) : retrouver son établissement dans le catalogue Merry,
// puis prouver que c'est bien soi avec un code reçu à l'adresse mail de la fiche. Sert aussi de connexion :
// un prestataire qui revient refait ces deux étapes et retrouve son espace.
// Créer sa fiche (maquettes V0c et V0cm) : l'établissement n'est pas dans le catalogue, le prestataire donne
// son nom, son activité, son adresse et son adresse mail ; le code reçu à cette adresse crée la fiche.

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { usePro } from "@/lib/pro/store";
import { ProIcon } from "./icons";

const CONTACT = "bonjour@withmerry.com";

// Les catégories du catalogue (catalog.categories)
const CATEGORIES = [
  ["lieu", "Lieu de réception"],
  ["photographe", "Photographe"],
  ["videaste", "Vidéaste"],
  ["traiteur", "Traiteur"],
  ["dj", "DJ et animation"],
  ["musiciens", "Musiciens et groupes"],
  ["fleuriste", "Fleuriste"],
  ["decoration", "Décoration et location"],
  ["wedding_planner", "Wedding planner"],
  ["patisserie", "Pâtissier et wedding cake"],
  ["beaute", "Coiffure et maquillage"],
  ["robe", "Robes et costumes"],
  ["transport", "Transport"],
  ["officiant", "Officiant de cérémonie"],
];
const EMPTY_FORM = { name: "", category: "lieu", address: "", postal_code: "", city: "", email: "", phone: "", siret: "" };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Ce qui manque au formulaire « Créer votre fiche », dans l'ordre de l'écran
function formProblem(f) {
  if (f.name.trim().length < 2) return "Indiquez le nom de votre établissement.";
  if (!f.address.trim()) return "Indiquez l’adresse de votre établissement.";
  if (!/^\d{5}$/.test(f.postal_code.replace(/\s/g, ""))) return "Le code postal compte 5 chiffres.";
  if (!f.city.trim()) return "Indiquez la ville.";
  if (!EMAIL_RE.test(f.email.trim())) return "Indiquez une adresse mail valide : le code y sera envoyé.";
  if (f.siret.trim() && !/^\d{14}$/.test(f.siret.replace(/\s/g, ""))) return "Le SIRET compte 14 chiffres. Vous pouvez aussi le laisser vide.";
  return "";
}

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
  address: "Nous ne trouvons pas cette adresse. Vérifiez le code postal et la ville, puis validez de nouveau le code.",
  create_failed: "Le code est bon, mais la fiche n’a pas pu être créée. Réessayez dans un instant.",
  network: "La connexion a échoué. Vérifiez votre réseau, puis réessayez.",
};

export default function Claim() {
  const pro = usePro();
  const [step, setStep] = useState(1);
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [setupMissing, setSetupMissing] = useState(false);
  const [picked, setPicked] = useState(null);
  const [channel, setChannel] = useState("mail");
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [fixNote, setFixNote] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(() => ({ ...EMPTY_FORM, email: pro.data?.user?.email || "" }));
  const boxes = useRef([]);
  const demo = pro.mode === "demo";

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
    // Démo : aucun code ne part, n'importe quels 6 chiffres ouvrent l'espace de démonstration
    if (demo) {
      setSent(true);
      setTimeout(() => boxes.current[0]?.focus(), 50);
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

  function choose(found) {
    const r = demo && !found.email_hint ? { ...found, email_hint: "c•••@exemple.fr" } : found;
    setPicked(r);
    setStep(2);
    setSent(false);
    setError("");
    setFixNote(false);
    if (r.email_hint) sendCode(r);
  }

  function startCreate() {
    setCreating(true);
    setStep(1);
    setError("");
    setSent(false);
    if (q.trim().length >= 3 && !/^\d[\d\s]*$/.test(q) && !form.name) setForm((f) => ({ ...f, name: q.trim() }));
  }

  function backToSearch() {
    setCreating(false);
    setStep(1);
    setError("");
  }

  const field = (key) => ({ value: form[key], onChange: (e) => setForm((f) => ({ ...f, [key]: e.target.value })) });
  const formFields = () => ({ ...form, email: undefined });

  async function sendCreateCode() {
    const problem = formProblem(form);
    if (problem) {
      setError(problem);
      return;
    }
    setError("");
    if (demo) {
      setStep(2);
      setSent(true);
      return;
    }
    setBusy(true);
    const res = await call({ action: "create_send", email: form.email.trim(), fields: formFields() });
    setBusy(false);
    if (!res.ok) {
      setError(ERRORS[res.error] || ERRORS.send_failed);
      return;
    }
    setStep(2);
    setSent(true);
    setCode(["", "", "", "", "", ""]);
    setTimeout(() => boxes.current[0]?.focus(), 50);
  }

  async function validate() {
    const c = code.join("");
    if (c.length < 6) {
      setError("Entrez les 6 chiffres du code.");
      return;
    }
    setBusy(true);
    setError("");
    if (demo) {
      window.location.assign(creating ? "/pro/fiche?demo=1" : "/pro?demo=1");
      return;
    }
    const res = creating
      ? await call({ action: "create_verify", email: form.email.trim(), code: c, fields: formFields() })
      : await call({ action: "verify", vendorId: picked.id, code: c });
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

  const cardTitle = step === 2 ? (creating ? form.name.trim() : picked?.name) : creating ? "Créez votre fiche" : "Retrouvez votre établissement";
  const eyebrow = step === 2 ? "Votre fiche" : creating ? "Nouvelle fiche" : "Espace prestataire";
  const goBack = step === 2 ? () => setStep(1) : creating ? backToSearch : null;

  const codeBlock = (label, resend) => (
    <div className="p-claim-code">
      <span id="code-label">{label}</span>
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
      <button type="button" className="p-claim-resend" onClick={resend} disabled={busy}>
        {sent ? "Renvoyer le code" : "Envoyer le code"}
      </button>
    </div>
  );
  const errorBox = error ? (
    <p className="p-claim-error" role="alert">
      {error}{" "}
      {/Écrivez-nous/.test(error) ? <a href={`mailto:${CONTACT}?subject=Accès à ma fiche Merry${picked ? ` : ${picked.name}` : ""}`}>{CONTACT}</a> : null}
    </p>
  ) : null;
  const categoryLabel = CATEGORIES.find(([slug]) => slug === form.category)?.[1];

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
            {goBack ? (
              <button type="button" className="p-claim-back" aria-label="Étape précédente" onClick={goBack}>
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

          {creating && step === 1 ? (
            <>
              <p className="p-claim-help">Quelques informations pour commencer. Photos, prix et capacités se complètent ensuite dans Ma fiche.</p>
              <div className="p-claim-field">
                <label htmlFor="pro-name">Nom de l’établissement</label>
                <input id="pro-name" className="p-claim-input" autoComplete="organization" {...field("name")} />
              </div>
              <div className="p-claim-field">
                <label htmlFor="pro-cat">Activité</label>
                <select id="pro-cat" className="p-claim-input p-claim-select" {...field("category")}>
                  {CATEGORIES.map(([slug, label]) => (
                    <option key={slug} value={slug}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="p-claim-field">
                <label htmlFor="pro-adr">Adresse</label>
                <input id="pro-adr" className="p-claim-input" autoComplete="address-line1" {...field("address")} />
              </div>
              <div className="p-claim-row">
                <div className="p-claim-field is-cp">
                  <label htmlFor="pro-cp">Code postal</label>
                  <input id="pro-cp" className="p-claim-input" inputMode="numeric" autoComplete="postal-code" maxLength={6} {...field("postal_code")} />
                </div>
                <div className="p-claim-field">
                  <label htmlFor="pro-ville">Ville</label>
                  <input id="pro-ville" className="p-claim-input" autoComplete="address-level2" {...field("city")} />
                </div>
              </div>
              <div className="p-claim-field">
                <label htmlFor="pro-mail">Adresse mail de l’établissement</label>
                <input id="pro-mail" className="p-claim-input" type="email" autoComplete="email" {...field("email")} />
                <span className="p-claim-hint">Nous y envoyons un code pour vérifier que c’est bien vous. C’est aussi là qu’arrivent les demandes des couples.</span>
              </div>
              <div className="p-claim-row is-wrap">
                <div className="p-claim-field">
                  <label htmlFor="pro-tel">
                    Téléphone <span className="p-claim-opt">(facultatif)</span>
                  </label>
                  <input id="pro-tel" className="p-claim-input" type="tel" autoComplete="tel" {...field("phone")} />
                </div>
                <div className="p-claim-field">
                  <label htmlFor="pro-siret">
                    SIRET <span className="p-claim-opt">(facultatif)</span>
                  </label>
                  <input id="pro-siret" className="p-claim-input" inputMode="numeric" {...field("siret")} />
                </div>
              </div>
              <button type="button" className="p-claim-link p-claim-tel-only" onClick={backToSearch}>
                Retrouver une fiche existante
              </button>
              {errorBox}
              <div className="p-claim-actions is-split">
                <button type="button" className="p-claim-link p-desk-only" onClick={backToSearch}>
                  Retrouver une fiche existante
                </button>
                <button type="button" className="p-claim-submit" onClick={sendCreateCode} disabled={busy}>
                  Recevoir mon code
                </button>
              </div>
            </>
          ) : creating ? (
            <>
              <div className="p-claim-recap">
                <span className="p-claim-vname">{form.name.trim()}</span>
                <ul>
                  <li>
                    <ProIcon name="pin" size={16} stroke="#5f5e58" />
                    <span>
                      {form.address.trim()}, {form.postal_code.trim()} {form.city.trim()}
                    </span>
                  </li>
                  <li>
                    <ProIcon name="fiche" size={16} stroke="#5f5e58" />
                    <span>{categoryLabel}</span>
                  </li>
                </ul>
                <button type="button" className="p-claim-fix" onClick={() => setStep(1)}>
                  Modifier
                </button>
              </div>
              <p className="p-claim-intro">Votre fiche est proposée aux couples dès que vous validez le code. Ajoutez ensuite vos photos, vos prix et vos capacités dans Ma fiche.</p>
              <div className="p-claim-rule" />
              <div className="p-claim-legend">Vérifions que c’est bien vous</div>
              {codeBlock(`Le code à 6 chiffres envoyé à ${form.email.trim()}`, sendCreateCode)}
              {errorBox}
              <div className="p-claim-actions">
                <button type="button" className="p-claim-submit" onClick={validate} disabled={busy}>
                  Créer ma fiche
                </button>
              </div>
            </>
          ) : step === 1 ? (
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
              <div className="p-claim-new">
                <span>
                  <span className="p-claim-new-title">Mon établissement n’apparaît pas</span>
                  <span className="p-claim-new-sub">Créez votre fiche en deux minutes.</span>
                </span>
                <button type="button" className="p-btn p-btn-ghost" onClick={startCreate}>
                  Créer ma fiche
                </button>
              </div>
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
              {channel === "mail" && picked.email_hint ? codeBlock(sent ? "Le code à 6 chiffres reçu par mail" : "Nous envoyons un code à 6 chiffres à cette adresse", () => sendCode()) : null}
              {errorBox}
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
