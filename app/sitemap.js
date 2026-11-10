import { PUBLIC_URL, allPages, getStats } from "@/lib/seo/data";

// Pages du site vitrine (adresses publiques) : l'accueil et les pages institutionnelles, hors onboarding
const SITE_PAGES = ["/", "/partenaires", "/about", "/confidentialite", "/cgu"];

export const revalidate = 86400;

export default async function sitemap() {
  // Sans clé de service (local), pas de pages ; une lecture qui échoue lève et laisse le sitemap précédent en place
  const stats = await getStats();
  if (!stats) return [];
  const site = SITE_PAGES.map((path) => ({ url: `${PUBLIC_URL}${path}`, lastModified: stats.at, changeFrequency: "monthly" }));
  return site.concat(allPages(stats).map((p) => ({ url: `${PUBLIC_URL}${p.href}`, lastModified: stats.at, changeFrequency: "weekly" })));
}
