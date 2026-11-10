"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { DashProvider, useDash } from "@/lib/dash/store";
import { accentIntroDue, markAccentSeen, syncAccent, useAccent } from "@/lib/dash/accent";
import { ImportsProvider, useImports } from "@/lib/dash/imports";
import { CALENDLY_URL, SITE_URL, WHATSAPP_URL } from "@/lib/site";
import { isVendorThreadUnread } from "@/lib/dash/picks";
import { Icon } from "./icons";
import { Avatar, Popover, PageLoader } from "./ui";
import Organisers from "./Organisers";

// Même ordre partout (barre latérale, onglets du téléphone) : Invités, Budget, Planning, Prestataires, Messagerie
const NAV = [
  { href: "/dashboard/invites", label: "Invités", short: "Invités", icon: "users" },
  { href: "/dashboard/budget", label: "Budget", short: "Budget", icon: "wallet", also: ["/dashboard/documents", "/dashboard/indicateurs/budget"] },
  { href: "/dashboard/retroplanning", label: "Rétroplanning", short: "Planning", icon: "calendar" },
  { href: "/dashboard/prestataires", label: "Prestataires", short: "Prestataires", icon: "store", exclude: ["/dashboard/prestataires/messagerie"] },
  { href: "/dashboard/prestataires/messagerie", label: "Messagerie", short: "Messagerie", icon: "bubble", badge: true },
];

// L'éditeur du site (/dashboard/site) fait partie de l'espace Invités ; les documents et les indicateurs, du Budget
const isOn = (n, pathname) =>
  (pathname.startsWith(n.href) || (n.also || []).some((h) => pathname.startsWith(h)) || (n.href === "/dashboard/invites" && pathname.startsWith("/dashboard/site"))) &&
  !(n.exclude || []).some((h) => pathname.startsWith(h));

export default function Shell({ children }) {
  return (
    <DashProvider>
      <ImportsProvider>
        <Frame>{children}</Frame>
      </ImportsProvider>
    </DashProvider>
  );
}

// Réponse d'un prestataire plus récente que la dernière lecture du fil (vendors.messages_read_at) :
// sert de pastille sur le bouton Messagerie de la navigation.
function useUnreadMessages() {
  const dash = useDash();
  const data = dash.data;
  const vendors = data?.vendors || [];
  return vendors.filter((v) => isVendorThreadUnread(v, data)).length;
}

function pendingSentence(pending) {
  if (!pending.length) return null;
  if (pending.length > 1) return `${pending.length} organisateurs n'ont pas encore accès.`;
  const name = pending[0].display_name;
  if (/^parents de /i.test(name)) return `Les ${name.charAt(0).toLowerCase()}${name.slice(1)} n'ont pas encore accès.`;
  return `${name} n'a pas encore accès.`;
}

