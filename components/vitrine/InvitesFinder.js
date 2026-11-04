"use client";

// Flux « Tu es invité » (canvas « 4 - Invités » : Site-Invites, -Code, -Nom, -Trouve). Un seul
// composant client, pas de sous-routes : « J'ai un code » et « Je cherche par prénoms » mènent à
// un panneau qui remplace la hero, « On a trouvé la fête » ouvre le vrai site (/s/[slug]), et un
// état « on n'a rien trouvé » (absent du canvas) referme la boucle plutôt que de laisser l'invité
// face à un bouton qui ne répond pas.

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { BusyDots } from "@/components/dash/ui";
import { useLang } from "@/lib/lang";
import { INVITES_TEXT } from "@/lib/i18n/vitrine-invites";

function readDemoWedding() {
  try {
    const raw = window.localStorage.getItem("merry-demo-v1");
    const data = raw ? JSON.parse(raw)?.data : null;
    if (!data?.site?.published || !data?.wedding) return null;
    return {
      slug: data.site.slug,
      partner1: data.wedding.partner1,
      partner2: data.wedding.partner2,
      wedding_date: data.wedding.wedding_date,
      venue: data.wedding.venue,
      region: data.wedding.region,
      cover: data.site.content?.photos?.cover || null,
    };
  } catch {
    return null;
  }
}

function matchesDemo(w, { code, name1, name2, date }) {
  if (!w) return null;
  if (code) return w.slug?.toLowerCase() === code.trim().toLowerCase() ? w : null;
  const n1 = name1.trim().toLowerCase();
  const n2 = name2.trim().toLowerCase();
  const p1 = (w.partner1 || "").trim().toLowerCase();
  const p2 = (w.partner2 || "").trim().toLowerCase();
  // Comme la fonction Supabase : un prénom seul ne suffit pas, il faut l'autre prénom ou la date
  if (!n2 && !date) return null;
  const sameTwo = (p1 === n1 && (!n2 || p2 === n2)) || (p2 === n1 && (!n2 || p1 === n2));
  if (!sameTwo) return null;
  if (date && w.wedding_date !== date) return null;
  return w;
}

