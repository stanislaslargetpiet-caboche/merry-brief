// Visite venue d'une annonce (gclid, ?source=gads-…) sur une page SEO : la source suit la personne de lien en lien
// jusqu'à l'inscription, dans l'adresse seulement (rien n'est stocké dans le navigateur). Sans cela, le bouton
// d'inscription des pages SEO marque tout le monde « seo » et l'annonce qui a amené le couple se perd (D-381).
import { sourceOf } from "@/lib/compteur";

const APP_HOST = "app.withmerry.com";

/** Source à faire suivre depuis l'adresse de la page, ou null (aucune, ou déjà « seo »). */
export function sourceASuivre(search) {
  const source = sourceOf(search);
  return source && source !== "seo" ? source : null;
}

/** L'adresse d'un lien, avec la source : l'inscription de l'appli et les pages du site ; les autres liens restent tels quels. */
export function lienAvecSource(href, source, origin) {
  if (!href || !source || /^(#|mailto:|tel:)/i.test(href)) return href;
  let url;
  try {
    url = new URL(href, origin);
  } catch {
    return href;
  }
  const memeSite = url.origin === new URL(origin).origin;
  const inscription = url.hostname === APP_HOST && url.pathname === "/";
  if (!memeSite && !inscription) return href;
  url.searchParams.set("source", source);
  return memeSite ? `${url.pathname}${url.search}${url.hash}` : url.toString();
}
