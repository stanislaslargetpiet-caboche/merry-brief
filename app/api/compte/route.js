// Réglages > Supprimer mon compte : supprime le compte Supabase de la personne connectée (D-130). Chacun de ses
// mariages part avec lui (fichiers, mails envoyés, données en cascade) sauf si un autre organisateur y a un compte :
// le mariage reste alors pour lui, sa place y est remise à vide. Ses préférences, ses briefs et ses imports partent
// avec le compte (cascade). GET : ce qui partira, pour la fenêtre de confirmation.
// Nécessite SUPABASE_SERVICE_ROLE_KEY côté serveur ; sans clé, la route répond 501 et l'écran le dit.

import { createClient } from "@supabase/supabase-js";
import { effacerMariage, mariagesDuCompte, retirerMails } from "@/lib/server/effacement";
import { mailShell } from "@/lib/server/mailShell";
import { sendMail } from "@/lib/server/sendMail";
import { renderMail } from "@/lib/server/mailTemplate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "cache-control": "private, no-store" };

async function connecte(req) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !service) return { refus: Response.json({ error: "indisponible" }, { status: 501, headers: NO_STORE }) };
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return { refus: Response.json({ error: "connexion" }, { status: 401, headers: NO_STORE }) };
  const admin = createClient(url, service, { auth: { persistSession: false } });
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data?.user) return { refus: Response.json({ error: "connexion" }, { status: 401, headers: NO_STORE }) };
  return { admin, user: data.user };
}

export async function GET(req) {
  const who = await connecte(req);
  if (who.refus) return who.refus;
  try {
    const mariages = await mariagesDuCompte(who.admin, who.user.id);
    return Response.json({ mariages: mariages.map(({ couple, autres }) => ({ couple, autres })) }, { headers: NO_STORE });
  } catch (e) {
    console.error("[merry] compte, lecture", e?.message || e);
    return Response.json({ error: "lecture" }, { status: 502, headers: NO_STORE });
  }
}

export async function DELETE(req) {
  const who = await connecte(req);
  if (who.refus) return who.refus;
  const { admin, user } = who;

  let mariages;
  try {
    mariages = await mariagesDuCompte(admin, user.id);
    // Les mariages d'abord : si une étape échoue, le compte est encore là et la suppression peut être relancée
    for (const m of mariages) if (!m.autres.length) await effacerMariage(admin, m.id);
    await retirerMails(admin, null, [user.email]);
  } catch (e) {
    console.error("[merry] compte, suppression", e?.message || e);
    return Response.json({ error: "echec" }, { status: 500, headers: NO_STORE });
  }
  const { error: delErr } = await admin.auth.admin.deleteUser(user.id);
  if (delErr) return Response.json({ error: "echec" }, { status: 500, headers: NO_STORE });

  // La suppression est faite : le mail de confirmation ne peut plus la faire échouer
  if (process.env.RESEND_API_KEY && user.email) {
    const subject = "Ton compte Merry est supprimé";
    const gardes = mariages.some((m) => m.autres.length);
    const effaces = mariages.some((m) => !m.autres.length);
    const paras = [
      ...(effaces ? ["Le mariage et ses données sont supprimés avec lui."] : []),
      ...(gardes ? ["Le mariage et ses données restent accessibles aux autres organisateurs."] : []),
      "Si cette suppression ne vient pas de toi, réponds à ce mail.",
    ];
    const body = renderMail({ title: `${subject}.`, paras, why: "Tu reçois ce mail pour confirmer la suppression de ton compte." });
    await sendMail({ to: user.email, subject, text: [`${subject}.`, ...paras].join("\n\n"), html: mailShell({ title: subject, preheader: "Ton compte a bien été supprimé.", body }), label: "compte supprimé" }).catch(() => {});
  }
  return Response.json({ ok: true }, { headers: NO_STORE });
}
