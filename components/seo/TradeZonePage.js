// Page SEO métier × zone (canvas « 8 - SEO », artboards SEO-Metier-Zone et SEO-Metier-Zone-Tel).
// Composant serveur : tout le texte est rendu dans le HTML, lisible par Google et par les moteurs IA.

import { PUBLIC_URL, hrefOf, num } from "@/lib/seo/data";
import { pageDescription, pageModel, pageTitle } from "@/lib/seo/model";
import ScrollNav from "./ScrollNav";

// Gardés ici pour les appelants existants ; le calcul vit dans lib/seo/model.js
export { pageDescription, pageModel, pageTitle };

// Les pages sont servies sur www.withmerry.com : l'inscription et l'espace pro restent sur l'appli
const SIGNUP = "https://app.withmerry.com/?source=seo";
const CLAIM = "https://app.withmerry.com/pro/fiche";
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
        {v.photo ? <img src={v.photo} alt={v.name} loading="lazy" decoding="async" width={640} height={420} /> : <span>{trade.key === "lieu" ? "Photo du lieu à venir" : "Photo à venir"}</span>}
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
            {trade.quote === false ? "Contacter la boutique" : "Demander un devis"}
          </a>
        </div>
      </div>
    </article>
  );
}

function jsonLd(trade, zone, model, vendors) {
  const url = `${PUBLIC_URL}${hrefOf(trade, zone)}`;
  const graph = [
    {
      "@type": "BreadcrumbList",
      itemListElement: model.crumbs.map((c, i) => ({ "@type": "ListItem", position: i + 1, name: c.label, item: c.href.startsWith("http") ? c.href : `${PUBLIC_URL}${c.href}` })),
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
          <a href={SIGNUP} className="sm-btn sm-btn-lime">
            J'organise
          </a>
        </div>
      </header>

      <main className="sm-wrap">
        <div className="sm-head">
          <h1 className="sm-title">{pageTitle(trade, zone)}.</h1>
          <p className="sm-intro">{model.intro}</p>
        </div>

        {model.pills.length > 1 && (
          <ScrollNav aria-label={zone.kind === "france" ? "Régions" : "Départements"} className="sm-pills">
            {model.pills.map((p) => (
              <a key={p.href} href={p.href} className={p.on ? "sm-pill is-on" : "sm-pill"} aria-current={p.on ? "page" : undefined}>
                {p.label}
              </a>
            ))}
          </ScrollNav>
        )}

        {vendors.length > 0 && (
          <section aria-labelledby="sm-sel" className="sm-sel">
            <h2 id="sm-sel" className="sm-h2 sm-sr">
              {trade.tab}.
            </h2>
            <div className="sm-grid">
              {vendors.map((v) => (
                <VendorCard key={v.id} v={v} trade={trade} />
              ))}
            </div>
            {stat.n > vendors.length && (
              <a href={SIGNUP} className="sm-btn sm-btn-line sm-more">
                Voir les {num(stat.n)} {trade.many}
              </a>
            )}
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

        {model.tabs.length > 1 && (
          <section aria-labelledby="sm-metiers" className="sm-block">
            <h2 id="sm-metiers" className="sm-h2">
              Autres métiers.
            </h2>
            <nav aria-label="Métiers" className="sm-pills sm-pills-wrap">
              {model.tabs
                .filter((t) => !t.on)
                .map((t) => (
                  <a key={t.href} href={t.href} className="sm-pill">
                    {t.label}
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

        <p className="sm-src">{model.source}.</p>
      </main>

      <div className="sm-bar">
        <a href={SIGNUP} className="sm-btn sm-btn-lime sm-btn-big">
          Fais mon mariage sur Merry
        </a>
      </div>
    </div>
  );
}
