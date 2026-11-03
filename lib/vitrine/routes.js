// Site vitrine : adresses publiques (les mêmes que sur Squarespace) et pages internes qui les servent.

export const VITRINE_HOSTS = ["withmerry.com", "www.withmerry.com"];

export const VITRINE_PAGES = {
  "/": "/vitrine",
  "/partenaires": "/vitrine/partenaires",
  "/about": "/vitrine/about",
  "/onboarding": "/vitrine/onboarding",
  "/confidentialite": "/vitrine/confidentialite",
  "/cgu": "/vitrine/cgu",
};

export const APP = "https://app.withmerry.com";
export const SIGNUP = `${APP}/`;
export const LOGIN = `${APP}/connexion`;
export const PRO = `${APP}/pro`;
export const PRO_LOGIN = `${PRO}?connexion=1`; // connexion d'un prestataire (adresse mail puis code)
export const DEMO = "https://calendly.com/stanlp/merry";

// Les liens internes du site gardent partout leurs adresses publiques : sur withmerry.com le middleware les
// sert, et sur une prévisualisation Vercel ou en local il les réécrit aussi vers les pages internes
// (middleware.js). Les pages n'ont ainsi pas besoin de connaître l'hôte, et restent statiques (mises en cache).
// Seule exception : « / » reste l'onboarding de l'appli hors withmerry.com ; en local, ouvrir /vitrine.
export const LINKS = { home: "/", pro: "/partenaires", about: "/about", guests: "/onboarding", privacy: "/confidentialite", terms: "/cgu" };
