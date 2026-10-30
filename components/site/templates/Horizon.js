"use client";

// Modèle 1 · Horizon (par défaut) : panneaux clairs sur fond lin, deux colonnes décalées sur ordinateur.
// Maquettes Site-Horizon (1440 px) et Site-Horizon-Tel (390 px).

import { useState } from "react";
import { hourClock } from "@/lib/site/model";
import { AgendaLink, Faq, Orn, Photo, QR, RouteLink, joinList, useCountdown, useSavedResponse, useShare } from "../parts";
import GuestFormInline from "../GuestFormInline";
import { F, L } from "../edit";
import { placeLine, travelLabel, writeTo } from "../kit";

const Head = ({ kicker, title, wave }) => (
  <div className="hz-head">
    {wave ? <Orn name="wave" /> : null}
    {kicker ? <span className="hz-tiny"><L>{kicker}</L></span> : null}
    <h2 className="hz-it"><L>{title}</L></h2>
  </div>
);

function Top({ ctx }) {
  return (
    <header className="hz-nav">
      {ctx.nav.map((n) => (
        <a key={n.key} href={`#${n.key}`} className="hz-tiny">
          {n.label}
        </a>
      ))}
    </header>
  );
}

function Hero({ ctx }) {
  const { v } = ctx;
  return (
    <section className="hz-panel hz-hero">
      <Photo path="photos.cover" src={v.photos.cover} tone={1} label="Votre photo, vos mains" preview={ctx.preview} className="hz-hero-photo" />
      <div className="hz-hero-names">
        <span className="hz-tiny"><L>Nous nous marions</L></span>
        <F k="names.p1" placeholder="Prénom" as="h1" className="hz-it" value={v.p1 || v.names} />
        {v.p2 ? (
          <>
            <span className="hz-cg"><L>et</L></span>
            <F k="names.p2" placeholder="Prénom" as="span" className="hz-it" value={v.p2} />
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
    <section id="jour" className="hz-panel hz-pad hz-center">
      <Head kicker="Notez la date" title="Le jour" />
      <div className="hz-date">
        <div className="hz-date-side">
          <span className="hz-tiny">{d.weekday}</span>
          <span className="hz-tiny">{d.month}</span>
        </div>
        <span className="hz-it hz-date-day">{d.day}</span>
        <div className="hz-date-side">
          <span className="hz-tiny">{d.year}</span>
          {v.timeText ? <span className="hz-tiny">À {v.timeText}</span> : null}
        </div>
      </div>
      <F k="venue.name" placeholder="Le nom du lieu" as="span" className="hz-it hz-venue" value={v.venueName} />
      {v.venueAddress || v.content.dress.title ? <span className="hz-cg hz-venue-sub">{[v.venueAddress, v.content.dress.title ? `tenue ${v.content.dress.title.charAt(0).toLowerCase()}${v.content.dress.title.slice(1)}` : ""].filter(Boolean).join(" · ")}</span> : null}
      {cd ? (
        <div className="hz-count">
          {[
            [cd.days, "Jours"],
            [cd.hours, "Heures"],
            [cd.minutes, "Minutes"],
            [cd.seconds, "Secondes"],
          ].map(([n, l]) => (
            <div key={l}>
              <span className="hz-it">{n}</span>
              <span className="hz-tiny">{l}</span>
            </div>
          ))}
        </div>
      ) : null}
      <div className="hz-actions">
        <AgendaLink v={v} className="hz-pill">
          <L>Ajouter à mon agenda</L>
        </AgendaLink>
        <RouteLink v={v} className="hz-pill">
          <L>Voir l’itinéraire</L>
        </RouteLink>
      </div>
    </section>
  );
}

function Programme({ ctx }) {
  const { v } = ctx;
  return (
    <section id="programme" className="hz-panel hz-pad">
      <Head kicker="Le déroulé" title={<><L>Au fil du</L><br /><L>week-end</L></>} />
      <div className="hz-prog">
        {v.days.map((day, i) => (
          <div key={day.key || i}>
            {day.date ? <div className={`hz-tiny hz-prog-day${i ? " is-next" : ""}`}>{day.date.dayMonth}</div> : null}
            {day.moments.map((m) => (
              <div key={m.id} className="hz-prog-row">
                <span className="hz-tiny hz-prog-time">{hourClock(m.time)}</span>
                <span className="hz-rule" />
                <div className="hz-prog-text">
                  <F k={`moments.${m.id}.name`} placeholder="Le moment" as="span" className="hz-it" value={m.name} />
                  {m.text || placeLine(m) ? (
                    <span className="hz-cg">
                      {m.text}
                      {m.text && placeLine(m) ? <br /> : null}
                      {placeLine(m)}
                    </span>
                  ) : null}
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
    <section id="citation" className="hz-panel hz-citation">
      <Photo path="photos.citation" src={v.photos.citation} tone={2} label="Votre photo, au coucher du soleil" preview={ctx.preview} className="hz-citation-photo" />
      <F k="citation" multiline placeholder="Une phrase qui vous ressemble" as="p" className="hz-cg" value={v.content.citation} />
    </section>
  );
}

function Histoire({ ctx }) {
  const { v } = ctx;
  const [a, b] = v.photos.story || [];
  return (
    <section id="histoire" className="hz-panel hz-pad hz-center">
      <Head kicker="Comment tout a commencé" title={<F k="story.title" placeholder="Le titre" value={v.content.story.title || "Notre histoire"} />} />
      <div className="hz-collage">
        <div className="hz-shot is-a">
          <Photo src={a} tone={1} preview={ctx.preview} />
        </div>
        <div className="hz-shot is-b">
          <Photo src={b} tone={2} preview={ctx.preview} />
        </div>
      </div>
      <F k="story.text" multiline placeholder="Votre histoire" as="p" className="hz-p hz-story" value={v.content.story.text} />
    </section>
  );
}

function Album({ ctx, title = "De l’album", photos }) {
  const { v } = ctx;
  const list = photos || v.photos.album || [];
  const tiles = list.length ? list : [null, null, null, null, null, null];
  return (
    <section id="album" className="hz-panel hz-album">
      <Head wave title={title} />
      <div className="hz-strip">
        {tiles.map((src, i) => (
          <div key={i}>
            <Photo src={src} tone={[2, 1, 3][i % 3]} preview={ctx.preview} />
          </div>
        ))}
      </div>
      {!list.length ? <p className="hz-tiny hz-strip-note"><L>Vos photos du week-end, ici après le mariage</L></p> : null}
    </section>
  );
}

function Moments({ ctx }) {
  return <Album ctx={ctx} title="Nos moments" photos={ctx.v.photos.moments} />;
}

function Reponse({ ctx }) {
  const { v } = ctx;
  const [reload, setReload] = useState(0);
  const res = useSavedResponse(v.formSlug, ctx.preview, reload);
  const contacts = v.content.contacts;
  if (!res) {
    return (
      <section id="reponse" className="hz-panel hz-pad">
        <Head kicker="Votre réponse" title="Serez-vous des nôtres ?" />
        {v.formSlug ? (
          <GuestFormInline formSlug={v.formSlug} preview={ctx.preview} onAnswered={() => setReload((n) => n + 1)} />
        ) : contacts.length ? (
          <div className="hz-answer">
            <span className="hz-cg hz-change">{writeTo(contacts)}</span>
          </div>
        ) : null}
      </section>
    );
  }
  return (
    <section id="reponse" className="hz-panel hz-pad">
      <Head kicker="Merci, votre réponse est enregistrée" title={res.present === false ? "Vous nous manquerez" : "Vous serez des nôtres"} />
      <div className="hz-answer">
        <div className="hz-answer-line">
          <span className="hz-tiny"><L>Vos noms</L></span>
          <span className="hz-p">{res.names}</span>
        </div>
        {res.moments?.length ? (
          <div className="hz-answer-line">
            <span className="hz-tiny"><L>Vos moments</L></span>
            <span className="hz-p">{joinList(res.moments).replace(/^./, (c) => c.toUpperCase())}</span>
          </div>
        ) : null}
        <div className="hz-answer-yes">
          <span className="hz-tiny"><L>Vous serez là ?</L></span>
          <div>
            <span className={`hz-pill${res.present !== false ? " is-on" : " is-off"}`} aria-current={res.present !== false ? "true" : undefined}>
              <L>Oui, avec joie</L>
            </span>
            <span className={`hz-pill${res.present === false ? " is-on" : " is-off"}`} aria-current={res.present === false ? "true" : undefined}>
              <L>Hélas, non</L>
            </span>
          </div>
        </div>
        {v.formSlug ? (
          <a href={`/f/${v.formSlug}`} className="hz-cg hz-change">
            {contacts.length ? `Un changement ? ${writeTo(contacts)}` : "Un changement ? Répondez à nouveau"}
          </a>
        ) : contacts.length ? (
          <span className="hz-cg hz-change">Un changement ? {writeTo(contacts)}</span>
        ) : null}
      </div>
    </section>
  );
}

function Questions({ ctx }) {
  const { v } = ctx;
  return (
    <section id="questions" className="hz-panel hz-pad-wide">
      <div className="hz-head">
        <Orn name="wave" />
        <span className="hz-tiny"><L>Bon à savoir</L></span>
        <h2 className="hz-it"><L>Questions &amp; réponses</L></h2>
        <p className="hz-cg hz-q-intro">
          Vous ne trouvez pas ?<br />
          {v.content.contacts.length ? `${writeTo(v.content.contacts)}, nous répondons vite.` : "Écrivez-nous, nous répondons vite."}
        </p>
      </div>
      <div className="hz-faq">
        <Faq items={v.content.faq} titleClass="hz-it" textClass="hz-p" />
      </div>
    </section>
  );
}

function Partage({ ctx }) {
  const { v } = ctx;
  const share = useShare(v);
  return (
    <section id="partage" className="hz-panel hz-pad-wide">
      <Head kicker="Faites suivre" title="Partagez ce site" />
      <div className="hz-share">
        <QR url={ctx.shareUrl || share.url} size={72} />
        <div>
          <span className="hz-tiny"><L>Scannez pour l’ouvrir sur un autre téléphone</L></span>
          <a className="hz-pill" href={share.whatsapp} target="_blank" rel="noopener noreferrer">
            <L>Partager sur WhatsApp</L>
          </a>
          <button type="button" className="hz-pill" onClick={share.copy}>
            {share.copied ? "Lien copié" : "Copier le lien"}
          </button>
        </div>
      </div>
    </section>
  );
}

// Rubriques qui n'existent pas dans la maquette Horizon : même vocabulaire (panneau, titre Italiana)
function Mot({ ctx }) {
  return (
    <section id="mot" className="hz-panel hz-pad hz-center">
      <Head kicker="Chers amis" title="Bienvenue" />
      <F k="mot" multiline placeholder="Votre mot d’accueil" as="p" className="hz-p hz-story" value={ctx.v.content.mot} />
    </section>
  );
}

function Lieu({ ctx }) {
  const { v } = ctx;
  return (
    <section id="lieu" className="hz-panel hz-lieu">
      <Photo path="photos.venue" src={v.photos.venue} tone={3} label="Votre photo, le lieu" preview={ctx.preview} className="hz-lieu-photo" />
      <div className="hz-pad hz-center">
        <Head kicker="Le lieu" title={<F k="venue.name" placeholder="Le nom du lieu" value={v.venueName || "Le lieu"} />} />
        <F k="venue.address" placeholder="L’adresse du lieu" as="span" className="hz-cg hz-venue-sub" value={v.venueAddress} />
        <F k="venue.text" multiline placeholder="Quelques mots sur le lieu" as="p" className="hz-p hz-story" value={v.content.venue.text} />
        <div className="hz-actions">
          <RouteLink v={v} className="hz-pill">
            <L>Voir l’itinéraire</L>
          </RouteLink>
        </div>
      </div>
    </section>
  );
}

function Tenue({ ctx }) {
  const { dress } = ctx.v.content;
  return (
    <section id="tenue" className="hz-panel hz-pad hz-center">
      <Head kicker="La tenue" title={<F k="dress.title" placeholder="Le dress code" value={dress.title || "Dress code"} />} />
      <F k="dress.text" multiline placeholder="La tenue en quelques mots" as="p" className="hz-p hz-story" value={dress.text} />
      {dress.colors.length ? (
        <div className="hz-swatches">
          {dress.colors.map((c, i) => (
            <div key={i}>
              <span style={{ background: c.color }} />
              <span className="hz-tiny">{c.name}</span>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function Pratique({ ctx }) {
  const { v, keys } = ctx;
  const c = v.content;
  const dressHere = !keys.includes("tenue") && (c.dress.title || c.dress.text);
  return (
    <section id="pratique" className="hz-panel hz-pad-wide">
      <Head kicker="Bon à savoir" title="Le pratique" />
      <div className="hz-prat">
        {c.travel.length ? (
          <div>
            <div className="hz-tiny hz-prat-k"><L>Venir</L></div>
            {c.travel.map((t, i) => (
              <p key={i} className="hz-p">
                <span className="hz-ink">{travelLabel(t)}.</span> {t.text}
              </p>
            ))}
          </div>
        ) : null}
        {c.stays.length ? (
          <div>
            <div className="hz-tiny hz-prat-k"><L>Se loger</L></div>
            {c.stays.map((s, i) => (
              <p key={i} className="hz-p">
                <span className="hz-ink">{s.name}</span>
                {[s.distance, s.note].filter(Boolean).length ? ` · ${[s.distance, s.note].filter(Boolean).join(" · ")}` : ""}
              </p>
            ))}
          </div>
        ) : null}
        {dressHere ? (
          <div>
            <div className="hz-tiny hz-prat-k"><L>Dress code</L></div>
            <p className="hz-p">
              <F k="dress.title" placeholder="Le dress code" as="span" className="hz-ink" value={c.dress.title} />{c.dress.title ? ". " : " "}
              <F k="dress.text" multiline placeholder="La tenue en quelques mots" value={c.dress.text} />
            </p>
          </div>
        ) : null}
        {c.kids.title || c.kids.text ? (
          <div>
            <div className="hz-tiny hz-prat-k"><L>Enfants</L></div>
            <p className="hz-p">
              <F k="kids.title" placeholder="Les enfants" as="span" className="hz-ink" value={c.kids.title} />{c.kids.title ? ". " : " "}
              <F k="kids.text" multiline placeholder="Les enfants : bienvenus, garde prévue…" value={c.kids.text} />
            </p>
          </div>
        ) : null}
      </div>
    </section>
  );
}

// Deux colonnes décalées sur ordinateur (l'en-tête en haut à droite), une seule sur téléphone
const LEFT = new Set(["programme", "histoire", "album", "questions", "pratique", "tenue", "lieu", "mot", "moments"]);

function Layout({ ctx, render }) {
  const left = ctx.keys.filter((k) => LEFT.has(k));
  const right = ctx.keys.filter((k) => !LEFT.has(k));
  const order = (k) => ({ order: ctx.keys.indexOf(k) + 1 });
  return (
    <div className="hz-cols">
      <div className="hz-col is-left">
        {left.map((k) => (
          <div key={k} className="hz-cell" style={order(k)}>
            {render(k)}
          </div>
        ))}
      </div>
      <div className="hz-col is-right">
        <div className="hz-cell" style={{ order: 0 }}>
          <Hero ctx={ctx} />
        </div>
        {right.map((k) => (
          <div key={k} className="hz-cell" style={order(k)}>
            {render(k)}
          </div>
        ))}
      </div>
    </div>
  );
}

function Footer({ ctx }) {
  return (
    <footer className="hz-footer">
      <span className="hz-it">{ctx.v.names}</span>
      <span className="hz-tiny"><L>Fait avec Merry</L></span>
    </footer>
  );
}

const Horizon = {
  Top,
  Layout,
  Footer,
  sections: { mot: Mot, jour: Jour, programme: Programme, lieu: Lieu, tenue: Tenue, pratique: Pratique, histoire: Histoire, moments: Moments, citation: Citation, album: Album, reponse: Reponse, questions: Questions, partage: Partage },
  // La réponse n'apparaît que si l'invité a un formulaire où répondre ou une réponse enregistrée
  visible: (key, v) => key !== "reponse" || !!v.formSlug,
};
export default Horizon;
