// Badge « Télécharger dans l'App Store » : les fichiers officiels d'Apple (public/vitrine/app-store-*.svg),
// jamais redessinés ni recolorés. `track` nomme le clic pour la mesure du site (components/vitrine/Track.js).

import { APP_STORE_URL } from "@/lib/appStore";

const BADGES = {
  fr: { src: "/vitrine/app-store-fr.svg", alt: "Télécharger dans l'App Store", width: 164 },
  en: { src: "/vitrine/app-store-en.svg", alt: "Download on the App Store", width: 156 },
};

export default function AppStoreBadge({ lang, track }) {
  const badge = BADGES[lang] || BADGES.fr;
  return (
    <a href={APP_STORE_URL} className="wv-asb" data-track={track}>
      <img src={badge.src} alt={badge.alt} width={badge.width} height={52} decoding="async" />
    </a>
  );
}
