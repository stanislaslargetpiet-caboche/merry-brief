"use client";

// Page « Acquisition › Publicités » du pilotage : trois chiffres, des visites venues d'une publicité (?source=meta-a…)
// à l'inscription. Les visites viennent du compteur anonyme (lib/compteur.js, cookies acceptés ou non), les
// inscriptions des briefs. Clics, impressions et dépense restent dans Ads Manager.
import { Section, Tile, TileChart } from "@/components/pilotage/ui";
import { avecInscriptions, isPub } from "@/lib/compteur";
import { pctOf } from "@/lib/server/pilotage/shape";

const somme = (rows, key) => rows.reduce((acc, r) => acc + (r[key] || 0), 0);

export default function Publicites({ entonnoir, sources }) {
  if (!entonnoir) {
    return (
      <Section id="publicites">
        <div className="pl-empty">PostHog n'est pas lisible : voir la page Santé.</div>
      </Section>
    );
  }
  const pubs = avecInscriptions(entonnoir, sources).filter((r) => isPub(r.source));
  const site = somme(pubs, "site");
  const inscriptions = somme(pubs, "inscriptions");
  return (
    <Section id="publicites">
      <TileChart>
        <Tile label="Visites depuis une pub" value={site} hint="Pages du site ouvertes depuis une publicité (compteur sans cookie)" />
        <Tile label="Inscriptions" value={inscriptions} hint="Briefs créés avec un lien de publicité" />
        <Tile label="Taux d'inscription" value={pctOf(inscriptions, site)} format={(v) => `${v} %`} hint="Inscriptions sur visites depuis une pub" />
      </TileChart>
    </Section>
  );
}
