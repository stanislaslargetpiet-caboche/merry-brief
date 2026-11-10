"use client";

// Liste des invités sur téléphone : une seule tâche par écran, répondre vite.
// - les chiffres dans un panneau (lien vers les indicateurs), avec la barre des réponses reçues ;
// - une recherche avec les filtres dedans ;
// - des sections par groupe (ou par réponse), repliables, avec leur compte ;
// - une ligne par invité : nom, pastille de réponse ; glisser à droite = vient, à gauche = ne vient pas ;
// - la pastille ouvre une feuille en bas : la réponse pour chaque moment, et la fiche.
// Le filtrage, le tri et l'enregistrement (avec Annuler) restent ceux de la page : la liste reçoit `shown`
// et `applyValues`, rien n'est recalculé ici.

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { GUEST_STATUS_LABEL, guestLabel, guestStats, guestStatus } from "@/lib/dash/model";
import { fullName } from "@/lib/dash/format";
import { RSVP, RSVP_ORDER, pastel } from "@/lib/dash/theme";
import TeamChanges from "./TeamChanges";
import { Icon } from "./icons";
import { trapTab } from "./ui";

const GROUP_KEY = "merry.invites.mobile.group";
const SWIPE_PX = 72; // le geste compte au-delà de cette distance
const STATUS_ORDER = ["attente", "oui", "non", "non_invite"];

function readGroupBy(fallback) {
  try {
    const v = window.localStorage.getItem(GROUP_KEY);
    return ["groupe", "reponse", "aucun"].includes(v) ? v : fallback;
  } catch {
    return fallback;
  }
}

// Les moments auxquels l'invité est convié : c'est à ceux-là qu'un glissement répond
const invitedEvents = (r, events) => events.filter((ev) => (r[ev.id] || "non_invite") !== "non_invite");

