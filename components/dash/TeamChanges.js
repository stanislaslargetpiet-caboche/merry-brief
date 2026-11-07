"use client";

// Pastille « Modifications » de la liste des invités : ce que les autres organisateurs ont changé sur les
// 3 derniers jours, par jour, avec l'ancienne et la nouvelle valeur. Sur ordinateur, un panneau sous la
// pastille ; sur téléphone, une feuille qui monte du bas. Rien à montrer : pas de pastille.

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { Icon } from "./icons";
import { Avatar, Faces, Popover } from "./ui";
import { RSVP } from "@/lib/dash/theme";
import { dayLabel, dePrefix, fieldLabel, namesLine, teamChanges, timeLabel } from "@/lib/dash/activity";

function Status({ value }) {
  const s = RSVP[value];
  if (!s) return null;
  return (
    <span className="d-tc-status" style={{ background: s.bg, color: s.ink }}>
      {s.label}
    </span>
  );
}

// Valeur lisible d'un champ : le nom du groupe plutôt que son identifiant
function shown(item, value, groups) {
  if (value == null || value === "") return "";
  if (item.field === "group_id") return groups.find((g) => g.id === value)?.name || "un groupe supprimé";
  return value;
}

function Change({ item, data, guestIds, onPick }) {
  const member = data.members.find((m) => m.id === item.member_id);
  const who = member?.display_name || "Un organisateur";
  // « Parents de Léo ont changé », « Léa a changé »
  const plural = /^(parents|les) /i.test(who);
  const one = item.guests.length === 1 ? item.guests[0] : null;
  const name = one ? <b>{one.name}</b> : null;
  const event = item.event_id ? data.events.find((e) => e.id === item.event_id) : null;
  const first = item.entries[item.entries.length - 1];
  const last = item.entries[0];
  let line;
  let sub = null;
  if (item.kind === "ajout") {
    line = one ? <>ajouté {name}</> : <>ajouté {item.guests.length} invités</>;
    if (!one) sub = namesLine(item.guests);
  } else if (item.kind === "retrait") {
    line = one ? <>retiré {name} de la liste</> : <>retiré {item.guests.length} invités</>;
    if (!one) sub = namesLine(item.guests);
  } else if (item.kind === "reponse") {
    line = one ? (
      <>
        changé la réponse {dePrefix(one.name)}
        {name}
      </>
    ) : (
      <>changé {item.guests.length} réponses</>
    );
    sub = one ? (
      <>
        {event?.name || "Un moment"} {first.old_value ? <Status value={first.old_value} /> : null}
        {first.old_value ? "→" : null} <Status value={last.new_value} />
      </>
    ) : (
      `${event?.name || "Un moment"} · ${namesLine(item.guests)}`
    );
  } else {
    const label = fieldLabel(item.field, data.fields);
    line = one ? (
      <>
        changé {label} {dePrefix(one.name)}
        {name}
      </>
    ) : (
      <>
        changé {label} de {item.guests.length} invités
      </>
    );
    if (one) {
      const before = shown(item, first.old_value, data.groups);
      const after = shown(item, last.new_value, data.groups);
      sub = (
        <>
          {before ? <s>{before}</s> : null}
          {before && after ? " → " : null}
          {after || (before ? " effacé" : null)}
        </>
      );
    } else sub = namesLine(item.guests);
  }
  const body = (
    <>
      <Avatar member={member} size={30} />
      <span className="d-tc-body">
        <span className="d-tc-line">
          <b>{who}</b> {plural ? "ont" : "a"} {line}
        </span>
        {sub ? <span className="d-tc-sub">{sub}</span> : null}
      </span>
      <time className="d-tc-time" dateTime={item.at}>
        {timeLabel(item.at)}
      </time>
    </>
  );
  if (one && guestIds.has(one.id)) {
    return (
      <Link href={`/dashboard/invites/${one.id}`} className="d-tc-item" onClick={onPick}>
        {body}
      </Link>
    );
  }
  return <div className="d-tc-item">{body}</div>;
}

function ChangesList({ items, data, onPick }) {
  const guestIds = useMemo(() => new Set(data.guests.map((g) => g.id)), [data.guests]);
  const days = [];
  for (const it of items) {
    const label = dayLabel(it.at);
    if (days[days.length - 1]?.label !== label) days.push({ label, items: [] });
    days[days.length - 1].items.push(it);
  }
  return (
    <div className="d-tc-list">
      {days.map((d, i) => (
        <section key={d.label} className="d-tc-day">
          {i ? <span className="d-tc-sep" aria-hidden="true" /> : null}
          <h3>{d.label}</h3>
          {d.items.map((it) => (
            <Change key={it.id} item={it} data={data} guestIds={guestIds} onPick={onPick} />
          ))}
        </section>
      ))}
    </div>
  );
}

function Sheet({ onClose, children }) {
  const [host, setHost] = useState(null);
  const ref = useRef(null);
  useEffect(() => setHost(document.body), []);
  useEffect(() => {
    if (!host) return undefined;
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.classList.add("d-noscroll");
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.classList.remove("d-noscroll");
    };
  }, [host, onClose]);
  if (!host) return null;
  return createPortal(
    <div className="d-msheet-layer">
      <div className="d-msheet-scrim" aria-hidden="true" onClick={onClose} />
      <div ref={ref} className="d-msheet d-tc-sheet" role="dialog" aria-modal="true" aria-label="Modifications de l'équipe">
        <div className="d-msheet-grip" aria-hidden="true" />
        {children}
      </div>
    </div>,
    host,
  );
}

export default function TeamChanges({ data, phone }) {
  const [open, setOpen] = useState(false);
  const items = useMemo(() => teamChanges(data.activity, data.meId), [data.activity, data.meId]);
  if (!items.length) return null;
  const authors = [...new Set(items.map((it) => it.member_id))].map((id) => data.members.find((m) => m.id === id)).filter(Boolean);
  const close = () => setOpen(false);
  const head = (
    <div className="d-tc-head">
      <div>
        <h2>Modifications de l'équipe</h2>
        <small>3 derniers jours</small>
      </div>
      {phone ? (
        <button type="button" className="d-icon-btn" onClick={close} aria-label="Fermer">
          <Icon name="x" size={16} sw={2.2} />
        </button>
      ) : null}
    </div>
  );
  const label = `${items.length} modification${items.length > 1 ? "s" : ""} de l'équipe`;
  return (
    <span className="d-anchor">
      <button
        type="button"
        className={`d-tc-pill${open ? " is-on" : ""}${phone ? " is-phone" : ""}`}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={phone ? label : undefined}
        title={phone ? undefined : label}
      >
        <Faces members={authors.slice(0, 3)} size={24} />
        {phone ? null : "Modifications"}
        <span className="d-tc-count">{items.length}</span>
      </button>
      {phone ? (
        open ? (
          <Sheet onClose={close}>
            {head}
            <ChangesList items={items} data={data} onPick={close} />
          </Sheet>
        ) : null
      ) : (
        <Popover open={open} onClose={close} className="d-tc-pop">
          {head}
          <ChangesList items={items} data={data} onPick={close} />
        </Popover>
      )}
    </span>
  );
}
