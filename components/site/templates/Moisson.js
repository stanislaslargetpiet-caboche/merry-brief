"use client";

// Modèle 7 · Moisson (Intime) : champ de blé, carte blanche posée sur une photo.
// Maquettes Site-Moisson (1440 px) et Site-Moisson-Tel (390 px).

import { contactHref, hourText } from "@/lib/site/model";
import { AgendaLink, Faq, Photo, QR, RouteLink, joinList, useCountdown, useSavedResponse, useShare } from "../parts";
import { momentWhen, placeLine, travelLabel, witnesses } from "../kit";

function Top({ ctx }) {
  const { v } = ctx;
  return (
    <section className="mo-hero">
      <Photo src={v.photos.cover} tone={1} label="Votre photo, en plein champ" preview={ctx.preview} className="mo-hero-photo" />
      <nav className="mo-nav">
        {ctx.nav.map((n) => (
          <a key={n.key} href={`#${n.key}`}>
            {n.label}
          </a>
        ))}
      </nav>
      <div className="mo-hero-text">
        <h1 className="mo-gl">{v.names}</h1>
        {v.date ? <span className="mo-lab is-white">Mariage · {v.date.dots}</span> : null}
      </div>
    </section>
  );
}

function Jour({ ctx }) {
  const { v } = ctx;
  const cd = useCountdown(v.dateIso, v.time);
  return (
    <section id="jour" className="mo-jour">
      <h2 className="mo-gl mo-big">Notre mariage</h2>
      <span className="mo-lab is-acc">Le grand jour approche</span>
      <span className="mo-when">{[v.date.long, v.venueName].filter(Boolean).join(" · ")}</span>
      {cd ? (
        <div className="mo-count">
          {[
            [cd.days, "Jours"],
            [cd.hours, "Heures"],
            [cd.minutes, "Min"],
            [cd.seconds, "Sec"],
          ].map(([n, l], i) => (
            <span key={l} className="mo-count-cell">
              {i ? <span className="mo-count-sep">:</span> : null}
              <span className="mo-count-n">
                <span>{n}</span>
                <span>{l}</span>
              </span>
            </span>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function Programme({ ctx }) {
  const { v } = ctx;
  const [bg] = v.photos.ambiance || [];
  return (
    <section id="programme" className="mo-prog">
      <Photo src={bg} tone={2} label="Votre photo, en fond" preview={ctx.preview} className="mo-prog-bg" />
      <div className="mo-prog-inner">
        <div className="mo-card">
          <h2 className="mo-gl mo-acc mo-h2">{v.weekend ? "Le week-end" : "Le jour J"}</h2>
          <span className="mo-lab mo-sub">Le programme</span>
          {v.content.welcome ? <p className="mo-p mo-intro">{v.content.welcome}</p> : null}
          <div className="mo-prog-list">
            {v.moments.map((m) => (
              <div key={m.id}>
                <span className="mo-lab is-acc is-small">{momentWhen(m, hourText)}</span>
                <span className="mo-gl mo-prog-name">{m.name}</span>
                {placeLine(m) || m.text ? <span className="mo-p is-small">{placeLine(m) || m.text}</span> : null}
              </div>
            ))}
          </div>
          <AgendaLink v={v} className="mo-btn" style={{ marginTop: 22 }}>
            Ajouter à mon agenda
          </AgendaLink>
        </div>
        <Photo src={v.photos.venue} tone={3} label="Votre photo, le lieu" preview={ctx.preview} frame={false} className="mo-prog-side" />
      </div>
    </section>
  );
}

function Lieu({ ctx }) {
  const { v } = ctx;
  const c = v.content;
  const [, a2, a3] = v.photos.ambiance || [];
  return (
    <>
      <section id="lieu" className="mo-lieu">
        <h2 className="mo-lab mo-lieu-title">Le lieu</h2>
        {c.venue.text ? <p className="mo-p mo-col">{c.venue.text}</p> : null}
        {v.venueAddress ? (
          <>
            <span className="mo-lab is-small">Adresse</span>
            <span className="mo-acc mo-addr">{v.venueAddress}</span>
          </>
        ) : null}
        {c.travel.map((t, i) => (
          <p key={i} className="mo-p mo-col">
            <span className="mo-ink">{travelLabel(t)}.</span> {t.text}
          </p>
        ))}
        <RouteLink v={v} className="mo-btn" style={{ marginTop: 10 }}>
          Voir l’itinéraire
        </RouteLink>
      </section>
      <div className="mo-strip">
        <Photo src={a2} tone={1} label="Votre photo, la table" preview={ctx.preview} />
        <Photo src={v.photos.venue} tone={3} label="Le lieu" preview={ctx.preview} frame={false} />
        <Photo src={a3} tone={2} label="Votre photo, le jardin" preview={ctx.preview} />
      </div>
    </>
  );
}

function Pratique({ ctx }) {
  const { v, keys } = ctx;
  const c = v.content;
  const cols = [];
  // Les trajets sont dans « Le lieu » ; sans cette rubrique, ils viennent ici
  if (!keys.includes("lieu") && c.travel.length)
    cols.push(
      <div key="venir">
        <h3 className="mo-lab mo-h3">Venir</h3>
        <div className="mo-col-list">
          {c.travel.map((t, i) => (
            <p key={i} className="mo-p">
              <span className="mo-ink">{travelLabel(t)}.</span> {t.text}
            </p>
          ))}
        </div>
      </div>,
    );
  if (c.stays.length)
    cols.push(
      <div key="loger">
        <h3 className="mo-lab mo-h3">Se loger</h3>
        <div className="mo-col-list">
          {c.stays.map((s, i) => (
            <p key={i} className="mo-p">
              <span className="mo-ink">{s.name}</span>
              {[s.distance, s.note].filter(Boolean).length ? (
                <>
                  <br />
                  {[s.distance, s.note].filter(Boolean).join(" · ")}
                </>
              ) : null}
            </p>
          ))}
        </div>
      </div>,
    );
  if (!keys.includes("tenue") && (c.dress.title || c.dress.text))
    cols.push(
      <div key="dress">
        <h3 className="mo-lab mo-h3">Dress code</h3>
        <p className="mo-p">
          {c.dress.title ? (
            <>
              <span className="mo-ink">{c.dress.title}.</span>
              <br />
            </>
          ) : null}
          {c.dress.text}
        </p>
      </div>,
    );
  if (c.kids.title || c.kids.text)
    cols.push(
      <div key="kids">
        <h3 className="mo-lab mo-h3">Enfants</h3>
        <p className="mo-p">
          {c.kids.title ? (
            <>
              <span className="mo-ink">{c.kids.title}.</span>
              <br />
            </>
          ) : null}
          {c.kids.text}
        </p>
      </div>,
    );
  return (
    <section id="pratique" className="mo-tint mo-prat">
      <h2 className="mo-gl mo-acc mo-h2 mo-center">Bon à savoir</h2>
      <div className="mo-prat-grid" style={{ "--n": cols.length }}>
        {cols}
      </div>
    </section>
  );
}

function Questions({ ctx }) {
  const c = ctx.v.content;
  return (
    <section id="questions" className="mo-q">
      <h3 className="mo-gl mo-acc mo-h3b">Une question ?</h3>
      {c.contacts.length ? <p className="mo-p mo-narrow">{witnesses(c.contacts)}, sont là pour vous.</p> : null}
      {c.contacts.length ? (
        <div className="mo-btns">
          {c.contacts.map((x, i) =>
            contactHref(x) ? (
              <a key={i} className="mo-btn" href={contactHref(x)}>
                Écrire à {x.name}
              </a>
            ) : null,
          )}
        </div>
      ) : null}
      {c.faq.length ? (
        <div className="mo-faq">
          <Faq items={c.faq} titleClass="mo-gl mo-faq-q" textClass="mo-p" />
        </div>
      ) : null}
    </section>
  );
}

// Rubriques absentes de la maquette Moisson : même vocabulaire (Gloock, capitales Jost, fond blanc)
function Simple({ id, title, kicker, tint, children }) {
  return (
    <section id={id} className={`mo-simple${tint ? " mo-tint" : ""}`}>
      {kicker ? <span className="mo-lab">{kicker}</span> : null}
      <h2 className="mo-gl mo-acc mo-h2">{title}</h2>
      {children}
    </section>
  );
}

function Mot({ ctx }) {
  return (
    <Simple id="mot" title="Chers amis">
      <p className="mo-p mo-col">{ctx.v.content.mot}</p>
    </Simple>
  );
}

function Tenue({ ctx }) {
  const { dress } = ctx.v.content;
  return (
    <Simple id="tenue" kicker="Dress code" title={dress.title || "La tenue"}>
      {dress.text ? <p className="mo-p mo-col">{dress.text}</p> : null}
      {dress.colors.length ? (
        <div className="mo-swatches">
          {dress.colors.map((x, i) => (
            <div key={i}>
              <span style={{ background: x.color }} />
              <span className="mo-lab is-small">{x.name}</span>
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
    <Simple id="histoire" kicker="Comment tout a commencé" title={v.content.story.title || "Notre histoire"}>
      {v.content.story.text ? <p className="mo-p mo-col">{v.content.story.text}</p> : null}
      <div className="mo-pair">
        <Photo src={a} tone={1} preview={ctx.preview} />
        <Photo src={b} tone={2} preview={ctx.preview} />
      </div>
    </Simple>
  );
}

function Gallery({ ctx, id, title, photos, note }) {
  const tiles = photos?.length ? photos : [null, null, null];
  return (
    <Simple id={id} title={title}>
      <div className="mo-gallery">
        {tiles.map((src, i) => (
          <Photo key={i} src={src} tone={(i % 3) + 1} preview={ctx.preview} />
        ))}
      </div>
      {!photos?.length && note ? <span className="mo-lab is-small">{note}</span> : null}
    </Simple>
  );
}

function Citation({ ctx }) {
  const { v } = ctx;
  return (
    <section id="citation" className="mo-citation">
      <Photo src={v.photos.citation} tone={2} label="Votre photo" preview={ctx.preview} />
      {v.content.citation ? <p className="mo-gl">{v.content.citation}</p> : null}
    </section>
  );
}

function Reponse({ ctx }) {
  const { v } = ctx;
  const res = useSavedResponse(v.formSlug, ctx.preview);
  return (
    <Simple id="reponse" kicker={res ? "Merci, votre réponse est enregistrée" : "Votre réponse"} title={res ? (res.present === false ? "Vous nous manquerez" : "Vous serez des nôtres") : "Serez-vous des nôtres ?"} tint>
      {res ? (
        <p className="mo-p mo-col">
          <span className="mo-ink">{res.names}</span>
          {res.moments?.length ? ` · ${joinList(res.moments)}` : ""}
        </p>
      ) : null}
      {v.formSlug ? (
        <a className="mo-btn" href={`/f/${v.formSlug}`}>
          {res ? "Changer ma réponse" : "Répondre"}
        </a>
      ) : null}
    </Simple>
  );
}

function Partage({ ctx }) {
  const { v } = ctx;
  const share = useShare(v);
  return (
    <Simple id="partage" title="Partagez le site">
      <div className="mo-share">
        <QR url={ctx.shareUrl || share.url} size={84} />
        <div className="mo-btns is-col">
          <a className="mo-btn" href={share.whatsapp} target="_blank" rel="noopener noreferrer">
            WhatsApp
          </a>
          <button type="button" className="mo-btn" onClick={share.copy}>
            {share.copied ? "Lien copié" : "Copier le lien"}
          </button>
        </div>
      </div>
      {v.content.whatsapp ? (
        <a className="mo-acc mo-addr" href={v.content.whatsapp} target="_blank" rel="noopener noreferrer">
          Rejoindre notre groupe
        </a>
      ) : null}
    </Simple>
  );
}

function Footer({ ctx }) {
  return (
    <footer className="mo-footer">
      <span className="mo-gl">{ctx.v.names}</span>
      <span className="mo-lab is-small is-soft">Fait avec Merry</span>
    </footer>
  );
}

const Moisson = {
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
export default Moisson;
