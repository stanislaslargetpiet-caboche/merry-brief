import Script from "next/script";
import { SHARE_IMAGE } from "@/lib/site";
import "./vitrine.css";

// Weglot traduit le site en anglais, comme sur Squarespace (clé publique du projet Weglot de Merry)
const WEGLOT_KEY = "wg_7a7d56df697abdba42bbcb9e1940599c4";

export const metadata = {
  title: "Merry",
  description: "Merry : l’assistant qui simplifie l’organisation de tous tes événements, de A à Z. 100 % gratuit pour les organisateurs.",
  alternates: { canonical: "https://www.withmerry.com/" },
  // Aperçu des liens partagés (WhatsApp, iMessage, réseaux) : photo du haut de l'accueil
  openGraph: { siteName: "Merry", locale: "fr_FR", type: "website", images: [{ url: SHARE_IMAGE, width: 1200, height: 630 }] },
  twitter: { card: "summary_large_image", images: [SHARE_IMAGE] },
};

export default function VitrineLayout({ children }) {
  return (
    <>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Climate+Crisis&display=swap" precedence="default" />
      {children}
      <Script src="https://cdn.weglot.com/weglot.min.js" strategy="afterInteractive" />
      <Script id="weglot-init" strategy="afterInteractive">{`(function w(){if(window.Weglot){window.Weglot.initialize({api_key:"${WEGLOT_KEY}"})}else{setTimeout(w,50)}})()`}</Script>
    </>
  );
}
