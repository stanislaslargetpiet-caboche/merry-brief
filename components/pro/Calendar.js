"use client";

// Calendrier des disponibilités (maquettes V3/V3m, fusionné avec Tarifs) : un mois, chaque date
// libre, en option ou réservée. Ordinateur : fenêtre posée sous la date ; téléphone : feuille en bas.

import { useEffect, useMemo, useState } from "react";
import { usePro } from "@/lib/pro/store";
import { addDays, isoDate, shortDate, toDate, today } from "@/lib/dash/format";
import { dateLong, dayLong, monthName, todayIsoLocal } from "@/lib/pro/format";
import { ProIcon } from "@/components/pro/icons";
import { Sheet } from "@/components/pro/ui";
import { CloseBtn } from "@/components/pro/FeatureDialog";

const WEEK = ["Lun.", "Mar.", "Mer.", "Jeu.", "Ven.", "Sam.", "Dim."];
const OTHER = "__autre__";

function usePhone() {
  const [phone, setPhone] = useState(false);
  useEffect(() => {
    const m = window.matchMedia("(max-width: 700px)");
    const on = () => setPhone(m.matches);
    on();
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, []);
  return phone;
}

// Les cases d'un mois, du lundi au dimanche
function monthGrid(year, month) {
  const first = new Date(year, month, 1);
  const start = addDays(first, -((first.getDay() + 6) % 7));
  const last = new Date(year, month + 1, 0);
  const end = addDays(last, (7 - last.getDay()) % 7);
  const days = [];
  for (let d = start; d <= end; d = addDays(d, 1)) days.push(d);
  return days;
}

export default function AvailabilityCalendar() {
  const pro = usePro();
  const d = pro.data;
  const phone = usePhone();
  const byDay = useMemo(() => new Map(d.dates.map((x) => [x.day, x])), [d.dates]);
  const clients = d.clients || [];
  const nameOf = (x) => clients.find((c) => c.id === x.client_id)?.names || x.label || "";
  const now = todayIsoLocal();

  // Le calendrier s'ouvre toujours sur le mois en cours
  const [month, setMonth] = useState(() => ({ y: today().getFullYear(), m: today().getMonth() }));
  const [open, setOpen] = useState(null);
  // Sélection de plusieurs jours à la fois, pour poser une option ou une réservation en une fois
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState(() => new Set());
  const [anchorDay, setAnchorDay] = useState(null);
  const [multiOpen, setMultiOpen] = useState(false);
  const days = monthGrid(month.y, month.m);
  const monthIsos = useMemo(() => days.filter((x) => x.getMonth() === month.m).map(isoDate), [days, month.m]);
  const go = (delta) => {
    const x = new Date(month.y, month.m + delta, 1);
    setMonth({ y: x.getFullYear(), m: x.getMonth() });
    setOpen(null);
    setSelected(new Set());
    setAnchorDay(null);
  };
  const inMonth = d.dates.filter((x) => toDate(x.day).getMonth() === month.m && toDate(x.day).getFullYear() === month.y).sort((a, b) => a.day.localeCompare(b.day));

  const openDay = (iso) => {
    const x = toDate(iso);
    if (x.getMonth() !== month.m || x.getFullYear() !== month.y) setMonth({ y: x.getFullYear(), m: x.getMonth() });
    setOpen(iso);
  };

  const toggleSelectMode = () => {
    setSelectMode((v) => !v);
    setSelected(new Set());
    setAnchorDay(null);
    setOpen(null);
  };

  const dayClick = (iso, e) => {
    if (!selectMode) {
      setOpen(open === iso ? null : iso);
      return;
    }
    setSelected((prev) => {
      const next = new Set(prev);
      if (e.shiftKey && anchorDay) {
        const i1 = monthIsos.indexOf(anchorDay);
        const i2 = monthIsos.indexOf(iso);
        if (i1 !== -1 && i2 !== -1) {
          const [lo, hi] = i1 < i2 ? [i1, i2] : [i2, i1];
          for (let i = lo; i <= hi; i++) next.add(monthIsos[i]);
          return next;
        }
      }
      if (next.has(iso)) next.delete(iso);
      else next.add(iso);
      return next;
    });
    setAnchorDay(iso);
  };

  const closeMulti = () => {
    setMultiOpen(false);
    setSelectMode(false);
    setSelected(new Set());
    setAnchorDay(null);
  };

  const editor = open ? <DayEditor day={open} entry={byDay.get(open)} clients={clients} phone={phone} onClose={() => setOpen(null)} /> : null;
  const selectedDays = useMemo(() => monthIsos.filter((iso) => selected.has(iso)), [monthIsos, selected]);
  const multiEditor = multiOpen ? <MultiDayEditor days={selectedDays} clients={clients} onClose={closeMulti} /> : null;

  return (
    <section className="p-dispo">
      <div className="p-dispo-grid is-single">
        <section className="p-cal">
          <div className="p-cal-head">
            <h2>
              {monthName(new Date(month.y, month.m, 1))} {month.y}
            </h2>
            <span className="p-cal-headactions">
              <button type="button" className={`p-btn p-btn-ghost is-40${selectMode ? " is-on" : ""}`} aria-pressed={selectMode} onClick={toggleSelectMode}>
                {selectMode ? "Terminé" : "Sélectionner plusieurs jours"}
              </button>
              <span className="p-cal-nav">
                <button type="button" aria-label="Mois précédent" onClick={() => go(-1)}>
                  <ProIcon name="prev" size={16} sw={2} />
                </button>
                <button type="button" aria-label="Mois suivant" onClick={() => go(1)}>
                  <ProIcon name="next" size={16} sw={2} />
                </button>
              </span>
            </span>
          </div>
          {selectMode ? (
            <div className="p-cal-select-bar">
              <span>
                {selected.size
                  ? `${selected.size} jour${selected.size > 1 ? "s" : ""} sélectionné${selected.size > 1 ? "s" : ""}`
                  : phone
                    ? "Touchez des jours à modifier ensemble"
                    : "Cliquez sur des jours, ou Maj + clic pour une période"}
              </span>
              <button type="button" className="p-btn p-btn-primary is-40" disabled={!selected.size} onClick={() => setMultiOpen(true)}>
                Modifier
              </button>
            </div>
          ) : null}
          <Legend className="p-desk-only" />
          <Legend className="p-phone-only is-dots" />
          <div className="p-cal-days">
            {WEEK.map((w, k) => (
              <div key={w} className={`p-cal-wd${k >= 5 ? " is-we" : ""}`}>
                {phone ? w.replace(".", "") : w}
              </div>
            ))}
            {days.map((day) => {
              const iso = isoDate(day);
              const out = day.getMonth() !== month.m;
              const we = day.getDay() === 0 || day.getDay() === 6;
              if (out) {
                return (
                  <div key={iso} aria-hidden="true" className={`p-cal-out${we ? " is-we" : ""}`}>
                    {day.getDate()}
                  </div>
                );
              }
              const x = byDay.get(iso);
              const who = x ? nameOf(x) : "";
              const state = x ? (x.status === "reserve" ? "réservé" : "option posée") : "libre";
              const isSel = selectMode && selected.has(iso);
              const label = `${dateLong(iso)}, ${state}${who ? `, ${who}` : ""}${x?.status === "option" && x.expires_on ? `, expire le ${shortDate(x.expires_on)}` : ""}${selectMode ? isSel ? ", sélectionné" : ", non sélectionné" : ""}`;
              return (
                <div key={iso} className="p-cal-cellwrap">
                  <button
                    type="button"
                    aria-label={label}
                    aria-expanded={!selectMode ? open === iso : undefined}
                    aria-pressed={selectMode ? isSel : undefined}
                    className={`p-cal-day${we ? " is-we" : ""}${x ? ` is-${x.status}` : ""}${open === iso ? " is-open" : ""}${isSel ? " is-selected" : ""}`}
                    onClick={(e) => dayClick(iso, e)}
                  >
                    {selectMode ? <span className={`p-cal-check${isSel ? " is-on" : ""}`} aria-hidden="true" /> : null}
                    <span className="p-cal-n">{day.getDate()}</span>
                    {x ? (
                      <>
                        <span className="p-cal-who">{who}</span>
                        <span className="p-cal-state">{x.status === "reserve" ? "Réservé" : x.expires_on ? `Option, expire le ${shortDate(x.expires_on)}` : "Option"}</span>
                        <span className={`p-cal-dot is-${x.status}`} aria-hidden="true" />
                      </>
                    ) : null}
                  </button>
                  {open === iso && !selectMode && !phone ? editor : null}
                </div>
              );
            })}
          </div>
        </section>

        <div className="p-dispo-side">
          {inMonth.length ? (
            <section className="p-block is-4 p-phone-only is-col">
              <h2 className="p-h2 is-16">En {monthName(new Date(month.y, month.m, 1)).toLowerCase()}</h2>
              <ul className="p-rows">
                {inMonth.map((x) => (
                  <li key={x.id} className="p-month-row">
                    <span className="p-month-day">{shortDate(x.day, { year: false }).replace(".", ".")}</span>
                    <button type="button" className="p-month-who" onClick={() => openDay(x.day)}>
                      <span className="p-month-name">{nameOf(x) || "Date bloquée"}</span>
                      <span className="p-month-state">{x.status === "reserve" ? "Réservé" : x.expires_on ? `Option, expire le ${shortDate(x.expires_on)}` : "Option"}</span>
                    </button>
                    <span className={`p-chip ${x.status === "reserve" ? "is-dark" : "is-planned"}`}>{x.status === "reserve" ? "Réservé" : "Option"}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      </div>
      {open && phone ? editor : null}
      {multiEditor}
    </section>
  );
}

function Legend({ className = "" }) {
  return (
    <div aria-label="Légende" className={`p-legend ${className}`}>
      <span>
        <span className="p-legend-box" />
        Libre
      </span>
      <span>
        <span className="p-legend-box is-option" />
        Option posée
      </span>
      <span>
        <span className="p-legend-box is-reserve" />
        Réservé
      </span>
    </div>
  );
}

// État, couple et expiration d'une option : partagé entre l'édition d'un jour et de plusieurs jours
function useDayStatusState(entry, choices) {
  const [status, setStatus] = useState(entry?.status || "option");
  const [who, setWho] = useState(entry?.client_id || (entry?.label ? OTHER : choices[0]?.id || OTHER));
  const [label, setLabel] = useState(entry?.label || "");
  const [expires, setExpires] = useState(entry?.expires_on || isoDate(addDays(today(), 14)));
  return { status, setStatus, who, setWho, label, setLabel, expires, setExpires };
}

function DayStatusFields({ idPrefix, state, choices }) {
  const { status, setStatus, who, setWho, label, setLabel, expires, setExpires } = state;
  return (
    <>
      <div role="radiogroup" aria-label="État de la date" className="p-day-states">
        {[
          ["libre", "Libre"],
          ["option", "Poser une option"],
          ["reserve", "Réservé"],
        ].map(([k, l]) => (
          <button key={k} type="button" role="radio" aria-checked={status === k} className={`p-day-state${status === k ? " is-on" : ""}`} onClick={() => setStatus(k)}>
            {l}
          </button>
        ))}
      </div>
      {status !== "libre" ? (
        <>
          <div className="p-field">
            <label htmlFor={`${idPrefix}-couple`}>Couple</label>
            <select id={`${idPrefix}-couple`} className="p-input" value={who} onChange={(e) => setWho(e.target.value)}>
              {choices.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.names}
                </option>
              ))}
              <option value={OTHER}>Un autre couple…</option>
            </select>
          </div>
          {who === OTHER ? (
            <div className="p-field">
              <label htmlFor={`${idPrefix}-autre`}>Nom du couple</label>
              <input id={`${idPrefix}-autre`} className="p-input" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Julie & Paul" />
            </div>
          ) : null}
          {status === "option" ? (
            <div className="p-field">
              <label htmlFor={`${idPrefix}-exp`}>L’option expire le</label>
              <div className="p-input p-unit">
                <ProIcon name="calendar" size={16} stroke="#6b6a63" />
                <input id={`${idPrefix}-exp`} type="date" className="p-unit-input" value={expires || ""} onChange={(e) => setExpires(e.target.value)} />
              </div>
            </div>
          ) : null}
        </>
      ) : null}
    </>
  );
}

// Libre, option (avec le couple et la fin de l'option) ou réservé
function DayEditor({ day, entry, clients, phone, onClose }) {
  const pro = usePro();
  const choices = clients.filter((c) => c.stage !== "perdu");
  const state = useDayStatusState(entry, choices);
  const { status, who, label, expires } = state;
  const title = dayLong(day);

  async function save() {
    if (status === "libre") await pro.setDay(day, null);
    else await pro.setDay(day, { status, client_id: who === OTHER ? null : who, label: who === OTHER ? label.trim() || null : null, expires_on: expires });
    onClose();
  }

  const body = (
    <>
      <DayStatusFields idPrefix="day-pop" state={state} choices={choices} />
      <div className="p-day-foot">
        <button type="button" className="p-day-cancel" onClick={onClose}>
          Annuler
        </button>
        <button type="button" className="p-btn p-btn-primary" onClick={save} disabled={status !== "libre" && who === OTHER && !label.trim()}>
          Enregistrer
        </button>
      </div>
    </>
  );

  if (phone) {
    return (
      <Sheet labelledBy="day-title" onClose={onClose} className="p-day-sheet">
        <div className="p-day-head">
          <strong id="day-title">{title}</strong>
          <CloseBtn onClose={onClose} />
        </div>
        {body}
      </Sheet>
    );
  }
  return (
    <div role="dialog" aria-label={title} className="p-day-pop" onKeyDown={(e) => e.key === "Escape" && onClose()}>
      <div className="p-day-head">
        <strong>{title}</strong>
        <button type="button" className="p-day-x" aria-label="Fermer" onClick={onClose}>
          <ProIcon name="x" size={16} sw={2} />
        </button>
      </div>
      {body}
    </div>
  );
}

// Même état (libre, option, réservé) posé sur plusieurs jours à la fois
function MultiDayEditor({ days, clients, onClose }) {
  const pro = usePro();
  const choices = clients.filter((c) => c.stage !== "perdu");
  const state = useDayStatusState(null, choices);
  const { status, who, label, expires } = state;
  const sorted = useMemo(() => [...days].sort(), [days]);
  const title = `${sorted.length} jour${sorted.length > 1 ? "s" : ""} sélectionné${sorted.length > 1 ? "s" : ""}`;
  const summary = sorted.length > 3 ? `${shortDate(sorted[0])} – ${shortDate(sorted[sorted.length - 1])}` : sorted.map((x) => shortDate(x)).join(", ");

  async function save() {
    const payload = status === "libre" ? null : { status, client_id: who === OTHER ? null : who, label: who === OTHER ? label.trim() || null : null, expires_on: expires };
    await Promise.all(sorted.map((day) => pro.setDay(day, payload)));
    onClose();
  }

  const body = (
    <>
      <p className="p-note">{summary}</p>
      <DayStatusFields idPrefix="day-multi" state={state} choices={choices} />
      <div className="p-day-foot">
        <button type="button" className="p-day-cancel" onClick={onClose}>
          Annuler
        </button>
        <button type="button" className="p-btn p-btn-primary" onClick={save} disabled={!sorted.length || (status !== "libre" && who === OTHER && !label.trim())}>
          Appliquer à {sorted.length} jour{sorted.length > 1 ? "s" : ""}
        </button>
      </div>
    </>
  );

  return (
    <Sheet labelledBy="multi-day-title" onClose={onClose} className="p-day-sheet">
      <div className="p-day-head">
        <strong id="multi-day-title">{title}</strong>
        <CloseBtn onClose={onClose} />
      </div>
      {body}
    </Sheet>
  );
}
