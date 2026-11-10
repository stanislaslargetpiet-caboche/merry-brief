"use client";

// Section « Comment ça marche » de l'accueil (D-228 : fusion des trois étapes et du carrousel ; scènes refaites le
// 10 nov. 2026 d'après les planches Site-Brief-1 à 6 du canvas : brief, plan, matchs, devis, invités, à plusieurs).
// Trois onglets d'étape, chacun avec sa phrase et deux scènes de 5 s. Chaque scène arrive par morceaux (délai --d) puis
// reste en place ; l'onglet actif porte la progression de toute l'étape et passe seul au suivant. Sur téléphone, les onglets deviennent trois segments de progression. Le
// rythme est tenu par l'animation CSS d'un minuteur invisible (sa fin = scène suivante) : la pause fige donc d'un coup
// le minuteur, la progression et le détail animé. Textes : lib/i18n/vitrine-carrousel.js ; styles :
// app/vitrine/carrousel.css.

import { useEffect, useRef, useState } from "react";
import { useLang } from "@/lib/lang";
import { CARROUSEL, COUPLE_PHOTO, FACES, MOODS, VENUE_COUNT } from "@/lib/i18n/vitrine-carrousel";

const TRACK = ["mariage", "prestataires", "reste"];

const CHECK = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </svg>
);
const HEART_PATH = "M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.1a4.3 4.3 0 0 1 7.5 2.7C19.5 15.4 12 20 12 20z";
const STROKE = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" };

// Icônes du système (pleines pistache, trait encre) : lieu, date, invités, budget, ambiance
const ICONS = {
  lieu: (
    <>
      <path d="M12 21s-7-5.5-7-11a7 7 0 1 1 14 0c0 5.5-7 11-7 11z" fill="#bfe9a6" stroke="#1c1c1a" strokeWidth="1.5" strokeLinejoin="round" />
      <circle cx="12" cy="10" r="2.4" fill="#ffffff" stroke="#1c1c1a" strokeWidth="1.3" />
    </>
  ),
  date: (
    <>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2" fill="#bfe9a6" stroke="#1c1c1a" strokeWidth="1.5" />
      <path d="M8 3v4M16 3v4M3.5 10h17" stroke="#1c1c1a" strokeWidth="1.5" strokeLinecap="round" />
    </>
  ),
  invites: (
    <>
      <path d="M16 14.6c2.6.2 4.6 2 5.3 5.4H13c0-2.3.9-4.3 3-5.4z" fill="#e6f7dc" stroke="#1c1c1a" strokeWidth="1.3" strokeLinejoin="round" />
      <circle cx="17" cy="9" r="2.5" fill="#e6f7dc" stroke="#1c1c1a" strokeWidth="1.3" />
      <path d="M2.5 20c.8-3.5 3.4-5.5 6.5-5.5s5.7 2 6.5 5.5z" fill="#bfe9a6" stroke="#1c1c1a" strokeWidth="1.5" strokeLinejoin="round" />
      <circle cx="9" cy="8" r="3.5" fill="#bfe9a6" stroke="#1c1c1a" strokeWidth="1.5" />
    </>
  ),
  budget: (
    <>
      <rect x="3" y="6" width="18" height="13" rx="2" fill="#bfe9a6" stroke="#1c1c1a" strokeWidth="1.5" />
      <path d="M3 10h18" stroke="#1c1c1a" strokeWidth="1.5" />
      <path d="M16.5 14.5h1.5" stroke="#1c1c1a" strokeWidth="1.8" strokeLinecap="round" />
    </>
  ),
  ambiance: <path d="M12 3l2.2 5.6L20 9.5l-4.4 3.9 1.3 5.8L12 16.2l-4.9 3 1.3-5.8L4 9.5l5.8-.9z" fill="#bfe9a6" stroke="#1c1c1a" strokeWidth="1.5" strokeLinejoin="round" />,
};
const BRIEF_ICONS = ["lieu", "date", "invites", "budget", "ambiance"];

function Icon({ name }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
      {ICONS[name]}
    </svg>
  );
}

// Un état qui en remplace un autre à `delay` secondes du début de la scène (les deux occupent la même case : pas de saut)
function Swap({ from, to, delay = 1.5, className = "" }) {
  return (
    <span className={`cr-swap ${className}`} style={{ "--d": `${delay}s` }}>
      <span className="cr-from">{from}</span>
      <span className="cr-to">{to}</span>
    </span>
  );
}

