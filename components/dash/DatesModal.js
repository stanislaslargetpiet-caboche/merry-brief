"use client";

// Les grandes dates : quels moments le mariage comporte, et quand. Chaque moment coché devient
// un moment de la liste des invités (s'il n'existe pas) et ajoute ses tâches type au rétroplanning.

import { useMemo, useState } from "react";
import { useDash } from "@/lib/dash/store";
import { KEY_DATES, eventOfKind, eventDate, tasksForKind } from "@/lib/dash/dates";
import { coupleIds } from "@/lib/dash/model";
import { applyShift, shiftPlan } from "@/lib/dash/shift";
import ShiftOption from "./ShiftOption";
import { addDays, isoDate, longDate, uid } from "@/lib/dash/format";
import { shortEventName } from "./MomentsModal";
import { Icon, Tile } from "./icons";
import { Btn, Modal } from "./ui";

export const DATES_SEEN_KEY = "merry-dates-seen";

export default function DatesModal({ onClose, first }) {
  const dash = useDash();
  const { events, wedding, guests, tasks, members } = dash.data;
  const [rows, setRows] = useState(() =>
    KEY_DATES.map((k) => {
      const ev = k.fixed ? null : eventOfKind(events, k.kind);
      return { ...k, on: k.fixed ? true : !!ev, date: k.fixed ? wedding.wedding_date || "" : ev ? eventDate(ev, wedding) || "" : k.offset !== null && wedding.wedding_date ? isoDate(addDays(wedding.wedding_date, k.offset)) : "", ev };
    }),
  );
  const [busy, setBusy] = useState(false);
  const [shift, setShift] = useState(true);
  // Le jour J change : les tâches de Merry suivent (les moments ont leurs propres dates ici)
  const newJourJ = rows.find((r) => r.fixed)?.date || null;
  const plan = useMemo(() => shiftPlan(dash.data, wedding.wedding_date || null, newJourJ, { events: false }), [dash.data, wedding.wedding_date, newJourJ]);

  const set = (kind, patch) => setRows((rs) => rs.map((r) => (r.kind === kind ? { ...r, ...patch } : r)));

  async function save() {
    setBusy(true);
    const now = new Date().toISOString();
    let added = 0;
    for (const r of rows) {
      if (r.fixed) {
        if (r.date && r.date !== wedding.wedding_date) {
          await dash.updateWedding({ wedding_date: r.date });
          if (plan && shift) await applyShift(dash, plan);
        }
        continue;
      }
      if (r.on) {
        let ev = r.ev;
        if (!ev) {
          const id = uid();
          const position = events.length ? Math.max(...events.map((x) => x.position)) + 1 : 0;
          [ev] = await dash.insert("events", { id, name: r.label, short_name: shortEventName(r.short), position, kind: r.kind, event_date: r.date || null });
          if (guests.length) await dash.insert("guest_responses", guests.map((g) => ({ guest_id: g.id, event_id: id, status: "attente", updated_at: now })));
        } else if ((ev.event_date || null) !== (r.date || null) || ev.kind !== r.kind) await dash.update("events", ev.id, { event_date: r.date || null, kind: r.kind });
        if (r.date) {
          const fresh = tasksForKind(r.kind, r.date, [...tasks, ...dash.data.tasks].map((t) => t.title), coupleIds(members));
          if (fresh.length) {
            await dash.insert("tasks", fresh.map((t, i) => ({ ...t, position: dash.data.tasks.length + i })));
            added += fresh.length;
          }
        }
      } else if (r.ev) {
        if (window.confirm(`Retirer « ${r.ev.name} » des moments ? Les réponses des invités à ce moment seront effacées.`)) await dash.remove("events", r.ev.id);
      }
    }
    try {
      window.localStorage.setItem(`${DATES_SEEN_KEY}-${wedding.id}`, "1");
    } catch {
      /* ignore */
    }
    setBusy(false);
    dash.setToast({ kind: "ok", text: added ? `Grandes dates enregistrées, ${added} tâche${added > 1 ? "s" : ""} ajoutée${added > 1 ? "s" : ""} au rétroplanning.` : "Grandes dates enregistrées." });
    onClose();
  }

  return (
    <Modal
      title={first ? "Les grandes dates de votre mariage" : "Les grandes dates"}
      onClose={onClose}
      wide
      footer={
        <>
          <Btn kind="ghost" onClick={onClose}>
            {first ? "Plus tard" : "Annuler"}
          </Btn>
          <Btn onClick={save} disabled={busy}>
            {busy ? "Enregistrement…" : "Enregistrer"}
          </Btn>
        </>
      }
    >
      <p className="d-muted" style={{ margin: 0 }}>
        Cochez ce qui fait partie de votre mariage : le rétroplanning s'adapte et les tâches qui vont avec s'ajoutent.
      </p>
      <div className="d-col" style={{ gap: 8 }}>
        {rows.map((r) => (
          <div key={r.kind} className={`d-keydate${r.on ? " is-on" : ""}`}>
            <button type="button" className={`d-check${r.on ? " is-done" : ""}`} aria-pressed={r.on} aria-label={r.label} disabled={r.fixed} onClick={() => set(r.kind, { on: !r.on })}>
              {r.on ? <Icon name="check" size={14} sw={2.4} /> : null}
            </button>
            <Tile name={r.icon} size={36} bg={r.on ? "var(--d-limetint)" : "var(--d-panel)"} />
            <span className="d-keydate-text">
              <strong>{r.label}</strong>
              <span className="d-small d-muted">{r.on && r.date ? longDate(r.date) : r.hint}</span>
            </span>
            {r.on ? (
              <span className="d-keydate-date">
                <input className="d-input" type="date" value={r.date || ""} onChange={(e) => set(r.kind, { date: e.target.value })} aria-label={`Date : ${r.label}`} />
                {!r.fixed && r.offset !== null && wedding.wedding_date ? (
                  <button type="button" className="d-link" style={{ fontSize: 12 }} onClick={() => set(r.kind, { date: isoDate(addDays(wedding.wedding_date, r.offset)) })}>
                    {r.offset === 0 ? "Le jour J" : r.offset < 0 ? "La veille" : "Le lendemain"}
                  </button>
                ) : null}
              </span>
            ) : (
              <span className="d-small d-muted d-keydate-date">Non prévu</span>
            )}
          </div>
        ))}
      </div>
      <ShiftOption plan={plan} checked={shift} onChange={setShift} />
      <p className="d-small d-muted" style={{ margin: 0 }}>
        Chaque moment coché a sa colonne de réponses dans la liste des invités. Vous pourrez changer les dates ici à tout moment.
      </p>
    </Modal>
  );
}
