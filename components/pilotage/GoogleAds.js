"use client";

// Bloc « Google Ads » de la page Acquisition › Référencement (D-364, D-381) : ce que coûte la campagne et ce qu'elle
// amène, par jour, par campagne, par mot-clé et par recherche tapée. Calculs dans lib/pilotage/googleAds.js ; dépense
// et clics envoyés chaque heure par le script du compte Google Ads (scripts/google-ads/merry-depense.js).
import { DayBars, Fold, Folds, Table, Tile, TileChart } from "@/components/pilotage/ui";
import { chiffresGoogleAds, resumeGoogleAds } from "@/lib/pilotage/googleAds";
import { fmtAgo, fmtEur, fmtInt } from "@/lib/server/pilotage/shape";

const eur = (v) => (v === null || v === undefined ? "–" : fmtEur(v));
const CORRESPONDANCE = { EXACT: "exacte", PHRASE: "expression", BROAD: "large" };

export default function GoogleAds({ ads, entonnoir, sources, utilisateurs, joursList, jours }) {
  if (!ads?.disponible) {
    const { site, inscriptions } = chiffresGoogleAds(entonnoir, sources);
    return (
      <>
        <h3 className="pl-bloc-titre">Google Ads</h3>
        <TileChart>
          <Tile label="Visites depuis Google Ads" value={site} hint="Arrivées sur le site par un clic d'annonce, compteur sans cookie" />
          <Tile label="Inscriptions" value={inscriptions} hint="Comptes créés après un clic d'annonce" />
        </TileChart>
        <p className="pl-note">Dépense et clics pas encore reçus{ads?.raison ? ` : ${ads.raison}` : " : le script Google Ads n'a rien envoyé"}.</p>
      </>
    );
  }
  const r = resumeGoogleAds({ lignes: ads.lignes, joursList, jours, entonnoir, sources, utilisateurs });
  const c = r.courant;
  const p = r.precedent;
  const series = r.series;
  return (
    <>
      <h3 className="pl-bloc-titre">Google Ads</h3>
      <TileChart>
        <Tile label="Dépense" value={c.cout} prev={p.cout} format={fmtEur} inverse hint="Coût des clics, lu dans Google Ads" chart={<DayBars title="Dépense par jour" series={series} keys={["cout"]} labels={["Dépense"]} days={jours} format={fmtEur} />} />
        <Tile label="Clics" value={c.clics} prev={p.clics} hint={`${fmtInt(c.impressions)} affichages de l'annonce ; ${fmtInt(c.visites)} arrivées comptées sur le site`} chart={<DayBars title="Clics par jour" series={series} keys={["clics"]} labels={["Clics"]} days={jours} />} />
        <Tile label="Inscriptions" value={c.inscriptions} prev={p.inscriptions} hint={`Comptes créés après un clic d'annonce, dont ${fmtInt(c.actifs)} ont envoyé une demande à un prestataire`} chart={<DayBars title="Inscriptions par jour" series={series} keys={["inscriptions"]} labels={["Inscriptions"]} days={jours} />} />
        <Tile label="Coût par inscription" value={c.cout_inscription} prev={p.cout_inscription} format={fmtEur} inverse hint={`Dépense sur inscriptions ; ${eur(c.cout_actif)} par couple qui a envoyé une demande`} />
      </TileChart>
      <Folds>
        <Fold title="Par campagne" value={r.campagnes.length ? `${fmtInt(r.campagnes.length)}` : null}>
          <Table
            rows={r.campagnes}
            cols={[
              { key: "campagne", label: "Campagne" },
              { key: "cout", label: "Dépense", num: true, render: (x) => eur(x.cout), sort: (x) => x.cout },
              { key: "clics", label: "Clics", num: true, render: (x) => fmtInt(x.clics), sort: (x) => x.clics },
              { key: "cpc", label: "Coût par clic", num: true, render: (x) => eur(x.cpc), sort: (x) => x.cpc ?? Infinity },
              { key: "inscriptions", label: "Inscriptions", num: true, render: (x) => fmtInt(x.inscriptions), sort: (x) => x.inscriptions },
              { key: "cout_inscription", label: "Coût par inscription", num: true, render: (x) => eur(x.cout_inscription), sort: (x) => x.cout_inscription ?? Infinity },
            ]}
          />
          {r.sansCampagne ? <p className="pl-note">{fmtInt(r.sansCampagne)} inscription(s) venue(s) d'une annonce sans campagne connue.</p> : null}
        </Fold>
        <Fold title="Par mot-clé" value={r.motsCles.length ? `${fmtInt(r.motsCles.length)}` : null}>
          <Table
            rows={r.motsCles}
            max={30}
            cols={[
              { key: "terme", label: "Mot-clé", render: (x) => `${x.terme}${x.correspondance ? ` (${CORRESPONDANCE[x.correspondance] || x.correspondance.toLowerCase()})` : ""}` },
              { key: "campagne", label: "Campagne" },
              { key: "cout", label: "Dépense", num: true, render: (x) => eur(x.cout), sort: (x) => x.cout },
              { key: "clics", label: "Clics", num: true, render: (x) => fmtInt(x.clics), sort: (x) => x.clics },
              { key: "cpc", label: "Coût par clic", num: true, render: (x) => eur(x.cpc), sort: (x) => x.cpc ?? Infinity },
              { key: "conversions", label: "Conversions Google", num: true, render: (x) => fmtInt(x.conversions), sort: (x) => x.conversions },
            ]}
          />
        </Fold>
        <Fold title="Recherches tapées" value={r.recherches.length ? `${fmtInt(r.recherches.length)}` : null}>
          <Table
            rows={r.recherches}
            max={30}
            cols={[
              { key: "terme", label: "Recherche" },
              { key: "impressions", label: "Affichages", num: true, render: (x) => fmtInt(x.impressions), sort: (x) => x.impressions },
              { key: "clics", label: "Clics", num: true, render: (x) => fmtInt(x.clics), sort: (x) => x.clics },
              { key: "cout", label: "Dépense", num: true, render: (x) => eur(x.cout), sort: (x) => x.cout },
            ]}
          />
        </Fold>
      </Folds>
      <p className="pl-note">Chiffres Google Ads reçus {ads.maj ? fmtAgo(ads.maj) : "jamais"}. Les conversions Google ne comptent que les visiteurs qui ont accepté les cookies.</p>
    </>
  );
}
