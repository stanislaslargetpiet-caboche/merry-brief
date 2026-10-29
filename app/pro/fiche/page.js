"use client";

// Ma fiche (maquettes V2 et V2m) : ce que les couples voient du prestataire. Chaque modification part
// tout de suite dans le catalogue que lisent les couples. ?apercu=1 ouvre l'aperçu côté couples (V2b, V2n).

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { usePro } from "@/lib/pro/store";
import { ProIcon } from "@/components/pro/icons";
import { Pills, Switch } from "@/components/pro/ui";
import { BusyDots } from "@/components/dash/ui";
import Apercu from "@/components/pro/Apercu";

const STYLES = ["Champêtre", "Chic", "Bohème", "Bord de mer", "Intime", "Grande fête"];
const CATERER = [
  { value: "libre", label: "Libre" },
  { value: "impose", label: "Imposé" },
  { value: "liste", label: "Liste de traiteurs" },
];
const MUSIC_END = ["Minuit", "1 h", "2 h", "4 h", "Pas de limite"];

// Fin de soirée lue sur le site (« 2h du matin », « sans limite ») : le choix le plus proche
function musicChoice(text) {
  const t = String(text || "").toLowerCase();
  if (!t) return "";
  if (/minuit/.test(t)) return "Minuit";
  if (/sans|pas de|aucune|illimit|aube|matin|nuit/.test(t)) return "Pas de limite";
  const h = Number(t.match(/(\d{1,2})\s*(h|:)/)?.[1]);
  if (h === 1) return "1 h";
  if (h === 2) return "2 h";
  if (h >= 3 && h <= 8) return "4 h";
  return MUSIC_END.includes(text) ? text : "";
}

