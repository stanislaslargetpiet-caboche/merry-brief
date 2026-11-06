"use client";

// Ma fiche (maquettes V2 et V2m) : ce que les couples voient du prestataire. Chaque modification part
// tout de suite dans le catalogue que lisent les couples. ?apercu=1 ouvre l'aperçu côté couples (V2b, V2n).
// Audit du 3 nov. 2026 : seuls restent les champs que les couples voient vraiment (places debout, fin de
// soirée, adresse exacte, zone, rayon et taille d'équipe retirés ; import de vidéo retiré, seul un lien
// est montré aux couples). Bloc « Plus d'informations » retiré pour tous les métiers le 5 nov. 2026 (demande de Stan).

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { usePro } from "@/lib/pro/store";
import { ProIcon } from "@/components/pro/icons";
import { Pills, ProSubnav, Switch } from "@/components/pro/ui";
import { PRO_PROFIL_TABS } from "@/components/pro/Shell";
import { BusyDots } from "@/components/dash/ui";
import Apercu from "@/components/pro/Apercu";
import { searchAddress } from "@/lib/pro/geo";

const PHOTOS_MIN = 3;
const DESC_MIN = 300;
const validMail = (t) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(t));
const validPhone = (t) => {
  const n = String(t).replace(/\D/g, "");
  return n.length >= 9 && n.length <= 15;
};

