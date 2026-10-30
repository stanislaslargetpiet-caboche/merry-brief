// Page SEO métier × zone (canvas « 8 - SEO », artboards SEO-Metier-Zone et SEO-Metier-Zone-Tel).
// Composant serveur : tout le texte est rendu dans le HTML, lisible par Google et par les moteurs IA.

import { APP_URL, euros, hasPage, hrefOf, statOf } from "@/lib/seo/data";
import { FRANCE, REGIONS, departmentsOf, regionZone, zoneOf } from "@/lib/seo/geo";
import { MEDIAN_LABEL, MEDIAN_PHRASE, TRADES } from "@/lib/seo/trades";

const SIGNUP = "/?source=seo";
const CLAIM = "/pro/fiche";
const SITE = "https://www.withmerry.com";

const ICONS = {
  seats: "M7 11V5.5A1.5 1.5 0 0 1 8.5 4h7A1.5 1.5 0 0 1 17 5.5V11M5 11h14v3H5zM7 14v6M17 14v6",
  beds: "M3 18V7M3 13h18v5M21 13v-2a3 3 0 0 0-3-3h-7v5",
  train: "M5.5 10.5h13M9 20l-1.5 1.5M15 20l1.5 1.5M9 13.5h.01M15 13.5h.01",
};

function SpecIcon({ name }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {name === "train" && <rect x="5.5" y="3.5" width="13" height="13" rx="3" />}
      <path d={ICONS[name]} />
      {name === "beds" && <circle cx="7" cy="10.5" r="1.8" />}
    </svg>
  );
}

function Heart() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1c1c1a" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.1a4.3 4.3 0 0 1 7.5 2.7C19.5 15.4 12 20 12 20z" />
    </svg>
  );
}

function VendorCard({ v, trade }) {
  return (
    <article className="sm-card">
      <div className="sm-photo">
        {v.photo ? <img src={v.photo} alt={v.name} loading="lazy" /> : <span>{trade.key === "lieu" ? "Photo du lieu à venir" : "Photo à venir"}</span>}
        <a href={SIGNUP} className="sm-heart" aria-label={`Ajouter ${v.name} à ma sélection`}>
          <Heart />
        </a>
      </div>
      <div className="sm-card-body">
        <div className="sm-card-name">
          <h3>{v.name}</h3>
          {v.area && (
            <div className="sm-area">
              <span>{v.area}</span>
            </div>
          )}
        </div>
        {v.specs.length > 0 && (
          <ul className="sm-specs">
            {v.specs.map((s) => (
              <li key={s.icon}>
                <SpecIcon name={s.icon} />
                {s.text}
              </li>
            ))}
          </ul>
        )}
        <div className="sm-card-price">
          {v.price ? (
            <span className="sm-price">
              <span className="sm-price-from">À partir de</span>
              <span className="sm-price-v">{v.price.value}</span>
              {v.price.unit && <span className="sm-price-from">{v.price.unit}</span>}
            </span>
          ) : (
            <span className="sm-price">
              <span className="sm-price-from">Prix sur demande</span>
            </span>
          )}
          <a href={SIGNUP} className="sm-link">
            Demander un devis
          </a>
        </div>
      </div>
    </article>
  );
}

// Le titre de la page, sans le point final : « Lieux de mariage en Île-de-France »
export function pageTitle(trade, zone) {
  return `${trade.title} ${zone.in}`;
}

export function pageDescription(trade, zone, stat) {
  const price = stat.median ? `, à partir de ${euros(stat.median)} en médiane` : "";
  return `${stat.n} ${trade.count} ${zone.in}${price}. Compare les prix et demande tes devis sur Merry, gratuitement.`;
}

