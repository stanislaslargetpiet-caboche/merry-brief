"use client";

// La sélection de lieux (canvas 7b et 7n)

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useDash } from "@/lib/dash/store";
import { inWords, rank } from "@/lib/dash/catalog";
import { chosenVenue, dateLong, guestsLabel } from "@/lib/dash/picks";
import { Icon } from "@/components/dash/icons";
import { DevisDialog, EnviesPanel, FichePanel, MoreButton, Negotiated, Price, PrecisionsBar, SampleNote, usePicks, useRecommendations } from "@/components/dash/Prestataires";

const FORMAT = { jour: "Une journée", weekend: "Un week-end" };

export default function Lieux() {
  const dash = useDash();
  const router = useRouter();
  const data = dash.data;
  const { picks, add } = usePicks();
  const rec = useRecommendations("lieu");
  const { vendors, source } = rec;
  const list = useMemo(() => rank(vendors, data.wishes?.wishes || null, "lieu"), [vendors, data.wishes]);
  const [fiche, setFiche] = useState(null);
  const [envies, setEnvies] = useState(false);
  const [devis, setDevis] = useState(null);
  const venue = chosenVenue(data, picks);
  const b = data.brief || {};
  const w = data.wedding;
  const briefBits = [dateLong(w.wedding_date), b.guests ? guestsLabel({ ...data, guests: [] }) : guestsLabel(data), w.region || b.region, FORMAT[b.format], (b.vibes || []).slice(0, 2).join(", ").replace(/, (\S)/, (m, x) => `, ${x.toLowerCase()}`)]
    .filter(Boolean)
    .join(" · ");
  const n = list.length;

  return (
    <>
      <div className="d-pr-backrow">
        <Link href="/dashboard/prestataires" className="d-pr-back">
          <Icon name="back" size={16} sw={2} />
          Prestataires
        </Link>
        <Link href="/dashboard/prestataires/mes" className="d-pr-pillink is-desk-lg">
          <Icon name="heart" size={15} sw={2} />
          Mes prestataires
        </Link>
      </div>
      <div className="d-pr-lieux-head">
        <h1 className="d-title">Lieux.</h1>
        <p>
          {inWords(n, "lieu")} choisi{n > 1 ? "s" : ""} d'après votre brief.
          {venue ? ` Vous avez retenu le ${venue.data?.name}.` : ""}
        </p>
      </div>
      <SampleNote source={source} />
      <div className="d-pr-briefline">
        <span>
          <strong>D'après votre brief</strong>
          {briefBits ? ` · ${briefBits}` : ""}
        </span>
        <Link href="/dashboard/brief">Modifier le brief</Link>
      </div>
      <PrecisionsBar onOpen={() => setEnvies(true)} />
      <div className="d-pr-grid is-lieux">
        {list.map((v) => {
          const photo = (v.photos || []).find(Boolean);
          return (
            <article key={v.id} className="d-pr-card is-lieu">
              <div role="img" aria-label={photo ? `${v.name}, ${v.area}` : `Photo à venir, ${v.name}`} className="d-pr-lieu-photo" style={{ backgroundImage: photo ? `url("${photo}")` : undefined }}>
                {photo ? null : "Photo du lieu à venir"}
              </div>
              <div className="d-pr-card-body is-lieu">
                <div className="d-pr-card-top">
                  <div className="d-pr-card-name">
                    <h3>{v.name}</h3>
                    <div className="d-pr-area">{v.area}</div>
                  </div>
                  {v.negotiated ? <Negotiated /> : null}
                </div>
                <Price v={v} unit={v.unitWeekend || v.unit} />
                <div className="d-pr-lieu-more">
                  {v.upTo ? <div className="d-pr-details">{v.upTo}</div> : null}
                  {v.pitch || v.why ? <div className="d-pr-pitch">{v.pitch || v.why}</div> : null}
                </div>
                <button type="button" className="d-pr-arrowlink" onClick={() => setFiche(v)}>
                  Voir le lieu
                  <Icon name="arrowRight" size={15} sw={2} />
                </button>
              </div>
            </article>
          );
        })}
      </div>
      <MoreButton rec={rec} category="lieu" />
      <section className="d-pr-panelcta">
        <div>
          <h2>{inWords(n, "lieu")}, pas davantage</h2>
          <p>Merry écarte ce qui ne tient pas votre date, votre nombre d'invités ou votre budget. Pour une autre sélection, dites-nous ce qui compte le plus pour vous.</p>
        </div>
        <div className="d-pr-panelcta-btns">
          <button type="button" className="d-btn d-btn-ghost" onClick={() => setEnvies(true)}>
            Affiner la sélection
          </button>
          <button type="button" className="d-btn d-btn-primary" onClick={() => dash.setToast({ kind: "ok", text: "La comparaison côte à côte arrive bientôt dans Merry." })}>
            Comparer les {inWords(n, "lieu").toLowerCase()}
          </button>
        </div>
      </section>
      {fiche ? (
        <FichePanel
          v={fiche}
          index={Math.max(0, list.indexOf(fiche))}
          total={n}
          onClose={() => setFiche(null)}
          onRequest={async (v) => {
            const p = await add(v);
            setFiche(null);
            if (p) setDevis([p]);
          }}
        />
      ) : null}
      {envies ? <EnviesPanel onClose={() => setEnvies(false)} /> : null}
      {devis ? <DevisDialog picks={devis} onClose={() => setDevis(null)} onSent={() => router.push("/dashboard/prestataires/demandes")} /> : null}
    </>
  );
}
