"use client";

// Espace prestataire : cadre commun (maquettes V1 et V1m). Barre latérale lime sur ordinateur ;
// sur téléphone, bandeau lime puis onglets texte qui défilent. Séparé du tableau de bord des couples.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ProProvider, usePro } from "@/lib/pro/store";
import { Popover, PageLoader } from "@/components/dash/ui";
import { ProIcon } from "./icons";
import Claim from "./Claim";
import FeatureDialog from "./FeatureDialog";

export const PRO_NAV = [
  { href: "/pro", label: "Accueil", icon: "home", exact: true },
  { href: "/pro/fiche", label: "Ma fiche", icon: "fiche" },
  { href: "/pro/tarifs", label: "Tarifs", icon: "tarifs" },
  { href: "/pro/disponibilites", label: "Disponibilités", icon: "calendar" },
  { href: "/pro/demandes", label: "Demandes", icon: "demandes" },
  { href: "/pro/clients", label: "Clients", icon: "clients" },
  { href: "/pro/projets", label: "Projets de mariage", icon: "projets" },
  { href: "/pro/credits", label: "Crédits", icon: "credits" },
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
  if (pro.status === "claim") return <Claim />;
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
  const v = pro.data.vendor;
  const cover = pro.data.photos?.[0]?.url;
  const credits = pro.data.pro?.credits ?? 0;
  const here = PRO_NAV.find((n) => (n.exact ? pathname === n.href : pathname.startsWith(n.href)))?.label || "Accueil";
  const navRef = useRef(null);

  useEffect(() => {
    if (!pro.toast) return undefined;
    const t = setTimeout(() => pro.setToast(null), 5000);
    return () => clearTimeout(t);
  }, [pro.toast, pro]);

  // Téléphone : l'onglet de la page reste visible dans la barre qui défile
  useEffect(() => {
    navRef.current?.querySelector('[aria-current="page"]')?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [pathname]);

  const avatar = (size) => <span className="p-face" role="img" aria-label={v.name} style={{ width: size, height: size, backgroundImage: cover ? `url("${cover}")` : undefined }} />;

  return (
    <div className="d-root p-root">
      {/* Téléphone : bandeau lime, puis onglets texte */}
      <header className="p-top">
        <Link href="/pro" className="p-brand is-small">
          <span className="p-brand-logo">Merry</span>
          <span className="p-brand-sub">Espace prestataire</span>
        </Link>
        <span className="p-top-right">
          <Link href="/pro/credits" className="p-credits-pill is-small">
            <ProIcon name="credits" size={15} sw={2} />
            {credits} crédit{credits > 1 ? "s" : ""}
          </Link>
          <span className="d-anchor">
            <button type="button" className="p-top-face" onClick={() => setMenu((o) => !o)} aria-label={`Votre compte, ${v.name}`} aria-expanded={menu}>
              {avatar(36)}
            </button>
            <Popover open={menu} onClose={() => setMenu(false)} align="right">
              <AccountMenu close={() => setMenu(false)} />
            </Popover>
          </span>
        </span>
      </header>
      <nav className="p-tabs" aria-label="Navigation de l'espace prestataire" ref={navRef}>
        {PRO_NAV.map((n) => {
          const on = n.exact ? pathname === n.href : pathname.startsWith(n.href);
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
        </Link>
        <div className="p-nav-main">
          {PRO_NAV.map((n) => {
            const on = n.exact ? pathname === n.href : pathname.startsWith(n.href);
            return (
              <Link key={n.href} href={n.href} className={`d-nav-item${on ? " is-on" : ""}`} aria-current={on ? "page" : undefined}>
                <ProIcon name={n.icon} size={18} />
                {n.label}
              </Link>
            );
          })}
        </div>
        <div className="p-nav-bottom">
          <Link href="/pro/credits" className="p-credits-pill">
            <ProIcon name="credits" size={15} sw={2} />
            {credits} crédit{credits > 1 ? "s" : ""}
          </Link>
          <button type="button" className="p-outline-pill" onClick={() => setFeature(true)}>
            Proposer une fonctionnalité
          </button>
          <span className="d-anchor p-account-wrap">
            <button type="button" className="p-account" onClick={() => setMenu((o) => !o)} aria-expanded={menu}>
              {avatar(36)}
              <span className="p-account-text">
                <span className="p-account-name">{v.name}</span>
                <span className="p-account-sub">Votre compte</span>
              </span>
            </button>
            <Popover open={menu} onClose={() => setMenu(false)} className="p-account-pop">
              <AccountMenu close={() => setMenu(false)} />
            </Popover>
          </span>
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
        <div className="p-wrap">
          {children}
          <button type="button" className="p-outline-pill p-phone-only p-feature-phone" onClick={() => setFeature(true)}>
            Proposer une fonctionnalité
          </button>
        </div>
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

function AccountMenu({ close }) {
  const pro = usePro();
  return (
    <>
      <Link className="d-pop-item" href="/pro/fiche" onClick={close}>
        Ma fiche
      </Link>
      <span className="d-pop-item p-pop-mail">{pro.data.user?.email}</span>
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
