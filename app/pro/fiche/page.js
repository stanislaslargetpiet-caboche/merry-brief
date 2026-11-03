"use client";

// Ma fiche (maquettes V2 et V2m) : ce que les couples voient du prestataire. Chaque modification part
// tout de suite dans le catalogue que lisent les couples. ?apercu=1 ouvre l'aperçu côté couples (V2b, V2n).
// Audit du 3 nov. 2026 : seuls restent les champs que les couples voient vraiment (places debout, fin de
// soirée, adresse exacte, zone, rayon et taille d'équipe retirés ; import de vidéo retiré, seul un lien
// est montré aux couples).

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { usePro } from "@/lib/pro/store";
import { ProIcon } from "@/components/pro/icons";
import { Pills, ProSubnav, Switch } from "@/components/pro/ui";
import { PRO_PROFIL_TABS } from "@/components/pro/Shell";
import { BusyDots } from "@/components/dash/ui";
import Apercu from "@/components/pro/Apercu";
import { plusFor } from "@/lib/vendorPlus";

const CATERER = [
  { value: "libre", label: "Libre" },
  { value: "impose", label: "Imposé" },
  { value: "liste", label: "Liste de traiteurs" },
];
const catererOf = (det) => (det.caterer_mode ? det.caterer_mode : det.caterer_imposed === false ? "libre" : det.caterer_imposed === true ? "impose" : "");
const hasPlus = (category) => {
  const { choices, toggles, text } = plusFor(category);
  return choices.length > 0 || toggles.length > 0 || text.length > 0;
};

export default function MaFichePage() {
  return (
    <Suspense>
      <MaFiche />
    </Suspense>
  );
}

