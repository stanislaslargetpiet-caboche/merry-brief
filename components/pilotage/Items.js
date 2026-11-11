"use client";

// Liste d'actions du pilotage : la capture (Ajouter, ⌘ K), la page Aujourd'hui et la page Tâches.
// Les lignes viennent de /api/interne/pilotage/items ; en démonstration, elles restent dans la page.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { PilotIcon } from "@/components/pilotage/icons";
import { useGo } from "@/components/pilotage/PilotNav";
import { Card, Pill, PilotDots, Tile } from "@/components/pilotage/ui";
import { buildFil, choisirLecture, etatFil, grilleMois, itemAction, libelleEcheance, lireEdition, moisDecale, parseCapture, rangerTaches, raccourcisDate, RECURRENCES } from "@/lib/pilotage/items";
import { pilotagePath } from "@/lib/pilotage/nav";
import { briefAgent, estAlerteBug } from "@/lib/pilotage/agent";
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

// Auditer et Réparer : lancent l'agent, ou copient la consigne quand aucun agent n'est branché
function useAgent(l, demo) {
  const [agent, setAgent] = useState(null);
  const alerte = l.source === "alerte";
  const lancer = async (mode) => {
    setAgent({ mode, etat: "envoi" });
    try {
      const corps = alerte ? { alerte: { titre: l.titre, detail: l.sous }, mode } : { id: l.id, mode };
      const r = demo ? { ok: true, lance: false, brief: briefAgent(alerte ? { titre: l.titre, detail: l.sous } : l.item, mode, alerte) } : await call("POST", corps, URL_AGENT);
      if (r.lance) return setAgent({ mode, etat: "lance", session: r.session });
      await navigator.clipboard?.writeText(r.brief).catch(() => {});
      setAgent({ mode, etat: "copie" });
    } catch (x) {
      setAgent({ mode, etat: "echec", message: x.message });
    }
  };
  return { agent, lancer, envoi: agent?.etat === "envoi" };
}

function EtatAgent({ agent }) {
  if (!agent) return null;
  return (
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
  );
}

