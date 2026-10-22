"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { useDash } from "@/lib/dash/store";
import { KPI_DEFAULTS, KPI_MAX, kpiCatalog, kpiContext, kpiDef } from "@/lib/dash/model";
import { Icon } from "@/components/dash/icons";
import { Btn, OkPill, PageHeader, Section } from "@/components/dash/ui";

const BACK = {
  accueil: { href: "/dashboard", label: "Accueil", preview: "Aperçu de l'accueil" },
  budget: { href: "/dashboard/budget", label: "Budget", preview: "Aperçu du budget" },
  invites: { href: "/dashboard/invites", label: "Invités", preview: "Aperçu des invités" },
};

export default function Indicateurs() {
  const { scope } = useParams();
  const router = useRouter();
  const dash = useDash();
  const data = dash.data;
  const conf = BACK[scope] || BACK.accueil;
  const sc = BACK[scope] ? scope : "accueil";
  // Un indicateur d'un moment supprimé disparaît de la sélection
  const initial = (data.kpiPrefs?.[sc]?.length ? data.kpiPrefs[sc] : KPI_DEFAULTS[sc]).filter((id) => kpiDef(sc, id, data));
  const [chosen, setChosen] = useState(initial);
  const ctx = kpiContext(data);

  const toggle = (id) => setChosen((c) => (c.includes(id) ? c.filter((x) => x !== id) : c.length >= KPI_MAX ? c : [...c, id]));

  async function save() {
    await dash.saveKpis(sc, chosen);
    router.push(conf.href);
  }

  return (
    <>
      <PageHeader back={{ href: conf.href, label: conf.label }} title="Vos indicateurs." />

      <div className="d-col" style={{ gap: 10 }}>
        <div className="d-small d-muted" style={{ fontWeight: 600, fontSize: 14 }}>
          {conf.preview} · la croix retire un indicateur
        </div>
        <div className="d-stats" style={{ "--cols": Math.max(chosen.length, 1), padding: 12, gap: 10 }}>
          {chosen.map((id) => {
            const def = kpiDef(sc, id, data);
            if (!def) return null;
            const val = def.get(ctx);
            return (
              <div key={id} className="d-kpi-tile">
                <button type="button" className="d-icon-btn" onClick={() => toggle(id)} aria-label={`Retirer ${def.label}`}>
                  <Icon name="x" size={12} sw={2.4} />
                </button>
                <span className="d-stat-value" style={{ fontSize: 22 }}>
                  {val.value}
                  {val.sub ? <span className="d-stat-sub"> {val.sub}</span> : null}
                </span>
                {def.pill ? <OkPill small>{def.label}</OkPill> : <span className="d-stat-label">{def.label}</span>}
              </div>
            );
          })}
          {!chosen.length ? <div className="d-small d-muted" style={{ padding: 18 }}>Aucun indicateur : cochez-en un ci-dessous.</div> : null}
        </div>
      </div>

      <Section title="Indicateurs disponibles" right={<span className="d-small d-muted">{chosen.length} sur {KPI_MAX} choisis</span>} />

      {kpiCatalog(sc, data).map((fam) => (
        <div key={fam.family} className="d-col" style={{ gap: 10 }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>{fam.family}</div>
          <div className="d-g3">
            {fam.items.map((it) => {
              const on = chosen.includes(it.id);
              const val = it.get(ctx);
              return (
                <button
                  key={it.id}
                  type="button"
                  className={`d-kpi-choice${on ? " is-on" : ""}`}
                  onClick={() => toggle(it.id)}
                  aria-pressed={on}
                  disabled={!on && chosen.length >= KPI_MAX}
                >
                  <span className="d-box">{on ? <Icon name="check" size={13} sw={2.4} /> : null}</span>
                  <span className="d-kpi-choice-text">
                    <strong>{it.label}</strong>
                    <b>
                      {val.value}
                      {val.sub ? ` ${val.sub}` : ""}
                    </b>
                    <span>{it.descFn ? it.descFn(ctx) : it.desc}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ))}

      <div className="d-actions-end">
        <Btn kind="ghost" href={conf.href}>
          Annuler
        </Btn>
        <Btn onClick={save}>Enregistrer</Btn>
      </div>
    </>
  );
}
