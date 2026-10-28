"use client";

// Espace Invités, onglet « Liste de mariage » (artboards « 10c » et « 10o ») : pas encore construite,
// un bloc « Bientôt » et un aperçu grisé de ce qu'elle montrera.

import { Bar } from "@/components/dash/ui";
import InvitesHeader from "@/components/dash/InvitesTabs";

const GIFTS = [
  { name: "Week-end à Bonifacio", sub: "Deux nuits face à la mer", amount: "640 €", of: "sur 1 200 €", pct: 53 },
  { name: "Vélo de course", sub: "Pour les cols du Ventoux", amount: "900 €", of: "sur 1 800 €", pct: 50 },
  { name: "Cagnotte voyage de noces", sub: "Participation libre", amount: "2 350 €", of: "34 participants", pct: 53 },
];

export default function ListeDeMariage() {
  return (
    <>
      <InvitesHeader tab="liste-de-mariage" />
      <section className="d-isoon">
        <span className="d-itab-soon">Bientôt</span>
        <div className="d-isoon-text">
          <h2>Votre liste de mariage, ici, à côté de vos invités</h2>
          <p className="d-muted">Des cadeaux et une cagnotte que vos invités retrouveront sur votre site, avec le suivi des participations. Nous vous préviendrons dès qu’elle sera prête.</p>
        </div>
        <div className="d-isoon-gifts" aria-hidden="true">
          {GIFTS.map((g) => (
            <div key={g.name} className="d-isoon-gift">
              <span className="d-isoon-photo" />
              <strong>{g.name}</strong>
              <small>{g.sub}</small>
              <span>
                <b>{g.amount}</b> {g.of}
              </span>
              <Bar value={g.pct} color="var(--d-border)" track="var(--d-line)" />
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
