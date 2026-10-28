"use client";

// Modèle 6 · Belvédère (Chic) : grande photo de lac, écriture fine, bandeau programme bleu pâle.
// Maquettes Site-Belvedere (1440 px) et Site-Belvedere-Tel (390 px).

import { contactHref, hourText } from "@/lib/site/model";
import { AgendaLink, Faq, Ico, Orn, Photo, QR, RouteLink, joinList, useSavedResponse, useShare } from "../parts";
import { F, L } from "../edit";
import { travelLabel, witnesses } from "../kit";

const lower = (s) => (s ? s.charAt(0).toLowerCase() + s.slice(1) : "");

function Top({ ctx }) {
  const { v } = ctx;
  return (
    <section id="accueil" className="bv-hero">
      <div className="bv-nav">
        <span className="bv-lab is-white bv-brand">{v.initials.join(" | ")}</span>
        <nav>
          {ctx.nav.map((n) => (
            <a key={n.key} href={`#${n.key}`} className="bv-lab is-white">
              {n.label}
            </a>
          ))}
        </nav>
        <span />
      </div>
      <Photo path="photos.cover" src={v.photos.cover} tone={1} label="Votre photo" preview={ctx.preview} className="bv-hero-photo" />
      <div className="bv-hero-text">
        <F k="tagline" placeholder="Une phrase sous vos prénoms" as="span" className="bv-lab is-white bv-lh" value={v.content.tagline} />
        <h1 className="bv-caps">
          <F k="names.p1" placeholder="Prénom" value={v.p1} />{" "}
          {v.p2 ? (
            <>
              <span className="bv-ms"><L>et</L></span>
              <br />
              <F k="names.p2" placeholder="Prénom" value={v.p2} />
            </>
          ) : null}
        </h1>
        <span className="bv-tick" />
        {v.date ? (
          <span className="bv-lab is-white bv-lh">
            {v.date.noWeekday}
            <br />
            {[v.venueName, v.area].filter(Boolean).join(", ")}
          </span>
        ) : null}
        {ctx.keys.includes("programme") ? (
          <a href="#programme" className="bv-more is-white">
            <Ico name="chevron" size={16} sw={1.2} />
            <L>Le programme</L>
          </a>
        ) : null}
      </div>
      <div className="bv-ms bv-hero-ms">
        <L>Mieux</L>
        <br />
        <L>ensemble</L>
        <br />
        <L>toujours</L>
        <span className="bv-hero-rule" />
      </div>
    </section>
  );
}

function Mot({ ctx }) {
  const { v } = ctx;
  return (
    <section id="mot" className="bv-welcome">
      <Photo path="photos.venue" src={v.photos.venue} tone={2} label="Votre photo, le lieu" preview={ctx.preview} frame={false} className="bv-welcome-photo" />
      <div className="bv-welcome-text">
        <span className="bv-lab is-small"><L>Bienvenue</L></span>
        <h2 className="bv-cg bv-h2">
          <L>Merci d’être</L>
          <br />
          <L>des nôtres.</L>
        </h2>
        <F k="mot" multiline placeholder="Votre mot d’accueil" as="p" className="bv-p" value={v.content.mot} />
        <span className="bv-ms bv-sign">{v.names}</span>
      </div>
      <div className="bv-rose">
        <Orn name="rose" />
        <span className="bv-lab is-small is-soft bv-lh">
          <L>« Même été,</L>
          <br />
          <L>nouvel horizon »</L>
        </span>
      </div>
    </section>
  );
}