function MaFiche() {
  const pro = usePro();
  const router = useRouter();
  const params = useSearchParams();
  const v = pro.data.vendor;
  const det = v.details || {};
  const isLieu = v.primary_category === "lieu";
  const apercu = params.get("apercu") === "1";

  // Les liens « Prochaine étape » de l'accueil arrivent sur la bonne section
  useEffect(() => {
    const id = window.location.hash.slice(1);
    if (id) document.getElementById(id)?.scrollIntoView({ block: "start", behavior: "smooth" });
  }, []);

  const save = (patch) => pro.saveFiche(patch);
  const num = (x) => (x === "" || x === null || x === undefined ? null : Math.max(0, Math.round(Number(x))) || 0);

  return (
    <div className="p-narrow">
      {/* Le titre seul, comme les autres onglets de Mon profil ; l'aperçu passe sous les onglets */}
      <h1 className="p-h1 is-page">Ma fiche.</h1>
      <ProSubnav items={PRO_PROFIL_TABS} label="Sections de Mon profil" />
      <div className="p-clients-tools">
        <button type="button" className="p-btn p-btn-ghost p-phone-wide" onClick={() => router.push("/pro/fiche?apercu=1")}>
          <ProIcon name="eye" size={18} />
          Aperçu côté couples
        </button>
      </div>

      <PhotosSection />

      <section className="p-sec" id="video">
        <VideoSection />
      </section>

      <section className="p-sec" id="presentation">
        <h2 className="p-sec-title">Présentation</h2>
        <div className="p-field">
          <label htmlFor="desc">Description</label>
          <TextArea id="desc" rows={4} value={v.description || ""} onSave={(t) => save({ description: t })} />
        </div>
        <div className="p-grid2">
          <TextField id="site" label="Site internet" value={v.website} onSave={(t) => save({ website: t || null })} />
          <TextField
            id="adresse"
            label="Adresse"
            value={v.address}
            onSave={async (t) => {
              await save({ address: t || null });
              if (t) pro.calcAccess();
            }}
          />
        </div>
        <TextField id="brochure" label="Lien vers la brochure (PDF)" value={det.brochure_url} onSave={(t) => save({ brochure_url: t || null })} />
      </section>

      {isLieu ? (
        <section className="p-sec" id="lieu">
          <h2 className="p-sec-title">Le lieu</h2>
          <div className="p-grid2">
            <NumberField id="assis" label="Places assises" value={v.capacity_seated} onSave={(n) => save({ capacity_seated: num(n) })} />
            <NumberField id="couch" label="Couchages" value={v.beds} onSave={(n) => save({ beds: num(n) })} />
          </div>
          <div className="p-field is-8">
            <span id="trait">Traiteur</span>
            <Pills
              label="Traiteur"
              options={CATERER}
              value={catererOf(det)}
              onChange={(mode) => save({ caterer_mode: mode, caterer_imposed: mode !== "libre" })}
            />
          </div>
        </section>
      ) : null}

      {isLieu ? (
        <section className="p-sec" id="acces">
          <div className="p-sec-row">
            <h2 className="p-sec-title">Accès</h2>
            {v.address ? (
              <button type="button" className="p-btn p-btn-ghost" onClick={() => pro.calcAccess()}>
                Recalculer depuis l’adresse
              </button>
            ) : null}
          </div>
          <p className="p-hint">Estimés depuis l’adresse de la section Présentation ; modifiables à la main.</p>
          <div className="p-access">
            <TextField id="aero" label="Aéroport le plus proche" value={v.airport_name} onSave={(t) => save({ airport_name: t })} />
            <MinutesField id="aero-t" value={v.airport_minutes} onSave={(n) => save({ airport_minutes: num(n) })} />
          </div>
          <div className="p-access">
            <TextField id="gare" label="Gare TGV" value={v.station_name} onSave={(t) => save({ station_name: t })} />
            <MinutesField id="gare-t" value={v.station_minutes} onSave={(n) => save({ station_minutes: num(n) })} />
          </div>
          <div className="p-toggles">
            <div className="p-toggle">
              <span id="park">Parking sur place</span>
              <Switch on={det.parking === true || (det.parking === undefined && v.parking === true)} labelledBy="park" onChange={(on) => save({ parking: on })} />
            </div>
            <div className="p-toggle">
              <span id="pmr">Accessible PMR</span>
              <Switch on={det.accessible === true || (det.accessible === undefined && v.accessible === true)} labelledBy="pmr" onChange={(on) => save({ accessible: on })} />
            </div>
          </div>
        </section>
      ) : null}

      {hasPlus(v.primary_category) ? (
        <section className="p-sec" id="plus">
          <h2 className="p-sec-title">Plus d’informations</h2>
          <PlusInfosSection category={v.primary_category} />
        </section>
      ) : null}

      {apercu ? <Apercu onClose={() => router.replace("/pro/fiche")} /> : null}
    </div>
  );
}

// ---------- Photos : la première sert de couverture (badge), glisser pour changer l'ordre ----------

