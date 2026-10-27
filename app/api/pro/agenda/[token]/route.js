// Espace prestataire : agenda privé au format iCal (Disponibilités > Synchroniser mon agenda).
// Le lien contient le jeton secret de la fiche (pro_vendors.ical_token) ; Google Agenda, Apple Calendrier
// ou Outlook le relisent régulièrement. Dates réservées et options, avec le couple.
// Nécessite SUPABASE_SERVICE_ROLE_KEY côté serveur.

import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Texte iCal : virgules, points-virgules et retours à la ligne échappés
const esc = (s) => String(s || "").replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
const ymd = (d) => String(d).slice(0, 10).replace(/-/g, "");
const nextDay = (d) => {
  const x = new Date(`${String(d).slice(0, 10)}T00:00:00Z`);
  x.setUTCDate(x.getUTCDate() + 1);
  return x.toISOString().slice(0, 10).replace(/-/g, "");
};

export async function GET(_req, { params }) {
  const { token } = await params;
  const clean = String(token || "").replace(/\.ics$/, "");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !service) return new Response("Agenda indisponible", { status: 501 });
  if (!UUID_RE.test(clean)) return new Response("Agenda introuvable", { status: 404 });

  const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: pro } = await admin.from("pro_vendors").select("vendor_id").eq("ical_token", clean).maybeSingle();
  if (!pro) return new Response("Agenda introuvable", { status: 404 });
  const [{ data: vendor }, { data: dates }, { data: clients }] = await Promise.all([
    admin.schema("catalog").from("vendors").select("name").eq("id", pro.vendor_id).maybeSingle(),
    admin.from("pro_dates").select("id, day, status, client_id, label, expires_on, created_at").eq("vendor_id", pro.vendor_id),
    admin.from("pro_clients").select("id, names").eq("vendor_id", pro.vendor_id),
  ]);
  const names = new Map((clients || []).map((c) => [c.id, c.names]));
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");

  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Merry//Espace prestataire//FR", "CALSCALE:GREGORIAN", `X-WR-CALNAME:${esc(`Merry · ${vendor?.name || "Mes dates"}`)}`];
  for (const d of dates || []) {
    const who = names.get(d.client_id) || d.label || "";
    const what = d.status === "reserve" ? "Réservé" : "Option";
    lines.push(
      "BEGIN:VEVENT",
      `UID:${d.id}@merry`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${ymd(d.day)}`,
      `DTEND;VALUE=DATE:${nextDay(d.day)}`,
      `SUMMARY:${esc(who ? `${what} · ${who}` : what)}`,
      ...(d.status === "option" && d.expires_on ? [`DESCRIPTION:${esc(`Option, expire le ${d.expires_on}`)}`] : []),
      "TRANSP:TRANSPARENT",
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return new Response(lines.join("\r\n"), {
    headers: { "Content-Type": "text/calendar; charset=utf-8", "Cache-Control": "private, max-age=300" },
  });
}
