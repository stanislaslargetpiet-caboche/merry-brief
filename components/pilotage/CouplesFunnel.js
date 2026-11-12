"use client";

// Page « Couples › Funnel » du pilotage : l'entonnoir des couples (lib/pilotage/funnel.js), puis un mariage par
// ligne avec son étape et ce qui le rend peut-être hors sujet. Un clic sur une étape ne garde que les couples arrêtés
// là, un clic sur un intitulé classe le tableau sur cette colonne (tests toujours en bas). Mêmes données que Par
// couple (clé `utilisateurs` de /api/interne/pilotage). Colonne Mails (D-289) : un
// interrupteur sort le couple des mails de démarrage ou l'y remet, « Voir les mails » ouvre son planning (mails à
// venir, à lire ou à retirer un à un, et mails déjà partis), servi par /api/interne/pilotage/demarrage. La flèche
// après le nom déroule sous la ligne les adresses des inscrits du couple, sans l'équipe. La pastille « test » prend
// la place de la date, sinon elle s'ajouterait à la flèche et le tableau dépasserait la carte.

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card, Funnel, Pill, PilotDots, Section, Table } from "@/components/pilotage/ui";
import { dateCouple, fmtDay, visiteCell, visiteTs } from "@/components/pilotage/Utilisateurs";
import { ETAPES, buildFunnel } from "@/lib/pilotage/funnel";
import { demoMails } from "@/lib/server/pilotage/demo";
import { fmtInt } from "@/lib/server/pilotage/shape";

const AUCUN = [];
const TOUT = "tout";

const muted = (text) => <span className="pl-muted">{text}</span>;
const num = (n) => (n ? fmtInt(n) : muted("0"));

async function call(query, init) {
  const { data } = await supabase.auth.getSession();
  const res = await fetch(`/api/interne/pilotage/demarrage${query}`, {
    ...init,
    headers: { authorization: `Bearer ${data?.session?.access_token || ""}`, "content-type": "application/json" },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `erreur ${res.status}`);
  return body;
}

const PARIS = { timeZone: "Europe/Paris" };
const jourParis = (d) => new Date(d).toLocaleDateString("fr-CA", PARIS);
const heure = (iso) => new Date(iso).toLocaleTimeString("fr-FR", { ...PARIS, hour: "numeric", minute: "2-digit" }).replace(":00", " h").replace(":", " h ");
const majuscule = (s) => `${s.charAt(0).toUpperCase()}${s.slice(1)}`;
const joinEt = (noms) => (noms.length > 1 ? `${noms.slice(0, -1).join(", ")} et ${noms[noms.length - 1]}` : noms[0] || "");

// « Ce soir, 20 h », « Demain, 20 h », puis « Samedi 14 nov., 20 h »
function quand(iso) {
  const ecart = Math.round((Date.parse(jourParis(iso)) - Date.parse(jourParis(new Date()))) / 86400000);
  if (ecart === 0) return `Ce soir, ${heure(iso)}`;
  if (ecart === 1) return `Demain, ${heure(iso)}`;
  return `${majuscule(new Date(iso).toLocaleDateString("fr-FR", { ...PARIS, weekday: "long", day: "numeric", month: "short" }))}, ${heure(iso)}`;
}

const envoye = (iso) => `${new Date(iso).toLocaleDateString("fr-FR", { ...PARIS, day: "numeric", month: "short" })}, ${heure(iso)}`;

function Interrupteur({ on, disabled, label, onChange }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} className={`pl-switch${on ? " is-on" : ""}`} disabled={disabled} onClick={() => onChange(!on)}>
      <span />
    </button>
  );
}

function Fleche({ ouvert, couple, onClick }) {
  return (
    <button type="button" className="pl-fleche" aria-expanded={ouvert} aria-label={`Adresses de ${couple}`} onClick={onClick}>
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M4 6l4 4 4-4" />
      </svg>
    </button>
  );
}

function coupleCell(r, fleche) {
  return (
    <>
      <strong>{r.couple}</strong>
      {fleche}
      <span className="pl-cell-sub">
        {r.test ? (
          <span title="Compte de test : en bas de la liste, sans mails">
            <Pill>test</Pill>
          </span>
        ) : (
          dateCouple(r)
        )}
      </span>
    </>
  );
}

function inscrits(r) {
  const emails = (r.comptes || []).filter((c) => c.couple !== false && c.email).map((c) => c.email);
  return (
    <span className="pl-inscrits">
      {emails.length ? emails.map((e) => <span key={e}>{e}</span>) : muted("Aucune adresse")}
    </span>
  );
}

const stadeCell = (r) => (
  <span title={ETAPES[r.stade].detail}>
    <Pill>{ETAPES[r.stade].pastille}</Pill>
  </span>
);

function signauxCell(r) {
  if (!r.signaux.length) return muted("–");
  return (
    <span className="pl-people pl-signaux">
      {r.signaux.map((s) => (
        <span key={s.id} title={s.title}>
          <Pill tone={s.tone}>{s.label}</Pill>
        </span>
      ))}
    </span>
  );
}

