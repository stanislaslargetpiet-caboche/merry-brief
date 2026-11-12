"use client";

// Pilotage : les indicateurs de Merry (couples, prestataires, acquisition, coulisses), rangés en boutons et sous-pages
// (lib/pilotage/nav.js), réservés aux adresses de PILOTAGE_EMAILS. Toutes les adresses
// /pilotage/… servent cette page : les données viennent de /api/interne/pilotage ; la page ne fait que les mettre en forme. Chaque chiffre de période est comparé à la période précédente de même longueur.

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import Couts from "@/components/pilotage/Couts";
import Utilisateurs from "@/components/pilotage/Utilisateurs";
import CouplesFunnel from "@/components/pilotage/CouplesFunnel";
import Demandes from "@/components/pilotage/Demandes";
import Campagnes from "@/components/pilotage/Campagnes";
import Publicites from "@/components/pilotage/Publicites";
import Robots from "@/components/pilotage/Robots";
import Reseau from "@/components/pilotage/Reseau";
import { Aujourdhui, Capture, Taches, useItems } from "@/components/pilotage/Items";
import { PilotLangue, PilotPeriod, PilotSide, PilotSubnav, useLangue } from "@/components/pilotage/PilotNav";
import { supabase } from "@/lib/supabase";
import { alignSeries, dayList, fmtDateTime, fmtHeure, fmtInt, heureList, pctOf, splitSeries, sumBy, sumMesure } from "@/lib/server/pilotage/shape";
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

// « Mois en cours » : du 1er du mois (heure de Paris) à aujourd'hui, comparé au même nombre de jours juste avant
const RANGES = [
  { id: "24h", jours: 1, label: "24 h" },
  { id: "7j", jours: 7, label: "7 jours" },
  { id: "mois", label: "Mois en cours" },
];

// Le journal des réponses (guest_response_log) n'existe que depuis le 3 nov. 2026 au soir (premier relevé en base) :
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

