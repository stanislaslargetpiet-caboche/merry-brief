// Fiche publique d'un prestataire, ouverte depuis une carte des pages SEO. Pas de coordonnées : le contact passe par Merry.

import { PUBLIC_URL, hasPage, hrefOf } from "@/lib/seo/data";
import { FRANCE, zoneOf } from "@/lib/seo/geo";
import { SHARE_IMAGE } from "@/lib/site";
import { SpecIcon } from "./TradeZonePage";

const SIGNUP = "https://app.withmerry.com/?source=seo";

export const ficheHref = (id) => `/mariage/prestataire/${id}`;

export function ficheMetadata(v) {
  const title = `${v.name}${v.area ? `, ${v.area}` : ""} | Merry`;
  const description = `${v.name} : ${v.trade.one}${v.department ? ` ${v.department.in}` : ""}. Photos, prix et demande de devis sur Merry.`;
  const url = `${PUBLIC_URL}${ficheHref(v.id)}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    // Fiches fines : elles servent à la navigation, pas encore au référencement
    robots: { index: false, follow: true },
    openGraph: { title, description, url, siteName: "Merry", locale: "fr_FR", type: "website", images: [{ url: SHARE_IMAGE, width: 1200, height: 630 }] },
    twitter: { card: "summary_large_image", images: [SHARE_IMAGE] },
  };
}

export default function VendorFichePage({ vendor: v, stats }) {
  const { trade } = v;
  const dep = v.department && zoneOf(v.department.slug);
  const back = dep && stats && hasPage(stats, trade, dep) ? { href: hrefOf(trade, dep), label: `${trade.tab} ${dep.in}` } : { href: hrefOf(trade, FRANCE), label: trade.tab };
  const [cover, ...rest] = v.photos;
  return (
    <div className="sm-root">
      <main id="contenu" tabIndex={-1} className="sm-wrap">
        <div className="sm-head">
          <nav aria-label="Retour" className="sm-crumbs">
            <a href={back.href}>← {back.label}</a>
          </nav>
          <h1 className="sm-title">{v.name}</h1>
          {v.area && (
            <div className="sm-area">
              <span>{v.area}</span>
            </div>
          )}
        </div>

        <div className="sm-fiche">
          <div className="sm-fiche-photos">
            {cover ? <img className="sm-fiche-cover" src={cover} alt={v.name} width={1200} height={800} decoding="async" /> : <div className="sm-fiche-cover sm-photo-empty">{trade.key === "lieu" ? "Photo du lieu à venir" : "Photo à venir"}</div>}
            {rest.length > 0 && (
              <div className="sm-fiche-more">
                {rest.map((src) => (
                  <img key={src} src={src} alt="" loading="lazy" decoding="async" width={400} height={300} />
                ))}
              </div>
            )}
          </div>

          <aside className="sm-fiche-side">
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
            <span className="sm-price">
              {v.price ? (
                <>
                  <span className="sm-price-from">À partir de</span>
                  <span className="sm-price-v">{v.price.value}</span>
                  {v.price.unit && <span className="sm-price-from">{v.price.unit}</span>}
                </>
              ) : (
                <span className="sm-price-from">Prix sur demande</span>
              )}
            </span>
            <a href={SIGNUP} className="sm-btn sm-btn-primary sm-btn-big">
              {trade.quote === false ? "Contacter la boutique" : "Demander un devis"}
            </a>
          </aside>
        </div>
      </main>

      <div className="sm-bar">
        <a href={SIGNUP} className="sm-btn sm-btn-lime sm-btn-big">
          {trade.quote === false ? "Contacter la boutique" : "Demander un devis"}
        </a>
      </div>
    </div>
  );
}
