import Legal from "@/components/vitrine/Legal";
import { CONFIDENTIALITE_TEXT, CONFIDENTIALITE_SECTIONS } from "@/lib/i18n/vitrine-confidentialite";

export const metadata = {
  title: "Politique de confidentialité",
  description: "Quelles données Merry traite, pourquoi, combien de temps, avec quels prestataires, et quels sont vos droits.",
  alternates: { canonical: "https://www.withmerry.com/confidentialite" },
};

export default function Confidentialite() {
  return <Legal text={CONFIDENTIALITE_TEXT} sections={CONFIDENTIALITE_SECTIONS} />;
}
