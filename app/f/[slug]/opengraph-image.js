import { ImageResponse } from "next/og";
import { fetchPublicForm, formTitle } from "@/lib/formServer";
import { formTheme } from "@/lib/dash/form";
import { longDate } from "@/lib/dash/format";
import { alanSans, climateCrisis } from "@/lib/og/fonts";

// Image de l'aperçu de lien (planches 3g du canvas, D-212), aux couleurs du formulaire. Avec une photo d'en-tête :
// la photo cadrée comme sur la page, la carte « Save the date » et la pastille « Créé avec Merry ». Sans photo :
// les prénoms en grand sur la couleur du couple, la date, et « Créé avec Merry » en bas.
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Formulaire des invités";
export const revalidate = 60;

const INK = "#1c1c1a";

// Prénoms en grand sans photo : plus le titre est long, plus il est petit, pour tenir sur deux lignes
const bigTitleSize = (title) => (title.length <= 16 ? 108 : title.length <= 28 ? 88 : 68);

function Merry({ logo, label }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
      <span style={{ fontSize: 22, fontWeight: 600, color: label }}>Créé avec</span>
      <span style={{ fontFamily: logo ? "Climate Crisis" : "Alan Sans", fontSize: 36, fontWeight: logo ? 400 : 700, lineHeight: 1, color: INK }}>Merry</span>
    </div>
  );
}

export default async function Image({ params }) {
  const { slug } = await params;
  const [form, fonts, logo] = await Promise.all([fetchPublicForm(slug), alanSans(), climateCrisis("Merry")]);
  const theme = formTheme(form?.theme);
  const title = formTitle(form);
  const date = longDate(form?.wedding_date);
  const pos = Number.isFinite(Number(form?.cover_position)) ? Number(form.cover_position) : 50;
  const photo = form?.cover_url && /^https:\/\//.test(form.cover_url) ? form.cover_url : null;
  const kicker = { fontSize: 22, letterSpacing: 4, textTransform: "uppercase", color: theme.accent, fontWeight: 700 };

  return new ImageResponse(
    photo ? (
      <div style={{ width: "100%", height: "100%", display: "flex", position: "relative", background: theme.deep, fontFamily: "Alan Sans", color: INK }}>
        <img src={photo} alt="" width={1200} height={630} style={{ position: "absolute", inset: 0, width: 1200, height: 630, objectFit: "cover", objectPosition: `50% ${pos}%` }} />
        <div style={{ position: "absolute", top: 44, right: 44, display: "flex", alignItems: "center", height: 76, padding: "0 32px", borderRadius: 999, background: "#ffffff" }}>
          <Merry logo={logo} label={theme.accent} />
        </div>
        <div style={{ position: "absolute", left: 48, bottom: 48, maxWidth: 1104, display: "flex", flexDirection: "column", gap: 8, padding: "22px 30px", borderRadius: 24, background: "#ffffff" }}>
          <div style={kicker}>Save the date</div>
          <div style={{ fontSize: 56, fontWeight: 700, lineHeight: 1.05 }}>{title}</div>
        </div>
      </div>
    ) : (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", background: theme.deep, fontFamily: "Alan Sans", color: INK }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 22, padding: "48px 80px 0" }}>
          <div style={{ ...kicker, fontSize: 24, letterSpacing: 5 }}>Save the date</div>
          <div style={{ fontSize: bigTitleSize(title), fontWeight: 700, lineHeight: 1, letterSpacing: -1, textAlign: "center" }}>{title}</div>
          {date ? (
            <div style={{ display: "flex", alignItems: "center", height: 60, padding: "0 28px", borderRadius: 999, background: "#ffffff", color: theme.accent, fontSize: 26, fontWeight: 700 }}>{date}</div>
          ) : null}
        </div>
        <div style={{ display: "flex", paddingBottom: 48, paddingTop: 24 }}>
          <Merry logo={logo} label={INK} />
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [...fonts, ...(logo ? [{ name: "Climate Crisis", data: logo, style: "normal", weight: 400 }] : [])],
    },
  );
}
