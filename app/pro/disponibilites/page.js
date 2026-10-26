"use client";

// Disponibilités (maquettes V4 et V4m) : un mois, chaque date libre, en option ou réservée.
// Ordinateur : fenêtre posée sous la date ; téléphone : feuille en bas de l'écran.

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

export default function Disponibilites() {
  const pro = usePro();
  const d = pro.data;
  const phone = usePhone();
  const byDay = useMemo(() => new Map(d.dates.map((x) => [x.day, x])), [d.dates]);
  const clients = d.clients || [];
  const nameOf = (x) => clients.find((c) => c.id === x.client_id)?.names || x.label || "";
  const now = todayIsoLocal();

  // Mois affiché : celui de la prochaine date posée, sinon le mois en cours
  const [month, setMonth] = useState(() => {
    const next = [...d.dates].filter((x) => x.day >= now).sort((a, b) => a.day.localeCompare(b.day))[0];
    const base = toDate(next?.day) || today();
    return { y: base.getFullYear(), m: base.getMonth() };
  });
  const [open, setOpen] = useState(null);
  const days = monthGrid(month.y, month.m);
  const go = (delta) => {
    const x = new Date(month.y, month.m + delta, 1);
    setMonth({ y: x.getFullYear(), m: x.getMonth() });
    setOpen(null);
  };
  const expiring = d.dates.filter((x) => x.status === "option" && x.expires_on).sort((a, b) => a.expires_on.localeCompare(b.expires_on));
  const inMonth = d.dates.filter((x) => toDate(x.day).getMonth() === month.m && toDate(x.day).getFullYear() === month.y).sort((a, b) => a.day.localeCompare(b.day));

  const openDay = (iso) => {
    const x = toDate(iso);
    if (x.getMonth() !== month.m || x.getFullYear() !== month.y) setMonth({ y: x.getFullYear(), m: x.getMonth() });
    setOpen(iso);
  };

  const editor = open ? <DayEditor day={open} entry={byDay.get(open)} clients={clients} phone={phone} onClose={() => setOpen(null)} /> : null;

  return (
    <div className="p-dispo">
      <div className="p-head-text is-8">
        <h1 className="p-h1 is-page">Disponibilités.</h1>
        <p className="p-lead">{phone ? "Touchez" : "Cliquez sur"} une date pour la bloquer, poser une option ou la marquer réservée.</p>
      </div>
      <div className="p-dispo-grid">
        <section className="p-cal">
          <div className="p-cal-head">
            <h2>
              {monthName(new Date(month.y, month.m, 1))} {month.y}
            </h2>
            <span className="p-cal-nav">
              <button type="button" aria-label="Mois précédent" onClick={() => go(-1)}>
                <ProIcon name="prev" size={16} sw={2} />
              </button>
              <button type="button" aria-label="Mois suivant" onClick={() => go(1)}>
                <ProIcon name="next" size={16} sw={2} />
              </button>
            </span>
          </div>
          <Legend className="p-desk-only" />
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
              const label = `${dateLong(iso)}, ${state}${who ? `, ${who}` : ""}${x?.status === "option" && x.expires_on ? `, expire le ${shortDate(x.expires_on)}` : ""}`;
              return (
                <div key={iso} className="p-cal-cellwrap">
                  <button
                    type="button"
                    aria-label={label}
                    aria-expanded={open === iso}
                    className={`p-cal-day${we ? " is-we" : ""}${x ? ` is-${x.status}` : ""}${open === iso ? " is-open" : ""}`}
                    onClick={() => setOpen(open === iso ? null : iso)}
                  >
                    <span className="p-cal-n">{day.getDate()}</span>
                    {x ? (
                      <>
                        <span className="p-cal-who">{who}</span>
                        <span className="p-cal-state">{x.status === "reserve" ? "Réservé" : x.expires_on ? `Option, expire le ${shortDate(x.expires_on)}` : "Option"}</span>
                        <span className={`p-cal-dot is-${x.status}`} aria-hidden="true" />
                      </>
                    ) : null}
                  </button>
                  {open === iso && !phone ? editor : null}
                </div>
              );
            })}
          </div>
          <Legend className="p-phone-only is-dots" />
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
          <SyncCard />
          {expiring.length ? (
            <section className="p-expiring">
              <h2>Options qui expirent bientôt</h2>
              <ul className="p-rows">
                {expiring.slice(0, 5).map((x) => (
                  <li key={x.id}>
                    <span className="p-who is-3">
                      <span className="p-exp-name">{nameOf(x) || "Option"}</span>
                      <span className="p-exp-meta">
                        {dateLong(x.day)} · Expire le {shortDate(x.expires_on)}
                      </span>
                    </span>
                    <button type="button" className="p-link is-135" onClick={() => openDay(x.day)}>
                      Prolonger
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      </div>
      {open && phone ? editor : null}
    </div>
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

// Libre, option (avec le couple et la fin de l'option) ou réservé
function DayEditor({ day, entry, clients, phone, onClose }) {
  const pro = usePro();
  const choices = clients.filter((c) => c.stage !== "perdu");
  const [status, setStatus] = useState(entry?.status || "option");
  const [who, setWho] = useState(entry?.client_id || (entry?.label ? OTHER : choices[0]?.id || OTHER));
  const [label, setLabel] = useState(entry?.label || "");
  const [expires, setExpires] = useState(entry?.expires_on || isoDate(addDays(today(), 14)));
  const title = dayLong(day);

  async function save() {
    if (status === "libre") await pro.setDay(day, null);
    else await pro.setDay(day, { status, client_id: who === OTHER ? null : who, label: who === OTHER ? label.trim() || null : null, expires_on: expires });
    onClose();
  }

  const body = (
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
            <label htmlFor="couple-pop">Couple</label>
            <select id="couple-pop" className="p-input" value={who} onChange={(e) => setWho(e.target.value)}>
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
              <label htmlFor="couple-autre">Nom du couple</label>
              <input id="couple-autre" className="p-input" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Julie & Paul" />
            </div>
          ) : null}
          {status === "option" ? (
            <div className="p-field">
              <label htmlFor="exp-pop">L’option expire le</label>
              <div className="p-input p-unit">
                <ProIcon name="calendar" size={16} stroke="#6b6a63" />
                <input id="exp-pop" type="date" className="p-unit-input" value={expires || ""} onChange={(e) => setExpires(e.target.value)} />
              </div>
            </div>
          ) : null}
        </>
      ) : null}
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

// Lien d'agenda privé (iCal), lu par Google Agenda, Apple Calendrier ou Outlook
function SyncCard() {
  const pro = usePro();
  const token = pro.data.pro?.ical_token;
  const feed = () => `${window.location.origin}/api/pro/agenda/${token}.ics`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(feed());
      return true;
    } catch {
      return false;
    }
  }

  async function google() {
    if (pro.mode === "demo") return pro.setToast({ kind: "ok", text: "En démo, l’agenda n’est pas relié." });
    window.open(`https://calendar.google.com/calendar/r?cid=${encodeURIComponent(feed().replace(/^https?:/, "webcal:"))}`, "_blank", "noopener");
  }

  async function ical() {
    if (pro.mode === "demo") return pro.setToast({ kind: "ok", text: "En démo, l’agenda n’est pas relié." });
    const copied = await copy();
    window.location.href = feed().replace(/^https?:/, "webcal:");
    pro.setToast({ kind: "ok", text: copied ? "Lien de l’agenda copié : collez-le dans Outlook ou un autre agenda si besoin." : "Votre agenda va s’ouvrir pour s’abonner à vos dates." });
  }

  return (
    <section className="p-sync">
      <h2>Synchroniser mon agenda</h2>
      <p>Vos dates réservées et vos options apparaissent dans votre agenda habituel.</p>
      <div className="p-sync-btns">
        <button type="button" className="p-btn p-btn-ghost" onClick={google}>
          <ProIcon name="calendar" size={17} />
          Google Agenda
        </button>
        <button type="button" className="p-btn p-btn-ghost" onClick={ical}>
          <ProIcon name="calendar" size={17} />
          iCal
        </button>
      </div>
    </section>
  );
}
