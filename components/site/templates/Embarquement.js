"use client";

// Modèle 4 · Embarquement (Un peu dingue) : billet d'avion, globe, tampons, calendrier.
// Maquettes Site-Embarquement (1440 px) et Site-Embarquement-Tel (390 px).

import { contactHref, hourClock } from "@/lib/site/model";
import { AgendaLink, Faq, Ico, Orn, Photo, QR, RouteLink, Stamp, Ticket, joinList, useSavedResponse, useShare } from "../parts";
import { F, L } from "../edit";
import { placeDot, travelShort } from "../kit";

const upper = (s) => String(s || "").toUpperCase();

function PlaneRule({ width = 150, ink }) {
  return (
    <div className={`em-planerule${ink ? " is-ink" : ""}`} style={{ width }}>
      <span />
      <Ico name="avion" size={16} sw={1.2} style={{ transform: "rotate(45deg)" }} />
      <span />
    </div>
  );
}

const Head = ({ title, ink, width = 150 }) => (
  <div className="em-head">
    <h2 className={`em-cz${ink ? "" : " is-on"}`}><L>{title}</L></h2>
    <PlaneRule width={width} ink={ink} />
  </div>
);

function Top({ ctx }) {
  const { v } = ctx;
  const d = v.date;
  const city = v.place || v.area || "";
  return (
    <>
      <header className="em-header">
        <span className="em-cz em-brand">{v.initials.join(" & ")}</span>
        <nav>
          {ctx.nav.map((n) => (
            <a key={n.key} href={`#${n.key}`} className="em-lab">
              {n.label}
            </a>
          ))}
        </nav>
        <span />
      </header>
      <section className="em-hero">
        <Ticket notch="62%" className="em-pass">
          <div className="em-lab em-depart"><L>&#9654;&nbsp; Départ</L></div>
          <div className="em-center em-pass-body">
            <div className="em-lab is-ink em-wide"><L>Billet de mariage</L></div>
            <div className="em-dash" />
            <span className="em-plane">
              <Ico name="avion" size={22} sw={1.3} />
            </span>
            <Orn name="globe" />
            <F k="names.p1" placeholder="Prénom" as="h1" className="em-cz em-name" value={v.p1} />
            {v.p2 ? (
              <>
                <div className="em-sc em-et"><L>et</L></div>
                <F k="names.p2" placeholder="Prénom" as="div" className="em-cz em-name" value={v.p2} />
              </>
            ) : null}
            <div className="em-grid">
              <div>
                <span className="em-lab"><L>Vol &amp; date</L></span>
                <span>{d ? d.dots : "À venir"}</span>
              </div>
              <div>
                <span className="em-lab"><L>Classe</L></span>
                <span><L>Invité d’honneur</L></span>
              </div>
              <div>
                <span className="em-lab"><L>Destination</L></span>
                <span>{[city, v.area && v.area !== city ? v.area : ""].filter(Boolean).join(", ") || "Surprise"}</span>
              </div>
              <div>
                <span className="em-lab"><L>Lieu du mariage</L></span>
                <span>{v.venueName || "À venir"}</span>
              </div>
            </div>
            <div className="em-stamps">
              <Stamp top={upper(v.names)} bottom={d ? upper(`${d.day} ${d.monthShort.replace(".", "")} ${d.year}`) : ""} size={104} />
              <Orn name="waves" />
              <span className="em-sc em-bon"><L>Bon voyage</L></span>
            </div>
            <div className="em-dash" />
            {d ? <div className="em-lab is-ink em-wide">Embarquement le {d.day === 1 ? "1er" : d.day} {d.monthLower}</div> : null}
          </div>
        </Ticket>
        <div className="em-hero-text">
          <div className="em-sc em-hero-sc"><L>Notre mariage</L></div>
          {city ? <div className="em-cz em-hero-cz">à {city}</div> : null}
          <PlaneRule width={380} />
          {v.weekend || d ? (
            <div className="em-lab em-wide is-soft">
              {[v.area ? `Un week-end en ${v.area}` : "", v.weekend ? `${v.weekend.first.day} → ${v.weekend.last.day} ${v.weekend.last.monthLower} ${v.weekend.last.year}` : d?.noWeekday].filter(Boolean).join(" · ")}
            </div>
          ) : null}
          <F k="welcome" multiline placeholder="Votre mot de bienvenue" as="p" className="em-p em-hero-p" value={v.content.welcome} />
        </div>
      </section>
    </>
  );
}

