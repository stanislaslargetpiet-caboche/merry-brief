"use client";

// Tarifs (maquettes V3 et V3m) : formules, options et saisons. Le prix le plus bas devient le
// « À partir de » que voient les couples (catalog.vendors.price_min, mis à jour par la base).

import { useState } from "react";
import { usePro } from "@/lib/pro/store";
import { euros, parseAmount } from "@/lib/dash/format";
import { OPTION_UNIT, UNIT_LABEL, price } from "@/lib/pro/format";
import { ProIcon } from "@/components/pro/icons";

const OPTION_UNITS = [
  { value: "forfait", label: "Forfait" },
  { value: "nuit", label: "La nuit" },
  { value: "par_invite", label: "Par invité" },
  { value: "par_heure", label: "Par heure" },
];

export default function Tarifs() {
  const pro = usePro();
  const d = pro.data;
  const formulas = [...d.formulas].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  const options = [...d.options].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  const [editing, setEditing] = useState(null);
  const lowest = formulas
    .flatMap((f) => [f.price_high, f.price_low].filter((x) => x !== null && x !== undefined).map((p) => ({ p, unit: f.unit })))
    .sort((a, b) => a.p - b.p)[0];

  async function addFormula() {
    const row = await pro.insertRow("pro_formulas", "formulas", { name: "Nouvelle formule", unit: "forfait", includes: [], price_high: null, price_low: null, position: formulas.length });
    if (row) setEditing(row.id);
  }

  async function addOption() {
    const row = await pro.insertRow("pro_options", "options", { name: "Nouvelle option", unit: "forfait", price: null, position: options.length });
    if (row) setEditing(row.id);
  }

  return (
    <div className="p-narrow is-28">
      <h1 className="p-h1 is-page">Tarifs.</h1>
      <p className="p-banner">
        Votre prix le plus bas s’affiche aux couples :{" "}
        <strong>{lowest ? `À partir de ${euros(lowest.p)}${lowest.unit === "par_invite" ? " par invité" : ""}` : "ajoutez une formule et ses prix"}</strong>
      </p>

      <section className="p-block is-14">
        <h2 className="p-h2">Formules</h2>
        <ul className="p-formulas">
          {formulas.map((f) =>
            editing === f.id ? (
              <FormulaEditor key={f.id} f={f} onDone={() => setEditing(null)} />
            ) : (
              <li key={f.id} className="p-formula">
                <div className="p-formula-top">
                  <h3>{f.name}</h3>
                  <span className="p-chip">{UNIT_LABEL[f.unit]}</span>
                </div>
                {f.includes?.length ? (
                  <ul className="p-checks">
                    {f.includes.map((t) => (
                      <li key={t}>
                        <ProIcon name="check" size={15} sw={2.4} stroke="#574e00" style={{ flex: "none", marginTop: 2 }} />
                        <span>{t}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
                <div className="p-seasons-prices">
                  {[
                    ["Haute saison", f.price_high],
                    ["Basse saison", f.price_low],
                  ].map(([k, p]) => (
                    <div key={k}>
                      <span className="p-sp-k">{k}</span>
                      <span className="p-sp-v">
                        {price(p)}
                        <span>{f.unit === "par_invite" && p !== null && p !== undefined ? " par invité" : ""}</span>
                      </span>
                    </div>
                  ))}
                </div>
                <button type="button" className="p-link p-start" onClick={() => setEditing(f.id)}>
                  Modifier
                </button>
              </li>
            ),
          )}
          <li className="p-formula-add">
            <button type="button" onClick={addFormula}>
              <ProIcon name="plus" size={20} sw={2} />
              Ajouter une formule
            </button>
          </li>
        </ul>
      </section>

      <section className="p-card p-options">
        <h2 className="p-options-title">Options</h2>
        <ul className="p-rows">
          {options.map((o) =>
            editing === o.id ? (
              <OptionEditor key={o.id} o={o} onDone={() => setEditing(null)} />
            ) : (
              <li key={o.id} className="p-option">
                <span className="p-option-name">{o.name}</span>
                <span className="p-option-right">
                  <span className="p-option-price">
                    {price(o.price)} <span>{o.price !== null && o.price !== undefined ? OPTION_UNIT[o.unit] : ""}</span>
                  </span>
                  <button type="button" className="p-link is-small" onClick={() => setEditing(o.id)}>
                    Modifier
                  </button>
                </span>
              </li>
            ),
          )}
        </ul>
        <button type="button" className="p-link is-plain p-start p-add-line" onClick={addOption}>
          <ProIcon name="plus" size={16} sw={2} />
          Ajouter une option
        </button>
      </section>

      <section className="p-card p-options">
        <h2 className="p-options-title">Saisons</h2>
        <ul className="p-rows">
          {[
            ["Haute saison", "high_from", "high_to"],
            ["Basse saison", "low_from", "low_to"],
          ].map(([label, from, to], k) => (
            <li key={label} className="p-season">
              <span className="p-season-name">{label}</span>
              <div className="p-season-fields">
                <SeasonField id={`s${k}a`} label="Du" value={d.pro?.[from]} onSave={(t) => pro.saveSeasons({ [from]: t })} />
                <SeasonField id={`s${k}b`} label="Au" value={d.pro?.[to]} onSave={(t) => pro.saveSeasons({ [to]: t })} />
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function SeasonField({ id, label, value, onSave }) {
  const [draft, setDraft] = useState(value || "");
  return (
    <div className="p-field">
      <label htmlFor={id}>{label}</label>
      <input id={id} className="p-input" value={draft} placeholder="1 mai" onChange={(e) => setDraft(e.target.value)} onBlur={() => draft.trim() && draft.trim() !== value && onSave(draft.trim())} />
    </div>
  );
}

const toPrice = (s) => {
  const n = parseAmount(s);
  return n === null ? null : Math.max(0, Math.round(n));
};

function FormulaEditor({ f, onDone }) {
  const pro = usePro();
  const [name, setName] = useState(f.name);
  const [unit, setUnit] = useState(f.unit);
  const [includes, setIncludes] = useState((f.includes || []).join("\n"));
  const [high, setHigh] = useState(f.price_high ?? "");
  const [low, setLow] = useState(f.price_low ?? "");

  async function save() {
    await pro.updateRow("pro_formulas", "formulas", f.id, {
      name: name.trim() || "Formule",
      unit,
      includes: includes
        .split("\n")
        .map((t) => t.trim())
        .filter(Boolean),
      price_high: toPrice(high),
      price_low: toPrice(low),
    });
    onDone();
  }

  return (
    <li className="p-formula is-editing">
      <div className="p-field">
        <label htmlFor={`fn-${f.id}`}>Nom de la formule</label>
        <input id={`fn-${f.id}`} className="p-input" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      </div>
      <div className="p-field is-8">
        <span>Prix</span>
        <div className="p-pills" role="radiogroup" aria-label="Prix">
          {Object.entries(UNIT_LABEL).map(([k, l]) => (
            <button key={k} type="button" role="radio" aria-checked={unit === k} className={`p-pill${unit === k ? " is-on" : ""}`} onClick={() => setUnit(k)}>
              {l}
            </button>
          ))}
        </div>
      </div>
      <div className="p-field">
        <label htmlFor={`fi-${f.id}`}>Ce qui est compris, une ligne par élément</label>
        <textarea id={`fi-${f.id}`} rows={4} className="p-textarea" value={includes} onChange={(e) => setIncludes(e.target.value)} />
      </div>
      <div className="p-grid2">
        <div className="p-field">
          <label htmlFor={`fh-${f.id}`}>Haute saison (€)</label>
          <input id={`fh-${f.id}`} className="p-input" inputMode="numeric" value={high} onChange={(e) => setHigh(e.target.value)} />
        </div>
        <div className="p-field">
          <label htmlFor={`fl-${f.id}`}>Basse saison (€)</label>
          <input id={`fl-${f.id}`} className="p-input" inputMode="numeric" value={low} onChange={(e) => setLow(e.target.value)} />
        </div>
      </div>
      <div className="p-edit-actions">
        <button
          type="button"
          className="p-link is-small is-muted"
          onClick={async () => {
            await pro.deleteRow("pro_formulas", "formulas", f.id);
            onDone();
          }}
        >
          Supprimer la formule
        </button>
        <span>
          <button type="button" className="p-btn p-btn-ghost is-40" onClick={onDone}>
            Annuler
          </button>
          <button type="button" className="p-btn p-btn-primary is-40" onClick={save}>
            Enregistrer
          </button>
        </span>
      </div>
    </li>
  );
}

function OptionEditor({ o, onDone }) {
  const pro = usePro();
  const [name, setName] = useState(o.name);
  const [unit, setUnit] = useState(o.unit);
  const [value, setValue] = useState(o.price ?? "");

  async function save() {
    await pro.updateRow("pro_options", "options", o.id, { name: name.trim() || "Option", unit, price: toPrice(value) });
    onDone();
  }

  return (
    <li className="p-option is-editing">
      <div className="p-option-edit">
        <div className="p-field">
          <label htmlFor={`on-${o.id}`}>Option</label>
          <input id={`on-${o.id}`} className="p-input" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </div>
        <div className="p-field">
          <label htmlFor={`op-${o.id}`}>Prix (€)</label>
          <input id={`op-${o.id}`} className="p-input" inputMode="numeric" value={value} onChange={(e) => setValue(e.target.value)} />
        </div>
        <div className="p-field">
          <label htmlFor={`ou-${o.id}`}>Compté</label>
          <select id={`ou-${o.id}`} className="p-input" value={unit} onChange={(e) => setUnit(e.target.value)}>
            {OPTION_UNITS.map((u) => (
              <option key={u.value} value={u.value}>
                {u.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="p-edit-actions">
        <button
          type="button"
          className="p-link is-small is-muted"
          onClick={async () => {
            await pro.deleteRow("pro_options", "options", o.id);
            onDone();
          }}
        >
          Supprimer l’option
        </button>
        <span>
          <button type="button" className="p-btn p-btn-ghost is-40" onClick={onDone}>
            Annuler
          </button>
          <button type="button" className="p-btn p-btn-primary is-40" onClick={save}>
            Enregistrer
          </button>
        </span>
      </div>
    </li>
  );
}
