"use client";

// Réglages du site de mariage : le formulaire de chaque rubrique (artboard « 9 · Réglages du site »).
// Chaque champ enregistre au fil de la frappe (la page attend 0,7 s avant d'écrire dans Supabase).

import Link from "next/link";
import { useRef, useState } from "react";
import { useDash } from "@/lib/dash/store";
import { shrinkImage } from "@/lib/dash/form";
import { TRAVEL_KINDS } from "@/lib/site/model";
import { Icon } from "./icons";
import { Btn, BusyDots } from "./ui";

const SHORT = { weekday: "short", day: "numeric", month: "short" };
const dayLabel = (iso) => (iso ? new Date(`${iso}T12:00:00`).toLocaleDateString("fr-FR", SHORT).replace(/^./, (c) => c.toUpperCase()) : "");

export function TextField({ label, hint, value, onChange, placeholder, max = 200, area, rows = 3, type = "text" }) {
  return (
    <label className="d-field">
      <span className="d-field-label">{label}</span>
      {hint ? <span className="d-field-hint">{hint}</span> : null}
      {area ? (
        <textarea className="d-textarea" rows={rows} maxLength={max} value={value || ""} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input className="d-input" type={type} maxLength={max} value={value || ""} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      )}
    </label>
  );
}

// Envoi d'une photo (réduite à 1 800 px) dans le dossier du mariage
function useUpload() {
  const dash = useDash();
  const [busy, setBusy] = useState(false);
  const upload = async (file) => {
    if (!file) return null;
    if (!/^image\//.test(file.type)) {
      dash.setToast({ kind: "error", text: "Choisissez une photo (JPG, PNG ou WebP)." });
      return null;
    }
    setBusy(true);
    try {
      const blob = await shrinkImage(file);
      const res = await dash.uploadCover(blob);
      if (res.ok) return res.url;
      dash.setToast({ kind: "error", text: "La photo n'a pas pu être envoyée. Réessayez avec une autre image." });
    } catch {
      dash.setToast({ kind: "error", text: "Cette photo n'a pas pu être lue." });
    } finally {
      setBusy(false);
    }
    return null;
  };
  return [busy, upload];
}

export function PhotoField({ label, hint, value, onChange }) {
  const input = useRef(null);
  const [busy, upload] = useUpload();
  return (
    <div className="d-field">
      <span className="d-field-label">{label}</span>
      {hint ? <span className="d-field-hint">{hint}</span> : null}
      <button type="button" className={`d-fcover d-site-photo${value ? " has-photo" : ""}`} onClick={() => input.current?.click()} disabled={busy} style={value ? { backgroundImage: `url("${value}")` } : undefined}>
        {value ? (
          <span className="d-fcover-change">{busy ? <BusyDots /> : "Changer la photo"}</span>
        ) : (
          <>
            <Icon name="upload" size={22} />
            <strong>{busy ? <BusyDots /> : "Choisir une photo"}</strong>
          </>
        )}
      </button>
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        hidden
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          const url = await upload(file);
          if (url) onChange(url);
        }}
      />
      {value ? (
        <button type="button" className="d-link" style={{ alignSelf: "flex-start" }} onClick={() => onChange(null)}>
          Retirer la photo
        </button>
      ) : null}
    </div>
  );
}

export function PhotosField({ label, hint, value = [], onChange, max = 6 }) {
  const input = useRef(null);
  const [busy, upload] = useUpload();
  return (
    <div className="d-field">
      <span className="d-field-label" style={{ display: "flex", justifyContent: "space-between" }}>
        {label}
        <span className="d-muted" style={{ fontWeight: 400 }}>
          {value.length} sur {max}
        </span>
      </span>
      {hint ? <span className="d-field-hint">{hint}</span> : null}
      <div className="d-site-photos">
        {value.map((src, i) => (
          <div key={`${src}-${i}`} className="d-site-thumb" style={{ backgroundImage: `url("${src}")` }}>
            <button type="button" className="d-site-thumb-x" aria-label={`Retirer la photo ${i + 1}`} onClick={() => onChange(value.filter((_, j) => j !== i))}>
              <Icon name="x" size={14} sw={2.2} />
            </button>
          </div>
        ))}
        {value.length < max ? (
          <button type="button" className="d-site-thumb is-add" onClick={() => input.current?.click()} disabled={busy} aria-label="Ajouter des photos">
            <Icon name={busy ? "upload" : "plus"} size={20} sw={2} />
            <span>{busy ? <BusyDots /> : "Ajouter"}</span>
          </button>
        ) : null}
      </div>
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        hidden
        onChange={async (e) => {
          const files = [...(e.target.files || [])].slice(0, max - value.length);
          e.target.value = "";
          const urls = [];
          for (const f of files) {
            const url = await upload(f);
            if (url) urls.push(url);
          }
          if (urls.length) onChange([...value, ...urls].slice(0, max));
        }}
      />
    </div>
  );
}

