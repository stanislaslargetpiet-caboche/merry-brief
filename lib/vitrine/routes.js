// Site vitrine : adresses publiques (les mêmes que sur Squarespace) et pages internes qui les servent.

export const VITRINE_HOSTS = ["withmerry.com", "www.withmerry.com"];

export const VITRINE_PAGES = {
  "/": "/vitrine",
  "/partenaires": "/vitrine/partenaires",
  "/about": "/vitrine/about",
  "/onboarding": "/vitrine/onboarding",
};

export const APP = "https://app.withmerry.com";
export const SIGNUP = `${APP}/`;
export const LOGIN = `${APP}/connexion`;
export const PRO = `${APP}/pro`;
export const DEMO = "https://calendly.com/stanlp/merry";

// Sur withmerry.com les liens gardent leurs adresses publiques ; ailleurs (prévisualisation Vercel, local)
// ils pointent vers les pages internes, pour pouvoir tout parcourir avant la bascule du domaine.
export function linksFor(host) {
  const onSite = VITRINE_HOSTS.includes(String(host || "").split(":")[0].toLowerCase());
  const href = (path) => (onSite ? path : VITRINE_PAGES[path]);
  return { home: href("/"), pro: href("/partenaires"), about: href("/about"), guests: href("/onboarding") };
}
