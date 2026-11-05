// Valider ou refuser une demande d'accès à une fiche prestataire (section « Demandes » de /pilotage).
// Même accès que le reste du pilotage (adresses de PILOTAGE_EMAILS, jeton de session Supabase).

import { requirePilot } from "@/lib/server/pilotage/auth";
import { decideDemande } from "@/lib/server/proDemande";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "cache-control": "private, no-store" };
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req) {
  const who = await requirePilot(req);
  if (who.refus) return who.refus;
  const body = await req.json().catch(() => null);
  const id = String(body?.id || "");
  const decision = body?.decision === "valider" || body?.decision === "refuser" ? body.decision : null;
  if (!UUID_RE.test(id) || !decision) return Response.json({ error: "invalide" }, { status: 400, headers: NO_STORE });
  const res = await decideDemande(who.admin, id, decision, who.email);
  if (res.error) return Response.json(res, { status: res.error === "introuvable" ? 404 : res.error === "deja_decidee" ? 409 : 500, headers: NO_STORE });
  return Response.json({ ok: true }, { headers: NO_STORE });
}
