"use client";

// Plan de table : à gauche ceux qui viennent et n'ont pas encore de place, à droite les tables.
// On place en glissant un invité sur une table, ou en cochant plusieurs puis « Placer ici ».
// Les foyers restent ensemble (placement automatique, et avertissement quand ils sont séparés).

import { useEffect, useMemo, useState, useRef } from "react";
import { useDash } from "@/lib/dash/store";
import { responseIndex, guestLabel } from "@/lib/dash/model";
import { fullName, normalize, uid } from "@/lib/dash/format";
import { pastel } from "@/lib/dash/theme";
import { householdKey, householdLabel, householdsOf } from "@/lib/dash/households";
import { DEFAULT_CAPACITY, autoSeat, defaultSeatingEvent, eligibleGuests, planFor, splitHouseholds } from "@/lib/dash/seating";
import { Icon } from "@/components/dash/icons";
import { Btn, InlineEdit, Popover } from "@/components/dash/ui";
import InvitesHeader from "@/components/dash/InvitesTabs";

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", '"': "&quot;", ">": "&gt;" })[c]);
}

const n = (k, one, many) => `${k} ${k > 1 ? many : one}`;

export default function PlanDeTable() {
  const dash = useDash();
  const data = dash.data;
  const { guests, groups, events, wedding } = data;
  const setup = data.seatingSetup !== false;
  const idx = useMemo(() => responseIndex(data.responses), [data.responses]);
  const byId = useMemo(() => new Map(guests.map((g) => [g.id, g])), [guests]);
  const groupById = useMemo(() => new Map(groups.map((g) => [g.id, g])), [groups]);
  const households = useMemo(() => householdsOf(guests, byId), [guests, byId]);
  const [eventId, setEventId] = useState(() => defaultSeatingEvent(events)?.id || null);
  useEffect(() => {
    if (!events.some((e) => e.id === eventId)) setEventId(defaultSeatingEvent(events)?.id || null);
  }, [events, eventId]);
  const event = events.find((e) => e.id === eventId) || null;
  const plan = useMemo(() => planFor(data, eventId), [data, eventId]);
  const eligible = useMemo(() => (eventId ? eligibleGuests(data, idx, eventId) : []), [data, idx, eventId]);
  const unseated = eligible.filter((g) => !plan.tableOf.has(g.id));
  const split = useMemo(() => splitHouseholds(eligible, plan.tableOf, byId), [eligible, plan.tableOf, byId]);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState({});
  const [keepHouseholds, setKeepHouseholds] = useState(true);
  const [over, setOver] = useState(null); // table survolée pendant un glisser
  const [menu, setMenu] = useState(null); // id de la table dont le menu est ouvert
  const q = normalize(query);
  const shown = unseated.filter((g) => !q || normalize(`${guestLabel(g, byId)} ${groupById.get(g.group_id)?.name || ""}`).includes(q));
  const selIds = unseated.filter((g) => selected[g.id]).map((g) => g.id);
  const ok = (text) => dash.setToast({ kind: "ok", text });

  // Les membres du foyer encore à placer suivent (option « garder les foyers ensemble »)
  const withHousehold = (ids) => {
    if (!keepHouseholds) return ids;
    const set = new Set(ids);
    for (const id of ids) {
      const g = byId.get(id);
      if (!g) continue;
      for (const m of households.get(householdKey(g, byId)) || []) if (unseated.some((u) => u.id === m.id)) set.add(m.id);
    }
    return [...set];
  };

  async function place(ids, tableId) {
    const all = withHousehold(ids).filter((id) => plan.tableOf.get(id) !== tableId);
    if (!all.length) return;
    setSelected({});
    if (await dash.seatGuests(all, eventId, tableId)) {
      const t = plan.tables.find((x) => x.id === tableId);
      ok(`${n(all.length, "invité placé", "invités placés")} à « ${t?.name || "la table"} ».`);
    }
  }
  async function unseat(ids) {
    if (await dash.seatGuests(ids, eventId, null)) ok(`${n(ids.length, "invité retiré", "invités retirés")} du plan.`);
  }
  const addingTable = useRef(false);
  async function addTable() {
    if (addingTable.current) return;
    addingTable.current = true;
    try {
      const name = `Table ${plan.tables.length + 1}`;
      await dash.insert("seating_tables", { id: uid(), event_id: eventId, name, capacity: DEFAULT_CAPACITY, position: plan.tables.length });
    } finally {
      addingTable.current = false;
    }
  }
  async function removeTable(t) {
    const seated = (plan.perTable.get(t.id) || []).length;
    if (!window.confirm(seated ? `Supprimer « ${t.name} » ? Ses ${seated} invités repassent dans « À placer ».` : `Supprimer « ${t.name} » ?`)) return;
    dash.remove("seating_tables", t.id);
  }
  async function autoPlace() {
    // S'il manque de la place, on ajoute des tables de 8 avant de placer
    let tables = plan.tables;
    const room = tables.reduce((a, t) => a + Math.max(0, (t.capacity || DEFAULT_CAPACITY) - (plan.perTable.get(t.id) || []).length), 0);
    const missing = Math.max(0, Math.ceil((unseated.length - room) / DEFAULT_CAPACITY));
    if (missing) {
      const added = await dash.insert(
        "seating_tables",
        Array.from({ length: missing }, (_, i) => ({ id: uid(), event_id: eventId, name: `Table ${tables.length + i + 1}`, capacity: DEFAULT_CAPACITY, position: tables.length + i })),
      );
      tables = [...tables, ...added];
    }
    const seats = autoSeat(unseated, tables, plan.perTable, byId, groups.map((g) => g.id));
    const byTable = new Map();
    for (const s of seats) byTable.set(s.table_id, [...(byTable.get(s.table_id) || []), s.guest_id]);
    let placed = 0;
    for (const [tableId, ids] of byTable) {
      if (await dash.seatGuests(ids, eventId, tableId)) placed += ids.length;
    }
    const left = unseated.length - placed;
    ok(`${n(placed, "invité placé", "invités placés")}${missing ? ` · ${n(missing, "table ajoutée", "tables ajoutées")}` : ""}${left ? ` · ${left} sans place` : ""}.`);
  }

  function print() {
    const title = `Plan de table · ${event?.name || ""}`;
    const couple = [wedding.partner1, wedding.partner2].filter(Boolean).join(" & ");
    const blocks = plan.tables
      .map((t) => {
        const list = plan.perTable.get(t.id) || [];
        return `<section><h2>${escapeHtml(t.name)} <small>${list.length}/${t.capacity}</small></h2><ol>${list.map((g) => `<li>${escapeHtml(guestLabel(g, byId))}${g.diet ? ` <small>${escapeHtml(g.diet)}</small>` : ""}</li>`).join("")}</ol></section>`;
      })
      .join("");
    const rest = unseated.length ? `<section><h2>À placer <small>${unseated.length}</small></h2><ol>${unseated.map((g) => `<li>${escapeHtml(guestLabel(g, byId))}</li>`).join("")}</ol></section>` : "";
    const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<style>body{font-family:Inter,Helvetica,Arial,sans-serif;color:#1c1c1a;margin:32px}h1{font-size:20px;margin:0 0 4px}p{color:#6b6a63;margin:0 0 18px;font-size:13px}
main{columns:3;column-gap:28px}section{break-inside:avoid;margin:0 0 18px}h2{font-size:14px;margin:0 0 6px;border-bottom:1px solid #ecebe6;padding-bottom:4px}h2 small{color:#6b6a63;font-weight:400;margin-left:6px}
ol{margin:0;padding-left:20px;font-size:12.5px;line-height:1.6}li small{color:#6b6a63;margin-left:4px}@media print{main{columns:3}}</style></head>
<body><h1>${escapeHtml(couple)}</h1><p>${escapeHtml(title)} · ${plan.tables.length} tables · ${eligible.length - unseated.length} placés</p><main>${blocks}${rest}</main>
<script>window.onload=()=>window.print()</script></body></html>`;
    const w = window.open("", "_blank");
    if (w) {
      w.document.write(html);
      w.document.close();
    }
  }

  // Glisser-déposer natif : un invité (ou la sélection) vers une table
  const dragStart = (e, g) => {
    const ids = selected[g.id] && selIds.length ? selIds : [g.id];
    e.dataTransfer.setData("text/plain", ids.join(","));
    e.dataTransfer.effectAllowed = "move";
  };
  const drop = (e, tableId) => {
    e.preventDefault();
    setOver(null);
    const ids = String(e.dataTransfer.getData("text/plain") || "")
      .split(",")
      .filter((id) => byId.has(id));
    if (ids.length) place(ids, tableId);
  };

  const full = plan.tables.filter((t) => (plan.perTable.get(t.id) || []).length >= (t.capacity || DEFAULT_CAPACITY)).length;
  const overCap = plan.tables.filter((t) => (plan.perTable.get(t.id) || []).length > (t.capacity || DEFAULT_CAPACITY)).length;
  const guestRow = (g, seatedAt) => {
    const hk = householdKey(g, byId);
    const members = households.get(hk) || [];
    const isSplit = split.has(hk);
    const group = groupById.get(g.group_id);
    const p = group ? pastel(group.color) : null;
    return (
      <>
        <span className="d-seat-name">
          <span>{guestLabel(g, byId)}</span>
          <small>
            {group ? (
              <span className="d-group" style={{ background: p.bg, color: p.ink }}>
                {group.name}
              </span>
            ) : null}
            {members.length > 1 ? (
              <span className={`d-house${isSplit ? " is-split" : ""}`} title={isSplit ? "Ce foyer est réparti sur plusieurs tables" : `Foyer : ${members.map((m) => fullName(m) || "+1").join(", ")}`}>
                <Icon name="home" size={10} sw={2.2} />
                {isSplit ? "foyer séparé" : householdLabel(members)}
              </span>
            ) : null}
            {g.diet ? <span className="d-seat-diet">{g.diet}</span> : null}
            {g.age ? <span>{g.age} ans</span> : null}
          </small>
        </span>
        {seatedAt ? (
          <button type="button" className="d-icon-btn d-seat-x" aria-label={`Retirer ${guestLabel(g, byId)} de la table`} title="Retirer de la table" onClick={() => unseat([g.id])}>
            <Icon name="x" size={13} sw={2.2} />
          </button>
        ) : null}
      </>
    );
  };

  return (
    <>
      <InvitesHeader
        tab="plan"
        actions={
          <span className="d-filters" style={{ gap: 10 }}>
            {events.length > 1 ? (
              <select className="d-select" value={eventId || ""} onChange={(e) => setEventId(e.target.value)} aria-label="Moment du plan" style={{ width: "auto", minHeight: 40 }}>
                {events.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </select>
            ) : null}
            <Btn kind="ghost" icon="file" onClick={print} disabled={!plan.tables.length}>
              Imprimer
            </Btn>
            <Btn kind="lime" icon="plus" onClick={addTable} disabled={!setup || !eventId}>
              Ajouter une table
            </Btn>
          </span>
        }
      />

      {!setup ? (
        <p className="d-small" style={{ margin: 0, padding: 12, borderRadius: 12, background: "#fff4e5" }}>
          Pour garder le plan de table, lancez <code>supabase/plan-de-table.sql</code> dans Supabase (SQL Editor).
        </p>
      ) : null}
      {!event ? (
        <div className="d-empty">
          <p>Pas encore de moment défini : ajoutez-en un dans la liste des invités (Modifier les moments).</p>
        </div>
      ) : (
        <>
          <div className="d-seat-summary">
            <span>
              <b>{eligible.length - unseated.length}</b> placés sur <b>{eligible.length}</b> qui viennent {event.name === "Dîner" ? "au dîner" : `à « ${event.name} »`}
            </span>
            {unseated.length ? <span>· {n(unseated.length, "à placer", "à placer")}</span> : <span>· tout le monde a sa place</span>}
            {full ? <span>· {n(full, "table pleine", "tables pleines")}</span> : null}
            {overCap ? <span className="d-seat-warn">· {n(overCap, "table au-dessus de sa capacité", "tables au-dessus de leur capacité")}</span> : null}
            {split.size ? <span className="d-seat-warn">· {n(split.size, "foyer séparé", "foyers séparés")}</span> : null}
          </div>

          <div className="d-seat-layout">
            <aside className="d-seat-side">
              <div className="d-seat-side-head">
                <strong>À placer · {unseated.length}</strong>
                {unseated.length ? (
                  <Btn small kind="ghost" icon="sparkle" onClick={autoPlace} disabled={!setup} title="Les foyers ensemble, puis par groupe, dans les tables qui ont de la place">
                    Placer automatiquement
                  </Btn>
                ) : null}
              </div>
              {eligible.length ? (
                <>
                  <label className="d-search" style={{ width: "100%", boxSizing: "border-box" }}>
                    <Icon name="search" size={15} />
                    <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Chercher" aria-label="Chercher un invité à placer" style={{ width: "100%" }} />
                  </label>
                  <label className="d-small" style={{ display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                    <input type="checkbox" className="d-check" checked={keepHouseholds} onChange={(e) => setKeepHouseholds(e.target.checked)} />
                    Garder les foyers ensemble
                  </label>
                  {selIds.length ? (
                    <div className="d-seat-selbar">
                      <strong>{n(selIds.length, "sélection", "sélections")}</strong>
                      <button type="button" className="d-link" onClick={() => setSelected({})}>
                        Désélectionner
                      </button>
                    </div>
                  ) : shown.length ? (
                    <button type="button" className="d-link d-small" style={{ alignSelf: "flex-start" }} onClick={() => setSelected(Object.fromEntries(shown.map((g) => [g.id, true])))}>
                      Tout sélectionner ({shown.length})
                    </button>
                  ) : null}
                  <ul className="d-seat-list">
                    {shown.map((g) => (
                      <li key={g.id} className={`d-seat-row${selected[g.id] ? " is-on" : ""}`} draggable={setup} onDragStart={(e) => dragStart(e, g)} title="Glisser vers une table, ou cocher puis « Placer ici »">
                        <input type="checkbox" className="d-check" checked={!!selected[g.id]} onChange={() => setSelected((x) => ({ ...x, [g.id]: !x[g.id] }))} aria-label={`Sélectionner ${guestLabel(g, byId)}`} />
                        {guestRow(g, null)}
                      </li>
                    ))}
                    {!shown.length ? <li className="d-small d-muted" style={{ padding: 8 }}>{unseated.length ? "Aucun invité ne correspond." : "Tout le monde est placé."}</li> : null}
                  </ul>
                </>
              ) : (
                <p className="d-small d-muted" style={{ margin: 0 }}>
                  Personne n'a encore confirmé sa venue {event.name === "Dîner" ? "au dîner" : `à « ${event.name} »`}. Le plan se remplit avec les « Vient ».
                </p>
              )}
            </aside>

            <div className="d-seat-tables">
              {plan.tables.map((t) => {
                const list = plan.perTable.get(t.id) || [];
                const cap = t.capacity || DEFAULT_CAPACITY;
                const isOver = list.length > cap;
                return (
                  <section
                    key={t.id}
                    className={`d-seat-table${over === t.id ? " is-over" : ""}${isOver ? " is-full" : ""}`}
                    onDragOver={(e) => {
                      e.preventDefault();
                      if (over !== t.id) setOver(t.id);
                    }}
                    onDragLeave={() => setOver((o) => (o === t.id ? null : o))}
                    onDrop={(e) => drop(e, t.id)}
                  >
                    <header className="d-seat-table-head">
                      <InlineEdit value={t.name} label="nom de la table" onSave={(v) => v && dash.update("seating_tables", t.id, { name: v.slice(0, 40) })} />
                      <span className={`d-seat-count${isOver ? " is-over" : list.length === cap ? " is-exact" : ""}`} title="Places prises / places à la table">
                        {list.length}/
                        <InlineEdit value={String(cap)} label="places à la table" width={34} onSave={(v) => dash.update("seating_tables", t.id, { capacity: Math.max(1, Math.min(60, parseInt(v, 10) || cap)) })} />
                      </span>
                      <span className="d-anchor">
                        <button type="button" className="d-icon-btn" aria-label={`Options de ${t.name}`} onClick={() => setMenu(menu === t.id ? null : t.id)}>
                          <Icon name="dots" size={16} sw={2.4} />
                        </button>
                        <Popover open={menu === t.id} onClose={() => setMenu(null)} align="right">
                          {list.length ? (
                            <button
                              type="button"
                              className="d-pop-item"
                              onClick={() => {
                                setMenu(null);
                                unseat(list.map((g) => g.id));
                              }}
                            >
                              <span className="d-pop-label">Vider la table</span>
                            </button>
                          ) : null}
                          <button
                            type="button"
                            className="d-pop-item is-danger"
                            onClick={() => {
                              setMenu(null);
                              removeTable(t);
                            }}
                          >
                            <span className="d-pop-label">
                              <Icon name="trash" size={14} sw={2} />
                              Supprimer la table
                            </span>
                          </button>
                        </Popover>
                      </span>
                    </header>
                    <ul className="d-seat-list">
                      {list.map((g) => (
                        <li key={g.id} className="d-seat-row" draggable={setup} onDragStart={(e) => dragStart(e, g)}>
                          {guestRow(g, t)}
                        </li>
                      ))}
                      {!list.length ? <li className="d-small d-muted d-seat-empty">Glissez des invités ici</li> : null}
                    </ul>
                    {selIds.length ? (
                      <Btn small className="d-btn-block" onClick={() => place(selIds, t.id)}>
                        Placer ici ({withHousehold(selIds).length})
                      </Btn>
                    ) : null}
                  </section>
                );
              })}
              {!plan.tables.length ? (
                <div className="d-empty" style={{ gridColumn: "1 / -1" }}>
                  <p>Pas encore de table pour {event.name === "Dîner" ? "le dîner" : `« ${event.name} »`}.</p>
                  <div className="d-filters">
                    <Btn kind="lime" icon="plus" onClick={addTable} disabled={!setup}>
                      Ajouter une table
                    </Btn>
                    {unseated.length ? (
                      <Btn kind="ghost" icon="sparkle" onClick={autoPlace} disabled={!setup}>
                        Créer les tables et placer tout le monde
                      </Btn>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </>
      )}
    </>
  );
}
