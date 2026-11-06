"use client";

// Section « Utilisateurs » du pilotage : qui s'est connecté récemment, et où en est chaque couple (site créé,
// invités saisis, formulaire, devis). Les données viennent de /api/interne/pilotage (clé `utilisateurs`), lues sur
// la fenêtre exacte choisie (1 h comprise).

import { useMemo, useState } from "react";
import { Card, Pill, Section, Table, Tile } from "@/components/pilotage/ui";
import { fmtAgo, fmtDateTime, fmtInt } from "@/lib/server/pilotage/shape";

const FILTERS = [
  { id: "tous", label: "Tous", test: () => true },
  { id: "site", label: "Ont un site", test: (m) => Boolean(m.site) },
  { id: "sans-site", label: "Sans site", test: (m) => !m.site },
  { id: "invites", label: "Au moins un invité", test: (m) => m.invites > 0 },
  { id: "sans-invite", label: "Aucun invité", test: (m) => m.invites === 0 },
  { id: "devis", label: "Ont demandé un devis", test: (m) => m.devis > 0 },
];

// Fiche PostHog de la personne, ouverte sur l'onglet des replays. Le distinct_id est l'id Supabase (posthog.identify
// dans lib/analytics.js) ; le projet est celui de lib/server/pilotage/posthog.js. Seules les personnes qui ont accepté
// les cookies ont des sessions.
const posthogPersonUrl = (id) => `https://eu.posthog.com/project/321035/person/${encodeURIComponent(id)}#activeTab=sessionRecordings`;

// `posthog_dernier` : dernier événement reçu pour cette personne (undefined si PostHog n'a pas été lu, null si aucun)
const NO_CONSENT_DAYS = 3;
const posthogCell = (r) => {
  const link = (text) => <a className="pl-link" href={posthogPersonUrl(r.id)} target="_blank" rel="noopener noreferrer">{text}</a>;
  if (r.posthog_dernier === undefined) return link("PostHog");
  const last = Date.parse(r.posthog_dernier);
  const lastLogin = r.derniere_connexion ? Date.parse(r.derniere_connexion) : 0;
  if (!last) return <span className="pl-muted" title="Aucun événement PostHog en 90 jours : cookies refusés, jamais acceptés, ou PostHog bloqué par le navigateur.">Aucun consentement</span>;
  // Connecté après le dernier événement reçu (marge de 3 jours) : il utilise l'appli mais PostHog ne voit plus rien
  if (lastLogin - last > NO_CONSENT_DAYS * 86400000) {
    return <span className="pl-muted" title={`Dernier événement PostHog : ${fmtDateTime(r.posthog_dernier)}. Il s'est connecté depuis : probablement plus de consentement aux cookies (ou PostHog bloqué).`}>Aucun consentement depuis le {new Date(r.posthog_dernier).toLocaleDateString("fr-FR", { day: "numeric", month: "long", timeZone: "Europe/Paris" })} · {link("ancien replay")}</span>;
  }
  return link("PostHog");
};

const sitePill =(site) => (site === "publié" ? <Pill tone="ok">Site publié</Pill> : site === "brouillon" ? <Pill tone="warn">Site brouillon</Pill> : <span className="pl-muted">aucun</span>);

// Noms derrière les tuiles : un seul bouton déroulant, une liste par tuile (période courante)
const DETAIL_LISTS = [
  { key: "connectes", title: "Connectés", line: (x) => x.email, more: (x) => [x.couple, fmtAgo(x.at)] },
  { key: "comptes", title: "Nouveaux comptes", line: (x) => x.email, more: (x) => [x.couple || "sans mariage", fmtAgo(x.at)] },
  { key: "mariages", title: "Mariages créés", line: (x) => x.couple, more: (x) => [x.email, fmtAgo(x.at)] },
  { key: "sites", title: "Sites créés", line: (x) => x.couple, more: (x) => [x.email, fmtAgo(x.at)] },
  { key: "invites", title: "Invités ajoutés", line: (x) => x.couple, more: (x) => [x.email, `${fmtInt(x.n)} invité${x.n > 1 ? "s" : ""}`] },
  { key: "devis", title: "Demandes de devis", line: (x) => x.couple, more: (x) => [x.email, `${fmtInt(x.n)} demande${x.n > 1 ? "s" : ""}`] },
];

