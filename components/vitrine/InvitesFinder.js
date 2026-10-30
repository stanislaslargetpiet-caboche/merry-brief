"use client";

// Flux « Tu es invité » (canvas « 4 - Invités » : Site-Invites, -Code, -Nom, -Trouve). Un seul
// composant client, pas de sous-routes : « J'ai un code » et « Je cherche par prénoms » mènent à
// un panneau qui remplace la hero, « On a trouvé la fête » ouvre le vrai site (/s/[slug]), et un
// état « on n'a rien trouvé » (absent du canvas) referme la boucle plutôt que de laisser l'invité
// face à un bouton qui ne répond pas.

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { BusyDots } from "@/components/dash/ui";

function readDemoWedding() {
  try {
    const raw = window.localStorage.getItem("merry-demo-v1");
    const data = raw ? JSON.parse(raw)?.data : null;
    if (!data?.site?.published || !data?.wedding) return null;
    return {
      slug: data.site.slug,
      partner1: data.wedding.partner1,
      partner2: data.wedding.partner2,
      wedding_date: data.wedding.wedding_date,
      venue: data.wedding.venue,
      region: data.wedding.region,
      cover: data.site.content?.photos?.cover || null,
    };
  } catch {
    return null;
  }
}

function matchesDemo(w, { code, name1, name2, date }) {
  if (!w) return null;
  if (code) return w.slug?.toLowerCase() === code.trim().toLowerCase() ? w : null;
  const n1 = name1.trim().toLowerCase();
  const n2 = name2.trim().toLowerCase();
  const p1 = (w.partner1 || "").trim().toLowerCase();
  const p2 = (w.partner2 || "").trim().toLowerCase();
  const sameTwo = (p1 === n1 && (!n2 || p2 === n2)) || (p2 === n1 && (!n2 || p1 === n2));
  if (!sameTwo) return null;
  if (date && w.wedding_date !== date) return null;
  return w;
}

