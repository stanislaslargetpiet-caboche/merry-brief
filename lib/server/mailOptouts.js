// Désinscriptions des mails de notification (supabase/mail-desinscriptions.sql). Le lien d'un mail
// porte l'adresse et une signature : personne ne peut désinscrire une adresse sans avoir reçu ce mail.

import { createHmac, timingSafeEqual } from "node:crypto";

const clean = (email) => String(email || "").trim().toLowerCase();

function sign(email) {
  return createHmac("sha256", process.env.SUPABASE_SERVICE_ROLE_KEY || "").update(`desinscription:${clean(email)}`).digest("base64url");
}

export function unsubLink(origin, email) {
  const e = Buffer.from(clean(email)).toString("base64url");
  return `${origin}/desinscription?e=${e}&t=${sign(email)}`;
}

// Renvoie l'adresse si le lien est authentique, sinon null
export function readUnsubLink(e, t) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  const email = clean(Buffer.from(String(e || ""), "base64url").toString("utf8"));
  if (!email.includes("@")) return null;
  const given = Buffer.from(String(t || ""));
  const expected = Buffer.from(sign(email));
  return given.length === expected.length && timingSafeEqual(given, expected) ? email : null;
}

// Sans la table ou en cas d'erreur, personne n'est retiré : mieux vaut un mail de trop qu'une demande manquée
export async function optedOut(admin, emails, kind) {
  const list = [...new Set(emails.map(clean))];
  if (!list.length) return new Set();
  const { data, error } = await admin.from("mail_optouts").select("email").eq("kind", kind).in("email", list);
  if (error) {
    console.warn("[merry] désinscriptions illisibles", error.message);
    return new Set();
  }
  return new Set((data || []).map((r) => r.email));
}
