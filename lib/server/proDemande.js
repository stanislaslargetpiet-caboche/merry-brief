// Demande d'accès à une fiche prestataire (écrans V0g2, V0g2b, V0g, V0h3 du canvas, 5 nov. 2026) : la
// vérification des champs reçus, les crédits de bienvenue et la décision de Stan (valider ou refuser).
// Le code reçu par mail prouve seulement l'adresse du compte : la preuve que la fiche est bien au demandeur est un contrôle à la main, par mail
// ou par téléphone, auprès des coordonnées d'ORIGINE de la fiche (jamais celles que le demandeur vient de
// saisir : un faux demandeur aurait mis les siennes).

import { sendVendorWelcome } from "@/lib/server/vendorWelcome";
import { sendDemandeRefusee } from "@/lib/server/demandeVendorMails";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const welcomeCredits = () => Math.max(0, Number(process.env.MERRY_PRO_WELCOME_CREDITS ?? 100) || 0);

export const cleanEmail = (v) => String(v || "").trim().toLowerCase();
export const validEmail = (v) => {
  const e = cleanEmail(v);
  return e.length <= 160 && EMAIL_RE.test(e);
};

// Un numéro français ou international saisi à la main : espaces, points et tirets tolérés, 8 à 15 chiffres
export function cleanPhone(v) {
  return String(v || "").replace(/[\s.\-()]/g, "");
}
export function validPhone(v) {
  return /^(\+|00)?\d{8,15}$/.test(cleanPhone(v));
}

// Une coordonnée de la fiche : « oui » (la bonne), « non » (pas la bonne, la vraie est saisie), ou rien à
// confirmer quand la fiche n'en avait pas (la saisie est alors obligatoire).
function coord(raw, known, valid, clean) {
  const choice = raw?.choice === "oui" || raw?.choice === "non" ? raw.choice : null;
  const given = clean(raw?.given);
  if (known) {
    if (choice === "oui") return { ok: true, choice, given: null };
    if (choice === "non" && valid(given)) return { ok: true, choice, given };
    return { ok: false };
  }
  return valid(given) ? { ok: true, choice: null, given } : { ok: false };
}

// body : { coords: { email: { choice, given }, phone: { choice, given } }, account: { email, password, phone } }
// fiche : { hasEmail, hasPhone } d'après le catalogue ; signedIn : le compte existe déjà (autre fiche)
export function validateDemande(body, fiche, signedIn) {
  const email = coord(body?.coords?.email, fiche.hasEmail, validEmail, cleanEmail);
  if (!email.ok) return { ok: false, error: "coords_email" };
  const phone = coord(body?.coords?.phone, fiche.hasPhone, validPhone, cleanPhone);
  if (!phone.ok) return { ok: false, error: "coords_phone" };
  const account = { email: cleanEmail(body?.account?.email), password: body?.account?.password, phone: cleanPhone(body?.account?.phone) };
  if (!validPhone(account.phone)) return { ok: false, error: "account_phone" };
  if (!signedIn) {
    if (!validEmail(account.email)) return { ok: false, error: "account_email" };
    if (typeof account.password !== "string" || account.password.length < 8 || account.password.length > 72) return { ok: false, error: "bad_password" };
  }
  return { ok: true, value: { email, phone, account } };
}

// Une coordonnée a-t-elle été changée par le demandeur (« non » ou saisie sur une fiche qui n'en avait pas) ?
export const changedCoords = (row) => ({ email: Boolean(row.email_given), phone: Boolean(row.phone_given) });

// Valider : les coordonnées données remplacent celles de la fiche, la fiche devient vérifiée, les crédits de
// bienvenue sont versés et le mail de bienvenue part. Renvoie { ok } ou { error }.
export async function decideDemande(admin, id, decision, by) {
  const { data: claim } = await admin.from("pro_claims").select("*").eq("id", id).maybeSingle();
  if (!claim) return { error: "introuvable" };
  if (claim.status !== "en_attente") return { error: "deja_decidee" };
  const now = new Date().toISOString();

  if (decision === "refuser") {
    await admin.from("pro_members").delete().eq("vendor_id", claim.vendor_id).eq("user_id", claim.user_id);
    const { data: rest } = await admin.from("pro_members").select("id").eq("vendor_id", claim.vendor_id).limit(1);
    // Plus personne : la fiche redevient libre (le catalogue n'est pas touché), le compte du demandeur reste
    if (!rest?.length) await admin.from("pro_vendors").delete().eq("vendor_id", claim.vendor_id).eq("verification", "en_attente");
    await admin.from("pro_claims").update({ status: "refusee", decided_at: now, decided_by: by }).eq("id", id);
    // Le mail ne bloque jamais le refus
    try {
      const { data: v } = await admin.schema("catalog").from("vendors").select("name").eq("id", claim.vendor_id).maybeSingle();
      await sendDemandeRefusee({ to: claim.account_email, vendorName: v?.name });
    } catch (e) {
      console.warn("[merry] mail refus prestataire", e?.message || e);
    }
    return { ok: true };
  }

  const { data: fiche } = await admin.schema("catalog").from("vendors").select("status").eq("id", claim.vendor_id).maybeSingle();
  // Fiche créée par le demandeur : elle attendait cette validation pour apparaître côté couples
  const patch = fiche?.status === "candidate" ? { status: "active" } : {};
  if (claim.email_given) patch.email = claim.email_given;
  if (claim.phone_given) patch.phone = claim.phone_given;
  if (Object.keys(patch).length) {
    const { error } = await admin.schema("catalog").from("vendors").update(patch).eq("id", claim.vendor_id);
    if (error) return { error: "ecriture", message: error.message.slice(0, 200) };
  }
  const credits = welcomeCredits();
  const { data: pv } = await admin.from("pro_vendors").select("credits").eq("vendor_id", claim.vendor_id).maybeSingle();
  const grant = pv && pv.credits === 0 ? credits : 0;
  const { error: e1 } = await admin
    .from("pro_vendors")
    .update({ verification: "validee", verified_at: now, ...(grant ? { credits: grant } : {}) })
    .eq("vendor_id", claim.vendor_id);
  if (e1) return { error: "ecriture", message: e1.message.slice(0, 200) };
  if (grant) {
    await admin.from("pro_ledger").insert({ vendor_id: claim.vendor_id, kind: "remboursement", label: `Bienvenue sur Merry : ${grant} crédits offerts`, delta: grant, balance: grant });
  }
  await admin.from("pro_claims").update({ status: "validee", decided_at: now, decided_by: by }).eq("id", id);
  // Le mail ne bloque jamais la validation
  try {
    const { data: v } = await admin.schema("catalog").from("vendors").select("name").eq("id", claim.vendor_id).maybeSingle();
    await sendVendorWelcome({ to: claim.account_email, vendorName: v?.name, credits: grant });
  } catch (e) {
    console.warn("[merry] mail validation prestataire", e?.message || e);
  }
  return { ok: true };
}
