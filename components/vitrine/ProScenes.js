"use client";

// Les quatre blocs animés de la page Prestataires, sur la grammaire du carrousel de l'accueil (components/vitrine/
// Carrousel.js : mêmes pièces, mêmes styles `cr-`, même rythme de 5 s par scène). Chaque bloc enchaîne ses scènes
// seul, sous une barre de segments et un bouton pause ; la lecture ne tourne que bloc à l'écran. Textes :
// lib/i18n/vitrine-pro-scenes.js ; styles propres : app/vitrine/pro-scenes.css. Planches : Site-Pro-* du canvas.

import { useEffect, useRef, useState } from "react";
import { useLang } from "@/lib/lang";
import { CARROUSEL, COUPLE_PHOTO, FACES, VENUES } from "@/lib/i18n/vitrine-carrousel";
import { PRO_SCENES } from "@/lib/i18n/vitrine-pro-scenes";
import { Icon, Swap, Head, Pill, Photo, rise } from "./Carrousel";

const SCENE_SECONDS = 5;
const OLIVIERS = VENUES.oliviers.img;

const LOCK = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6b6a63" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="5" y="11" width="14" height="9" rx="2" />
    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
  </svg>
);
const SEARCH = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1c1c1a" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
    <circle cx="11" cy="11" r="6.5" />
    <path d="M16 16l4.5 4.5" />
  </svg>
);
const SMALL_CHECK = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </svg>
);
const BRIEF_ICONS = ["date", "lieu", "invites", "budget"];

// Le contact du couple, masqué tant que le prestataire n'a pas répondu
function Masked({ t, className = "" }) {
  return (
    <div className={`pc-masked ${className}`}>
      <span className="cr-tile">{LOCK}</span>
      <span className="cr-grow">
        <span className="cr-cap">{t.contact}</span>
        <span className="pc-mask">
          <b style={{ width: "68%" }} />
          <b style={{ width: "46%" }} />
        </span>
      </span>
    </div>
  );
}

// Les deux boutons de réponse
function Actions({ t, delay }) {
  return (
    <span className="pc-actions cr-rise" style={rise(delay)}>
      <span className="cr-btn cr-btn-primary">{t.reply}</span>
      <span className="cr-btn cr-btn-line">{t.skip}</span>
    </span>
  );
}

function Who({ t, sub }) {
  return (
    <span className="pc-who">
      <Photo src={COUPLE_PHOTO} className="cr-face cr-face-lg" label={t.couple} />
      <span className="cr-grow">
        <span className="cr-name cr-top-t">{t.couple}</span>
        <span className="cr-cap">{sub}</span>
      </span>
    </span>
  );
}

/* ---- Bloc 1 : avant (haut de la page) ---- */

