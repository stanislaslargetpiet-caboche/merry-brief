"use client";

// Corps de la page Prestataires du site vitrine : extrait pour lire la langue (useLang), le
// chargement des chiffres du catalogue (getProof) reste côté serveur dans app/vitrine/partenaires/page.js.

import { Block } from "./Frame";
import { DEMO, PRO, PRO_LOGIN } from "@/lib/vitrine/routes";
import { useLang } from "@/lib/lang";
import { formatProof } from "@/lib/vitrine/proof";
import { PARTENAIRES_TEXT, PARTENAIRES_COMPARATIF, PARTENAIRES_FAQ } from "@/lib/i18n/vitrine-partenaires";
import avantApres, { en as avantApresEn } from "@/lib/vitrine/blocks/pro-avant-apres";
import criteres, { en as criteresEn } from "@/lib/vitrine/blocks/pro-criteres";
import credits, { en as creditsEn } from "@/lib/vitrine/blocks/pro-credits";
import fiche, { en as ficheEn } from "@/lib/vitrine/blocks/pro-fiche";

// Planche « Site-Prestataires » du canvas « 9 - Site vitrine » (30 oct. 2026)
// Le nom tapé ici arrive dans la recherche de « Retrouvez votre établissement » (/pro?etablissement=…)
const FICHE = PRO;

const Cta = ({ children }) => (
  <a href={PRO} className="wv-btn wv-btn-dark">
    {children}
  </a>
);

export default function PartenairesBody({ proof: rawProof }) {
  const { lang } = useLang();
  const t = PARTENAIRES_TEXT[lang];
  const proof = formatProof({ count: rawProof.count, at: new Date(rawProof.at) }, lang);

  return (
    <>
      <section className="wv-sec wv-center" aria-label="Prestataires" style={{ gap: 28 }}>
        <h1 className="wv-h1" style={{ maxWidth: 1100 }}>
          {t.h1}
        </h1>
        <form className="wv-find" action={FICHE} method="get">
          <label className="wv-find-in">
            <span className="wv-sr">{t.fieldSr}</span>
            <input type="search" name="etablissement" placeholder={t.fieldPlaceholder} autoComplete="organization" />
          </label>
          <button type="submit" className="wv-btn wv-btn-dark">
            {t.findCta}
          </button>
        </form>
        <p className="wv-find-note">
          {t.findNotePre}
          <span className="wv-proof-hl">
            {proof.number} {t.findNoteMid}
          </span>
          {t.findNotePost} ({proof.month}){t.findNoteEnd}
        </p>
        <div className="wv-btns" style={{ justifyContent: "center" }}>
          <a href={PRO_LOGIN} className="wv-btn wv-btn-line">
            {t.alreadyIn}
          </a>
        </div>
        <Block fr={avantApres} en={avantApresEn} className="wv-media wv-media-wide" />
        <p className="wv-lead" style={{ maxWidth: 620 }}>
          {t.notYet}
        </p>
        <div className="wv-btns" style={{ justifyContent: "center" }}>
          <a href={PRO} className="wv-btn wv-btn-dark">
            {t.completeCta}
          </a>
          <a href={DEMO} className="wv-btn wv-btn-line">
            {t.demoCta}
          </a>
        </div>
      </section>

      <section className="wv-sec wv-lime wv-credits" aria-label="Les crédits">
        <div className="wv-stack">
          <h2 className="wv-h3">{t.creditsTitle}</h2>
          <p className="wv-lead">{t.creditsLead1}</p>
          <p className="wv-lead">{t.creditsLead2}</p>
        </div>
        <Block fr={credits} en={creditsEn} className="wv-media" />
      </section>

      <section className="wv-sec wv-cmp-sec" aria-labelledby="wv-cmp-t">
        <h2 id="wv-cmp-t" className="wv-h3">
          {t.cmpTitle}
        </h2>
        <div className="wv-cmp" role="table">
          <div className="wv-cmp-row wv-cmp-head" role="row">
            <span role="columnheader">
              <span className="wv-sr">{t.cmpCriteria}</span>
            </span>
            <span role="columnheader">{t.cmpPaid}</span>
            <span role="columnheader">{t.cmpMerry}</span>
          </div>
          {PARTENAIRES_COMPARATIF.map(([kFr, aFr, bFr, kEn, aEn, bEn]) => (
            <div key={kFr} className="wv-cmp-row" role="row">
              <span role="rowheader">{lang === "en" ? kEn : kFr}</span>
              <span role="cell">{lang === "en" ? aEn : aFr}</span>
              <span role="cell">{lang === "en" ? bEn : bFr}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="wv-sec wv-black wv-split wv-split-big" aria-label="Les demandes">
        <Block fr={criteres} en={criteresEn} className="wv-media" />
        <div className="wv-stack">
          <h2 className="wv-h3">{t.reqTitle}</h2>
          <div className="wv-steps">
            <p>{t.reqStep1}</p>
            <p>{t.reqStep2}</p>
            <p>{t.reqStep3}</p>
          </div>
          <div className="wv-btns">
            <Cta>{t.completeCta}</Cta>
          </div>
        </div>
      </section>

      <section className="wv-sec wv-lime wv-guar" aria-label="Garantie Merry">
        <p className="wv-guar-k">{t.guarKicker}</p>
        <h2 className="wv-h3">{t.guarTitle}</h2>
        <p className="wv-lead">{t.guarLead}</p>
      </section>

      <section className="wv-sec wv-split wv-split-big" aria-label="Votre fiche">
        <Block fr={fiche} en={ficheEn} className="wv-media" />
        <div className="wv-stack">
          <h2 className="wv-h3">{t.ficheTitle}</h2>
          <p className="wv-lead">{t.ficheLead}</p>
          <div className="wv-btns">
            <Cta>{t.completeCta}</Cta>
          </div>
        </div>
      </section>

      <section className="wv-sec wv-lime wv-two" aria-labelledby="wv-faq-pro">
        <h2 id="wv-faq-pro" className="wv-h3">
          {t.faqTitle}
        </h2>
        <div className="wv-acc wv-acc-small">
          {PARTENAIRES_FAQ.map(([qFr, aFr, qEn, aEn], idx) => (
            <details key={qFr} open={idx === 0}>
              <summary>{lang === "en" ? qEn : qFr}</summary>
              <p>{lang === "en" ? aEn : aFr}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="wv-sec wv-black wv-end" aria-label="Commencer">
        <ul>
          <li>{t.end1}</li>
          <li>{t.end2}</li>
          <li>{t.end3}</li>
        </ul>
        <div className="wv-stack">
          <h2 className="wv-h3">{t.endTitle}</h2>
          <div className="wv-btns">
            <a href={FICHE} className="wv-btn wv-btn-lime">
              {t.endClaim}
            </a>
            <a href={DEMO} className="wv-btn wv-btn-line">
              {t.demoCta}
            </a>
          </div>
          <p className="wv-lead">{t.endOffer}</p>
        </div>
      </section>
    </>
  );
}
