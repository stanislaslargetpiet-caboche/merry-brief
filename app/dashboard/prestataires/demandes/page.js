"use client";

// Vos demandes de devis (canvas 7i et 7u)

import Link from "next/link";
import { useDash } from "@/lib/dash/store";
import { CATEGORIES } from "@/lib/dash/catalog";
import { pickStatus, picksBy } from "@/lib/dash/picks";
import { shortDate } from "@/lib/dash/format";
import { PrHead, RowActions, StatusChip, Thumb } from "@/components/dash/Prestataires";

export default function Demandes() {
  const dash = useDash();
  const data = dash.data;
  const sent = (data.picks || []).filter((p) => p.requested_at);
  const by = picksBy(sent);
  const sections = CATEGORIES.filter((c) => by[c.key].length);
  const compare = () => dash.setToast({ kind: "ok", text: "La comparaison des devis arrive bientôt dans Merry." });

  return (
    <>
      <PrHead on="mes" />
      <div className="d-pr-req-intro">
        <h2>Vos demandes de devis</h2>
      </div>
      {sections.length ? (
        <div className="d-pr-boxes is-req">
          {sections.map((c) => (
            <section key={c.key} className="d-pr-box is-req">
              <h3 className="d-pr-box-title">{by[c.key].length > 1 ? c.group : c.groupOne}</h3>
              <ul className="d-pr-lines">
                {by[c.key].map((p) => {
                  const v = p.data || {};
                  const status = pickStatus(p, data);
                  const href = p.vendor_id ? `/dashboard/budget/prestataires/${p.vendor_id}` : "#";
                  const line = status.key === "envoyee" ? null : status.line;
                  return (
                    <li key={p.id} className="d-pr-line is-req">
                      <div className="d-pr-req-top">
                        <Thumb v={v} size={56} className="d-pr-line-thumb" />
                        <div className="d-pr-line-main">
                          <div className="d-pr-line-name">
                            <Link href={href}>{v.name}</Link>
                            <span className="d-desk-only-inline">
                              <StatusChip k={status.key} />
                            </span>
                          </div>
                          <div className="d-pr-line-meta">
                            {c.label}
                            <span className="d-desk-only-inline">{v.area ? ` · ${v.area}` : ""}</span> · envoyée le {shortDate(p.requested_at)}
                          </div>
                        </div>
                      </div>
                      <div className="d-pr-req-rest">
                        <div className="d-mob-only-flex">
                          <StatusChip k={status.key} />
                        </div>
                        {line ? <div className="d-pr-line-text">{line}</div> : null}
                      </div>
                      <div className="d-pr-line-acts">
                        <RowActions p={p} status={status} onCompare={compare} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      ) : (
        <div className="d-card is-panel">
          <strong>Aucune demande de devis pour l’instant.</strong>
          <span className="d-small" style={{ lineHeight: 1.5, color: "#43423c" }}>
            Gardez des prestataires d'un cœur dans <Link href="/dashboard/prestataires">Trouver des prestataires</Link>, puis demandez vos devis en une fois.
          </span>
        </div>
      )}
    </>
  );
}
