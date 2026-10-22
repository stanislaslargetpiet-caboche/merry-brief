"use client";

import { useEffect, useMemo, useState } from "react";
import { createAccountAndBrief } from "@/lib/supabase";
import { SITE_URL } from "@/lib/site";

/* ------------------------------------------------------------------ */
/*  Contenu des écrans (source : canvas « Merry · Carte brief »,        */
/*  page Onboarding, validé le 21 oct. 2026)                            */
/* ------------------------------------------------------------------ */

const EVENTS = [
  { value: "mariage", label: "Mariage", sub: "Du lieu à la lune de miel", available: true },
  { value: "famille", label: "Fête de famille" },
  { value: "evjf", label: "Enterrement de vie de jeune fille" },
  { value: "evg", label: "Enterrement de vie de garçon" },
  { value: "anniversaire", label: "Anniversaire" },
  { value: "fiancailles", label: "Fiançailles" },
  { value: "bapteme", label: "Baptême" },
  { value: "autre", label: "Une autre fête" },
];

const STAGES = [
  { value: "debut", label: "Au tout (tout) début" },
  { value: "regarde", label: "On commence à s'y pencher" },
  { value: "lieu_recherche", label: "On cherche le lieu" },
  { value: "lieu_reserve", label: "Le lieu est réservé, il manque tout le reste" },
  { value: "details", label: "Presque fini, il reste les détails" },
];

const TEAMS = [
  { value: "nous_deux", label: "Juste nous deux" },
  { value: "nous_parents", label: "Nous et nos parents" },
  { value: "nous_planner", label: "Nous et un wedding planner" },
  { value: "planner_seul", label: "Juste un wedding planner" },
];

const GUESTS = [
  { value: "<50", label: "Moins de 50" },
  { value: "50-100", label: "50 à 100" },
  { value: "100-150", label: "100 à 150" },
  { value: "150-200", label: "150 à 200" },
  { value: ">200", label: "Plus de 200" },
];

const FORMATS = [
  { value: "jour", label: "Sur une journée" },
  { value: "weekend", label: "Tout un week-end" },
  { value: "inconnu", label: "On ne sait pas encore" },
];

const VIBES = [
  "Champêtre",
  "Grande fête",
  "Intime",
  "Chic",
  "Bohème",
  "Bord de mer",
  "Rock",
  "À l'ancienne",
  "Un peu dingue",
  "On ne sait pas encore",
];


const BUDGETS = [
  { value: "<15k", label: "Moins de 15 000 €" },
  { value: "15-30k", label: "15 000 à 30 000 €" },
  { value: "30-50k", label: "30 000 à 50 000 €" },
  { value: ">50k", label: "Plus de 50 000 €" },
  { value: "aucune_idee", label: "Aucune idée, aidez-nous" },
];

const HELP = [
  { value: "prestataires", label: "Trouver et comparer les prestataires", tag: "Gratuit" },
  { value: "invites", label: "Gérer la liste d'invités", tag: "Gratuit" },
  { value: "budget", label: "Gérer le budget et les paiements", tag: "Gratuit" },
  { value: "site", label: "Créer mon site de mariage", tag: "Gratuit" },
  { value: "cagnotte", label: "Créer ma cagnotte de mariage", tag: "Gratuit" },
  { value: "planner", label: "Trouver un wedding planner", tag: "Sur devis", quote: true },
  { value: "logements", label: "Trouver des logements et gérer les transports", tag: "Gratuit" },
];

const PANEL_WORDS = [
  "On fête quoi ?",
  "C'est parti !",
  "Qui fait quoi.",
  "Vous deux.",
  "Le sens de la fête.",
  "Sobre. Chic. Et élégant.",
  "Le budget.",
  "Un coup de main.",
  "On attaque.",
];

// 8 questions après le choix de la fête (étape 0, sans compteur).
const TOTAL = 8;
const DASHBOARD_URL = process.env.NEXT_PUBLIC_DASHBOARD_URL || "/dashboard";

const EMPTY = {
  event: "mariage",
  stage: "",
  team: "",
  first_name: "",
  first_age: "",
  partner_first_name: "",
  partner_age: "",
  wedding_date: "",
  date_unknown: false,
  region: "",
  region_unknown: false,
  guests: "",
  format: "",
  vibes: [],
  pinterest: "",
  weekend: [],
  honeymoon: "",
  honeymoon_vibes: [],
  budget: "",
  help: [],
  email: "",
  password: "",
  phone: "",
  partner_email: "",
};

