"use client";

// Modèle 5 · Colline (Bohème) : site de photographe, logo en médaillon, grandes photos.
// Maquettes Site-Colline (1440 px) et Site-Colline-Tel (390 px).

import { useState } from "react";
import { contactHref, hourText } from "@/lib/site/model";
import { AgendaLink, Faq, Ico, Orn, Photo, QR, RouteLink, joinList, useSavedResponse, useShare } from "../parts";
import GuestFormInline from "../GuestFormInline";
import { F, L } from "../edit";
import { momentWhen, placeLine, travelLabel, witnesses } from "../kit";

// Titres en capitales Cormorant avec un mot en italique (« Le programme » : le premier, « Les essentiels » : le dernier)
function Ital({ text, at = "last" }) {
  const words = String(text || "").trim().split(/\s+/);
  if (words.length < 2) return <i>{text}</i>;
  if (at === "first")
    return (
      <>
        <i>{words[0]}</i> {words.slice(1).join(" ")}
      </>
    );
  return (
    <>
      {words.slice(0, -1).join(" ")} <i>{words[words.length - 1]}</i>
    </>
  );
}

function Top({ ctx }) {
  const { v } = ctx;
  const half = Math.ceil(ctx.nav.length / 2);
  const left = ctx.nav.slice(0, half);
  const right = ctx.nav.slice(half);
  return (
    <>
      <div className="co-band">
        <span className="co-lab">{[v.date?.long, v.venueName].filter(Boolean).join(" · ")}</span>
        {ctx.keys.includes("programme") ? (
          <a href="#programme" className="co-lab is-soft">
            <L>Voir le programme</L>
          </a>
        ) : null}
      </div>
      <div className="co-header">
        <nav className="is-l">
          {left.map((n) => (
            <a key={n.key} href={`#${n.key}`} className="co-lab">
              {n.label}
            </a>
          ))}
        </nav>
        <div className="co-medal-slot">
          <div className="co-medal">
            <Orn name="medallion" width={61} height={42} />
            <span className="co-cg"><F k="names.p1" placeholder="Prénom" value={v.p1 || v.names} />{v.p2 ? <> &amp; <F k="names.p2" placeholder="Prénom" value={v.p2} /></> : null}</span>
          </div>
        </div>
        <nav className="is-r">
          {right.map((n) => (
            <a key={n.key} href={`#${n.key}`} className="co-lab">
              {n.label}
            </a>
          ))}
        </nav>
      </div>
      <div className="co-hero">
        <Photo path="photos.cover" src={v.photos.cover} tone={1} label="Votre photo, paysage" preview={ctx.preview} className="co-hero-photo" />
        <div className="co-hero-text">
          {v.date ? <span className="co-lab is-white">{["Le", v.date.noWeekday, v.place ? `à ${v.place}` : ""].filter(Boolean).join(" ").replace(/ à /, ", à ")}</span> : null}
          {ctx.keys.includes("programme") ? (
            <a className="co-btn-o" href="#programme">
              <L>Le programme</L>
            </a>
          ) : null}
        </div>
      </div>
    </>
  );
}

function Jour({ ctx }) {
  const { v } = ctx;
  const c = v.content;
  const cells = [
    v.date ? ["Quand", v.date.long, v.weekend ? `Le week-end du ${v.weekend.first.day} au ${v.weekend.last.day}` : v.timeText ? `À ${v.timeText}` : ""] : null,
    v.venueName ? ["Où", v.venueName, v.venueAddress] : null,
    c.dress.title ? ["Tenue", c.dress.title, c.dress.text?.split(/[.:]/)[0]?.trim() || ""] : null,
  ].filter(Boolean);
  return (
    <section id="jour" className="co-tint co-jour">
      <span className="co-lab">{v.namesEt ? `${v.namesEt.replace(" et ", " & ")} se marient` : "Nous nous marions"}</span>
      <F k="welcome" multiline placeholder="Votre mot de bienvenue" as="p" className="co-p co-jour-p" value={c.welcome} />
      <div className="co-jour-cells">
        {cells.map(([k, a, b]) => (
          <div key={k}>
            <span className="co-lab is-soft is-small">{k}</span>
            <span className="co-cg is-plain">{a}</span>
            {b ? <span className="co-p is-small">{b}</span> : null}
          </div>
        ))}
      </div>
    </section>
  );
}

