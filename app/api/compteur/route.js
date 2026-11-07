import { after } from "next/server";
import { compter, isEtape, isRobot, sourceOf } from "@/lib/compteur";

// Écrans de l'onboarding vus (components/Brief.js), comptés sans cookie : voir lib/compteur.js
export async function POST(req) {
  let body = {};
  try {
    body = JSON.parse(await req.text());
  } catch {
    /* corps illisible : rien à compter */
  }
  const etape = String(body.etape || "");
  if (!isEtape(etape) || etape === "site" || etape === "appli") return new Response(null, { status: 204 });
  if (isRobot(req.headers.get("user-agent"))) return new Response(null, { status: 204 });
  const site = (req.headers.get("host") || "").split(":")[0].toLowerCase();
  const send = compter({ etape, source: sourceOf(String(body.search || "")), site });
  if (send) after(send);
  return new Response(null, { status: 204 });
}
