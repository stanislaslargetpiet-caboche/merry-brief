"use client";

// Page « Prestataires › Funnel » du pilotage : l'entonnoir des fiches revendiquées (lib/pilotage/funnelPros.js), puis
// une fiche par ligne, comme Couples › Funnel : son étape (date de revendication sous le nom), sa dernière visite et son dernier replay PostHog, ce qu'elle
// a rempli (photos, formules, dates), ce qu'elle a reçu et fait (vues, demandes, réponses, réservations), ses crédits
// et ce qui demande un coup d'œil. Un clic sur une étape ne garde que les fiches arrêtées là ; la flèche après le nom
// déroule les comptes de la fiche. Données : clé `utilisateurs.prestataires` de /api/interne/pilotage.

import { useMemo, useState } from "react";
import { Card, Funnel, Pill, Section, Table } from "@/components/pilotage/ui";
import { fmtDay, replayCell, visiteCell, visiteTs } from "@/components/pilotage/Utilisateurs";
import { ETAPES_PRO, buildFunnelPros } from "@/lib/pilotage/funnelPros";
import { fmtInt } from "@/lib/server/pilotage/shape";

const muted = (text) => <span className="pl-muted">{text}</span>;
const num = (n) => (n ? fmtInt(n) : muted("0"));

function Fleche({ ouvert, nom, onClick }) {
  return (
    <button type="button" className="pl-fleche" aria-expanded={ouvert} aria-label={`Comptes de ${nom}`} onClick={onClick}>
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M4 6l4 4 4-4" />
      </svg>
    </button>
  );
}

function ficheCell(r, fleche) {
  return (
    <>
      <strong>{r.nom}</strong>
      {fleche}
      <span className="pl-cell-sub">
        {r.test ? (
          <span title="Fiche de test : en bas de la liste, hors des comptes">
            <Pill>test</Pill>
          </span>
        ) : (
          [r.metier, r.ville, r.revendiquee ? `depuis le ${fmtDay(r.revendiquee)}` : null].filter(Boolean).join(" · ") || "–"
        )}
      </span>
    </>
  );
}

function comptes(r) {
  return (
    <span className="pl-inscrits">
      {r.comptes.length ? r.comptes.map((c) => <span key={c.id}>{[c.email || "sans adresse", c.role].filter(Boolean).join(" · ")}</span>) : muted("Aucun compte rattaché")}
    </span>
  );
}

const stadeCell = (r) => (
  <span title={ETAPES_PRO[r.stade].detail}>
    <Pill>{ETAPES_PRO[r.stade].pastille}</Pill>
  </span>
);

function signauxCell(r) {
  if (!r.signaux.length) return muted("–");
  return (
    <span className="pl-people pl-signaux">
      {r.signaux.map((s) => (
        <span key={s.id} title={s.title}>
          <Pill tone={s.tone}>{s.label}</Pill>
        </span>
      ))}
    </span>
  );
}

const photosCell = (r) => (r.photos ? <span title={`${fmtInt(r.photos_pro)} ajoutée(s) par le prestataire`}>{fmtInt(r.photos)}</span> : muted("0"));

const creditsCell = (r) =>
  r.credits == null ? (
    muted("–")
  ) : (
    <span title={`${fmtInt(r.credits_depenses)} crédit(s) dépensé(s)`}>
      {fmtInt(r.credits)}
      {r.credits_depenses ? <span className="pl-muted"> · −{fmtInt(r.credits_depenses)}</span> : null}
    </span>
  );

export default function PrestatairesFunnel({ data }) {
  const [choix, setChoix] = useState(null);
  const [deplies, setDeplies] = useState(() => new Set());
  const liste = data?.prestataires;
  const { etapes, lignes } = useMemo(() => buildFunnelPros(liste || []), [liste]);

  if (!liste) {
    return (
      <Section id="funnel-pros">
        <div className="pl-empty">{data?.prestataires_erreur ? `Fiches prestataires non lues : ${data.prestataires_erreur}` : "Utilisateurs non lus : voir la page Santé."}</div>
      </Section>
    );
  }
  const deplier = (id) =>
    setDeplies((d) => {
      const n = new Set(d);
      if (!n.delete(id)) n.add(id);
      return n;
    });
  const rows = choix === null ? lignes : lignes.filter((p) => p.stade === choix);
  const titre = choix === null ? `${fmtInt(etapes[0].n)} fiches revendiquées` : `Arrêtées à « ${etapes[choix].label} » : ${fmtInt(etapes[choix].ici)}`;
  return (
    <Section id="funnel-pros">
      <Card>
        <Funnel steps={etapes} selected={choix} onSelect={(i) => setChoix(choix === i ? null : i)} empty="Aucune fiche revendiquée" />
      </Card>
      <Card>
        <div className="pl-funnel-head">
          <h3>{titre}</h3>
          {choix !== null ? (
            <button type="button" className="pl-chip" onClick={() => setChoix(null)}>
              Tout voir
            </button>
          ) : null}
        </div>
        <div className="pl-funnel-table is-pros">
          <Table
            cols={[
              { key: "nom", label: "Prestataire", render: (r) => ficheCell(r, <Fleche ouvert={deplies.has(r.id)} nom={r.nom} onClick={() => deplier(r.id)} />), sort: (r) => r.nom },
              { key: "stade", label: "Étape", render: stadeCell, sort: (r) => r.stade },
              { key: "visite", group: "Dernière visite", label: "Visite", render: visiteCell, sort: visiteTs },
              { key: "replay", group: "Dernière visite", label: "PostHog", render: (r) => (r.comptes.length ? replayCell(r) : muted("–")), sort: (r) => (r.replay ? Date.parse(r.replay.debut) : null) },
              { key: "photos", group: "Fiche", label: "Photos", num: true, render: photosCell, sort: (r) => r.photos },
              { key: "formules", group: "Fiche", label: "Formules", num: true, render: (r) => num(r.formules), sort: (r) => r.formules },
              { key: "dates", group: "Fiche", label: "Dates", num: true, render: (r) => num(r.dates), sort: (r) => r.dates },
              { key: "vues", group: "Couples", label: "Vues", num: true, render: (r) => num(r.vues), sort: (r) => r.vues },
              { key: "demandes", group: "Couples", label: "Demandes", num: true, render: (r) => num(r.demandes), sort: (r) => r.demandes },
              { key: "reponses", group: "Couples", label: "Réponses", num: true, render: (r) => num(r.reponses), sort: (r) => r.reponses },
              { key: "reservations", group: "Couples", label: "Réservés", num: true, render: (r) => num(r.reservations), sort: (r) => r.reservations },
              { key: "credits", label: "Crédits", num: true, render: creditsCell, sort: (r) => r.credits },
              { key: "signaux", label: "À regarder", render: signauxCell, sort: (r) => r.signaux.length },
            ]}
            rows={rows}
            rowClass={(r) => (r.test ? "is-test" : null)}
            detail={(r) => (deplies.has(r.id) ? comptes(r) : null)}
            pinLast={(r) => r.test}
            max={300}
            empty="Aucune fiche à cette étape"
          />
        </div>
      </Card>
    </Section>
  );
}
