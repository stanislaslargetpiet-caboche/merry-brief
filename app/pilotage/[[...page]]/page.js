"use client";

// Pilotage : les indicateurs de Merry (couples, prestataires, acquisition, coulisses), rangés en boutons et sous-pages
// (lib/pilotage/nav.js), réservés aux adresses de PILOTAGE_EMAILS. Toutes les adresses
// /pilotage/… servent cette page : les données viennent de /api/interne/pilotage ; la page ne fait que les mettre en forme. Chaque chiffre de période est comparé à la période précédente de même longueur.

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import Couts from "@/components/pilotage/Couts";
import Utilisateurs from "@/components/pilotage/Utilisateurs";
import Demandes from "@/components/pilotage/Demandes";
import Campagnes from "@/components/pilotage/Campagnes";
import Publicites from "@/components/pilotage/Publicites";
import Robots from "@/components/pilotage/Robots";
import Reseau from "@/components/pilotage/Reseau";
import { Aujourdhui, Capture, Taches, useItems } from "@/components/pilotage/Items";
import { PilotLangue, PilotPeriod, PilotSide, PilotSubnav, useLangue } from "@/components/pilotage/PilotNav";
import { supabase } from "@/lib/supabase";
import { alignSeries, dayList, fmtDateTime, fmtHeure, fmtInt, pctOf, splitSeries, sumBy, sumMesure } from "@/lib/server/pilotage/shape";
import { Card, DayBars, DayLine, PageContext, Pill, PilotDots, PilotLoader, Section, Tile, TileChart } from "@/components/pilotage/ui";
import { cumulSerie, mesureDepuis } from "@/lib/pilotage/graphes";
import { demoData } from "@/lib/server/pilotage/demo";
import { buildSante } from "@/lib/pilotage/sante";
import { titreJour } from "@/lib/pilotage/items";
import { pathFromHash, resolvePage } from "@/lib/pilotage/nav";
import { parisDay } from "@/lib/server/pilotage/reseau";

// ?demo=1 (ou pas de Supabase en local) : la page se dessine avec un jeu d'exemple, jamais de vraies mesures
function readDemoFlag() {
  try {
    return new URLSearchParams(window.location.search).get("demo") === "1";
  } catch {
    return false;
  }
}

// 1 h : seuls les chiffres d'Aujourd'hui et les couples connectés se lisent à l'heure ; les sources par jour
// (Supabase, PostHog, Resend…) restent sur 24 h
const RANGES = [
  { id: "1h", jours: 1, heure: true, label: "1 h" },
  { id: "24h", jours: 1, label: "24 h" },
  { id: "7j", jours: 7, label: "7 jours" },
  { id: "30j", jours: 30, label: "30 jours" },
];

// Le journal des réponses RSVP (guest_response_log) n'existe que depuis le 3 nov. 2026 au soir (premier relevé en base) :
// avant, un jour n'a pas de mesure
const DEBUT_JOURNAL_RSVP = "2026-11-03";

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

// Dernier événement Resend de chaque mail : « Cliqué » suppose « Ouvert », on n'affiche que le plus avancé
const ETAT_MAIL = {
  sent: ["Envoyé", "neutral"],
  delivered: ["Délivré", "neutral"],
  opened: ["Ouvert", "ok"],
  clicked: ["Cliqué", "ok"],
  delivery_delayed: ["Retardé", "warn"],
  bounced: ["Rebond", "bad"],
  complained: ["Plainte", "bad"],
  failed: ["Échec", "bad"],
};

