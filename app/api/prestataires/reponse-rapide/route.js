// Enregistre une réponse en un clic depuis le mail « un prestataire t'a répondu » (planche V56), sans
// connexion : le lien signé (lib/server/reponseRapide) suffit. Puis renvoie vers la messagerie, où la
// réponse apparaît déjà envoyée — un clic suffit, même pour dire non.

import { createClient } from "@supabase/supabase-js";
import { publicOrigin } from "@/lib/server/origin";
import { readQuickReplyLink } from "@/lib/server/reponseRapide";

export const runtime = "nodejs";

export async function GET(req) {
  const origin = publicOrigin(req);
  const target = `${origin}/dashboard/prestataires/messagerie`;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !service) return Response.redirect(target, 302);

  const { searchParams } = new URL(req.url);
  const clientId = searchParams.get("c") || "";
  const choice = searchParams.get("r") || "";
  const body = readQuickReplyLink(clientId, choice, searchParams.get("t"));
  if (!body) return Response.redirect(target, 302);

  const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: client } = await admin.from("pro_clients").select("pick_id, vendor_id").eq("id", clientId).maybeSingle();
  const { data: pick } = client ? await admin.from("vendor_picks").select("wedding_id").eq("id", client.pick_id).maybeSingle() : { data: null };
  if (client && pick) {
    await admin
      .from("vendor_messages")
      .insert({ wedding_id: pick.wedding_id, vendor_id: client.vendor_id, from_vendor: false, author_id: null, body, sent_at: new Date().toISOString() });
  }
  return Response.redirect(target, 302);
}
