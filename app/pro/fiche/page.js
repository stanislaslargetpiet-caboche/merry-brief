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

const CATERER = [
  { value: "libre", label: "Libre" },
  { value: "impose", label: "Imposé" },
  { value: "liste", label: "Liste de traiteurs" },
];
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
        <h1 className="p-h1 is-page">Ma fiche.</h1>
        <button type="button" className="p-btn p-btn-ghost p-phone-wide" onClick={() => router.push("/pro/fiche?apercu=1")}>
          <ProIcon name="eye" size={18} />
          Aperçu côté couples
        </button>
      </div>
      <ProSubnav items={PRO_PROFIL_TABS} label="Sections de Mon profil" />

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
          <h2 className="p-sec-title">Accès</h2>
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

  return (
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
