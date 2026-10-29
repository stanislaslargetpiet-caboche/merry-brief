"use client";

import { useEffect, useState } from "react";
import { useData } from "@/lib/dash/store";
import { coupleIds, isBoth, taskGroups, taskStats } from "@/lib/dash/model";
import { pastel } from "@/lib/dash/theme";
import { Icon } from "@/components/dash/icons";
import { Avatar, Bar, Btn, Faces, Modal, PageHeader } from "@/components/dash/ui";
import TaskRow, { TaskForm } from "@/components/dash/TaskRow";
import DatesModal, { DATES_SEEN_KEY } from "@/components/dash/DatesModal";
import Timeline from "@/components/dash/Timeline";

export default function Retroplanning() {
  const data = useData();
  const { tasks, members, wedding } = data;
  const [who, setWho] = useState(null);
  const [adding, setAdding] = useState(false);
  const [showDone, setShowDone] = useState(true);
  const [dates, setDates] = useState(null); // null | "first" | "edit"

  // À la première visite, on demande les grandes dates (civil, veille, brunch…)
  useEffect(() => {
    if (!wedding?.id) return;
    try {
      if (window.localStorage.getItem(`${DATES_SEEN_KEY}-${wedding.id}`)) return;
    } catch {
      /* ignore */
    }
    if (!data.events.some((e) => e.event_date)) setDates("first");
  }, [wedding?.id, data.events]);

  const st = taskStats(data);
  const couple = coupleIds(members);
  const coupleMembers = members.filter((m) => couple.includes(m.id));

  const filtered = tasks
    .filter((t) => (!who || (who === "both" ? isBoth(t.assignees || [], members) : (t.assignees || []).includes(who))) && (showDone || !t.done));
  const groups = taskGroups(filtered);

  // Qui fait quoi : chaque personne, et « Vous deux » pour les tâches du couple
  const rows = [];
  for (const m of members) {
    const mine = tasks.filter((t) => (t.assignees || []).length === 1 && t.assignees[0] === m.id);
    const shared = tasks.filter((t) => (t.assignees || []).includes(m.id) && t.assignees.length > 1 && !isBoth(t.assignees, members));
    const list = [...mine, ...shared];
    rows.push({ key: m.id, label: m.display_name, faces: [m], color: m.color, done: list.filter((t) => t.done).length, total: list.length });
    if (m.role === "couple" && couple.length === 2 && m.id === couple[1]) {
      const both = tasks.filter((t) => isBoth(t.assignees || [], members));
      rows.push({ key: "both", label: "Vous deux", faces: coupleMembers, color: "jaune", done: both.filter((t) => t.done).length, total: both.length });
    }
  }


  return (
    <>
      <PageHeader
        title="Rétroplanning."
        actions={
          <>
            <span className="d-desk-only-flex">
              <Btn kind="ghost" icon="pin" onClick={() => setDates("edit")}>
                Grandes dates
              </Btn>
            </span>
            <Btn icon="plus" onClick={() => setAdding(true)}>
              Ajouter une tâche
            </Btn>
          </>
        }
      />

      <div className="d-card is-panel d-filterbar" style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 18, padding: "18px 24px" }}>
        <span style={{ display: "inline-flex", alignItems: "baseline", gap: 8 }}>
          <strong style={{ fontSize: 26, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
            {st.done}/{st.total}
          </strong>
          <span className="d-small d-muted">tâches faites</span>
        </span>
        <span style={{ flex: "1 1 160px", maxWidth: 230, display: "flex" }}>
          <Bar value={st.total ? (st.done / st.total) * 100 : 0} />
        </span>
        <div className="d-desk-only" style={{ marginLeft: "auto" }}>
        <div className="d-filters d-scroll-x">
          <button type="button" className={`d-pill${!who ? " is-on" : ""}`} onClick={() => setWho(null)}>
            Tout
          </button>
          {members.map((m) => (
            <button key={m.id} type="button" className={`d-pill${who === m.id ? " is-on" : ""}`} onClick={() => setWho(who === m.id ? null : m.id)} style={{ paddingLeft: 6 }}>
              <Avatar member={m} size={22} />
              {m.display_name}
            </button>
          ))}
          <button type="button" className={`d-pill${!showDone ? " is-on" : ""}`} onClick={() => setShowDone((x) => !x)}>
            {showDone ? "Masquer les tâches faites" : "Afficher les tâches faites"}
          </button>
        </div>
        </div>
      </div>

      {/* Téléphone : les mêmes filtres par personne que sur ordinateur, en pastilles */}
      <div className="d-mob-only">
        <div className="d-filters d-scroll-x">
          <button type="button" className={`d-pill${!who ? " is-on" : ""}`} onClick={() => setWho(null)}>
            Tout
          </button>
          {members.map((m) => (
            <button key={m.id} type="button" className={`d-pill d-pill-face${who === m.id ? " is-on" : ""}`} onClick={() => setWho(who === m.id ? null : m.id)} aria-label={m.display_name} aria-pressed={who === m.id}>
              <Avatar member={m} size={26} />
            </button>
          ))}
        </div>
      </div>

      <div className="d-desk-only">
        <Timeline data={data} onPinClick={() => setDates("edit")} />
      </div>

      {adding ? (
        <Modal title="Ajouter une tâche" onClose={() => setAdding(false)}>
          <TaskForm onDone={() => setAdding(false)} />
        </Modal>
      ) : null}

      <div className="d-grid-side">
        <div className="d-col" style={{ gap: 26 }}>
          {groups.map((g) => (
            <div key={g.key} className="d-col" style={{ gap: 12 }}>
              <h2 className="d-h2" style={{ fontSize: 19, display: "flex", alignItems: "center", gap: 10, color: g.key === "late" ? "var(--d-red-ink)" : undefined }}>
                {g.label}
                <span className="d-count d-desk-only">{g.tasks.length}</span>
              </h2>
              <div className="d-tasks">
                {g.tasks.map((t) => (
                  <TaskRow key={t.id} task={t} />
                ))}
              </div>
            </div>
          ))}
          <span className="d-mob-only">
            <button type="button" className="d-pill is-dashed" style={{ width: "100%", justifyContent: "center", minHeight: 48 }} onClick={() => setAdding(true)}>
              <Icon name="plus" size={14} sw={2} />
              Ajouter une tâche
            </button>
          </span>
          {!groups.length ? (
            <div className="d-empty">
              <p>{who ? "Rien pour cette personne." : "Aucune tâche pour l'instant."}</p>
              {!who && !tasks.length ? (
                <Btn kind="ghost" small icon="sparkle" href="/dashboard/retroplanning/generer">
                  Générer un rétroplanning
                </Btn>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="d-col d-desk-only">
          <section className="d-card">
            <h2>Qui fait quoi</h2>
            <div>
              {rows.map((r) => (
                <div key={r.key} style={{ display: "flex", flexDirection: "column", gap: 10, padding: "12px 0", borderTop: "1px solid var(--d-line)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <Faces members={r.faces} size={24} />
                    <span style={{ flex: 1, fontSize: 14, fontWeight: 500 }}>{r.label}</span>
                    <span className="d-small d-muted">
                      {r.done}/{r.total}
                    </span>
                  </div>
                  <Bar value={r.total ? (r.done / r.total) * 100 : 0} color={pastel(r.color).mid} track="#efeee9" />
                </div>
              ))}
            </div>
          </section>
          <span>
            <Btn kind="ghost" small icon="sparkle" href="/dashboard/retroplanning/generer">
              Compléter le rétroplanning
            </Btn>
          </span>
        </div>
      </div>
      {dates ? (
        <DatesModal
          first={dates === "first"}
          onClose={() => {
            try {
              window.localStorage.setItem(`${DATES_SEEN_KEY}-${wedding.id}`, "1");
            } catch {
              /* ignore */
            }
            setDates(null);
          }}
        />
      ) : null}
    </>
  );
}
