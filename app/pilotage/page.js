"use client";

// Pilotage : tous les indicateurs de Merry sur une page (site, appli, prestataires, mails, bugs, déploiements),
// réservée aux adresses de PILOTAGE_EMAILS. Les données viennent de /api/interne/pilotage ; la page ne fait
// que les mettre en forme. Chaque chiffre de période est comparé à la période précédente de même longueur.

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { alignSeries, fmtDateTime, fmtDay, fmtDuration, fmtInt, fmtPct, pctOf, splitSeries, sumBy } from "@/lib/server/pilotage/shape";
import { Card, DayBars, Funnel, Pill, Ranked, Section, Table, Tile } from "@/components/pilotage/ui";
import { demoData } from "@/lib/server/pilotage/demo";

// ?demo=1 (ou pas de Supabase en local) : la page se dessine avec un jeu d'exemple, jamais de vraies mesures
function readDemoFlag() {
  try {
    return new URLSearchParams(window.location.search).get("demo") === "1";
  } catch {
    return false;
  }
}

const RANGES = [
  { jours: 1, label: "24 h" },
  { jours: 7, label: "7 jours" },
  { jours: 30, label: "30 jours" },
];

function useToken() {
  const [state, setState] = useState({ status: "loading", token: null, email: null });
  useEffect(() => {
    let alive = true;
    (async () => {
      if (readDemoFlag() || !supabase) return setState({ status: "demo", token: null, email: null });
      const { data } = await supabase.auth.getSession();
      if (!alive) return;
      const s = data?.session;
      setState(s ? { status: "ok", token: s.access_token, email: s.user?.email } : { status: "signedout", token: null, email: null });
    })();
    return () => {
      alive = false;
    };
  }, []);
  return state;
}

export default function PilotagePage() {
  const auth = useToken();
  const [jours, setJours] = useState(7);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(
    async (j) => {
      if (!auth.token) return;
      setBusy(true);
      setError(null);
      try {
        const res = await fetch(`/api/interne/pilotage?jours=${j}`, { headers: { authorization: `Bearer ${auth.token}` }, cache: "no-store" });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error === "interdit" ? "interdit" : body.error === "connexion" ? "connexion" : `erreur ${res.status}`);
        }
        setData(await res.json());
      } catch (e) {
        setError(String(e.message || e));
      } finally {
        setBusy(false);
      }
    },
    [auth.token],
  );

  useEffect(() => {
    if (auth.status === "ok") load(jours);
    if (auth.status === "demo") setData(demoData(jours));
  }, [auth.status, jours, load]);

  if (auth.status === "loading") return <Gate title="Pilotage" text="Un instant…" />;
  if (auth.status === "signedout" || error === "connexion")
    return (
      <Gate title="Pilotage" text="Connectez-vous avec le compte Merry autorisé pour lire les indicateurs.">
        <a className="pl-btn is-primary" href="/connexion?next=%2Fpilotage">
          Me connecter
        </a>
      </Gate>
    );
  if (error === "interdit") return <Gate title="Réservé" text={`Le compte ${auth.email || ""} n'a pas accès au pilotage.`} />;

  return (
    <div className="pl-root">
      <div className="pl-wrap">
        <header className="pl-top">
          <div className="pl-top-left">
            <a className="pl-logo" href="/dashboard">
              Merry
            </a>
            <span className="pl-title">Pilotage</span>
            {data ? <span className="pl-generated">{data.demo ? "jeu d'exemple, pas de vraies mesures" : `généré le ${fmtDateTime(data.genere)}`}</span> : null}
          </div>
          <div className="pl-top-right">
            <div className="pl-ranges" role="tablist" aria-label="Période">
              {RANGES.map((r) => (
                <button key={r.jours} type="button" role="tab" aria-selected={jours === r.jours} className={jours === r.jours ? "is-on" : ""} disabled={busy} onClick={() => setJours(r.jours)}>
                  {r.label}
                </button>
              ))}
            </div>
            <button type="button" className="pl-btn" onClick={() => load(jours)} disabled={busy || auth.status === "demo"}>
              {busy ? "Chargement…" : "Actualiser"}
            </button>
          </div>
        </header>
        <nav className="pl-nav" aria-label="Sections">
          <a href="#sante">Santé</a>
          <a href="#site">Site</a>
          <a href="#appli">Appli</a>
          <a href="#produit">Produit</a>
          <a href="#prestataires">Prestataires</a>
          <a href="#mails">Mails</a>
          <a href="#bugs">Bugs</a>
        </nav>
        {error ? <div className="pl-errors">Impossible de charger les indicateurs ({error}).</div> : null}
        {!data && !error ? <div className="pl-loading">Lecture de Supabase, PostHog, Resend et Vercel…</div> : null}
        {data ? <Board data={data} jours={jours} /> : null}
      </div>
    </div>
  );
}

