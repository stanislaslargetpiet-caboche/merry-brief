"use client";

// Section « Demandes » du pilotage : les demandes d'accès à une fiche qui attendent une vérification à la main
// (mail ou rappel dans l'heure), avec les coordonnées d'origine de la fiche, ce que le demandeur a répondu,
// et « Valider » / « Refuser ». Les données viennent de /api/interne/pilotage (clé `demandes`).

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Pill, Section } from "@/components/pilotage/ui";

async function decide(id, decision) {
  const { data } = await supabase.auth.getSession();
  const res = await fetch("/api/interne/pilotage/demandes", {
    method: "POST",
    headers: { authorization: `Bearer ${data?.session?.access_token || ""}`, "content-type": "application/json" },
    body: JSON.stringify({ id, decision }),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `erreur ${res.status}`);
}

const ago = (iso) => {
  const min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (min < 60) return `il y a ${min} min`;
  const h = Math.floor(min / 60);
  return h < 48 ? `il y a ${h} h` : `il y a ${Math.floor(h / 24)} j`;
};

// Une coordonnée : ce que la fiche affichait, et la réponse du demandeur
function coordLine(label, fiche, choice, given) {
  if (choice === "oui") return `${label} : ${fiche} (confirmé par le demandeur)`;
  if (choice === "non") return `${label} : la fiche dit ${fiche || "rien"}, le demandeur dit que non et donne ${given}`;
  return `${label} : la fiche n'en avait pas, le demandeur donne ${given}`;
}

function Demande({ d, demo, onDone }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const changed = Boolean(d.email_given || d.phone_given);
  const go = async (decision) => {
    setBusy(true);
    setErr(null);
    try {
      await decide(d.id, decision);
      await onDone();
    } catch (x) {
      setErr(`Non enregistré : ${x.message}`);
      setBusy(false);
    }
  };
  return (
    <div className="pl-health-item pl-demande">
      <Pill tone={changed ? "warn" : "info"}>{changed ? "Coordonnées changées" : "À vérifier"}</Pill>
      <div>
        <strong>
          {d.fiche.nom}
          {d.fiche.ville ? ` · ${d.fiche.ville}` : ""}
          {d.fiche.metier ? ` · ${d.fiche.metier}` : ""}
        </strong>
        <span className="pl-muted">{ago(d.cree_le)} · compte {d.account_email} · {d.account_phone}</span>
        <span className="pl-muted">{coordLine("Mail", d.fiche_email, d.email_choice, d.email_given)}</span>
        <span className="pl-muted">{coordLine("Téléphone", d.fiche_phone, d.phone_choice, d.phone_given)}</span>
        <span className="pl-muted">{changed ? "Contacte la fiche par ses coordonnées d'origine, pas par celles du demandeur." : "Contacte la fiche par son mail ou son téléphone pour confirmer."}</span>
        {demo ? null : (
          <span className="pl-demande-actions">
            <button type="button" className="pl-btn is-primary" onClick={() => go("valider")} disabled={busy}>
              Valider
            </button>
            <button type="button" className="pl-btn" onClick={() => go("refuser")} disabled={busy}>
              Refuser
            </button>
            {err ? <span className="pl-form-err">{err}</span> : null}
          </span>
        )}
      </div>
    </div>
  );
}

export default function Demandes({ demandes, demo, onChange }) {
  const waiting = demandes?.en_attente || [];
  return (
    <Section id="demandes" title="Demandes" kicker="Accès aux fiches prestataires" defaultOpen={waiting.length > 0}>
      {!demandes?.disponible ? (
        <div className="pl-health-item">
          <Pill tone="neutral">Info</Pill>
          <div>
            <strong>Demandes non lues</strong>
            <span className="pl-muted">{demandes?.raison || "la lecture a échoué : voir les erreurs en bas de page"}</span>
          </div>
        </div>
      ) : (
        <>
          {waiting.length ? (
            waiting.map((d) => <Demande key={d.id} d={d} demo={demo} onDone={onChange} />)
          ) : (
            <div className="pl-health-item">
              <Pill tone="ok">OK</Pill>
              <div>
                <strong>Aucune demande en attente</strong>
              </div>
            </div>
          )}
          {demandes.recentes.length ? (
            <div className="pl-health-item">
              <Pill tone="neutral">Info</Pill>
              <div>
                <strong>Dernières décisions</strong>
                {demandes.recentes.map((d) => (
                  <span className="pl-muted" key={d.id}>
                    {d.statut === "validee" ? "Validée" : "Refusée"} · {d.fiche.nom} · {ago(d.decidee_le || d.cree_le)}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </>
      )}
    </Section>
  );
}