function PhotosSection() {
  const pro = usePro();
  const photos = pro.data.photos || [];
  const fileRef = useRef(null);
  const [drag, setDrag] = useState(null);
  const [busy, setBusy] = useState(false);

  const move = (from, to) => {
    if (to < 0 || to >= photos.length || from === to) return;
    const next = [...photos];
    const [x] = next.splice(from, 1);
    next.splice(to, 0, x);
    pro.setPhotos(next);
  };

  return (
    <section className="p-sec" id="photos">
      <h2 className="p-sec-title">Photos</h2>
      <ul className="p-photos">
        {photos.map((ph, i) => {
          const label = i === 0 ? "la photo de couverture" : `la photo ${i + 1}`;
          return (
            <li
              key={ph.path}
              className={`p-photo${drag === i ? " is-dragging" : ""}`}
              style={{ backgroundImage: ph.url ? `url("${ph.url}")` : undefined }}
              draggable
              onDragStart={() => setDrag(i)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                move(drag, i);
                setDrag(null);
              }}
              onDragEnd={() => setDrag(null)}
            >
              {i === 0 ? <span className="p-photo-tag">Couverture</span> : null}
              <button
                type="button"
                className="p-photo-btn is-grip"
                aria-label={`Déplacer ${label} (flèches gauche et droite)`}
                onKeyDown={(e) => {
                  if (e.key === "ArrowLeft") move(i, i - 1);
                  if (e.key === "ArrowRight") move(i, i + 1);
                }}
              >
                <ProIcon name="grip" size={16} fill="#1c1c1a" stroke="none" />
              </button>
              <button type="button" className="p-photo-btn is-remove" aria-label={`Retirer ${label}`} onClick={() => pro.removePhoto(ph.path)}>
                <ProIcon name="trash" size={15} sw={2} />
              </button>
            </li>
          );
        })}
        <li className="p-photo-add">
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            hidden
            onChange={async (e) => {
              const files = e.target.files;
              if (!files?.length) return;
              setBusy(true);
              await pro.addPhotos(files);
              setBusy(false);
              e.target.value = "";
            }}
          />
          <button type="button" onClick={() => fileRef.current?.click()} disabled={busy}>
            <ProIcon name="plus" size={20} sw={2} />
            {busy ? <BusyDots /> : "Ajouter des photos"}
          </button>
        </li>
      </ul>
    </section>
  );
}

// ---------- Vidéo : un lien Matterport, YouTube ou Vimeo (seul format montré aux couples) ----------