function formatDate(iso) {
  if (!iso) return null;
  const d = new Date(`${iso}T00:00:00`);
  const s = d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default function InvitesFinder() {
  const [view, setView] = useState("home"); // home | code | nom | trouve | non-trouve
  const [code, setCode] = useState("");
  const [name1, setName1] = useState("");
  const [name2, setName2] = useState("");
  const [date, setDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [found, setFound] = useState(null);

  async function search({ byCode }) {
    setBusy(true);
    try {
      const params = byCode
        ? { code: code.trim(), name1: null, name2: null, date: null }
        : { code: null, name1: name1.trim(), name2: name2.trim(), date: date || null };
      let result = null;
      if (supabase) {
        const { data, error } = await supabase.rpc("merry_find_wedding", {
          p_code: params.code,
          p_name1: params.name1,
          p_name2: params.name2,
          p_date: params.date,
        });
        if (error) console.error("[merry] recherche de la fête", error);
        result = data || null;
      } else {
        result = matchesDemo(readDemoWedding(), { code: params.code, name1: params.name1 || "", name2: params.name2 || "", date: params.date });
      }
      setFound(result);
      setView(result ? "trouve" : "non-trouve");
    } finally {
      setBusy(false);
    }
  }

  if (view === "trouve" && found) {
    const names = [found.partner1, found.partner2].filter(Boolean).join(" & ");
    const place = [found.venue, found.region].filter(Boolean).join(", ");
    return (
      <main className="wv-flow">
        <button type="button" className="wv-flow-back" onClick={() => setView("home")}>
          ← Retour
        </button>
        <h1 className="wv-h2">On a trouvé la fête.</h1>
        <div className="wv-flow-panel">
          <div className="wv-flow-match">
            {found.cover ? (
              <img src={found.cover} alt="" />
            ) : (
              <span className="wv-flow-match-ph" aria-hidden="true">
                {names
                  .split(/\s*&\s*/)
                  .map((n) => n.trim()[0])
                  .join("")}
              </span>
            )}
            <div>
              <b>{names}</b>
              <p>
                {formatDate(found.wedding_date)}
                {place ? (
                  <>
                    <br />
                    {place}
                  </>
                ) : null}
              </p>
            </div>
          </div>
          <a href={`/s/${found.slug}`} className="wv-btn wv-btn-dark wv-btn-wide">
            Ouvrir la page de la fête
          </a>
          <p className="wv-flow-or">
            Ce n’est pas eux ?{" "}
            <button type="button" onClick={() => setView("nom")}>
              Chercher à nouveau
            </button>
          </p>
        </div>
        <ul className="wv-flow-steps">
          <li>
            <b>Programme</b>L’heure, le lieu, le déroulé.
          </li>
          <li>
            <b>Ta réponse</b>Oui ou non, en deux clics, régime compris.
          </li>
          <li>
            <b>Infos pratiques</b>Accès, hébergement, dress code.
          </li>
          <li>
            <b>Cadeaux</b>La liste ou la cagnotte.
          </li>
        </ul>
      </main>
    );
  }

  if (view === "non-trouve") {
    return (
      <main className="wv-flow">
        <button type="button" className="wv-flow-back" onClick={() => setView("home")}>
          ← Retour
        </button>
        <h1 className="wv-h2">On n’a rien trouvé.</h1>
        <div className="wv-flow-panel">
          <p className="wv-help">
            Vérifie l’orthographe des prénoms ou du code, majuscules et accents ne comptent pas. Si plusieurs couples
            portent les mêmes prénoms, ajoute la date de la fête.
          </p>
          <button type="button" className="wv-btn wv-btn-dark wv-btn-wide" onClick={() => setView(code ? "code" : "nom")}>
            Réessayer
          </button>
          <p className="wv-flow-or">
            {code ? (
              <>
                Pas de code ?{" "}
                <button type="button" onClick={() => setView("nom")}>
                  Cherche par prénoms
                </button>
              </>
            ) : (
              <>
                Tu as un code ?{" "}
                <button type="button" onClick={() => setView("code")}>
                  Entre-le ici
                </button>
              </>
            )}
          </p>
        </div>
      </main>
    );
  }

  if (view === "code") {
    return (
      <main className="wv-flow">
        <button type="button" className="wv-flow-back" onClick={() => setView("home")}>
          ← Retour
        </button>
        <h1 className="wv-h2">Ton code d’invitation.</h1>
        <form
          className="wv-flow-panel"
          onSubmit={(e) => {
            e.preventDefault();
            if (code.trim()) search({ byCode: true });
          }}
        >
          <span className="wv-flow-label" id="invite-code-label">
            Le code de ton faire-part
          </span>
          <input
            className="wv-flow-field"
            aria-labelledby="invite-code-label"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Ex. alice-et-ben-2027"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
          />
          <p className="wv-help">Il est sur ton faire-part, ou dans le message que les mariés t’ont envoyé. Majuscules ou minuscules, peu importe.</p>
          <button type="submit" className="wv-btn wv-btn-dark wv-btn-wide" disabled={busy || !code.trim()}>
            {busy ? <BusyDots label="Recherche en cours" /> : "Trouver la fête"}
          </button>
          <p className="wv-flow-or">
            Pas de code ?{" "}
            <button type="button" onClick={() => setView("nom")}>
              Cherche par prénoms
            </button>
          </p>
        </form>
      </main>
    );
  }

  if (view === "nom") {
    return (
      <main className="wv-flow">
        <button type="button" className="wv-flow-back" onClick={() => setView("home")}>
          ← Retour
        </button>
        <h1 className="wv-h2">Qui se marie ?</h1>
        <form
          className="wv-flow-panel"
          onSubmit={(e) => {
            e.preventDefault();
            if (name1.trim()) search({ byCode: false });
          }}
        >
          <div className="wv-flow-two">
            <label>
              <span className="wv-flow-label">Un prénom</span>
              <input className="wv-flow-field" value={name1} onChange={(e) => setName1(e.target.value)} placeholder="Alice" />
            </label>
            <label>
              <span className="wv-flow-label">L’autre prénom</span>
              <input className="wv-flow-field" value={name2} onChange={(e) => setName2(e.target.value)} placeholder="Ben" />
            </label>
          </div>
          <label>
            <span className="wv-flow-label">Date de la fête</span>
            <input type="date" className="wv-flow-field" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <p className="wv-help">Deux prénoms suffisent souvent. La date aide quand plusieurs couples portent les mêmes.</p>
          <button type="submit" className="wv-btn wv-btn-dark wv-btn-wide" disabled={busy || !name1.trim()}>
            {busy ? <BusyDots label="Recherche en cours" /> : "Trouver la fête"}
          </button>
          <p className="wv-flow-or">
            Tu as un code ?{" "}
            <button type="button" onClick={() => setView("code")}>
              Entre-le ici
            </button>
          </p>
        </form>
      </main>
    );
  }

  return (
    <main className="wv-invites">
      <img src="/vitrine/invites-1.webp" alt="" className="wv-ph wv-ph1" />
      <img src="/vitrine/invites-2.webp" alt="" className="wv-ph wv-ph2" />
      <img src="/vitrine/invites-3.webp" alt="" className="wv-ph wv-ph3" />
      <img src="/vitrine/invites-4.webp" alt="" className="wv-ph wv-ph4" />
      <div className="wv-invites-in">
        <h1 className="wv-h2">Tu es invité au plus beau jour de leur vie.</h1>
        <p className="wv-h4">C’est pas rien.</p>
        <p className="wv-lead" style={{ maxWidth: 640 }}>
          Retrouve la page de leur fête : le programme, ta réponse, les infos pratiques et la liste de cadeaux.
        </p>
        <div className="wv-btns" style={{ justifyContent: "center", marginTop: 18 }}>
          <button type="button" className="wv-btn wv-btn-dark" onClick={() => setView("code")}>
            J'ai un code
          </button>
          <button type="button" className="wv-btn wv-btn-line" onClick={() => setView("nom")}>
            J'ai un nom
          </button>
        </div>
        <p className="wv-flow-hint">Le code est sur ton faire-part ou dans le message des mariés.</p>
      </div>
    </main>
  );
}
