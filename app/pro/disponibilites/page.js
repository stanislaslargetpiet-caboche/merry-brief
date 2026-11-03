import { redirect } from "next/navigation";

// Disponibilités a fusionné dans Tarifs (calendrier + prix sur un seul écran, demande de Stan le
// 3 nov. 2026 : « merger avec un calendrier très similaire à ce que fait Airbnb »). Un ancien lien
// ou favori ramène à Tarifs.
export default function Disponibilites() {
  redirect("/pro/tarifs");
}
