/*
 * Textes de l'ossature du site vitrine (components/vitrine/Frame.js : en-tête,
 * pied de page, bouton flottant mobile), en français et en anglais.
 *
 * Les meta title/description de chaque page (app/vitrine/**\/page.js) restent
 * en français : elles sont générées côté serveur (export const metadata),
 * hors de portée de useLang() qui est client-side. Les traduire demanderait
 * un vrai routage par langue (ex. /en/...), hors périmètre du remplacement
 * de Weglot validé le 4 nov. 2026 (décision : pas de routing par locale).
 */

export const FRAME_TEXT = {
  fr: {
    skip: "Aller au contenu",
    logoAria: "Merry, accueil",
    navHome: "Accueil",
    navPro: "Prestataires",
    navAbout: "À propos",
    loginAria: "Connexion : choisir son espace",
    loginSummary: "Connexion ▾",
    loginCouple: "Espace couple",
    loginPro: "Espace prestataire",
    menuAria: "Ouvrir le menu",
    menuNavAria: "Menu mobile",
    menuLoginGroup: "Connexion",
    organise: "J'organise",
    seoAria: "Prestataires de mariage par région",
    seoTitle: "Prestataires de mariage par région",
    stickyFree: "Gratuit pour les mariés.",
    stickyTime: "Dix minutes pour démarrer.",
    footerTag: "La vie est la plus belle des fêtes.",
  },
  en: {
    skip: "Skip to content",
    logoAria: "Merry, home",
    navHome: "Home",
    navPro: "Vendors",
    navAbout: "About",
    loginAria: "Log in: choose your space",
    loginSummary: "Log in ▾",
    loginCouple: "Couple space",
    loginPro: "Vendor space",
    menuAria: "Open menu",
    menuNavAria: "Mobile menu",
    menuLoginGroup: "Log in",
    organise: "I'm planning",
    seoAria: "Wedding vendors by region",
    seoTitle: "Wedding vendors by region",
    stickyFree: "Free for the couple.",
    stickyTime: "Ten minutes to get started.",
    footerTag: "Life is the best party there is.",
  },
};

export const FOOTER_LINKS_TEXT = {
  fr: { about: "À propos", pro: "Prestataires", privacy: "Confidentialité", terms: "Conditions d'utilisation" },
  en: { about: "About", pro: "Vendors", privacy: "Privacy", terms: "Terms of use" },
};
