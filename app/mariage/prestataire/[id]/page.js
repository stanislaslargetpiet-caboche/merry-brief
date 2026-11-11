import { notFound } from "next/navigation";
import VendorFichePage, { ficheMetadata } from "@/components/seo/VendorFichePage";
import { getStats, getVendor } from "@/lib/seo/data";

export const revalidate = 86400;
export const dynamicParams = true;
export function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }) {
  const { id } = await params;
  const vendor = await getVendor(id);
  return vendor ? ficheMetadata(vendor) : {};
}

export default async function VendorRoute({ params }) {
  const { id } = await params;
  const vendor = await getVendor(id);
  if (!vendor) notFound();
  const stats = await getStats();
  return <VendorFichePage vendor={vendor} stats={stats} />;
}
