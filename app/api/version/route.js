// Version en ligne de l'appli (commit déployé par Vercel), lue par les onglets restés ouverts pour savoir
// s'ils tournent encore avec un ancien code (components/NouvelleVersion.js, lib/version.js).
// Vide en local : rien ne se recharge pendant le développement.

export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({ version: process.env.VERCEL_GIT_COMMIT_SHA || "" }, { headers: { "cache-control": "no-store" } });
}
