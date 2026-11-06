"use client";

// Section « Coûts » en tête du pilotage : dépenses du mois, cumul, par catégorie, par fournisseur,
// et un petit formulaire pour saisir une dépense. Les données viennent de /api/interne/pilotage (clé `couts`).

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card, Pill, Ranked, Section, Table, Tile } from "@/components/pilotage/ui";
import { fmtDay, fmtEur } from "@/lib/server/pilotage/shape";
import { CATEGORIES } from "@/lib/server/pilotage/couts";

const eur = fmtEur;
const MOIS = (m) => (m ? new Date(`${m}-15T12:00:00Z`).toLocaleDateString("fr-FR", { month: "long", year: "numeric", timeZone: "Europe/Paris" }) : "");

function today() {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Paris" });
}

async function send(method, path, body) {
  const { data } = await supabase.auth.getSession();
  const res = await fetch(path, {
    method,
    headers: { authorization: `Bearer ${data?.session?.access_token || ""}`, "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).champ || `erreur ${res.status}`);
}

function Ajout({ onDone }) {
  const [f, setF] = useState({ jour: today(), fournisseur: "", libelle: "", categorie: "tech", montant_eur: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      await send("POST", "/api/interne/pilotage/couts", f);
      setF((s) => ({ ...s, fournisseur: "", libelle: "", montant_eur: "" }));
      await onDone();
    } catch (x) {
      setErr(`Champ à revoir : ${x.message}`);
    } finally {
      setBusy(false);
    }
  };
  return (
    <form className="pl-form" onSubmit={submit}>
      <label>
        Jour
        <input type="date" value={f.jour} onChange={set("jour")} required />
      </label>
      <label>
        Fournisseur
        <input value={f.fournisseur} onChange={set("fournisseur")} placeholder="Google Cloud" maxLength={80} required />
      </label>
      <label>
        Libellé
        <input value={f.libelle} onChange={set("libelle")} placeholder="Places API, campagne photos" maxLength={200} />
      </label>
      <label>
        Catégorie
        <select value={f.categorie} onChange={set("categorie")}>
          {CATEGORIES.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        Montant (€)
        <input inputMode="decimal" value={f.montant_eur} onChange={set("montant_eur")} placeholder="0,00" required />
      </label>
      <button type="submit" className="pl-btn is-primary" disabled={busy}>
        {busy ? "Ajout…" : "Ajouter"}
      </button>
      {err ? <span className="pl-form-err">{err}</span> : null}
    </form>
  );
}

export default function Couts({ couts, demo, onChange }) {
  const mois = today().slice(0, 7);
  const labelOf = Object.fromEntries(CATEGORIES.map((c) => [c.id, c.label]));
  const remove = async (id) => {
    await send("DELETE", `/api/interne/pilotage/couts?id=${id}`);
    await onChange();
  };

  return (
    <Section id="couts">
      {!couts?.disponible ? (
        <div className="pl-health-item">
          <Pill tone="neutral">Info</Pill>
          <div>
            <strong>Registre des coûts non lu</strong>
            <span className="pl-muted">{couts?.raison || "la lecture a échoué : voir les erreurs en bas de page"}</span>
          </div>
        </div>
      ) : (
        <>
          <div className="pl-tiles">
            <Tile label={`Dépensé en ${MOIS(mois)}`} value={couts.mois} format={eur} sub={`${eur(couts.mois_par_jour)} par jour (${couts.jours_mois} jours écoulés) · ${eur(couts.mois_precedent)} le mois précédent`} />
            <Tile label="30 derniers jours" value={couts.trente_jours} format={eur} sub={`${eur(couts.trente_par_jour)} par jour`} />
            <Tile label="Cumul enregistré" value={couts.total} format={eur} sub={`${couts.lignes} dépense(s) saisie(s)`} />
          </div>
          <div className="pl-grid">
            <Card fold="open" title="Par catégorie" note="Cumul depuis la première dépense saisie">
              <Ranked rows={couts.par_categorie.map((c) => ({ label: c.label, n: c.depense }))} format={eur} empty="Aucune dépense saisie" />
            </Card>
            <Card fold="open" title="Par fournisseur" wide note="Cumul depuis la première dépense saisie">
              <Ranked rows={couts.par_fournisseur} format={eur} empty="Aucune dépense saisie" max={8} />
            </Card>
            <Card fold="open" title="Dernières dépenses" wide>
              <Table
                empty="Aucune dépense saisie : ajoute la première ci-dessous"
                rows={couts.recentes}
                cols={[
                  { key: "jour", label: "Jour", render: (r) => fmtDay(r.jour) },
                  { key: "fournisseur", label: "Fournisseur" },
                  { key: "libelle", label: "Libellé", render: (r) => r.libelle || "–" },
                  { key: "categorie", label: "Catégorie", render: (r) => labelOf[r.categorie] || r.categorie },
                  { key: "montant_eur", label: "Montant", num: true, render: (r) => eur(r.montant_eur) },
                  ...(demo ? [] : [{ key: "x", label: "", render: (r) => (
                    <button type="button" className="pl-link" onClick={() => remove(r.id)} aria-label={`Retirer ${r.fournisseur}`}>
                      Retirer
                    </button>
                  ) }]),
                ]}
              />
            </Card>
            <Card fold="closed" title="Ajouter une dépense" note="En euros : convertis à la main une facture en dollars. Les coûts par appel de Google Places se lisent dans Google Cloud Console, Facturation > Rapports.">
              {demo ? <div className="pl-empty">Indisponible dans le jeu d'exemple</div> : <Ajout onDone={onChange} />}
            </Card>
          </div>
        </>
      )}
    </Section>
  );
}
