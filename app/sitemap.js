import { APP_URL, allPages, getStats } from "@/lib/seo/data";

export const revalidate = 86400;

export default async function sitemap() {
  const stats = await getStats().catch(() => null);
  if (!stats) return [];
  return allPages(stats).map((p) => ({ url: `${APP_URL}${p.href}`, lastModified: stats.at, changeFrequency: "weekly" }));
}