function VideoSection() {
  const pro = usePro();
  const v = pro.data.vendor;
  const raw = v.details?.video_url || "";
  const url = raw.startsWith("fichier:") ? "" : raw;
  const cover = pro.data.photos?.[0]?.url;
  const [open, setOpen] = useState(!!url);

  useEffect(() => {
    if (url) setOpen(true);
  }, [url]);

  const toggle = (on) => {
    setOpen(on);
    if (!on && url) pro.saveFiche({ video_url: null });
  };

  return (
    <>
      <div className="p-sec-row">
        <h2 className="p-sec-title">Vidéos et visite virtuelle</h2>
        <Switch on={open} label="Ajouter vidéo ou visite virtuelle" onChange={toggle} />
      </div>
      {open ? (
        <div className="p-video">
          <div className="p-video-box" style={{ backgroundImage: cover ? `url("${cover}")` : undefined }}>
            {url ? (
              <button type="button" className="p-video-play" aria-label="Lire la vidéo" onClick={() => window.open(/^https?:/i.test(url) ? url : `https://${url}`, "_blank", "noopener")}>
                <ProIcon name="play" size={22} fill="#1c1c1a" stroke="none" />
              </button>
            ) : null}
            <span className="p-video-tag">{url ? "Vidéo de présentation" : "Pas encore de vidéo"}</span>
          </div>
          <div className="p-video-side">
            <div className="p-field">
              <label htmlFor="lien">Lien Matterport, YouTube ou Vimeo</label>
              <TextInput id="lien" placeholder="https://" value={url} onSave={(t) => pro.saveFiche({ video_url: t || null })} />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

// ---------- Plus d'informations : questions propres à chaque métier (lib/vendorPlus.js) ----------

function PlusInfosSection({ category }) {
  const pro = usePro();
  const v = pro.data.vendor;
  const det = v.details || {};
  const save = (patch) => pro.saveFiche(patch);
  const { choices, toggles, text } = plusFor(category);

  return (
    <div className="p-plus">
      {choices.map((c) => (
        <PlusChoiceRow key={c.key} choice={c} value={det[c.key]} onChange={(val) => save({ [c.key]: val })} />
      ))}
      {toggles.map((t) => (
        <div key={t.key} className="p-plus-row is-toggle">
          <span id={`plus-${t.key}`} className="p-plus-q">
            {t.question}
          </span>
          <Switch on={det[t.key] === true} labelledBy={`plus-${t.key}`} onChange={(on) => save({ [t.key]: on })} />
        </div>
      ))}
      {text.map((t) => (
        <div key={t.key} className="p-plus-row is-text">
          <TextField id={`plus-${t.key}`} label={t.question} value={det[t.key]} onSave={(val) => save({ [t.key]: val || null })} />
        </div>
      ))}
    </div>
  );
}

// Choix à pastilles d'une question « Plus d'informations », avec un bouton pour ajouter sa propre réponse
function PlusChoiceRow({ choice: c, value, onChange }) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const list = value || [];
  const extra = list.filter((v) => !c.options.some((o) => o.value === v));
  const isOn = (v) => list.includes(v);
  const toggle = (v) => onChange(isOn(v) ? list.filter((x) => x !== v) : [...list, v]);
  const addCustom = () => {
    const t = draft.trim();
    setAdding(false);
    setDraft("");
    if (!t || isOn(t)) return;
    onChange([...list, t]);
  };

  return (
    <div className="p-plus-row">
      <span id={`plus-${c.key}`} className="p-plus-q">
        {c.question}
      </span>
      <div className="p-pills" role="group" aria-label={c.question}>
        {c.options.map((o) => (
          <button key={o.value} type="button" className={`p-pill${isOn(o.value) ? " is-on" : ""}`} onClick={() => toggle(o.value)}>
            {o.label}
          </button>
        ))}
        {extra.map((v) => (
          <button key={v} type="button" className="p-pill is-on" onClick={() => toggle(v)}>
            {v}
          </button>
        ))}
        {adding ? (
          <input
            autoFocus
            type="text"
            className="p-pill-input"
            value={draft}
            placeholder="Votre réponse…"
            onChange={(e) => setDraft(e.target.value)}
            onBlur={addCustom}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
              if (e.key === "Escape") {
                setDraft("");
                setAdding(false);
              }
            }}
          />
        ) : (
          <button type="button" className="p-pill p-pill-add" onClick={() => setAdding(true)}>
            <ProIcon name="plus" size={13} sw={2.4} />
            Autre
          </button>
        )}
      </div>
    </div>
  );
}

// ---------- Champs enregistrés quand on les quitte ----------

function useDraft(value) {
  const [draft, setDraft] = useState(value ?? "");
  const last = useRef(value);
  useEffect(() => {
    if (value !== last.current) {
      last.current = value;
      setDraft(value ?? "");
    }
  }, [value]);
  return [draft, setDraft];
}

function TextInput({ id, value, onSave, placeholder, type = "text", className = "p-input" }) {
  const [draft, setDraft] = useDraft(value);
  return (
    <input
      id={id}
      type={type}
      className={className}
      value={draft}
      placeholder={placeholder}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => String(draft) !== String(value ?? "") && onSave(typeof draft === "string" ? draft.trim() : draft)}
      onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
    />
  );
}

function TextArea({ id, value, onSave, rows }) {
  const [draft, setDraft] = useDraft(value);
  return <textarea id={id} rows={rows} className="p-textarea" value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={() => draft !== (value || "") && onSave(draft.trim())} />;
}

function TextField({ id, label, value, onSave }) {
  return (
    <div className="p-field">
      <label htmlFor={id}>{label}</label>
      <TextInput id={id} value={value} onSave={onSave} />
    </div>
  );
}

function NumberField({ id, label, value, onSave }) {
  return (
    <div className="p-field">
      <label htmlFor={id}>{label}</label>
      <TextInput id={id} type="number" value={value ?? ""} onSave={onSave} />
    </div>
  );
}

function MinutesField({ id, value, onSave }) {
  return (
    <div className="p-field">
      <label htmlFor={id}>Trajet</label>
      <div className="p-input p-unit">
        <TextInput id={id} type="number" className="p-unit-input" value={value ?? ""} onSave={onSave} />
        <span>min</span>
      </div>
    </div>
  );
}
