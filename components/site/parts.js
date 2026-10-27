"use client";

// Briques communes aux modèles du site : photos (ou leur emplacement), compte à rebours, perles,
// billets, tampons, QR code, questions, partage, réponse enregistrée, rubrique vide (aperçu seulement).

import { useEffect, useId, useState } from "react";
import QRCode from "qrcode";
import { ICONS, ORN } from "@/lib/site/ornaments";
import { downloadIcs, mapsUrl, RESPONSE_KEY } from "@/lib/site/model";

export function Orn({ name, className = "", style, width, height, flip, rotate, label, stretch }) {
  const o = ORN[name];
  if (!o) return null;
  const [, , w, h] = o.viewBox.split(" ").map(Number);
  // Retourné d'abord, puis tourné (comme dans les maquettes)
  const transform = [rotate ? `rotate(${rotate}deg)` : "", flip ? "scaleX(-1)" : ""].filter(Boolean).join(" ");
  return (
    <svg
      viewBox={o.viewBox}
      preserveAspectRatio={stretch ? "none" : undefined}
      width={width ?? w}
      height={height ?? h}
      className={`s-ornament ${className}`}
      style={{ display: "block", overflow: "visible", ...(transform ? { transform } : {}), ...style }}
      aria-hidden={label ? undefined : "true"}
      role={label ? "img" : undefined}
      aria-label={label}
      dangerouslySetInnerHTML={{ __html: o.body }}
    />
  );
}

export function Ico({ name, size = 24, sw = 1, className = "", style }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={sw}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
      style={{ flex: "none", ...style }}
      dangerouslySetInnerHTML={{ __html: ICONS[name] || "" }}
    />
  );
}

// ---------------------------------------------------------------------------
// Photos : la photo du couple, sinon l'emplacement teinté de la maquette (libellé dans l'aperçu seulement)
// ---------------------------------------------------------------------------

export function Photo({ src, tone = 1, label, preview, className = "", style, frame = true, round, position, gray, children }) {
  if (src) {
    return (
      <div className={`s-photo ${className}`} style={{ ...style, borderRadius: round }} role="img" aria-label={label || "Photo"}>
        <img src={src} alt="" style={{ objectPosition: position ? `center ${position}%` : undefined, filter: gray ? "grayscale(1) contrast(1.05)" : undefined }} />
        {children}
      </div>
    );
  }
  return (
    <div className={`s-photo is-empty is-t${tone} ${className}`} style={{ ...style, borderRadius: round }} aria-hidden="true">
      {frame ? <span className="s-photo-frame" style={{ borderRadius: round }} /> : null}
      {preview && label ? (
        <span className="s-photo-label">
          <Ico name="photo" size={16} sw={1.1} />
          {label}
        </span>
      ) : null}
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Compte à rebours jusqu'à la date (et l'heure) du mariage
// ---------------------------------------------------------------------------

export function useCountdown(dateIso, time) {
  const [now, setNow] = useState(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  if (!dateIso) return null;
  const [y, m, d] = dateIso.slice(0, 10).split("-").map(Number);
  const hm = /^(\d{1,2})[:h ]?(\d{2})?/.exec(String(time || ""));
  const target = new Date(y, m - 1, d, hm ? Number(hm[1]) : 0, hm?.[2] ? Number(hm[2]) : 0).getTime();
  const left = Math.max(0, target - (now ?? target));
  const s = Math.floor(left / 1000);
  const pad = (n) => String(n).padStart(2, "0");
  return { days: String(Math.floor(s / 86400)), hours: pad(Math.floor((s % 86400) / 3600)), minutes: pad(Math.floor((s % 3600) / 60)), seconds: pad(s % 60), done: now !== null && left === 0 };
}

// ---------------------------------------------------------------------------
// Perles (Perle) : un rang suspendu, et le chemin du programme
// ---------------------------------------------------------------------------

function pearl(x, y, r, key) {
  const hl = r * 0.36;
  return (
    <g key={key}>
      <circle className="s-orn s-pearl" cx={x.toFixed(1)} cy={y.toFixed(1)} r={r} strokeWidth=".8" />
      <circle cx={(x - hl).toFixed(1)} cy={(y - hl).toFixed(1)} r={(r * 0.28).toFixed(1)} fill="#ffffff" />
    </g>
  );
}

// Rang de perles en guirlande : largeur, creux au milieu, rayon
export function Pearls({ width = 420, sag = 30, r = 5, className = "", style }) {
  const n = Math.max(3, Math.round((width - 12) / (r * 2.16)));
  const items = [];
  for (let i = 0; i < n; i += 1) {
    const t = i / (n - 1);
    items.push(pearl(r + 1 + t * (width - 2 * r - 2), r + 3 + sag * 4 * t * (1 - t), r, i));
  }
  return (
    <svg viewBox={`0 0 ${width} ${sag + 2 * r + 8}`} width={width} height={sag + 2 * r + 8} className={className} style={{ display: "block", overflow: "visible", maxWidth: "100%", ...style }} aria-hidden="true">
      {items}
    </svg>
  );
}

// Chemin de perles du programme : serpente au milieu, un moment de chaque côté à tour de rôle
export function PearlPath({ count, step = 170, width = 560, className = "" }) {
  const height = 30 + step * Math.max(1, count);
  const amp = width * 0.214;
  const pts = [];
  let last = null;
  for (let y = 10; y <= height - 20; y += 0.5) {
    const x = width / 2 + amp * Math.sin(((y - 10) / (step * 2)) * Math.PI * 2);
    if (!last || Math.hypot(x - last[0], y - last[1]) >= 19) {
      pts.push([x, y]);
      last = [x, y];
    }
  }
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} className={className} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }} aria-hidden="true">
      {pts.map(([x, y], i) => pearl(x, y, 7, i))}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Billet (Embarquement) : bords perforés et encoches
