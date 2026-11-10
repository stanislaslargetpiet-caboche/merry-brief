"use client";

// Page « Couples › Par couple » du pilotage : un seul tableau, un mariage par ligne, le plus récemment venu d'abord,
// les couples de test en bas, en gris.
// Pour chaque couple : ses comptes, sa dernière visite et le replay PostHog de sa dernière session enregistrée, puis
// ce qu'il a fait dans l'appli (site, invités, formulaire, tâches, budget, devis) et sa couleur. Les données viennent
// de /api/interne/pilotage (clé `utilisateurs`), croisées avec PostHog par withPostHog.

import { Card, Pill, Section, Table } from "@/components/pilotage/ui";
import { ACCENTS } from "@/lib/dash/accent";
import { PASTELS } from "@/lib/dash/theme";
import { fmtAgo, fmtDateTime, fmtInt, replayUrl } from "@/lib/server/pilotage/shape";

// Fiche PostHog de la personne, ouverte sur l'onglet des replays. Le distinct_id est l'id Supabase (posthog.identify
// dans lib/analytics.js) ; le projet est celui de lib/server/pilotage/posthog.js.
const posthogPersonUrl = (id) => `https://eu.posthog.com/project/321035/person/${encodeURIComponent(id)}#activeTab=sessionRecordings`;

const DAY = 86400000;
const ts = (iso) => (iso ? Date.parse(iso) : 0);
const handle = (email) => (email ? email.split("@")[0] : "sans adresse");
const fmtDay = (iso) => new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short", timeZone: "Europe/Paris" });
const fmtWedding = (date) => new Date(`${date}T12:00:00Z`).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Paris" });
const fmtActive = (s) => (s < 60 ? `${s} s` : `${Math.round(s / 60)} min`);
const muted = (text) => <span className="pl-muted">{text}</span>;
const num = (n) => (n ? fmtInt(n) : muted("0"));

const PillLink = ({ tone, href, title, children }) => (
  <a className={`pl-pill is-${tone} is-link`} href={href} title={title} target="_blank" rel="noopener noreferrer">
    {children}
  </a>
);

// La personne venue en dernier, en pastel (lib/dash/theme.js) ; les autres comptes au survol de « +N »
const venu = (c) => `${c.email || "sans adresse"} · ${c.derniere_visite ? `venu ${fmtAgo(c.derniere_visite)}` : "jamais venu"}`;
function comptesCell(r) {
  const comptes = r.comptes || r.emails.map((email) => ({ email }));
  if (!comptes.length) return muted("aucun");
  const [first, ...autres] = comptes;
  return (
    <span className="pl-people">
      <span className="pl-person" style={{ background: PASTELS.lavande.bg, color: PASTELS.lavande.ink }} title={venu(first)}>
        {handle(first.email)}
      </span>
      {autres.length ? (
        <span title={autres.map(venu).join("\n")}>
          <Pill>{`+${autres.length}`}</Pill>
        </span>
      ) : null}
    </span>
  );
}

// Couleur de la pastille selon l'ancienneté de la dernière visite
const recence = (iso) => {
  const age = Date.now() - ts(iso);
  return age <= DAY ? "ok" : age <= 7 * DAY ? "lime" : age <= 30 * DAY ? "warn" : "bad";
};
function visiteCell(r) {
  const at = r.derniere_visite === undefined ? r.derniere_connexion : r.derniere_visite;
  if (!at) return <Pill>jamais</Pill>;
  const detail = [`Dernière visite : ${fmtDateTime(at)}`, r.visite_par ? `par ${r.visite_par}` : null, r.derniere_connexion ? `Dernière connexion (mot de passe ou lien) : ${fmtDateTime(r.derniere_connexion)}` : null];
  return (
    <span title={detail.filter(Boolean).join("\n")}>
      <Pill tone={recence(at)}>{fmtAgo(at)}</Pill>
    </span>
  );
}

