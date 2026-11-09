"use client";

import { useMemo } from "react";
import { useParams } from "next/navigation";
import { longDate } from "@/lib/dash/format";
import { formTheme } from "@/lib/dash/form";
import GuestForm, { useGuestForm } from "@/components/site/GuestForm";

/*
 * Page publique du formulaire invités : le lien que le couple partage sur
 * WhatsApp, Facebook ou par message. Aucune connexion : le formulaire est lu et
 * envoyé par deux fonctions Supabase (merry_form_public, merry_form_submit).
 * En démo (tableau de bord ?demo=1 ou sans Supabase), on lit le formulaire du navigateur.
 * Le formulaire lui-même (questions, envoi) est dans components/site/GuestForm.js, partagé avec le site de mariage.
 */

export default function GuestFormPage() {
  const { slug } = useParams();
  const state = useGuestForm(slug);
  const form = state.form;
  const theme = formTheme(form?.theme);
  const style = useMemo(() => ({ "--gf-bg": theme.bg, "--gf-deep": theme.deep, "--gf-accent": theme.accent }), [theme]);

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
          <p className="gf-state">Ce formulaire n'existe pas ou n'est plus ouvert. Vérifiez le lien reçu des mariés.</p>
        )}
      </main>
    );
  }

  const couple = (form.title || "").trim() || [form.partner1, form.partner2].filter(Boolean).join(" & ");

  return (
    <main className="gf" style={style}>
      <div className="gf-cover" style={form.cover_url ? { backgroundImage: `url("${form.cover_url}")`, backgroundPosition: `center ${Number.isFinite(Number(form.cover_position)) ? Number(form.cover_position) : 50}%` } : undefined} role={form.cover_url ? "img" : undefined} aria-label={form.cover_url ? `Photo de ${couple}` : undefined} />
      <div className="gf-wrap">
        <section className="gf-card gf-hero">
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
        </section>

        <GuestForm form={form} slug={String(slug)} brand />

        <a className="gf-foot" href="https://withmerry.com" target="_blank" rel="noreferrer">
          <span className="gf-foot-line">
            Formulaire créé avec <b>Merry</b>
          </span>
          <span className="gf-foot-sub">Merry simplifie l'organisation du mariage de A à Z</span>
          <span className="gf-foot-url">withmerry.com</span>
        </a>
      </div>
    </main>
  );
}
