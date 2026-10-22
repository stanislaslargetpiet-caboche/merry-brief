"use client";

// Répare une liste déjà importée : une colonne de codes (« Qui » : D, P, L, M, C) devient les groupes des invités.
// Même question que pendant l'import, même table de correspondance, appliquée aux invités qui sont déjà là.

import { useMemo, useState } from "react";
import { useDash } from "@/lib/dash/store";
import { normalize, uid } from "@/lib/dash/format";
import { columnValues, initialMap, resolvePick } from "@/lib/dash/codes";
import { PASTEL_KEYS } from "@/lib/dash/theme";
import { Btn, Modal } from "./ui";
import { CodesMap } from "./CodesMap";

export function FieldGroupsModal({ field, onClose }) {
  const dash = useDash();
  const { guests, groups } = dash.data;
  const values = useMemo(() => columnValues(guests, field.id), [guests, field.id]);
  const [map, setMap] = useState(() => initialMap(values, groups));
  const [busy, setBusy] = useState(false);

  const picks = values.map((v) => [v, resolvePick(map[v.key], groups)]).filter(([, r]) => r);
  const moved = picks.reduce((a, [v]) => a + v.n, 0);

  async function apply() {
    setBusy(true);
    // Groupes à créer (un seul par nom), puis les invités rangés groupe par groupe
    const made = new Map();
    const toCreate = [];
    for (const [, r] of picks) {
      if (!r.vid || made.has(r.vid)) continue;
      const id = uid();
      made.set(r.vid, id);
      toCreate.push({ id, name: r.name, color: PASTEL_KEYS[(groups.length + toCreate.length) % PASTEL_KEYS.length], position: groups.length + toCreate.length });
    }
    if (toCreate.length) await dash.insert("guest_groups", toCreate);
    const byGroup = new Map();
    for (const g of guests) {
      const raw = g.custom?.[field.id];
      if (!raw) continue;
      const hit = picks.find(([v]) => v.key === normalize(raw));
      if (!hit) continue;
      const gid = hit[1].id || made.get(hit[1].vid);
      if (g.group_id === gid) continue;
      byGroup.set(gid, [...(byGroup.get(gid) || []), g.id]);
    }
    let count = 0;
    for (const [gid, ids] of byGroup) {
      if (await dash.updateGuests(ids, { group_id: gid })) count += ids.length;
    }
    setBusy(false);
    dash.setToast({ kind: "ok", text: `${count} ${count > 1 ? "invités rangés" : "invité rangé"} selon « ${field.name} ».` });
    onClose();
  }

  return (
    <Modal
      title={`Ranger les invités selon « ${field.name} »`}
      onClose={onClose}
      footer={
        <>
          <Btn kind="ghost" onClick={onClose}>
            Annuler
          </Btn>
          <Btn onClick={apply} disabled={busy || !moved}>
            {moved ? `Ranger ${moved} ${moved > 1 ? "invités" : "invité"}` : "Choisissez un groupe"}
          </Btn>
        </>
      }
    >
      <div className="d-col" style={{ gap: 14 }}>
        <p className="d-small d-muted" style={{ margin: 0, lineHeight: 1.5 }}>
          Dites à quel groupe correspond chaque valeur. Les invités dont la valeur est reliée à un groupe y sont déplacés ; les autres ne bougent pas. La colonne reste en place.
        </p>
        <CodesMap column={field.name} values={values} map={map} groups={groups} onChange={setMap} />
      </div>
    </Modal>
  );
}