function MailPrevu({ mail, busy, onRetirer }) {
  const [ouvert, setOuvert] = useState(false);
  return (
    <div className="pl-mail-ligne">
      <span className="pl-muted">{quand(mail.soir)}</span>
      <strong>{mail.titre}</strong>
      <span className="pl-muted">
        « {mail.objet} » · à {joinEt(mail.a)}
      </span>
      <span className="pl-demande-actions">
        <button type="button" className="pl-btn" aria-expanded={ouvert} onClick={() => setOuvert(!ouvert)} disabled={!mail.html}>
          {ouvert ? "Masquer" : "Voir"}
        </button>
        <button type="button" className="pl-btn" onClick={onRetirer} disabled={busy}>
          Retirer
        </button>
      </span>
      {ouvert ? <iframe title={`Aperçu : ${mail.titre}`} srcDoc={mail.html} sandbox="" className="pl-mail-preview" /> : null}
    </div>
  );
}

// Planning d'un couple, dans un panneau à droite : interrupteur, mails à venir, mails retirés, mails déjà partis
function MailsCouple({ row, demo, retires, onRetrait, onClose }) {
  const [lu, setLu] = useState(null);
  const [erreur, setErreur] = useState(null);
  const [busy, setBusy] = useState(false);
  const detail = demo ? demoMails(row, retires) : lu;

  const load = useCallback(async () => {
    if (demo) return;
    try {
      setLu(await call(`?mariage=${row.id}`, { method: "GET" }));
      setErreur(null);
    } catch (e) {
      setErreur(`Lecture impossible : ${e.message}`);
    }
  }, [demo, row.id]);

  useEffect(() => {
    const timer = setTimeout(load, 0);
    return () => clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    const echap = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", echap);
    return () => window.removeEventListener("keydown", echap);
  }, [onClose]);

  const retirer = async (etape, retire) => {
    setBusy(true);
    await onRetrait(row.id, etape, retire);
    await load();
    setBusy(false);
  };

  const sorti = retires.includes(TOUT);
  const vide = detail?.test ? "Couple de test : aucun mail de démarrage." : sorti ? "Sorti des mails de démarrage." : "Aucun mail prévu.";
  return (
    <div className="pl-tiroir-fond" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <aside className="pl-tiroir" role="dialog" aria-modal="true" aria-label={`Mails de ${row.couple}`}>
        <div className="pl-tiroir-tete">
          <h3>{row.couple}</h3>
          <button type="button" className="pl-btn" onClick={onClose}>
            Fermer
          </button>
        </div>
        {row.test ? null : (
          <div className="pl-tiroir-switch">
            <span>Mails de démarrage</span>
            <Interrupteur on={!sorti} disabled={busy} label={`Mails de démarrage pour ${row.couple}`} onChange={(on) => retirer(TOUT, !on)} />
          </div>
        )}
        {erreur ? <div className="pl-empty">{erreur}</div> : null}
        {detail ? (
          <>
            <h4>À venir</h4>
            {detail.a_venir.length ? detail.a_venir.map((m) => <MailPrevu key={`${m.soir}|${m.etape}`} mail={m} busy={busy} onRetirer={() => retirer(m.etape, true)} />) : <div className="pl-empty">{vide}</div>}
            {detail.retires.map((r) => (
              <div key={r.etape} className="pl-mail-ligne is-retire">
                <strong>{r.titre}</strong>
                <span className="pl-demande-actions">
                  <Pill>Retiré</Pill>
                  <button type="button" className="pl-btn" onClick={() => retirer(r.etape, false)} disabled={busy}>
                    Remettre
                  </button>
                </span>
              </div>
            ))}
            {detail.desinscrits.length ? <div className="pl-empty">Désinscription des conseils : {joinEt(detail.desinscrits)}</div> : null}
            <h4>Déjà envoyés</h4>
            {detail.envoyes.length ? (
              <ul className="pl-mail-envoyes">
                {detail.envoyes.map((e) => (
                  <li key={`${e.at}|${e.libelle}|${e.a}`}>
                    <span className="pl-muted">{envoye(e.at)}</span>
                    <strong>{e.libelle}</strong>
                    <span className="pl-muted">à {e.a}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="pl-empty">Rien pour l&apos;instant.</div>
            )}
          </>
        ) : erreur ? null : (
          <PilotDots />
        )}
      </aside>
    </div>
  );
}

export default function CouplesFunnel({ data, demo = false }) {
  const [choix, setChoix] = useState(null);
  const [mails, setMails] = useState(demo ? { disponible: true, retraits: {} } : null);
  const [ouvert, setOuvert] = useState(null);
  const [note, setNote] = useState(null);
  const [deplies, setDeplies] = useState(() => new Set());
  const { etapes, lignes } = useMemo(() => buildFunnel(data?.mariages || []), [data]);

  useEffect(() => {
    if (demo) return undefined;
    let vivant = true;
    const timer = setTimeout(async () => {
      try {
        const lus = await call("", { method: "GET" });
        if (vivant) setMails(lus);
      } catch {
        if (vivant) setMails({ disponible: false });
      }
    }, 0);
    return () => {
      vivant = false;
      clearTimeout(timer);
    };
  }, [demo]);

  const retraitsDe = (id) => mails?.retraits?.[id] || AUCUN;
  const poser = (id, liste) => setMails((m) => ({ ...m, retraits: { ...m.retraits, [id]: liste } }));
  // Affiché tout de suite, rétabli si l'enregistrement échoue
  const retrait = async (id, etape, retire) => {
    const avant = retraitsDe(id);
    poser(id, retire ? [...avant.filter((e) => e !== etape), etape] : avant.filter((e) => e !== etape));
    if (demo) return;
    try {
      const res = await call("", { method: "POST", body: JSON.stringify({ mariage: id, etape, retire }) });
      poser(id, res.retraits);
      setNote(null);
    } catch (e) {
      poser(id, avant);
      setNote(`Non enregistré : ${e.message}`);
    }
  };
  const fermer = useCallback(() => setOuvert(null), []);
  const deplier = (id) =>
    setDeplies((d) => {
      const n = new Set(d);
      if (!n.delete(id)) n.add(id);
      return n;
    });

  if (!data) {
    return (
      <Section id="funnel">
        <div className="pl-empty">Utilisateurs non lus : voir la page Santé.</div>
      </Section>
    );
  }
  const actif = Boolean(mails?.disponible);
  const mailsCell = (r) =>
    r.test ? (
      muted("–")
    ) : (
      <span className="pl-mails-cell">
        <Interrupteur on={!retraitsDe(r.id).includes(TOUT)} disabled={!actif} label={`Mails de démarrage pour ${r.couple}`} onChange={(on) => retrait(r.id, TOUT, !on)} />
        <button type="button" className="pl-chip" onClick={() => setOuvert(r)} disabled={!actif}>
          Voir les mails
        </button>
      </span>
    );
  const rows = choix === null ? lignes : lignes.filter((m) => m.stade === choix);
  const titre = choix === null ? `${fmtInt(etapes[0].n)} couples` : `Arrêtés à « ${etapes[choix].label} » : ${fmtInt(etapes[choix].ici)}`;
  return (
    <Section id="funnel">
      <Card>
        <Funnel steps={etapes} selected={choix} onSelect={(i) => setChoix(choix === i ? null : i)} empty="Aucun couple" />
      </Card>
      <Card>
        <div className="pl-funnel-head">
          <h3>{titre}</h3>
          <span className="pl-demande-actions">
            {note ? <Pill tone="warn">{note}</Pill> : null}
            {mails && !actif ? <Pill tone="warn">Mails de démarrage non lus</Pill> : null}
            {choix !== null ? (
              <button type="button" className="pl-chip" onClick={() => setChoix(null)}>
                Tout voir
              </button>
            ) : null}
          </span>
        </div>
        <Table
          cols={[
            { key: "couple", label: "Couple", render: (r) => coupleCell(r, <Fleche ouvert={deplies.has(r.id)} couple={r.couple} onClick={() => deplier(r.id)} />), sort: (r) => r.couple },
            { key: "stade", label: "Étape", render: stadeCell, sort: (r) => r.stade },
            { key: "cree", label: "Inscrit", render: (r) => (r.cree ? fmtDay(r.cree) : "–"), sort: (r) => (r.cree ? Date.parse(r.cree) : null) },
            { key: "visite", label: "Dernière visite", render: visiteCell, sort: visiteTs },
            { key: "invites", group: "Avancement", label: "Invités", num: true, render: (r) => num(r.invites), sort: (r) => r.invites },
            { key: "reponses", group: "Avancement", label: "Réponses", num: true, render: (r) => num(r.reponses_formulaire), sort: (r) => r.reponses_formulaire },
            { key: "equipe", group: "Avancement", label: "Équipe", num: true, render: (r) => num(r.equipe), sort: (r) => r.equipe },
            { key: "budget", group: "Avancement", label: "Budget", render: (r) => (r.budget_touche ? "commencé" : muted("–")), sort: (r) => Boolean(r.budget_touche) },
            { key: "devis", group: "Avancement", label: "Devis", num: true, render: (r) => num(r.devis), sort: (r) => r.devis },
            { key: "signaux", label: "À regarder", render: signauxCell, sort: (r) => r.signaux.length },
            { key: "mails", label: "Mails", render: mailsCell, sort: (r) => (r.test ? null : !retraitsDe(r.id).includes(TOUT)) },
          ]}
          rows={rows}
          rowClass={(r) => (r.test ? "is-test" : null)}
          detail={(r) => (deplies.has(r.id) ? inscrits(r) : null)}
          pinLast={(r) => r.test}
          max={300}
          empty="Aucun couple à cette étape"
        />
      </Card>
      {ouvert ? <MailsCouple row={ouvert} demo={demo} retires={retraitsDe(ouvert.id)} onRetrait={retrait} onClose={fermer} /> : null}
    </Section>
  );
}
