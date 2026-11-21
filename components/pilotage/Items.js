"use client";

// Liste d'actions du pilotage : la page Aujourd'hui (bugs, alertes, lectures). Les tâches, la page Tâches et la capture
// (Ajouter, ⌘ K) sont retirées depuis le 21 novembre 2026.
// Les lignes viennent de /api/interne/pilotage/items ; en démonstration, elles restent dans la page.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { PilotIcon } from "@/components/pilotage/icons";
import { useGo } from "@/components/pilotage/PilotNav";
import { Card, Pill, PilotDots, Tile } from "@/components/pilotage/ui";
import { buildFil, choisirLecture, etatFil, itemAction, lireEdition } from "@/lib/pilotage/items";
import { pilotagePath } from "@/lib/pilotage/nav";
import { briefAgent, estAlerteBug, statutBug } from "@/lib/pilotage/agent";
import { fmtDay } from "@/lib/server/pilotage/shape";
import { parisDay } from "@/lib/server/pilotage/reseau";
import { demoItems } from "@/lib/server/pilotage/demo";

const URL_ITEMS = "/api/interne/pilotage/items";
const URL_CONTACT = "/api/interne/pilotage/reseau";
const URL_PLAN = "/api/interne/pilotage/reseau/plan";
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

const PlusTard = ({ g }) =>
  g.reportable ? (
    <button type="button" className="pl-chip" onClick={g.tard} disabled={g.busy}>
      Plus tard
    </button>
  ) : null;

const ETATS_AGENT = { audit: "Audit lancé", reparer: "Réparation lancée" };

// Les comptes rendus des agents, par clé de ligne du fil. Relus toutes les 20 s tant qu'un agent travaille : le bouton Rapport
// apparaît seul quand il a fini. En démonstration, il n'y en a pas.
function useRapports(demo) {
  const [rapports, setRapports] = useState({});
  const lire = useCallback(async () => {
    if (demo) return;
    try {
      const { rapports: liste = [] } = await call("GET", null, URL_AGENT);
      setRapports(Object.fromEntries(liste.map((r) => [r.cle, r])));
    } catch {}
  }, [demo]);
  useEffect(() => {
    lire();
  }, [lire]);
  // Toutes les 20 s tant qu'un agent travaille, toutes les 5 min tant qu'une PR attend d'être fusionnée
  const attente = Object.values(rapports).some((r) => r.statut === "en_cours");
  const aFusionner = Object.values(rapports).some((r) => r.pr?.etat === "ouverte");
  const rythme = attente ? 20000 : aFusionner ? 300000 : 0;
  useEffect(() => {
    if (!rythme) return;
    const t = setInterval(lire, rythme);
    return () => clearInterval(t);
  }, [rythme, lire]);
  return { rapports, relire: lire };
}

// Auditer et Réparer : lancent l'agent, ou copient la consigne quand aucun agent n'est branché
function useAgent(l, demo, rapport, relire) {
  const [agent, setAgent] = useState(null);
  const alerte = l.source === "alerte";
  const lancer = async (mode) => {
    setAgent({ mode, etat: "envoi" });
    try {
      const corps = alerte ? { alerte: { titre: l.titre, detail: l.sous }, mode, cle: l.cle } : { id: l.id, mode, cle: l.cle };
      const r = demo ? { ok: true, lance: false, brief: briefAgent(alerte ? { titre: l.titre, detail: l.sous } : l.item, mode, alerte) } : await call("POST", corps, URL_AGENT);
      if (r.lance) {
        setAgent({ mode, etat: "lance", session: r.session });
        return relire?.();
      }
      await navigator.clipboard?.writeText(r.brief).catch(() => {});
      setAgent({ mode, etat: "copie" });
    } catch (x) {
      setAgent({ mode, etat: "echec", message: x.message });
    }
  };
  // Un compte rendu relu en base prime sur l'état local : il survit au rechargement de la page
  const vu = rapport && rapport.statut === "en_cours" && (!agent || agent.etat === "lance") ? { mode: rapport.mode, etat: "lance", session: rapport.session } : agent;
  return { agent: vu, lancer, envoi: agent?.etat === "envoi", pret: rapport?.statut === "pret" };
}

// Une PR fusionnée règle le bug : la carte s'écarte d'elle-même, comme sous le bouton Écarter
function useRegle(rapport, g, demo) {
  const parti = useRef(false);
  const fusionnee = rapport?.statut === "pret" && rapport.pr?.etat === "fusionnee";
  useEffect(() => {
    if (!fusionnee || demo || parti.current) return;
    parti.current = true;
    g.fait();
  }, [fusionnee, demo, g]);
}

const PastilleStatut = ({ statut }) =>
  statut ? (
    statut.lien ? (
      <a href={statut.lien} target="_blank" rel="noreferrer" className="pl-statut-lien">
        <Pill tone={statut.ton}>{statut.texte}</Pill>
      </a>
    ) : (
      <Pill tone={statut.ton}>{statut.texte}</Pill>
    )
  ) : null;

// Le bouton Rapport et le compte rendu de l'agent, dans l'ordre de ses quatre rubriques
function BoutonRapport({ ouvert, setOuvert }) {
  return (
    <button type="button" className="pl-btn is-agent" onClick={() => setOuvert(!ouvert)} aria-expanded={ouvert}>
      <PilotIcon name="audit" size={16} />
      Rapport
    </button>
  );
}