function Programme({ ctx }) {
  const { v } = ctx;
  const [big] = v.photos.ambiance || [];
  return (
    <section id="programme" className="co-prog">
      <div className="co-prog-sprig">
        <Orn name="sprig200" />
      </div>
      <div className="co-prog-left">
        <div className="co-prog-text">
          <h2 className="co-cg co-h2">
            <Ital text="Le programme" at="first" />
          </h2>
          <div className="co-prog-list">
            {v.moments.map((m) => (
              <div key={m.id}>
                <span className="co-lab is-acc is-small">{momentWhen(m, hourText)}</span>
                <F k={`moments.${m.id}.name`} placeholder="Le moment" as="span" className="co-cg is-plain co-prog-name" value={m.name} />
                {m.text || placeLine(m) ? (
                  <span className="co-p is-small">
                    {m.text}
                    {m.text && placeLine(m) ? <br /> : null}
                    {placeLine(m)}
                  </span>
                ) : null}
              </div>
            ))}
          </div>
          <AgendaLink v={v} className="co-btn" style={{ marginTop: 22 }}>
            <Ico name="agenda" size={15} sw={1.3} />
            <L>Ajouter à mon agenda</L>
          </AgendaLink>
        </div>
        <div className="co-vline">
          <span className="co-lab is-soft is-small"><L>Notre week-end</L></span>
        </div>
      </div>
      <div className="co-prog-photos">
        <div className="co-prog-big">
          <Photo src={big || v.photos.cover} tone={1} label="Votre photo" preview={ctx.preview} />
          {v.place || v.date ? <span className="co-al">{[v.place, v.date?.monthLower].filter(Boolean).join(", ")}</span> : null}
        </div>
        <div className="co-prog-small">
          <Photo path="photos.venue" src={v.photos.venue} tone={2} label="Votre photo, le lieu" preview={ctx.preview} frame={false} />
        </div>
      </div>
    </section>
  );
}

function Card({ photo, tone, label, dark, preview, children, className = "" }) {
  return (
    <div className={`co-card ${className}`}>
      <div className="co-card-photo">
        <Photo src={photo} tone={tone} preview={preview} frame={false} />
        {dark ? <span className="co-card-dark" /> : null}
        <span className="co-lab is-white co-card-label"><L>{label}</L></span>
      </div>
      <div className="co-card-text">{children}</div>
    </div>
  );
}

function Pratique({ ctx }) {
  const { v, keys } = ctx;
  const c = v.content;
  const [, a2, a3] = v.photos.ambiance || [];
  const others = [];
  for (const m of v.moments) if (m.address && m.address !== v.venueAddress && !others.some((o) => o.address === m.address)) others.push({ name: m.name, address: m.address });
  const dressHere = !keys.includes("tenue") && !keys.includes("jour") && (c.dress.title || c.dress.text);
  return (
    <section id="pratique" className="co-tint co-ess">
      <div className="co-ess-head">
        <h2 className="co-cg co-h2">
          <Ital text="Les essentiels" />
        </h2>
        <span />
      </div>
      <div className="co-ess-grid">
        <Card photo={v.photos.venue} tone={2} label="Le lieu" dark preview={ctx.preview} className="is-c1">
          {v.venueName ? (
            <p className="co-p">
              <F k="venue.name" placeholder="Le nom du lieu" as="span" className="co-ink" value={v.venueName} />
              {v.venueAddress ? `, ${v.venueAddress}.` : "."}
              {others.length ? ` ${others.map((o) => `${o.name} : ${o.address}`).join(". ")}.` : ""}
            </p>
          ) : null}
          {dressHere ? (
            <p className="co-p">
              <span className="co-ink">{c.dress.title || "Tenue"}.</span> {c.dress.text}
            </p>
          ) : null}
          {c.kids.title || c.kids.text ? (
            <p className="co-p">
              <span className="co-ink"><L>Enfants.</L></span> {[c.kids.title, c.kids.text].filter(Boolean).join(". ")}
            </p>
          ) : null}
        </Card>
        {c.travel.length ? (
          <Card photo={a2} tone={3} label="Venir" preview={ctx.preview} className="is-c2">
            {c.travel.map((t, i) => (
              <p key={i} className="co-p">
                <span className="co-ink">{travelLabel(t)}.</span> {t.text}
              </p>
            ))}
          </Card>
        ) : null}
        {c.stays.length ? (
          <Card photo={a3} tone={1} label="Se loger" preview={ctx.preview} className="is-c3">
            {c.stays.map((s, i) => (
              <p key={i} className="co-p">
                <span className="co-ink">{s.name}</span>
                {[s.distance, s.note].filter(Boolean).length ? ` · ${[s.distance, s.note].filter(Boolean).join(" · ")}` : ""}
              </p>
            ))}
          </Card>
        ) : null}
      </div>
    </section>
  );
}

