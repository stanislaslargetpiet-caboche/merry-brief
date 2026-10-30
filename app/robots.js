import { APP_URL } from "@/lib/seo/data";

// Les sites de mariage (/s) et les formulaires (/f) des couples restent hors des moteurs de recherche ;
// /vitrine est l'adresse interne du site vitrine, servi sur withmerry.com.
export default function robots() {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/dashboard", "/pro", "/api", "/connexion", "/s/", "/f/", "/vitrine"] }],
    sitemap: `${APP_URL}/sitemap.xml`,
  };
}