function formatDate(iso, lang) {
  if (!iso) return null;
  const d = new Date(`${iso}T00:00:00`);
  const s = d.toLocaleDateString(lang === "en" ? "en-US" : "fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default function InvitesFinder() {
  const { lang } = useLang();
  const t = INVITES_TEXT[lang];
  const [view, setView] = useState("home"); // home | code | nom | trouve | non-trouve
  const [code, setCode] = useState("");
  const [name1, setName1] = useState("");
  const [name2, setName2] = useState("");
  const [date, setDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [found, setFound] = useState(null);

  async function search({ byCode }) {
    setBusy(true);
    try {
      const params = byCode
        ? { code: code.trim(), name1: null, name2: null, date: null }
        : { code: null, name1: name1.trim(), name2: name2.trim(), date: date || null };
      let result = null;
      if (supabase) {
        const { data, error } = await supabase.rpc("merry_find_wedding", {
          p_code: params.code,
          p_name1: params.name1,
          p_name2: params.name2,
          p_date: params.date,
        });
        if (error) console.error("[merry] recherche de la fête", error);
        result = data || null;
      } else {
        result = matchesDemo(readDemoWedding(), { code: params.code, name1: params.name1 || "", name2: params.name2 || "", date: params.date });
      }
      setFound(result);
      setView(result ? "trouve" : "non-trouve");
    } finally {
      setBusy(false);
    }
  }

  if (view === "trouve" && found) {
    const names = [found.partner1, found.partner2].filter(Boolean).join(" & ");
    const place = [found.venue, found.region].filter(Boolean).join(", ");
    return (
      <section className="wv-flow" aria-label="Invités">
        <button type="button" className="wv-flow-back" onClick={() => setView("home")}>
          {t.back}
        </button>
        <h1 className="wv-h1">{t.foundTitle}</h1>
        <div className="wv-flow-panel">
          <div className="wv-flow-match">
            {found.cover ? (
              <img src={found.cover} alt="" />
            ) : (
              <span className="wv-flow-match-ph" aria-hidden="true">
                {names
                  .split(/\s*&\s*/)
                  .map((n) => n.trim()[0])
                  .join("")}
              </span>
            )}
            <div>
              <b>{names}</b>
              <p>
                {formatDate(found.wedding_date, lang)}
                {place ? (
                  <>
                    <br />
                    {place}
                  </>
                ) : null}
              </p>
            </div>
          </div>
          <a href={`/s/${found.slug}`} className="wv-btn wv-btn-dark wv-btn-wide">
            {t.openSite}
          </a>
          <p className="wv-flow-or">
            {t.notThem}{" "}
            <button type="button" onClick={() => setView("nom")}>
              {t.searchAgain}
            </button>
          </p>
        </div>
        <ul className="wv-flow-steps">
          <li>
            <b>{t.stepProgram}</b>
            {t.stepProgramDesc}
          </li>
          <li>
            <b>{t.stepRsvp}</b>
            {t.stepRsvpDesc}
          </li>
          <li>
            <b>{t.stepInfo}</b>
            {t.stepInfoDesc}
          </li>
          <li>
            <b>{t.stepGifts}</b>
            {t.stepGiftsDesc}
          </li>
        </ul>
      </section>
    );
  }

  if (view === "non-trouve") {
    return (
      <section className="wv-flow" aria-label="Invités">
        <button type="button" className="wv-flow-back" onClick={() => setView("home")}>
          {t.back}
        </button>
        <h1 className="wv-h1">{t.notFoundTitle}</h1>
        <div className="wv-flow-panel">
          <p className="wv-help">{t.notFoundHelp}</p>
          <button type="button" className="wv-btn wv-btn-dark wv-btn-wide" onClick={() => setView(code ? "code" : "nom")}>
            {t.retry}
          </button>
          <p className="wv-flow-or">
            {code ? (
              <>
                {t.noCode}{" "}
                <button type="button" onClick={() => setView("nom")}>
                  {t.searchByNames}
                </button>
              </>
            ) : (
              <>
                {t.hasCode}{" "}
                <button type="button" onClick={() => setView("code")}>
                  {t.enterHere}
                </button>
              </>
            )}
          </p>
        </div>
      </section>
    );
  }

  if (view === "code") {
    return (
      <section className="wv-flow" aria-label="Invités">
        <button type="button" className="wv-flow-back" onClick={() => setView("home")}>
          {t.back}
        </button>
        <h1 className="wv-h1">{t.codeTitle}</h1>
        <form
          className="wv-flow-panel"
          onSubmit={(e) => {
            e.preventDefault();
            if (code.trim()) search({ byCode: true });
          }}
        >
          <span className="wv-flow-label" id="invite-code-label">
            {t.codeLabel}
          </span>
          <input
            className="wv-flow-field"
            aria-labelledby="invite-code-label"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder={t.codePlaceholder}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
          />
          <button type="submit" className="wv-btn wv-btn-dark wv-btn-wide" disabled={busy || !code.trim()}>
            {busy ? <BusyDots label={t.searching} /> : t.findParty}
          </button>
          <p className="wv-flow-or">
            {t.noCode}{" "}
            <button type="button" onClick={() => setView("nom")}>
              {t.searchByNames}
            </button>
          </p>
        </form>
      </section>
    );
  }

  if (view === "nom") {
    return (
      <section className="wv-flow" aria-label="Invités">
        <button type="button" className="wv-flow-back" onClick={() => setView("home")}>
          {t.back}
        </button>
        <h1 className="wv-h1">{t.namesTitle}</h1>
        <form
          className="wv-flow-panel"
          onSubmit={(e) => {
            e.preventDefault();
            if (name1.trim() && (name2.trim() || date)) search({ byCode: false });
          }}
        >
          <div className="wv-flow-two">
            <label>
              <span className="wv-flow-label">{t.name1Label}</span>
              <input className="wv-flow-field" value={name1} onChange={(e) => setName1(e.target.value)} placeholder={t.name1Placeholder} />
            </label>
            <label>
              <span className="wv-flow-label">{t.name2Label}</span>
              <input className="wv-flow-field" value={name2} onChange={(e) => setName2(e.target.value)} placeholder={t.name2Placeholder} />
            </label>
          </div>
          <label>
            <span className="wv-flow-label">{t.dateLabel}</span>
            <input type="date" className="wv-flow-field" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <button type="submit" className="wv-btn wv-btn-dark wv-btn-wide" disabled={busy || !name1.trim() || (!name2.trim() && !date)}>
            {busy ? <BusyDots label={t.searching} /> : t.findParty}
          </button>
          <p className="wv-flow-or">
            {t.hasCode}{" "}
            <button type="button" onClick={() => setView("code")}>
              {t.enterHere}
            </button>
          </p>
        </form>
      </section>
    );
  }

  return (
    <section className="wv-invites" aria-label="Invités">
      <img src="/vitrine/invites-1.webp" alt="" className="wv-ph wv-ph1" width={1400} height={934} decoding="async" />
      <img src="/vitrine/invites-2.webp" alt="" className="wv-ph wv-ph2" width={1400} height={934} decoding="async" />
      <img src="/vitrine/invites-3.webp" alt="" className="wv-ph wv-ph3" width={1400} height={934} decoding="async" />
      <img src="/vitrine/invites-4.webp" alt="" className="wv-ph wv-ph4" width={1400} height={978} decoding="async" />
      <div className="wv-invites-in">
        <h1 className="wv-h1">{t.homeTitle}</h1>
        <p className="wv-h4">{t.homeSub}</p>
        <div className="wv-btns" style={{ justifyContent: "center", marginTop: 18 }}>
          <button type="button" className="wv-btn wv-btn-dark" onClick={() => setView("code")}>
            {t.hasCodeBtn}
          </button>
          <button type="button" className="wv-btn wv-btn-line" onClick={() => setView("nom")}>
            {t.hasNameBtn}
          </button>
        </div>
        <p className="wv-flow-hint">{t.hint}</p>
      </div>
    </section>
  );
}
