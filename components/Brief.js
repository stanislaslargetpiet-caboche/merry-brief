"use client";

import { useEffect, useMemo, useState } from "react";
import { createAccountAndBrief } from "@/lib/supabase";
import { SITE_URL } from "@/lib/site";
import { useLang } from "@/lib/lang";
import { BRIEF_TEXT } from "@/lib/i18n/brief";
import LangSwitch from "@/components/LangSwitch";

/* ------------------------------------------------------------------ */
/*  Contenu des écrans (source : canvas « Merry · Carte brief »,        */
/*  page Onboarding, validé le 21 oct. 2026). Textes FR/EN : voir       */
/*  lib/i18n/brief.js.                                                  */
/* ------------------------------------------------------------------ */

// 7 questions après le choix de la fête (étape 0, sans compteur).
const TOTAL = 7;
const DASHBOARD_URL = process.env.NEXT_PUBLIC_DASHBOARD_URL || "/dashboard";

const EMPTY = {
  event: "mariage",
  stage: "",
  team: "",
  wedding_date: "",
  date_unknown: false,
  region: "",
  region_unknown: false,
  guests: "",
  format: "",
  vibes: [],
  pinterest: "",
  budget: "",
  first_name: "",
  partner_first_name: "",
  email: "",
  password: "",
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
  const { lang } = useLang();
  const s = BRIEF_TEXT[lang];

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

  const isMail = (str) => /.+@.+\..+/.test(str);

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
        return (
          data.first_name.trim().length > 0 &&
          data.partner_first_name.trim().length > 0 &&
          isMail(data.email) &&
          data.password.length >= 8 &&
          (data.partner_email.trim() === "" || isMail(data.partner_email))
        );
      default:
        return false;
    }
  }, [step, data]);

  const next = () => setStep((st) => Math.min(st + 1, TOTAL));
  const back = () => setStep((st) => Math.max(st - 1, 0));

  async function submit() {
    setStatus("sending");
    setErrorMsg("");
    const brief = {
      stage: data.stage,
      team: data.team,
      wedding_date: data.date_unknown ? null : data.wedding_date || null,
      date_unknown: data.date_unknown,
      region: data.region_unknown ? null : data.region.trim() || null,
      region_unknown: data.region_unknown,
      guests: data.guests,
      format: data.format,
      vibes: data.vibes,
      pinterest: data.pinterest.trim() || null,
      budget: data.budget,
      first_name: data.first_name.trim(),
      partner_first_name: data.partner_first_name.trim(),
      email: data.email.trim().toLowerCase(),
      partner_email: data.partner_email.trim().toLowerCase() || null,
      source: typeof window !== "undefined" ? window.location.search.slice(0, 200) || null : null,
    };
    const res = await createAccountAndBrief({ email: brief.email, password: data.password, brief });
    if (!res.ok) {
      setStatus("error");
      const m = res.error?.message || "";
      setErrorMsg(/already registered|already exists/i.test(m) ? s.errors.alreadyRegistered : s.errors.generic);
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
      case 0: {
        const t = s.steps[0];
        return (
          <>
            <div className="eyebrow">{t.eyebrow}</div>
            <h1 className="question">{t.question}</h1>
            <p className="help">{t.help}</p>
            <div className="choices events">
              {s.events.map((o) =>
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
                    <span className="tag soon-tag">{s.soonTag}</span>
                  </button>
                )
              )}
            </div>
            <p className="note">{t.note}</p>
          </>
        );
      }

      case 1: {
        const t = s.steps[1];
        return (
          <>
            <div className="eyebrow">{t.eyebrow}</div>
            <h1 className="question">{t.question}</h1>
            <p className="help">{t.help}</p>
            <div className="choices stack">
              {s.stages.map((o) => (
                <Chip key={o.value} selected={data.stage === o.value} onClick={() => set("stage", o.value)}>
                  {o.label}
                </Chip>
              ))}
            </div>
          </>
        );
      }

      case 2: {
        const t = s.steps[2];
        return (
          <>
            <div className="eyebrow">{t.eyebrow}</div>
            <h1 className="question">{t.question}</h1>
            <p className="help">{t.help}</p>
            <div className="choices stack">
              {s.teams.map((o) => (
                <Chip key={o.value} selected={data.team === o.value} onClick={() => set("team", o.value)}>
                  {o.label}
                </Chip>
              ))}
            </div>
          </>
        );
      }

      case 3: {
        const t = s.steps[3];
        return (
          <>
            <div className="eyebrow">{t.eyebrow}</div>
            <h1 className="question">{t.question}</h1>
            <p className="help">{t.help}</p>
            <div className="fields">
              <div className="field">
                <label htmlFor="wedding_date">{t.dateLabel}</label>
                <input id="wedding_date" type="date" value={data.wedding_date} disabled={data.date_unknown} onChange={(e) => set("wedding_date", e.target.value)} />
                <label className="toggle">
                  <input type="checkbox" checked={data.date_unknown} onChange={(e) => set("date_unknown", e.target.checked)} />
                  {t.unsureToggle}
                </label>
              </div>
              <div className="field">
                <label htmlFor="region">{t.regionLabel}</label>
                <input id="region" placeholder={t.regionPlaceholder} value={data.region} disabled={data.region_unknown} onChange={(e) => set("region", e.target.value)} />
                <label className="toggle">
                  <input type="checkbox" checked={data.region_unknown} onChange={(e) => set("region_unknown", e.target.checked)} />
                  {t.unsureToggle}
                </label>
              </div>
            </div>
          </>
        );
      }

      case 4: {
        const t = s.steps[4];
        return (
          <>
            <div className="eyebrow">{t.eyebrow}</div>
            <h1 className="question">{t.question}</h1>
            <p className="help">{t.help}</p>
            <div className="choices">
              {s.guests.map((o) => (
                <Chip key={o.value} selected={data.guests === o.value} onClick={() => set("guests", o.value)}>
                  {o.label}
                </Chip>
              ))}
            </div>
            <p className="subhead">{t.subhead}</p>
            <div className="choices">
              {s.formats.map((o) => (
                <Chip key={o.value} selected={data.format === o.value} onClick={() => set("format", o.value)}>
                  {o.label}
                </Chip>
              ))}
            </div>
          </>
        );
      }

      case 5: {
        const t = s.steps[5];
        return (
          <>
            <div className="eyebrow">{t.eyebrow}</div>
            <h1 className="question">{t.question}</h1>
            <p className="help">{t.help}</p>
            <div className="choices">
              {s.vibes.map((v) => (
                <Chip key={v} selected={data.vibes.includes(v)} onClick={() => toggleIn("vibes", v, 3)}>
                  {v}
                </Chip>
              ))}
            </div>
            <div className="field">
              <label htmlFor="pinterest">{t.pinterestLabel}</label>
              <input id="pinterest" placeholder={t.pinterestPlaceholder} value={data.pinterest} onChange={(e) => set("pinterest", e.target.value)} inputMode="url" />
            </div>
          </>
        );
      }

      case 6: {
        const t = s.steps[6];
        return (
          <>
            <div className="eyebrow">{t.eyebrow}</div>
            <h1 className="question">{t.question}</h1>
            <p className="help">{t.help}</p>
            <div className="choices stack">
              {s.budgets.map((o) => (
                <Chip key={o.value} selected={data.budget === o.value} onClick={() => set("budget", o.value)}>
                  {o.label}
                </Chip>
              ))}
            </div>
          </>
        );
      }

      case 7: {
        const t = s.steps[7];
        const partnerName = data.partner_first_name.trim() || t.partnerEmailDefaultName;
        return (
          <>
            <div className="eyebrow">{t.eyebrow}</div>
            <h1 className="question">{t.question}</h1>
            <p className="help">{t.help}</p>
            <div className="fields">
              <div className="field">
                <label htmlFor="first_name">{t.firstNameLabel}</label>
                <input id="first_name" value={data.first_name} onChange={(e) => set("first_name", e.target.value)} autoComplete="given-name" />
              </div>
              <div className="field">
                <label htmlFor="partner_first_name">{t.partnerFirstNameLabel}</label>
                <input id="partner_first_name" value={data.partner_first_name} onChange={(e) => set("partner_first_name", e.target.value)} />
              </div>
              <div className="field">
                <label htmlFor="email">{t.emailLabel}</label>
                <input id="email" type="email" value={data.email} onChange={(e) => set("email", e.target.value)} autoComplete="email" inputMode="email" />
              </div>
              <div className="field">
                <label htmlFor="password">{t.passwordLabel}</label>
                <input id="password" type="password" value={data.password} onChange={(e) => set("password", e.target.value)} autoComplete="new-password" />
              </div>
            </div>
            <div className="field">
              <label htmlFor="partner_email">{t.partnerEmailLabel(partnerName)}</label>
              <input id="partner_email" type="email" value={data.partner_email} onChange={(e) => set("partner_email", e.target.value)} inputMode="email" />
            </div>
            {status === "error" ? <p className="error">{errorMsg}</p> : null}
            <p className="footnote">
              {t.footnoteLead}{" "}
              <a href="https://www.merry.fr/cgu" target="_blank" rel="noreferrer">{t.footnoteTos}</a>{" "}
              {t.footnoteAnd}{" "}
              <a href="https://www.merry.fr/confidentialite" target="_blank" rel="noreferrer">{t.footnotePrivacy}</a>
              {t.footnoteTail}
            </p>
          </>
        );
      }

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
        <LangSwitch />
        <a className="panel-logo" href={SITE_URL} aria-label={s.logoAria}>Merry</a>
        <div className="panel-word" aria-hidden="true">{finished ? s.panelWordDone : s.panelWords[step]}</div>
        <div className="panel-caption" aria-hidden="true">{s.panelCaption}</div>
      </aside>

      <main className="stage">
        {finished ? (
          <section className="card done" aria-live="polite">
            <div className="check"><Check /></div>
            <h1 className="question">{s.done.welcome(names)}</h1>
            {status === "confirm" ? (
              <p className="help">{s.done.confirmMsg(data.email.trim())}</p>
            ) : (
              <p className="help">{s.done.doneMsg}</p>
            )}
            {status === "done" ? (
              <a className="btn" href={DASHBOARD_URL}>{s.done.dashboardBtn}</a>
            ) : null}
            <a className="skip" href={SITE_URL}>{s.done.backToSite}</a>
          </section>
        ) : (
          <>
            <div className="topbar">
              <button type="button" className="back" onClick={back} disabled={step === 0} aria-label={s.backAria}>
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
              <a className="close" href={SITE_URL} aria-label={s.closeAria} title={s.closeTitle}>
                <CloseIcon />
              </a>
            </div>

            <section className="card" key={step}>
              {renderStep()}
              <div className="actions">
                {step === 5 ? (
                  <button type="button" className="skip" onClick={() => { set("vibes", [s.vibes[s.vibes.length - 1]]); next(); }}>{s.skip}</button>
                ) : step === 7 ? (
                  <a className="skip" href="/connexion">{s.loginLink}</a>
                ) : <span />}
                {isLast ? (
                  <button type="button" className="btn" onClick={submit} disabled={!canContinue || status === "sending"}>
                    {status === "sending" ? s.submitting : s.submitDone}
                  </button>
                ) : (
                  <button type="button" className="btn" onClick={next} disabled={!canContinue}>
                    {s.next}
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
