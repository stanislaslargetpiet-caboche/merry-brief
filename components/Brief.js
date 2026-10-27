"use client";

import { useEffect, useMemo, useState } from "react";
import { createAccountAndBrief } from "@/lib/supabase";
import { SITE_URL } from "@/lib/site";
import { useLang } from "@/lib/lang";
import { BRIEF_TEXT, VIBE_UNSURE } from "@/lib/i18n/brief";
import LangSwitch from "@/components/LangSwitch";
import { trackEvent } from "@/lib/analytics";

/* ------------------------------------------------------------------ */
/*  Onboarding V2 (source : canvas « Merry · Carte brief », page        */
/*  « Onboarding & connexion v2 », validé le 27 oct. 2026).             */
/*  4 étapes : la fête, l'équipe, l'essentiel, le compte.               */
/*  Textes FR/EN : voir lib/i18n/brief.js.                              */
/* ------------------------------------------------------------------ */

const TOTAL = 4;
const DASHBOARD_URL = process.env.NEXT_PUBLIC_DASHBOARD_URL || "/dashboard";

// Un nom stable par écran (indépendant de la langue affichée), pour que le
// funnel PostHog ("onboarding_step_viewed") reste lisible : à quelle étape
// les couples s'arrêtent.
const STEP_KEYS = ["fete", "equipe", "essentiel", "compte"];

// Bornes des jauges : la valeur maximale vaut « et plus ».
const GUESTS = { max: 300, step: 10 };
const BUDGET = { max: 100000, step: 1000 };
const MAX_VIBES = 3;

const EMPTY = {
  event: "mariage",
  team: "",
  stage: "",
  region: "",
  region_unknown: false,
  date_mode: "flexible",
  wedding_date: "",
  flex_months: [],
  guests_min: 80,
  guests_max: 120,
  budget_min: 20000,
  budget_max: 40000,
  budget_unknown: false,
  vibes: [],
  first_name: "",
  partner_first_name: "",
  email: "",
  password: "",
};

const STORAGE_KEY = "merry-brief-draft-v3";
const PENDING_KEY = "merry-brief-pending";

// Les 12 prochains mois, à partir du mois suivant : « 2027-06 »
function nextMonths() {
  const now = new Date();
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() + 1 + i, 1);
    return { key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, month: d.getMonth(), year: d.getFullYear() };
  });
}

// Tranches lues par le tableau de bord (lib/dash/criteria.js) : on garde la plus proche du milieu de la fourchette.
function guestsCode(min, max) {
  const mid = (min + max) / 2;
  if (mid < 50) return "<50";
  if (mid < 100) return "50-100";
  if (mid < 150) return "100-150";
  if (mid <= 200) return "150-200";
  return ">200";
}

function budgetCode(min, max, unknown) {
  if (unknown) return "aucune_idee";
  const mid = (min + max) / 2;
  if (mid < 15000) return "<15k";
  if (mid < 30000) return "15-30k";
  if (mid <= 50000) return "30-50k";
  return ">50k";
}

/* ------------------------------------------------------------------ */
/*  Petits composants                                                  */
/* ------------------------------------------------------------------ */

function Chip({ selected, onClick, dashed, children }) {
  return (
    <button type="button" className={"ob-chip" + (dashed ? " dashed" : "")} aria-pressed={selected} onClick={onClick}>
      {children}
    </button>
  );
}

function ArrowLeft() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M15 5l-7 7 7 7" />
    </svg>
  );
}

function Check({ size = 26 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12.5l4.5 4.5L19 7" />
    </svg>
  );
}

function Heart() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 21s-7-4.35-9.5-8.5C.8 9 2.2 5.5 5.5 5c2-.3 3.8.7 4.8 2.3L12 9l1.7-1.7C14.7 5.7 16.5 4.7 18.5 5c3.3.5 4.7 4 3 7.5C19 16.65 12 21 12 21z" />
    </svg>
  );
}