function Head({ title, children }) {
  return (
    <div className="cr-head">
      <h3 className="cr-t">{title}</h3>
      {children}
    </div>
  );
}

function Pill({ kind, children }) {
  return (
    <span className={`cr-pill cr-${kind}`}>
      {kind === "ok" && CHECK}
      {children}
    </span>
  );
}

function Photo({ src, className = "", label, style }) {
  return (
    <span
      className={`cr-ph ${className}`}
      style={{ backgroundImage: `url(${src})`, ...style }}
      {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })}
    />
  );
}

// Une carte avec son titre et sa pastille de statut (scène « Ton plan »)
function Top({ title, status }) {
  return (
    <span className="cr-top">
      <span className="cr-name cr-top-t">{title}</span>
      <Pill kind="ok">{status}</Pill>
    </span>
  );
}

const rise = (d) => ({ "--d": `${d}s` });

/* ---- 1 Ton brief ---- */

function Brief({ t }) {
  const b = t.briefScene;
  return (
    <>
      <Head title={b.title}>
        <Swap className="cr-pill cr-off" from={b.before} to={b.after} delay={1.6} />
      </Head>
      <div className="cr-brief">
        <div className="cr-card cr-brief-card">
          <span className="cr-who-row">
            <Photo src={COUPLE_PHOTO} className="cr-face cr-face-lg" />
            <span className="cr-grow">
              <span className="cr-name cr-top-t">{b.couple}</span>
              <span className="cr-cap">{b.wedding}</span>
            </span>
          </span>
          <div className="cr-rows">
            {b.rows.map(([question, answer], i) => (
              <div key={question} className={`cr-row cr-rise${i === 4 ? " cr-brief-now" : ""}`} style={rise(0.2 + i * 0.3)}>
                <span className="cr-tile">
                  <Icon name={BRIEF_ICONS[i]} />
                </span>
                <span className="cr-grow">
                  <span className="cr-cap">{question}</span>
                  <span className="cr-name">
                    {answer}
                    {i === 4 && <span className="cr-caret" aria-hidden="true" />}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="cr-mood">
          <span className="cr-mood-h">
            <span className="cr-name cr-top-t">{b.mood}</span>
            <span className="cr-cap">{b.moodCount}</span>
          </span>
          <div className="cr-mood-grid">
            {b.moods.map((label, i) => (
              <span key={label} className={`cr-mood-ph cr-ph${i < 3 ? " cr-ring" : ""}`} style={{ backgroundImage: `url(${MOODS[i]})`, "--d": `${2 + i * 0.5}s` }} role="img" aria-label={label}>
                {i < 3 ? (
                  <span className="cr-mood-ck cr-pop" style={rise(2 + i * 0.5)}>
                    {CHECK}
                  </span>
                ) : (
                  <span className="cr-mood-ck is-off" />
                )}
                <span className="cr-mood-lab">{label}</span>
              </span>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

// Anneau du budget : un arc par poste, dans les verts du système, le reste du budget en gris
const RING = ["#1c1c1a", "#2f5a1a", "#5f9e3f", "#8fcc6c", "#bfe9a6", "#e6f7dc"];
const R = 78;
const C = 2 * Math.PI * R;

function Ring({ rows, total, label, cap }) {
  let offset = 0;
  return (
    <span className="cr-ring-wrap">
      <svg width="184" height="184" viewBox="0 0 184 184" aria-hidden="true">
        <circle cx="92" cy="92" r={R} fill="none" stroke="#f6f5f1" strokeWidth="22" />
        {rows.map(([poste, , amount], i) => {
          const len = (amount / total) * C;
          const arc = (
            <circle
              key={poste}
              className="cr-arc"
              cx="92"
              cy="92"
              r={R}
              fill="none"
              stroke={RING[i]}
              strokeWidth="22"
              strokeDasharray={`${len - 3} ${C - len + 3}`}
              strokeDashoffset={-offset}
              transform="rotate(-90 92 92)"
              style={rise(0.9 + i * 0.15)}
            />
          );
          offset += len;
          return arc;
        })}
      </svg>
      <span className="cr-ring-mid">
        <b>{label}</b>
        <span className="cr-cap">{cap}</span>
      </span>
    </span>
  );
}

function Plan({ t }) {
  const p = t.plan;
  return (
    <>
      <Head title={p.title}>
        <span className="cr-chips">
          {t.brief.map((b, i) => (
            <span key={b} className="cr-chip cr-chip-s">
              <Icon name={BRIEF_ICONS[i]} />
              {b}
            </span>
          ))}
        </span>
      </Head>
      <div className="cr-plan3">
        <div className="cr-card cr-col cr-rise" style={rise(0.2)}>
          <Top title={p.timeline} status={p.ready} />
          <div className="cr-steps">
            {p.steps.map(([when, what], i) => (
              <div key={when} className={`cr-step cr-rise${i === 4 ? " is-day" : ""}`} style={rise(0.5 + i * 0.25)}>
                <span className={`cr-dot${i === 0 ? " is-now" : i === 4 ? " is-past" : ""}`} />
                <span className="cr-step-when">{when}</span>
                <span className="cr-step-what">{what}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="cr-card cr-col cr-rise" style={rise(0.6)}>
          <Top title={p.budget} status={p.split} />
          <Ring rows={p.rows} total={35000} label={p.total} cap={p.posts} />
          <div className="cr-rows cr-legend">
            {p.rows.slice(0, 3).map(([poste, amount], i) => (
              <div key={poste} className="cr-row">
                <span className="cr-sw" style={{ background: RING[i] }} />
                <span className="cr-grow">{poste}</span>
                <b className="cr-amount">{amount}</b>
              </div>
            ))}
          </div>
          <span className="cr-cap">{p.more}</span>
        </div>
        <div className="cr-card cr-col cr-rise" style={rise(1)}>
          <Top title={p.venues} status={p.found} />
          <span className="cr-count">
            <b>{VENUE_COUNT}</b>
            <span className="cr-cap">{p.count}</span>
          </span>
          <div className="cr-rows">
            {p.list.map((v, i) => (
              <div key={v.name} className="cr-row cr-rise" style={rise(1.8 + i * 0.3)}>
                <Photo src={v.img} className="cr-vt" />
                <span className="cr-grow">
                  <span className="cr-name">{v.name}</span>
                  <span className="cr-cap">{v.area}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

/* ---- 2 Prestataires ---- */

function Matches({ t }) {
  const m = t.matches;
  return (
    <>
      <Head title={m.title}>
        <span className="cr-chips cr-cats">
          {m.cats.map((c, i) => (
            <span key={c} className={`cr-chip${i === 0 ? " is-on" : ""}`}>
              {c}
              {i === 0 && <b>{VENUE_COUNT}</b>}
            </span>
          ))}
        </span>
      </Head>
      <div className="cr-venues">
        {m.cards.map((c, i) => (
          <article key={c.name} className="cr-match">
            <span className="cr-match-photo" style={{ backgroundImage: `url(${c.img})` }}>
              <span className="cr-vc-heart">
                <Swap
                  delay={2.6 + i * 0.2}
                  from={<svg width="20" height="20" viewBox="0 0 24 24" {...STROKE} aria-hidden="true"><path d={HEART_PATH} /></svg>}
                  to={<svg width="20" height="20" viewBox="0 0 24 24" {...STROKE} fill="#1c1c1a" aria-hidden="true"><path d={HEART_PATH} /></svg>}
                />
              </span>
              <span className="cr-match-tags">
                {[c.seats, m.budget, m.style].map((tag, j) => (
                  <span key={tag} className="cr-match-tag cr-pop" style={rise(0.4 + i * 0.25 + j * 0.45)}>
                    {CHECK}
                    {tag}
                  </span>
                ))}
              </span>
            </span>
            <span className="cr-match-body">
              <span className="cr-grow">
                <span className="cr-name">{c.name}</span>
                <span className="cr-area">
                  <span>{c.area}</span>
                </span>
              </span>
              <span className="cr-match-price">
                {m.from}
                <b>{c.price}</b>
              </span>
            </span>
          </article>
        ))}
      </div>
      <div className="cr-selbar cr-rise" style={rise(3.4)}>
        <span className="cr-stack">
          {m.cards.map((c) => (
            <Photo key={c.name} src={c.img} className="cr-thumb" />
          ))}
        </span>
        <span className="cr-grow">
          <span className="cr-name">{m.selCount}</span>
          <span className="cr-cap">{m.selLabel}</span>
        </span>
        <span className="cr-btn cr-btn-primary">{m.selCta}</span>
      </div>
    </>
  );
}

function Quotes({ t }) {
  const q = t.quotes;
  return (
    <>
      <Head title={q.title}>
        <span className="cr-rise" style={rise(2)}>
          <Pill kind="ok">{q.replies}</Pill>
        </span>
      </Head>
      <div className="cr-devis">
        <div className="cr-card cr-col cr-ask">
          <span className="cr-top">
            <span className="cr-name cr-top-t">{q.request}</span>
            <span className="cr-stack">
              {q.cards.map((c) => (
                <Photo key={c.name} src={c.img} className="cr-thumb" />
              ))}
            </span>
          </span>
          <div className="cr-letter">
            {q.lines.map((l) => (
              <p key={l}>{l}</p>
            ))}
          </div>
          <Pill kind="ok">{q.sent}</Pill>
        </div>
        <div className="cr-replies">
          {q.cards.map((c, i) => (
            <div key={c.name} className={`cr-reply cr-rise${c.best ? " is-best" : ""}${c.free ? "" : " is-full"}`} style={rise(0.4 + i * 0.5)}>
              <Photo src={c.img} className="cr-reply-ph" />
              <span className="cr-grow cr-reply-mid">
                <span className="cr-name cr-top-t">{c.name}</span>
                <span className="cr-cap">{c.area}</span>
                <span className="cr-reply-tags">
                  {c.free ? <Pill kind="ok">{q.free}</Pill> : <Pill kind="off">{q.full}</Pill>}
                  {c.best && (
                    <span className="cr-tag cr-tag-full cr-pop" style={rise(2.4)}>
                      {q.best}
                    </span>
                  )}
                </span>
              </span>
              <span className="cr-reply-side">
                <b className="cr-reply-price">{c.price}</b>
                {c.free && <span className={`cr-btn ${c.best ? "cr-btn-primary" : "cr-btn-line"}`}>{c.best ? q.choose : q.see}</span>}
              </span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

/* ---- 3 Tout le reste ---- */

function Guests({ t }) {
  const g = t.guests;
  return (
    <>
      <Head title={g.title}>
        <span className="cr-stack cr-faces">
          {g.rows.map(([face, name]) => (
            <Photo key={name} src={FACES[face]} className="cr-face" />
          ))}
        </span>
      </Head>
      <div className="cr-guests2">
        <div className="cr-couple cr-form">
          <Photo src={COUPLE_PHOTO} className="cr-form-cover" label={g.photo} />
          <div className="cr-form-in">
            <span className="cr-serif cr-form-names">{g.couple}</span>
            <span className="cr-couple-cap">{g.when}</span>
            <span className="cr-form-q">{g.question}</span>
            <span className="cr-form-opts">
              <Swap className="cr-copt-swap" delay={1.2} from={<span className="cr-copt">{g.yes}</span>} to={<span className="cr-copt is-on">{g.yes}</span>} />
              <span className="cr-copt">{g.no}</span>
            </span>
            <span className="cr-cfield">{g.note}</span>
          </div>
        </div>
        <div className="cr-guests-right">
          <span className="cr-gcount">
            <Swap from={<b>{g.before}</b>} to={<b>{g.after}</b>} delay={2} />
            <span className="cr-grow">
              <span className="cr-name">{g.of}</span>
              <span className="cr-track">
                <b className="cr-fill" style={{ width: "72.5%", "--d": "2s" }} />
              </span>
            </span>
          </span>
          <div className="cr-card cr-feed">
            <span className="cr-lab">{g.latest}</span>
            <div className="cr-rows">
              {g.rows.map(([face, name, answer, when], i) => (
                <div key={name} className={`cr-row${i === 0 ? " cr-new cr-rise" : ""}`} style={i === 0 ? rise(2) : undefined}>
                  <Photo src={FACES[face]} className="cr-face" />
                  <span className="cr-grow">
                    <span className="cr-name">{name}</span>
                    <span className="cr-cap">{answer}</span>
                  </span>
                  <span className="cr-cap">{when}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function Team({ t }) {
  const k = t.team;
  return (
    <>
      <Head title={k.title}>
        <span className="cr-team-head">
          <span className="cr-stack cr-faces">
            <Photo src={COUPLE_PHOTO} className="cr-face" />
            {["parentsAlice", "parentsBen", "lea", "hugo"].map((f) => (
              <Photo key={f} src={FACES[f]} className="cr-face" />
            ))}
          </span>
          <span className="cr-btn cr-btn-line">{k.invite}</span>
        </span>
      </Head>
      <div className="cr-team">
        <div className="cr-card cr-feed">
          <span className="cr-lab">{k.week}</span>
          <div className="cr-rows">
            {k.rows.map(([face, who, what, when], i) => (
              <div key={who + what} className="cr-row cr-rise" style={rise(0.4 + i * 0.6)}>
                <Photo src={FACES[face]} className="cr-face" />
                <span className="cr-grow">
                  <span className="cr-name">{who}</span>
                  <span className="cr-team-what">{what}</span>
                </span>
                <span className="cr-cap">{when}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="cr-team-side">
          <span className="cr-ph cr-team-site" style={{ backgroundImage: `url(${COUPLE_PHOTO})` }} role="img" aria-label={k.photo}>
            <span className="cr-team-site-in">
              <span className="cr-grow">
                <span className="cr-name">{k.site}</span>
                <span className="cr-cap">{k.siteCap}</span>
              </span>
              <Pill kind="ok">{k.online}</Pill>
            </span>
          </span>
          <div className="cr-stats cr-stats-3 cr-team-stats">
            {k.stats.map(([value, label]) => (
              <span key={label} className="cr-stat">
                <b>{value}</b>
                <span>{label}</span>
              </span>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

const SCENES = [
  [Brief, Plan],
  [Matches, Quotes],
  [Guests, Team],
];
const SCENE_SECONDS = 5;

export default function Carrousel() {
  const { lang } = useLang();
  const t = CARROUSEL[lang] ?? CARROUSEL.fr;
  const [tab, setTab] = useState(0);
  const [scene, setScene] = useState(0);
  // Tour de lecture : relance la progression de l'onglet quand on y entre, même en recliquant le même onglet
  const [round, setRound] = useState(0);
  const [paused, setPaused] = useState(false);
  const [visible, setVisible] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    // Mouvement réduit : pas de lecture automatique, chaque scène s'affiche dans son état final (carrousel.css)
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) setPaused(true);
    // La lecture ne tourne que si le carrousel est à l'écran : le visiteur qui y arrive commence à la première scène
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
    setTab(i);
    setScene(0);
    setRound((r) => r + 1);
  };
  const next = () => {
    if (scene < SCENES[tab].length - 1) setScene(scene + 1);
    else pick((tab + 1) % SCENES.length);
  };

  const Scene = SCENES[tab][scene];
  const step = t.steps[tab];
  return (
    <div ref={ref} className={`cr${paused || !visible ? " is-paused" : ""}`}>
      <div className="cr-bar">
        <div className="cr-tabs" role="tablist" aria-label={t.tabsLabel}>
          {t.steps.map((st, i) => (
            <button
              key={st.tab}
              type="button"
              role="tab"
              id={`cr-tab-${i}`}
              aria-selected={i === tab}
              aria-controls="cr-panel"
              className={`cr-tab${i === tab ? " is-on" : ""}${i < tab ? " is-done" : ""}`}
              onClick={() => pick(i)}
              data-track={`carrousel_${TRACK[i]}`}
            >
              <i aria-hidden="true">{i + 1}</i>
              <span className="cr-tab-l">{st.tab}</span>
              {/* Progression de toute l'étape ; sur téléphone, chaque onglet est un segment (plein une fois passé) */}
              <span className="cr-prog" aria-hidden="true">
                {i === tab && <b key={round} style={{ animationDuration: `${SCENES[i].length * SCENE_SECONDS}s` }} />}
              </span>
            </button>
          ))}
        </div>
        <button type="button" className="cr-pause" aria-label={paused ? t.play : t.pause} aria-pressed={paused} onClick={() => setPaused((p) => !p)}>
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
      <p className="cr-lead">
        <b>{step.title}</b> {step.text}
      </p>
      <div className="cr-stage" id="cr-panel" role="tabpanel" aria-labelledby={`cr-tab-${tab}`}>
        <div key={`${round}-${scene}`} className="cr-scene">
          <Scene t={t} />
        </div>
        <span key={`minuteur-${round}-${scene}`} className="cr-timer" style={{ animationDuration: `${SCENE_SECONDS}s` }} aria-hidden="true" onAnimationEnd={next} />
      </div>
    </div>
  );
}
