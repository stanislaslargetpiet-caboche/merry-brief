"use client";

// Petites pièces de l'espace prestataire, d'après les maquettes : fenêtre (centrée sur ordinateur,
// feuille en bas sur téléphone), interrupteur, pastille de couple

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { coupleInitials, faceColor } from "@/lib/pro/format";

// Sous-onglets d'une section groupée de la barre latérale (Mon profil, Messagerie) : évite
// d'empiler trop d'entrées dans la barre, comme sur les maquettes « Mon profil » et « Messagerie »
export function ProSubnav({ items, label }) {
  const pathname = usePathname();
  return (
    <nav aria-label={label} className="p-subnav">
      {items.map((it) => {
        const on = pathname === it.href;
        return (
          <Link key={it.href} href={it.href} className={`p-subtab${on ? " is-on" : ""}`} aria-current={on ? "page" : undefined}>
            {it.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function Sheet({ labelledBy, onClose, children, className = "", wide = false }) {
  const box = useRef(null);
  // onClose est le plus souvent une fonction fléchée recréée à chaque rendu : lue par une référence, sinon
  // chaque changement d'état relançait l'effet (écouteurs réinstallés, focus renvoyé au premier bouton)
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") closeRef.current();
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
  }, []);
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
