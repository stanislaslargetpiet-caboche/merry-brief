// Réglages > Supprimer mon compte : supprime le compte Supabase de la personne connectée.
// Ses places d'organisateur restent dans les mariages (user_id remis à vide), les données du mariage
// restent pour les autres organisateurs ; ses préférences et imports partent avec le compte (cascade).
// Nécessite SUPABASE_SERVICE_ROLE_KEY côté serveur ; sans clé, la route répond 501 et l'écran le dit.

import { createClient } from "@supabase/supabase-js";
import { mailShell } from "@/lib/server/mailShell";
import { sendMail } from "@/lib/server/sendMail";
import { renderMail } from "@/lib/server/mailTemplate";

export const runtime = "nodejs";

export async function DELETE(req) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !service) return Response.json({ error: "indisponible" }, { status: 501 });
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return Response.json({ error: "connexion" }, { status: 401 });

  const admin = createClient(url, service, { auth: { persistSession: false } });
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data?.user) return Response.json({ error: "connexion" }, { status: 401 });

  const { count } = await admin.from("wedding_members").select("id", { count: "exact", head: true }).eq("user_id", data.user.id);
  const { error: delErr } = await admin.auth.admin.deleteUser(data.user.id);
  if (delErr) return Response.json({ error: "echec" }, { status: 500 });
  // La suppression est faite : le mail de confirmation ne peut plus la faire échouer
  if (process.env.RESEND_API_KEY && data.user.email) {
    const subject = "Ton compte Merry est supprimé";
    const paras = [...(count ? ["Le mariage et ses données restent accessibles aux autres organisateurs."] : []), "Si cette suppression ne vient pas de toi, réponds à ce mail."];
    const body = renderMail({ title: `${subject}.`, paras, why: "Tu reçois ce mail pour confirmer la suppression de ton compte." });
    await sendMail({ to: data.user.email, subject, text: [`${subject}.`, ...paras].join("\n\n"), html: mailShell({ title: subject, preheader: "Ton compte a bien été supprimé.", body }), label: "compte supprimé" }).catch(() => {});
  }
  return Response.json({ ok: true });
}
