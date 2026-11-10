"use client";

// Corps de la page d'accueil du site vitrine : extrait pour lire la langue (useLang), le
// chargement des chiffres du catalogue (getProof) reste côté serveur dans app/vitrine/page.js.

import Image from "next/image";
import Block from "./Block";
import Carrousel from "./Carrousel";
import { SIGNUP } from "@/lib/vitrine/routes";
import { useLang } from "@/lib/lang";
import { formatProof } from "@/lib/vitrine/proofFormat";
import { ACCUEIL_TEXT, ACCUEIL_STEPS, ACCUEIL_FAQ } from "@/lib/i18n/vitrine-accueil";
import proposition, { en as propositionEn } from "@/lib/vitrine/blocks/proposition";

export default function HomeBody({ links, proof: rawProof }) {
  const { lang } = useLang();
  const t = ACCUEIL_TEXT[lang];
  const proof = formatProof({ count: rawProof.count, at: new Date(rawProof.at) }, lang);

  return (
    <>
      <section className="wv-hero" aria-label="Accueil">
        <div className="wv-hero-in">
          <p className="wv-eyebrow">{t.eyebrow}</p>
          <h1 className="wv-h1">{t.h1}</h1>
          <p className="wv-lead">
            {t.leadPre}
            <b>{t.leadBold}</b>
            {t.leadPost}
          </p>
          <div className="wv-cta">
            <a href={SIGNUP} className="wv-btn wv-btn-dark" data-track="hero_organise">
              {t.organise}
            </a>
            <a href={links.pro} className="wv-textlink" data-track="hero_prestataire">
              {t.proLink}
            </a>
          </div>
          <p className="wv-proof-line">
            {t.proofPre}
            <span className="wv-proof-hl">
              {proof.number} {t.proofPost}
            </span>{" "}
            ({proof.month}).
          </p>
        </div>
        <Block fr={proposition} en={propositionEn} className="wv-hero-media" />
      </section>

      <section className="wv-how" aria-labelledby="wv-how-t">
        <div className="wv-center">
          <h2 id="wv-how-t" className="wv-h3">
            {t.howTitle}
          </h2>
        </div>
        <ol className="wv-how-g">
          {ACCUEIL_STEPS.map(([img, titleFr, textFr, titleEn, textEn], idx) => (
            <li key={img} className="wv-how-card">
              <div className="wv-how-shot">
                <Image
                  src={`/vitrine/etapes/${img}.webp`}
                  alt=""
                  width={1800}
                  height={1013}
                  sizes="(max-width: 760px) 92vw, 30vw"
                  loading={idx === 0 ? "eager" : "lazy"}
                />
              </div>
              <span className="wv-how-n" aria-hidden="true">
                {idx + 1}
              </span>
              <h3>{lang === "en" ? titleEn : titleFr}</h3>
              <p>{lang === "en" ? textEn : textFr}</p>
            </li>
          ))}
        </ol>
        <div className="wv-btns" style={{ justifyContent: "center", marginTop: 40 }}>
          <a href={SIGNUP} className="wv-btn wv-btn-dark" data-track="how_organise">
            {t.organise}
          </a>
        </div>
      </section>

      <section className="wv-sec wv-lime wv-center" aria-label="Fonctionnalités">
        <h2 className="wv-h3" style={{ maxWidth: 900 }}>
          {t.featTitle}
        </h2>
        <Carrousel />
      </section>

      <section className="wv-sec wv-split" aria-label="Modèle">
        <Image src="/vitrine/gratuit.webp" alt="" className="wv-photo" width={1600} height={1061} sizes="(max-width: 760px) 100vw, 46vw" />
        <div className="wv-stack" style={{ gap: 24 }}>
          <h2 className="wv-h3">{t.freeTitle}</h2>
          <p className="wv-p">{t.freeBody}</p>
          <div className="wv-btns">
            <a href={SIGNUP} className="wv-btn wv-btn-dark" data-track="gratuit_organise">
              {t.organise}
            </a>
            <a href={links.pro} className="wv-btn wv-btn-line" data-track="gratuit_modele">
              {t.model}
            </a>
          </div>
        </div>
      </section>

      <section className="wv-sec wv-faq" aria-labelledby="wv-faq">
        <div>
          <h2 id="wv-faq" className="wv-h3">
            {t.faqTitle}
          </h2>
          <div className="wv-acc">
            {ACCUEIL_FAQ.map(([qFr, aFr, qEn, aEn], idx) => (
              <details key={qFr} open={idx === 0}>
                <summary>{lang === "en" ? qEn : qFr}</summary>
                <p>{lang === "en" ? aEn : aFr}</p>
              </details>
            ))}
          </div>
        </div>
        <Image src="/vitrine/faq.webp" alt="" className="wv-photo" style={{ minHeight: 640 }} width={1400} height={1953} sizes="(max-width: 760px) 0px, 34vw" />
      </section>

      <section className="wv-guest" aria-label="Invités">
        <div className="wv-marquee" aria-hidden="true">
          {Array.from({ length: 6 }, (_, idx) => (
            <span key={idx}>{t.guestLabel}</span>
          ))}
        </div>
        <p>{t.guestBody}</p>
        <a href={links.guests} className="wv-btn wv-btn-lime" data-track="invite">
          {t.guestCta}
        </a>
      </section>
    </>
  );
}