// Fêtes à venir : fond pastel très clair, icône de la même teinte (canvas, 27 oct.)
const SOON_LOOK = [
  { bg: "#f4f9fd", ink: "#a9c2d8", path: <><path d="M8 3h8l-1 7a3 3 0 0 1-6 0L8 3z" /><path d="M12 13v5M9 21h6" /></> },
  { bg: "#fdf9ee", ink: "#d8c184", path: <><path d="M4 11h16v8a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-8z" /><path d="M3 8h18v3H3zM12 8V4M9 5c0-1.5 1-2 3-3 0 1-1 2 0 3M15 5c0-1.5-1-2-3-3" /></> },
  { bg: "#fdf6f7", ink: "#d8a9ad", path: <><path d="M12 4L3 20h18L12 4z" /><path d="M12 10l5 10M12 4v16" /></> },
  { bg: "#f4faf5", ink: "#a0c9a8", path: <><rect x="3" y="8" width="18" height="12" rx="2" /><path d="M9 8V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 13h18" /></> },
  { bg: "#fdf8f3", ink: "#d8b48e", path: <path d="M12 3l2.1 5.6 6 .3-4.6 3.8 1.6 5.8L12 15.6 6.9 18.5l1.6-5.8-4.6-3.8 6-.3L12 3z" /> },
];

