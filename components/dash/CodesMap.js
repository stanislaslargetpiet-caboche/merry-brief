"use client";

// Tableau « valeur de la colonne → groupe » : une ligne par code (D, P, L…), avec le nombre d'invités concernés.
// Sert à l'import (une colonne de lettres dont Merry ne devine pas le sens) et à réparer une liste déjà importée.

const ENC = (pick) => (pick?.kind === "group" ? `g:${pick.id}` : pick?.kind === "new" ? "__new" : "");

export function CodesMap({ column, values, map, groups, onChange }) {
  const set = (key, pick) => onChange({ ...map, [key]: pick });
  return (
    <div className="d-codes" role="group" aria-label={`Sens des valeurs de la colonne ${column}`}>
      {values.map((v) => {
        const pick = map[v.key];
        return (
          <div key={v.key} className="d-codes-row">
            <span className="d-codes-key">
              <strong>{v.label}</strong>
              <span className="d-small d-muted">{v.n > 1 ? `${v.n} invités` : "1 invité"}</span>
            </span>
            <span className="d-codes-arrow" aria-hidden="true">
              →
            </span>
            <span className="d-codes-pick">
              <select
                className="d-select"
                aria-label={`Groupe pour « ${v.label} »`}
                value={ENC(pick)}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === "") set(v.key, { kind: "none" });
                  else if (val === "__new") set(v.key, { kind: "new", name: pick?.kind === "new" ? pick.name : "" });
                  else set(v.key, { kind: "group", id: val.slice(2) });
                }}
              >
                <option value="">Choisir un groupe…</option>
                {groups.map((g) => (
                  <option key={g.id} value={`g:${g.id}`}>
                    {g.name}
                  </option>
                ))}
                <option value="__new">Nouveau groupe…</option>
              </select>
              {pick?.kind === "new" ? (
                <input
                  className="d-input"
                  aria-label={`Nom du nouveau groupe pour « ${v.label} »`}
                  placeholder="Nom du groupe (ex. Famille Dormeuil)"
                  value={pick.name || ""}
                  maxLength={60}
                  onChange={(e) => set(v.key, { kind: "new", name: e.target.value })}
                  autoFocus
                />
              ) : null}
              {pick?.suggested ? <span className="d-small d-muted">Proposé : vérifiez</span> : null}
            </span>
          </div>
        );
      })}
    </div>
  );
}