function Avant({ t }) {
  const a = t.avant;
  return (
    <>
      <Head title={a.title}>
        <Swap from={<Pill kind="off">{a.before}</Pill>} to={<Pill kind="ok">{a.after}</Pill>} delay={1.6} />
      </Head>
      <div className="pc-two pc-avant">
        <div className="cr-card pc-col pc-before">
          <span className="cr-lab">{a.before}</span>
          {a.vague.map((line, i) => (
            <div key={line} className="pc-vague cr-rise" style={rise(0.2 + i * 0.35)}>
              <i>?</i>
              {line}
            </div>
          ))}
          <span className="cr-cap pc-foot cr-rise" style={rise(1.2)}>
            {a.vagueCap}
          </span>
        </div>
        <div className="cr-card pc-col pc-after cr-rise" style={rise(1.6)}>
          <Who t={t} sub={a.received} />
          <div className="cr-rows">
            {a.rows.map(([cap, value], i) => (
              <div key={cap} className="cr-row">
                <span className="cr-tile">
                  <Icon name={BRIEF_ICONS[i]} />
                </span>
                <span className="cr-grow">
                  <span className="cr-cap">{cap}</span>
                  <span className="cr-name">{value}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

function Match({ t }) {
  const m = t.match;
  return (
    <>
      <Head title={m.title}>
        <span className="cr-rise" style={rise(2.8)}>
          <Pill kind="ok">{m.score}</Pill>
        </span>
      </Head>
      <div className="pc-two pc-match">
        <div className="cr-card pc-col">
          <span className="pc-venue">
            <Photo src={OLIVIERS} className="cr-vt" label={t.venue} />
            <span className="cr-grow">
              <span className="cr-name cr-top-t">{t.venue}</span>
              <span className="cr-cap">{m.venueCap}</span>
            </span>
          </span>
          <div className="cr-rows pc-crit">
            {m.criteria.map((c, i) => (
              <div key={c} className="cr-row">
                <span className="pc-chk cr-pop" style={rise(0.4 + i * 0.45)}>
                  {SMALL_CHECK}
                </span>
                <span className="cr-grow pc-crit-t">{c}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="cr-card pc-col cr-rise" style={rise(0.2)}>
          <span className="cr-top">
            <span className="cr-lab">{m.request}</span>
            <span className="cr-tag">{m.new}</span>
          </span>
          <Who t={t} sub={t.avant.received} />
          <Masked t={t} className="pc-hide-sm" />
          <Actions t={t} delay={2.6} />
          <span className="cr-cap">{t.freeToSee}</span>
        </div>
      </div>
    </>
  );
}

/* ---- Bloc 2 : crédits ---- */

function Offered({ t }) {
  const o = t.offered;
  return (
    <>
      <Head title={o.title} />
      <div className="cr-stats pc-hero cr-rise" style={rise(0.2)}>
        <b className="pc-big">100</b>
        <span className="cr-name">{o.of}</span>
        <span className="cr-cap">{o.cap}</span>
        <span className="cr-track pc-wide-track">
          <b className="cr-fill" style={{ width: "100%", "--d": "0.5s" }} />
        </span>
      </div>
      <div className="cr-card cr-rows pc-grow">
        {o.rows.map(([label, value], i) => (
          <div key={label} className="cr-row cr-rise" style={rise(1.2 + i * 0.4)}>
            <span className="cr-grow cr-name">{label}</span>
            {i === 2 ? <Pill kind="ok">{value}</Pill> : <span className="cr-pill cr-off">{value}</span>}
          </div>
        ))}
      </div>
    </>
  );
}

function Trades({ t }) {
  const o = t.trades;
  return (
    <>
      <Head title={o.title} />
      <span className="cr-cap pc-sub">{o.cap}</span>
      <div className="cr-card cr-rows pc-grow pc-trades">
        {o.list.map(([name, n], i) => (
          <div key={name} className="cr-row cr-rise" style={rise(0.3 + i * 0.35)}>
            <span className="cr-grow cr-name">{name}</span>
            <span className={`cr-tag${i === 0 ? " cr-tag-full" : ""}`}>{t.credits(n)}</span>
          </div>
        ))}
      </div>
      <span className="cr-cap cr-rise" style={rise(2.2)}>
        {o.foot}
      </span>
    </>
  );
}

function Guarantee({ t }) {
  const g = t.guarantee;
  return (
    <>
      <Head title={g.title}>
        <span className="cr-rise" style={rise(0.2)}>
          <Pill kind="ok">{g.status}</Pill>
        </span>
      </Head>
      <div className="cr-card pc-col cr-rise" style={rise(0.2)}>
        <span className="cr-name cr-top-t">{g.question}</span>
        <span className="cr-cap">{g.answer}</span>
      </div>
      <div className="cr-card cr-rows pc-grow">
        {g.rows.map(([label, value], i) => (
          <div key={label} className="cr-row cr-rise" style={rise(0.8 + i * 0.4)}>
            <span className="cr-grow cr-name">{label}</span>
            <b className="cr-amount">{value}</b>
          </div>
        ))}
        <div className="cr-row cr-new cr-rise" style={rise(2.4)}>
          <span className="cr-grow cr-name">{g.back}</span>
          <b className="cr-amount cr-pop" style={rise(2.6)}>
            {g.backValue}
          </b>
        </div>
      </div>
    </>
  );
}

/* ---- Bloc 3 : « Tu vois tout avant de répondre » ---- */

function Inbox({ t }) {
  const b = t.inbox;
  return (
    <>
      <Head title={b.title}>
        <span className="cr-pill cr-off">{b.count}</span>
      </Head>
      <div className="cr-card cr-rows pc-grow">
        {b.rows.map(([face, name, cap, tag], i) => (
          <div key={name} className={`cr-row cr-rise${i === 0 ? " cr-new" : ""}`} style={rise(0.3 + i * 0.7)}>
            <Photo src={face ? FACES[face] : COUPLE_PHOTO} className="cr-face" />
            <span className="cr-grow">
              <span className="cr-name">{name}</span>
              <span className="cr-cap">{cap}</span>
            </span>
            {i === 0 ? <span className="cr-tag cr-tag-full cr-pop" style={rise(1)}>{tag}</span> : <span className="cr-pill cr-off">{tag}</span>}
          </div>
        ))}
      </div>
      <span className="cr-cap cr-rise" style={rise(2.2)}>
        {b.foot}
      </span>
    </>
  );
}

function Read({ t }) {
  const r = t.read;
  return (
    <>
      <Head title={r.title} />
      <div className="cr-card pc-col cr-rise" style={rise(0.2)}>
        <span className="cr-top">
          <Who t={t} sub={r.request} />
          <Pill kind="ok">{r.score}</Pill>
        </span>
        <div className="cr-rows">
          {r.rows.map(([cap, value], i) => (
            <div key={cap} className="cr-row cr-rise" style={rise(0.6 + i * 0.3)}>
              <span className="cr-cap pc-key">{cap}</span>
              <span className="cr-grow cr-name">{value}</span>
            </div>
          ))}
        </div>
      </div>
      <Masked t={t} className="cr-card" />
      <Actions t={t} delay={2} />
      <span className="cr-cap">{t.freeToSee}</span>
    </>
  );
}

function Answer({ t }) {
  const a = t.answer;
  return (
    <>
      <Head title={a.title}>
        <span className="cr-pop" style={rise(2.6)}>
          <Pill kind="ok">{a.sent}</Pill>
        </span>
      </Head>
      <div className="cr-stats cr-stats-3">
        {a.stats.map(([value, label], i) => (
          <span key={label} className="cr-stat cr-rise" style={rise(0.2 + i * 0.4)}>
            <b>{value}</b>
            <span>{label}</span>
          </span>
        ))}
      </div>
      <div className="cr-card pc-col cr-rise" style={rise(1.4)}>
        <span className="cr-top">
          <span className="cr-cap">{a.to}</span>
          <Pill kind="ok">{a.unlocked}</Pill>
        </span>
        <span className="pc-message">{a.message}</span>
        <span className="cr-chip cr-chip-s pc-file">{a.file}</span>
      </div>
      <span className="cr-cap cr-rise" style={rise(2.8)}>
        {a.foot}
      </span>
    </>
  );
}

/* ---- Bloc 4 : « Ta fiche » ---- */

function Find({ t }) {
  const f = t.find;
  return (
    <>
      <Head title={f.title} />
      <span className="pc-search">
        {SEARCH}
        <span>
          {t.venue}
          <span className="cr-caret" aria-hidden="true" />
        </span>
      </span>
      <div className="cr-card pc-col cr-rise" style={rise(1.2)}>
        <span className="pc-venue">
          <Photo src={OLIVIERS} className="cr-vt" label={t.venue} />
          <span className="cr-grow">
            <span className="cr-name cr-top-t">{t.venue}</span>
            <span className="cr-cap">{f.venueCap}</span>
          </span>
        </span>
        <span className="cr-btn cr-btn-primary pc-me cr-pop" style={rise(2.2)}>
          {f.me}
        </span>
      </div>
      <span className="cr-cap cr-rise" style={rise(0.4)}>
        {f.foot}
      </span>
    </>
  );
}

function Complete({ t }) {
  const c = t.complete;
  return (
    <>
      <Head title={c.title}>
        <Swap from={<Pill kind="off">{c.before}</Pill>} to={<Pill kind="ok">{c.after}</Pill>} delay={2.4} />
      </Head>
      <div className="pc-strip">
        {[VENUES.oliviers.img, VENUES.source.img, VENUES.clair.img].map((src, i) => (
          <Photo key={src} src={src} className="pc-strip-ph cr-rise" style={rise(0.2 + i * 0.3)} label={c.photos[i]} />
        ))}
      </div>
      <div className="cr-card pc-col">
        <div className="cr-rows">
          <div className="cr-row cr-rise" style={rise(1)}>
            <span className="cr-tile">
              <Icon name="budget" />
            </span>
            <span className="cr-grow">
              <span className="cr-cap">{c.from}</span>
              <span className="cr-name">{c.price}</span>
            </span>
          </div>
          <div className="cr-row cr-rise" style={rise(1.4)}>
            <span className="cr-tile">
              <Icon name="invites" />
            </span>
            <span className="cr-grow">
              <span className="cr-cap">{c.capacity}</span>
              <span className="cr-name">{c.capacityValue}</span>
            </span>
          </div>
        </div>
        <span className="cr-chips">
          {c.chips.map((chip, i) => (
            <span key={chip} className="cr-chip cr-chip-s cr-pop" style={rise(1.8 + i * 0.25)}>
              {chip}
            </span>
          ))}
        </span>
      </div>
      <span className="cr-track">
        <b className="cr-fill" style={{ width: "100%", "--d": "0.8s", animationDuration: "1.6s" }} />
      </span>
    </>
  );
}

function Live({ t }) {
  const l = t.live;
  return (
    <>
      <Head title={l.title}>
        <span className="cr-pop" style={rise(0.3)}>
          <Pill kind="ok">{l.status}</Pill>
        </span>
      </Head>
      <div className="pc-vc cr-rise" style={rise(0.2)}>
        <Photo src={OLIVIERS} className="pc-vc-photo" label={t.venue} />
        <span className="pc-vc-body">
          <span className="cr-name cr-top-t">{t.venue}</span>
          <span className="cr-area">
            <span>{l.area}</span>
          </span>
          <span className="pc-vc-price">
            {l.from} <b>{l.price}</b>
          </span>
        </span>
      </div>
      <div className="cr-card pc-line cr-rise" style={rise(1.6)}>
        <Photo src={COUPLE_PHOTO} className="cr-face" />
        <span className="cr-grow">
          <span className="cr-name">{t.couple}</span>
          <span className="cr-cap">{l.match}</span>
        </span>
        <span className="cr-tag cr-tag-full cr-pop" style={rise(2.2)}>
          {l.new}
        </span>
      </div>
      <span className="cr-cap cr-rise" style={rise(2.8)}>
        {l.foot}
      </span>
    </>
  );
}

// kind : « wide » (haut de la page, 1 040 px) ou « half » (une colonne) ; bg : fond de la scène, « grey » sur une section blanche
const BLOCKS = {
  avant: { scenes: [Avant, Match], kind: "wide", bg: "grey" },
  credits: { scenes: [Offered, Trades, Guarantee], kind: "half", bg: "white" },
  demande: { scenes: [Inbox, Read, Answer], kind: "half", bg: "white" },
  fiche: { scenes: [Find, Complete, Live], kind: "half", bg: "grey" },
};

export default function ProScenes({ block, className = "" }) {
  const { lang } = useLang();
  const t = PRO_SCENES[lang] ?? PRO_SCENES.fr;
  const ui = CARROUSEL[lang] ?? CARROUSEL.fr;
  const { scenes, kind, bg } = BLOCKS[block];
  const [scene, setScene] = useState(0);
  // Tour de lecture : relance la progression quand on revient sur une scène choisie à la main
  const [round, setRound] = useState(0);
  const [paused, setPaused] = useState(false);
  const [visible, setVisible] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    // Mouvement réduit : pas de lecture automatique, chaque scène s'affiche dans son état final (pro-scenes.css)
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) setPaused(true);
    // La lecture ne tourne que si le bloc est à l'écran : le visiteur qui y arrive commence à la première scène
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return undefined;
    }
    const io = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: 0.35 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const pick = (i) => {
    setScene(i);
    setRound((r) => r + 1);
  };
  const next = () => pick((scene + 1) % scenes.length);

  const Scene = scenes[scene];
  return (
    <div ref={ref} className={`cr pc pc-${kind} pc-${bg} pc-b-${block}${paused || !visible ? " is-paused" : ""} ${className}`}>
      <div className="cr-stage pc-stage" role="group" aria-label={t.scene(scene + 1)}>
        <div key={`${round}-${scene}`} className="cr-scene">
          <Scene t={t} />
        </div>
        <span key={`minuteur-${round}-${scene}`} className="cr-timer" style={{ animationDuration: `${SCENE_SECONDS}s` }} aria-hidden="true" onAnimationEnd={next} />
      </div>
      <div className="pc-ctl">
        <div className="pc-dots">
          {scenes.map((_, i) => (
            <button key={i} type="button" className={`pc-dot${i === scene ? " is-on" : ""}${i < scene ? " is-done" : ""}`} aria-label={t.scene(i + 1)} aria-current={i === scene} onClick={() => pick(i)}>
              <span aria-hidden="true">{i === scene && <b key={round} style={{ animationDuration: `${SCENE_SECONDS}s` }} />}</span>
            </button>
          ))}
        </div>
        <button type="button" className="cr-pause" aria-label={paused ? ui.play : ui.pause} aria-pressed={paused} onClick={() => setPaused((p) => !p)}>
          {paused ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="#1c1c1a" aria-hidden="true">
              <path d="M8 5.5v13l11-6.5z" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="#1c1c1a" aria-hidden="true">
              <rect x="6" y="5" width="4" height="14" rx="1" />
              <rect x="14" y="5" width="4" height="14" rx="1" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}
