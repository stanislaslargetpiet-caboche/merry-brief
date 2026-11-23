// Merry App sur l'App Store (en ligne depuis le 22 nov. 2026) : l'identifiant et le lien, à un seul endroit.
// Le lien ne porte pas de pays : Apple envoie chacun vers sa boutique.

export const APP_STORE_ID = "6835056425";
export const APP_STORE_URL = `https://apps.apple.com/app/merry-app/id${APP_STORE_ID}`;

// Bandeau que Safari affiche de lui-même en haut de page sur iPhone (balise apple-itunes-app). L'appli iOS
// charge ces mêmes pages dans une vue web, qui ignore la balise.
export const APP_STORE_BANNER = { appId: APP_STORE_ID };

// Carte de l'appli web (components/dash/AppStoreCard.js) : sur iPhone, hors de l'appli, tant qu'elle n'est pas fermée
export function showAppCard(ua, inApp, closed) {
  return /iPhone|iPod/.test(ua) && !inApp && !closed;
}
