"use client";

// Page « Campagnes emails » du pilotage : les chiffres de la période, puis un bloc par type de campagne. Pour le mail
// du samedi : les numéros partis, le mail à venir, un envoi de test à soi, puis l'envoi réel après confirmation. Un
// second clic ne renvoie à personne. Les mails automatiques restent sur la page Mails.

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card, DayBars, Fold, Folds, Pill, Section, Table, Tile, TileChart } from "@/components/pilotage/ui";
import { alignSeries, fmtDateTime, fmtPct } from "@/lib/server/pilotage/shape";

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

const shortDay = (iso) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short", timeZone: "Europe/Paris" });
const TON = { Parti: "ok", Programmé: "info", "À envoyer": "warn", "Sans retour": "bad" };

const COLONNES = [
  { key: "numero", label: "N°" },
  { key: "titre", label: "Mail" },
  { key: "samedi", label: "Départ", render: (r) => shortDay(r.samedi) },
  { key: "statut", label: "État", render: (r) => <Pill tone={TON[r.statut]}>{r.statut}</Pill> },
  { key: "envoyes", label: "Envoyés", num: true },
  { key: "delivres", label: "Délivrés", num: true },
  { key: "visites", label: "Visites", num: true },
  { key: "echecs", label: "Échecs", num: true },
  { key: "desinscrits", label: "Désinscrits", num: true },
];

// Campagnes sans envoi depuis le pilotage pour l'instant : une ligne, en attendant leurs chiffres
const A_VENIR = [{ id: "prestataires", label: "Série prestataires", etat: "Pas envoyée", detail: "5 mails" }];

const sommeDe = (visites, cle) => (visites ? visites.reduce((total, v) => total + v[cle], 0) : null);

function Chiffres({ data, visites, joursList, jours }) {
  const p = data.periode;
  const prev = data.precedente;
  return (
    <>
      <TileChart>
        <Tile label="Envoyés" value={p.envoyes} prev={prev.envoyes} chart={<DayBars title="Envois par jour" series={alignSeries(joursList, data.par_jour, ["envois"])} keys={["envois"]} labels={["Envois"]} days={jours} />} />
        <Tile label="Délivrés" value={p.delivres} sub={fmtPct(p.delivres, p.envoyes)} />
        <Tile label="Visites depuis le mail" value={sommeDe(visites, "periode")} prev={sommeDe(visites, "precedente")} hint="Sessions PostHog venues du mail, avec accord cookies" />
        <Tile label="Désinscrits" value={p.desinscrits} prev={prev.desinscrits} inverse />
        <Tile label="Échecs" value={p.echecs} prev={prev.echecs} inverse hint="Rebonds, plaintes, échecs d'envoi et adresses bloquées" />
      </TileChart>
    </>
  );
}

function MailDuSamedi({ data, visites, demo, onChange }) {
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
  const lignes = (data?.numeros || []).map((n) => ({ ...n, visites: visites ? visites.find((v) => v.campagne === n.campagne)?.total || 0 : null }));
  return (
    <>
      <h2 className="pl-bloc-titre">Mail du samedi</h2>
      {error ? (
        <div className="pl-health-item">
          <Pill tone="warn">Erreur</Pill>
          <div>
            <strong>{error}</strong>
          </div>
        </div>
      ) : null}
      {state ? (
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
      ) : null}
      {lignes.length ? (
        <Card>
          <Table cols={COLONNES} rows={lignes} max={60} />
        </Card>
      ) : null}
      <Folds>
        {data?.problemes?.length ? (
          <Fold open title="En difficulté" icon="securite" value={data.problemes.length}>
            <Table
              cols={[
                { key: "quand", label: "Quand", render: (r) => fmtDateTime(r.quand) },
                { key: "numero", label: "N°" },
                { key: "a", label: "Destinataire" },
                { key: "etat", label: "État", render: (r) => <Pill tone="bad">{r.etat}</Pill> },
                { key: "detail", label: "Type" },
              ]}
              rows={data.problemes}
            />
          </Fold>
        ) : null}
        {state ? (
          <Fold title="Destinataires et comptes écartés" icon="invites" value={left + state.exclus.length}>
            <div>
              {state.restants.map((e) => (
                <span className="pl-muted pl-ligne" key={e}>
                  {e}
                </span>
              ))}
              {state.exclus.map((e) => (
                <span className="pl-muted pl-ligne" key={e}>
                  Écarté : {e}
                </span>
              ))}
            </div>
          </Fold>
        ) : null}
        {state ? (
          <Fold title={`Aperçu du n° ${state.numero}`} icon="email">
            <iframe title="Aperçu du mail" srcDoc={state.html} sandbox="" className="pl-mail-preview" />
          </Fold>
        ) : null}
      </Folds>
    </>
  );
}

export default function Campagnes({ data, visites, joursList, jours, demo, onChange }) {
  const lu = data?.disponible ? data : null;
  return (
    <Section id="campagnes">
      {lu ? <Chiffres data={lu} visites={visites} joursList={joursList} jours={jours} /> : <div className="pl-empty">Suivi des campagnes non lu : {data?.raison || "voir la page Santé"}.</div>}
      <MailDuSamedi data={lu} visites={visites} demo={demo} onChange={onChange} />
      {A_VENIR.map((c) => (
        <div key={c.id} className="pl-bloc">
          <h2 className="pl-bloc-titre">{c.label}</h2>
          <div className="pl-health-item">
            <Pill>{c.etat}</Pill>
            <div>
              <strong>{c.detail}</strong>
            </div>
          </div>
        </div>
      ))}
    </Section>
  );
}
