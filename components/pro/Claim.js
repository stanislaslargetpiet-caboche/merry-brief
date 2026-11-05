"use client";

// Revendiquer sa fiche (maquettes V0-Rev1 à V0-Rev4) : retrouver son établissement dans le catalogue
// Merry, confirmer que c'est bien le sien, puis prouver que c'est bien soi avec un code reçu à l'adresse
// mail de la fiche. Sert aussi de connexion : un prestataire qui revient refait ces étapes et retrouve
// son espace.
// Créer sa fiche (maquettes V0-Onb1 à V0-Onb4) : l'établissement n'est pas dans le catalogue, un écran par
// groupe d'informations (nom et activité, adresse, contact), puis le code reçu à cette adresse crée la
// fiche. Chaque étape a sa propre barre de progression, conforme au canvas du 3 nov. 2026 (avant cette
// date, ces deux parcours tenaient sur un seul écran fusionné ; Stan a demandé de les refaire pas à pas).
// Se connecter : un prestataire qui revient tape son adresse mail, reçoit un code, et retrouve ses fiches
// (hors canvas, parcours à part, sans barre de progression, inchangé).
// /pro?fiche=<id> (lien d'un mail « un couple vous a écrit ») ouvre directement l'écran de confirmation ;
// /pro?etablissement=<nom> (recherche du site vitrine) préremplit la recherche.
// /pro?invitation=<jeton> (lien envoyé à un collaborateur) : rejoindre l'équipe de la fiche, connecté ou
// avec un code reçu à l'adresse invitée (app/api/pro/invitation). Avant le 3 nov. 2026 ce lien menait à
// l'inscription des couples.
// Audit du 3 nov. 2026 : un seul titre par étape (la question), plus de phrase d'aide qui la répète, plus
// de « Corriger une information » ni de légende sous Bienvenue, et Préparation n'annonce que ce qui est vrai.
//
// Entrée (canvas Vendor-Entree, 4 nov. 2026) : « Me connecter » (mail et mot de passe) ou « Retrouver ma
// fiche ». Le mot de passe se choisit à la création et à la revendication ; le code reste la preuve d'accès
// à l'adresse. Revendication : le code part toujours à l'adresse de la fiche, jamais à une adresse tapée
// (Rev2 en demande une sur le canvas) : ce serait ouvrir n'importe quelle fiche à n'importe qui.
// Compte sans mot de passe : code, puis mot de passe, puis Préparation et Bienvenue, une seule fois.
// Le SIRET (facultatif) n'apparaît plus non plus dans Votre compte, le canvas ne le montre plus : le champ
// reste accepté par l'API si jamais réintroduit.

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { usePro } from "@/lib/pro/store";
import { completeness } from "@/lib/pro/format";
import { Pills } from "./ui";
import { ProIcon } from "./icons";
import Preparation from "./Preparation";
import Welcome from "./Welcome";

const CONTACT = "bonjour@withmerry.com";

