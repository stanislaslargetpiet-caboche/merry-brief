// Couples › Funnel du pilotage : suppression définitive d'un couple (lib/server/pilotage/suppression.js). GET
// ?mariage=… : ce qui partira (comptes supprimés ou gardés, nombre de fichiers) ; DELETE { mariage } : la suppression.
// Même accès que le reste du pilotage (PILOTAGE_EMAILS et adresses approuvées), dont les comptes ne sont jamais supprimés.

import { pilotEmails } from "@/lib/server/pilotage/acces";
import { requirePilot } from "@/lib/server/pilotage/auth";
import { planSuppression, supprimerCouple } from "@/lib/server/pilotage/suppression";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "cache-control": "private, no-store" };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(req) {
  const who = await requirePilot(req);
  if (who.refus) return who.refus;
  const id = new URL(req.url).searchParams.get("mariage");
  if (!UUID.test(String(id || ""))) return Response.json({ error: "invalide" }, { status: 400, headers: NO_STORE });
  try {
    const plan = await planSuppression(who.admin, id, await pilotEmails(who.admin));
    if (!plan) return Response.json({ error: "introuvable" }, { status: 404, headers: NO_STORE });
    return Response.json({ couple: plan.couple, comptes: plan.comptes.map(({ email, garde }) => ({ email, garde })), fichiers: plan.fichiers.length }, { headers: NO_STORE });
  } catch (e) {
    console.error("[merry] suppression, pilotage", e?.message || e);
    return Response.json({ error: "lecture" }, { status: 502, headers: NO_STORE });
  }
}

export async function DELETE(req) {
  const who = await requirePilot(req);
  if (who.refus) return who.refus;
  const body = await req.json().catch(() => null);
  if (!UUID.test(String(body?.mariage || ""))) return Response.json({ error: "invalide" }, { status: 400, headers: NO_STORE });
  try {
    const fait = await supprimerCouple(who.admin, body.mariage, await pilotEmails(who.admin));
    if (!fait) return Response.json({ error: "introuvable" }, { status: 404, headers: NO_STORE });
    console.info("[merry] suppression, pilotage", who.email, body.mariage, fait.comptes, "comptes", fait.fichiers, "fichiers");
    return Response.json(fait, { headers: NO_STORE });
  } catch (e) {
    // Une étape a échoué : le mariage est encore là, la suppression peut être relancée depuis le Funnel
    console.error("[merry] suppression, pilotage", e?.message || e);
    return Response.json({ error: e?.message || "echec" }, { status: 502, headers: NO_STORE });
  }
}
