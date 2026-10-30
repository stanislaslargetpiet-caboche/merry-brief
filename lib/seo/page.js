// Chargement commun des pages /mariage/[metier] et /mariage/[metier]/[zone]

import { notFound } from "next/navigation";
import { PUBLIC_URL, getStats, getVendors, hasPage, hrefOf, statOf } from "./data";
import { FRANCE, zoneOf } from "./geo";
import { tradeOf } from "./trades";
import { SHARE_IMAGE } from "@/lib/site";
import { pageDescription, pageTitle } from "@/components/seo/TradeZonePage";

async function resolve(metier, zoneSlug) {
  const trade = tradeOf(metier);
  const zone = zoneSlug === undefined ? FRANCE : zoneOf(zoneSlug);
  if (!trade || !zone) return null;
  const stats = await getStats();
  if (!stats || !hasPage(stats, trade, zone)) return null;
  return { trade, zone, stats };
}

export async function loadPage(metier, zoneSlug) {
  const found = await resolve(metier, zoneSlug);
  if (!found) notFound();
  const vendors = await getVendors(found.trade.slug, found.zone.slug);
  return { ...found, vendors };
}

export async function pageMetadata(metier, zoneSlug) {
  const found = await resolve(metier, zoneSlug);
  if (!found) return {};
  const { trade, zone, stats } = found;
  const title = `${pageTitle(trade, zone)} : tarifs et sélection | Merry`;
  const description = pageDescription(trade, zone, statOf(stats, trade, zone));
  const url = `${PUBLIC_URL}${hrefOf(trade, zone)}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, siteName: "Merry", locale: "fr_FR", type: "website", images: [{ url: SHARE_IMAGE, width: 1200, height: 630 }] },
    twitter: { card: "summary_large_image", images: [SHARE_IMAGE] },
  };
}