// Dernier événement Resend de chaque mail : « Cliqué » suppose « Ouvert », on n'affiche que le plus avancé.
// Une teinte pastel par étape, du plus neutre (envoyé) au plus engagé (cliqué) ; les trois soucis restent en rouge.
const ETAT_MAIL = {
  sent: ["Envoyé", "neutral"],
  delivered: ["Délivré", "info"],
  opened: ["Ouvert", "violet"],
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
  const today = parisDay(Date.now());
  const range = RANGES.find((r) => r.id === periode) || RANGES[1];
  const jours = range.jours || Number(today.slice(8, 10));
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const pathname = usePathname();
  const { group, page } = resolvePage(pathname);
  const [search, setSearch] = useState("");
  const liste = useItems(auth.status);

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
    if (auth.status === "ok") load(jours, false);
    if (auth.status === "demo") setData(demoData(jours));
  }, [auth.status, jours, load]);

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
          onRefresh={() => load(jours, true)}
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
              <Board data={data} jours={jours} reload={() => load(jours, true)} liste={liste} today={today} search={search} langue={langue} />
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
  // Sur 24 h (et 1 h), le Site se lit heure par heure : les 24 dernières heures contre les 24 d'avant, chiffres des
  // tuiles compris. Sans les séries par heure (démo, source en échec), il reste jour par jour.
  const heures = useMemo(
    () => (jours === 1 && ph?.site?.visites_heures && data.utilisateurs?.comptes_heures ? heureList(Date.parse(data.genere) || Date.now()) : null),
    [jours, ph, data.utilisateurs, data.genere],
  );
  const pasSite = heures ? 24 : jours;
  const parSite = heures ? "par heure" : "par jour";
  // Visites du compteur sans cookie et comptes créés, jour par jour : le taux saute les jours sans visite. Le compteur
  // n'existe que depuis le 7 nov. 2026 (D-187) : avant sa première visite, un jour n'a pas de mesure (null), pas zéro.
  const arrivees = useMemo(() => {
    const comptes = new Map(heures ? data.utilisateurs.comptes_heures : (sb?.series || []).map((r) => [r.jour, Number(r.inscriptions) || 0]));
    const visites = alignSeries(heures || joursList, heures ? ph.site.visites_heures : ph?.site?.visites, ["visites", "mesurees", "douteuses"]);
    const debut = heures ? 0 : visites.findIndex((r) => r.visites > 0);
    return visites.map((r, i) => ({ ...r, visites: i < debut ? null : r.visites, comptes: comptes.get(r.jour) || 0, taux: pctOf(comptes.get(r.jour) || 0, r.visites) }));
  }, [heures, joursList, ph, sb, data.utilisateurs]);
  const arriveesSplit = useMemo(() => splitSeries(arrivees, pasSite), [arrivees, pasSite]);
  // Allure des visites relevée depuis peu : seules les visites mesurées entrent dans ce pourcentage, toutes restent comptées
  const mesurees = sumBy(arriveesSplit.current, "mesurees") || 0;
  const douteuses = sumBy(arriveesSplit.current, "douteuses") || 0;
  const noteAllure = mesurees
    ? `Relevé récent : ${fmtInt(douteuses)} visites sur ${fmtInt(mesurees)} (${pctOf(douteuses, mesurees)} %) n'ont pas l'allure d'un navigateur ordinaire (script, ou navigateur très ancien). Elles restent comptées dans le total.`
    : "Relevé de l'allure des visites (navigateur ordinaire ou script) : aucune visite mesurée sur la période pour l'instant.";
  const robots = useMemo(() => alignSeries(heures || joursList, heures ? ph.site.robots_heures : ph?.site?.robots, ["robots"]), [heures, joursList, ph]);
  const robotsSplit = useMemo(() => splitSeries(robots, pasSite), [robots, pasSite]);
  const reponsesForm = useMemo(() => mesureDepuis(sb?.series, "reponses_formulaire", DEBUT_JOURNAL_RSVP), [sb]);
  const reponsesFormSplit = useMemo(() => splitSeries(reponsesForm, jours), [reponsesForm, jours]);
  // Fonction SQL pas encore relancée : la clé manque, la tuile affiche « – » plutôt qu'un faux zéro
  const formMesure = Boolean(sb?.series?.some((r) => r.reponses_formulaire != null));
  // Sur 24 h, les autres graphes de Supabase (Mariages, Couples connectés, Réponses au formulaire, Formulaires live,
  // Demandes de devis, Vues de fiches) se lisent aussi heure par heure (supabase/pilotage-heures.sql). Tant que la
  // fonction n'est pas collée en base, ils restent par jour (comme avant).
  const activiteHeures = useMemo(() => {
    const rows = data.supabaseHeures?.series;
    if (!heures || !rows) return null;
    const par = new Map(rows.map((r) => [r.jour, r]));
    return heures.map((h) => par.get(h) || { jour: h, mariages: 0, demandes: 0, reponses_formulaire: 0, formulaires_live: 0, vues_pro: 0, couples_connectes: 0 });
  }, [heures, data.supabaseHeures]);
  // Agents IA et bugs (exceptions, clics de rage) sur 24 h : déjà lus heure par heure par PostHog
  const agentsHeures = useMemo(() => (heures && ph?.agents?.visites_heures ? alignSeries(heures, ph.agents.visites_heures, ["visites"]) : null), [heures, ph]);
  const bugsHeures = useMemo(() => (heures && ph?.bugs?.heures ? alignSeries(heures, ph.bugs.heures, ["exceptions", "rage"]) : null), [heures, ph]);
  const mailHeures = useMemo(() => (heures && data.envois?.par_heure ? alignSeries(heures, data.envois.par_heure, ["envois"]) : null), [heures, data.envois]);
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

  // Série, nombre de jours et mot à employer dans le titre : la version heure par heure quand elle est là, sinon
  // la version par jour d'avant (Search Console n'a jamais d'heure par heure : ses trois graphes restent par jour)
  const seriesActivite = activiteHeures || sb?.series;
  const joursActivite = activiteHeures ? pasSite : jours;
  const parActivite = activiteHeures ? "par heure" : "par jour";
  const seriesAgents = agentsHeures || agentsSeries;
  const joursAgents = agentsHeures ? pasSite : jours;
  const parAgents = agentsHeures ? "par heure" : "par jour";
  const seriesBugs = bugsHeures || bugs;
  const joursBugs = bugsHeures ? pasSite : jours;
  const parBugs = bugsHeures ? "par heure" : "par jour";
  const seriesMail = mailHeures || mailSeries;
  const joursMail = mailHeures ? pasSite : jours;
  const parMail = mailHeures ? "par heure" : "par jour";

  return (
    <>
      <Section id="jour">
        <Aujourdhui liste={liste} data={data} sante={sante} today={today} tuiles={tuilesJour} reload={reload} search={search} langue={langue} />
      </Section>

      <Section id="activite">
        <TileChart>
          <Tile label="Mariages" value={t.mariages} sub={`${fmtInt(cur("mariages"))} créé(s) sur la période`} chart={<DayLine cumul title="Mariages au total" series={cumulSerie(seriesActivite, "mariages", t.mariages)} valeur="cumul" label="Mariages" days={joursActivite} />} />
          <Tile label="Couples connectés" value={u.couples_connectes?.n} sub={`sur ${fmtInt(t.mariages)} mariages`} hint="Mariages dont un compte s'est connecté sur la période (Supabase Auth)" chart={<DayLine title={`Couples connectés ${parActivite}`} series={seriesActivite} valeur="couples_connectes" label="Couples connectés" days={joursActivite} />} />
          <Tile label="Réponses au formulaire" value={formMesure ? sumMesure(reponsesFormSplit.current, "reponses_formulaire") : null} prev={formMesure ? sumMesure(reponsesFormSplit.previous, "reponses_formulaire") : undefined} hint="Invités qui ont répondu par le formulaire, une fois par jour chacun" chart={<DayLine title={`Réponses au formulaire ${parActivite}`} series={activiteHeures || reponsesForm} valeur="reponses_formulaire" label="Réponses au formulaire" days={joursActivite} />} />
          <Tile label="Formulaires live" value={formMesure ? t.formulaires_publies : null} sub={formMesure ? `sur ${fmtInt(t.mariages)} mariages` : null} hint="Formulaires invités en ligne ; le passé compte les formulaires créés ce jour-là et encore publiés" chart={activiteHeures ? <DayLine title={`Formulaires live ${parActivite}`} series={seriesActivite} valeur="formulaires_live" label="Formulaires live" days={joursActivite} /> : <DayBars title="Formulaires live par jour" series={sb?.series} keys={["formulaires_live"]} labels={["Formulaires live"]} days={jours} />} />
          <Tile label="Demandes de devis" value={cur("demandes")} prev={prev("demandes")} chart={<DayLine title={`Demandes de devis ${parActivite}`} series={seriesActivite} valeur="demandes" label="Demandes de devis" days={joursActivite} />} />
        </TileChart>
      </Section>

      <CouplesFunnel data={data.utilisateurs} demo={demo} />

      <Utilisateurs data={data.utilisateurs} />

      <Section id="catalogue">
        <TileChart>
          <Tile label="Fiches revendiquées" value={t.fiches_revendiquees} sub={t.fiches_revendiquees_periode != null ? `${fmtInt(t.fiches_revendiquees_periode)} sur la période` : null} />
          <Tile label="Vues de fiches" value={cur("vues_pro")} prev={prev("vues_pro")} hint="Fiches revendiquées ouvertes par des couples" chart={activiteHeures ? <DayLine title={`Vues de fiches ${parActivite}`} series={seriesActivite} valeur="vues_pro" label="Vues de fiches" days={joursActivite} /> : <DayBars title="Vues de fiches par jour" series={sb?.series} keys={["vues_pro"]} labels={["Vues de fiches"]} days={jours} />} />
          <Tile label="Crédits dépensés" value={t.credits_depenses_periode} sub={t.credits_depenses != null ? `${fmtInt(t.credits_depenses)} au total` : null} hint="Réponses payées en crédits sur la période" />
          <Tile label="Avec 3 photos ou plus" value={pctOf(t.catalogue_photos3, t.catalogue_actifs)} format={pct} sub={`des ${fmtInt(t.catalogue_actifs)} fiches actives`} />
        </TileChart>
      </Section>

      <Demandes demandes={data.demandes} demo={demo} onChange={reload} />

      <Reseau reseau={data.reseau} demo={demo} onChange={reload} />

      <Section id="site">
        {ph ? (
          <TileChart>
            <Tile label="Visites humaines" value={sumBy(arriveesSplit.current, "visites")} prev={sumMesure(arriveesSplit.previous, "visites")} hint="Pages du site ouvertes par une personne, cookies acceptés ou non (compteur sans cookie, robots et appareils de l'équipe écartés)" note={noteAllure} chart={<DayLine title={`Visites humaines ${parSite}`} series={arrivees} valeur="visites" label="Visites humaines" days={pasSite} />} />
            <Tile label="Comptes créés" value={sumBy(arriveesSplit.current, "comptes")} prev={sumBy(arriveesSplit.previous, "comptes")} chart={<DayLine title={`Comptes créés ${parSite}`} series={arrivees} valeur="comptes" label="Comptes créés" days={pasSite} />} />
            <Tile label="Taux d'inscription" value={pctOf(sumBy(arriveesSplit.current, "comptes"), sumBy(arriveesSplit.current, "visites"))} prev={pctOf(sumBy(arriveesSplit.previous, "comptes"), sumBy(arriveesSplit.previous, "visites"))} format={pct} sansPct hint="Comptes créés sur visites" chart={<DayLine title={`Taux d'inscription ${parSite}`} series={arrivees} valeur="taux" label="Taux d'inscription" days={pasSite} format={pct} />} />
            <Tile label="Robots" value={sumBy(robotsSplit.current, "robots")} prev={sumBy(robotsSplit.previous, "robots")} sub={`${pctOf(sumBy(robotsSplit.current, "robots"), sumBy(robotsSplit.current, "robots") + (sumBy(arriveesSplit.current, "visites") || 0)) ?? 0} % des passages`} hint="Passages de robots sur le site : moteurs de recherche, aperçus de lien, agents IA, scripts" chart={heures ? <DayLine title={`Robots ${parSite}`} series={robots} valeur="robots" label="Robots" days={pasSite} /> : <DayBars title={`Robots ${parSite}`} series={robots} keys={["robots"]} labels={["Robots"]} days={pasSite} />} />
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
            {ph ? <Tile label="Visites d'agents IA" value={sumBy(agentsSplit.current, "visites")} prev={sumBy(agentsSplit.previous, "visites")} hint="Pages lues par des agents qui ne chargent pas le JavaScript (GPTBot, ClaudeBot, PerplexityBot…), reconnus à leur User-Agent" chart={agentsHeures ? <DayLine title={`Visites d'agents ${parAgents}`} series={seriesAgents} valeur="visites" label="Visites" days={joursAgents} /> : <DayBars title="Visites d'agents par jour" series={agentsSeries} keys={["visites"]} labels={["Visites"]} days={jours} />} /> : null}
          </TileChart>
        ) : (
          nonLu("Search Console", data.google?.raison)
        )}
      </Section>

      <Section id="sante" right={demo ? null : <SendBrief />}>
        {ph || vc ? (
          <TileChart>
            {ph ? <Tile label="Erreurs JavaScript" value={sumBy(bugsSplit.current, "exceptions")} prev={sumBy(bugsSplit.previous, "exceptions")} inverse chart={bugsHeures ? <DayLine title={`Erreurs ${parBugs}`} series={seriesBugs} valeur="exceptions" label="Erreurs" days={joursBugs} /> : <DayBars title="Erreurs par jour" series={bugs} keys={["exceptions"]} labels={["Erreurs"]} days={jours} />} /> : null}
            {ph ? <Tile label="Clics de rage" value={sumBy(bugsSplit.current, "rage")} prev={sumBy(bugsSplit.previous, "rage")} inverse chart={bugsHeures ? <DayLine title={`Clics de rage ${parBugs}`} series={seriesBugs} valeur="rage" label="Clics de rage" days={joursBugs} /> : <DayBars title="Clics de rage par jour" series={bugs} keys={["rage"]} labels={["Clics de rage"]} days={jours} />} /> : null}
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
              <Tile label="Envoyés" value={envois ? sumBy(mailSplit.current, "envois") : mails.envoyes} prev={envois ? sumMesure(mailSplit.previous, "envois") : null} sub={!envois && rs.tronque ? "limité aux 100 derniers envois" : null} chart={<DayLine title={`Envois ${parMail}`} series={seriesMail} valeur="envois" label="Envois" days={joursMail} />} />
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