// Un bug : le constat en deux lignes (lisible en entier), puis Auditer et Réparer lancent un agent
function CarteBug({ l, demo, ...gestes }) {
  const g = useGestes(l, gestes);
  const [ouvert, setOuvert] = useState(false);
  const { agent, lancer, envoi } = useAgent(l, demo);
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
          <EtatAgent agent={agent} />
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

// Une alerte se traite ou s'écarte : Auditer et Réparer pour celles qui parlent de bugs, Écarter quand elle est déjà traitée
// ou n'est plus d'actualité (elle revient si son texte change)
function LigneAlerte({ l, demo, ...gestes }) {
  const g = useGestes(l, gestes);
  const { agent, lancer, envoi } = useAgent(l, demo);
  const bug = l.source === "alerte" && estAlerteBug(l.titre);
  return (
    <li className="pl-ligne pl-ligne-alerte">
      <span className="pl-ligne-t">
        <strong>{l.titre}</strong>
        {l.sous ? <small>{l.sous}</small> : null}
        <EtatAgent agent={agent} />
      </span>
      <Pill tone={l.tone}>{l.tag}</Pill>
      <span className="pl-ligne-a">
        {bug ? (
          <>
            <button type="button" className="pl-btn is-agent" onClick={() => lancer("audit")} disabled={envoi}>
              <PilotIcon name="audit" size={16} />
              Auditer
            </button>
            <button type="button" className="pl-btn is-agent" onClick={() => lancer("reparer")} disabled={envoi}>
              <PilotIcon name="agent" size={16} />
              Réparer
            </button>
          </>
        ) : null}
        <Ouvrir l={l} />
        {l.source !== "demande" ? (
          <button type="button" className="pl-btn is-primary" onClick={g.fait} disabled={g.busy} title="Déjà traitée ou plus à jour : elle revient si son texte change">
            Écarter
          </button>
        ) : null}
      </span>
    </li>
  );
}

function Section({ icone, titre, n, className = "", plie = false, children }) {
  const [ouvert, setOuvert] = useState(!plie);
  return (
    <section className={`pl-card pl-section ${className}`.trim()}>
      <h3>
        <button type="button" className="pl-section-toggle" aria-expanded={ouvert} onClick={() => setOuvert((o) => !o)}>
          <PilotIcon name={icone} size={24} />
          {titre}
          <span className="pl-section-n">{n}</span>
          <svg className="pl-section-chevron" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M4 6l4 4 4-4" />
          </svg>
        </button>
      </h3>
      {ouvert ? children : null}
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
        <Section icone="reseau" titre="Réseau" n={reseau.length} plie>
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
              <LigneAlerte key={l.cle} l={l} demo={demo} {...gestes} />
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

// Chaque chiffre du bandeau mène à la page qui le détaille
const TUILES_LIENS = {
  Visiteurs: pilotagePath("acquisition", "site"),
  "Comptes créés": pilotagePath("acquisition", "site"),
  "Mariages créés": pilotagePath("couples", "activite"),
  "Demandes de devis": pilotagePath("couples", "activite"),
};

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
          <Tile key={t.label} {...t} sansPct href={TUILES_LIENS[t.label] ? `${TUILES_LIENS[t.label]}${search}` : undefined} onGo={go} />
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

const TRAIT = { fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round", strokeLinejoin: "round" };

// Icônes au trait, sans couleur : la date et le temps se lisent au texte, comme dans Todoist
function Trait({ name }) {
  const dessins = {
    date: (
      <>
        <rect x="3.5" y="4.5" width="13" height="12" rx="2.5" />
        <path d="M3.5 8h13" />
      </>
    ),
    repeter: (
      <>
        <path d="M4 9V8a2 2 0 0 1 2-2h8l-2-2M16 11v1a2 2 0 0 1-2 2H6l2 2" />
      </>
    ),
    ajouter: <path d="M10 4v12M4 10h12" />,
    supprimer: <path d="M4.5 6h11M8 6V4.5h4V6M6 6l.6 9.5h6.8L14 6" />,
    precedent: <path d="m12 5-5 5 5 5" />,
    suivant: <path d="m8 5 5 5-5 5" />,
    sans: (
      <>
        <circle cx="10" cy="10" r="6.5" />
        <path d="m5.4 14.6 9.2-9.2" />
      </>
    ),
  };
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" aria-hidden="true" {...TRAIT}>
      {dessins[name]}
    </svg>
  );
}

const JOURS_COURTS = ["L", "M", "M", "J", "V", "S", "D"];

// Le sélecteur de date de Todoist : un champ pour écrire « demain », des raccourcis, le mois, la récurrence
function ChoixDate({ valeur, recurrence, today, onChoisir, onRecurrence, onFermer }) {
  const [mois, setMois] = useState((valeur || today).slice(0, 7));
  const [saisie, setSaisie] = useState("");
  const boite = useRef(null);
  const grille = useMemo(() => grilleMois(mois), [mois]);
  const raccourcis = useMemo(() => raccourcisDate(today), [today]);
  const lu = saisie.trim() ? parseCapture(`x ${saisie}`, today).echeance : null;
  const libelle = (j) => libelleEcheance(j, today)?.texte;

  useEffect(() => {
    const dehors = (e) => boite.current && !boite.current.contains(e.target) && onFermer();
    const echap = (e) => e.key === "Escape" && (e.stopPropagation(), onFermer());
    document.addEventListener("mousedown", dehors);
    document.addEventListener("keydown", echap);
    return () => {
      document.removeEventListener("mousedown", dehors);
      document.removeEventListener("keydown", echap);
    };
  }, [onFermer]);

  return (
    <div className="pl-date-pop" ref={boite} role="dialog" aria-label="Choisir la date">
      <input
        className="pl-date-saisie"
        autoFocus
        value={saisie}
        placeholder={valeur ? libelle(valeur) : "Écrire une date : demain, vendredi…"}
        aria-label="Date"
        onChange={(e) => setSaisie(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            if (lu) onChoisir(lu);
          }
        }}
      />
      {lu ? (
        <button type="button" className="pl-date-opt" onClick={() => onChoisir(lu)}>
          <Trait name="date" />
          <span>{libelle(lu)}</span>
        </button>
      ) : null}
      <div className="pl-date-opts">
        {raccourcis.map((r) => (
          <button key={r.id} type="button" className="pl-date-opt" onClick={() => onChoisir(r.jour)}>
            <Trait name="date" />
            <span>{r.label}</span>
            <small>{r.repere}</small>
          </button>
        ))}
        <button type="button" className="pl-date-opt" onClick={() => onChoisir(null)}>
          <Trait name="sans" />
          <span>Sans date</span>
        </button>
      </div>
      <div className="pl-cal">
        <div className="pl-cal-tete">
          <strong>{grille.titre}</strong>
          <button type="button" className="pl-cal-nav" aria-label="Mois précédent" onClick={() => setMois(moisDecale(mois, -1))}>
            <Trait name="precedent" />
          </button>
          <button type="button" className="pl-cal-nav" aria-label="Mois suivant" onClick={() => setMois(moisDecale(mois, 1))}>
            <Trait name="suivant" />
          </button>
        </div>
        <div className="pl-cal-grille">
          {JOURS_COURTS.map((j, k) => (
            <span key={k} className="pl-cal-j">
              {j}
            </span>
          ))}
          {grille.semaines.flat().map((c) =>
            c.dansMois ? (
              <button key={c.jour} type="button" className={`pl-cal-jour${c.jour === today ? " is-today" : ""}${c.jour === valeur ? " is-on" : ""}${c.jour < today ? " is-passe" : ""}`} aria-label={libelle(c.jour) || c.jour} aria-pressed={c.jour === valeur} onClick={() => onChoisir(c.jour)}>
                {Number(c.jour.slice(8))}
              </button>
            ) : (
              <span key={c.jour} />
            ),
          )}
        </div>
      </div>
      <label className="pl-date-rec">
        <Trait name="repeter" />
        <select value={recurrence} aria-label="Récurrence" onChange={(e) => onRecurrence(e.target.value)}>
          {RECURRENCES.map((r) => (
            <option key={r.id} value={r.id}>
              {r.id ? r.label : "Récurrence"}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

// L'échéance sous le titre ; un clic ouvre le sélecteur. `vide` : la puce Date d'un champ d'ajout, encadrée même sans date
function PuceDate({ echeance, recurrence, today, vide, onChoisir, onRecurrence }) {
  const [ouvert, setOuvert] = useState(false);
  const fermer = useCallback(() => setOuvert(false), []);
  const l = libelleEcheance(echeance, today);
  return (
    <span className="pl-date-wrap">
      <button type="button" className={`pl-date${l ? ` is-${l.ton}` : " is-vide"}${vide ? " is-chip" : ""}`} aria-haspopup="dialog" aria-expanded={ouvert} onClick={() => setOuvert((o) => !o)}>
        <Trait name="date" />
        {l ? l.texte : "Date"}
        {recurrence ? <Trait name="repeter" /> : null}
      </button>
      {ouvert ? (
        <ChoixDate
          valeur={echeance}
          recurrence={recurrence}
          today={today}
          onChoisir={(j) => {
            onChoisir(j);
            fermer();
          }}
          onRecurrence={onRecurrence}
          onFermer={fermer}
        />
      ) : null}
    </span>
  );
}

function Tache({ i, agir, today }) {
  const [titre, setTitre] = useState(i.titre);
  const modifier = (champs) => agir("PATCH", { id: i.id, action: "modifier", ...champs });
  return (
    <li className="pl-tache">
      <button type="button" className="pl-tick pl-tache-tick" aria-label={`Fait : ${i.titre}`} onClick={() => agir("PATCH", { id: i.id, action: "fait" })} />
      <div className="pl-tache-corps">
        <div className="pl-tache-haut">
          <input className="pl-tache-titre" value={titre} maxLength={300} aria-label="Titre" onChange={(e) => setTitre(e.target.value)} onBlur={() => titre.trim() && titre !== i.titre && modifier({ titre })} onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()} />
          {i.projet ? <Pill tone="neutral">{i.projet}</Pill> : null}
          {i.type === "decision" ? <Pill tone="neutral">Décision</Pill> : null}
          {i.priorite ? <Pill tone="warn">Prioritaire</Pill> : null}
        </div>
        {i.echeance || i.recurrence ? <PuceDate echeance={i.echeance} recurrence={i.recurrence} today={today} onChoisir={(echeance) => modifier({ echeance })} onRecurrence={(recurrence) => modifier({ recurrence })} /> : null}
      </div>
      <span className="pl-tache-actions">
        {!i.echeance && !i.recurrence ? <PuceDate echeance={null} recurrence="" today={today} onChoisir={(echeance) => modifier({ echeance })} onRecurrence={(recurrence) => modifier({ recurrence })} /> : null}
        <button type="button" className="pl-icone" aria-label={`Supprimer « ${i.titre} »`} onClick={() => window.confirm(`Supprimer « ${i.titre} » ?`) && agir("DELETE", { id: i.id })}>
          <Trait name="supprimer" />
        </button>
      </span>
    </li>
  );
}

// « Ajouter une tâche » en bas de la liste : le champ s'ouvre sur place, avec sa date, comme dans Todoist
function AjoutTache({ agir, disponible, today }) {
  const [ouvert, setOuvert] = useState(false);
  const [texte, setTexte] = useState("");
  const [echeance, setEcheance] = useState(null);
  const [recurrence, setRecurrence] = useState("");
  const [busy, setBusy] = useState(false);
  const champ = useRef(null);
  const lu = parseCapture(texte, today, echeance);
  const fermer = () => {
    setOuvert(false);
    setTexte("");
    setEcheance(null);
    setRecurrence("");
  };
  const envoyer = async (e) => {
    e.preventDefault();
    if (!lu.titre || busy) return;
    setBusy(true);
    const ok = await agir("POST", { ...lu, type: "tache", ...(recurrence ? { recurrence } : {}) });
    setBusy(false);
    if (ok) {
      setTexte("");
      setEcheance(null);
      setRecurrence("");
      champ.current?.focus();
    }
  };
  if (!ouvert)
    return (
      <button type="button" className="pl-ajout-ligne" disabled={!disponible} onClick={() => setOuvert(true)}>
        <Trait name="ajouter" />
        Ajouter une tâche
      </button>
    );
  return (
    <form className="pl-ajout" onSubmit={envoyer} onKeyDown={(e) => e.key === "Escape" && fermer()}>
      <input ref={champ} autoFocus className="pl-ajout-titre" value={texte} maxLength={300} placeholder="Nom de la tâche" aria-label="Nom de la tâche" onChange={(e) => setTexte(e.target.value)} />
      <div className="pl-ajout-bas">
        <PuceDate echeance={lu.echeance} recurrence={recurrence} today={today} vide onChoisir={setEcheance} onRecurrence={setRecurrence} />
        {lu.projet ? <Pill tone="neutral">{lu.projet}</Pill> : null}
        {lu.priorite ? <Pill tone="warn">Prioritaire</Pill> : null}
        <span className="pl-ajout-boutons">
          <button type="button" className="pl-btn" onClick={fermer}>
            Annuler
          </button>
          <button type="submit" className="pl-btn is-primary" disabled={!lu.titre || busy}>
            Ajouter
          </button>
        </span>
      </div>
    </form>
  );
}

export function Taches({ liste, today }) {
  const [projet, setProjet] = useState("");
  const projets = useMemo(() => [...new Set(rangerTaches(liste.items, today).flatMap((g) => g.lignes.map((i) => i.projet)).filter(Boolean))].sort(), [liste.items, today]);
  const vus = projet ? liste.items.filter((i) => i.projet === projet) : liste.items;
  const lignes = rangerTaches(vus, today).flatMap((g) => g.lignes);
  const [faitsOuverts, setFaitsOuverts] = useState(false);
  return (
    <div className="pl-taches">
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
      {lignes.length ? (
        <ul className="pl-taches-liste">
          {lignes.map((i) => (
            <Tache key={i.id} i={i} agir={liste.agir} today={today} />
          ))}
        </ul>
      ) : null}
      <AjoutTache agir={liste.agir} disponible={liste.disponible} today={today} />
      {!lignes.length && liste.disponible && (liste.charge || !liste.err) ? <p className="pl-empty">{liste.charge ? "Rien à faire" : <PilotDots label="Lecture de la liste" />}</p> : null}
      {liste.faits.length ? (
        <div className="pl-faites">
          <button type="button" className="pl-faites-titre" aria-expanded={faitsOuverts} onClick={() => setFaitsOuverts((o) => !o)}>
            Faites récemment · {liste.faits.length}
          </button>
          {faitsOuverts ? (
            <ul className="pl-taches-liste">
              {liste.faits.map((i) => (
                <li key={i.id} className="pl-tache is-faite">
                  <button type="button" className="pl-tick pl-tache-tick is-fait" aria-label={`Rétablir : ${i.titre}`} onClick={() => liste.agir("PATCH", { id: i.id, action: "rouvrir" })} />
                  <div className="pl-tache-corps">
                    <span className="pl-tache-fait">{i.titre}</span>
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
