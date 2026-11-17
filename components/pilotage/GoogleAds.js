"use client";

// Bloc « Google Ads » de la page Acquisition › Référencement : visites venues d'une annonce Google, inscriptions
// et taux (chiffres dans lib/pilotage/googleAds.js). La balise GTM-NNL3ZQSH (D-363) remonte les conversions dans
// Google Ads, pas ici.
import { Tile, TileChart } from "@/components/pilotage/ui";
import { chiffresGoogleAds } from "@/lib/pilotage/googleAds";
import { GOOGLE_TAG_ID } from "@/lib/vitrine/googleTag";

export default function GoogleAds({ entonnoir, sources }) {
  const { site, inscriptions, taux } = chiffresGoogleAds(entonnoir, sources);
  return (
    <>
      <h3 className="pl-bloc-titre">Google Ads</h3>
      <TileChart>
        <Tile label="Visites depuis Google Ads" value={site} hint="Pages du site ouvertes depuis une annonce Google (lien avec gclid), compteur sans cookie" />
        <Tile label="Inscriptions" value={inscriptions} hint="Briefs créés avec un lien venu d'une annonce Google" />
        <Tile label="Taux d'inscription" value={taux} format={(v) => `${v} %`} hint="Inscriptions sur visites depuis Google Ads" />
      </TileChart>
      <p className="pl-note">Clics, impressions et dépense se lisent dans Google Ads. Balise {GOOGLE_TAG_ID} sur withmerry.com, conversions comptées là-bas après accord cookies.</p>
    </>
  );
}
