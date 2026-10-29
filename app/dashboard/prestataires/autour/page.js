import { redirect } from "next/navigation";

// « Autour de votre lieu » a été fondu dans les recommandations (onglets par catégorie) le 29 oct. 2026
export default function Autour() {
  redirect("/dashboard/prestataires");
}
