// Mail « le lieu est réservé, prochaine étape le traiteur » (planche V64, leçon Mariages.net), envoyé une
// fois par mariage la première fois qu'un poste « lieu » a un devis signé. Appelé depuis
// components/dash/PosteModal.js. Toujours en best-effort : le devis reste de toute façon enregistré.

import { createClient } from "@supabase/supabase-js";
import { publicOrigin } from "@/lib/server/origin";
import { allowUser } from "@/lib/server/rate";
import { lieuSigneMail } from "@/lib/server/lieuSigneMail";
import { deliver } from "@/lib/server/mailJobs";

export const runtime = "nodejs";

export async function POST(req) {
  if (!process.env.RESEND_API_KEY) return Response.json({ error: "no_mail" }, { status: 501 });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!url || !key || !service || !token) return Response.json({ error: "auth" }, { status: 401 });
  const sb = createClient(url, key, { auth: { persistSession: false }, global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data: user } = await sb.auth.getUser(token);
  const to = String(user?.user?.email || "").trim();
  if (!user?.user || !to) return Response.json({ error: "auth" }, { status: 401 });

  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }
  const weddingId = String(body.weddingId || "");
  const lieuName = String(body.lieuName || "").slice(0, 120).trim() || "Ton lieu";
  if (!weddingId) return Response.json({ error: "bad_request" }, { status: 400 });

  // Lue avec le jeton de l'appelant : les règles d'accès (is_wedding_member) suffisent à vérifier
  // qu'il organise bien ce mariage.
  const { data: wedding } = await sb.from("weddings").select("region").eq("id", weddingId).maybeSingle();
  if (!wedding) return Response.json({ error: "not_found" }, { status: 404 });

  if (!(await allowUser(sb, "couple_mail", 60, 86400))) return Response.json({ error: "quota" }, { status: 429 });

  let traiteurs = [];
  if (wedding.region) {
    const { data } = await sb
      .schema("catalog")
      .from("vendors")
      .select("name, city")
      .eq("primary_category", "traiteur")
      .eq("region", wedding.region)
      .order("wedding_signal", { ascending: false })
      .limit(3);
    traiteurs = data || [];
  }

  const link = `${publicOrigin(req)}/dashboard/prestataires`;
  const mail = lieuSigneMail({ lieuName, traiteurs, link });
  const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
  const sent = await deliver(admin, `lecon-v64:${weddingId}`, { to, ...mail, label: "lieu signé" });
  return Response.json({ ok: true, sent });
}
