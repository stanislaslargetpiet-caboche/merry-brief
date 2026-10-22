"use client";

// Modifier plusieurs invités à la fois, sur plusieurs catégories en une seule action :
// groupe, moments et colonnes personnalisées. Seules les lignes cochées sont appliquées.

import { useMemo, useState } from "react";
import { useDash } from "@/lib/dash/store";
import { guestLabel } from "@/lib/dash/model";
import { fullName } from "@/lib/dash/format";
import { pastel } from "@/lib/dash/theme";
import { Icon } from "./icons";
import { Btn, Modal } from "./ui";

// Un invité par ligne : on part toujours de son propre custom pour ne pas effacer ses autres colonnes
function applyFields(guest, fieldPatches) {
  const custom = { ...(guest.custom || {}) };
  for (const [fieldId, value] of Object.entries(fieldPatches)) {
    if (value) custom[fieldId] = value;
    else delete custom[fieldId];
  }
  return custom;
}

export default function BulkEditModal({ guestIds, onClose }) {
  const dash = useDash();
  const { guests, groups, events, fields } = dash.data;
  const byId = useMemo(() => new Map(guests.map((g) => [g.id, g])), [guests]);
  const selected = guestIds.map((id) => byId.get(id)).filter(Boolean);
  const names = selected.slice(0, 3).map((g) => fullName(g) || guestLabel(g, byId));

  const [groupOn, setGroupOn] = useState(false);
  const [groupValue, setGroupValue] = useState(undefined); // id | null (sans groupe)
  const [momentsOn, setMomentsOn] = useState(false);
  const [momentState, setMomentState] = useState({}); // eventId -> "invite" | "remove"
  const [fieldsOn, setFieldsOn] = useState({}); // fieldId -> bool
  const [fieldValues, setFieldValues] = useState({}); // fieldId -> valeur choisie
  const [busy, setBusy] = useState(false);

  const cycleMoment = (evId) =>
    setMomentState((m) => {
      const cur = m[evId];
      const next = cur === undefined ? "invite" : cur === "invite" ? "remove" : undefined;
      const { [evId]: _drop, ...rest } = m;
      return next ? { ...rest, [evId]: next } : rest;
    });

  const changeCount = (groupOn && groupValue !== undefined ? 1 : 0) + (momentsOn && Object.keys(momentState).length ? 1 : 0) + Object.values(fieldsOn).filter(Boolean).length;

  async function apply() {
    setBusy(true);
    const ids = guestIds;
    if (groupOn && groupValue !== undefined) await dash.updateGuests(ids, { group_id: groupValue });
    if (momentsOn) {
      for (const [evId, state] of Object.entries(momentState)) await dash.setResponses(ids, evId, state === "invite" ? "attente" : "non_invite");
    }
    const activeFields = Object.entries(fieldsOn).filter(([, on]) => on);
    if (activeFields.length) {
      const patches = Object.fromEntries(activeFields.map(([fid]) => [fid, fieldValues[fid] || null]));
      await Promise.all(ids.map((id) => dash.update("guests", id, { custom: applyFields(byId.get(id) || { custom: {} }, patches) })));
    }
    setBusy(false);
    dash.setToast({ kind: "ok", text: `${ids.length} invité${ids.length > 1 ? "s" : ""} modifié${ids.length > 1 ? "s" : ""}.` });
    onClose();
  }

  return (
    <Modal
      title="Modifier en masse"
      onClose={onClose}
      wide
      footer={
        <>
          <Btn kind="ghost" onClick={onClose}>
            Annuler
          </Btn>
          <Btn onClick={apply} disabled={busy || !changeCount}>
            {changeCount ? `Appliquer les ${changeCount} changement${changeCount > 1 ? "s" : ""}` : "Cochez ce qui change"}
          </Btn>
        </>
      }
    >
      <p className="d-muted d-small" style={{ margin: 0 }}>
        {selected.length} invité{selected.length > 1 ? "s" : ""} sélectionné{selected.length > 1 ? "s" : ""}
        {names.length ? ` · ${names.join(", ")}${selected.length > names.length ? "…" : ""}` : ""}. Cochez ce que vous voulez changer, le reste est laissé tel quel.
      </p>

      <div className="d-bulk-rows">
        <div className="d-bulk-row">
          <input type="checkbox" className="d-check" checked={groupOn} onChange={(e) => setGroupOn(e.target.checked)} aria-label="Changer le groupe" />
          <span className="d-bulk-body">
            <strong>Groupe</strong>
            <span className="d-filters">
              {groups.map((g) => {
                const p = pastel(g.color);
                const on = groupValue === g.id;
                return (
                  <button
                    key={g.id}
                    type="button"
                    className="d-group d-group-big"
                    style={{ background: p.bg, color: p.ink, boxShadow: on ? `0 0 0 1.5px ${p.ink}` : undefined, fontWeight: on ? 600 : 500 }}
                    onClick={() => {
                      setGroupOn(true);
                      setGroupValue(g.id);
                    }}
                  >
                    {g.name}
                  </button>
                );
              })}
              <button
                type="button"
                className={`d-pill${groupValue === null ? " is-on" : ""}`}
                onClick={() => {
                  setGroupOn(true);
                  setGroupValue(null);
                }}
              >
                Sans groupe
              </button>
            </span>
          </span>
        </div>

        {events.length ? (
          <div className="d-bulk-row">
            <input type="checkbox" className="d-check" checked={momentsOn} onChange={(e) => setMomentsOn(e.target.checked)} aria-label="Changer les moments" />
            <span className="d-bulk-body">
              <strong>Moments</strong>
              <span className="d-filters">
                {events.map((ev) => {
                  const st = momentState[ev.id];
                  return (
                    <button
                      key={ev.id}
                      type="button"
                      className={`d-pill${st === "invite" ? " is-on" : st === "remove" ? " is-off" : ""}`}
                      onClick={() => {
                        setMomentsOn(true);
                        cycleMoment(ev.id);
                      }}
                      title={st === "invite" ? `Invité à ${ev.name}` : st === "remove" ? `Plus invité à ${ev.name}` : `Pas de changement pour ${ev.name}`}
                    >
                      {st === "invite" ? <Icon name="check" size={13} sw={2.2} /> : null}
                      {ev.name}
                    </button>
                  );
                })}
              </span>
              <span className="d-small d-muted">Un clic ajoute ou retire l'invitation à ce moment pour les {selected.length} sélectionnés.</span>
            </span>
          </div>
        ) : null}

        {fields.map((f) => (
          <div key={f.id} className="d-bulk-row">
            <input
              type="checkbox"
              className="d-check"
              checked={!!fieldsOn[f.id]}
              onChange={(e) => setFieldsOn((x) => ({ ...x, [f.id]: e.target.checked }))}
              aria-label={`Changer ${f.name}`}
            />
            <span className="d-bulk-body">
              <strong>
                {f.name} <span className="d-muted" style={{ fontWeight: 400 }}>· colonne{f.kind === "text" ? ", texte libre" : ""}</span>
              </strong>
              {f.kind === "choice" ? (
                <span className="d-filters">
                  {(f.options || []).map((o) => (
                    <button
                      key={o}
                      type="button"
                      className={`d-pill${fieldValues[f.id] === o ? " is-on" : ""}`}
                      onClick={() => {
                        setFieldsOn((x) => ({ ...x, [f.id]: true }));
                        setFieldValues((x) => ({ ...x, [f.id]: o }));
                      }}
                    >
                      {o}
                    </button>
                  ))}
                  <button
                    type="button"
                    className="d-pill"
                    onClick={() => {
                      setFieldsOn((x) => ({ ...x, [f.id]: true }));
                      setFieldValues((x) => ({ ...x, [f.id]: null }));
                    }}
                  >
                    Effacer
                  </button>
                </span>
              ) : (
                <input
                  className="d-input"
                  placeholder="Même texte pour les sélectionnés, vide pour effacer"
                  value={fieldValues[f.id] ?? ""}
                  onFocus={() => setFieldsOn((x) => ({ ...x, [f.id]: true }))}
                  onChange={(e) => {
                    setFieldsOn((x) => ({ ...x, [f.id]: true }));
                    setFieldValues((x) => ({ ...x, [f.id]: e.target.value }));
                  }}
                  style={{ maxWidth: 320 }}
                />
              )}
            </span>
          </div>
        ))}
      </div>
    </Modal>
  );
}