// Les catégories du catalogue (catalog.categories)
const CATEGORIES = [
  ["lieu", "Lieu de réception"],
  ["photographe", "Photographe"],
  ["videaste", "Vidéaste"],
  ["traiteur", "Traiteur"],
  ["dj", "DJ et animation"],
  ["musiciens", "Musiciens et groupes"],
  ["fleuriste", "Fleuriste"],
  ["decoration", "Décoration et location"],
  ["wedding_planner", "Wedding planner"],
  ["patisserie", "Pâtissier et wedding cake"],
  ["beaute", "Coiffure et maquillage"],
  ["robe", "Robes et costumes"],
  ["transport", "Transport"],
  ["officiant", "Officiant de cérémonie"],
  ["autre", "Autre"],
];
const EMPTY_FORM = { name: "", category: "", address: "", postal_code: "", city: "", email: "", phone: "", siret: "", password: "" };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// L'écran en cours et les champs saisis survivent à un rechargement, une heure au plus (sessionStorage)
const SAVED_KEY = "merry-pro-claim-v1";
const SAVED_MAX_AGE = 60 * 60 * 1000;
function readSaved() {
  try {
    const raw = window.sessionStorage.getItem(SAVED_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    return s && s.at && Date.now() - s.at < SAVED_MAX_AGE ? s : null;
  } catch {
    return null;
  }
}
function writeSaved(s) {
  try {
    window.sessionStorage.setItem(SAVED_KEY, JSON.stringify({ ...s, at: Date.now() }));
  } catch {
    /* ignore */
  }
}
function clearSaved() {
  try {
    window.sessionStorage.removeItem(SAVED_KEY);
  } catch {
    /* ignore */
  }
}

// Force d'un mot de passe, de 0 (trop court) à 4 : longueur, chiffres et lettres, casse, autre caractère
const STRENGTH = ["Trop court", "Faible", "Moyen", "Bon", "Fort"];
function strength(pw) {
  if (pw.length < 8) return 0;
  let s = 1;
  if (pw.length >= 12) s += 1;
  if (/\d/.test(pw) && /[a-zA-Z]/.test(pw)) s += 1;
  if ((/[a-z]/.test(pw) && /[A-Z]/.test(pw)) || /[^a-zA-Z0-9]/.test(pw)) s += 1;
  return Math.min(4, s);
}
function PasswordMeter({ value }) {
  if (!value) return null;
  const s = strength(value);
  return (
    <span className={`p-pw-meter is-${s}`} aria-live="polite">
      <span className="p-pw-bars" aria-hidden="true">
        {[1, 2, 3, 4].map((i) => (
          <span key={i} className={i <= s ? "is-on" : ""} />
        ))}
      </span>
      <span className="p-pw-label">{STRENGTH[s]}</span>
    </span>
  );
}
const PASSWORD_HINT = "Le mot de passe compte au moins 8 caractères.";
const sameName = (a, b) => {
  const norm = (s) => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  return norm(a) === norm(b);
};

const CREATE_FLOW = ["name", "address", "contact", "code"];
const CLAIM_FLOW = ["search", "confirm", "code"];
const LOGIN_FLOW = ["login-email", "login-code"];
const INVITE_FLOW = ["invite", "invite-code"];

// Ce qui manque au formulaire « Créer votre fiche », dans l'ordre des écrans
function formProblem(f) {
  if (f.name.trim().length < 2) return "Indiquez le nom de votre établissement.";
  if (!f.address.trim()) return "Indiquez l’adresse de votre établissement.";
  if (!/^\d{5}$/.test(f.postal_code.replace(/\s/g, ""))) return "Le code postal compte 5 chiffres.";
  if (!f.city.trim()) return "Indiquez la ville.";
  if (!EMAIL_RE.test(f.email.trim())) return "Indiquez une adresse mail valide : le code y sera envoyé.";
  if (f.siret.trim() && !/^\d{14}$/.test(f.siret.replace(/\s/g, ""))) return "Le SIRET compte 14 chiffres. Vous pouvez aussi le laisser vide.";
  return "";
}

// Le jeton du compte déjà connecté accompagne la vérification : la fiche rejoint ce compte au lieu de
// basculer sur celui de l'adresse qui a reçu le code
async function call(body, path = "/api/pro/claim", token = null) {
  try {
    const headers = { "Content-Type": "application/json" };
    if (token) headers.authorization = `Bearer ${token}`;
    else if (supabase && /verify$|^accept$/.test(body.action || "")) {
      const { data } = await supabase.auth.getSession();
      if (data?.session?.access_token) headers.authorization = `Bearer ${data.session.access_token}`;
    }
    const res = await fetch(path, { method: "POST", headers, body: JSON.stringify(body) });
    const json = await res.json().catch(() => ({}));
    return { status: res.status, ...json };
  } catch {
    return { status: 0, error: "network" };
  }
}

// Recherche : par le serveur (photos signées), sinon directement dans la base (sans photo)
async function search(q) {
  const res = await call({ action: "search", q });
  if (res.results) return { results: res.results };
  if (res.error === "setup") return { setup: true, results: [] };
  if (!supabase) return { results: [] };
  const { data, error } = await supabase.rpc("pro_search", { q });
  if (error) return { setup: /PGRST202|Could not find/i.test(error.message), results: [] };
  return { results: (data || []).map((r) => ({ ...r, photo: null })) };
}

const ERRORS = {
  not_configured: "La vérification n’est pas encore branchée sur ce site (clé du serveur manquante). Écrivez-nous et nous l’activons pour vous.",
  no_email: "Nous n’avons pas d’adresse mail pour cette fiche. Écrivez-nous depuis l’adresse de votre établissement : nous vous ouvrons l’accès.",
  wait: "Un code vient déjà de partir. Attendez une minute avant d’en demander un autre.",
  send_failed: "Le code n’a pas pu partir. Réessayez dans un instant.",
  bad_code: "Ce code ne correspond pas, ou il a expiré. Vérifiez-le, ou demandez-en un nouveau.",
  setup: "L’espace prestataire n’est pas encore installé sur la base de données (supabase/espace-prestataire.sql).",
  link_failed: "Le code est bon, mais la fiche n’a pas pu être rattachée à votre compte. Réessayez.",
  no_account: "Aucun compte Merry à cette adresse. Retrouvez votre fiche par son nom, ou créez-la : le code arrive à l’adresse de la fiche.",
  bad_password: PASSWORD_HINT,
  password_failed: "Le mot de passe n’a pas pu être enregistré. Réessayez dans un instant.",
  not_found: "Cette fiche n’existe plus, ou n’est pas encore publiée. Retrouvez votre établissement par son nom.",
  address: "Nous ne trouvons pas cette adresse. Vérifiez le code postal et la ville, puis validez de nouveau le code.",
  create_failed: "Le code est bon, mais la fiche n’a pas pu être créée. Réessayez dans un instant.",
  network: "La connexion a échoué. Vérifiez votre réseau, puis réessayez.",
  bad_link: "Ce lien d’invitation n’est plus valable. Demandez-en un nouveau à la personne qui vous a invité.",
  already_member: "Vous faites déjà partie de cette équipe. Ce lien est réservé à la personne invitée : il reste valable pour elle.",
};

export default function Claim() {
  const pro = usePro();
  const [screen, setScreen] = useState("entry");
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [setupMissing, setSetupMissing] = useState(false);
  const [picked, setPicked] = useState(null);
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState(false);
  const [invite, setInvite] = useState(null); // { token, vendor_name, email_hint } : lien d'invitation
  const [invitePassword, setInvitePassword] = useState("");
  const [invitePassword2, setInvitePassword2] = useState("");
  const [preparing, setPreparing] = useState(null); // "create" | "claim", une fois le code validé
  const [welcome, setWelcome] = useState(null); // "create" | "claim", une fois la préparation terminée
  const [fill, setFill] = useState(null); // complétude de la fiche, pour Bienvenue
  const fromPop = useRef(false);
  const firstScreen = useRef(true);
  const [logging, setLogging] = useState(false); // « J'ai déjà un compte » : adresse mail puis code
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginFailed, setLoginFailed] = useState(false);
  const [claimPassword, setClaimPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPassword2, setNewPassword2] = useState("");
  const [firstLogin, setFirstLogin] = useState(false);
  const [duplicate, setDuplicate] = useState(null);
  const [notice, setNotice] = useState(""); // un mot au-dessus de la recherche (connecté sans fiche, lien périmé…)
  const [form, setForm] = useState(() => ({ ...EMPTY_FORM, email: pro.data?.user?.email || "" }));
  const boxes = useRef([]);
  const screenRef = useRef(null);
  const [resendAt, setResendAt] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const demo = pro.mode === "demo";
  const signedIn = Boolean(pro.data?.user?.email);
  const myFiches = pro.data?.vendors || []; // connecté à un espace, venu chercher une autre fiche

  // Arrivée par un lien : la fiche s'ouvre directement sur l'écran de confirmation ; ou le nom du site est repris
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fiche = params.get("fiche");
    const name = params.get("etablissement");
    const forced = signedIn || (name && name.trim()) || fiche || params.get("invitation") || params.get("connexion") === "1";
    // Rechargement en plein parcours : on reprend là où on en était, sauf si l'adresse impose un écran
    const saved = forced ? null : readSaved();
    if (saved && saved.screen && saved.screen !== "entry") {
      setCreating(!!saved.creating);
      setLogging(!!saved.logging);
      setForm((f) => ({ ...f, ...(saved.form || {}), password: "" }));
      setQ(saved.q || "");
      setPicked(saved.picked || null);
      setDuplicate(saved.duplicate || null);
      setLoginEmail(saved.loginEmail || "");
      setFirstLogin(!!saved.firstLogin);
      setSent(!!saved.sent);
      setScreen(saved.screen);
    }
    if (name && name.trim()) setQ(name.trim().slice(0, 120));
    if (signedIn || (name && name.trim()) || fiche || params.get("invitation")) setScreen("search");
    // « Connexion » du site : l'adresse mail puis le code, sans passer par la recherche
    if (params.get("connexion") === "1" && !signedIn) startLogin();
    let live = true;
    const token = params.get("invitation");
    if (token) {
      if (demo) {
        setInvite({ token, vendor_name: "Domaine des Oliviers", email_hint: "c•••@exemple.fr" });
        setScreen("invite");
        return undefined;
      }
      (async () => {
        const { data: s } = supabase ? await supabase.auth.getSession() : { data: null };
        const res = await call({ action: "info", token }, "/api/pro/invitation", s?.session?.access_token);
        if (!live) return;
        if (res.vendor_name) {
          setInvite({ token, vendor_name: res.vendor_name, email_hint: res.email_hint, already: !!res.already_member });
          setScreen("invite");
        } else setNotice(ERRORS[res.error] || ERRORS.bad_link);
      })();
      return () => {
        live = false;
      };
    }
    // ?fiche=…&connexion=1 : un collaborateur se connecte avec son adresse, pas celle de la fiche
    if (!fiche || demo || (params.get("connexion") === "1" && !signedIn)) return undefined;
    (async () => {
      const res = await call({ action: "lookup", vendorId: fiche });
      if (!live) return;
      if (res.result) choose(res.result);
      else setNotice(ERRORS[res.error] || ERRORS.not_found);
    })();
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (invite) return;
    writeSaved({ screen, creating, logging, form: { ...form, password: "" }, q, picked, duplicate, loginEmail, firstLogin, sent });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, creating, logging, form, q, picked, duplicate, loginEmail, firstLogin, sent]);

  // Le bouton retour du navigateur revient à l'écran précédent au lieu de quitter /pro
  useEffect(() => {
    if (firstScreen.current) {
      firstScreen.current = false;
      window.history.replaceState({ claimScreen: screen }, "");
      return;
    }
    if (fromPop.current) {
      fromPop.current = false;
      return;
    }
    window.history.pushState({ claimScreen: screen }, "");
  }, [screen]);
  useEffect(() => {
    const onPop = (e) => {
      if (!e.state?.claimScreen) return;
      fromPop.current = true;
      setError("");
      setScreen(e.state.claimScreen);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  // Complétude de la fiche, pour la barre de Bienvenue (la session est déjà posée)
  async function loadFill(vid) {
    if (demo || !vid || !supabase) {
      setFill(demo ? 40 : null);
      return;
    }
    try {
      const [fiche, photos, formulas] = await Promise.all([
        supabase.rpc("pro_fiche", { v: vid }),
        supabase.rpc("pro_photos", { v: vid }),
        supabase.from("pro_formulas").select("price_low, price_high").eq("vendor_id", vid),
      ]);
      const vendor = (fiche.data || [])[0];
      if (!vendor) return;
      setFill(completeness({ vendor: { ...vendor, details: vendor.details || {} }, photos: photos.data || [], formulas: formulas.data || [] }).pct);
    } catch {
      setFill(null);
    }
  }

  // Connecté, mais aucune fiche rattachée à ce compte : on le dit au-dessus de la recherche
  useEffect(() => {
    if (signedIn && !myFiches.length && !logging && !creating && !notice) setNotice(`Connecté avec ${pro.data.user.email}, mais aucune fiche n’est encore rattachée à ce compte. Retrouvez votre établissement ci-dessous, ou créez sa fiche.`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signedIn]);

  // Recherche au fil de la frappe
  useEffect(() => {
    const t = q.trim();
    if (t.length < 3) {
      setResults([]);
      return undefined;
    }
    let live = true;
    setSearching(true);
    const timer = setTimeout(async () => {
      const r = await search(t);
      if (!live) return;
      setResults(r.results);
      setSetupMissing(!!r.setup);
      setSearching(false);
    }, 300);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [q]);

  // Renvoie true si le code est parti (ou en démo) : sert à passer à l'écran suivant seulement si besoin
  async function sendCode(target = picked) {
    setError("");
    if (!target?.email_hint) {
      setError(ERRORS.no_email);
      return false;
    }
    // Démo : aucun code ne part, n'importe quels 6 chiffres ouvrent l'espace de démonstration
    if (demo) {
      setSent(true);
      armResend();
      setTimeout(() => boxes.current[0]?.focus(), 50);
      return true;
    }
    setBusy(true);
    const res = await call({ action: "send", vendorId: target.id });
    setBusy(false);
    if (res.ok) {
      setSent(true);
      armResend();
      setCode(["", "", "", "", "", ""]);
      setTimeout(() => boxes.current[0]?.focus(), 50);
      return true;
    }
    setError(ERRORS[res.error] || ERRORS.send_failed);
    return false;
  }

  // Un résultat choisi, ou l'arrivée par lien : toujours l'écran de confirmation d'abord, le code ne part
  // que sur un clic explicite (un lien reçu ou forgé ne doit pas envoyer un mail à lui seul)
  function choose(found) {
    const r = demo && !found.email_hint ? { ...found, email_hint: "c•••@exemple.fr" } : found;
    setPicked(r);
    setCreating(false);
    setScreen(r.claimed && !signedIn ? "managed" : "confirm");
    setSent(false);
    setError("");
  }

  async function confirmAndSend() {
    if (!signedIn && claimPassword.length < 8) {
      setError(PASSWORD_HINT);
      return;
    }
    if (await sendCode()) setScreen("code");
  }

  function startCreate() {
    setCreating(true);
    setScreen("name");
    setError("");
    setSent(false);
    if (q.trim().length >= 3 && !/^\d[\d\s]*$/.test(q) && !form.name) setForm((f) => ({ ...f, name: q.trim() }));
  }

  function backToSearch() {
    setCreating(false);
    setLogging(false);
    setInvite(null);
    setScreen("search");
    setSent(false);
    setError("");
  }

  function startLogin() {
    setLogging(true);
    setCreating(false);
    setLoginFailed(false);
    setScreen("login-email");
    setSent(false);
    setError("");
    setNotice("");
  }

  function backToEntry() {
    backToSearch();
    setScreen("entry");
  }

  // Après la connexion, l'espace se recharge ; si l'écran reste là, ce compte n'a pas encore de fiche
  async function afterLogin() {
    clearSaved();
    await pro.reload();
    setBusy(false);
    setLogging(false);
    setScreen("search");
    setSent(false);
    setNotice(`Connecté avec ${loginEmail.trim()}, mais aucune fiche n’est encore rattachée à ce compte. Retrouvez votre établissement ci-dessous, ou créez sa fiche.`);
  }

  async function signIn() {
    const mail = loginEmail.trim();
    if (!EMAIL_RE.test(mail) || !loginPassword) {
      setError("Indiquez votre adresse mail et votre mot de passe.");
      return;
    }
    setError("");
    setLoginFailed(false);
    if (demo) {
      window.location.assign("/pro?demo=1");
      return;
    }
    setBusy(true);
    const { error: failure } = await supabase.auth.signInWithPassword({ email: mail, password: loginPassword });
    if (failure) {
      setBusy(false);
      setLoginFailed(true);
      setError(/invalid/i.test(failure.message) ? "Adresse ou mot de passe incorrect." : ERRORS.network);
      return;
    }
    await afterLogin();
  }

  async function savePassword() {
    if (newPassword.length < 8) {
      setError(PASSWORD_HINT);
      return;
    }
    if (newPassword !== newPassword2) {
      setError("Les deux mots de passe ne sont pas identiques.");
      return;
    }
    setError("");
    setBusy(true);
    if (!demo) {
      const { data: s } = await supabase.auth.getSession();
      const res = await call({ action: "password_set", password: newPassword }, undefined, s?.session?.access_token);
      if (!res.ok) {
        setBusy(false);
        setError(ERRORS[res.error] || ERRORS.password_failed);
        return;
      }
    }
    if (firstLogin && picked) {
      await loadFill(picked.id);
      setBusy(false);
      setPreparing("claim");
      return;
    }
    clearSaved();
    if (demo) {
      window.location.assign("/pro?demo=1");
      return;
    }
    pro.setHold(false);
    await afterLogin();
  }

  function backTo(target) {
    return () => {
      setError("");
      setScreen(target);
    };
  }

  async function sendLoginCode() {
    const mail = loginEmail.trim();
    if (!EMAIL_RE.test(mail)) {
      setError("Indiquez l’adresse mail de votre compte Merry.");
      return;
    }
    setError("");
    setLoginFailed(false);
    if (demo) {
      setScreen("login-code");
      setSent(true);
      armResend();
      setTimeout(() => boxes.current[0]?.focus(), 50);
      return;
    }
    setBusy(true);
    const res = await call({ action: "login_send", email: mail });
    setBusy(false);
    if (!res.ok) {
      setError(ERRORS[res.error] || ERRORS.send_failed);
      return;
    }
    setScreen("login-code");
    setSent(true);
      armResend();
    setCode(["", "", "", "", "", ""]);
    setTimeout(() => boxes.current[0]?.focus(), 50);
  }

  // Invitation : déjà connecté, le compte rejoint l'équipe tout de suite ; sinon un code part à l'adresse invitée
  async function joinTeam() {
    setError("");
    if (!signedIn && screen === "invite") {
      if (invitePassword.length < 8) {
        setError(PASSWORD_HINT);
        return;
      }
      if (invitePassword !== invitePassword2) {
        setError("Les deux mots de passe ne sont pas identiques.");
        return;
      }
    }
    if (demo) {
      if (!signedIn && screen === "invite") {
        setScreen("invite-code");
        setSent(true);
        armResend();
        return;
      }
      window.location.assign("/pro?demo=1");
      return;
    }
    setBusy(true);
    if (signedIn) {
      const res = await call({ action: "accept", token: invite.token }, "/api/pro/invitation");
      if (!res.ok) {
        setBusy(false);
        setError(ERRORS[res.error] || ERRORS.link_failed);
        return;
      }
      pro.rememberVendor(res.vendorId);
      window.location.assign("/pro");
      return;
    }
    const res = await call({ action: "send", token: invite.token }, "/api/pro/invitation");
    setBusy(false);
    if (!res.ok) {
      setError(ERRORS[res.error] || ERRORS.send_failed);
      return;
    }
    setScreen("invite-code");
    setSent(true);
      armResend();
    setCode(["", "", "", "", "", ""]);
    setTimeout(() => boxes.current[0]?.focus(), 50);
  }

  const field = (key) => ({ value: form[key], onChange: (e) => setForm((f) => ({ ...f, [key]: e.target.value })) });
  const onEnter = (fn) => (e) => {
    if (e.key === "Enter") fn();
  };

  // Chaque écran place le focus sur son premier champ ou son premier bouton
  useEffect(() => {
    const root = screenRef.current;
    if (!root || root.contains(document.activeElement)) return;
    root.querySelector("input:not([type=hidden]), button:not(:disabled)")?.focus({ preventScroll: true });
  }, [screen]);

  // « Renvoyer le code » attend la minute que le serveur impose (throttled, app/api/pro/claim)
  useEffect(() => {
    if (!resendAt) return undefined;
    const t = setInterval(() => {
      setNow(Date.now());
      if (Date.now() >= resendAt) clearInterval(t);
    }, 1000);
    return () => clearInterval(t);
  }, [resendAt]);
  const resendIn = Math.max(0, Math.ceil((resendAt - now) / 1000));
  function armResend() {
    const t = Date.now();
    setNow(t);
    setResendAt(t + 60000);
  }
  const formFields = () => ({ ...form, email: undefined, password: undefined });

  async function nextFromName() {
    if (form.name.trim().length < 2) {
      setError("Indiquez le nom de votre établissement.");
      return;
    }
    if (!form.category) {
      setError("Choisissez votre activité.");
      return;
    }
    setError("");
    if (!demo) {
      setBusy(true);
      const found = await search(form.name.trim());
      setBusy(false);
      const twin = (found.results || []).find((r) => sameName(r.name, form.name));
      if (twin) {
        setDuplicate(twin);
        setScreen("duplicate");
        return;
      }
    }
    setScreen("address");
  }

  function nextFromAddress() {
    if (!form.address.trim()) {
      setError("Indiquez l’adresse de votre établissement.");
      return;
    }
    if (!/^\d{5}$/.test(form.postal_code.replace(/\s/g, ""))) {
      setError("Le code postal compte 5 chiffres.");
      return;
    }
    if (!form.city.trim()) {
      setError("Indiquez la ville.");
      return;
    }
    setError("");
    setScreen("contact");
  }

  async function sendCreateCode() {
    const problem = formProblem(form) || (!signedIn && form.password.length < 8 ? PASSWORD_HINT : "");
    if (problem) {
      setError(problem);
      return;
    }
    setError("");
    if (demo) {
      setScreen("code");
      setSent(true);
      armResend();
      return;
    }
    setBusy(true);
    const res = await call({ action: "create_send", email: form.email.trim(), fields: formFields() });
    setBusy(false);
    if (!res.ok) {
      setError(ERRORS[res.error] || ERRORS.send_failed);
      return;
    }
    setScreen("code");
    setSent(true);
      armResend();
    setCode(["", "", "", "", "", ""]);
    setTimeout(() => boxes.current[0]?.focus(), 50);
  }

  async function validate() {
    const c = code.join("");
    if (c.length < 6) {
      setError("Entrez les 6 chiffres du code.");
      return;
    }
    setBusy(true);
    setError("");
    if (invite) {
      const res = demo ? { ok: true } : await call({ action: "verify", token: invite.token, code: c, password: invitePassword }, "/api/pro/invitation");
      if (!res.ok) {
        setBusy(false);
        setError(ERRORS[res.error] || ERRORS.bad_code);
        return;
      }
      if (demo) {
        window.location.assign("/pro?demo=1");
        return;
      }
      pro.rememberVendor(res.vendorId);
      if (res.session && supabase) await supabase.auth.setSession(res.session);
      clearSaved();
      window.location.assign("/pro");
      return;
    }
    if (demo) {
      // La connexion (pas de fiche précise à préparer) garde le passage direct
      if (logging) {
        setFirstLogin(true);
        setPicked({ id: "demo", name: "Domaine des Oliviers", category: "Lieu de réception", city: "Lourmarin" });
        setBusy(false);
        setScreen("password");
        return;
      }
      setFill(40);
      setPreparing(creating ? "create" : "claim");
      return;
    }
    const res = creating
      ? await call({ action: "create_verify", email: form.email.trim(), code: c, fields: formFields(), password: signedIn ? undefined : form.password })
      : logging
        ? await call({ action: "login_verify", email: loginEmail.trim(), code: c })
        : await call({ action: "verify", vendorId: picked.id, code: c, password: signedIn ? undefined : claimPassword });
    if (!res.ok) {
      setBusy(false);
      setError(ERRORS[res.error] || ERRORS.bad_code);
      return;
    }
    // La session est posée tout de suite : un rechargement pendant Préparation ou Bienvenue mène au
    // dashboard au lieu de perdre le code. setHold empêche l'espace de se recharger sous les animations.
    pro.setHold(true);
    if (res.session && supabase) await supabase.auth.setSession(res.session);
    if (!logging) {
      const vid = res.vendorId || picked?.id;
      if (vid) pro.rememberVendor(vid);
      await loadFill(vid);
      setPreparing(creating ? "create" : "claim");
      return;
    }
    setFirstLogin(!!res.firstTime);
    if (res.vendor) {
      setPicked(res.vendor);
      pro.rememberVendor(res.vendor.id);
    }
    setBusy(false);
    setScreen("password");
  }

  function typeDigit(i, raw) {
    const digits = raw.replace(/\D/g, "");
    if (digits.length > 1) {
      // Code collé d'un coup
      const next = [...code];
      digits
        .slice(0, 6 - i)
        .split("")
        .forEach((d, k) => (next[i + k] = d));
      setCode(next);
      boxes.current[Math.min(5, i + digits.length)]?.focus();
      return;
    }
    const next = [...code];
    next[i] = digits;
    setCode(next);
    if (digits && i < 5) boxes.current[i + 1]?.focus();
  }

  const codeBlock = (label, resend) => (
    <div className="p-claim-code">
      <span id="code-label">{label}</span>
      <span className="p-claim-code-hint">Il arrive en moins d’une minute, parfois dans les indésirables.</span>
      <div role="group" aria-labelledby="code-label" className="p-claim-digits">
        {code.map((d, i) => (
          <input
            key={i}
            ref={(el) => (boxes.current[i] = el)}
            type="text"
            inputMode="numeric"
            autoComplete={i === 0 ? "one-time-code" : "off"}
            maxLength={i === 0 ? 6 : 1}
            value={d}
            aria-label={`Chiffre ${i + 1} sur 6`}
            onChange={(e) => typeDigit(i, e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Backspace" && !code[i] && i > 0) boxes.current[i - 1]?.focus();
              if (e.key === "Enter") validate();
            }}
          />
        ))}
      </div>
      <button type="button" className="p-claim-resend" onClick={resend} disabled={busy || resendIn > 0}>
        {resendIn > 0 ? `Renvoyer le code dans ${resendIn} s` : sent ? "Renvoyer le code" : "Envoyer le code"}
      </button>
    </div>
  );
  const errorBox = error ? (
    <p className="p-claim-error" role="alert">
      {error}{" "}
      {/Écrivez-nous/.test(error) ? <a href={`mailto:${CONTACT}?subject=Accès à ma fiche Merry${picked ? ` : ${picked.name}` : ""}`}>{CONTACT}</a> : null}
    </p>
  ) : null;
  const categoryLabel = CATEGORIES.find(([slug]) => slug === form.category)?.[1];

  function finishPreparing() {
    setWelcome(preparing);
    setPreparing(null);
  }

  function goTo(path) {
    clearSaved();
    window.location.assign(demo ? `${path}?demo=1` : path);
  }

  if (preparing === "create") {
    return (
      <Preparation
        steps={[
          { label: "Fiche créée", detail: [form.name.trim(), categoryLabel, form.city.trim()].filter(Boolean).join(" · ") },
          { label: "Adresse placée sur la carte", detail: [form.address.trim(), form.postal_code.trim(), form.city.trim()].filter(Boolean).join(" ") },
          { label: "Tableau de bord prêt", detail: "100 crédits offerts" },
        ]}
        lines={["On enregistre votre fiche…", "On la place sur la carte…", "On prépare votre tableau de bord…"]}
        onDone={finishPreparing}
      />
    );
  }
  if (preparing === "claim") {
    const found = [picked.website, picked.rating ? `${String(picked.rating).replace(".", ",")} sur Google` : null, picked.photo ? "photos" : null].filter(Boolean);
    return (
      <Preparation
        steps={[
          { label: "Fiche retrouvée", detail: [picked.name, picked.category, picked.city].filter(Boolean).join(" · ") },
          found.length ? { label: "Informations publiques récupérées", detail: found.join(" · ") } : { label: "Fiche rattachée à votre compte", detail: picked.category || "" },
          { label: "Tableau de bord prêt", detail: firstLogin ? "Mot de passe enregistré" : "100 crédits offerts" },
        ]}
        lines={["On retrouve votre fiche…", "On récupère ses informations…", "On prépare votre tableau de bord…"]}
        onDone={finishPreparing}
      />
    );
  }
  if (welcome === "create") {
    return <Welcome name={form.name.trim()} fill={fill} primary={{ label: "Accéder à mon dashboard", onClick: () => goTo("/pro") }} />;
  }
  if (welcome === "claim") {
    return <Welcome name={picked.name} fill={fill} primary={{ label: "Compléter ma fiche", onClick: () => goTo("/pro/fiche") }} secondary={{ label: "Accéder au dashboard", onClick: () => goTo("/pro") }} />;
  }

  const flow = invite ? INVITE_FLOW : logging ? LOGIN_FLOW : creating ? CREATE_FLOW : CLAIM_FLOW;
  const stepIndex = Math.max(0, flow.indexOf(screen));
  const stepTotal = flow.length;
  // Le titre est la question de l'étape ; le surtitre dit seulement où l'on en est
  const META = {
    name: { eyebrow: "Votre établissement", title: "Comment s’appelle votre établissement ?" },
    address: { eyebrow: "Votre établissement", title: "Quelle est son adresse ?" },
    contact: { eyebrow: "Votre compte", title: "Comment peut-on vous contacter ?" },
    search: { eyebrow: "Espace prestataire", title: "Retrouvez votre établissement" },
    confirm: { eyebrow: "Votre fiche", title: picked?.name || "" },
    entry: { eyebrow: "Espace prestataire", title: "Bienvenue sur Merry." },
    "login-email": { eyebrow: "Connexion", title: "Heureux de vous revoir." },
    password: { eyebrow: "Connexion", title: "Choisissez votre mot de passe." },
    managed: { eyebrow: "Votre fiche existe déjà", title: "Cette fiche a déjà un compte." },
    duplicate: { eyebrow: "Votre établissement", title: "Est-ce votre fiche ?" },
    "login-code": { eyebrow: "Connexion", title: "Vérifions que c’est bien vous." },
    code: { eyebrow: "Dernière étape", title: "Vérifions que c’est bien vous." },
    invite: { eyebrow: "Invitation", title: invite?.already ? "Cette invitation est pour un collègue." : `Rejoindre ${invite?.vendor_name || "l’équipe"}` },
    "invite-code": { eyebrow: "Invitation", title: "Vérifions que c’est bien vous." },
  };
  const { eyebrow, title: cardTitle } = META[screen] || { eyebrow: "", title: "" };
  const noProgress = logging || ["entry", "password", "managed", "duplicate"].includes(screen) || (screen === "invite" && !!invite?.already);
  // Changer de compte sans perdre le lien d'invitation
  const switchAccount = () => pro.signOut(`/pro?invitation=${invite.token}`);
  const goBack = screen === "entry" || screen === "password"
    ? null
    : screen === "managed"
    ? backTo("search")
    : screen === "duplicate"
    ? backTo("name")
    : invite
    ? screen === "invite-code"
      ? backTo("invite")
      : null
    : logging
    ? screen === "login-code"
      ? backTo("login-email")
      : backToEntry
    : creating
      ? screen === "name"
        ? backToSearch
        : screen === "address"
          ? backTo("name")
          : screen === "contact"
            ? backTo("address")
            : backTo("contact")
      : screen === "search"
        ? signedIn
          ? null
          : backTo("entry")
        : screen === "confirm"
          ? backTo("search")
          : backTo("confirm");

  return (
    <div className="p-claim">
      <header className="p-claim-header">
        <span className="p-brand-logo">Merry</span>
        <a href="https://www.withmerry.com">Retour au site</a>
      </header>
      <div className="p-claim-stage">
        <div className="p-claim-band">
          <div className={`p-claim-top${goBack || !noProgress ? "" : " is-hidden"}`}>
            {goBack ? (
              <button type="button" className="p-claim-back" aria-label="Étape précédente" onClick={goBack}>
                <ProIcon name="prev" size={18} sw={2} />
              </button>
            ) : (
              <span className="p-claim-back is-empty" />
            )}
            {/* La connexion n'est pas un parcours en étapes : pas de barre de progression */}
            {noProgress ? null : (
              <>
                <div className="p-claim-progress">
                  <span style={{ width: `${Math.round(((stepIndex + 1) / stepTotal) * 100)}%` }} />
                </div>
                <span className="p-claim-count">
                  {stepIndex + 1} / {stepTotal}
                </span>
              </>
            )}
          </div>
          <div className="p-claim-band-title">
            <span className="p-claim-eyebrow">{eyebrow}</span>
            <h1 className="p-claim-h1">{cardTitle}</h1>
          </div>
        </div>
        <div className="p-claim-card">
          <div className="p-claim-eyebrow p-desk-only">{eyebrow}</div>
          <h1 className="p-claim-h1 p-desk-only">{cardTitle}</h1>
          <div className="p-claim-screen" key={screen} ref={screenRef}>

          {screen === "entry" ? (
            <div className="p-claim-stack">
              <button type="button" className="p-claim-submit" onClick={startLogin}>
                Me connecter
              </button>
              <button type="button" className="p-claim-submit is-line" onClick={backToSearch}>
                Retrouver ma fiche
              </button>
            </div>
          ) : screen === "password" ? (
            <>
              <div className="p-claim-field">
                <label htmlFor="pro-new-1">Mot de passe (8 caractères minimum)</label>
                <input id="pro-new-1" className="p-claim-input" type="password" autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} onKeyDown={onEnter(savePassword)} autoFocus />
                <PasswordMeter value={newPassword} />
              </div>
              <div className="p-claim-field">
                <label htmlFor="pro-new-2">Confirmer le mot de passe</label>
                <input id="pro-new-2" className="p-claim-input" type="password" autoComplete="new-password" value={newPassword2} onChange={(e) => setNewPassword2(e.target.value)} onKeyDown={(e) => e.key === "Enter" && savePassword()} />
              </div>
              {errorBox}
              <button type="button" className="p-claim-submit" onClick={savePassword} disabled={busy}>
                Enregistrer et continuer
              </button>
            </>
          ) : screen === "managed" ? (
            <>
              <div className="p-claim-row-fiche">
                <span className="p-claim-name">{picked.name}</span>
                <span className="p-claim-meta">{[picked.category, picked.city].filter(Boolean).join(" · ")}</span>
              </div>
              <div className="p-claim-stack">
                <button type="button" className="p-claim-submit" onClick={startLogin}>
                  Me connecter
                </button>
                <button type="button" className="p-claim-link" onClick={backTo("confirm")}>
                  Pas de compte ? Recevoir un code à l’adresse de la fiche
                </button>
              </div>
            </>
          ) : screen === "duplicate" ? (
            <>
              <div className="p-claim-row-fiche">
                <span className="p-claim-name">{duplicate.name}</span>
                <span className="p-claim-meta">{[duplicate.category, duplicate.city].filter(Boolean).join(" · ")}</span>
              </div>
              <div className="p-claim-stack">
                <button type="button" className="p-claim-submit" onClick={() => choose(duplicate)}>
                  Oui, c’est ma fiche
                </button>
                <button type="button" className="p-claim-submit is-line" onClick={backTo("address")}>
                  Non, créer une nouvelle fiche
                </button>
              </div>
            </>
          ) : invite ? (
            screen === "invite" ? (
              invite.already ? (
                <>
                  <div className="p-claim-channel is-on is-single">
                    <ProIcon name="mail" size={20} />
                    <span>
                      <span className="p-claim-ctitle">Elle est destinée à {invite.email_hint}</span>
                      <span className="p-claim-chint">Vous êtes connecté avec {pro.data?.user?.email}, déjà membre de {invite.vendor_name}. Le lien reste valable pour la personne invitée.</span>
                    </span>
                  </div>
                  <div className="p-claim-stack">
                    <button type="button" className="p-claim-submit" onClick={() => window.location.assign("/pro")}>
                      Ouvrir mon espace
                    </button>
                    <button type="button" className="p-claim-link" onClick={switchAccount}>
                      Me déconnecter pour l’accepter avec une autre adresse
                    </button>
                  </div>
                </>
              ) : (
              <>
                <div className="p-claim-channel is-on is-single">
                  <ProIcon name="mail" size={20} />
                  <span>
                    <span className="p-claim-ctitle">{signedIn ? `Connecté avec ${pro.data.user.email}` : "Un code par mail, à l’adresse invitée"}</span>
                    {signedIn ? null : <span className="p-claim-chint">{invite.email_hint}</span>}
                  </span>
                </div>
                {signedIn ? null : (
                  <>
                    <div className="p-claim-field">
                      <label htmlFor="pro-inv-pw">Choisissez votre mot de passe (8 caractères minimum)</label>
                      <input id="pro-inv-pw" className="p-claim-input" type="password" autoComplete="new-password" value={invitePassword} onChange={(e) => setInvitePassword(e.target.value)} onKeyDown={onEnter(joinTeam)} />
                      <PasswordMeter value={invitePassword} />
                    </div>
                    <div className="p-claim-field">
                      <label htmlFor="pro-inv-pw2">Confirmer le mot de passe</label>
                      <input id="pro-inv-pw2" className="p-claim-input" type="password" autoComplete="new-password" value={invitePassword2} onChange={(e) => setInvitePassword2(e.target.value)} onKeyDown={onEnter(joinTeam)} />
                    </div>
                    <p className="p-claim-hint">Le code arrive à l’adresse invitée. Vous vous connecterez ensuite avec ce mot de passe.</p>
                  </>
                )}
                {errorBox}
                <div className="p-claim-actions">
                  <button type="button" className="p-claim-submit" onClick={joinTeam} disabled={busy}>
                    {signedIn ? "Rejoindre l’équipe" : "Recevoir mon code"}
                  </button>
                </div>
                {signedIn ? (
                  <button type="button" className="p-claim-link" onClick={switchAccount}>
                    Ce n’est pas vous ? Changer de compte
                  </button>
                ) : null}
              </>
              )
            ) : (
              <>
                {codeBlock(`Le code envoyé à ${invite.email_hint}`, joinTeam)}
                {errorBox}
                <div className="p-claim-actions">
                  <button type="button" className="p-claim-submit" onClick={validate} disabled={busy}>
                    Rejoindre l’équipe
                  </button>
                </div>
              </>
            )
          ) : logging ? (
            screen === "login-email" ? (
              <>
                <div className="p-claim-field">
                  <label htmlFor="pro-login">Adresse mail</label>
                  <input id="pro-login" className="p-claim-input" type="email" autoComplete="email" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} onKeyDown={onEnter(signIn)} autoFocus />
                </div>
                <div className="p-claim-field">
                  <span className="p-claim-label-row">
                    <label htmlFor="pro-login-pw">Mot de passe</label>
                    <button type="button" className="p-claim-link" onClick={sendLoginCode} disabled={busy}>
                      Oublié ?
                    </button>
                  </span>
                  <input
                    id="pro-login-pw"
                    className="p-claim-input"
                    type="password"
                    autoComplete="current-password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && signIn()}
                  />
                </div>
                {errorBox}
                <div className="p-claim-stack">
                  <button type="button" className="p-claim-submit" onClick={signIn} disabled={busy}>
                    Me connecter
                  </button>
                  {loginFailed ? (
                    <button type="button" className="p-claim-submit is-line" onClick={sendLoginCode} disabled={busy}>
                      Recevoir un code par mail
                    </button>
                  ) : (
                    <button type="button" className="p-claim-link" onClick={backToSearch}>
                      Première connexion ? Retrouver ma fiche
                    </button>
                  )}
                </div>
              </>
            ) : (
              <>
                {codeBlock(`Le code envoyé à ${loginEmail.trim()}`, sendLoginCode)}
                {errorBox}
                <div className="p-claim-actions is-split">
                  <button type="button" className="p-claim-link" onClick={backToSearch}>
                    Retrouver ma fiche par son nom
                  </button>
                  <button type="button" className="p-claim-submit" onClick={validate} disabled={busy}>
                    Valider
                  </button>
                </div>
              </>
            )
          ) : creating ? (
            screen === "name" ? (
              <>
                <div className="p-claim-field">
                  <label htmlFor="pro-name" className="p-sr">
                    Nom de l’établissement
                  </label>
                  <input id="pro-name" className="p-claim-input" autoComplete="organization" autoFocus onKeyDown={onEnter(nextFromName)} {...field("name")} />
                </div>
                <p className="p-claim-help">Quelle est votre activité ?</p>
                <div className="p-claim-cats">
                  <Pills options={CATEGORIES.map(([slug, label]) => ({ value: slug, label }))} value={form.category} onChange={(v) => setForm((f) => ({ ...f, category: v }))} label="Activité" />
                </div>
                <button type="button" className="p-claim-link p-claim-tel-only" onClick={backToSearch}>
                  J’ai déjà une fiche Merry
                </button>
                {errorBox}
                <div className="p-claim-actions is-split">
                  <button type="button" className="p-claim-link p-desk-only" onClick={backToSearch}>
                    J’ai déjà une fiche Merry
                  </button>
                  <button type="button" className="p-claim-submit" onClick={nextFromName} disabled={busy}>
                    Suivant
                  </button>
                </div>
              </>
            ) : screen === "address" ? (
              <>
                <div className="p-claim-field">
                  <label htmlFor="pro-adr" className="p-sr">
                    Adresse
                  </label>
                  <input id="pro-adr" className="p-claim-input" autoComplete="address-line1" autoFocus onKeyDown={onEnter(nextFromAddress)} {...field("address")} />
                </div>
                <div className="p-claim-row">
                  <div className="p-claim-field is-cp">
                    <label htmlFor="pro-cp">Code postal</label>
                    <input id="pro-cp" className="p-claim-input" inputMode="numeric" autoComplete="postal-code" maxLength={6} onKeyDown={onEnter(nextFromAddress)} {...field("postal_code")} />
                  </div>
                  <div className="p-claim-field">
                    <label htmlFor="pro-ville">Ville</label>
                    <input id="pro-ville" className="p-claim-input" autoComplete="address-level2" onKeyDown={onEnter(nextFromAddress)} {...field("city")} />
                  </div>
                </div>
                {errorBox}
                <div className="p-claim-actions">
                  <button type="button" className="p-claim-submit" onClick={nextFromAddress}>
                    Suivant
                  </button>
                </div>
              </>
            ) : screen === "contact" ? (
              <>
                <div className="p-claim-field">
                  <label htmlFor="pro-mail">Adresse mail de l’établissement</label>
                  <input id="pro-mail" className="p-claim-input" type="email" autoComplete="email" autoFocus onKeyDown={onEnter(sendCreateCode)} {...field("email")} />
                  <span className="p-claim-hint">Le code arrive à cette adresse, comme les demandes des couples.</span>
                </div>
                <div className="p-claim-field">
                  <label htmlFor="pro-tel">
                    Téléphone <span className="p-claim-opt">(facultatif)</span>
                  </label>
                  <input id="pro-tel" className="p-claim-input" type="tel" autoComplete="tel" onKeyDown={onEnter(sendCreateCode)} {...field("phone")} />
                </div>
                {signedIn ? null : (
                  <div className="p-claim-field">
                    <label htmlFor="pro-new-pw">Mot de passe (8 caractères minimum)</label>
                    <input id="pro-new-pw" className="p-claim-input" type="password" autoComplete="new-password" onKeyDown={onEnter(sendCreateCode)} {...field("password")} />
                    <PasswordMeter value={form.password} />
                  </div>
                )}
                {errorBox}
                <div className="p-claim-actions">
                  <button type="button" className="p-claim-submit" onClick={sendCreateCode} disabled={busy}>
                    Recevoir mon code
                  </button>
                </div>
              </>
            ) : (
              <>
                {codeBlock(`Le code envoyé à ${form.email.trim()}`, sendCreateCode)}
                {errorBox}
                <div className="p-claim-actions">
                  <button type="button" className="p-claim-submit" onClick={validate} disabled={busy}>
                    Créer ma fiche
                  </button>
                </div>
              </>
            )
          ) : screen === "search" ? (
            <>
              {myFiches.length ? (
                <p className="p-claim-help is-notice">
                  Vous êtes connecté à {myFiches.map((v) => v.name).join(", ")}. <a href="/pro">Aller à mon espace</a> ·{" "}
                  <button type="button" className="p-claim-link" onClick={() => pro.signOut(`/pro${window.location.search}`)}>
                    Changer de compte
                  </button>
                </p>
              ) : null}
              {notice ? <p className="p-claim-help is-notice">{notice}</p> : null}
              {setupMissing ? <p className="p-claim-error">{ERRORS.setup}</p> : null}
              <div className="p-claim-field">
                <label htmlFor="pro-q">Nom ou numéro SIRET</label>
                <div className="p-claim-search">
                  <ProIcon name="search" size={18} stroke="#5f5e58" />
                  <input id="pro-q" type="search" value={q} placeholder="Nom ou numéro SIRET" onChange={(e) => setQ(e.target.value)} autoComplete="organization" autoFocus />
                </div>
              </div>
              {results.length ? (
                <ul className="p-claim-results" aria-label="Résultats">
                  {results.map((r) => (
                    <li key={r.id}>
                      <span role="img" aria-label={`${r.name}, ${r.city || ""}`} className="p-claim-thumb" style={r.photo ? { backgroundImage: `url("${r.photo}")` } : undefined}>
                        {r.photo ? null : <span>Photo</span>}
                      </span>
                      <span className="p-claim-result">
                        <span className="p-claim-name">
                          {r.name}
                          {r.claimed ? <span className="p-chip is-small p-claim-claimed">Déjà gérée sur Merry</span> : null}
                        </span>
                        <span className="p-claim-meta">{[r.city, r.category].filter(Boolean).join(" · ")}</span>
                      </span>
                      <button type="button" className="p-btn p-btn-ghost is-40" onClick={() => choose(r)}>
                        C’est moi
                      </button>
                    </li>
                  ))}
                </ul>
              ) : q.trim().length >= 3 && !searching && !setupMissing ? (
                <p className="p-claim-help">Aucune fiche ne porte ce nom. Essayez le nom tel qu’il apparaît sur Google, ou votre numéro SIRET.</p>
              ) : null}
              <div className="p-claim-new">
                <span>
                  <span className="p-claim-new-title">Mon établissement n’apparaît pas</span>
                  <span className="p-claim-new-sub">Créez votre fiche en quelques écrans.</span>
                </span>
                <button type="button" className="p-btn p-btn-ghost" onClick={startCreate}>
                  Créer ma fiche
                </button>
              </div>
            </>
          ) : screen === "confirm" ? (
            <>
              <div className="p-claim-vcard">
                <div role="img" aria-label={`${picked.name}, photo de couverture`} className="p-claim-cover" style={picked.photo ? { backgroundImage: `url("${picked.photo}")` } : undefined} />
                <div className="p-claim-vbody">
                  <span className="p-claim-vname">{picked.name}</span>
                  <ul>
                    {picked.address || picked.city ? (
                      <li>
                        <ProIcon name="pin" size={16} stroke="#5f5e58" />
                        <span>{[picked.address, [picked.postal_code, picked.city].filter(Boolean).join(" ")].filter(Boolean).join(", ")}</span>
                      </li>
                    ) : null}
                    {picked.category ? (
                      <li>
                        <ProIcon name="fiche" size={16} stroke="#5f5e58" />
                        <span>{picked.category}</span>
                      </li>
                    ) : null}
                    {picked.rating ? (
                      <li>
                        <ProIcon name="star" size={16} stroke="#5f5e58" />
                        <span>
                          {String(picked.rating).replace(".", ",")} sur Google · {picked.reviews || 0} avis
                        </span>
                      </li>
                    ) : null}
                  </ul>
                </div>
              </div>
              <div className="p-claim-channel is-on is-single">
                <ProIcon name="mail" size={20} />
                <span>
                  <span className="p-claim-ctitle">{picked.email_hint ? "Un code par mail, à l’adresse de la fiche" : "Pas d’adresse mail sur cette fiche"}</span>
                  <span className="p-claim-chint">{picked.email_hint || "Écrivez-nous depuis l’adresse de votre établissement : nous vous ouvrons l’accès."}</span>
                </span>
              </div>
              {picked.email_hint && !signedIn ? (
                <div className="p-claim-field">
                  <label htmlFor="pro-claim-pw">Choisissez un mot de passe (8 caractères minimum)</label>
                  <input id="pro-claim-pw" className="p-claim-input" type="password" autoComplete="new-password" value={claimPassword} onChange={(e) => setClaimPassword(e.target.value)} onKeyDown={onEnter(confirmAndSend)} />
                  <PasswordMeter value={claimPassword} />
                </div>
              ) : null}
              {errorBox}
              <div className="p-claim-actions">
                <button type="button" className="p-claim-submit" onClick={confirmAndSend} disabled={busy || !picked.email_hint}>
                  Recevoir mon code
                </button>
              </div>
            </>
          ) : (
            <>
              {codeBlock(`Le code envoyé à ${picked.email_hint}`, () => sendCode())}
              {errorBox}
              <div className="p-claim-actions">
                <button type="button" className="p-claim-submit" onClick={validate} disabled={busy || !picked.email_hint}>
                  Confirmer
                </button>
              </div>
            </>
          )}
          </div>
        </div>
      </div>
    </div>
  );
}
