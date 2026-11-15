import { FACES } from "@/lib/i18n/vitrine-carrousel";

// Images de l'accueil demandées dès l'entête (app/vitrine/page.js) : la première image de la carte animée du haut, et
// les portraits du 3e onglet de « Comment ça marche » (scène invités), qui sinon ne partent qu'au clic et laissent des
// ronds gris une à trois secondes sur téléphone avec un réseau lent (relevé du 15 nov. 2026). Environ 140 Ko.
export const ACCUEIL_PRELOAD = ["/vitrine/blocks/proposition-1.webp", ...new Set(Object.values(FACES))];