function Programme({ ctx }) {
  const { v } = ctx;
  return (
    <section id="programme" className="em-onbg em-prog">
      <Head title="Plan de vol" />
      {v.days.map((day, i) => (
        <div key={day.key || i}>
          {day.date ? <div className={`em-lab is-soft em-prog-day${i ? " is-next" : ""}`}>{day.date.dayMonth}</div> : null}
          {day.moments.map((m) => (
            <div key={m.id} className="em-prog-row">
              <div className="em-prog-line">
                <span />
                <span />
              </div>
              <div className="em-prog-text">
                <F k={`moments.${m.id}.name`} placeholder="Le moment" as="span" className="em-prog-name" value={m.name} />
                {placeDot(m) ? <span className="em-prog-place">{placeDot(m)}</span> : null}
              </div>
              <span className="em-mono em-prog-time">{hourClock(m.time)}</span>
            </div>
          ))}
        </div>
      ))}
      <div className="em-flight">
        <Orn name="flight300" />
      </div>
      <div className="em-center" style={{ marginTop: 8 }}>
        <AgendaLink v={v} className="em-btn is-light">
          <Ico name="agenda" size={16} sw={1.3} />
          <L>Ajouter à mon agenda</L>
        </AgendaLink>
      </div>
    </section>
  );
}

function Lieu({ ctx }) {
  const { v } = ctx;
  const others = [];
  for (const m of v.moments) {
    const addr = m.address || "";
    if (!addr || addr === v.venueAddress || others.some((o) => o.address === addr)) continue;
    others.push({ label: [m.date?.weekday, m.name.toLowerCase()].filter(Boolean).join(", "), address: addr });
  }
  return (
    <Ticket notch="38%" className="em-card em-lieu">
      <section id="lieu">
        <div className="em-stamp-small">
          <Stamp top={upper([v.place, v.area].filter(Boolean).join(" · ") || v.venueName)} bottom="FRANCE" size={78} />
        </div>
        <div className="em-center em-lieu-body">
          <Head title="Le lieu" ink />
          <F k="venue.name" placeholder="Le nom du lieu" as="div" className="em-lieu-name" value={v.venueName} />
          <F k="venue.address" placeholder="L’adresse du lieu" as="p" className="em-p em-upper" value={v.venueAddress} />
          <RouteLink v={v} className="em-btn" style={{ margin: "8px 0 14px" }}>
            <L>Comment venir</L>
          </RouteLink>
          <Photo path="photos.venue" src={v.photos.venue} tone={2} label="Votre photo, le lieu" preview={ctx.preview} gray className="em-lieu-photo" round={10} />
          {others.length ? <div className="em-dash" style={{ marginTop: 14 }} /> : null}
          {others.map((o, i) => (
            <p key={i} className="em-p">
              <span className="em-ink">{o.label.replace(/^./, (c) => c.toUpperCase())} :</span> {o.address}
            </p>
          ))}
        </div>
      </section>
    </Ticket>
  );
}

// Calendrier du mois, le jour J marqué d'un cœur
function Jour({ ctx }) {
  const { v } = ctx;
  const d = v.date.date;
  const first = new Date(d.getFullYear(), d.getMonth(), 1);
  const lead = (first.getDay() + 6) % 7;
  const days = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  const cells = [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);
  return (
    <Ticket notch="72%" className="em-card em-cal">
      <section id="jour" className="em-center">
        <h2 className="em-cz em-cal-title">
          {v.date.month} {v.date.year}
        </h2>
        <div className="em-cal-grid">
          {["L", "M", "M", "J", "V", "S", "D"].map((x, i) => (
            <span key={i} className="em-lab is-ink">
              {x}
            </span>
          ))}
          {cells.map((n, i) =>
            n === v.date.day ? (
              <span key={i} className="em-cal-day is-day">
                <Ico name="coeur" size={34} sw={0} className="em-heart" />
                <span>{n}</span>
              </span>
            ) : (
              <span key={i} className="em-cal-day">
                {n || ""}
              </span>
            ),
          )}
        </div>
        <div className="em-dash" />
        <div className="em-lab"><L>Le grand jour</L></div>
        <div className="em-cz em-cal-date">{v.date.dots}</div>
        <Ico name="coeurTrait" size={16} sw={1.2} className="em-accent" />
      </section>
    </Ticket>
  );
}

