import { redirect } from "next/navigation";

// « Vos demandes » a été fondu dans « Mes prestataires », qui montre déjà où en est chaque demande (29 oct. 2026)
export default function Demandes() {
  redirect("/dashboard/prestataires/mes");
}
