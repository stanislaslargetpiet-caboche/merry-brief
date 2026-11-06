import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { eventRow, verifySignature } from "@/lib/server/resendWebhook";
import { summarizeEvents } from "@/lib/server/pilotage/resend";

const secret = `whsec_${Buffer.from("cle-de-test-merry").toString("base64")}`;
const now = Date.parse("2026-11-06T14:00:00Z");
const ts = String(Math.floor(now / 1000));
const sign = (id, t, body) => `v1,${createHmac("sha256", Buffer.from("cle-de-test-merry")).update(`${id}.${t}.${body}`).digest("base64")}`;

describe("webhook Resend : signature", () => {
  const body = JSON.stringify({ type: "email.delivered", data: { email_id: "e1" } });
  it("accepte une signature valide", () => {
    expect(verifySignature({ secret, id: "msg_1", timestamp: ts, signature: sign("msg_1", ts, body), body, now })).toBe(true);
  });
  it("accepte une signature parmi plusieurs (rotation de clé)", () => {
    const header = `v1,AAAA ${sign("msg_1", ts, body)}`;
    expect(verifySignature({ secret, id: "msg_1", timestamp: ts, signature: header, body, now })).toBe(true);
  });
  it("refuse un corps modifié, un autre identifiant ou une autre clé", () => {
    const signature = sign("msg_1", ts, body);
    expect(verifySignature({ secret, id: "msg_1", timestamp: ts, signature, body: `${body} `, now })).toBe(false);
    expect(verifySignature({ secret, id: "msg_2", timestamp: ts, signature, body, now })).toBe(false);
    expect(verifySignature({ secret: `whsec_${Buffer.from("autre").toString("base64")}`, id: "msg_1", timestamp: ts, signature, body, now })).toBe(false);
  });
  it("refuse un appel trop ancien (rejeu) et les en-têtes manquants", () => {
    const old = String(Math.floor(now / 1000) - 600);
    expect(verifySignature({ secret, id: "msg_1", timestamp: old, signature: sign("msg_1", old, body), body, now })).toBe(false);
    expect(verifySignature({ secret, id: "msg_1", timestamp: ts, signature: "", body, now })).toBe(false);
    expect(verifySignature({ secret: "", id: "msg_1", timestamp: ts, signature: sign("msg_1", ts, body), body, now })).toBe(false);
  });
});

describe("webhook Resend : événement", () => {
  it("garde un clic avec son lien", () => {
    const row = eventRow("msg_9", {
      type: "email.clicked",
      created_at: "2026-11-06T13:00:00Z",
      data: { email_id: "e1", to: ["Emma@Example.com"], subject: "Ta réponse", click: { link: "https://app.withmerry.com/x" } },
    });
    expect(row).toMatchObject({ svix_id: "msg_9", email_id: "e1", type: "email.clicked", to_email: "emma@example.com", link: "https://app.withmerry.com/x" });
    expect(row.occurred_at).toBe("2026-11-06T13:00:00.000Z");
  });
  it("garde le type d'un rebond", () => {
    expect(eventRow("m", { type: "email.bounced", data: { email_id: "e2", to: ["a@b.fr"], bounce: { type: "Permanent" } } }).bounce_type).toBe("Permanent");
  });
  it("ignore un type non suivi ou un événement sans mail", () => {
    expect(eventRow("m", { type: "contact.created", data: { email_id: "e" } })).toBeNull();
    expect(eventRow("m", { type: "email.opened", data: {} })).toBeNull();
    expect(eventRow("", { type: "email.opened", data: { email_id: "e" } })).toBeNull();
  });
});

describe("pilotage : synthèse des événements", () => {
  it("compte chaque mail une fois par étape et calcule les taux sur les délivrés", () => {
    const s = summarizeEvents([
      { email_id: "a", type: "email.delivered" },
      { email_id: "a", type: "email.opened" },
      { email_id: "a", type: "email.opened" },
      { email_id: "a", type: "email.clicked" },
      { email_id: "b", type: "email.delivered" },
      { email_id: "c", type: "email.bounced" },
    ]);
    expect(s).toMatchObject({ actif: true, envoyes: 3, delivres: 2, ouverts: 1, cliques: 1, rebonds: 1, taux_ouverture: 50, taux_clic: 50 });
  });
  it("reste inactif sans événement", () => {
    expect(summarizeEvents([])).toMatchObject({ actif: false, envoyes: 0, taux_ouverture: null });
  });
});