// Dernière session enregistrée par PostHog, tous comptes du couple confondus (withPostHog)
function replayCell(r) {
  const first = r.comptes?.[0];
  if (r.posthog === undefined) return first?.id ? <PillLink tone="neutral" href={posthogPersonUrl(first.id)} title="PostHog non lu : fiche de la personne">PostHog</PillLink> : "–";
  if (r.posthog === "jamais") return <span title="Aucun événement PostHog en 90 jours : cookies refusés ou jamais acceptés, ou PostHog bloqué par le navigateur."><Pill>sans cookies</Pill></span>;
  if (r.posthog === "sans_replay") {
    return (
      <PillLink tone="neutral" href={posthogPersonUrl(first.id)} title={`PostHog voit des sessions (${fmtInt(r.sessions_7j)} sur 7 jours) mais aucune n'a été enregistrée. Ouvrir la fiche de ${first.email}.`}>
        pas de replay
      </PillLink>
    );
  }
  const x = r.replay;
  const detail = `Session de ${x.email} le ${fmtDateTime(x.debut)} : ${fmtActive(x.actif_s)} d'activité, ${fmtInt(x.clics)} clic(s)${x.erreurs ? `, ${fmtInt(x.erreurs)} erreur(s) de console` : ""}.`;
  if (r.posthog === "ancien") {
    return (
      <PillLink tone="warn" href={replayUrl(x.session)} title={`${detail}\nVisites plus récentes sans enregistrement : plus d'accord aux cookies, ou PostHog bloqué.`}>
        ▶ {fmtDay(x.debut)}
      </PillLink>
    );
  }
  return (
    <PillLink tone={x.erreurs ? "bad" : "lime"} href={replayUrl(x.session)} title={`${detail}\nOuvrir le replay dans PostHog.`}>
      ▶ {fmtActive(x.actif_s)}
      {x.erreurs ? ` · ${fmtInt(x.erreurs)} err.` : ""}
    </PillLink>
  );
}

const statutCell = (statut, href, quoi) => {
  if (!statut) return muted("aucun");
  const label = statut === "publié" ? "Publié" : "Brouillon";
  const tone = statut === "publié" ? "ok" : "warn";
  return href ? <PillLink tone={tone} href={href} title={`Ouvrir ${quoi}`}>{label}</PillLink> : <Pill tone={tone}>{label}</Pill>;
};

function coupleCell(r) {
  const passe = r.date && ts(`${r.date}T23:59:59Z`) < Date.now();
  return (
    <>
      <strong>{r.couple}</strong>
      {r.test ? <span title="Compte de test : en bas de la liste, sans mail du samedi"> <Pill>test</Pill></span> : null}
      <span className="pl-cell-sub">{r.date ? `${fmtWedding(r.date)}${passe ? " · passé" : ""}` : "date à fixer"}</span>
    </>
  );
}

// Couleur de chaque compte (elle suit la personne, pas le couple), son nom au survol
function couleurCell(r) {
  const choisies = (r.comptes || []).filter((c) => c.accent);
  if (!choisies.length) return <span className="pl-muted" title="Pas choisi : citron par défaut">–</span>;
  const keys = [...new Set(choisies.map((c) => c.accent))];
  return (
    <span className="pl-swatches" title={choisies.map((c) => `${c.email} : ${ACCENTS.find((a) => a.key === c.accent)?.label || "ancienne couleur"}`).join("\n")}>
      {keys.map((k) => (
        <span key={k} className="pl-swatch" style={{ background: ACCENTS.find((a) => a.key === k)?.color || "var(--border-strong)" }} />
      ))}
    </span>
  );
}

export default function Utilisateurs({ data }) {
  if (!data) {
    return (
      <Section id="comptes">
        <div className="pl-empty">Utilisateurs non lus : voir la page Santé.</div>
      </Section>
    );
  }
  return (
    <Section id="comptes">
      <Card>
        <Table
          cols={[
            { key: "couple", label: "Couple", render: coupleCell },
            { key: "comptes", label: "Comptes", render: comptesCell },
            { key: "visite", group: "Dernière visite", label: "Quand", render: visiteCell },
            { key: "replay", group: "Dernière visite", label: "PostHog", render: replayCell },
            { key: "sessions", group: "Dernière visite", label: "Sessions 7 j", num: true, render: (r) => (r.sessions_7j === undefined ? "–" : num(r.sessions_7j)) },
            { key: "site", group: "Avancement", label: "Site", render: (r) => statutCell(r.site, r.site_slug ? `/s/${r.site_slug}` : null, "le site") },
            { key: "invites", group: "Avancement", label: "Invités", num: true, render: (r) => num(r.invites) },
            { key: "formulaire", group: "Avancement", label: "Formulaire", render: (r) => statutCell(r.formulaire, r.formulaire_slug ? `/f/${r.formulaire_slug}` : null, "le formulaire") },
            { key: "reponses", group: "Avancement", label: "Réponses", num: true, render: (r) => num(r.reponses_formulaire) },
            { key: "taches", group: "Avancement", label: "Tâches faites", num: true, render: (r) => (r.taches ? `${fmtInt(r.taches_faites)} / ${fmtInt(r.taches)}` : muted("0")) },
            { key: "budget", group: "Avancement", label: "Postes budget", num: true, render: (r) => num(r.budget) },
            { key: "devis", group: "Avancement", label: "Devis", num: true, render: (r) => (r.devis ? <Pill tone="lime">{fmtInt(r.devis)}</Pill> : muted("0")) },
            { key: "couleur", label: "Couleur", render: couleurCell },
          ]}
          rows={data.mariages}
          rowClass={(r) => (r.test ? "is-test" : null)}
          max={300}
          empty="Aucun mariage"
        />
      </Card>
    </Section>
  );
}