function Programme({ ctx }) {
  const { v } = ctx;
  const [a1] = v.photos.ambiance || [];
  return (
    <section id="programme" className="bv-prog">
      <div className="bv-prog-side">
        <Photo src={a1} tone={2} label="Votre photo" preview={ctx.preview} frame={false} />
        <span className="bv-ms bv-prog-ms">
          <L>Bons amis,</L>
          <br />
          <L>beaux jours</L>
        </span>
      </div>
      <div className="bv-prog-mid">
        <span className="bv-lab is-small"><L>La célébration</L></span>
        <h2 className="bv-cg bv-h2 bv-prog-title">{v.weekend ? "Le programme du week-end" : "Le programme"}</h2>
        <div className="bv-prog-grid" style={{ "--n": Math.min(4, v.moments.length) }}>
          {v.moments.map((m, i) => (
            <div key={m.id}>
              <span className="bv-cg bv-num">{String(i + 1).padStart(2, "0")}</span>
              <F k={`moments.${m.id}.name`} placeholder="Le moment" as="span" className="bv-lab bv-prog-name" value={m.name} />
              {m.date ? (
                <span className="bv-p is-small">
                  {m.date.dayMonth}
                  {m.time ? (
                    <>
                      <br />
                      {hourText(m.time)}
                    </>
                  ) : null}
                </span>
              ) : null}
              {m.place || m.address ? (
                <span className="bv-p is-small">
                  {m.place}
                  {m.place && m.address ? <br /> : null}
                  {m.address}
                </span>
              ) : null}
            </div>
          ))}
        </div>
        <AgendaLink v={v} className="bv-more" style={{ marginTop: 18 }}>
          <Ico name="agenda" size={15} sw={1.2} />
          <L>Ajouter à mon agenda</L>
          <Ico name="fleche" size={14} sw={1.2} />
        </AgendaLink>
      </div>
      <div className="bv-prog-side">
        <Photo src={v.photos.citation || v.photos.venue} tone={3} label="Votre photo" preview={ctx.preview} frame={false} />
      </div>
    </section>
  );
}

function Pratique({ ctx }) {
  const { v, keys } = ctx;
  const c = v.content;
  const [, a2, a3, a4] = v.photos.ambiance || [];
  const icons = [
    c.travel.some((t) => t.kind === "train") ? ["train", "Train"] : null,
    c.travel.some((t) => t.kind === "avion") ? ["avion", "Avion"] : null,
    c.stays.length ? ["lit", "Se loger"] : null,
    c.kids.title || c.kids.text ? ["enfant", "Enfants"] : null,
  ].filter(Boolean);
  const dress = !keys.includes("tenue") && (c.dress.title || c.dress.text);
  const showJourJ = dress || c.kids.title || c.kids.text || (!keys.includes("questions") && c.contacts.length);
  return (
    <>
      {c.travel.length || c.stays.length ? (
        <section id="pratique" className="bv-venir">
          <Photo src={a2} tone={1} label="Votre photo, vous deux" preview={ctx.preview} frame={false} className="bv-venir-photo" />
          <div className="bv-venir-text">
            <span className="bv-lab is-small"><L>Les détails</L></span>
            <h2 className="bv-cg bv-h2">{v.place ? `Venir à ${v.place}` : "Venir"}</h2>
            <F k="venue.text" multiline placeholder="Quelques mots sur le lieu" as="p" className="bv-p" value={c.venue.text} />
            {icons.length ? (
              <div className="bv-icons" style={{ "--n": icons.length }}>
                {icons.map(([ic, label]) => (
                  <div key={label}>
                    <Ico name={ic} size={26} />
                    <span className="bv-lab is-small">{label}</span>
                  </div>
                ))}
              </div>
            ) : null}
            <div className="bv-lines">
              {c.travel.map((t, i) => (
                <p key={i} className="bv-p is-small">
                  <span className="bv-ink">{travelLabel(t)}.</span> {t.text}
                </p>
              ))}
              {c.stays.length ? (
                <p className="bv-p is-small">
                  <span className="bv-ink"><L>Se loger.</L></span> {c.stays.map((s) => `${s.name}${s.distance ? ` (${lower(s.distance)})` : ""}`).join(" · ")}.
                </p>
              ) : null}
            </div>
          </div>
          <div className="bv-venir-side">
            <Photo src={a3} tone={2} label="Votre photo" preview={ctx.preview} frame={false} />
            <span className="bv-ms bv-venir-ms">
              <L>En toute</L>
              <br />
              <L>saison</L>
            </span>
          </div>
        </section>
      ) : null}
      {showJourJ ? (
        <section id={c.travel.length || c.stays.length ? "savoir" : "pratique"} className="bv-savoir">
          <Photo src={a4} tone={2} label="Votre photo, détail" preview={ctx.preview} frame={false} className="bv-savoir-photo" />
          <div className="bv-savoir-text">
            <span className="bv-lab is-small"><L>Bon à savoir</L></span>
            <h2 className="bv-cg bv-h2"><L>Le jour J</L></h2>
            {dress ? (
              <div className="bv-item">
                <span className="bv-lab is-small"><L>Dress code</L></span>
                <p className="bv-p is-small">{[c.dress.title, c.dress.text].filter(Boolean).join(". ")}</p>
              </div>
            ) : null}
            {c.kids.title || c.kids.text ? (
              <div className="bv-item">
                <span className="bv-lab is-small"><L>Enfants</L></span>
                <p className="bv-p is-small">{[c.kids.title, c.kids.text].filter(Boolean).join(". ")}</p>
              </div>
            ) : null}
            {!keys.includes("questions") && c.contacts.length ? (
              <div className="bv-item">
                <span className="bv-lab is-small"><L>Une question ?</L></span>
                <p className="bv-p is-small">Écrivez à {witnesses(c.contacts)}.</p>
              </div>
            ) : null}
          </div>
          <span className="bv-lab is-small is-soft bv-lh bv-quote">
            <L>« Une vie</L>
            <br />
            <L>plus belle</L>
            <br />
            <L>avec vous »</L>
          </span>
        </section>
      ) : null}
    </>
  );
}

