"use client";

// Modèle 2 · Terracotta (Champêtre) : faire-part long, bords déchirés, brins fleuris au trait.
// Maquettes Site-Terracotta (1440 px) et Site-Terracotta-Tel (390 px).

import { hourText } from "@/lib/site/model";
import { AgendaLink, Faq, Ico, Orn, Photo, RouteLink, useCountdown } from "../parts";
import { travelLabel } from "../kit";
import { contactHref } from "@/lib/site/model";

const KIND_ICON = { civil: "mairie", mairie: "mairie", veille: "assiette", diner: "assiette", cocktail: "alliances", ceremonie: "alliances", brunch: "tasse" };
function momentIcon(m) {
  if (m.kind && KIND_ICON[m.kind]) return KIND_ICON[m.kind];
  const n = m.name.toLowerCase();
  if (/mairie|civil/.test(n)) return "mairie";
  if (/brunch|petit[- ]d[ée]j/.test(n)) return "tasse";
  if (/d[îi]ner|repas|veille|soir/.test(n)) return "assiette";
  return "alliances";
}

const Rule = ({ width = 140 }) => <Orn name="heartRule" width={width} height={12} />;

function Top({ ctx }) {
  const { v } = ctx;
  const cd = useCountdown(v.dateIso, v.time);
  const d = v.date;
  return (
    <>
      <div className="tc-sprig is-l">
        <Orn name="sprig" rotate={90} />
      </div>
      <div className="tc-sprig is-r">
        <Orn name="sprig" flip rotate={-90} />
      </div>
      <header className="tc-nav">
        {ctx.nav.map((n) => (
          <a key={n.key} href={`#${n.key}`}>
            {n.label}
          </a>
        ))}
      </header>
      <section className="tc-hero">
        <div className="tc-hero-l">
          {v.content.tagline ? <p className="tc-quote">« {v.content.tagline} »</p> : null}
          <div className="tc-initials">
            <span>{v.initials[0]}</span>
            {v.initials[1] ? (
              <>
                <span className="tc-initials-rule" />
                <span>{v.initials[1]}</span>
              </>
            ) : null}
          </div>
          <div className="tc-caps">Nous nous marions</div>
        </div>
        <div className="tc-hero-photo">
          <Photo src={v.photos.cover} tone={1} label="Votre photo" preview={ctx.preview} />
          <Orn name="tornBottom" stretch width="100%" height={28} style={{ position: "absolute", left: 0, right: 0, bottom: -1 }} />
        </div>
        <div className="tc-hero-r">
          <div className="tc-sprig-side is-l">
            <Orn name="sprigSmall" width={130} height={130} />
          </div>
          <div className="tc-sprig-side is-r">
            <Orn name="sprigSmall" width={130} height={130} flip />
          </div>
          <h1 className="tc-script tc-names">
            {v.p1}
            {v.p2 ? (
              <>
                <br />
                <span>&amp;</span>
                <br />
                {v.p2}
              </>
            ) : null}
          </h1>
          {v.content.welcome ? <p className="tc-p tc-welcome">{v.content.welcome}</p> : null}
          {d ? (
            <div className="tc-date">
              <div className="tc-caps">{d.month}</div>
              <div className="tc-date-row">
                <div className="tc-caps tc-date-box">{d.weekday}</div>
                <div className="tc-date-day">{d.day}</div>
                <div className="tc-caps tc-date-box">{d.year}</div>
              </div>
              {v.venueName || v.area ? <div className="tc-p tc-date-place">{[v.venueName, v.area].filter(Boolean).join(" · ")}</div> : null}
            </div>
          ) : null}
          {cd ? (
            <div className="tc-count">
              <div className="tc-caps">Avant le grand jour</div>
              <div className="tc-count-row">
                {[
                  [cd.days, "Jours"],
                  [cd.hours, "Heures"],
                  [cd.minutes, "Minutes"],
                  [cd.seconds, "Secondes"],
                ].map(([n, l], i) => (
                  <span key={l} className="tc-count-cell">
                    {i ? <span className="tc-count-sep">:</span> : null}
                    <span className="tc-count-n">
                      <span>{n}</span>
                      <span className="tc-k">{l}</span>
                    </span>
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </section>
      <div className="tc-rule" />
    </>
  );
}

function Programme({ ctx }) {
  const { v } = ctx;
  return (
    <section id="programme" className="tc-prog">
      <div className="tc-head">
        <h2 className="tc-caps tc-h2">Le programme</h2>
        <Rule />
      </div>
      <div className="tc-prog-list">
        {v.days.map((day, i) => (
          <div key={day.key || i}>
            {day.date ? <div className={`tc-caps-s tc-prog-day${i ? " is-next" : ""}`}>{day.date.dayMonth}</div> : null}
            {day.moments.map((m) => (
              <div key={m.id} className="tc-prog-row">
                <div className="tc-prog-ico">
                  <Ico name={momentIcon(m)} size={38} />
                </div>
                <div className="tc-prog-line">
                  <span className="tc-prog-bar" />
                  <span className="tc-prog-dot" />
                </div>
                <div className="tc-prog-text">
                  <div className="tc-prog-name">{m.name}</div>
                  {m.place || m.address ? (
                    <div className="tc-prog-place">
                      {m.place}
                      {m.place && m.address ? <br /> : null}
                      {m.address}
                    </div>
                  ) : null}
                  {m.text ? <div className="tc-prog-place">{m.text}</div> : null}
                  {m.address || m.place ? (
                    <RouteLink v={v} address={[m.place, m.address].filter(Boolean).join(", ")} className="tc-maplink">
                      Voir sur la carte
                    </RouteLink>
                  ) : null}
                </div>
                <div className="tc-prog-time">{hourText(m.time)}</div>
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className="tc-center" style={{ marginTop: 26 }}>
        <AgendaLink v={v} className="tc-pill">
          <Ico name="agenda" size={18} sw={1.3} />
          Ajouter à mon agenda
        </AgendaLink>
      </div>
    </section>
  );
}

function Lieu({ ctx }) {
  const { v } = ctx;
  const main = v.moments.find((m) => m.dateIso === v.dateIso && m.time) || null;
  return (
    <section id="lieu" className="tc-lieu">
      <div className="tc-center tc-lieu-text">
        {v.date ? <div className="tc-caps-s">{[`${v.date.weekday} ${v.date.day}`, v.timeText || (main ? hourText(main.time) : "")].filter(Boolean).join(" · ")}</div> : null}
        <h2 className="tc-caps tc-lieu-name">{v.venueName}</h2>
        {v.venueAddress || v.content.venue.text ? (
          <p className="tc-p">
            {v.venueAddress}
            {v.venueAddress && v.content.venue.text ? <br /> : null}
            {v.content.venue.text}
          </p>
        ) : null}
        <RouteLink v={v} className="tc-pill" style={{ marginTop: 6 }}>
          <Ico name="pin" size={18} sw={1.3} />
          Voir l’itinéraire
        </RouteLink>
      </div>
      <div className="tc-lieu-photo">
        <Photo src={v.photos.venue} tone={3} label="Votre photo, le lieu" preview={ctx.preview} frame={false} />
        <Orn name="tornTop" stretch width="100%" height={22} style={{ position: "absolute", left: 0, right: 0, top: -1 }} />
      </div>
    </section>
  );
}

function Pratique({ ctx }) {
  const { v, keys } = ctx;
  const c = v.content;
  const cols = [];
  if (!keys.includes("tenue") && (c.dress.title || c.dress.text))
    cols.push(
      <div key="dress">
        <div className="tc-ico-row">
          <Ico name="robe" size={40} sw={0.9} />
          <Ico name="flacon" size={40} sw={0.9} />
        </div>
        <h3 className="tc-caps">Dress code</h3>
        {c.dress.title ? <div className="tc-italic">{c.dress.title}</div> : null}
        {c.dress.text ? <p className="tc-p tc-narrow">{c.dress.text}</p> : null}
      </div>,
    );
  if (c.travel.length)
    cols.push(
      <div key="venir">
        <div className="tc-ico-row">
          <Ico name="train" size={34} />
        </div>
        <h3 className="tc-caps">Venir</h3>
        <div className="tc-list">
          {c.travel.map((t, i) => (
            <div key={i}>
              <div className="tc-k is-acc">{travelLabel(t)}</div>
              <p className="tc-p">{t.text}</p>
            </div>
          ))}
        </div>
      </div>,
    );
  if (c.stays.length)
    cols.push(
      <div key="loger">
        <div className="tc-ico-row">
          <Ico name="lit" size={34} />
        </div>
        <h3 className="tc-caps">Se loger</h3>
        <div className="tc-list is-tight">
          {c.stays.map((s, i) => (
            <div key={i}>
              <span className="tc-stay">{s.name}</span>
              <span className="tc-p">{[s.distance, s.note].filter(Boolean).join(" · ")}</span>
            </div>
          ))}
        </div>
      </div>,
    );
  if (c.kids.title || c.kids.text)
    cols.push(
      <div key="enfants">
        <div className="tc-ico-row">
          <Ico name="enfant" size={34} />
        </div>
        <h3 className="tc-caps">Enfants</h3>
        {c.kids.title ? <div className="tc-italic is-small">{c.kids.title}</div> : null}
        {c.kids.text ? <p className="tc-p tc-narrow">{c.kids.text}</p> : null}
      </div>,
    );
  return (
    <section id="pratique" className="tc-prat-wrap">
      <div className="tc-head">
        <h2 className="tc-caps tc-h2">Bon à savoir</h2>
        <Rule />
      </div>
      <div className="tc-prat" style={{ "--n": cols.length }}>
        {cols}
      </div>
      <div className="tc-rule" />
    </section>
  );
}

function Questions({ ctx }) {
  const { v } = ctx;
  const c = v.content;
  return (
    <section id="questions" className="tc-questions">
      <div className="tc-center tc-q">
        <div className="tc-ico-row">
          <Ico name="mail" size={34} />
        </div>
        <h3 className="tc-caps">Une question ?</h3>
        {c.contacts.length ? <p className="tc-p tc-narrow">{c.contacts.some((x) => /t[ée]moin/i.test(x.role || "")) ? "Nos témoins connaissent tous les détails du week-end." : "Ils connaissent tous les détails du week-end."}</p> : null}
        {c.contacts.length ? (
          <div className="tc-q-btns">
            {c.contacts.map((x, i) => {
              const href = contactHref(x);
              return href ? (
                <a key={i} className="tc-pill" href={href}>
                  Écrire à {x.name}
                </a>
              ) : null;
            })}
          </div>
        ) : null}
      </div>
      {c.faq.length ? (
        <div className="tc-faq">
          <Faq items={c.faq} titleClass="tc-faq-q" textClass="tc-p" />
        </div>
      ) : null}
    </section>
  );
}

// Rubriques absentes de la maquette Terracotta : même vocabulaire (capitales Jost, filet au cœur)
function Simple({ id, title, children }) {
  return (
    <section id={id} className="tc-simple">
      <div className="tc-head">
        <h2 className="tc-caps tc-h2">{title}</h2>
        <Rule />
      </div>
      <div className="tc-center tc-simple-body">{children}</div>
    </section>
  );
}

function Mot({ ctx }) {
  return (
    <Simple id="mot" title="Chers amis">
      <p className="tc-p tc-wide">{ctx.v.content.mot}</p>
    </Simple>
  );
}

function Jour({ ctx }) {
  const { v } = ctx;
  return (
    <Simple id="jour" title="Le jour">
      <div className="tc-italic">{v.date.long}</div>
      <p className="tc-p">{[v.timeText ? `À ${v.timeText}` : "", v.venueName].filter(Boolean).join(" · ")}</p>
      <AgendaLink v={v} className="tc-pill">
        <Ico name="agenda" size={18} sw={1.3} />
        Ajouter à mon agenda
      </AgendaLink>
    </Simple>
  );
}

function Tenue({ ctx }) {
  const { dress } = ctx.v.content;
  return (
    <Simple id="tenue" title="Dress code">
      {dress.title ? <div className="tc-italic">{dress.title}</div> : null}
      {dress.text ? <p className="tc-p tc-wide">{dress.text}</p> : null}
      {dress.colors.length ? (
        <div className="tc-swatches">
          {dress.colors.map((x, i) => (
            <div key={i}>
              <span style={{ background: x.color }} />
              <span className="tc-k">{x.name}</span>
            </div>
          ))}
        </div>
      ) : null}
    </Simple>
  );
}

function Histoire({ ctx }) {
  const { v } = ctx;
  const [a, b] = v.photos.story || [];
  return (
    <Simple id="histoire" title={v.content.story.title || "Notre histoire"}>
      <div className="tc-pair">
        <Photo src={a} tone={1} preview={ctx.preview} />
        <Photo src={b} tone={3} preview={ctx.preview} />
      </div>
      {v.content.story.text ? <p className="tc-p tc-wide">{v.content.story.text}</p> : null}
    </Simple>
  );
}

function Gallery({ ctx, id, title, photos, note }) {
  const tiles = photos?.length ? photos : [null, null, null];
  return (
    <Simple id={id} title={title}>
      <div className="tc-gallery">
        {tiles.map((src, i) => (
          <Photo key={i} src={src} tone={(i % 3) + 1} preview={ctx.preview} />
        ))}
      </div>
      {!photos?.length && note ? <p className="tc-k">{note}</p> : null}
    </Simple>
  );
}

function Citation({ ctx }) {
  const { v } = ctx;
  return (
    <section id="citation" className="tc-citation">
      <Photo src={v.photos.citation} tone={2} label="Votre photo" preview={ctx.preview} />
      {v.content.citation ? <p className="tc-italic">{v.content.citation}</p> : null}
    </section>
  );
}

function Reponse({ ctx }) {
  const { v } = ctx;
  return (
    <Simple id="reponse" title="Votre réponse">
      <p className="tc-p tc-wide">Vous avez déjà répondu ? Rien à faire. Sinon, deux minutes suffisent.</p>
      {v.formSlug ? (
        <a className="tc-pill" href={`/f/${v.formSlug}`}>
          Répondre
        </a>
      ) : null}
    </Simple>
  );
}

function Partage({ ctx }) {
  const { v } = ctx;
  const url = ctx.shareUrl || (typeof window === "undefined" ? "" : window.location.href.split("#")[0]);
  return (
    <Simple id="partage" title="Faites suivre">
      <p className="tc-p tc-wide">Envoyez ce site à ceux qui en ont besoin.</p>
      <div className="tc-q-btns">
        <a className="tc-pill" href={`https://wa.me/?text=${encodeURIComponent(`${v.names} : toutes les infos du mariage ${url}`)}`} target="_blank" rel="noopener noreferrer">
          Partager sur WhatsApp
        </a>
      </div>
    </Simple>
  );
}

function Footer() {
  return (
    <div className="tc-footer">
      <div className="tc-footer-sprig">
        <Orn name="sprigSmall" />
      </div>
      <div className="tc-center tc-footer-text">
        <div className="tc-caps">Nous avons hâte de fêter ce jour avec vous</div>
        <div className="tc-script tc-merci">Merci !</div>
        <div className="tc-made">Fait avec Merry</div>
      </div>
      <div className="tc-footer-sprig is-r">
        <Orn name="sprigSmall" flip />
      </div>
    </div>
  );
}

const Terracotta = {
  Top,
  Footer,
  sections: {
    mot: Mot,
    jour: Jour,
    programme: Programme,
    lieu: Lieu,
    tenue: Tenue,
    pratique: Pratique,
    histoire: Histoire,
    moments: ({ ctx }) => <Gallery ctx={ctx} id="moments" title="Nos moments" photos={ctx.v.photos.moments} />,
    citation: Citation,
    album: ({ ctx }) => <Gallery ctx={ctx} id="album" title="L’album" photos={ctx.v.photos.album} note="Vos photos du week-end, ici après le mariage" />,
    reponse: Reponse,
    questions: Questions,
    partage: Partage,
  },
  visible: (key, v) => key !== "reponse" || !!v.formSlug,
};
export default Terracotta;
