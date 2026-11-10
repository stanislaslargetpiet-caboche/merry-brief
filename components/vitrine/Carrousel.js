"use client";

// Carrousel de l'accueil (lot 2, storyboard validé par Stan le 10 nov. 2026, planches Site-Blocs-* du canvas) : quatre
// onglets de trois scènes de 5 s. Chaque scène arrive complète et un seul détail s'y anime ; l'onglet actif porte la
// progression et passe seul au suivant. Le rythme est tenu par l'animation CSS d'un minuteur invisible (sa fin = scène
// suivante) : la pause fige donc d'un coup le minuteur, la progression et le détail animé. Textes :
// lib/i18n/vitrine-carrousel.js ; styles : app/vitrine/carrousel.css.

import { useEffect, useRef, useState } from "react";
import { useLang } from "@/lib/lang";
import { CARROUSEL, COUPLE_PHOTO } from "@/lib/i18n/vitrine-carrousel";

const TRACK = ["prestataires", "budget", "invites", "retroplanning"];

const CHECK = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </svg>
);
const HEART_PATH = "M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.1a4.3 4.3 0 0 1 7.5 2.7C19.5 15.4 12 20 12 20z";
const STROKE = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" };

// Icônes du système (pleines citron, trait encre) : lieu, date, invités, budget, document
const ICONS = {
  lieu: (
    <>
      <path d="M12 21s-7-5.5-7-11a7 7 0 1 1 14 0c0 5.5-7 11-7 11z" fill="#fff700" stroke="#1c1c1a" strokeWidth="1.5" strokeLinejoin="round" />
      <circle cx="12" cy="10" r="2.4" fill="#ffffff" stroke="#1c1c1a" strokeWidth="1.3" />
    </>
  ),
  date: (
    <>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2" fill="#fff700" stroke="#1c1c1a" strokeWidth="1.5" />
      <path d="M8 3v4M16 3v4M3.5 10h17" stroke="#1c1c1a" strokeWidth="1.5" strokeLinecap="round" />
    </>
  ),
  invites: (
    <>
      <path d="M16 14.6c2.6.2 4.6 2 5.3 5.4H13c0-2.3.9-4.3 3-5.4z" fill="#fffdb8" stroke="#1c1c1a" strokeWidth="1.3" strokeLinejoin="round" />
      <circle cx="17" cy="9" r="2.5" fill="#fffdb8" stroke="#1c1c1a" strokeWidth="1.3" />
      <path d="M2.5 20c.8-3.5 3.4-5.5 6.5-5.5s5.7 2 6.5 5.5z" fill="#fff700" stroke="#1c1c1a" strokeWidth="1.5" strokeLinejoin="round" />
      <circle cx="9" cy="8" r="3.5" fill="#fff700" stroke="#1c1c1a" strokeWidth="1.5" />
    </>
  ),
  budget: (
    <>
      <rect x="3" y="6" width="18" height="13" rx="2" fill="#fff700" stroke="#1c1c1a" strokeWidth="1.5" />
      <path d="M3 10h18" stroke="#1c1c1a" strokeWidth="1.5" />
      <path d="M16.5 14.5h1.5" stroke="#1c1c1a" strokeWidth="1.8" strokeLinecap="round" />
    </>
  ),
  document: (
    <>
      <path d="M6 3h8l5 5v13H6z" fill="#fff700" stroke="#1c1c1a" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M14 3v5h5" fill="#fffdb8" stroke="#1c1c1a" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M9 12h6M9 15h6" stroke="#1c1c1a" strokeWidth="1.2" strokeLinecap="round" />
    </>
  ),
};
const BRIEF_ICONS = ["lieu", "date", "invites", "budget"];

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

function Photo({ src, className = "" }) {
  return <span className={`cr-ph ${className}`} style={{ backgroundImage: `url(${src})` }} aria-hidden="true" />;
}

/* ---- 1 Prestataires ---- */

