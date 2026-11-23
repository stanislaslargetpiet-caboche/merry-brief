"use client";

// Carte « Merry est sur l'App Store. » au-dessus de la liste d'invités (canvas « 11 - Application iOS »,
// App Store 6). Seulement sur iPhone, dans un navigateur : jamais dans l'appli elle-même, qui charge ces mêmes
// pages (Capacitor pose window.Capacitor). Fermée, elle ne revient pas sur cet appareil.

import { useEffect, useState } from "react";
import { APP_STORE_URL, showAppCard } from "@/lib/appStore";
import { trackEvent } from "@/lib/analytics";
import { Icon } from "./icons";

const KEY = "merry-app-store-carte";

function closedHere() {
  try {
    return window.localStorage.getItem(KEY) === "fermee";
  } catch {
    return false;
  }
}

export default function AppStoreCard() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setShow(showAppCard(navigator.userAgent, !!window.Capacitor, closedHere())), 0);
    return () => clearTimeout(timer);
  }, []);
  if (!show) return null;
  const close = () => {
    setShow(false);
    try {
      window.localStorage.setItem(KEY, "fermee");
    } catch {
      // Stockage refusé (navigation privée) : la carte reviendra à la prochaine visite
    }
    trackEvent("app_store_carte", { action: "fermer" });
  };
  return (
    <div className="d-appcard" role="region" aria-label="Merry sur l'App Store">
      <span className="d-appcard-ic" aria-hidden="true">
        Merry
      </span>
      <b>Merry est sur l'App Store.</b>
      <a className="d-appcard-go" href={APP_STORE_URL} onClick={() => trackEvent("app_store_carte", { action: "telecharger" })}>
        Télécharger
      </a>
      <button type="button" className="d-appcard-x" onClick={close} aria-label="Fermer">
        <Icon name="x" size={14} sw={2.4} />
      </button>
    </div>
  );
}
