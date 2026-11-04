// Mail de bienvenue, envoyé juste après la confirmation d'adresse (retour du lien de
// confirmation Supabase sur /connexion, avant la redirection vers le tableau de bord).
// Nécessite RESEND_API_KEY côté serveur (Vercel > Settings > Environment Variables).
// Sans clé, la route répond 501 : la redirection vers le tableau de bord n'attend pas ce mail.

import { createClient } from "@supabase/supabase-js";
import { publicOrigin } from "@/lib/server/origin";
import { allowUser } from "@/lib/server/rate";
import { welcomeMail } from "@/lib/server/welcomeMail";
import { sendMail } from "@/lib/server/sendMail";
import { displayName } from "@/lib/server/names";

export const runtime = "nodejs";

export async function POST(req) {
  if (!process.env.RESEND_API_KEY) return Response.json({ error: "no_mail" }, { status: 501 });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!url || !key || !token) return Response.json({ error: "auth" }, { status: 401 });
  const sb = createClient(url, key, { auth: { persistSession: false }, global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data: user } = await sb.auth.getUser(token);
  if (!user?.user) return Response.json({ error: "auth" }, { status: 401 });
  const to = String(user.user.email || "").trim();
  if (!to) return Response.json({ error: "no_email" }, { status: 422 });

  if (!(await allowUser(sb, "welcome_mail", 1, 86400))) return Response.json({ error: "quota" }, { status: 429 });

  // Le mariage n'existe pas forcément encore à cet instant (il se crée au premier chargement du
  // tableau de bord à partir du questionnaire d'accueil) : on personnalise quand on peut, sinon
  // on retombe sur un mail générique plutôt que de bloquer l'envoi.
  const { data: member } = await sb.from("wedding_members").select("wedding_id").eq("user_id", user.user.id).maybeSingle();
  let couple = "";
  if (member?.wedding_id) {
    const { data: wedding } = await sb.from("weddings").select("partner1, partner2").eq("id", member.wedding_id).maybeSingle();
    couple = [wedding?.partner1, wedding?.partner2].filter(Boolean).map(displayName).join(" et ");
  }
  const meta = user.user.user_metadata || {};
  const greeting = couple || [meta.first_name, meta.partner_first_name].map(displayName).filter(Boolean).join(" et ");

  const origin = publicOrigin(req);
  const { subject, text, html } = welcomeMail({ greeting, link: `${origin}/dashboard`, assets: `${origin}/mail` });

  if (!(await sendMail({ to, subject, text, html, label: "mail bienvenue" }))) return Response.json({ error: "send_failed" }, { status: 502 });
  return Response.json({ ok: true, to });
}
