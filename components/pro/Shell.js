"use client";

// Espace prestataire : cadre commun (maquettes V1 et V1m). Barre latérale lime sur ordinateur ;
// sur téléphone, bandeau lime puis onglets texte qui défilent. Séparé du tableau de bord des couples.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ProProvider, usePro } from "@/lib/pro/store";
import { Popover, PageLoader } from "@/components/dash/ui";
import { Icon } from "@/components/dash/icons";
import { syncAccent, useAccent } from "@/lib/dash/accent";
import { countUnreadRequests, memberColor, memberInitial, memberName, PRO_SEEN_EVENT } from "@/lib/pro/format";
import { CALENDLY_URL, SITE_URL } from "@/lib/site";
import { ProIcon, CreditsCoins } from "./icons";
import Claim from "./Claim";
import Pending from "./Pending";
import FeatureDialog from "./FeatureDialog";

// Chaque entrée groupe plusieurs pages sous un seul onglet de la barre latérale (maquettes
// « Mon profil » et « Messagerie » du canvas) ; `match` liste les chemins qui l'activent, et ses
// sous-pages affichent un ProSubnav vers les autres.
// Projets de mariage (/pro/projets) est masqué de la navigation depuis le 3 nov. 2026 (décision de Stan) :
// la liste reste vide tant que les couples n'ont pas d'écran pour accepter d'être contactés. La page existe
// toujours, il suffit de remettre l'entrée ici quand cet écran couple sera prêt.
export const PRO_NAV = [
  { href: "/pro", label: "Dashboard", icon: "home", exact: true, match: ["/pro"] },
  { href: "/pro/demandes", label: "Messagerie", icon: "demandes", match: ["/pro/demandes", "/pro/clients"], badge: true },
  { href: "/pro/fiche", label: "Mon profil", icon: "fiche", match: ["/pro/fiche", "/pro/tarifs", "/pro/credits", "/pro/compte"] },
];

// Demandes reçues et pas encore répondues, non relues dans ce navigateur (lecture posée par la page
// Demandes elle-même dans le localStorage) : sert de pastille sur le bouton Messagerie de la navigation.
function useUnreadRequests() {
  const pro = usePro();
  const requests = pro.data.requests;
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    const recompute = () => setUnread(countUnreadRequests(requests));
    recompute();
    window.addEventListener(PRO_SEEN_EVENT, recompute);
    window.addEventListener("storage", recompute);
    return () => {
      window.removeEventListener(PRO_SEEN_EVENT, recompute);
      window.removeEventListener("storage", recompute);
    };
  }, [requests]);

  return unread;
}

export const PRO_MESSAGERIE_TABS = [
  { href: "/pro/demandes", label: "Demandes" },
  { href: "/pro/clients", label: "Réservations" },
  { href: "/pro/clients/historique", label: "Anciens clients" },
];

// Disponibilités a fusionné dans Tarifs (calendrier + prix, demande de Stan le 3 nov. 2026)
export const PRO_PROFIL_TABS = [
  { href: "/pro/fiche", label: "Ma fiche" },
  { href: "/pro/tarifs", label: "Calendrier & Tarifs" },
  { href: "/pro/credits", label: "Crédits" },
  { href: "/pro/compte", label: "Compte" },
];

export default function ProShell({ children }) {
  return (
    <ProProvider>
      <Gate>{children}</Gate>
    </ProProvider>
  );
}

function Gate({ children }) {
  const pro = usePro();
  if (pro.status === "loading") {
    return (
      <div className="d-root p-root p-bare">
        <PageLoader />
      </div>
    );
  }
  // Un lien d'invitation s'ouvre sur l'écran pour rejoindre l'équipe, même pour un compte qui a déjà sa fiche
  const invited = typeof window !== "undefined" && new URLSearchParams(window.location.search).has("invitation");
  if (pro.status === "claim" || (invited && pro.status === "ready")) return <Claim />;
  if (pro.status === "pending") return <Pending />;
  if (pro.status === "setup" || pro.status === "error") return <Trouble kind={pro.status} error={pro.error} reload={pro.reload} />;
  return <Frame>{children}</Frame>;
}

function Trouble({ kind, error, reload }) {
  return (
    <div className="d-root p-root p-bare">
      <div className="d-card d-error-card p-trouble">
        <h1 className="d-title">Un instant.</h1>
        {kind === "setup" ? (
          <p>
            L’espace prestataire n’est pas encore installé sur la base de données. Il faut coller le fichier <code>supabase/espace-prestataire.sql</code> dans Supabase (SQL Editor), puis recharger la page. En attendant,{" "}
            <a href="/pro?demo=1">la démonstration</a> montre chaque écran.
          </p>
        ) : (
          <p>L’espace prestataire n’a pas pu se charger ({error}). Vérifiez votre connexion, puis réessayez.</p>
        )}
        <div>
          <button type="button" className="d-btn d-btn-primary" onClick={reload}>
            Réessayer
          </button>
        </div>
      </div>
    </div>
  );
}

