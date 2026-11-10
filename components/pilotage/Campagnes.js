"use client";

// Page « Acquisition › Campagnes emails » du pilotage : trois chiffres de la période. Le bouton « Prochain envoi »
// ouvre le mail du samedi à venir : un envoi de test à soi, puis l'envoi réel après confirmation (un second clic ne
// renvoie à personne), les destinataires et l'aperçu. Les mails automatiques restent dans Coulisses › Mails
// automatiques.

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card, DayBars, Pill, Section, Tile, TileChart } from "@/components/pilotage/ui";
import { alignSeries } from "@/lib/server/pilotage/shape";

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

const at = (iso) => new Date(iso).toLocaleString("fr-FR", { weekday: "long", day: "numeric", month: "long", hour: "numeric", minute: "2-digit", timeZone: "Europe/Paris" }).replace(":00", " h").replace(":", " h ");

const sommeDe = (visites, cle) => (visites ? visites.reduce((total, v) => total + v[cle], 0) : null);

function Chiffres({ data, visites, joursList, jours }) {
  const p = data.periode;
  const prev = data.precedente;
  return (
    <TileChart>
      <Tile label="Envoyés" value={p.envoyes} prev={prev.envoyes} chart={<DayBars title="Envois par jour" series={alignSeries(joursList, data.par_jour, ["envois"])} keys={["envois"]} labels={["Envois"]} days={jours} />} />
      <Tile label="Visites depuis le mail" value={sommeDe(visites, "periode")} prev={sommeDe(visites, "precedente")} hint="Sessions PostHog venues du mail, avec accord cookies" />
      <Tile label="Désinscrits" value={p.desinscrits} prev={prev.desinscrits} inverse />
    </TileChart>
  );
}

function ProchainEnvoi({ data, demo, onChange }) {
  const [state, setState] = useState(demo ? data?.envoi : null);
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
    const plural = `${count} personne${count > 1 ? "s" : ""}`;
    if (!window.confirm(state.depart ? `Programmer « Du nouveau sur Merry » pour ${at(state.depart)}, à ${plural} ?` : `Envoyer « Du nouveau sur Merry » à ${plural} ?`)) return;
    setBusy(true);
    setNote(null);
    try {
      const res = await call({ method: "POST", body: JSON.stringify({ action: "envoyer", numero: state.numero, attendu: count }) });
      setNote(`${res.envoyes} mail${res.envoyes > 1 ? "s" : ""} ${res.depart ? `programmé${res.envoyes > 1 ? "s" : ""} pour ${at(res.depart)}` : `envoyé${res.envoyes > 1 ? "s" : ""}`}${res.echecs ? `, ${res.echecs} en échec : relance pour les reprendre` : ""}.`);
    } catch (e) {
      setNote(e.message === "liste_changee" ? "La liste a changé : relis-la avant d'envoyer." : `Envoi interrompu : ${e.message}`);
    }
    await load();
    onChange?.();
    setBusy(false);
  };

  const left = state?.restants.length || 0;
  return (
    <Card>
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
            <Pill tone={left ? "info" : state.depart ? "info" : "ok"}>{left ? "À envoyer" : state.depart ? "Programmé" : "Envoyé"}</Pill>
            <div>
              <strong>
                N° {state.numero} · {state.titre}
              </strong>
              <span className="pl-muted">
                {left} à envoyer · {state.deja} déjà envoyé{state.deja > 1 ? "s" : ""} · {state.desinscrits} désinscrit{state.desinscrits > 1 ? "s" : ""} · {state.exclus.length} compte{state.exclus.length > 1 ? "s" : ""} de test écarté{state.exclus.length > 1 ? "s" : ""}
              </span>
              <span className="pl-demande-actions">
                <button type="button" className="pl-btn" onClick={test} disabled={busy || demo}>
                  M'envoyer un test
                </button>
                <button type="button" className="pl-btn is-primary" onClick={send} disabled={busy || demo || !left}>
                  {busy ? "Envoi…" : `${state.depart ? "Programmer" : "Envoyer"} à ${left} personne${left > 1 ? "s" : ""}`}
                </button>
                {note ? <span className="pl-muted">{note}</span> : null}
              </span>
            </div>
          </div>
          <p className="pl-note">
            {state.restants.length ? `À envoyer : ${state.restants.join(", ")}` : "Personne à qui envoyer"}
            {state.exclus.length ? `. Écartés : ${state.exclus.join(", ")}` : ""}
          </p>
          <iframe title="Aperçu du mail" srcDoc={state.html} sandbox="" className="pl-mail-preview" />
        </>
      ) : error ? null : (
        <div className="pl-empty">Lecture du prochain envoi…</div>
      )}
    </Card>
  );
}

export default function Campagnes({ data, visites, joursList, jours, demo, onChange }) {
  const [ouvert, setOuvert] = useState(false);
  const lu = data?.disponible ? data : null;
  const bouton = (
    <button type="button" className="pl-btn" aria-expanded={ouvert} onClick={() => setOuvert(!ouvert)}>
      {ouvert ? "Fermer" : "Prochain envoi"}
    </button>
  );
  return (
    <Section id="campagnes" right={bouton}>
      {ouvert ? <ProchainEnvoi data={lu} demo={demo} onChange={onChange} /> : null}
      {lu ? <Chiffres data={lu} visites={visites} joursList={joursList} jours={jours} /> : <div className="pl-empty">Suivi des campagnes non lu : {data?.raison || "voir la page Santé"}.</div>}
    </Section>
  );
}