const STORAGE_KEY = "merry-brief-draft-v2";
const PENDING_KEY = "merry-brief-pending";

/* ------------------------------------------------------------------ */
/*  Petits composants                                                  */
/* ------------------------------------------------------------------ */

function Chip({ selected, onClick, children, tag, quote }) {
  return (
    <button type="button" className="chip" aria-pressed={selected} onClick={onClick}>
      <span>{children}</span>
      {tag ? <span className={"tag" + (quote ? " quote" : "")}>{tag}</span> : null}
    </button>
  );
}

function Check() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12.5l4.5 4.5L19 7" />
    </svg>
  );
}

function CheckSmall() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flex: "none", marginLeft: "auto" }}>
      <path d="M5 12.5l4.5 4.5L19 7" />
    </svg>
  );
}

function ArrowLeft() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M15 5l-7 7 7 7" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Le flow                                                            */
/* ------------------------------------------------------------------ */

export default function Brief() {
  const [step, setStep] = useState(0);
  const [data, setData] = useState(EMPTY);
  const [status, setStatus] = useState("idle"); // idle | sending | done | confirm | error
  const [errorMsg, setErrorMsg] = useState("");

  // Brouillon par navigateur : le couple qui ferme l'onglet ne repart pas de zéro.
  // Le mot de passe n'est jamais mis dans le brouillon.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved && saved.data) {
          setData({ ...EMPTY, ...saved.data, password: "" });
          setStep(Math.min(saved.step || 0, TOTAL));
        }
      }
    } catch {
      /* stockage indisponible : on démarre à vide */
    }
  }, []);

  useEffect(() => {
    if (status === "done" || status === "confirm") return;
    try {
      const { password, ...rest } = data;
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ step, data: rest }));
    } catch {
      /* ignore */
    }
  }, [step, data, status]);

  const set = (key, value) => setData((d) => ({ ...d, [key]: value }));
  const toggleIn = (key, value, max) =>
    setData((d) => {
      const list = d[key].includes(value) ? d[key].filter((v) => v !== value) : [...d[key], value];
      return { ...d, [key]: max ? list.slice(-max) : list };
    });

  const isMail = (s) => /.+@.+\..+/.test(s);

  const canContinue = useMemo(() => {
    switch (step) {
      case 0:
        return data.event === "mariage";
      case 1:
        return !!data.stage;
      case 2:
        return !!data.team;
      case 3:
        return (
          data.first_name.trim().length > 0 &&
          data.partner_first_name.trim().length > 0 &&
          (data.date_unknown || data.wedding_date) &&
          (data.region_unknown || data.region.trim().length > 0)
        );
      case 4:
        return !!data.guests && !!data.format;
      case 5:
        return data.vibes.length > 0;
      case 6:
        return !!data.budget;
      case 7:
        return data.help.length > 0;
      case 8:
        return (
          isMail(data.email) &&
          data.password.length >= 8 &&
          data.phone.trim().length >= 6 &&
          (data.partner_email.trim() === "" || isMail(data.partner_email))
        );
      default:
        return false;
    }
  }, [step, data]);

  const next = () => setStep((s) => Math.min(s + 1, TOTAL));
  const back = () => setStep((s) => Math.max(s - 1, 0));

  async function submit() {
    setStatus("sending");
    setErrorMsg("");
    const brief = {
      stage: data.stage,
      team: data.team,
      first_name: data.first_name.trim(),
      first_age: data.first_age ? Number(data.first_age) : null,
      partner_first_name: data.partner_first_name.trim(),
      partner_age: data.partner_age ? Number(data.partner_age) : null,
      wedding_date: data.date_unknown ? null : data.wedding_date || null,
      date_unknown: data.date_unknown,
      region: data.region_unknown ? null : data.region.trim() || null,
      region_unknown: data.region_unknown,
      guests: data.guests,
      format: data.format,
      vibes: data.vibes,
      pinterest: data.pinterest.trim() || null,
      weekend: data.weekend,
      honeymoon: data.honeymoon.trim() || null,
      honeymoon_vibes: data.honeymoon_vibes,
      budget: data.budget,
      help: data.help,
      email: data.email.trim().toLowerCase(),
      phone: data.phone.trim(),
      partner_email: data.partner_email.trim().toLowerCase() || null,
      source: typeof window !== "undefined" ? window.location.search.slice(0, 200) || null : null,
    };
    const res = await createAccountAndBrief({ email: brief.email, password: data.password, brief });
    if (!res.ok) {
      setStatus("error");
      const m = res.error?.message || "";
      if (/already registered|already exists/i.test(m)) {
        setErrorMsg("Il y a déjà un compte avec cet email. Connecte-toi, ou utilise une autre adresse.");
      } else {
        setErrorMsg("Ça n'est pas passé de notre côté. Réessaie, ou écris-nous à bonjour@merry.fr.");
      }
      return;
    }
    try {
      window.localStorage.removeItem(STORAGE_KEY);
      if (res.needsEmailConfirmation) {
        window.localStorage.setItem(PENDING_KEY, JSON.stringify(brief));
      }
    } catch {
      /* ignore */
    }
    setStatus(res.needsEmailConfirmation ? "confirm" : "done");
  }

  /* ------------------------------ écrans ------------------------------ */

  function renderStep() {
    switch (step) {
      case 0:
        return (
          <>
            <div className="eyebrow">C'est parti !</div>
            <h1 className="question">Qu'est-ce que tu prépares ?</h1>
            <p className="help">Choisis ta fête, on adapte les questions.</p>
            <div className="choices events">
              {EVENTS.map((o) =>
                o.available ? (
                  <button key={o.value} type="button" className="chip event" aria-pressed={data.event === o.value} onClick={() => set("event", o.value)}>
                    <span className="event-text">
                      <span className="event-name">{o.label}</span>
                      <span className="event-sub">{o.sub}</span>
                    </span>
                    {data.event === o.value ? <CheckSmall /> : null}
                  </button>
                ) : (
                  <button key={o.value} type="button" className="chip event soon" disabled aria-disabled="true">
                    <span className="event-name">{o.label}</span>
                    <span className="tag soon-tag">Bientôt</span>
                  </button>
                )
              )}
            </div>
            <p className="note">Pour l'instant, Merry s'occupe des mariages. Les autres fêtes arrivent très vite.</p>
          </>
        );

      case 1:
        return (
          <>
            <div className="eyebrow">C'est parti !</div>
            <h1 className="question">Vous en êtes où ?</h1>
            <p className="help">Au tout début ou sur la dernière ligne droite : on s'adapte !</p>
            <div className="choices stack">
              {STAGES.map((o) => (
                <Chip key={o.value} selected={data.stage === o.value} onClick={() => set("stage", o.value)}>
                  {o.label}
                </Chip>
              ))}
            </div>
          </>
        );

      case 2:
        return (
          <>
            <div className="eyebrow">L'équipe</div>
            <h1 className="question">Qui participe à l'organisation ?</h1>
            <p className="help">Pour savoir qui aura accès au tableau de bord, et à qui on parle.</p>
            <div className="choices stack">
              {TEAMS.map((o) => (
                <Chip key={o.value} selected={data.team === o.value} onClick={() => set("team", o.value)}>
                  {o.label}
                </Chip>
              ))}
            </div>
          </>
        );

      case 3:
        return (
          <>
            <div className="eyebrow">Vous deux</div>
            <h1 className="question">Comme toute belle histoire, ça commence par les prénoms.</h1>
            <div className="fields">
              <div className="field">
                <label htmlFor="first_name">Ton prénom</label>
                <input id="first_name" value={data.first_name} onChange={(e) => set("first_name", e.target.value)} autoComplete="given-name" />
              </div>
              <div className="field">
                <label htmlFor="first_age">Ton âge</label>
                <input id="first_age" inputMode="numeric" pattern="[0-9]*" value={data.first_age} onChange={(e) => set("first_age", e.target.value.replace(/\D/g, "").slice(0, 2))} />
              </div>
              <div className="field">
                <label htmlFor="partner_first_name">Le prénom de ta moitié</label>
                <input id="partner_first_name" value={data.partner_first_name} onChange={(e) => set("partner_first_name", e.target.value)} />
              </div>
              <div className="field">
                <label htmlFor="partner_age">Son âge</label>
                <input id="partner_age" inputMode="numeric" pattern="[0-9]*" value={data.partner_age} onChange={(e) => set("partner_age", e.target.value.replace(/\D/g, "").slice(0, 2))} />
              </div>
              <div className="field">
                <label htmlFor="wedding_date">La date</label>
                <input id="wedding_date" type="date" value={data.wedding_date} disabled={data.date_unknown} onChange={(e) => set("wedding_date", e.target.value)} />
                <label className="toggle">
                  <input type="checkbox" checked={data.date_unknown} onChange={(e) => set("date_unknown", e.target.checked)} />
                  On hésite encore
                </label>
              </div>
              <div className="field">
                <label htmlFor="region">La région de rêve pour votre mariage ?</label>
                <input id="region" placeholder="Provence, Bretagne, Paris…" value={data.region} disabled={data.region_unknown} onChange={(e) => set("region", e.target.value)} />
                <label className="toggle">
                  <input type="checkbox" checked={data.region_unknown} onChange={(e) => set("region_unknown", e.target.checked)} />
                  On hésite encore
                </label>
              </div>
            </div>
          </>
        );

      case 4:
        return (
          <>
            <div className="eyebrow">La fête</div>
            <h1 className="question">Combien de monde ?</h1>
            <p className="help">The more the merrier... comme ils disent.</p>
            <div className="choices">
              {GUESTS.map((o) => (
                <Chip key={o.value} selected={data.guests === o.value} onClick={() => set("guests", o.value)}>
                  {o.label}
                </Chip>
              ))}
            </div>
            <p className="subhead">Sur une journée, ou tout un week-end ?</p>
            <div className="choices">
              {FORMATS.map((o) => (
                <Chip key={o.value} selected={data.format === o.value} onClick={() => set("format", o.value)}>
                  {o.label}
                </Chip>
              ))}
            </div>
          </>
        );

      case 5:
        return (
          <>
            <div className="eyebrow">Le style</div>
            <h1 className="question">Votre mariage, en trois mots.</h1>
            <p className="help">Choisis jusqu'à trois. Ça nous évite de te proposer un château quand tu veux une grange.</p>
            <div className="choices">
              {VIBES.map((v) => (
                <Chip key={v} selected={data.vibes.includes(v)} onClick={() => toggleIn("vibes", v, 3)}>
                  {v}
                </Chip>
              ))}
            </div>
            <div className="field">
              <label htmlFor="pinterest">Un tableau Pinterest, si vous en avez un (facultatif)</label>
              <input id="pinterest" placeholder="https://pinterest.com/…" value={data.pinterest} onChange={(e) => set("pinterest", e.target.value)} inputMode="url" />
            </div>
          </>
        );

      case 6:
        return (
          <>
            <div className="eyebrow">Le budget</div>
            <h1 className="question">Vous aviez quelque chose en tête ?</h1>
            <p className="help">Ça reste entre nous. On s'en sert pour ne jamais te montrer ce que tu ne veux pas payer.</p>
            <div className="choices stack">
              {BUDGETS.map((o) => (
                <Chip key={o.value} selected={data.budget === o.value} onClick={() => set("budget", o.value)}>
                  {o.label}
                </Chip>
              ))}
            </div>
          </>
        );

      case 7:
        return (
          <>
            <div className="eyebrow">Un coup de main ?</div>
            <h1 className="question">Sur quoi on t'aide ?</h1>
            <p className="help">Coche tout ce qui te parle ! On sait tout faire (ou presque).</p>
            <div className="choices stack">
              {HELP.map((o) => (
                <Chip key={o.value} selected={data.help.includes(o.value)} onClick={() => toggleIn("help", o.value)} tag={o.tag} quote={o.quote}>
                  {o.label}
                </Chip>
              ))}
            </div>
          </>
        );

      case 8:
        return (
          <>
            <div className="eyebrow">Dernière étape</div>
            <h1 className="question">Ton tableau de bord est prêt. Il te faut juste un compte.</h1>
            <p className="help">Tout ce que tu viens de nous dire y est déjà. Gratuit, sans engagement.</p>
            <div className="fields">
              <div className="field">
                <label htmlFor="email">Ton email</label>
                <input id="email" type="email" value={data.email} onChange={(e) => set("email", e.target.value)} autoComplete="email" inputMode="email" />
              </div>
              <div className="field">
                <label htmlFor="password">Mot de passe (8 caractères minimum)</label>
                <input id="password" type="password" value={data.password} onChange={(e) => set("password", e.target.value)} autoComplete="new-password" />
              </div>
              <div className="field">
                <label htmlFor="phone">Ton téléphone</label>
                <input id="phone" type="tel" value={data.phone} onChange={(e) => set("phone", e.target.value)} autoComplete="tel" inputMode="tel" placeholder="06 …" />
              </div>
              <div className="field">
                <label htmlFor="partner_email">L'email de {data.partner_first_name.trim() || "ta moitié"}, pour son accès (facultatif)</label>
                <input id="partner_email" type="email" value={data.partner_email} onChange={(e) => set("partner_email", e.target.value)} inputMode="email" />
              </div>
            </div>
            {status === "error" ? <p className="error">{errorMsg}</p> : null}
            <p className="footnote">
              En créant ton compte, tu acceptes nos{" "}
              <a href="https://www.merry.fr/cgu" target="_blank" rel="noreferrer">conditions d'utilisation</a> et notre{" "}
              <a href="https://www.merry.fr/confidentialite" target="_blank" rel="noreferrer">politique de confidentialité</a>. Pas de newsletter, pas de spam.
            </p>
          </>
        );

      default:
        return null;
    }
  }

  /* ------------------------------ rendu ------------------------------- */

  const isLast = step === TOTAL;
  const names = [data.first_name.trim(), data.partner_first_name.trim()].filter(Boolean).join(" et ");
  const finished = status === "done" || status === "confirm";

  return (
    <div className="shell">
      <aside className="panel">
        <a className="panel-logo" href={SITE_URL} aria-label="Merry, retour au site">Merry</a>
        <div className="panel-word" aria-hidden="true">{finished ? "Bienvenue." : PANEL_WORDS[step]}</div>
        <div className="panel-caption" aria-hidden="true">Merry - Experience Crafting Group</div>
      </aside>

      <main className="stage">
        {finished ? (
          <section className="card done" aria-live="polite">
            <div className="check"><Check /></div>
            <h1 className="question">Bienvenue{names ? `, ${names}` : ""}.</h1>
            {status === "confirm" ? (
              <p className="help">
                Un mail vient de partir à {data.email.trim()} : clique sur le lien pour confirmer ton compte, et ton tableau de bord s'ouvre avec tout ce que tu viens de nous dire.
              </p>
            ) : (
              <p className="help">
                Votre tableau de bord est ouvert : le brief, le budget, la liste d'invités et les premiers lieux à comparer vous attendent.
              </p>
            )}
            {status === "done" ? (
              <a className="btn" href={DASHBOARD_URL}>Accéder au dashboard</a>
            ) : null}
            <a className="skip" href={SITE_URL}>Retour au site</a>
          </section>
        ) : (
          <>
            <div className="topbar">
              <button type="button" className="back" onClick={back} disabled={step === 0} aria-label="Question précédente">
                <ArrowLeft />
              </button>
              {step === 0 ? (
                <div style={{ flex: 1 }} />
              ) : (
                <>
                  <div className="progress" role="progressbar" aria-valuemin={1} aria-valuemax={TOTAL} aria-valuenow={step}>
                    <span style={{ width: `${(step / TOTAL) * 100}%` }} />
                  </div>
                  <div className="counter">{step} / {TOTAL}</div>
                </>
              )}
              <a className="close" href={SITE_URL} aria-label="Retour au site Merry" title="Retour au site (tes réponses sont gardées)">
                <CloseIcon />
              </a>
            </div>

            <section className="card" key={step}>
              {renderStep()}
              <div className="actions">
                {step === 5 ? (
                  <button type="button" className="skip" onClick={() => { set("vibes", ["On ne sait pas encore"]); next(); }}>Passer</button>
                ) : step === 8 ? (
                  <a className="skip" href="/connexion">Déjà un compte ? Se connecter</a>
                ) : <span />}
                {isLast ? (
                  <button type="button" className="btn" onClick={submit} disabled={!canContinue || status === "sending"}>
                    {status === "sending" ? "Création…" : "Accéder au dashboard"}
                  </button>
                ) : (
                  <button type="button" className="btn" onClick={next} disabled={!canContinue}>
                    Suivant
                  </button>
                )}
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