function Histoire({ ctx }) {
  const { v } = ctx;
  const [a, b] = v.photos.story || [];
  return (
    <section id="histoire" className="co-story">
      <div className="co-story-top">
        <Photo src={a} tone={2} label="Votre photo, détail" preview={ctx.preview} className="co-story-photo" />
        <div className="co-story-over">
          <span className="co-lab is-small"><L>C’est ici que tout a commencé</L></span>
          <h2 className="co-cg co-h2">
            <Ital text={v.content.story.title || "Notre histoire"} />
          </h2>
        </div>
        <div className="co-story-round">
          <Photo src={b} tone={1} label="Vous deux" preview={ctx.preview} frame={false} />
        </div>
      </div>
      <div className="co-tint co-story-text">
        <F k="story.text" multiline placeholder="Votre histoire" as="p" className="co-p co-story-p" value={v.content.story.text} />
        <span className="co-lab is-small">{v.names}</span>
      </div>
    </section>
  );
}

function Questions({ ctx }) {
  const { v } = ctx;
  const c = v.content;
  const [, , , a4] = v.photos.ambiance || [];
  return (
    <section id="questions" className="co-q">
      <Photo src={a4} tone={2} label="Votre photo" preview={ctx.preview} className="co-q-photo" />
      <div className="co-q-body">
        <div className="co-vline is-l">
          <span className="co-lab is-soft is-small">{c.contacts.length ? "Nos témoins" : "Bon à savoir"}</span>
        </div>
        <div className="co-q-text">
          <h2 className="co-cg co-h2">
            Une <i><L>question</L></i> ?
          </h2>
          {c.contacts.length ? <p className="co-p">{witnesses(c.contacts)} connaissent tous les détails du week-end.</p> : null}
          {c.contacts.length ? (
            <div className="co-q-btns">
              {c.contacts.map((x, i) =>
                contactHref(x) ? (
                  <a key={i} className="co-btn" href={contactHref(x)}>
                    Écrire à {x.name}
                  </a>
                ) : null,
              )}
            </div>
          ) : null}
          {c.faq.length ? (
            <div className="co-faq">
              <Faq items={c.faq} titleClass="co-cg is-plain co-faq-q" textClass="co-p" />
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

// Rubriques absentes de la maquette Colline : même vocabulaire (capitales Cormorant, bande sable)
function Simple({ id, title, kicker, tint, children }) {
  return (
    <section id={id} className={`co-simple${tint ? " co-tint" : ""}`}>
      {kicker ? <span className="co-lab is-small"><L>{kicker}</L></span> : null}
      <h2 className="co-cg co-h2">
        <Ital text={title} />
      </h2>
      {children}
    </section>
  );
}

function Mot({ ctx }) {
  return (
    <Simple id="mot" title="Chers amis" kicker="Un mot pour vous" tint>
      <F k="mot" multiline placeholder="Votre mot d’accueil" as="p" className="co-p co-jour-p" value={ctx.v.content.mot} />
    </Simple>
  );
}

function Lieu({ ctx }) {
  const { v } = ctx;
  return (
    <section id="lieu" className="co-lieu">
      <Photo path="photos.venue" src={v.photos.venue} tone={2} label="Votre photo, le lieu" preview={ctx.preview} className="co-lieu-photo" />
      <div className="co-q-text">
        <span className="co-lab is-small"><L>Le lieu</L></span>
        <F k="venue.name" placeholder="Le nom du lieu" as="h2" className="co-cg co-h2 is-plain" value={v.venueName} />
        <F k="venue.address" placeholder="L’adresse du lieu" as="p" className="co-p" value={v.venueAddress} />
        <F k="venue.text" multiline placeholder="Quelques mots sur le lieu" as="p" className="co-p" value={v.content.venue.text} />
        <RouteLink v={v} className="co-btn">
          <L>Voir l’itinéraire</L>
        </RouteLink>
      </div>
    </section>
  );
}

function Tenue({ ctx }) {
  const { dress } = ctx.v.content;
  return (
    <Simple id="tenue" title={<F k="dress.title" placeholder="Le dress code" value={dress.title || "La tenue"} />} kicker="Dress code">
      <F k="dress.text" multiline placeholder="La tenue en quelques mots" as="p" className="co-p co-jour-p" value={dress.text} />
      {dress.colors.length ? (
        <div className="co-swatches">
          {dress.colors.map((x, i) => (
            <div key={i}>
              <span style={{ background: x.color }} />
              <span className="co-lab is-small">{x.name}</span>
            </div>
          ))}
        </div>
      ) : null}
    </Simple>
  );
}

function Gallery({ ctx, id, title, photos, note }) {
  const tiles = photos?.length ? photos : [null, null, null];
  return (
    <Simple id={id} title={title}>
      <div className="co-gallery">
        {tiles.map((src, i) => (
          <Photo key={i} src={src} tone={(i % 3) + 1} preview={ctx.preview} frame={false} />
        ))}
      </div>
      {!photos?.length && note ? <span className="co-lab is-small is-soft"><L>{note}</L></span> : null}
    </Simple>
  );
}

function Citation({ ctx }) {
  const { v } = ctx;
  return (
    <section id="citation" className="co-citation">
      <Photo path="photos.citation" src={v.photos.citation} tone={1} label="Votre photo" preview={ctx.preview} />
      <F k="citation" multiline placeholder="Une phrase qui vous ressemble" as="p" className="co-al" value={v.content.citation} />
    </section>
  );
}

function Reponse({ ctx }) {
  const { v } = ctx;
  const [reload, setReload] = useState(0);
  const res = useSavedResponse(v.formSlug, ctx.preview, reload);
  return (
    <Simple id="reponse" title="Votre réponse" kicker={res ? "Merci, elle est enregistrée" : "Pas encore répondu ?"} tint>
      {res ? (
        <>
          <p className="co-p co-jour-p">
            <span className="co-ink">{res.names}</span>
            {res.moments?.length ? ` · ${joinList(res.moments)}` : ""}
          </p>
          {v.formSlug ? (
            <a className="co-btn" href={`/f/${v.formSlug}`}>
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

function Partage({ ctx }) {
  const { v } = ctx;
  const share = useShare(v);
  return (
    <Simple id="partage" title="Faites suivre" kicker="Le lien du site">
      <div className="co-share">
        <QR url={ctx.shareUrl || share.url} size={84} />
        <div>
          <a className="co-btn" href={share.whatsapp} target="_blank" rel="noopener noreferrer">
            <L>Partager sur WhatsApp</L>
          </a>
          <button type="button" className="co-btn-o is-ink" onClick={share.copy}>
            {share.copied ? "Lien copié" : "Copier le lien"}
          </button>
          {v.content.whatsapp ? (
            <a className="co-lab is-acc" href={v.content.whatsapp} target="_blank" rel="noopener noreferrer">
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
    <footer className="co-tint co-footer">
      <span className="co-cg">{v.names}</span>
      <span className="co-lab is-soft is-small">{[v.date?.dots, v.place, "Fait avec Merry"].filter(Boolean).join(" · ")}</span>
    </footer>
  );
}

const Colline = {
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
export default Colline;