function Gate({ title, text, children }) {
  return (
    <div className="pl-root">
      <div className="pl-gate">
        <h1>{title}</h1>
        <p>{text}</p>
        {children}
      </div>
    </div>
  );
}

const LABEL_PERIODE = { 1: "24 h", 7: "7 jours", 30: "30 jours" };

function Board({ data, jours }) {
  const sb = data.supabase;
  const ph = data.posthog?.disponible ? data.posthog : null;
  const rs = data.resend?.disponible ? data.resend : null;
  const vc = data.vercel?.disponible ? data.vercel : null;
  const periode = LABEL_PERIODE[jours] || `${jours} jours`;

  const joursList = useMemo(() => (sb?.series || []).map((r) => r.jour), [sb]);
  const sbSplit = useMemo(() => splitSeries(sb?.series || [], jours), [sb, jours]);
  const site = useMemo(() => alignSeries(joursList, ph?.site?.series, ["visiteurs", "pages", "sessions"]), [joursList, ph]);
  const siteSplit = useMemo(() => splitSeries(site, jours), [site, jours]);
  const app = useMemo(() => alignSeries(joursList, ph?.app?.series, ["sessions", "pages", "duree", "sessions2"]), [joursList, ph]);
  const appPeople = useMemo(() => alignSeries(joursList, ph?.app?.personnes_series, ["personnes"]), [joursList, ph]);
  const appMerged = useMemo(() => app.map((r, i) => ({ ...r, personnes: appPeople[i]?.personnes || 0 })), [app, appPeople]);
  const appSplit = useMemo(() => splitSeries(appMerged, jours), [appMerged, jours]);
  const bugs = useMemo(() => alignSeries(joursList, ph?.bugs?.series, ["exceptions", "rage", "morts"]), [joursList, ph]);
  const bugsSplit = useMemo(() => splitSeries(bugs, jours), [bugs, jours]);

  const t = sb?.totaux || {};
  const cur = (k) => sumBy(sbSplit.current, k);
  const prev = (k) => sumBy(sbSplit.previous, k);

  const exceptionsCur = sumBy(bugsSplit.current, "exceptions");
  const exceptionsPrev = sumBy(bugsSplit.previous, "exceptions");
  const rageCur = sumBy(bugsSplit.current, "rage");
  const mailProblemes = rs ? rs.problemes.length : 0;

  const sante = [];
  if (vc) {
    sante.push({
      tone: vc.erreurs_production ? "bad" : vc.erreurs ? "warn" : "ok",
      titre: vc.erreurs_production ? `${vc.erreurs_production} déploiement(s) de production en échec` : vc.erreurs ? `${vc.erreurs} déploiement(s) de prévisualisation en échec` : "Déploiements Vercel sans échec",
      detail: vc.derniere_production ? `Dernière production prête ${fmtDateTime(vc.derniere_production.quand)} · ${vc.derniere_production.message || vc.derniere_production.commit || ""}` : "Aucune production sur la période",
    });
  } else {
    sante.push({ tone: "neutral", titre: "Déploiements Vercel non lus", detail: data.vercel?.raison || "ajoute VERCEL_API_TOKEN sur Vercel (Production) pour les afficher ici" });
  }
  if (ph) {
    sante.push({
      tone: exceptionsCur > 0 ? (exceptionsCur > exceptionsPrev ? "bad" : "warn") : "ok",
      titre: exceptionsCur ? `${fmtInt(exceptionsCur)} erreur(s) JavaScript sur ${periode}` : `Aucune erreur JavaScript sur ${periode}`,
      detail: exceptionsPrev ? `${fmtInt(exceptionsPrev)} sur la période précédente` : "rien non plus sur la période précédente",
    });
    sante.push({
      tone: rageCur > 0 ? "warn" : "ok",
      titre: rageCur ? `${fmtInt(rageCur)} clic(s) de rage` : "Aucun clic de rage",
      detail: rageCur ? "une personne a cliqué plusieurs fois au même endroit sans effet : voir la section Bugs" : "personne ne s'est acharné sur un bouton muet",
    });
  } else {
    sante.push({ tone: "neutral", titre: "PostHog non lu", detail: data.posthog?.raison || "clé manquante" });
  }
  if (rs) {
    sante.push({
      tone: mailProblemes ? "bad" : "ok",
      titre: mailProblemes ? `${mailProblemes} mail(s) en difficulté` : `${fmtInt(rs.envoyes)} mail(s) envoyés, aucun rebond`,
      detail: mailProblemes ? rs.problemes.map((m) => `${m.etat} · ${m.a}`).slice(0, 3).join(" ; ") : Object.entries(rs.par_etat).map(([k, n]) => `${n} ${k}`).join(", ") || "rien sur la période",
    });
  }
  if (t.comptes_jamais_connectes > 0) sante.push({ tone: "warn", titre: `${t.comptes_jamais_connectes} compte(s) jamais connecté(s)`, detail: "créés sans jamais ouvrir le tableau de bord" });
  if (t.organisateurs_invites_en_attente > 0) sante.push({ tone: "neutral", titre: `${t.organisateurs_invites_en_attente} invitation(s) d'organisateur en attente`, detail: "mail envoyé, compte pas encore créé" });
  if (t.catalogue_sans_photo > 0) sante.push({ tone: "neutral", titre: `${fmtInt(t.catalogue_sans_photo)} prestataire(s) actifs sans photo`, detail: "ils passent derrière les autres dans les propositions" });
  if (sb?.repli) sante.push({ tone: "warn", titre: "Supabase en mode réduit", detail: "pilotage_stats n'existe pas encore : colle supabase/pilotage.sql dans le SQL Editor pour le catalogue par métier, les fiches pro, les RSVP et les demandes détaillées" });
  if (sb && sbSplit.current.length === 0) sante.push({ tone: "warn", titre: "Série Supabase vide", detail: "pilotage_stats n'a rien renvoyé pour la période" });
  for (const e of data.erreurs || []) sante.push({ tone: "bad", titre: `Source en échec : ${e.source}`, detail: e.message });

  const appS = ph?.app?.sessions;
  const appP = ph?.app?.sessions_prec;
  const siteB = ph?.site?.rebond;
  const siteBP = ph?.site?.rebond_prec;
  const catalogue = sb?.catalogue || [];

  return (
    <>
      <Section id="sante" title="Santé" kicker="À regarder d'abord">
        <div className="pl-health">
          {sante.map((s, i) => (
            <div className="pl-health-item" key={i}>
              <Pill tone={s.tone}>{s.tone === "ok" ? "OK" : s.tone === "bad" ? "Alerte" : s.tone === "warn" ? "À voir" : "Info"}</Pill>
              <div>
                <strong>{s.titre}</strong>
                <span className="pl-muted">{s.detail}</span>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section id="site" title="Site vitrine" kicker={`withmerry.com · ${periode}`}>
        {ph ? (
          <>
            <div className="pl-tiles">
              <Tile label="Visiteurs" value={sumBy(siteSplit.current, "visiteurs")} prev={sumBy(siteSplit.previous, "visiteurs")} hint="Personnes distinctes ayant vu au moins une page (PostHog, après accord cookies)" />
              <Tile label="Pages vues" value={sumBy(siteSplit.current, "pages")} prev={sumBy(siteSplit.previous, "pages")} />
              <Tile label="Sessions" value={siteB?.sessions || 0} prev={siteBP?.sessions} />
              <Tile label="Taux de rebond" value={pctOf(siteB?.rebonds, siteB?.sessions)} prev={pctOf(siteBP?.rebonds, siteBP?.sessions)} format={(v) => `${v} %`} inverse hint="Sessions d'une seule page" />
              <Tile label="Durée moyenne" value={Math.round(siteB?.duree || 0)} prev={Math.round(siteBP?.duree || 0)} format={fmtDuration} />
            </div>
            <div className="pl-grid">
              <Card title="Visiteurs par jour" wide>
                <DayBars series={site} keys={["visiteurs", "pages"]} labels={["Visiteurs", "Pages vues"]} days={jours} />
              </Card>
              <Card title="D'où viennent les sessions">
                <Ranked rows={ph.site.sources} label="source" />
              </Card>
              <Card title="Pages les plus vues">
                <Ranked rows={ph.site.pages.map((p) => ({ label: p.chemin, n: p.vues, sub: `${fmtInt(p.visiteurs)} visiteurs` }))} />
              </Card>
              <Card title="Pages d'entrée">
                <Ranked rows={ph.site.entrees.map((p) => ({ label: p.chemin, n: p.n }))} />
              </Card>
              <Card title="Appareils et pays">
                <Ranked rows={ph.site.appareils} max={4} />
                <div style={{ height: 10 }} />
                <Ranked rows={ph.site.pays} max={5} />
              </Card>
              {ph.site.utm.length ? (
                <Card title="Campagnes (utm)">
                  <Ranked rows={ph.site.utm.map((u) => ({ label: `${u.source}${u.campagne ? ` · ${u.campagne}` : ""}`, n: u.n }))} />
                </Card>
              ) : null}
            </div>
          </>
        ) : (
          <div className="pl-empty">PostHog n'est pas lisible : {data.posthog?.raison || "voir la section Santé"}.</div>
        )}
      </Section>

      <Section id="appli" title="Appli organisateurs" kicker={`app.withmerry.com · ${periode}`}>
        <div className="pl-tiles">
          <Tile label="Comptes au total" value={t.comptes} sub={`${fmtInt(t.comptes_actifs)} connectés sur ${periode}`} />
          <Tile label="Nouveaux comptes" value={cur("inscriptions")} prev={prev("inscriptions")} />
          <Tile label="Comptes connectés" value={t.comptes_actifs} prev={t.comptes_actifs_prec} hint="Dernière connexion dans la période (Supabase Auth, sans dépendre des cookies)" />
          {ph ? (
            <>
              <Tile label="Personnes vues (PostHog)" value={ph.app.personnes} prev={ph.app.personnes_prec} hint="Après accord cookies seulement" />
              <Tile label="Sessions" value={appS?.n || 0} prev={appP?.n} />
              <Tile label="Durée moyenne" value={Math.round(appS?.duree || 0)} prev={Math.round(appP?.duree || 0)} format={fmtDuration} hint={`Médiane ${fmtDuration(appS?.mediane || 0)}`} />
              <Tile label="Pages par session" value={appS?.pages || 0} prev={appP?.pages} format={(v) => (Math.round(Number(v) * 10) / 10).toLocaleString("fr-FR")} />
              <Tile label="Sessions d'une minute ou plus" value={pctOf(appS?.engagees, appS?.n)} prev={pctOf(appP?.engagees, appP?.n)} format={(v) => `${v} %`} />
            </>
          ) : null}
        </div>
        <div className="pl-grid">
          <Card title="Nouveaux comptes par jour" wide>
            <DayBars series={sb?.series} keys={["inscriptions", "mariages"]} labels={["Comptes", "Mariages créés"]} days={jours} />
          </Card>
          <Card title="Entonnoir d'onboarding" note="Personnes distinctes ayant vu chaque écran, puis comptes créés. PostHog ne compte que les visiteurs qui acceptent les cookies.">
            {ph ? (
              <Funnel
                steps={[
                  { label: "La fête", n: ph.app.funnel.fete },
                  { label: "L'équipe", n: ph.app.funnel.equipe },
                  { label: "L'essentiel", n: ph.app.funnel.essentiel },
                  { label: "Le compte", n: ph.app.funnel.compte },
                  { label: "Compte créé", n: ph.app.funnel.termine },
                ]}
              />
            ) : (
              <div className="pl-empty">PostHog non lu</div>
            )}
            {ph?.app.funnel.echecs ? <p className="pl-note">{fmtInt(ph.app.funnel.echecs)} échec(s) de création de compte.</p> : null}
          </Card>
          {ph ? (
            <>
              <Card title="Sessions et personnes par jour" wide>
                <DayBars series={appMerged} keys={["sessions", "personnes"]} labels={["Sessions", "Personnes"]} days={jours} />
              </Card>
              <Card title="Appareils">
                <Ranked rows={ph.app.appareils} max={4} />
                <p className="pl-note">Le téléphone est attendu autour de 80 % de l'usage.</p>
              </Card>
              <Card title="Pages les plus vues" wide>
                <Table
                  cols={[
                    { key: "chemin", label: "Page", render: (r) => <span className="pl-mono">{r.chemin}</span> },
                    { key: "vues", label: "Vues", num: true, render: (r) => fmtInt(r.vues) },
                    { key: "sessions", label: "Sessions", num: true, render: (r) => fmtInt(r.sessions) },
                    { key: "personnes", label: "Personnes", num: true, render: (r) => fmtInt(r.personnes) },
                  ]}
                  rows={ph.app.pages}
                  max={14}
                />
              </Card>
              <Card title="Où le temps passe" note="Temps entre un événement et le suivant dans la même session, plafonné à 30 minutes ; le dernier écran d'une session n'est pas compté.">
                <Ranked rows={ph.app.temps.map((p) => ({ label: p.chemin, n: p.total, sub: `${fmtDuration(p.moyenne)} par passage` }))} format={fmtDuration} max={10} />
              </Card>
            </>
          ) : null}
        </div>
      </Section>

      <Section id="produit" title="Ce que les couples font" kicker={`Supabase · ${periode}`}>
        <div className="pl-tiles">
          <Tile label="Mariages" value={t.mariages} sub={`${fmtInt(t.mariages_avec_date)} avec une date`} />
          <Tile label="Organisateurs" value={t.organisateurs} sub={`${fmtInt(t.organisateurs_invites_en_attente)} invitation(s) en attente`} />
          <Tile label="Invités saisis" value={t.invites} sub={t.mariages_avec_invites != null ? `dans ${fmtInt(t.mariages_avec_invites)} mariage(s)` : null} />
          <Tile label="Réponses RSVP" value={cur("reponses_rsvp")} prev={prev("reponses_rsvp")} hint="Lignes du journal des réponses (formulaire et saisie)" />
          <Tile label="Demandes de devis" value={cur("demandes")} prev={prev("demandes")} sub={`${fmtInt(t.demandes_devis)} au total`} />
          <Tile label="Messages couple → pro" value={cur("messages_couple")} prev={prev("messages_couple")} />
          <Tile label="Réponses pro → couple" value={cur("messages_pro")} prev={prev("messages_pro")} />
          <Tile label="Sites de mariage publiés" value={t.sites_publies} sub={sb?.repli ? null : `${fmtInt(cur("visites_sites"))} visite(s) sur ${periode}`} />
          <Tile label="Formulaires publiés" value={t.formulaires_publies} sub={t.reponses_formulaires != null ? `${fmtInt(t.reponses_formulaires)} réponse(s) reçue(s)` : null} />
          <Tile label="Tâches" value={t.taches} sub={`${fmtPct(t.taches_faites, t.taches)} faites`} />
          <Tile label="Lignes de budget" value={t.lignes_budget} sub={`${fmtInt(t.documents)} document(s)`} />
          <Tile label="Appels IA" value={cur("appels_ia")} prev={prev("appels_ia")} hint="Import d'invités, lecture de devis, comparaison de prestataires" />
        </div>
        <div className="pl-grid">
          <Card title="Demandes et messages par jour" wide>
            <DayBars series={sb?.series} keys={["demandes", "messages_couple"]} labels={["Demandes de devis", "Messages"]} days={jours} />
          </Card>
          <Card title="Réponses RSVP et visites des sites">
            <DayBars series={sb?.series} keys={["reponses_rsvp", "visites_sites"]} labels={["Réponses", "Visites"]} days={jours} height={80} />
          </Card>
          <Card title="Derniers comptes" wide>
            <Table
              cols={[
                { key: "email", label: "Adresse" },
                { key: "prenoms", label: "Couple", render: (r) => r.prenoms || <span className="pl-muted">{sb?.repli ? "–" : "sans mariage"}</span> },
                { key: "cree", label: "Créé", render: (r) => fmtDateTime(r.cree) },
                { key: "derniere_connexion", label: "Dernière connexion", render: (r) => fmtDateTime(r.derniere_connexion) },
              ]}
              rows={sb?.derniers_comptes}
            />
          </Card>
          <Card title="Dernières demandes de devis">
            <Table
              cols={[
                { key: "quand", label: "Quand", render: (r) => fmtDateTime(r.quand) },
                { key: "couple", label: "Couple" },
                { key: "prestataire", label: "Prestataire", render: (r) => `${r.prestataire}${r.categorie ? ` · ${r.categorie}` : ""}` },
              ]}
              rows={sb?.dernieres_demandes}
              max={10}
            />
          </Card>
        </div>
      </Section>

      <Section id="prestataires" title="Prestataires" kicker="Catalogue et espace prestataire">
        <div className="pl-tiles">
          <Tile label="Prestataires actifs" value={t.catalogue_actifs} sub={t.catalogue_fermes != null ? `${fmtInt(t.catalogue_candidats)} candidats, ${fmtInt(t.catalogue_fermes)} fermés` : `${fmtInt(t.catalogue_candidats)} candidats`} />
          <Tile label="Avec 3 photos ou plus" value={pctOf(t.catalogue_photos3, t.catalogue_actifs)} format={(v) => `${v} %`} sub={`${fmtInt(t.catalogue_sans_photo)} sans aucune photo`} />
          <Tile label="Avec un email" value={pctOf(t.catalogue_email, t.catalogue_actifs)} format={(v) => `${v} %`} sub={`${fmtInt(t.catalogue_email)} fiches`} />
          <Tile label="Avec un téléphone" value={pctOf(t.catalogue_telephone, t.catalogue_actifs)} format={(v) => `${v} %`} sub={`${fmtInt(t.catalogue_telephone)} fiches`} />
          <Tile label="Fiches revendiquées" value={t.fiches_revendiquees} sub={t.fiches_revendiquees_periode != null ? `${fmtInt(t.fiches_revendiquees_periode)} sur ${periode} · ${fmtInt(t.comptes_pro)} compte(s) pro` : `${fmtInt(t.comptes_pro)} compte(s) pro`} />
          <Tile label="Crédits en circulation" value={t.credits_en_circulation} sub={t.credits_depenses != null ? `${fmtInt(t.credits_depenses)} dépensés au total` : null} />
          <Tile label="Crédits dépensés" value={t.credits_depenses_periode} hint="Réponses payées en crédits sur la période" />
          <Tile label="Vues de fiches pro" value={cur("vues_pro")} prev={prev("vues_pro")} hint="Fiches revendiquées ouvertes par des couples" />
          <Tile label="Clients côté pro" value={t.clients_pro} sub={t.clients_pro_repondus != null ? `${fmtInt(t.clients_pro_repondus)} avec une réponse` : null} />
          <Tile label="Ajoutés par les couples" value={t.catalogue_ajoutes_par_couples} hint="Prestataires créés à la main depuis un tableau de bord" />
        </div>
        <div className="pl-grid">
          <Card title="Catalogue par métier" wide>
            <Table
              cols={[
                { key: "label", label: "Métier" },
                { key: "actifs", label: "Actifs", num: true, render: (r) => fmtInt(r.actifs) },
                { key: "photos3", label: "3 photos +", num: true, render: (r) => fmtPct(r.photos3, r.actifs) },
                { key: "sans_photo", label: "Sans photo", num: true, render: (r) => fmtInt(r.sans_photo) },
                { key: "email", label: "Email", num: true, render: (r) => fmtPct(r.email, r.actifs) },
                { key: "telephone", label: "Téléphone", num: true, render: (r) => fmtPct(r.telephone, r.actifs) },
                { key: "candidats", label: "Candidats", num: true, render: (r) => fmtInt(r.candidats) },
                { key: "revendiques", label: "Revendiqués", num: true, render: (r) => fmtInt(r.revendiques) },
              ]}
              rows={catalogue.filter((c) => c.actifs || c.candidats)}
              max={20}
            />
          </Card>
          <Card title="Fiches revendiquées">
            <Table
              cols={[
                { key: "nom", label: "Fiche", render: (r) => `${r.nom || "?"}${r.categorie ? ` · ${r.categorie}` : ""}` },
                { key: "credits", label: "Crédits", num: true },
                { key: "clients", label: "Clients", num: true },
                { key: "vues", label: "Vues", num: true },
              ]}
              rows={sb?.fiches_pro}
              max={12}
            />
          </Card>
        </div>
      </Section>

      <Section id="mails" title="Mails" kicker={`Resend · ${periode}`}>
        {rs ? (
          <>
            <div className="pl-tiles">
              <Tile label="Envoyés" value={rs.envoyes} sub={rs.tronque ? "limité aux 100 derniers envois" : "tous les envois de la période"} />
              <Tile label="Délivrés" value={rs.par_etat.delivered || 0} sub={fmtPct(rs.par_etat.delivered || 0, rs.envoyes)} />
              <Tile label="Rebonds et plaintes" value={(rs.par_etat.bounced || 0) + (rs.par_etat.complained || 0)} inverse prev={null} />
              <Tile label="Relances planifiées" value={cur("mails_planifies")} prev={prev("mails_planifies")} hint="Tâche Vercel de 8 h UTC (mail_sent)" />
              <Tile label="Désinscriptions" value={t.desinscriptions_mail} inverse />
            </div>
            <div className="pl-grid">
              <Card title="Par type de mail" wide>
                <Ranked rows={rs.sujets.map((s) => ({ label: s.sujet, n: s.n }))} />
              </Card>
              <Card title="Derniers envois">
                <Table
                  cols={[
                    { key: "quand", label: "Quand", render: (r) => fmtDateTime(r.quand) },
                    { key: "sujet", label: "Sujet" },
                    { key: "etat", label: "État", render: (r) => <Pill tone={r.etat === "delivered" ? "ok" : ["bounced", "complained", "failed"].includes(r.etat) ? "bad" : "neutral"}>{r.etat}</Pill> },
                  ]}
                  rows={rs.derniers}
                  max={8}
                />
              </Card>
              {rs.problemes.length ? (
                <Card title="En difficulté" wide>
                  <Table
                    cols={[
                      { key: "quand", label: "Quand", render: (r) => fmtDateTime(r.quand) },
                      { key: "a", label: "Destinataire" },
                      { key: "sujet", label: "Sujet" },
                      { key: "etat", label: "État", render: (r) => <Pill tone="bad">{r.etat}</Pill> },
                    ]}
                    rows={rs.problemes}
                  />
                </Card>
              ) : null}
            </div>
          </>
        ) : (
          <div className="pl-empty">Resend n'est pas lisible : {data.resend?.raison || "voir la section Santé"}.</div>
        )}
      </Section>

      <Section id="bugs" title="Bugs et performance" kicker={`PostHog et Vercel · ${periode}`}>
        {ph ? (
          <>
            <div className="pl-tiles">
              <Tile label="Erreurs JavaScript" value={exceptionsCur} prev={exceptionsPrev} inverse />
              <Tile label="Clics de rage" value={rageCur} prev={sumBy(bugsSplit.previous, "rage")} inverse />
              <Tile label="Clics morts" value={sumBy(bugsSplit.current, "morts")} prev={sumBy(bugsSplit.previous, "morts")} inverse hint="Clics sans aucun effet visible" />
              {vc ? <Tile label="Déploiements" value={vc.total} sub={`${fmtInt(vc.erreurs)} en échec, ${fmtInt(vc.en_cours)} en cours`} /> : null}
            </div>
            <div className="pl-grid">
              <Card title="Erreurs par jour" wide>
                <DayBars series={bugs} keys={["exceptions", "rage"]} labels={["Erreurs", "Clics de rage"]} days={jours} height={80} />
              </Card>
              <Card title="Web vitals (p75)" note="LCP sous 2,5 s, INP sous 200 ms et CLS sous 0,1 sont les seuils de Google.">
                {ph.bugs.vitals.length ? (
                  <Table
                    cols={[
                      { key: "hote", label: "Hôte" },
                      { key: "lcp", label: "LCP", num: true, render: (r) => (r.lcp === null ? "–" : `${(r.lcp / 1000).toFixed(2)} s`) },
                      { key: "inp", label: "INP", num: true, render: (r) => (r.inp === null ? "–" : `${Math.round(r.inp)} ms`) },
                      { key: "cls", label: "CLS", num: true, render: (r) => (r.cls === null ? "–" : r.cls.toFixed(2)) },
                    ]}
                    rows={ph.bugs.vitals}
                  />
                ) : (
                  <div className="pl-empty">Pas de mesure : active « Web vitals » dans PostHog (Autocapture) pour les voir ici.</div>
                )}
              </Card>
              <Card title="Dernières erreurs" wide>
                <Table
                  cols={[
                    { key: "quand", label: "Quand", render: (r) => fmtDateTime(r.quand) },
                    { key: "titre", label: "Erreur", render: (r) => <span title={r.titre}>{r.titre}</span> },
                    { key: "chemin", label: "Page", render: (r) => <span className="pl-mono">{`${r.hote || ""}${r.chemin || ""}`}</span> },
                    { key: "navigateur", label: "Navigateur", render: (r) => `${r.navigateur || "?"}${r.appareil ? ` · ${r.appareil}` : ""}` },
                  ]}
                  rows={ph.bugs.exceptions}
                  max={15}
                  empty="Aucune erreur JavaScript remontée sur la période"
                />
                <p className="pl-note">
                  Détail et replay de chaque session dans <a href="https://eu.posthog.com/project/321035/error_tracking">PostHog, Error tracking</a>.
                </p>
              </Card>
              <Card title="Clics de rage">
                <Ranked rows={ph.bugs.rage.map((r) => ({ label: `${r.hote || ""}${r.chemin || ""}`, n: r.n, sub: fmtDay(r.dernier) }))} empty="Aucun clic de rage" />
              </Card>
              {vc ? (
                <Card title="Déploiements Vercel" wide>
                  <Table
                    cols={[
                      { key: "quand", label: "Quand", render: (r) => fmtDateTime(r.quand) },
                      { key: "etat", label: "État", render: (r) => <Pill tone={r.etat === "READY" ? "ok" : r.etat === "ERROR" ? "bad" : r.etat === "CANCELED" ? "neutral" : "warn"}>{r.etat}</Pill> },
                      { key: "cible", label: "Cible" },
                      { key: "message", label: "Commit", render: (r) => `${r.commit ? `${r.commit} · ` : ""}${r.message || r.branche || ""}` },
                      { key: "duree", label: "Durée", num: true, render: (r) => (r.duree ? fmtDuration(r.duree) : "–") },
                    ]}
                    rows={vc.liste}
                    max={15}
                  />
                </Card>
              ) : (
                <Card title="Déploiements Vercel" wide>
                  <div className="pl-empty">
                    {data.vercel?.raison || "Non disponible"}. Crée un jeton sur vercel.com/account/tokens (portée stan-f307), ajoute-le sur Vercel en variable
                    VERCEL_API_TOKEN (Production), redéploie : la liste et les échecs de build apparaissent ici.
                  </div>
                </Card>
              )}
            </div>
          </>
        ) : (
          <div className="pl-empty">PostHog n'est pas lisible : {data.posthog?.raison || "voir la section Santé"}.</div>
        )}
      </Section>

      {data.erreurs?.length ? (
        <div className="pl-errors">
          <h3>Sources en échec</h3>
          <ul>
            {data.erreurs.map((e, i) => (
              <li key={i}>
                <strong>{e.source}</strong> : {e.message}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <p className="pl-note" style={{ marginTop: 24 }}>
        Liens directs : <a href="https://eu.posthog.com/project/321035">PostHog</a> · <a href="https://supabase.com/dashboard/project/vrmgrcvdqznswzuamezj">Supabase</a> ·{" "}
        <a href="https://vercel.com/stan-f307/merry-brief">Vercel</a> · <a href="https://resend.com/emails">Resend</a>. Période courante en encre dans les graphes, précédente en retrait ; jours en heure de Paris.
      </p>
    </>
  );
}
