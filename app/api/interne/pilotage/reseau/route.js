// Actions de la section « Réseau » de /pilotage : ajouter un contact, cocher, reporter, valider, écarter, changer de statut.
// Même accès que le reste du pilotage (adresses de PILOTAGE_EMAILS, jeton de session Supabase).

import { requirePilot } from "@/lib/server/pilotage/auth";
import { planAction, validateContact } from "@/lib/server/pilotage/reseau";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "cache-control": "private, no-store" };
const fail = (error) => Response.json({ error: "ecriture", message: error.message.slice(0, 200) }, { status: 500, headers: NO_STORE });

export async function POST(req) {
  const who = await requirePilot(req);
  if (who.refus) return who.refus;
  const body = await req.json().catch(() => null);
  const v = validateContact(body);
  if (!v.ok) return Response.json({ error: "invalide", champ: v.erreur }, { status: 400, headers: NO_STORE });
  const { data, error } = await who.admin.from("pilotage_contacts").insert(v.valeur).select("id").single();
  if (error?.code === "23505") return Response.json({ error: "existe" }, { status: 409, headers: NO_STORE });
  if (error) return fail(error);
  return Response.json({ ok: true, id: data.id }, { headers: NO_STORE });
}

export async function PATCH(req) {
  const who = await requirePilot(req);
  if (who.refus) return who.refus;
  const body = await req.json().catch(() => null);
  const id = String(body?.id ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) return Response.json({ error: "invalide" }, { status: 400, headers: NO_STORE });
  const { data: contact, error: lecture } = await who.admin.from("pilotage_contacts").select("id, statut, canal, prochaine_action").eq("id", id).maybeSingle();
  if (lecture) return fail(lecture);
  if (!contact) return Response.json({ error: "introuvable" }, { status: 404, headers: NO_STORE });
  const plan = planAction(contact, body);
  if (!plan.ok) return Response.json({ error: "invalide", champ: plan.erreur }, { status: 400, headers: NO_STORE });
  const { error } = await who.admin.from("pilotage_contacts").update(plan.valeur).eq("id", id);
  if (error) return fail(error);
  if (plan.echange) {
    const { error: journal } = await who.admin.from("pilotage_contact_echanges").insert(plan.echange);
    if (journal) return fail(journal);
  }
  return Response.json({ ok: true }, { headers: NO_STORE });
}