function faqOf(trade, zone, stat, month) {
  const items = [];
  if (stat.median) {
    items.push({
      q: `Combien coûte ${trade.one} ${zone.in} ?`,
      a: `Compte ${euros(stat.median)} ${MEDIAN_PHRASE[trade.unit]} : c'est le prix de départ médian des ${stat.priced} ${trade.many} ${zone.in} qui affichent leur tarif sur Merry (${month}).`,
    });
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

  const figures = [{ value: String(stat.n), label: trade.count }];
  if (stat.median) figures.push({ value: euros(stat.median), label: `prix de départ médian, ${MEDIAN_LABEL[trade.unit]}` });
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

  return { stat, month, tabs, pills, elsewhere, figures, crumbs, faq: faqOf(trade, zone, stat, month) };
}

function jsonLd(trade, zone, model, vendors) {
  const url = `${APP_URL}${hrefOf(trade, zone)}`;
  const graph = [
    {
      "@type": "BreadcrumbList",
      itemListElement: model.crumbs.map((c, i) => ({ "@type": "ListItem", position: i + 1, name: c.label, item: c.href.startsWith("http") ? c.href : `${APP_URL}${c.href}` })),
    },
    {
      "@type": "FAQPage",
      mainEntity: model.faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
    },
    {
      "@type": "ItemList",
      name: pageTitle(trade, zone),
      url,
      itemListElement: vendors.map((v, i) => ({
        "@type": "ListItem",
        position: i + 1,
        item: { "@type": "LocalBusiness", name: v.name, address: { "@type": "PostalAddress", addressRegion: v.area || undefined, addressCountry: "FR" } },
      })),
    },
  ];
  // Un « < » dans un nom ne doit pas pouvoir fermer la balise script
  return JSON.stringify({ "@context": "https://schema.org", "@graph": graph }).replace(/</g, "\\u003c");
}

export default function TradeZonePage({ trade, zone, stats, vendors }) {
  const model = pageModel(trade, zone, stats);
  const { stat } = model;
  return (
    <div className="sm-root">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(trade, zone, model, vendors) }} />

      <header className="sm-top">
        <div className="sm-top-in">
          <a href={SITE} className="sm-logo">
            Merry
          </a>
          <a href={SIGNUP} className="sm-btn sm-btn-primary">
            J'organise
          </a>
        </div>
      </header>

      <main className="sm-wrap">
        <div className="sm-head">
          <nav aria-label="Fil d'Ariane" className="sm-crumbs">
            {model.crumbs.map((c, i) =>
              i < model.crumbs.length - 1 ? (
                <span key={c.href} className="sm-crumb">
                  <a href={c.href}>{c.label}</a>
                  <span aria-hidden="true">›</span>
                </span>
              ) : (
                <span key={c.href} aria-current="page">
                  {c.label}
                </span>
              ),
            )}
          </nav>
          <h1 className="sm-title">{pageTitle(trade, zone)}.</h1>
        </div>

        {model.tabs.length > 1 && (
          <nav aria-label="Métiers" className="sm-tabs">
            {model.tabs.map((t) => (
              <a key={t.href} href={t.href} className={t.on ? "is-on" : undefined} aria-current={t.on ? "page" : undefined}>
                {t.label}
              </a>
            ))}
          </nav>
        )}

        <section aria-label="Chiffres clés" className="sm-figs">
          {model.figures.map((f) => (
            <div key={f.label} className="sm-fig">
              <b>{f.value}</b>
              <span>{f.label}</span>
            </div>
          ))}
        </section>

        {model.pills.length > 1 && (
          <nav aria-label={zone.kind === "france" ? "Régions" : "Départements"} className="sm-pills">
            {model.pills.map((p) => (
              <a key={p.href} href={p.href} className={p.on ? "sm-pill is-on" : "sm-pill"} aria-current={p.on ? "page" : undefined}>
                {p.label}
              </a>
            ))}
          </nav>
        )}

        {vendors.length > 0 && (
          <section aria-labelledby="sm-sel" className="sm-sel">
            <h2 id="sm-sel" className="sm-h2">
              {trade.tab}.
            </h2>
            <div className="sm-grid">
              {vendors.map((v) => (
                <VendorCard key={v.id} v={v} trade={trade} />
              ))}
            </div>
            <a href={SIGNUP} className="sm-btn sm-btn-line sm-more">
              Voir les {stat.n} {trade.many}
            </a>
          </section>
        )}

        <section aria-label="Commencer" className="sm-cta">
          <div className="sm-cta-text">
            <p>Fais ton mariage sur Merry.</p>
            <span>Tu ne paies rien (oui).</span>
          </div>
          <a href={SIGNUP} className="sm-btn sm-btn-primary sm-btn-big">
            C'est parti
          </a>
        </section>

        <section aria-labelledby="sm-faq" className="sm-block">
          <h2 id="sm-faq" className="sm-h2">
            FAQ.
          </h2>
          <div className="sm-faq">
            {model.faq.map((f) => (
              <div key={f.q}>
                <h3>{f.q}</h3>
                <p>{f.a}</p>
              </div>
            ))}
          </div>
        </section>

        {model.elsewhere.length > 0 && (
          <section aria-labelledby="sm-ailleurs" className="sm-block">
            <h2 id="sm-ailleurs" className="sm-h2">
              {trade.tab} ailleurs en France.
            </h2>
            <nav aria-label="Autres régions" className="sm-pills sm-pills-wrap">
              {model.elsewhere.map((p) => (
                <a key={p.href} href={p.href} className="sm-pill">
                  {p.label}
                </a>
              ))}
            </nav>
          </section>
        )}

        <section aria-label="Pour les prestataires" className="sm-claim">
          <p>
            <b>{trade.claim}</b> Revendiquez votre fiche : 100 crédits offerts.
          </p>
          <a href={CLAIM} className="sm-btn sm-btn-line">
            Revendiquer ma fiche
          </a>
        </section>

        <p className="sm-src">Source : catalogue Merry, {model.month}.</p>
      </main>

      <div className="sm-bar">
        <a href={SIGNUP} className="sm-btn sm-btn-primary sm-btn-big">
          Fais mon mariage sur Merry
        </a>
      </div>
    </div>
  );
}
