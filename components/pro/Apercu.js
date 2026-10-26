"use client";

// Aperçu côté couples (maquettes V2b et V2n) : la carte des résultats et la fiche ouverte, telles que
// les montre la page Prestataires des couples. La carte est celle du tableau de bord des couples
// (VendorCard), construite par la même fonction (fromCatalog) à partir de la fiche du prestataire.

import { useState } from "react";
import { usePro } from "@/lib/pro/store";
import { fromCatalog } from "@/lib/dash/catalog";
import { euros } from "@/lib/dash/format";
import { MiniMap, Negotiated, VendorCard } from "@/components/dash/Prestataires";
import { Icon } from "@/components/dash/icons";
import { ProIcon } from "./icons";
import { Sheet } from "./ui";
import { CloseBtn } from "./FeatureDialog";

// La fiche telle qu'elle sortirait du catalogue, avec les choix du prestataire déjà appliqués
export function coupleView(d) {
  const row = d.vendor;
  const det = row.details || {};
  const pick = (key, column) => (det[key] === true || det[key] === false ? det[key] : row[column ?? key]);
  const merged = {
    ...row,
    caterer_imposed: pick("caterer_imposed"),
    parking: pick("parking"),
    accessible: pick("accessible"),
    outdoor_ceremony: pick("outdoor_ceremony"),
  };
  const v = fromCatalog(merged, (d.photos || []).map((p) => p.url).filter(Boolean), null);
  const first = [...(d.formulas || [])].sort((a, b) => (a.position ?? 0) - (b.position ?? 0))[0];
  return {
    ...v,
    place: [row.city, row.department && /^\d/.test(row.department) ? null : row.department].filter(Boolean).join(", ") || v.area,
    rating: row.google_rating ? { score: String(row.google_rating).replace(".", ","), count: row.google_review_count || 0 } : null,
    included: first?.includes?.length ? first.includes : null,
    story: row.description || null,
    where: [row.city ? `Près de ${row.city}` : null, v.access].filter(Boolean).join(" · "),
  };
}

