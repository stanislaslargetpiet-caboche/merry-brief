// Mise en forme de la phrase de preuve (nombre et mois), sans dépendance : importable côté navigateur.

export function formatProof({ count, at }, lang = "fr") {
  const locale = lang === "en" ? "en-US" : "fr-FR";
  const number = new Intl.NumberFormat(locale).format(count).replace(/ | /g, " ");
  const month = new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(at);
  return { number, month };
}
