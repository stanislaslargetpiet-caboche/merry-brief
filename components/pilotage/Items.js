"use client";

// Liste d'actions du pilotage : la capture (Ajouter, ⌘ K), la page Aujourd'hui et la page Tâches.
// Les lignes viennent de /api/interne/pilotage/items ; en démonstration, elles restent dans la page.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { PilotIcon } from "@/components/pilotage/icons";
import { useGo } from "@/components/pilotage/PilotNav";
import { Card, Pill, PilotDots, Tile } from "@/components/pilotage/ui";
import { buildFil, choisirLecture, etatFil, itemAction, lireEdition, parseCapture, rangerTaches, RECURRENCES } from "@/lib/pilotage/items";
import { pilotagePath } from "@/lib/pilotage/nav";
import { briefAgent } from "@/lib/pilotage/agent";
import { fmtDay } from "@/lib/server/pilotage/shape";
import { CRENEAUX, parisDay } from "@/lib/server/pilotage/reseau";
import { demoAgenda, demoItems } from "@/lib/server/pilotage/demo";

const URL_ITEMS = "/api/interne/pilotage/items";
const URL_CONTACT = "/api/interne/pilotage/reseau";
const URL_PLAN = "/api/interne/pilotage/reseau/plan";
const URL_AGENDA = "/api/interne/pilotage/agenda";
const URL_AGENT = "/api/interne/pilotage/agent";

