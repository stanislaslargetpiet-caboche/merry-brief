"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Icon } from "./icons";
import { pastel, RSVP } from "@/lib/dash/theme";

export function Btn({ kind = "primary", icon, href, small, onClick, children, type = "button", disabled, className = "", title, target }) {
  const cls = `d-btn d-btn-${kind}${small ? " d-btn-small" : ""} ${className}`;
  const inner = (
    <>
      {icon ? <Icon name={icon} size={16} sw={2} /> : null}
      {children}
    </>
  );
  if (href) {
    if (/^(https?:|mailto:|tel:)/.test(href)) {
      return (
        <a className={cls} href={href} title={title} target={target} rel={target ? "noreferrer" : undefined}>
          {inner}
        </a>
      );
    }
    return (
      <Link className={cls} href={href} title={title}>
        {inner}
      </Link>
    );
  }
  return (
    <button type={type} className={cls} onClick={onClick} disabled={disabled} title={title}>
      {inner}
    </button>
  );
}

export function Avatar({ member, size = 28, ring }) {
  const p = pastel(member?.color);
  return (
    <span
      className="d-avatar"
      title={member?.display_name}
      style={{ width: size, height: size, background: p.mid, fontSize: Math.max(10, Math.round(size * 0.42)), border: ring ? `2px solid ${ring}` : undefined }}
    >
      {member?.initial || (member?.display_name || "?").charAt(0).toUpperCase()}
    </span>
  );
}

export function Faces({ members, size = 20, ring = "#ffffff" }) {
  return (
    <span className="d-faces">
      {members.map((m, i) => (
        <span key={m.id} style={{ marginLeft: i ? -7 : 0, display: "inline-flex" }}>
          <Avatar member={m} size={size} ring={members.length > 1 ? ring : undefined} />
        </span>
      ))}
    </span>
  );
}

// Pastille d'une personne ou de « Vous deux »
export function PersonChip({ members, label, color }) {
  const list = members.filter(Boolean);
  if (!list.length) return <span className="d-muted d-small">À choisir</span>;
  const p = pastel(color || (list.length > 1 ? "jaune" : list[0].color));
  return (
    <span className="d-person" style={{ background: p.bg, color: p.ink }}>
      <Faces members={list} size={20} />
      {label || list.map((m) => m.display_name).join(" et ")}
    </span>
  );
}

export function GroupChip({ group, onClick, small = true }) {
  if (!group) return <span className="d-group d-group-none">Sans groupe</span>;
  const p = pastel(group.color);
  const Tag = onClick ? "button" : "span";
  return (
    <Tag type={onClick ? "button" : undefined} className={`d-group${small ? "" : " d-group-big"}`} style={{ background: p.bg, color: p.ink }} onClick={onClick}>
      {group.name}
    </Tag>
  );
}

export function RsvpChip({ status, onClick, open, title }) {
  const s = RSVP[status] || RSVP.non_invite;
  const Tag = onClick ? "button" : "span";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      className={`d-rsvp${open ? " is-open" : ""}`}
      style={{ background: s.bg, color: s.ink, fontWeight: s.weight }}
      onClick={onClick}
      title={title}
      aria-haspopup={onClick ? "menu" : undefined}
      aria-expanded={onClick ? !!open : undefined}
    >
      {s.check ? <Icon name="check" size={12} sw={2.4} /> : null}
      {s.label}
      {open ? <Icon name="chevDown" size={12} sw={2.2} /> : null}
    </Tag>
  );
}

export function OkPill({ children = "Payés", small }) {
  return (
    <span className={`d-okpill${small ? " is-small" : ""}`}>
      <Icon name="check" size={12} sw={2.4} />
      {children}
    </span>
  );
}

export function KpiBar({ items, plusHref, compact }) {
  return (
    <div className={`d-stats${compact ? " is-compact" : ""}`} style={{ "--cols": items.length + (plusHref ? 1 : 0) }}>
      {items.map((it) => (
        <div key={it.id || it.label} className="d-stat">
          <span className="d-stat-value">
            {it.value}
            {it.sub ? <span className="d-stat-sub"> {it.sub}</span> : null}
          </span>
          {it.pill ? <OkPill>{it.label}</OkPill> : <span className="d-stat-label">{it.label}</span>}
        </div>
      ))}
      {plusHref ? (
        <Link href={plusHref} className="d-stat-plus" title="Choisir les indicateurs">
          <span className="d-stat-plus-btn">
            <Icon name="plus" size={16} sw={2.2} />
          </span>
          <span>Indicateurs</span>
        </Link>
      ) : null}
    </div>
  );
}

export function Section({ title, right, count }) {
  return (
    <div className="d-section">
      <h2>
        {title}
        {count !== undefined ? <span className="d-count">{count}</span> : null}
      </h2>
      <span className="d-section-line" />
      {right}
    </div>
  );
}