// ---------------------------------------------------------------------------

export function Ticket({ notch = "50%", className = "", style, children }) {
  return (
    <div className={`s-ticket ${className}`} style={{ "--notch": notch, ...style }}>
      <span className="s-ticket-n is-l" />
      <span className="s-ticket-n is-r" />
      {children}
    </div>
  );
}

// Tampon rond avec texte en arc (Embarquement)
export function Stamp({ top, bottom, size = 104 }) {
  const id = useId().replace(/:/g, "");
  const c = size / 2;
  const r1 = c - 13;
  const r2 = c - 7;
  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} aria-hidden="true" className="s-stamp">
      <defs>
        <path id={`${id}t`} d={`M${c - r1} ${c} A${r1} ${r1} 0 0 1 ${c + r1} ${c}`} />
        <path id={`${id}b`} d={`M${c - r2} ${c} A${r2} ${r2} 0 0 0 ${c + r2} ${c}`} />
      </defs>
      <circle className="s-ink" cx={c} cy={c} r={c - 2} fill="none" strokeWidth="1.2" />
      <circle className="s-ink" cx={c} cy={c} r={size * 0.29} fill="none" strokeWidth=".8" />
      <text className="f-ink" fontFamily="var(--f-sans)" fontSize="8.5" letterSpacing="1.6">
        <textPath href={`#${id}t`} startOffset="50%" textAnchor="middle">
          {top}
        </textPath>
      </text>
      <text className="f-ink" fontFamily="var(--f-sans)" fontSize="8.5" letterSpacing="1.6">
        <textPath href={`#${id}b`} startOffset="50%" textAnchor="middle">
          {bottom}
        </textPath>
      </text>
      <g transform={`translate(${c - 11} ${c - 11})`} className="s-ink">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: ICONS.avion }} />
      </g>
    </svg>
  );
}

// ---------------------------------------------------------------------------
// QR code du site
// ---------------------------------------------------------------------------

