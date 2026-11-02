import { fetchPublicForm } from "@/lib/formServer";
import FormPage from "@/components/site/FormPage";

// Le formulaire est lu une fois côté serveur (le même appel que l'aperçu de lien, partagé dans la requête) :
// il s'affiche déjà rempli, sans écran « Chargement… » ni second aller-retour depuis le navigateur.
export default async function GuestFormRoute({ params }) {
  const { slug } = await params;
  const initial = await fetchPublicForm(slug);
  return <FormPage slug={slug} initial={initial} />;
}
