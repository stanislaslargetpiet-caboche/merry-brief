"use client";

// « Vos critères » : la seule boîte des critères du couple, en haut de Prestataires et de Lieux.
// Chaque critère est une puce modifiable sur place (petite fenêtre), sans passer par le Brief :
// les réponses du brief (lieu, date, invités, budget, style) y sont réécrites, le reste va dans vendor_wishes.

import { useEffect, useState } from "react";
import { useDash } from "@/lib/dash/store";
import { REGIONS } from "@/lib/dash/filters";
import { BUDGET_RANGES, CRIT_ICON, GUEST_RANGES, VIBES, criteriaList, guestsOf } from "@/lib/dash/criteria";
import { DuoIcon, Icon } from "./icons";
import { Popover } from "./ui";

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

export function CriteriaBox({ onEnvies }) {
  const data = useDash().data;
  const list = criteriaList(data);
  return (
    <section className="d-pr-crits" aria-labelledby="crit-titre">
      <div className="d-pr-crits-head">
        <h2 id="crit-titre">Vos critères</h2>
        <button type="button" className="d-btn d-btn-ghost d-btn-small d-pr-envies-btn" onClick={onEnvies}>
          <Icon name="sparkle" size={15} sw={2} />
          Préciser mes envies
        </button>
      </div>
      <div className="d-pr-crits-chips">
        {list.map((c) => (
          <CritChip key={`${c.key}-${c.word || ""}`} c={c} />
        ))}
      </div>
    </section>
  );
}

function CritChip({ c }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="d-anchor">
      <button type="button" className={`d-pr-chip is-crit${c.empty ? " is-empty" : ""}${open ? " is-open" : ""}`} aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <CritIcon k={c.key} />
        <span className="d-pr-chip-t">{c.label}</span>
        <Icon name="chevDown" size={12} sw={2.2} stroke="#6b6a63" />
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
  const w = { regions: [], access: [], venue: [], criteria: [], removed: [], ...(data.wishes?.wishes || {}) };
  const setWishes = (patch) => dash.saveWishes({ wishes: { ...w, ...patch } });
  const remove = (patch) => {
    setWishes(patch);
    close();
  };

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
            <Opt key={r} on={w.regions.includes(r)} onClick={() => toggle(r)}>
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
        {!w.regions.length && w.city?.name ? (
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
      </div>
    );
  }

  if (c.key === "date") {
    return (
      <div className="d-pr-crited">
        <TextField id="crit-date" type="date" label="Date du mariage" value={data.wedding.wedding_date || ""} onSave={(d) => dash.updateWedding({ wedding_date: d || null })} />
      </div>
    );
  }

  if (c.key === "invites") {
    const g = guestsOf(data);
    return (
      <div className="d-pr-crited">
        <strong className="d-pr-crited-t">Combien d'invités ?</strong>
        <div role="radiogroup" aria-label="Nombre d'invités" className="d-pr-crited-list">
          {GUEST_RANGES.map((r) => (
            <Opt key={r.code} radio on={g.range?.code === r.code} onClick={() => dash.saveBrief({ guests: r.code })}>
              {r.label}
            </Opt>
          ))}
        </div>
        {g.listCount && (!g.range || g.listCount < g.range.min || g.listCount > g.range.max) ? <span className="d-pr-crited-sub">{g.listCount} dans votre liste d'invités</span> : null}
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
              <Opt key={r.code} radio on={data.brief?.budget === r.code} onClick={() => dash.saveBrief({ budget: r.code })}>
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
          }}
        />
      </div>
    );
  }

  if (c.key === "style") {
    const vibes = data.brief?.vibes || [];
    const all = [...VIBES, ...vibes.filter((x) => !VIBES.includes(x))];
    const toggle = (x) => dash.saveBrief({ vibes: vibes.includes(x) ? vibes.filter((y) => y !== x) : [...vibes, x].slice(-3) });
    return (
      <div className="d-pr-crited">
        <strong className="d-pr-crited-t">Votre style, trois au plus</strong>
        <div className="d-pr-optrow">
          {all.map((x) => (
            <Opt key={x} on={vibes.includes(x)} onClick={() => toggle(x)}>
              {x}
            </Opt>
          ))}
        </div>
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

function RemoveBtn({ onClick }) {
  return (
    <button type="button" className="d-pr-textbtn is-small d-pr-crited-remove" onClick={onClick}>
      Retirer ce critère
    </button>
  );
}
