"use client";

// Mes prestataires (canvas 7j et 7v) : ceux que l'on a gardés, où en est chaque demande,
// et ceux à cocher pour la prochaine demande de devis

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import VendorComments, { useVendorComments } from "@/components/dash/VendorComments";
import { useDash } from "@/lib/dash/store";
import { CATEGORIES } from "@/lib/dash/catalog";
import { pickStatus, picksBy } from "@/lib/dash/picks";
import { Icon } from "@/components/dash/icons";
import { DevisDialog, FichePanel, Heart, PrHead, RowActions, StatusChip, Thumb, usePicks, vendorFromPick } from "@/components/dash/Prestataires";

export default function Mes() {
  const dash = useDash();
  const router = useRouter();
  const data = dash.data;
  const { picks, toggle, add } = usePicks();
  const [fiche, setFiche] = useState(null);
  const [devis, setDevis] = useState(null);
  const by = picksBy(picks);
  const sections = CATEGORIES.filter((c) => c.key !== "autre" || by.autre.length);
  const next = picks.filter((p) => !p.requested_at && p.checked);

  async function remove(p) {
    await toggle({ id: p.catalog_ref });
    dash.setToast({ kind: "ok", text: `${p.data?.name} est retiré de vos prestataires.` });
  }

  return (
    <>
      <PrHead on="mes" />
      {dash.mode === "live" && !data.picksSetup ? (
        <div className="d-card is-panel">
          <strong>Les prestataires ne sont pas encore installés sur la base.</strong>
          <span className="d-small" style={{ lineHeight: 1.5, color: "#43423c" }}>
            Collez le fichier <code>supabase/prestataires.sql</code> dans Supabase (SQL Editor), puis rechargez la page.
          </span>
        </div>
      ) : null}
      <div className="d-pr-mes-intro">
        <Link href="/dashboard/prestataires/demandes" className="d-btn d-btn-ghost d-pr-mes-requests">
          <Icon name="requests" size={16} sw={1.8} />
          Voir mes demandes de devis
        </Link>
      </div>
      <div className="d-pr-boxes">
        {sections.map((c) => (
          <section key={c.key} className="d-pr-box is-mes">
            <div className="d-pr-box-head">
              <h3>{c.group}</h3>
              <Link href={c.key === "lieu" ? "/dashboard/prestataires" : `/dashboard/prestataires/autour`} className="d-pr-arrowlink is-13">
                {c.more}
                <Icon name="arrowRight" size={14} sw={2} />
              </Link>
            </div>
            {by[c.key].length ? (
              <ul className="d-pr-lines">
                {by[c.key].map((p) => (
                  <MesRow
                    key={p.id}
                    p={p}
                    status={pickStatus(p, data)}
                    label={c.label}
                    onCheck={() => dash.update("vendor_picks", p.id, { checked: !p.checked })}
                    onRemove={() => remove(p)}
                    onFiche={() => setFiche(vendorFromPick(p))}
                    onCompare={() => dash.setToast({ kind: "ok", text: "La comparaison des devis arrive bientôt dans Merry." })}
                  />
                ))}
              </ul>
            ) : (
              <p className="d-pr-empty">Aucun {c.one} enregistré pour l’instant.</p>
            )}
          </section>
        ))}
      </div>
      {next.length ? (
        <div role="region" aria-label="Prochaine demande" className="d-pr-nextbar">
          <div className="d-pr-nextbar-text">
            <strong>
              {next.length} prestataire{next.length > 1 ? "s" : ""} coché{next.length > 1 ? "s" : ""}
            </strong>
            <span>{next.map((p) => p.data?.name).join(", ")}</span>
          </div>
          <button type="button" className="d-btn d-btn-primary d-pr-big" onClick={() => setDevis(next)}>
            Demander les devis ({next.length})
          </button>
        </div>
      ) : null}
      {fiche ? (
        <FichePanel
          v={fiche}
          index={0}
          total={1}
          onClose={() => setFiche(null)}
          onRequest={async (v) => {
            const p = await add(v);
            setFiche(null);
            if (p) setDevis([p]);
          }}
        />
      ) : null}
      {devis ? <DevisDialog picks={devis} onClose={() => setDevis(null)} onSent={() => router.push("/dashboard/prestataires/demandes")} /> : null}
    </>
  );
}

function MesRow({ p, status, label, onCheck, onRemove, onFiche, onCompare }) {
  const v = p.data || {};
  const [talk, setTalk] = useState(false);
  const comments = useVendorComments(p.catalog_ref);
  const bubble = (
    <button
      type="button"
      className={`d-bubble${talk ? " is-open" : ""}${comments.length ? "" : " is-empty"}`}
      onClick={() => setTalk((x) => !x)}
      aria-expanded={talk}
      aria-label={comments.length ? `${comments.length} commentaire${comments.length > 1 ? "s" : ""} sur ${v.name}` : `Commenter : ${v.name}`}
    >
      <Icon name="bubble" size={14} sw={2} />
      {comments.length ? comments.length : null}
    </button>
  );
  const todo = status.key === "todo";
  const line = status.line;
  const acts = <RowActions p={p} status={status} onFiche={onFiche} onCompare={onCompare} />;
  return (
    <li className="d-pr-line is-mes">
      <div className="d-pr-mes-top">
        {todo ? (
          <input type="checkbox" className="d-pr-check" checked={!!p.checked} onChange={onCheck} aria-label={`Inclure ${v.name} dans la prochaine demande de devis`} />
        ) : (
          <span aria-hidden="true" className="d-pr-check-space" />
        )}
        <Thumb v={v} size={56} className="d-pr-line-thumb" />
        <div className="d-pr-line-main">
          <div className="d-pr-line-name">
            <span>{v.name}</span>
            <span className="d-desk-only-inline">
              <StatusChip k={status.key} />
            </span>
          </div>
          <div className="d-pr-line-meta">
            {label}
            {v.area ? ` · ${v.area}` : ""}
          </div>
          {line ? <div className="d-pr-line-text d-desk-only">{line}</div> : null}
        </div>
        <div className="d-pr-line-acts d-desk-only-flex">
          {bubble}
          {acts}
        </div>
        <Heart on onClick={onRemove} label={`Retirer ${v.name} de mes prestataires`} size={18} className="d-pr-heart is-bare is-row" />
      </div>
      <div className="d-pr-mes-rest d-mob-only-flex">
        <div>
          <StatusChip k={status.key} />
        </div>
        {line ? <div className="d-pr-line-text">{line}</div> : null}
        <div className="d-pr-line-acts">
          {bubble}
          {acts}
        </div>
      </div>
      {talk ? (
        <div className="d-pr-mes-thread">
          <VendorComments vendorRef={p.catalog_ref} name={v.name} />
        </div>
      ) : null}
    </li>
  );
}
