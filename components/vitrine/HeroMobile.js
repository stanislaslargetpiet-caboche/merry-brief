"use client";

// Visuel d'accueil pour téléphone : la tuile Merry entourée des cartes du brief (lieu, date,
// invités, budget, style) et de trois photos, en tailles fixes lisibles. Sur ordinateur, la scène
// animée du bloc « proposition » (en cqw) s'en charge ; ici, tout est masqué au-dessus de 760 px.

import { useLang } from "@/lib/lang";

const STROKE = { fill: "none", stroke: "#1c1c1a", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" };

const ICONS = {
  lieu: (
    <>
      <path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z" />
      <circle cx="12" cy="9.5" r="2.5" />
    </>
  ),
  date: (
    <>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
    </>
  ),
  invites: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M2.5 19c.7-3 2.9-4.7 5.6-4.7s4.9 1.7 5.6 4.7" />
      <circle cx="17" cy="9" r="2.2" />
      <path d="M16 14.6c2.2.2 3.9 1.7 4.5 4.6" />
    </>
  ),
  budget: (
    <>
      <path d="M17.5 6.5A7 7 0 1 0 17.5 17.5" />
      <path d="M4 10.5h9M4 13.5h9" />
    </>
  ),
  style: (
    <>
      <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" />
      <path d="M19 16l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z" />
    </>
  ),
};

const TEXT = {
  fr: {
    aria: "Aperçu du brief : lieu, date, invités, budget et style",
    cards: [
      ["lieu", "LIEU", "Provence"],
      ["date", "DATE", "19 juin 2027"],
      ["invites", "INVITÉS", "120"],
      ["budget", "BUDGET", "35 000 €"],
      ["style", "STYLE", "Champêtre chic"],
    ],
  },
  en: {
    aria: "Preview of the brief: venue, date, guests, budget and style",
    cards: [
      ["lieu", "VENUE", "Provence"],
      ["date", "DATE", "19 June 2027"],
      ["invites", "GUESTS", "120"],
      ["budget", "BUDGET", "€35,000"],
      ["style", "STYLE", "Chic countryside"],
    ],
  },
};

const PHOTOS = ["proposition-2", "proposition-3", "proposition-1"];

export default function HeroMobile() {
  const { lang } = useLang();
  const t = TEXT[lang] || TEXT.fr;
  return (
    <div className="wv-hm" role="img" aria-label={t.aria}>
      <div className="wv-hm-mid" aria-hidden="true">
        {PHOTOS.map((p, i) => (
          <span key={p} className={`wv-hm-ph wv-hm-ph${i + 1}`} style={{ backgroundImage: `url(/vitrine/blocks/${p}.webp)` }} />
        ))}
        <span className="wv-hm-tile">Merry</span>
      </div>
      {t.cards.map(([icon, label, value], i) => (
        <div key={icon} className={`wv-hm-c wv-hm-c${i + 1}`} aria-hidden="true">
          <span className="wv-hm-ic">
            <svg width="22" height="22" viewBox="0 0 24 24" {...STROKE}>
              {ICONS[icon]}
            </svg>
          </span>
          <span className="wv-hm-tx">
            <span className="wv-hm-k">{label}</span>
            <span className="wv-hm-v">{value}</span>
          </span>
        </div>
      ))}
    </div>
  );
}
