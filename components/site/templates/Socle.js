"use client";

// Le socle commun des sites de mariage (canvas « 4 - sites refs », planche « Proposition · socle commun,
// trois structures »). Mêmes blocs, mêmes textes, mêmes photos pour les trois mises en page :
// - cadre : la photo en grand, les prénoms dessus, les blocs centrés en dessous ;
// - edito : les prénoms en titre de journal, la photo encadrée, le texte aligné à gauche ;
// - cote : la photo fixe à gauche, tout le reste défile à droite (en haut sur téléphone).
// Deux polices (un titre sobre, Inter pour le texte), une couleur d'accent, pas d'ornement ni de compte à rebours.

import { useState } from "react";
import { contactHref, hourText } from "@/lib/site/model";
import { AgendaLink, Faq, Photo, RouteLink, joinList, useSavedResponse } from "../parts";
import GuestFormInline from "../GuestFormInline";
import { F, L } from "../edit";
import { momentWhen, placeLine, travelLabel, witnesses } from "../kit";

// Une photo du couple, avec « Recadrer » dans l'éditeur (haut, centre, bas)
function Pic({ ctx, k, label, className }) {
  const { v } = ctx;
  const crop = v.content.crop?.[k];
  return <Photo path={`photos.${k}`} src={v.photos[k]} tone={k === "cover" ? 1 : 3} label={label} preview={ctx.preview} frame={false} position={crop} cropKey={`crop.${k}`} className={className} />;
}

function Names({ v, as: Tag = "h1", className = "" }) {
  return (
    <Tag className={`so-names ${className}`}>
      <F k="names.p1" placeholder="Prénom" value={v.p1 || v.names} />
      {v.p2 ? (
        <>
          {" "}&amp; <F k="names.p2" placeholder="Prénom" value={v.p2} />
        </>
      ) : null}
    </Tag>
  );
}

function When({ v }) {
  const line = [v.date?.long, v.venueName].filter(Boolean).join(" · ");
  return line ? <span className="so-when">{line}</span> : null;
}

function Nav({ ctx, className = "" }) {
  if (!ctx.nav.length) return null;
  return (
    <nav className={`so-nav ${className}`}>
      {ctx.nav.map((n) => (
        <a key={n.key} href={`#${n.key}`} onClickCapture={(e) => ctx.edit && e.preventDefault()}>
          <L>{n.label}</L>
        </a>
      ))}
    </nav>
  );
}

// Un bloc : petit titre, titre, contenu ; la mise en page le dispose (centré, en colonne, à droite)
function Block({ id, kicker, title, children, tint }) {
  return (
    <section id={id} className={`so-block${tint ? " is-tint" : ""}`}>
      <div className="so-block-head">
        {kicker ? <span className="so-kicker"><L>{kicker}</L></span> : null}
        {title ? <h2 className="so-h2">{typeof title === "string" ? <L>{title}</L> : title}</h2> : null}
      </div>
      <div className="so-block-body">{children}</div>
    </section>
  );
}

function Mot({ ctx }) {
  return (
    <Block id="mot" kicker="Bienvenue" title="Chers amis">
      <F k="mot" multiline placeholder="Votre mot d’accueil" as="p" className="so-p" value={ctx.v.content.mot} />
    </Block>
  );
}

function Jour({ ctx }) {
  const { v } = ctx;
  return (
    <Block id="jour" kicker="Le jour" title={v.date?.long || "La date"}>
      <p className="so-p">{[v.timeText, v.venueName, v.place].filter(Boolean).join(" · ")}</p>
    </Block>
  );
}

function Programme({ ctx }) {
  const { v } = ctx;
  return (
    <Block id="programme" kicker="Le programme" title={v.weekend ? "Le week-end" : "Le jour J"}>
      <F k="welcome" multiline placeholder="Votre mot de bienvenue" as="p" className="so-p" value={v.content.welcome} />
      <ul className="so-list">
        {v.moments.map((m) => (
          <li key={m.id}>
            <F k={`moments.${m.id}.name`} placeholder="Le moment" as="strong" className="so-item" value={m.name} />
            <span className="so-meta">{momentWhen(m, hourText)}</span>
            {placeLine(m) || m.text ? <span className="so-p is-small">{placeLine(m) || m.text}</span> : null}
          </li>
        ))}
      </ul>
      <AgendaLink v={v} className="so-link">
        <L>Ajouter à mon agenda</L>
      </AgendaLink>
    </Block>
  );
}

function Lieu({ ctx }) {
  const { v } = ctx;
  const c = v.content;
  return (
    <Block id="lieu" kicker="Le lieu" title={<F k="venue.name" placeholder="Le nom du lieu" value={v.venueName || "Le lieu"} />}>
      {ctx.structure !== "cote" ? <Pic ctx={ctx} k="venue" label="Votre photo, le lieu" className="so-venue-photo" /> : null}
      <F k="venue.text" multiline placeholder="Quelques mots sur le lieu" as="p" className="so-p" value={c.venue.text} />
      <F k="venue.address" placeholder="L’adresse du lieu" as="p" className="so-p so-ink" value={v.venueAddress} />
      {c.travel.length ? (
        <ul className="so-list is-tight">
          {c.travel.map((t, i) => (
            <li key={i}>
              <strong className="so-item is-small">{travelLabel(t)}</strong>
              <span className="so-p is-small">{t.text}</span>
            </li>
          ))}
        </ul>
      ) : null}
      <RouteLink v={v} className="so-link">
        <L>Voir l’itinéraire</L>
      </RouteLink>
    </Block>
  );
}