export function PageHeader({ kicker, title, actions, back }) {
  return (
    <div className="d-header">
      <div className="d-header-text">
        {back ? (
          <Link href={back.href} className="d-back">
            <Icon name="back" size={16} sw={2} />
            {back.label}
          </Link>
        ) : null}
        {kicker ? <div className="d-kicker">{kicker}</div> : null}
        {title ? <h1 className="d-title">{title}</h1> : null}
      </div>
      {actions ? <div className="d-header-actions">{actions}</div> : null}
    </div>
  );
}

export function Checkbox({ done, onChange, label }) {
  return (
    <button type="button" className={`d-check${done ? " is-done" : ""}`} onClick={() => onChange(!done)} aria-pressed={done} aria-label={label}>
      {done ? <Icon name="check" size={14} sw={2.4} /> : null}
    </button>
  );
}

export function Bar({ value, color = "#1c1c1a", track = "#e4e2dc", height = 6 }) {
  return (
    <span className="d-bar" style={{ background: track, height }}>
      <span style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: color, height }} />
    </span>
  );
}

export function Modal({ title, onClose, children, footer, wide }) {
  const ref = useRef(null);
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.activeElement;
    (ref.current?.querySelector(".d-modal-body input, .d-modal-body textarea, .d-modal-body select") || ref.current?.querySelector("button"))?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      prev?.focus?.();
    };
  }, [onClose]);
  return (
    <div className="d-modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`d-modal${wide ? " is-wide" : ""}`} role="dialog" aria-modal="true" aria-label={title} ref={ref}>
        <div className="d-modal-head">
          <h2>{title}</h2>
          <button type="button" className="d-icon-btn" onClick={onClose} aria-label="Fermer">
            <Icon name="x" size={16} sw={2.2} />
          </button>
        </div>
        <div className="d-modal-body">{children}</div>
        {footer ? <div className="d-modal-foot">{footer}</div> : null}
      </div>
    </div>
  );
}

export function Field({ label, children, hint, full }) {
  return (
    <label className={`d-field${full ? " is-full" : ""}`}>
      <span className="d-field-label">{label}</span>
      {children}
      {hint ? <span className="d-field-hint">{hint}</span> : null}
    </label>
  );
}

// Menu déroulant ancré sous un élément ; se ferme au clic extérieur ou sur Échap
export function Popover({ open, onClose, children, align = "left", className = "" }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (ref.current && !ref.current.contains(e.target) && !ref.current.parentElement?.contains(e.target)) onClose();
    };
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div ref={ref} className={`d-pop d-pop-${align} ${className}`} role="menu">
      {children}
    </div>
  );
}

// Texte modifiable en place : un clic ouvre le champ, Entrée enregistre, Échap annule
export function InlineEdit({ value, onSave, placeholder = "–", className = "", inputClassName = "", width, label, display, multiline }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value || "");
  useEffect(() => {
    if (!editing) setDraft(value || "");
  }, [value, editing]);
  const commit = () => {
    setEditing(false);
    const next = draft.trim();
    if (next !== (value || "").trim()) onSave(next || null);
  };
  if (editing) {
    const props = {
      className: `d-inline-input ${inputClassName}`,
      value: draft,
      autoFocus: true,
      "aria-label": label,
      onChange: (e) => setDraft(e.target.value),
      onBlur: commit,
      onKeyDown: (e) => {
        if (e.key === "Enter" && !(multiline && e.shiftKey)) {
          e.preventDefault();
          commit();
        }
        if (e.key === "Escape") {
          setDraft(value || "");
          setEditing(false);
        }
      },
      style: width ? { width } : undefined,
    };
    return multiline ? <textarea rows={3} {...props} /> : <input {...props} />;
  }
  return (
    <button type="button" className={`d-inline ${className}${value ? "" : " is-empty"}`} onClick={() => setEditing(true)} title={label ? `Modifier : ${label}` : "Modifier"}>
      {display || value || placeholder}
    </button>
  );
}

// Camembert en anneau
export function Donut({ segments, size = 168, thickness = 26, center, sub }) {
  const total = segments.reduce((a, s) => a + Math.max(0, s.value), 0);
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="d-donut" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#efeee9" strokeWidth={thickness} />
        {total > 0
          ? segments.map((s, i) => {
              const len = (Math.max(0, s.value) / total) * c;
              const gap = segments.length > 1 && len > 4 ? 2 : 0;
              const el = (
                <circle
                  key={i}
                  cx={size / 2}
                  cy={size / 2}
                  r={r}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={thickness}
                  strokeDasharray={`${Math.max(0, len - gap)} ${c}`}
                  strokeDashoffset={-offset}
                  transform={`rotate(-90 ${size / 2} ${size / 2})`}
                />
              );
              offset += len;
              return el;
            })
          : null}
      </svg>
      <div className="d-donut-center">
        <strong>{center}</strong>
        {sub ? <span>{sub}</span> : null}
      </div>
    </div>
  );
}

export function Empty({ children, action }) {
  return (
    <div className="d-empty">
      <p>{children}</p>
      {action}
    </div>
  );
}