const catererOf = (det) => (det.caterer_mode ? det.caterer_mode : det.caterer_imposed === false ? "libre" : det.caterer_imposed === true ? "impose" : "");

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
      <div className="p-head">
        <div className="p-head-text is-8">
          <h1 className="p-h1 is-page">Ma fiche.</h1>
          <p className="p-lead">Ce que les couples voient de vous. Vos modifications sont enregistrées au fur et à mesure.</p>
        </div>
        <button type="button" className="p-btn p-btn-ghost p-phone-wide" onClick={() => router.push("/pro/fiche?apercu=1")}>
          <ProIcon name="eye" size={18} />
          Aperçu côté couples
        </button>
      </div>

      <PhotosSection />

      <section className="p-sec" id="video">
        <h2 className="p-sec-title">Vidéos et visite virtuelle</h2>
        <VideoSection />
      </section>

      <section className="p-sec" id="presentation">
        <h2 className="p-sec-title">Présentation</h2>
        <div className="p-field">
          <label htmlFor="desc">Description</label>
          <TextArea id="desc" rows={4} value={v.description || ""} onSave={(t) => save({ description: t })} />
        </div>
        <div className="p-field is-8">
          <span>Style</span>
          <StylePills value={v.style_tags || []} onChange={(tags) => save({ style_tags: tags })} />
        </div>
      </section>

      {isLieu ? (
        <section className="p-sec" id="lieu">
          <h2 className="p-sec-title">Le lieu</h2>
          <div className="p-grid3">
            <NumberField id="assis" label="Places assises" value={v.capacity_seated} onSave={(n) => save({ capacity_seated: num(n) })} />
            <NumberField id="debout" label="Places debout" value={v.capacity_standing} onSave={(n) => save({ capacity_standing: num(n) })} />
            <NumberField id="couch" label="Couchages" value={v.beds} onSave={(n) => save({ beds: num(n) })} />
          </div>
          <div className="p-toggles">
            <div className="p-toggle">
              <span id="cer">Cérémonie en extérieur possible</span>
              <Switch on={det.outdoor_ceremony === true} labelledBy="cer" onChange={(on) => save({ outdoor_ceremony: on })} />
            </div>
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
          <div className="p-field is-narrow">
            <label htmlFor="fin">Fin de soirée</label>
            <select id="fin" className="p-input" value={musicChoice(det.music_end)} onChange={(e) => save({ music_end: e.target.value === "Pas de limite" ? "sans limite" : e.target.value.toLowerCase() === "minuit" ? "minuit" : e.target.value })}>
              {!musicChoice(det.music_end) ? <option value="">À préciser</option> : null}
              {MUSIC_END.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </div>
        </section>
      ) : null}

      {isLieu ? (
        <section className="p-sec" id="acces">
          <div className="p-sec-row">
            <h2 className="p-sec-title">Accès</h2>
            <span className="p-calc">
              <ProIcon name="sparkle" size={13} stroke="#35520a" sw={2} />
              Calculé par Merry, modifiable
            </span>
          </div>
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

      {apercu ? <Apercu onClose={() => router.replace("/pro/fiche")} /> : null}
    </div>
  );
}

// ---------- Photos : la première sert de couverture, glisser pour changer l'ordre ----------

function PhotosSection() {
  const pro = usePro();
  const photos = pro.data.photos || [];
  const fileRef = useRef(null);
  const [drag, setDrag] = useState(null);
  const [busy, setBusy] = useState(false);
  const slots = Math.max(5, photos.length);

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
        {Array.from({ length: slots }, (_, i) => {
          const ph = photos[i];
          const label = i === 0 ? "la photo de couverture" : `la photo ${i + 1}`;
          if (!ph) {
            return (
              <li key={`vide-${i}`} className="p-photo is-empty">
                <span>Photo {i + 1}</span>
              </li>
            );
          }
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
      <p className="p-hint">La première photo sert de couverture. Glissez les photos pour changer l’ordre.</p>
    </section>
  );
}

// ---------- Vidéo : un lien (Matterport, YouTube, Vimeo) ou un fichier importé ----------

function VideoSection() {
  const pro = usePro();
  const v = pro.data.vendor;
  const url = v.details?.video_url || "";
  const isFile = url.startsWith("fichier:");
  const cover = pro.data.photos?.[0]?.url;
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(false);

  async function play() {
    if (!url) return;
    if (!isFile) {
      window.open(/^https?:/i.test(url) ? url : `https://${url}`, "_blank", "noopener");
      return;
    }
    await pro.openDocument({ storage_path: url.slice(8) });
  }

  return (
    <div className="p-video">
      <div className="p-video-box" style={{ backgroundImage: cover ? `url("${cover}")` : undefined }}>
        {url ? (
          <button type="button" className="p-video-play" aria-label="Lire la vidéo" onClick={play}>
            <ProIcon name="play" size={22} fill="#1c1c1a" stroke="none" />
          </button>
        ) : null}
        <span className="p-video-tag">{url ? "Vidéo de présentation" : "Pas encore de vidéo"}</span>
      </div>
      <div className="p-video-side">
        <div className="p-field">
          <label htmlFor="lien">Lien Matterport, YouTube ou Vimeo</label>
          <TextInput id="lien" placeholder="https://" value={isFile ? "" : url} onSave={(t) => pro.saveFiche({ video_url: t || null })} />
        </div>
        <span className="p-hint">{isFile ? `ou, déjà importée : ${url.split("/").pop()}` : "ou"}</span>
        <input
          ref={fileRef}
          type="file"
          accept="video/*"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            setBusy(true);
            await pro.uploadVideo(f);
            setBusy(false);
            e.target.value = "";
          }}
        />
        <button type="button" className="p-btn p-btn-ghost p-start p-phone-wide" onClick={() => fileRef.current?.click()} disabled={busy}>
          {busy ? <BusyDots /> : "Importer une vidéo"}
        </button>
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

function StylePills({ value, onChange }) {
  const all = [...STYLES, ...value.filter((t) => !STYLES.includes(t))];
  return (
    <div className="p-pills" role="group" aria-label="Style">
      {all.map((s) => {
        const on = value.includes(s);
        return (
          <button key={s} type="button" aria-pressed={on} className={`p-pill is-38${on ? " is-on" : ""}`} onClick={() => onChange(on ? value.filter((x) => x !== s) : [...value, s])}>
            {on ? <ProIcon name="check" size={14} sw={2.4} stroke="#ffffff" /> : null}
            {s}
          </button>
        );
      })}
    </div>
  );
}
