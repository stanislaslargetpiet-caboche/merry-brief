// Accès au pilotage (Coulisses › Accès). POST { action: "demander" } : tout compte connecté qui n'a pas accès laisse
// une demande, et l'équipe reçoit un mail à la première. POST { action: "approuver" | "refuser" | "retirer", email } :
// réservé au pilotage ; l'approbation envoie un mail à la personne.

import { deciderAcces, demanderAcces } from "@/lib/server/pilotage/acces";
import { sendAccesOuvert, sendDemandeAcces } from "@/lib/server/pilotage/accesMail";
import { requirePilot, requireSession } from "@/lib/server/pilotage/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "cache-control": "private, no-store" };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const STATUS = { invalide: 400, introuvable: 404, permanent: 409, indisponible: 501 };

export async function POST(req) {
  const body = await req.json().catch(() => null);
  try {
    if (body?.action === "demander") {
      const who = await requireSession(req);
      if (who.refus) return who.refus;
      const res = await demanderAcces(who.admin, who.email);
      if (res.error) return Response.json(res, { status: STATUS[res.error] || 500, headers: NO_STORE });
      if (res.nouvelle) await sendDemandeAcces(who.email);
      return Response.json({ statut: res.statut }, { headers: NO_STORE });
    }
    const who = await requirePilot(req);
    if (who.refus) return who.refus;
    const email = String(body?.email || "").trim().toLowerCase();
    if (!EMAIL_RE.test(email) || email.length > 160) return Response.json({ error: "invalide" }, { status: 400, headers: NO_STORE });
    const res = await deciderAcces(who.admin, email, body?.action, who.email);
    if (res.error) return Response.json(res, { status: STATUS[res.error] || 500, headers: NO_STORE });
    if (res.statut === "approuve") await sendAccesOuvert(email);
    console.info("[merry] accès pilotage", who.email, body.action, email);
    return Response.json(res, { headers: NO_STORE });
  } catch (e) {
    console.error("[merry] accès pilotage", e?.message || e);
    return Response.json({ error: "erreur" }, { status: 500, headers: NO_STORE });
  }
}
