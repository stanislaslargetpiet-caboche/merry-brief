"use client";

import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useDash } from "@/lib/dash/store";
import { normalize, uid } from "@/lib/dash/format";
import { guestKey, parseRows, parseText } from "@/lib/dash/importParse";
import { Icon } from "@/components/dash/icons";
import { Btn, GroupChip, InlineEdit, PageHeader, Section } from "@/components/dash/ui";

const BADGES = {
  xls: ["XLS", "#e5eadc", "#3f5a31"],
  csv: ["CSV", "#e5eadc", "#3f5a31"],
  img: ["JPG", "#fbe5dc", "#8c4229"],
  pdf: ["PDF", "#fbe5dc", "#8c4229"],
  txt: ["TXT", "#ebe6fb", "#4a3d99"],
};

function kindOf(file) {
  const n = file.name.toLowerCase();
  if (/\.(xlsx|xlsm)$/.test(n)) return "xls";
  if (/\.(csv|tsv)$/.test(n)) return "csv";
  if (/\.(txt|md)$/.test(n)) return "txt";
  if (/\.pdf$/.test(n) || file.type === "application/pdf") return "pdf";
  if (/^image\//.test(file.type)) return "img";
  return null;
}

function readAsBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1]);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

// Photo réduite à 1600 px (JPEG) : assez pour lire une liste, et sous la limite d'envoi de Vercel
async function shrinkImage(file) {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext("2d").drawImage(bmp, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.82).split(",")[1];
}

const MAX_PDF = 3 * 1024 * 1024;
const MAX_TEXT = 60000;

function rowsToText(rows) {
  return rows.map((r) => r.map((c) => (c === null || c === undefined ? "" : String(c).replace(/\t/g, " "))).join("\t")).join("\n");
}

