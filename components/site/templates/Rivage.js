"use client";

// Modèle 8 · Rivage (Bord de mer) : plage, « Nos moments » en photos éparpillées, album.
// Maquettes Site-Rivage (1440 px) et Site-Rivage-Tel (390 px).

import { useState } from "react";
import { contactHref, hourClock } from "@/lib/site/model";
import { AgendaLink, Faq, Photo, QR, RouteLink, joinList, useCountdown, useSavedResponse, useShare } from "../parts";
import GuestFormInline from "../GuestFormInline";
import { F, L } from "../edit";
import { placeDot, travelLabel, writeTo } from "../kit";

const Head = ({ kicker, title, small }) => (
  <div className="rv-head">
    {kicker ? <span className="rv-tiny"><L>{kicker}</L></span> : null}
    <h2 className={`rv-gd${small ? " is-small" : ""}`}><L>{title}</L></h2>
  </div>
);

function Top({ ctx }) {
  const { v } = ctx;
  return (
    <section className="rv-hero">
      <Photo path="photos.cover" src={v.photos.cover} tone={1} label="Votre photo, vos mains" preview={ctx.preview} className="rv-hero-photo" />
      <div className="rv-nav">
        <span className="rv-tiny is-dark">{v.initials.join(" & ")}</span>
        {ctx.nav.map((n) => (
          <a key={n.key} href={`#${n.key}`} className="rv-tiny is-dark">
            {n.label}
          </a>
        ))}
      </div>
      <div className="rv-names">
        <span className="rv-tiny"><L>Nous nous marions</L></span>
        <F k="names.p1" placeholder="Prénom" as="h1" className="rv-gd" value={v.p1} />
        {v.p2 ? (
          <>
            <span className="rv-it"><L>et</L></span>
            <F k="names.p2" placeholder="Prénom" as="span" className="rv-gd" value={v.p2} />
          </>
        ) : null}
      </div>
    </section>
  );
}

function Jour({ ctx }) {
  const { v } = ctx;
  const cd = useCountdown(v.dateIso, v.time);
  const d = v.date;
  return (
    <section id="jour" className="rv-jour">
      <Head kicker="Notez la date" title="Le jour" />
      <div className="rv-date">
        <div>
          <span className="rv-tiny">{d.weekday}</span>
          <span className="rv-tiny">{d.month}</span>
        </div>
        <span className="rv-gd rv-date-day">{d.day}</span>
        <div>
          <span className="rv-tiny">{d.year}</span>
          {v.timeText ? <span className="rv-tiny">À {v.timeText}</span> : null}
        </div>
      </div>
      <F k="venue.name" placeholder="Le nom du lieu" as="span" className="rv-gd rv-venue" value={v.venueName} />
      <F k="venue.address" placeholder="L’adresse du lieu" as="span" className="rv-it rv-addr" value={v.venueAddress} />
      {cd ? (
        <div className="rv-count">
          {[
            [cd.days, "Jours"],
            [cd.hours, "Heures"],
            [cd.minutes, "Minutes"],
            [cd.seconds, "Secondes"],
          ].map(([n, l]) => (
            <div key={l}>
              <span className="rv-gd">{n}</span>
              <span className="rv-tiny">{l}</span>
            </div>
          ))}
        </div>
      ) : null}
      <div className="rv-actions">
        <AgendaLink v={v} className="rv-pill">
          <L>Ajouter à mon agenda</L>
        </AgendaLink>
        <RouteLink v={v} className="rv-pill">
          <L>Voir l’itinéraire</L>
        </RouteLink>
      </div>
    </section>
  );
}

