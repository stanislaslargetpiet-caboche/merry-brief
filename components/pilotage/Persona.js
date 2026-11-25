"use client";

// Page « Acquisition › Persona » du pilotage (D-398) : qui clique sur les annonces Google et qui s'inscrit, par sexe,
// âge, région et appareil. Calculs dans lib/pilotage/persona.js.
import { Card, Section, Tile, TileChart } from "@/components/pilotage/ui";
import { AnneauxSexe, Barres, Colonnes } from "@/components/pilotage/PersonaGraphes";
import { resumePersona } from "@/lib/pilotage/persona";
import { fmtInt } from "@/lib/server/pilotage/shape";

const pctFormat = (v) => `${v} %`;

export default function Persona({ ads, mariages, joursList, jours }) {
  const periode = (joursList || []).slice(-jours);
  const r = resumePersona({ lignes: ads?.disponible ? ads.lignes : [], mariages, jours: periode });
  return (
    <Section id="persona">
      <TileChart>
        <Tile label="Clics Google Ads" value={r.clics} hint="Clics sur les annonces, lus dans Google Ads" />
        <Tile label="Femmes parmi les clics" value={r.femmes_clics} format={pctFormat} hint="Sur les clics dont Google connaît le sexe" />
        <Tile label="Inscriptions" value={r.inscriptions} hint={`Mariages créés, couples de test écartés ; dont ${fmtInt(r.inscriptions_google)} après un clic d'annonce`} />
        <Tile label="Femmes parmi les inscrits" value={r.femmes_inscrits} format={pctFormat} hint="Estimé d'après le prénom donné à l'inscription" />
      </TileChart>
      {!r.persona_recue ? <p className="pl-note">Sexe, âge, région et appareil des clics pas encore reçus de Google Ads.</p> : null}
      <div className="pl-persona">
        <Card title="Sexe" note="Inscrits : estimé d'après le prénom.">
          <AnneauxSexe rows={r.sexe} />
        </Card>
        <Card title="Âge des clics" note="L'âge n'est pas demandé à l'inscription.">
          <Colonnes rows={r.age} />
        </Card>
        <Card title="Région" note="Inscrits : lieu du mariage donné à l'inscription.">
          <Barres rows={r.region} />
        </Card>
        <Card title="Appareil des clics">
          <Barres rows={r.appareil} inscrits={false} />
        </Card>
      </div>
    </Section>
  );
}