export function QR({ url, size = 72, className = "" }) {
  const [svg, setSvg] = useState("");
  useEffect(() => {
    let live = true;
    QRCode.toString(url || "https://merry.fr", { type: "svg", margin: 0, errorCorrectionLevel: "M", color: { dark: "#000000", light: "#0000" } })
      .then((s) => live && setSvg(s.replace(/fill="#000000"/g, 'fill="currentColor"').replace(/stroke="#000000"/g, 'stroke="currentColor"')))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [url]);
  return <span className={`s-qr ${className}`} style={{ width: size, height: size }} role="img" aria-label="QR code du site" dangerouslySetInnerHTML={{ __html: svg }} />;
}

// ---------------------------------------------------------------------------
// Questions : accordéon (la première ouverte)
// ---------------------------------------------------------------------------

export function Faq({ items, titleClass = "", textClass = "", iconSize = 14, groups = true }) {
  const [open, setOpen] = useState(0);
  let lastGroup = null;
  return (
    <div className="s-faq">
      {items.map((q, i) => {
        const head = groups && q.group && q.group !== lastGroup ? q.group : null;
        lastGroup = q.group || lastGroup;
        const on = open === i;
        return (
          <div key={i}>
            {head ? <div className="s-faq-group">{head}</div> : null}
            <div className="s-faq-item">
              <button type="button" className="s-faq-q" aria-expanded={on} onClick={() => setOpen(on ? -1 : i)}>
                <span className={titleClass}>{q.q}</span>
                <Ico name={on ? "moins" : "plus"} size={iconSize} />
              </button>
              {on && q.a ? <p className={`s-faq-a ${textClass}`}>{q.a}</p> : null}
            </div>
          </div>
        );
      })}
      <div className="s-faq-end" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Actions : agenda, itinéraire, partage
// ---------------------------------------------------------------------------

export function AgendaLink({ v, className, children, style }) {
  return (
    <button type="button" className={className} style={style} onClick={() => downloadIcs(v)}>
      {children}
    </button>
  );
}

export function RouteLink({ v, address, className, children, style }) {
  const href = mapsUrl(address || [v.venueName, v.venueAddress].filter(Boolean).join(", "));
  if (!href) return null;
  return (
    <a className={className} style={style} href={href} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  );
}

export function useShare(v) {
  const [copied, setCopied] = useState(false);
  const url = typeof window === "undefined" ? "" : window.location.href.split("#")[0].split("?")[0];
  return {
    url,
    copied,
    whatsapp: `https://wa.me/?text=${encodeURIComponent(`${v.names} : toutes les infos du mariage ${url}`)}`,
    copy: async () => {
      try {
        await navigator.clipboard.writeText(url);
      } catch {
        window.prompt("Copiez le lien :", url);
        return;
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    },
  };
}

// ---------------------------------------------------------------------------
// Réponse enregistrée : ce que cet invité a envoyé depuis ce navigateur (formulaire /f/…)
// ---------------------------------------------------------------------------

export function useSavedResponse(formSlug, preview) {
  const [res, setRes] = useState(null);
  useEffect(() => {
    if (preview) {
      setRes({ names: "Claire et Paul Martin", moments: ["Mairie", "dîner de la veille", "cérémonie et réception"], present: true, example: true });
      return;
    }
    if (!formSlug) return;
    try {
      const raw = window.localStorage.getItem(RESPONSE_KEY(formSlug));
      if (raw) setRes(JSON.parse(raw));
    } catch {
      // stockage indisponible : la rubrique invite à répondre
    }
  }, [formSlug, preview]);
  return res;
}

export function joinList(xs) {
  const a = xs.filter(Boolean);
  if (a.length < 2) return a[0] || "";
  return `${a.slice(0, -1).join(", ")} et ${a[a.length - 1]}`;
}

// Rubrique sans contenu : visible dans l'aperçu du tableau de bord seulement
export function EmptySection({ label }) {
  return (
    <div className="s-empty">
      <strong>{label}</strong>
      <span>Rubrique vide : remplissez-la dans le tableau de bord. Vos invités ne la voient pas.</span>
    </div>
  );
}