function Vendors({ t }) {
  const v = t.vendors;
  return (
    <>
      <Head title={v.title}>
        <span className="cr-chips">
          {t.brief.map((b, i) => (
            <span key={b} className="cr-chip">
              <Icon name={BRIEF_ICONS[i]} />
              {b}
            </span>
          ))}
        </span>
      </Head>
      <div className="cr-venues">
        {v.cards.map((c, i) => (
          <article key={c.name} className="cr-vc">
            <span className="cr-vc-photo" style={{ backgroundImage: `url(${c.img})` }}>
              <span className="cr-vc-heart">
                <Swap
                  delay={0.5 + i * 0.4}
                  from={<svg width="20" height="20" viewBox="0 0 24 24" {...STROKE} aria-hidden="true"><path d={HEART_PATH} /></svg>}
                  to={<svg width="20" height="20" viewBox="0 0 24 24" {...STROKE} fill="#1c1c1a" aria-hidden="true"><path d={HEART_PATH} /></svg>}
                />
              </span>
            </span>
            <span className="cr-vc-body">
              <span className="cr-grow">
                <span className="cr-name">{c.name}</span>
                <span className="cr-area">
                  <span>{c.area}</span>
                </span>
              </span>
              <span className="cr-specs">
                <span>
                  <svg width="18" height="18" viewBox="0 0 24 24" {...STROKE} aria-hidden="true"><path d="M7 11V5.5A1.5 1.5 0 0 1 8.5 4h7A1.5 1.5 0 0 1 17 5.5V11M5 11h14v3H5zM7 14v6M17 14v6" /></svg>
                  {c.seats}
                </span>
                <span>
                  <svg width="18" height="18" viewBox="0 0 24 24" {...STROKE} aria-hidden="true"><path d="M3 18V7M3 13h18v5M21 13v-2a3 3 0 0 0-3-3h-7v5" /><circle cx="7" cy="10.5" r="1.8" /></svg>
                  {c.beds}
                </span>
              </span>
              <span className="cr-vc-price">
                {v.from} <b>{c.price}</b> {v.rent}
              </span>
            </span>
          </article>
        ))}
      </div>
      <div className="cr-selbar cr-rise" style={{ "--d": "1.8s" }}>
        <span className="cr-stack">
          {v.cards.map((c) => (
            <Photo key={c.name} src={c.img} className="cr-thumb" />
          ))}
        </span>
        <span className="cr-grow">
          <span className="cr-name">{v.selCount}</span>
          <span className="cr-cap">{v.selLabel}</span>
        </span>
        <span className="cr-btn cr-btn-primary">{v.selCta}</span>
      </div>
    </>
  );
}

