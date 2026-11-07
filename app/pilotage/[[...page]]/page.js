"use client";

// Pilotage : les indicateurs de Merry (site, appli, prestataires, mails, bugs, déploiements), rangés en cinq boutons
// et leurs sous-pages (lib/pilotage/nav.js), réservés aux adresses de PILOTAGE_EMAILS. Toutes les adresses
// /pilotage/… servent cette page : les données viennent de /api/interne/pilotage ; la page ne fait que les mettre en forme. Chaque chiffre de période est comparé à la période précédente de même longueur.

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import Couts from "@/components/pilotage/Couts";
import Utilisateurs from "@/components/pilotage/Utilisateurs";
import Demandes from "@/components/pilotage/Demandes";
import Campagnes from "@/components/pilotage/Campagnes";
import Publicites from "@/components/pilotage/Publicites";
import Reseau from "@/components/pilotage/Reseau";
import { Aujourdhui, Capture, Taches, useItems } from "@/components/pilotage/Items";
import { PilotPeriod, PilotSide, PilotSubnav } from "@/components/pilotage/PilotNav";
import { supabase } from "@/lib/supabase";
import { alignSeries, dayList, fmtDateTime, fmtDay, fmtDuration, fmtInt, fmtPct, pctOf, splitSeries, sumBy } from "@/lib/server/pilotage/shape";
import { Card, DayBars, DayLine, Facts, Fold, Folds, Funnel, PageContext, Pill, Ranked, Section, Table, Tile, TileChart } from "@/components/pilotage/ui";
import { cumulSerie } from "@/lib/pilotage/graphes";
import { demoData } from "@/lib/server/pilotage/demo";
import { buildSante } from "@/lib/pilotage/sante";
import { titreJour } from "@/lib/pilotage/items";
import { pathFromHash, resolvePage } from "@/lib/pilotage/nav";
import { parisDay } from "@/lib/server/pilotage/reseau";
import { AGENT_TYPES } from "@/lib/agentsIa";

// ?demo=1 (ou pas de Supabase en local) : la page se dessine avec un jeu d'exemple, jamais de vraies mesures
function readDemoFlag() {
  try {
    return new URLSearchParams(window.location.search).get("demo") === "1";
  } catch {
    return false;
  }
}

// 1 h : seule la section Utilisateurs se lit à l'heure ; les sources par jour (PostHog, Resend…) restent sur 24 h
const RANGES = [
  { id: "1h", jours: 1, heure: true, label: "1 h" },
  { id: "24h", jours: 1, label: "24 h" },
  { id: "7j", jours: 7, label: "7 jours" },
  { id: "30j", jours: 30, label: "30 jours" },
];