function Qui({ detail }) {
  const [open, setOpen] = useState(false);
  if (!detail) return null;
  return (
    <div className="pl-qui">
      <button type="button" className="pl-chip" aria-expanded={open} onClick={() => setOpen(!open)}>
        {open ? "Masquer les noms" : "Voir les noms"}
      </button>
      {open ? (
        <div className="pl-grid">
          {DETAIL_LISTS.map((l) => {
            const rows = detail[l.key] || [];
            return (
              <Card key={l.key} title={`${l.title} (${rows.length})`} fold={rows.length ? undefined : "closed"}>
                {rows.length ? (
                  <ul className="pl-qui-list">
                    {rows.map((x, i) => (
                      <li key={i}>
                        <strong>{l.line(x)}</strong> <span className="pl-muted">{l.more(x).filter(Boolean).join(" · ")}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="pl-empty">Personne sur la période</div>
                )}
              </Card>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export default function Utilisateurs({ data }) {
  const [filter, setFilter] = useState("tous");
  const rows = useMemo(() => (data?.mariages || []).filter((FILTERS.find((f) => f.id === filter) || FILTERS[0]).test), [data, filter]);
  if (!data) {
    return (
      <Section id="comptes">
        <div className="pl-empty">Utilisateurs non lus : voir la page Santé.</div>
      </Section>
    );
  }
  const f = data.fenetre || {};
  const t = data.totaux || {};
  return (
    <Section id="comptes">
      <div className="pl-tiles">
        <Tile label="Connectés" value={f.connectes?.n} prev={f.connectes?.prec} hint="Comptes dont la dernière connexion tombe dans la période (Supabase Auth)" />
        <Tile label="Nouveaux comptes" value={f.comptes_crees?.n} prev={f.comptes_crees?.prec} sub={`${fmtInt(t.comptes)} au total`} />
        <Tile label="Mariages créés" value={f.mariages_crees?.n} prev={f.mariages_crees?.prec} sub={`${fmtInt(t.mariages)} au total`} />
        <Tile label="Sites créés" value={f.sites_crees?.n} prev={f.sites_crees?.prec} sub={`${fmtInt(t.avec_site)} mariage(s) en ont un, ${fmtInt(t.avec_site_publie)} publié(s)`} />
        <Tile label="Invités ajoutés" value={f.invites_ajoutes?.n} prev={f.invites_ajoutes?.prec} sub={`${fmtInt(t.avec_invites)} mariage(s) en ont au moins un`} />
        <Tile label="Demandes de devis" value={f.devis?.n} prev={f.devis?.prec} sub={`${fmtInt(t.avec_devis)} mariage(s) en ont fait`} />
      </div>
      <Qui detail={data.detail} />
      <div className="pl-grid">
        <Card fold="open" full title="Derniers utilisateurs connectés" note="Supabase date la dernière connexion (mot de passe ou lien), pas chaque ouverture de l'appli avec une session déjà ouverte : un couple qui reste connecté peut y paraître moins récent qu'il ne l'est.">
          <Table
            cols={[
              { key: "email", label: "Utilisateur", render: (r) => <strong>{r.email}</strong> },
              { key: "couple", label: "Couple", render: (r) => r.couple || <span className="pl-muted">sans mariage</span> },
              { key: "derniere_connexion", label: "Dernière connexion", render: (r) => (r.derniere_connexion ? <span title={fmtDateTime(r.derniere_connexion)}>{fmtAgo(r.derniere_connexion)}</span> : <span className="pl-muted">jamais</span>) },
              { key: "site", label: "Site", render: (r) => sitePill(r.site) },
              { key: "invites", label: "Invités", num: true, render: (r) => (r.invites === null ? "–" : fmtInt(r.invites)) },
              { key: "devis", label: "Devis", num: true, render: (r) => (r.devis === null ? "–" : fmtInt(r.devis)) },
              { key: "sessions", label: "Sessions", render: posthogCell },
            ]}
            rows={data.utilisateurs}
            max={12}
            empty="Aucun compte"
          />
        </Card>
        <Card fold="open" full title="Où en sont les couples">
          <div className="pl-filters" role="group" aria-label="Filtrer les mariages">
            {FILTERS.map((x) => (
              <button key={x.id} type="button" aria-pressed={filter === x.id} className={`pl-chip${filter === x.id ? " is-on" : ""}`} onClick={() => setFilter(x.id)}>
                {x.label}
              </button>
            ))}
          </div>
          <p className="pl-note" style={{ margin: "0 0 10px" }}>
            {fmtInt(rows.length)} mariage(s) sur {fmtInt(data.mariages?.length || 0)}.
          </p>
          <Table
            cols={[
              { key: "couple", label: "Couple", render: (r) => <strong>{r.couple}</strong> },
              { key: "emails", label: "Compte", render: (r) => r.emails.join(", ") || "–" },
              { key: "site", label: "Site", render: (r) => sitePill(r.site) },
              { key: "invites", label: "Invités", num: true, render: (r) => (r.invites ? fmtInt(r.invites) : <span className="pl-muted">0</span>) },
              { key: "formulaire", label: "Formulaire", render: (r) => (r.formulaire ? `${r.formulaire}${r.reponses_formulaire ? ` · ${fmtInt(r.reponses_formulaire)} réponse(s)` : ""}` : <span className="pl-muted">aucun</span>) },
              { key: "taches", label: "Tâches faites", num: true, render: (r) => (r.taches ? `${fmtInt(r.taches_faites)} / ${fmtInt(r.taches)}` : "–") },
              { key: "devis", label: "Devis", num: true, render: (r) => fmtInt(r.devis) },
              { key: "derniere_connexion", label: "Dernière connexion", render: (r) => fmtAgo(r.derniere_connexion) },
            ]}
            rows={rows}
            max={40}
            empty="Aucun mariage dans ce filtre"
          />
        </Card>
        <Card fold="closed" full title="Derniers comptes créés">
          <Table
            cols={[
              { key: "email", label: "Adresse" },
              { key: "couple", label: "Couple", render: (r) => r.couple || <span className="pl-muted">sans mariage</span> },
              { key: "cree", label: "Créé", render: (r) => fmtDateTime(r.cree) },
              { key: "derniere_connexion", label: "Dernière connexion", render: (r) => fmtAgo(r.derniere_connexion) },
            ]}
            rows={[...(data.utilisateurs || [])].sort((a, b) => Date.parse(b.cree) - Date.parse(a.cree))}
            max={12}
          />
        </Card>
      </div>
    </Section>
  );
}
