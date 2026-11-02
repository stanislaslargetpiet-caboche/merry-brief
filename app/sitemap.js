import { PUBLIC_URL, allPages, getStats } from "@/lib/seo/data";

export const revalidate = 86400;

export default async function sitemap() {
  // Sans clé de service (local), pas de pages ; une lecture qui échoue lève et laisse le sitemap précédent en place
  const stats = await getStats();
  if (!stats) return [];
  return allPages(stats).map((p) => ({ url: `${PUBLIC_URL}${p.href}`, lastModified: stats.at, changeFrequency: "weekly" }));
}