function Request({ t }) {
  const r = t.request;
  return (
    <>
      <Head title={r.title} />
      <div className="cr-request">
        <div className="cr-card cr-to-list">
          <span className="cr-lab">{r.to}</span>
          <div className="cr-rows">
            {r.venues.map((v) => (
              <div key={v.name} className="cr-row">
                <Photo src={v.img} className="cr-thumb cr-thumb-lg" />
                <span className="cr-grow">
                  <span className="cr-name">{v.name}</span>
                  <span className="cr-cap">{v.area}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="cr-card cr-message">
          <span className="cr-lab">{r.message}</span>
          <div className="cr-letter">
            {r.lines.map((l) => (
              <p key={l}>{l}</p>
            ))}
          </div>
          <Swap
            className="cr-send"
            delay={1.6}
            from={<span className="cr-btn cr-btn-primary">{r.send}</span>}
            to={<Pill kind="ok">{r.sent}</Pill>}
          />
        </div>
      </div>
    </>
  );
}

function Quotes({ t }) {
  const q = t.quotes;
  return (
    <>
      <Head title={q.title}>
        <span className="cr-tag">{q.replies}</span>
      </Head>
      <div className="cr-quotes">
        {q.cards.map((c) => (
          <article key={c.name} className={`cr-quote${c.best ? " is-best" : ""}`}>
            <Photo src={c.img} className="cr-quote-photo" />
            {c.best && (
              <span className="cr-tag cr-tag-full cr-best cr-pop" style={{ "--d": "1s" }}>
                {q.best}
              </span>
            )}
            <span className="cr-grow">
              <span className="cr-name">{c.name}</span>
              <span className="cr-cap">{c.area}</span>
            </span>
            <b className="cr-quote-price">{c.price}</b>
            {c.free ? (
              <span className="cr-free">
                {CHECK}
                {q.free}
              </span>
            ) : (
              <span className="cr-full">{q.full}</span>
            )}
            <span className={`cr-btn ${c.best ? "cr-btn-primary" : c.free ? "cr-btn-line" : "cr-btn-off"} cr-quote-cta`}>{c.best ? q.choose : q.see}</span>
          </article>
        ))}
      </div>
    </>
  );
}

/* ---- 2 Budget ---- */

function Budget({ t }) {
  const b = t.budget;
  return (
    <>
      <Head title={b.title} />
      <div className="cr-stats cr-stats-3">
        {b.stats.map(([value, label]) => (
          <span key={label} className="cr-stat">
            <b>{value}</b>
            <span>{label}</span>
          </span>
        ))}
      </div>
      <div className="cr-card cr-rows">
        {b.rows.map(([poste, value, planned, pct], i) => (
          <div key={poste} className="cr-row cr-poste">
            <span className="cr-name">{poste}</span>
            <span className="cr-track">
              <b className="cr-fill" style={{ width: `${pct}%`, "--d": `${0.3 + i * 0.15}s` }} />
            </span>
            <span className="cr-amount">
              <b>{value}</b> <span className="cr-cap">{`${b.on} ${planned}`}</span>
            </span>
          </div>
        ))}
      </div>
    </>
  );
}

function Payers({ t }) {
  const p = t.payers;
  return (
    <>
      <Head title={p.title} />
      <div className="cr-card cr-payers">
        <div className="cr-payers-top">
          <span className="cr-lab">{p.label}</span>
          <Swap className="cr-big" from={p.total[0]} to={p.total[1]} />
        </div>
        <div className="cr-split" aria-hidden="true">
          {p.rows.map((r, i) => (
            <span key={r.ini} className={`cr-seg cr-seg-${i}`} style={{ "--w0": `${r.w[0]}%`, "--w1": `${r.w[1]}%`, "--d": "1.5s" }} />
          ))}
        </div>
        <div className="cr-rows">
          {p.rows.map((r, i) => (
            <div key={r.ini} className={`cr-row${r.arrives ? " cr-rise" : ""}`} style={r.arrives ? { "--d": "1.5s" } : undefined}>
              <span className={`cr-av cr-av${[4, 1, 3][i]}`}>{r.ini}</span>
              <span className="cr-grow">
                <span className="cr-name">{r.name}</span>
              </span>
              <Swap className="cr-cap cr-pct" from={r.pct[0]} to={r.pct[1]} />
              <b className="cr-amount">{r.amount}</b>
            </div>
          ))}
        </div>
      </div>
      <span className="cr-btn cr-btn-line cr-end">{p.add}</span>
    </>
  );
}

function Payments({ t }) {
  const p = t.payments;
  return (
    <>
      <Head title={p.title} />
      <div className="cr-card cr-rows">
        {p.rows.map(([name, kind, amount, date], i) => (
          <div key={`${name}-${kind}`} className="cr-row cr-payment">
            <span className="cr-grow">
              <span className="cr-name">{name}</span>
              <span className="cr-cap">{kind}</span>
            </span>
            <b className="cr-amount">{amount}</b>
            <span>
              {i < 2 && <Pill kind="ok">{p.paid}</Pill>}
              {i === 2 && <Swap from={<Pill kind="wait">{p.due}</Pill>} to={<Pill kind="ok">{p.paid}</Pill>} />}
              {i === 3 && <Pill kind="wait">{p.due}</Pill>}
            </span>
            <span className="cr-cap cr-date">{date}</span>
          </div>
        ))}
      </div>
      <div className="cr-payfoot">
        <div className="cr-stats cr-stats-inline">
          {p.stats.map(([before, after, label]) => (
            <span key={label} className="cr-stat">
              <Swap from={<b>{before}</b>} to={<b>{after}</b>} />
              <span>{label}</span>
            </span>
          ))}
        </div>
        <span className="cr-soon">
          <span className="cr-btn cr-btn-off">{p.pay}</span>
          <span className="cr-tag">{p.soon}</span>
        </span>
      </div>
    </>
  );
}

/* ---- 3 Invités ---- */

function Guests({ t }) {
  const g = t.guests;
  return (
    <>
      <Head title={g.title} />
      <div className="cr-stats cr-stats-4">
        {g.stats.map(([before, after, label]) => (
          <span key={label} className="cr-stat">
            {before === after ? <b>{after}</b> : <Swap from={<b>{before}</b>} to={<b>{after}</b>} />}
            <span>{label}</span>
          </span>
        ))}
      </div>
      <div className="cr-card cr-rows cr-guests">
        {g.rows.map(([ini, name, group, state], i) => (
          <div key={name} className="cr-row">
            <span className={`cr-av cr-av${(i % 4) + 1}`}>{ini}</span>
            <span className="cr-grow">
              <span className="cr-name">{name}</span>
              <span className="cr-cap">{group}</span>
            </span>
            {state === "yes" && <Pill kind="ok">{g.yes}</Pill>}
            {state === "wait" && <Pill kind="wait">{g.wait}</Pill>}
            {state === "no" && <Pill kind="off">{g.no}</Pill>}
            {state === "flip" && <Swap from={<Pill kind="wait">{g.wait}</Pill>} to={<Pill kind="ok">{g.yes}</Pill>} />}
          </div>
        ))}
      </div>
    </>
  );
}

function Form({ t }) {
  const f = t.form;
  return (
    <>
      <Head title={f.title} />
      <div className="cr-form-wrap">
        <div className="cr-couple cr-form">
          <span className="cr-serif cr-form-names">{f.couple}</span>
          <span className="cr-couple-cap">{f.when}</span>
          <span className="cr-serif cr-form-q">{f.question}</span>
          <span className="cr-opts">
            <span className="cr-opt cr-pick" style={{ "--d": "0.8s" }}>
              {CHECK}
              {f.yes}
            </span>
            <span className="cr-opt">{f.no}</span>
          </span>
          <span className="cr-field">{f.diet}</span>
          <span className="cr-field">{f.note}</span>
          <Swap
            className="cr-form-send"
            delay={2}
            from={<span className="cr-opt cr-opt-send">{f.send}</span>}
            to={<Pill kind="ok">{f.thanks}</Pill>}
          />
        </div>
        <div className="cr-form-side cr-rise" style={{ "--d": "2.4s" }}>
          <span className="cr-lab">{f.side}</span>
          <div className="cr-card cr-form-card">
            <span className="cr-row-inline">
              <span className="cr-av cr-av2">L</span>
              <span className="cr-grow">
                <span className="cr-name">{f.guest}</span>
                <span className="cr-cap">{f.guestRole}</span>
              </span>
            </span>
            <Pill kind="ok">{f.answer}</Pill>
            <span>{f.diet}</span>
          </div>
        </div>
      </div>
    </>
  );
}

function Site({ t }) {
  const s = t.site;
  return (
    <>
      <Head title={s.title} />
      <div className="cr-couple cr-site">
        <div className="cr-site-text">
          <span className="cr-site-nav">
            {s.nav.map((n) => (
              <span key={n}>{n}</span>
            ))}
          </span>
          <span className="cr-serif cr-site-names">{s.couple}</span>
          <span className="cr-couple-cap">{s.when}</span>
          <div className="cr-fund">
            <span className="cr-fund-top">
              <span className="cr-name">{s.fund}</span>
              <span>
                <Swap from={<b>{s.before}</b>} to={<b>{s.after}</b>} /> <span className="cr-couple-cap">{s.of}</span>
              </span>
            </span>
            <span className="cr-fund-track">
              <b className="cr-seg" style={{ "--w0": "67%", "--w1": "69%", "--d": "1.5s" }} />
            </span>
            <span className="cr-rise cr-fund-gift" style={{ "--d": "1.5s" }}>
              {s.gift}
            </span>
          </div>
          <span className="cr-couple-cap">{s.madeWith}</span>
        </div>
        <span className="cr-ph cr-site-photo" style={{ backgroundImage: `url(${COUPLE_PHOTO})` }} role="img" aria-label={s.photo} />
      </div>
    </>
  );
}

/* ---- 4 Rétroplanning ---- */

function Timeline({ t }) {
  const tl = t.timeline;
  return (
    <>
      <Head title={tl.title} />
      <div className="cr-tl">
        <span className="cr-tl-line" aria-hidden="true" />
        {tl.rows.map(([when, what, state]) => (
          <div key={when} className={`cr-tl-row${state === "now" ? " is-now" : ""}`}>
            <span className="cr-tl-when">{when}</span>
            <span className={`cr-dot${state ? ` is-${state}` : ""}${state === "now" ? " cr-pop" : ""}`} style={state === "now" ? { "--d": "1s" } : undefined} />
            <span className="cr-name">{what}</span>
            <span>
              {state === "past" && <Pill kind="ok">{tl.done}</Pill>}
              {state === "now" && (
                <span className="cr-tag cr-tag-full cr-pop" style={{ "--d": "1s" }}>
                  {tl.here}
                </span>
              )}
            </span>
          </div>
        ))}
      </div>
    </>
  );
}

function Tasks({ t }) {
  const k = t.tasks;
  return (
    <>
      <Head title={k.title}>
        <Swap className="cr-tag" from={k.before} to={k.after} />
      </Head>
      <div className="cr-card cr-rows cr-tasks">
        {k.rows.map(([what, by, ini, who, state]) => (
          <div key={what} className="cr-row">
            {state === "done" && <span className="cr-box is-on">{CHECK}</span>}
            {state === "flip" && <Swap from={<span className="cr-box" />} to={<span className="cr-box is-on">{CHECK}</span>} />}
            {!state && <span className="cr-box" />}
            <span className="cr-grow">
              <span className={`cr-name${state === "done" ? " is-done" : ""}${state === "flip" ? " cr-strike" : ""}`} style={state === "flip" ? { "--d": "1.5s" } : undefined}>
                {what}
              </span>
              <span className="cr-cap">{by}</span>
            </span>
            <span className="cr-who">
              <span className={`cr-av cr-av${{ A: 4, B: 3, S: 1 }[ini]}`}>{ini}</span>
              <span className="cr-who-name">{who}</span>
            </span>
          </div>
        ))}
      </div>
    </>
  );
}

function Docs({ t }) {
  const d = t.docs;
  return (
    <>
      <Head title={d.title} />
      <div className="cr-docs">
        <div className="cr-folders">
          {d.folders.map(([name, before, after], i) => (
            <div key={name} className={`cr-folder${i === 0 ? " is-on" : ""}`}>
              <span className="cr-tile">
                <Icon name="document" />
              </span>
              <span className="cr-grow">
                <span className="cr-name">{name}</span>
                {after ? <Swap className="cr-cap" delay={1.2} from={before} to={after} /> : <span className="cr-cap">{before}</span>}
              </span>
            </div>
          ))}
        </div>
        <div className="cr-card cr-files">
          <div className="cr-rows">
            {d.files.map(([name, by], i) => (
              <div key={name} className={`cr-row${i === d.files.length - 1 ? " cr-rise" : ""}`} style={i === d.files.length - 1 ? { "--d": "1.2s" } : undefined}>
                <span className="cr-tile cr-tile-muted">
                  <Icon name="document" />
                </span>
                <span className="cr-grow">
                  <span className="cr-name">{name}</span>
                  <span className="cr-cap">{by}</span>
                </span>
              </div>
            ))}
          </div>
          <span className="cr-drop">{d.drop}</span>
        </div>
      </div>
    </>
  );
}

const SCENES = [
  [Vendors, Request, Quotes],
  [Budget, Payers, Payments],
  [Guests, Form, Site],
  [Timeline, Tasks, Docs],
];

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
    if (scene < 2) setScene(scene + 1);
    else pick((tab + 1) % SCENES.length);
  };

  const Scene = SCENES[tab][scene];
  return (
    <div ref={ref} className={`cr${paused || !visible ? " is-paused" : ""}`}>
      <div className="cr-bar">
        <div className="cr-tabs" role="tablist" aria-label={t.tabsLabel}>
          {t.tabs.map((label, i) => (
            <button
              key={label}
              type="button"
              role="tab"
              id={`cr-tab-${i}`}
              aria-selected={i === tab}
              aria-controls="cr-panel"
              className={`cr-tab${i === tab ? " is-on" : ""}`}
              onClick={() => pick(i)}
              data-track={`carrousel_${TRACK[i]}`}
            >
              <i aria-hidden="true">{i + 1}</i>
              {label}
              {i === tab && (
                <span className="cr-prog" aria-hidden="true">
                  <b key={round} />
                </span>
              )}
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
      <div className="cr-stage" id="cr-panel" role="tabpanel" aria-labelledby={`cr-tab-${tab}`}>
        <div key={`${round}-${scene}`} className="cr-scene">
          <Scene t={t} />
        </div>
        <span key={`minuteur-${round}-${scene}`} className="cr-timer" aria-hidden="true" onAnimationEnd={next} />
      </div>
    </div>
  );
}
