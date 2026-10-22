"use client";

import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useDash } from "@/lib/dash/store";
import { normalize, uid } from "@/lib/dash/format";
import { guestKey } from "@/lib/dash/importParse";
import { badgeOf, pastedEntry, readFile } from "@/lib/dash/importRead";
import { Icon } from "@/components/dash/icons";
import { Btn, GroupChip, InlineEdit, PageHeader, Section } from "@/components/dash/ui";

const MAX_FILES = 15;
const PARALLEL = 3; // parties lues en même temps par l'IA

function plural(n, one, many) {
  return `${n} ${n > 1 ? many : one}`;
}

export default function Importer() {
  const dash = useDash();
  const router = useRouter();
  const { guests, groups, events, fields } = dash.data;
  const [files, setFiles] = useState([]); // { id, name, kind, note, status, parts, guests, extraColumns, byAi }
  const [aiOff, setAiOff] = useState(false);
  const [pasted, setPasted] = useState("");
  const [showPaste, setShowPaste] = useState(false);
  const [over, setOver] = useState(false);
  const [saving, setSaving] = useState(false);
  const [defaultGroup, setDefaultGroup] = useState(groups[0]?.id || "");
  const [invitedTo, setInvitedTo] = useState(events.map((e) => e.id));
  const [extraOn, setExtraOn] = useState({});
  const [edits, setEdits] = useState({}); // rowId -> champs corrigés
  const [removed, setRemoved] = useState({}); // rowId -> true
  const [selected, setSelected] = useState({}); // rowId -> true
  const inputRef = useRef(null);
  const aiOffRef = useRef(false);

  const patchFile = (id, patch) => setFiles((x) => x.map((f) => (f.id === id ? { ...f, ...(typeof patch === "function" ? patch(f) : patch) } : f)));

  const groupIdFor = useMemo(() => {
    const list = groups.map((g) => [normalize(g.name), g.id]);
    return (name) => {
      const n = normalize(name || "");
      if (!n) return null;
      const exact = list.find(([k]) => k === n);
      if (exact) return exact[1];
      const near = list.find(([k]) => k.includes(n) || n.includes(k));
      return near ? near[1] : null;
    };
  }, [groups]);

  // Lecture locale (sans IA) : tableaux et texte ; les PDF et photos attendent l'IA
  function fallbackLocal(entry, why) {
    if (entry.local && entry.local.guests.length) {
      patchFile(entry.id, { status: "lue", guests: entry.local.guests, extraColumns: entry.local.extraColumns || [], byAi: false, why });
    } else if (entry.local) {
      patchFile(entry.id, { status: "erreur", why: "Aucun nom trouvé dans ce fichier." });
    } else {
      patchFile(entry.id, { status: "erreur", why: why || "Les PDF et les photos se lisent avec l'IA, pas encore activée." });
    }
  }

  async function readWithAi(entry) {
    if (dash.mode !== "live" || !supabase || aiOffRef.current) return fallbackLocal(entry);
    const { data: sess } = await supabase.auth.getSession();
    const token = sess?.session?.access_token;
    const units = entry.units;
    const results = new Array(units.length).fill(null);
    let done = 0;
    let stop = null;
    patchFile(entry.id, { status: "encours", parts: { done: 0, total: units.length } });

    async function one(i) {
      for (let attempt = 0; attempt < 2; attempt += 1) {
        if (stop) return;
        try {
          const res = await fetch("/api/import-invites", {
            method: "POST",
            headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
            body: JSON.stringify({ source: { name: entry.name, ...units[i] }, groups: groups.map((g) => g.name), fields: fields.map((f) => f.name) }),
          });
          if (res.status === 501) {
            stop = "off";
            return;
          }
          if (res.status === 429) {
            stop = "quota";
            return;
          }
          if (!res.ok) throw new Error(String(res.status));
          results[i] = await res.json();
          done += 1;
          patchFile(entry.id, { parts: { done, total: units.length } });
          return;
        } catch {
          if (attempt === 1) results[i] = { failed: true };
        }
      }
    }

    let next = 0;
    await Promise.all(
      Array.from({ length: Math.min(PARALLEL, units.length) }, async () => {
        while (next < units.length && !stop) await one(next++);
      }),
    );

    if (stop === "off") {
      aiOffRef.current = true;
      setAiOff(true);
      return fallbackLocal(entry);
    }
    const ok = results.filter((r) => r && !r.failed);
    if (stop === "quota" && !ok.length) return fallbackLocal(entry, "Limite de lectures du jour atteinte : réessayez demain.");
    if (!ok.length) return fallbackLocal(entry, "Merry n'a pas pu lire ce fichier. Réessayez dans un instant.");
    if (ok.length < units.length && entry.local?.guests.length) return fallbackLocal(entry, "Lu en partie par l'IA : Merry a lu le tableau colonne par colonne.");
    const found = ok.flatMap((r) => r.guests || []).map((g) => ({ ...g, extra: g.extra || {} }));
    patchFile(entry.id, {
      status: "lue",
      byAi: true,
      guests: found,
      extraColumns: [...new Set(ok.flatMap((r) => r.extraColumns || []))],
      why: ok.length < units.length ? `${ok.length} parties sur ${units.length} lues : retirez le fichier et réessayez pour le reste.` : null,
    });
  }

  async function addFiles(list) {
    const picked = Array.from(list).slice(0, MAX_FILES);
    const entries = picked.map((f) => ({ id: uid(), name: f.name, kind: "txt", status: "lecture", guests: [], extraColumns: [], file: f }));
    setFiles((x) => [...x, ...entries.map(({ file, ...e }) => e)]);
    for (const e of entries) {
      try {
        const read = await readFile(e.file);
        const entry = { ...e, ...read };
        patchFile(e.id, { kind: read.kind, note: read.note });
        readWithAi(entry);
      } catch (err) {
        patchFile(e.id, { kind: err.kind || "txt", status: "erreur", why: err.note || (err.message === "PDF trop lourd" ? "PDF trop lourd : envoyez-le en plusieurs fois ou en photos." : "Impossible de lire ce fichier.") });
      }
    }
  }

  function addPasted() {
    const text = pasted.trim();
    if (!text) return;
    const entry = { id: uid(), name: "Liste collée", status: "lecture", guests: [], extraColumns: [], ...pastedEntry(text) };
    setFiles((x) => [...x, { ...entry, units: undefined, local: undefined }]);
    setPasted("");
    setShowPaste(false);
    readWithAi(entry);
  }

  // Lignes de l'aperçu, avec détection des doublons
  const rows = useMemo(() => {
    const existingByKey = new Map(guests.map((g) => [guestKey(g), g]));
    const existingByEmail = new Map(guests.filter((g) => g.email).map((g) => [normalize(g.email), g]));
    const seen = new Set();
    const out = [];
    files.forEach((f) => {
      f.guests.forEach((g, i) => {
        const id = `${f.id}:${i}`;
        const row = { id, file: f.name, ...g, ...(edits[id] || {}) };
        if (!row.group_id && row.group) row.group_id = groupIdFor(row.group);
        const key = guestKey(row);
        const named = row.first_name || row.last_name;
        if (named && key && seen.has(key)) return; // même personne dans deux fichiers
        if (named && key) seen.add(key);
        const dup = (named && key && existingByKey.get(key)) || (row.email && existingByEmail.get(normalize(row.email)));
        row.dup = dup || null;
        row.check = !dup && (row.uncertain || (!named && !row.plus_one_of && row.plusOneOfIndex === undefined));
        out.push(row);
      });
    });
    return out;
  }, [files, guests, edits, groupIdFor]);

  const active = rows.filter((r) => !removed[r.id]);
  const dups = active.filter((r) => r.dup);
  const news = active.filter((r) => !r.dup);
  const checks = active.filter((r) => r.check);
  const removedCount = rows.length - active.length;
  const selectedIds = active.filter((r) => selected[r.id]).map((r) => r.id);
  const reading = files.some((f) => f.status === "lecture" || f.status === "encours");
  const extraColumns = [...new Set(files.flatMap((f) => f.extraColumns || []))].filter((c) => !fields.some((x) => normalize(x.name) === normalize(c)));
  const shownExtra = extraColumns.filter((c) => extraOn[c] !== false);
  const groupById = new Map(groups.map((g) => [g.id, g]));

  const edit = (id, patch) => setEdits((x) => ({ ...x, [id]: { ...(x[id] || {}), ...patch } }));
  const removeRows = (ids) => {
    setRemoved((x) => ({ ...x, ...Object.fromEntries(ids.map((i) => [i, true])) }));
    setSelected((x) => {
      const n = { ...x };
      ids.forEach((i) => delete n[i]);
      return n;
    });
  };
  const allSelected = active.length > 0 && selectedIds.length === active.length;

  async function commit() {
    setSaving(true);
    // Colonnes nouvelles retenues
    const fieldIdByName = new Map(fields.map((f) => [normalize(f.name), f.id]));
    const newFields = shownExtra.map((c, i) => ({ id: uid(), name: c, position: fields.length + i }));
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
        age: Number.isFinite(Number(r.age)) && r.age !== null && r.age !== "" ? Number(r.age) : null,
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
      if (r.age && !r.dup.age) patch.age = Number(r.age) || null;
      const custom = { ...toCustom(r.extra), ...(r.dup.custom || {}) };
      if (Object.keys(custom).length !== Object.keys(r.dup.custom || {}).length) patch.custom = custom;
      if (Object.keys(patch).length) await dash.update("guests", r.dup.id, patch);
    }
    setSaving(false);
    dash.setToast({ kind: "ok", text: `${plural(created.length, "invité ajouté", "invités ajoutés")}${dups.length ? `, ${plural(dups.length, "fusionné", "fusionnés")}` : ""}.` });
    router.push("/dashboard/invites");
  }

  return (
    <>
      <PageHeader back={{ href: "/dashboard/invites", label: "Invités" }} title="Importer une liste." />

      <div
        className={`d-drop-big${over ? " is-over" : ""}`}
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
        <span className="d-tile" style={{ width: 52, height: 52, borderRadius: 15, background: "#ffffff" }}>
          <Icon name="upload" size={24} />
        </span>
        <strong>Déposez vos listes ici</strong>
        <p>N'importe quel format : Excel ou Google Sheets (toutes les feuilles), CSV, Word, PDF, photo d'une liste écrite à la main, capture d'écran, notes du téléphone.</p>
        <div className="d-filters" style={{ justifyContent: "center" }}>
          <Btn icon="upload" onClick={() => inputRef.current?.click()}>
            Choisir des fichiers
          </Btn>
          <Btn kind="ghost" icon="copy" onClick={() => setShowPaste((v) => !v)}>
            Coller une liste
          </Btn>
        </div>
        <input
          ref={inputRef}
          type="file"
          multiple
          hidden
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {showPaste ? (
        <div className="d-col" style={{ gap: 10 }}>
          <textarea
            className="d-textarea"
            value={pasted}
            onChange={(e) => setPasted(e.target.value)}
            placeholder={"Collez votre liste telle quelle (notes, mail, message, tableau copié) :\nM. et Mme Jean Dupont\nClaire Morel, claire.morel@gmail.com\nLouise Martin +1"}
            autoFocus
            rows={7}
          />
          <div className="d-actions-end">
            <Btn kind="ghost" small onClick={() => setShowPaste(false)}>
              Annuler
            </Btn>
            <Btn small onClick={addPasted} disabled={!pasted.trim()}>
              Lire la liste
            </Btn>
          </div>
        </div>
      ) : null}

      {files.length ? (
        <div className="d-file-chips">
          {files.map((f) => {
            const [label, bg, ink] = badgeOf(f.kind);
            const meta =
              f.status === "lue"
                ? `${f.note ? `${f.note} · ` : ""}${plural(f.guests.length, "nom", "noms")}`
                : f.status === "encours" && f.parts?.total > 1
                  ? `${f.note || ""} · partie ${Math.min(f.parts.done + 1, f.parts.total)} sur ${f.parts.total}`
                  : f.status === "erreur"
                    ? f.why
                    : f.note || "Lecture…";
            return (
              <div key={f.id} className="d-file-chip">
                <span className="d-file-badge" style={{ background: bg, color: ink }}>
                  {label}
                </span>
                <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
                  <strong style={{ fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={f.name}>
                    {f.name}
                  </strong>
                  <span className="d-small-muted" style={f.status === "erreur" ? { color: "#9b2c2c" } : undefined}>
                    {meta}
                  </span>
                  {f.status === "lue" && f.why ? <span className="d-small-muted">{f.why}</span> : null}
                </span>
                {f.status === "lue" ? (
                  <span className="d-okpill is-small">
                    <Icon name="check" size={12} sw={2.4} />
                    Lue
                  </span>
                ) : f.status === "erreur" ? (
                  <span className="d-status" style={{ background: "#fde0de", color: "#9b2c2c" }}>
                    Non lue
                  </span>
                ) : (
                  <span className="d-status is-todo">Merry lit…</span>
                )}
                <button type="button" className="d-icon-btn is-flat" aria-label={`Retirer ${f.name}`} onClick={() => setFiles((x) => x.filter((y) => y.id !== f.id))}>
                  <Icon name="x" size={14} sw={2.2} />
                </button>
              </div>
            );
          })}
        </div>
      ) : null}

      {aiOff ? (
        <div className="d-card" style={{ background: "var(--d-panel)", border: 0, gap: 6 }}>
          <strong style={{ fontSize: 14 }}>La lecture par l'IA n'est pas encore activée.</strong>
          <span className="d-small d-muted">
            En attendant, Merry lit les tableaux et le texte colonne par colonne. Les PDF et les photos seront lus dès qu'elle sera activée. Vérifiez l'aperçu avant d'ajouter.
          </span>
        </div>
      ) : null}

      {rows.length ? (
        <>
          <Section
            title="Aperçu"
            right={
              <span className="d-small d-muted" style={{ whiteSpace: "nowrap" }}>
                {plural(active.length, "trouvé", "trouvés")} · {plural(news.length, "nouveau", "nouveaux")} · {dups.length} à fusionner · {checks.length} à vérifier
              </span>
            }
          />
          <div className="d-import-settings">
            <span>
              <span className="d-muted">Groupe par défaut</span>
              <select className="d-select" value={defaultGroup} onChange={(e) => setDefaultGroup(e.target.value)} aria-label="Groupe par défaut">
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
                <option value="">Sans groupe</option>
              </select>
            </span>
            <span>
              <span className="d-muted">Invités à</span>
              {events.map((ev) => {
                const on = invitedTo.includes(ev.id);
                return (
                  <button key={ev.id} type="button" className={`d-pill${on ? " is-on" : ""}`} style={{ minHeight: 30, padding: "0 10px" }} aria-pressed={on} onClick={() => setInvitedTo((x) => (on ? x.filter((i) => i !== ev.id) : [...x, ev.id]))}>
                    {on ? <Icon name="check" size={12} sw={2.4} /> : null}
                    {ev.short_name}
                  </button>
                );
              })}
            </span>
            {extraColumns.length ? (
              <span>
                <span className="d-muted">{extraColumns.length > 1 ? "Nouvelles colonnes" : "Nouvelle colonne"}</span>
                {extraColumns.map((c) => {
                  const on = extraOn[c] !== false;
                  return (
                    <button key={c} type="button" className={`d-pill${on ? " is-on" : ""}`} style={{ minHeight: 30, padding: "0 10px", ...(on ? { background: "var(--d-limetint)" } : {}) }} onClick={() => setExtraOn((x) => ({ ...x, [c]: !on }))} aria-pressed={on}>
                      {on ? <Icon name="check" size={12} sw={2.4} /> : null}
                      {c}
                    </button>
                  );
                })}
              </span>
            ) : null}
          </div>

          {selectedIds.length ? (
            <div className="d-selbar" role="region" aria-label="Lignes sélectionnées">
              <strong>{plural(selectedIds.length, "ligne sélectionnée", "lignes sélectionnées")}</strong>
              <span className="d-selbar-actions">
                <button type="button" onClick={() => setSelected({})}>
                  Tout désélectionner
                </button>
                <button type="button" className="is-danger" onClick={() => removeRows(selectedIds)}>
                  <Icon name="trash" size={14} sw={2} />
                  {selectedIds.length > 1 ? `Supprimer les ${selectedIds.length} lignes` : "Supprimer la ligne"}
                </button>
              </span>
            </div>
          ) : null}

          <div className="d-table-wrap">
            <table className="d-table d-guests">
              <thead>
                <tr>
                  <th className="d-col-check">
                    <input
                      type="checkbox"
                      className="d-check"
                      checked={allSelected}
                      onChange={() => setSelected(allSelected ? {} : Object.fromEntries(active.map((r) => [r.id, true])))}
                      aria-label="Tout sélectionner"
                    />
                  </th>
                  <th>Invités</th>
                  <th>Régime</th>
                  <th>Adresse</th>
                  <th>Mail</th>
                  <th>Téléphone</th>
                  {shownExtra.map((c) => (
                    <th key={c} className="d-col-custom">
                      {c}
                    </th>
                  ))}
                  <th>Import</th>
                  <th aria-label="Supprimer" />
                </tr>
              </thead>
              <tbody>
                {active.map((r) => {
                  const group = groupById.get(r.group_id || (r.dup ? r.dup.group_id : defaultGroup));
                  const label = `${r.first_name || ""} ${r.last_name || ""}`.trim();
                  const isSel = !!selected[r.id];
                  return (
                    <tr key={r.id} className={isSel ? "d-row-selected" : r.dup ? "d-row-dup" : r.check ? "d-row-check" : ""}>
                      <td className="d-col-check">
                        <input type="checkbox" className="d-check" checked={isSel} onChange={() => setSelected((x) => ({ ...x, [r.id]: !isSel }))} aria-label={`Sélectionner ${label || "cette ligne"}`} />
                      </td>
                      <td>
                        <div className="d-guest-name">
                          <InlineEdit
                            value={label}
                            placeholder={r.plusOneOfIndex !== undefined || r.plus_one_of ? "+1 à nommer" : "Sans nom"}
                            label="nom"
                            width={170}
                            onSave={(v) => {
                              const parts = String(v || "").trim().split(/\s+/);
                              edit(r.id, { first_name: parts.shift() || "", last_name: parts.join(" "), uncertain: false, note: null });
                            }}
                          />
                          <span className="d-guest-sub">
                            {r.age ? <span>{r.age} ans</span> : null}
                            <GroupChip group={group} />
                          </span>
                        </div>
                      </td>
                      <td>
                        <InlineEdit value={r.diet} label="régime" width={110} onSave={(v) => edit(r.id, { diet: v })} className="d-cell-clip" />
                      </td>
                      <td>
                        <InlineEdit value={r.address} label="adresse" width={200} onSave={(v) => edit(r.id, { address: v })} className="d-cell-clip" />
                      </td>
                      <td>
                        <InlineEdit value={r.email} label="mail" width={170} onSave={(v) => edit(r.id, { email: v })} className="d-cell-clip" />
                      </td>
                      <td>
                        <InlineEdit value={r.phone} label="téléphone" width={130} onSave={(v) => edit(r.id, { phone: v })} className="d-cell-clip" />
                      </td>
                      {shownExtra.map((c) => (
                        <td key={c} className="d-col-custom">
                          {(r.extra || {})[c] || "–"}
                        </td>
                      ))}
                      <td>
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 3 }}>
                          {r.dup ? (
                            <>
                              <span className="d-status" style={{ background: "#f4f5d6", color: "#5d5e12" }}>
                                Sera fusionné
                              </span>
                              <span className="d-small-muted">Déjà dans votre liste</span>
                            </>
                          ) : r.check ? (
                            <>
                              <span className="d-status" style={{ background: "#fde0de", color: "#9b2c2c" }}>
                                À vérifier
                              </span>
                              {r.note ? <span className="d-small-muted">{r.note}</span> : null}
                            </>
                          ) : (
                            <span className="d-okpill is-small">
                              <Icon name="plus" size={12} sw={2.4} />
                              Nouveau
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <button type="button" className="d-icon-btn is-flat is-danger" onClick={() => removeRows([r.id])} aria-label={`Supprimer ${label || "cette ligne"}`} title="Supprimer cette ligne">
                          <Icon name="trash" size={16} sw={2} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="d-filters" style={{ justifyContent: "space-between" }}>
            <span className="d-small d-muted">
              {removedCount ? (
                <button type="button" className="d-link" style={{ fontSize: "inherit" }} onClick={() => setRemoved({})}>
                  Rétablir {plural(removedCount, "ligne supprimée", "lignes supprimées")}
                </button>
              ) : null}
            </span>
            <div className="d-filters">
              <Btn kind="ghost" href="/dashboard/invites">
                Annuler
              </Btn>
              <Btn onClick={commit} disabled={saving || reading || !active.length}>
                {reading ? "Merry lit encore…" : news.length ? `Ajouter ${plural(news.length, "invité", "invités")}` : "Fusionner les doublons"}
              </Btn>
            </div>
          </div>
        </>
      ) : reading ? (
        <div className="d-empty">
          <p>Merry lit vos listes…</p>
        </div>
      ) : null}
    </>
  );
}