export default function Apercu({ onClose }) {
  const pro = usePro();
  const v = coupleView(pro.data);
  const photos = v.photos?.length ? v.photos : [null];
  const [i, setI] = useState(0);
  const n = Math.max(photos.length, 5);
  const cur = photos[i] || null;

  return (
    <Sheet labelledBy="apercu-titre" onClose={onClose} className="p-apercu">
      <div className="p-apercu-head">
        <div>
          <h2 id="apercu-titre">Aperçu côté couples</h2>
          <span>Votre fiche telle qu’elle apparaît sur la page Prestataires des couples.</span>
        </div>
        <CloseBtn onClose={onClose} label="Fermer l’aperçu" />
      </div>
      <div className="p-apercu-body">
        <div className="p-apercu-col is-card">
          <span className="p-apercu-label">Dans les résultats</span>
          <VendorCard v={v} picked={false} onToggle={() => {}} onOpen={() => {}} />
          <p className="p-apercu-note">Exemple de carte dans les résultats d’un couple. « Pourquoi ce lieu » reprend la première phrase de votre présentation.</p>
        </div>
        <div className="p-apercu-col">
          <span className="p-apercu-label">Quand un couple ouvre votre fiche</span>
          <div className="p-apercu-fiche">
            <div className="d-pr-panel-body d-pr-fiche">
              <div className="d-pr-gallery">
                <div role="img" aria-label={`${v.name}, photo ${i + 1} sur ${n}`} className="d-pr-gallery-main" style={{ backgroundImage: cur ? `url("${cur}")` : undefined }}>
                  {cur ? null : <span className="d-pr-gallery-empty">Photo à venir</span>}
                  <button type="button" className="d-pr-garrow is-prev" aria-label="Photo précédente" onClick={() => setI((x) => (x - 1 + photos.length) % photos.length)}>
                    <Icon name="prev" size={16} sw={2.2} stroke="#1c1c1a" />
                  </button>
                  <button type="button" className="d-pr-garrow is-next" aria-label="Photo suivante" onClick={() => setI((x) => (x + 1) % photos.length)}>
                    <Icon name="next" size={16} sw={2.2} stroke="#1c1c1a" />
                  </button>
                  <span className="d-pr-gcount">
                    {i + 1} / {n}
                  </span>
                </div>
                <div className="d-pr-gthumbs">
                  {Array.from({ length: n - 1 }, (_, k) => {
                    const ph = photos[k + 1] || null;
                    return (
                      <button key={k} type="button" aria-label={`Photo ${k + 2} sur ${n}`} style={{ backgroundImage: ph ? `url("${ph}")` : undefined }} onClick={() => photos[k + 1] !== undefined && setI(k + 1)}>
                        {ph ? null : "Photo à venir"}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="d-pr-fiche-title">
                <div>
                  <h1 id="apercu-fiche-titre">{v.name}</h1>
                  <div className="d-pr-fiche-place">{v.place}</div>
                </div>
                <span className="d-pr-heart is-outline p-apercu-heart" aria-hidden="true">
                  <ProIcon name="heart" size={20} />
                </span>
              </div>
              {v.facts?.length ? (
                <div className="d-pr-facts">
                  {v.facts.map(([icon, k, val]) => (
                    <div key={k} className="d-pr-fact">
                      <Icon name={icon} size={18} sw={1.7} stroke="#1c1c1a" style={{ flex: "none", marginTop: 1 }} />
                      <span>
                        <small>{k}</small>
                        <strong>{val}</strong>
                      </span>
                    </div>
                  ))}
                </div>
              ) : null}
              {v.price ? (
                <section className="d-pr-offer">
                  <div className="d-pr-offer-top">
                    <span className="d-pr-price">
                      <span className="d-pr-price-from is-13">À partir de</span>
                      <span className="d-pr-price-v is-28">{euros(v.price)}</span>
                      <span className="d-pr-price-from is-13">{v.unit}</span>
                    </span>
                    {v.negotiated ? <Negotiated /> : null}
                  </div>
                  {v.included ? (
                    <div className="d-pr-included">
                      <div className="d-pr-included-t">Ce qui est compris</div>
                      <ul>
                        {v.included.map((t) => (
                          <li key={t}>
                            <Icon name="check" size={15} sw={2.4} stroke="#35520a" style={{ flex: "none", marginTop: 2 }} />
                            <span>{t}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </section>
              ) : null}
              {v.story ? (
                <section className="d-pr-fsec">
                  <h2>{v.category === "lieu" ? "Pourquoi ce lieu" : "Pourquoi ce prestataire"}</h2>
                  <p>{v.story}</p>
                </section>
              ) : null}
              {v.rating ? (
                <section className="d-pr-reviews">
                  <div>
                    <h2>Ce qu’en disent les couples</h2>
                    <span className="d-pr-stars">
                      <Icon name="star" size={14} stroke="#1c1c1a" />
                      <strong>{v.rating.score}</strong> · {v.rating.count} avis
                    </span>
                  </div>
                </section>
              ) : null}
              {v.lat !== null && v.lat !== undefined ? (
                <section className="d-pr-fsec">
                  <h2>{v.category === "lieu" ? "Où se trouve le domaine" : "Où le trouver"}</h2>
                  <MiniMap v={v} />
                  {v.where ? <div className="d-pr-where">{v.where}</div> : null}
                </section>
              ) : null}
            </div>
            <div className="d-pr-panel-foot is-fiche">
              <span className="d-btn d-btn-primary d-pr-big" aria-hidden="true">
                <Icon name="heart" size={17} sw={2} stroke="#ffffff" />
                Ajouter à ma sélection
              </span>
              <span className="d-btn d-btn-ghost d-pr-big" aria-hidden="true">
                Demander un devis
              </span>
            </div>
          </div>
        </div>
      </div>
    </Sheet>
  );
}
