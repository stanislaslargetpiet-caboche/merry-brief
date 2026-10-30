"use client";

// Modèle 3 · Perle (Chic) : rangs de perles, capitales didone, programme sur bande taupe.
// Maquettes Site-Perle (1440 px) et Site-Perle-Tel (390 px).

import { useState } from "react";
import { contactHref, hourClock, mapsUrl } from "@/lib/site/model";
import { AgendaLink, Faq, Orn, Pearls, PearlPath, Photo, QR, joinList, useCountdown, useSavedResponse, useShare } from "../parts";
import GuestFormInline from "../GuestFormInline";
import { F, L } from "../edit";
import { travelLabel, writeTo } from "../kit";

const Head = ({ title, script, light }) => (
  <div className="pe-head">
    <h2 className={`pe-bd${light ? " is-light" : ""}`}><L>{title}</L></h2>
    {script ? <div className={`pe-sc${light ? " is-light" : ""}`}><L>{script}</L></div> : null}
  </div>
);
const lower = (s) => (s ? s.charAt(0).toLowerCase() + s.slice(1) : "");
const initials = (v) => v.initials.join(" & ");

function Top({ ctx }) {
  const { v } = ctx;
  return (
    <>
      <header className="pe-header">
        <div className="pe-brand">
          <span className="pe-sc">{initials(v)}</span>
          {v.date ? <span className="pe-lab is-ink">{`${v.date.dd} · ${v.date.mm} · ${v.date.yy}`}</span> : null}
        </div>
        <nav>
          {ctx.nav.map((n) => (
            <a key={n.key} href={`#${n.key}`} className="pe-lab is-ink" onClickCapture={(e) => ctx.edit && e.preventDefault()}>
              <L>{n.label}</L>
            </a>
          ))}
        </nav>
        <span />
      </header>
      <section className="pe-hero">
        <div>
          <div className="pe-hero-names">
            <h1 className="pe-bd">
              <F k="names.p1" placeholder="Prénom" value={v.p1} />
              {v.p2 ? (
                <>
                  <br />
                  <F k="names.p2" placeholder="Prénom" value={v.p2} />
                </>
              ) : null}
            </h1>
            <div className="pe-sc pe-hero-sc"><L>Notre mariage !</L></div>
          </div>
          <div className="pe-hero-pearls">
            <Pearls width={420} sag={30} r={5} />
          </div>
          {v.date ? <p className="pe-lab is-ink pe-hero-when">{[v.date.long, v.venueName].filter(Boolean).join(" · ")}</p> : null}
        </div>
        <Photo path="photos.cover" src={v.photos.cover} tone={1} label="Votre photo, noir et blanc" preview={ctx.preview} gray className="pe-hero-photo" />
      </section>
    </>
  );
}