// Le bandeau garde sa place pendant la lecture des indicateurs : la liste ne saute pas sous le doigt
const TUILES_JOUR = ["Visiteurs", "Comptes créés", "Mariages créés", "Demandes de devis"];

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
  const [periode, setPeriode] = useState("7j");
  const range = RANGES.find((r) => r.id === periode) || RANGES[2];
  const jours = range.jours;
  const heure = Boolean(range.heure);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const pathname = usePathname();
  const { group, page } = resolvePage(pathname);
  const [search, setSearch] = useState("");
  const liste = useItems(auth.status);
  const today = parisDay(Date.now());

  // Les anciens liens (/pilotage#demandes) mènent à la sous-page ; ?demo=1 suit la navigation
  useEffect(() => {
    setSearch(window.location.search);
    const target = pathFromHash(window.location.hash);
    if (!target) return undefined;
    // Après ce tour : le routeur ne suit l'historique qu'une fois ses propres effets passés
    const timer = setTimeout(() => window.history.replaceState(null, "", `${target}${window.location.search}`));
    return () => clearTimeout(timer);
  }, []);

  // Le jeton est repris à chaque lecture : celui du chargement de la page expire au bout d'une heure, et
  // Supabase le renouvelle en arrière-plan. Sur un 401, un renouvellement forcé puis un seul nouvel essai.
  const load = useCallback(
    async (j, frais = false, h = false) => {
      if (auth.status !== "ok") return;
      setBusy(true);
      setError(null);
      const call = (token) => fetch(`/api/interne/pilotage?jours=${j}${h ? "&periode=1h" : ""}${frais ? "&frais=1" : ""}`, { headers: { authorization: `Bearer ${token}` }, cache: "no-store" });
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
    if (auth.status === "ok") load(jours, false, heure);
    if (auth.status === "demo") setData(demoData(jours));
  }, [auth.status, jours, heure, load]);

  const badges = { demandes: data?.demandes?.en_attente?.length || 0 };
  const quotidien = group.id === "aujourdhui";

  if (auth.status === "loading") return <Gate title="Pilotage" text="Un instant…" />;
  if (auth.status === "signedout" || error === "connexion")
    return (
      <Gate title="Pilotage" text="Connectez-vous avec le compte Merry autorisé pour lire les indicateurs.">
        <a className="pl-btn is-primary" href={`/connexion?next=${encodeURIComponent(pathname)}`}>
          Me connecter
        </a>
      </Gate>
    );
  if (error === "interdit") return <Gate title="Réservé" text={`Le compte ${auth.email || ""} n'a pas accès au pilotage.`} />;

  return (
    <div className="pl-root pl-shell">
      <PilotSide group={group} search={search} badges={badges}>
        <Capture agir={liste.agir} disponible={liste.disponible} defaut={quotidien ? today : null} today={today} />
        <PilotPeriod
          ranges={RANGES}
          value={periode}
          onChange={setPeriode}
          onRefresh={() => load(jours, true, heure)}
          busy={busy}
          canRefresh={auth.status !== "demo"}
          stamp={data ? (data.demo ? "Jeu d'exemple, pas de vraies mesures" : `Lu le ${fmtDateTime(data.genere)}`) : null}
        />
      </PilotSide>
      <main className="pl-main">
        <div className="pl-wrap">
          <header className="pl-head">
            <h1>{quotidien ? titreJour(today) : group.label}</h1>
          </header>
          <PilotSubnav group={group} page={page} search={search} badges={badges} />
          {heure && data && page.periode !== false && page.id !== "comptes" ? <p className="pl-note">Sur 1 h, seule la page Comptes est lue à la minute près ; ici, les chiffres restent sur 24 h.</p> : null}
          {error ? <div className="pl-errors">Impossible de charger les indicateurs ({error}).</div> : null}
          {page.id === "liste" ? (
            <section className="pl-section">
              <Taches liste={liste} today={today} />
            </section>
          ) : null}
          {!data && quotidien ? (
            <section className="pl-section">
              <Aujourdhui liste={liste} data={{}} sante={[]} today={today} tuiles={TUILES_JOUR.map((label) => ({ label }))} reload={() => {}} search={search} indicateurs={error ? "erreur" : "lecture"} />
            </section>
          ) : null}
          {!data && !error && !quotidien && page.id !== "liste" ? <div className="pl-loading">Lecture de Supabase, PostHog, Resend et Vercel…</div> : null}
          {data ? (
            <PageContext.Provider value={page.id}>
              <Board data={data} jours={jours} reload={() => load(jours, true, heure)} liste={liste} today={today} search={search} />
            </PageContext.Provider>
          ) : null}
        </div>
      </main>
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

function Board({ data, jours, reload, liste, today, search }) {
  const demo = Boolean(data.demo);
  const sb = data.supabase;
  const ph = data.posthog?.disponible ? data.posthog : null;
  const rs = data.resend?.disponible ? data.resend : null;
  const mails = rs?.hors_campagnes || rs;
  const vc = data.vercel?.disponible ? data.vercel : null;
  const gsc = data.google?.disponible ? data.google : null;
  const seo = data.seo?.disponible ? data.seo : null;
  const periode = LABEL_PERIODE[jours] || `${jours} jours`;

  const joursList = useMemo(() => (sb?.series?.length ? sb.series.map((r) => r.jour) : dayList(jours)), [sb, jours]);
  const sbSplit = useMemo(() => splitSeries(sb?.series || [], jours), [sb, jours]);
  const site = useMemo(() => alignSeries(joursList, ph?.site?.series, ["visiteurs", "pages", "sessions"]), [joursList, ph]);
  const siteSplit = useMemo(() => splitSeries(site, jours), [site, jours]);
  // Rebond et durée par jour : null quand personne n'est venu, pour que la courbe saute le jour plutôt que tomber à zéro
  const siteQualite = useMemo(
    () => alignSeries(joursList, ph?.site?.qualite, ["rebonds", "sessions", "duree"]).map((r) => ({ jour: r.jour, rebond: pctOf(r.rebonds, r.sessions), duree: r.sessions ? Math.round(r.duree) : null })),
    [joursList, ph]
  );
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
  const gscPosition = gscSeries.map((r) => ({ jour: r.jour, position: r.impressions > 0 ? Math.round(r.position * 10) / 10 : null }));
  const organic = alignSeries(joursList, ph?.seo?.series, ["sessions"]);
  const organicSplit = splitSeries(organic, jours);
  const agentsSeries = alignSeries(joursList, ph?.agents?.series, ["visites", "pages"]);
  const agentsSplit = splitSeries(agentsSeries, jours);
  const avgPos = (rows) => {
    const seen = rows.filter((r) => r.impressions > 0);
    const imp = sumBy(seen, "impressions");
    return imp ? Math.round((seen.reduce((a, r) => a + r.position * r.impressions, 0) / imp) * 10) / 10 : null;
  };
  const sitemapGsc = gsc?.sitemaps?.[0] || null;
  const clickRate = gsc ? pctOf(sumBy(gscSplit.current, "clics"), sumBy(gscSplit.current, "impressions")) : null;
  const mailSeries = alignSeries(joursList, mails?.par_jour, ["envois"]);

  const appS = ph?.app?.sessions;
  const appP = ph?.app?.sessions_prec;
  const siteB = ph?.site?.rebond;
  const siteBP = ph?.site?.rebond_prec;
  const catalogue = sb?.catalogue || [];

  // Cinq chiffres au plus : Search Console d'abord, puis ce qui reste lisible sans elle
  const seoTiles = [
    gsc && <Tile key="clics" label="Clics depuis Google" value={sumBy(gscSplit.current, "clics")} prev={sumBy(gscSplit.previous, "clics")} hint="Search Console, données décalées de deux à trois jours" chart={<DayBars title="Clics par jour" series={gscSeries} keys={["clics"]} labels={["Clics"]} days={jours} />} />,
    gsc && <Tile key="impressions" label="Impressions" value={sumBy(gscSplit.current, "impressions")} prev={sumBy(gscSplit.previous, "impressions")} hint="Fois où une page de Merry est apparue dans les résultats" chart={<DayBars title="Impressions par jour" series={gscSeries} keys={["impressions"]} labels={["Impressions"]} days={jours} />} />,
    gsc && <Tile key="position" label="Position moyenne" value={avgPos(gscSplit.current)} prev={avgPos(gscSplit.previous)} format={(v) => Number(v).toLocaleString("fr-FR")} inverse hint="Pondérée par les impressions ; plus petit est mieux" chart={<DayLine title="Position moyenne par jour" series={gscPosition} valeur="position" label="Position" days={jours} format={(v) => Number(v).toLocaleString("fr-FR")} />} />,
    gsc && <Tile key="indexees" label="Pages indexées" value={sitemapGsc ? sitemapGsc.indexes : null} sub={sitemapGsc ? `sur ${fmtInt(sitemapGsc.soumis)} soumises` : "sitemap pas encore soumis"} />,
    seo && <Tile key="defauts" label="Pages en défaut" value={seo.pages_en_defaut} sub={`sur ${fmtInt(seo.pages.length)} relues aujourd'hui`} inverse />,
    ph && <Tile key="moteurs" label="Sessions venues d'un moteur" value={sumBy(organicSplit.current, "sessions")} prev={sumBy(organicSplit.previous, "sessions")} hint="PostHog : première page de la session ouverte depuis Google, Bing, Qwant… (après accord cookies)" chart={<DayBars title="Sessions venues d'un moteur, par jour" series={organic} keys={["sessions"]} labels={["Sessions"]} days={jours} />} />,
    seo && <Tile key="sitemap" label="Pages dans le sitemap" value={seo.sitemap.urls} sub={seo.sitemap.statut === 200 ? "sitemap.xml lisible" : `réponse ${seo.sitemap.statut}`} />,
  ].filter(Boolean).slice(0, 5);

  const u = data.utilisateurs?.fenetre || {};
  const tuilesJour = [
    { label: "Visiteurs", value: ph ? sumBy(siteSplit.current, "visiteurs") : null, prev: ph ? sumBy(siteSplit.previous, "visiteurs") : null },
    { label: "Comptes créés", value: u.comptes_crees?.n, prev: u.comptes_crees?.prec },
    { label: "Mariages créés", value: u.mariages_crees?.n, prev: u.mariages_crees?.prec },
    { label: "Demandes de devis", value: u.devis?.n, prev: u.devis?.prec },
  ];

  return (
    <>
      <Section id="jour">
        <Aujourdhui liste={liste} data={data} sante={sante} today={today} tuiles={tuilesJour} reload={reload} search={search} />
      </Section>

      <Section id="sante" right={demo ? null : <SendBrief />}>
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
        <p className="pl-note">
          Liens directs : <a href="https://eu.posthog.com/project/321035">PostHog</a> · <a href="https://supabase.com/dashboard/project/vrmgrcvdqznswzuamezj">Supabase</a> ·{" "}
          <a href="https://vercel.com/stan-f307/merry-brief">Vercel</a> · <a href="https://resend.com/emails">Resend</a>. Jours en heure de Paris.
        </p>
      </Section>

      <Utilisateurs data={data.utilisateurs} series={sb?.series} jours={jours} />

      <Demandes demandes={data.demandes} demo={demo} onChange={reload} />

      <Reseau reseau={data.reseau} demo={demo} onChange={reload} />

      <Publicites entonnoir={ph?.site?.entonnoir} sources={data.utilisateurs?.sources} />
      <Campagnes data={data.campagnes} visites={ph?.mails} joursList={joursList} jours={jours} demo={demo} onChange={reload} />

      <Couts couts={data.couts} demo={demo} onChange={reload} />

      <Section id="site">
        {ph ? (
          <>
            <TileChart>
              <Tile label="Visiteurs" value={sumBy(siteSplit.current, "visiteurs")} prev={sumBy(siteSplit.previous, "visiteurs")} hint="Personnes distinctes ayant vu au moins une page (PostHog, après accord cookies)" chart={<DayBars title="Visiteurs par jour" series={site} keys={["visiteurs"]} labels={["Visiteurs"]} days={jours} />} />
              <Tile label="Pages vues" value={sumBy(siteSplit.current, "pages")} prev={sumBy(siteSplit.previous, "pages")} chart={<DayBars title="Pages vues par jour" series={site} keys={["pages"]} labels={["Pages vues"]} days={jours} />} />
              <Tile label="Sessions" value={siteB?.sessions || 0} prev={siteBP?.sessions} chart={<DayBars title="Sessions par jour" series={site} keys={["sessions"]} labels={["Sessions"]} days={jours} />} />
              <Tile label="Taux de rebond" value={pctOf(siteB?.rebonds, siteB?.sessions)} prev={pctOf(siteBP?.rebonds, siteBP?.sessions)} format={(v) => `${v} %`} inverse hint="Sessions d'une seule page" chart={<DayLine title="Taux de rebond par jour" series={siteQualite} valeur="rebond" label="Taux de rebond" days={jours} format={(v) => `${v} %`} />} />
              <Tile label="Durée moyenne" value={Math.round(siteB?.duree || 0)} prev={Math.round(siteBP?.duree || 0)} format={fmtDuration} chart={<DayLine title="Durée moyenne par jour" series={siteQualite} valeur="duree" label="Durée moyenne" days={jours} format={fmtDuration} />} />
            </TileChart>
            <Folds>
              <Fold open title="D'où viennent les sessions" icon="lieu" value={ph.site.sources.length ? `${fmtInt(ph.site.sources.length)} sources` : null}>
                <Ranked rows={ph.site.sources} label="source" />
              </Fold>
              <Fold title="Chiffres par jour" icon="date" value={`${fmtInt(jours)} jours`}>
                <Table
                  max={31}
                  cols={[
                    { key: "jour", label: "Jour", render: (r) => fmtDay(r.jour) },
                    { key: "visiteurs", label: "Visiteurs", num: true },
                    { key: "pages", label: "Pages vues", num: true },
                    { key: "sessions", label: "Sessions", num: true },
                    { key: "rebond", label: "Rebond", num: true, render: (r) => (r.rebond === null ? "–" : `${r.rebond} %`) },
                    { key: "duree", label: "Durée", num: true, render: (r) => (r.duree === null ? "–" : fmtDuration(r.duree)) },
                  ]}
                  rows={siteSplit.current.map((r, i) => ({ ...r, ...siteQualite[siteQualite.length - siteSplit.current.length + i] })).reverse()}
                />
              </Fold>
              <Fold title="Pages les plus vues" icon="document">
                <Ranked rows={ph.site.pages.map((p) => ({ label: p.chemin, n: p.vues, sub: `${fmtInt(p.visiteurs)} visiteurs` }))} />
              </Fold>
              <Fold title="Pages d'entrée" icon="rechercher">
                <Ranked rows={ph.site.entrees.map((p) => ({ label: p.chemin, n: p.n }))} />
              </Fold>
              <Fold title="Appareils et pays" icon="telephone">
                <Ranked rows={ph.site.appareils} max={4} />
                <div style={{ height: 10 }} />
                <Ranked rows={ph.site.pays} max={5} />
              </Fold>
              {ph.site.utm.length ? (
                <Fold title="Campagnes (utm)" icon="filtrer" value={fmtInt(ph.site.utm.length)}>
                  <Ranked rows={ph.site.utm.map((u) => ({ label: `${u.source}${u.campagne ? ` · ${u.campagne}` : ""}`, n: u.n }))} />
                </Fold>
              ) : null}
            </Folds>
          </>
        ) : (
          <div className="pl-empty">PostHog n'est pas lisible : {data.posthog?.raison || "voir la page Santé"}.</div>
        )}
      </Section>

      <Section id="referencement" right={demo ? null : <RefreshSeo />}>
        <TileChart>{seoTiles}</TileChart>
        <Folds>
          {gsc ? (
            <>
              <Fold open title="Requêtes qui amènent du monde" icon="rechercher" value={clickRate === null ? null : `${clickRate} % de clic`}>
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
              </Fold>
              <Fold title="Pages qui ressortent" icon="document">
                <Ranked rows={gsc.pages.map((p) => ({ label: p.page, n: p.impressions, sub: `${fmtInt(p.clics)} clic(s)` }))} empty="Aucune page vue dans les résultats" />
                <div style={{ height: 10 }} />
                <Ranked rows={gsc.appareils} max={4} empty="Pas encore de clic" />
              </Fold>
            </>
          ) : (
            <Fold open title="Search Console" icon="rechercher" note="Trois gestes : valider withmerry.com dans Search Console (enregistrement TXT chez Squarespace), y ajouter le compte de service comme utilisateur, coller sa clé JSON sur Vercel en GOOGLE_SERVICE_ACCOUNT_JSON. Les clics, impressions, positions, requêtes et pages indexées apparaissent ici ensuite, avec deux à trois jours de décalage.">
              <div className="pl-empty">{data.google?.raison || "Non lue"}.</div>
            </Fold>
          )}
          {ph ? (
            <Fold title="Arrivées depuis un moteur" icon="lieu" value={fmtInt(sumBy(organicSplit.current, "sessions"))}>
              <Ranked rows={ph.seo.moteurs} max={6} empty="Aucune arrivée depuis un moteur" />
              <div style={{ height: 10 }} />
              <Ranked rows={ph.seo.entrees.map((p) => ({ label: p.chemin, n: p.n, sub: `${(Math.round(p.pages * 10) / 10).toLocaleString("fr-FR")} page(s) vue(s)` }))} empty="Aucune arrivée depuis un moteur sur la période" />
            </Fold>
          ) : null}
          {gsc || seo ? (
            <Fold title="Sitemap" icon="filtrer" value={seo ? `${fmtInt(seo.sitemap.urls)} pages` : null} note={seo ? `robots.txt : ${seo.robots.statut === 200 ? "lisible" : `réponse ${seo.robots.statut}`}, sitemap ${seo.robots.sitemap_declare ? "déclaré" : "non déclaré"}.` : null}>
              {gsc ? (
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
              ) : null}
              <div style={{ height: 10 }} />
              {seo ? <Ranked rows={seo.sitemap.sections} max={12} empty="Sitemap vide" /> : null}
            </Fold>
          ) : null}
          {seo ? (
            <Fold title="Santé technique" icon="securite" value={`${fmtInt(seo.lenteur_ms)} ms`} note="Un échantillon du sitemap, différent chaque jour, relu comme le ferait un moteur : réponse, titre, description, adresse canonique, noindex, h1.">
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
            </Fold>
          ) : null}
        </Folds>
      </Section>

      <Section id="agents">
        {ph ? (
          <>
            <TileChart>
              <Tile label="Visites d'agents IA" value={sumBy(agentsSplit.current, "visites")} prev={sumBy(agentsSplit.previous, "visites")} hint="Pages lues par des agents qui ne chargent pas le JavaScript (GPTBot, ClaudeBot, PerplexityBot…), reconnus à leur User-Agent. Un User-Agent se falsifie." note="Relevé par le middleware à chaque requête, hors redirections. Aucun profil de personne ni adresse IP n'est gardé." chart={<DayBars title="Visites d'agents par jour" series={agentsSeries} keys={["visites"]} labels={["Visites"]} days={jours} />} />
              <Tile label="Sur le site" value={(ph.agents.sites["www.withmerry.com"] || 0) + (ph.agents.sites["withmerry.com"] || 0)} />
              <Tile label="Sur l'appli" value={ph.agents.sites["app.withmerry.com"] || 0} />
              <Tile label="Agents différents" value={ph.agents.familles.length} />
              <Tile label="Navigateurs pilotés" value={ph.agents.navigateurs.site.sessions + ph.agents.navigateurs.app.sessions} inverse hint="Sessions de navigateurs pilotés par un programme (webdriver, Chrome sans écran), écartées des chiffres du site et de l'appli" />
            </TileChart>
            <Folds>
              <Fold open title="Qui lit" icon="rechercher" value={ph.agents.familles.length ? `${fmtInt(ph.agents.familles.length)} agents` : null}>
                <Table
                  cols={[
                    { key: "famille", label: "Agent" },
                    { key: "operateur", label: "Société" },
                    { key: "type", label: "Pour quoi", render: (r) => AGENT_TYPES[r.type] || r.type },
                    { key: "n", label: "Visites", render: (r) => fmtInt(r.n) },
                    { key: "pages", label: "Pages", render: (r) => fmtInt(r.pages) },
                    { key: "dernier", label: "Dernier passage", render: (r) => fmtDateTime(r.dernier) },
                  ]}
                  rows={ph.agents.familles}
                  empty="Aucun agent relevé sur la période"
                />
              </Fold>
              <Fold title="Pages lues" icon="document" value={ph.agents.pages.length ? fmtInt(ph.agents.pages.length) : null}>
                <Ranked rows={ph.agents.pages.map((p) => ({ label: p.chemin, n: p.n, sub: `${fmtInt(p.familles)} agents` }))} />
              </Fold>
              <Fold title="Navigateurs pilotés, écartés" icon="securite">
                <Facts
                  rows={[
                    { label: "Sessions sur le site", value: ph.agents.navigateurs.site.sessions, sub: `${fmtInt(ph.agents.navigateurs.site.pages)} pages vues` },
                    { label: "Sessions sur l'appli", value: ph.agents.navigateurs.app.sessions, sub: `${fmtInt(ph.agents.navigateurs.app.pages)} pages vues` },
                  ]}
                />
              </Fold>
              <Fold title="Rafales restées dans les chiffres" icon="horloge">
                <Facts
                  rows={[
                    { label: "Sur le site", value: ph.agents.rafales.site?.rafales || 0, sub: `sur ${fmtInt(ph.agents.rafales.site?.sessions || 0)} sessions` },
                    { label: "Sur l'appli", value: ph.agents.rafales.app?.rafales || 0, sub: `sur ${fmtInt(ph.agents.rafales.app?.sessions || 0)} sessions` },
                  ]}
                />
                <p className="pl-note">Quatre pages ou plus en cinq secondes ou moins : sans doute un programme qui a passé la détection. Ces sessions ne sont pas retirées des autres chiffres.</p>
              </Fold>
            </Folds>
          </>
        ) : (
          <div className="pl-empty">PostHog n'est pas lisible : {data.posthog?.raison || "voir la page Santé"}.</div>
        )}
      </Section>

      <Section id="appli">
        <TileChart>
          <Tile label="Comptes au total" value={t.comptes} sub={`${fmtInt(t.comptes_actifs)} connectés sur ${periode}`} chart={<DayLine cumul title="Comptes au total" series={cumulSerie(sb?.series, "inscriptions", t.comptes)} valeur="cumul" label="Comptes" days={jours} />} />
          <Tile label="Nouveaux comptes" value={cur("inscriptions")} prev={prev("inscriptions")} chart={<DayBars title="Nouveaux comptes par jour" series={sb?.series} keys={["inscriptions", "mariages"]} labels={["Comptes", "Mariages créés"]} days={jours} />} />
          {ph ? (
            <>
              <Tile ouvert label="Sessions" value={appS?.n || 0} prev={appP?.n} chart={<DayBars title="Sessions et personnes par jour" series={appMerged} keys={["sessions", "personnes"]} labels={["Sessions", "Personnes"]} days={jours} />} />
              <Tile label="Durée moyenne" value={Math.round(appS?.duree || 0)} prev={Math.round(appP?.duree || 0)} format={fmtDuration} hint={`Médiane ${fmtDuration(appS?.mediane || 0)}`} chart={<DayLine title="Durée moyenne par jour" series={appMerged.map((r) => ({ jour: r.jour, duree: r.sessions ? Math.round(r.duree) : null }))} valeur="duree" label="Durée moyenne" days={jours} format={fmtDuration} />} />
              <Tile label="Sessions d'une minute ou plus" value={pctOf(appS?.engagees, appS?.n)} prev={pctOf(appP?.engagees, appP?.n)} format={(v) => `${v} %`} />
            </>
          ) : null}
        </TileChart>
        <Folds>
          <Fold open title="Entonnoir d'onboarding" icon="filtrer" value={ph ? `${fmtInt(ph.app.funnel.termine)} comptes` : null} note="Personnes distinctes ayant vu chaque écran, puis comptes créés. PostHog ne compte que les visiteurs qui acceptent les cookies.">
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
          </Fold>
          <Fold title="Autres mesures" icon="reglages">
            <Facts
              rows={[
                { label: "Comptes connectés", value: t.comptes_actifs, sub: t.comptes_actifs_prec != null ? `${fmtInt(t.comptes_actifs_prec)} avant` : null },
                ph && { label: "Personnes vues (PostHog)", value: ph.app.personnes, sub: ph.app.personnes_prec != null ? `${fmtInt(ph.app.personnes_prec)} avant` : null },
                ph && { label: "Pages par session", value: (Math.round(Number(appS?.pages || 0) * 10) / 10).toLocaleString("fr-FR") },
              ]}
            />
          </Fold>
          {ph ? (
            <>
              <Fold title="Appareils" icon="telephone" note="Le téléphone est attendu autour de 80 % de l'usage.">
                <Ranked rows={ph.app.appareils} max={4} />
              </Fold>
              <Fold title="Pages les plus vues" icon="document">
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
              </Fold>
              <Fold title="Où le temps passe" icon="horloge" note="Temps entre un événement et le suivant dans la même session, plafonné à 30 minutes ; le dernier écran d'une session n'est pas compté.">
                <Ranked rows={ph.app.temps.map((p) => ({ label: p.chemin, n: p.total, sub: `${fmtDuration(p.moyenne)} par passage` }))} format={fmtDuration} max={10} />
              </Fold>
            </>
          ) : null}
        </Folds>
      </Section>

      <Section id="couples">
        <TileChart>
          <Tile label="Mariages" value={t.mariages} sub={`${fmtInt(t.mariages_avec_date)} avec une date`} chart={<DayLine cumul title="Mariages au total" series={cumulSerie(sb?.series, "mariages", t.mariages)} valeur="cumul" label="Mariages" days={jours} />} />
          <Tile label="Invités saisis" value={t.invites} sub={t.mariages_avec_invites != null ? `dans ${fmtInt(t.mariages_avec_invites)} mariage(s)` : null} />
          <Tile label="Réponses RSVP" value={cur("reponses_rsvp")} prev={prev("reponses_rsvp")} hint="Lignes du journal des réponses (formulaire et saisie)" chart={<DayBars title="Réponses RSVP par jour" series={sb?.series} keys={["reponses_rsvp"]} labels={["Réponses"]} days={jours} />} />
          <Tile ouvert label="Demandes de devis" value={cur("demandes")} prev={prev("demandes")} sub={`${fmtInt(t.demandes_devis)} au total`} chart={<DayBars title="Demandes de devis par jour" series={sb?.series} keys={["demandes"]} labels={["Demandes de devis"]} days={jours} />} />
          <Tile label="Sites publiés" value={t.sites_publies} sub={sb?.repli ? null : `${fmtInt(cur("visites_sites"))} visite(s) sur ${periode}`} />
        </TileChart>
        <Folds>
          <Fold open title="Messages" icon="messagerie" value={fmtInt(cur("messages_couple") + cur("messages_pro"))}>
            <DayBars series={sb?.series} keys={["messages_couple", "messages_pro"]} labels={["Couple vers prestataire", "Prestataire vers couple"]} days={jours} height={140} />
            <Facts
              rows={[
                { label: "Couple vers prestataire", value: cur("messages_couple"), sub: `${fmtInt(prev("messages_couple"))} avant` },
                { label: "Prestataire vers couple", value: cur("messages_pro"), sub: `${fmtInt(prev("messages_pro"))} avant` },
              ]}
            />
          </Fold>
          <Fold title="Réponses RSVP et visites des sites" icon="date" value={fmtInt(cur("reponses_rsvp"))}>
            <DayBars series={sb?.series} keys={["reponses_rsvp", "visites_sites"]} labels={["Réponses", "Visites"]} days={jours} height={140} />
          </Fold>
          <Fold title="Formulaires et sites" icon="document" value={fmtInt((t.formulaires_publies || 0) + (t.sites_publies || 0))}>
            <Facts
              rows={[
                { label: "Formulaires publiés", value: t.formulaires_publies, sub: t.reponses_formulaires != null ? `${fmtInt(t.reponses_formulaires)} réponse(s) reçue(s)` : null },
                { label: "Sites publiés", value: t.sites_publies },
              ]}
            />
          </Fold>
          <Fold title="Organisation" icon="budget" value={`${fmtInt(t.organisateurs)} organisateurs`}>
            <Facts
              rows={[
                { label: "Organisateurs", value: t.organisateurs, sub: `${fmtInt(t.organisateurs_invites_en_attente)} invitation(s) en attente` },
                { label: "Tâches", value: t.taches, sub: `${fmtPct(t.taches_faites, t.taches)} faites` },
                { label: "Lignes de budget", value: t.lignes_budget },
                { label: "Documents", value: t.documents },
              ]}
            />
          </Fold>
          <Fold title="Appels IA" icon="reglages" value={fmtInt(cur("appels_ia"))} note="Import d'invités, lecture de devis, comparaison de prestataires.">
            <DayBars series={sb?.series} keys={["appels_ia"]} labels={["Appels IA"]} days={jours} height={140} />
          </Fold>
          <Fold title="Dernières demandes de devis" icon="email">
            <Table
              cols={[
                { key: "quand", label: "Quand", render: (r) => fmtDateTime(r.quand) },
                { key: "couple", label: "Couple" },
                { key: "prestataire", label: "Prestataire", render: (r) => `${r.prestataire}${r.categorie ? ` · ${r.categorie}` : ""}` },
              ]}
              rows={sb?.dernieres_demandes}
              max={10}
            />
          </Fold>
        </Folds>
      </Section>

      <Section id="prestataires">
        <TileChart>
          <Tile label="Prestataires actifs" value={t.catalogue_actifs} sub={t.catalogue_fermes != null ? `${fmtInt(t.catalogue_candidats)} candidats, ${fmtInt(t.catalogue_fermes)} fermés` : `${fmtInt(t.catalogue_candidats)} candidats`} />
          <Tile label="Fiches revendiquées" value={t.fiches_revendiquees} sub={t.fiches_revendiquees_periode != null ? `${fmtInt(t.fiches_revendiquees_periode)} sur ${periode} · ${fmtInt(t.comptes_pro)} compte(s) pro` : `${fmtInt(t.comptes_pro)} compte(s) pro`} />
          <Tile label="Crédits dépensés" value={t.credits_depenses_periode} hint="Réponses payées en crédits sur la période" />
          <Tile label="Vues de fiches" value={cur("vues_pro")} prev={prev("vues_pro")} hint="Fiches revendiquées ouvertes par des couples" chart={<DayBars title="Vues de fiches par jour" series={sb?.series} keys={["vues_pro"]} labels={["Vues de fiches"]} days={jours} />} />
          <Tile label="Clients côté pro" value={t.clients_pro} sub={t.clients_pro_repondus != null ? `${fmtInt(t.clients_pro_repondus)} avec une réponse` : null} />
        </TileChart>
        <Folds>
          <Fold open title="Qualité du catalogue" icon="photo" value={`${fmtInt(t.catalogue_sans_photo)} sans photo`}>
            <Facts
              rows={[
                { label: "Avec 3 photos ou plus", value: `${pctOf(t.catalogue_photos3, t.catalogue_actifs)} %`, sub: `${fmtInt(t.catalogue_sans_photo)} sans aucune photo` },
                { label: "Avec un email", value: `${pctOf(t.catalogue_email, t.catalogue_actifs)} %`, sub: `${fmtInt(t.catalogue_email)} fiches` },
                { label: "Avec un téléphone", value: `${pctOf(t.catalogue_telephone, t.catalogue_actifs)} %`, sub: `${fmtInt(t.catalogue_telephone)} fiches` },
                { label: "Ajoutés par les couples", value: t.catalogue_ajoutes_par_couples },
              ]}
            />
          </Fold>
          <Fold title="Crédits" icon="budget" value={fmtInt(t.credits_en_circulation)}>
            <Facts
              rows={[
                { label: "En circulation", value: t.credits_en_circulation },
                { label: "Dépensés sur la période", value: t.credits_depenses_periode },
                { label: "Dépensés au total", value: t.credits_depenses },
              ]}
            />
          </Fold>
          <Fold title="Catalogue par métier" icon="filtrer" value={fmtInt(catalogue.filter((c) => c.actifs || c.candidats).length)}>
            <Ranked rows={catalogue.filter((c) => c.actifs).map((c) => ({ label: c.label, n: c.actifs })).sort((a, b) => b.n - a.n)} max={8} />
            <div style={{ height: 10 }} />
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
          </Fold>
          <Fold title="Fiches revendiquées" icon="avis" value={fmtInt(t.fiches_revendiquees)}>
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
          </Fold>
        </Folds>
      </Section>

      <Section id="mails">
        {rs ? (
          <>
            <TileChart>
              <Tile label="Envoyés" value={mails.envoyes} sub={rs.tronque ? "limité aux 100 derniers envois" : null} note={rs.tronque ? "Sur les 100 derniers envois seulement." : null} chart={<DayBars title="Envois par jour" series={mailSeries} keys={["envois"]} labels={["Envois"]} days={jours} />} />
              <Tile label="Délivrés" value={mails.par_etat.delivered || 0} sub={fmtPct(mails.par_etat.delivered || 0, mails.envoyes)} />
              <Tile label="Rebonds et plaintes" value={(mails.par_etat.bounced || 0) + (mails.par_etat.complained || 0)} inverse prev={null} />
            </TileChart>
            <Folds>
              {mails.problemes.length ? (
                <Fold open title="En difficulté" icon="securite" value={fmtInt(mails.problemes.length)}>
                  <Table
                    cols={[
                      { key: "quand", label: "Quand", render: (r) => fmtDateTime(r.quand) },
                      { key: "a", label: "Destinataire" },
                      { key: "sujet", label: "Sujet" },
                      { key: "etat", label: "État", render: (r) => <Pill tone="bad">{r.etat}</Pill> },
                    ]}
                    rows={mails.problemes}
                  />
                </Fold>
              ) : null}
              <Fold open={!mails.problemes.length} title="Par type de mail" icon="email" value={fmtInt(mails.sujets.length)}>
                <Ranked rows={mails.sujets.map((s) => ({ label: s.sujet, n: s.n }))} />
              </Fold>
              <Fold title="Derniers envois" icon="horloge">
                <Table
                  cols={[
                    { key: "quand", label: "Quand", render: (r) => fmtDateTime(r.quand) },
                    { key: "sujet", label: "Sujet" },
                    { key: "etat", label: "État", render: (r) => <Pill tone={r.etat === "delivered" ? "ok" : ["bounced", "complained", "failed"].includes(r.etat) ? "bad" : "neutral"}>{r.etat}</Pill> },
                  ]}
                  rows={mails.derniers}
                  max={8}
                />
              </Fold>
              <Fold title="Relances et désinscriptions" icon="date" value={fmtInt(cur("mails_planifies"))}>
                <Facts
                  rows={[
                    { label: "Relances planifiées", value: cur("mails_planifies"), sub: `${fmtInt(prev("mails_planifies"))} avant` },
                    { label: "Désinscriptions", value: t.desinscriptions_mail },
                  ]}
                />
              </Fold>
            </Folds>
          </>
        ) : (
          <div className="pl-empty">Resend n'est pas lisible : {data.resend?.raison || "voir la page Santé"}.</div>
        )}
      </Section>

      <Section id="bugs">
        {ph ? (
          <>
            <TileChart>
              <Tile label="Erreurs JavaScript" value={exceptionsCur} prev={exceptionsPrev} inverse chart={<DayBars title="Erreurs par jour" series={bugs} keys={["exceptions"]} labels={["Erreurs"]} days={jours} />} />
              <Tile label="Clics de rage" value={rageCur} prev={sumBy(bugsSplit.previous, "rage")} inverse chart={<DayBars title="Clics de rage par jour" series={bugs} keys={["rage"]} labels={["Clics de rage"]} days={jours} />} />
              <Tile label="Clics morts" value={sumBy(bugsSplit.current, "morts")} prev={sumBy(bugsSplit.previous, "morts")} inverse hint="Clics sans aucun effet visible" chart={<DayBars title="Clics morts par jour" series={bugs} keys={["morts"]} labels={["Clics morts"]} days={jours} />} />
              <Tile label="Bugs vus en replay" value={ph.bugs.replays?.bugs || 0} sub={`sur ${fmtInt(ph.bugs.replays?.analysees || 0)} analysée(s)`} inverse />
              {vc ? <Tile label="Déploiements" value={vc.total} sub={`${fmtInt(vc.erreurs)} en échec, ${fmtInt(vc.en_cours)} en cours`} /> : null}
            </TileChart>
            <Folds>
              <Fold open title="Web vitals (p75)" icon="horloge" note="LCP sous 2,5 s, INP sous 200 ms et CLS sous 0,1 sont les seuils de Google.">
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
              </Fold>
              <Fold open title="Bugs vus dans les replays" icon="securite" value={fmtInt(ph.bugs.replays?.bugs || 0)}>
                <Table
                  cols={[
                    { key: "quand", label: "Quand", render: (r) => fmtDateTime(r.quand) },
                    { key: "raison", label: "Ce qui s'est passé" },
                    { key: "lien", label: "Replay", render: (r) => <a href={r.lien}>Voir</a> },
                  ]}
                  rows={ph.bugs.replays?.liste || []}
                  max={15}
                  empty={ph.bugs.replays?.analysees ? "Aucun bug vu sur la période" : "Aucune session analysée sur la période"}
                />
              </Fold>
              <Fold title="Dernières erreurs" icon="securite" value={fmtInt(ph.bugs.exceptions.length)}>
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
              </Fold>
              <Fold title="Clics de rage" icon="rechercher" value={fmtInt(rageCur)}>
                <Ranked rows={ph.bugs.rage.map((r) => ({ label: `${r.hote || ""}${r.chemin || ""}`, n: r.n, sub: fmtDay(r.dernier) }))} empty="Aucun clic de rage" />
              </Fold>
              <Fold title="Déploiements Vercel" icon="reglages" value={vc ? fmtInt(vc.total) : null}>
                {vc ? (
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
                ) : (
                  <div className="pl-empty">
                    {data.vercel?.raison || "Non disponible"}. Crée un jeton sur vercel.com/account/tokens (portée stan-f307), ajoute-le sur Vercel en variable
                    VERCEL_API_TOKEN (Production), redéploie : la liste et les échecs de build apparaissent ici.
                  </div>
                )}
              </Fold>
            </Folds>
          </>
        ) : (
          <div className="pl-empty">PostHog n'est pas lisible : {data.posthog?.raison || "voir la page Santé"}.</div>
        )}
      </Section>

    </>
  );
}
