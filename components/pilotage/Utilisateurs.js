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

const sitePill = (site) => (site === "publié" ? <Pill tone="ok">Site publié</Pill> : site === "brouillon" ? <Pill tone="warn">Site brouillon</Pill> : <span className="pl-muted">aucun</span>);

export default function Utilisateurs({ data, label }) {
  const [filter, setFilter] = useState("tous");
  const rows = useMemo(() => (data?.mariages || []).filter((FILTERS.find((f) => f.id === filter) || FILTERS[0]).test), [data, filter]);
  if (!data) {
    return (
      <Section id="utilisateurs" title="Utilisateurs" kicker={`En direct · ${label}`}>
        <div className="pl-empty">Utilisateurs non lus : voir la section Santé.</div>
      </Section>
    );
  }
  const f = data.fenetre || {};
  const t = data.totaux || {};
  const summary = [
    { label: "connectés", value: fmtInt(f.connectes?.n || 0) },
    { label: "nouveaux comptes", value: fmtInt(f.comptes_crees?.n || 0) },
  ];
  return (
    <Section id="utilisateurs" title="Utilisateurs" kicker={`En direct · ${label}`} summary={summary}>
      <div className="pl-tiles">
        <Tile label="Connectés" value={f.connectes?.n} prev={f.connectes?.prec} hint="Comptes dont la dernière connexion tombe dans la période (Supabase Auth)" />
        <Tile label="Nouveaux comptes" value={f.comptes_crees?.n} prev={f.comptes_crees?.prec} sub={`${fmtInt(t.comptes)} au total`} />
        <Tile label="Mariages créés" value={f.mariages_crees?.n} prev={f.mariages_crees?.prec} sub={`${fmtInt(t.mariages)} au total`} />
        <Tile label="Sites créés" value={f.sites_crees?.n} prev={f.sites_crees?.prec} sub={`${fmtInt(t.avec_site)} mariage(s) en ont un, ${fmtInt(t.avec_site_publie)} publié(s)`} />
        <Tile label="Invités ajoutés" value={f.invites_ajoutes?.n} prev={f.invites_ajoutes?.prec} sub={`${fmtInt(t.avec_invites)} mariage(s) en ont au moins un`} />
        <Tile label="Demandes de devis" value={f.devis?.n} prev={f.devis?.prec} sub={`${fmtInt(t.avec_devis)} mariage(s) en ont fait`} />
      </div>
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
