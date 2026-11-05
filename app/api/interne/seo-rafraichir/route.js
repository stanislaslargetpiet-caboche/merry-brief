// Rafraîchit les pages SEO (/mariage/…) et le sitemap sans attendre leur journée de cache : à lancer après
// un enrichissement du catalogue (photos, nouvelles fiches, changements de statut). Les comptes, la sélection
// des prestataires mis en avant et les pages elles-mêmes sont recalculés à la prochaine visite de chacune.
// Deux accès : le bouton de la page de pilotage (jeton de session d'une adresse de PILOTAGE_EMAILS), ou
// CRON_SECRET en jeton pour une commande ou une tâche planifiée.

import { revalidatePath, revalidateTag } from "next/cache";
import { SEO_TAG } from "@/lib/seo/data";
import { requirePilot } from "@/lib/server/pilotage/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function refresh() {
  revalidateTag(SEO_TAG);
  revalidatePath("/mariage/[metier]", "page");
  revalidatePath("/mariage/[metier]/[zone]", "page");
  revalidatePath("/sitemap.xml");
  return Response.json({ ok: true, quand: new Date().toISOString() }, { headers: { "cache-control": "private, no-store" } });
}

function byCron(req) {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret) && req.headers.get("authorization") === `Bearer ${secret}`;
}

export async function POST(req) {
  if (byCron(req)) return refresh();
  const who = await requirePilot(req);
  if (who.refus) return who.refus;
  return refresh();
}

// Vercel appelle ses tâches planifiées en GET
export async function GET(req) {
  if (!byCron(req)) return Response.json({ error: "unauthorized" }, { status: 401 });
  return refresh();
}
