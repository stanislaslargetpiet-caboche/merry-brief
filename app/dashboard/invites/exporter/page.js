"use client";

import { useMemo, useState } from "react";
import { useData } from "@/lib/dash/store";
import { responseIndex, guestLabel } from "@/lib/dash/model";
import { normalize } from "@/lib/dash/format";
import { RSVP } from "@/lib/dash/theme";
import { Icon } from "@/components/dash/icons";
import { Btn, PageHeader } from "@/components/dash/ui";

// Une cellule qui commence par = + - @ serait lue comme une formule par Excel
function csvCell(v) {
  let s = v === null || v === undefined ? "" : String(v);
  if (typeof v !== "number" && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function download(blob, name) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(a.href);
    a.remove();
  }, 1000);
}

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
}

export default function Exporter() {
  const data = useData();
  const { guests, groups, events, fields, wedding } = data;
  const idx = useMemo(() => responseIndex(data.responses), [data.responses]);
  const byId = useMemo(() => new Map(guests.map((g) => [g.id, g])), [guests]);
  const groupById = useMemo(() => new Map(groups.map((g) => [g.id, g])), [groups]);

  const columns = useMemo(
    () => [
      { id: "name", label: "Nom et prénom", get: (g) => guestLabel(g, byId) },
      { id: "group", label: "Groupe", get: (g) => groupById.get(g.group_id)?.name || "" },
      ...events.map((ev) => ({ id: `ev:${ev.id}`, label: ev.name, ev, get: (g) => RSVP[(idx.get(g.id) || {})[ev.id] || "non_invite"].label })),
      { id: "diet", label: "Régime", get: (g) => g.diet || "" },
      { id: "address", label: "Adresse", get: (g) => g.address || "" },
      { id: "email", label: "Mail", get: (g) => g.email || "" },
      { id: "phone", label: "Téléphone", get: (g) => g.phone || "" },
      { id: "age", label: "Âge (enfants)", get: (g) => (g.age ? `${g.age} ans` : "") },
      ...fields.map((f) => ({ id: `f:${f.id}`, label: f.name, get: (g) => (g.custom || {})[f.id] || "" })),
    ],
    [events, fields, idx, byId, groupById],
  );

  const evMatch = (re) => events.filter((e) => re.test(normalize(e.name))).map((e) => `ev:${e.id}`);
  const tableField = fields.filter((f) => /table/i.test(f.name)).map((f) => `f:${f.id}`);
  const shortcuts = [
    { id: "traiteur", label: "Pour le traiteur", cols: ["name", ...(evMatch(/^(cocktail|diner|dejeuner)$/).length ? evMatch(/^(cocktail|diner|dejeuner)$/) : evMatch(/cocktail|diner|dejeuner|repas/)), "diet", "age"] },
    { id: "fairepart", label: "Pour les faire-part", cols: ["name", "address"] },
    { id: "table", label: "Pour le plan de table", cols: ["name", "group", "diet", "age", ...tableField] },
    { id: "tout", label: "Tout", cols: columns.map((c) => c.id) },
  ];

  const dinner = events.find((e) => normalize(e.name) === "diner") || events.find((e) => /diner/.test(normalize(e.name)) && !/veille/.test(normalize(e.name))) || events[events.length - 1];
  const [chosen, setChosen] = useState(shortcuts[0].cols);
  const [who, setWho] = useState(dinner ? "dinner" : "all");
  const [groupId, setGroupId] = useState(groups[0]?.id || "");
  const [format, setFormat] = useState("xlsx");

  const audiences = [
    dinner ? { id: "dinner", label: `Ceux qui ont dit oui au ${dinner.name.toLowerCase()}`, list: guests.filter((g) => (idx.get(g.id) || {})[dinner.id] === "oui") } : null,
    { id: "all", label: "Tous les invités", list: guests },
    { id: "group", label: "Un groupe", list: guests.filter((g) => g.group_id === groupId) },
  ].filter(Boolean);
  const audience = audiences.find((a) => a.id === who) || audiences[0];
  const cols = columns.filter((c) => chosen.includes(c.id));
  const activeShortcut = shortcuts.find((s) => s.cols.length === chosen.length && s.cols.every((c) => chosen.includes(c)));
  const fileBase = `invites-${normalize([wedding.partner1, wedding.partner2].filter(Boolean).join(" ")).replace(/\s+/g, "-") || "mariage"}`;

  async function run() {
    const rows = audience.list.map((g) => cols.map((c) => c.get(g)));
    if (format === "csv") {
      const text = [cols.map((c) => csvCell(c.label)).join(";"), ...rows.map((r) => r.map(csvCell).join(";"))].join("\r\n");
      download(new Blob(["﻿" + text], { type: "text/csv;charset=utf-8" }), `${fileBase}.csv`);
    } else if (format === "xlsx") {
      const { default: writeXlsxFile } = await import("write-excel-file/browser");
      const sheet = [cols.map((c) => ({ value: c.label, fontWeight: "bold" })), ...rows.map((r) => r.map((v) => ({ value: v })))];
      await writeXlsxFile(sheet, { columns: cols.map((c) => ({ width: c.id === "address" ? 42 : c.id === "name" ? 26 : 16 })) }).toFile(`${fileBase}.xlsx`);
    } else {
      const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${escapeHtml(fileBase)}</title>
<style>body{font-family:Archivo,Helvetica,Arial,sans-serif;color:#1c1c1a;margin:32px}h1{font-size:20px;margin:0 0 4px}p{color:#6b6a63;margin:0 0 18px;font-size:13px}
table{border-collapse:collapse;width:100%;font-size:12px}th{text-align:left;background:#f6f5f1;padding:8px;text-transform:uppercase;font-size:11px;letter-spacing:.04em;color:#6b6a63}td{padding:8px;border-top:1px solid #ecebe6}</style></head>
<body><h1>${escapeHtml([wedding.partner1, wedding.partner2].filter(Boolean).join(" & "))}</h1><p>${escapeHtml(audience.label)} · ${audience.list.length} invités</p>
<table><thead><tr>${cols.map((c) => `<th>${escapeHtml(c.label)}</th>`).join("")}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((v) => `<td>${escapeHtml(v)}</td>`).join("")}</tr>`).join("")}</tbody></table>
<script>window.onload=()=>window.print()</script></body></html>`;
      const w = window.open("", "_blank");
      if (w) {
        w.document.write(html);
        w.document.close();
      }
    }
  }

  const toggle = (id) => setChosen((c) => (c.includes(id) ? c.filter((x) => x !== id) : columns.map((x) => x.id).filter((x) => c.includes(x) || x === id)));

  return (
    <>
      <PageHeader back={{ href: "/dashboard/invites", label: "Les invités" }} title="Exporter la liste." />
      <div className="d-grid-side d-grid-export">
        <section className="d-card">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <h2>Colonnes à exporter</h2>
            <span className="d-small d-muted">
              {chosen.length} sur {columns.length}
            </span>
          </div>
          <div className="d-col" style={{ gap: 8 }}>
            <span className="d-small d-muted">Raccourcis</span>
            <div className="d-filters">
              {shortcuts.map((s) => (
                <button key={s.id} type="button" className={`d-pill${activeShortcut?.id === s.id ? " is-on" : ""}`} style={activeShortcut?.id === s.id ? { background: "var(--d-limetint)" } : undefined} onClick={() => setChosen(s.cols)}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>
          <div className="d-g2" style={{ gap: 10 }}>
            {columns.map((c) => {
              const on = chosen.includes(c.id);
              return (
                <button key={c.id} type="button" className={`d-choice${on ? " is-on" : ""}`} onClick={() => toggle(c.id)} aria-pressed={on}>
                  <span className="d-box">{on ? <Icon name="check" size={13} sw={2.4} /> : null}</span>
                  <span style={{ fontSize: 15, fontWeight: on ? 600 : 400 }}>{c.label}</span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="d-card">
          <div className="d-col" style={{ gap: 10 }}>
            <strong style={{ fontSize: 14 }}>Quels invités ?</strong>
            {audiences.map((a) => (
              <button key={a.id} type="button" className={`d-choice${who === a.id ? " is-on" : ""}`} onClick={() => setWho(a.id)} aria-pressed={who === a.id}>
                <span className="d-radio" />
                <span className="d-choice-text">
                  <strong style={{ fontSize: 14 }}>{a.label}</strong>
                  {a.id === "group" ? (
                    <select
                      className="d-select"
                      style={{ width: "auto", maxWidth: "100%", minHeight: 32, fontSize: 13, marginTop: 4 }}
                      value={groupId}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => {
                        setGroupId(e.target.value);
                        setWho("group");
                      }}
                    >
                      {groups.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.name}
                        </option>
                      ))}
                    </select>
                  ) : null}
                </span>
                <span className="d-small d-muted" style={{ whiteSpace: "nowrap" }}>
                  {a.list.length} invités
                </span>
              </button>
            ))}
          </div>
          <div className="d-col" style={{ gap: 10 }}>
            <strong style={{ fontSize: 14 }}>Format</strong>
            <div className="d-g3" style={{ gap: 10 }}>
              {[
                ["xlsx", "Excel"],
                ["csv", "CSV"],
                ["pdf", "PDF"],
              ].map(([id, label]) => (
                <button key={id} type="button" className={`d-choice${format === id ? " is-on" : ""}`} style={{ justifyContent: "center", fontWeight: 600 }} onClick={() => setFormat(id)} aria-pressed={format === id}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          <Btn icon="download" onClick={run} disabled={!cols.length || !audience.list.length} className="d-btn-block" >
            Exporter {audience.list.length} invité{audience.list.length > 1 ? "s" : ""}
          </Btn>
          {format === "pdf" ? <p className="d-small d-muted" style={{ margin: 0 }}>Le PDF s'ouvre dans un nouvel onglet : choisissez « Enregistrer au format PDF » dans la fenêtre d'impression.</p> : null}
        </section>
      </div>
    </>
  );
}
