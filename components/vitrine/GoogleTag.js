import Script from "next/script";
import { CONSENT_KEY } from "@/lib/analytics";
import { GOOGLE_TAG_SRC } from "@/lib/vitrine/googleTag";

// Balise Google (Google Ads, campagne d'Eugénie du 17 nov. 2026) : présente sur toutes les pages du site
// withmerry.com (vitrine et pages SEO), pas sur l'appli. Le mode consentement démarre refusé et passe à accordé
// si la personne a accepté le bandeau cookies (lib/analytics.js garde ce choix et le relaie à gtag).

const INIT = `window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
var merryConsent = "denied";
try { if (window.localStorage.getItem(${JSON.stringify(CONSENT_KEY)}) === "yes") merryConsent = "granted"; } catch (e) {}
gtag('consent', 'default', { ad_storage: merryConsent, ad_user_data: merryConsent, ad_personalization: merryConsent, analytics_storage: merryConsent });
gtag('js', new Date());`;

export default function GoogleTag() {
  return (
    <>
      <Script id="google-tag-init" strategy="afterInteractive" dangerouslySetInnerHTML={{ __html: INIT }} />
      <Script id="google-tag" src={GOOGLE_TAG_SRC} strategy="afterInteractive" />
    </>
  );
}
