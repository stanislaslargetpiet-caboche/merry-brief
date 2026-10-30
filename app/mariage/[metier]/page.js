import TradeZonePage from "@/components/seo/TradeZonePage";
import { loadPage, pageMetadata } from "@/lib/seo/page";

// Rendue à la première visite puis gardée un jour ; la liste des pages est dans le sitemap
export const revalidate = 86400;
export const dynamicParams = true;
export function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }) {
  const { metier } = await params;
  return pageMetadata(metier);
}

export default async function TradeFrancePage({ params }) {
  const { metier } = await params;
  const page = await loadPage(metier);
  return <TradeZonePage {...page} />;
}
