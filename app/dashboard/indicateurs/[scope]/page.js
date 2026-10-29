"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { useDash } from "@/lib/dash/store";
import { KPI_DEFAULTS, KPI_MAX, KPI_MEASURES, customKpiId, kpiCatalog, kpiContext, kpiDef, kpiItem } from "@/lib/dash/model";
import { euros, pctLabel } from "@/lib/dash/format";
import { Icon } from "@/components/dash/icons";
import { Btn, OkPill, PageHeader, Section } from "@/components/dash/ui";

const BACK = {
  accueil: { href: "/dashboard", label: "Accueil", preview: "Aperçu de l'accueil" },
  budget: { href: "/dashboard/budget", label: "Budget", preview: "Aperçu du budget" },
  invites: { href: "/dashboard/invites", label: "Invités", preview: "Aperçu des invités" },
};

// Les indicateurs du budget de départ, relus comme des indicateurs à soi quand on les modifie
const BUILTIN_MEASURE = { budget_initial: "budget", engage: "engage", deja_paye: "paye", reste_a_payer: "reste", disponible: "disponible" };

// Budget : pas de catalogue, le couple crée, modifie ou retire ses propres indicateurs (artboard 2c)
function BudgetKpis({ chosen, setChosen, ctx, data }) {
  const [editing, setEditing] = useState(null); // index de l'indicateur modifié, ou null pour un nouveau
  const [label, setLabel] = useState("");
  const [measure, setMeasure] = useState("reste");
  const [format, setFormat] = useState("eur");
  const full = editing === null && chosen.length >= KPI_MAX;

  const edit = (i) => {
    const def = kpiDef("budget", chosen[i], data);
    if (!def) return;
    setEditing(i);
    setLabel(def.label);
    setMeasure(def.custom?.measure || BUILTIN_MEASURE[def.id] || "budget");
    setFormat(def.custom?.format || "eur");
  };
  const reset = () => {
    setEditing(null);
    setLabel("");
    setMeasure("reste");
    setFormat("eur");
  };
  const submit = (e) => {
    e.preventDefault();
    if (!label.trim() || full) return;
    const id = customKpiId(measure, format, label);
    setChosen((c) => (editing === null ? [...c, id] : c.map((x, i) => (i === editing ? id : x))));
    reset();
  };
  const preview = KPI_MEASURES.find((m) => m.id === measure).get(ctx.b);

  return (
    <>
      <div className="d-stats d-kpi-own" style={{ "--cols": Math.min(chosen.length + 1, KPI_MAX + 1), padding: 12, gap: 10 }}>
        {chosen.map((id, i) => {
          const def = kpiDef("budget", id, data);
          if (!def) return null;
          const val = kpiItem(def, ctx);
          return (
            <div key={id} className={`d-kpi-tile${editing === i ? " is-editing" : ""}`}>
              <button type="button" className="d-icon-btn" onClick={() => (setChosen((c) => c.filter((x) => x !== id)), reset())} aria-label={`Retirer ${def.label}`}>
                <Icon name="x" size={12} sw={2.4} />
              </button>
              <span className="d-stat-value" style={{ fontSize: 22 }}>
                {val.value}
                {val.sub ? <span className="d-stat-sub"> {val.sub}</span> : null}
              </span>
              <span className="d-stat-label">{val.label}</span>
              <button type="button" className="d-link" style={{ fontSize: 12.5 }} onClick={() => edit(i)}>
                Modifier
              </button>
            </div>
          );
        })}
        {chosen.length < KPI_MAX ? (
          <button type="button" className="d-kpi-tile is-add" onClick={() => (reset(), document.getElementById("kpi-nom")?.focus())}>
            <Icon name="plus" size={16} sw={2.4} />
            Ajouter un indicateur
          </button>
        ) : null}
      </div>

      <form className="d-card d-kpi-form" onSubmit={submit}>
        <h2>{editing === null ? "Nouvel indicateur" : "Modifier l'indicateur"}</h2>
        <label className="d-field">
          <span className="d-field-label">Nom</span>
          <input id="kpi-nom" className="d-input" value={label} onChange={(e) => setLabel(e.target.value)} maxLength={40} placeholder="Reste à payer" />
        </label>
        <div className="d-field">
          <span className="d-field-label">Ce qu'il calcule</span>
          <div className="d-filters">
            {KPI_MEASURES.map((m) => (
              <button key={m.id} type="button" className={`d-pill${measure === m.id ? " is-on" : ""}`} aria-pressed={measure === m.id} onClick={() => setMeasure(m.id)}>
                {m.label}
              </button>
            ))}
          </div>
        </div>
        <div className="d-field">
          <span className="d-field-label">Afficher</span>
          <div className="d-filters">
            <button type="button" className={`d-pill${format === "eur" ? " is-on" : ""}`} aria-pressed={format === "eur"} onClick={() => setFormat("eur")}>
              En euros
            </button>
            <button type="button" className={`d-pill${format === "pct" ? " is-on" : ""}`} aria-pressed={format === "pct"} onClick={() => setFormat("pct")}>
              En % du budget
            </button>
          </div>
        </div>
        <div className="d-kpi-preview">
          <span>Aperçu</span>
          <strong>{format === "pct" ? pctLabel(preview, ctx.b.initial) : euros(preview)}</strong>
        </div>
        <div className="d-actions-end" style={{ justifyContent: "flex-start" }}>
          <Btn type="submit" disabled={!label.trim() || full}>
            {editing === null ? "Ajouter" : "Mettre à jour"}
          </Btn>
          {editing !== null ? (
            <Btn kind="ghost" onClick={reset}>
              Annuler
            </Btn>
          ) : null}
        </div>
      </form>
    </>
  );
}

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

      {sc === "budget" ? <BudgetKpis chosen={chosen} setChosen={setChosen} ctx={ctx} data={data} /> : null}

      <div className="d-desk-only" hidden={sc === "budget"}>
        <div className="d-col" style={{ gap: 10 }}>
          <div className="d-stats" style={{ "--cols": Math.max(chosen.length, 1), padding: 12, gap: 10 }}>
            {chosen.map((id) => {
              const def = kpiDef(sc, id, data);
              if (!def) return null;
              const val = kpiItem(def, ctx);
              return (
                <div key={id} className="d-kpi-tile">
                  <button type="button" className="d-icon-btn" onClick={() => toggle(id)} aria-label={`Retirer ${def.label}`}>
                    <Icon name="x" size={12} sw={2.4} />
                  </button>
                  <span className="d-stat-value" style={{ fontSize: 22 }}>
                    {val.value}
                    {val.sub ? <span className="d-stat-sub"> {val.sub}</span> : null}
                  </span>
                  {val.pill ? <OkPill small>{val.label}</OkPill> : <span className="d-stat-label">{val.label}</span>}
                </div>
              );
            })}
            {!chosen.length ? <div className="d-small d-muted" style={{ padding: 18 }}>Aucun indicateur : cochez-en un ci-dessous.</div> : null}
          </div>
        </div>
      </div>

      {sc !== "budget" ? (
        <div className="d-desk-only">
          <Section title="Indicateurs disponibles" right={<span className="d-small d-muted">{chosen.length} sur {KPI_MAX} choisis</span>} />
        </div>
      ) : null}

      {(sc === "budget" ? [] : kpiCatalog(sc, data)).map((fam) => (
        <div key={fam.family} className="d-col" style={{ gap: 10 }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>{fam.family}</div>
          <div className="d-g3 d-desk-only">
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
          <div className="d-card d-mob-only" style={{ padding: "2px 14px" }}>
            {fam.items.map((it) => {
              const on = chosen.includes(it.id);
              const val = it.get(ctx);
              return (
                <button
                  key={it.id}
                  type="button"
                  className={`d-kpi-mrow${on ? " is-on" : ""}`}
                  onClick={() => toggle(it.id)}
                  aria-pressed={on}
                  disabled={!on && chosen.length >= KPI_MAX}
                >
                  <span className="d-box">{on ? <Icon name="check" size={13} sw={2.4} /> : null}</span>
                  <span className="d-kpi-mrow-text">
                    <strong>{it.label}</strong>
                    <span>{it.descFn ? it.descFn(ctx) : it.desc}</span>
                  </span>
                  <span className="d-kpi-mrow-value">
                    {val.value}
                    {val.sub ? ` ${val.sub}` : ""}
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
