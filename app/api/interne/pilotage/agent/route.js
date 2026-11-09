// Lance un agent sur un bug du pilotage : un audit (lecture seule) ou une réparation (une pull request, jamais fusionnée).
// Même accès que le reste du pilotage. L'agent est une routine Claude appelée par PILOTAGE_AGENT_URL avec le jeton
// PILOTAGE_AGENT_TOKEN ; sans eux, la route renvoie la consigne prête à coller dans une session Claude Code.

import { requirePilot } from "@/lib/server/pilotage/auth";
import { briefAgent, estAlerteBug, estBug, MODES_AGENT } from "@/lib/pilotage/agent";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "cache-control": "private, no-store" };
const validId = (id) => /^[0-9a-f-]{36}$/i.test(id);

export async function POST(req) {
  const who = await requirePilot(req);
  if (who.refus) return who.refus;
  const body = await req.json().catch(() => null);
  const mode = String(body?.mode ?? "");
  if (!MODES_AGENT.includes(mode)) return Response.json({ error: "invalide" }, { status: 400, headers: NO_STORE });
  let brief;
  if (body?.alerte) {
    // Une alerte du fil n'est pas une ligne de base : le pilotage envoie son texte, la route ne garde que celles qui parlent de bugs
    const titre = String(body.alerte.titre ?? "").slice(0, 300);
    if (!titre || !estAlerteBug(titre)) return Response.json({ error: "invalide" }, { status: 400, headers: NO_STORE });
    brief = briefAgent({ titre, detail: String(body.alerte.detail ?? "").slice(0, 1000) }, mode, true);
  } else {
    const id = String(body?.id ?? "");
    if (!validId(id)) return Response.json({ error: "invalide" }, { status: 400, headers: NO_STORE });
    const { data: item, error } = await who.admin.from("pilotage_items").select("id, titre, detail, projet, statut").eq("id", id).maybeSingle();
    if (error) return Response.json({ error: "lecture" }, { status: 502, headers: NO_STORE });
    if (!item || item.statut !== "a_faire" || !estBug(item)) return Response.json({ error: "introuvable" }, { status: 404, headers: NO_STORE });
    brief = briefAgent(item, mode);
  }
  const url = process.env.PILOTAGE_AGENT_URL;
  const jeton = process.env.PILOTAGE_AGENT_TOKEN;
  if (!url || !jeton) return Response.json({ ok: true, lance: false, brief }, { headers: NO_STORE });

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { authorization: `Bearer ${jeton}`, "content-type": "application/json", ...(process.env.PILOTAGE_AGENT_BETA ? { "anthropic-beta": process.env.PILOTAGE_AGENT_BETA } : {}) },
      body: JSON.stringify({ text: brief }),
      signal: AbortSignal.timeout(15000),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const raison = String(json?.error?.message || json?.message || "").slice(0, 160);
      console.error("[merry] agent pilotage", res.status, raison);
      return Response.json({ error: `agent refusé (${res.status})${raison ? ` : ${raison}` : ""}`, brief }, { status: 502, headers: NO_STORE });
    }
    return Response.json({ ok: true, lance: true, session: typeof json.claude_code_session_url === "string" ? json.claude_code_session_url : "" }, { headers: NO_STORE });
  } catch (e) {
    console.error("[merry] agent pilotage", e?.message || e);
    return Response.json({ error: `agent injoignable : ${String(e?.message || e).slice(0, 120)}`, brief }, { status: 502, headers: NO_STORE });
  }
}
