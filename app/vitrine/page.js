import Frame from "@/components/vitrine/Frame";
import HomeBody from "@/components/vitrine/HomeBody";
import { LINKS } from "@/lib/vitrine/routes";
import { getProof } from "@/lib/vitrine/proof";
import { ACCUEIL_FAQ } from "@/lib/i18n/vitrine-accueil";

// Données structurées : la FAQ, telle qu'affichée, pour les moteurs de recherche (reste en
// français : lié aux meta title/description qui restent en français, voir lib/i18n/vitrine-frame.js)
const FAQ_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: ACCUEIL_FAQ.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })),
};

export default async function VitrineAccueil() {
  const links = LINKS;
  const { count, at } = await getProof();
  const proof = { count, at: at.toISOString() };
  return (
    <Frame current="home">
      {/* Première image de la carte animée du haut : chargée dès l'entête plutôt qu'après le CSS */}
      <link rel="preload" as="image" href="/vitrine/blocks/proposition-1.webp" />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_JSON_LD) }} />
      <HomeBody links={links} proof={proof} />
    </Frame>
  );
}
