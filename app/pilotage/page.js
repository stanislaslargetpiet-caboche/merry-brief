"use client";

// Pilotage : tous les indicateurs de Merry sur une page (site, appli, prestataires, mails, bugs, déploiements),
// réservée aux adresses de PILOTAGE_EMAILS. Les données viennent de /api/interne/pilotage ; la page ne fait
// que les mettre en forme. Chaque chiffre de période est comparé à la période précédente de même longueur.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Couts from "@/components/pilotage/Couts";
import Demandes from "@/components/pilotage/Demandes";
import PilotNav from "@/components/pilotage/PilotNav";
import { supabase } from "@/lib/supabase";
import { alignSeries, dayList, fmtDateTime, fmtDay, fmtDuration, fmtInt, fmtPct, pctOf, splitSeries, sumBy } from "@/lib/server/pilotage/shape";
import { Card, DayBars, Funnel, Pill, Ranked, Section, Table, Tile } from "@/components/pilotage/ui";
import { demoData } from "@/lib/server/pilotage/demo";
import { buildSante } from "@/lib/pilotage/sante";

// ?demo=1 (ou pas de Supabase en local) : la page se dessine avec un jeu d'exemple, jamais de vraies mesures
function readDemoFlag() {
  try {
    return new URLSearchParams(window.location.search).get("demo") === "1";
  } catch {
    return false;
  }
}

