// Webhooks Resend : vérification de la signature (Svix) et lecture d'un événement. Resend signe chaque appel
// avec HMAC-SHA256 sur « id.horodatage.corps », clé = RESEND_WEBHOOK_SECRET (« whsec_… », en base 64).

import { createHmac, timingSafeEqual } from "node:crypto";

const TOLERANCE_SECONDS = 300;

export const TRACKED = new Set([
  "email.sent",
  "email.delivered",
  "email.delivery_delayed",
  "email.opened",
  "email.clicked",
  "email.bounced",
  "email.complained",
  "email.failed",
  "email.suppressed",
]);

export function verifySignature({ secret, id, timestamp, signature, body, now = Date.now() }) {
  if (!secret || !id || !timestamp || !signature) return false;
  const age = Math.abs(now / 1000 - Number(timestamp));
  if (!Number.isFinite(age) || age > TOLERANCE_SECONDS) return false;
  const key = Buffer.from(String(secret).replace(/^whsec_/, ""), "base64");
  const expected = createHmac("sha256", key).update(`${id}.${timestamp}.${body}`).digest();
  // L'en-tête peut porter plusieurs signatures (rotation de clé) : « v1,xxx v1,yyy »
  return String(signature).split(" ").some((part) => {
    const [version, value] = part.split(",");
    if (version !== "v1" || !value) return false;
    const got = Buffer.from(value, "base64");
    return got.length === expected.length && timingSafeEqual(got, expected);
  });
}

export function eventRow(svixId, event) {
  const data = event?.data || {};
  if (!svixId || !TRACKED.has(event?.type) || !data.email_id) return null;
  const to = Array.isArray(data.to) ? data.to[0] : data.to;
  const when = Date.parse(event.created_at || data.created_at);
  return {
    svix_id: svixId,
    email_id: String(data.email_id),
    type: event.type,
    to_email: to ? String(to).toLowerCase().slice(0, 254) : null,
    subject: data.subject ? String(data.subject).slice(0, 200) : null,
    link: data.click?.link ? String(data.click.link).slice(0, 500) : null,
    bounce_type: data.bounce?.type ? String(data.bounce.type).slice(0, 40) : null,
    occurred_at: new Date(Number.isFinite(when) ? when : Date.now()).toISOString(),
  };
}