// Rubriques absentes de la maquette Belvédère : même vocabulaire (Cormorant, filets fins, photos pleine hauteur)
function Simple({ id, kicker, title, children, center = true }) {
  return (
    <section id={id} className={`bv-simple${center ? " is-center" : ""}`}>
      {kicker ? <span className="bv-lab is-small"><L>{kicker}</L></span> : null}
      <h2 className="bv-cg bv-h2"><L>{title}</L></h2>
      {children}
    </section>
  );
}

function Jour({ ctx }) {
  const { v } = ctx;
  return (
    <Simple id="jour" kicker="Notez la date" title={v.date.long}>
      <p className="bv-p">{[v.timeText ? `À ${v.timeText}` : "", v.venueName].filter(Boolean).join(" · ")}</p>
      <div className="bv-row-btns">
        <AgendaLink v={v} className="bv-btn">
          <L>Ajouter à mon agenda</L>
        </AgendaLink>
        <RouteLink v={v} className="bv-more">
          <L>Voir l’itinéraire</L>
          <Ico name="fleche" size={14} sw={1.2} />
        </RouteLink>
      </div>
    </Simple>
  );
}

function Lieu({ ctx }) {
  const { v } = ctx;
  return (
    <section id="lieu" className="bv-venir">
      <Photo path="photos.venue" src={v.photos.venue} tone={1} label="Votre photo, le lieu" preview={ctx.preview} frame={false} className="bv-venir-photo" />
      <div className="bv-venir-text">
        <span className="bv-lab is-small"><L>Le lieu</L></span>
        <F k="venue.name" placeholder="Le nom du lieu" as="h2" className="bv-cg bv-h2" value={v.venueName} />
        <F k="venue.address" placeholder="L’adresse du lieu" as="p" className="bv-p" value={v.venueAddress} />
        <F k="venue.text" multiline placeholder="Quelques mots sur le lieu" as="p" className="bv-p" value={v.content.venue.text} />
        <RouteLink v={v} className="bv-btn">
          <L>Voir l’itinéraire</L>
        </RouteLink>
      </div>
    </section>
  );
}