// Rappels d'import fermés depuis la croix, sur l'appareil : la liste reste dans Importer une liste
const HIDDEN_IMPORTS_KEY = "merry-imports-hidden";
function readHiddenImports() {
  try {
    const raw = window.localStorage.getItem(HIDDEN_IMPORTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}
function writeHiddenImports(ids) {
  try {
    window.localStorage.setItem(HIDDEN_IMPORTS_KEY, JSON.stringify(ids));
  } catch {
    /* stockage indisponible */
  }
}

// Import de liste en cours ou prêt, visible sur toutes les pages : la lecture continue même quand on quitte la page d'import
function ImportBadge() {
  const dash = useDash();
  const pathname = usePathname();
  const { jobs: all } = useImports();
  const seen = useRef(new Map());
  const [hidden, setHidden] = useState([]);

  useEffect(() => {
    setHidden(readHiddenImports());
  }, []);

  // Une fois la lecture terminée, un message le dit, où que l'on soit
  useEffect(() => {
    for (const j of all) {
      const before = seen.current.get(j.id);
      seen.current.set(j.id, j.status);
      if (before === "encours" && j.status !== "encours" && !pathname.startsWith("/dashboard/invites/importer")) {
        dash.setToast(j.status === "lue" ? { kind: "ok", text: `« ${j.name} » est lue : ${j.guests.length} nom${j.guests.length > 1 ? "s" : ""} à vérifier dans Importer une liste.` } : { kind: "error", text: `« ${j.name} » n'a pas pu être lue.` });
      }
    }
  }, [all, pathname, dash]);

  // Une lecture en cours reste toujours affichée ; une liste lue disparaît du rappel une fois fermée
  const jobs = all.filter((j) => j.status === "encours" || !hidden.includes(j.id));
  if (!jobs.length || pathname.startsWith("/dashboard/invites/importer")) return null;
  const running = jobs.filter((j) => j.status === "encours");
  const job = running[0] || jobs[jobs.length - 1];
  const text = running.length
    ? `Merry lit « ${job.name} »${job.parts.total > 1 ? ` · ${Math.min(job.parts.done, job.parts.total)}/${job.parts.total}` : ""}`
    : jobs.length > 1
      ? `${jobs.length} listes lues, à vérifier`
      : job.status === "lue"
        ? `« ${job.name} » est lue : ${job.guests.length} nom${job.guests.length > 1 ? "s" : ""} à vérifier`
        : `« ${job.name} » n'a pas pu être lue`;

  function close() {
    // Les identifiants d'imports disparus (validés, retirés, nettoyés) ne sont pas gardés
    const ids = all.map((j) => j.id);
    const next = [...new Set([...hidden.filter((id) => ids.includes(id)), ...jobs.map((j) => j.id)])];
    setHidden(next);
    writeHiddenImports(next);
  }

  return (
    <div className={`d-import-badge${running.length ? " is-running" : ""}`} role="status">
      <Link href="/dashboard/invites/importer" className="d-import-link">
        <span className="d-import-dot" aria-hidden="true" />
        <span className="d-import-text">{text}</span>
        <strong>{running.length ? "Voir" : "Vérifier"}</strong>
      </Link>
      {running.length ? null : (
        <button type="button" className="d-import-close" onClick={close} aria-label="Fermer">
          <Icon name="x" size={14} sw={2.2} />
        </button>
      )}
    </div>
  );
}

function Frame({ children }) {
  const dash = useDash();
  const pathname = usePathname();
  const router = useRouter();
  const unread = useUnreadMessages();
  const [showOrganisers, setShowOrganisers] = useState(false);
  const accent = useAccent();
  const [introClosed, setIntroClosed] = useState(false);
  const live = dash.status === "ready" && dash.mode === "live";
  const onSettings = pathname.startsWith("/dashboard/reglages");
  const showIntro = live && !introClosed && !onSettings && accentIntroDue(dash.user);

  useEffect(() => {
    if (live) syncAccent(dash.user);
  }, [live, dash.user]);

  // Quelqu'un qui ouvre Réglages de lui-même a vu le sélecteur : la carte n'a plus lieu d'être
  useEffect(() => {
    if (live && onSettings && accentIntroDue(dash.user)) markAccentSeen();
  }, [live, onSettings, dash.user]);

  function closeIntro() {
    setIntroClosed(true);
    markAccentSeen();
  }

  useEffect(() => {
    if (dash.status === "signedout") router.replace(`/connexion?next=${encodeURIComponent(pathname + window.location.search)}`);
    if (dash.status === "mustreset") window.location.replace("/connexion?reset=1");
  }, [dash.status, pathname, router]);

  // Les autres organisateurs voient sur quelle page on est
  useEffect(() => {
    dash.trackPage?.(pathname);
  }, [pathname, dash.trackPage]);

  // Le compte à rebours ne repart qu'avec un nouveau toast, pas à chaque changement du tableau de bord
  const setToastRef = useRef(dash.setToast);
  setToastRef.current = dash.setToast;
  useEffect(() => {
    if (!dash.toast) return undefined;
    // Un toast avec « Annuler » reste un peu plus longtemps, le temps de se raviser
    const t = setTimeout(() => setToastRef.current(null), dash.toast.action ? 8000 : 5000);
    return () => clearTimeout(t);
  }, [dash.toast]);

  // Ouvre la fenêtre des organisateurs depuis n'importe quelle page (lien #organisateurs)
  useEffect(() => {
    const open = () => {
      if (window.location.hash === "#organisateurs") {
        setShowOrganisers(true);
        history.replaceState(null, "", window.location.pathname + window.location.search);
      }
    };
    open();
    window.addEventListener("hashchange", open);
    return () => window.removeEventListener("hashchange", open);
  }, [pathname]);

  const data = dash.data;
  const members = data?.members || [];
  const pending = members.filter((m) => !m.user_id);
  const [menu, setMenu] = useState(false);

  return (
    <div className="d-root" data-accent={accent}>
      {/* Téléphone : en-tête compact en haut, onglets en bas */}
      <header className="d-topbar">
        <Link href="/dashboard" className="d-logo">
          Merry
        </Link>
        {data ? (
          <div className="d-topbar-right">
            <button type="button" className="d-topbar-faces" onClick={() => setShowOrganisers(true)} aria-label="Voir les organisateurs">
              {members.slice(0, 4).map((m, i) => (
                <span key={m.id} style={{ marginLeft: i ? -8 : 0, display: "inline-flex", opacity: m.user_id ? 1 : 0.55 }}>
                  <Avatar member={m} size={28} ring="var(--d-lime)" />
                </span>
              ))}
              {pending.length ? <span className="d-topbar-dot" aria-hidden="true" /> : null}
            </button>
            <span className="d-anchor">
              <button type="button" className="d-topbar-menu" onClick={() => setMenu((o) => !o)} aria-label="Menu" aria-expanded={menu}>
                <Icon name="dots" size={18} sw={2.2} />
              </button>
              <Popover open={menu} onClose={() => setMenu(false)} align="right">
                {data?.weddings?.length > 1
                  ? data.weddings.map((w) => (
                      <button
                        key={w.id}
                        type="button"
                        className={`d-pop-item${w.id === data.wedding.id ? " is-on" : ""}`}
                        onClick={() => {
                          setMenu(false);
                          dash.switchWedding(w.id);
                        }}
                      >
                        {w.name || "Mariage"}
                        {w.id === data.wedding.id ? <Icon name="check" size={14} sw={2.2} /> : null}
                      </button>
                    ))
                  : null}
                <button
                  type="button"
                  className="d-pop-item"
                  onClick={() => {
                    setMenu(false);
                    setShowOrganisers(true);
                  }}
                >
                  Organisateurs
                </button>
                <Link className="d-pop-item" href="/dashboard/reglages" onClick={() => setMenu(false)}>
                  Réglages
                </Link>
                <a className="d-pop-item" href={SITE_URL}>
                  Retour au site
                </a>
                <button type="button" className="d-pop-item" onClick={dash.signOut}>
                  Se déconnecter
                </button>
              </Popover>
            </span>
          </div>
        ) : null}
      </header>

      <nav className="d-tabbar" aria-label="Navigation du tableau de bord">
        {NAV.map((n) => {
          const on = isOn(n, pathname);
          return (
            <Link key={n.href} href={n.href} className={`d-tab-item${on ? " is-on" : ""}`} aria-current={on ? "page" : undefined}>
              {on ? <span className="d-tab-pill">{n.short}</span> : n.short}
            </Link>
          );
        })}
      </nav>

      <nav className="d-nav" aria-label="Navigation du tableau de bord">
        <Link href="/dashboard" className="d-logo">
          Merry
        </Link>
        {data?.weddings?.length > 1 ? (
          <select className="d-select d-wedding-switch" value={data.wedding.id} onChange={(e) => dash.switchWedding(e.target.value)} aria-label="Changer de mariage">
            {data.weddings.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name || "Mariage"}
              </option>
            ))}
          </select>
        ) : null}
        <div className="d-nav-main">
          {NAV.map((n) => {
            const on = isOn(n, pathname);
            return (
              <Link key={n.href} href={n.href} className={`d-nav-item${on ? " is-on" : ""}`} aria-current={on ? "page" : undefined}>
                <Icon name={n.icon} size={18} />
                {n.label}
                {n.badge && unread ? <span className="d-nav-badge" aria-label={`${unread} non lus`}>{unread}</span> : null}
              </Link>
            );
          })}
        </div>
        <div className="d-nav-bottom">
          <div className="d-help">
            <Link className={`d-help-btn${pathname.startsWith("/dashboard/reglages") ? " is-on" : ""}`} href="/dashboard/reglages">
              <Icon name="settings" size={16} sw={2} />
              <span>Réglages</span>
            </Link>
            <a className="d-help-btn" href={CALENDLY_URL} target="_blank" rel="noopener noreferrer">
              <Icon name="bubble" size={16} sw={2} />
              <span>Aide</span>
            </a>
            <a className="d-help-btn" href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer">
              <Icon name="users" size={16} sw={2} />
              <span>Premiers utilisateurs</span>
            </a>
          </div>
          {data ? (
            <div className="d-team">
              <div className="d-team-title">Organisateurs</div>
              <button type="button" className="d-team-faces" onClick={() => setShowOrganisers(true)} aria-label="Voir les organisateurs">
                {members.slice(0, 5).map((m, i) => (
                  <span key={m.id} style={{ marginLeft: i ? -9 : 0, display: "inline-flex", opacity: m.user_id ? 1 : 0.55 }}>
                    <Avatar member={m} size={32} ring="#ffffff" />
                  </span>
                ))}
                <span className="d-team-plus" style={{ marginLeft: members.length ? -9 : 0 }}>
                  <Icon name="plus" size={14} sw={2} />
                </span>
              </button>
              {pending.length ? <div className="d-team-note">{pendingSentence(pending)}</div> : null}
              <button type="button" className="d-btn d-btn-primary d-btn-small d-btn-block" onClick={() => setShowOrganisers(true)}>
                Inviter un organisateur
              </button>
            </div>
          ) : null}
          <div className="d-nav-links">
            <a href={SITE_URL}>Retour au site</a>
            {data ? (
              <button type="button" onClick={dash.signOut}>
                Se déconnecter
              </button>
            ) : null}
          </div>
        </div>
      </nav>
      <main className="d-main">
        {dash.mode === "demo" && dash.status === "ready" ? (
          <div className="d-demo">
            <span>
              <strong>Mode démo.</strong> <span className="d-desk-only">Données d'exemple, enregistrées seulement dans ce navigateur.</span>
            </span>
            <button type="button" onClick={dash.resetDemo}>
              Remettre à zéro
            </button>
          </div>
        ) : null}
        <div className="d-wrap">
          {dash.status === "ready" ? (
            children
          ) : dash.status === "error" ? (
            <ErrorState kind={dash.error} reload={dash.reload} />
          ) : (
            <PageLoader />
          )}
        </div>
      </main>
      {showOrganisers && data ? <Organisers onClose={() => setShowOrganisers(false)} /> : null}
      <ImportBadge />
      {showIntro ? (
        <div className="d-intro" role="status">
          <span>Tu peux changer la couleur de Merry.</span>
          <Link className="d-btn d-btn-primary d-btn-small" href="/dashboard/reglages" onClick={closeIntro}>
            Choisir ma couleur
          </Link>
          <button type="button" className="d-intro-close" onClick={closeIntro} aria-label="Fermer">
            <Icon name="x" size={14} sw={2.2} />
          </button>
        </div>
      ) : null}
      {dash.toast ? (
        <div className={`d-toast is-${dash.toast.kind}`} role="status">
          {dash.toast.kind === "ok" ? (
            <span className="d-toast-check" aria-hidden="true">
              <Icon name="check" size={13} sw={3} />
            </span>
          ) : null}
          {dash.toast.text}
          {dash.toast.action ? (
            <button
              type="button"
              className="d-toast-action"
              onClick={() => {
                const run = dash.toast.action.onClick;
                dash.setToast(null);
                run();
              }}
            >
              {dash.toast.action.label}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function ErrorState({ kind, reload }) {
  return (
    <div className="d-card d-error-card">
      <h1 className="d-title">Un instant.</h1>
      {kind === "setup" ? (
        <p>
          Le tableau de bord n'est pas encore installé sur la base de données. Il faut coller le fichier <code>supabase/dashboard.sql</code> dans
          Supabase (SQL Editor), puis recharger la page.
        </p>
      ) : (
        <p>Le tableau de bord n'a pas pu se charger. Vérifiez votre connexion, puis réessayez. Si cela continue, écrivez-nous à bonjour@withmerry.com.</p>
      )}
      <div>
        <button type="button" className="d-btn d-btn-primary" onClick={reload}>
          Réessayer
        </button>
      </div>
    </div>
  );
}
