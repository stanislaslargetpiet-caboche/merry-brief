"use client";

// Formulaire RSVP intégré directement dans la rubrique « Votre réponse » du site de mariage,
// au lieu d'un lien vers /f/[slug] : l'invité répond sans quitter le site. Même composant que la
// page publique (GuestForm) ; les couleurs sont celles du site (app/f/form.css, .gf-embed).

import "@/app/f/form.css";
import GuestForm, { useGuestForm } from "./GuestForm";

export default function GuestFormInline({ formSlug, preview, onAnswered }) {
  const state = useGuestForm(formSlug, { preview });
  if (state.status !== "ready") {
    return <p className="gf-state">{state.status === "loading" ? "Chargement du formulaire…" : "Ce formulaire n'existe pas ou n'est plus ouvert."}</p>;
  }
  return (
    <div className="gf-embed">
      <GuestForm form={state.form} slug={formSlug} onAnswered={onAnswered} />
    </div>
  );
}