export default function InvitesMobile({ data, shown, stats, events, groups, idx, byId, groupById, query, setQuery, filterCount, onFilters, applyValues, okUndo }) {
  const filtered = filterCount > 0 || query.trim().length > 0;
  const [groupBy, setGroupBy] = useState(() => readGroupBy(groups.length > 1 ? "groupe" : "aucun"));
  const [closed, setClosed] = useState(() => new Set());
  const [sheet, setSheet] = useState(null); // id de l'invité dont la feuille est ouverte

  const changeGroupBy = (v) => {
    setGroupBy(v);
    try {
      window.localStorage.setItem(GROUP_KEY, v);
    } catch {
      /* stockage indisponible */
    }
  };

  // Sections : par groupe (l'ordre des groupes, « Sans groupe » en dernier), par réponse, ou une seule
  const sections = useMemo(() => {
    if (groupBy === "aucun") return [{ key: "all", label: null, items: shown }];
    const map = new Map();
    for (const g of shown) {
      const k = groupBy === "groupe" ? g.group_id || "none" : guestStatus(idx.get(g.id) || {}, events);
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(g);
    }
    if (groupBy === "groupe") {
      const order = [...groups.map((x) => x.id), "none"];
      return order.filter((k) => map.has(k)).map((k) => ({ key: k, label: k === "none" ? "Sans groupe" : groupById.get(k)?.name || "Groupe", color: groupById.get(k)?.color, items: map.get(k) }));
    }
    return STATUS_ORDER.filter((k) => map.has(k)).map((k) => ({ key: k, label: GUEST_STATUS_LABEL[k], status: k, items: map.get(k) }));
  }, [groupBy, shown, groups, groupById, idx, events]);
  // Beaucoup de groupes : tout replié au départ, sauf si l'on cherche ou filtre
  const manySections = sections.length > 8 && !filtered;
  const isOpen = (key) => (manySections ? closed.has(`open:${key}`) : !closed.has(key));
  const toggle = (key) =>
    setClosed((s) => {
      const next = new Set(s);
      const k = manySections ? `open:${key}` : key;
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });

  // Un glissement répond pour tous les moments où l'invité est convié
  const answer = async (g, status) => {
    const r = idx.get(g.id) || {};
    const evs = invitedEvents(r, events);
    if (!evs.length) return;
    const { n, step } = await applyValues(evs.map((ev) => ({ id: g.id, key: `ev:${ev.id}`, value: status })));
    if (n) okUndo(`${guestLabel(g, byId)} : ${status === "oui" ? "vient" : "ne vient pas"}.`, step);
  };

  const current = sheet ? byId.get(sheet) : null;
  // Sur téléphone, seul un pourcentage tient sous le chiffre ; « (dont 2 non invités) » reste sur ordinateur
  const cells = (stats || []).map((it) => ({ ...it, sub: it.sub && it.sub.includes("%") ? it.sub : undefined }));
  const answers = useMemo(() => guestStats(data), [data]);

  return (
    <div className="d-mlist">
      {/* Les indicateurs choisis dans « Vos indicateurs », puis la part d'invités qui ont répondu */}
      <Link href="/dashboard/indicateurs/invites" className="d-mkpi" title="Choisir les indicateurs" style={{ "--cols": cells.length || 1 }}>
        {cells.map((it) => (
          <span key={it.id} className="d-mkpi-cell">
            <strong>
              {it.value}
              {it.sub ? <i> {it.sub}</i> : null}
            </strong>
            <small>{it.label}</small>
          </span>
        ))}
        {answers.invited ? (
          <span className="d-mkpi-bar" role="img" aria-label={`${answers.answered} réponses sur ${answers.invited} invités`}>
            <span style={{ width: `${Math.round((answers.answered / answers.invited) * 100)}%` }} />
          </span>
        ) : null}
        {filtered ? (
          <span className="d-mkpi-note">
            {shown.length} affiché{shown.length > 1 ? "s" : ""} sur {data.guests.length}
          </span>
        ) : null}
      </Link>

      <div className="d-mbar">
        <label className="d-msearch">
          <Icon name="search" size={16} sw={2} />
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Chercher un invité" aria-label="Chercher un invité" enterKeyHint="search" />
          {query ? (
            <button type="button" className="d-msearch-clear" aria-label="Effacer la recherche" onClick={() => setQuery("")}>
              <Icon name="x" size={14} sw={2.4} />
            </button>
          ) : null}
          <button type="button" className={`d-msearch-filters${filterCount ? " is-on" : ""}`} onClick={onFilters} aria-label={filterCount ? `Filtres, ${filterCount} actifs` : "Filtres"}>
            <Icon name="list" size={16} sw={2.2} />
            {filterCount ? <span>{filterCount}</span> : null}
          </button>
        </label>
        <TeamChanges data={data} phone />
      </div>

      <div className="d-mlist-group" role="group" aria-label="Grouper par">
        {[
          ["groupe", "Par groupe"],
          ["reponse", "Par réponse"],
          ["aucun", "Tout"],
        ].map(([k, label]) => (
          <button key={k} type="button" className={groupBy === k ? "is-on" : undefined} aria-pressed={groupBy === k} onClick={() => changeGroupBy(k)}>
            {label}
          </button>
        ))}
      </div>

      {!shown.length ? (
        <p className="d-muted d-small d-mlist-empty">{data.guests.length ? "Aucun invité ne correspond." : "Pas encore d'invité : appuyez sur + pour commencer."}</p>
      ) : (
        sections.map((s) => {
          const open = isOpen(s.key);
          return (
            <section key={s.key} className="d-msec">
              {s.label ? (
                <button type="button" className="d-msec-head" onClick={() => toggle(s.key)} aria-expanded={open}>
                  {s.color ? <i style={{ background: pastel(s.color).ink }} aria-hidden="true" /> : null}
                  <strong>{s.label}</strong>
                  <span>{s.items.length}</span>
                  <Icon name="chevDown" size={14} sw={2.4} style={{ transform: open ? "rotate(180deg)" : undefined }} />
                </button>
              ) : null}
              {open || !s.label ? (
                <div className="d-mcards">
                  {s.items.map((g) => (
                    <Row key={g.id} guest={g} events={events} idx={idx} byId={byId} groupById={groupById} showGroup={groupBy !== "groupe"} onOpen={() => setSheet(g.id)} onAnswer={answer} />
                  ))}
                </div>
              ) : null}
            </section>
          );
        })
      )}

      {current ? <GuestSheet guest={current} events={events} idx={idx} byId={byId} groupById={groupById} onClose={() => setSheet(null)} onPick={(ev, k) => applyValues([{ id: current.id, key: `ev:${ev.id}`, value: k }])} /> : null}
    </div>
  );
}

