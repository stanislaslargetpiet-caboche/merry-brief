// Qui peut lire la page de pilotage : PILOTAGE_EMAILS (adresses séparées par des virgules), sinon celles de Stan.

const DEFAULT_EMAILS = ["stanislas.largetpiet@gmail.com", "largetstan@gmail.com"];

export function allowedEmails(env = process.env) {
  const raw = String(env.PILOTAGE_EMAILS || "").trim();
  const list = raw ? raw.split(/[,\s]+/).filter(Boolean) : DEFAULT_EMAILS;
  return new Set(list.map((e) => e.toLowerCase()));
}
