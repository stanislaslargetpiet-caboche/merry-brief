import { redirect } from "next/navigation";

// Le pense-bête a quitté le menu (artboards « 10 · Invités, un seul espace ») ; ses notes restent en base.
// Un ancien lien ou favori ramène à l'accueil.
export default function PenseBete() {
  redirect("/dashboard");
}
