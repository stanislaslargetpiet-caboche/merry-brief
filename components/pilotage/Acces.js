"use client";

// Coulisses › Accès : les adresses qui ont demandé l'accès au pilotage (Approuver / Refuser), celles qui l'ont
// (Retirer) et les accès permanents de PILOTAGE_EMAILS. Les données viennent de /api/interne/pilotage (clé `acces`).

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Pill, Section } from "@/components/pilotage/ui";

async function decide(email, action) {
  const { data } = await supabase.auth.getSession();
  const res = await fetch("/api/interne/pilotage/acces", {
    method: "POST",
    headers: { authorization: `Bearer ${data?.session?.access_token || ""}`, "content-type": "application/json" },
    body: JSON.stringify({ email, action }),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `erreur ${res.status}`);
}

const ago = (iso) => {
  const min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (min < 60) return `il y a ${min} min`;
  const h = Math.floor(min / 60);
  return h < 48 ? `il y a ${h} h` : `il y a ${Math.floor(h / 24)} j`;
};

function Ligne({ r, actions, demo, onDone, sub }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const go = async (action) => {
    setBusy(true);
    setErr(null);
    try {
      await decide(r.email, action);
      await onDone();
    } catch (x) {
      setErr(`Non enregistré : ${x.message}`);
      setBusy(false);
    }
  };
  return (
    <span className="pl-acces-ligne">
      <span>
        <strong>{r.email}</strong>
        <span className="pl-muted"> · {sub}</span>
      </span>
      {demo ? null : (
        <span className="pl-demande-actions">
          {actions.map(([action, label, primary]) => (
            <button key={action} type="button" className={primary ? "pl-btn is-primary" : "pl-btn"} onClick={() => go(action)} disabled={busy}>
              {label}
            </button>
          ))}
          {err ? <span className="pl-form-err">{err}</span> : null}
        </span>
      )}
    </span>
  );
}

export default function Acces({ acces, demo, onChange }) {
  const attente = acces?.en_attente || [];
  return (
    <Section id="acces">
      {!acces?.disponible ? (
        <div className="pl-health-item">
          <Pill tone="neutral">Info</Pill>
          <div>
            <strong>Accès non lus</strong>
            <span className="pl-muted">{acces?.raison || "la lecture a échoué : voir les erreurs en bas de page"}</span>
          </div>
        </div>
      ) : (
        <>
          <div className="pl-health-item">
            <Pill tone={attente.length ? "warn" : "ok"}>{attente.length ? "À décider" : "OK"}</Pill>
            <div className="pl-acces-liste">
              <strong>{attente.length ? `${attente.length} demande${attente.length > 1 ? "s" : ""} en attente` : "Aucune demande en attente"}</strong>
              {attente.map((r) => (
                <Ligne key={r.email} r={r} sub={ago(r.demande_le)} demo={demo} onDone={onChange} actions={[["approuver", "Approuver", true], ["refuser", "Refuser"]]} />
              ))}
            </div>
          </div>
          <div className="pl-health-item">
            <Pill tone="info">Accès</Pill>
            <div className="pl-acces-liste">
              <strong>Ont accès</strong>
              {acces.permanents.map((email) => (
                <span className="pl-acces-ligne" key={email}>
                  <span>
                    <strong>{email}</strong>
                    <span className="pl-muted"> · permanent</span>
                  </span>
                </span>
              ))}
              {acces.approuves.map((r) => (
                <Ligne key={r.email} r={r} sub={`approuvé ${ago(r.decide_le || r.demande_le)}`} demo={demo} onDone={onChange} actions={[["retirer", "Retirer"]]} />
              ))}
            </div>
          </div>
          {acces.refuses.length ? (
            <div className="pl-health-item">
              <Pill tone="neutral">Info</Pill>
              <div className="pl-acces-liste">
                <strong>Refusés</strong>
                {acces.refuses.map((r) => (
                  <Ligne key={r.email} r={r} sub={`refusé ${ago(r.decide_le || r.demande_le)}`} demo={demo} onDone={onChange} actions={[["approuver", "Approuver"]]} />
                ))}
              </div>
            </div>
          ) : null}
        </>
      )}
    </Section>
  );
}
