import { SHARE_IMAGE } from "@/lib/site";
import Track from "@/components/vitrine/Track";
import { LangProvider } from "@/lib/lang";
import "./vitrine.css";
import "./blocks.css";
import "./carrousel.css";

const SITE = "https://www.withmerry.com";

// Les pages du site vitrine sont statiques, régénérées une fois par jour (chiffres du catalogue : liens SEO,
// nombre de prestataires) : servies depuis le cache, sans rendu à chaque visite.
export const revalidate = 86400;

export const metadata = {
  metadataBase: new URL(SITE),
  title: { default: "Merry · Organiser son mariage, gratuit pour les mariés", template: "%s | Merry" },
  description: "Merry : l’assistant qui simplifie l’organisation de ton mariage, de A à Z. 100 % gratuit pour les mariés.",
  alternates: { canonical: "/" },
  // Aperçu des liens partagés (WhatsApp, iMessage, réseaux) : photo du haut de l'accueil
  openGraph: { siteName: "Merry", locale: "fr_FR", type: "website", url: "/", images: [{ url: SHARE_IMAGE, width: 1200, height: 630 }] },
  twitter: { card: "summary_large_image", images: [SHARE_IMAGE] },
};

// Données structurées : l'organisation (nom, logo, site) pour les moteurs de recherche
const ORGANIZATION = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Merry",
  url: SITE,
  logo: `${SITE}/apple-icon`,
  sameAs: [],
};

export default function VitrineLayout({ children }) {
  return (
    <LangProvider>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ORGANIZATION) }} />
      {children}
      <Track />
    </LangProvider>
  );
}
