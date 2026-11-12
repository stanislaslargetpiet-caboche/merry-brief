// Couples › Funnel du pilotage (D-289) : retraits des mails de démarrage pour les interrupteurs (GET), planning d'un
// couple (GET ?mariage=…), sortie de la séquence ou retrait d'un mail (POST { mariage, etape, retire }). Même accès
// que le reste du pilotage (adresses de PILOTAGE_EMAILS).

import { requirePilot } from "@/lib/server/pilotage/auth";
import { apercuCouple, changerRetrait, etapeValide, lireRetraits } from "@/lib/server/pilotage/demarrage";
import { publicOrigin } from "@/lib/server/origin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "cache-control": "private, no-store" };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(req) {
  const who = await requirePilot(req);
  if (who.refus) return who.refus;
  const id = new URL(req.url).searchParams.get("mariage");
  if (id && !UUID.test(id)) return Response.json({ error: "invalide" }, { status: 400, headers: NO_STORE });
  try {
    if (!id) return Response.json({ disponible: true, retraits: await lireRetraits(who.admin) }, { headers: NO_STORE });
    const apercu = await apercuCouple(who.admin, id, publicOrigin(req));
    return apercu ? Response.json(apercu, { headers: NO_STORE }) : Response.json({ error: "introuvable" }, { status: 404, headers: NO_STORE });
  } catch (e) {
    console.error("[merry] démarrage, pilotage", e?.message || e);
    // Sans la table (SQL pas encore collé), le tableau se dessine quand même, interrupteurs grisés
    return id ? Response.json({ error: "lecture" }, { status: 502, headers: NO_STORE }) : Response.json({ disponible: false }, { headers: NO_STORE });
  }
}

export async function POST(req) {
  const who = await requirePilot(req);
  if (who.refus) return who.refus;
  const body = await req.json().catch(() => null);
  if (!UUID.test(String(body?.mariage || "")) || !etapeValide(body?.etape) || typeof body?.retire !== "boolean") {
    return Response.json({ error: "invalide" }, { status: 400, headers: NO_STORE });
  }
  try {
    await changerRetrait(who.admin, body.mariage, body.etape, body.retire, who.email);
    const retraits = await lireRetraits(who.admin);
    return Response.json({ retraits: retraits[body.mariage] || [] }, { headers: NO_STORE });
  } catch (e) {
    console.error("[merry] démarrage, pilotage", e?.message || e);
    return Response.json({ error: "ecriture" }, { status: 502, headers: NO_STORE });
  }
}