function Programme({ ctx }) {
  const { v } = ctx;
  return (
    <section id="programme" className="rv-prog">
      <Head kicker="Le déroulé" title={v.weekend ? "Au fil du week-end" : "Au fil du jour"} />
      <div className="rv-prog-list">
        {v.days.map((day, i) => (
          <div key={day.key || i}>
            {day.date ? <div className={`rv-tiny is-ink rv-prog-day${i ? " is-next" : ""}`}>{day.date.dayMonth}</div> : null}
            {day.moments.map((m) => (
              <div key={m.id} className="rv-prog-row">
                <span className="rv-prog-time">{hourClock(m.time)}</span>
                <span className="rv-rule" />
                <div className="rv-prog-text">
                  <F k={`moments.${m.id}.name`} placeholder="Le moment" as="span" className="rv-gd" value={m.name} />
                  <F k={`moments.${m.id}.text`} multiline placeholder="Un petit mot" as="span" className="rv-it" value={m.text} />
                  {placeDot(m) ? <span className="rv-prog-place">{placeDot(m)}</span> : null}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}

function Citation({ ctx }) {
  const { v } = ctx;
  return (
    <section id="citation" className="rv-citation">
      <Photo src={v.photos.citation || v.photos.venue} tone={3} label="Votre photo, le lieu" preview={ctx.preview} frame={false} />
      <F k="citation" multiline placeholder="Une phrase qui vous ressemble" as="p" className="rv-it" value={v.content.citation} />
    </section>
  );
}

function Pratique({ ctx }) {
  const { v, keys } = ctx;
  const c = v.content;
  const cols = [];
  if (c.travel.length)
    cols.push(
      <div key="venir">
        <span className="rv-gd rv-h3"><L>Venir</L></span>
        {c.travel.map((t, i) => (
          <p key={i} className="rv-p is-small">
            <span className="rv-ink">{travelLabel(t)}.</span> {t.text}
          </p>
        ))}
      </div>,
    );
  if (c.stays.length)
    cols.push(
      <div key="loger">
        <span className="rv-gd rv-h3"><L>Se loger</L></span>
        {c.stays.map((s, i) => (
          <p key={i} className="rv-p is-small">
            <span className="rv-ink">{s.name}</span>
            {s.distance ? ` · ${s.distance}` : ""}
            {s.note ? (
              <>
                <br />
                {s.note}
              </>
            ) : null}
          </p>
        ))}
      </div>,
    );
  if (!keys.includes("tenue") && (c.dress.title || c.dress.text))
    cols.push(
      <div key="dress">
        <span className="rv-gd rv-h3"><L>Dress code</L></span>
        <p className="rv-p is-small">
          <F k="dress.title" placeholder="Le dress code" as="span" className="rv-ink" value={c.dress.title} />{c.dress.title ? ". " : " "}
          <F k="dress.text" multiline placeholder="La tenue en quelques mots" value={c.dress.text} />
        </p>
      </div>,
    );
  if (c.kids.title || c.kids.text)
    cols.push(
      <div key="kids">
        <span className="rv-gd rv-h3"><L>Enfants</L></span>
        <p className="rv-p is-small">
          <F k="kids.title" placeholder="Les enfants" as="span" className="rv-ink" value={c.kids.title} />{c.kids.title ? ". " : " "}
          <F k="kids.text" multiline placeholder="Les enfants : bienvenus, garde prévue…" value={c.kids.text} />
        </p>
      </div>,
    );
  return (
    <section id="pratique" className="rv-prat">
      <Head kicker="Bon à savoir" title="Le pratique" />
      <div className="rv-prat-grid" style={{ "--n": cols.length }}>
        {cols}
      </div>
    </section>
  );
}

// « Nos moments » : six photos éparpillées autour du titre
function Moments({ ctx }) {
  const { v } = ctx;
  const p = v.photos.moments || [];
  const tones = [1, 2, 3, 2, 1, 3];
  return (
    <section id="moments" className="rv-moments">
      {tones.map((t, i) => (
        <div key={i} className={`rv-shot is-m${i + 1}`}>
          <Photo src={p[i]} tone={t} preview={ctx.preview} />
        </div>
      ))}
      <div className="rv-moments-title">
        <span className="rv-tiny"><L>Quelques-uns de nos jours préférés</L></span>
        <h2 className="rv-gd">
          <L>Nos</L>
          <br />
          <L>moments</L>
        </h2>
      </div>
      <F k="tagline" placeholder="Une phrase sous vos prénoms" as="span" className="rv-al rv-moments-al" value={v.content.tagline} />
    </section>
  );
}

function Histoire({ ctx }) {
  const { v } = ctx;
  const [a, b] = v.photos.story || [];
  return (
    <section id="histoire" className="rv-story">
      <div className="rv-story-shots">
        <div className="rv-shot is-a">
          <Photo src={a} tone={2} preview={ctx.preview} />
        </div>
        <div className="rv-shot is-b">
          <Photo src={b} tone={1} preview={ctx.preview} />
        </div>
      </div>
      <div className="rv-story-text">
        <Head kicker="Comment tout a commencé" title={<F k="story.title" placeholder="Le titre" value={v.content.story.title || "Notre histoire"} />} />
        <F k="story.text" multiline placeholder="Votre histoire" as="p" className="rv-p" value={v.content.story.text} />
      </div>
    </section>
  );
}

function Album({ ctx }) {
  const { v } = ctx;
  const list = v.photos.album || [];
  const tiles = list.length ? list : [null, null, null, null, null, null, null];
  return (
    <section id="album" className="rv-album">
      <Head kicker="Plus tard, vos photos" title="De l’album" />
      <div className="rv-strip">
        {tiles.map((src, i) => (
          <div key={i}>
            <Photo src={src} tone={[3, 1, 2][i % 3]} preview={ctx.preview} />
          </div>
        ))}
      </div>
      {!list.length ? <p className="rv-tiny rv-center rv-note"><L>Ajoutez les vôtres après le mariage</L></p> : null}
    </section>
  );
}

function Questions({ ctx }) {
  const c = ctx.v.content;
  return (
    <section id="questions" className="rv-q">
      <Head kicker="Bon à savoir" title="Questions et réponses" small />
      {c.contacts.length ? <p className="rv-it rv-center rv-q-intro">Une autre question ? {writeTo(c.contacts)}{c.contacts.some((x) => /t[ée]moin/i.test(x.role || "")) ? ", nos témoins" : ""}.</p> : null}
      {c.faq.length ? <Faq items={c.faq} titleClass="rv-gd rv-faq-q" textClass="rv-p is-small" groups={false} /> : null}
      {c.contacts.some((x) => contactHref(x)) ? (
        <div className="rv-actions is-center">
          {c.contacts.map((x, i) =>
            contactHref(x) ? (
              <a key={i} className="rv-pill" href={contactHref(x)}>
                Écrire à {x.name}
              </a>
            ) : null,
          )}
        </div>
      ) : null}
    </section>
  );
}

function Partage({ ctx }) {
  const { v } = ctx;
  const share = useShare(v);
  return (
    <section id="partage" className="rv-q">
      <Head kicker="Faites suivre" title="Partagez le site" small />
      <div className="rv-share">
        <QR url={ctx.shareUrl || share.url} size={92} />
        <div>
          <span className="rv-tiny is-small"><L>Scannez pour l’ouvrir sur un autre téléphone</L></span>
          <a className="rv-pill" href={share.whatsapp} target="_blank" rel="noopener noreferrer">
            <L>WhatsApp</L>
          </a>
          <button type="button" className="rv-pill" onClick={share.copy}>
            {share.copied ? "Lien copié" : "Copier le lien"}
          </button>
        </div>
      </div>
      {v.content.whatsapp ? (
        <div className="rv-center" style={{ marginTop: 24 }}>
          <a className="rv-pill is-fill" href={v.content.whatsapp} target="_blank" rel="noopener noreferrer">
            <L>Rejoindre notre groupe</L>
          </a>
        </div>
      ) : null}
    </section>
  );
}

// Rubriques absentes de la maquette Rivage : même vocabulaire (Gilda, italiques Cormorant)
function Simple({ id, kicker, title, children }) {
  return (
    <section id={id} className="rv-simple">
      <Head kicker={kicker} title={title} />
      {children}
    </section>
  );
}

function Mot({ ctx }) {
  return (
    <Simple id="mot" kicker="Chers amis" title="Bienvenue">
      <F k="mot" multiline placeholder="Votre mot d’accueil" as="p" className="rv-p rv-narrow" value={ctx.v.content.mot} />
    </Simple>
  );
}

function Lieu({ ctx }) {
  const { v } = ctx;
  return (
    <Simple id="lieu" kicker="Le lieu" title={v.venueName}>
      <F k="venue.address" placeholder="L’adresse du lieu" as="p" className="rv-it rv-addr" value={v.venueAddress} />
      <F k="venue.text" multiline placeholder="Quelques mots sur le lieu" as="p" className="rv-p rv-narrow" value={v.content.venue.text} />
      <div className="rv-lieu-photo">
        <Photo path="photos.venue" src={v.photos.venue} tone={3} label="Votre photo, le lieu" preview={ctx.preview} frame={false} />
      </div>
      <RouteLink v={v} className="rv-pill">
        <L>Voir l’itinéraire</L>
      </RouteLink>
    </Simple>
  );
}

function Tenue({ ctx }) {
  const { dress } = ctx.v.content;
  return (
    <Simple id="tenue" kicker="Dress code" title={<F k="dress.title" placeholder="Le dress code" value={dress.title || "La tenue"} />}>
      <F k="dress.text" multiline placeholder="La tenue en quelques mots" as="p" className="rv-p rv-narrow" value={dress.text} />
      {dress.colors.length ? (
        <div className="rv-swatches">
          {dress.colors.map((x, i) => (
            <div key={i}>
              <span style={{ background: x.color }} />
              <span className="rv-tiny">{x.name}</span>
            </div>
          ))}
        </div>
      ) : null}
    </Simple>
  );
}

function Reponse({ ctx }) {
  const { v } = ctx;
  const [reload, setReload] = useState(0);
  const res = useSavedResponse(v.formSlug, ctx.preview, reload);
  return (
    <Simple id="reponse" kicker={res ? "Merci, votre réponse est enregistrée" : "Votre réponse"} title={res ? (res.present === false ? "Vous nous manquerez" : "Vous serez des nôtres") : "Serez-vous des nôtres ?"}>
      {res ? (
        <>
          <p className="rv-p rv-narrow">
            <span className="rv-ink">{res.names}</span>
            {res.moments?.length ? ` · ${joinList(res.moments)}` : ""}
          </p>
          {v.formSlug ? (
            <a className="rv-pill is-fill" href={`/f/${v.formSlug}`}>
              Changer ma réponse
            </a>
          ) : null}
        </>
      ) : v.formSlug ? (
        <GuestFormInline formSlug={v.formSlug} preview={ctx.preview} onAnswered={() => setReload((n) => n + 1)} />
      ) : null}
    </Simple>
  );
}

function Footer({ ctx }) {
  return (
    <footer className="rv-footer">
      <span className="rv-gd">{ctx.v.names}</span>
      <span className="rv-tiny"><L>Fait avec Merry</L></span>
    </footer>
  );
}

const Rivage = {
  Top,
  Footer,
  sections: { mot: Mot, jour: Jour, programme: Programme, lieu: Lieu, tenue: Tenue, pratique: Pratique, histoire: Histoire, moments: Moments, citation: Citation, album: Album, reponse: Reponse, questions: Questions, partage: Partage },
  visible: (key, v) => key !== "reponse" || !!v.formSlug,
};
export default Rivage;
