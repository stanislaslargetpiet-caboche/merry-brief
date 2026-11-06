"use client";

// Navigation du pilotage : barre latérale citron (cinq boutons) et sous-pages en pilules, comme l'espace prestataire.
// Le changement de page passe par l'historique du navigateur, sans recharger : les données lues restent en mémoire.

import { useEffect, useRef } from "react";
import { Icon } from "@/components/dash/icons";
import { PILOTAGE_NAV, pilotagePath } from "@/lib/pilotage/nav";

function useGo() {
  return (event, href) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
    event.preventDefault();
    window.history.pushState(null, "", href);
    window.scrollTo(0, 0);
  };
}

export function PilotSide({ group, search, badges }) {
  const go = useGo();
  const nav = useRef(null);

  // Sur téléphone la barre défile en largeur : le bouton en cours reste visible
  useEffect(() => {
    const el = nav.current;
    const on = el?.querySelector(".is-on");
    if (on && el.scrollWidth > el.clientWidth) el.scrollLeft = on.offsetLeft - (el.clientWidth - on.offsetWidth) / 2;
  }, [group.id]);

  return (
    <aside className="pl-side">
      <a className="pl-logo" href="/dashboard">
        Merry
      </a>
      <nav ref={nav} className="pl-nav" aria-label="Pilotage">
        {PILOTAGE_NAV.map((g) => {
          const on = g.id === group.id;
          const href = `${pilotagePath(g.id, g.pages[0].id)}${search}`;
          const badge = g.pages.reduce((n, p) => n + (badges[p.id] || 0), 0);
          return (
            <a key={g.id} href={href} className={`pl-nav-item${on ? " is-on" : ""}`} aria-current={on ? "true" : undefined} onClick={(e) => go(e, href)}>
              <Icon name={g.icon} size={20} />
              {g.label}
              {badge ? <span className="pl-nav-badge">{badge}</span> : null}
            </a>
          );
        })}
      </nav>
    </aside>
  );
}

export function PilotSubnav({ group, page, search, badges }) {
  const go = useGo();
  return (
    <nav className="pl-subnav" aria-label={`Pages de ${group.label}`}>
      {group.pages.map((p) => {
        const on = p.id === page.id;
        const href = `${pilotagePath(group.id, p.id)}${search}`;
        return (
          <a key={p.id} href={href} className={`pl-pill-link${on ? " is-active" : ""}`} aria-current={on ? "page" : undefined} onClick={(e) => go(e, href)}>
            {p.label}
            {badges[p.id] ? <span className="pl-subnav-badge">{badges[p.id]}</span> : null}
          </a>
        );
      })}
    </nav>
  );
}
