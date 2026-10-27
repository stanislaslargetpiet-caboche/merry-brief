"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { DashProvider, useDash } from "@/lib/dash/store";
import { ImportsProvider, useImports } from "@/lib/dash/imports";
import { CALENDLY_URL, SITE_URL, WHATSAPP_URL } from "@/lib/site";
import { Icon } from "./icons";
import { Avatar, Popover } from "./ui";
import Organisers from "./Organisers";

const NAV = [
  { href: "/dashboard", label: "Accueil", short: "Accueil", icon: "home", exact: true },
  { href: "/dashboard/invites", label: "Invités", short: "Invités", icon: "users" },
  { href: "/dashboard/retroplanning", label: "Rétroplanning", short: "Planning", icon: "calendar" },
  { href: "/dashboard/budget", label: "Budget", short: "Budget", icon: "wallet" },
  { href: "/dashboard/prestataires", label: "Prestataires", short: "Prestataires", icon: "store" },
  { href: "/dashboard/documents", label: "Documents", short: "Docs", icon: "folder" },
  { href: "/dashboard/pense-bete", label: "Pense-bête", short: "Notes", icon: "notepad" },
  { href: "/dashboard/site", label: "Site de mariage", short: "Site", icon: "globe" },
];
const SOON = ["Liste & cagnotte"];

export default function Shell({ children }) {
  return (
    <DashProvider>
      <ImportsProvider>
        <Frame>{children}</Frame>
      </ImportsProvider>
    </DashProvider>
  );
}

function pendingSentence(pending) {
  if (!pending.length) return null;
  if (pending.length > 1) return `${pending.length} organisateurs n'ont pas encore accès.`;
  const name = pending[0].display_name;
  if (/^parents de /i.test(name)) return `Les ${name.charAt(0).toLowerCase()}${name.slice(1)} n'ont pas encore accès.`;
  return `${name} n'a pas encore accès.`;
}

// Import de liste en cours ou prêt, visible sur toutes les pages : la lecture continue même quand on quitte la page d'import
function ImportBadge() {
  const dash = useDash();
  const pathname = usePathname();
  const { jobs } = useImports();
  const seen = useRef(new Map());

  // Une fois la lecture terminée, un message le dit, où que l'on soit
  useEffect(() => {
    for (const j of jobs) {
      const before = seen.current.get(j.id);
      seen.current.set(j.id, j.status);
      if (before === "encours" && j.status !== "encours" && !pathname.startsWith("/dashboard/invites/importer")) {
        dash.setToast(j.status === "lue" ? { kind: "ok", text: `« ${j.name} » est lue : ${j.guests.length} nom${j.guests.length > 1 ? "s" : ""} à vérifier dans Importer une liste.` } : { kind: "error", text: `« ${j.name} » n'a pas pu être lue.` });
      }
    }
  }, [jobs, pathname, dash]);

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
  return (
    <Link href="/dashboard/invites/importer" className={`d-import-badge${running.length ? " is-running" : ""}`} role="status">
      <span className="d-import-dot" aria-hidden="true" />
      <span>{text}</span>
      <strong>{running.length ? "Voir" : "Vérifier"}</strong>
    </Link>
  );
}

function Frame({ children }) {
  const dash = useDash();
  const pathname = usePathname();
  const router = useRouter();
  const [showOrganisers, setShowOrganisers] = useState(false);

  useEffect(() => {
    if (dash.status === "signedout") router.replace(`/connexion?next=${encodeURIComponent(pathname)}`);
    if (dash.status === "mustreset") window.location.replace("/connexion?reset=1");
  }, [dash.status, pathname, router]);

  useEffect(() => {
    if (!dash.toast) return undefined;
    const t = setTimeout(() => dash.setToast(null), 5000);
    return () => clearTimeout(t);
  }, [dash.toast, dash]);

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
    <div className="d-root">
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
                  <Avatar member={m} size={28} ring="#cbff75" />
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
          const on = n.exact ? pathname === n.href : pathname.startsWith(n.href);
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
            const on = n.exact ? pathname === n.href : pathname.startsWith(n.href);
            return (
              <Link key={n.href} href={n.href} className={`d-nav-item${on ? " is-on" : ""}`} aria-current={on ? "page" : undefined}>
                <Icon name={n.icon} size={18} />
                {n.label}
              </Link>
            );
          })}
        </div>
        <div className="d-nav-soon">
          <div className="d-nav-caption">Bientôt</div>
          {SOON.map((s) => (
            <span key={s} className="d-nav-soon-item">
              {s}
            </span>
          ))}
        </div>
        <div className="d-nav-bottom">
          <div className="d-help">
            <a className="d-help-btn" href={CALENDLY_URL} target="_blank" rel="noopener noreferrer">
              <Icon name="calendar" size={16} sw={2} />
              <span>Démonstration</span>
            </a>
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
            <div className="d-loading" aria-live="polite">
              Chargement…
            </div>
          )}
        </div>
      </main>
      {showOrganisers && data ? <Organisers onClose={() => setShowOrganisers(false)} /> : null}
      <ImportBadge />
      {dash.toast ? (
        <div className={`d-toast is-${dash.toast.kind}`} role="status">
          {dash.toast.text}
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
