// Comptes de test, une seule liste pour le mail du samedi (écartés de l'envoi) et Couples › Par couple du pilotage
// (rangés en bas, en gris) : une adresse qui ressemble à un test ou à l'équipe, ou l'une de celles que Stan a
// désignées une à une (D-231). Le dépôt est public : ces adresses-là vivent hors du code, dans la variable
// COMPTES_TEST de Vercel, séparées par des virgules.

const MOTIF = /(test|demo|stanislas|largetpiet|larget-piet|largetstan|hugues|codron|@withmerry\.com$)/i;

const designees = (env) => new Set(String(env.COMPTES_TEST || "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean));

export const estAdresseTest = (email, env = process.env) => Boolean(email) && (MOTIF.test(email) || designees(env).has(String(email).trim().toLowerCase()));

// Un couple est un test quand il n'a aucun compte, que son créateur est un compte de test ou que tous ses comptes en
// sont : un vrai couple qui a invité Stan dans son équipe reste un vrai couple
export const estCoupleTest = (createur, emails, env = process.env) => !emails.length || estAdresseTest(createur, env) || emails.every((e) => estAdresseTest(e, env));
