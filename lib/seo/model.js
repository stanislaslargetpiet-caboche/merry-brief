// Calcul des pages SEO métier × zone : titre, description, questions, onglets, chiffres. Fonctions pures,
// séparées de l'affichage (components/seo/TradeZonePage.js) pour être testées (tests/seoTrades.test.js).

import { euros, ficheHref, hasPage, hrefOf, num, statOf } from "./data";
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
  items.push({
    q: "Merry, c'est vraiment gratuit ?",
    a: `Oui. 100 % gratuit pour toi (pas 99 %). Les ${trade.many} paient en crédits pour te répondre.`,
  });
  return items;
}

const rating = new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 2 });
const stars = new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

// Le bloc « En chiffres » (D-287) : quatre comptes de la zone, ceux qui valent zéro en moins, rien sous deux
function numbersOf(trade, stat) {
  const l = stat.local;
  if (!l) return [];
  const note = l.notes ? rating.format(l.note) : null;
  const list =
    trade.key === "lieu"
      ? [
          [l.heberg, "avec hébergement"],
          [l.cap150, "pour 150 invités assis et plus"],
          [l.ceremonie, "avec cérémonie sur place"],
          [note, `note Google, ${num(l.avis)} avis`],
        ]
      : [
          [note, "note Google moyenne"],
          [l.avis, "avis Google"],
          [l.tres_bien_notes, "notés 4,8 et plus"],
          [l.avis100, "avec 100 avis et plus"],
        ];
  const out = list.filter(([v]) => v).map(([v, label]) => ({ value: typeof v === "number" ? num(v) : v, label }));
  return out.length >= 2 ? out : [];
}

// Une réponse qui cite des fiches : des morceaux de texte et des liens, et le même texte à plat pour les données structurées
function linked(q, parts) {
  return { q, a: parts.map((p) => (typeof p === "string" ? p : p.label)).join(""), parts };
}

// « A, B et C », chaque élément étant lui-même une suite de morceaux
function listOf(items) {
  return items.flatMap((item, i) => [i === 0 ? "" : i === items.length - 1 ? " et " : ", ", ...item]).filter(Boolean);
}

// Chaque fiche en lien, son détail entre parenthèses : l'unité au premier exemple seulement, le département sauf sur
// une page départementale. « Domaine Le Mezo (250 couchages, Morbihan), Le Manoir d'Alexandre (119, Morbihan) »
function cite(examples, zone, detail) {
  return listOf(
    examples.map((v, i) => {
      const bits = [detail(v, i === 0), zone.kind === "department" ? "" : v.area].filter(Boolean);
      return [{ label: v.name, href: ficheHref(v.id) }, bits.length ? ` (${bits.join(", ")})` : ""];
    }),
  );
}

// « 7 min de Dol-de-Bretagne », « 8 min d'Auray »
function fromStation({ minutes, name }) {
  const n = String(name || "").trim();
  if (!n) return `${minutes} min d'une gare TGV`;
  return `${minutes} min ${/^[aeiouyàâéèêîôûh]/i.test(n) ? "d'" : "de "}${n}`;
}

// Où sont les prestataires : les départements de la région, ou les régions de France, en liens vers leurs pages
function spreadOf(trade, zone, stats) {
  if (zone.kind === "department") return null;
  const subs = zone.kind === "france" ? REGIONS.map((r) => regionZone(r.name)) : departmentsOf(zone.region).map((d) => zoneOf(d.slug));
  const list = subs
    .map((z) => ({ z, n: statOf(stats, trade, z).n }))
    .filter((x) => x.n > 0)
    .sort((a, b) => b.n - a.n || a.z.name.localeCompare(b.z.name, "fr"))
    .slice(0, 6);
  if (list.length < 2) return null;
  const parts = listOf(
    list.map(({ z, n }) => {
      const prep = z.in.endsWith(z.name) ? z.in.slice(0, -z.name.length) : `${z.in} `;
      return [`${num(n)} ${prep}`, hasPage(stats, trade, z) ? { label: z.name, href: hrefOf(trade, z) } : z.name];
    }),
  );
  return linked(`${trade.near} dans ${zone.kind === "france" ? "ta région" : "ton département"} ?`, [...parts, "."]);
}

