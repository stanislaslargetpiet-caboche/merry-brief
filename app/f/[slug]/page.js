"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { longDate } from "@/lib/dash/format";
import { formTheme, merryProof } from "@/lib/dash/form";
import GuestForm, { useGuestForm } from "@/components/site/GuestForm";

// Lien vers le site : la source fait compter ces visites et inscriptions à part (compteur anonyme et briefs.source)
const MERRY = "https://withmerry.com/?source=formulaire-invites";

/*
 * Page publique du formulaire invités : le lien que le couple partage sur
 * WhatsApp, Facebook ou par message. Aucune connexion : le formulaire est lu et
 * envoyé par deux fonctions Supabase (merry_form_public, merry_form_submit) ; l'envoi passe par
 * /api/formulaire/repondre, qui confirme la réponse à l'invité par mail.
 * En démo (tableau de bord ?demo=1 ou sans Supabase), on lit le formulaire du navigateur.
 * Le formulaire lui-même (questions, envoi) est dans components/site/GuestForm.js, partagé avec le site de mariage.
 */

export default function GuestFormPage() {
  const { slug } = useParams();
  const state = useGuestForm(slug);
  const form = state.form;
  const theme = formTheme(form?.theme);
  const style = useMemo(() => ({ "--gf-bg": theme.bg, "--gf-deep": theme.deep, "--gf-accent": theme.accent }), [theme]);
  const [answered, setAnswered] = useState(false);

  if (state.status !== "ready") {
    return (
      <main className="gf" style={style}>
        {state.status === "loading" ? (
          <div className="gf-loader" role="status" aria-label="Chargement du formulaire">
            <span className="gf-loader-word">Merry</span>
            <span className="gf-loadbar">
              <span />
            </span>
          </div>
        ) : (
          <p className="gf-state">Ce formulaire n'existe pas ou n'est plus ouvert. Vérifie le lien reçu des mariés.</p>
        )}
      </main>
    );
  }

  const couple = (form.title || "").trim() || [form.partner1, form.partner2].filter(Boolean).join(" & ");

  return (
    <main className={`gf${answered ? " is-answered" : ""}`} style={style}>
      {/* Après l'envoi, la photo et le titre ne reviennent pas : le merci puis la carte Merry, sur fond blanc */}
      {answered ? null : <div className="gf-cover" style={form.cover_url ? { backgroundImage: `url("${form.cover_url}")`, backgroundPosition: `center ${Number.isFinite(Number(form.cover_position)) ? Number(form.cover_position) : 50}%` } : undefined} role={form.cover_url ? "img" : undefined} aria-label={form.cover_url ? `Photo de ${couple}` : undefined} />}
      <div className="gf-wrap">
        {answered ? null : <section className="gf-card gf-hero">
          <div className="gf-kicker">Save the date</div>
          <h1>{couple}</h1>
          {form.wedding_date ? <div className="gf-date">{longDate(form.wedding_date)}</div> : null}
          {form.venue ? <div className="gf-venue">{form.venue}</div> : null}
          {form.message ? <p className="gf-message">{form.message}</p> : null}
          {form.venue ? (
            <a className="gf-maps" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(form.venue)}`} target="_blank" rel="noreferrer">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 21s-6.5-6.2-6.5-11a6.5 6.5 0 0 1 13 0c0 4.8-6.5 11-6.5 11z" />
                <circle cx="12" cy="10" r="2.3" />
              </svg>
              Voir l'itinéraire
            </a>
          ) : null}
        </section>}

        <GuestForm form={form} slug={String(slug)} fullscreen onAnswered={() => setAnswered(true)} />

        {answered ? (
          <section className="gf-merry" aria-label="Merry">
            <span className="gf-merry-by">
              Créé avec <b>Merry</b>
            </span>
            <div className="gf-merry-head">
              <p>{merryProof(form)}</p>
              <h2>Et toi, c'est pour quand&nbsp;?</h2>
            </div>
            <ul className="gf-merry-tags">
              <li>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="9" cy="8" r="3.5" />
                  <path d="M2.5 20c.8-3.5 3.4-5.5 6.5-5.5s5.7 2 6.5 5.5" />
                  <circle cx="17" cy="9" r="2.5" />
                  <path d="M16 14.6c2.6.2 4.6 2 5.3 5.4" />
                </svg>
                Liste d'invités
              </li>
              <li>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="3" y="6" width="18" height="13" rx="2" />
                  <path d="M3 10h18M16.5 14.5h1.5" />
                </svg>
                Budget
              </li>
              <li>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="10" cy="10" r="6" />
                  <path d="M21 21l-4.3-4.3" />
                </svg>
                Prestataires
              </li>
            </ul>
            <a className="gf-merry-cta" href={MERRY} target="_blank" rel="noreferrer">
              Organiser mon mariage
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </a>
            <span className="gf-merry-free">Gratuit pour les mariés.</span>
          </section>
        ) : null}

        <a className="gf-foot" href={MERRY} target="_blank" rel="noreferrer">
          <b>Merry</b>
          <span>withmerry.com</span>
        </a>
      </div>
    </main>
  );
}
