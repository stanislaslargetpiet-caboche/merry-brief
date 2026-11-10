import { ImageResponse } from "next/og";
import { fetchPublicForm } from "@/lib/formServer";
import { formTheme } from "@/lib/dash/form";

// Photo d'en-tête du formulaire pour le mail de confirmation (planche V49) : recadrée en bandeau comme sur la
// page, au cadrage choisi par le couple. Les messageries (Gmail surtout) ignorent object-fit : le recadrage se
// fait ici. 840 × 300, montrée à 560 × 200 dans le mail.

export const runtime = "nodejs";

export async function GET(req, { params }) {
  const { slug } = await params;
  const form = await fetchPublicForm(slug);
  const photo = form?.cover_url && /^https:\/\//.test(form.cover_url) ? form.cover_url : null;
  if (!photo) return new Response(null, { status: 404 });
  const pos = Number.isFinite(Number(form.cover_position)) ? Number(form.cover_position) : 50;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: formTheme(form.theme).deep }}>
        <img src={photo} alt="" width={840} height={300} style={{ width: 840, height: 300, objectFit: "cover", objectPosition: `50% ${pos}%` }} />
      </div>
    ),
    { width: 840, height: 300, headers: { "cache-control": "public, max-age=3600, s-maxage=86400" } },
  );
}