// Jauge à deux poignées (minimum et maximum)
function RangeSlider({ min, max, step, low, high, onChange, lowAria, highAria, disabled }) {
  const pct = (v) => (v / max) * 100;
  return (
    <div className={"ob-range" + (disabled ? " off" : "")}>
      <span className="ob-range-track" />
      <span className="ob-range-fill" style={{ left: `${pct(low)}%`, width: `${pct(high) - pct(low)}%` }} />
      <input
        type="range" min={min} max={max} step={step} value={low} aria-label={lowAria} disabled={disabled}
        onChange={(e) => onChange(Math.min(Number(e.target.value), high - step), high)}
      />
      <input
        type="range" min={min} max={max} step={step} value={high} aria-label={highAria} disabled={disabled}
        onChange={(e) => onChange(low, Math.max(Number(e.target.value), low + step))}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Le flow                                                            */
/* ------------------------------------------------------------------ */

export default function Brief() {
  const { lang } = useLang();
  const s = BRIEF_TEXT[lang];
  const months = useMemo(nextMonths, []);

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
          setStep(Math.min(saved.step || 0, TOTAL - 1));
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

  // Un événement par écran vu : permet de construire l'entonnoir d'onboarding
  // dans PostHog et de voir précisément à quelle étape les couples abandonnent.
  useEffect(() => {
    if (status === "done" || status === "confirm") return;
    trackEvent("onboarding_step_viewed", { step, step_key: STEP_KEYS[step] || String(step) });
  }, [step, status]);

  const set = (key, value) => setData((d) => ({ ...d, [key]: value }));
  const toggleIn = (key, value, max) =>
    setData((d) => {
      const list = d[key].includes(value) ? d[key].filter((v) => v !== value) : [...d[key], value];
      return { ...d, [key]: max ? list.slice(-max) : list };
    });

  // « On ne sait pas » exclut les autres ambiances, et inversement.
  const toggleVibe = (value) =>
    setData((d) => {
      if (value === VIBE_UNSURE) return { ...d, vibes: d.vibes.includes(VIBE_UNSURE) ? [] : [VIBE_UNSURE] };
      const rest = d.vibes.filter((v) => v !== VIBE_UNSURE);
      const list = rest.includes(value) ? rest.filter((v) => v !== value) : [...rest, value];
      return { ...d, vibes: list.slice(-MAX_VIBES) };
    });

  const isMail = (str) => /.+@.+\..+/.test(str);

  const canContinue = useMemo(() => {
    switch (step) {
      case 0:
        return data.event === "mariage";
      case 1:
        return !!data.team && !!data.stage;
      case 2:
        return (
          (data.region_unknown || data.region.trim().length > 0) &&
          (data.date_mode === "precise" ? !!data.wedding_date : data.flex_months.length > 0) &&
          data.vibes.length > 0
        );
      case 3:
        return (
          data.first_name.trim().length > 0 &&
          data.partner_first_name.trim().length > 0 &&
          isMail(data.email) &&
          data.password.length >= 8
        );
      default:
        return false;
    }
  }, [step, data]);

  const next = () => setStep((st) => Math.min(st + 1, TOTAL - 1));
  const back = () => setStep((st) => Math.max(st - 1, 0));

  async function submit() {
    setStatus("sending");
    setErrorMsg("");
    const flexible = data.date_mode === "flexible";
    const brief = {
      stage: data.stage,
      team: data.team,
      region: data.region_unknown ? null : data.region.trim() || null,
      region_unknown: data.region_unknown,
      date_mode: data.date_mode,
      wedding_date: flexible ? null : data.wedding_date || null,
      date_unknown: flexible,
      flex_months: flexible ? [...data.flex_months].sort() : [],
      guests_min: data.guests_min,
      guests_max: data.guests_max,
      guests: guestsCode(data.guests_min, data.guests_max),
      budget_min: data.budget_unknown ? null : data.budget_min,
      budget_max: data.budget_unknown ? null : data.budget_max,
      budget: budgetCode(data.budget_min, data.budget_max, data.budget_unknown),
      vibes: data.vibes,
      first_name: data.first_name.trim(),
      partner_first_name: data.partner_first_name.trim(),
      email: data.email.trim().toLowerCase(),
      source: typeof window !== "undefined" ? window.location.search.slice(0, 200) || null : null,
    };
    const res = await createAccountAndBrief({ email: brief.email, password: data.password, brief });
    if (!res.ok) {
      setStatus("error");
      const m = res.error?.message || "";
      setErrorMsg(/already registered|already exists/i.test(m) ? s.errors.alreadyRegistered : s.errors.generic);
      trackEvent("onboarding_signup_failed", { stage: res.stage || null });
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
    trackEvent("onboarding_completed", { needs_email_confirmation: !!res.needsEmailConfirmation });
    setStatus(res.needsEmailConfirmation ? "confirm" : "done");
  }

  /* ------------------------------ écrans ------------------------------ */

  function renderStep() {
    switch (step) {
      case 0:
        return (
          <>
            <button type="button" className="ob-event" aria-pressed={data.event === "mariage"} onClick={() => set("event", "mariage")}>
              <span className="ob-event-icon"><Heart /></span>
              <span className="ob-event-name">{s.wedding}</span>
              <Check />
            </button>
            <div className="ob-soon">
              <span className="ob-marker">{s.soon}</span>
              <div className="ob-soon-grid">
                {s.soonEvents.map((name, i) => (
                  <span key={name} className="ob-soon-item" style={{ background: SOON_LOOK[i].bg }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={SOON_LOOK[i].ink} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      {SOON_LOOK[i].path}
                    </svg>
                    {name}
                  </span>
                ))}
              </div>
            </div>
          </>
        );

      case 1: {
        const t = s.steps[1];
        return (
          <>
            <div className="ob-group">
              <h2 className="ob-title">{t.teamQuestion}</h2>
              <div className="ob-chips">
                {s.teams.map((o) => (
                  <Chip key={o.value} selected={data.team === o.value} onClick={() => set("team", o.value)}>{o.label}</Chip>
                ))}
              </div>
            </div>
            <div className="ob-group">
              <h2 className="ob-title">{t.stageQuestion}</h2>
              <div className="ob-chips">
                {s.stages.map((o) => (
                  <Chip key={o.value} selected={data.stage === o.value} onClick={() => set("stage", o.value)}>{o.label}</Chip>
                ))}
              </div>
            </div>
          </>
        );
      }

      case 2: {
        const t = s.steps[2];
        const guestsMaxLabel = data.guests_max >= GUESTS.max ? `${GUESTS.max}+` : data.guests_max;
        const budgetMaxLabel = s.euros(data.budget_max) + (data.budget_max >= BUDGET.max ? "+" : "");
        return (
          <div className="ob-box">
            <div className="ob-row">
              <h2 className="ob-title">{t.where}</h2>
              <div className="ob-inline">
                <input
                  className="ob-input" value={data.region} placeholder={t.wherePlaceholder} aria-label={t.where}
                  disabled={data.region_unknown} onChange={(e) => set("region", e.target.value)}
                />
                <button type="button" className="ob-link" aria-pressed={data.region_unknown} onClick={() => set("region_unknown", !data.region_unknown)}>
                  {s.unsure}
                </button>
              </div>
            </div>

            <div className="ob-row">
              <div className="ob-row-head">
                <h2 className="ob-title">{t.when}</h2>
                <div className="ob-toggle" role="group" aria-label={t.when}>
                  <button type="button" aria-pressed={data.date_mode === "precise"} onClick={() => set("date_mode", "precise")}>{t.precise}</button>
                  <button type="button" aria-pressed={data.date_mode === "flexible"} onClick={() => set("date_mode", "flexible")}>{t.flexible}</button>
                </div>
              </div>
              {data.date_mode === "precise" ? (
                <input className="ob-input" type="date" aria-label={t.precise} value={data.wedding_date} onChange={(e) => set("wedding_date", e.target.value)} />
              ) : (
                <>
                  <p className="ob-help">{t.monthsHelp}</p>
                  <div className="ob-months">
                    {months.map((m) => (
                      <button key={m.key} type="button" className="ob-month" aria-pressed={data.flex_months.includes(m.key)} onClick={() => toggleIn("flex_months", m.key)}>
                        <span>{s.monthShort[m.month]}</span>
                        <span className="ob-month-year">{m.year}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div className="ob-row">
              <div className="ob-slider-row">
                <h2 className="ob-title">{t.guests}</h2>
                <span className="ob-scale">0</span>
                <RangeSlider
                  min={0} max={GUESTS.max} step={GUESTS.step} low={data.guests_min} high={data.guests_max}
                  lowAria={t.guestsMinAria} highAria={t.guestsMaxAria}
                  onChange={(lo, hi) => setData((d) => ({ ...d, guests_min: lo, guests_max: hi }))}
                />
                <span className="ob-scale">{GUESTS.max}+</span>
                <span className="ob-value">{t.guestsRange(data.guests_min, guestsMaxLabel)}</span>
              </div>
            </div>

            <div className="ob-row">
              <div className="ob-slider-row">
                <h2 className="ob-title">{t.budget}</h2>
                <span className="ob-scale">{s.euros(0)}</span>
                <RangeSlider
                  min={0} max={BUDGET.max} step={BUDGET.step} low={data.budget_min} high={data.budget_max}
                  lowAria={t.budgetMinAria} highAria={t.budgetMaxAria} disabled={data.budget_unknown}
                  onChange={(lo, hi) => setData((d) => ({ ...d, budget_min: lo, budget_max: hi }))}
                />
                <span className="ob-scale">{s.euros(BUDGET.max)}+</span>
                <span className="ob-value">{data.budget_unknown ? t.budgetTbd : t.guestsRange(s.euros(data.budget_min), budgetMaxLabel)}</span>
              </div>
              <button type="button" className="ob-link" aria-pressed={data.budget_unknown} onClick={() => set("budget_unknown", !data.budget_unknown)}>
                {data.budget_unknown ? t.budgetKnown : t.budgetUnsure}
              </button>
            </div>

            <div className="ob-row">
              <h2 className="ob-title">{t.vibes}</h2>
              <div className="ob-chips small">
                {s.vibes.map((o) => (
                  <Chip key={o.value} selected={data.vibes.includes(o.value)} dashed={o.value === VIBE_UNSURE} onClick={() => toggleVibe(o.value)}>
                    {o.label}
                  </Chip>
                ))}
              </div>
            </div>
          </div>
        );
      }

      case 3: {
        const t = s.steps[3];
        return (
          <>
            <h2 className="ob-title">{t.title}</h2>
            <div className="ob-form">
              <div className="ob-pair">
                <div className="ob-field">
                  <label htmlFor="first_name">{t.firstNameLabel}</label>
                  <input id="first_name" className="ob-input" value={data.first_name} onChange={(e) => set("first_name", e.target.value)} autoComplete="given-name" />
                </div>
                <div className="ob-field">
                  <label htmlFor="partner_first_name">{t.partnerFirstNameLabel}</label>
                  <input id="partner_first_name" className="ob-input" value={data.partner_first_name} onChange={(e) => set("partner_first_name", e.target.value)} />
                </div>
              </div>
              <div className="ob-field">
                <label htmlFor="email">{t.emailLabel}</label>
                <input id="email" className="ob-input" type="email" value={data.email} onChange={(e) => set("email", e.target.value)} autoComplete="email" inputMode="email" />
              </div>
              <div className="ob-field">
                <label htmlFor="password">{t.passwordLabel}</label>
                <input id="password" className="ob-input" type="password" placeholder={t.passwordPlaceholder} value={data.password} onChange={(e) => set("password", e.target.value)} autoComplete="new-password" />
              </div>
              {status === "error" ? <p className="ob-error">{errorMsg}</p> : null}
              <p className="ob-footnote">
                {t.footnoteLead}{" "}
                <a href="https://www.withmerry.com/cgu" target="_blank" rel="noreferrer">{t.footnoteTos}</a>{" "}
                {t.footnoteAnd}{" "}
                <a href="https://www.withmerry.com/confidentialite" target="_blank" rel="noreferrer">{t.footnotePrivacy}</a>
                {t.footnoteTail}
              </p>
              <a className="ob-link ob-login-mobile" href="/connexion">{t.loginLink}</a>
            </div>
          </>
        );
      }

      default:
        return null;
    }
  }

  /* ------------------------------ rendu ------------------------------- */

  const isLast = step === TOTAL - 1;
  const names = [data.first_name.trim(), data.partner_first_name.trim()].filter(Boolean).join(lang === "fr" ? " et " : " and ");
  const finished = status === "done" || status === "confirm";
  const n = step + 1;

  return (
    <div className="ob">
      <header className="ob-header">
        <a className="ob-logo" href={SITE_URL} aria-label={s.logoAria}>Merry</a>
        <div className="ob-header-right">
          <LangSwitch />
          {finished ? null : <a className="ob-quit" href={SITE_URL} title={s.quitTitle}>{s.quit}</a>}
        </div>
      </header>

      {finished ? (
        <main className="ob-main ob-done" aria-live="polite">
          <div className="ob-done-glow" aria-hidden="true" />
          <div className="ob-done-check"><Check size={30} /></div>
          <h1 className="ob-done-title">{s.done.welcome(names)}</h1>
          <p className="ob-done-text">{status === "confirm" ? s.done.confirmMsg(data.email.trim()) : s.done.doneMsg}</p>
          {status === "done" ? <a className="ob-btn" href={DASHBOARD_URL}>{s.done.dashboardBtn}</a> : null}
          <a className="ob-link" href={SITE_URL}>{s.done.backToSite}</a>
        </main>
      ) : (
        <main className={"ob-main" + (step === 2 ? " wide" : step === 3 ? " narrow" : "")} key={step}>
          <div className="ob-top">
            <div className="ob-tagline">
              {step > 0 ? (
                <button type="button" className="ob-back" onClick={back} aria-label={s.backAria}><ArrowLeft /></button>
              ) : null}
              <span className="ob-tag">{s.steps[step].tag}</span>
            </div>
            <div className="ob-progress" role="progressbar" aria-valuemin={1} aria-valuemax={TOTAL} aria-valuenow={n} aria-label={s.progressAria(n, TOTAL)}>
              <div className="ob-progress-bar"><span style={{ width: `${(n / TOTAL) * 100}%` }} /></div>
              <span className="ob-progress-count">{n}/{TOTAL}</span>
            </div>
          </div>

          {renderStep()}

          <div className="ob-actions">
            {step > 0 ? (
              <button type="button" className="ob-back ob-back-mobile" onClick={back} aria-label={s.backAria}><ArrowLeft /></button>
            ) : null}
            {isLast ? (
              <>
                <a className="ob-link ob-login" href="/connexion">{s.steps[3].loginLink}</a>
                <button type="button" className="ob-btn accent" onClick={submit} disabled={!canContinue || status === "sending"}>
                  {status === "sending" ? s.submitting : s.submitDone}
                </button>
              </>
            ) : (
              <button type="button" className="ob-btn" onClick={next} disabled={!canContinue}>{s.next}</button>
            )}
          </div>
        </main>
      )}
    </div>
  );
}
