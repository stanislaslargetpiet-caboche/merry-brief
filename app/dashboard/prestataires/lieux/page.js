"use client";

// La sélection de lieux (canvas 7b et 7n)

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fragment, useMemo, useState } from "react";
import { useDash } from "@/lib/dash/store";
import { rank } from "@/lib/dash/catalog";
import { searchWishes } from "@/lib/dash/criteria";
import { Icon } from "@/components/dash/icons";
import { FiltersPanel, SearchSummary, inPrice } from "@/components/dash/Filtres";
import {
  ConfirmDivider,
  DevisDialog,
  FichePanel,
  FiltersNote,
  MoreButton,
  Price,
  SampleNote,
  Specs,
  ToConfirm,
  usePicks,
  useRecommendations,
} from "@/components/dash/Prestataires";

export default function Lieux() {
  const dash = useDash();
  const router = useRouter();
  const data = dash.data;
  const { picks, add } = usePicks();
  const rec = useRecommendations("lieu");
  const { vendors, source } = rec;
  const [price, setPrice] = useState(null);
  const list = useMemo(() => rank(vendors, searchWishes(data), "lieu").filter((v) => inPrice(v, price)), [vendors, data, price]);
  const [fiche, setFiche] = useState(null);
  const [filters, setFilters] = useState(false);
  const [devis, setDevis] = useState(null);
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
      </div>
      <SampleNote source={source} />
      <FiltersNote rec={rec} />
      <SearchSummary price={price} busy={rec.loading} onOpen={() => setFilters(true)} />
      <div className="d-pr-grid is-lieux">
        {list.map((v, i) => {
          const photo = (v.photos || []).find(Boolean);
          return (
            <Fragment key={v.id}>
              <ConfirmDivider list={list} index={i} />
              <article className="d-pr-card is-lieu">
                <div role="img" aria-label={photo ? `${v.name}, ${v.area}` : `Photo à venir, ${v.name}`} className="d-pr-lieu-photo" style={{ backgroundImage: photo ? `url("${photo}")` : undefined }}>
                  {photo ? null : "Photo du lieu à venir"}
                </div>
                <div className="d-pr-card-body is-lieu">
                  <div className="d-pr-card-top">
                    <div className="d-pr-card-name">
                      <h3>{v.name}</h3>
                      {v.area ? <div className="d-pr-area is-hl"><span>{v.area}</span></div> : null}
                    </div>
                  </div>
                  <Specs v={v} />
                  <Price v={v} unit={v.unitWeekend || v.unit} />
                  <ToConfirm v={v} />
                  <div className="d-pr-maplinks">
                    <button type="button" className="d-pr-arrowlink" onClick={() => setFiche(v)}>
                      Voir le lieu
                      <Icon name="arrowRight" size={15} sw={2} />
                    </button>
                    {v.lat !== undefined && v.lat !== null ? (
                      <Link href={`/dashboard/prestataires?vue=carte&lieu=${encodeURIComponent(v.id)}`} className="d-pr-maplink">
                        <Icon name="map" size={14} sw={2} />
                        Voir sur la carte
                      </Link>
                    ) : null}
                  </div>
                </div>
              </article>
            </Fragment>
          );
        })}
      </div>
      <MoreButton rec={rec} category="lieu" />
      {fiche ? (
        <FichePanel
          v={fiche}
          index={Math.max(0, list.indexOf(fiche))}
          total={n}
          onClose={() => setFiche(null)}
          onMap={(v) => router.push(`/dashboard/prestataires?vue=carte&lieu=${encodeURIComponent(v.id)}`)}
          onRequest={async (v) => {
            const p = await add(v);
            setFiche(null);
            if (p) setDevis([p]);
          }}
        />
      ) : null}
      {filters ? <FiltersPanel category="lieu" price={price} onClose={() => setFilters(false)} onApply={setPrice} /> : null}
      {devis ? <DevisDialog picks={devis} onClose={() => setDevis(null)} onSent={() => router.push("/dashboard/prestataires/demandes")} /> : null}
    </>
  );
}