function Pratique({ ctx }) {
  const { v, keys } = ctx;
  const c = v.content;
  const items = [];
  if (!keys.includes("lieu")) for (const t of c.travel) items.push([travelLabel(t), t.text]);
  for (const s of c.stays) items.push([s.name, [s.distance, s.note].filter(Boolean).join(" · ")]);
  if (c.dress.title || c.dress.text) items.push([c.dress.title || "Dress code", c.dress.text]);
  if (c.kids.title || c.kids.text) items.push([c.kids.title || "Les enfants", c.kids.text]);
  return (
    <Block id="pratique" kicker="Bon à savoir" title="Infos pratiques" tint>
      <ul className="so-list">
        {items.map(([t, x], i) => (
          <li key={i}>
            <strong className="so-item is-small">{t}</strong>
            {x ? <span className="so-p is-small">{x}</span> : null}
          </li>
        ))}
      </ul>
      {c.contacts.length ? <p className="so-p is-small">{witnesses(c.contacts)}, sont là pour vos questions.</p> : null}
      {c.contacts.some(contactHref) ? (
        <div className="so-links">
          {c.contacts.map((x, i) =>
            contactHref(x) ? (
              <a key={i} className="so-link" href={contactHref(x)}>
                Écrire à {x.name}
              </a>
            ) : null,
          )}
        </div>
      ) : null}
      {c.faq.length ? <Faq items={c.faq} titleClass="so-item is-small" textClass="so-p is-small" /> : null}
    </Block>
  );
}

function Reponse({ ctx }) {
  const { v } = ctx;
  const [reload, setReload] = useState(0);
  const res = useSavedResponse(v.formSlug, ctx.preview, reload);
  return (
    <Block id="reponse" kicker={res ? "Merci, c’est noté" : "Votre réponse"} title={res ? (res.present === false ? "Vous nous manquerez" : "Vous serez des nôtres") : "Serez-vous des nôtres ?"}>
      {res ? (
        <>
          <p className="so-p">
            <span className="so-ink">{res.names}</span>
            {res.moments?.length ? ` · ${joinList(res.moments)}` : ""}
          </p>
          {v.formSlug ? (
            <a className="so-link" href={`/f/${v.formSlug}`}>
              Changer ma réponse
            </a>
          ) : null}
        </>
      ) : v.formSlug ? (
        <GuestFormInline formSlug={v.formSlug} preview={ctx.preview} onAnswered={() => setReload((n) => n + 1)} />
      ) : null}
    </Block>
  );
}

function Footer({ ctx }) {
  return (
    <footer className="so-footer">
      <span className="so-footer-names">{ctx.v.names}</span>
      <span className="so-kicker is-soft"><L>Fait avec Merry</L></span>
    </footer>
  );
}

const SECTIONS = { mot: Mot, jour: Jour, programme: Programme, lieu: Lieu, pratique: Pratique, reponse: Reponse };
const visible = (key, v) => key !== "reponse" || !!v.formSlug;

// Plein cadre
const Cadre = {
  Top: ({ ctx }) => (
    <header className="so-hero">
      <Pic ctx={ctx} k="cover" label="Votre photo, en grand" className="so-hero-photo" />
      <Nav ctx={ctx} className="is-over" />
      <div className="so-hero-text">
        <Names v={ctx.v} />
        <When v={ctx.v} />
      </div>
    </header>
  ),
  Layout: ({ ctx, render }) => <div className="so-flow">{ctx.keys.map((k) => render(k))}</div>,
  Footer,
  sections: SECTIONS,
  visible,
};

// Éditorial
const Edito = {
  Top: ({ ctx }) => (
    <header className="so-mast">
      <div className="so-bar">
        <span className="so-initials">{ctx.v.initials.join(" & ")}</span>
        <Nav ctx={ctx} />
      </div>
      <div className="so-mast-text">
        <Names v={ctx.v} />
        <When v={ctx.v} />
      </div>
      <Pic ctx={ctx} k="cover" label="Votre photo" className="so-mast-photo" />
    </header>
  ),
  Layout: ({ ctx, render }) => <div className="so-flow">{ctx.keys.map((k) => render(k))}</div>,
  Footer,
  sections: SECTIONS,
  visible,
};

// Côte à côte : la photo reste en place, la colonne de droite porte tout le reste
const Cote = {
  Top: () => null,
  Layout: ({ ctx, render }) => {
    return (
      <div className="so-split">
        <div className="so-split-photo">
          <Pic ctx={ctx} k="cover" label="Votre photo" className="so-split-pic" />
        </div>
        <div className="so-split-side">
          <Nav ctx={ctx} />
          <div className="so-split-head">
            <When v={ctx.v} />
            <Names v={ctx.v} />
          </div>
          <div className="so-flow">{ctx.keys.map((k) => render(k))}</div>
          <Footer ctx={ctx} />
        </div>
      </div>
    );
  },
  Footer: () => null,
  sections: SECTIONS,
  visible,
};

export { Cadre, Edito, Cote };
