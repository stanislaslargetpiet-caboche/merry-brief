"use client";

// Comparer les devis (canvas 4g, ordinateur et téléphone) : deux prestataires d'une même catégorie face à face,
// « VS » au milieu, le meilleur de chaque critère surligné. Plus de deux devis : on choisit l'adversaire.

import Link from "next/link";
import { useEffect, useState } from "react";
import { useDash } from "@/lib/dash/store";
import { CATEGORIES, catOf } from "@/lib/dash/catalog";
import { guestsOf } from "@/lib/dash/criteria";
import { pickStatus, picksBy } from "@/lib/dash/picks";
import { euros } from "@/lib/dash/format";
import { Icon } from "@/components/dash/icons";
import { Btn } from "@/components/dash/ui";
import { usePicks, vendorFromPick } from "@/components/dash/Prestataires";

const quoteOf = (p, data) => {
  const item = p.vendor_id ? data.items.find((i) => i.vendor_id === p.vendor_id && i.quote_amount) : null;
  return item?.quote_amount ?? p.quote_amount ?? null;
};

// Minutes d'accès lues dans « 35 min de l'aéroport… » ou « 1 h 15 de… »
const minutesOf = (s) => {
  const m = String(s || "").match(/(?:(\d+)\s*h\s*)?(\d+)?\s*min|(\d+)\s*h\b/);
  if (!m) return null;
  return (Number(m[1] || m[3] || 0) * 60) + Number(m[2] || 0);
};

// Pour chaque critère, true chez celui qui l'emporte (jamais d'égalité gagnante)
function winners(values, low) {
  const ok = values.filter((x) => x !== null && x !== undefined);
  if (ok.length < 2) return values.map(() => false);
  const best = low ? Math.min(...ok) : Math.max(...ok);
  const n = ok.filter((x) => x === best).length;
  return values.map((x) => n === 1 && x === best);
}