// Les trois jours autour du mariage, le jour J au milieu
function DateStrip({ v }) {
  const d = v.date.date;
  const day = (n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  const name = (x) => x.toLocaleDateString("fr-FR", { weekday: "long" }).replace(/^./, (c) => c.toUpperCase());
  return (
    <div className="pe-strip">
      <h2 className="pe-bd pe-strip-month">{v.date.month}</h2>
      <div className="pe-strip-days">
        {[-1, 0, 1].map((n) => (
          <div key={n} className={n === 0 ? "is-day" : ""}>
            <span>{name(day(n))}</span>
            <span className="pe-bd">{day(n).getDate()}</span>
            <span className="pe-strip-dot" />
          </div>
        ))}
      </div>
      <Orn name="pendant" className="pe-pendant" />
    </div>
  );
}

function Mot({ ctx }) {
  const { v } = ctx;
  return (
    <section id="mot" className="pe-mot">
      <h2 className="pe-bd pe-mot-title"><L>Chers amis !</L></h2>
      <div className="pe-sc pe-mot-sc"><L>merci d’avoir répondu</L></div>
      <div className="pe-mot-pearls">
        <Pearls width={380} sag={28} r={5} />
      </div>
      <div className="pe-env">
        <div className="pe-env-back" />
        <Orn name="envelope" stretch width="100%" height={216} style={{ position: "absolute", left: 0, bottom: 0 }} />
        <div className="pe-env-card">
          <F k="mot" multiline placeholder="Votre mot d’accueil" as="p" value={v.content.mot} />
          <div className="pe-sc">{initials(v)}</div>
        </div>
        <Orn name="clip" width={18} height={42} className="pe-clip" />
      </div>
      {v.date ? (
        <>
          <div style={{ height: 70 }} />
          <DateStrip v={v} />
        </>
      ) : null}
    </section>
  );
}

function Jour({ ctx }) {
  const { v } = ctx;
  const cd = useCountdown(v.dateIso, v.time);
  return (
    <section id="jour" className="pe-mot">
      <DateStrip v={v} />
      {cd ? (
        <div className="pe-count">
          {[
            [cd.days, "Jours"],
            [cd.hours, "Heures"],
            [cd.minutes, "Minutes"],
          ].map(([n, l]) => (
            <div key={l}>
              <span className="pe-bd">{n}</span>
              <span className="pe-lab">{l}</span>
            </div>
          ))}
        </div>
      ) : null}
      <AgendaLink v={v} className="pe-lnk">
        <L>Ajouter à mon agenda</L>
      </AgendaLink>
    </section>
  );
}

function Programme({ ctx }) {
  const { v } = ctx;
  const list = v.days.flatMap((d) => d.moments);
  return (
    <section id="programme" className="pe-taupe pe-prog">
      <Head title="Le programme" script="du week-end" light />
      <div className="pe-prog-box" style={{ "--n": list.length }}>
        <PearlPath count={list.length} width={560} step={170} className="pe-path is-desk" />
        <PearlPath count={list.length} width={342} step={155} className="pe-path is-phone" />
        {list.map((m, i) => (
          <div key={m.id} className={`pe-prog-item ${i % 2 ? "is-r" : "is-l"}`} style={{ "--i": i }}>
            <span className="pe-bd pe-prog-time">{hourClock(m.time) || "·"}</span>
            <F k={`moments.${m.id}.name`} placeholder="Le moment" as="span" className="pe-prog-name" value={m.name} />
            {m.date ? <span className="pe-lab">{`${m.date.weekdayShort} ${m.date.day} ${m.date.monthShort}`}</span> : null}
          </div>
        ))}
        <Orn name="pearlKnot" className="pe-knot" />
      </div>
      <AgendaLink v={v} className="pe-lnk is-light">
        <L>Ajouter à mon agenda</L>
      </AgendaLink>
    </section>
  );
}

// Les lieux du week-end : un par adresse, avec les jours où l'on s'y retrouve
function places(v) {
  const out = [];
  for (const m of v.moments) {
    const name = m.place || "";
    if (!name && !m.address) continue;
    const key = (m.address || name).toLowerCase();
    let p = out.find((x) => x.key === key);
    if (!p) out.push((p = { key, name: name.split(",")[0], address: m.address, days: [], moments: [] }));
    if (m.date && !p.days.includes(m.date.weekday)) p.days.push(m.date.weekday);
    p.moments.push(m.name);
  }
  if (!out.length && (v.venueName || v.venueAddress)) out.push({ key: "lieu", name: v.venueName, address: v.venueAddress, days: v.date ? [v.date.weekday] : [], moments: [] });
  return out.slice(0, 3);
}

function Lieu({ ctx }) {
  const { v } = ctx;
  const list = places(v);
  return (
    <section id="lieu" className="pe-block">
      <Head title={list.length > 1 ? "Les lieux" : "Le lieu"} script="notez l’adresse" />
      <div className="pe-oval">
        <Orn name="pearlFrame" stretch width="100%" height="100%" style={{ position: "absolute", inset: 0 }} />
        <div className="pe-oval-card">
          {list.map((p, i) => (
            <div key={p.key} className="pe-oval-item">
              {i ? <span className="pe-oval-rule" /> : null}
              <span className="pe-lab">{[joinList(p.days), p.moments.length === 1 ? lower(p.moments[0]) : ""].filter(Boolean).join(" · ")}</span>
              <span className="pe-bd pe-oval-name">{p.name || v.venueName}</span>
              {p.address ? <span className="pe-oval-addr">{p.address}</span> : null}
              {mapsUrl(p.address || p.name) ? (
                <a className="pe-lnk" href={mapsUrl([p.name, p.address].filter(Boolean).join(", "))} target="_blank" rel="noopener noreferrer">
                  <L>Voir sur la carte</L>
                </a>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Tenue({ ctx }) {
  const { dress } = ctx.v.content;
  return (
    <section id="tenue" className="pe-block pe-dress">
      <Head title="Dress code" script={lower(dress.title)} />
      <F k="dress.text" multiline placeholder="La tenue en quelques mots" as="p" className="pe-p pe-dress-text" value={dress.text} />
      {dress.colors.length ? (
        <div className="pe-swatches">
          {dress.colors.map((c, i) => (
            <div key={i}>
              <span style={{ background: c.color }} />
              <span className="pe-lab">{c.name}</span>
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
  const cols = [];
  if (c.travel.length)
    cols.push(
      <div key="venir">
        <h3 className="pe-bd pe-h3"><L>Venir</L></h3>
        <div className="pe-col-list">
          {c.travel.map((t, i) => (
            <p key={i} className="pe-p">
              <span className="pe-ink">{travelLabel(t)}.</span> {t.text}
            </p>
          ))}
        </div>
      </div>,
    );
  if (c.stays.length)
    cols.push(
      <div key="loger">
        <h3 className="pe-bd pe-h3"><L>Se loger</L></h3>
        <div className="pe-col-list">
          {c.stays.map((s, i) => (
            <p key={i} className="pe-p">
              <span className="pe-ink">{s.name}</span>
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
        <h3 className="pe-bd pe-h3"><L>Dress code</L></h3>
        <p className="pe-p pe-col-narrow">
          <F k="dress.title" placeholder="Le dress code" as="span" className="pe-ink" value={c.dress.title} />{c.dress.title ? ". " : " "}
          <F k="dress.text" multiline placeholder="La tenue en quelques mots" value={c.dress.text} />
        </p>
      </div>,
    );
  if (c.kids.title || c.kids.text)
    cols.push(
      <div key="kids">
        <h3 className="pe-bd pe-h3"><L>Enfants</L></h3>
        <p className="pe-p pe-col-narrow">
          <F k="kids.title" placeholder="Les enfants" as="span" className="pe-ink" value={c.kids.title} />{c.kids.title ? ". " : " "}
          <F k="kids.text" multiline placeholder="Les enfants : bienvenus, garde prévue…" value={c.kids.text} />
        </p>
      </div>,
    );
  return (
    <section id="pratique" className="pe-infos">
      <Head title="Bon à savoir" script="pour le voyage" />
      <div className="pe-cols">
        {cols.map((col, i) => [i ? <span key={`r${i}`} className="pe-col-rule" /> : null, col])}
      </div>
    </section>
  );
}

function Partage({ ctx }) {
  const { v } = ctx;
  const share = useShare(v);
  const group = v.content.whatsapp?.trim();
  return (
    <section id="partage" className="pe-block pe-group">
      <Head title={group ? "Notre groupe" : "Faites suivre"} script={group ? "WhatsApp" : "le lien du site"} />
      <div className="pe-group-card">
        <div className="pe-group-pearls">
          <Pearls width={140} sag={18} r={4.2} />
        </div>
        <div className="pe-group-body">
          {group ? (
            <>
              <p className="pe-p"><L>Horaires, navettes, photos du week-end : toutes les nouvelles arrivent ici.</L></p>
              <a className="pe-lnk" href={group} target="_blank" rel="noopener noreferrer">
                <L>Rejoindre le groupe</L>
              </a>
            </>
          ) : (
            <>
              <QR url={ctx.shareUrl || share.url} size={84} />
              <p className="pe-p"><L>Scannez pour l’ouvrir sur un autre téléphone.</L></p>
              <a className="pe-lnk" href={share.whatsapp} target="_blank" rel="noopener noreferrer">
                <L>Partager sur WhatsApp</L>
              </a>
              <button type="button" className="pe-lnk" onClick={share.copy}>
                {share.copied ? "Lien copié" : "Copier le lien"}
              </button>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

// Rubriques absentes de la maquette Perle : même vocabulaire (didone, écriture, carte claire)
function Histoire({ ctx }) {
  const { v } = ctx;
  const [a, b] = v.photos.story || [];
  return (
    <section id="histoire" className="pe-block">
      <Head title={<F k="story.title" placeholder="Le titre" value={v.content.story.title || "Notre histoire"} />} script="comment tout a commencé" />
      <div className="pe-pair">
        <Photo src={a} tone={1} preview={ctx.preview} gray />
        <Photo src={b} tone={3} preview={ctx.preview} gray />
      </div>
      <F k="story.text" multiline placeholder="Votre histoire" as="p" className="pe-p pe-dress-text" value={v.content.story.text} />
    </section>
  );
}

function Gallery({ ctx, id, title, script, photos, note }) {
  const tiles = photos?.length ? photos : [null, null, null, null];
  return (
    <section id={id} className="pe-block">
      <Head title={title} script={script} />
      <div className="pe-gallery">
        {tiles.map((src, i) => (
          <Photo key={i} src={src} tone={(i % 3) + 1} preview={ctx.preview} gray />
        ))}
      </div>
      {!photos?.length && note ? <p className="pe-lab pe-note"><L>{note}</L></p> : null}
    </section>
  );
}

function Citation({ ctx }) {
  const { v } = ctx;
  return (
    <section id="citation" className="pe-citation">
      <Photo path="photos.citation" src={v.photos.citation} tone={2} label="Votre photo" preview={ctx.preview} gray />
      <F k="citation" multiline placeholder="Une phrase qui vous ressemble" as="p" className="pe-sc" value={v.content.citation} />
    </section>
  );
}

function Reponse({ ctx }) {
  const { v } = ctx;
  const [reload, setReload] = useState(0);
  const res = useSavedResponse(v.formSlug, ctx.preview, reload);
  return (
    <section id="reponse" className="pe-block">
      <Head title="Votre réponse" script={res ? (res.present === false ? "vous nous manquerez" : "vous serez des nôtres") : "deux minutes suffisent"} />
      <div className="pe-group-card">
        <div className="pe-group-body">
          {res ? (
            <>
              <p className="pe-p">
                <span className="pe-ink">{res.names}</span>
                {res.moments?.length ? (
                  <>
                    <br />
                    {joinList(res.moments).replace(/^./, (c) => c.toUpperCase())}
                  </>
                ) : null}
              </p>
              {v.formSlug ? (
                <a className="pe-lnk" href={`/f/${v.formSlug}`}>
                  <L>Un changement ? Répondre à nouveau</L>
                </a>
              ) : null}
            </>
          ) : v.formSlug ? (
            <GuestFormInline formSlug={v.formSlug} preview={ctx.preview} onAnswered={() => setReload((n) => n + 1)} />
          ) : null}
        </div>
      </div>
    </section>
  );
}

function Questions({ ctx }) {
  const c = ctx.v.content;
  return (
    <section id="questions" className="pe-infos">
      <Head title="Questions" script="et réponses" />
      <div className="pe-faq">
        {c.faq.length ? <Faq items={c.faq} titleClass="pe-faq-q" textClass="pe-p" /> : null}
        {c.contacts.length ? (
          <div className="pe-contacts">
            <p className="pe-p">{writeTo(c.contacts)}.</p>
            {c.contacts.map((x, i) =>
              contactHref(x) ? (
                <a key={i} className="pe-lnk" href={contactHref(x)}>
                  Écrire à {x.name}
                </a>
              ) : null,
            )}
          </div>
        ) : null}
      </div>
    </section>
  );
}

function Footer({ ctx }) {
  return (
    <footer className="pe-footer">
      <span className="pe-sc">{initials(ctx.v)}</span>
      <span className="pe-lab"><L>Fait avec Merry</L></span>
    </footer>
  );
}

const Perle = {
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
    moments: ({ ctx }) => <Gallery ctx={ctx} id="moments" title="Nos moments" script="nos jours préférés" photos={ctx.v.photos.moments} />,
    citation: Citation,
    album: ({ ctx }) => <Gallery ctx={ctx} id="album" title="L’album" script="du week-end" photos={ctx.v.photos.album} note="Vos photos du week-end, ici après le mariage" />,
    reponse: Reponse,
    questions: Questions,
    partage: Partage,
  },
  visible: (key, v) => key !== "reponse" || !!v.formSlug,
};
export default Perle;