const SECTIONS = [
  { id: "sante", label: "Santé" },
  { id: "demandes", label: "Demandes" },
  { id: "couts", label: "Coûts" },
  { id: "site", label: "Site" },
  { id: "referencement", label: "Référencement" },
  { id: "appli", label: "Appli" },
  { id: "produit", label: "Produit" },
  { id: "prestataires", label: "Prestataires" },
  { id: "mails", label: "Mails" },
  { id: "bugs", label: "Bugs" },
];

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
  const rootRef = useRef(null);
  const barRef = useRef(null);

  // Le menu fixe a une hauteur qui change (une ou deux rangées selon la largeur) : la page la mesure pour que
  // les sections s'arrêtent juste dessous quand on clique sur une pastille
  useEffect(() => {
    const bar = barRef.current;
    const root = rootRef.current;
    if (!bar || !root || typeof ResizeObserver === "undefined") return undefined;
    const apply = () => root.style.setProperty("--bar-h", `${Math.ceil(bar.getBoundingClientRect().height)}px`);
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(bar);
    return () => ro.disconnect();
  });

  // Le jeton est repris à chaque lecture : celui du chargement de la page expire au bout d'une heure, et
  // Supabase le renouvelle en arrière-plan. Sur un 401, un renouvellement forcé puis un seul nouvel essai.
  const load = useCallback(
    async (j, frais = false) => {
      if (auth.status !== "ok") return;
      setBusy(true);
      setError(null);
      const call = (token) => fetch(`/api/interne/pilotage?jours=${j}${frais ? "&frais=1" : ""}`, { headers: { authorization: `Bearer ${token}` }, cache: "no-store" });
      try {
        const { data: sess } = await supabase.auth.getSession();
        let res = await call(sess?.session?.access_token || auth.token);
        if (res.status === 401) {
          const { data: fresh } = await supabase.auth.refreshSession();
          if (fresh?.session?.access_token) res = await call(fresh.session.access_token);
        }
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
    [auth.status, auth.token],
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
    <div className="pl-root" ref={rootRef}>
      <header className="pl-bar" ref={barRef}>
        <div className="pl-bar-in">
          <a className="pl-logo" href="/dashboard">
            Merry
          </a>
          <div className="pl-actions">
            <div className="pl-ranges" role="group" aria-label="Période">
              {RANGES.map((r) => (
                <button key={r.jours} type="button" aria-pressed={jours === r.jours} className={`pl-chip${jours === r.jours ? " is-on" : ""}`} disabled={busy} onClick={() => setJours(r.jours)}>
                  {r.label}
                </button>
              ))}
            </div>
            <button type="button" className="pl-btn" onClick={() => load(jours, true)} disabled={busy || auth.status === "demo"}>
              {busy ? "Chargement…" : "Actualiser"}
            </button>
          </div>
          {data ? <PilotNav sections={SECTIONS} offsetRef={barRef} ready={Boolean(data)} /> : null}
        </div>
      </header>
      <div className="pl-wrap">
        <div className="pl-hero">
          <h1>Pilotage</h1>
          <p className="pl-lede">
            Coûts, site, appli, prestataires, mails, référencement et bugs de Merry, relus à l'ouverture.
            {data ? <span className="pl-generated">{data.demo ? "Jeu d'exemple, pas de vraies mesures" : `Généré le ${fmtDateTime(data.genere)}`}</span> : null}
          </p>
        </div>
        {data ? (
          <div className="pl-folds">
            <button type="button" className="pl-chip" onClick={() => window.dispatchEvent(new CustomEvent("pilotage:all", { detail: true }))}>
              Tout déplier
            </button>
            <button type="button" className="pl-chip" onClick={() => window.dispatchEvent(new CustomEvent("pilotage:all", { detail: false }))}>
              Tout replier
            </button>
          </div>
        ) : null}
        {error ? <div className="pl-errors">Impossible de charger les indicateurs ({error}).</div> : null}
        {!data && !error ? <div className="pl-loading">Lecture de Supabase, PostHog, Resend et Vercel…</div> : null}
        {data ? <Board data={data} jours={jours} reload={() => load(jours, true)} /> : null}
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

// Envoie tout de suite le mail du matin à Stan : sert à le vérifier sans attendre 8 h
function SendBrief() {
  const [state, setState] = useState("idle"); // idle | busy | done | error
  const run = async () => {
    setState("busy");
    try {
      const { data: sess } = await supabase.auth.getSession();
      const res = await fetch("/api/interne/quotidien?test=1", { method: "POST", headers: { authorization: `Bearer ${sess?.session?.access_token || ""}` } });
      setState(res.ok ? "done" : "error");
    } catch {
      setState("error");
    }
  };
  return (
    <button type="button" className="pl-btn" onClick={run} disabled={state === "busy"} title="Envoie le mail de 8 h maintenant, avec les chiffres du moment">
      {state === "busy" ? "Envoi…" : state === "done" ? "Mail envoyé" : state === "error" ? "Échec, réessayer" : "Envoyer le mail du jour"}
    </button>
  );
}

// Vide les caches des pages /mariage/… et du sitemap : à utiliser après un enrichissement du catalogue
function RefreshSeo() {
  const [state, setState] = useState("idle"); // idle | busy | done | error
  const run = async () => {
    setState("busy");
    try {
      const { data: sess } = await supabase.auth.getSession();
      const res = await fetch("/api/interne/seo-rafraichir", { method: "POST", headers: { authorization: `Bearer ${sess?.session?.access_token || ""}` } });
      setState(res.ok ? "done" : "error");
    } catch {
      setState("error");
    }
  };
  return (
    <button type="button" className="pl-btn" onClick={run} disabled={state === "busy"} title="Les comptes, les prestataires mis en avant et le sitemap sont recalculés à la prochaine visite de chaque page">
      {state === "busy" ? "Rafraîchissement…" : state === "done" ? "Pages SEO rafraîchies" : state === "error" ? "Échec, réessayer" : "Rafraîchir les pages SEO"}
    </button>
  );
}

function Board({ data, jours, reload }) {
  const demo = Boolean(data.demo);
  const sb = data.supabase;
  const ph = data.posthog?.disponible ? data.posthog : null;
  const rs = data.resend?.disponible ? data.resend : null;
  const vc = data.vercel?.disponible ? data.vercel : null;
  const gsc = data.google?.disponible ? data.google : null;
  const seo = data.seo?.disponible ? data.seo : null;
  const periode = LABEL_PERIODE[jours] || `${jours} jours`;

  const joursList = useMemo(() => (sb?.series?.length ? sb.series.map((r) => r.jour) : dayList(jours)), [sb, jours]);
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

  const sante = buildSante(data, jours);

  const gscSeries = alignSeries(joursList, gsc?.series, ["clics", "impressions", "position"]);
  const gscSplit = splitSeries(gscSeries, jours);
  const organic = alignSeries(joursList, ph?.seo?.series, ["sessions"]);
  const organicSplit = splitSeries(organic, jours);
  const avgPos = (rows) => {
    const seen = rows.filter((r) => r.impressions > 0);
    const imp = sumBy(seen, "impressions");
    return imp ? Math.round((seen.reduce((a, r) => a + r.position * r.impressions, 0) / imp) * 10) / 10 : null;
  };
  const sitemapGsc = gsc?.sitemaps?.[0] || null;

  const appS = ph?.app?.sessions;
  const appP = ph?.app?.sessions_prec;
  const siteB = ph?.site?.rebond;
  const siteBP = ph?.site?.rebond_prec;
  const catalogue = sb?.catalogue || [];

  return (
    <>
      <Section id="sante" title="Santé" kicker="À regarder d'abord" right={demo ? null : <SendBrief />}>
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

      <Demandes demandes={data.demandes} demo={demo} onChange={reload} />

      <Couts couts={data.couts} demo={demo} onChange={reload} />

      <Section defaultOpen={false} id="site" title="Site vitrine" kicker={`withmerry.com · ${periode}`}>
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
              <Card fold="open" title="D'où viennent les sessions">
                <Ranked rows={ph.site.sources} label="source" />
              </Card>
              <Card fold="closed" title="Pages les plus vues">
                <Ranked rows={ph.site.pages.map((p) => ({ label: p.chemin, n: p.vues, sub: `${fmtInt(p.visiteurs)} visiteurs` }))} />
              </Card>
              <Card fold="closed" title="Pages d'entrée">
                <Ranked rows={ph.site.entrees.map((p) => ({ label: p.chemin, n: p.n }))} />
              </Card>
              <Card fold="closed" title="Appareils et pays">
                <Ranked rows={ph.site.appareils} max={4} />
                <div style={{ height: 10 }} />
                <Ranked rows={ph.site.pays} max={5} />
              </Card>
              {ph.site.utm.length ? (
                <Card fold="closed" title="Campagnes (utm)">
                  <Ranked rows={ph.site.utm.map((u) => ({ label: `${u.source}${u.campagne ? ` · ${u.campagne}` : ""}`, n: u.n }))} />
                </Card>
              ) : null}
            </div>
          </>
        ) : (
          <div className="pl-empty">PostHog n'est pas lisible : {data.posthog?.raison || "voir la section Santé"}.</div>
        )}
      </Section>

      <Section defaultOpen={false} id="referencement" title="Référencement" kicker={`Google · ${periode}`} right={demo ? null : <RefreshSeo />}>
        <div className="pl-tiles">
          {gsc ? (
            <>
              <Tile label="Clics depuis Google" value={sumBy(gscSplit.current, "clics")} prev={sumBy(gscSplit.previous, "clics")} hint="Search Console, données décalées de deux à trois jours" />
              <Tile label="Impressions" value={sumBy(gscSplit.current, "impressions")} prev={sumBy(gscSplit.previous, "impressions")} hint="Fois où une page de Merry est apparue dans les résultats" />
              <Tile label="Taux de clic" value={pctOf(sumBy(gscSplit.current, "clics"), sumBy(gscSplit.current, "impressions"))} prev={pctOf(sumBy(gscSplit.previous, "clics"), sumBy(gscSplit.previous, "impressions"))} format={(v) => `${v} %`} />
              <Tile label="Position moyenne" value={avgPos(gscSplit.current)} prev={avgPos(gscSplit.previous)} format={(v) => Number(v).toLocaleString("fr-FR")} inverse hint="Pondérée par les impressions ; plus petit est mieux" />
              <Tile label="Pages indexées" value={sitemapGsc ? sitemapGsc.indexes : null} sub={sitemapGsc ? `sur ${fmtInt(sitemapGsc.soumis)} soumises dans le sitemap` : "sitemap pas encore soumis à Google"} />
            </>
          ) : null}
          {ph ? <Tile label="Sessions venues d'un moteur" value={sumBy(organicSplit.current, "sessions")} prev={sumBy(organicSplit.previous, "sessions")} hint="PostHog : première page de la session ouverte depuis Google, Bing, Qwant… (après accord cookies)" /> : null}
          {seo ? (
            <>
              <Tile label="Pages dans le sitemap" value={seo.sitemap.urls} sub={seo.sitemap.statut === 200 ? "sitemap.xml lisible" : `réponse ${seo.sitemap.statut}`} />
              <Tile label="Pages en défaut" value={seo.pages_en_defaut} sub={`sur ${fmtInt(seo.pages.length)} relues aujourd'hui`} inverse />
              <Tile label="Temps de réponse" value={seo.lenteur_ms} format={(v) => `${fmtInt(v)} ms`} sub="moyenne de l'échantillon, depuis le serveur" />
            </>
          ) : null}
        </div>
        <div className="pl-grid">
          {gsc ? (
            <>
              <Card title="Clics par jour">
                <DayBars series={gscSeries} keys={["clics"]} labels={["Clics"]} days={jours} height={80} />
              </Card>
              <Card title="Impressions par jour">
                <DayBars series={gscSeries} keys={["impressions"]} labels={["Impressions"]} days={jours} height={80} />
              </Card>
              <Card fold="closed" title="Appareils (clics)">
                <Ranked rows={gsc.appareils} max={4} empty="Pas encore de clic" />
              </Card>
              <Card fold="closed" title="Requêtes qui amènent du monde" wide>
                <Table
                  cols={[
                    { key: "requete", label: "Requête" },
                    { key: "clics", label: "Clics", num: true, render: (r) => fmtInt(r.clics) },
                    { key: "impressions", label: "Impressions", num: true, render: (r) => fmtInt(r.impressions) },
                    { key: "ctr", label: "Taux de clic", num: true, render: (r) => `${Math.round(r.ctr * 100)} %` },
                    { key: "position", label: "Position", num: true, render: (r) => (Math.round(r.position * 10) / 10).toLocaleString("fr-FR") },
                  ]}
                  rows={gsc.requetes}
                  max={15}
                  empty="Google n'a encore remonté aucune requête pour cette période"
                />
              </Card>
              <Card fold="closed" title="Pages qui ressortent">
                <Ranked rows={gsc.pages.map((p) => ({ label: p.page, n: p.impressions, sub: `${fmtInt(p.clics)} clic(s)` }))} empty="Aucune page vue dans les résultats" />
              </Card>
              <Card fold="closed" title="Sitemaps vus par Google" wide>
                <Table
                  cols={[
                    { key: "chemin", label: "Sitemap", render: (r) => <span className="pl-mono">{r.chemin}</span> },
                    { key: "soumis", label: "Soumises", num: true, render: (r) => fmtInt(r.soumis) },
                    { key: "indexes", label: "Indexées", num: true, render: (r) => fmtInt(r.indexes) },
                    { key: "erreurs", label: "Erreurs", num: true },
                    { key: "lu", label: "Dernière lecture", render: (r) => (r.en_attente ? "en attente" : fmtDateTime(r.lu)) },
                  ]}
                  rows={gsc.sitemaps}
                  empty="Aucun sitemap soumis : dans Search Console, Sitemaps, ajoute https://www.withmerry.com/sitemap.xml"
                />
              </Card>
            </>
          ) : (
            <Card title="Search Console" wide>
              <div className="pl-empty">{data.google?.raison || "Non lue"}.</div>
              <p className="pl-note">
                Trois gestes : valider withmerry.com dans Search Console (enregistrement TXT chez Squarespace), y ajouter le compte de service comme utilisateur, coller sa clé JSON sur Vercel en
                GOOGLE_SERVICE_ACCOUNT_JSON. Les clics, impressions, positions, requêtes et pages indexées apparaissent ici ensuite, avec deux à trois jours de décalage.
              </p>
            </Card>
          )}
          {ph ? (
            <>
              <Card title="Sessions venues d'un moteur, par jour" wide={!gsc}>
                <DayBars series={organic} keys={["sessions"]} labels={["Sessions"]} days={jours} height={80} />
              </Card>
              <Card fold="closed" title="Pages d'entrée depuis un moteur">
                <Ranked rows={ph.seo.entrees.map((p) => ({ label: p.chemin, n: p.n, sub: `${(Math.round(p.pages * 10) / 10).toLocaleString("fr-FR")} page(s) vue(s)` }))} empty="Aucune arrivée depuis un moteur sur la période" />
              </Card>
              <Card fold="closed" title="Moteurs">
                <Ranked rows={ph.seo.moteurs} max={6} empty="Aucune arrivée depuis un moteur" />
              </Card>
            </>
          ) : null}
          {seo ? (
            <>
              <Card fold="closed" title="Pages relues aujourd'hui" wide note="Un échantillon du sitemap, différent chaque jour, relu comme le ferait un moteur : réponse, titre, description, adresse canonique, noindex, h1.">
                <Table
                  cols={[
                    { key: "chemin", label: "Page", render: (r) => <span className="pl-mono">{r.chemin}</span> },
                    { key: "statut", label: "Réponse", num: true, render: (r) => <Pill tone={r.statut === 200 ? "ok" : "bad"}>{r.statut || "–"}</Pill> },
                    { key: "ms", label: "Temps", num: true, render: (r) => `${fmtInt(r.ms)} ms` },
                    { key: "problemes", label: "Défauts", render: (r) => (r.problemes.length ? r.problemes.join(", ") : <span className="pl-muted">aucun</span>) },
                  ]}
                  rows={[...seo.pages].sort((a, b) => b.problemes.length - a.problemes.length)}
                  max={13}
                />
              </Card>
              <Card fold="closed" title="Contenu du sitemap" note={`robots.txt : ${seo.robots.statut === 200 ? "lisible" : `réponse ${seo.robots.statut}`}, sitemap ${seo.robots.sitemap_declare ? "déclaré" : "non déclaré"}.`}>
                <Ranked rows={seo.sitemap.sections} max={12} empty="Sitemap vide" />
              </Card>
            </>
          ) : null}
        </div>
      </Section>

      <Section defaultOpen={false} id="appli" title="Appli organisateurs" kicker={`app.withmerry.com · ${periode}`}>
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
          <Card fold="open" title="Entonnoir d'onboarding" note="Personnes distinctes ayant vu chaque écran, puis comptes créés. PostHog ne compte que les visiteurs qui acceptent les cookies.">
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
              <Card fold="closed" title="Appareils">
                <Ranked rows={ph.app.appareils} max={4} />
                <p className="pl-note">Le téléphone est attendu autour de 80 % de l'usage.</p>
              </Card>
              <Card fold="closed" title="Pages les plus vues" wide>
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
              <Card fold="closed" title="Où le temps passe" note="Temps entre un événement et le suivant dans la même session, plafonné à 30 minutes ; le dernier écran d'une session n'est pas compté.">
                <Ranked rows={ph.app.temps.map((p) => ({ label: p.chemin, n: p.total, sub: `${fmtDuration(p.moyenne)} par passage` }))} format={fmtDuration} max={10} />
              </Card>
            </>
          ) : null}
        </div>
      </Section>

      <Section defaultOpen={false} id="produit" title="Ce que les couples font" kicker={`Supabase · ${periode}`}>
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
          <Card fold="closed" title="Derniers comptes" wide>
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
          <Card fold="closed" title="Dernières demandes de devis">
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

      <Section defaultOpen={false} id="prestataires" title="Prestataires" kicker="Catalogue et espace prestataire">
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
          <Card fold="open" title="Catalogue par métier" wide>
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
          <Card fold="closed" title="Fiches revendiquées">
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

      <Section defaultOpen={false} id="mails" title="Mails" kicker={`Resend · ${periode}`}>
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
              <Card fold="open" title="Par type de mail" wide>
                <Ranked rows={rs.sujets.map((s) => ({ label: s.sujet, n: s.n }))} />
              </Card>
              <Card fold="closed" title="Derniers envois">
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

      <Section defaultOpen={false} id="bugs" title="Bugs et performance" kicker={`PostHog et Vercel · ${periode}`}>
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
              <Card fold="open" title="Web vitals (p75)" note="LCP sous 2,5 s, INP sous 200 ms et CLS sous 0,1 sont les seuils de Google.">
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
              <Card fold="closed" title="Dernières erreurs" wide>
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
              <Card fold="closed" title="Clics de rage">
                <Ranked rows={ph.bugs.rage.map((r) => ({ label: `${r.hote || ""}${r.chemin || ""}`, n: r.n, sub: fmtDay(r.dernier) }))} empty="Aucun clic de rage" />
              </Card>
              {vc ? (
                <Card fold="closed" title="Déploiements Vercel" wide>
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
                <Card fold="closed" title="Déploiements Vercel" wide>
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
