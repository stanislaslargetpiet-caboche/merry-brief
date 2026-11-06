"use client";

// Section « Réseau » du pilotage : les actions du jour, les noms à valider et le pipeline par piste.
// Les données viennent de /api/interne/pilotage (clé `reseau`) ; l'agent des créneaux écrit dans les mêmes tables.

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card, Fold, Folds, Pill, Ranked, Section, Table, Tile } from "@/components/pilotage/ui";
import { fmtDay, fmtInt } from "@/lib/server/pilotage/shape";
import { PISTES, STATUTS } from "@/lib/server/pilotage/reseau";

async function send(method, body, url = "/api/interne/pilotage/reseau") {
  const { data } = await supabase.auth.getSession();
  const res = await fetch(url, {
    method,
    headers: { authorization: `Bearer ${data?.session?.access_token || ""}`, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `erreur ${res.status}`);
}

function useAct(onChange) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const run = async (method, body, url) => {
    setBusy(true);
    setErr(null);
    try {
      await send(method, body, url);
      await onChange();
      return true;
    } catch (x) {
      setErr(x.message === "existe" ? "Ce contact existe déjà" : `Non enregistré : ${x.message}`);
      return false;
    } finally {
      setBusy(false);
    }
  };
  return { busy, err, run };
}

function Coordonnees({ c }) {
  return (
    <span className="pl-muted pl-reseau-liens">
      {c.linkedin ? (
        <a href={c.linkedin} target="_blank" rel="noreferrer">
          LinkedIn
        </a>
      ) : null}
      {c.email ? <a href={`mailto:${c.email}`}>{c.email}</a> : null}
    </span>
  );
}

const who = (c) => [c.nom, c.entreprise].filter(Boolean).join(" · ");

function Action({ c, demo, today, onChange }) {
  const { busy, err, run } = useAct(onChange);
  return (
    <div className="pl-health-item pl-demande">
      <Pill tone={c.date_action < today ? "warn" : "neutral"}>{c.date_action < today ? "En retard" : "Aujourd'hui"}</Pill>
      <div>
        <strong>{who(c)}</strong>
        <span className="pl-muted">{c.prochaine_action || "Action à préciser"}</span>
        {c.notes ? <span className="pl-muted">{c.notes}</span> : null}
        <Coordonnees c={c} />
        {demo ? null : (
          <span className="pl-demande-actions">
            <button type="button" className="pl-btn is-primary" onClick={() => run("PATCH", { id: c.id, action: "fait" })} disabled={busy}>
              Fait
            </button>
            <button type="button" className="pl-btn" onClick={() => run("PATCH", { id: c.id, action: "reporter" })} disabled={busy}>
              Reporter
            </button>
            {err ? <span className="pl-form-err">{err}</span> : null}
          </span>
        )}
      </div>
    </div>
  );
}

const PLAN_URL = "/api/interne/pilotage/reseau/plan";

function PlanLigne({ l, demo, onChange }) {
  const { busy, err, run } = useAct(onChange);
  const [texte, setTexte] = useState(l.message);
  const [copie, setCopie] = useState(false);
  const titre = l.nom ? who(l) : l.titre;
  const lien = l.lien_envoi || l.linkedin;
  const ouvert = l.statut === "a_faire";
  const copier = async () => {
    await navigator.clipboard.writeText(texte);
    setCopie(true);
    setTimeout(() => setCopie(false), 1500);
  };
  const enregistrer = () => {
    if (texte !== l.message) run("PATCH", { id: l.id, action: "texte", message: texte }, PLAN_URL);
  };
  if (!ouvert) {
    return (
      <div className="pl-health-item">
        <Pill tone={l.statut === "fait" ? "ok" : "neutral"}>{l.statut === "fait" ? "Fait" : "Reporté"}</Pill>
        <div>
          <strong>{titre}</strong>
        </div>
      </div>
    );
  }
  return (
    <div className="pl-health-item pl-demande pl-reseau-ligne">
      <Pill tone="neutral">À faire</Pill>
      <div>
        <strong>{titre}</strong>
        {l.raison ? <span className="pl-muted">{l.raison}</span> : null}
        {l.dernier_message ? <blockquote className="pl-reseau-recu">{l.dernier_message}</blockquote> : null}
        {l.message ? <textarea className="pl-reseau-message" aria-label={`Message pour ${titre}`} value={texte} rows={5} maxLength={4000} readOnly={demo} onChange={(e) => setTexte(e.target.value)} onBlur={enregistrer} /> : null}
        <span className="pl-demande-actions">
          {l.message ? (
            <button type="button" className="pl-btn" onClick={copier}>
              {copie ? "Copié" : "Copier"}
            </button>
          ) : null}
          {lien ? (
            <a className="pl-btn" href={lien} target="_blank" rel="noreferrer">
              {lien.includes("mail.google.com") ? "Ouvrir le brouillon" : "Ouvrir LinkedIn"}
            </a>
          ) : null}
          {demo ? null : (
            <>
              <button type="button" className="pl-btn is-primary" onClick={() => run("PATCH", { id: l.id, action: "fait" }, PLAN_URL)} disabled={busy}>
                Fait
              </button>
              <button type="button" className="pl-btn" onClick={() => run("PATCH", { id: l.id, action: "reporter" }, PLAN_URL)} disabled={busy}>
                Reporter
              </button>
            </>
          )}
          {err ? <span className="pl-form-err">{err}</span> : null}
        </span>
      </div>
    </div>
  );
}

function Plan({ plan, raison, demo, onChange }) {
  if (!plan) {
    return (
      <div className="pl-health-item">
        <Pill tone="neutral">Info</Pill>
        <div>
          <strong>Pas de plan préparé</strong>
          {raison ? <span className="pl-muted">{raison}</span> : null}
        </div>
      </div>
    );
  }
  return (
    <>
      {plan.creneaux.map((x) => (
        <div className="pl-reseau-creneau" key={x.id}>
          <h3>
            {x.label} <span className="pl-muted">{fmtDay(plan.jour)}</span>
          </h3>
          {x.lignes.map((l) => (
            <PlanLigne key={l.id} l={l} demo={demo} onChange={onChange} />
          ))}
        </div>
      ))}
    </>
  );
}

function AValider({ c, demo, onChange }) {
  const { busy, err, run } = useAct(onChange);
  return (
    <div className="pl-health-item pl-demande">
      <Pill tone="neutral">À valider</Pill>
      <div>
        <strong>
          {who(c)}
          {c.role ? ` · ${c.role}` : ""}
        </strong>
        {c.notes ? <span className="pl-muted">{c.notes}</span> : null}
        <Coordonnees c={c} />
        {demo ? null : (
          <span className="pl-demande-actions">
            <button type="button" className="pl-btn is-primary" onClick={() => run("PATCH", { id: c.id, action: "valider" })} disabled={busy}>
              Valider
            </button>
            <button type="button" className="pl-btn" onClick={() => run("PATCH", { id: c.id, action: "ecarter" })} disabled={busy}>
              Écarter
            </button>
            {err ? <span className="pl-form-err">{err}</span> : null}
          </span>
        )}
      </div>
    </div>
  );
}

function StatutSelect({ c, demo, onChange }) {
  const { busy, err, run } = useAct(onChange);
  return (
    <>
      <select className="pl-reseau-statut" aria-label={`Statut de ${c.nom}`} value={c.statut} disabled={busy || demo} onChange={(e) => run("PATCH", { id: c.id, action: "statut", statut: e.target.value })}>
        {STATUTS.map((s) => (
          <option key={s.id} value={s.id}>
            {s.label}
          </option>
        ))}
      </select>
      {err ? <span className="pl-form-err">{err}</span> : null}
    </>
  );
}

function Ajouter({ onChange }) {
  const { busy, err, run } = useAct(onChange);
  const [form, setForm] = useState({ nom: "", entreprise: "", piste: "marketplace" });
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault();
    if (await run("POST", form)) setForm({ ...form, nom: "", entreprise: "" });
  };
  return (
    <form className="pl-form pl-reseau-ajout" onSubmit={submit}>
      <label>
        Nom
        <input value={form.nom} onChange={set("nom")} required maxLength={120} />
      </label>
      <label>
        Entreprise
        <input value={form.entreprise} onChange={set("entreprise")} maxLength={120} />
      </label>
      <label>
        Piste
        <select value={form.piste} onChange={set("piste")}>
          {PISTES.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
      </label>
      <button type="submit" className="pl-btn" disabled={busy}>
        Ajouter
      </button>
      {err ? <span className="pl-form-err">{err}</span> : null}
    </form>
  );
}

const NON_LU = ["plan", "noms", "pipeline"];

export default function Reseau({ reseau, demo, onChange }) {
  if (!reseau?.disponible) {
    return NON_LU.map((id) => (
      <Section key={id} id={id}>
        <div className="pl-health-item">
          <Pill tone="neutral">Info</Pill>
          <div>
            <strong>Réseau non lu</strong>
            <span className="pl-muted">{reseau?.raison || "la lecture a échoué : voir les erreurs en bas de la page Santé"}</span>
          </div>
        </div>
      </Section>
    ));
  }
  const cols = [
    { key: "nom", label: "Contact", render: (c) => who(c) },
    { key: "statut", label: "Statut", render: (c) => <StatutSelect c={c} demo={demo} onChange={onChange} /> },
    { key: "action", label: "Prochaine action", render: (c) => c.prochaine_action || "–" },
    { key: "date", label: "Date", render: (c) => (c.date_action ? fmtDay(c.date_action) : "–") },
    { key: "dernier", label: "Dernier contact", render: (c) => (c.dernier_contact ? fmtDay(c.dernier_contact) : "–") },
  ];
  return (
    <>
      <Section id="plan">
        <div className="pl-reseau-liste">
          <Plan plan={reseau.plan} raison={reseau.plan_raison} demo={demo} onChange={onChange} />
          {reseau.a_faire.map((c) => (
            <Action key={c.id} c={c} demo={demo} today={reseau.jour} onChange={onChange} />
          ))}
        </div>
      </Section>
      <Section id="noms">
        <div className="pl-reseau-liste">
          {reseau.a_valider.length ? reseau.a_valider.map((c) => <AValider key={c.id} c={c} demo={demo} onChange={onChange} />) : <div className="pl-empty">Aucun nom à valider</div>}
        </div>
      </Section>
      <Section id="pipeline">
        <div className="pl-tiles">
          <Tile label="Nouveaux contacts, 7 jours" value={reseau.semaine.nouveaux} />
          <Tile label="Réponses, 7 jours" value={reseau.semaine.reponses} />
          <Tile label="Rendez-vous" value={reseau.semaine.rdv} />
          <Tile label="Contacts suivis" value={reseau.total} />
        </div>
        <Card title="Contacts par étape">
          <Ranked rows={reseau.pistes.map((p) => ({ label: p.label, n: p.contacts.length }))} max={20} empty="Aucun contact" />
        </Card>
        <Folds>
          {reseau.pistes.map((p) => (
            <Fold key={p.id} title={p.label} icon="invites" value={fmtInt(p.contacts.length)}>
              <Table cols={cols} rows={p.contacts} max={200} />
            </Fold>
          ))}
          <Fold title="Derniers échanges" icon="messagerie">
            <Table
              cols={[
                { key: "jour", label: "Jour", render: (e) => fmtDay(e.jour) },
                { key: "nom", label: "Contact" },
                { key: "sens", label: "Sens", render: (e) => ({ entrant: "Reçu", sortant: "Envoyé", note: "Note" })[e.sens] },
                { key: "resume", label: "Résumé", render: (e) => e.resume || "–" },
              ]}
              rows={reseau.derniers}
              empty="Aucun échange"
            />
          </Fold>
          {demo ? null : (
            <Fold title="Ajouter un contact" icon="ajouter">
              <Ajouter onChange={onChange} />
            </Fold>
          )}
        </Folds>
      </Section>
    </>
  );
}
