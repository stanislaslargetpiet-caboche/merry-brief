"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

/*
 * Langue de l'appli (onboarding, connexion). La landing Squarespace vit sur un
 * autre domaine : rien ne se partage automatiquement, donc le seul moyen fiable
 * de faire suivre la langue depuis le site, c'est un paramètre dans le lien du
 * bouton (?lang=en). Une fois ici, on la garde en cookie + localStorage pour
 * qu'elle tienne sur toutes les pages de l'appli (brief, connexion, puis
 * dashboard plus tard), sans dépendre du lien de retour.
 */

export const LANGS = ["fr", "en"];
export const DEFAULT_LANG = "fr";

const COOKIE_KEY = "merry_lang";
const STORAGE_KEY = "merry-lang";

function readCookie(name) {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp("(?:^|; )" + name + "=([^;]*)"));
  return match ? decodeURIComponent(match[1]) : null;
}

function writeCookie(name, value) {
  if (typeof document === "undefined") return;
  const oneYear = 60 * 60 * 24 * 365;
  document.cookie = `${name}=${value}; path=/; max-age=${oneYear}; samesite=lax`;
}

function normalize(raw) {
  const v = (raw || "").slice(0, 2).toLowerCase();
  return LANGS.includes(v) ? v : null;
}

// Ordre de priorité : ?lang= du lien, puis choix déjà fait sur cet appareil
// (cookie, puis localStorage si le cookie est bloqué), puis langue du
// navigateur, et sinon le français par défaut.
export function detectLang() {
  if (typeof window === "undefined") return DEFAULT_LANG;

  const fromUrl = normalize(new URLSearchParams(window.location.search).get("lang"));
  if (fromUrl) return fromUrl;

  const fromCookie = normalize(readCookie(COOKIE_KEY));
  if (fromCookie) return fromCookie;

  let fromStorage = null;
  try {
    fromStorage = normalize(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    /* stockage indisponible */
  }
  if (fromStorage) return fromStorage;

  const fromBrowser = normalize(navigator.language || navigator.userLanguage);
  return fromBrowser || DEFAULT_LANG;
}

export function persistLang(lang) {
  writeCookie(COOKIE_KEY, lang);
  try {
    window.localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    /* ignore */
  }
  if (typeof document !== "undefined") document.documentElement.lang = lang;
}

const LangContext = createContext({ lang: DEFAULT_LANG, setLang: () => {} });

export function LangProvider({ children }) {
  const [lang, setLangState] = useState(DEFAULT_LANG);

  useEffect(() => {
    const detected = detectLang();
    setLangState(detected);
    persistLang(detected);
  }, []);

  const setLang = (next) => {
    if (!LANGS.includes(next) || next === lang) return;
    setLangState(next);
    persistLang(next);
  };

  const value = useMemo(() => ({ lang, setLang }), [lang]);

  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export function useLang() {
  return useContext(LangContext);
}
