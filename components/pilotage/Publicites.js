"use client";

// Page « Publicités » du pilotage : ce que les campagnes payantes amènent, du site à l'inscription, par variante
// (?source=meta-a…). Les passages viennent du compteur anonyme (lib/compteur.js, cookies acceptés ou non), les
// inscriptions des briefs. Clics, impressions et dépense restent dans Ads Manager.
import { Fold, Folds, Section, Table, Tile, TileChart } from "@/components/pilotage/ui";
import { avecInscriptions, ETAPES, isPub } from "@/lib/compteur";
import { fmtInt, pctOf } from "@/lib/server/pilotage/shape";

const somme = (rows, key) => rows.reduce((acc, r) => acc + (r[key] || 0), 0);

const COLS = [
  { key: "source", label: "Source", render: (r) => <strong>{r.source}</strong> },
  ...ETAPES.map((e) => ({ key: e.id, label: e.label, num: true })),
  { key: "inscriptions", label: "Inscriptions", num: true },
  { key: "conversion", label: "Taux", num: true, render: (r) => (r.site ? `${pctOf(r.inscriptions, r.site)} %` : "–") },
];

export default function Publicites({ entonnoir, sources }) {
  if (!entonnoir) {
    return (
      <Section id="publicites">
        <div className="pl-empty">PostHog n'est pas lisible : voir la page Santé.</div>
      </Section>
    );
  }
  const lignes = avecInscriptions(entonnoir, sources);
  const pubs = lignes.filter((r) => isPub(r.source)).sort((a, b) => a.source.localeCompare(b.source));
  const autres = lignes.filter((r) => !isPub(r.source));
  const site = somme(pubs, "site");
  const inscriptions = somme(pubs, "inscriptions");
  return (
    <Section id="publicites">
      <TileChart>
        <Tile label="Visites" value={site} hint="Pages du site ouvertes depuis une publicité (compteur sans cookie)" />
        <Tile label="Appli ouverte" value={somme(pubs, "appli")} sub={site ? `${pctOf(somme(pubs, "appli"), site)} % des visites` : null} />
        <Tile label="Écran compte" value={somme(pubs, "compte")} hint="Dernier écran de l'onboarding, avant la création du compte" />
        <Tile label="Inscriptions" value={inscriptions} sub={site ? `${pctOf(inscriptions, site)} % des visites` : null} />
      </TileChart>
      <Folds>
        <Fold open title="Par variante" icon="filtrer" value={fmtInt(pubs.length)} note="Taux : inscriptions sur visites du site. Clics, impressions et dépense : Ads Manager.">
          <Table cols={COLS} rows={pubs} max={20} empty="Aucune visite venue d'une publicité sur la période" />
        </Fold>
        <Fold title="Le reste du trafic" icon="lieu" value={fmtInt(somme(autres, "site"))}>
          <Table cols={COLS} rows={autres} max={12} empty="Rien de compté sur la période" />
        </Fold>
      </Folds>
    </Section>
  );
}
