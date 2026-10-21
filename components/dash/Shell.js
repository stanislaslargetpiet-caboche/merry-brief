"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { DashProvider, useDash } from "@/lib/dash/store";
import { SITE_URL } from "@/lib/site";
import { Icon } from "./icons";
import { Avatar } from "./ui";
import Organisers from "./Organisers";

const NAV = [
  { href: "/dashboard", label: "Accueil", icon: "home", exact: true },
  { href: "/dashboard/invites", label: "Invités", icon: "users" },
  { href: "/dashboard/retroplanning", label: "Rétroplanning", icon: "calendar" },
  { href: "/dashboard/budget", label: "Budget", icon: "wallet" },
];
const SOON = ["Prestataires", "Site de mariage", "Liste & cagnotte"];

export default function Shell({ children }) {
  return (
    <DashProvider>
      <Frame>{children}</Frame>
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

function Frame({ children }) {
  const dash = useDash();
  const pathname = usePathname();
  const router = useRouter();
  const [showOrganisers, setShowOrganisers] = useState(false);

  useEffect(() => {
    if (dash.status === "signedout") router.replace(`/connexion?next=${encodeURIComponent(pathname)}`);
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

  return (
    <div className="d-root">
      <nav className="d-nav" aria-label="Navigation du tableau de bord">
        <Link href="/dashboard" className="d-logo">
          Merry
        </Link>
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
          {data ? (
            <button type="button" className="d-nav-item d-nav-mobile-only" onClick={() => setShowOrganisers(true)}>
              Organisateurs
            </button>
          ) : null}
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
              <strong>Mode démo.</strong> Données d'exemple, enregistrées seulement dans ce navigateur.
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
        <p>Le tableau de bord n'a pas pu se charger. Vérifiez votre connexion, puis réessayez. Si cela continue, écrivez-nous à bonjour@merry.fr.</p>
      )}
      <div>
        <button type="button" className="d-btn d-btn-primary" onClick={reload}>
          Réessayer
        </button>
      </div>
    </div>
  );
}
