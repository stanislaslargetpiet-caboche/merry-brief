import { getStats } from "@/lib/seo/data";
import { TRADES } from "@/lib/seo/trades";

// Phrase de preuve « Plus de 15 000 prestataires référencés (octobre 2026) » : calculée depuis le catalogue
// (somme des établissements actifs par métier, arrondie au millier inférieur) et datée du jour du calcul,
// pour ne pas vieillir dans le code. Sans chiffres (local sans clé), le dernier chiffre connu reste affiché.
const FALLBACK = { count: 15000, at: new Date("2026-10-01") };

export function countVendors(stats) {
  if (!stats?.stats) return null;
  const total = TRADES.reduce((sum, trade) => sum + (stats.stats[trade.slug]?.france?.n || 0), 0);
  return total >= 1000 ? Math.floor(total / 1000) * 1000 : null;
}

export async function getProof() {
  const stats = await getStats().catch(() => null);
  const count = countVendors(stats);
  const at = count && stats?.at ? new Date(stats.at) : FALLBACK.at;
  return { count: count || FALLBACK.count, at };
}

export function formatProof({ count, at }, lang = "fr") {
  const locale = lang === "en" ? "en-US" : "fr-FR";
  const number = new Intl.NumberFormat(locale).format(count).replace(/ | /g, " ");
  const month = new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(at);
  return { number, month };
}
