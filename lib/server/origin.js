// Adresse publique de l'appli pour les liens envoyés par mail (invitations, notifications).
// Jamais l'en-tête Host tel quel : un lien de mail ne doit pas dépendre de la requête qui l'a déclenché
// (ni d'un en-tête forgé). NEXT_PUBLIC_APP_URL si elle est définie ; sinon un hôte de prévisualisation
// Vercel reste accepté pour tester une branche, et tout le reste retombe sur app.withmerry.com.

const APP_URL = "https://app.withmerry.com";

export function publicOrigin(req) {
  const configured = String(process.env.NEXT_PUBLIC_APP_URL || "").trim().replace(/\/+$/, "");
  if (/^https?:\/\/[a-z0-9.-]+$/i.test(configured)) return configured;
  const host = String(req?.headers?.get("x-forwarded-host") || req?.headers?.get("host") || "")
    .split(",")[0]
    .trim()
    .toLowerCase();
  if (host === "app.withmerry.com" || host === "localhost:3000" || /^[a-z0-9-]+\.vercel\.app$/.test(host)) {
    return `${host.startsWith("localhost") ? "http" : "https"}://${host}`;
  }
  return APP_URL;
}

// Adresse IP du visiteur telle que Vercel la transmet (première de la liste x-forwarded-for)
export function clientIp(req) {
  const fwd = String(req?.headers?.get("x-forwarded-for") || "").split(",")[0].trim();
  return fwd || String(req?.headers?.get("x-real-ip") || "").trim() || "unknown";
}