const CATERER = [
  { value: "libre", label: "Libre" },
  { value: "impose", label: "Imposé" },
  { value: "liste", label: "Liste de traiteurs" },
];
const catererOf = (det) => (det.caterer_mode ? det.caterer_mode : det.caterer_imposed === false ? "libre" : det.caterer_imposed === true ? "impose" : "");
// Champs obligatoires (demande de Stan le 5 nov. 2026) : tout sauf site internet, brochure et vidéo.
// Un champ vide est signalé, astérisque et message, sans bloquer l'enregistrement ni la fiche.
const isEmpty = (x) => x === null || x === undefined || x === "" || (Array.isArray(x) && !x.length);
const Req = () => (
  <span className="p-req" aria-hidden="true">
    {" "}
    *
  </span>
);
const Missing = ({ when, children = "Ce champ est obligatoire." }) => (when ? <p className="p-hint is-warn">{children}</p> : null);

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
          <label htmlFor="desc">
            Description
            <Req />
          </label>
          <TextArea id="desc" rows={4} min={DESC_MIN} value={v.description || ""} onSave={(t) => save({ description: t })} />
        </div>
        <div className="p-grid2">
          <TextField id="site" label="Site internet" value={v.website} onSave={(t) => save({ website: t || null })} />
          <AddressField
            value={v.address}
            onValidated={async ({ address, postal_code, city }) => {
              await save({ address, ...(postal_code ? { postal_code } : {}), ...(city ? { city } : {}) });
              if (address) pro.calcAccess();
            }}
          />
        </div>
        <div className="p-grid2">
          <TextField required id="tel" type="tel" label="Téléphone" value={v.phone} check={validPhone} checkText="Vérifiez ce numéro de téléphone." onSave={(t) => save({ phone: t || null })} />
          <div>
            <TextField required id="mail" type="email" label="Mail" value={v.email} check={validMail} checkText="Vérifiez cette adresse mail." onSave={(t) => save({ email: t || null })} />
            <MailCheck email={v.email} />
          </div>
        </div>
        <TextField id="brochure" label="Lien vers la brochure (PDF)" value={det.brochure_url} onSave={(t) => save({ brochure_url: t || null })} />
      </section>

      {isLieu ? (
        <section className="p-sec" id="lieu">
          <h2 className="p-sec-title">Le lieu</h2>
          <div className="p-grid2">
            <NumberField required id="assis" label="Places assises" value={v.capacity_seated} onSave={(n) => save({ capacity_seated: num(n) })} />
            <NumberField required id="couch" label="Couchages" value={v.beds} onSave={(n) => save({ beds: num(n) })} />
          </div>
          <div className="p-field is-8">
            <span id="trait">
              Traiteur
              <Req />
            </span>
            <Pills
              label="Traiteur"
              options={CATERER}
              value={catererOf(det)}
              onChange={(mode) => save({ caterer_mode: mode, caterer_imposed: mode !== "libre" })}
            />
            <Missing when={!catererOf(det)}>Choisissez une réponse.</Missing>
          </div>
        </section>
      ) : null}

      <section className="p-sec" id="acces">
        <h2 className="p-sec-title">Gare et aéroport</h2>
        <p className="p-hint">Activez ce qui est à proximité, puis ajustez le trajet : il est estimé depuis l’adresse, à corriger à la main.</p>
        <div className="p-toggles">
          <TransportRow id="gare" label="Gare à proximité" nameKey="station_name" minutesKey="station_minutes" pick={(a) => a?.station} />
          <TransportRow id="aero" label="Aéroport à proximité" nameKey="airport_name" minutesKey="airport_minutes" pick={(a) => a?.airport} />
        </div>
      </section>

      {isLieu ? (
        <section className="p-sec" id="parking">
          <h2 className="p-sec-title">Accès</h2>
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
      <h2 className="p-sec-title">
        Photos
        <Req />
      </h2>
      {photos.length < PHOTOS_MIN ? <p className="p-hint is-warn">Ajoutez au moins {PHOTOS_MIN} photos pour publier votre fiche.</p> : null}
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
              <button
                type="button"
                className="p-photo-btn is-remove"
                aria-label={`Retirer ${label}`}
                disabled={photos.length <= PHOTOS_MIN}
                title={photos.length <= PHOTOS_MIN ? `Au moins ${PHOTOS_MIN} photos sont requises` : undefined}
                onClick={() => pro.removePhoto(ph.path)}
              >
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

// ---------- Mail de contact : vérifié par un code à 6 chiffres (app/api/pro/contact) ----------

const MAIL_ERRORS = {
  bad_code: "Ce code n’est pas le bon.",
  expired: "Ce code n’est plus valable : demandez-en un nouveau.",
  wait: "Trop de codes demandés : réessayez dans une heure.",
  no_email: "Enregistrez d’abord une adresse mail valide.",
};

// Rien ne s'affiche tant que supabase/pro-fiche-mail-verifie.sql n'est pas en place (colonne absente)
function MailCheck({ email }) {
  const pro = usePro();
  const [step, setStep] = useState("idle");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const mail = String(email || "").trim().toLowerCase();

  // Une autre adresse : le code demandé pour la précédente ne sert plus
  useEffect(() => {
    setStep("idle");
    setCode("");
    setError(null);
  }, [mail]);

  if (!pro.data.pro || !("email_verified" in pro.data.pro) || !validMail(mail)) return null;
  if (pro.data.pro.email_verified === mail) return <p className="p-hint p-verified">Adresse vérifiée</p>;

  const run = async (action) => {
    setBusy(true);
    setError(null);
    const res = await pro.verifyMail(action, code);
    setBusy(false);
    if (res.error) setError(MAIL_ERRORS[res.error] || "La vérification n’a pas abouti : réessayez.");
    else if (res.sent) {
      setCode("");
      setStep("code");
    }
  };

  return (
    <div className="p-verify">
      {step === "code" ? (
        <>
          <label htmlFor="mail-code" className="p-hint">
            Code reçu à cette adresse
          </label>
          <div className="p-verify-row">
            <input
              id="mail-code"
              className="p-input"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              onKeyDown={(e) => e.key === "Enter" && code.length === 6 && run("verify")}
            />
            <button type="button" className="p-btn p-btn-ghost" disabled={busy || code.length !== 6} onClick={() => run("verify")}>
              {busy ? <BusyDots /> : "Valider"}
            </button>
          </div>
          <button type="button" className="p-verify-again" disabled={busy} onClick={() => run("send")}>
            Renvoyer le code
          </button>
        </>
      ) : (
        <button type="button" className="p-btn p-btn-ghost p-start" disabled={busy} onClick={() => run("send")}>
          {busy ? <BusyDots /> : "Vérifier cette adresse"}
        </button>
      )}
      <Missing when={!!error}>{error}</Missing>
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

function TextInput({ id, value, onSave, placeholder, type = "text", className = "p-input", required }) {
  const [draft, setDraft] = useDraft(value);
  return (
    <input
      id={id}
      type={type}
      className={className}
      value={draft}
      placeholder={placeholder}
      aria-required={required || undefined}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => String(draft) !== String(value ?? "") && onSave(typeof draft === "string" ? draft.trim() : draft)}
      onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
    />
  );
}

// `min` : longueur minimale signalée sous le champ, décomptée pendant la saisie (le texte reste enregistré)
function TextArea({ id, value, onSave, rows, min }) {
  const [draft, setDraft] = useDraft(value);
  const left = min ? min - draft.trim().length : 0;
  return (
    <>
      <textarea id={id} rows={rows} className="p-textarea" aria-required={min ? true : undefined} value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={() => draft !== (value || "") && onSave(draft.trim())} />
      <Missing when={left > 0}>
        {min} caractères au minimum : il en manque {left}.
      </Missing>
    </>
  );
}

// Adresse : recherche en direct (Géoplateforme de l'IGN, gratuite et sans clé — lib/pro/geo.js), à
// valider dans la liste plutôt que tapée au hasard. Sans suggestion choisie, le texte tapé reste
// enregistré tel quel à la perte du focus (adresse déjà connue, Google My Business absent du catalogue…).
function AddressField({ value, onValidated }) {
  const [draft, setDraft] = useDraft(value);
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [validated, setValidated] = useState(!!value);

  useEffect(() => {
    if (draft.trim().length < 4) {
      setResults([]);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      searchAddress(draft, { signal: ctrl.signal })
        .then(setResults)
        .catch(() => {});
    }, 300);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [draft]);

  const pick = (r) => {
    setDraft(r.address);
    setValidated(true);
    setOpen(false);
    setResults([]);
    onValidated({ address: r.address, postal_code: r.postal_code, city: r.city });
  };

  return (
    <div className="p-field p-address">
      <label htmlFor="adresse">
        Adresse
        <Req />
      </label>
      <input
        id="adresse"
        className="p-input"
        autoComplete="off"
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value);
          setValidated(false);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          setTimeout(() => setOpen(false), 150);
          if (draft.trim() !== (value || "").trim()) onValidated({ address: draft.trim() || null });
        }}
      />
      {open && results.length ? (
        <ul className="p-address-list" role="listbox" aria-label="Suggestions d’adresse">
          {results.map((r) => (
            <li key={r.label}>
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => pick(r)}>
                {r.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {!validated && draft.trim() ? <p className="p-hint">Choisissez une suggestion pour vérifier l’adresse.</p> : null}
      <Missing when={isEmpty(value)} />
    </div>
  );
}

// `check` : format attendu d'une valeur déjà saisie (téléphone, mail), signalé sans bloquer
function TextField({ id, label, value, onSave, required, type, check, checkText }) {
  return (
    <div className="p-field">
      <label htmlFor={id}>
        {label}
        {required ? <Req /> : null}
      </label>
      <TextInput id={id} type={type} value={value} onSave={onSave} required={required} />
      <Missing when={required && isEmpty(value)} />
      <Missing when={!isEmpty(value) && check && !check(value)}>{checkText}</Missing>
    </div>
  );
}

function NumberField({ id, label, value, onSave, required }) {
  return (
    <div className="p-field">
      <label htmlFor={id}>
        {label}
        {required ? <Req /> : null}
      </label>
      <TextInput id={id} type="number" value={value ?? ""} onSave={onSave} required={required} />
      <Missing when={required && isEmpty(value)} />
    </div>
  );
}

// Gare ou aéroport à proximité : « oui » enregistre un trajet de départ (estimé depuis l'adresse, 15 min à
// défaut), « non » vide le nom et le trajet (colonnes *_name et *_minutes de vendors, lues par les couples).
// La jauge ne part qu'au relâchement pour ne pas enregistrer à chaque cran.
const MAX_MINUTES = 120;
function TransportRow({ id, label, nameKey, minutesKey, pick }) {
  const pro = usePro();
  const v = pro.data.vendor;
  const minutes = v[minutesKey];
  const on = minutes !== null && minutes !== undefined;
  const [draft, setDraft] = useState(null);
  const shown = draft ?? minutes ?? 0;

  const toggle = async (next) => {
    if (!next) return pro.saveFiche({ [nameKey]: null, [minutesKey]: null });
    const est = pick(await pro.estimateAccess());
    return pro.saveFiche({ [nameKey]: est?.name || null, [minutesKey]: Math.min(est?.minutes ?? 15, MAX_MINUTES) });
  };
  const commit = (e) => {
    const n = Number(e.currentTarget.value);
    setDraft(null);
    if (n !== minutes) pro.saveFiche({ [minutesKey]: n });
  };

  return (
    <div className="p-toggle-block">
      <div className="p-toggle">
        <span id={`${id}-l`}>{label}</span>
        <Switch on={on} labelledBy={`${id}-l`} onChange={toggle} />
      </div>
      {on ? (
        <div className="p-range">
          <TextField id={`${id}-n`} label={nameKey === "station_name" ? "Nom de la gare" : "Nom de l’aéroport"} value={v[nameKey]} onSave={(t) => pro.saveFiche({ [nameKey]: t || null })} />
          <div className="p-field">
            <label htmlFor={`${id}-r`}>Trajet estimé</label>
            <div className="p-range-row">
              <input
                id={`${id}-r`}
                type="range"
                min={0}
                max={MAX_MINUTES}
                step={5}
                value={shown}
                aria-valuetext={`${shown} min`}
                onChange={(e) => setDraft(Number(e.target.value))}
                onPointerUp={commit}
                onKeyUp={commit}
                onBlur={commit}
              />
              <output htmlFor={`${id}-r`}>{shown} min</output>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

