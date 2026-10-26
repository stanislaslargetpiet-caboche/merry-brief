"use client";

// Petites pièces de l'espace prestataire, d'après les maquettes : fenêtre (centrée sur ordinateur,
// feuille en bas sur téléphone), interrupteur, pastille de couple

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { coupleInitials, faceColor } from "@/lib/pro/format";

export function Sheet({ labelledBy, onClose, children, className = "", wide = false }) {
  const box = useRef(null);
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const before = document.activeElement;
    box.current?.querySelector("textarea, input, button")?.focus({ preventScroll: true });
    const body = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = body;
      before?.focus?.({ preventScroll: true });
    };
  }, [onClose]);
  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="d-root p-layer">
      <div className="p-scrim" aria-hidden="true" onClick={onClose} />
      <div ref={box} role="dialog" aria-modal="true" aria-labelledby={labelledBy} className={`p-sheet${wide ? " is-wide" : ""} ${className}`}>
        <span className="p-sheet-grip" aria-hidden="true" />
        {children}
      </div>
    </div>,
    document.body,
  );
}

export function Switch({ on, onChange, label, labelledBy, disabled }) {
  return (
    <button type="button" role="switch" aria-checked={!!on} aria-label={label} aria-labelledby={labelledBy} disabled={disabled} className={`p-switch${on ? " is-on" : ""}`} onClick={() => onChange(!on)}>
      <span />
    </button>
  );
}

export function Face({ names, size = 44 }) {
  return (
    <span aria-hidden="true" className="p-couple" style={{ width: size, height: size, background: faceColor(names), fontSize: size >= 44 ? 14 : 13 }}>
      {coupleInitials(names)}
    </span>
  );
}

// Choix en pastilles (style, traiteur, fin de soirée…)
export function Pills({ options, value, onChange, multiple = false, label }) {
  const isOn = (o) => (multiple ? (value || []).includes(o.value) : value === o.value);
  return (
    <div className="p-pills" role={multiple ? "group" : "radiogroup"} aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          className={`p-pill${isOn(o) ? " is-on" : ""}`}
          {...(multiple ? { "aria-pressed": isOn(o) } : { role: "radio", "aria-checked": isOn(o) })}
          onClick={() => {
            if (!multiple) onChange(o.value);
            else onChange(isOn(o) ? value.filter((x) => x !== o.value) : [...(value || []), o.value]);
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