function Rapport({ rapport }) {
  return (
    <div className="pl-rapport">
      {rapport.texte
        .split(/\n{2,}/)
        .filter(Boolean)
        .map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      {rapport.session ? (
        <a href={rapport.session} target="_blank" rel="noreferrer">
          Voir la session
        </a>
      ) : null}
    </div>
  );
}

function EtatAgent({ agent, pret }) {
  if (!agent || pret) return null;
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
function CarteBug({ l, demo, rapport, relire, ...gestes }) {
  const g = useGestes(l, gestes);
  const [ouvert, setOuvert] = useState(false);
  const [rapportOuvert, setRapportOuvert] = useState(false);
  const { agent, lancer, envoi, pret } = useAgent(l, demo, rapport, relire);
  useRegle(rapport, g, demo);
  const statut = statutBug(rapport);
  return (
    <li className="pl-bug">
      <span className="pl-bug-ico">
        <PilotIcon name="bug" size={26} />
      </span>
      <div className="pl-bug-corps">
        <div className="pl-bug-tete">
          <strong>{l.titre}</strong>
          {statut ? <PastilleStatut statut={statut} /> : l.retard ? <Pill tone="warn">En retard</Pill> : null}
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
          {pret ? <BoutonRapport ouvert={rapportOuvert} setOuvert={setRapportOuvert} /> : null}
          <EtatAgent agent={agent} pret={pret} />
        </div>
        {pret && rapportOuvert ? <Rapport rapport={rapport} /> : null}
      </div>
      <span className="pl-ligne-a">
        <PlusTard g={g} />
        <button type="button" className="pl-btn" onClick={g.fait} disabled={g.busy} title="Réglé ou plus d'actualité : la carte quitte l'écran">
          Écarter
        </button>
      </span>
    </li>
  );
}


// Une alerte se traite ou s'écarte : Auditer et Réparer pour celles qui parlent de bugs, Écarter quand elle est déjà traitée
// ou n'est plus d'actualité (elle revient si son texte change)
function LigneAlerte({ l, demo, rapport, relire, ...gestes }) {
  const g = useGestes(l, gestes);
  const [rapportOuvert, setRapportOuvert] = useState(false);
  const { agent, lancer, envoi, pret } = useAgent(l, demo, rapport, relire);
  const bug = l.source === "alerte" && estAlerteBug(l.titre);
  useRegle(rapport, g, demo);
  const statut = pret ? statutBug(rapport) : null;
  return (
    <li className="pl-ligne pl-ligne-alerte">
      <span className="pl-ligne-t">
        <strong>{l.titre}</strong>
        {l.sous ? <small>{l.sous}</small> : null}
        <EtatAgent agent={agent} pret={pret} />
        <PastilleStatut statut={statut} />
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
            {pret ? <BoutonRapport ouvert={rapportOuvert} setOuvert={setRapportOuvert} /> : null}
          </>
        ) : null}
        <Ouvrir l={l} />
        {l.source !== "demande" ? (
          <button type="button" className="pl-btn is-primary" onClick={g.fait} disabled={g.busy} title="Déjà traitée ou plus à jour : elle revient si son texte change">
            Écarter
          </button>
        ) : null}
      </span>
      {pret && rapportOuvert ? <Rapport rapport={rapport} /> : null}
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

// Le fil du jour en deux blocs : les bugs, les alertes (tâches retirées le 21 novembre 2026)
function FilGroupe({ fil, gestes, demo }) {
  const { rapports, relire } = useRapports(demo);
  const du = (g) => fil.filter((l) => l.groupe === g);
  const bugs = du("bugs");
  const alertes = du("alertes");
  return (
    <div className="pl-fil">
      {bugs.length ? (
        <Section icone="bug" titre="Bugs" n={bugs.length}>
          <ul className="pl-bugs">
            {bugs.map((l) => (
              <CarteBug key={l.cle} l={l} demo={demo} rapport={rapports[l.cle]} relire={relire} {...gestes} />
            ))}
          </ul>
        </Section>
      ) : null}
      {alertes.length ? (
        <Section icone="alerte" titre="Alertes" n={alertes.length}>
          <ul className="pl-lignes">
            {alertes.map((l) => (
              <LigneAlerte key={l.cle} l={l} demo={demo} rapport={rapports[l.cle]} relire={relire} {...gestes} />
            ))}
          </ul>
        </Section>
      ) : null}
    </div>
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
  const [retires, setRetires] = useState([]);
  const items = liste.items;
  const fil = useMemo(() => buildFil({ items, demandes: data.demandes, sante, today }).filter((l) => !retires.includes(l.cle)), [items, data.demandes, sante, today, retires]);
  const retirer = useCallback((cle) => setRetires((r) => [...r, cle]), []);
  const mot = items.filter((i) => i.type === "mot" && i.statut === "a_faire").sort((a, b) => String(b.cree_le).localeCompare(String(a.cree_le)))[0];
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
      <div className="pl-jour">
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
      </div>
      <div className="pl-lectures">
        <BlocLecture titre="News of the Day" items={items} today={today} langue={langue} />
        <BlocLecture titre="Feature of the Day" items={items} today={today} langue={langue} />
      </div>
    </>
  );
}