export default function PilotagePage() {
  const auth = useToken();
  const [periode, setPeriode] = useState("7j");
  const [langue, setLangue] = useLangue();
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

  if (auth.status === "loading")
    return (
      <div className="pl-root">
        <PilotLoader />
      </div>
    );
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
        >
          <PilotLangue value={langue} onChange={setLangue} />
        </PilotPeriod>
      </PilotSide>
      <main className="pl-main">
        <div className="pl-wrap">
          <header className="pl-head">
            <h1>{quotidien ? titreJour(today) : group.label}</h1>
          </header>
          <PilotSubnav group={group} page={page} search={search} badges={badges} />
          {heure && data && page.periode !== false && !quotidien ? <p className="pl-note">Sur 1 h, ces chiffres restent sur 24 h{page.id === "activite" ? ", sauf les couples connectés" : ""}.</p> : null}
          {error ? <div className="pl-errors">Impossible de charger les indicateurs ({error}).</div> : null}
          {page.id === "liste" ? (
            <section className="pl-section">
              <Taches liste={liste} today={today} />
            </section>
          ) : null}
          {!data && quotidien ? (
            <section className="pl-section">
              <Aujourdhui liste={liste} data={{}} sante={[]} today={today} tuiles={TUILES_JOUR.map((label) => ({ label }))} reload={() => {}} search={search} langue={langue} indicateurs={error ? "erreur" : "lecture"} />
            </section>
          ) : null}
          {!data && !error && !quotidien && page.id !== "liste" ? <div className="pl-loading"><PilotDots label="Lecture des indicateurs" /></div> : null}
          {data ? (
            <PageContext.Provider value={page.id}>
              <Board data={data} jours={jours} reload={() => load(jours, true, heure)} liste={liste} today={today} search={search} langue={langue} />
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

// Une page de chiffres : deux à quatre tuiles et le graphe de celle qu'on clique, rien d'autre. Les listes (Par couple,
// Demandes d'accès) et les outils (envoi de campagne, saisie d'une dépense) ont leur bouton en tête de page.
function Board({ data, jours, reload, liste, today, search, langue }) {
  const demo = Boolean(data.demo);
  const sb = data.supabase;
  const ph = data.posthog?.disponible ? data.posthog : null;
  const rs = data.resend?.disponible ? data.resend : null;
  const mails = rs?.hors_campagnes || rs;
  const vc = data.vercel?.disponible ? data.vercel : null;
  const gsc = data.google?.disponible ? data.google : null;

  const joursList = useMemo(() => (sb?.series?.length ? sb.series.map((r) => r.jour) : dayList(jours)), [sb, jours]);
  const sbSplit = useMemo(() => splitSeries(sb?.series || [], jours), [sb, jours]);
  const site = useMemo(() => alignSeries(joursList, ph?.site?.series, ["visiteurs", "pages", "sessions"]), [joursList, ph]);
  const siteSplit = useMemo(() => splitSeries(site, jours), [site, jours]);
  // Visites du compteur sans cookie et comptes créés, jour par jour : le taux saute les jours sans visite. Le compteur
  // n'existe que depuis le 7 nov. 2026 (D-187) : avant sa première visite, un jour n'a pas de mesure (null), pas zéro.
  const arrivees = useMemo(() => {
    const comptes = new Map((sb?.series || []).map((r) => [r.jour, Number(r.inscriptions) || 0]));
    const visites = alignSeries(joursList, ph?.site?.visites, ["visites"]);
    const debut = visites.findIndex((r) => r.visites > 0);
    return visites.map((r, i) => ({ ...r, visites: i < debut ? null : r.visites, comptes: comptes.get(r.jour) || 0, taux: pctOf(comptes.get(r.jour) || 0, r.visites) }));
  }, [joursList, ph, sb]);
  const arriveesSplit = useMemo(() => splitSeries(arrivees, jours), [arrivees, jours]);
  const robots = useMemo(() => alignSeries(joursList, ph?.site?.robots, ["robots"]), [joursList, ph]);
  const robotsSplit = useMemo(() => splitSeries(robots, jours), [robots, jours]);
  const rsvp = useMemo(() => mesureDepuis(sb?.series, "reponses_rsvp", DEBUT_JOURNAL_RSVP), [sb]);
  const rsvpSplit = useMemo(() => splitSeries(rsvp, jours), [rsvp, jours]);
  const bugs = useMemo(() => alignSeries(joursList, ph?.bugs?.series, ["exceptions", "rage", "morts"]), [joursList, ph]);
  const bugsSplit = useMemo(() => splitSeries(bugs, jours), [bugs, jours]);

  const t = sb?.totaux || {};
  const cur = (k) => sumBy(sbSplit.current, k);
  const prev = (k) => sumBy(sbSplit.previous, k);

  const sante = buildSante(data, jours);

  const gscSeries = alignSeries(joursList, gsc?.series, ["clics", "impressions", "position"]);
  const gscSplit = splitSeries(gscSeries, jours);
  const gscPosition = gscSeries.map((r) => ({ jour: r.jour, position: r.impressions > 0 ? Math.round(r.position * 10) / 10 : null }));
  const agentsSeries = alignSeries(joursList, ph?.agents?.series, ["visites", "pages"]);
  const agentsSplit = splitSeries(agentsSeries, jours);
  const avgPos = (rows) => {
    const seen = rows.filter((r) => r.impressions > 0);
    const imp = sumBy(seen, "impressions");
    return imp ? Math.round((seen.reduce((a, r) => a + r.position * r.impressions, 0) / imp) * 10) / 10 : null;
  };
  // Envois automatiques par jour : suivi par webhook quand il est lu (mesuré depuis son premier événement), sinon les
  // 100 derniers envois de l'API, qui ne remontent souvent pas jusqu'à la période d'avant
  const envois = data.envois;
  const mailSeries = envois
    ? alignSeries(joursList, envois.par_jour, ["envois"]).map((r) => (r.jour < envois.depuis ? { ...r, envois: null } : r))
    : alignSeries(joursList, mails?.par_jour, ["envois"]);
  const mailSplit = splitSeries(mailSeries, jours);
  const u = data.utilisateurs?.fenetre || {};

  const tuilesJour = [
    { label: "Visiteurs", value: ph ? sumBy(siteSplit.current, "visiteurs") : null, prev: ph ? sumBy(siteSplit.previous, "visiteurs") : null },
    { label: "Comptes créés", value: u.comptes_crees?.n, prev: u.comptes_crees?.prec },
    { label: "Mariages créés", value: u.mariages_crees?.n, prev: u.mariages_crees?.prec },
    { label: "Demandes de devis", value: u.devis?.n, prev: u.devis?.prec },
  ];
  const pct = (v) => `${v} %`;
  const nonLu = (source, raison) => <div className="pl-empty">{source} n'est pas lisible : {raison || "voir les alertes d'Aujourd'hui"}.</div>;

  return (
    <>
      <Section id="jour">
        <Aujourdhui liste={liste} data={data} sante={sante} today={today} tuiles={tuilesJour} reload={reload} search={search} langue={langue} />
      </Section>

      <Section id="activite">
        <TileChart>
          <Tile label="Mariages" value={t.mariages} sub={`${fmtInt(cur("mariages"))} créé(s) sur la période`} chart={<DayLine cumul title="Mariages au total" series={cumulSerie(sb?.series, "mariages", t.mariages)} valeur="cumul" label="Mariages" days={jours} />} />
          <Tile label="Couples connectés" value={u.couples_connectes?.n} sub={`sur ${fmtInt(t.mariages)} mariages`} hint="Mariages dont un compte s'est connecté sur la période (Supabase Auth)" chart={<DayLine title="Couples connectés par jour" series={sb?.series} valeur="couples_connectes" label="Couples connectés" days={jours} />} />
          <Tile label="Réponses RSVP" value={cur("reponses_rsvp")} prev={sumMesure(rsvpSplit.previous, "reponses_rsvp")} hint="Lignes du journal des réponses (formulaire et saisie)" chart={<DayLine title="Réponses RSVP par jour" series={rsvp} valeur="reponses_rsvp" label="Réponses" days={jours} />} />
          <Tile label="Demandes de devis" value={cur("demandes")} prev={prev("demandes")} chart={<DayLine title="Demandes de devis par jour" series={sb?.series} valeur="demandes" label="Demandes de devis" days={jours} />} />
        </TileChart>
      </Section>

      <Utilisateurs data={data.utilisateurs} />

      <Section id="catalogue">
        <TileChart>
          <Tile label="Fiches revendiquées" value={t.fiches_revendiquees} sub={t.fiches_revendiquees_periode != null ? `${fmtInt(t.fiches_revendiquees_periode)} sur la période` : null} />
          <Tile label="Vues de fiches" value={cur("vues_pro")} prev={prev("vues_pro")} hint="Fiches revendiquées ouvertes par des couples" chart={<DayBars title="Vues de fiches par jour" series={sb?.series} keys={["vues_pro"]} labels={["Vues de fiches"]} days={jours} />} />
          <Tile label="Crédits dépensés" value={t.credits_depenses_periode} sub={t.credits_depenses != null ? `${fmtInt(t.credits_depenses)} au total` : null} hint="Réponses payées en crédits sur la période" />
          <Tile label="Avec 3 photos ou plus" value={pctOf(t.catalogue_photos3, t.catalogue_actifs)} format={pct} sub={`des ${fmtInt(t.catalogue_actifs)} fiches actives`} />
        </TileChart>
      </Section>

      <Demandes demandes={data.demandes} demo={demo} onChange={reload} />

      <Reseau reseau={data.reseau} demo={demo} onChange={reload} />

      <Section id="site">
        {ph ? (
          <TileChart>
            <Tile label="Visites humaines" value={sumBy(arriveesSplit.current, "visites")} prev={sumMesure(arriveesSplit.previous, "visites")} hint="Pages du site ouvertes par une personne, cookies acceptés ou non (compteur sans cookie, robots écartés)" chart={<DayLine title="Visites humaines par jour" series={arrivees} valeur="visites" label="Visites humaines" days={jours} />} />
            <Tile label="Comptes créés" value={cur("inscriptions")} prev={prev("inscriptions")} chart={<DayBars title="Comptes créés par jour" series={sb?.series} keys={["inscriptions"]} labels={["Comptes créés"]} days={jours} />} />
            <Tile label="Taux d'inscription" value={pctOf(cur("inscriptions"), sumBy(arriveesSplit.current, "visites"))} prev={pctOf(prev("inscriptions"), sumBy(arriveesSplit.previous, "visites"))} format={pct} sansPct hint="Comptes créés sur visites" chart={<DayLine title="Taux d'inscription par jour" series={arrivees} valeur="taux" label="Taux d'inscription" days={jours} format={pct} />} />
            <Tile label="Robots" value={sumBy(robotsSplit.current, "robots")} prev={sumBy(robotsSplit.previous, "robots")} sub={`${pctOf(sumBy(robotsSplit.current, "robots"), sumBy(robotsSplit.current, "robots") + (sumBy(arriveesSplit.current, "visites") || 0)) ?? 0} % des passages`} hint="Passages de robots sur le site : moteurs de recherche, aperçus de lien, agents IA, scripts" chart={<DayBars title="Robots par jour" series={robots} keys={["robots"]} labels={["Robots"]} days={jours} />} />
          </TileChart>
        ) : (
          nonLu("PostHog", data.posthog?.raison)
        )}
        {ph ? <Robots familles={ph.site?.robots_familles} /> : null}
      </Section>

      <Publicites entonnoir={ph?.site?.entonnoir} sources={data.utilisateurs?.sources} />
      <Campagnes data={data.campagnes} visites={ph?.mails} joursList={joursList} jours={jours} demo={demo} onChange={reload} />

      <Section id="referencement" right={demo ? null : <RefreshSeo />}>
        {gsc || ph ? (
          <TileChart>
            {gsc ? <Tile label="Clics depuis Google" value={sumBy(gscSplit.current, "clics")} prev={sumBy(gscSplit.previous, "clics")} hint="Search Console, données décalées de deux à trois jours" chart={<DayBars title="Clics par jour" series={gscSeries} keys={["clics"]} labels={["Clics"]} days={jours} />} /> : null}
            {gsc ? <Tile label="Impressions" value={sumBy(gscSplit.current, "impressions")} prev={sumBy(gscSplit.previous, "impressions")} hint="Fois où une page de Merry est apparue dans les résultats" chart={<DayBars title="Impressions par jour" series={gscSeries} keys={["impressions"]} labels={["Impressions"]} days={jours} />} /> : null}
            {gsc ? <Tile label="Position moyenne" value={avgPos(gscSplit.current)} prev={avgPos(gscSplit.previous)} format={(v) => Number(v).toLocaleString("fr-FR")} inverse hint="Pondérée par les impressions ; plus petit est mieux" chart={<DayLine title="Position moyenne par jour" series={gscPosition} valeur="position" label="Position" days={jours} format={(v) => Number(v).toLocaleString("fr-FR")} />} /> : null}
            {ph ? <Tile label="Visites d'agents IA" value={sumBy(agentsSplit.current, "visites")} prev={sumBy(agentsSplit.previous, "visites")} hint="Pages lues par des agents qui ne chargent pas le JavaScript (GPTBot, ClaudeBot, PerplexityBot…), reconnus à leur User-Agent" chart={<DayBars title="Visites d'agents par jour" series={agentsSeries} keys={["visites"]} labels={["Visites"]} days={jours} />} /> : null}
          </TileChart>
        ) : (
          nonLu("Search Console", data.google?.raison)
        )}
      </Section>

      <Section id="sante" right={demo ? null : <SendBrief />}>
        {ph || vc ? (
          <TileChart>
            {ph ? <Tile label="Erreurs JavaScript" value={sumBy(bugsSplit.current, "exceptions")} prev={sumBy(bugsSplit.previous, "exceptions")} inverse chart={<DayBars title="Erreurs par jour" series={bugs} keys={["exceptions"]} labels={["Erreurs"]} days={jours} />} /> : null}
            {ph ? <Tile label="Clics de rage" value={sumBy(bugsSplit.current, "rage")} prev={sumBy(bugsSplit.previous, "rage")} inverse chart={<DayBars title="Clics de rage par jour" series={bugs} keys={["rage"]} labels={["Clics de rage"]} days={jours} />} /> : null}
            {ph ? <Tile label="Bugs vus en replay" value={ph.bugs.replays?.bugs || 0} sub={`sur ${fmtInt(ph.bugs.replays?.analysees || 0)} session(s) analysée(s)`} inverse /> : null}
            {vc ? <Tile label="Déploiements en échec" value={vc.erreurs} sub={`sur ${fmtInt(vc.total)} déploiement(s)`} inverse /> : null}
          </TileChart>
        ) : (
          nonLu("PostHog", data.posthog?.raison)
        )}
      </Section>

      <Section id="mails">
        {rs ? (
          <>
            <TileChart>
              <Tile label="Envoyés" value={envois ? sumBy(mailSplit.current, "envois") : mails.envoyes} prev={envois ? sumMesure(mailSplit.previous, "envois") : null} sub={!envois && rs.tronque ? "limité aux 100 derniers envois" : null} chart={<DayLine title="Envois par jour" series={mailSeries} valeur="envois" label="Envois" days={jours} />} />
              <Tile label="Taux de délivrance" value={pctOf(mails.par_etat.delivered || 0, mails.envoyes)} format={pct} />
              <Tile label="Rebonds et plaintes" value={(mails.par_etat.bounced || 0) + (mails.par_etat.complained || 0)} inverse />
            </TileChart>
            <Card title="Derniers envois">
              {mails.derniers?.length ? (
                <ul className="pl-lignes">
                  {mails.derniers.map((m, i) => (
                    <li key={m.id || i} className="pl-ligne pl-ligne-mail">
                      <span className="pl-ligne-t">
                        <strong>{m.a || "–"}</strong>
                        <small>{m.sujet || "Sans objet"}</small>
                      </span>
                      <span className="pl-ligne-pastilles">
                        {ETAT_MAIL[m.etat] ? <Pill tone={ETAT_MAIL[m.etat][1]}>{ETAT_MAIL[m.etat][0]}</Pill> : null}
                        <Pill>{fmtHeure(m.quand)}</Pill>
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="pl-empty">Aucun envoi</div>
              )}
            </Card>
          </>
        ) : (
          nonLu("Resend", data.resend?.raison)
        )}
      </Section>

      <Couts couts={data.couts} demo={demo} onChange={reload} />
    </>
  );
}
