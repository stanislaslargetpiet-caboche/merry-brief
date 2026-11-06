"use client";

// Section « Mail du samedi » du pilotage : l'aperçu du mail de la semaine, la liste des destinataires, un envoi de
// test à soi, puis l'envoi réel après confirmation. Un second clic ne renvoie à personne.

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Pill, Section } from "@/components/pilotage/ui";

async function call(init) {
  const { data } = await supabase.auth.getSession();
  const res = await fetch("/api/interne/pilotage/nouveautes", {
    ...init,
    headers: { authorization: `Bearer ${data?.session?.access_token || ""}`, "content-type": "application/json" },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `erreur ${res.status}`);
  return body;
}

const dayOf = (iso) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Paris" });

export default function Nouveautes({ demo }) {
  const [state, setState] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState(null);

  const load = useCallback(async () => {
    try {
      setState(await call({ method: "GET" }));
      setError(null);
    } catch (e) {
      setError(`Lecture impossible : ${e.message}`);
    }
  }, []);

  useEffect(() => {
    if (demo) return undefined;
    const timer = setTimeout(load, 0);
    return () => clearTimeout(timer);
  }, [demo, load]);

  const test = async () => {
    setBusy(true);
    setNote(null);
    try {
      const res = await call({ method: "POST", body: JSON.stringify({ action: "test", numero: state.numero }) });
      setNote(`Test envoyé à ${res.a}.`);
    } catch (e) {
      setNote(`Test non envoyé : ${e.message}`);
    }
    setBusy(false);
  };

  const send = async () => {
    const count = state.restants.length;
    if (!window.confirm(`Envoyer « Du nouveau sur Merry » à ${count} personne${count > 1 ? "s" : ""} ?`)) return;
    setBusy(true);
    setNote(null);
    try {
      const res = await call({ method: "POST", body: JSON.stringify({ action: "envoyer", numero: state.numero, attendu: count }) });
      setNote(`${res.envoyes} mail${res.envoyes > 1 ? "s" : ""} envoyé${res.envoyes > 1 ? "s" : ""}${res.echecs ? `, ${res.echecs} en échec : relance pour les reprendre` : ""}.`);
    } catch (e) {
      setNote(e.message === "liste_changee" ? "La liste a changé : relis-la avant d'envoyer." : `Envoi interrompu : ${e.message}`);
    }
    await load();
    setBusy(false);
  };

  if (demo) return null;
  const left = state?.restants.length || 0;
  return (
    <Section id="nouveautes" title="Mail du samedi" kicker={state ? `N° ${state.numero}, ${dayOf(state.samedi)}` : "Du nouveau sur Merry"}>
      {error ? (
        <div className="pl-health-item">
          <Pill tone="warn">Erreur</Pill>
          <div>
            <strong>{error}</strong>
          </div>
        </div>
      ) : null}
      {state ? (
        <>
          <div className="pl-health-item">
            <Pill tone={left ? "info" : "ok"}>{left ? "À envoyer" : "Envoyé"}</Pill>
            <div>
              <strong>{state.titre}</strong>
              <span className="pl-muted">
                {left} à envoyer · {state.deja} déjà envoyé{state.deja > 1 ? "s" : ""} · {state.desinscrits} désinscrit{state.desinscrits > 1 ? "s" : ""} · {state.exclus.length} compte{state.exclus.length > 1 ? "s" : ""} de test écarté{state.exclus.length > 1 ? "s" : ""}
              </span>
              <span className="pl-demande-actions">
                <button type="button" className="pl-btn" onClick={test} disabled={busy}>
                  M'envoyer un test
                </button>
                <button type="button" className="pl-btn is-primary" onClick={send} disabled={busy || !left}>
                  {busy ? "Envoi…" : `Envoyer à ${left} personne${left > 1 ? "s" : ""}`}
                </button>
                {note ? <span className="pl-muted">{note}</span> : null}
              </span>
            </div>
          </div>
          <details className="pl-health-item">
            <summary>Destinataires et comptes écartés</summary>
            <div>
              {state.restants.map((e) => (
                <span className="pl-muted" key={e}>
                  {e}
                </span>
              ))}
              {state.exclus.map((e) => (
                <span className="pl-muted" key={e}>
                  Écarté : {e}
                </span>
              ))}
            </div>
          </details>
          <iframe title="Aperçu du mail" srcDoc={state.html} sandbox="" className="pl-mail-preview" />
        </>
      ) : null}
    </Section>
  );
}
