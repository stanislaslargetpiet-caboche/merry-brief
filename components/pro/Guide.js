"use client";

// Accueil du dashboard prestataire (maquette « V1 bis », canvas Merry · Carte brief, 6 nov. 2026) :
// message de bienvenue, « Comment ça marche », coûts par métier, 100 crédits offerts et Garantie Merry.
// « Masquer ce guide » se retient par fiche, dans ce navigateur.

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePro } from "@/lib/pro/store";
import { REPLY_COSTS } from "@/lib/pro/format";

const KEY = "merry-pro-guide-masque";

// Icônes pleines citron du design system (planche « Bibliothèque d'icônes »)
const ICONS = {
  invites:
    '<path d="M16 14.6c2.6.2 4.6 2 5.3 5.4H13c0-2.3.9-4.3 3-5.4z" fill="#fffdb8" stroke="#1c1c1a" stroke-width="1.3" stroke-linejoin="round"/><circle cx="17" cy="9" r="2.5" fill="#fffdb8" stroke="#1c1c1a" stroke-width="1.3"/><path d="M2.5 20c.8-3.5 3.4-5.5 6.5-5.5s5.7 2 6.5 5.5z" fill="#fff700" stroke="#1c1c1a" stroke-width="1.5" stroke-linejoin="round"/><circle cx="9" cy="8" r="3.5" fill="#fff700" stroke="#1c1c1a" stroke-width="1.5"/>',
  filtrer:
    '<path d="M4 5h16M7 12h10M10 19h4" stroke="#1c1c1a" stroke-width="2" stroke-linecap="round"/><circle cx="14" cy="5" r="2.1" fill="#fff700" stroke="#1c1c1a" stroke-width="1.3"/><circle cx="10" cy="12" r="2.1" fill="#fff700" stroke="#1c1c1a" stroke-width="1.3"/><circle cx="13" cy="19" r="2.1" fill="#fff700" stroke="#1c1c1a" stroke-width="1.3"/>',
  rechercher: '<circle cx="10" cy="10" r="6" fill="#fff700" stroke="#1c1c1a" stroke-width="1.6"/><path d="M21 21l-4.3-4.3" stroke="#1c1c1a" stroke-width="2.2" stroke-linecap="round"/>',
  messagerie:
    '<path d="M4 5h16v11H8.5L4 20z" fill="#fff700" stroke="#1c1c1a" stroke-width="1.5" stroke-linejoin="round"/><circle cx="8.5" cy="10.5" r="1" fill="#1c1c1a"/><circle cx="12" cy="10.5" r="1" fill="#1c1c1a"/><circle cx="15.5" cy="10.5" r="1" fill="#1c1c1a"/>',
  avis: '<path d="M12 3l2.6 5.6 6.1.6-4.6 4.1 1.3 6-5.4-3.1-5.4 3.1 1.3-6-4.6-4.1 6.1-.6z" fill="#fff700" stroke="#1c1c1a" stroke-width="1.3" stroke-linejoin="round"/>',
  securite:
    '<path d="M12 3.5 5 6.5v5.2c0 4.6 3 8.3 7 9.3 4-1 7-4.7 7-9.3V6.5z" fill="#fff700" stroke="#1c1c1a" stroke-width="1.5" stroke-linejoin="round"/><path d="m9.3 12.3 2 2 3.6-4" stroke="#1c1c1a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
  budget:
    '<rect x="3" y="6" width="18" height="13" rx="2" fill="#fff700" stroke="#1c1c1a" stroke-width="1.5"/><path d="M3 10h18" stroke="#1c1c1a" stroke-width="1.5"/><path d="M16.5 14.5h1.5" stroke="#1c1c1a" stroke-width="1.8" stroke-linecap="round"/>',
};

function Icon({ name }) {
  return <svg width="26" height="26" viewBox="0 0 24 24" aria-hidden="true" dangerouslySetInnerHTML={{ __html: ICONS[name] }} />;
}

const STEPS = [
  { icon: "invites", title: "Les couples détaillent leur mariage.", text: "Date, lieu, nombre d’invités, budget, style : ils répondent à des questions précises." },
  { icon: "filtrer", title: "Merry vous envoie ceux qui vous correspondent.", text: "Les demandes arrivent dans votre messagerie, et par mail." },
  { icon: "rechercher", title: "Vous choisissez si vous y donnez suite.", text: "Voir une demande (date, lieu, invités, budget...) est gratuit. Seules les coordonnées du couple restent floutées." },
  { icon: "messagerie", title: "Vous utilisez des crédits pour y répondre.", text: "Les crédits servent seulement à activer l’entrée en relation, vous ne payez plus rien après." },
  { icon: "avis", title: "Vous gérez la suite plus facilement.", text: "Envoi de devis, réception des paiements... tout se fait via Merry." },
];

