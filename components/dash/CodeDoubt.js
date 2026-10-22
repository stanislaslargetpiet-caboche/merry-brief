"use client";

// Le doute de Merry sur une colonne de codes (« Qui » : D, P, L, M, C) : il demande à quoi correspondent les
// lettres au lieu de les deviner. Tant que la question reste sans réponse, l'import n'est pas validé.

import { useState } from "react";
import { initialMap, resolvePick } from "@/lib/dash/codes";
import { Btn } from "./ui";
import { CodesMap } from "./CodesMap";

const label = (v) => v.label;

export function CodeDoubt({ doubt, answer, groups, onAnswer }) {
  const { column, values } = doubt;
  const [editing, setEditing] = useState(false);
  const [map, setMap] = useState(null); // null : rien changé pour l'instant
  const [keep, setKeep] = useState(answer?.keep || false);
  const current = map || answer?.map || initialMap(values, groups);
  const named = values.filter((v) => resolvePick(current[v.key], groups));

  if (answer && !editing) {
    const lines = values
      .map((v) => {
        const r = resolvePick(answer.map?.[v.key], groups);
        if (!r) return null;
        return `${label(v)} → ${r.id ? groups.find((g) => g.id === r.id)?.name : r.name}`;
      })
      .filter(Boolean);
    return (
      <div className="d-doubt is-answered">
        <span className="d-doubt-text">
          {answer.mode === "groups" ? (
            <>
              <strong>« {column} » donne le groupe de chaque invité.</strong>
              <span className="d-small d-muted">{lines.join(" · ") || "Aucune valeur reliée à un groupe."}</span>
            </>
          ) : (
            <strong>« {column} » reste une colonne ordinaire.</strong>
          )}
        </span>
        <button type="button" className="d-link" style={{ fontSize: 13 }} onClick={() => setEditing(true)}>
          Modifier
        </button>
      </div>
    );
  }

  return (
    <div className="d-doubt" role="group" aria-label={`Question de Merry sur la colonne ${column}`}>
      <div className="d-doubt-head">
        <span className="d-readout-alert" aria-hidden="true">
          ?
        </span>
        <span className="d-doubt-text">
          <strong>Que veut dire la colonne « {column} » ?</strong>
          <span className="d-small d-muted">
            Elle contient {values.length} valeurs ({values.map(label).join(", ")}). Merry ne devine pas ce qu'elles désignent : dites-lui à quel groupe correspond chacune. Une valeur sans groupe garde celui de l'en-tête du fichier.
          </span>
        </span>
      </div>
      <CodesMap column={column} values={values} map={current} groups={groups} onChange={setMap} />
      <label className="d-check-line">
        <input type="checkbox" checked={keep} onChange={(e) => setKeep(e.target.checked)} />
        <span>Garder aussi la colonne « {column} » dans la liste</span>
      </label>
      <div className="d-actions-end">
        {answer ? (
          <Btn
            kind="ghost"
            small
            onClick={() => {
              setMap(null);
              setEditing(false);
            }}
          >
            Annuler
          </Btn>
        ) : null}
        <Btn
          kind="ghost"
          small
          onClick={() => {
            onAnswer({ mode: "keep", map: {}, keep: true });
            setEditing(false);
          }}
        >
          Garder comme simple colonne
        </Btn>
        <Btn
          small
          disabled={!named.length}
          onClick={() => {
            onAnswer({ mode: "groups", map: current, keep });
            setEditing(false);
          }}
        >
          Appliquer les groupes
        </Btn>
      </div>
    </div>
  );
}