export default function Importer() {
  const dash = useDash();
  const router = useRouter();
  const { guests, groups, events, fields } = dash.data;
  const [files, setFiles] = useState([]); // { id, name, kind, status, note, guests, extraColumns, ai: {kind, mime, content} }
  const [pasted, setPasted] = useState("");
  const [showPaste, setShowPaste] = useState(false);
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [defaultGroup, setDefaultGroup] = useState(groups[0]?.id || "");
  const [invitedTo, setInvitedTo] = useState(events.map((e) => e.id));
  const [extraOn, setExtraOn] = useState({});
  const [edits, setEdits] = useState({}); // rowId -> patch
  const [skip, setSkip] = useState({}); // rowId -> true (doublon ignoré / ligne retirée)
  const inputRef = useRef(null);

  async function readFile(file) {
    const kind = kindOf(file);
    const entry = { id: uid(), name: file.name, kind: kind || "txt", status: "lue", guests: [], extraColumns: [] };
    try {
      if (!kind) throw new Error("Format non reconnu");
      if (kind === "xls") {
        const { readSheet } = await import("read-excel-file/browser");
        const rows = await readSheet(file);
        Object.assign(entry, parseRows(rows));
        entry.ai = { kind: "text", content: rowsToText(rows).slice(0, MAX_TEXT) };
        entry.note = `${rows.length} lignes`;
      } else if (kind === "csv" || kind === "txt") {
        const text = await file.text();
        Object.assign(entry, parseText(text));
        entry.ai = { kind: "text", content: text.slice(0, MAX_TEXT) };
        entry.note = kind === "txt" ? "Notes" : `${text.split("\n").filter(Boolean).length} lignes`;
      } else {
        if (kind === "pdf" && file.size > MAX_PDF) throw new Error("PDF trop lourd");
        entry.ai = kind === "pdf" ? { kind: "pdf", mime: "application/pdf", content: await readAsBase64(file) } : { kind: "image", mime: "image/jpeg", content: await shrinkImage(file) };
        entry.status = "ia";
        entry.note = kind === "pdf" ? "PDF" : "Photo d'une liste";
      }
    } catch (e) {
      entry.status = "erreur";
      entry.note =
        e.message === "Format non reconnu"
          ? "Format non reconnu (Excel, CSV, PDF, photo ou texte)"
          : e.message === "PDF trop lourd"
            ? "PDF trop lourd (3 Mo au plus) : envoyez une photo ou un export Excel"
            : "Impossible de lire ce fichier";
    }
    return entry;
  }

  async function addFiles(list) {
    setBusy(true);
    const read = [];
    for (const f of Array.from(list).slice(0, 10)) read.push(await readFile(f));
    setFiles((x) => [...x, ...read]);
    setBusy(false);
    await readWithAi(read);
  }

  function addPasted() {
    if (!pasted.trim()) return;
    const entry = { id: uid(), name: "Liste collée", kind: "txt", status: "lue", ...parseText(pasted), ai: { kind: "text", content: pasted }, note: "Notes" };
    entry.note = `Notes · ${entry.guests.length} noms`;
    setFiles((x) => [...x, entry]);
    setPasted("");
    setShowPaste(false);
    readWithAi([entry]);
  }

  // Avec la clé IA (et un compte connecté), Merry relit chaque fichier : photos, PDF et listes en vrac.
  async function readWithAi(entries) {
    const todo = entries.filter((e) => e.ai && e.status !== "erreur");
    const noAi = (f) => (f.kind === "img" || f.kind === "pdf" ? { ...f, status: "erreur", note: "La lecture des photos et PDF arrive bientôt. En attendant : Excel, CSV ou texte collé." } : { ...f, status: "lue" });
    if (dash.mode !== "live" || !supabase || !todo.length) {
      setFiles((x) => x.map((f) => (todo.some((e) => e.id === f.id) ? noAi(f) : f)));
      return;
    }
    const { data: sess } = await supabase.auth.getSession();
    const token = sess?.session?.access_token;
    const groupByName = new Map(groups.map((g) => [normalize(g.name), g.id]));
    for (const e of todo) {
      setFiles((x) => x.map((f) => (f.id === e.id ? { ...f, status: "encours" } : f)));
      try {
        const res = await fetch("/api/import-invites", {
          method: "POST",
          headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
          body: JSON.stringify({ source: { name: e.name, ...e.ai }, groups: groups.map((g) => g.name), fields: fields.map((f) => f.name) }),
        });
        if (!res.ok) throw Object.assign(new Error("ai"), { status: res.status });
        const out = await res.json();
        setFiles((x) =>
          x.map((f) =>
            f.id === e.id
              ? {
                  ...f,
                  status: "lue",
                  byAi: true,
                  guests: (out.guests || []).map((g) => ({ ...g, extra: g.extra || {}, group_id: g.group ? groupByName.get(normalize(g.group)) || null : null })),
                  extraColumns: out.extraColumns || [],
                  note: `${f.note ? `${f.note} · ` : ""}lue par Merry`,
                }
              : f,
          ),
        );
      } catch (err) {
        // Sans clé IA (501) on garde la lecture locale ; sinon on explique ce qui bloque
        setFiles((x) =>
          x.map((f) => {
            if (f.id !== e.id) return f;
            if (err.status === 501) return noAi(f);
            if (f.kind !== "img" && f.kind !== "pdf") return { ...f, status: "lue" };
            const note = err.status === 429 ? "Limite de lectures du jour atteinte : réessayez demain." : err.status === 413 ? "Fichier trop lourd pour être lu." : "Merry n'a pas pu lire ce fichier. Réessayez.";
            return { ...f, status: "erreur", note };
          }),
        );
      }
    }
  }

  // Lignes de l'aperçu, avec détection des doublons
  const rows = useMemo(() => {
    const existingByKey = new Map(guests.map((g) => [guestKey(g), g]));
    const existingByEmail = new Map(guests.filter((g) => g.email).map((g) => [normalize(g.email), g]));
    const groupIdByName = new Map(groups.map((g) => [normalize(g.name), g.id]));
    const seen = new Set();
    const out = [];
    files.forEach((f) => {
      f.guests.forEach((g, i) => {
        const id = `${f.id}:${i}`;
        const row = { id, file: f.name, ...g, ...(edits[id] || {}) };
        if (!row.group_id && row.group) row.group_id = groupIdByName.get(normalize(row.group)) || null;
        const key = guestKey(row);
        if (key && seen.has(key)) return; // même personne dans deux fichiers
        if (key) seen.add(key);
        const dup = (key && existingByKey.get(key)) || (row.email && existingByEmail.get(normalize(row.email)));
        row.dup = dup || null;
        row.check = !dup && (row.uncertain || (!row.first_name && !row.last_name && !row.plus_one_of && row.plusOneOfIndex === undefined));
        out.push(row);
      });
    });
    return out;
  }, [files, guests, groups, edits]);

  const active = rows.filter((r) => !skip[r.id]);
  const dups = active.filter((r) => r.dup);
  const news = active.filter((r) => !r.dup);
  const checks = active.filter((r) => r.check);
  const extraColumns = [...new Set(files.flatMap((f) => f.extraColumns || []))].filter((c) => !fields.some((x) => normalize(x.name) === normalize(c)));
  const groupById = new Map(groups.map((g) => [g.id, g]));

  async function commit() {
    setBusy(true);
    // Colonnes nouvelles retenues
    const fieldIdByName = new Map(fields.map((f) => [normalize(f.name), f.id]));
    const newFields = extraColumns.filter((c) => extraOn[c] !== false).map((c, i) => ({ id: uid(), name: c, position: fields.length + i }));
    if (newFields.length) await dash.insert("guest_fields", newFields);
    newFields.forEach((f) => fieldIdByName.set(normalize(f.name), f.id));
    const toCustom = (extra) => {
      const c = {};
      for (const [k, v] of Object.entries(extra || {})) {
        const fid = fieldIdByName.get(normalize(k));
        if (fid && v) c[fid] = String(v);
      }
      return c;
    };
    // Nouveaux invités (+1 rattachés à la personne qu'ils accompagnent)
    const created = [];
    const idByRow = new Map();
    let pos = guests.length;
    for (const r of news) {
      const id = uid();
      idByRow.set(r.id, id);
      created.push({
        id,
        first_name: r.first_name || "",
        last_name: r.last_name || "",
        age: r.age || null,
        diet: r.diet || null,
        address: r.address || null,
        email: r.email || null,
        phone: r.phone || null,
        group_id: r.group_id || defaultGroup || null,
        custom: toCustom(r.extra),
        position: pos++,
        _row: r,
      });
    }
    for (const c of created) {
      const r = c._row;
      if (r.plusOneOfIndex !== undefined) {
        const [fid] = r.id.split(":");
        c.plus_one_of = idByRow.get(`${fid}:${r.plusOneOfIndex}`) || null;
      } else if (r.plus_one_of) {
        const host = created.find((x) => guestKey(x) === normalize(r.plus_one_of)) || guests.find((x) => guestKey(x) === normalize(r.plus_one_of));
        c.plus_one_of = host?.id || null;
      }
      delete c._row;
    }
    if (created.length) {
      await dash.insert("guests", created);
      const responses = [];
      const now = new Date().toISOString();
      for (const g of created) for (const ev of events) responses.push({ guest_id: g.id, event_id: ev.id, status: invitedTo.includes(ev.id) ? "attente" : "non_invite", updated_at: now });
      if (responses.length) await dash.insert("guest_responses", responses);
    }
    // Doublons : on complète seulement ce qui manque
    for (const r of dups) {
      const patch = {};
      for (const k of ["address", "email", "phone", "diet"]) if (r[k] && !r.dup[k]) patch[k] = r[k];
      if (r.age && !r.dup.age) patch.age = r.age;
      const custom = { ...toCustom(r.extra), ...(r.dup.custom || {}) };
      if (Object.keys(custom).length !== Object.keys(r.dup.custom || {}).length) patch.custom = custom;
      if (Object.keys(patch).length) await dash.update("guests", r.dup.id, patch);
    }
    setBusy(false);
    dash.setToast({ kind: "ok", text: `${created.length} invité${created.length > 1 ? "s" : ""} ajouté${created.length > 1 ? "s" : ""}${dups.length ? `, ${dups.length} fusionné${dups.length > 1 ? "s" : ""}` : ""}.` });
    router.push("/dashboard/invites");
  }

  const readCount = files.filter((f) => f.status === "lue").length;

  return (
    <>
      <PageHeader back={{ href: "/dashboard/invites", label: "Les invités" }} title="Importer une liste." />

      <div className="d-g2">
        <section className="d-card">
          <h2>Vos fichiers</h2>
          <div
            className={`d-drop${over ? " is-over" : ""}`}
            onDragOver={(e) => {
              e.preventDefault();
              setOver(true);
            }}
            onDragLeave={() => setOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setOver(false);
              addFiles(e.dataTransfer.files);
            }}
          >
            <span className="d-tile" style={{ width: 40, height: 40, borderRadius: 11, background: "#ffffff" }}>
              <Icon name="upload" size={20} />
            </span>
            <span style={{ flex: "1 1 180px", display: "flex", flexDirection: "column", gap: 2 }}>
              <strong style={{ fontSize: 14 }}>Glissez une liste ici</strong>
              <span className="d-small-muted">Excel, CSV, PDF, photo d'une liste, notes du téléphone</span>
            </span>
            <Btn kind="ghost" small onClick={() => inputRef.current?.click()}>
              Parcourir
            </Btn>
            <input
              ref={inputRef}
              type="file"
              multiple
              hidden
              accept=".xlsx,.xlsm,.csv,.tsv,.txt,.pdf,image/*"
              onChange={(e) => {
                addFiles(e.target.files);
                e.target.value = "";
              }}
            />
          </div>
          {showPaste ? (
            <div className="d-col" style={{ gap: 10 }}>
              <textarea className="d-textarea" value={pasted} onChange={(e) => setPasted(e.target.value)} placeholder={"Collez votre liste, un invité par ligne :\nClaire Morel, claire.morel@gmail.com\nLouise Martin +1"} autoFocus />
              <div className="d-actions-end">
                <Btn kind="ghost" small onClick={() => setShowPaste(false)}>
                  Annuler
                </Btn>
                <Btn small onClick={addPasted}>
                  Lire la liste
                </Btn>
              </div>
            </div>
          ) : (
            <button type="button" className="d-link" style={{ alignSelf: "flex-start" }} onClick={() => setShowPaste(true)}>
              Ou collez une liste (notes, mail, message)
            </button>
          )}
          {files.length ? (
            <div>
              {files.map((f) => {
                const [label, bg, ink] = BADGES[f.kind] || BADGES.txt;
                return (
                  <div key={f.id} className="d-file">
                    <span className="d-file-badge" style={{ background: bg, color: ink }}>
                      {f.kind === "img" ? (f.name.split(".").pop() || "IMG").toUpperCase().slice(0, 4) : label}
                    </span>
                    <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
                      <strong style={{ fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</strong>
                      <span className="d-small-muted">
                        {f.note}
                        {f.status === "lue" ? ` · ${f.guests.length} nom${f.guests.length > 1 ? "s" : ""}` : ""}
                      </span>
                    </span>
                    {f.status === "lue" ? (
                      <span className="d-okpill is-small">
                        <Icon name="check" size={12} sw={2.4} />
                        Lue
                      </span>
                    ) : f.status === "encours" || f.status === "ia" ? (
                      <span className="d-status is-todo">Merry lit…</span>
                    ) : (
                      <span className="d-status" style={{ background: "#fde0de", color: "#9b2c2c" }}>
                        Non lue
                      </span>
                    )}
                    <button type="button" className="d-icon-btn" aria-label={`Retirer ${f.name}`} onClick={() => setFiles((x) => x.filter((y) => y.id !== f.id))}>
                      <Icon name="x" size={14} sw={2.2} />
                    </button>
                  </div>
                );
              })}
            </div>
          ) : null}
        </section>

        <section className="d-card">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
            <h2>Ce que Merry a trouvé</h2>
            {readCount ? (
              <span className="d-okpill is-small">
                <Icon name="check" size={12} sw={2.4} />
                {readCount} liste{readCount > 1 ? "s" : ""} lue{readCount > 1 ? "s" : ""}
              </span>
            ) : null}
          </div>
          <div className="d-stats" style={{ "--cols": 4, padding: "18px 10px" }}>
            {[
              [active.length, "invités trouvés"],
              [news.length, "nouveaux"],
              [dups.length, "doublons"],
              [checks.length, "à vérifier"],
            ].map(([v, l]) => (
              <div key={l} className="d-stat">
                <span className="d-stat-value" style={{ fontSize: 22 }}>
                  {v}
                </span>
                <span className="d-stat-label">{l}</span>
              </div>
            ))}
          </div>
          {extraColumns.length ? (
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
              <strong style={{ fontSize: 14 }}>{extraColumns.length > 1 ? "Nouvelles colonnes trouvées" : "Nouvelle colonne trouvée"}</strong>
              {extraColumns.map((c) => {
                const on = extraOn[c] !== false;
                return (
                  <button key={c} type="button" className={`d-pill${on ? " is-on" : ""}`} style={on ? { background: "var(--d-limetint)" } : undefined} onClick={() => setExtraOn((x) => ({ ...x, [c]: !on }))} aria-pressed={on}>
                    {on ? <Icon name="check" size={13} sw={2.2} /> : null}
                    {c}
                  </button>
                );
              })}
            </div>
          ) : null}
          <div className="d-form-grid">
            <label className="d-field">
              <span className="d-field-label">Groupe par défaut</span>
              <select className="d-select" value={defaultGroup} onChange={(e) => setDefaultGroup(e.target.value)}>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
                <option value="">Sans groupe</option>
              </select>
            </label>
            <div className="d-field">
              <span className="d-field-label">Invités à</span>
              <div className="d-filters">
                {events.map((ev) => {
                  const on = invitedTo.includes(ev.id);
                  return (
                    <button key={ev.id} type="button" className={`d-pill${on ? " is-on" : ""}`} style={{ minHeight: 30, padding: "0 10px" }} aria-pressed={on} onClick={() => setInvitedTo((x) => (on ? x.filter((i) => i !== ev.id) : [...x, ev.id]))}>
                      {ev.short_name}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          <p className="d-small d-muted" style={{ margin: 0 }}>
            Les doublons sont fusionnés : Merry complète l'adresse, le mail ou le régime qui manquaient, sans rien écraser.
          </p>
        </section>
      </div>

      {rows.length ? (
        <>
          <Section title="Aperçu" />
          <div className="d-table-wrap">
            <table className="d-table d-guests">
              <thead>
                <tr>
                  <th>Invités</th>
                  <th>Régime</th>
                  <th>Adresse</th>
                  <th>Mail</th>
                  {extraColumns.filter((c) => extraOn[c] !== false).map((c) => (
                    <th key={c} className="d-col-custom">
                      {c}
                    </th>
                  ))}
                  <th className="is-num">Import</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const skipped = !!skip[r.id];
                  const group = groupById.get(r.group_id || (r.dup ? r.dup.group_id : defaultGroup));
                  return (
                    <tr key={r.id} className={r.dup && !skipped ? "d-row-dup" : r.check && !skipped ? "d-row-check" : ""} style={skipped ? { opacity: 0.45 } : undefined}>
                      <td>
                        <div className="d-guest-name">
                          <InlineEdit
                            value={`${r.first_name || ""} ${r.last_name || ""}`.trim()}
                            placeholder={r.plusOneOfIndex !== undefined || r.plus_one_of ? "+1 à nommer" : "Sans nom"}
                            label="nom"
                            width={170}
                            onSave={(v) => {
                              const parts = String(v || "").trim().split(/\s+/);
                              setEdits((x) => ({ ...x, [r.id]: { ...(x[r.id] || {}), first_name: parts.shift() || "", last_name: parts.join(" "), uncertain: false } }));
                            }}
                          />
                          <span className="d-guest-sub">
                            {r.age ? <span>{r.age} ans</span> : null}
                            <GroupChip group={group} />
                          </span>
                          {r.dup ? <span className="d-small-muted">Déjà dans votre liste</span> : r.note ? <span className="d-small-muted">{r.note}</span> : null}
                        </div>
                      </td>
                      <td>
                        <span className="d-cell-clip" style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {r.diet || "–"}
                        </span>
                      </td>
                      <td>
                        <span className="d-cell-clip" style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 160 }}>
                          {r.address || "–"}
                        </span>
                      </td>
                      <td>
                        <span className="d-cell-clip" style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 160 }}>
                          {r.email || "–"}
                        </span>
                      </td>
                      {extraColumns.filter((c) => extraOn[c] !== false).map((c) => (
                        <td key={c} className="d-col-custom">
                          {(r.extra || {})[c] || "–"}
                        </td>
                      ))}
                      <td className="is-num">
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                          {skipped ? (
                            <span className="d-status" style={{ background: "var(--d-panel)", color: "var(--d-muted)" }}>
                              Ignoré
                            </span>
                          ) : r.dup ? (
                            <span className="d-status" style={{ background: "#f4f5d6", color: "#5d5e12" }}>
                              Doublon possible
                            </span>
                          ) : r.check ? (
                            <span className="d-status" style={{ background: "#fde0de", color: "#9b2c2c" }}>
                              À vérifier
                            </span>
                          ) : (
                            <span className="d-okpill is-small">
                              <Icon name="plus" size={12} sw={2.4} />
                              Nouveau
                            </span>
                          )}
                          <button type="button" className="d-link" style={{ fontSize: 12 }} onClick={() => setSkip((x) => ({ ...x, [r.id]: !skipped }))}>
                            {skipped ? "Reprendre" : r.dup ? "Ne pas fusionner" : "Retirer"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="d-filters" style={{ justifyContent: "space-between" }}>
            <span className="d-small d-muted">
              {active.length} invité{active.length > 1 ? "s" : ""} retenu{active.length > 1 ? "s" : ""} sur {rows.length}
              {dups.length ? ` · les ${dups.length} doublon${dups.length > 1 ? "s seront fusionnés" : " sera fusionné"} avec votre liste` : ""}
              {checks.length ? " · cliquez sur un nom pour le corriger" : ""}
            </span>
            <div className="d-filters">
              <Btn kind="ghost" href="/dashboard/invites">
                Annuler
              </Btn>
              <Btn onClick={commit} disabled={busy || !active.length}>
                {news.length ? `Ajouter ${news.length} invité${news.length > 1 ? "s" : ""}` : "Fusionner les doublons"}
              </Btn>
            </div>
          </div>
        </>
      ) : busy ? (
        <div className="d-empty">
          <p>Merry lit vos listes…</p>
        </div>
      ) : null}
    </>
  );
}