// Une ligne : glisser à droite = vient, à gauche = ne vient pas (seulement si l'invité est convié quelque part)
function Row({ guest: g, events, idx, byId, groupById, showGroup, onOpen, onAnswer }) {
  const r = idx.get(g.id) || {};
  const status = guestStatus(r, events);
  const host = g.plus_one_of ? byId.get(g.plus_one_of) : null;
  const label = guestLabel(g, byId) || (host ? `+1 de ${fullName(host)}` : "Sans nom");
  const group = groupById.get(g.group_id);
  const sub = [showGroup && group ? group.name : null, g.age ? `${g.age} ans` : null, host && !fullName(g) ? "À nommer" : null].filter(Boolean).join(" · ");
  const canSwipe = invitedEvents(r, events).length > 0;
  const [dx, setDx] = useState(0);
  const drag = useRef(null); // { x, y, id, horizontal }
  const onDown = (e) => {
    if (!canSwipe || e.pointerType === "mouse") return;
    drag.current = { x: e.clientX, y: e.clientY, horizontal: null };
  };
  const onMove = (e) => {
    const d = drag.current;
    if (!d) return;
    const mx = e.clientX - d.x;
    const my = e.clientY - d.y;
    if (d.horizontal === null) {
      if (Math.abs(mx) < 8 && Math.abs(my) < 8) return;
      d.horizontal = Math.abs(mx) > Math.abs(my);
    }
    if (!d.horizontal) return;
    setDx(Math.max(-120, Math.min(120, mx)));
  };
  const onUp = () => {
    const d = drag.current;
    drag.current = null;
    if (!d || !d.horizontal) {
      setDx(0);
      return;
    }
    if (dx >= SWIPE_PX) onAnswer(g, "oui");
    else if (dx <= -SWIPE_PX) onAnswer(g, "non");
    setDx(0);
  };
  return (
    <div className={`d-mcard${dx ? " is-dragging" : ""}`} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
      {canSwipe ? (
        <div className="d-mcard-hints" aria-hidden="true">
          <span className={`is-oui${dx >= SWIPE_PX ? " is-armed" : ""}`}>Vient</span>
          <span className={`is-non${dx <= -SWIPE_PX ? " is-armed" : ""}`}>Ne vient pas</span>
        </div>
      ) : null}
      <div className="d-mcard-face" style={dx ? { transform: `translateX(${dx}px)` } : undefined}>
        <Link href={`/dashboard/invites/${g.id}`} className="d-mcard-main" style={{ borderLeftColor: group ? pastel(group.color).ink : "transparent" }} draggable={false} onClick={(e) => drag.current?.horizontal && e.preventDefault()}>
          <strong className={status === "non" ? "is-non" : undefined}>{label}</strong>
          {sub ? <small>{sub}</small> : null}
        </Link>
        <button type="button" className={`d-mcard-status is-${status}`} onClick={onOpen} aria-label={`${GUEST_STATUS_LABEL[status]} : modifier la réponse de ${label}`}>
          {GUEST_STATUS_LABEL[status]}
        </button>
      </div>
    </div>
  );
}

// Feuille en bas : la réponse pour chaque moment, et la fiche
function GuestSheet({ guest: g, events, idx, byId, groupById, onClose, onPick }) {
  const ref = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const [host, setHost] = useState(null);
  useEffect(() => setHost(document.querySelector(".d-root") || document.body), []);
  useEffect(() => {
    if (!host) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") closeRef.current();
      else trapTab(ref.current, e);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.activeElement;
    ref.current?.querySelector("button")?.focus({ preventScroll: true });
    document.body.classList.add("d-noscroll");
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.classList.remove("d-noscroll");
      prev?.focus?.({ preventScroll: true });
    };
  }, [host]);
  if (!host) return null;
  const r = idx.get(g.id) || {};
  const group = groupById.get(g.group_id);
  const label = guestLabel(g, byId) || "Sans nom";
  return createPortal(
    <div className="d-msheet-layer">
      <div className="d-msheet-scrim" aria-hidden="true" onClick={onClose} />
      <div ref={ref} className="d-msheet" role="dialog" aria-modal="true" aria-label={`Réponse de ${label}`}>
        <div className="d-msheet-grip" aria-hidden="true" />
        <div className="d-msheet-head">
          <div>
            <strong>{label}</strong>
            {group ? <small>{group.name}</small> : null}
          </div>
          <button type="button" className="d-icon-btn" onClick={onClose} aria-label="Fermer">
            <Icon name="x" size={16} sw={2.2} />
          </button>
        </div>
        <div className="d-msheet-moments">
          {events.map((ev) => {
            const st = r[ev.id] || "non_invite";
            return (
              <div key={ev.id} className="d-msheet-moment">
                <span>{ev.name}</span>
                <div className="d-msheet-seg" role="group" aria-label={`${ev.name} : réponse`}>
                  {RSVP_ORDER.map((k) => (
                    <button key={k} type="button" className={st === k ? "is-on" : undefined} aria-pressed={st === k} style={st === k ? { background: RSVP[k].bg, color: RSVP[k].ink } : undefined} onClick={() => onPick(ev, k)}>
                      {RSVP[k].label}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
          {!events.length ? <p className="d-small d-muted">Ajoutez un moment (cocktail, dîner…) pour noter les réponses.</p> : null}
        </div>
        <div className="d-msheet-actions">
          <Link href={`/dashboard/invites/${g.id}`} className="d-btn d-btn-primary">
            Voir la fiche
          </Link>
        </div>
      </div>
    </div>,
    host,
  );
}
