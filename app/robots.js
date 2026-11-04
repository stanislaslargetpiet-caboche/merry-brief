import { PUBLIC_URL } from "@/lib/seo/data";

// Les sites de mariage (/s) et les formulaires (/f) des couples restent hors des moteurs de recherche ;
// /vitrine est l'adresse interne du site vitrine, servi sur withmerry.com.
export default function robots() {
  return {
    // /s et /f portent déjà noindex : les interdire ici empêcherait les robots de le lire
    rules: [{ userAgent: "*", allow: "/", disallow: ["/dashboard", "/pro", "/pilotage", "/api", "/connexion", "/vitrine"] }],
    sitemap: `${PUBLIC_URL}/sitemap.xml`,
  };
}
