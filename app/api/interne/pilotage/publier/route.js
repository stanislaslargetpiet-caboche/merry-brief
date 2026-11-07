// Dépôt des routines News of the Day et Feature of the Day dans la page Aujourd'hui du pilotage, et leur mémoire.
// POST : une ligne par rubrique et par jour, un second passage le même jour remplace le premier.
// GET : l'historique et les éditions récentes d'une rubrique, à relire pour ne pas se répéter.
// PUT : reprise de l'historique antérieur au pilotage, qui remplace le précédent.
// Accès par l'en-tête x-cron-key (PILOTAGE_PUBLIER_KEY), propre à cette route : les routines n'ont pas de session.

import { createClient } from "@supabase/supabase-js";
import { ecrireParCle, lireMemoire, remplacerHistorique } from "@/lib/server/pilotage/items";
import { parisDay } from "@/lib/server/pilotage/reseau";
import { validateHistorique, validateLectureMemoire, validatePublication } from "@/lib/pilotage/items";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "cache-control": "private, no-store" };

function acces(req) {
  const cle = process.env.PILOTAGE_PUBLIER_KEY;
  if (!cle || req.headers.get("x-cron-key") !== cle) return { refus: Response.json({ error: "interdit" }, { status: 403 }) };
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !service) return { refus: Response.json({ error: "indisponible" }, { status: 501 }) };
  return { admin: createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } }) };
}

export async function GET(req) {
  const { admin, refus } = acces(req);
  if (refus) return refus;
  const { searchParams } = new URL(req.url);
  const v = validateLectureMemoire(searchParams.get("rubrique"), searchParams.get("jours"), parisDay(Date.now()));
  if (!v.ok) return Response.json({ error: "invalide", champ: v.erreur }, { status: 400 });
  const { error, ...memoire } = await lireMemoire(admin, v.rubrique, v.depuis);
  if (error) {
    console.error("[merry] mémoire pilotage", error.message);
    return Response.json({ error: "lecture" }, { status: 502 });
  }
  return Response.json({ ok: true, ...memoire }, { headers: NO_STORE });
}

export async function POST(req) {
  const { admin, refus } = acces(req);
  if (refus) return refus;
  const v = validatePublication(await req.json().catch(() => null), parisDay(Date.now()));
  if (!v.ok) return Response.json({ error: "invalide", champ: v.erreur }, { status: 400 });
  const { error } = await ecrireParCle(admin, v.valeur);
  if (error) {
    console.error("[merry] publication pilotage", error.message);
    return Response.json({ error: "ecriture" }, { status: 500 });
  }
  return Response.json({ ok: true });
}

export async function PUT(req) {
  const { admin, refus } = acces(req);
  if (refus) return refus;
  const v = validateHistorique(await req.json().catch(() => null));
  if (!v.ok) return Response.json({ error: "invalide", champ: v.erreur }, { status: 400 });
  const { error } = await remplacerHistorique(admin, v.rubrique, v.lignes);
  if (error) {
    console.error("[merry] historique pilotage", error.message);
    return Response.json({ error: "ecriture" }, { status: 500 });
  }
  return Response.json({ ok: true, parties: v.lignes.length });
}