function Tenue({ ctx }) {
  const { dress } = ctx.v.content;
  return (
    <Simple id="tenue" kicker="Dress code" title={<F k="dress.title" placeholder="Le dress code" value={dress.title || "La tenue"} />}>
      <F k="dress.text" multiline placeholder="La tenue en quelques mots" as="p" className="bv-p bv-narrow" value={dress.text} />
      {dress.colors.length ? (
        <div className="bv-swatches">
          {dress.colors.map((x, i) => (
            <div key={i}>
              <span style={{ background: x.color }} />
              <span className="bv-lab is-small">{x.name}</span>
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
    <section id="histoire" className="bv-story">
      <Photo src={a} tone={1} label="Votre photo" preview={ctx.preview} frame={false} />
      <div className="bv-venir-text">
        <span className="bv-lab is-small"><L>Comment tout a commencé</L></span>
        <F k="story.title" placeholder="Le titre" as="h2" className="bv-cg bv-h2" value={v.content.story.title || "Notre histoire"} />
        <F k="story.text" multiline placeholder="Votre histoire" as="p" className="bv-p" value={v.content.story.text} />
        <span className="bv-ms bv-sign">{v.names}</span>
      </div>
      <Photo src={b} tone={3} preview={ctx.preview} frame={false} />
    </section>
  );
}

function Gallery({ ctx, id, title, photos, note }) {
  const tiles = photos?.length ? photos : [null, null, null, null];
  return (
    <Simple id={id} kicker="En images" title={title}>
      <div className="bv-gallery">
        {tiles.map((src, i) => (
          <Photo key={i} src={src} tone={(i % 3) + 1} preview={ctx.preview} frame={false} />
        ))}
      </div>
      {!photos?.length && note ? <span className="bv-lab is-small is-soft"><L>{note}</L></span> : null}
    </Simple>
  );
}

function Citation({ ctx }) {
  const { v } = ctx;
  return (
    <section id="citation" className="bv-citation">
      <Photo path="photos.citation" src={v.photos.citation} tone={1} label="Votre photo" preview={ctx.preview} frame={false} />
      <F k="citation" multiline placeholder="Une phrase qui vous ressemble" as="p" className="bv-ms" value={v.content.citation} />
    </section>
  );
}

function Reponse({ ctx }) {
  const { v } = ctx;
  const res = useSavedResponse(v.formSlug, ctx.preview);
  return (
    <Simple id="reponse" kicker={res ? "Merci, votre réponse est enregistrée" : "Votre réponse"} title={res ? (res.present === false ? "Vous nous manquerez." : "Vous serez des nôtres.") : "Serez-vous des nôtres ?"}>
      {res ? (
        <p className="bv-p">
          <span className="bv-ink">{res.names}</span>
          {res.moments?.length ? ` · ${joinList(res.moments)}` : ""}
        </p>
      ) : null}
      {v.formSlug ? (
        <a className="bv-btn" href={`/f/${v.formSlug}`}>
          {res ? "Changer ma réponse" : "Répondre"}
        </a>
      ) : null}
    </Simple>
  );
}

function Questions({ ctx }) {
  const c = ctx.v.content;
  return (
    <Simple id="questions" kicker="Bon à savoir" title="Une question ?">
      {c.contacts.length ? <p className="bv-p bv-narrow">Écrivez à {witnesses(c.contacts)}.</p> : null}
      {c.contacts.length ? (
        <div className="bv-row-btns">
          {c.contacts.map((x, i) =>
            contactHref(x) ? (
              <a key={i} className="bv-btn" href={contactHref(x)}>
                Écrire à {x.name}
              </a>
            ) : null,
          )}
        </div>
      ) : null}
      {c.faq.length ? (
        <div className="bv-faq">
          <Faq items={c.faq} titleClass="bv-cg bv-faq-q" textClass="bv-p is-small" />
        </div>
      ) : null}
    </Simple>
  );
}

function Partage({ ctx }) {
  const { v } = ctx;
  const share = useShare(v);
  return (
    <Simple id="partage" kicker="Faites suivre" title="Partagez le site">
      <div className="bv-share">
        <QR url={ctx.shareUrl || share.url} size={84} />
        <div>
          <a className="bv-btn" href={share.whatsapp} target="_blank" rel="noopener noreferrer">
            <L>WhatsApp</L>
          </a>
          <button type="button" className="bv-more" onClick={share.copy}>
            {share.copied ? "Lien copié" : "Copier le lien"}
          </button>
          {v.content.whatsapp ? (
            <a className="bv-more" href={v.content.whatsapp} target="_blank" rel="noopener noreferrer">
              <L>Rejoindre notre groupe</L>
            </a>
          ) : null}
        </div>
      </div>
    </Simple>
  );
}

function Footer({ ctx }) {
  const { v } = ctx;
  return (
    <footer className="bv-footer">
      <span className="bv-lab bv-brand">{v.initials.join(" | ")}</span>
      <span className="bv-ms">{v.names}</span>
      <span className="bv-lab is-small is-soft"><L>Fait avec Merry</L></span>
    </footer>
  );
}

const Belvedere = {
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
export default Belvedere;
