"use client";

// « Vos critères » : la seule boîte des critères du couple, en haut de Prestataires et de Lieux.
// Chaque critère est une puce modifiable sur place (petite fenêtre), sans passer par le Brief :
// les réponses du brief (lieu, date, invités, budget, style) y sont réécrites, le reste va dans vendor_wishes.
// Chaque changement s'applique tout de suite aux recommandations. Tout critère se retire ; ceux du brief
// sont alors seulement mis de côté pour la recherche (vendor_wishes.wishes.off), le brief garde sa valeur.

import { useEffect, useState } from "react";
import { useDash } from "@/lib/dash/store";
import { REGIONS } from "@/lib/dash/filters";
import { BRIEF_KEYS, BUDGET_RANGES, CRIT_ICON, GUEST_RANGES, VIBES, criteriaList, guestsOf } from "@/lib/dash/criteria";
import { toDate } from "@/lib/dash/format";
import { DuoIcon, Icon } from "./icons";
import { Popover } from "./ui";

const MONTHS = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];

export function CritIcon({ k, size = 16, tint }) {
  const [set, name] = CRIT_ICON[k] || CRIT_ICON.words;
  if (set === "duo") return <DuoIcon name={name} size={size} fill={tint ? "#cbff75" : "var(--d-lime)"} stroke={tint ? "#35520a" : "#1c1c1a"} />;
  return <Icon name={name} size={size} sw={1.8} stroke={tint ? "#35520a" : "#1c1c1a"} />;
}

// Faits d'un lieu en petites étiquettes (cartes) : teinte lime quand ils répondent à un critère
export function FactChips({ facts, className = "" }) {
  if (!facts.length) return null;
  return (
    <ul className={`d-pr-facttags ${className}`} aria-label="Ce que propose le lieu">
      {facts.map((f) => (
        <li key={f.key} className={f.match ? "is-match" : ""}>
          <CritIcon k={f.key} size={15} tint={f.match} />
          <span>{f.text}</span>
          {f.match ? <span className="d-sr"> (répond à vos critères)</span> : null}
        </li>
      ))}
    </ul>
  );
}

// Envies telles qu'enregistrées, avec des valeurs par défaut
function useWishes() {
  const dash = useDash();
  const w = { regions: [], access: [], venue: [], criteria: [], removed: [], off: [], ...(dash.data.wishes?.wishes || {}) };
  const save = (patch) => dash.saveWishes({ wishes: { ...w, ...patch } });
  return [w, save];
}

export function CriteriaBox({ onEnvies }) {
  const data = useDash().data;
  const [w, save] = useWishes();
  const list = criteriaList(data);
  const on = list.filter((c) => !c.off);
  const off = list.filter((c) => c.off);
  // Nouvelle recherche : tous les critères retirés (le brief garde ses réponses)
  const reset = () =>
    save({ off: BRIEF_KEYS, regions: [], city: { name: "", max: null }, airport: { on: false, max: null }, station: { on: false, max: null }, access: [], seats: null, beds: null, venue: [], caterer: null, style: "", criteria: [], removed: [...(w.removed || []), ...(w.criteria || [])], when: null });
  return (
    <section className="d-pr-crits" aria-labelledby="crit-titre">
      <div className="d-pr-crits-head">
        <h2 id="crit-titre">Vos critères</h2>
        <span className="d-pr-crits-actions">
          {on.length ? (
            <button type="button" className="d-pr-textbtn is-small" onClick={reset}>
              Nouvelle recherche
            </button>
          ) : null}
          <button type="button" className="d-btn d-btn-ghost d-btn-small d-pr-envies-btn" onClick={onEnvies}>
            <Icon name="sparkle" size={15} sw={2} />
            Préciser mes envies
          </button>
        </span>
      </div>
      <div className="d-pr-crits-chips">
        {on.map((c) => (
          <CritChip key={`${c.key}-${c.word || ""}`} c={c} />
        ))}
        {off.map((c) => (
          <CritChip key={`off-${c.key}`} c={c} />
        ))}
        {!on.length ? <span className="d-pr-crits-none">Aucun critère : tous les lieux vous sont proposés.</span> : null}
      </div>
    </section>
  );
}