// Un métier du catalogue = une ligne ; DJ et musiciens partagent le même tarif
const COSTS = [
  { label: "Lieu de réception", keys: ["lieu"], cost: REPLY_COSTS.lieu },
  { label: "Traiteur", keys: ["traiteur"], cost: REPLY_COSTS.traiteur },
  { label: "Photographe", keys: ["photographe", "videaste"], cost: REPLY_COSTS.photographe },
  { label: "DJ et animation", keys: ["dj", "musiciens"], cost: REPLY_COSTS.dj },
  { label: "Fleuriste", keys: ["fleuriste"], cost: REPLY_COSTS.fleuriste },
];

export default function Guide() {
  const pro = usePro();
  const vendor = pro.data.vendor;
  const storeKey = `${KEY}:${vendor?.id || "fiche"}`;
  const [hidden, setHidden] = useState(null);

  useEffect(() => {
    try {
      setHidden(window.localStorage.getItem(storeKey) === "1");
    } catch {
      setHidden(false);
    }
  }, [storeKey]);

  function toggle(next) {
    setHidden(next);
    try {
      if (next) window.localStorage.setItem(storeKey, "1");
      else window.localStorage.removeItem(storeKey);
    } catch {}
  }

  if (hidden === null) return null;
  if (hidden) {
    return (
      <button type="button" className="p-link p-guide-show" onClick={() => toggle(false)}>
        Revoir le guide
      </button>
    );
  }

  const mine = vendor?.primary_category;
  return (
    <>
      <section className="p-guide-hero" aria-label="Bienvenue">
        <h2>Bienvenue sur Merry{vendor?.name ? `, ${vendor.name}` : ""}.</h2>
        <div className="p-guide-hero-actions">
          <Link href="/pro/demandes" className="p-btn p-btn-primary">
            Voir mes demandes
          </Link>
          <button type="button" className="p-link" onClick={() => toggle(true)}>
            Masquer ce guide
          </button>
        </div>
      </section>

      <section className="p-guide-card" aria-label="Comment ça marche">
        <h2 className="p-h2">Comment ça marche.</h2>
        <ol className="p-guide-steps">
          {STEPS.map((s, i) => (
            <li key={s.title}>
              <span className="p-guide-ico">
                <Icon name={s.icon} />
              </span>
              <div>
                <span className="p-guide-n">Étape {i + 1}</span>
                <b>{s.title}</b>
                <span className="p-guide-t">{s.text}</span>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <div className="p-guide-cost">
        <section className="p-guide-card" aria-label="Combien ça coûte">
          <div className="p-guide-cost-head">
            <span className="p-guide-ico">
              <Icon name="budget" />
            </span>
            <div>
              <h2 className="p-h2">Combien ça coûte ?</h2>
              <p>Vous ne dépensez des crédits que pour répondre à une demande qui vous intéresse.</p>
            </div>
          </div>
          <ul className="p-guide-rows">
            {COSTS.map((c) => {
              const on = c.keys.includes(mine);
              return (
                <li key={c.label} className={on ? "is-mine" : ""}>
                  <span>
                    {c.label}
                    {on ? <em>Votre métier</em> : null}
                  </span>
                  <b>{c.cost} crédits</b>
                </li>
              );
            })}
          </ul>
        </section>

        <div className="p-guide-offer">
          <section className="p-guide-gift" aria-label="Crédits offerts">
            <span className="p-guide-n">À l’inscription</span>
            <b>100 crédits</b>
            <span className="p-guide-gift-sub">offerts pour démarrer</span>
            <p>Utilisez-les pour répondre à vos premières demandes.</p>
          </section>
          <section className="p-guide-warranty" aria-label="Garantie Merry">
            <span className="p-guide-ico">
              <Icon name="securite" />
            </span>
            <h2 className="p-h2">La Garantie Merry</h2>
            <p>Si vos 100 crédits offerts ne vous apportent aucune réservation, Merry vous les rend.</p>
          </section>
        </div>
      </div>
    </>
  );
}