// Les questions propres à la zone, avant le prix et la gratuité. Une question ne paraît qu'avec au moins deux
// fiches comptées et une fiche à citer.
function localFaq(trade, zone, stats, stat, examples) {
  const l = stat.local;
  if (!l) return [];
  const ex = (k) => examples?.[k] || [];
  const items = [];
  if (trade.key === "lieu") {
    if (l.heberg >= 2 && ex("heberg").length) {
      const list = cite(ex("heberg"), zone, (v, first) => (first ? `${num(v.beds)} couchages` : num(v.beds)));
      items.push(linked(`Quels lieux de mariage avec hébergement ${zone.in} ?`, [`${num(l.heberg)} lieux ${zone.in} ont des couchages sur place. Les plus grands : `, ...list, "."]));
    }
    if (l.cap150 >= 2 && ex("cap150").length) {
      const list = cite(ex("cap150"), zone, (v, first) => (first ? `${num(v.seats)} places` : num(v.seats)));
      items.push(linked(`Un lieu pour 150 invités ${zone.in} ?`, [`${num(l.cap150)} lieux ${zone.in} reçoivent 150 invités assis ou plus. Par exemple `, ...list, "."]));
    }
    if (l.gare30 >= 2 && ex("gare30").length) {
      const list = cite(ex("gare30"), zone, (v) => fromStation(v.station));
      items.push(linked(`Un lieu de mariage près d'une gare ${zone.in} ?`, [`${num(l.gare30)} lieux ${zone.in} sont à moins de 30 minutes d'une gare TGV. Les plus proches : `, ...list, "."]));
    }
    return items;
  }
  if (l.tres_bien_notes >= 2 && ex("notes").length) {
    const list = cite(ex("notes"), zone, (v) => `${stars.format(v.rating)} sur ${num(v.reviews)} avis`);
    items.push(linked(`${trade.best} ${zone.in} ?`, [`${num(l.tres_bien_notes)} ${trade.count} ${zone.in} ont 4,8 ou plus sur au moins 20 avis Google. En tête : `, ...list, "."]));
  }
  const spread = spreadOf(trade, zone, stats);
  if (spread) items.push(spread);
  return items;
}

// Le paragraphe propre à chaque page : où se trouvent les prestataires et quelle part de la France ils pèsent.
// Que des comptes du catalogue, aucun texte interchangeable d'une zone à l'autre.
function introOf(trade, zone, stats, stat, region) {
  const top = (zones, limit) =>
    zones
      .map((z) => ({ name: z.name, n: statOf(stats, trade, z).n }))
      .filter((z) => z.n > 0)
      .sort((a, b) => b.n - a.n || a.name.localeCompare(b.name, "fr"))
      .slice(0, limit)
      .map((z) => `${z.name} (${num(z.n)})`)
      .join(", ");
  const total = statOf(stats, trade, FRANCE).n;
  if (zone.kind === "france") {
    const regions = REGIONS.map((r) => regionZone(r.name));
    return `Merry référence ${num(stat.n)} ${trade.count} en France. Les régions les mieux fournies : ${top(regions, 3)}.`;
  }
  const share = total ? Math.max(1, Math.round((stat.n / total) * 100)) : 0;
  if (zone.kind === "region") {
    const deps = departmentsOf(zone.region).map((d) => zoneOf(d.slug));
    const withVendors = deps.filter((z) => statOf(stats, trade, z).n > 0);
    return `${num(stat.n)} ${trade.count} ${zone.in}, soit ${share} % des ${num(total)} de France, répartis dans ${withVendors.length} départements. Les plus fournis : ${top(withVendors, 3)}.`;
  }
  const mates = departmentsOf(region.region)
    .map((d) => zoneOf(d.slug))
    .filter((z) => z.slug !== zone.slug);
  const near = top(mates, 3);
  return `${num(stat.n)} ${trade.count} ${zone.in}, soit ${share} % des ${num(total)} de France.${near ? ` Dans la même région : ${near}.` : ""}`;
}

// Ce qui sert à la fois à la page et aux données structurées. `examples` : les fiches citées par la FAQ locale (getExamples).
export function pageModel(trade, zone, stats, examples) {
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
  const numbers = numbersOf(trade, stat);
  const google = numbers.some((f) => f.label.includes("Google"));
  const merry = `catalogue Merry${google ? " et notes Google" : ""}, ${month}`;
  const source = national ? `Sources : ${merry} ; ${national.source}` : `${google ? "Sources" : "Source"} : ${merry}`;
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

  const faq = [...localFaq(trade, zone, stats, stat, examples), ...faqOf(trade, zone, stat, month)];
  return { stat, month, intro: introOf(trade, zone, stats, stat, region), source, tabs, pills, elsewhere, figures, numbers, crumbs, faq };
}
