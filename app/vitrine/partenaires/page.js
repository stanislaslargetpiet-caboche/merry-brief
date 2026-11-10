import Frame from "@/components/vitrine/Frame";
import PartenairesBody from "@/components/vitrine/PartenairesBody";
import { getProof } from "@/lib/vitrine/proof";

export const metadata = {
  title: "Prestataires",
  description: "Reçois beaucoup plus de demandes de mariage qualifiées, sans abonnement ni commission : tu lis tout gratuitement et utilises des crédits seulement pour répondre. 100 crédits offerts.",
  alternates: { canonical: "https://www.withmerry.com/partenaires" },
};

export default async function VitrinePrestataires() {
  const { count, at } = await getProof();
  const proof = { count, at: at.toISOString() };
  return (
    <Frame current="pro">
      <PartenairesBody proof={proof} />
    </Frame>
  );
}
