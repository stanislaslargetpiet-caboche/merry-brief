"use client";

// Page ouverte par « Se désinscrire » dans un mail (planches V30 et V30b). Rien ne change à l'ouverture
// du lien, seulement au clic : les antivirus de messagerie ouvrent les liens tout seuls.
// ?demo=1 montre l'écran sans lien signé.

import { useEffect, useState } from "react";

const DEMO_MAIL = "contact@masdelasource.fr";

async function call(params, action) {
  try {
    const res = await fetch("/api/desinscription", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ e: params.e, t: params.t, k: params.k, action }),
    });
    return await res.json();
  } catch {
    return { error: "network" };
  }
}

const TEXTS = {
  nouveautes: {
    ask: "Tu ne recevras plus le récap du samedi. Ton mariage reste sur Merry, et les autres mails qui le concernent continuent d’arriver.",
    done: "ne recevra plus le récap du samedi. Les autres mails qui concernent son mariage continuent d’arriver.",
  },
  activite: {
    ask: "Tu ne recevras plus le mail de 20 h sur l’activité de ton compte. Tu retrouves tout sur Merry, et les autres mails continuent d’arriver.",
    done: "ne recevra plus le mail de 20 h sur l’activité de son compte. Les autres mails continuent d’arriver.",
  },
  demarrage: {
    ask: "Tu ne recevras plus les conseils pour bien démarrer sur Merry. Ton mariage reste sur Merry, et les mails qui le concernent continuent d’arriver.",
    done: "ne recevra plus les conseils pour bien démarrer. Les mails qui concernent son mariage continuent d’arriver.",
  },
  vendor: {
    ask: "Tu ne recevras plus de mail quand un couple t’écrit sur Merry. Ses messages resteront dans ton espace prestataire.",
    done: "ne recevra plus ces mails. Ses messages restent dans ton espace prestataire.",
  },
};

export default function Desinscription() {
  const [params, setParams] = useState(null);
  const [state, setState] = useState({ status: "loading" });
  const [busy, setBusy] = useState(false);
  const texts = TEXTS[params?.k] || TEXTS.vendor;

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const found = { e: query.get("e"), t: query.get("t"), k: query.get("k"), demo: query.get("demo") === "1" };
    setParams(found);
    if (found.demo) {
      setState({ status: "ready", email: DEMO_MAIL, out: false });
      return;
    }
    call(found).then((res) => setState(res.email ? { status: "ready", email: res.email, out: res.out } : { status: "bad" }));
  }, []);

  async function change(action) {
    if (params.demo) {
      setState({ ...state, out: action === "desinscrire" });
      return;
    }
    setBusy(true);
    const res = await call(params, action);
    setBusy(false);
    if (res.email) setState({ status: "ready", email: res.email, out: res.out });
    else setState({ ...state, failed: true });
  }

  return (
    <main className="unsub">
      <span className="unsub-logo">Merry</span>
      {state.status === "loading" ? <p className="unsub-text">Un instant…</p> : null}
      {state.status === "bad" ? (
        <>
          <h1>Ce lien n’est plus valide.</h1>
          <p className="unsub-text">
            Écris-nous à <a href="mailto:bonjour@withmerry.com">bonjour@withmerry.com</a>, nous retirerons ton adresse.
          </p>
        </>
      ) : null}
      {state.status === "ready" && !state.out ? (
        <>
          <h1>Ne plus recevoir ces mails&nbsp;?</h1>
          <p className="unsub-text">{texts.ask}</p>
          <div className="unsub-mail">{state.email}</div>
          <button type="button" className="unsub-btn" disabled={busy} onClick={() => change("desinscrire")}>
            Me désinscrire
          </button>
        </>
      ) : null}
      {state.status === "ready" && state.out ? (
        <>
          <svg className="unsub-check" width="40" height="40" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="9" fill="#d4f1e8" stroke="#0b6a4f" strokeWidth="2" />
            <path d="M8 12l3 3 5-6" fill="none" stroke="#0b6a4f" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <h1 className="is-done">C’est noté.</h1>
          <p className="unsub-text">{state.email} {texts.done}</p>
          <button type="button" className="unsub-btn is-ghost" disabled={busy} onClick={() => change("reabonner")}>
            Me réabonner
          </button>
        </>
      ) : null}
      {state.failed ? <p className="unsub-text is-error">Ça n’a pas fonctionné. Réessaie dans un instant.</p> : null}
    </main>
  );
}