async function call(method, body, url = URL_ITEMS) {
  const { data } = await supabase.auth.getSession();
  const res = await fetch(url, {
    method,
    headers: { authorization: `Bearer ${data?.session?.access_token || ""}`, "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `erreur ${res.status}`);
  return json;
}

export function useItems(status) {
  const demo = status === "demo";
  const [state, setState] = useState({ disponible: true, items: [], faits: [], charge: false });
  const [err, setErr] = useState(null);
  const lire = useCallback(async () => {
    if (status !== "ok") return;
    try {
      setState({ ...(await call("GET")), charge: true });
    } catch (x) {
      setErr(`Liste non lue : ${x.message}`);
    }
  }, [status]);

  useEffect(() => {
    if (demo) setState({ disponible: true, items: demoItems(), faits: [], charge: true });
    else lire();
  }, [demo, lire]);

  const agir = useCallback(
    async (method, body, url) => {
      setErr(null);
      if (demo) {
        if (url) return true;
        setState((s) => {
          if (body.alerte) return { ...s, items: [...s.items, { id: body.alerte, type: "alerte", cle: body.alerte, statut: "fait" }] };
          if (method === "POST") return { ...s, items: [...s.items, { id: `demo-${Date.now()}`, statut: "a_faire", priorite: 0, recurrence: "", detail: "", lien: "", projet: "", echeance: null, ...body }] };
          if (method === "DELETE") return { ...s, items: s.items.filter((i) => i.id !== body.id) };
          const item = [...s.items, ...s.faits].find((i) => i.id === body.id);
          const plan = itemAction(item, body, parisDay(Date.now()));
          const suivant = { ...item, ...plan.valeur };
          const reste = (l) => l.filter((i) => i.id !== body.id);
          return suivant.statut === "fait" ? { ...s, items: reste(s.items), faits: [suivant, ...reste(s.faits)] } : { ...s, items: [...reste(s.items), suivant], faits: reste(s.faits) };
        });
        return true;
      }
      try {
        await call(method, body, url || (method === "DELETE" ? `${URL_ITEMS}?id=${body.id}` : URL_ITEMS));
        await lire();
        return true;
      } catch (x) {
        setErr(`Non enregistré : ${x.message}`);
        return false;
      }
    },
    [demo, lire],
  );

  return { ...state, status, err, agir };
}

// Lu à part des indicateurs, plus lents : les meetings s'affichent sans les attendre
function useAgenda(status) {
  const [agenda, setAgenda] = useState(null);
  useEffect(() => {
    if (status === "demo") return setAgenda(demoAgenda());
    if (status !== "ok") return;
    let vivant = true;
    call("GET", null, URL_AGENDA)
      .then((a) => vivant && setAgenda(a))
      .catch(() => vivant && setAgenda({ disponible: false, raison: "Agenda non lu" }));
    return () => {
      vivant = false;
    };
  }, [status]);
  return agenda;
}

// Ajouter, en bas de la barre latérale ; ⌘ K l'ouvre depuis n'importe quelle page
export function Capture({ agir, disponible, defaut, today }) {
  const [ouvert, setOuvert] = useState(false);
  const [texte, setTexte] = useState("");
  const [type, setType] = useState("tache");
  const [busy, setBusy] = useState(false);
  const champ = useRef(null);

  useEffect(() => {
    const raccourci = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOuvert(true);
      }
      if (e.key === "Escape") setOuvert(false);
    };
    window.addEventListener("keydown", raccourci);
    return () => window.removeEventListener("keydown", raccourci);
  }, []);

  useEffect(() => {
    if (ouvert) champ.current?.focus();
  }, [ouvert]);

  const lu = parseCapture(texte, today, defaut);
  const envoyer = async (e) => {
    e.preventDefault();
    if (!lu.titre || busy) return;
    setBusy(true);
    const ok = await agir("POST", { ...lu, type });
    setBusy(false);
    if (ok) {
      setTexte("");
      setType("tache");
      setOuvert(false);
    }
  };

  return (
    <>
      <button type="button" className="pl-add" onClick={() => setOuvert(true)} disabled={!disponible}>
        <PilotIcon name="ajouter" size={20} />
        Ajouter
        <kbd>⌘ K</kbd>
      </button>
      {ouvert ? (
        <div className="pl-capture-fond" onMouseDown={(e) => e.target === e.currentTarget && setOuvert(false)}>
          <form className="pl-capture" role="dialog" aria-modal="true" aria-label="Ajouter à la liste" onSubmit={envoyer}>
            <input ref={champ} value={texte} onChange={(e) => setTexte(e.target.value)} maxLength={300} placeholder="Appeler Astrid demain #perso !" aria-label="Texte" />
            <div className="pl-capture-bas">
              <span className="pl-filters">
                {[
                  ["tache", "Tâche"],
                  ["decision", "Décision"],
                ].map(([id, label]) => (
                  <button key={id} type="button" className={`pl-chip${type === id ? " is-on" : ""}`} aria-pressed={type === id} onClick={() => setType(id)}>
                    {label}
                  </button>
                ))}
                {lu.echeance ? <Pill tone="neutral">{fmtDay(lu.echeance)}</Pill> : <Pill tone="neutral">À trier</Pill>}
                {lu.projet ? <Pill tone="neutral">{lu.projet}</Pill> : null}
                {lu.priorite ? <Pill tone="warn">Prioritaire</Pill> : null}
              </span>
              <button type="submit" className="pl-btn is-primary" disabled={!lu.titre || busy}>
                Ajouter
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </>
  );
}

// Les gestes d'une ligne du fil : fait, plus tard
function useGestes(l, { agir, reload, retirer }) {
  const [busy, setBusy] = useState(false);
  const geste = async (fn) => {
    setBusy(true);
    const ok = await fn();
    setBusy(false);
    if (ok) retirer(l.cle);
  };
  const autre = l.source === "plan" ? URL_PLAN : URL_CONTACT;
  const fait = () => {
    if (l.source === "item") return geste(() => agir("PATCH", { id: l.id, action: "fait" }));
    if (l.source === "alerte") return geste(() => agir("POST", { alerte: l.cle }));
    return geste(async () => {
      const ok = await agir("PATCH", { id: l.id, action: "fait" }, autre);
      if (ok) reload();
      return ok;
    });
  };
  const tard = () => {
    if (l.source === "item") return geste(() => agir("PATCH", { id: l.id, action: "plus_tard" }));
    return geste(async () => {
      const ok = await agir("PATCH", { id: l.id, action: "reporter" }, autre);
      if (ok) reload();
      return ok;
    });
  };
  return { busy, fait, tard, reportable: ["item", "plan", "contact"].includes(l.source) };
}

const Ouvrir = ({ l, primaire }) =>
  l.lien ? (
    <a className={`pl-btn${primaire ? " is-primary" : ""}`} href={l.lien} target={l.lien.startsWith("http") ? "_blank" : undefined} rel="noreferrer">
      Ouvrir
    </a>
  ) : null;

const Tick = ({ l, g }) => (l.source !== "demande" ? <button type="button" className="pl-tick" aria-label={`Fait : ${l.titre}`} onClick={g.fait} disabled={g.busy} /> : <span className="pl-tick is-vide" />);
const PlusTard = ({ g }) =>
  g.reportable ? (
    <button type="button" className="pl-chip" onClick={g.tard} disabled={g.busy}>
      Plus tard
    </button>
  ) : null;

// Une tâche de Stan : marque citron, titre plus grand, priorité et retard en clair
function LigneTache({ l, ...gestes }) {
  const g = useGestes(l, gestes);
  return (
    <li className={`pl-ligne pl-ligne-mienne${l.prioritaire ? " is-prio" : ""}`}>
      <Tick l={l} g={g} />
      <span className="pl-ligne-t">
        <strong>{l.titre}</strong>
        {l.sous && !l.retard ? <small>{l.sous}</small> : null}
      </span>
      {l.prioritaire ? (
        <span className="pl-marque">
          <PilotIcon name="priorite" size={16} />
          Prioritaire
        </span>
      ) : null}
      {l.retard ? <Pill tone="warn">En retard</Pill> : null}
      {l.projet ? <Pill tone="neutral">{l.projet}</Pill> : null}
      {l.tag === "Campagne" || l.tag === "Décision" ? <Pill tone="lime">{l.tag}</Pill> : null}
      <span className="pl-ligne-a">
        <PlusTard g={g} />
        <Ouvrir l={l} />
      </span>
    </li>
  );
}

const ETATS_AGENT = { audit: "Audit lancé", reparer: "Réparation lancée" };

// Un bug : le constat en deux lignes (lisible en entier), puis Auditer et Réparer lancent un agent
function CarteBug({ l, demo, ...gestes }) {
  const g = useGestes(l, gestes);
  const [ouvert, setOuvert] = useState(false);
  const [agent, setAgent] = useState(null);
  const lancer = async (mode) => {
    setAgent({ mode, etat: "envoi" });
    try {
      const r = demo ? { ok: true, lance: false, brief: briefAgent(l.item, mode) } : await call("POST", { id: l.id, mode }, URL_AGENT);
      if (r.lance) return setAgent({ mode, etat: "lance", session: r.session });
      await navigator.clipboard?.writeText(r.brief).catch(() => {});
      setAgent({ mode, etat: "copie" });
    } catch (x) {
      setAgent({ mode, etat: "echec", message: x.message });
    }
  };
  const envoi = agent?.etat === "envoi";
  return (
    <li className="pl-bug">
      <span className="pl-bug-ico">
        <PilotIcon name="bug" size={26} />
      </span>
      <div className="pl-bug-corps">
        <div className="pl-bug-tete">
          <strong>{l.titre}</strong>
          {l.retard ? <Pill tone="warn">En retard</Pill> : null}
        </div>
        {l.sous ? <p className={`pl-bug-texte${ouvert ? " is-ouvert" : ""}`}>{l.sous}</p> : null}
        {l.sous && l.sous.length > 160 ? (
          <button type="button" className="pl-link" onClick={() => setOuvert(!ouvert)} aria-expanded={ouvert}>
            {ouvert ? "Réduire" : "Tout lire"}
          </button>
        ) : null}
        <div className="pl-bug-actions">
          <button type="button" className="pl-btn is-agent" onClick={() => lancer("audit")} disabled={envoi}>
            <PilotIcon name="audit" size={16} />
            Auditer
          </button>
          <button type="button" className="pl-btn is-primary is-agent" onClick={() => lancer("reparer")} disabled={envoi}>
            <PilotIcon name="agent" size={16} />
            Réparer
          </button>
          {agent ? (
            <span className={`pl-agent-etat${agent.etat === "echec" ? " is-echec" : ""}`} role="status">
              {agent.etat === "envoi" ? "Envoi…" : null}
              {agent.etat === "lance" ? ETATS_AGENT[agent.mode] : null}
              {agent.etat === "copie" ? "Consigne copiée, à coller dans Claude Code" : null}
              {agent.etat === "echec" ? `Non lancé : ${agent.message}` : null}
              {agent.session ? (
                <a href={agent.session} target="_blank" rel="noreferrer">
                  Voir la session
                </a>
              ) : null}
            </span>
          ) : null}
        </div>
      </div>
      <span className="pl-ligne-a">
        <PlusTard g={g} />
        <button type="button" className="pl-tick" aria-label={`Fait : ${l.titre}`} onClick={g.fait} disabled={g.busy} />
      </span>
    </li>
  );
}

const ICONES_CANAL = { linkedin: "linkedin", mail: "email", appel: "telephone", intro: "intro" };

function LigneReseau({ l, ...gestes }) {
  const g = useGestes(l, gestes);
  return (
    <li className="pl-ligne pl-ligne-reseau">
      <Tick l={l} g={g} />
      <span className="pl-canal">
        <PilotIcon name={ICONES_CANAL[l.canal] || "reseau"} size={22} />
      </span>
      <span className="pl-ligne-t">
        <strong>{l.titre}</strong>
        {l.sous ? <small>{l.sous}</small> : null}
      </span>
      {l.pret ? <Pill tone="lime">Message prêt</Pill> : null}
      {l.retard ? <Pill tone="warn">En retard</Pill> : null}
      <span className="pl-ligne-a">
        <PlusTard g={g} />
        <Ouvrir l={l} />
      </span>
    </li>
  );
}

function LigneAlerte({ l, ...gestes }) {
  const g = useGestes(l, gestes);
  return (
    <li className="pl-ligne">
      <Tick l={l} g={g} />
      <span className="pl-ligne-t">
        <strong>{l.titre}</strong>
        {l.sous ? <small>{l.sous}</small> : null}
      </span>
      <Pill tone={l.tone}>{l.tag}</Pill>
      <span className="pl-ligne-a">
        <Ouvrir l={l} />
      </span>
    </li>
  );
}

function Section({ icone, titre, n, className = "", children }) {
  return (
    <section className={`pl-card pl-section ${className}`.trim()}>
      <h3>
        <PilotIcon name={icone} size={24} />
        {titre}
        <span className="pl-section-n">{n}</span>
      </h3>
      {children}
    </section>
  );
}

// Le fil du jour en quatre blocs : ce que Stan a ajouté, les bugs, le réseau, les alertes
function FilGroupe({ fil, gestes, demo }) {
  const du = (g) => fil.filter((l) => l.groupe === g);
  const taches = du("taches");
  const bugs = du("bugs");
  const reseau = du("reseau");
  const alertes = du("alertes");
  const creneaux = [...new Set(reseau.map((l) => l.creneau))].map((id) => ({ id, label: id === "relance" ? "Relances du pipeline" : CRENEAUX_LABELS[id] || "Réseau", lignes: reseau.filter((l) => l.creneau === id) }));
  return (
    <div className="pl-fil">
      {taches.length ? (
        <Section icone="taches" titre="Mes tâches" n={taches.length} className="is-miennes">
          <ul className="pl-lignes">
            {taches.map((l) => (
              <LigneTache key={l.cle} l={l} {...gestes} />
            ))}
          </ul>
        </Section>
      ) : null}
      {bugs.length ? (
        <Section icone="bug" titre="Bugs" n={bugs.length}>
          <ul className="pl-bugs">
            {bugs.map((l) => (
              <CarteBug key={l.cle} l={l} demo={demo} {...gestes} />
            ))}
          </ul>
        </Section>
      ) : null}
      {reseau.length ? (
        <Section icone="reseau" titre="Réseau" n={reseau.length}>
          {creneaux.map((c) => (
            <div key={c.id} className="pl-creneau">
              <h4>
                <PilotIcon name="horloge" size={16} />
                {c.label}
              </h4>
              <ul className="pl-lignes">
                {c.lignes.map((l) => (
                  <LigneReseau key={l.cle} l={l} {...gestes} />
                ))}
              </ul>
            </div>
          ))}
        </Section>
      ) : null}
      {alertes.length ? (
        <Section icone="alerte" titre="Alertes" n={alertes.length}>
          <ul className="pl-lignes">
            {alertes.map((l) => (
              <LigneAlerte key={l.cle} l={l} {...gestes} />
            ))}
          </ul>
        </Section>
      ) : null}
    </div>
  );
}

const CRENEAUX_LABELS = Object.fromEntries(CRENEAUX.map((c) => [c.id, c.label]));

function Meetings({ status }) {
  const agenda = useAgenda(status);
  const meetings = agenda?.meetings || [];
  return (
    <Card title={`Meetings avec l'extérieur${meetings.length ? ` · ${meetings.length}` : ""}`}>
      {meetings.length ? (
        <dl className="pl-facts">
          {meetings.map((m) => (
            <div key={m.id}>
              <dt>{m.personnes}</dt>
              <dd>{m.heure}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="pl-empty">{!agenda ? <PilotDots label="Lecture de l'agenda" /> : agenda.disponible ? "Aucun aujourd'hui" : agenda.raison}</p>
      )}
    </Card>
  );
}

function Morceaux({ liste }) {
  return liste.map((m, i) =>
    m.lien ? (
      <a key={i} href={m.lien} target="_blank" rel="noreferrer">
        {m.texte}
      </a>
    ) : m.gras ? (
      <strong key={i}>{m.gras}</strong>
    ) : (
      <span key={i}>{m.texte}</span>
    ),
  );
}

function Edition({ texte, langue }) {
  return (
    <details className="pl-edition">
      <summary>{langue === "en" ? "Read" : "Lire"}</summary>
      {lireEdition(texte).map((b, i) =>
        b.type === "titre" ? (
          <h4 key={i}>{b.texte}</h4>
        ) : b.type === "liste" ? (
          <ul key={i}>
            {b.lignes.map((l, j) => (
              <li key={j}>
                <Morceaux liste={l} />
              </li>
            ))}
          </ul>
        ) : (
          <p key={i}>
            <Morceaux liste={b.morceaux} />
          </p>
        ),
      )}
    </details>
  );
}

function BlocLecture({ titre, items, today, langue }) {
  const lecture = choisirLecture(items, titre, langue);
  return (
    <Card title={titre}>
      {lecture ? (
        <div className="pl-lecture">
          {lecture.echeance && lecture.echeance !== today ? <small>{fmtDay(lecture.echeance)}</small> : null}
          {lecture.lien ? (
            <a href={lecture.lien} target="_blank" rel="noreferrer">
              {lecture.titre}
            </a>
          ) : (
            <strong>{lecture.titre}</strong>
          )}
          {lecture.detail ? <p>{lecture.detail}</p> : null}
          {lecture.contenu ? <Edition texte={lecture.contenu} langue={langue} /> : null}
        </div>
      ) : (
        <p className="pl-empty">Pas encore publiée</p>
      )}
    </Card>
  );
}

export function Aujourdhui({ liste, data, sante, today, tuiles, reload, search, langue = "fr", indicateurs = "lus" }) {
  const go = useGo();
  const pageTaches = `${pilotagePath("taches", "liste")}${search}`;
  const [retires, setRetires] = useState([]);
  const items = liste.items;
  const fil = useMemo(() => buildFil({ items, reseau: data.reseau, demandes: data.demandes, sante, today }).filter((l) => !retires.includes(l.cle)), [items, data.reseau, data.demandes, sante, today, retires]);
  const retirer = useCallback((cle) => setRetires((r) => [...r, cle]), []);
  const mot = items.filter((i) => i.type === "mot" && i.statut === "a_faire").sort((a, b) => String(b.cree_le).localeCompare(String(a.cree_le)))[0];
  const nbTaches = rangerTaches(items, today).reduce((n, g) => n + g.lignes.length, 0);
  const etat = etatFil({ charge: liste.charge, err: liste.err, indicateurs });
  return (
    <>
      <div className="pl-tiles">
        {tuiles.map((t) => (
          <Tile key={t.label} {...t} sansPct />
        ))}
      </div>
      {mot ? (
        <div className="pl-mot">
          <p>{mot.detail || mot.titre}</p>
        </div>
      ) : null}
      {!liste.disponible ? <div className="pl-errors">{liste.raison}</div> : null}
      {liste.err ? <div className="pl-errors">{liste.err}</div> : null}
      <div className="pl-jour has-side">
        {fil.length ? (
          <>
            <FilGroupe fil={fil} gestes={{ agir: liste.agir, reload, retirer }} demo={liste.status === "demo"} />
            {etat.complet ? null : <p className="pl-empty">{etat.message}</p>}
          </>
        ) : (
          <Card title="À faire">
            <p className="pl-empty">{etat.message}</p>
          </Card>
        )}
        <div className="pl-jour-side">
          <Meetings status={liste.status} />
          <a className="pl-card pl-compteur" href={pageTaches} onClick={(e) => go(e, pageTaches)}>
            <span>{liste.charge ? nbTaches : "–"}</span>
            Tâches
          </a>
        </div>
      </div>
      <div className="pl-lectures">
        <BlocLecture titre="News of the Day" items={items} today={today} langue={langue} />
        <BlocLecture titre="Feature of the Day" items={items} today={today} langue={langue} />
      </div>
    </>
  );
}

function Tache({ i, agir }) {
  const [titre, setTitre] = useState(i.titre);
  const modifier = (champs) => agir("PATCH", { id: i.id, action: "modifier", ...champs });
  return (
    <li className="pl-ligne pl-tache">
      <button type="button" className="pl-tick" aria-label={`Fait : ${i.titre}`} onClick={() => agir("PATCH", { id: i.id, action: "fait" })} />
      <input className="pl-tache-titre" value={titre} maxLength={300} aria-label="Titre" onChange={(e) => setTitre(e.target.value)} onBlur={() => titre.trim() && titre !== i.titre && modifier({ titre })} />
      {i.projet ? <Pill tone="neutral">{i.projet}</Pill> : null}
      {i.type === "decision" ? <Pill tone="neutral">Décision</Pill> : null}
      {i.priorite ? <Pill tone="warn">Prioritaire</Pill> : null}
      <span className="pl-ligne-a">
        <input className="pl-tache-date" type="date" value={i.echeance || ""} aria-label="Échéance" onChange={(e) => modifier({ echeance: e.target.value || null })} />
        <select className="pl-reseau-statut" value={i.recurrence} aria-label="Récurrence" onChange={(e) => modifier({ recurrence: e.target.value })}>
          {RECURRENCES.map((r) => (
            <option key={r.id} value={r.id}>
              {r.label}
            </option>
          ))}
        </select>
        <button type="button" className="pl-link" onClick={() => window.confirm(`Supprimer « ${i.titre} » ?`) && agir("DELETE", { id: i.id })}>
          Supprimer
        </button>
      </span>
    </li>
  );
}

export function Taches({ liste, today }) {
  const [projet, setProjet] = useState("");
  const projets = useMemo(() => [...new Set(rangerTaches(liste.items, today).flatMap((g) => g.lignes.map((i) => i.projet)).filter(Boolean))].sort(), [liste.items, today]);
  const vus = projet ? liste.items.filter((i) => i.projet === projet) : liste.items;
  const groupes = rangerTaches(vus, today);
  return (
    <>
      {!liste.disponible ? <div className="pl-errors">{liste.raison}</div> : null}
      {liste.err ? <div className="pl-errors">{liste.err}</div> : null}
      {projets.length ? (
        <div className="pl-filters">
          {["", ...projets].map((p) => (
            <button key={p} type="button" className={`pl-chip${projet === p ? " is-on" : ""}`} aria-pressed={projet === p} onClick={() => setProjet(p)}>
              {p || "Tout"}
            </button>
          ))}
        </div>
      ) : null}
      {groupes.map((g) => (
        <Card key={g.id} title={`${g.label} · ${g.lignes.length}`}>
          <ul className="pl-lignes">
            {g.lignes.map((i) => (
              <Tache key={i.id} i={i} agir={liste.agir} />
            ))}
          </ul>
        </Card>
      ))}
      {!groupes.length && liste.disponible && (liste.charge || !liste.err) ? <p className="pl-empty">{liste.charge ? "Rien à faire" : <PilotDots label="Lecture de la liste" />}</p> : null}
      {liste.faits.length ? (
        <Card title="Faites récemment">
          <ul className="pl-lignes">
            {liste.faits.map((i) => (
              <li key={i.id} className="pl-ligne">
                <span className="pl-ligne-t">
                  <small>{i.titre}</small>
                </span>
                <button type="button" className="pl-link" onClick={() => liste.agir("PATCH", { id: i.id, action: "rouvrir" })}>
                  Rétablir
                </button>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </>
  );
}