function Frame({ children }) {
  const pro = usePro();
  const pathname = usePathname();
  const [feature, setFeature] = useState(false);
  const [menu, setMenu] = useState(false);
  const credits = pro.data.pro?.credits ?? 0;
  const here = PRO_NAV.find((n) => ((n.exact ? pathname === n.href : n.match.some((m) => pathname === m || pathname.startsWith(m + "/")))))?.label || "Dashboard";
  const navRef = useRef(null);
  const accent = useAccent();
  const unread = useUnreadRequests();

  useEffect(() => {
    if (pro.mode === "live") syncAccent(pro.data.user);
  }, [pro.mode, pro.data.user]);

  useEffect(() => {
    if (!pro.toast) return undefined;
    const t = setTimeout(() => pro.setToast(null), 5000);
    return () => clearTimeout(t);
  }, [pro.toast, pro]);

  // Téléphone : l'onglet de la page reste visible dans la barre qui défile
  useEffect(() => {
    navRef.current?.querySelector('[aria-current="page"]')?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [pathname]);

  return (
    <div className="d-root p-root" data-accent={accent}>
      {/* Téléphone : bandeau lime, puis onglets texte */}
      <header className="p-top">
        <Link href="/pro" className="p-brand is-small">
          <span className="p-brand-logo">Merry</span>
          <span className="p-brand-sub">Espace prestataire</span>
        </Link>
        <span className="p-top-right">
          <Link href="/pro/credits" className="p-credits-pill is-small">
            <CreditsCoins size={16} />
            {credits} crédit{credits > 1 ? "s" : ""}
          </Link>
          <span className="d-anchor">
            <button type="button" className="d-topbar-menu" onClick={() => setMenu((o) => !o)} aria-label="Menu" aria-expanded={menu}>
              <Icon name="dots" size={18} sw={2.2} />
            </button>
            <Popover open={menu} onClose={() => setMenu(false)} align="right">
              <AccountMenu close={() => setMenu(false)} />
            </Popover>
          </span>
        </span>
      </header>
      <nav className="p-tabs" aria-label="Navigation de l'espace prestataire" ref={navRef}>
        {PRO_NAV.map((n) => {
          const on = (n.exact ? pathname === n.href : n.match.some((m) => pathname === m || pathname.startsWith(m + "/")));
          return (
            <Link key={n.href} href={n.href} className={`p-tab${on ? " is-on" : ""}`} aria-current={on ? "page" : undefined}>
              {n.label}
            </Link>
          );
        })}
      </nav>

      <nav className="p-nav" aria-label="Navigation de l'espace prestataire">
        <Link href="/pro" className="p-brand">
          <span className="p-brand-logo">Merry</span>
          <span className="p-brand-sub">Espace prestataire</span>
          {pro.data.vendor?.name ? <span className="p-brand-vendor">{pro.data.vendor.name}</span> : null}
        </Link>
        <div className="p-nav-main">
          {PRO_NAV.map((n) => {
            const on = (n.exact ? pathname === n.href : n.match.some((m) => pathname === m || pathname.startsWith(m + "/")));
            return (
              <Link key={n.href} href={n.href} className={`d-nav-item${on ? " is-on" : ""}`} aria-current={on ? "page" : undefined}>
                <ProIcon name={n.icon} size={18} />
                {n.label}
                {n.badge && unread ? (
                  <span className="d-nav-badge" aria-label={`${unread} non lues`}>
                    {unread}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </div>
        <div className="p-nav-bottom">
          <Link href="/pro/credits" className="p-credits-pill">
            <CreditsCoins size={16} />
            {credits} crédit{credits > 1 ? "s" : ""}
          </Link>
          <div className="d-help">
            <Link className={`d-help-btn${pathname.startsWith("/pro/compte") ? " is-on" : ""}`} href="/pro/compte">
              <Icon name="settings" size={16} sw={2} />
              <span>Réglages</span>
            </Link>
            <a className="d-help-btn" href={CALENDLY_URL} target="_blank" rel="noopener noreferrer">
              <Icon name="bubble" size={16} sw={2} />
              <span>Aide</span>
            </a>
          </div>
          <CollabTeam />
          <VendorSwitch />
          <button type="button" className="p-outline-pill" onClick={() => setFeature(true)}>
            Proposer une fonctionnalité
          </button>
          <div className="d-nav-links">
            <a href={SITE_URL}>Retour au site</a>
            <button type="button" onClick={pro.signOut}>
              Se déconnecter
            </button>
          </div>
        </div>
      </nav>

      <main className="p-main">
        {pro.mode === "demo" ? (
          <div className="d-demo">
            <span>
              <strong>Mode démo.</strong> <span className="d-desk-only">Données d’exemple, enregistrées seulement dans ce navigateur.</span>
            </span>
            <button type="button" onClick={pro.resetDemo}>
              Remettre à zéro
            </button>
          </div>
        ) : null}
        <div className="p-wrap">{children}</div>
      </main>
      {feature ? <FeatureDialog page={here} onClose={() => setFeature(false)} /> : null}
      {pro.toast ? (
        <div className={`d-toast is-${pro.toast.kind}`} role="status">
          {pro.toast.text}
        </div>
      ) : null}
    </div>
  );
}

// Collaborateurs dans la barre latérale (maquette Compte), sur le modèle de la carte « Organisateurs »
// du tableau de bord des couples (components/dash/Shell.js) : avatars, invitation en attente, bouton d'invitation
// Déjà sur Compte, le lien ne change rien à l'écran : l'événement fait défiler jusqu'à la section
// (et place le curseur dans le formulaire pour « Inviter »). Depuis une autre page, l'ancre s'en charge.
function showCollab(invite) {
  window.dispatchEvent(new CustomEvent("merry:collab", { detail: { invite } }));
}

function CollabTeam() {
  const pro = usePro();
  const members = pro.data.members || [];
  if (!members.length) return null;
  const pending = members.filter((m) => !m.user_id);
  const note = pending.length ? (pending.length > 1 ? `${pending.length} collaborateurs n’ont pas encore rejoint.` : `${memberName(pending[0])} n’a pas encore rejoint.`) : null;
  return (
    <div className="d-team">
      <Link href="/pro/compte#collaborateurs" onClick={() => showCollab(false)} className="d-team-title" style={{ textDecoration: "none", color: "inherit" }}>
        Collaborateurs
      </Link>
      <Link href="/pro/compte#collaborateurs" onClick={() => showCollab(false)} className="d-team-faces" aria-label="Voir les collaborateurs">
        {members.slice(0, 5).map((m, i) => (
          <span key={m.id} style={{ marginLeft: i ? -9 : 0, display: "inline-flex", opacity: m.user_id ? 1 : 0.55 }}>
            <span
              aria-hidden="true"
              style={{
                width: 32,
                height: 32,
                borderRadius: 999,
                background: memberColor(m).mid,
                color: memberColor(m).ink,
                border: "2px solid #ffffff",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "11.5px",
                fontWeight: 700,
              }}
            >
              {memberInitial(m)}
            </span>
          </span>
        ))}
        <span className="d-team-plus" style={{ marginLeft: members.length ? -9 : 0 }}>
          <Icon name="plus" size={14} sw={2} />
        </span>
      </Link>
      {note ? <div className="d-team-note">{note}</div> : null}
      <Link href="/pro/compte#inviter" onClick={() => showCollab(true)} className="d-btn d-btn-primary d-btn-small d-btn-block">
        Inviter un collaborateur
      </Link>
    </div>
  );
}

// Plusieurs fiches sur le même compte : un menu pour passer de l'une à l'autre
function VendorSwitch({ item }) {
  const pro = usePro();
  const list = pro.data.vendors || [];
  if (list.length < 2) return null;
  const current = pro.data.vendor?.id;
  if (item) {
    return list
      .filter((v) => v.id !== current)
      .map((v) => (
        <button key={v.id} type="button" className="d-pop-item" onClick={() => pro.switchVendor(v.id)}>
          Passer à {v.name}
        </button>
      ));
  }
  return (
    <label className="p-vendor-switch">
      <span className="p-sr">Fiche affichée</span>
      <select className="p-input" value={current} onChange={(e) => pro.switchVendor(e.target.value)}>
        {list.map((v) => (
          <option key={v.id} value={v.id}>
            {v.name}
          </option>
        ))}
      </select>
    </label>
  );
}

function AccountMenu({ close }) {
  const pro = usePro();
  return (
    <>
      <VendorSwitch item />
      <a className="d-pop-item" href="/pro?revendiquer=1">
        Ajouter une fiche
      </a>
      <a className="d-pop-item" href={SITE_URL}>
        Retour au site
      </a>
      <button
        type="button"
        className="d-pop-item"
        onClick={() => {
          close();
          pro.signOut();
        }}
      >
        Se déconnecter
      </button>
    </>
  );
}
