import TradeZonePage from "@/components/seo/TradeZonePage";
import { loadPage, pageMetadata } from "@/lib/seo/page";

export const revalidate = 86400;
export const dynamicParams = true;
export function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }) {
  const { metier, zone } = await params;
  return pageMetadata(metier, zone);
}

export default async function TradeZoneRoute({ params }) {
  const { metier, zone } = await params;
  const page = await loadPage(metier, zone);
  return <TradeZonePage {...page} />;
}
