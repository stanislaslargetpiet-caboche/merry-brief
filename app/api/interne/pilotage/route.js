// Indicateurs de pilotage de Merry (page /pilotage), réservés aux adresses de PILOTAGE_EMAILS (celles de Stan par
// défaut). La page envoie le jeton de session Supabase ; la route vérifie l'adresse puis collecte les six sources
// (lib/server/pilotage/collect.js). Chaque source peut manquer ou échouer sans priver la page des autres.

import { collectPilotage } from "@/lib/server/pilotage/collect";
import { requirePilot } from "@/lib/server/pilotage/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const RANGES = new Set([1, 7, 30]);

export async function GET(req) {
  const who = await requirePilot(req);
  if (who.refus) return who.refus;
  const { admin } = who;

  const params = new URL(req.url).searchParams;
  const asked = Number(params.get("jours") || 7);
  const days = RANGES.has(asked) ? asked : 7;
  // « Actualiser » demande une lecture neuve (?frais=1) ; sinon Supabase est lu par le cache de cinq minutes
  const data = await collectPilotage({ admin, days, fresh: params.get("frais") === "1" });
  return Response.json({ ok: true, jours: days, genere: new Date().toISOString(), ...data }, { headers: { "cache-control": "private, no-store" } });
}
