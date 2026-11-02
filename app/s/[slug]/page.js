import { fetchPublicSite } from "@/lib/siteServer";
import SitePage from "@/components/site/SitePage";

// Le site est lu une fois côté serveur (le même appel que l'aperçu de lien, partagé dans la requête) :
// la première image arrive déjà remplie, sans écran vide ni second aller-retour depuis le navigateur.
// Introuvable côté serveur (site tout juste publié, cache de 60 s) : la page vérifie elle-même, en direct.
export default async function WeddingSiteRoute({ params }) {
  const { slug } = await params;
  const initial = await fetchPublicSite(slug);
  return <SitePage slug={slug} initial={initial} />;
}