function DressCol({ dress }) {
  return (
    <div className="em-center em-dress">
      <h2 className="em-cz em-h-band"><L>Dress code</L></h2>
      {dress.title || dress.text ? <p className="em-p em-dress-p">{[dress.title, dress.text].filter(Boolean).join(". ")}</p> : null}
      {dress.colors.length ? (
        <div className="em-swatches">
          {dress.colors.map((c, i) => (
            <div key={i}>
              <span style={{ background: c.color }} />
              <span className="em-lab is-ink">{c.name}</span>
            </div>
          ))}
        </div>
      ) : null}
      <div className="em-flight-ink">
        <Orn name="flight260" />
      </div>
    </div>
  );
}

function Pratique({ ctx }) {
  const { v, keys } = ctx;
  const c = v.content;
  const dress = !keys.includes("tenue") && (c.dress.title || c.dress.text || c.dress.colors.length);
  return (
    <section id="pratique" className="em-band">
      <div className={`em-band-grid${dress ? "" : " is-single"}`}>
        {dress ? <DressCol dress={c.dress} /> : null}
        <div className="em-frame">
          <Ticket notch="50%" className="em-card em-escales">
            <div className="em-center em-esc-head">
              <h2 className="em-cz"><L>Escales pratiques</L></h2>
              <div className="em-lab">{["Venir", c.stays.length ? "dormir" : "", c.kids.text || c.kids.title ? "enfants" : ""].filter(Boolean).join(" · ")}</div>
            </div>
            {c.travel.length ? (
              <>
                <div className="em-esc-row is-head">
                  <span className="em-mono"><L>Mode</L></span>
                  <span className="em-mono"><L>Départ</L></span>
                  <span className="em-mono"><L>Durée</L></span>
                </div>
                {c.travel.map((t, i) => (
                  <div key={i} className="em-esc-row">
                    <span className="em-mono is-acc">{travelShort(t)}</span>
                    <span className="em-mono is-ink">{t.place || t.text}</span>
                    <span className="em-mono is-ink">{t.duration}</span>
                  </div>
                ))}
              </>
            ) : null}
            {c.stays.length ? (
              <>
                <div style={{ height: 18 }} />
                <div className="em-esc-row is-head">
                  <span className="em-mono"><L>Hôtel</L></span>
                  <span className="em-mono"><L>Nom</L></span>
                  <span className="em-mono"><L>Distance</L></span>
                </div>
                {c.stays.map((s, i) => (
                  <div key={i} className="em-esc-row">
                    <span className="em-mono is-acc"><L>Dormir</L></span>
                    <span className="em-mono is-ink">{s.name}</span>
                    <span className="em-mono is-ink">{s.distance}</span>
                  </div>
                ))}
              </>
            ) : null}
            {c.kids.title || c.kids.text ? (
              <p className="em-p em-kids">
                <span className="em-ink"><L>Enfants :</L></span> {[c.kids.title, c.kids.text].filter(Boolean).join(". ").replace(/^./, (x) => x.toLowerCase())}
              </p>
            ) : null}
          </Ticket>
        </div>
      </div>
    </section>
  );
}

function Tenue({ ctx }) {
  return (
    <section id="tenue" className="em-band">
      <div className="em-band-grid is-single">
        <DressCol dress={ctx.v.content.dress} />
      </div>
    </section>
  );
}

function Mot({ ctx }) {
  const { v } = ctx;
  return (
    <section id="mot" className="em-onbg em-center em-mot">
      <h2 className="em-cz is-on em-mot-title">
        <L>Chers amis</L>
        <br />
        <L>et famille</L>
      </h2>
      <F k="mot" multiline placeholder="Votre mot d’accueil" as="p" className="em-p em-mot-p" value={v.content.mot} />
      <Photo src={v.photos.ambiance?.[0] || v.photos.cover} tone={1} label="Votre photo" preview={ctx.preview} className="em-mot-photo" />
      <div className="em-flight-end">
        <Orn name="flight220" />
      </div>
    </section>
  );
}

function Questions({ ctx }) {
  const c = ctx.v.content;
  return (
    <Ticket notch="50%" className="em-card em-q">
      <section id="questions">
        <div className="em-center em-q-head">
          <h2 className="em-cz"><L>Une question ?</L></h2>
          {c.contacts.length ? <p className="em-p">{c.contacts.some((x) => /t[ée]moin/i.test(x.role || "")) ? "Nos témoins ont toutes les réponses." : "Ils ont toutes les réponses."}</p> : null}
        </div>
        {c.contacts.map((x, i) => (
          <div key={i} className="em-q-row">
            <div>
              <span className="em-cz">{x.name}</span>
              {x.role ? <span className="em-lab">{x.role}</span> : null}
            </div>
            {contactHref(x) ? (
              <a className="em-btn" href={contactHref(x)}>
                <Ico name="mail" size={15} sw={1.3} />
                <L>Écrire</L>
              </a>
            ) : null}
          </div>
        ))}
        {c.faq.length ? (
          <div className="em-faq">
            <Faq items={c.faq} titleClass="em-faq-q" textClass="em-p" groups={false} />
          </div>
        ) : null}
      </section>
    </Ticket>
  );
}

