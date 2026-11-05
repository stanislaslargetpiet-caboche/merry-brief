// Saisie des coûts de la page /pilotage : ajouter ou retirer une dépense du registre pilotage_couts.
// Même accès que le reste du pilotage (adresses de PILOTAGE_EMAILS, jeton de session Supabase).

import { requirePilot } from "@/lib/server/pilotage/auth";
import { validateCout } from "@/lib/server/pilotage/couts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "cache-control": "private, no-store" };

export async function POST(req) {
  const who = await requirePilot(req);
  if (who.refus) return who.refus;
  const body = await req.json().catch(() => null);
  const v = validateCout(body);
  if (!v.ok) return Response.json({ error: "invalide", champ: v.erreur }, { status: 400, headers: NO_STORE });
  const { data, error } = await who.admin.from("pilotage_couts").insert(v.valeur).select("id").single();
  if (error) return Response.json({ error: "ecriture", message: error.message.slice(0, 200) }, { status: 500, headers: NO_STORE });
  return Response.json({ ok: true, id: data.id }, { headers: NO_STORE });
}

export async function DELETE(req) {
  const who = await requirePilot(req);
  if (who.refus) return who.refus;
  const id = new URL(req.url).searchParams.get("id") || "";
  if (!/^[0-9a-f-]{36}$/i.test(id)) return Response.json({ error: "invalide" }, { status: 400, headers: NO_STORE });
  const { error } = await who.admin.from("pilotage_couts").delete().eq("id", id);
  if (error) return Response.json({ error: "ecriture", message: error.message.slice(0, 200) }, { status: 500, headers: NO_STORE });
  return Response.json({ ok: true }, { headers: NO_STORE });
}
