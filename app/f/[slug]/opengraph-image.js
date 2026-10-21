import { ImageResponse } from "next/og";
import { fetchPublicForm, formTitle } from "@/lib/formServer";
import { formTheme } from "@/lib/dash/form";

// Image de l'aperçu de lien : la photo d'en-tête, cadrée comme sur la page, avec le titre
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Formulaire des invités";
export const revalidate = 60;

export default async function Image({ params }) {
  const { slug } = await params;
  const form = await fetchPublicForm(slug);
  const theme = formTheme(form?.theme);
  const title = formTitle(form);
  const pos = Number.isFinite(Number(form?.cover_position)) ? Number(form.cover_position) : 50;
  const photo = form?.cover_url && /^https:\/\//.test(form.cover_url) ? form.cover_url : null;

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", position: "relative", background: theme.deep }}>
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} alt="" width={1200} height={630} style={{ position: "absolute", inset: 0, width: 1200, height: 630, objectFit: "cover", objectPosition: `50% ${pos}%` }} />
        ) : null}
        <div style={{ position: "absolute", left: 48, bottom: 48, display: "flex", flexDirection: "column", gap: 8, padding: "22px 30px", borderRadius: 24, background: "#ffffff" }}>
          <div style={{ fontSize: 22, letterSpacing: 4, textTransform: "uppercase", color: theme.accent, fontWeight: 600 }}>Save the date</div>
          <div style={{ fontSize: 56, fontWeight: 700, color: "#1c1c1a" }}>{title}</div>
        </div>
      </div>
    ),
    size,
  );
}
