// Lance un agent sur un bug du pilotage : un audit (lecture seule) ou une réparation (une pull request, jamais fusionnée).
// Même accès que le reste du pilotage. L'agent est une routine Claude appelée par PILOTAGE_AGENT_URL avec le jeton
// PILOTAGE_AGENT_TOKEN ; sans eux, la route renvoie la consigne prête à coller dans une session Claude Code.

import { requirePilot } from "@/lib/server/pilotage/auth";
import { randomBytes, randomUUID } from "node:crypto";
import { briefAgent, estAlerteBug, estBug, MODES_AGENT } from "@/lib/pilotage/agent";
import { publicOrigin } from "@/lib/server/origin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "cache-control": "private, no-store" };
const validId = (id) => /^[0-9a-f-]{36}$/i.test(id);

// Les rapports déjà rendus ou attendus : { cle, mode, statut, session, texte, maj_le } ; sans la table, une liste vide
export async function GET(req) {
  const who = await requirePilot(req);
  if (who.refus) return who.refus;
  const { data, error } = await who.admin.from("pilotage_rapports").select("cle, mode, statut, session, texte, maj_le").order("maj_le", { ascending: false }).limit(100);
  if (error) return Response.json({ rapports: [] }, { headers: NO_STORE });
  return Response.json({ rapports: data || [] }, { headers: NO_STORE });
}

export async function POST(req) {
  const who = await requirePilot(req);
  if (who.refus) return who.refus;
  const body = await req.json().catch(() => null);
  const mode = String(body?.mode ?? "");
  if (!MODES_AGENT.includes(mode)) return Response.json({ error: "invalide" }, { status: 400, headers: NO_STORE });
  let source;
  if (body?.alerte) {
    // Une alerte du fil n'est pas une ligne de base : le pilotage envoie son texte, la route ne garde que celles qui parlent de bugs
    const titre = String(body.alerte.titre ?? "").slice(0, 300);
    if (!titre || !estAlerteBug(titre)) return Response.json({ error: "invalide" }, { status: 400, headers: NO_STORE });
    source = { item: { titre, detail: String(body.alerte.detail ?? "").slice(0, 1000) }, alerte: true };
  } else {
    const id = String(body?.id ?? "");
    if (!validId(id)) return Response.json({ error: "invalide" }, { status: 400, headers: NO_STORE });
    const { data: item, error } = await who.admin.from("pilotage_items").select("id, titre, detail, projet, statut").eq("id", id).maybeSingle();
    if (error) return Response.json({ error: "lecture" }, { status: 502, headers: NO_STORE });
    if (!item || item.statut !== "a_faire" || !estBug(item)) return Response.json({ error: "introuvable" }, { status: 404, headers: NO_STORE });
    source = { item, alerte: false };
  }
  const url = process.env.PILOTAGE_AGENT_URL;
  const jeton = process.env.PILOTAGE_AGENT_TOKEN;
  if (!url || !jeton) return Response.json({ ok: true, lance: false, brief: briefAgent(source.item, mode, source.alerte) }, { headers: NO_STORE });

  // Le compte rendu revient au pilotage : une ligne par bug ou alerte, avec un jeton à usage unique que l'agent renvoie.
  // Sans la table (SQL pas encore collé) ou sans clé de ligne, l'agent part quand même, sans retour.
  const cle = String(body?.cle ?? "").slice(0, 320);
  let retour = null;
  if (cle) {
    const rapport = { id: randomUUID(), jeton: randomBytes(24).toString("hex") };
    const { error } = await who.admin.from("pilotage_rapports").upsert({ ...rapport, cle, mode, statut: "en_cours", session: "", texte: "", maj_le: new Date().toISOString() }, { onConflict: "cle" });
    if (error) console.error("[merry] rapport pilotage", error.message);
    else retour = { ...rapport, url: `${publicOrigin(req)}/api/interne/pilotage/agent/rapport` };
  }
  const brief = briefAgent(source.item, mode, source.alerte, retour);
  const abandon = () => (retour ? who.admin.from("pilotage_rapports").delete().eq("id", retour.id) : null);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { authorization: `Bearer ${jeton}`, "content-type": "application/json", "anthropic-version": "2023-06-01", ...(process.env.PILOTAGE_AGENT_BETA ? { "anthropic-beta": process.env.PILOTAGE_AGENT_BETA } : {}) },
      body: JSON.stringify({ text: brief }),
      signal: AbortSignal.timeout(15000),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const raison = String(json?.error?.message || json?.message || "").slice(0, 160);
      console.error("[merry] agent pilotage", res.status, raison);
      await abandon();
      return Response.json({ error: `agent refusé (${res.status})${raison ? ` : ${raison}` : ""}`, brief }, { status: 502, headers: NO_STORE });
    }
    const session = typeof json.claude_code_session_url === "string" ? json.claude_code_session_url : "";
    if (retour && session) await who.admin.from("pilotage_rapports").update({ session }).eq("id", retour.id);
    return Response.json({ ok: true, lance: true, session }, { headers: NO_STORE });
  } catch (e) {
    console.error("[merry] agent pilotage", e?.message || e);
    await abandon();
    return Response.json({ error: `agent injoignable : ${String(e?.message || e).slice(0, 120)}`, brief }, { status: 502, headers: NO_STORE });
  }
}
