import { redirect } from "next/navigation";

// La sélection de lieux a été fondue dans l'onglet Lieux des recommandations le 29 oct. 2026
export default function Lieux() {
  redirect("/dashboard/prestataires");
}