function CritChip({ c }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="d-anchor">
      <button
        type="button"
        className={`d-pr-chip is-crit${c.empty ? " is-empty" : ""}${c.off ? " is-off" : ""}${open ? " is-open" : ""}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={c.off ? `Ajouter le critère ${c.label}` : undefined}
        onClick={() => setOpen((o) => !o)}
      >
        {c.off ? <Icon name="plus" size={13} sw={2.2} stroke="#6b6a63" /> : <CritIcon k={c.key} />}
        <span className="d-pr-chip-t">{c.label}</span>
        {c.off ? null : <Icon name="chevDown" size={12} sw={2.2} stroke="#6b6a63" />}
      </button>
      <Popover open={open} onClose={() => setOpen(false)} className="d-pr-critpop">
        <Editor c={c} close={() => setOpen(false)} />
      </Popover>
    </span>
  );
}

const MINUTES = [30, 45, 60];

function Opt({ on, onClick, children, radio }) {
  return (
    <button type="button" {...(radio ? { role: "radio", "aria-checked": on } : { "aria-pressed": on })} className={`d-pr-opt is-small${on ? " is-on" : ""}`} onClick={onClick}>
      {on && !radio ? <Icon name="check" size={12} sw={2.6} stroke="#ffffff" /> : null}
      {children}
    </button>
  );
}

// Texte enregistré quand on valide (Entrée) ou qu'on quitte le champ
function TextField({ id, label, value, onSave, placeholder, type = "text" }) {
  const [x, setX] = useState(value || "");
  useEffect(() => setX(value || ""), [value]);
  const commit = () => x.trim() !== (value || "") && onSave(x.trim());
  return (
    <div className="d-pr-critfield">
      <label htmlFor={id}>{label}</label>
      <input id={id} type={type} className="d-input" value={x} placeholder={placeholder} onChange={(e) => setX(e.target.value)} onBlur={commit} onKeyDown={(e) => e.key === "Enter" && commit()} />
    </div>
  );
}

function Editor({ c, close }) {
  const dash = useDash();
  const data = dash.data;
  const [w, save] = useWishes();
  const brief = BRIEF_KEYS.includes(c.key);
  // Modifier un critère du brief le remet dans la recherche
  const keep = brief ? { off: w.off.filter((k) => k !== c.key) } : {};
  const setWishes = (patch) => save({ ...keep, ...patch });
  const turnOn = () => (brief && w.off.includes(c.key) ? save(keep) : null);
  const remove = (patch) => {
    save(patch);
    close();
  };
  const removeBrief = () => remove({ off: [...new Set([...w.off, c.key])] });

  if (c.key === "lieu") {
    const pickRegions = (regions) => {
      setWishes({ regions, city: { name: "", max: null } });
      dash.updateWedding({ region: regions.join(", ") || null });
    };
    const toggle = (r) => pickRegions(w.regions.includes(r) ? w.regions.filter((x) => x !== r) : [...w.regions, r]);
    return (
      <div className="d-pr-crited">
        <strong className="d-pr-crited-t">Où ?</strong>
        <span className="d-pr-crited-sub">Une ou plusieurs régions</span>
        <div className="d-pr-optrow">
          {REGIONS.map((r) => (
            <Opt key={r} on={!c.off && w.regions.includes(r)} onClick={() => toggle(r)}>
              {r}
            </Opt>
          ))}
        </div>
        <TextField
          id="crit-ville"
          label="Ou près d'une ville"
          placeholder="Aix-en-Provence"
          value={w.regions.length ? "" : w.city?.name || ""}
          onSave={(name) => {
            setWishes({ regions: [], city: { name, max: name ? w.city?.max || 60 : null } });
            if (name) dash.updateWedding({ region: name });
          }}
        />
        {!c.off && !w.regions.length && w.city?.name ? (
          <div role="radiogroup" aria-label="Temps de route maximum" className="d-pr-optrow">
            {MINUTES.map((m) => (
              <Opt key={m} radio on={(w.city.max || 60) === m} onClick={() => setWishes({ city: { ...w.city, max: m } })}>
                {m} min
              </Opt>
            ))}
          </div>
        ) : null}
        <TextField
          id="crit-lieu"
          label="Ou un autre endroit"
          placeholder="Luberon, Pays basque, Toscane…"
          value={!w.regions.length && !w.city?.name ? data.wedding.region || "" : ""}
          onSave={(region) => {
            setWishes({ regions: [], city: { name: "", max: null } });
            dash.updateWedding({ region: region || null });
          }}
        />
        {c.off ? <UseBtn onClick={turnOn} label="Chercher là" /> : <RemoveBtn onClick={removeBrief} />}
      </div>
    );
  }

  if (c.key === "date") return <DateEditor c={c} w={w} setWishes={setWishes} turnOn={turnOn} removeBrief={removeBrief} />;

  if (c.key === "invites") {
    const g = guestsOf(data);
    return (
      <div className="d-pr-crited">
        <strong className="d-pr-crited-t">Combien d'invités ?</strong>
        <div role="radiogroup" aria-label="Nombre d'invités" className="d-pr-crited-list">
          {GUEST_RANGES.map((r) => (
            <Opt
              key={r.code}
              radio
              on={!c.off && g.range?.code === r.code}
              onClick={() => {
                dash.saveBrief({ guests: r.code });
                turnOn();
              }}
            >
              {r.label}
            </Opt>
          ))}
        </div>
        {g.listCount && (!g.range || g.listCount < g.range.min || g.listCount > g.range.max) ? <span className="d-pr-crited-sub">{g.listCount} dans votre liste d'invités</span> : null}
        {c.off ? <UseBtn onClick={turnOn} /> : <RemoveBtn onClick={removeBrief} />}
      </div>
    );
  }

  if (c.key === "budget") {
    const total = data.wedding.budget_total;
    return (
      <div className="d-pr-crited">
        <strong className="d-pr-crited-t">Budget</strong>
        {total === null || total === undefined ? (
          <div role="radiogroup" aria-label="Budget" className="d-pr-crited-list">
            {BUDGET_RANGES.map((r) => (
              <Opt
                key={r.code}
                radio
                on={!c.off && data.brief?.budget === r.code}
                onClick={() => {
                  dash.saveBrief({ budget: r.code });
                  turnOn();
                }}
              >
                {r.label}
              </Opt>
            ))}
          </div>
        ) : null}
        <TextField
          id="crit-budget"
          label="Budget total (€)"
          placeholder="40 000"
          value={total === null || total === undefined ? "" : String(Math.round(total))}
          onSave={(t) => {
            const n = Number(String(t).replace(/[^\d]/g, ""));
            dash.updateWedding({ budget_total: t && n ? n : null });
            turnOn();
          }}
        />
        {c.off ? <UseBtn onClick={turnOn} /> : <RemoveBtn onClick={removeBrief} />}
      </div>
    );
  }

  if (c.key === "style") {
    const vibes = data.brief?.vibes || [];
    const all = [...VIBES, ...vibes.filter((x) => !VIBES.includes(x))];
    const toggle = (x) => {
      dash.saveBrief({ vibes: vibes.includes(x) ? vibes.filter((y) => y !== x) : [...vibes, x].slice(-3) });
      turnOn();
    };
    return (
      <div className="d-pr-crited">
        <strong className="d-pr-crited-t">Votre style, trois au plus</strong>
        <div className="d-pr-optrow">
          {all.map((x) => (
            <Opt key={x} on={!c.off && vibes.includes(x)} onClick={() => toggle(x)}>
              {x}
            </Opt>
          ))}
        </div>
        {c.off ? <UseBtn onClick={turnOn} /> : <RemoveBtn onClick={removeBrief} />}
      </div>
    );
  }

  if (c.key === "airport" || c.key === "station") {
    const cur = w[c.key] || { on: true, max: null };
    return (
      <div className="d-pr-crited">
        <strong className="d-pr-crited-t">{c.key === "airport" ? "Près d'un aéroport" : "Près d'une gare TGV"}</strong>
        <div role="radiogroup" aria-label="Temps de trajet maximum" className="d-pr-optrow">
          {MINUTES.map((m) => (
            <Opt key={m} radio on={(cur.max || 60) === m} onClick={() => setWishes({ [c.key]: { on: true, max: m } })}>
              {m} min
            </Opt>
          ))}
        </div>
        <RemoveBtn onClick={() => remove({ [c.key]: { on: false, max: null } })} />
      </div>
    );
  }

  if (c.key === "seats" || c.key === "beds") {
    return (
      <div className="d-pr-crited">
        <TextField id={`crit-${c.key}`} type="number" label={c.key === "seats" ? "Places assises, au moins" : "Couchages sur place, au moins"} value={w[c.key] ? String(w[c.key]) : ""} onSave={(t) => setWishes({ [c.key]: Number(t) || null })} />
        <RemoveBtn onClick={() => remove({ [c.key]: null })} />
      </div>
    );
  }

  if (c.key === "caterer") {
    return (
      <div className="d-pr-crited">
        <strong className="d-pr-crited-t">Traiteur</strong>
        <div role="radiogroup" aria-label="Traiteur" className="d-pr-optrow">
          <Opt radio on={w.caterer === "libre"} onClick={() => setWishes({ caterer: "libre" })}>
            Libre
          </Opt>
          <Opt radio on={w.caterer === "impose"} onClick={() => setWishes({ caterer: "impose" })}>
            Celui du lieu
          </Opt>
        </div>
        <RemoveBtn onClick={() => remove({ caterer: null })} />
      </div>
    );
  }

  const listKey = { parking: ["access", "parking"], pmr: ["access", "pmr"], late: ["venue", "fin_tardive"], ceremony: ["venue", "ceremonie_exterieur"], exclusive: ["venue", "exclusivite"] }[c.key];
  return (
    <div className="d-pr-crited">
      <strong className="d-pr-crited-t">{c.label}</strong>
      <RemoveBtn
        onClick={() =>
          listKey
            ? remove({ [listKey[0]]: w[listKey[0]].filter((x) => x !== listKey[1]) })
            : remove({ criteria: w.criteria.filter((x) => x !== c.word), removed: [...w.removed, c.word] })
        }
      />
    </div>
  );
}

// Date : un jour précis (celui du mariage), ou des dates flexibles (un ou plusieurs mois, une année)
function DateEditor({ c, w, setWishes, turnOn, removeBrief }) {
  const dash = useDash();
  const day = toDate(dash.data.wedding.wedding_date);
  const [mode, setMode] = useState(w.when ? "flexible" : "precise");
  const firstYear = day ? day.getFullYear() : new Date().getFullYear() + 1;
  const when = w.when || { months: day ? [day.getMonth()] : [], years: [firstYear] };
  const toggle = (xs, x) => (xs.includes(x) ? xs.filter((y) => y !== x) : [...xs, x]);
  const setWhen = (next) => setWishes({ when: next });
  return (
    <div className="d-pr-crited">
      <div role="radiogroup" aria-label="Date du mariage" className="d-pr-optrow">
        <Opt
          radio
          on={mode === "precise"}
          onClick={() => {
            setMode("precise");
            if (w.when) setWishes({ when: null });
          }}
        >
          Date précise
        </Opt>
        <Opt
          radio
          on={mode === "flexible"}
          onClick={() => {
            setMode("flexible");
            setWhen(when);
          }}
        >
          Dates flexibles
        </Opt>
      </div>
      {mode === "precise" ? (
        <TextField
          id="crit-date"
          type="date"
          label="Date du mariage"
          value={dash.data.wedding.wedding_date || ""}
          onSave={(d) => {
            dash.updateWedding({ wedding_date: d || null });
            turnOn();
          }}
        />
      ) : (
        <>
          <span className="d-pr-crited-sub">Un ou plusieurs mois</span>
          <div className="d-pr-optrow">
            {MONTHS.map((m, k) => (
              <Opt key={m} on={!c.off && when.months.includes(k)} onClick={() => setWhen({ ...when, months: toggle(when.months, k) })}>
                {m}
              </Opt>
            ))}
          </div>
          <span className="d-pr-crited-sub">Année</span>
          <div className="d-pr-optrow">
            {[firstYear, firstYear + 1, firstYear + 2].map((y) => (
              <Opt key={y} on={!c.off && when.years.includes(y)} onClick={() => setWhen({ ...when, years: toggle(when.years, y) })}>
                {y}
              </Opt>
            ))}
          </div>
        </>
      )}
      {c.off ? <UseBtn onClick={turnOn} /> : <RemoveBtn onClick={removeBrief} />}
    </div>
  );
}

function RemoveBtn({ onClick }) {
  return (
    <button type="button" className="d-pr-textbtn is-small d-pr-crited-remove" onClick={onClick}>
      Retirer ce critère
    </button>
  );
}

function UseBtn({ onClick, label = "Prendre en compte" }) {
  return (
    <button type="button" className="d-btn d-btn-primary d-btn-small d-pr-crited-remove" onClick={onClick}>
      {label}
    </button>
  );
}
