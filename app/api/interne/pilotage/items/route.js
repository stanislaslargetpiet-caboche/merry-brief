// Liste d'actions de /pilotage : lire, ajouter, cocher, reporter, modifier, supprimer, et retenir une alerte vue.
// Même accès que le reste du pilotage (adresses de PILOTAGE_EMAILS, jeton de session Supabase).

import { requirePilot } from "@/lib/server/pilotage/auth";
import { ecrireParCle, readItems } from "@/lib/server/pilotage/items";
import { parisDay } from "@/lib/server/pilotage/reseau";
import { itemAction, validateItem } from "@/lib/pilotage/items";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "cache-control": "private, no-store" };
const fail = (error) => Response.json({ error: "ecriture", message: error.message.slice(0, 200) }, { status: 500, headers: NO_STORE });
const invalide = (champ) => Response.json({ error: "invalide", champ }, { status: 400, headers: NO_STORE });
const validId = (id) => /^[0-9a-f-]{36}$/i.test(id);

export async function GET(req) {
  const who = await requirePilot(req);
  if (who.refus) return who.refus;
  try {
    return Response.json(await readItems(who.admin), { headers: NO_STORE });
  } catch (e) {
    console.error("[merry] liste d'actions", e?.message || e);
    return Response.json({ error: "lecture" }, { status: 502, headers: NO_STORE });
  }
}

export async function POST(req) {
  const who = await requirePilot(req);
  if (who.refus) return who.refus;
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return invalide("corps");
  if (body.alerte) {
    const cle = String(body.alerte);
    if (!cle.startsWith("alerte:") || cle.length > 320) return invalide("alerte");
    const { error } = await ecrireParCle(who.admin, { type: "alerte", titre: cle.slice(7, 307) || "Alerte", statut: "fait", fait_le: new Date().toISOString(), cle });
    return error ? fail(error) : Response.json({ ok: true }, { headers: NO_STORE });
  }
  const v = validateItem(body, { creation: true });
  if (!v.ok) return invalide(v.erreur);
  const { data, error } = await who.admin.from("pilotage_items").insert(v.valeur).select("id").single();
  if (error) return fail(error);
  return Response.json({ ok: true, id: data.id }, { headers: NO_STORE });
}

export async function PATCH(req) {
  const who = await requirePilot(req);
  if (who.refus) return who.refus;
  const body = await req.json().catch(() => null);
  const id = String(body?.id ?? "");
  if (!validId(id)) return invalide("id");
  const { data: item, error: lecture } = await who.admin.from("pilotage_items").select("id, echeance, recurrence").eq("id", id).maybeSingle();
  if (lecture) return fail(lecture);
  if (!item) return Response.json({ error: "introuvable" }, { status: 404, headers: NO_STORE });
  const plan = itemAction(item, body, parisDay(Date.now()));
  if (!plan.ok) return invalide(plan.erreur);
  const { error } = await who.admin.from("pilotage_items").update(plan.valeur).eq("id", id);
  return error ? fail(error) : Response.json({ ok: true }, { headers: NO_STORE });
}

export async function DELETE(req) {
  const who = await requirePilot(req);
  if (who.refus) return who.refus;
  const id = new URL(req.url).searchParams.get("id") || "";
  if (!validId(id)) return invalide("id");
  const { error } = await who.admin.from("pilotage_items").delete().eq("id", id);
  return error ? fail(error) : Response.json({ ok: true }, { headers: NO_STORE });
}
