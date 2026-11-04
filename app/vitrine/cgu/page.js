import Legal from "@/components/vitrine/Legal";
import { CGU_TEXT, CGU_SECTIONS } from "@/lib/i18n/vitrine-cgu";

export const metadata = {
  title: "Conditions d'utilisation",
  description: "Les règles d'utilisation de Merry pour les organisateurs, les invités et les prestataires.",
  alternates: { canonical: "https://www.withmerry.com/cgu" },
};

export default function ConditionsUtilisation() {
  return <Legal text={CGU_TEXT} sections={CGU_SECTIONS} />;
}
