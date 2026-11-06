// Meetings avec l'extérieur du jour, pour la page Aujourd'hui du pilotage. Même accès que le reste du pilotage.

import { requirePilot } from "@/lib/server/pilotage/auth";
import { readAgenda } from "@/lib/server/pilotage/google";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "cache-control": "private, no-store" };

export async function GET(req) {
  const who = await requirePilot(req);
  if (who.refus) return who.refus;
  try {
    return Response.json(await readAgenda(), { headers: NO_STORE });
  } catch (e) {
    console.error("[merry] agenda", e?.message || e);
    return Response.json({ disponible: false, raison: "Agenda non lu" }, { headers: NO_STORE });
  }
}
