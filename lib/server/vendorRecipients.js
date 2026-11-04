// Qui prévenir pour une fiche : son adresse et les comptes qui la gèrent, sans les désinscrits.
// Renvoie une Map adresse → lien. Sans accès serveur ou sans la fonction SQL, l'adresse de la fiche seule.

import { optedOut } from "@/lib/server/mailOptouts";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function vendorRecipients(admin, { contact, catalogId, origin }) {
  const recipients = new Map();
  const address = String(contact || "").trim();
  if (EMAIL_RE.test(address)) recipients.set(address.toLowerCase(), `${origin}/pro${catalogId ? `?fiche=${catalogId}` : ""}`);
  if (admin && catalogId) {
    const { data: members } = await admin.rpc("pro_notify_vendor_members", { v: catalogId });
    for (const m of members || []) {
      const email = String(m.to_email || "").trim();
      if (EMAIL_RE.test(email)) recipients.set(email.toLowerCase(), `${origin}/pro?fiche=${catalogId}&connexion=1`);
    }
  }
  return recipients;
}

export async function dropOptedOut(admin, recipients, kind) {
  for (const email of await optedOut(admin, [...recipients.keys()], kind)) recipients.delete(email);
  return recipients;
}
