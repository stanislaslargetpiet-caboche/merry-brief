"use client";

// Lecture d'un devis ou d'une facture par l'IA, pour remplir la fiche prestataire.
// Le fichier est découpé comme pour l'import des invités (pages de PDF, photo, texte),
// chaque partie est lue, et les réponses sont fusionnées : la première valeur trouvée gagne.

import { supabase } from "@/lib/supabase";
import { readFile } from "./importRead";

const MAX_PARTS = 3;

function merge(acc, found) {
  if (!found) return acc;
  const out = { ...acc };
  for (const [k, v] of Object.entries(found)) {
    if (k === "installments") out.installments = [...(acc.installments || []), ...(Array.isArray(v) ? v : [])];
    else if (v !== null && v !== undefined && v !== "" && (out[k] === null || out[k] === undefined || out[k] === "")) out[k] = v;
  }
  return out;
}

// Renvoie { ok, found } ou { ok: false, reason: "off" | "quota" | "unsupported" | "failed", note }
export async function readVendorDocument(file, vendor) {
  if (!supabase) return { ok: false, reason: "off" };
  let parsed;
  try {
    parsed = await readFile(file);
  } catch (e) {
    return { ok: false, reason: "unsupported", note: e?.note || "Format non reconnu : essayez un PDF, une photo ou un document Word." };
  }
  const units = (parsed.units || []).slice(0, MAX_PARTS);
  if (!units.length) return { ok: false, reason: "unsupported", note: "Rien à lire dans ce fichier." };
  const { data: sess } = await supabase.auth.getSession();
  const token = sess?.session?.access_token;
  let found = { installments: [] };
  let any = false;
  for (const u of units) {
    const res = await fetch("/api/lire-prestataire", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({ source: { name: file.name, ...u }, vendor: vendor ? { name: vendor.name, category: vendor.category, contact_name: vendor.contact_name, email: vendor.email, phone: vendor.phone } : null }),
    });
    if (res.status === 501) return { ok: false, reason: "off" };
    if (res.status === 429) return { ok: false, reason: "quota" };
    if (!res.ok) continue;
    const out = await res.json();
    if (out.found) {
      found = merge(found, out.found);
      any = true;
    }
  }
  if (!any) return { ok: false, reason: "failed" };
  return { ok: true, found };
}

// Récupère un document déjà déposé sous forme de File, pour le relire
export async function fetchDocumentFile(dash, doc) {
  const url = await dash.documentUrl(doc);
  if (!url) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return new File([blob], doc.name || "document", { type: doc.mime || blob.type || "application/octet-stream" });
  } catch {
    return null;
  }
}

// Champs de la fiche prestataire que l'IA peut remplir, dans l'ordre d'affichage
export const VENDOR_FIELDS = [
  ["name", "Nom"],
  ["category", "Métier"],
  ["contact_name", "Interlocuteur"],
  ["contact_role", "Rôle"],
  ["phone", "Téléphone"],
  ["email", "Mail"],
  ["website", "Site"],
  ["iban", "IBAN"],
  ["bic", "BIC"],
  ["account_holder", "Titulaire du compte"],
];
