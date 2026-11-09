"use client";

// Page « Publicités » du pilotage : ce que les campagnes payantes amènent, du site à l'inscription, par variante
// (?source=meta-a…). Les passages viennent du compteur anonyme (lib/compteur.js, cookies acceptés ou non), les
// inscriptions des briefs. Clics, impressions et dépense restent dans Ads Manager.
import { Fold, Folds, Section, Table, Tile, TileChart } from "@/components/pilotage/ui";
import { avecInscriptions, ETAPES, isPub } from "@/lib/compteur";
import { fmtInt, pctOf } from "@/lib/server/pilotage/shape";

const somme = (rows, key) => rows.reduce((acc, r) => acc + (r[key] || 0), 0);

// Noms des variantes du test « Test mariage nov » (7 au 9 nov. 2026), affichés à la place du lien
const VARIANTES = { "meta-a": "A Budget", "meta-b": "B Liste", "meta-c": "C Formulaire", "meta-d": "D Prestataires", "meta-e": "E Rétroplanning" };

const colonnes = (premiere) => [
  { key: "source", label: premiere, render: (r) => <strong title={r.source}>{VARIANTES[r.source] || r.source}</strong> },
  ...ETAPES.map((e) => ({ key: e.id, label: e.label, num: true, group: e.onboarding ? "Écrans de l'onboarding" : null })),
  { key: "inscriptions", label: "Inscrits", num: true },
  { key: "conversion", label: "Inscrits / visites", num: true, render: (r) => (r.site ? `${pctOf(r.inscriptions, r.site)} %` : "–") },
];
const COLS_PUBS = colonnes("Pub");
const COLS_AUTRES = colonnes("Source");

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
        <Fold open title="Par variante" icon="filtrer" value={fmtInt(pubs.length)} note="Chaque colonne compte des passages, pas des personnes : un visiteur peut revenir sur un écran. Clics, impressions et dépense : Ads Manager.">
          <Table cols={COLS_PUBS} rows={pubs} max={20} empty="Aucune visite venue d'une publicité sur la période" />
        </Fold>
        <Fold title="Le reste du trafic" icon="lieu" value={fmtInt(somme(autres, "site"))}>
          <Table cols={COLS_AUTRES} rows={autres} max={12} empty="Rien de compté sur la période" />
        </Fold>
      </Folds>
    </Section>
  );
}
