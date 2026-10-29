"use client";

// Autour de votre lieu (canvas 7f et 7r) : une rangée par catégorie, « Pas besoin » pour la replier

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { useDash } from "@/lib/dash/store";
import { CATEGORIES, catOf } from "@/lib/dash/catalog";
import { chosenVenue, guestsLabel, monthYear } from "@/lib/dash/picks";
import { euros } from "@/lib/dash/format";
import { Icon } from "@/components/dash/icons";
import { BusyDots } from "@/components/dash/ui";
import { details, DevisDialog, FichePanel, Heart, Price, PrHead, SampleNote, usePicks, useRecommendations } from "@/components/dash/Prestataires";

const ROWS = CATEGORIES.filter((c) => c.key !== "lieu" && c.key !== "autre");

export default function Autour() {
  const dash = useDash();
  const router = useRouter();
  const data = dash.data;
  const { picks, isPicked, toggle, add } = usePicks();
  const venue = chosenVenue(data, picks);
  const v = venue?.data || null;
  const name = v?.name || data.wedding.venue || null;
  const near = v?.lat ? { lat: v.lat, lng: v.lng } : null;
  const skipped = data.wishes?.skipped || [];
  const { source } = useRecommendations("traiteur", near);
  const [fiche, setFiche] = useState(null);
  const [devis, setDevis] = useState(null);

  async function skip(key, on) {
    if (dash.mode === "live" && !data.picksSetup) {
      dash.setToast({ kind: "error", text: "Ce choix ne peut pas encore être enregistré : collez supabase/prestataires.sql dans Supabase (SQL Editor)." });
      return;
    }
    await dash.saveWishes({ skipped: on ? [...new Set([...skipped, key])] : skipped.filter((k) => k !== key) });
  }

  const sub = ["Mariage", guestsLabel(data), monthYear(data.wedding.wedding_date)].filter(Boolean).join(" · ");

  return (
    <>
      <PrHead on="trouver" />
      <SampleNote source={source} />
      {name ? (
        <div className="d-pr-yourvenue">
          <div className="d-pr-kicker">VOTRE LIEU</div>
          <div className="d-pr-yourvenue-card">
            <span role="img" aria-label={name} className="d-pr-yourvenue-img" style={{ backgroundImage: (v?.photos || []).find(Boolean) ? `url("${(v?.photos || []).find(Boolean)}")` : undefined }} />
            <div className="d-pr-yourvenue-main">
              <strong>{name}</strong>
              <span>{sub}</span>
            </div>
            {v?.price ? <span className="d-pr-yourvenue-price">{euros(v.price)}</span> : null}
          </div>
        </div>
      ) : null}
      <div className="d-pr-autour-head">
        <h2>Autour de votre lieu</h2>
        <p>{name ? `Des prestataires qui interviennent déjà au ${name} ou à moins de 70 km.` : "Des prestataires qui interviennent dans votre région."}</p>
      </div>
      <div className="d-pr-rows">
        {ROWS.map((c) =>
          skipped.includes(c.key) ? (
            <section key={c.key} aria-label={c.group} className="d-pr-skipped">
              <h3>{c.group} :</h3>
              <span>pas besoin</span>
              <span aria-hidden="true">·</span>
              <button type="button" className="d-pr-textbtn" onClick={() => skip(c.key, false)}>
                Annuler
              </button>
            </section>
          ) : (
            <Row key={c.key} cat={c.key} venueName={name} near={near} isPicked={isPicked} onToggle={toggle} onSkip={() => skip(c.key, true)} onOpen={setFiche} />
          ),
        )}
      </div>
      {fiche ? (
        <FichePanel
          v={fiche}
          index={0}
          total={1}
          list={catOf(fiche.category).tab}
          onClose={() => setFiche(null)}
          onRequest={async (x) => {
            const p = await add(x);
            setFiche(null);
            if (p) setDevis([p]);
          }}
        />
      ) : null}
      {devis ? <DevisDialog picks={devis} onClose={() => setDevis(null)} onSent={() => router.push("/dashboard/prestataires/demandes")} /> : null}
    </>
  );
}

function Row({ cat, venueName, near, isPicked, onToggle, onSkip, onOpen }) {
  const c = catOf(cat);
  const rec = useRecommendations(cat, near);
  const { vendors } = rec;
  const scroller = useRef(null);
  const scroll = (d) => scroller.current?.scrollBy({ left: d * 316, behavior: "smooth" });
  const id = `row-${cat}`;
  return (
    <section aria-labelledby={id} className="d-pr-row">
      <div className="d-pr-row-head">
        <div>
          <h3 id={id}>{c.group}</h3>
          <span>{vendors.length ? `${rec.hasMore ? "Plus de " : ""}${vendors.length} ${c.near} près ${venueName ? `du ${venueName}` : "de chez vous"}` : `Aucun ${c.one} près ${venueName ? `du ${venueName}` : "de chez vous"} pour l’instant.`}</span>
        </div>
        <span className="d-pr-row-actions">
          <button type="button" className="d-pr-textbtn" onClick={onSkip}>
            Pas besoin
          </button>
          {vendors.length > 3 || rec.hasMore ? (
            <span className="d-pr-row-arrows d-desk-only">
              <button type="button" aria-label={`${c.group} précédents`} onClick={() => scroll(-1)}>
                <Icon name="prev" size={16} sw={2.2} stroke="#1c1c1a" />
              </button>
              <button type="button" aria-label={`${c.group} suivants`} onClick={() => scroll(1)}>
                <Icon name="next" size={16} sw={2.2} stroke="#1c1c1a" />
              </button>
            </span>
          ) : null}
        </span>
      </div>
      {vendors.length ? (
        <div className="d-pr-row-scroll" ref={scroller}>
          {vendors.map((v) => {
            const photo = (v.photos || []).find(Boolean);
            return (
              <article key={v.id} className="d-pr-rowcard">
                <div className="d-pr-rowcard-img" style={{ backgroundImage: photo ? `url("${photo}")` : undefined }}>
                  {photo ? null : (
                    <span role="img" aria-label={`Photo à venir, ${v.name}`}>
                      Photo à venir
                    </span>
                  )}
                  <Heart on={isPicked(v)} onClick={() => onToggle(v)} size={18} className="d-pr-heart is-small" />
                </div>
                <div className="d-pr-rowcard-body">
                  <div className="d-pr-card-top">
                    <div className="d-pr-card-name">
                      <h4>
                        <button type="button" onClick={() => onOpen(v)}>
                          {v.name}
                        </button>
                      </h4>
                      <div className="d-pr-area">{v.area}</div>
                    </div>
                  </div>
                  <div className="d-pr-details is-sm">{details(v, venueName)}</div>
                  {v.why ? (
                    <div className="d-pr-why is-sm">
                      <span>Pourquoi :</span> {v.why}
                    </div>
                  ) : null}
                  {v.price ? (
                    <div className="d-pr-card-price is-sm">
                      <Price v={v} />
                    </div>
                  ) : null}
                </div>
              </article>
            );
          })}
          {rec.hasMore ? (
            <div className="d-pr-rowmore">
              <button type="button" className="d-btn d-btn-ghost" onClick={rec.more} disabled={rec.loadingMore}>
                {rec.loadingMore ? <BusyDots /> : `Voir plus de ${c.many}`}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
