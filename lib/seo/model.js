// Calcul des pages SEO métier × zone : titre, description, questions, onglets, chiffres. Fonctions pures,
// séparées de l'affichage (components/seo/TradeZonePage.js) pour être testées (tests/seoTrades.test.js).

import { euros, hasPage, hrefOf, num, statOf } from "./data";
import { FRANCE, REGIONS, departmentsOf, regionZone, zoneOf } from "./geo";
import { MEDIAN_LABEL, MEDIAN_PHRASE, NATIONAL, TRADES } from "./trades";

const SITE = "https://www.withmerry.com";

// Le titre de la page, sans le point final : « Lieux de mariage en Île-de-France »
export function pageTitle(trade, zone) {
  return `${trade.title} ${zone.in}`;
}

export function pageDescription(trade, zone, stat) {
  const price = stat.median ? `, à partir de ${euros(stat.median)} en médiane` : "";
  const compare = trade.priced === false ? "Compare-les" : "Compare les prix";
  const ask = trade.quote === false ? "contacte-les" : "demande tes devis";
  return `${num(stat.n)} ${trade.count} ${zone.in}${price}. ${compare} et ${ask} sur Merry, gratuitement.`;
}

function faqOf(trade, zone, stat, month) {
  const items = [];
  if (stat.median) {
    items.push({
      q: `Combien coûte ${trade.one} ${zone.in} ?`,
      a: `Compte ${euros(stat.median)} ${MEDIAN_PHRASE[trade.unit]} : c'est le prix de départ médian des ${stat.priced} ${trade.many} ${zone.in} qui affichent leur tarif sur Merry (${month}).`,
    });
  } else if (NATIONAL[trade.slug]) {
    items.push({ q: `Combien coûte ${trade.one} ?`, a: NATIONAL[trade.slug].answer });
  }
  if (trade.key === "lieu") {
    items.push({
      q: "Je réserve mon lieu combien de temps avant ?",
      a: "Tôt. Un mariage se prépare en 15 mois en moyenne (Mariages.net, rapport 2026), et c'est le lieu qui fixe la date.",
    });
  }
  items.push({ q: "Quel budget pour un mariage ?", a: "19 293 € en moyenne en France, pour 90 invités (Mariages.net, rapport 2026)." });
  items.push({
    q: "Merry, c'est vraiment gratuit ?",
    a: `Oui. 100 % gratuit pour toi (pas 99 %). Les ${trade.many} paient en crédits pour te répondre.`,
  });
  return items;
}

// Ce qui sert à la fois à la page et aux données structurées
export function pageModel(trade, zone, stats) {
  const stat = statOf(stats, trade, zone);
  const month = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" }).format(stats?.at ? new Date(stats.at) : new Date());
  const region = zone.kind === "department" ? regionZone(zone.region) : zone.kind === "region" ? zone : null;

  const tabs = TRADES.filter((t) => t.slug === trade.slug || hasPage(stats, t, zone)).map((t) => ({ label: t.tab, href: hrefOf(t, zone), on: t.slug === trade.slug }));

  let pills = [];
  if (zone.kind === "france") {
    pills = REGIONS.map((r) => regionZone(r.name))
      .filter((z) => hasPage(stats, trade, z))
      .map((z) => ({ label: z.name, href: hrefOf(trade, z), on: false }));
  } else {
    const deps = departmentsOf(region.region)
      .map((d) => zoneOf(d.slug))
      .filter((z) => hasPage(stats, trade, z));
    pills = [
      { label: zone.kind === "region" ? `Toute la région` : region.name, href: hrefOf(trade, region), on: zone.kind === "region" },
      ...deps.map((z) => ({ label: z.name, href: hrefOf(trade, z), on: z.slug === zone.slug })),
    ];
  }

  const elsewhere =
    zone.kind === "france"
      ? []
      : REGIONS.map((r) => regionZone(r.name))
          .filter((z) => z.slug !== region.slug && hasPage(stats, trade, z))
          .map((z) => ({ label: z.name, href: hrefOf(trade, z) }));

  const figures = [{ value: num(stat.n), label: trade.count }];
  const national = stat.median ? null : NATIONAL[trade.slug] || null;
  if (stat.median) figures.push({ value: euros(stat.median), label: `prix de départ médian, ${MEDIAN_LABEL[trade.unit]}` });
  else if (national) figures.push({ value: national.value, label: national.label });
  const source = national ? `Sources : catalogue Merry, ${month} ; ${national.source}` : `Source : catalogue Merry, ${month}`;
  if (zone.kind === "region") {
    const n = departmentsOf(zone.region).filter((d) => statOf(stats, trade, zoneOf(d.slug)).n > 0).length;
    if (n > 1) figures.push({ value: String(n), label: "départements" });
  }
  if (zone.kind === "france") {
    const n = REGIONS.filter((r) => statOf(stats, trade, regionZone(r.name)).n > 0).length;
    figures.push({ value: String(n), label: "régions" });
  }

  const crumbs = [{ label: "Mariage", href: SITE }];
  crumbs.push({ label: trade.tab, href: hrefOf(trade, FRANCE) });
  if (zone.kind === "department") crumbs.push({ label: region.name, href: hrefOf(trade, region) });
  if (zone.kind !== "france") crumbs.push({ label: zone.name, href: hrefOf(trade, zone) });

  return { stat, month, source, tabs, pills, elsewhere, figures, crumbs, faq: faqOf(trade, zone, stat, month) };
}
