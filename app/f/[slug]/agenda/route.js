import { fetchPublicForm } from "@/lib/formServer";
import { publicOrigin } from "@/lib/server/origin";
import { agendaEvent, googleAgendaUrl, icsFile, wantsIcs } from "@/lib/server/formAgenda";

// Bouton « Ajouter à mon agenda » du mail de confirmation (lib/server/formConfirmationMail.js) : un fichier
// .ics sur un appareil Apple (ou avec ?format=ics), Google Agenda ailleurs. Formulaire sans date : retour au
// formulaire. Rien que ce que la page publique montre déjà (prénoms, date, lieu).

export const runtime = "nodejs";

export async function GET(req, { params }) {
  const { slug } = await params;
  const origin = publicOrigin(req);
  const form = await fetchPublicForm(slug);
  if (!form) return Response.redirect(origin, 302);
  const link = `${origin}/f/${slug}`;
  const ev = agendaEvent(form);
  if (!ev) return Response.redirect(link, 302);
  const details = `Formulaire des invités : ${link}`;
  if (wantsIcs(req.headers.get("user-agent")) || new URL(req.url).searchParams.get("format") === "ics") {
    return new Response(icsFile(ev, { uid: `${slug}-${ev.start}@withmerry.com`, details }), {
      headers: { "content-type": "text/calendar; charset=utf-8", "content-disposition": 'inline; filename="mariage.ics"', "cache-control": "private, no-store" },
    });
  }
  return Response.redirect(googleAgendaUrl(ev, details), 302);
}
