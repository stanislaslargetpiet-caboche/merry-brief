// Mail du samedi (section « Mail du samedi » de /pilotage) : aperçu et destinataires, envoi de test à la personne
// connectée, puis envoi réel. Même accès que le reste du pilotage (adresses de PILOTAGE_EMAILS).

import { requirePilot } from "@/lib/server/pilotage/auth";
import { issueState, sendIssue, sendTest } from "@/lib/server/nouveautes";
import { latestIssue } from "@/lib/server/nouveautesMail";
import { publicOrigin } from "@/lib/server/origin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const NO_STORE = { "cache-control": "private, no-store" };

export async function GET(req) {
  const who = await requirePilot(req);
  if (who.refus) return who.refus;
  try {
    return Response.json(await issueState(who.admin, latestIssue(), publicOrigin(req)), { headers: NO_STORE });
  } catch (e) {
    console.error("[merry] mail du samedi", e?.message || e);
    return Response.json({ error: "lecture" }, { status: 502, headers: NO_STORE });
  }
}

export async function POST(req) {
  const who = await requirePilot(req);
  if (who.refus) return who.refus;
  if (!process.env.RESEND_API_KEY) return Response.json({ error: "indisponible" }, { status: 501, headers: NO_STORE });
  const body = await req.json().catch(() => null);
  const issue = latestIssue();
  if (body?.numero !== issue.numero) return Response.json({ error: "invalide" }, { status: 400, headers: NO_STORE });
  const origin = publicOrigin(req);
  if (body.action === "test") {
    const ok = await sendTest(issue, origin, who.email);
    return Response.json(ok ? { ok, a: who.email } : { error: "envoi" }, { status: ok ? 200 : 502, headers: NO_STORE });
  }
  if (body.action !== "envoyer" || !Number.isInteger(body.attendu)) return Response.json({ error: "invalide" }, { status: 400, headers: NO_STORE });
  try {
    const res = await sendIssue(who.admin, issue, origin, body.attendu);
    return Response.json(res, { status: res.error ? 409 : 200, headers: NO_STORE });
  } catch (e) {
    console.error("[merry] mail du samedi", e?.message || e);
    return Response.json({ error: "lecture" }, { status: 502, headers: NO_STORE });
  }
}
