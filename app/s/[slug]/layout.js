import "../site.css";
import { fetchPublicSite } from "@/lib/siteServer";
import { longDate } from "@/lib/dash/format";

// Titre, description et image affichés quand le lien est partagé (WhatsApp, Facebook, messages)
export async function generateMetadata({ params }) {
  const { slug } = await params;
  const site = await fetchPublicSite(slug);
  const names = site ? [site.partner1, site.partner2].filter(Boolean).map((n) => String(n).trim().split(/\s+/)[0]).join(" & ") : "";
  const title = names || "Notre mariage";
  const when = site && !site.closed ? [site.wedding_date ? longDate(site.wedding_date) : null, site.content?.venue?.name || site.venue].filter(Boolean).join(" · ") : "";
  const description = when ? `${when}. Le programme, le lieu et tout le pratique du week-end.` : "Le programme, le lieu et tout le pratique du week-end.";
  const image = site?.content?.photos?.cover;
  return {
    title,
    description,
    robots: { index: false, follow: false },
    openGraph: { title, description, type: "website", locale: "fr_FR", ...(image ? { images: [image] } : {}) },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default function WeddingSiteLayout({ children }) {
  return children;
}