// Liste d'éléments (trajets, hébergements, questions, témoins) : ajouter, retirer, monter, descendre
function ListEditor({ items, onChange, empty, add, addLabel, max = 12, render, label }) {
  const set = (i, patch) => onChange(items.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const move = (i, d) => {
    const j = i + d;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  return (
    <div className="d-col" style={{ gap: 10 }}>
      {items.map((it, i) => (
        <div key={i} className="d-site-item">
          <div className="d-site-item-head">
            <strong>
              {label} {i + 1}
            </strong>
            <span className="d-site-item-btns">
              <button type="button" className="d-icon-btn is-flat" aria-label={`Monter : ${label} ${i + 1}`} disabled={i === 0} onClick={() => move(i, -1)}>
                <Icon name="arrowUp" size={16} />
              </button>
              <button type="button" className="d-icon-btn is-flat" aria-label={`Descendre : ${label} ${i + 1}`} disabled={i === items.length - 1} onClick={() => move(i, 1)}>
                <Icon name="arrowDown" size={16} />
              </button>
              <button type="button" className="d-icon-btn is-flat is-danger" aria-label={`Supprimer : ${label} ${i + 1}`} onClick={() => onChange(items.filter((_, j) => j !== i))}>
                <Icon name="trash" size={16} />
              </button>
            </span>
          </div>
          {render(it, (patch) => set(i, patch))}
        </div>
      ))}
      {!items.length && empty ? <p className="d-small d-muted" style={{ margin: 0 }}>{empty}</p> : null}
      {items.length < max ? (
        <button type="button" className="d-fq-add" onClick={() => onChange([...items, add()])}>
          <Icon name="plus" size={16} sw={2} />
          {addLabel}
        </button>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Formulaire de chaque rubrique
// ---------------------------------------------------------------------------

export function HeaderFields({ site, setContent, setPhoto, data, dash }) {
  const c = site.content;
  return (
    <div className="d-site-fields">
      <p className="d-small d-muted" style={{ margin: 0, lineHeight: 1.5 }}>
        Vos prénoms ({[data.wedding.partner1, data.wedding.partner2].filter(Boolean).join(" et ")}) viennent de votre mariage.
      </p>
      <PhotoField label="Photo d'en-tête" hint="En grand en haut du site. Format portrait ou paysage selon le modèle." value={c.photos.cover} onChange={(url) => setPhoto("cover", url)} />
      <PhotosField label="Photos d'ambiance" hint="Les modèles les placent autour du programme et des infos pratiques." value={c.photos.ambiance || []} max={4} onChange={(urls) => setPhoto("ambiance", urls)} />
      <div className="d-site-g2">
        <label className="d-field">
          <span className="d-field-label">Date du mariage</span>
          <input className="d-input" type="date" value={data.wedding.wedding_date || ""} onChange={(e) => dash.updateWedding({ wedding_date: e.target.value || null })} />
        </label>
        <TextField label="Heure de la cérémonie" type="time" value={c.time} onChange={(time) => setContent({ time })} />
      </div>
      <TextField label="Votre petit mot" hint="Sous vos prénoms, dans les modèles qui en ont un." area max={300} value={c.welcome} onChange={(welcome) => setContent({ welcome })} />
      <TextField label="Une phrase à vous" hint="Une citation, une promesse. Terracotta l'affiche à côté de vos initiales." max={140} value={c.tagline} placeholder="Là où tout a commencé, nous allons nous dire oui." onChange={(tagline) => setContent({ tagline })} />
    </div>
  );
}

export function SectionFields({ k, site, setContent, setPhoto, data, dash }) {
  const c = site.content;
  const set = (key) => (patch) => setContent({ [key]: { ...c[key], ...patch } });

  if (k === "mot")
    return (
      <div className="d-site-fields">
        <TextField label="Le mot d'accueil" area rows={4} max={600} value={c.mot} onChange={(mot) => setContent({ mot })} />
      </div>
    );

  if (k === "jour")
    return (
      <div className="d-site-fields">
        <p className="d-small d-muted" style={{ margin: 0, lineHeight: 1.5 }}>
          La date, l'heure et le lieu se règlent dans l'en-tête et dans « Le lieu ». Le compte à rebours, le bouton d'agenda et l'itinéraire viennent tout seuls.
        </p>
      </div>
    );

  if (k === "programme") {
    const events = [...(data.events || [])].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
    const setMoment = (id, patch) => setContent({ moments: { ...c.moments, [id]: { ...(c.moments[id] || {}), ...patch } } });
    return (
      <div className="d-site-fields">
        <p className="d-small d-muted" style={{ margin: 0, lineHeight: 1.5 }}>
          Les moments viennent de votre liste d’invités (<Link href="/dashboard/invites">Invités</Link>, « Modifier les moments »). Ajoutez l’heure, le lieu et un petit mot : ils s’affichent sur le site dans l’ordre des heures.
        </p>
        {events.length ? null : <p className="d-small" style={{ margin: 0 }}>Aucun moment pour l'instant.</p>}
        {events.map((e) => {
          const m = c.moments[e.id] || {};
          return (
            <div key={e.id} className={`d-site-item${m.hidden ? " is-off" : ""}`}>
              <div className="d-site-item-head">
                <strong>{e.name}</strong>
                <span className="d-site-item-btns">
                  <span className="d-small d-muted">{dayLabel(e.event_date || data.wedding.wedding_date)}</span>
                  <button type="button" className="d-icon-btn is-flat" aria-pressed={!m.hidden} aria-label={m.hidden ? `Afficher : ${e.name}` : `Masquer : ${e.name}`} title={m.hidden ? "Afficher sur le site" : "Masquer sur le site"} onClick={() => setMoment(e.id, { hidden: !m.hidden })}>
                    <Icon name={m.hidden ? "eyeOff" : "eye"} size={17} />
                  </button>
                </span>
              </div>
              {m.hidden ? (
                <p className="d-small d-muted" style={{ margin: 0 }}>
                  Masqué sur le site.
                </p>
              ) : (
                <>
                  <div className="d-site-g2 is-time">
                    <TextField label="Heure" type="time" value={m.time} onChange={(time) => setMoment(e.id, { time })} />
                    <TextField label="Lieu" value={m.place} max={120} placeholder="Mairie, salle des mariages" onChange={(place) => setMoment(e.id, { place })} />
                  </div>
                  <TextField label="Adresse" value={m.address} max={160} placeholder="Place de la Mairie, 13100 Aix-en-Provence" onChange={(address) => setMoment(e.id, { address })} />
                  <TextField label="Petit mot" value={m.text} max={140} placeholder="La cérémonie civile, en petit comité" onChange={(text) => setMoment(e.id, { text })} />
                </>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  if (k === "lieu")
    return (
      <div className="d-site-fields">
        <TextField label="Nom du lieu" value={c.venue.name} max={120} placeholder={data.wedding.venue || "Domaine des Oliviers"} onChange={(name) => set("venue")({ name })} />
        <TextField label="Adresse" hint="Sert aussi au bouton « Voir l'itinéraire »." value={c.venue.address} max={160} onChange={(address) => set("venue")({ address })} />
        <TextField label="Région" value={c.venue.area} max={80} placeholder="Provence" onChange={(area) => set("venue")({ area })} />
        <TextField label="Quelques mots sur le lieu" area max={400} value={c.venue.text} onChange={(text) => set("venue")({ text })} />
        <PhotoField label="Photo du lieu" value={c.photos.venue} onChange={(url) => setPhoto("venue", url)} />
      </div>
    );

  if (k === "tenue")
    return (
      <div className="d-site-fields">
        <TextField label="Le dress code" value={c.dress.title} max={60} placeholder="Champêtre chic" onChange={(title) => set("dress")({ title })} />
        <TextField label="Un conseil" area max={300} value={c.dress.text} placeholder="Talons plats conseillés : la cérémonie a lieu dans le jardin." onChange={(text) => set("dress")({ text })} />
        <div className="d-field">
          <span className="d-field-label">Votre palette</span>
          <span className="d-field-hint">Les couleurs que vous suggérez à vos invités, six au plus.</span>
          <div className="d-site-colors">
            {c.dress.colors.map((x, i) => (
              <div key={i} className="d-site-color">
                <input type="color" value={x.color} aria-label={`Couleur ${i + 1}`} onChange={(e) => set("dress")({ colors: c.dress.colors.map((y, j) => (j === i ? { ...y, color: e.target.value } : y)) })} />
                <input className="d-input" value={x.name} maxLength={20} aria-label={`Nom de la couleur ${i + 1}`} onChange={(e) => set("dress")({ colors: c.dress.colors.map((y, j) => (j === i ? { ...y, name: e.target.value } : y)) })} />
                <button type="button" className="d-icon-btn is-flat is-danger" aria-label={`Retirer la couleur ${i + 1}`} onClick={() => set("dress")({ colors: c.dress.colors.filter((_, j) => j !== i) })}>
                  <Icon name="trash" size={16} />
                </button>
              </div>
            ))}
            {c.dress.colors.length < 6 ? (
              <button type="button" className="d-fq-add" onClick={() => set("dress")({ colors: [...c.dress.colors, { name: "", color: "#d3c5ad" }] })}>
                <Icon name="plus" size={16} sw={2} />
                Ajouter une couleur
              </button>
            ) : null}
          </div>
        </div>
      </div>
    );

  if (k === "pratique")
    return (
      <div className="d-site-fields">
        <div className="d-fq-head">
          <strong>Venir</strong>
          <span>Un trajet par ligne. Embarquement les range en tableau : départ et durée.</span>
        </div>
        <ListEditor
          label="Trajet"
          items={c.travel}
          onChange={(travel) => setContent({ travel })}
          addLabel="Ajouter un trajet"
          add={() => ({ kind: "train", text: "", place: "", duration: "" })}
          render={(t, up) => (
            <>
              <div className="d-filters">
                {TRAVEL_KINDS.map((kind) => (
                  <button key={kind.id} type="button" className={`d-pill${t.kind === kind.id ? " is-on" : ""}`} style={t.kind === kind.id ? { background: "var(--d-limetint)" } : undefined} aria-pressed={t.kind === kind.id} onClick={() => up({ kind: kind.id })}>
                    {kind.label}
                  </button>
                ))}
              </div>
              <TextField label="En une phrase" value={t.text} max={200} placeholder="Gare d’Avignon TGV, puis 45 min de route ou nos navettes." onChange={(text) => up({ text })} />
              <div className="d-site-g2">
                <TextField label="Départ" value={t.place} max={60} placeholder="Avignon TGV" onChange={(place) => up({ place })} />
                <TextField label="Durée" value={t.duration} max={40} placeholder="45 min" onChange={(duration) => up({ duration })} />
              </div>
            </>
          )}
        />
        <div className="d-fq-head" style={{ marginTop: 8 }}>
          <strong>Se loger</strong>
          <span>Les hébergements que vous conseillez.</span>
        </div>
        <ListEditor
          label="Hébergement"
          items={c.stays}
          onChange={(stays) => setContent({ stays })}
          addLabel="Ajouter un hébergement"
          add={() => ({ name: "", distance: "", note: "" })}
          render={(s, up) => (
            <>
              <TextField label="Nom" value={s.name} max={80} placeholder="Hôtel des Restanques" onChange={(name) => up({ name })} />
              <div className="d-site-g2">
                <TextField label="Distance" value={s.distance} max={30} placeholder="À 3 km" onChange={(distance) => up({ distance })} />
                <TextField label="En un mot" value={s.note} max={60} placeholder="Avec piscine" onChange={(note) => up({ note })} />
              </div>
            </>
          )}
        />
        <div className="d-fq-head" style={{ marginTop: 8 }}>
          <strong>Les enfants</strong>
        </div>
        <TextField label="En titre" value={c.kids.title} max={80} placeholder="Les enfants sont les bienvenus" onChange={(title) => set("kids")({ title })} />
        <TextField label="Le détail" area max={300} value={c.kids.text} onChange={(text) => set("kids")({ text })} />
        <p className="d-small d-muted" style={{ margin: 0, lineHeight: 1.5 }}>
          Le dress code s'affiche ici tant que la rubrique « La tenue » est masquée.
        </p>
      </div>
    );

  if (k === "histoire")
    return (
      <div className="d-site-fields">
        <TextField label="Titre" value={c.story.title} max={60} placeholder="Notre histoire" onChange={(title) => set("story")({ title })} />
        <TextField label="Votre histoire" area rows={5} max={1200} value={c.story.text} onChange={(text) => set("story")({ text })} />
        <PhotosField label="Deux photos" value={c.photos.story || []} max={2} onChange={(urls) => setPhoto("story", urls)} />
      </div>
    );

  if (k === "moments")
    return (
      <div className="d-site-fields">
        <PhotosField label="Vos photos préférées" value={c.photos.moments || []} max={6} onChange={(urls) => setPhoto("moments", urls)} />
      </div>
    );

  if (k === "citation")
    return (
      <div className="d-site-fields">
        <TextField label="La phrase" value={c.citation} max={120} placeholder="Quand le soleil touche la colline, nous dirons oui" onChange={(citation) => setContent({ citation })} />
        <PhotoField label="La photo" value={c.photos.citation} onChange={(url) => setPhoto("citation", url)} />
      </div>
    );

  if (k === "album")
    return (
      <div className="d-site-fields">
        <PhotosField label="Les photos du week-end" hint="Avant le mariage, la rubrique annonce « Vos photos du week-end, ici après le mariage »." value={c.photos.album || []} max={12} onChange={(urls) => setPhoto("album", urls)} />
      </div>
    );

  if (k === "reponse")
    return (
      <div className="d-site-fields">
        <p className="d-small d-muted" style={{ margin: 0, lineHeight: 1.5 }}>
          Chaque invité retrouve ce qu'il a répondu au <Link href="/dashboard/invites/formulaire">formulaire invités</Link>, sur le téléphone ou l'ordinateur qui a servi à répondre. Sinon, un bouton l'invite à répondre. Sans formulaire en ligne, la rubrique n'apparaît pas.
        </p>
      </div>
    );

  if (k === "questions")
    return (
      <div className="d-site-fields">
        <div className="d-fq-head">
          <strong>Questions et réponses</strong>
          <span>Le thème regroupe les questions (« Venir et dormir », « Le jour J »).</span>
        </div>
        <ListEditor
          label="Question"
          items={c.faq}
          max={20}
          onChange={(faq) => setContent({ faq })}
          addLabel="Ajouter une question"
          add={() => ({ group: c.faq[c.faq.length - 1]?.group || "", q: "", a: "" })}
          render={(q, up) => (
            <>
              <TextField label="Thème" value={q.group} max={40} placeholder="Le jour J" onChange={(group) => up({ group })} />
              <TextField label="Question" value={q.q} max={120} placeholder="Quelle tenue ?" onChange={(text) => up({ q: text })} />
              <TextField label="Réponse" area max={500} value={q.a} onChange={(a) => up({ a })} />
            </>
          )}
        />
        <div className="d-fq-head" style={{ marginTop: 8 }}>
          <strong>Vos témoins</strong>
          <span>Les invités leur écrivent d'un clic : un mail, un téléphone ou un lien.</span>
        </div>
        <ListEditor
          label="Témoin"
          items={c.contacts}
          max={6}
          onChange={(contacts) => setContent({ contacts })}
          addLabel="Ajouter un témoin"
          add={() => ({ name: "", role: "", reach: "" })}
          render={(x, up) => (
            <>
              <div className="d-site-g2">
                <TextField label="Prénom" value={x.name} max={40} placeholder="Léa" onChange={(name) => up({ name })} />
                <TextField label="Rôle" value={x.role} max={60} placeholder="Témoin de Margue" onChange={(role) => up({ role })} />
              </div>
              <TextField label="Mail ou téléphone" value={x.reach} max={120} placeholder="lea@exemple.fr" onChange={(reach) => up({ reach })} />
            </>
          )}
        />
      </div>
    );

  if (k === "partage")
    return (
      <div className="d-site-fields">
        <p className="d-small d-muted" style={{ margin: 0, lineHeight: 1.5 }}>
          Le QR code, le partage sur WhatsApp et le lien à copier viennent tout seuls.
        </p>
        <TextField label="Lien de votre groupe WhatsApp" hint="Facultatif. Certains modèles l'affichent en « Notre groupe »." value={c.whatsapp} max={200} placeholder="https://chat.whatsapp.com/…" onChange={(whatsapp) => setContent({ whatsapp })} />
      </div>
    );

  return null;
}

export function SetupNotice() {
  return (
    <section className="d-card" style={{ maxWidth: 640 }}>
      <h2>Encore une étape côté Supabase</h2>
      <p className="d-muted" style={{ margin: 0, lineHeight: 1.5 }}>
        Le site a besoin de sa table. Dans Supabase, ouvrez SQL Editor, collez le contenu de <code>supabase/site-mariage.sql</code> et lancez-le, puis rechargez cette page.
      </p>
      <Btn kind="ghost" href="/dashboard">
        Retour à l'accueil
      </Btn>
    </section>
  );
}
