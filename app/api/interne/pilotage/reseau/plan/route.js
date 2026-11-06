// Actions sur le plan du jour de la section « Réseau » : corriger un message, cocher, reporter.
// Même accès que le reste du pilotage (adresses de PILOTAGE_EMAILS, jeton de session Supabase).

import { requirePilot } from "@/lib/server/pilotage/auth";
import { planStep } from "@/lib/server/pilotage/reseau";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "cache-control": "private, no-store" };
const fail = (error) => Response.json({ error: "ecriture", message: error.message.slice(0, 200) }, { status: 500, headers: NO_STORE });

export async function PATCH(req) {
  const who = await requirePilot(req);
  if (who.refus) return who.refus;
  const body = await req.json().catch(() => null);
  const id = String(body?.id ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) return Response.json({ error: "invalide" }, { status: 400, headers: NO_STORE });
  const { data: item, error: lecture } = await who.admin.from("pilotage_reseau_plan").select("id, creneau, contact_id, message").eq("id", id).maybeSingle();
  if (lecture) return fail(lecture);
  if (!item) return Response.json({ error: "introuvable" }, { status: 404, headers: NO_STORE });
  let contact = null;
  if (item.contact_id) {
    const { data, error } = await who.admin.from("pilotage_contacts").select("id, statut, canal, prochaine_action").eq("id", item.contact_id).maybeSingle();
    if (error) return fail(error);
    contact = data;
  }
  const step = planStep(item, contact, body);
  if (!step.ok) return Response.json({ error: "invalide", champ: step.erreur }, { status: 400, headers: NO_STORE });
  const { error } = await who.admin.from("pilotage_reseau_plan").update(step.ligne).eq("id", id);
  if (error) return fail(error);
  if (step.contact) {
    const { error: maj } = await who.admin.from("pilotage_contacts").update(step.contact).eq("id", item.contact_id);
    if (maj) return fail(maj);
  }
  if (step.echange) {
    const { error: journal } = await who.admin.from("pilotage_contact_echanges").insert(step.echange);
    if (journal) return fail(journal);
  }
  return Response.json({ ok: true }, { headers: NO_STORE });
}