export default function Comparer() {
  const dash = useDash();
  const data = dash.data;
  const { picks } = usePicks();
  const by = picksBy(picks);
  const quoted = (key) => by[key].filter((p) => pickStatus(p, data).key === "devis");
  const first = CATEGORIES.find((c) => quoted(c.key).length > 1)?.key || "lieu";
  const [cat, setCat] = useState(null);
  const [pair, setPair] = useState([0, 1]);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get("cat");
    setCat(p && CATEGORIES.some((c) => c.key === p) ? p : first);
  }, [first]);

  const key = cat || first;
  const c = catOf(key);
  const list = quoted(key);
  const g = guestsOf(data);
  const guestsN = g.listCount || (g.range ? Math.round((g.range.min + g.range.max) / 2) : null);
  const duel = [list[pair[0]], list[pair[1]]].filter(Boolean);
  const vs = duel.map((p) => ({ p, v: vendorFromPick(p), amount: quoteOf(p, data) }));

  const changeCat = (k) => {
    setCat(k);
    setPair([0, 1]);
    const u = new URL(window.location.href);
    u.searchParams.set("cat", k);
    window.history.replaceState(null, "", u);
  };

  async function choose(x) {
    if (key === "lieu" && dash.updateWedding) await dash.updateWedding({ venue: x.v.name });
    dash.setToast({ kind: "ok", text: key === "lieu" ? `${x.v.name} est votre lieu.` : `${x.v.name} est retenu.` });
  }

  const rows = vs.length === 2
    ? [
        { icon: "wallet", label: "Devis", val: (x) => <strong className="d-cmp-price">{euros(x.amount)}</strong>, win: winners(vs.map((x) => x.amount), true), tag: "Le moins cher" },
        guestsN ? { icon: "users", label: `Par invité, pour ${guestsN}`, val: (x) => euros(Math.round(x.amount / guestsN)), win: [false, false] } : null,
        { icon: "seat", label: "Places assises", val: (x) => (x.v.seats ? `${x.v.seats} places` : null), win: winners(vs.map((x) => x.v.seats ?? null)), tag: "Plus grand" },
        { icon: "bed", label: "Couchages", val: (x) => (x.v.beds !== undefined && x.v.beds !== null ? `${x.v.beds} couchage${x.v.beds > 1 ? "s" : ""}` : null), win: winners(vs.map((x) => x.v.beds ?? null)), tag: "Plus de couchages" },
        { icon: /a[ée]roport/i.test(vs[0].v.access || "") ? "plane" : "train", label: "Accès", val: (x) => x.v.access || null, win: winners(vs.map((x) => minutesOf(x.v.access)), true), tag: "Plus proche" },
        { icon: "check", label: "Compris", val: (x) => (x.v.included?.length ? x.v.included.join(", ") : null), win: winners(vs.map((x) => x.v.included?.length ?? null)), tag: "Plus complet" },
      ].filter((r) => r && vs.some((x) => r.val(x)))
    : [];

  return (
    <>
      <div className="d-pr-backrow">
        <Link href="/dashboard/prestataires/mes" className="d-pr-back">
          <Icon name="back" size={16} sw={2} />
          Mes prestataires
        </Link>
      </div>
      <h1 className="d-title">Comparer les devis.</h1>
      <div role="tablist" aria-label="Catégories" className="d-pr-tabs d-cmp-tabs">
        {CATEGORIES.filter((x) => by[x.key].length).map((x) => {
          const n = quoted(x.key).length;
          return (
            <button key={x.key} type="button" role="tab" aria-selected={x.key === key} className={x.key === key ? "is-on" : ""} disabled={n < 2} onClick={() => changeCat(x.key)}>
              {x.group}
              {n ? ` · ${n} devis` : ""}
            </button>
          );
        })}
      </div>

      {vs.length === 2 ? (
        <>
          {list.length > 2 ? (
            <div className="d-cmp-pick" role="group" aria-label="Choisir l'adversaire">
              <span>Face à {vs[0].v.name} :</span>
              {list.map((p, i) =>
                i === pair[0] ? null : (
                  <button key={p.id} type="button" className={`d-pr-opt is-small${i === pair[1] ? " is-on" : ""}`} aria-pressed={i === pair[1]} onClick={() => setPair([pair[0], i])}>
                    {p.data?.name}
                  </button>
                ),
              )}
            </div>
          ) : null}
          <section className="d-cmp-duel">
            {vs.map((x, i) => {
              const photo = (x.v.photos || []).find(Boolean);
              const devis = x.p.vendor_id ? `/dashboard/budget/prestataires/${x.p.vendor_id}` : null;
              return (
                <article key={x.p.id} className="d-cmp-card">
                  <div className="d-cmp-photo" role="img" aria-label={photo ? x.v.name : `Photo à venir, ${x.v.name}`} style={{ backgroundImage: photo ? `url("${photo}")` : undefined }}>
                    {photo ? null : "Photo à venir"}
                  </div>
                  <div className="d-cmp-id">
                    <h2>{x.v.name}</h2>
                    {x.v.area ? (
                      <span className="d-pr-area is-hl">
                        <span>{x.v.area}</span>
                      </span>
                    ) : null}
                  </div>
                  {x.v.pitch || x.v.why ? <p className="d-cmp-pitch">{x.v.pitch || `${x.v.why.charAt(0).toUpperCase()}${x.v.why.slice(1)}.`}</p> : null}
                  <div className="d-cmp-crits">
                    {rows.map((r) => {
                      const val = r.val(x);
                      const win = r.win[i] && r.tag;
                      return (
                        <div key={r.label} className="d-cmp-crit">
                          <Icon name={r.icon} size={16} sw={1.8} />
                          <div>
                            <span className="d-cmp-label">{r.label}</span>
                            <span className="d-cmp-val">{val || "Non précisé"}</span>
                            {win ? <span className="d-cmp-win">{r.tag}</span> : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="d-cmp-actions">
                    <Btn onClick={() => choose(x)}>{`Choisir ce ${c.one}`}</Btn>
                    {devis ? <Link href={devis}>Voir le devis</Link> : null}
                  </div>
                </article>
              );
            })}
            <span className="d-cmp-vs" aria-hidden="true">
              VS
            </span>
          </section>
        </>
      ) : (
        <div className="d-card is-panel">
          <strong>Il faut deux devis reçus pour comparer.</strong>
          <Link href="/dashboard/prestataires/mes" className="d-pr-arrowlink is-13">
            Voir mes prestataires
            <Icon name="arrowRight" size={14} sw={2} />
          </Link>
        </div>
      )}
    </>
  );
}
