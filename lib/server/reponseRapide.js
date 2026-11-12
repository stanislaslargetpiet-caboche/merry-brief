// Réponses en un clic sous le mail « un prestataire t'a répondu » (planche V56, leçon Mariages.net :
// répondre y est aussi simple que « Ça m'intéresse / Je réfléchis / Non, merci »). Le lien porte
// l'identifiant du client (pro_clients) et le choix, signés : personne ne peut répondre à la place du
// couple sans avoir reçu ce mail précis. /api/prestataires/reponse-rapide lit le lien, sans compte.

import { createHmac, timingSafeEqual } from "node:crypto";

export const QUICK_REPLIES = {
  interesse: "Ça m'intéresse, merci pour votre réponse !",
  reflechis: "Je réfléchis encore de mon côté, je reviens vers vous.",
  "non-merci": "Non merci, nous ne donnons pas suite à cette demande.",
};

function sign(clientId, choice) {
  return createHmac("sha256", process.env.SUPABASE_SERVICE_ROLE_KEY || "").update(`reponse-rapide:${clientId}:${choice}`).digest("base64url");
}

export function quickReplyLink(origin, clientId, choice) {
  return `${origin}/api/prestataires/reponse-rapide?c=${encodeURIComponent(clientId)}&r=${choice}&t=${sign(clientId, choice)}`;
}

// Renvoie le texte de la réponse si le lien est authentique et le choix valide, sinon null
export function readQuickReplyLink(clientId, choice, t) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !clientId || !QUICK_REPLIES[choice]) return null;
  const given = Buffer.from(String(t || ""));
  const expected = Buffer.from(sign(clientId, choice));
  return given.length === expected.length && timingSafeEqual(given, expected) ? QUICK_REPLIES[choice] : null;
}
