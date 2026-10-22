"use client";

// Les colonnes que Merry ne connaît pas : il les liste toutes avec quelques valeurs, dit ce qu'il en a compris,
// et demande quoi en faire : garder (en la renommant au besoin), en faire les groupes des invités, ou l'ignorer.
// Tant que l'organisateur n'a pas validé, l'ajout reste bloqué.

import { useState } from "react";
import { initialMap, resolvePick } from "@/lib/dash/codes";
import { Btn } from "./ui";
import { CodesMap } from "./CodesMap";

const MODES = [
  { id: "keep", label: "Garder comme colonne" },
  { id: "groups", label: "En faire des groupes" },
  { id: "ignore", label: "Ignorer" },
];

function sample(p) {
  return p.values
    .slice(0, 4)
    .map((v) => (v.n > 1 ? `${v.label} (${v.n})` : v.label))
    .join(", ");
}

// Réponse proposée au départ : des lettres seules sont probablement un groupe codé, le reste une colonne à garder
const draftFor = (p, groups) => ({ mode: p.looksLikeCodes ? "groups" : "keep", name: p.column, map: p.groupable ? initialMap(p.values, groups) : {}, keepToo: false });

export function ColumnsReview({ profiles, answers, meanings, groups, takenNames, onValidate }) {
  const [editing, setEditing] = useState(false);
  const [drafts, setDrafts] = useState({});
  const draftOf = (p) => drafts[p.column] || answers[p.column] || draftFor(p, groups);
  const set = (p, patch) => setDrafts((d) => ({ ...d, [p.column]: { ...draftOf(p), ...patch } }));
  const pending = profiles.filter((p) => !answers[p.column]);
  const complete = profiles.every((p) => {
    const d = draftOf(p);
    return d.mode !== "groups" || p.values.some((v) => resolvePick(d.map[v.key], groups));
  });

  // Tout a reçu une réponse : une ligne par colonne, modifiable
  if (!pending.length && !editing) {
    return (
      <div className="d-doubt is-answered">
        <span className="d-doubt-text">
          <strong>Colonnes du fichier</strong>
          <span className="d-small d-muted">
            {profiles
              .map((p) => {
                const a = answers[p.column];
                return `« ${p.column} » : ${a.mode === "ignore" ? "ignorée" : a.mode === "groups" ? `groupes${a.keepToo ? " et colonne" : ""}` : a.name?.trim() && a.name.trim() !== p.column ? `colonne « ${a.name.trim()} »` : "colonne"}`;
              })
              .join(" · ")}
          </span>
        </span>
        <button type="button" className="d-link" style={{ fontSize: 13 }} onClick={() => setEditing(true)}>
          Modifier
        </button>
      </div>
    );
  }

  return (
    <div className="d-doubt" role="group" aria-label="Colonnes du fichier">
      <div className="d-doubt-head">
        <span className="d-readout-alert" aria-hidden="true">
          ?
        </span>
        <span className="d-doubt-text">
          <strong>{profiles.length > 1 ? `Que faire de ces ${profiles.length} colonnes ?` : "Que faire de cette colonne ?"}</strong>
          <span className="d-small d-muted">Merry ne les connaît pas. Dites-lui ce qu'elles veulent dire : les garder (vous pouvez les renommer), en faire des groupes, ou les ignorer.</span>
        </span>
      </div>

      {profiles.map((p) => {
        const d = draftOf(p);
        const meaning = meanings[p.column];
        const clash = d.mode !== "ignore" && d.name.trim() && takenNames.has(d.name.trim().toLowerCase()) && d.name.trim() !== p.column;
        return (
          <div key={p.column} className="d-colrow">
            <div className="d-colrow-head">
              <strong className="d-colrow-name">« {p.column} »</strong>
              <span className="d-small d-muted">
                {p.total} {p.total > 1 ? "valeurs" : "valeur"} · par exemple {sample(p)}
              </span>
            </div>
            {meaning ? <span className="d-small d-muted">Merry a compris : {meaning}</span> : null}
            <span className="d-seg" role="group" aria-label={`Que faire de la colonne ${p.column}`}>
              {MODES.filter((m) => m.id !== "groups" || p.groupable).map((m) => (
                <button key={m.id} type="button" className={`d-pill d-pill-sm${d.mode === m.id ? " is-on" : ""}`} aria-pressed={d.mode === m.id} onClick={() => set(p, { mode: m.id })}>
                  {m.label}
                </button>
              ))}
            </span>
            {d.mode === "keep" ? (
              <label className="d-colrow-name-edit">
                <span className="d-small d-muted">Nom de la colonne</span>
                <input className="d-input" value={d.name} maxLength={120} onChange={(e) => set(p, { name: e.target.value })} aria-label={`Nom de la colonne ${p.column}`} />
                {clash ? <span className="d-small d-muted">Une colonne porte déjà ce nom : les valeurs s'y ajouteront.</span> : null}
              </label>
            ) : null}
            {d.mode === "groups" ? (
              <>
                <CodesMap column={p.column} values={p.values} map={d.map} groups={groups} onChange={(map) => set(p, { map })} />
                <label className="d-check-line">
                  <input type="checkbox" checked={d.keepToo} onChange={(e) => set(p, { keepToo: e.target.checked })} />
                  <span>Garder aussi « {p.column} » comme colonne de la liste</span>
                </label>
                <span className="d-small d-muted">Une valeur sans groupe garde celui de l'en-tête du fichier.</span>
              </>
            ) : null}
          </div>
        );
      })}

      <div className="d-actions-end">
        {!pending.length ? (
          <Btn
            kind="ghost"
            small
            onClick={() => {
              setDrafts({});
              setEditing(false);
            }}
          >
            Annuler
          </Btn>
        ) : null}
        <Btn
          small
          disabled={!complete}
          onClick={() => {
            onValidate(Object.fromEntries(profiles.map((p) => [p.column, draftOf(p)])));
            setDrafts({});
            setEditing(false);
          }}
        >
          Valider les colonnes
        </Btn>
      </div>
    </div>
  );
}