function Partage({ ctx }) {
  const { v } = ctx;
  const share = useShare(v);
  return (
    <Ticket notch="50%" className="em-card em-q">
      <section id="partage" className="em-center em-share">
        <h2 className="em-cz"><L>Faites suivre</L></h2>
        <QR url={ctx.shareUrl || share.url} size={92} />
        <p className="em-p"><L>Scannez pour l’ouvrir sur un autre téléphone.</L></p>
        <a className="em-btn" href={share.whatsapp} target="_blank" rel="noopener noreferrer">
          <L>WhatsApp</L>
        </a>
        <button type="button" className="em-btn" onClick={share.copy}>
          {share.copied ? "Lien copié" : "Copier le lien"}
        </button>
        {v.content.whatsapp ? (
          <a className="em-link" href={v.content.whatsapp} target="_blank" rel="noopener noreferrer">
            <L>Rejoindre notre groupe</L>
          </a>
        ) : null}
      </section>
    </Ticket>
  );
}

function Reponse({ ctx }) {
  const { v } = ctx;
  const res = useSavedResponse(v.formSlug, ctx.preview);
  return (
    <Ticket notch="50%" className="em-card em-q">
      <section id="reponse" className="em-center em-share">
        <h2 className="em-cz"><L>Votre billet</L></h2>
        {res ? (
          <>
            <div className="em-lab">{res.present === false ? "Vous ne serez pas du voyage" : "Réservation confirmée"}</div>
            <p className="em-p">
              <span className="em-ink">{res.names}</span>
              {res.moments?.length ? (
                <>
                  <br />
                  {joinList(res.moments).replace(/^./, (x) => x.toUpperCase())}
                </>
              ) : null}
            </p>
            {v.formSlug ? (
              <a className="em-link" href={`/f/${v.formSlug}`}>
                <L>Un changement ? Répondre à nouveau</L>
              </a>
            ) : null}
          </>
        ) : (
          <>
            <p className="em-p"><L>Pas encore répondu ? Deux minutes suffisent.</L></p>
            {v.formSlug ? (
              <a className="em-btn" href={`/f/${v.formSlug}`}>
                <L>Répondre</L>
              </a>
            ) : null}
          </>
        )}
      </section>
    </Ticket>
  );
}

function Histoire({ ctx }) {
  const { v } = ctx;
  const [a, b] = v.photos.story || [];
  return (
    <section id="histoire" className="em-onbg em-wide-block">
      <Head title={<F k="story.title" placeholder="Le titre" value={v.content.story.title || "Notre histoire"} />} width={200} />
      <div className="em-pair">
        <Photo src={a} tone={1} preview={ctx.preview} round={6} />
        <Photo src={b} tone={3} preview={ctx.preview} round={6} />
      </div>
      <F k="story.text" multiline placeholder="Votre histoire" as="p" className="em-p em-story" value={v.content.story.text} />
    </section>
  );
}

function Gallery({ ctx, id, title, photos, note }) {
  const tiles = photos?.length ? photos : [null, null, null, null];
  return (
    <section id={id} className="em-onbg em-wide-block">
      <Head title={title} width={200} />
      <div className="em-gallery">
        {tiles.map((src, i) => (
          <Photo key={i} src={src} tone={(i % 3) + 1} preview={ctx.preview} round={6} />
        ))}
      </div>
      {!photos?.length && note ? <p className="em-lab is-soft em-note"><L>{note}</L></p> : null}
    </section>
  );
}

function Citation({ ctx }) {
  const { v } = ctx;
  return (
    <section id="citation" className="em-citation">
      <Photo path="photos.citation" src={v.photos.citation} tone={2} label="Votre photo" preview={ctx.preview} />
      <F k="citation" multiline placeholder="Une phrase qui vous ressemble" as="p" className="em-sc" value={v.content.citation} />
    </section>
  );
}

function Footer() {
  return (
    <footer className="em-footer">
      <span className="em-sc"><L>Bon voyage</L></span>
      <span className="em-lab is-soft"><L>Fait avec Merry</L></span>
    </footer>
  );
}

const Embarquement = {
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
export default Embarquement;
