"use client";

// Page « Couples › Par couple » du pilotage : un seul tableau, un mariage par ligne, le plus récemment connecté
// d'abord (site, invités, formulaire, devis, couleur, replay). Les données viennent de /api/interne/pilotage (clé
// `utilisateurs`).

import { useMemo } from "react";
import { Card, Pill, Section, Table } from "@/components/pilotage/ui";
import { fmtAgo, fmtDateTime, fmtInt } from "@/lib/server/pilotage/shape";

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

const sitePill = (site) => (site === "publié" ? <Pill tone="ok">Site publié</Pill> : site === "brouillon" ? <Pill tone="warn">Site brouillon</Pill> : <span className="pl-muted">aucun</span>);

export default function Utilisateurs({ data }) {
  const parEmail = useMemo(() => new Map((data?.utilisateurs || []).map((u) => [u.email, u])), [data]);
  if (!data) {
    return (
      <Section id="comptes">
        <div className="pl-empty">Utilisateurs non lus : voir la page Santé.</div>
      </Section>
    );
  }
  // Couleur et replay : ceux du premier compte du mariage
  const compte = (r) => parEmail.get(r.emails[0]);
  return (
    <Section id="comptes">
      <Card>
        <Table
          cols={[
            { key: "couple", label: "Couple", render: (r) => <strong>{r.couple}</strong> },
            { key: "emails", label: "Compte", render: (r) => r.emails.join(", ") || "–" },
            { key: "derniere_connexion", label: "Dernière connexion", render: (r) => (r.derniere_connexion ? <span title={fmtDateTime(r.derniere_connexion)}>{fmtAgo(r.derniere_connexion)}</span> : <span className="pl-muted">jamais</span>) },
            { key: "site", label: "Site", render: (r) => sitePill(r.site) },
            { key: "invites", label: "Invités", num: true, render: (r) => (r.invites ? fmtInt(r.invites) : <span className="pl-muted">0</span>) },
            { key: "formulaire", label: "Formulaire", render: (r) => (r.formulaire ? `${r.formulaire}${r.reponses_formulaire ? ` · ${fmtInt(r.reponses_formulaire)} réponse(s)` : ""}` : <span className="pl-muted">aucun</span>) },
            { key: "devis", label: "Devis", num: true, render: (r) => fmtInt(r.devis) },
            { key: "couleur", label: "Couleur", render: (r) => compte(r)?.couleur || <span className="pl-muted">pas choisi</span> },
            { key: "replay", label: "Replay", render: (r) => (compte(r) ? posthogCell(compte(r)) : "–") },
          ]}
          rows={data.mariages}
          max={300}
          empty="Aucun mariage"
        />
      </Card>
    </Section>
  );
}
