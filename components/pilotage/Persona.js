"use client";

// Page « Acquisition › Persona » du pilotage (D-398) : qui clique sur les annonces Google et qui s'inscrit, par sexe,
// âge, région et appareil. Calculs dans lib/pilotage/persona.js.
import { Card, Section, Table, Tile, TileChart } from "@/components/pilotage/ui";
import { resumePersona } from "@/lib/pilotage/persona";
import { fmtInt } from "@/lib/server/pilotage/shape";

const part = (v) => (v === null || v === undefined ? "–" : `${v} %`);
const pctFormat = (v) => `${v} %`;

function Repartition({ titre, rows, inscrits = true, note }) {
  const cols = [
    { key: "label", label: "" },
    { key: "clics", label: "Clics", num: true, render: (x) => fmtInt(x.clics), sort: (x) => x.clics },
    { key: "part_clics", label: "Part", num: true, render: (x) => part(x.part_clics), sort: (x) => x.part_clics ?? -1 },
  ];
  if (inscrits) {
    cols.push(
      { key: "inscriptions", label: "Inscrits", num: true, render: (x) => fmtInt(x.inscriptions), sort: (x) => x.inscriptions },
      { key: "part_inscriptions", label: "Part", num: true, render: (x) => part(x.part_inscriptions), sort: (x) => x.part_inscriptions ?? -1 }
    );
  }
  return (
    <Card title={titre} note={note}>
      <Table rows={rows} cols={cols} max={14} pinLast={(x) => x.inconnu} />
    </Card>
  );
}

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
        <Repartition titre="Sexe" rows={r.sexe} note="Inscrits : estimé d'après le prénom." />
        <Repartition titre="Âge" rows={r.age} inscrits={false} note="L'âge n'est pas demandé à l'inscription." />
        <Repartition titre="Région" rows={r.region} note="Inscrits : lieu du mariage donné à l'inscription." />
        <Repartition titre="Appareil" rows={r.appareil} inscrits={false} />
      </div>
    </Section>
  );
}
